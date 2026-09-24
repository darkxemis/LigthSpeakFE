import { Service, inject } from '@angular/core';
import { ToneService } from '../../core/audio/tone.service';
import { UserSettingsService } from '../../core/settings/user-settings.service';

const PEAK_GAIN = 1;

@Service()
export class VoiceSfxService {
  private readonly tone = inject(ToneService);
  private readonly settings = inject(UserSettingsService);

  playJoin(): void {
    this.playNotes([523.25, 659.25], 0.11);
  }

  playLeave(): void {
    this.playNotes([659.25, 392.0], 0.11);
  }

  private playNotes(frequencies: number[], noteDuration: number): void {
    const settings = this.settings.settings();
    if (!settings.sfxEnabled) {
      return;
    }
    this.tone.play(frequencies, noteDuration, PEAK_GAIN * (settings.outputVolume / 100));
  }
}
