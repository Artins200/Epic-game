// Ядро игры: состояния, волны, паника, эвакуация, подвал.
import * as THREE from '../vendor/three.module.js';
import { UI } from './core/ui.js';
import { Audio0 as Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Speaker } from './core/speech.js';
import { Effects } from './core/effects.js';
import { Player } from './core/player.js';
import { Enemy, ST, makeSoldier } from './core/actors.js';
import { buildBase } from './world/base.js';
import { buildBasement, makeBasementGround } from './world/basement.js';
import { IntroScene } from './scenes/intro.js';
import { Rig, Timeline, makeTransport } from './scenes/cutscene.js';

const WAVES = [
  { count: 5, types: ['rifle'] },
  { count: 7, types: ['rifle'] },
  { count: 8, types: ['rifle'] },
  { count: 9, types: ['rifle', 'rifle', 'heavy'] },
  { count: 10, types: ['rifle', 'rifle', 'heavy'] },
  { count: 11, types: ['rifle', 'heavy'] },
  { count: 12, types: ['rifle', 'heavy', 'rifle'] },
  { count: 13, types: ['rifle', 'heavy', 'fanatic'] },
  { count: 15, types: ['rifle', 'heavy', 'fanatic', 'rifle'] },
];
const HOLDOUT = 120; // секунд, 10-я волна

const rayAABB = (o, d, min, max) => {
  let tmin = -Infinity, tmax = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    if (Math.abs(d[ax]) < 1e-8) {
      if (o[ax] < min[ax] || o[ax] > max[ax]) return Infinity;
      continue;
    }
    let t1 = (min[ax] - o[ax]) / d[ax];
    let t2 = (max[ax] - o[ax]) / d[ax];
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin > 0 ? tmin : (tmax > 0 ? 0 : Infinity);
};

const raySphere = (o, d, c, r) => {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc > 0 && b > 0) return Infinity;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? -b + Math.sqrt(disc) : t;
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 4000);

    this.ui = new UI();
    this.audio = Audio;
    this.input = new Input(this.canvas);
    this.speaker = new Speaker(this.ui, this.audio);

    this.clock = new THREE.Clock();
    this.mode = 'menu';
    this.paused = false;
    this.stats = { kills: 0, spared: 0, escaped: 0, tech: 0, start: 0, headshots: 0 };

    // мир
    this.base = buildBase();
    this.basement = buildBasement();
    this.basementGround = makeBasementGround(this.basement.stepTops);

    this.scene = this.base.scene;
    this.colliders = this.base.colliders;
    this.fxBase = new Effects(this.base.scene);
    this.fxBasement = new Effects(this.basement.scene);
    this.effects = this.fxBase;

    this.player = new Player(this);
    this.scene.add(this.player.body);
    this.player.attachTo(this.camera);
    this.scene.add(this.camera);

    this.enemies = [];
    this.interactables = [];
    this.portals = [];
    this.rig = new Rig(this.camera);

    this._buildPortals();
    this._bindUI();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && (this.mode === 'base' || this.mode === 'basement') && !this.paused) this.pause(true);
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (this.mode === 'base' || this.mode === 'basement') this.pause(!this.paused);
      }
      if (e.code === 'KeyF') {
        this.speaker.setEnabled(!this.speaker.enabled);
        this.ui.banner(this.speaker.enabled ? 'ГОЛОС ВКЛ' : 'ГОЛОС ВЫКЛ (субтитры)', '', 'green', 1.4);
      }
      if ((e.code === 'Space' || e.code === 'Enter') && (this.mode === 'intro' || this.mode === 'evac')) this.skipCutscene();
    });

    this._menuCam = { a: 0 };
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ================== UI / кнопки ==================
  _bindUI() {
    document.getElementById('btn-start').onclick = () => this.beginOperation();
    document.getElementById('btn-resume').onclick = () => this.pause(false);
    document.getElementById('btn-restart').onclick = () => location.reload();
    document.getElementById('btn-again').onclick = () => location.reload();
    this.canvas.addEventListener('mousedown', () => {
      if ((this.mode === 'intro' || this.mode === 'evac') && this._cutsceneSkipOk) this.skipCutscene();
      // захват курсора возможен только по жесту пользователя
      if ((this.mode === 'base' || this.mode === 'basement') && !this.paused && !this.input.locked) {
        this.input.lock();
        this.input.mouseDown = false;
        this.ui.lockHint(false);
      }
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ================== порталы ==================
  _portalMesh(color) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.13, 8, 28),
      new THREE.MeshBasicMaterial({ color }));
    g.add(ring);
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){
          vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y,p.x);
          float w = sin(r*10.0 - uTime*3.0 + sin(a*3.0+uTime*1.4)*1.6);
          float glow = smoothstep(1.0, 0.15, r);
          vec3 c = mix(uColor*0.45, vec3(0.85,0.97,1.0), 0.5+0.5*w);
          gl_FragColor = vec4(c, glow*(0.55+0.4*w));
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), mat);
    g.add(disc);
    const light = new THREE.PointLight(color, 2.2, 16, 2);
    g.add(light);
    g.userData.mat = mat;
    g.visible = false;
    return g;
  }

  _buildPortals() {
    this.hatchPortal = this._portalMesh(0x4fd6ff);
    this.hatchPortal.rotation.x = -Math.PI / 2;
    this.hatchPortal.scale.setScalar(0.75);
    this.hatchPortal.position.copy(this.base.hatchPos).setY(0.25);
    this.base.scene.add(this.hatchPortal);
    this.portals.push(this.hatchPortal);

    this.exitPortal = this._portalMesh(0x7dff9a);
    this.exitPortal.position.copy(this.basement.exitPos).setY(-4 + 1.6);
    this.basement.scene.add(this.exitPortal);
    this.portals.push(this.exitPortal);
  }

  // ================== запуск ==================
  beginOperation() {
    this.audio.init();
    this.audio.resume();
    this.ui.setScreen('start-screen', false);
    this.stats.start = performance.now();
    this.intro = new IntroScene(this, this.camera);
    this.scene.remove(this.player.body);
    this.mode = 'intro';
    this.intro.start();
    setTimeout(() => { this._cutsceneSkipOk = true; }, 1500);
  }

  onIntroFinished() {
    this.mode = 'landing';
    this.ui.fade(true, 100);
    setTimeout(() => {
      this.scene.add(this.player.body);
      this.player.body.visible = false;
      this.player.bodyParts.gun.visible = true;
      this.player.bodyParts.legL.rotation.x = 0;
      this.player.bodyParts.legR.rotation.x = 0;
      this.player.pos.set(50, 0, -22);
      this.player.yaw = Math.atan2(50, 22);
      this.player.pitch = -0.05;
      this.player.hp = 100;
      this.scene = this.base.scene;
      this.colliders = this.base.colliders;
      this.effects.clear();
      this._addWeaponCrate();
      this._addConsoleInteraction();
      this._addHatchInteraction();
      this.scene.add(this.camera);
      this.mode = 'base';
      this.chapter = 2;
      this.ui.setHud(true);
      this.ui.cinema(false);
      this.ui.fade(false, 1200);
      this.ui.chapter('ГЛАВА 2', 'КВАДРАТ 7');
      this.ui.objective('Найти сброшенный ящик и взять оружие');
      this.speaker.say({
        who: 'КОМАНДИР (радио)',
        text: 'Ты на земле. Ящик с твоим стволом рядом. Дальше — центральное здание, там аппаратура связи. Доложи, как вступишь на базу.',
      });
      this.input.lock();
      this.waveState = 'pre';
      this.preT = 4;
      this.ui.waveLine('Противник: база не зачищена');
    }, 900);
  }

  _addWeaponCrate() {
    const crate = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x5b6137 }));
    crate.add(b);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.14, 1.24), new THREE.MeshLambertMaterial({ color: 0xffb020 }));
    strip.position.y = 0.1; crate.add(strip);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c0, side: THREE.DoubleSide }));
    chute.position.y = 4.6; crate.add(chute);
    for (const dx of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      l.position.set(dx * 0.45, 2.3, 0); l.rotation.z = dx * 0.14; crate.add(l);
    }
    crate.position.set(53, 0.45, -19);
    this.base.scene.add(crate);
    this.weaponCrate = crate;
    this.interactables.push({
      pos: new THREE.Vector3(53, 1, -19), radius: 3.4, label: 'Взять винтовку',
      once: true, action: () => {
        this.player.setWeapon(true);
        this.audio.pickup();
        crate.remove(chute);
        crate.position.y = 0.45;
        this.ui.banner('АК-74 «ВИХРЬ»', 'боезапас 30 / 180', 'green', 2.4);
        this.ui.objective('Добраться до центрального здания и выйти на связь');
        this.ui.waveLine('Аппаратура связи — внутри штаба в центре базы');
        this.waveState = 'pre'; this.preT = 6;
      },
    });
  }

  _addConsoleInteraction() {
    this.interactables.push({
      pos: this.base.consolePos.clone(), radius: 3.4, label: 'Аппаратура связи: выйти на связь',
      action: () => this.useConsole(),
    });
  }

  _addHatchInteraction() {
    this.hatchLocked = {
      pos: this.base.hatchPos.clone().setY(1), radius: 2.8,
      label: 'Люк в подвал: заблокирован',
      action: () => this.speaker.say({
        who: 'КОМАНДИР (радио)',
        text: 'Люк в подвал заблокирован, пока база наверху не наша. Сначала зачистка, потом данные.',
        hold: 3.4,
      }),
    };
    this.interactables.push(this.hatchLocked);
  }

  useConsole() {
    this.audio.radioBeep();
    const S = this.speaker;
    if (!this.consoleUsed) {
      this.consoleUsed = true;
      this.ui.banner('СВЯЗЬ УСТАНОВЛЕНА', 'штаб на проводе', 'green', 2.6);
      const seq = [
        [0.2, { who: 'АППАРАТУРА ШТАБА', text: 'Приём... Слышу тебя, десант. Канал чистый, докладывай.' }],
        [4.2, { who: 'КОМАНДИР', text: 'Уходить ещё рано. Выход на следующую точку заблокирован, пока база не зачищена.' }],
        [10.0, { who: 'КОМАНДИР', text: 'По данным разведки, скоро подмога десантируется. Держи позицию и отбивай волны, сколько понадобишься.' }],
        [17.5, { who: 'КОМАНДИР', text: 'Их уже подняли по тревоге. Девять волн, боец. Дальше будет борт.' }],
      ];
      seq.forEach(([t, line]) => setTimeout(() => {
        if (this.mode !== 'base') return;
        S.say(line);
      }, t * 1000));
      this.ui.objective('Держать базу: отбить 9 волн');
      this.audio.siren(5);
      setTimeout(() => {
        if (this.mode === 'base' && this.waveState === 'pre') {
          this.waveState = 'intermission';
          this.interT = 6;
          this.ui.banner('КОНТАКТ', 'противник обнаружил десант', 'red', 2.6);
        }
      }, 19500);
    } else if (this.waveState === 'holdout') {
      S.say({ who: 'КОМАНДИР', text: 'Держись, борт уже близко. Не высовывайся лишний раз.', hold: 3 });
    } else if (this.waveState === 'panic') {
      S.say({ who: 'КОМАНДИР', text: 'Они бегут. Не давай фанатикам зайти тебе в спину.', hold: 3 });
    } else {
      S.say({
        who: 'КОМАНДИР',
        text: 'Держим позицию. Волна ' + Math.min(9, this.wave + 1) + ' на подходе, подмога уже в воздухе.',
        hold: 3.4,
      });
    }
  }

  // ================== волны ==================
  get playerAlive() { return this.player.alive && !this.player.locked; }

  aliveEnemies(aggressiveOnly = false) {
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.isAlly) continue;
      if (aggressiveOnly && !(e.state === ST.ADVANCE || e.state === ST.ATTACK || e.state === ST.SPAWN)) continue;
      n++;
    }
    return n;
  }

  beginWave(n) {
    if (n > WAVES.length) return;
    this.wave = n;
    const def = WAVES[n - 1];
    this.waveState = 'spawning';
    this.spawnQueue = def.count;
    this.spawnTypes = def.types;
    this.spawnT = 0.4;
    this.audio.objective();
    this.ui.banner('ВОЛНА ' + n, 'противник идёт на базу', 'red', 2.6);
    this.ui.objective('Отбить волну ' + n + ' из 9');
    this.ui.waveLine('Волна ' + n + '/9 · осталось: ' + def.count);
  }

  spawnEnemy(type, pos) {
    const e = new Enemy(this, pos || this.pickSpawn(), { type });
    e.setState(ST.SPAWN);
    this.enemies.push(e);
    this.effects.dust(new THREE.Vector3(e.pos.x, e.pos.y + 0.2, e.pos.z), 6);
    return e;
  }

  pickSpawn() {
    const s = this.base.spawns[(Math.random() * this.base.spawns.length) | 0];
    return new THREE.Vector3(s.x + (Math.random() - 0.5) * 8, 0, s.z + (Math.random() - 0.5) * 8);
  }

  spawnBasementEnemy(pos) {
    const e = new Enemy(this, pos, { type: Math.random() < 0.25 ? 'heavy' : 'rifle' });
    e.setState(ST.SPAWN);
    this.enemies.push(e);
    return e;
  }

  spawnAlly(pos) {
    const e = new Enemy(this, pos, { team: 'friendly', type: 'rifle' });
    e.setState(ST.SPAWN);
    e.range = 40;
    this.enemies.push(e);
    return e;
  }

  updateWaves(dt) {
    if (this.waveState === 'pre') {
      this.ui.waveLine(this.consoleUsed
        ? 'Противник поднимает тревогу...'
        : 'Нужно выйти на связь через аппаратуру в штабе');
      if (this.preT > 0) this.preT -= dt;
      return;
    }
    if (this.waveState === 'intermission') {
      this.interT -= dt;
      this.ui.waveLine('Следующая волна через ' + Math.max(0, Math.ceil(this.interT)) + ' с');
      if (this.interT <= 0) this.beginWave(this.wave + 1);
      return;
    }
    if (this.waveState === 'spawning') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.spawnQueue > 0) {
        const t = this.spawnTypes[(Math.random() * this.spawnTypes.length) | 0];
        this.spawnEnemy(t);
        this.spawnQueue--;
        this.spawnT = 0.45 + Math.random() * 0.6;
      }
      if (this.spawnQueue <= 0) this.waveState = 'fighting';
      this.ui.waveLine('Волна ' + this.wave + '/9 · осталось: ' + this.aliveEnemies());
      return;
    }
    if (this.waveState === 'fighting') {
      this.ui.waveLine('Волна ' + this.wave + '/9 · осталось: ' + this.aliveEnemies());
      if (this.aliveEnemies() === 0) this.onWaveCleared();
      return;
    }
    if (this.waveState === 'panic') { this.updatePanic(dt); return; }
    if (this.waveState === 'holdout') { this.updateHoldout(dt); return; }
  }

  onWaveCleared() {
    this.audio.objective();
    if (this.wave >= WAVES.length) { this.startPanic(); return; }
    this.ui.banner('ВОЛНА ' + this.wave + ' ОТБИТА', 'перегруппировка', 'green', 2.6);
    this.player.heal(35);
    this.player.addAmmo(90);
    this.ui.waveLine('Пополнение: +35 HP, +90 патронов');
    if (this.wave === 6) this.dropReinforcements();
    this.waveState = 'intermission';
    this.interT = 9;
  }

  dropReinforcements() {
    this.speaker.say({
      who: 'КОМАНДИР (радио)',
      text: 'Подмога на подходе, два бойца садятся рядом с тобой. Держитесь вместе, дальше будет плотнее.',
    });
    setTimeout(() => {
      const p = this.player.pos;
      for (const [dx, dz] of [[6, 4], [-5, 6]]) {
        const a = this.spawnAlly(new THREE.Vector3(p.x + dx, 0, p.z + dz));
        this.effects.dust(new THREE.Vector3(a.pos.x, 0.2, a.pos.z), 12);
      }
      this.ui.banner('ПОДМОГА', 'двое бойцов на земле', 'green', 2.4);
    }, 2500);
  }

  // ================== ВЕЛИКАЯ ПАНИКА ==================
  startPanic() {
    this.waveState = 'panic';
    this.panicPhase = 'broadcast';
    this.panicT = 0;
    this.ui.cinema(true);
    this.ui.banner('ТРЕВОГА', 'база получила сигнал', 'red', 3.2);
    this.audio.siren(26);
    this.base.alarmLights.forEach(l => { l.userData.on = true; });
    // гарнизон выбегает на шум — рядом с игроком, чтобы всё было слышно и видно
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        if (this.mode !== 'base') return;
        const a = (i / 14) * Math.PI * 2 + Math.random();
        const r = 32 + Math.random() * 22;
        const p = this.player.pos;
        const pos = new THREE.Vector3(
          Math.max(-86, Math.min(86, p.x + Math.cos(a) * r)), 0,
          Math.max(-86, Math.min(86, p.z + Math.sin(a) * r)));
        this.spawnEnemy(i % 4 === 0 ? 'heavy' : 'rifle', pos);
      }, i * 400);
    }
    const S = this.speaker;
    const seq = [
      [1.2, { who: 'РАДИОПЕРЕХВАТ · ВСЕМ ПОСТАМ', text: 'Внимание всем постам! Внимание всем постам! Говорит командование базы!' }],
      [6.0, { who: 'РАДИОПЕРЕХВАТ · ВСЕМ ПОСТАМ', text: 'Объект потерян. Повторяю: объект потерян. Приказ — забыть про нас и уходить.' }],
      [12.0, { who: 'РАДИОПЕРЕХВАТ · ВСЕМ ПОСТАМ', text: 'Эвакуироваться, пока есть возможность. Это того не стоит. Повторяю: это того не стоит.' }],
      [18.0, { who: 'РАДИОПЕРЕХВАТ · ВСЕМ ПОСТАМ', text: 'Кто не успел — действуйте по обстановке. Бросайте технику. Конец связи.' }],
    ];
    seq.forEach(([t, line]) => setTimeout(() => {
      if (this.mode !== 'base') return;
      this.audio.radioBeep();
      S.say(line);
      if (t === 1.2) this.ui.banner('ВЕЛИКАЯ ПАНИКА', 'база уходит', 'red', 4);
    }, t * 1000));
    setTimeout(() => { if (this.mode === 'base') this.convertEnemies(); }, 23500);
  }

  convertEnemies() {
    this.panicPhase = 'converted';
    this.ui.cinema(false);
    const crowd = this.enemies.filter(e =>
      e.alive && !e.isAlly && e.state !== ST.SURRENDER && e.state !== ST.BEG && e.state !== ST.EVACUATE);
    // роли раскладываются детерминированно, чтобы в панике были видны все четыре реакции
    const n = crowd.length;
    const nFan = n >= 4 ? Math.max(1, Math.round(n * 0.15)) : 0;
    const nSurr = n >= 4 ? Math.max(1, Math.round(n * 0.15)) : 0;
    const nBeg = n >= 4 ? Math.max(1, Math.round(n * 0.15)) : 0;
    const nEvac = Math.max(n >= 4 ? 1 : 0, n - nFan - nSurr - nBeg);   // большая часть бежит
    const mix = [];
    for (let i = 0; i < nEvac; i++) mix.push('evac');
    for (let i = 0; i < nSurr; i++) mix.push('surr');   // поднимают руки
    for (let i = 0; i < nBeg; i++) mix.push('beg');     // падают и просят пощады
    for (let i = 0; i < nFan; i++) mix.push('fanatic'); // дерутся до последнего
    for (let i = mix.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [mix[i], mix[j]] = [mix[j], mix[i]];
    }
    const got = { evac: 0, surr: 0, beg: 0, fanatic: 0 };
    crowd.forEach((e, i) => {
      const role = mix.length ? mix[i % mix.length] : 'evac';
      got[role]++;
      if (role === 'evac') { e.setState(ST.EVACUATE); }
      else if (role === 'surr') { e.setState(ST.SURRENDER); }
      else if (role === 'beg') { e.setState(ST.BEG); }
      else {
        e.type = 'fanatic';
        e.speed = 5.4; e.fireInterval = 0.5; e.range = 48; e.accuracy = 0.44; e.dmg = 11;
        e.mesh.userData.parts.head.material.color.set(0x8c2f26);
        e.setState(ST.ATTACK);
      }
    });
    this.ui.banner('БАЗА БЕЖИТ',
      `бегут: ${got.evac} · сдаются: ${got.surr} · молят: ${got.beg} · дерутся: ${got.fanatic}`, '', 4.5);
    this.speaker.say({
      who: 'КОМАНДИР (радио)',
      text: 'Слышал их эфир? Они бегут. Добей тех, кто ещё стреляет, и держись — скоро борт.',
    });
    this.ui.objective('Добить тех, кто продолжает сопротивление');
  }

  updatePanic(dt) {
    this.panicT += dt;
    this.ui.waveLine('База в панике · сопротивляются: ' + this.aliveEnemies(true));
    if (this.panicPhase === 'converted' && this.panicT > 24 && this.aliveEnemies(true) === 0) {
      this.startHoldout();
    }
  }

  startHoldout() {
    this.waveState = 'holdout';
    this.holdT = HOLDOUT;
    this.spawnT = 3;
    this.audio.objective();
    this.ui.banner('ВОЛНА 10', 'продержаться 2:00 до эвакуации', 'red', 3.4);
    this.ui.objective('Волна 10: продержаться 2 минуты до борта');
    this.speaker.say({
      who: 'КОМАНДИР (радио)',
      text: 'Борт вылетел к тебе. Две минуты, боец. Просто две минуты — и мы уходим отсюда.',
    });
  }

  updateHoldout(dt) {
    this.holdT -= dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.holdT > 8) {
      this.spawnT = 7 + Math.random() * 6;
      const e = this.spawnEnemy(Math.random() < 0.3 ? 'fanatic' : 'rifle');
      if (Math.random() < 0.4) e.setState(ST.EVACUATE);
    }
    const m = Math.floor(Math.max(0, this.holdT) / 60);
    const s = Math.floor(Math.max(0, this.holdT) % 60);
    this.ui.timer(m + ':' + String(s).padStart(2, '0'), this.holdT < 20 ? 'red' : 'amber');
    this.ui.waveLine('Волна 10/10 · на базе: ' + this.aliveEnemies());
    if (this.holdT <= 0) {
      this.ui.timer(null);
      this.startEvacCutscene();
    }
  }

  // ================== катсцена эвакуации ==================
  startEvacCutscene() {
    if (this.mode === 'evac' || this.evacDone) return;
    this.evacDone = true;
    this.waveState = 'idle';
    this.mode = 'evac';
    this.player.locked = true;
    this.input.unlock();
    this.ui.cinema(true);
    this.ui.setHud(false);
    this.ui.skipHint(true);
    this._cutsceneSkipOk = false;
    setTimeout(() => { this._cutsceneSkipOk = true; }, 1500);
    this.audio.stopLoop('engine', 0.2);
    this.audio.startLoop('engine', 'engine', 200, 0.05);

    const plane = makeTransport();
    this.base.scene.add(plane);
    this.evacPlane = plane;
    const LZ = this.base.lz;
    plane.position.set(LZ.x + 260, 150, LZ.z - 320);
    plane.lookAt(LZ.x, 6, LZ.z);

    const rig = this.rig;
    rig.snap(new THREE.Vector3(LZ.x + 20, 14, LZ.z + 34), plane.position.clone());
    rig.setFov(70, 1);

    const tl = new Timeline();
    this.evacTL = tl;
    const S = this.speaker;

    tl.at(0.3, () => {
      this.ui.banner('ЭВАКУАЦИЯ', 'борт на подходе', 'green', 3);
      this.audio.setLoop('engine', 0.14, 190);
    });
    tl.at(7.5, () => {
      this.audio.setLoop('engine', 0.1, 140);
      rig.goto(new THREE.Vector3(LZ.x + 26, 5, LZ.z + 26), new THREE.Vector3(LZ.x, 3, LZ.z), 3);
    });
    tl.at(11.0, () => {
      this.audio.setLoop('engine', 0.05, 90);
      rig.goto(new THREE.Vector3(LZ.x + 9, 2.4, LZ.z + 13), new THREE.Vector3(LZ.x, 1.6, LZ.z), 2.5);
      const ramp = plane.userData.ramp;
      this._rampAnim = { ramp, t: 0 };
    });
    tl.at(13.5, () => {
      const cmd = makeSoldier({ uniform: 0x404a35, gear: 0x242a1c, helmet: 0x2b3123 });
      cmd.position.set(LZ.x, 0, LZ.z + 3.2);
      cmd.rotation.y = Math.PI;
      cmd.userData.parts.armL.rotation.x = -0.5;
      cmd.userData.parts.armR.rotation.x = -0.5;
      cmd.userData.parts.gun.visible = false;
      this.base.scene.add(cmd);
      this.evacCommander = cmd;
    });
    tl.at(15.0, () => {
      rig.goto(new THREE.Vector3(LZ.x + 3.4, 2.1, LZ.z + 6.5), new THREE.Vector3(LZ.x, 1.5, LZ.z + 0.5), 2.2);
      S.say({ who: 'КОМАНДИР', text: 'Вот ты где! Цел? Живой? Отлично.' });
    });
    tl.at(19.5, () => S.say({
      who: 'КОМАНДИР',
      text: 'Слушай... это было охренительно. Я серьёзно. Мы охренеть как хорошо справились, вся база разбежалась.',
    }));
    tl.at(26.0, () => S.say({
      who: 'КОМАНДИР',
      text: 'Но есть одно «но». В подвале штаба остались секретные данные. Технологии. Зайди и забери их, пока тут всё не разнесли.',
    }));
    tl.at(33.0, () => S.say({
      who: 'КОМАНДИР',
      text: 'Люк в подвал внутри штаба, за аппаратурой. Мы подождём на площадке. Туда и обратно, быстро.',
    }));
    tl.at(38.5, () => this.endEvacCutscene());
    this._evacT = 0;
  }

  updateEvac(dt) {
    this._evacT += dt;
    const LZ = this.base.lz;
    const plane = this.evacPlane;
    const t = this._evacT;
    if (t < 11) {
      const k = Math.min(1, t / 10.5);
      const e = k * k * (3 - 2 * k);
      plane.position.set(
        LZ.x + 260 * (1 - e) + 4 * Math.sin(t * 2),
        150 * (1 - e) + 4.6 * e,
        LZ.z - 320 * (1 - e),
      );
      plane.lookAt(LZ.x, 4, LZ.z + 40);
      plane.rotation.z = Math.sin(t * 1.6) * 0.03;
    } else {
      plane.position.set(LZ.x, 4.6, LZ.z);
      plane.rotation.set(0, 0, 0);
    }
    if (this._rampAnim) {
      this._rampAnim.t = Math.min(1, this._rampAnim.t + dt * 0.7);
      this._rampAnim.ramp.rotation.x = -0.5 + this._rampAnim.t * 0.42;
    }
    this.evacTL.update(dt);
    this.rig.update(dt);
    this.audio.setLoop('engine', t < 11 ? 0.14 : 0.05, t < 11 ? 170 : 80);
  }

  endEvacCutscene() {
    this.mode = 'base';
    this.player.locked = false;
    this.ui.cinema(false);
    this.ui.setHud(true);
    this.ui.fade(true, 700);
    this.rig.detach();
    setTimeout(() => {
      this.player.pos.set(this.base.lz.x + 2, 0, this.base.lz.z + 7);
      this.player.yaw = Math.PI;
      this.ui.fade(false, 800);
      this.ui.chapter('ГЛАВА 3', 'ПОДВАЛ');
      this.hatchPortal.visible = true;
      if (this.hatchLocked) { this.hatchLocked.used = true; this.hatchLocked.enabled = false; }
      this.audio.objective();
      this.ui.objective('Спуститься в подвал штаба за секретными данными');
      this.ui.waveLine('Люк открыт — внутри штаба, за аппаратурой связи');
      this.waveState = 'idle';
      this.ui.banner('ЛЮК В ПОДВАЛ ОТКРЫТ', 'синий портал внутри штаба', 'green', 3.4);
      this.interactables.push({
        pos: this.base.hatchPos.clone().setY(1), radius: 2.8, label: 'Спуститься в подвал',
        once: true, action: () => this.enterBasement(),
      });
      this.input.lock();
    }, 750);
  }

  // ================== ГЛАВА 3 — подвал ==================
  enterBasement() {
    this.audio.pickup();
    this.ui.fade(true, 700);
    setTimeout(() => {
      this.scene = this.basement.scene;
      this.colliders = this.basement.colliders;
      this.groundFn = this.basementGround;
      this.effects = this.fxBasement;
      this.effects.clear();
      this.scene.add(this.camera);
      this.enemies.forEach(e => e.dispose());
      this.enemies.length = 0;
      this.interactables = this.interactables.filter(i => i.scene === 'basement');
      this.player.pos.copy(this.basement.spawn);
      this.player.yaw = Math.PI;
      this.player.pitch = 0;
      this.player.vel.set(0, 0, 0);
      this.player.heal(60);
      this.player.addAmmo(120);
      this.mode = 'basement';
      this.waveState = 'idle';
      this._addTechPickups();
      this.ui.fade(false, 900);
      this.ui.banner('ГЛАВА 3', 'подвал штаба', '', 3.2);
      this.ui.objective('Найти секретные технологии (0/3)');
      this.ui.waveLine('Узкие проходы, лестницы, темнота. Держись близко к стенам.');
      this.speaker.say({
        who: 'КОМАНДИР (радио)',
        text: 'Связь в подвале паршивая. Три контейнера с технологиями: серверная, архив и лаборатория. Забирай всё и выходи через шахту.',
      });
      this.input.lock();
    }, 800);
  }

  _addTechPickups() {
    this.techCount = 0;
    this.basement.techSpots.forEach((spot, i) => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshBasicMaterial({ color: 0x59e0ff }));
      core.position.y = 1.15;
      g.add(core);
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95),
        new THREE.MeshBasicMaterial({ color: 0x88ccff, wireframe: true }));
      cage.position.y = 1.15; g.add(cage);
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.1),
        new THREE.MeshLambertMaterial({ color: 0x33383c }));
      pedestal.position.y = 0.42; g.add(pedestal);
      const l = new THREE.PointLight(0x59e0ff, 2.2, 12, 2);
      l.position.y = 1.4; g.add(l);
      g.position.copy(spot.pos);
      this.basement.scene.add(g);
      this.interactables.push({
        pos: spot.pos.clone().setY(spot.pos.y + 1), radius: 2.6, label: 'Забрать: ' + spot.name,
        scene: 'basement', once: true, mesh: g,
        action: () => this.collectTech(i, spot, g),
      });
    });
    this.interactables.push({
      pos: this.basement.exitPos.clone().setY(-3), radius: 2.6, label: 'Шахта эвакуации',
      scene: 'basement', once: true, enabled: false, action: () => this.finishBasement(),
    });
  }

  collectTech(i, spot, mesh) {
    this.basement.scene.remove(mesh);
    this.techCount++;
    this.stats.tech = this.techCount;
    this.audio.pickup();
    this.ui.banner(spot.name, 'получено ' + this.techCount + ' из 3', 'green', 2.4);
    this.speaker.say({
      who: 'КОМАНДИР (радио)',
      text: this.techCount < 3
        ? 'Есть! Ещё ' + (3 - this.techCount) + '. Осторожно, у них там кто-то остался внизу.'
        : 'Всё, комплект! Уходи через шахту эвакуации, я её открыл. Бегом!',
    });
    // тревога: охрана сбегается
    const spots = this.basement.enemySpawns
      .filter(s => s.distanceTo(spot.pos) < 26)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3 + this.techCount);
    spots.forEach((s, k) => {
      setTimeout(() => {
        if (this.mode !== 'basement') return;
        this.spawnBasementEnemy(s.clone());
        this.audio.enemyShot(20);
      }, 400 + k * 700);
    });
    this.audio.siren(6);
    this.ui.objective(this.techCount < 3
      ? `Отбиться! Технологии: ${this.techCount}/3`
      : 'Уйти через шахту эвакуации');
    this.basementFighting = true;
    if (this.techCount >= 3) {
      const it = this.interactables.find(x => x.label === 'Шахта эвакуации');
      if (it) it.enabled = true;
      this.exitPortal.visible = true;
    }
  }

  updateBasement(dt) {
    if (this.basementFighting) {
      const left = this.aliveEnemies();
      this.ui.waveLine('Охрана подвала: ' + left + ' · технологии: ' + this.techCount + '/3');
      if (left === 0 && this.techCount < 3) {
        this.basementFighting = false;
        this.ui.objective('Найти секретные технологии (' + this.techCount + '/3)');
      }
    } else {
      this.ui.waveLine('Технологии: ' + this.techCount + '/3');
    }
  }

  finishBasement() {
    this.mode = 'victory';
    this.player.locked = true;
    this.input.unlock();
    this.ui.setHud(false);
    this.ui.cinema(true);
    this.ui.fade(true, 900);
    this.audio.stopAllLoops();
    this.speaker.say({
      who: 'КОМАНДИР (радио)',
      text: 'Вижу тебя! Заходи на борт, уходим. Это была лучшая зачистка за весь год.',
    });
    setTimeout(() => this.showEnd(true), 5200);
  }

  showEnd(win) {
    const t = (performance.now() - this.stats.start) / 1000;
    const acc = this.player.shotsFired ? Math.round(this.player.shotsHit / this.player.shotsFired * 100) : 0;
    this.ui.cinema(false);
    this.ui.endScreen(
      win ? 'ЭВАКУАЦИЯ ЗАВЕРШЕНА' : 'ОПЕРАЦИЯ ПРОВАЛЕНА',
      win ? 'Квадрат 7 зачищен, секретные данные вывезены.' : 'Боец потерян в квадрате 7.',
      [
        ['Уничтожено', this.stats.kills],
        ['Точность', acc + '%'],
        ['Технологий', this.stats.tech + '/3'],
        ['Сдались / убежали', this.stats.spared + ' / ' + this.stats.escaped],
        ['Время', Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')],
        ['Волна', Math.min(10, this.wave || 0) + '/10'],
      ],
    );
    this.ui.setScreen('end-screen', true);
    this.mode = 'end';
  }

  skipCutscene() {
    if (!this._cutsceneSkipOk) return;
    if (this.mode === 'intro' && this.intro) this.intro.skip();
    if (this.mode === 'evac' && this.evacTL) { this.evacTL.skipAll(); }
  }

  // ================== события боя ==================
  onHitEnemy(e, killed) {
    this.audio.hitmarker();
    this.ui.hitmarker(killed);
  }

  onEnemyKilled(e) {
    this.stats.kills++;
    this.audio.gunshot(0.4, 6);
  }

  onEnemyEscaped(e) { this.stats.escaped++; }
  onAllyDown(e) { this.speaker.say({ who: 'СОЮЗНИК', text: 'Я down! Продолжай без меня!', radio: true, hold: 2 }); }

  markSurrendered(e) { this.stats.spared++; }

  damagePlayer(amount, from) {
    this.player.damage(amount, from);
  }

  onPlayerHurt(amount) {
    this.player.shake = Math.min(1, this.player.shake + amount / 40);
    this.ui.damage(amount);
    this.audio.impact('flesh');
  }

  onPlayerDeath() {
    if (this.mode === 'end' || this.mode === 'dead') return;
    this.mode = 'dead';
    this.player.locked = true;
    this.input.unlock();
    this.audio.explosion(0.5);
    this.ui.fade(true, 1400);
    this.ui.cinema(false);
    setTimeout(() => this.showEnd(false), 1600);
  }

  pause(on) {
    if (this.mode !== 'base' && this.mode !== 'basement') return;
    this.paused = on;
    this.ui.lockHint(false);
    this.ui.setScreen('pause-screen', on);
    if (on) this.input.unlock(); else this.input.lock();
  }

  // ================== мир: коллизии / выстрелы ==================
  groundHeight(x, z, fromY = 0) {
    return this.groundFn ? this.groundFn(x, z, fromY) : 0;
  }

  resolveCollision(pos, radius, height) {
    const list = this.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const dx = pos.x - c.cx, dz = pos.z - c.cz, dy = pos.y + height / 2 - c.cy;
      if (dx * dx + dz * dz + dy * dy > (c.r + radius + height) * (c.r + radius + height)) continue;
      if (pos.y + height < c.min.y + 0.02 || pos.y > c.max.y - 0.02) continue;
      const px = Math.min(pos.x + radius - c.min.x, c.max.x - (pos.x - radius));
      const pz = Math.min(pos.z + radius - c.min.z, c.max.z - (pos.z - radius));
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) pos.x += (pos.x - c.cx > 0 ? px : -px);
      else pos.z += (pos.z - c.cz > 0 ? pz : -pz);
    }
  }

  losClear(a, b) {
    const o = new THREE.Vector3(a.x, a.y + 1.5, a.z);
    const d = new THREE.Vector3(b.x - a.x, (b.y + 1.3) - (a.y + 1.5), b.z - a.z);
    const len = d.length();
    if (len < 0.001) return true;
    d.multiplyScalar(1 / len);
    for (const c of this.colliders) {
      if (!c.occluder) continue;
      const dx = (c.cx - o.x), dz = (c.cz - o.z);
      if (dx * dx + dz * dz > (c.r + len) * (c.r + len)) continue;
      if (rayAABB(o, d, c.min, c.max) < len) return false;
    }
    return true;
  }

  castShot(origin, dir, range) {
    let best = null;
    for (const e of this.enemies) {
      if (!e.alive || e.isAlly) continue;
      for (const s of e.hitSpheres()) {
        const t = raySphere(origin, dir, s.c, s.r);
        if (t > 0 && t < range && (!best || t < best.t)) best = { t, enemy: e, zone: s.zone };
      }
    }
    for (const c of this.colliders) {
      if (!c.occluder) continue;
      const t = rayAABB(origin, dir, c.min, c.max);
      if (t > 0 && t < range && (!best || t < best.t)) best = { t, enemy: null, zone: null };
    }
    // пол
    const gy = this.groundHeight(origin.x, origin.z, origin.y - 1.6);
    if (dir.y < -0.001) {
      const t = (gy - origin.y) / dir.y;
      if (t > 0 && t < range && (!best || t < best.t)) best = { t, enemy: null, zone: null };
    }
    if (!best) return null;
    return {
      point: origin.clone().addScaledVector(dir, best.t),
      enemy: best.enemy, zone: best.zone, dist: best.t,
    };
  }

  nearestEvacPoint(pos) {
    let best = null, bd = Infinity;
    for (const p of this.base.evacPoints) {
      const d = p.distanceToSquared(pos);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  nearestEnemy(pos) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.isAlly) continue;
      if (e.state === ST.SURRENDER || e.state === ST.BEG || e.state === ST.EVACUATE) continue;
      const d = e.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ================== взаимодействие ==================
  updateInteraction() {
    let found = null;
    const p = this.player.pos;
    for (const it of this.interactables) {
      if (it.used) continue;
      if (it.enabled === false) continue;
      if (it.pos.distanceTo(p) < it.radius) { found = it; break; }
    }
    this.ui.prompt(found ? found.label : null);
    this._curInteract = found;
    if (found && this.input.hit('KeyE')) {
      found.used = !!found.once;
      found.action();
    }
  }

  // ================== главный цикл ==================
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.mode === 'menu') {
      this._menuCam.a += dt * 0.06;
      const r = 120;
      this.camera.position.set(Math.cos(this._menuCam.a) * r, 52, Math.sin(this._menuCam.a) * r);
      this.camera.lookAt(0, 4, 0);
      this.renderer.render(this.base.scene, this.camera);
      return;
    }

    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

    if (this.mode === 'intro') {
      this.intro.update(dt);
      this.ui.update(dt);
      this.speaker.update(dt);
      this.renderer.render(this.intro.scene, this.camera);
      this.input.endFrame();
      return;
    }

    if (this.mode === 'evac') {
      this.updateEvac(dt);
      this.enemies.forEach(e => { if (!e.isStatic) e.update(dt); });
      this.effects.update(dt);
      this.ui.update(dt);
      this.speaker.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    if (this.mode === 'base' || this.mode === 'basement') {
      this.ui.lockHint(!this.input.locked && !this.player.locked);
      this.updateGameplay(dt);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    // end / dead
    this.effects.update(dt);
    this.speaker.update(dt);
    this.ui.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateGameplay(dt) {
    const P = this.player;
    if (this.input.mouseDown && !P.locked) P.shoot();

    P.update(dt, P.locked ? null : this.input);
    this.updateInteraction();

    // враги
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isStatic) continue;
      e.update(dt);
      if (e.remove) { e.dispose(); this.enemies.splice(i, 1); }
    }

    if (this.mode === 'base') this.updateWaves(dt);
    else this.updateBasement(dt);

    // порталы
    for (const p of this.portals) {
      if (p.visible) p.userData.mat.uniforms.uTime.value += dt;
    }
    // мигание аварийных ламп
    if (this.base.alarmLights[0].userData.on) {
      const on = (Math.sin(performance.now() * 0.008) > 0) ? 3.2 : 0.1;
      this.base.alarmLights.forEach(l => { l.intensity = on; });
    }
    // аппаратура
    if (this.base.appLamps) {
      this.base.appLamps.forEach((l, i) => {
        l.material.opacity = 1;
        l.visible = (Math.sin(performance.now() * 0.004 + i) > -0.3);
      });
    }
    if (this.base.radarDish) this.base.radarDish.rotation.y += dt * 0.6;

    this.effects.update(dt);
    this.ui.update(dt);
    this.speaker.update(dt);
    this.ui.health(P.hp);
    this.ui.ammo(P.mag, P.reserve);
    this.ui.stats('Уничтожено: ' + this.stats.kills);
  }
}
