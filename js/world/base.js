// ГЛАВА 2 — вражеская база «Квадрат 7»: центральное здание с аппаратурой, постройки, LZ, периметр.
import * as THREE from '../../vendor/three.module.js';

const M = {
  ground: new THREE.MeshLambertMaterial({ color: 0x5b6137 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x6b5f45 }),
  concrete: new THREE.MeshLambertMaterial({ color: 0x8d8b83 }),
  concreteD: new THREE.MeshLambertMaterial({ color: 0x6f6d66 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x5c6469 }),
  metalD: new THREE.MeshLambertMaterial({ color: 0x3d4448 }),
  rust: new THREE.MeshLambertMaterial({ color: 0x7a4a2c }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4c2c }),
  sandbag: new THREE.MeshLambertMaterial({ color: 0x9a8a5e }),
  red: new THREE.MeshLambertMaterial({ color: 0x8c2f26 }),
  green: new THREE.MeshLambertMaterial({ color: 0x3f5c33 }),
  glass: new THREE.MeshBasicMaterial({ color: 0x1a2a33 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x37ff9a }),
  screenB: new THREE.MeshBasicMaterial({ color: 0x4fc9ff }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
  pad: new THREE.MeshLambertMaterial({ color: 0x4a4f52 }),
};

function box(scene, colliders, w, h, d, x, y, z, mat, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  scene.add(m);
  if (opts.solid !== false) {
    const hw = (opts.ry ? d : w) / 2, hd = (opts.ry ? w : d) / 2;
    colliders.push({
      min: new THREE.Vector3(x - hw, y - h / 2, z - hd),
      max: new THREE.Vector3(x + hw, y + h / 2, z + hd),
      cx: x, cy: y, cz: z, r: Math.hypot(hw, h / 2, hd),
      occluder: opts.occluder !== false,
    });
  }
  return m;
}

function light(scene, x, y, z, color, intensity, dist, blink) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  scene.add(l);
  if (blink) l.userData.blink = blink;
  return l;
}

export function buildBase() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb2c4);
  scene.fog = new THREE.Fog(0x9fb2c4, 70, 320);

  const colliders = [];
  const out = { scene, colliders, occluders: null, spawns: [], evacPoints: [], props: [] };

  // свет
  const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x4c4a34, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.25);
  sun.position.set(60, 90, 40);
  scene.add(sun);

  // земля
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // площадки из грунта
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), M.dirt);
  apron.rotation.x = -Math.PI / 2; apron.position.y = 0.01;
  scene.add(apron);

  // ---------------- ЦЕНТРАЛЬНОЕ ЗДАНИЕ (штаб, аппаратура) ----------------
  const HQ = { x: 0, z: 0, w: 18, d: 14, h: 4.2 };
  const t = 0.5;
  // стены: южная (z+) с дверным проёмом
  box(scene, colliders, 7.5, HQ.h, t, -5.2, HQ.h / 2, HQ.d / 2, M.concrete);
  box(scene, colliders, 7.5, HQ.h, t, 5.2, HQ.h / 2, HQ.d / 2, M.concrete);
  box(scene, colliders, 3.0, HQ.h - 2.3, t, 0, HQ.h - (HQ.h - 2.3) / 2, HQ.d / 2, M.concrete);
  // северная
  box(scene, colliders, HQ.w, HQ.h, t, 0, HQ.h / 2, -HQ.d / 2, M.concrete);
  // западная с окном
  box(scene, colliders, t, HQ.h, 5, -HQ.w / 2, HQ.h / 2, -4.5, M.concrete);
  box(scene, colliders, t, HQ.h, 5, -HQ.w / 2, HQ.h / 2, 4.5, M.concrete);
  box(scene, colliders, t, HQ.h, 4, -HQ.w / 2, HQ.h / 2, 0, M.concrete, { solid: false });
  box(scene, colliders, t, 1.2, 4, -HQ.w / 2, 0.6, 0, M.concrete);
  box(scene, colliders, t, 1.2, 4, -HQ.w / 2, HQ.h - 0.6, 0, M.concrete);
  box(scene, colliders, t, 1.8, 4, -HQ.w / 2, 2.1, 0, M.glass, { solid: false, occluder: false });
  // восточная
  box(scene, colliders, t, HQ.h, HQ.d, HQ.w / 2, HQ.h / 2, 0, M.concrete);
  // крыша
  box(scene, colliders, HQ.w + 1.2, 0.4, HQ.d + 1.2, 0, HQ.h + 0.2, 0, M.concreteD, { occluder: true });

  // пол штаба
  const hqFloor = new THREE.Mesh(new THREE.PlaneGeometry(HQ.w - 1, HQ.d - 1), M.concreteD);
  hqFloor.rotation.x = -Math.PI / 2; hqFloor.position.y = 0.03;
  scene.add(hqFloor);

  // --- аппаратура связи (главная точка главы) ---
  const appGroup = new THREE.Group();
  appGroup.position.set(0, 0, -4.6);
  scene.add(appGroup);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 1.3), M.metalD);
  desk.position.y = 0.5; appGroup.add(desk);
  for (let i = -1; i <= 1; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.1), i === 0 ? M.screenB : M.screen);
    s.position.set(i * 1.65, 1.65, -0.3); appGroup.add(s);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.15, 0.08), M.metal);
    frame.position.set(i * 1.65, 1.65, -0.34); appGroup.add(frame);
  }
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.7), M.metal);
  rack.position.set(-4.2, 1.3, -0.6); appGroup.add(rack);
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x44ff88 : 0xffb020 }));
    l.position.set(-4.2 + (i % 2) * 0.25 - 0.12, 2.3 - (i >> 1) * 0.28, -0.24);
    appGroup.add(l); lamps.push(l);
  }
  light(scene, 0, 2.6, -4.2, 0x79ffc0, 1.4, 12);

  // стол с картой и ящики внутри
  const mapTable = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 2.2), M.wood);
  mapTable.position.set(4.6, 0.45, 2.6); scene.add(mapTable);
  colliders.push({
    min: new THREE.Vector3(2.9, 0, 1.5), max: new THREE.Vector3(6.3, 0.9, 3.7),
    cx: 4.6, cy: 0.45, cz: 2.6, r: 2.2, occluder: false,
  });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshBasicMaterial({ color: 0xd9cfa2 }));
  map.rotation.x = -Math.PI / 2; map.position.set(4.6, 0.91, 2.6); scene.add(map);
  for (const [x, z] of [[-6, 3.5], [-6.6, -1.5], [6.5, -3]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), M.wood);
    c.position.set(x, 0.55, z); scene.add(c);
    colliders.push({
      min: new THREE.Vector3(x - 0.55, 0, z - 0.55), max: new THREE.Vector3(x + 0.55, 1.1, z + 0.55),
      cx: x, cy: 0.55, cz: z, r: 1, occluder: true,
    });
  }
  // потолочные лампы штаба
  for (const [x, z] of [[-4, -3], [4, 3], [0, 0]]) {
    const lp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.4), M.lamp);
    lp.position.set(x, HQ.h - 0.3, z); scene.add(lp);
    light(scene, x, HQ.h - 0.6, z, 0xfff0c8, 1.1, 16);
  }

  // --- люк в подвал (появится после эвакуационной катсцены) ---
  out.hatchPos = new THREE.Vector3(6.4, 0, -4.6);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 2.4), M.metalD);
  hatch.position.set(out.hatchPos.x, 0.08, out.hatchPos.z); scene.add(hatch);
  const hatchRing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.7), M.rust);
  hatchRing.position.set(out.hatchPos.x, 0.05, out.hatchPos.z); scene.add(hatchRing);

  out.consolePos = new THREE.Vector3(0, 1.2, -3.4);

  // ---------------- ВСПОМОГАТЕЛЬНЫЕ ПОСТРОЙКИ ----------------
  function hut(x, z, ry) {
    const g = new THREE.Group();
    const w = 9, d = 6.5, h = 3.4;
    const walls = [
      [w, h, 0.35, 0, h / 2, -d / 2], [w, h, 0.35, 0, h / 2, d / 2],
      [0.35, h, d, -w / 2, h / 2, 0], [0.35, h, d, w / 2, h / 2, 0],
    ];
    walls.forEach(([ww, hh, dd, xx, yy, zz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), M.concreteD);
      m.position.set(xx, yy, zz); g.add(m);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.3, d + 0.8), M.rust);
    roof.position.y = h + 0.15; g.add(roof);
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
    // один цельный коллайдер
    const hw = Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * d / 2;
    const hd = Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * d / 2;
    colliders.push({
      min: new THREE.Vector3(x - hw, 0, z - hd), max: new THREE.Vector3(x + hw, h + 0.3, z + hd),
      cx: x, cy: h / 2, cz: z, r: Math.hypot(hw, h, hd), occluder: true,
    });
  }
  hut(-42, -34, 0); hut(42, -34, 0); hut(-42, 32, 0); hut(44, 30, Math.PI / 2);
  hut(-66, 4, Math.PI / 2);

  // вышки
  function tower(x, z) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7, 0.35), M.metal);
      leg.position.set(sx * 1.4, 3.5, sz * 1.4); g.add(leg);
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), M.wood);
    plat.position.y = 7; g.add(plat);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 4.4), M.rust);
    roof.position.y = 9.4; g.add(roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), M.metal);
      p.position.set(sx * 1.9, 8.2, sz * 1.9); g.add(p);
    }
    g.position.set(x, 0, z); scene.add(g);
    light(scene, x, 9.1, z, 0xffe6a8, 1.4, 34);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      colliders.push({
        min: new THREE.Vector3(x + sx * 1.6, 0, z + sz * 1.6),
        max: new THREE.Vector3(x + sx * 1.6 + 0.4, 7, z + sz * 1.6 + 0.4),
        cx: x + sx * 1.6, cy: 3.5, cz: z + sz * 1.6, r: 4, occluder: true,
      });
    }
  }
  tower(-74, -66); tower(74, -66); tower(-74, 66); tower(74, 66);

  // контейнеры
  const conts = [
    [-22, 16, 0], [-15, 18, 0], [20, 14, Math.PI / 2], [26, 16, Math.PI / 2],
    [-30, -14, Math.PI / 2], [16, -22, 0], [32, -6, 0], [-52, -18, 0],
    [56, 12, Math.PI / 2], [-18, -26, 0], [8, 26, 0], [40, 42, 0], [-36, 44, Math.PI / 2],
  ];
  for (const [x, z, ry] of conts) {
    const w = 6.1, d = 2.5, h = 2.6;
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.4 ? M.rust : M.metal);
    c.position.set(x, h / 2, z); c.rotation.y = ry; scene.add(c);
    const hw = (ry ? d : w) / 2, hd = (ry ? w : d) / 2;
    colliders.push({
      min: new THREE.Vector3(x - hw, 0, z - hd), max: new THREE.Vector3(x + hw, h, z + hd),
      cx: x, cy: h / 2, cz: z, r: 4, occluder: true,
    });
  }

  // мешки с песком
  const bags = [
    [-8, 12, 6, 0], [8, 12, 6, 0], [-12, -12, 0, 6], [12, -12, 0, 6],
    [24, 24, 8, 0], [-26, 24, 8, 0], [0, 34, 10, 0], [-46, -2, 0, 8], [46, 2, 0, 8],
  ];
  for (const [x, z, w, d] of bags) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 1.2), 1.15, Math.max(d, 1.2)), M.sandbag);
    m.position.set(x, 0.57, z); scene.add(m);
    colliders.push({
      min: new THREE.Vector3(x - Math.max(w, 1.2) / 2, 0, z - Math.max(d, 1.2) / 2),
      max: new THREE.Vector3(x + Math.max(w, 1.2) / 2, 1.15, z + Math.max(d, 1.2) / 2),
      cx: x, cy: 0.6, cz: z, r: Math.max(w, d), occluder: true,
    });
  }

  // бочки и топливные баки
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 11 && Math.abs(z) < 9) continue;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 8),
      Math.random() < 0.5 ? M.green : M.rust);
    b.position.set(x, 0.6, z); scene.add(b);
    colliders.push({
      min: new THREE.Vector3(x - 0.45, 0, z - 0.45), max: new THREE.Vector3(x + 0.45, 1.2, z + 0.45),
      cx: x, cy: 0.6, cz: z, r: 1, occluder: true,
    });
  }
  for (const [x, z] of [[-58, -46], [58, -46]]) {
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 6, 14), M.metalD);
    tk.rotation.z = Math.PI / 2; tk.position.set(x, 3.4, z); scene.add(tk);
    colliders.push({
      min: new THREE.Vector3(x - 3.4, 0, z - 3.4), max: new THREE.Vector3(x + 3.4, 6.6, z + 3.4),
      cx: x, cy: 3.3, cz: z, r: 6, occluder: true,
    });
  }

  // разбитый грузовик
  const truck = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.6), M.green);
  cab.position.set(0, 1.4, 1.6); truck.add(cab);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 4), M.metalD);
  bed.position.set(0, 1.1, -1.6); truck.add(bed);
  for (const sz of [-1.6, 1.8]) for (const sx of [-1.1, 1.1]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0x1b1b1b }));
    wh.rotation.z = Math.PI / 2; wh.position.set(sx, 0.62, sz); truck.add(wh);
  }
  truck.position.set(30, 0, 36); truck.rotation.y = 0.6;
  scene.add(truck);
  colliders.push({
    min: new THREE.Vector3(26.5, 0, 32.5), max: new THREE.Vector3(33.5, 2.6, 39.5),
    cx: 30, cy: 1.3, cz: 36, r: 5, occluder: true,
  });

  // радар
  const radar = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 10, 8), M.metal);
  mast.position.y = 5; radar.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), M.metalD);
  dish.rotation.x = Math.PI / 1.6; dish.position.y = 11; radar.add(dish);
  radar.position.set(-62, 0, 52); scene.add(radar);
  out.radarDish = dish;
  colliders.push({
    min: new THREE.Vector3(-63.2, 0, 50.8), max: new THREE.Vector3(-60.8, 10, 53.2),
    cx: -62, cy: 5, cz: 52, r: 7, occluder: true,
  });

  // ---------------- ПЕРИМЕТР ----------------
  const R = 92;
  const gaps = { 0: 2, 1: 1, 2: 1, 3: 2 };   // по одному проёму на сторону — туда бежит база
  for (let i = 0; i < 4; i++) {
    const seg = 46;
    for (let k = 0; k < 4; k++) {
      if (gaps[i] === k) continue;
      const off = -69 + k * seg;
      let x, z, w, d;
      if (i < 2) { x = off; z = i === 0 ? R : -R; w = seg; d = 0.6; }
      else { x = i === 2 ? R : -R; z = off; w = 0.6; d = seg; }
      box(scene, colliders, w, 3.2, d, x, 1.6, z, M.concreteD, { occluder: true });
      const wire = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? seg : 0.2, 0.5, i < 2 ? 0.2 : seg),
        new THREE.MeshBasicMaterial({ color: 0x2a2a2a, wireframe: true }));
      wire.position.set(x, 3.5, z); scene.add(wire);
    }
  }
  // ворота (юг) — проём
  for (const sx of [-1, 1]) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 1), M.rust);
    gate.position.set(sx * 4.5, 2.3, R + 0.6); scene.add(gate);
  }

  // ---------------- ПЛОЩАДКА ЭВАКУАЦИИ ----------------
  const LZ = new THREE.Vector3(62, 0, -54);
  out.lz = LZ;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), M.pad);
  pad.rotation.x = -Math.PI / 2; pad.position.set(LZ.x, 0.02, LZ.z); scene.add(pad);
  const mark = new THREE.Mesh(new THREE.RingGeometry(5.2, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffcc44, side: THREE.DoubleSide }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(LZ.x, 0.04, LZ.z); scene.add(mark);
  out.lzMark = mark;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x44ff88 }));
    l.position.set(LZ.x + Math.cos(a) * 9, 0.6, LZ.z + Math.sin(a) * 9); scene.add(l);
  }
  light(scene, LZ.x, 6, LZ.z, 0x88ffbb, 1.2, 40);

  // точки эвакуации противника (куда они бегут во время паники)
  out.evacPoints = [
    new THREE.Vector3(23, 0, 106), new THREE.Vector3(-23, 0, -106),
    new THREE.Vector3(106, 0, -23), new THREE.Vector3(-106, 0, 23),
  ];

  // точки появления волн
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    out.spawns.push(new THREE.Vector3(Math.cos(a) * 86, 0, Math.sin(a) * 86));
  }

  // декор за периметром: деревья и холмы
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = 105 + Math.random() * 130;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 4 + Math.random() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h * 0.4, 5), M.wood);
    trunk.position.set(x, h * 0.2, z); scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 + Math.random(), h * 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x33482a }));
    crown.position.set(x, h * 0.65, z); scene.add(crown);
  }
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = 180 + Math.random() * 90;
    const m = new THREE.Mesh(new THREE.ConeGeometry(28 + Math.random() * 22, 26 + Math.random() * 30, 5),
      new THREE.MeshLambertMaterial({ color: 0x6d7a6a }));
    m.position.set(Math.cos(a) * r, 6, Math.sin(a) * r); scene.add(m);
  }

  // аварийные лампы (для паники)
  out.alarmLights = [
    light(scene, 0, 5.4, 8.5, 0xff2200, 0, 30, true),
    light(scene, 30, 5, -30, 0xff2200, 0, 30, true),
    light(scene, -30, 5, 30, 0xff2200, 0, 30, true),
  ];
  out.appLamps = lamps;
  out.ground = ground;
  return out;
}
