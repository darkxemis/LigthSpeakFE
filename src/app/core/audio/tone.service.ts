import { Service } from '@angular/core';

/** Minimal shared sine-wave tone generator (voice SFX, message sounds…). */
@Service()
export class ToneService {
  private ctx: AudioContext | null = null;

  play(frequencies: number[], noteDuration: number, peakGain: number): void {
    // Clamping at 1.0: any gain above that just clips against full scale, which
    // makes volume changes in the upper range inaudible.
    const gain = Math.min(1, peakGain);
    if (frequencies.length === 0 || gain <= 0) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const start = now + i * noteDuration;

      osc.type = 'sine';
      osc.frequency.value = frequencies[i];

      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);

      osc.connect(noteGain);
      noteGain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration + 0.03);
    }
  }

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }
}
