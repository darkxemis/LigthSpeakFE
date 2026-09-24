import { Service, inject, signal } from '@angular/core';
import { VoiceHubService, VoicePeerInfo } from '../../core/realtime/voice-hub.service';
import { VoiceSfxService } from './voice-sfx.service';

export interface PeerConnectionState {
  connectionId: string;
  userId: string;
  username: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

@Service()
export class VoiceService {
  private readonly hub = inject(VoiceHubService);
  private readonly sfx = inject(VoiceSfxService);

  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, { pc: RTCPeerConnection; info: VoicePeerInfo }>();
  private readonly knownPeers = new Map<string, VoicePeerInfo>();
  private readonly remoteAudios = new Map<string, HTMLAudioElement>();
  private readonly pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private subscribed = false;
  private vadContext: AudioContext | null = null;
  private vadAnalyser: AnalyserNode | null = null;
  private vadSource: MediaStreamAudioSourceNode | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private vadBuffer: Uint8Array<ArrayBuffer> | null = null;
  private silenceTicks = 0;
  private lastSentSpeaking = false;
  private lastSentMuted = false;
  private lastSentDeafened = false;

  readonly channelId = this.hub.activeChannelId;
  readonly connecting = signal(false);
  readonly micEnabled = signal(true);
  readonly deafened = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly localStreamSignal = signal<MediaStream | null>(null);
  readonly peersSignal = signal<PeerConnectionState[]>([]);
  readonly localUserId = signal<string | null>(null);
  readonly localSpeaking = signal(false);

  async join(channelId: string, localUserId: string): Promise<void> {
    this.errorKey.set(null);
    this.connecting.set(true);
    this.localUserId.set(localUserId);

    try {
      this.ensureSubscribed();
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      this.applyMicState();
      this.localStreamSignal.set(this.localStream);
      await this.hub.join(channelId);
      this.startVad();
      await this.pushVoiceState(false, !this.micEnabled(), this.deafened());
      this.sfx.playJoin();
    } catch (err) {
      this.errorKey.set('voice.micDenied');
      await this.hub.leave().catch(() => undefined);
      this.stopVad();
      this.cleanupPeers();
      this.stopLocalStream();
      throw err;
    } finally {
      this.connecting.set(false);
    }
  }

  async leave(): Promise<void> {
    const wasConnected = this.hub.activeChannelId() !== null;
    this.stopVad();
    await this.hub.leave().catch(() => undefined);
    if (wasConnected) {
      this.sfx.playLeave();
    }
    this.localSpeaking.set(false);
    this.cleanupPeers();
    this.stopLocalStream();
    this.peersSignal.set([]);
    this.errorKey.set(null);
  }

  toggleMic(): void {
    if (this.deafened()) return;
    this.micEnabled.update((v) => !v);
    this.applyMicState();
    void this.pushVoiceState(false, !this.micEnabled(), false);
  }

  toggleDeafen(): void {
    const next = !this.deafened();
    this.deafened.set(next);
    if (next) {
      this.micEnabled.set(false);
    }
    this.applyMicState();
    this.applyRemotePlayback();
    void this.pushVoiceState(false, !this.micEnabled(), next);
  }

  private ensureSubscribed(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    this.hub.existingPeers$.subscribe((peers) => {
      for (const peer of peers) {
        this.knownPeers.set(peer.connectionId, peer);
        this.peersSignal.update((list) => {
          const index = list.findIndex((p) => p.connectionId === peer.connectionId);
          if (index === -1) {
            return [
              ...list,
              {
                connectionId: peer.connectionId,
                userId: peer.userId,
                username: peer.username,
                stream: null,
                connectionState: 'new' as RTCPeerConnectionState,
                isSpeaking: peer.isSpeaking ?? false,
                isMuted: peer.isMuted ?? false,
                isDeafened: peer.isDeafened ?? false,
              },
            ];
          }
          const next = [...list];
          next[index] = {
            ...next[index],
            userId: peer.userId || next[index].userId,
            username: peer.username || next[index].username,
            isSpeaking: peer.isSpeaking ?? next[index].isSpeaking,
            isMuted: peer.isMuted ?? next[index].isMuted,
            isDeafened: peer.isDeafened ?? next[index].isDeafened,
          };
          return next;
        });
      }
    });

    this.hub.peerJoined$.subscribe(async (peer) => {
      if (peer.userId === this.localUserId()) return;
      this.sfx.playJoin();
      this.knownPeers.set(peer.connectionId, peer);
      this.peersSignal.update((list) => [
        ...list.filter((p) => p.connectionId !== peer.connectionId),
        {
          connectionId: peer.connectionId,
          userId: peer.userId,
          username: peer.username,
          stream: null,
          connectionState: 'new' as RTCPeerConnectionState,
          isSpeaking: false,
          isMuted: false,
          isDeafened: false,
        },
      ]);
      await this.createPeer(peer, true);
    });

    this.hub.peerState$.subscribe((msg) => {
      this.peersSignal.update((list) =>
        list.map((p) =>
          p.connectionId === msg.connectionId
            ? {
                ...p,
                isSpeaking: msg.isSpeaking,
                isMuted: msg.isMuted,
                isDeafened: msg.isDeafened,
              }
            : p,
        ),
      );
    });

    this.hub.peerLeft$.subscribe((connectionId) => {
      const known = this.knownPeers.get(connectionId);
      if (known && known.userId !== this.localUserId()) {
        this.sfx.playLeave();
      }
      this.knownPeers.delete(connectionId);
      this.removePeer(connectionId);
    });

    this.hub.signal$.subscribe(async (msg) => {
      try {
        if (msg.signalType === 'offer') {
          let entry = this.peers.get(msg.fromConnectionId);
          if (!entry) {
            const known = this.knownPeers.get(msg.fromConnectionId);
            entry = await this.createPeer(
              {
                connectionId: msg.fromConnectionId,
                userId: msg.fromUserId || known?.userId || '',
                username: known?.username || '',
              },
              false,
            );
          }
          const { pc } = entry;
          await pc.setRemoteDescription(JSON.parse(msg.payload) as RTCSessionDescriptionInit);
          await this.flushIce(msg.fromConnectionId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await this.hub.sendSignal(msg.fromConnectionId, 'answer', JSON.stringify(pc.localDescription));
          return;
        }

        if (msg.signalType === 'answer') {
          const entry = this.peers.get(msg.fromConnectionId);
          if (!entry) return;
          await entry.pc.setRemoteDescription(JSON.parse(msg.payload) as RTCSessionDescriptionInit);
          await this.flushIce(msg.fromConnectionId, entry.pc);
          return;
        }

        if (msg.signalType === 'ice-candidate') {
          const candidate = JSON.parse(msg.payload) as RTCIceCandidateInit;
          const entry = this.peers.get(msg.fromConnectionId);
          if (entry && entry.pc.remoteDescription) {
            await entry.pc.addIceCandidate(candidate);
          } else {
            const queue = this.pendingIce.get(msg.fromConnectionId) ?? [];
            queue.push(candidate);
            this.pendingIce.set(msg.fromConnectionId, queue);
          }
        }
      } catch (err) {
        console.error('voice signal error', err);
      }
    });
  }

  private async createPeer(
    info: VoicePeerInfo,
    initiate: boolean,
  ): Promise<{ pc: RTCPeerConnection; info: VoicePeerInfo }> {
    this.removePeer(info.connectionId, false);

    const known = this.knownPeers.get(info.connectionId);
    const resolved: VoicePeerInfo = {
      connectionId: info.connectionId,
      userId: info.userId || known?.userId || '',
      username: info.username || known?.username || '',
    };
    this.knownPeers.set(resolved.connectionId, resolved);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const entry = { pc, info: resolved };
    this.peers.set(resolved.connectionId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.hub.sendSignal(
          resolved.connectionId,
          'ice-candidate',
          JSON.stringify(event.candidate.toJSON()),
        );
      }
    };

    pc.ontrack = (event) => {
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      this.attachRemoteAudio(resolved.connectionId, remote);
      this.peersSignal.update((list) => {
        const index = list.findIndex((p) => p.connectionId === resolved.connectionId);
        const prev = index === -1 ? null : list[index];
        const state: PeerConnectionState = {
          connectionId: resolved.connectionId,
          userId: prev?.userId || resolved.userId,
          username: prev?.username || resolved.username,
          stream: remote,
          connectionState: pc.connectionState,
          isSpeaking: prev?.isSpeaking ?? false,
          isMuted: prev?.isMuted ?? false,
          isDeafened: prev?.isDeafened ?? false,
        };
        if (index === -1) return [...list, state];
        const next = [...list];
        next[index] = state;
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      this.peersSignal.update((list) =>
        list.map((p) =>
          p.connectionId === resolved.connectionId
            ? { ...p, connectionState: pc.connectionState }
            : p,
        ),
      );
      if (pc.connectionState === 'failed') {
        this.removePeer(resolved.connectionId);
      }
    };

    if (initiate) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.hub.sendSignal(resolved.connectionId, 'offer', JSON.stringify(pc.localDescription));
    } else {
      this.peersSignal.update((list) => {
        const index = list.findIndex((p) => p.connectionId === resolved.connectionId);
        const prev = index === -1 ? null : list[index];
        const state: PeerConnectionState = {
          connectionId: resolved.connectionId,
          userId: prev?.userId || resolved.userId,
          username: prev?.username || resolved.username,
          stream: null,
          connectionState: pc.connectionState,
          isSpeaking: prev?.isSpeaking ?? false,
          isMuted: prev?.isMuted ?? false,
          isDeafened: prev?.isDeafened ?? false,
        };
        if (index === -1) return [...list, state];
        const next = [...list];
        next[index] = state;
        return next;
      });
    }

    return entry;
  }

  private attachRemoteAudio(connectionId: string, stream: MediaStream): void {
    let audio = this.remoteAudios.get(connectionId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      this.remoteAudios.set(connectionId, audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.muted = this.deafened();
    void audio.play().catch(() => undefined);
  }

  private applyRemotePlayback(): void {
    this.remoteAudios.forEach((audio) => {
      audio.muted = this.deafened();
      if (!this.deafened()) {
        void audio.play().catch(() => undefined);
      }
    });
  }

  private async flushIce(connectionId: string, pc: RTCPeerConnection): Promise<void> {
    const queue = this.pendingIce.get(connectionId) ?? [];
    for (const candidate of queue) {
      await pc.addIceCandidate(candidate);
    }
    this.pendingIce.delete(connectionId);
  }

  private removePeer(connectionId: string, update = true): void {
    const entry = this.peers.get(connectionId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(connectionId);
    }
    this.pendingIce.delete(connectionId);
    const audio = this.remoteAudios.get(connectionId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudios.delete(connectionId);
    }
    if (update) {
      this.peersSignal.update((list) => list.filter((p) => p.connectionId !== connectionId));
    }
  }

  private cleanupPeers(): void {
    for (const id of [...this.peers.keys()]) {
      this.removePeer(id, false);
    }
    for (const [id, audio] of [...this.remoteAudios]) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudios.delete(id);
    }
    this.pendingIce.clear();
    this.knownPeers.clear();
  }

  private stopLocalStream(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.localStreamSignal.set(null);
  }

  private applyMicState(): void {
    const enabled = this.micEnabled() && !this.deafened();
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  private startVad(): void {
    this.stopVad();
    if (!this.localStream) return;

    try {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      this.vadContext = new Ctor();
      if (this.vadContext.state === 'suspended') {
        void this.vadContext.resume().catch(() => undefined);
      }
      this.vadSource = this.vadContext.createMediaStreamSource(this.localStream);
      this.vadAnalyser = this.vadContext.createAnalyser();
      this.vadAnalyser.fftSize = 512;
      this.vadAnalyser.smoothingTimeConstant = 0.8;
      this.vadSource.connect(this.vadAnalyser);
      this.vadBuffer = new Uint8Array(this.vadAnalyser.fftSize);
      this.silenceTicks = 0;
      this.localSpeaking.set(false);
      this.lastSentSpeaking = false;
      this.lastSentMuted = !this.micEnabled();
      this.lastSentDeafened = this.deafened();

      this.vadTimer = setInterval(() => this.tickVad(), 80);
    } catch {
      this.stopVad();
    }
  }

  private stopVad(): void {
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    this.vadSource?.disconnect();
    this.vadAnalyser?.disconnect();
    this.vadSource = null;
    this.vadAnalyser = null;
    this.vadBuffer = null;
    if (this.vadContext && this.vadContext.state !== 'closed') {
      void this.vadContext.close().catch(() => undefined);
    }
    this.vadContext = null;
    this.silenceTicks = 0;
    this.localSpeaking.set(false);
  }

  private tickVad(): void {
    if (!this.vadAnalyser || !this.vadBuffer) return;

    const muted = !this.micEnabled() || this.deafened();
    if (muted) {
      if (this.localSpeaking()) {
        this.localSpeaking.set(false);
      }
      void this.pushVoiceState(false, !this.micEnabled(), this.deafened());
      return;
    }

    this.vadAnalyser.getByteTimeDomainData(this.vadBuffer);
    let sum = 0;
    for (const sample of this.vadBuffer) {
      const v = (sample - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.vadBuffer.length);

    if (rms > 0.02) {
      this.silenceTicks = 0;
      if (!this.localSpeaking()) {
        this.localSpeaking.set(true);
      }
    } else {
      this.silenceTicks += 1;
      if (this.silenceTicks >= 4 && this.localSpeaking()) {
        this.localSpeaking.set(false);
      }
    }

    void this.pushVoiceState(this.localSpeaking(), false, false);
  }

  private async pushVoiceState(isSpeaking: boolean, isMuted: boolean, isDeafened: boolean): Promise<void> {
    if (this.hub.activeChannelId() === null) return;
    if (
      isSpeaking === this.lastSentSpeaking &&
      isMuted === this.lastSentMuted &&
      isDeafened === this.lastSentDeafened
    ) {
      return;
    }
    this.lastSentSpeaking = isSpeaking;
    this.lastSentMuted = isMuted;
    this.lastSentDeafened = isDeafened;
    await this.hub.updateVoiceState(isSpeaking, isMuted, isDeafened);
  }
}
