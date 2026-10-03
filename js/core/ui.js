// Весь DOM-интерфейс: HUD, субтитры, баннеры, экраны.
const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $('hud');
    this.el = {
      objective: $('objective'), waveLine: $('wave-line'), radioInd: $('radio-ind'), radioWho: $('radio-who'),
      timer: $('timer'), stats: $('stats'), hpFill: $('hp-fill'), hpNum: $('hp-num'),
      mag: $('ammo-mag'), res: $('ammo-res'), ammo: $('ammo'), weapon: $('weapon-name'),
      prompt: $('prompt'), promptText: $('prompt-text'), subtitle: $('subtitle'),
      banner: $('banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'),
      damage: $('damage-flash'), hitmarker: $('hitmarker'), crosshair: $('crosshair'),
      fade: $('fade'), chapter: $('chapter-title'), ctNum: $('ct-num'), ctName: $('ct-name'),
      skip: $('skip-hint'), voiceHint: $('voice-hint'), lockHint: $('lock-hint'),
    };
    this._bannerT = 0; this._chapterT = 0; this._hitT = 0; this._dmgT = 0;
  }

  setHud(on) { this.hud.classList.toggle('hidden', !on); }
  setScreen(id, on) { const e = $(id); if (e) e.classList.toggle('hidden', !on); }

  objective(t) { this.el.objective.textContent = t || ''; }
  waveLine(t) { this.el.waveLine.textContent = t || ''; }
  stats(t) { this.el.stats.textContent = t || ''; }

  radio(who) {
    this.el.radioInd.classList.toggle('on', !!who);
    if (who) this.el.radioWho.textContent = who;
  }

  health(hp) {
    const h = Math.max(0, Math.round(hp));
    this.el.hpFill.style.width = h + '%';
    this.el.hpNum.textContent = h;
    this.el.hpFill.classList.toggle('low', h <= 30);
  }

  ammo(mag, res) {
    this.el.mag.textContent = mag;
    this.el.res.textContent = res;
    this.el.ammo.classList.toggle('empty', mag === 0);
  }

  timer(text, cls) {
    const t = this.el.timer;
    t.classList.toggle('hidden', !text);
    t.textContent = text || '';
    t.style.color = cls === 'amber' ? '#ffb020' : '#ff3b30';
  }

  prompt(text) {
    this.el.prompt.classList.toggle('on', !!text);
    if (text) this.el.promptText.textContent = text;
  }

  subtitle(s) {
    const el = this.el.subtitle;
    if (!s) { el.classList.remove('on'); return; }
    el.innerHTML =
      (s.who ? `<span class="who">${s.who}</span>` : '') +
      `<span class="txt">${s.text}</span>`;
    el.classList.add('on');
  }

  banner(main, sub = '', cls = '', dur = 3) {
    const e = this.el;
    e.bannerMain.textContent = main;
    e.bannerMain.className = cls;
    e.bannerSub.textContent = sub;
    e.banner.classList.add('on');
    this._bannerT = dur;
  }

  chapter(num, name, dur = 4.2) {
    this.el.ctNum.textContent = num;
    this.el.ctName.textContent = name;
    this.el.chapter.classList.add('on');
    this._chapterT = dur;
  }

  fade(on, ms = 800) {
    this.el.fade.style.transitionDuration = ms + 'ms';
    this.el.fade.classList.toggle('on', on);
  }

  cinema(on) { document.body.classList.toggle('cinema', on); }
  skipHint(on) { this.el.skip.classList.toggle('hidden', !on); }
  lockHint(on) { this.el.lockHint.classList.toggle('hidden', !on); }

  damage(amount) {
    this.el.damage.style.opacity = String(Math.min(0.95, 0.28 + amount / 90));
    this._dmgT = 0.24;
  }

  hitmarker(kill) {
    this.el.hitmarker.classList.add('on', kill ? 'kill' : '');
    this._hitT = kill ? 0.22 : 0.11;
  }

  spread(on) { this.el.crosshair.classList.toggle('spread', on); }

  endScreen(title, sub, statsArr) {
    $('end-title').textContent = title;
    $('end-sub').textContent = sub;
    $('end-stats').innerHTML = statsArr
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    this.setScreen('end-screen', true);
  }

  update(dt) {
    if (this._bannerT > 0) { this._bannerT -= dt; if (this._bannerT <= 0) this.el.banner.classList.remove('on'); }
    if (this._chapterT > 0) { this._chapterT -= dt; if (this._chapterT <= 0) this.el.chapter.classList.remove('on'); }
    if (this._hitT > 0) { this._hitT -= dt; if (this._hitT <= 0) this.el.hitmarker.classList.remove('on'); }
    if (this._dmgT > 0) { this._dmgT -= dt; if (this._dmgT <= 0) this.el.damage.style.opacity = '0'; }
  }
}
