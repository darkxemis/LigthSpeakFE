import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UserSettingsService } from '../../../../core/settings/user-settings.service';
import { TranslateService } from '../../../../core/i18n/translate.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LsSettingRow } from '../../../../shared/ui/setting-row';
import { LsToggle } from '../../../../shared/ui/toggle';

@Component({
  selector: 'ls-notifications-tab',
  imports: [TranslatePipe, LsSettingRow, LsToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-tab.html',
})
export class NotificationsTab {
  readonly settings = inject(UserSettingsService);
  private readonly translate = inject(TranslateService);
  private readonly toasts = inject(ToastService);

  readonly model = this.settings.settings;
  readonly canUseDesktopNotifications = typeof Notification !== 'undefined';

  async setDesktopNotifications(enabled: boolean): Promise<void> {
    if (enabled && this.canUseDesktopNotifications) {
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      if (permission !== 'granted') {
        this.toasts.error(
          this.translate.translate('settings.notifications.permissionDenied'),
        );
        return;
      }
    }
    this.settings.patch({ desktopNotificationsEnabled: enabled });
  }
}
