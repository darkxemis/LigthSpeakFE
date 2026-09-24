import { Service, effect, inject, signal } from '@angular/core';
import { VoiceHubService, VoicePeerInfo } from '../../core/realtime/voice-hub.service';
import { UserSettingsService } from '../../core/settings/user-settings.service';
import { VoiceSfxService } from './voice-sfx.service';
import { DEFAULT_USER_SETTINGS } from '../../shared/models/api.models';

export interface PeerConnectionState {
  connectionId: string;
  userId: string;
  username: string;
  profileImageUrl: string | null;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
  );
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

/** Per-peer listening preferences (local to this browser, not synced). */
export interface PeerAudioPref {
  volume: number;
  muted: boolean;
}

const PEER_AUDIO_KEY = 'lightspeak.peerAudio';

function loadPeerAudioPrefs(): Record<string, PeerAudioPref> {
  try {
    const raw = localStorage.getItem(PEER_AUDIO_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<PeerAudioPref> | null>;
    const result: Record<string, PeerAudioPref> = {};
    for (const [userId, pref] of Object.entries(parsed)) {
      if (!pref || typeof pref !== 'object') continue;
      result[userId] = {
        volume:
          typeof pref.volume === 'number' && Number.isFinite(pref.volume)
            ? Math.min(100, Math.max(0, pref.volume))
            : 100,
        muted: pref.muted === true,
      };
    }
    return result;
  } catch {
    return {};
  }
}

interface RemoteAudioEntry {
  audio: HTMLAudioElement;
  userId: string;
}

@Service()
export class VoiceService {
  private readonly hub = inject(VoiceHubService);
  private readonly sfx = inject(VoiceSfxService);
  private readonly settings = inject(UserSettingsService);

  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, { pc: RTCPeerConnection; info: VoicePeerInfo }>();
  private readonly knownPeers = new Map<string, VoicePeerInfo>();
  private readonly remoteAudios = new Map<string, RemoteAudioEntry>();
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
  private lastPttKey = DEFAULT_USER_SETTINGS.pushToTalkKey;

  readonly channelId = this.hub.activeChannelId;
  readonly connecting = signal(false);
  readonly micEnabled = signal(true);
  readonly deafened = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly localStreamSignal = signal<MediaStream | null>(null);
  readonly peersSignal = signal<PeerConnectionState[]>([]);
  readonly localUserId = signal<string | null>(null);
  readonly localSpeaking = signal(false);
  readonly pttActive = signal(false);

  private readonly peerAudioSignal = signal<Record<string, PeerAudioPref>>(
    loadPeerAudioPrefs(),
  );
  readonly peerAudio = this.peerAudioSignal.asReadonly();

  constructor() {
    window.addEventListener('keydown', this.onPttKeyDown);
    window.addEventListener('keyup', this.onPttKeyUp);
    window.addEventListener('blur', this.releasePtt);

    effect(() => {
      const settings = this.settings.settings();
      if (
        this.pttActive() &&
        (this.deafened() ||
          !settings.pushToTalkEnabled ||
          settings.pushToTalkKey !== this.lastPttKey)
      ) {
        this.pttActive.set(false);
      }
      this.lastPttKey = settings.pushToTalkKey;
      this.applyMicState();
      this.applyAudioProcessing();
      this.applyPeerAudio();
    });
  }

  async join(channelId: string, localUserId: string): Promise<void> {
    const activeId = this.hub.activeChannelId();
    if (activeId === channelId) return;
    if (activeId !== null) {
      await this.leave();
    }
    this.errorKey.set(null);
    this.connecting.set(true);
    this.localUserId.set(localUserId);

    try {
      this.ensureSubscribed();
      if (!this.settings.loaded()) {
        await this.settings.load();
      }
      const settings = this.settings.settings();
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: settings.echoCancellationEnabled,
          noiseSuppression: settings.noiseSuppressionEnabled,
          autoGainControl: settings.autoGainControlEnabled,
        },
        video: false,
      });
      this.micEnabled.set(!settings.startMuted);
      this.deafened.set(false);
      this.pttActive.set(false);
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
    this.pttActive.set(false);
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
    this.applyPeerAudio();
    void this.pushVoiceState(false, !this.micEnabled(), next);
  }

  peerVolumeOf(userId: string): number {
    return this.peerAudioSignal()[userId]?.volume ?? 100;
  }

  isPeerMuted(userId: string): boolean {
    return this.peerAudioSignal()[userId]?.muted ?? false;
  }

  setPeerVolume(userId: string, volume: number): void {
    const clamped = Math.min(100, Math.max(0, Math.round(volume)));
    this.peerAudioSignal.update((record) => ({
      ...record,
      [userId]: { volume: clamped, muted: record[userId]?.muted ?? false },
    }));
    this.savePeerAudioPrefs();
    this.applyPeerAudio();
  }

  togglePeerMuted(userId: string): void {
    this.peerAudioSignal.update((record) => ({
      ...record,
      [userId]: {
        volume: record[userId]?.volume ?? 100,
        muted: !(record[userId]?.muted ?? false),
      },
    }));
    this.savePeerAudioPrefs();
    this.applyPeerAudio();
  }

  private savePeerAudioPrefs(): void {
    try {
      localStorage.setItem(PEER_AUDIO_KEY, JSON.stringify(this.peerAudioSignal()));
    } catch {
      // Storage unavailable (private mode, quota…): keep in-memory only.
    }
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
                profileImageUrl: peer.profileImageUrl ?? null,
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
            profileImageUrl: peer.profileImageUrl ?? next[index].profileImageUrl,
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
          profileImageUrl: peer.profileImageUrl ?? null,
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
                profileImageUrl: known?.profileImageUrl ?? null,
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
      profileImageUrl: info.profileImageUrl ?? known?.profileImageUrl ?? null,
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
      this.attachRemoteAudio(resolved.connectionId, remote, resolved.userId);
      this.peersSignal.update((list) => {
        const index = list.findIndex((p) => p.connectionId === resolved.connectionId);
        const prev = index === -1 ? null : list[index];
        const state: PeerConnectionState = {
          connectionId: resolved.connectionId,
          userId: prev?.userId || resolved.userId,
          username: prev?.username || resolved.username,
          profileImageUrl: prev?.profileImageUrl ?? resolved.profileImageUrl ?? null,
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
          profileImageUrl: prev?.profileImageUrl ?? resolved.profileImageUrl ?? null,
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

  private attachRemoteAudio(connectionId: string, stream: MediaStream, userId: string): void {
    let entry = this.remoteAudios.get(connectionId);
    if (!entry) {
      const audio = new Audio();
      audio.autoplay = true;
      entry = { audio, userId };
      this.remoteAudios.set(connectionId, entry);
    }
    if (userId) {
      entry.userId = userId;
    }
    if (entry.audio.srcObject !== stream) {
      entry.audio.srcObject = stream;
    }
    void entry.audio.play().catch(() => undefined);
    this.applyPeerAudio();
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
      audio.audio.pause();
      audio.audio.srcObject = null;
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
    for (const [id, entry] of [...this.remoteAudios]) {
      entry.audio.pause();
      entry.audio.srcObject = null;
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
    const settings = this.settings.settings();
    const base = this.micEnabled() && !this.deafened();
    const pttOpen = !settings.pushToTalkEnabled || this.pttActive();
    const enabled = base && pttOpen;
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  private applyAudioProcessing(): void {
    const settings = this.settings.settings();
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      void track
        .applyConstraints({
          noiseSuppression: settings.noiseSuppressionEnabled,
          echoCancellation: settings.echoCancellationEnabled,
          autoGainControl: settings.autoGainControlEnabled,
        })
        .catch(() => undefined);
    }
  }

  private currentOutputVolume(): number {
    return Math.min(100, Math.max(0, this.settings.settings().outputVolume)) / 100;
  }

  private applyPeerAudio(): void {
    const globalVolume = this.currentOutputVolume();
    const deafened = this.deafened();
    for (const { audio, userId } of this.remoteAudios.values()) {
      const pref = this.peerAudioSignal()[userId];
      const peerVolume = pref?.volume ?? 100;
      audio.volume = Math.min(1, Math.max(0, (globalVolume * peerVolume) / 100));
      audio.muted = deafened || (pref?.muted ?? false);
    }
  }

  private readonly onPttKeyDown = (event: KeyboardEvent): void => {
    if (!this.isPttKey(event) || event.repeat || this.pttActive()) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }
    event.preventDefault();
    this.pttActive.set(true);
    this.applyMicState();
  };

  private readonly onPttKeyUp = (event: KeyboardEvent): void => {
    if (!this.isPttKey(event)) {
      return;
    }
    this.releasePtt();
  };

  private readonly releasePtt = (): void => {
    if (!this.pttActive()) {
      return;
    }
    this.pttActive.set(false);
    this.applyMicState();
    if (this.localSpeaking()) {
      this.localSpeaking.set(false);
      this.silenceTicks = 0;
      void this.pushVoiceState(false, !this.micEnabled(), this.deafened());
    }
  };

  private isPttKey(event: KeyboardEvent): boolean {
    const settings = this.settings.settings();
    return (
      settings.pushToTalkEnabled &&
      this.hub.activeChannelId() !== null &&
      !this.deafened() &&
      event.code === settings.pushToTalkKey
    );
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
