import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UserSettingsService } from '../../../../core/settings/user-settings.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ACCENT_COLORS, AccentColor } from '../../../../shared/models/api.models';
import { LsIcon } from '../../../../shared/ui/icon';
import { LsSettingRow } from '../../../../shared/ui/setting-row';
import { LsToggle } from '../../../../shared/ui/toggle';

@Component({
  selector: 'ls-appearance-tab',
  imports: [TranslatePipe, LsIcon, LsSettingRow, LsToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appearance-tab.html',
})
export class AppearanceTab {
  readonly settings = inject(UserSettingsService);
  readonly model = this.settings.settings;

  readonly accents = ACCENT_COLORS;

  private readonly accentPreview: Record<AccentColor, string> = {
    cyan: 'linear-gradient(135deg, #22D3EE, #A3E635)',
    lime: 'linear-gradient(135deg, #A3E635, #FACC15)',
    violet: 'linear-gradient(135deg, #A78BFA, #C4B5FD)',
    rose: 'linear-gradient(135deg, #FB7185, #FDA4AF)',
  };

  accentPreviewStyle(accent: AccentColor): string {
    return this.accentPreview[accent];
  }

  selectAccent(accent: AccentColor): void {
    this.settings.patch({ accentColor: accent });
  }
}
