/**
 * Zero-dependency Procedural Web Audio API sound synthesizer for Forklift Simulator
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private hydraulicOsc: OscillatorNode | null = null;
  private hydraulicGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.engineGain) {
      this.engineGain.gain.value = muted ? 0 : 0.05;
    }
    if (this.hydraulicGain && muted) {
      this.hydraulicGain.gain.value = 0;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startEngine() {
    this.initContext();
    if (!this.ctx || this.engineOsc || this.isMuted) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55; // idle rumble ~55Hz

      this.engineGain.gain.value = this.isMuted ? 0 : 0.04;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  public updateEngine(speedKmh: number) {
    if (!this.engineOsc || !this.engineGain || !this.ctx) return;
    const absSpeed = Math.abs(speedKmh);
    const targetFreq = 50 + Math.min(absSpeed * 4.5, 90);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

    const targetGain = this.isMuted ? 0 : 0.03 + Math.min(absSpeed * 0.003, 0.05);
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
  }

  public startHydraulics() {
    this.initContext();
    if (!this.ctx || this.isMuted || this.hydraulicOsc) return;

    try {
      this.hydraulicOsc = this.ctx.createOscillator();
      this.hydraulicGain = this.ctx.createGain();

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      filter.Q.value = 3.0;

      this.hydraulicOsc.type = 'triangle';
      this.hydraulicOsc.frequency.value = 320;
      this.hydraulicGain.gain.value = 0.05;

      this.hydraulicOsc.connect(filter);
      filter.connect(this.hydraulicGain);
      this.hydraulicGain.connect(this.ctx.destination);

      this.hydraulicOsc.start();
    } catch {
      // Ignore
    }
  }

  public stopHydraulics() {
    if (this.hydraulicOsc) {
      try {
        this.hydraulicOsc.stop();
        this.hydraulicOsc.disconnect();
      } catch {}
      this.hydraulicOsc = null;
      this.hydraulicGain = null;
    }
  }

  public playHorn() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const hornDuration = 0.44;

      // 1. Frekuensi Rendah Klakson Ganda Industri (Dual-Tone Heavy Industrial Horn):
      // Frekuensi rendah 288 Hz & 348 Hz (selang konsonan industri padat)
      // Ditambah sub-harmonik 144 Hz untuk hentakan bass tegap mesin berat
      const freqLow = 288;
      const freqHigh = 348;
      const freqSub = 144;

      // Master horn gain (keras & berkuasa dengan amplop ADSR tegas)
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.24, now + 0.016); // Serangan punchy 16ms
      masterGain.gain.setValueAtTime(0.24, now + hornDuration - 0.06);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + hornDuration);

      // Filter corong akustik tanduk logam kenderaan berat (Resonant horn bell chamber)
      const hornFilter = this.ctx.createBiquadFilter();
      hornFilter.type = 'lowpass';
      hornFilter.frequency.setValueAtTime(1450, now);
      hornFilter.Q.setValueAtTime(2.2, now);

      // Corong 1 (Nada Rendah - Low Tone + detuning chorus 2.5Hz)
      const oscLow1 = this.ctx.createOscillator();
      oscLow1.type = 'sawtooth';
      oscLow1.frequency.setValueAtTime(freqLow, now);

      const oscLow2 = this.ctx.createOscillator();
      oscLow2.type = 'sawtooth';
      oscLow2.frequency.setValueAtTime(freqLow + 2.5, now);

      // Corong 2 (Nada Tinggi - High Tone + detuning chorus -2.0Hz)
      const oscHigh1 = this.ctx.createOscillator();
      oscHigh1.type = 'sawtooth';
      oscHigh1.frequency.setValueAtTime(freqHigh, now);

      const oscHigh2 = this.ctx.createOscillator();
      oscHigh2.type = 'sawtooth';
      oscHigh2.frequency.setValueAtTime(freqHigh - 2.0, now);

      // Sub-harmonik badan kenderaan berat (Deep metallic body vibration)
      const oscSub = this.ctx.createOscillator();
      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(freqSub, now);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.18, now);
      oscSub.connect(subGain);
      subGain.connect(hornFilter);

      // Sambungkan semua osilator ke penapis corong
      oscLow1.connect(hornFilter);
      oscLow2.connect(hornFilter);
      oscHigh1.connect(hornFilter);
      oscHigh2.connect(hornFilter);

      hornFilter.connect(masterGain);

      // Output langsung ke pembesar suara (Dry path)
      masterGain.connect(this.ctx.destination);

      // 2. Efek Gema Ruang Gudang (Warehouse Acoustic Echo / Reverb Tail)
      const delayNode = this.ctx.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(0.082, now); // pantulan dinding konkrit 82ms

      const feedbackGain = this.ctx.createGain();
      feedbackGain.gain.setValueAtTime(0.32, now);

      const echoFilter = this.ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.setValueAtTime(950, now); // serapan frekuensi tinggi udara gudang

      const echoOutGain = this.ctx.createGain();
      echoOutGain.gain.setValueAtTime(0.20, now);
      echoOutGain.gain.exponentialRampToValueAtTime(0.001, now + hornDuration + 0.38);

      masterGain.connect(delayNode);
      delayNode.connect(echoFilter);
      echoFilter.connect(feedbackGain);
      feedbackGain.connect(delayNode); // feedback loop
      echoFilter.connect(echoOutGain);
      echoOutGain.connect(this.ctx.destination);

      // Mula dan henti semua osilator
      const stopTime = now + hornDuration;
      [oscLow1, oscLow2, oscHigh1, oscHigh2, oscSub].forEach((osc) => {
        osc.start(now);
        osc.stop(stopTime);
      });
    } catch {}
  }

  public playCrateClack() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  public playDeliverySuccess() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const notes = [440, 554.37, 659.25, 880]; // A Major arpeggio
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.09;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    } catch {}
  }

  public playCrash() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Heavy low impact boom (120Hz down to 25Hz)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

      oscGain.gain.setValueAtTime(0.25, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);

      // 2. Harsh noise burst / metal crunch
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 1.2;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.20, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseSource.start(now);
    } catch {}
  }

  public dispose() {
    this.stopHydraulics();
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const sound = new SoundEngine();
