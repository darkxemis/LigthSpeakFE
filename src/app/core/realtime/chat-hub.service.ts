import { Service, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { hubUrls } from '../api/api-urls';
import type { MessageResult } from '../../shared/models/api.models';

export interface TypingEvent {
  userId: string;
  username: string;
}

export interface VoiceUserStateEvent {
  serverId: string;
  channelId: string;
  userId: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

@Service()
export class ChatHubService {
  private readonly auth = inject(AuthService);

  private connection: signalR.HubConnection | null = null;
  private joining = false;
  private currentServerId: string | null = null;

  readonly connected = signal(false);
  readonly currentChannelId = signal<string | null>(null);

  private readonly messageSubject = new Subject<MessageResult>();
  private readonly typingSubject = new Subject<TypingEvent>();
  private readonly voiceRosterSubject = new Subject<{ serverId: string; channelId: string }>();
  private readonly voiceUserStateSubject = new Subject<VoiceUserStateEvent>();

  readonly messages$ = this.messageSubject.asObservable();
  readonly typing$ = this.typingSubject.asObservable();
  readonly voiceRosterUpdated$ = this.voiceRosterSubject.asObservable();
  readonly voiceUserState$ = this.voiceUserStateSubject.asObservable();

  async start(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }
    if (this.joining) return;
    this.joining = true;

    try {
      if (!this.connection) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrls.chat(), {
            accessTokenFactory: () => this.auth.accessToken() ?? '',
            withCredentials: false,
          })
          .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
          .configureLogging(signalR.LogLevel.Warning)
          .build();

        this.connection.on('ReceiveMessage', (message: MessageResult) => {
          this.messageSubject.next(message);
        });
        this.connection.on('UserTyping', (userId: string, username: string) => {
          this.typingSubject.next({ userId, username });
        });
        this.connection.on('VoiceRosterUpdated', (serverId: string, channelId: string) => {
          this.voiceRosterSubject.next({ serverId, channelId });
        });
        this.connection.on(
          'VoiceUserState',
          (
            serverId: string,
            channelId: string,
            userId: string,
            isSpeaking: boolean,
            isMuted: boolean,
            isDeafened: boolean,
          ) => {
            this.voiceUserStateSubject.next({
              serverId,
              channelId,
              userId,
              isSpeaking,
              isMuted,
              isDeafened,
            });
          },
        );
        this.connection.onreconnected(() => {
          this.connected.set(true);
          const channelId = this.currentChannelId();
          if (channelId) {
            void this.connection?.invoke('JoinChannel', channelId);
          }
          const serverId = this.currentServerId;
          if (serverId) {
            void this.connection?.invoke('JoinServerGroup', serverId);
          }
        });
        this.connection.onreconnecting(() => this.connected.set(false));
        this.connection.onclose(() => this.connected.set(false));
      }

      await this.connection.start();
      this.connected.set(true);
    } finally {
      this.joining = false;
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    await this.start();
    const previous = this.currentChannelId();
    if (previous && previous !== channelId) {
      await this.connection?.invoke('LeaveChannel', previous);
    }
    this.currentChannelId.set(channelId);
    await this.connection?.invoke('JoinChannel', channelId);
  }

  async leaveChannel(): Promise<void> {
    const channelId = this.currentChannelId();
    if (channelId) {
      await this.connection?.invoke('LeaveChannel', channelId).catch(() => undefined);
    }
    this.currentChannelId.set(null);
  }

  async joinServerGroup(serverId: string): Promise<void> {
    await this.start();
    const previous = this.currentServerId;
    if (previous && previous !== serverId) {
      await this.connection?.invoke('LeaveServerGroup', previous).catch(() => undefined);
    }
    this.currentServerId = serverId;
    await this.connection?.invoke('JoinServerGroup', serverId);
  }

  async leaveServerGroup(): Promise<void> {
    const serverId = this.currentServerId;
    if (serverId) {
      await this.connection?.invoke('LeaveServerGroup', serverId).catch(() => undefined);
    }
    this.currentServerId = null;
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    await this.start();
    await this.connection?.invoke('SendMessage', channelId, content);
  }

  async sendTyping(channelId: string): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('Typing', channelId).catch(() => undefined);
  }

  async stop(): Promise<void> {
    await this.leaveChannel().catch(() => undefined);
    await this.connection?.stop().catch(() => undefined);
    this.connected.set(false);
  }
}
