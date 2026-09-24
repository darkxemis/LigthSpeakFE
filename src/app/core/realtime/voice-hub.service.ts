import { Service, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { hubUrls } from '../api/api-urls';

export interface VoicePeerInfo {
  connectionId: string;
  userId: string;
  username: string;
  profileImageUrl?: string | null;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isDeafened?: boolean;
}

export interface VoiceSignalMessage {
  fromConnectionId: string;
  fromUserId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  payload: string;
}

export interface VoicePeerStateMessage {
  connectionId: string;
  userId: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

export type VoiceSignalType = VoiceSignalMessage['signalType'];

@Service()
export class VoiceHubService {
  private readonly auth = inject(AuthService);

  private connection: signalR.HubConnection | null = null;
  private starting: Promise<void> | null = null;

  readonly connected = signal(false);
  readonly activeChannelId = signal<string | null>(null);

  private readonly peerJoinedSubject = new Subject<VoicePeerInfo>();
  private readonly peerLeftSubject = new Subject<string>();
  private readonly existingPeersSubject = new Subject<VoicePeerInfo[]>();
  private readonly signalSubject = new Subject<VoiceSignalMessage>();
  private readonly peerStateSubject = new Subject<VoicePeerStateMessage>();

  readonly peerJoined$ = this.peerJoinedSubject.asObservable();
  readonly peerLeft$ = this.peerLeftSubject.asObservable();
  readonly existingPeers$ = this.existingPeersSubject.asObservable();
  readonly signal$ = this.signalSubject.asObservable();
  readonly peerState$ = this.peerStateSubject.asObservable();

  async start(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }
    if (this.starting) {
      return this.starting;
    }

    this.starting = (async () => {
      if (!this.connection) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrls.voice(), {
            accessTokenFactory: () => this.auth.accessToken() ?? '',
            withCredentials: false,
          })
          .withAutomaticReconnect([0, 1000, 2000, 5000])
          .configureLogging(signalR.LogLevel.Warning)
          .build();

        this.connection.on('ExistingPeers', (peers: VoicePeerInfo[]) => {
          this.existingPeersSubject.next(peers);
        });
        this.connection.on('PeerJoined', (peer: VoicePeerInfo) => {
          this.peerJoinedSubject.next(peer);
        });
        this.connection.on('PeerLeft', (connectionId: string) => {
          this.peerLeftSubject.next(connectionId);
        });
        this.connection.on('ReceiveSignal', (msg: VoiceSignalMessage) => {
          this.signalSubject.next(msg);
        });
        this.connection.on('PeerState', (msg: VoicePeerStateMessage) => {
          this.peerStateSubject.next(msg);
        });
        this.connection.onreconnected(() => this.connected.set(true));
        this.connection.onclose(() => {
          this.connected.set(false);
          this.activeChannelId.set(null);
        });
      }

      await this.connection.start();
      this.connected.set(true);
    })().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  async join(channelId: string): Promise<void> {
    await this.start();
    const previous = this.activeChannelId();
    if (previous && previous !== channelId) {
      await this.connection?.invoke('LeaveVoiceChannel', previous).catch(() => undefined);
    }
    this.activeChannelId.set(channelId);
    await this.connection?.invoke('JoinVoiceChannel', channelId);
  }

  async leave(): Promise<void> {
    const channelId = this.activeChannelId();
    if (channelId) {
      await this.connection?.invoke('LeaveVoiceChannel', channelId).catch(() => undefined);
    }
    this.activeChannelId.set(null);
  }

  async sendSignal(targetConnectionId: string, signalType: VoiceSignalType, payload: string): Promise<void> {
    await this.connection?.invoke('SendSignal', targetConnectionId, signalType, payload);
  }

  async updateVoiceState(isSpeaking: boolean, isMuted: boolean, isDeafened: boolean): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('UpdateVoiceState', isSpeaking, isMuted, isDeafened).catch(() => undefined);
  }

  async stop(): Promise<void> {
    await this.leave().catch(() => undefined);
    await this.connection?.stop().catch(() => undefined);
    this.connected.set(false);
  }
}
