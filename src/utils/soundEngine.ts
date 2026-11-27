export type SoundKey =
  | 'click'
  | 'pop'
  | 'next'
  | 'whoosh'
  | 'reveal'
  | 'vote'
  | 'tick'
  | 'tickUrgent'
  | 'explosion'
  | 'victory'
  | 'goal'
  | 'correct'
  | 'catch'
  | 'gold'
  | 'defeat'
  | 'wrong'
  | 'error'
  | 'hit'
  | 'slash'
  | 'bounce'
  | 'sting'
  | 'powerup'
  | 'freeze'
  | 'shatter'
  | 'wallBounce'
  | 'heartbeat'
  | 'laser'
  | 'clash'
  | 'splash';

export type MusicTheme = 'spy' | 'arcade';

const MUTE_STORAGE_KEY = 'bakasa_sound_muted';
const MUSIC_MUTE_STORAGE_KEY = 'qada_music_muted';

let lastHapticAt = 0;

export function triggerHaptic(pattern: number | number[] = 15): void {
  if (typeof navigator === 'undefined') return;
  const now = performance.now();
  if (now - lastHapticAt < 28) return;
  lastHapticAt = now;
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration failures on unsupported devices/iframes
    }
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private sfxMasterGain: GainNode | null = null;
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
  private globalListenersBound: boolean = false;
  private lastPlayAt: number = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
      this.musicMuted = localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === 'true';
    } catch {
      this.muted = false;
      this.musicMuted = false;
    }
    this.installGlobalInteractions();
  }

  public installGlobalUnlock(): void {
    this.installGlobalInteractions();
  }

  private installGlobalInteractions(): void {
    if (typeof window === 'undefined' || this.globalListenersBound) return;
    this.globalListenersBound = true;

    const handleFirstGesture = () => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.bufferUnlocked) {
        this.unlock();
      }
    };

    const findInteractiveTarget = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest('button, [role="button"], a[href]');
      if (!(el instanceof HTMLElement)) return null;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return null;
      if (el.dataset.noTactile === 'true' || el.closest('[data-no-tactile="true"]')) return null;
      return el;
    };

    const handlePointerDown = (e: Event) => {
      handleFirstGesture();
      const interactive = findInteractiveTarget(e.target);
      if (interactive) {
        triggerHaptic(15);
      }
    };

    const handleButtonClick = (e: Event) => {
      const interactive = findInteractiveTarget(e.target);
      if (!interactive) return;
      handleFirstGesture();
      // Auto-play crisp tactile click if the button's own handler didn't already play a sound
      const elapsed = performance.now() - this.lastPlayAt;
      if (elapsed > 65) {
        this.play('click');
      }
    };

    window.addEventListener('touchstart', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { capture: true, passive: true });
    window.addEventListener('click', handleButtonClick, { capture: false, passive: true });
  }

  public timeSinceLastPlay(): number {
    return performance.now() - this.lastPlayAt;
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
    if (this.ctx && (!this.sfxMasterGain || !this.compressor)) {
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      this.sfxMasterGain = this.ctx.createGain();
      this.sfxMasterGain.gain.setValueAtTime(0.92, this.ctx.currentTime);

      this.sfxMasterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private getSfxOutput(ctx: AudioContext): AudioNode {
    return this.sfxMasterGain ?? ctx.destination;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Warm pink-tinted noise blend for smoother whooshes and snaps
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, white * 0.55 + (b0 + b1 + b2) * 0.45));
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

  public vibrate(pattern: number | number[] = 15): void {
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
      this.play('pop');
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
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
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
      const barStep = step % 16;
      if (barStep === 0 || barStep === 2 || barStep === 8 || barStep === 10) {
        const isPrimary = barStep === 0 || barStep === 8;
        this.musicTone(ctx, 'sine', isPrimary ? 62 : 55, 36, now, 0.18, isPrimary ? 0.075 : 0.05);
      }
      const spyBass: Record<number, number> = {
        0: 110,
        4: 130.81,
        6: 123.47,
        8: 110,
        12: 146.83,
        14: 138.59,
      };
      if (spyBass[barStep]) {
        this.musicTone(ctx, 'triangle', spyBass[barStep], spyBass[barStep] * 0.98, now, 0.22, 0.042);
      }
      if (barStep % 4 === 3) {
        this.musicNoiseHit(ctx, now, 0.04, 2400, 'highpass', 0.015);
      }
    } else if (this.activeMusic === 'arcade') {
      const barStep = step % 16;
      if (barStep % 4 === 0) {
        this.musicTone(ctx, 'sine', 135, 42, now, 0.11, 0.085);
      }
      if (barStep === 4 || barStep === 12) {
        this.musicNoiseHit(ctx, now, 0.08, 1300, 'bandpass', 0.04);
      }
      if (barStep % 2 === 1) {
        this.musicNoiseHit(ctx, now, 0.025, 5200, 'highpass', 0.02);
      }
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

  // ---- Pro Multi-Layered Web Audio SFX ----

  public play(sound: SoundKey, urgency = 0): void {
    this.lastPlayAt = performance.now();
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
      case 'click':
      case 'pop': {
        // Crisp 3-layer tactile pop: bubble pitch bend + wooden body + micro noise snap
        this.tone(ctx, 'sine', 490, 940, now, 0.042, 0.14);
        this.tone(ctx, 'triangle', 1280, 560, now, 0.026, 0.08);
        this.playFilteredNoise(ctx, now, 0.016, 3200, 'highpass', 0.045);
        break;
      }
      case 'whoosh': {
        // Smooth air-whoosh transition: sweeping bandpass filter + soft air sub tail
        this.playSweepNoise(ctx, now, 0.22, 260, 1850, 540, 1.35, 0.16);
        this.tone(ctx, 'sine', 440, 185, now + 0.01, 0.16, 0.07);
        break;
      }
      case 'next': {
        // Forward whoosh + bright dual-note confirmation chime
        this.playSweepNoise(ctx, now, 0.15, 360, 1600, 720, 1.2, 0.09);
        this.tone(ctx, 'triangle', 466.16, 698.46, now, 0.075, 0.14);
        this.tone(ctx, 'sine', 698.46, 932.33, now + 0.05, 0.09, 0.13);
        break;
      }
      case 'reveal': {
        // Shimmering mystery reveal chord swell
        this.playSweepNoise(ctx, now, 0.18, 500, 2200, 1200, 1.5, 0.06);
        this.tone(ctx, 'sine', 330, 523.25, now, 0.14, 0.13);
        this.tone(ctx, 'triangle', 523.25, 659.25, now + 0.06, 0.16, 0.12);
        this.tone(ctx, 'sine', 783.99, 1046.5, now + 0.12, 0.18, 0.09);
        break;
      }
      case 'vote': {
        this.tone(ctx, 'triangle', 392, 587.33, now, 0.085, 0.15);
        this.tone(ctx, 'sine', 587.33, 783.99, now + 0.045, 0.09, 0.11);
        break;
      }
      case 'correct':
      case 'catch': {
        // Joyful bright major-chord pop + bell overtone
        this.tone(ctx, 'triangle', 523.25, 659.25, now, 0.075, 0.15);
        this.tone(ctx, 'sine', 659.25, 783.99, now + 0.04, 0.09, 0.14);
        this.tone(ctx, 'sine', 1046.5, 1318.5, now + 0.075, 0.12, 0.09);
        break;
      }
      case 'gold': {
        this.tone(ctx, 'triangle', 784, 1175, now, 0.085, 0.17);
        this.tone(ctx, 'triangle', 1175, 1568, now + 0.055, 0.13, 0.15);
        this.tone(ctx, 'sine', 2349, 2637, now + 0.08, 0.14, 0.06);
        break;
      }
      case 'tick': {
        // Precision clock escapement tick scaled with urgency
        const freq = 780 + urgency * 540;
        this.tone(ctx, 'triangle', freq, freq * 0.78, now, 0.032, 0.11);
        this.playFilteredNoise(ctx, now, 0.018, 2800 + urgency * 1200, 'highpass', 0.05);
        break;
      }
      case 'tickUrgent': {
        // Tense final-5-seconds clock pulse + low sub heartbeat
        this.tone(ctx, 'sawtooth', 1220, 880, now, 0.048, 0.12, 2400);
        this.tone(ctx, 'sine', 165, 85, now, 0.055, 0.14);
        this.playFilteredNoise(ctx, now, 0.022, 3400, 'highpass', 0.06);
        break;
      }
      case 'heartbeat': {
        // Cinematic lub-dub heartbeat + tense click
        this.tone(ctx, 'sine', 82, 38, now, 0.12, 0.34);
        this.tone(ctx, 'triangle', 145, 62, now, 0.07, 0.14);
        this.tone(ctx, 'sine', 68, 32, now + 0.16, 0.14, 0.28);
        this.tone(ctx, 'sawtooth', 1040, 720, now, 0.038, 0.085, 2200);
        break;
      }
      case 'error':
      case 'wrong': {
        // Punchy buzzer thud + low descending saw
        this.tone(ctx, 'sawtooth', 230, 145, now, 0.14, 0.13, 1100);
        this.tone(ctx, 'triangle', 180, 115, now + 0.05, 0.13, 0.12);
        this.tone(ctx, 'sine', 110, 68, now, 0.12, 0.14);
        break;
      }
      case 'defeat': {
        // Playful comedic wah-wah descending brass trombone
        const notes = [392, 369.99, 349.23, 293.66];
        notes.forEach((freq, idx) => {
          const isLast = idx === 3;
          const dur = isLast ? 0.38 : 0.125;
          const endFreq = isLast ? freq * 0.78 : freq * 0.95;
          this.tone(ctx, 'sawtooth', freq, endFreq, now + idx * 0.135, dur, 0.11, 1350);
          this.tone(ctx, 'triangle', freq * 0.5, endFreq * 0.5, now + idx * 0.135, dur, 0.08);
        });
        break;
      }
      case 'victory': {
        // Bright major-chord championship fanfare + brass harmonic + sparkle shimmer
        const fanfare = [
          { f: 523.25, t: 0, d: 0.13 },
          { f: 659.25, t: 0.085, d: 0.13 },
          { f: 783.99, t: 0.17, d: 0.15 },
          { f: 1046.5, t: 0.26, d: 0.44 },
        ];
        fanfare.forEach(({ f, t, d }) => {
          this.tone(ctx, 'triangle', f, f, now + t, d, 0.17);
          this.tone(ctx, 'sawtooth', f * 0.5, f * 0.5, now + t, d, 0.065, 2200);
          this.tone(ctx, 'sine', f * 2, f * 2, now + t, d * 0.75, 0.045);
        });
        // Major triad sustain chord on peak note
        this.tone(ctx, 'sine', 659.25, 659.25, now + 0.26, 0.38, 0.08);
        this.tone(ctx, 'sine', 783.99, 783.99, now + 0.26, 0.38, 0.08);
        this.playCrowdCheer(ctx, now + 0.12, 0.95, 0.16);
        break;
      }
      case 'goal': {
        // Stadium goal horn + crowd roar + triumphant major fanfare
        this.tone(ctx, 'sawtooth', 261.63, 261.63, now, 0.38, 0.13, 1800);
        this.tone(ctx, 'sawtooth', 329.63, 329.63, now + 0.03, 0.38, 0.11, 1800);
        this.tone(ctx, 'triangle', 523.25, 1046.5, now + 0.11, 0.36, 0.16);
        this.tone(ctx, 'sine', 783.99, 1046.5, now + 0.16, 0.34, 0.11);
        this.playCrowdCheer(ctx, now + 0.04, 1.3, 0.26);
        break;
      }
      case 'explosion': {
        // Deep bass explosion boom + filtered blast + crackle tail
        this.playExplosionNoise(ctx, now);
        this.tone(ctx, 'sine', 165, 24, now, 0.78, 0.52);
        this.tone(ctx, 'sawtooth', 115, 28, now + 0.02, 0.58, 0.28, 650);
        break;
      }
      case 'hit': {
        this.tone(ctx, 'triangle', 260, 72, now, 0.095, 0.25);
        this.tone(ctx, 'sine', 480, 140, now, 0.06, 0.16);
        this.playFilteredNoise(ctx, now, 0.05, 1100, 'bandpass', 0.18);
        break;
      }
      case 'slash': {
        this.playSweepNoise(ctx, now, 0.1, 3400, 1200, 600, 1.4, 0.16);
        this.tone(ctx, 'sine', 1100, 420, now, 0.075, 0.11);
        break;
      }
      case 'bounce': {
        this.tone(ctx, 'sawtooth', 620, 180, now, 0.15, 0.17, 2400);
        this.tone(ctx, 'square', 340, 130, now + 0.03, 0.13, 0.11, 1600);
        this.playFilteredNoise(ctx, now, 0.06, 2200, 'bandpass', 0.12);
        break;
      }
      case 'wallBounce': {
        this.tone(ctx, 'sine', 195, 90, now, 0.06, 0.07);
        break;
      }
      case 'sting': {
        this.tone(ctx, 'sawtooth', 260, 120, now, 0.18, 0.17, 1400);
        break;
      }
      case 'powerup': {
        this.tone(ctx, 'triangle', 440, 880, now, 0.12, 0.16);
        this.tone(ctx, 'sine', 880, 1320, now + 0.07, 0.14, 0.14);
        break;
      }
      case 'freeze': {
        this.tone(ctx, 'sine', 1320, 660, now, 0.16, 0.16);
        this.tone(ctx, 'triangle', 980, 1480, now + 0.06, 0.18, 0.12);
        break;
      }
      case 'shatter': {
        this.playFilteredNoise(ctx, now, 0.2, 3200, 'highpass', 0.22);
        this.tone(ctx, 'sawtooth', 720, 140, now, 0.16, 0.2, 2600);
        this.tone(ctx, 'square', 460, 110, now + 0.03, 0.18, 0.14, 1800);
        break;
      }
      case 'laser': {
        this.tone(ctx, 'sawtooth', 1240, 260, now, 0.11, 0.13, 2800);
        this.tone(ctx, 'sine', 880, 320, now, 0.08, 0.08);
        break;
      }
      case 'clash': {
        this.playFilteredNoise(ctx, now, 0.085, 3600, 'highpass', 0.19);
        this.tone(ctx, 'square', 960, 320, now, 0.09, 0.11, 2800);
        this.tone(ctx, 'sawtooth', 580, 190, now + 0.01, 0.1, 0.12, 2000);
        break;
      }
      case 'splash': {
        this.playFilteredNoise(ctx, now, 0.26, 950, 'bandpass', 0.24);
        this.tone(ctx, 'sine', 340, 95, now, 0.22, 0.18);
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
    peakGain: number,
    lowpassCutoff?: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dest = this.getSfxOutput(ctx);

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    if (lowpassCutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassCutoff, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.025);
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
    gain.connect(this.getSfxOutput(ctx));
    noise.start(startTime);
    noise.stop(startTime + duration + 0.015);
  }

  private playSweepNoise(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    startFreq: number,
    peakFreq: number,
    endFreq: number,
    q: number,
    peakGain: number
  ): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(q, startTime);
    filter.frequency.setValueAtTime(startFreq, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, peakFreq), startTime + duration * 0.42);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxOutput(ctx));
    noise.start(startTime);
    noise.stop(startTime + duration + 0.02);
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
    gain.connect(this.getSfxOutput(ctx));
    noise.start(startTime);
    noise.stop(startTime + duration + 0.02);
  }

  private playExplosionNoise(ctx: AudioContext, startTime: number): void {
    const duration = 0.98;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.25));
      const crackle = i > ctx.sampleRate * 0.14 && Math.random() < 0.09 ? 1.45 : 1;
      data[i] = (Math.random() * 2 - 1) * env * crackle;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, startTime);
    filter.frequency.exponentialRampToValueAtTime(75, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.62, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxOutput(ctx));

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}

export const soundEngine = new SoundEngine();
export const soundManager = soundEngine;
