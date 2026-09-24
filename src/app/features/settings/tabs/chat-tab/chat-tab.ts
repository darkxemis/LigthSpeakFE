import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UserSettingsService } from '../../../../core/settings/user-settings.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LsSettingRow } from '../../../../shared/ui/setting-row';
import { LsToggle } from '../../../../shared/ui/toggle';

@Component({
  selector: 'ls-chat-tab',
  imports: [TranslatePipe, LsSettingRow, LsToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-tab.html',
})
export class ChatTab {
  readonly settings = inject(UserSettingsService);
  readonly model = this.settings.settings;
}
