// ГЛАВА 1 — заставка: борт, приказ командира, показ игрока, прыжок с парашютом, «ты оружие забыл».
import * as THREE from '../../vendor/three.module.js';
import { makeSoldier } from '../core/actors.js';
import { Rig, Timeline, makePlaneInterior } from './cutscene.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class IntroScene {
  constructor(game, camera) {
    this.game = game;
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec6e8);
    this.scene.fog = new THREE.Fog(0x9ec6e8, 300, 2600);
    this.rig = new Rig(camera);
    this.tl = new Timeline();
    this.phase = 'board';
    this.t = 0;
    this.finished = false;
    this.alt = 900;
    this.vSpeed = 0;
    this.chute = false;
    this._build();
  }

  _build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xd8e8f6, 0x4a5238, 1.0));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
    sun.position.set(-200, 400, 100);
    s.add(sun);

    // земля далеко внизу
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshLambertMaterial({ color: 0x5f6b3c }));
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 1800;
      const m = new THREE.Mesh(new THREE.ConeGeometry(90 + Math.random() * 120, 120 + Math.random() * 200, 5),
        new THREE.MeshLambertMaterial({ color: 0x6c7a63 }));
      m.position.set(Math.cos(a) * r, 40, Math.sin(a) * r);
      s.add(m);
    }
    // лес
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 1200;
      const m = new THREE.Mesh(new THREE.ConeGeometry(14, 34, 5),
        new THREE.MeshLambertMaterial({ color: 0x38502c }));
      m.position.set(Math.cos(a) * r, 17, Math.sin(a) * r);
      s.add(m);
    }
    // силуэт базы внизу
    const base = new THREE.Group();
    const cm = new THREE.MeshLambertMaterial({ color: 0x8d8b83 });
    for (const [x, z, w, d, h] of [[0, 0, 18, 14, 5], [-42, -34, 9, 6, 4], [42, -34, 9, 6, 4], [-42, 32, 9, 6, 4], [44, 30, 6, 9, 4]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cm);
      b.position.set(x, h / 2, z); base.add(b);
    }
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: 0x4a4f52 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(62, 0.2, -54); base.add(pad);
    s.add(base);

    // облака, сквозь которые проходим
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(220 + Math.random() * 260, 120 + Math.random() * 140), cloudMat);
      c.rotation.x = -Math.PI / 2;
      c.position.set((Math.random() - 0.5) * 1800, 420 + Math.random() * 380, (Math.random() - 0.5) * 1800);
      s.add(c);
    }

    // самолёт
    this.plane = makePlaneInterior();
    this.plane.position.set(0, this.alt, 0);
    s.add(this.plane);

    // персонажи
    const seat = (m, x, z, ry) => {
      m.position.set(x, -1.75, z);
      m.rotation.y = ry;
      const p = m.userData.parts;
      p.legL.rotation.x = -1.35; p.legR.rotation.x = -1.35;
      p.armL.rotation.x = -0.5; p.armR.rotation.x = -0.5;
      this.plane.add(m);
      return m;
    };
    this.commander = makeSoldier({ uniform: 0x404a35, gear: 0x242a1c, helmet: 0x2b3123 });
    this.commander.position.set(1.15, -1.42, 1.6);
    this.commander.rotation.y = -0.9;
    this.plane.add(this.commander);
    this.mates = [seat(makeSoldier({ uniform: 0x565f3a }), -1.35, -2.4, 0),
      seat(makeSoldier({ uniform: 0x4e5737 }), 1.35, -2.4, Math.PI),
      seat(makeSoldier({ uniform: 0x59623b }), -1.35, -5.2, 0)];

    // игрок (без оружия!)
    this.playerModel = this.game.player.body;
    this.playerModel.visible = true;
    seat(this.playerModel, -1.35, 0.8, 0);
    this.playerModel.userData.parts.gun.visible = false;

    // парашют игрока
    this.chuteMesh = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshLambertMaterial({ color: 0x3f6b3a, side: THREE.DoubleSide }));
    canopy.position.y = 4.4;
    this.chuteMesh.add(canopy);
    for (const dx of [-1.6, 1.6]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 4),
        new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      line.position.set(dx * 0.5, 2.2, 0);
      line.rotation.z = dx * 0.16;
      this.chuteMesh.add(line);
    }
    this.chuteMesh.visible = false;
    s.add(this.chuteMesh);

    // ящик с оружием на своём парашюте
    this.crate = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x5b6137 }));
    this.crate.add(cb);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.14, 1.24), new THREE.MeshLambertMaterial({ color: 0xffb020 }));
    strip.position.y = 0.1; this.crate.add(strip);
    const cCanopy = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c0, side: THREE.DoubleSide }));
    cCanopy.position.y = 3.4; this.crate.add(cCanopy);
    this.crate.visible = false;
    s.add(this.crate);

    this._script();
  }

  _script() {
    const g = this.game;
    const S = g.speaker;
    const tl = this.tl;

    tl.at(0.2, () => {
      g.ui.chapter('ГЛАВА 1', 'ТИХИЙ ШТОРМ');
      g.audio.startLoop('engine', 'engine', 220, 0.22);
      this.rig.snap(V(-1.35, -0.05, 0.8), V(0.2, 0.3, 9));
      this.rig.setFov(70, 1);
    });
    tl.at(2.6, () => g.ui.banner('ОПЕРАЦИЯ «ТИХИЙ ШТОРМ»', 'борт 7 · квадрат 7 · 04:12', '', 3.6));
    tl.at(7.0, () => S.say({
      who: 'КОМАНДИР (борт 7)',
      text: 'Так, боец, слушай задачу. Внизу вражеская база, квадрат семь. Зачищай там всё это дело: связь, склады, охрану.',
    }));
    tl.at(15.5, () => S.say({
      who: 'КОМАНДИР (борт 7)',
      text: 'Разведка насчитала пару десятков человек и очень плохое настроение. Работаем быстро и громко.',
    }));
    tl.at(23.0, () => {
      this.rig.goto(V(2.9, 0.5, 3.6), V(-1.0, -0.5, 0.4), 3.0);
      this.rig.setFov(60, 3);
    });
    tl.at(26.5, () => {
      this.rig.goto(V(2.0, 0.1, -1.6), V(-1.35, -0.2, 0.8), 2.6);
    });
    tl.at(29.5, () => S.say({
      who: 'КОМАНДИР',
      text: 'Ну что, боец... Я думаю, это будет легко.',
    }));
    tl.at(34.0, () => {
      this.rig.goto(V(0.9, 0.35, 1.0), V(1.15, 0.3, 1.6), 2.2);
      this.rig.setFov(66, 2);
      this.commander.userData.parts.armR.rotation.x = -1.0;
    });
    tl.at(38.5, () => {
      const r = this.plane.userData;
      r.redL.material.color.set(0x331108);
      r.greenL.material.color.set(0x22ff55);
      r.redLight.color.set(0x22ff55);
      S.say({ who: 'ВЫПУСКАЮЩИЙ', text: 'Зелёный! Пошёл! Пошёл! Пошёл!', rate: 1.2 });
    });
    tl.at(43.0, () => {
      this.phase = 'jump';
      this.mates.forEach((m, i) => setTimeout(() => { this.plane.remove(m); }, i * 1));
      this.playerModel.visible = false;
      this.rig.goto(V(0, this.alt - 1.2, -8.5), V(0, this.alt - 6, -22), 2.4);
      this.rig.setFov(86, 2.4);
      g.audio.startLoop('wind', 'brown', 700, 0.02);
    });
    tl.at(45.5, () => { this.phase = 'fall'; });
    tl.at(48.5, () => {
      g.audio.radioBeep();
      S.say({ who: 'КОМАНДИР (радио)', text: 'Стой... Ты оружие забыл.', hold: 3.0 });
    });
    tl.at(52.5, () => S.say({
      who: 'КОМАНДИР (радио)',
      text: 'Ты серьёзно прыгнул на базу без ствола? Ладно, не паникуй. Сбрасываю тебе ящик, лови.',
    }));
    tl.at(59.0, () => {
      this.phase = 'chute';
      this.chute = true;
      this.chuteMesh.visible = true;
      this.crate.visible = true;
      this.crate.position.set(26, this.alt - 60, 24);
      g.audio.setLoop('wind', 0.1);
      this.rig.setFov(72, 2);
    });
    tl.at(61.0, () => S.say({
      who: 'КОМАНДИР (радио)',
      text: 'Ящик пошёл. Приземляйся, забирай ствол — и вперёд. Центральное здание в середине базы, там и аппаратура.',
    }));
    tl.at(68.0, () => {
      g.ui.fade(true, 900);
    });
    tl.at(69.6, () => this.finish());
  }

  start() {
    this.t = 0;
    this.game.ui.fade(true, 60);
    this.tl.at(1.5, () => this.game.ui.fade(false, 1600));
    this.game.ui.skipHint(true);
    this.game.ui.cinema(true);
    this.game.ui.setHud(false);
  }

  update(dt) {
    if (this.finished) return;
    this.t += dt;
    this.tl.update(dt);

    if (this.phase === 'fall' || this.phase === 'chute') {
      const grav = this.chute ? 2.5 : 26;
      const term = this.chute ? 7 : 58;
      this.vSpeed = Math.min(term, this.vSpeed + grav * dt);
      this.alt -= this.vSpeed * dt;
      this.rig.snap(V(Math.sin(this.t * 0.7) * 3, this.alt, Math.cos(this.t * 0.5) * 3),
        V(Math.sin(this.t * 0.7) * 6, this.alt - 40, Math.cos(this.t * 0.5) * 6 - 20));
      this.chuteMesh.position.set(Math.sin(this.t * 0.7) * 3, this.alt, Math.cos(this.t * 0.5) * 3);
      this.chuteMesh.rotation.z = Math.sin(this.t) * 0.06;
      this.crate.position.y -= (this.chute ? 9 : this.vSpeed) * dt;
      this.crate.position.x += Math.sin(this.t * 1.3) * 0.01;
      if (this.crate.position.y < 4) this.crate.position.y = 4;
      // самолёт улетает
      this.plane.position.y += 14 * dt;
      this.plane.position.z -= 70 * dt;
      this.plane.rotation.y += 0.12 * dt;
      this.plane.visible = this.plane.position.z > -400;
      this.game.audio.setLoop('wind', this.chute ? 0.09 : 0.22, 700 + this.vSpeed * 6);
      if (this.alt < 40 && this.phase === 'chute') {
        this.alt = 40;
      }
    } else if (this.phase === 'jump') {
      this.plane.position.z -= 60 * dt;
      this.plane.visible = this.plane.position.z > -300;
      this.game.audio.setLoop('engine', 0.16, 200);
    } else {
      // лёгкая тряска борта
      this.plane.position.y = this.alt + Math.sin(this.t * 2.2) * 0.06;
      this.plane.rotation.z = Math.sin(this.t * 1.4) * 0.012;
      this.commander.userData.parts.armL.rotation.x = Math.sin(this.t * 3) * 0.12 - 0.3;
    }

    this.rig.update(dt);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.game.ui.skipHint(false);
    this.game.audio.stopLoop('wind', 0.5);
    this.game.audio.stopLoop('engine', 0.8);
    this.game.speaker.stop();
    this.game.onIntroFinished();
  }

  skip() {
    this.tl.skipAll();
    this.finish();
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
