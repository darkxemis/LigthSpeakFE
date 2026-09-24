import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from '../../shared/ui/icon';
import { LsToastHost } from '../../shared/ui/toast-host';
import { ServersService } from '../servers/servers.service';
import { ChatService } from '../chat/chat.service';
import { VoiceService } from '../voice/voice.service';
import { ServerRail } from './server-rail/server-rail';
import { ChannelSidebar } from './channel-sidebar/channel-sidebar';
import { UserBar } from './user-bar/user-bar';

@Component({
  selector: 'ls-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslatePipe,
    LsIcon,
    LsToastHost,
    ServerRail,
    ChannelSidebar,
    UserBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly servers = inject(ServersService);
  private readonly chat = inject(ChatService);
  private readonly voice = inject(VoiceService);
  private readonly router = inject(Router);

  readonly mobileSidebarOpen = signal(false);

  constructor() {
    void this.servers.loadServers();
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  async logout(): Promise<void> {
    await this.servers.clear();
    await this.chat.closeChannel().catch(() => undefined);
    await this.voice.leave().catch(() => undefined);
    await this.auth.logout();
  }
}
