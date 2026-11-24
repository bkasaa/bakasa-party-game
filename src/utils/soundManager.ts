export type SoundKey =
  | 'click'
  | 'next'
  | 'reveal'
  | 'vote'
  | 'tick'
  | 'tickUrgent'
  | 'explosion'
  | 'victory'
  | 'goal'
  | 'defeat'
  | 'error'
  | 'hit'
  | 'slash'
  | 'bounce'
  | 'catch'
  | 'gold'
  | 'sting'
  | 'powerup'
  | 'freeze'
  | 'shatter'
  | 'wallBounce';

export type MusicTheme = 'spy' | 'arcade';

const MUTE_STORAGE_KEY = 'bakasa_sound_muted';
const MUSIC_MUTE_STORAGE_KEY = 'qada_music_muted';

export function triggerHaptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration failures on unsupported devices/iframes
    }
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private musicMuted: boolean = false;
  private customUrls: Partial<Record<SoundKey, string>> = {};
  private audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
  private listeners: Set<(muted: boolean) => void> = new Set();
  private musicListeners: Set<(muted: boolean) => void> = new Set();

  // Dynamic background music loop state
  private activeMusic: MusicTheme | null = null;
  private musicTimer: number | null = null;
  private musicStep: number = 0;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bufferUnlocked: boolean = false;
  private unlockListenersBound: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
      this.musicMuted = localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === 'true';
    } catch {
      this.muted = false;
      this.musicMuted = false;
    }
    this.installGlobalUnlock();
  }

  public installGlobalUnlock(): void {
    if (typeof window === 'undefined' || this.unlockListenersBound) return;
    this.unlockListenersBound = true;

    const handleFirstGesture = () => {
      if (this.ctx && this.ctx.state === 'running' && this.bufferUnlocked) {
        return;
      }
      this.unlock();
    };

    window.addEventListener('touchstart', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { capture: true, passive: true });
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

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public unlock(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const primeSilentBuffer = () => {
      if (this.bufferUnlocked) return;
      try {
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);
        this.bufferUnlocked = true;
      } catch {
        // Ignore if context is not yet ready
      }
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          primeSilentBuffer();
          if (this.activeMusic && !this.muted && !this.musicMuted && this.musicTimer === null) {
            this.resumeMusicLoop();
          }
        })
        .catch(() => {});
    } else {
      primeSilentBuffer();
    }
  }

  public vibrate(pattern: number | number[]): void {
    triggerHaptic(pattern);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public setMuted(value: boolean): void {
    this.muted = value;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures
    }
    if (value) {
      this.pauseMusicLoop();
    } else if (this.activeMusic && !this.musicMuted) {
      this.resumeMusicLoop();
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

  public setMusicMuted(value: boolean): void {
    this.musicMuted = value;
    try {
      localStorage.setItem(MUSIC_MUTE_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures
    }
    if (value) {
      this.pauseMusicLoop();
    } else if (this.activeMusic && !this.muted) {
      this.resumeMusicLoop();
    }
    this.musicListeners.forEach((cb) => cb(this.musicMuted));
  }

  public toggleMusicMute(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  public subscribe(cb: (muted: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public subscribeMusic(cb: (muted: boolean) => void): () => void {
    this.musicListeners.add(cb);
    return () => {
      this.musicListeners.delete(cb);
    };
  }

  // ---- Dynamic Background Music Engine ----

  public startMusic(theme: MusicTheme): void {
    if (this.activeMusic === theme && this.musicTimer !== null) return;
    this.activeMusic = theme;
    this.musicStep = 0;
    this.pauseMusicLoop();
    if (!this.muted && !this.musicMuted) {
      this.resumeMusicLoop();
    }
  }

  public stopMusic(): void {
    this.activeMusic = null;
    this.pauseMusicLoop();
  }

  private pauseMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setTargetAtTime(0.0001, now, 0.04);
      } catch {
        // Ignore gain cleanup error
      }
    }
  }

  private resumeMusicLoop(): void {
    if (!this.activeMusic || this.muted || this.musicMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.connect(ctx.destination);
    }
    this.musicGain.gain.setValueAtTime(1, ctx.currentTime);

    const intervalMs = this.activeMusic === 'spy' ? 320 : 145;
    this.tickMusicStep();
    this.musicTimer = window.setInterval(() => {
      this.tickMusicStep();
    }, intervalMs);
  }

  private tickMusicStep(): void {
    if (this.muted || this.musicMuted || !this.activeMusic) {
      this.pauseMusicLoop();
      return;
    }
    const ctx = this.getContext();
    if (!ctx || !this.musicGain || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const step = this.musicStep++;

    if (this.activeMusic === 'spy') {
      // Mysterious stealth heartbeat + low detective bassline
      const barStep = step % 16;
      // Heartbeat sub-thump on beats 0, 2, 8, 10
      if (barStep === 0 || barStep === 2 || barStep === 8 || barStep === 10) {
        const isPrimary = barStep === 0 || barStep === 8;
        this.musicTone(ctx, 'sine', isPrimary ? 62 : 55, 36, now, 0.18, isPrimary ? 0.075 : 0.05);
      }
      // Mysterious minor spy bass pluck
      const spyBass: Record<number, number> = {
        0: 110, // A2
        4: 130.81, // C3
        6: 123.47, // B2
        8: 110, // A2
        12: 146.83, // D3
        14: 138.59, // C#3
      };
      if (spyBass[barStep]) {
        this.musicTone(ctx, 'triangle', spyBass[barStep], spyBass[barStep] * 0.98, now, 0.22, 0.042);
      }
      // Subtle shaker tick on off-beats
      if (barStep % 4 === 3) {
        this.musicNoiseHit(ctx, now, 0.04, 2400, 'highpass', 0.015);
      }
    } else if (this.activeMusic === 'arcade') {
      // Energetic 138 BPM upbeat arcade groove
      const barStep = step % 16;
      // Kick on 0, 4, 8, 12
      if (barStep % 4 === 0) {
        this.musicTone(ctx, 'sine', 135, 42, now, 0.11, 0.085);
      }
      // Snappy snare/clap on 4, 12
      if (barStep === 4 || barStep === 12) {
        this.musicNoiseHit(ctx, now, 0.08, 1300, 'bandpass', 0.04);
      }
      // Closed hi-hat on odd steps
      if (barStep % 2 === 1) {
        this.musicNoiseHit(ctx, now, 0.025, 5200, 'highpass', 0.02);
      }
      // Funky octave chiptune bass
      const bassPattern = [
        130.81, 0, 130.81, 196,
        146.83, 0, 164.81, 0,
        174.61, 0, 174.61, 220,
        196.0, 0, 164.81, 146.83,
      ];
      const bassFreq = bassPattern[barStep];
      if (bassFreq > 0) {
        this.musicTone(ctx, 'triangle', bassFreq, bassFreq, now, 0.1, 0.048);
      }
      // Light sparkling lead blip every 2 bars
      const leadPattern: Record<number, number> = {
        0: 523.25,
        3: 659.25,
        6: 783.99,
        10: 659.25,
        14: 587.33,
      };
      if (Math.floor(step / 16) % 2 === 0 && leadPattern[barStep]) {
        this.musicTone(ctx, 'sine', leadPattern[barStep], leadPattern[barStep], now, 0.09, 0.024);
      }
    }
  }

  private musicTone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    if (!this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private musicNoiseHit(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    freq: number,
    filterType: BiquadFilterType,
    peakGain: number
  ): void {
    if (!this.musicGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
  }

  // ---- Rich Tactile Sound Effects ----

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
        // Tactile warm wooden pop + crisp transient
        this.tone(ctx, 'sine', 420, 740, now, 0.048, 0.14);
        this.tone(ctx, 'triangle', 1200, 520, now, 0.024, 0.07);
        break;
      }
      case 'next': {
        this.tone(ctx, 'triangle', 440, 660, now, 0.08, 0.15);
        this.tone(ctx, 'triangle', 660, 880, now + 0.055, 0.09, 0.14);
        break;
      }
      case 'reveal': {
        // Mystical chord swell
        this.tone(ctx, 'sine', 330, 523.25, now, 0.13, 0.14);
        this.tone(ctx, 'triangle', 523.25, 659.25, now + 0.07, 0.15, 0.12);
        this.tone(ctx, 'sine', 783.99, 1046.5, now + 0.13, 0.16, 0.08);
        break;
      }
      case 'vote': {
        this.tone(ctx, 'triangle', 392, 587.33, now, 0.09, 0.16);
        this.tone(ctx, 'sine', 587.33, 783.99, now + 0.05, 0.08, 0.1);
        break;
      }
      case 'tick': {
        const freq = 760 + urgency * 480;
        this.tone(ctx, 'triangle', freq, freq * 0.82, now, 0.036, 0.1);
        this.playFilteredNoise(ctx, now, 0.02, 2600, 'highpass', 0.04);
        break;
      }
      case 'tickUrgent': {
        this.tone(ctx, 'sawtooth', 1120, 890, now, 0.05, 0.13);
        this.tone(ctx, 'sine', 160, 90, now, 0.05, 0.12);
        break;
      }
      case 'error': {
        this.tone(ctx, 'sawtooth', 240, 155, now, 0.14, 0.12);
        this.tone(ctx, 'triangle', 190, 130, now + 0.06, 0.12, 0.1);
        break;
      }
      case 'defeat': {
        // Playful comic wah-wah descending trombone
        const notes = [392, 369.99, 349.23, 293.66];
        notes.forEach((freq, idx) => {
          const endFreq = idx === 3 ? freq * 0.82 : freq * 0.96;
          this.tone(ctx, 'sawtooth', freq, endFreq, now + idx * 0.13, idx === 3 ? 0.34 : 0.12, 0.1);
        });
        break;
      }
      case 'victory': {
        // Brass/synth championship fanfare + celebratory shimmer
        const fanfare = [
          { f: 523.25, t: 0, d: 0.13 },
          { f: 659.25, t: 0.09, d: 0.13 },
          { f: 783.99, t: 0.18, d: 0.15 },
          { f: 1046.5, t: 0.28, d: 0.42 },
        ];
        fanfare.forEach(({ f, t, d }) => {
          this.tone(ctx, 'triangle', f, f, now + t, d, 0.17);
          this.tone(ctx, 'sawtooth', f * 0.5, f * 0.5, now + t, d, 0.06);
        });
        // Supporting stadium crowd cheer wash
        this.playCrowdCheer(ctx, now + 0.12, 0.9, 0.16);
        break;
      }
      case 'goal': {
        // Stadium goal horn + crowd roar + triumphant chord
        this.tone(ctx, 'sawtooth', 261.63, 261.63, now, 0.38, 0.13);
        this.tone(ctx, 'sawtooth', 329.63, 329.63, now + 0.03, 0.38, 0.11);
        this.tone(ctx, 'triangle', 523.25, 1046.5, now + 0.12, 0.35, 0.16);
        this.playCrowdCheer(ctx, now + 0.05, 1.25, 0.26);
        break;
      }
      case 'explosion': {
        // Layered sub-bass drop + filtered blast + crackle tail
        this.playExplosionNoise(ctx, now);
        this.tone(ctx, 'sine', 150, 26, now, 0.72, 0.48);
        this.tone(ctx, 'sawtooth', 110, 30, now + 0.02, 0.55, 0.28);
        break;
      }
      case 'hit': {
        // Heavy wood/body impact thud + crisp slap
        this.tone(ctx, 'triangle', 260, 72, now, 0.095, 0.25);
        this.tone(ctx, 'sine', 480, 140, now, 0.06, 0.16);
        this.playFilteredNoise(ctx, now, 0.05, 1100, 'bandpass', 0.18);
        break;
      }
      case 'slash': {
        // Metallic knife throw whoosh + blade ring
        this.playFilteredNoise(ctx, now, 0.09, 2800, 'bandpass', 0.16);
        this.tone(ctx, 'sine', 1100, 420, now, 0.075, 0.11);
        break;
      }
      case 'bounce': {
        // Metallic deflection clang
        this.tone(ctx, 'sawtooth', 620, 180, now, 0.15, 0.17);
        this.tone(ctx, 'square', 340, 130, now + 0.03, 0.13, 0.12);
        this.playFilteredNoise(ctx, now, 0.06, 2200, 'bandpass', 0.12);
        break;
      }
      case 'wallBounce': {
        this.tone(ctx, 'sine', 195, 90, now, 0.06, 0.07);
        break;
      }
      case 'catch': {
        this.tone(ctx, 'sine', 490, 920, now, 0.08, 0.16);
        this.tone(ctx, 'triangle', 740, 1120, now + 0.03, 0.06, 0.1);
        break;
      }
      case 'gold': {
        this.tone(ctx, 'triangle', 784, 1175, now, 0.09, 0.18);
        this.tone(ctx, 'triangle', 1175, 1568, now + 0.06, 0.13, 0.16);
        break;
      }
      case 'sting': {
        this.tone(ctx, 'sawtooth', 260, 120, now, 0.18, 0.18);
        break;
      }
      case 'powerup': {
        this.tone(ctx, 'triangle', 440, 880, now, 0.12, 0.16);
        this.tone(ctx, 'sine', 880, 1320, now + 0.08, 0.14, 0.14);
        break;
      }
      case 'freeze': {
        this.tone(ctx, 'sine', 1320, 660, now, 0.16, 0.16);
        this.tone(ctx, 'triangle', 980, 1480, now + 0.06, 0.18, 0.12);
        break;
      }
      case 'shatter': {
        this.playFilteredNoise(ctx, now, 0.2, 3200, 'highpass', 0.22);
        this.tone(ctx, 'sawtooth', 720, 140, now, 0.16, 0.2);
        this.tone(ctx, 'square', 460, 110, now + 0.03, 0.18, 0.15);
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

  private playFilteredNoise(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    freq: number,
    filterType: BiquadFilterType,
    peakGain: number
  ): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration + 0.01);
  }

  private playCrowdCheer(ctx: AudioContext, startTime: number, duration: number, peakGain: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.2, startTime);
    filter.frequency.setValueAtTime(650, startTime);
    filter.frequency.linearRampToValueAtTime(1350, startTime + duration * 0.35);
    filter.frequency.linearRampToValueAtTime(850, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration + 0.02);
  }

  private playExplosionNoise(ctx: AudioContext, startTime: number): void {
    const duration = 0.95;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.24));
      const crackle = i > ctx.sampleRate * 0.15 && Math.random() < 0.08 ? 1.35 : 1;
      data[i] = (Math.random() * 2 - 1) * env * crackle;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1250, startTime);
    filter.frequency.exponentialRampToValueAtTime(85, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.58, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}

export const soundManager = new SoundManager();
