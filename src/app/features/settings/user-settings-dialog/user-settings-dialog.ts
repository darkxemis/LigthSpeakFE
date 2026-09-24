import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsAvatar } from '../../../shared/ui/avatar';
import { LsIcon, LsIconName } from '../../../shared/ui/icon';
import { SettingsTabId, SettingsUiService } from '../settings-ui.service';
import { AccountTab } from '../tabs/account-tab/account-tab';
import { AppearanceTab } from '../tabs/appearance-tab/appearance-tab';
import { ChatTab } from '../tabs/chat-tab/chat-tab';
import { NotificationsTab } from '../tabs/notifications-tab/notifications-tab';
import { VoiceTab } from '../tabs/voice-tab/voice-tab';

interface SettingsTabItem {
  id: SettingsTabId;
  icon: LsIconName;
  labelKey: string;
  descriptionKey: string;
}

@Component({
  selector: 'ls-user-settings-dialog',
  imports: [
    TranslatePipe,
    LsIcon,
    LsAvatar,
    AccountTab,
    VoiceTab,
    NotificationsTab,
    ChatTab,
    AppearanceTab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-dialog.html',
})
export class UserSettingsDialog {
  readonly ui = inject(SettingsUiService);
  readonly auth = inject(AuthService);

  readonly tabs: readonly SettingsTabItem[] = [
    {
      id: 'account',
      icon: 'user',
      labelKey: 'settings.tab.account',
      descriptionKey: 'settings.tab.accountDesc',
    },
    {
      id: 'voice',
      icon: 'volume',
      labelKey: 'settings.tab.voice',
      descriptionKey: 'settings.tab.voiceDesc',
    },
    {
      id: 'notifications',
      icon: 'bell',
      labelKey: 'settings.tab.notifications',
      descriptionKey: 'settings.tab.notificationsDesc',
    },
    {
      id: 'chat',
      icon: 'send',
      labelKey: 'settings.tab.chat',
      descriptionKey: 'settings.tab.chatDesc',
    },
    {
      id: 'appearance',
      icon: 'spark',
      labelKey: 'settings.tab.appearance',
      descriptionKey: 'settings.tab.appearanceDesc',
    },
  ];

  readonly activeTab = computed(
    () => this.tabs.find((tab) => tab.id === this.ui.activeTab()) ?? this.tabs[0],
  );

  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');

  constructor() {
    effect(() => {
      if (this.ui.open()) {
        queueMicrotask(() => this.panel()?.nativeElement.focus());
      }
    });
  }

  close(): void {
    this.ui.close();
  }
}
