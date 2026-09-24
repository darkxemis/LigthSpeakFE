import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsAvatar } from '../../../shared/ui/avatar';
import { LsIcon } from '../../../shared/ui/icon';
import { SettingsUiService } from '../../settings/settings-ui.service';

@Component({
  selector: 'ls-user-bar',
  imports: [TranslatePipe, LsAvatar, LsIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-bar.html',
})
export class UserBar {
  readonly auth = inject(AuthService);
  readonly settingsUi = inject(SettingsUiService);
  readonly logout = output<void>();
}
