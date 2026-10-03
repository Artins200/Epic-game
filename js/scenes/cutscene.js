// Мини-движок катсцен: таймлайн + камера по ключевым точкам.
import * as THREE from '../../vendor/three.module.js';

const ease = k => k * k * (3 - 2 * k);

export class Rig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fromP = new THREE.Vector3();
    this.fromL = new THREE.Vector3();
    this.toP = new THREE.Vector3();
    this.toL = new THREE.Vector3();
    this.t = 0; this.dur = 0;
    this.follow = null;      // {obj, offsetPos, offsetLook} — камера следит за объектом
    this.fov = null;
    this._init = false;
  }

  snap(pos, look) {
    this.pos.copy(pos); this.look.copy(look);
    this.fromP.copy(pos); this.fromL.copy(look);
    this.toP.copy(pos); this.toL.copy(look);
    this.t = 0; this.dur = 0; this.follow = null;
    this._apply();
    this._init = true;
  }

  goto(pos, look, dur = 2) {
    this.fromP.copy(this.pos); this.fromL.copy(this.look);
    this.toP.copy(pos); this.toL.copy(look);
    this.t = 0; this.dur = dur; this.follow = null;
  }

  attach(obj, offPos, offLook, smooth = 0.15) {
    this.follow = { obj, offPos: offPos.clone(), offLook: offLook.clone(), smooth };
  }

  detach() { this.follow = null; }

  setFov(v, dur = 1) { this.fov = { from: this.cam.fov, to: v, t: 0, dur }; }

  update(dt) {
    if (this.follow) {
      const o = this.follow.obj;
      const tp = o.localToWorld(this.follow.offPos.clone());
      const tl = o.localToWorld(this.follow.offLook.clone());
      const k = 1 - Math.pow(1 - this.follow.smooth, dt * 60);
      this.pos.lerp(tp, k); this.look.lerp(tl, k);
    } else if (this.dur > 0) {
      this.t += dt;
      const k = ease(Math.min(1, this.t / this.dur));
      this.pos.lerpVectors(this.fromP, this.toP, k);
      this.look.lerpVectors(this.fromL, this.toL, k);
      if (this.t >= this.dur) this.dur = 0;
    }
    if (this.fov) {
      this.fov.t += dt;
      const k = Math.min(1, this.fov.t / this.fov.dur);
      this.cam.fov = this.fov.from + (this.fov.to - this.fov.from) * ease(k);
      this.cam.updateProjectionMatrix();
      if (k >= 1) this.fov = null;
    }
    this._apply();
  }

  _apply() {
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }
}

export class Timeline {
  constructor() { this.events = []; this.t = 0; this.finished = false; }
  at(time, fn) { this.events.push({ time, fn, done: false }); this.events.sort((a, b) => a.time - b.time); return this; }
  update(dt) {
    this.t += dt;
    for (const e of this.events) {
      if (!e.done && this.t >= e.time) { e.done = true; e.fn(); }
    }
  }
  skipAll() {
    for (const e of this.events) if (!e.done) { e.done = true; e.fn(); }
  }
  get done() { return this.events.every(e => e.done); }
}

export function makePlaneInterior() {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x59636b, side: THREE.DoubleSide });
  const metalD = new THREE.MeshLambertMaterial({ color: 0x39424a, side: THREE.DoubleSide });
  const floorM = new THREE.MeshLambertMaterial({ color: 0x2f363c });

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 22, 14, 1, true), metal);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // пол
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 21), floorM);
  floor.position.y = -1.5; g.add(floor);
  // шпангоуты
  for (let i = -9; i <= 8; i += 2) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.11, 6, 16), metalD);
    rib.position.z = i; g.add(rib);
  }
  // скамейки
  for (const sx of [-1.35, 1.35]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 9), metalD);
    b.position.set(sx, -1.0, -1); g.add(b);
    for (let i = -4; i <= 3; i += 2) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), metalD);
      leg.position.set(sx, -1.25, i); g.add(leg);
    }
  }
  // сетка с грузом
  const net = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6b6145, wireframe: true }));
  net.position.set(0, -0.2, -8.5); g.add(net);
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), new THREE.MeshLambertMaterial({ color: 0x4d5a35 }));
  cargo.position.set(0, -0.8, -9.4); g.add(cargo);
  // аппаратура в носу
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 0.3), metalD);
  panel.position.set(0, -0.6, 8.6); g.add(panel);
  for (let i = 0; i < 6; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x33ff88 : 0xff5533 }));
    led.position.set(-1 + i * 0.4, -0.4, 8.44); g.add(led);
  }
  // красный/зелёный сигнал десанта
  const redL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
  redL.position.set(0, 1.4, 3); g.add(redL);
  const greenL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x114411 }));
  greenL.position.set(0, 1.4, 2.2); g.add(greenL);
  // открытая рампа
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 4.6), metalD);
  ramp.position.set(0, -1.9, -11.6); ramp.rotation.x = -0.42; g.add(ramp);

  const red = new THREE.PointLight(0xff3a1a, 1.5, 16, 2);
  red.position.set(0, 1.1, 2.6); g.add(red);
  const dim = new THREE.PointLight(0xbfd6e8, 0.5, 20, 2);
  dim.position.set(0, 0.5, -6); g.add(dim);

  g.userData.redL = redL; g.userData.greenL = greenL; g.userData.redLight = red;
  return g;
}

/** Низкополигональный транспортник для катсцен. */
export function makeTransport() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0x6f7a6a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3b423a });
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 17, 12), body);
  fuse.rotation.x = Math.PI / 2; g.add(fuse);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), body);
  nose.rotation.x = Math.PI / 2; nose.position.z = 8.5; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 0.35, 3.2), body);
  wing.position.set(0, 0.5, 1.5); g.add(wing);
  const props = [];
  for (const sx of [-9.5, 9.5]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.4, 10), dark);
    eng.rotation.x = Math.PI / 2; eng.position.set(sx, 0.5, 1.8); g.add(eng);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.12), dark);
    prop.position.set(sx, 0.5, 3.6); g.add(prop);
    props.push(prop);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.4, 3), body);
  tail.position.set(0, 2.6, -8); g.add(tail);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 2.2), body);
  stab.position.set(0, 1.1, -8.4); g.add(stab);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 4), dark);
  ramp.position.set(0, -1.3, -9.4); ramp.rotation.x = -0.5; g.add(ramp);
  const gearL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), dark);
  gearL.position.set(-1.4, -2.4, 2); g.add(gearL);
  const gearR = gearL.clone(); gearR.position.x = 1.4; g.add(gearR);
  g.userData.ramp = ramp;
  g.userData.props = props;
  return g;
}
