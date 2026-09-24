import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { UserSettingsService } from '../../core/settings/user-settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LsIcon } from '../../shared/ui/icon';
import { LsToastHost } from '../../shared/ui/toast-host';
import { ServersService } from '../servers/servers.service';
import { ChatService } from '../chat/chat.service';
import { VoiceService } from '../voice/voice.service';
import { SettingsUiService } from '../settings/settings-ui.service';
import { UserSettingsDialog } from '../settings/user-settings-dialog/user-settings-dialog';
import { CreateChannelDialog } from '../servers/create-channel-dialog/create-channel-dialog';
import { ServerRail } from './server-rail/server-rail';
import { ChannelSidebar } from './channel-sidebar/channel-sidebar';
import { UserBar } from './user-bar/user-bar';

@Component({
  selector: 'ls-shell',
  imports: [
    RouterOutlet,
    TranslatePipe,
    LsIcon,
    LsToastHost,
    ServerRail,
    ChannelSidebar,
    UserBar,
    UserSettingsDialog,
    CreateChannelDialog,
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
  private readonly userSettings = inject(UserSettingsService);
  private readonly settingsUi = inject(SettingsUiService);
  private readonly notifications = inject(NotificationsService);

  readonly mobileSidebarOpen = signal(false);
  readonly createChannelOpen = signal(false);

  constructor() {
    void this.servers.loadServers();
    void this.userSettings.load();
  }

  openSettings(): void {
    this.settingsUi.openDialog();
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
    this.settingsUi.close();
    this.userSettings.reset();
    await this.auth.logout();
  }
}
