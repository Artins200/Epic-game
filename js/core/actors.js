// Солдаты (игрок и противники) + ИИ с состояниями: атака, паника, эвакуация, сдача, мольба, последний бой.
import * as THREE from '../../vendor/three.module.js';

const U = (c) => new THREE.MeshLambertMaterial({ color: c });

export function makeSoldier(o = {}) {
  const uni = o.uniform || 0x5a6638;
  const gear = o.gear || 0x3b4227;
  const skin = o.skin || 0xc79a72;
  const helmet = o.helmet || 0x414b2b;

  const g = new THREE.Group();
  const mk = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = false;
    g.add(m);
    return m;
  };

  const legMat = U(uni), bootMat = U(0x241f18);
  const legL = new THREE.Group(); legL.position.set(-0.14, 0.86, 0);
  const legR = new THREE.Group(); legR.position.set(0.14, 0.86, 0);
  const mkLeg = (p) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), legMat);
    l.position.y = -0.41; p.add(l);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.34), bootMat);
    b.position.set(0, -0.78, 0.05); p.add(b);
    g.add(p);
  };
  mkLeg(legL); mkLeg(legR);

  const torso = mk(0.56, 0.72, 0.32, U(uni), 0, 1.22, 0);
  mk(0.6, 0.44, 0.38, U(gear), 0, 1.2, 0.01);          // разгрузка
  mk(0.2, 0.2, 0.12, U(0x2c2c2c), 0.16, 1.32, 0.2);   // подсумок
  const head = mk(0.27, 0.28, 0.27, U(skin), 0, 1.74, 0);
  mk(0.32, 0.16, 0.33, U(helmet), 0, 1.88, 0);
  mk(0.33, 0.07, 0.1, U(helmet), 0, 1.83, 0.14);

  const armL = new THREE.Group(); armL.position.set(-0.35, 1.5, 0);
  const armR = new THREE.Group(); armR.position.set(0.35, 1.5, 0);
  const mkArm = (p) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.18), U(uni));
    a.position.y = -0.31; p.add(a);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), U(gear));
    h.position.y = -0.66; p.add(h);
    g.add(p);
  };
  mkArm(armL); mkArm(armR);

  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.78), U(0x2b2b2b));
  gun.add(body);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), U(0x33291d));
  mag.position.set(0, -0.17, 0.06); gun.add(mag);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.26), U(0x4a3524));
  stock.position.set(0, -0.02, -0.44); gun.add(stock);
  gun.position.set(0, -0.62, 0.22);
  armR.add(gun);

  // прицел-вспышка
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.45);
  gun.add(muzzle);

  g.userData.parts = { legL, legR, armL, armR, torso, head, gun, muzzle };
  return g;
}

// ------------------ состояния ------------------
export const ST = {
  SPAWN: 'spawn', ADVANCE: 'advance', ATTACK: 'attack',
  EVACUATE: 'evacuate', SURRENDER: 'surrender', BEG: 'beg', DEAD: 'dead',
};

let idSeq = 1;

export class Enemy {
  constructor(game, pos, opts = {}) {
    this.game = game;
    this.id = idSeq++;
    this.type = opts.type || 'rifle';
    this.team = opts.team || 'enemy';
    this.isAlly = this.team === 'friendly';
    this.maxHp = this.type === 'heavy' ? 170 : this.type === 'fanatic' ? 120 : 100;
    this.hp = this.maxHp;
    this.speed = this.type === 'heavy' ? 3.1 : this.type === 'fanatic' ? 5.4 : 4.2;
    this.fireInterval = this.type === 'heavy' ? 1.5 : this.type === 'fanatic' ? 0.55 : 0.95;
    this.dmg = this.type === 'heavy' ? 16 : 8;
    this.range = this.type === 'heavy' ? 26 : 44;
    this.accuracy = this.type === 'heavy' ? 0.5 : this.type === 'fanatic' ? 0.42 : 0.3;

    this.mesh = makeSoldier(this.isAlly ? {
      uniform: 0x3f4a3a, gear: 0x2a2f22, helmet: 0x333b2c,
    } : {
      uniform: this.type === 'fanatic' ? 0x4a3a2a : 0x6a6444,
      gear: 0x33301f,
      helmet: this.type === 'fanatic' ? 0x2f2418 : 0x4d4a30,
    });
    this.mesh.position.copy(pos);
    game.scene.add(this.mesh);

    this.pos = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.state = ST.SPAWN;
    this.stateT = 0;
    this.anim = Math.random() * 10;
    this.fireCd = 0.6 + Math.random();
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.deadT = 0;
    this.speakCd = 4 + Math.random() * 6;
    this.prone = false;
    this.escaped = false;
    this.facing = Math.random() * Math.PI * 2;
    this.spawnT = 0;
    this.alerted = false;
    this.parts = this.mesh.userData.parts;
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
  }

  get alive() { return this.state !== ST.DEAD; }

  setState(s) {
    if (this.state === s || this.state === ST.DEAD) return;
    if (this.isAlly && (s === ST.EVACUATE || s === ST.SURRENDER || s === ST.BEG)) return;
    this.state = s;
    this.stateT = 0;
    if (s === ST.BEG) this.prone = true;
    if (s === ST.EVACUATE) {
      this.target = this.game.nearestEvacPoint(this.pos);
      this.speed *= 1.25;
    }
    if (s === ST.SURRENDER || s === ST.BEG) {
      this.game.markSurrendered(this);
      this.shout();
    }
  }

  shout() {
    const lines = this.state === ST.SURRENDER
      ? ['Не стреляй! Я сдаюсь!', 'Руки вверх! Я без оружия!', 'Всё, я выхожу! Не стреляйте!']
      : ['Пощады! Пощады!', 'Не надо, у меня семья!', 'Я сдаюсь, не стреляй!'];
    const d = this.pos.distanceTo(this.game.player.pos);
    if (d < 90) this.game.speaker.say({
      who: this.state === ST.SURRENDER ? 'ПРОТИВНИК (сдаётся)' : 'ПРОТИВНИК (молит)',
      text: lines[(Math.random() * lines.length) | 0],
      radio: false, hold: 2.1,
    });
  }

  damage(amount, zone) {
    if (!this.alive) return false;
    const mult = zone === 'head' ? 2.4 : 1;
    this.hp -= amount * mult;
    if (this.hp <= 0) { this.die(); return true; }
    if (this.isAlly) {
      return false;
    }
    if (this.state === ST.SURRENDER || this.state === ST.BEG) {
      // добивание сдавшегося — просто смерть
    } else if (this.state !== ST.EVACUATE) {
      this.alerted = true;
      if (this.state !== ST.ATTACK && this.state !== ST.ADVANCE) this.setState(ST.ADVANCE);
    }
    return false;
  }

  die() {
    if (this.state === ST.DEAD) return;
    this.state = ST.DEAD;
    this.deadT = 0;
    if (this.isAlly) this.game.onAllyDown(this); else this.game.onEnemyKilled(this);
    const p = this.pos.clone(); p.y += 1.1;
    this.game.effects.impact(p, 'flesh');
    this.game.effects.impact(p, 'flesh');
    // падение
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
  }

  // ---------------- движение ----------------
  _move(dt, dir, speed) {
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const target = dir.multiplyScalar(speed);
    this.vel.lerp(target, 1 - Math.pow(0.001, dt));
    const before = this.pos.clone();
    const next = this.pos.clone().addScaledVector(this.vel, dt);
    this.game.resolveCollision(next, 0.42, 1.8);
    next.y = this.game.groundHeight(next.x, next.z, this.pos.y);
    this.pos.copy(next);
    // если уперлись в стену — пробуем обойти
    const moved = this.pos.distanceTo(before);
    this._stuck = moved < speed * dt * 0.35 ? (this._stuck || 0) + dt : 0;
    if (this._stuck > 0.55) {
      this._avoid = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this._avoidSide || 1);
      this._avoidT = 0.9;
      this._avoidSide = -(this._avoidSide || 1);
      this._stuck = 0;
    }
    if (this._avoidT > 0) {
      this._avoidT -= dt;
      const alt = this.pos.clone().addScaledVector(this._avoid, dt * speed);
      this.game.resolveCollision(alt, 0.42, 1.8);
      alt.y = this.game.groundHeight(alt.x, alt.z, this.pos.y);
      this.pos.copy(alt);
    }
    this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.anim += dt * speed * 1.6;
  }

  acquireTarget() {
    if (!this.isAlly) return this.game.playerAlive ? this.game.player : null;
    return this.game.nearestEnemy(this.pos) || (this.game.playerAlive ? this.game.player : null);
  }

  update(dt) {
    this.stateT += dt;
    const g = this.game;

    if (this.state === ST.DEAD) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.5);
      this.mesh.rotation.x = this.fallDir * k * 1.55;
      if (this.deadT > 7) this.mesh.visible = Math.max(0, 1 - (this.deadT - 7) / 2) > 0.02;
      if (this.deadT > 9) this.remove = true;
      return;
    }

    if (this.state === ST.SPAWN) {
      this.spawnT += dt;
      this.mesh.position.y = this.pos.y;
      if (this.spawnT > 0.35) this.setState(this.alerted ? ST.ATTACK : ST.ADVANCE);
      return;
    }

    const T = this.acquireTarget();
    if (!T) {
      this.vel.multiplyScalar(0.85);
      this.mesh.position.y = this.pos.y;
      return;
    }
    const toPlayer = new THREE.Vector3().subVectors(T.pos, this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // --- поведение по состояниям ---
    switch (this.state) {
      case ST.ADVANCE: {
        this._move(dt, toPlayer, this.speed);
        if (dist < this.range && this.stateT > 0.5) this.setState(ST.ATTACK);
        this.facing = Math.atan2(toPlayer.x, toPlayer.z);
        break;
      }
      case ST.ATTACK: {
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = 1.2 + Math.random() * 1.6; if (Math.random() < .4) this.strafe *= -1; }
        const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
        const move = new THREE.Vector3();
        if (dist > this.range * 0.8) move.addScaledVector(toPlayer, 1);
        else if (dist < this.range * 0.35) move.addScaledVector(toPlayer, -1);
        move.addScaledVector(side, this.strafe * 0.8);
        this._move(dt, move, this.speed * 0.75);
        this.facing = Math.atan2(toPlayer.x, toPlayer.z);
        this.fireCd -= dt;
        if (this.fireCd <= 0 && dist < this.range && g.losClear(this.pos, T.pos)) {
          this.fireCd = this.fireInterval * (0.8 + Math.random() * 0.5);
          this.shoot(dist, T);
        }
        break;
      }
      case ST.EVACUATE: {
        const t = this.target;
        if (!t) { this.setState(ST.ADVANCE); break; }
        const dir = new THREE.Vector3().subVectors(t, this.pos); dir.y = 0;
        if (dir.length() < 4) {
          this.escaped = true;
          g.onEnemyEscaped(this);
          this.remove = true;
        } else {
          this._move(dt, dir, this.speed * 1.35);
        }
        break;
      }
      case ST.SURRENDER: {
        // медленно пятится, руки подняты
        if (this.stateT < 3) this._move(dt, toPlayer.clone().negate(), 1.1);
        else this.vel.multiplyScalar(0.85);
        this.speakCd -= dt;
        if (this.speakCd <= 0 && Math.random() < 0.3) { this.speakCd = 9 + Math.random() * 8; this.shout(); }
        break;
      }
      case ST.BEG: {
        this.vel.multiplyScalar(0.8);
        this.speakCd -= dt;
        if (this.speakCd <= 0 && Math.random() < 0.35) { this.speakCd = 8 + Math.random() * 8; this.shout(); }
        break;
      }
    }

    // --- поза / анимация ---
    const parts = this.parts;
    if (this.prone) {
      this.mesh.rotation.x = -1.45;
      parts.armR.rotation.x = -0.4 + Math.sin(this.stateT * 7) * 0.5;
      parts.armL.rotation.x = -0.6;
      parts.legL.rotation.x = 0.1; parts.legR.rotation.x = -0.1;
    } else if (this.state === ST.SURRENDER) {
      this.mesh.rotation.x = 0;
      parts.armL.rotation.x = -2.9; parts.armR.rotation.x = -2.9;
      parts.armL.rotation.z = 0.35; parts.armR.rotation.z = -0.35;
      parts.legL.rotation.x = 0; parts.legR.rotation.x = 0;
      parts.gun.visible = false;
    } else {
      this.mesh.rotation.x = 0;
      const s = Math.sin(this.anim) * Math.min(1, this.vel.length() / 3) * 0.75;
      parts.legL.rotation.x = s; parts.legR.rotation.x = -s;
      const aiming = this.state === ST.ATTACK || this.state === ST.ADVANCE;
      if (aiming) {
        parts.armR.rotation.x = -1.45; parts.armL.rotation.x = -1.25;
        parts.armR.rotation.z = -0.18; parts.armL.rotation.z = 0.28;
      } else {
        parts.armR.rotation.x = -s * 0.7; parts.armL.rotation.x = s * 0.7;
        parts.armR.rotation.z = 0; parts.armL.rotation.z = 0;
      }
    }
    this.mesh.rotation.y = this.facing;
    this.mesh.position.y = this.pos.y;
  }

  shoot(dist, target) {
    const g = this.game;
    const muzzle = new THREE.Vector3();
    this.parts.muzzle.getWorldPosition(muzzle);
    const aim = target.pos.clone(); aim.y += 1.15;
    // разброс
    const miss = (1 - this.accuracy * (1 - Math.min(1, dist / 70))) * 2.2;
    aim.x += (Math.random() - 0.5) * miss * 2.4;
    aim.y += (Math.random() - 0.5) * miss * 1.6;
    aim.z += (Math.random() - 0.5) * miss * 2.4;
    g.effects.tracer(muzzle, aim, 0xff8a4a);
    g.effects.muzzleFlash(muzzle, aim.clone().sub(muzzle).normalize());
    g.audio.enemyShot(dist);

    const hitDist = aim.distanceTo(target.pos.clone().setY(target.pos.y + 1.2));
    if (hitDist < 0.9) {
      if (this.isAlly) target.damage(this.dmg * (0.7 + Math.random() * 0.6), 'body');
      else g.damagePlayer(this.dmg * (0.7 + Math.random() * 0.6), this);
    } else if (Math.random() < 0.4) {
      g.effects.impact(aim, 'metal');
    }
  }

  // сферы для попаданий
  hitSpheres() {
    if (this.prone) {
      return [
        { c: new THREE.Vector3(this.pos.x, this.pos.y + 0.32, this.pos.z), r: 0.28, zone: 'head' },
        { c: new THREE.Vector3(this.pos.x, this.pos.y + 0.28, this.pos.z), r: 0.55, zone: 'body' },
      ];
    }
    return [
      { c: new THREE.Vector3(this.pos.x, this.pos.y + 1.72, this.pos.z), r: 0.3, zone: 'head' },
      { c: new THREE.Vector3(this.pos.x, this.pos.y + 1.05, this.pos.z), r: 0.58, zone: 'body' },
    ];
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
