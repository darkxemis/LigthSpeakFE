import { ChangeDetectionStrategy, Component, effect, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServersService } from '../../servers/servers.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ChatHubService } from '../../../core/realtime/chat-hub.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsIcon } from '../../../shared/ui/icon';
import { LsAvatar } from '../../../shared/ui/avatar';
import { PeerAudioMenu } from '../../voice/peer-audio-menu/peer-audio-menu';

@Component({
  selector: 'ls-channel-sidebar',
  imports: [RouterLink, TranslatePipe, LsIcon, LsAvatar, PeerAudioMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './channel-sidebar.html',
})
export class ChannelSidebar {
  readonly servers = inject(ServersService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly chatHub = inject(ChatHubService);

  readonly navigate = output<void>();
  readonly createChannel = output<void>();

  readonly voiceParticipants = signal<
    Record<
      string,
      {
        userId: string;
        username: string;
        profileImageUrl: string | null;
        isMuted: boolean;
        isSpeaking: boolean;
        isDeafened: boolean;
      }[]
    >
  >({});

  voiceUsersFor(channelId: string): {
    userId: string;
    username: string;
    profileImageUrl: string | null;
    isMuted: boolean;
    isSpeaking: boolean;
    isDeafened: boolean;
  }[] {
    return this.voiceParticipants()[channelId] ?? [];
  }

  constructor() {
    effect((onCleanup) => {
      const serverId = this.servers.selectedServerId();
      const hasVoice = this.servers.voiceChannels().length > 0;
      if (!serverId || !hasVoice) {
        this.voiceParticipants.set({});
        void this.chatHub.leaveServerGroup().catch(() => undefined);
        return;
      }

      let cancelled = false;
      const refresh = async (): Promise<void> => {
        try {
          const list = await this.servers.loadVoiceParticipants(serverId);
          if (cancelled) return;
          const map: Record<
            string,
            {
              userId: string;
              username: string;
              profileImageUrl: string | null;
              isMuted: boolean;
              isSpeaking: boolean;
              isDeafened: boolean;
            }[]
          > = {};
          for (const item of list) {
            map[item.channelId] = item.participants;
          }
          this.voiceParticipants.set(map);
        } catch {
          // ignore transient roster errors
        }
      };

      void refresh();
      void this.chatHub.joinServerGroup(serverId).catch(() => undefined);
      const rosterSub = this.chatHub.voiceRosterUpdated$.subscribe((evt) => {
        if (evt.serverId === serverId) {
          void refresh();
        }
      });
      const stateSub = this.chatHub.voiceUserState$.subscribe((evt) => {
        if (evt.serverId !== serverId) return;
        this.voiceParticipants.update((map) => {
          const list = map[evt.channelId];
          if (!list) return map;
          return {
            ...map,
            [evt.channelId]: list.map((p) =>
              p.userId === evt.userId
                ? {
                    ...p,
                    isSpeaking: evt.isSpeaking,
                    isMuted: evt.isMuted,
                    isDeafened: evt.isDeafened,
                  }
                : p,
            ),
          };
        });
      });

      const interval = setInterval(() => void refresh(), 5000);
      onCleanup(() => {
        cancelled = true;
        rosterSub.unsubscribe();
        stateSub.unsubscribe();
        clearInterval(interval);
        void this.chatHub.leaveServerGroup().catch(() => undefined);
      });
    });
  }

  isActive(channelId: string): boolean {
    return this.router.url.includes(`/channels/${channelId}`);
  }
}
