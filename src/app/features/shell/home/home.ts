import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LsIcon } from '../../../shared/ui/icon';
import { CreateServerDialog } from '../../servers/create-server-dialog/create-server-dialog';
import { JoinServerDialog } from '../../servers/join-server-dialog/join-server-dialog';
import { SettingsUiService } from '../../settings/settings-ui.service';
import { signal } from '@angular/core';

@Component({
  selector: 'ls-home',
  imports: [TranslatePipe, LsIcon, CreateServerDialog, JoinServerDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly settingsUi = inject(SettingsUiService);
  readonly createOpen = signal(false);
  readonly joinOpen = signal(false);
}
