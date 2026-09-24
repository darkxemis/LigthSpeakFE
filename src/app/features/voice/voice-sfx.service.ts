import { Service } from '@angular/core';

@Service()
export class VoiceSfxService {
  private ctx: AudioContext | null = null;

  playJoin(): void {
    this.playNotes([523.25, 659.25], 0.11);
  }

  playLeave(): void {
    this.playNotes([659.25, 392.0], 0.11);
  }

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

  private playNotes(frequencies: number[], noteDuration: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * noteDuration;

      osc.type = 'sine';
      osc.frequency.value = frequencies[i];

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(2.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration + 0.03);
    }
  }
}
