import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { UserSettingsService } from '../../../../core/settings/user-settings.service';
import { ToneService } from '../../../../core/audio/tone.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import { LsSettingRow } from '../../../../shared/ui/setting-row';
import { LsToggle } from '../../../../shared/ui/toggle';

const PREVIEW_NOTE = 740;
const PREVIEW_DURATION = 0.08;
const PREVIEW_MIN_INTERVAL_MS = 250;

@Component({
  selector: 'ls-voice-tab',
  imports: [TranslatePipe, LsSettingRow, LsToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voice-tab.html',
})
export class VoiceTab {
  readonly settings = inject(UserSettingsService);
  private readonly tone = inject(ToneService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly model = this.settings.settings;
  readonly capturingKey = signal(false);

  private lastPreviewAt = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCapture());
  }

  onVolumeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.settings.patch({ outputVolume: value });
    this.previewVolume(value);
  }

  private previewVolume(value: number): void {
    const now = Date.now();
    if (now - this.lastPreviewAt < PREVIEW_MIN_INTERVAL_MS) {
      return;
    }
    this.lastPreviewAt = now;
    this.tone.play([PREVIEW_NOTE], PREVIEW_DURATION, value / 100);
  }

  startCapture(): void {
    if (this.capturingKey()) {
      return;
    }
    this.capturingKey.set(true);
    window.addEventListener('keydown', this.onCaptureKey);
  }

  private readonly onCaptureKey = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
      this.stopCapture();
      return;
    }
    this.settings.patch({ pushToTalkKey: event.code });
    this.stopCapture();
  };

  private stopCapture(): void {
    window.removeEventListener('keydown', this.onCaptureKey);
    this.capturingKey.set(false);
  }

  keyLabel(code: string): string {
    if (code === 'Space') {
      return this.translate.translate('settings.voice.keySpace');
    }
    if (code.startsWith('Key')) {
      return code.slice(3);
    }
    if (code.startsWith('Digit')) {
      return code.slice(5);
    }
    if (code.startsWith('Numpad')) {
      return `Num ${code.slice(6)}`;
    }
    return code;
  }
}
