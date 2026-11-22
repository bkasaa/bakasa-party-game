export type SoundKey =
  | 'click'
  | 'next'
  | 'reveal'
  | 'vote'
  | 'tick'
  | 'tickUrgent'
  | 'explosion'
  | 'victory'
  | 'error';

const MUTE_STORAGE_KEY = 'bakasa_sound_muted';

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  // Drop-in map for future .mp3/.wav audio assets (e.g. { explosion: '/sounds/boom.mp3' })
  private customUrls: Partial<Record<SoundKey, string>> = {};
  private audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor() {
    try {
      const saved = localStorage.getItem(MUTE_STORAGE_KEY);
      this.muted = saved === 'true';
    } catch {
      this.muted = false;
    }
  }

  public registerAudioAssets(urls: Partial<Record<SoundKey, string>>): void {
    this.customUrls = { ...this.customUrls, ...urls };
    Object.entries(urls).forEach(([key, src]) => {
      if (src) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        this.audioCache[key as SoundKey] = audio;
      }
    });
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.getContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(value: boolean): void {
    this.muted = value;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures
    }
    this.listeners.forEach((cb) => cb(this.muted));
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.play('click');
    }
    return this.muted;
  }

  public subscribe(cb: (muted: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public play(sound: SoundKey, urgency = 0): void {
    if (this.muted) return;

    const customUrl = this.customUrls[sound];
    if (customUrl) {
      try {
        const cached = this.audioCache[sound];
        const audio = cached ? (cached.cloneNode() as HTMLAudioElement) : new Audio(customUrl);
        audio.volume = 0.85;
        audio.play().catch(() => {
          this.playSynth(sound, urgency);
        });
        return;
      } catch {
        // Fallback to synth
      }
    }

    this.playSynth(sound, urgency);
  }

  private playSynth(sound: SoundKey, urgency: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (sound) {
      case 'click': {
        this.tone(ctx, 'sine', 520, 680, now, 0.055, 0.14);
        break;
      }
      case 'next': {
        this.tone(ctx, 'triangle', 440, 660, now, 0.08, 0.16);
        this.tone(ctx, 'triangle', 660, 880, now + 0.06, 0.08, 0.14);
        break;
      }
      case 'reveal': {
        this.tone(ctx, 'sine', 330, 523.25, now, 0.12, 0.14);
        this.tone(ctx, 'sine', 523.25, 659.25, now + 0.08, 0.14, 0.12);
        break;
      }
      case 'vote': {
        this.tone(ctx, 'triangle', 392, 523, now, 0.09, 0.16);
        break;
      }
      case 'tick': {
        const freq = 750 + urgency * 450;
        this.tone(ctx, 'square', freq, freq * 0.85, now, 0.035, 0.09);
        break;
      }
      case 'tickUrgent': {
        this.tone(ctx, 'sawtooth', 1100, 950, now, 0.045, 0.14);
        break;
      }
      case 'error': {
        this.tone(ctx, 'sawtooth', 240, 170, now, 0.12, 0.12);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          this.tone(ctx, 'triangle', freq, freq, now + idx * 0.09, 0.16, 0.16);
        });
        break;
      }
      case 'explosion': {
        this.playExplosionNoise(ctx, now);
        this.tone(ctx, 'sawtooth', 140, 32, now, 0.65, 0.45);
        break;
      }
    }
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playExplosionNoise(ctx: AudioContext, startTime: number): void {
    const duration = 0.85;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.22));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, startTime);
    filter.frequency.exponentialRampToValueAtTime(90, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}

export const soundManager = new SoundManager();
