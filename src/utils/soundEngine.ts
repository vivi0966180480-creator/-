import type { SoundTheme } from '../types';

class ClassroomSoundEngine {
  private ctx: AudioContext | null = null;
  private volume = 0.7;
  private theme: SoundTheme = 'marimba';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setTheme(theme: SoundTheme): void {
    this.theme = theme;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Short crisp tick during spinning / reel rolling.
   * progress: 0 (start) -> 1 (near stop), subtly rising pitch for excitement.
   */
  public playTick(progress = 0.5): void {
    if (this.theme === 'mute' || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = this.theme === 'marimba' ? 420 : 660;
    const freq = baseFreq + progress * 240;

    osc.type = this.theme === 'marimba' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.045);

    const peakGain = this.volume * (this.theme === 'marimba' ? 0.24 : 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Bright celebratory arpeggio when a student is chosen.
   */
  public playWinnerFanfare(): void {
    if (this.theme === 'mute' || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 - E5 - G5 - C6 joyful bright major chord cascade
    const notes = this.theme === 'marimba' ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880.0, 1174.66];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const duration = idx === notes.length - 1 ? 0.65 : 0.28;

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.theme === 'marimba' ? 'triangle' : 'sine';
      overtone.type = 'sine';

      osc.frequency.setValueAtTime(freq, start);
      overtone.frequency.setValueAtTime(freq * 2, start);

      const peak = this.volume * (idx === notes.length - 1 ? 0.28 : 0.2);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.25, start);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + duration + 0.02);
      overtone.stop(start + duration + 0.02);
    });
  }

  /**
   * Light playful cascade when automatically creating groups.
   */
  public playGroupShuffle(): void {
    if (this.theme === 'mute' || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const start = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(this.volume * 0.16, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /**
   * Subtle tactile pop when manually swapping two students between groups.
   */
  public playSwapPop(): void {
    if (this.theme === 'mute' || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

export const soundEngine = new ClassroomSoundEngine();
