/**
 * Lightweight procedural SFX via Web Audio — no asset files required.
 * Call unlock() from a user gesture (start / resume) before playing.
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._volume = 0.45;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.enabled = false;
        return;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this._volume;
  }

  get t() {
    return this.ctx?.currentTime ?? 0;
  }

  _ok() {
    if (!this.enabled || !this.ctx || !this.master) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  /** Noise buffer (lazy). */
  _noise(seconds = 0.2) {
    if (!this._noiseBuf || this._noiseBuf.duration < seconds) {
      const n = Math.ceil(this.ctx.sampleRate * Math.max(seconds, 0.25));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
    }
    return this._noiseBuf;
  }

  _tone(type, freq, dur, { gain = 0.2, attack = 0.005, decay = 0.08, freqEnd = null, delay = 0 } = {}) {
    if (!this._ok()) return;
    const t0 = this.t + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, dur - decay));
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noiseBurst({ dur = 0.08, gain = 0.15, attack = 0.002, filterFreq = 1200, filterType = 'bandpass', Q = 1, delay = 0 } = {}) {
    if (!this._ok()) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(dur + 0.05);
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    filt.Q.value = Q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  punchSwing() {
    // Air whoosh
    this._noiseBurst({
      dur: 0.12,
      gain: 0.12,
      filterFreq: 1800,
      filterType: 'bandpass',
      Q: 0.8,
    });
    this._tone('triangle', 220, 0.1, { gain: 0.06, freqEnd: 90, attack: 0.01, decay: 0.05 });
  }

  punchHit({ hard = false } = {}) {
    // Flesh / impact thump
    this._tone('sine', hard ? 110 : 140, 0.14, { gain: hard ? 0.35 : 0.22, freqEnd: 45, attack: 0.002, decay: 0.06 });
    this._tone('square', hard ? 90 : 120, 0.08, { gain: hard ? 0.12 : 0.08, freqEnd: 50, attack: 0.001, decay: 0.04 });
    this._noiseBurst({
      dur: hard ? 0.1 : 0.07,
      gain: hard ? 0.22 : 0.14,
      filterFreq: hard ? 600 : 900,
      filterType: 'lowpass',
      Q: 0.7,
    });
  }

  punchMiss() {
    this._noiseBurst({
      dur: 0.06,
      gain: 0.05,
      filterFreq: 2400,
      filterType: 'highpass',
      Q: 0.5,
    });
  }

  playerHurt() {
    this._tone('sawtooth', 180, 0.18, { gain: 0.14, freqEnd: 70, attack: 0.002, decay: 0.08 });
    this._noiseBurst({
      dur: 0.12,
      gain: 0.18,
      filterFreq: 500,
      filterType: 'lowpass',
    });
  }

  knockdown() {
    this._tone('sine', 160, 0.22, { gain: 0.28, freqEnd: 40, attack: 0.002, decay: 0.1 });
    this._noiseBurst({
      dur: 0.16,
      gain: 0.2,
      filterFreq: 350,
      filterType: 'lowpass',
    });
    this._tone('triangle', 90, 0.25, { gain: 0.1, freqEnd: 35, delay: 0.04 });
  }

  macheteDraw() {
    this._noiseBurst({
      dur: 0.1,
      gain: 0.1,
      filterFreq: 2200,
      filterType: 'bandpass',
      Q: 0.9,
    });
    this._tone('triangle', 380, 0.12, { gain: 0.07, freqEnd: 160, attack: 0.005, decay: 0.06 });
  }

  macheteChop() {
    this._noiseBurst({
      dur: 0.14,
      gain: 0.2,
      filterFreq: 1400,
      filterType: 'bandpass',
      Q: 0.7,
    });
    this._tone('sawtooth', 200, 0.1, { gain: 0.1, freqEnd: 70, attack: 0.002, decay: 0.05 });
    this._tone('sine', 90, 0.22, { gain: 0.28, freqEnd: 35, attack: 0.002, decay: 0.1 });
    this._noiseBurst({
      dur: 0.18,
      gain: 0.22,
      filterFreq: 400,
      filterType: 'lowpass',
      delay: 0.04,
    });
  }

  enemyDie() {
    this._tone('triangle', 200, 0.2, { gain: 0.1, freqEnd: 60, attack: 0.005, decay: 0.1 });
    this._noiseBurst({
      dur: 0.14,
      gain: 0.12,
      filterFreq: 700,
      filterType: 'bandpass',
      Q: 1.2,
    });
  }

  breach() {
    this._tone('sawtooth', 140, 0.35, { gain: 0.16, freqEnd: 55, attack: 0.01, decay: 0.15 });
    this._tone('square', 70, 0.4, { gain: 0.1, freqEnd: 40, delay: 0.05 });
  }

  waveStart(wave = 1) {
    const base = 220 + Math.min(8, wave) * 18;
    this._tone('triangle', base, 0.18, { gain: 0.12, freqEnd: base * 1.5, attack: 0.01, decay: 0.06 });
    this._tone('triangle', base * 1.25, 0.22, { gain: 0.1, freqEnd: base * 1.8, delay: 0.1, attack: 0.01, decay: 0.08 });
    this._tone('sine', base * 1.5, 0.28, { gain: 0.08, delay: 0.2, attack: 0.02, decay: 0.1 });
  }

  waveClear(wave = 1) {
    const base = 260 + Math.min(8, wave) * 12;
    this._tone('sine', base, 0.22, { gain: 0.11, freqEnd: base * 1.33, attack: 0.01, decay: 0.08 });
    this._tone('triangle', base * 1.25, 0.28, { gain: 0.1, delay: 0.08, attack: 0.01, decay: 0.1 });
    this._tone('sine', base * 1.5, 0.35, { gain: 0.09, delay: 0.18, attack: 0.02, decay: 0.12 });
    this._tone('sine', base * 2, 0.45, { gain: 0.06, delay: 0.3, attack: 0.02, decay: 0.16 });
  }

  boatLand() {
    this._noiseBurst({
      dur: 0.2,
      gain: 0.1,
      filterFreq: 400,
      filterType: 'lowpass',
    });
    this._tone('sine', 90, 0.18, { gain: 0.08, freqEnd: 50, attack: 0.01, decay: 0.08 });
  }

  gameOver(reason = 'fallen') {
    if (reason === 'breach') {
      this._tone('sawtooth', 180, 0.5, { gain: 0.14, freqEnd: 50, attack: 0.02, decay: 0.2 });
      this._tone('triangle', 120, 0.6, { gain: 0.12, freqEnd: 40, delay: 0.15 });
      this._tone('sine', 80, 0.7, { gain: 0.1, freqEnd: 30, delay: 0.3 });
    } else {
      this._tone('triangle', 220, 0.35, { gain: 0.12, freqEnd: 80, attack: 0.02, decay: 0.15 });
      this._tone('sine', 140, 0.5, { gain: 0.14, freqEnd: 45, delay: 0.12 });
      this._tone('sine', 90, 0.6, { gain: 0.1, freqEnd: 35, delay: 0.28 });
    }
  }

  uiClick() {
    this._tone('square', 520, 0.05, { gain: 0.06, freqEnd: 380, attack: 0.001, decay: 0.02 });
  }

  arrowFire() {
    this._tone('triangle', 640, 0.07, { gain: 0.07, freqEnd: 280, attack: 0.001, decay: 0.03 });
    this._noiseBurst({
      dur: 0.06,
      gain: 0.05,
      filterFreq: 1800,
      filterType: 'bandpass',
    });
  }

  towerPlace() {
    this._tone('square', 180, 0.08, { gain: 0.07, freqEnd: 120, attack: 0.001, decay: 0.04 });
    this._noiseBurst({
      dur: 0.1,
      gain: 0.06,
      filterFreq: 350,
      filterType: 'lowpass',
    });
  }

  towerPickup() {
    this._tone('triangle', 300, 0.08, { gain: 0.06, freqEnd: 420, attack: 0.001, decay: 0.04 });
  }
}
