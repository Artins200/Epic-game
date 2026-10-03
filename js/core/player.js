// Игрок: управление от первого лица, оружие, здоровье.
import * as THREE from '../../vendor/three.module.js';
import { makeSoldier } from './actors.js';

const W = {
  damage: 27, headMult: 2.4, rpm: 640, magSize: 30, reserveMax: 300,
  reloadTime: 1.9, range: 140, spreadBase: 0.006, spreadMove: 0.02, spreadMax: 0.075,
};

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.hp = 100; this.maxHp = 100;
    this.regenT = 0;
    this.hasWeapon = false;
    this.mag = 0; this.reserve = 0;
    this.fireCd = 0; this.reloadT = 0;
    this.spread = W.spreadBase;
    this.shotsFired = 0; this.shotsHit = 0;
    this.bob = 0; this.stepT = 0;
    this.kick = 0; this.kickV = 0;
    this.shake = 0;
    this.eyeH = 1.66;
    this.sprinting = false;
    this.locked = false;          // управление отключено (катсцены)
    this.parachute = false;
    this.dead = false;
    this.interactCd = 0;

    this._buildViewmodel();
    // тело игрока (видно в катсценах от третьего лица)
    this.body = makeSoldier({ uniform: 0x3f4a3a, gear: 0x2a2f22, helmet: 0x333b2c });
    this.body.visible = false;
    this.bodyParts = this.body.userData.parts;
  }

  _buildViewmodel() {
    const vm = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x26282a });
    const wood = new THREE.MeshLambertMaterial({ color: 0x4a3524 });
    const hand = new THREE.MeshLambertMaterial({ color: 0x2f3a26 });
    const box = (w, h, d, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z); vm.add(mesh); return mesh;
    };
    box(0.07, 0.1, 0.62, dark, 0, 0, -0.1);
    box(0.06, 0.26, 0.1, dark, 0, -0.14, 0.02);
    box(0.07, 0.1, 0.2, wood, 0, -0.02, 0.34);
    box(0.05, 0.05, 0.16, dark, 0, 0.075, -0.16);
    box(0.11, 0.11, 0.14, hand, 0.02, -0.07, 0.14);
    box(0.11, 0.11, 0.12, hand, -0.02, -0.05, -0.12);
    this.muzzleVM = new THREE.Object3D();
    this.muzzleVM.position.set(0, 0.01, -0.44);
    vm.add(this.muzzleVM);
    vm.position.set(0.24, -0.22, -0.5);
    vm.rotation.y = 0.03;
    vm.visible = false;
    this.viewmodel = vm;
  }

  attachTo(camera) {
    this.camera = camera;
    camera.add(this.viewmodel);
    this.vmLight = new THREE.PointLight(0xfff0d0, 0.6, 6);
    this.vmLight.position.set(0.3, 0.3, 0.2);
    camera.add(this.vmLight);
  }

  setWeapon(on) {
    this.hasWeapon = on;
    this.viewmodel.visible = on;
    if (on && this.mag === 0 && this.reserve === 0) { this.mag = W.magSize; this.reserve = 180; }
  }

  get alive() { return this.hp > 0 && !this.dead; }

  damage(amount, from) {
    if (!this.alive || this.locked) return;
    this.hp -= amount;
    this.regenT = 5.5;
    this.game.onPlayerHurt(amount, from);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.onPlayerDeath(); }
  }

  get hpPct() { return this.hp / this.maxHp; }

  heal(v) { this.hp = Math.min(this.maxHp, this.hp + v); }

  addAmmo(n) { this.reserve = Math.min(W.reserveMax, this.reserve + n); }

  startReload() {
    if (this.reloadT > 0 || this.mag >= W.magSize || this.reserve <= 0 || !this.hasWeapon) return;
    this.reloadT = W.reloadTime;
    this.game.audio.reloadTick(0);
    setTimeout(() => this.game.audio.reloadTick(1), 500);
    setTimeout(() => this.game.audio.reloadTick(2), 1200);
  }

  shoot() {
    if (!this.hasWeapon || this.reloadT > 0 || this.fireCd > 0) return;
    if (this.mag <= 0) {
      this.fireCd = 0.28;
      this.game.audio.empty();
      if (this.reserve > 0) this.startReload();
      return;
    }
    this.mag--;
    this.fireCd = 60 / W.rpm;
    this.shotsFired++;
    this.spread = Math.min(W.spreadMax, this.spread + 0.011);
    this.kickV += 1.5;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * this.spread * 2;
    dir.y += (Math.random() - 0.5) * this.spread * 2;
    dir.z += (Math.random() - 0.5) * this.spread * 2;
    dir.normalize();
    const origin = this.camera.getWorldPosition(new THREE.Vector3());

    const hit = this.game.castShot(origin, dir, W.range);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, W.range);

    const muzzleW = this.muzzleVM.getWorldPosition(new THREE.Vector3());
    this.game.effects.tracer(muzzleW, end, 0xffe08a);
    this.game.effects.muzzleFlash(muzzleW, dir);
    this.game.audio.gunshot(1, 0);

    if (hit && hit.enemy) {
      this.shotsHit++;
      const killed = hit.enemy.damage(W.damage, hit.zone);
      this.game.onHitEnemy(hit.enemy, killed);
      this.game.effects.impact(hit.point, 'flesh');
    } else if (hit) {
      this.game.effects.impact(hit.point, 'metal');
      this.game.audio.impact('metal');
    }
  }

  updateMovement(dt, input) {
    const speed = this.sprinting ? 8.4 : 5.0;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.down('KeyW')) wish.add(fwd);
    if (input.down('KeyS')) wish.sub(fwd);
    if (input.down('KeyD')) wish.add(right);
    if (input.down('KeyA')) wish.sub(right);
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();

    const accel = this.onGround ? 14 : 3.5;
    const target = wish.multiplyScalar(speed);
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);

    if (this.onGround && input.down('Space')) { this.vel.y = 7.4; this.onGround = false; }
    this.vel.y -= 22 * dt;

    const next = this.pos.clone();
    next.x += this.vel.x * dt;
    next.z += this.vel.z * dt;
    this.game.resolveCollision(next, 0.42, this.eyeH);
    next.y += this.vel.y * dt;

    const gh = this.game.groundHeight(next.x, next.z, this.pos.y);
    if (next.y <= gh) {
      if (!this.onGround && this.vel.y < -8) {
        const dmg = (-this.vel.y - 8) * 3.2;
        if (dmg > 1) this.damage(dmg, null);
        this.game.effects.dust(new THREE.Vector3(next.x, gh + 0.1, next.z), 10);
      }
      next.y = gh; this.vel.y = 0; this.onGround = true;
    } else this.onGround = false;
    this.pos.copy(next);

    // шаги
    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && planar > 1) {
      this.bob += dt * (this.sprinting ? 11 : 7.5);
      this.stepT -= dt * (this.sprinting ? 1.5 : 1);
      if (this.stepT <= 0) { this.stepT = 0.42; this.game.audio.footstep(); }
    } else this.bob += dt * 1.2;

    this.sprinting = input.down('ShiftLeft') && input.down('KeyW') && !this.reloading();
  }

  reloading() { return this.reloadT > 0; }

  update(dt, input) {
    // перезарядка
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = W.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take; this.reserve -= take;
        this.reloadT = 0;
      }
    }
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.spread = Math.max(W.spreadBase + (this.onGround ? 0 : 0.02), this.spread - dt * 0.045);
    this.game.ui.spread(this.spread > 0.02);

    // регенерация
    if (this.alive) {
      this.regenT -= dt;
      if (this.regenT <= 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 7 * dt);
    }

    if (this.locked) {
      this.viewmodel.visible = false;
      return;
    }
    this.viewmodel.visible = this.hasWeapon;

    if (input) {
      const sens = 0.0022;
      this.yaw -= input.dx * sens;
      this.pitch -= input.dy * sens;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      this.updateMovement(dt, input);
      if (input.down('MouseLeft') || input.mouseDown) { /* стрельба в game.update */ }
      if (input.hit('KeyR')) this.startReload();
    }

    // отдача / тряска
    this.kickV -= this.kick * 26 * dt;
    this.kick += this.kickV * dt * 12;
    this.kick *= 0.9;
    this.shake = Math.max(0, this.shake - dt * 3.5);

    // камера
    const bobY = Math.sin(this.bob * 2) * 0.035 * (this.sprinting ? 1.5 : 1);
    const bobX = Math.cos(this.bob) * 0.028;
    const cam = this.camera;
    cam.position.set(this.pos.x + bobX, this.pos.y + this.eyeH + bobY, this.pos.z);
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + (Math.random() - 0.5) * this.shake * 0.05;
    cam.rotation.x = this.pitch + this.kick * 0.02 + (Math.random() - 0.5) * this.shake * 0.05;

    // вьюмодель: покачивание и отдача
    const vm = this.viewmodel;
    vm.position.set(0.24 + bobX * 0.4, -0.22 + bobY * 0.6 - (this.reloadT > 0 ? 0.12 : 0), -0.5 + this.kick * 0.03);
    vm.rotation.set(this.reloadT > 0 ? -0.5 + this.kick * 0.02 : this.kick * 0.02, 0.03, this.reloadT > 0 ? 0.3 : 0);
  }

  // позиция для катсцен от третьего лица
  syncBody() {
    this.body.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.body.rotation.y = this.yaw;
    this.bodyParts.armR.rotation.x = -1.4;
    this.bodyParts.armL.rotation.x = -1.2;
  }
}
