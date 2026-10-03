// Голос: субтитры всегда, озвучка через speechSynthesis (ru), если система её даёт.
export class Speaker {
  constructor(ui, audio) {
    this.ui = ui;
    this.audio = audio;
    this.enabled = true;
    this.voice = null;
    this.busyUntil = 0;
    this.timer = 0;
    this._pickVoice();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
  }

  _pickVoice() {
    if (typeof speechSynthesis === 'undefined') return;
    const all = speechSynthesis.getVoices() || [];
    this.voice =
      all.find(v => /^ru[-_]RU/i.test(v.lang) && /male|мужск|yuri|pavel|dmitry/i.test(v.name)) ||
      all.find(v => /^ru/i.test(v.lang)) ||
      null;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    if (!v) this.ui.subtitle(null);
  }

  get hasVoice() { return !!this.voice; }

  /** Показывает реплику. Возвращает расчётную длительность в секундах. */
  say({ who, text, radio = true, rate = 1.0, pitch = 1.0, hold = 0 }) {
    const dur = hold > 0 ? hold : Math.max(2.2, 1.15 + text.length * 0.052) / Math.min(1.25, rate);
    this.ui.subtitle({ who, text });
    if (radio && this.audio) this.audio.radioBeep();
    if (this.enabled && this.voice && typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = this.voice;
        u.lang = this.voice.lang || 'ru-RU';
        u.rate = rate;
        u.pitch = pitch;
        u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* озвучка недоступна — остаются субтитры */ }
    }
    this.timer = dur;
    return dur;
  }

  stop() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.timer = 0;
    this.ui.subtitle(null);
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) this.ui.subtitle(null);
    }
  }
}
