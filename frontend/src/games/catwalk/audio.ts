import type { GameEventType } from './engine/game';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class CatwalkAudio {
  enabled = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (this.enabled) await this.ensureReady();
    return this.enabled;
  }

  play(event: GameEventType): void {
    if (!this.enabled || !this.context || !this.master) return;
    const patterns: Partial<Record<GameEventType, Array<[number, number, number]>>> = {
      step: [[260, 0, 0.035]],
      caught: [[120, 0, 0.16], [92, 0.08, 0.2]],
      splash: [[180, 0, 0.1], [110, 0.07, 0.18]],
      home: [[440, 0, 0.1], [660, 0.09, 0.14]],
      level: [[440, 0, 0.12], [554, 0.1, 0.12], [740, 0.2, 0.18]],
      start: [[330, 0, 0.08], [495, 0.08, 0.12]],
      pause: [[220, 0, 0.09]],
      resume: [[330, 0, 0.09]],
      defeat: [[170, 0, 0.18], [130, 0.15, 0.25]],
    };
    patterns[event]?.forEach(([frequency, delay, duration]) => this.note(frequency, delay, duration));
  }

  private async ensureReady(): Promise<void> {
    const AudioContextClass = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  private note(frequency: number, delay: number, duration: number): void {
    if (!this.context || !this.master) return;
    const startsAt = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.035, startsAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.02);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
  }
}