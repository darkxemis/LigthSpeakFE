import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { ServersService } from '../servers.service';
import { ChatService } from '../../chat/chat.service';
import { VoiceService } from '../../voice/voice.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsIcon } from '../../../shared/ui/icon';
import { CreateChannelDialog } from '../create-channel-dialog/create-channel-dialog';
import { parseApiError } from '../../../core/api/api-error';
import { TranslateService } from '../../../core/i18n/translate.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'ls-server-view',
  imports: [RouterOutlet, TranslatePipe, LsIcon, CreateChannelDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './server-view.html',
  styleUrl: './server-view.css',
})
export class ServerViewComponent {
  readonly servers = inject(ServersService);
  private readonly chat = inject(ChatService);
  private readonly voice = inject(VoiceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly createChannelOpen = signal(false);

  constructor() {
    effect(() => {
      const serverId = this.route.snapshot.paramMap.get('serverId');
      if (!serverId) return;
      void this.load(serverId);
    });
  }

  private async load(serverId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.servers.selectServer(serverId);
      await Promise.all([
        this.servers.loadServer(serverId),
        this.servers.loadChannels(serverId),
        this.servers.loadMembers(serverId),
      ]);

      const channelId = this.route.snapshot.paramMap.get('channelId');
      if (!channelId) {
        const firstText = this.servers.textChannels()[0];
        if (firstText) {
          await this.router.navigate(['/app/servers', serverId, 'channels', firstText.id], {
            replaceUrl: true,
          });
        }
      }
    } catch (err) {
      this.error.set(this.translate.translate(`error.${parseApiError(err).tag}`));
      this.toasts.error(this.error() ?? '');
    } finally {
      this.loading.set(false);
    }
  }

  async onChannelCreated(channelId: string): Promise<void> {
    this.createChannelOpen.set(false);
    const serverId = this.route.snapshot.paramMap.get('serverId');
    if (serverId) {
      await this.router.navigate(['/app/servers', serverId, 'channels', channelId]);
    }
  }
}
