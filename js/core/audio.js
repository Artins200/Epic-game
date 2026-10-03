// Процедурный звук на WebAudio — без внешних файлов.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.loops = {};
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    // буфер белого шума
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // буфер "коричневого" шума для двигателей
    this.brown = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      b[i] = last * 3.2;
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; }

  _noiseSrc(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf || this.noise;
    s.loop = true;
    return s;
  }

  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // ---------------- выстрелы / взрывы ----------------
  gunshot(vol = 1, dist = 0) {
    if (!this.ctx) return;
    const t = this.t;
    const att = clamp(1 - dist / 90, 0.12, 1) * vol;
    const src = this._noiseSrc();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200 - dist * 26, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + 0.22);
    const g = this.ctx.createGain();
    this._env(g, t, 0.55 * att, 0.004, 0.19);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.3);

    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const og = this.ctx.createGain();
    this._env(og, t, 0.4 * att, 0.004, 0.16);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.22);
  }

  enemyShot(dist) {
    if (!this.ctx) return;
    const t = this.t;
    const att = clamp(1 - dist / 80, 0.1, 1);
    const src = this._noiseSrc();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    this._env(g, t, 0.3 * att, 0.005, 0.14);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }

  explosion(vol = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const src = this._noiseSrc();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 1.1);
    const g = this.ctx.createGain();
    this._env(g, t, 0.9 * vol, 0.02, 1.2);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 1.6);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 0.9);
    const og = this.ctx.createGain();
    this._env(og, t, 0.8 * vol, 0.01, 0.9);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 1.1);
  }

  impact(surface = 'metal') {
    if (!this.ctx) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = surface === 'flesh' ? 'triangle' : 'square';
    o.frequency.setValueAtTime(surface === 'flesh' ? 220 : 2200, t);
    o.frequency.exponentialRampToValueAtTime(surface === 'flesh' ? 90 : 700, t + 0.08);
    const g = this.ctx.createGain();
    this._env(g, t, 0.16, 0.002, 0.08);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  blip(freq = 900, dur = 0.07, vol = 0.18) {
    if (!this.ctx) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    this._env(g, t, vol, 0.005, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  radioBeep() { this.blip(1250, 0.05, 0.12); }
  hitmarker() { this.blip(1800, 0.05, 0.14); }
  reloadTick(i) { this.blip(300 + i * 180, 0.06, 0.13); }
  empty() { this.blip(180, 0.05, 0.16); }
  pickup() { this.blip(660, 0.08, 0.16); setTimeout(() => this.blip(990, 0.1, 0.14), 80); }
  objective() { this.blip(520, 0.09, 0.14); setTimeout(() => this.blip(780, 0.12, 0.13), 100); }

  footstep() {
    if (!this.ctx) return;
    const t = this.t;
    const src = this._noiseSrc();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 320 + Math.random() * 180; bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    this._env(g, t, 0.13, 0.006, 0.09);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.14);
  }

  // ---------------- сирена / тревога ----------------
  siren(dur = 8) {
    if (!this.ctx) return;
    const t = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 240;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.frequency.value = 620;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 1600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.6);
    g.gain.setValueAtTime(0.16, t + dur - 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(this.master);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  // ---------------- зацикленные шумы (движок, ветер) ----------------
  startLoop(key, kind, freq, vol) {
    if (!this.ctx || this.loops[key]) return;
    const src = this._noiseSrc(kind === 'brown' ? this.brown : this.noise);
    const f = this.ctx.createBiquadFilter();
    f.type = kind === 'brown' ? 'lowpass' : 'bandpass';
    f.frequency.value = freq; f.Q.value = kind === 'brown' ? 0.7 : 1.2;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    let osc = null;
    if (kind === 'engine') {
      osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = 62;
      const og = this.ctx.createGain(); og.gain.value = vol * 0.5;
      osc.connect(og); og.connect(this.master);
      osc.start();
    }
    this.loops[key] = { src, osc, filter: f, gain: g };
  }

  setLoop(key, vol, freq) {
    const l = this.loops[key]; if (!l) return;
    if (vol !== undefined) l.gain.gain.setTargetAtTime(vol, this.t, 0.2);
    if (freq !== undefined && l.osc) l.osc.frequency.setTargetAtTime(freq, this.t, 0.25);
  }

  stopLoop(key, fade = 0.6) {
    const l = this.loops[key]; if (!l) return;
    l.gain.gain.setTargetAtTime(0.0001, this.t, fade / 3);
    const t = this.t + fade + 0.2;
    try { l.src.stop(t); if (l.osc) l.osc.stop(t); } catch (e) { /* уже остановлен */ }
    delete this.loops[key];
  }

  stopAllLoops() { Object.keys(this.loops).forEach(k => this.stopLoop(k, 0.2)); }
}

export const Audio0 = new AudioEngine();
