// ГЛАВА 3 — подвал: лестницы, узкие проходы, серверные и секретные технологии.
import * as THREE from '../../vendor/three.module.js';

const MAT = {
  floor: new THREE.MeshLambertMaterial({ color: 0x4a4a48 }),
  floorAlt: new THREE.MeshLambertMaterial({ color: 0x3d4043 }),
  wall: new THREE.MeshLambertMaterial({ color: 0x5b5a54 }),
  wallB: new THREE.MeshLambertMaterial({ color: 0x47463f }),
  ceil: new THREE.MeshLambertMaterial({ color: 0x2e2e2c }),
  step: new THREE.MeshLambertMaterial({ color: 0x575752 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x4c5257 }),
  pipe: new THREE.MeshLambertMaterial({ color: 0x6a5b3c }),
  crate: new THREE.MeshLambertMaterial({ color: 0x5b4526 }),
  rack: new THREE.MeshLambertMaterial({ color: 0x24282c }),
  glass: new THREE.MeshBasicMaterial({ color: 0x2a3b44 }),
  tech: new THREE.MeshBasicMaterial({ color: 0x59e0ff }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xfff0c0 }),
};

const CELLS = [
  { x0: -5, x1: 5, z0: 0, z1: 10, y: 0, h: 3.6, name: 'Лестничный холл' },
  { x0: -1.5, x1: 1.5, z0: -10, z1: 0, y: 0, h: 3.0, name: 'Узкий проход' },
  { x0: -7, x1: 7, z0: -22, z1: -10, y: 0, h: 3.6, name: 'Серверная' },
  { x0: -17, x1: -7, z0: -18, z1: -14, y: 0, h: 3.0, name: 'Технический коридор' },
  { x0: -25, x1: -17, z0: -22, z1: -14, y: -4, h: 7.6, name: 'Лестница вниз', stairs: true },
  { x0: -33, x1: -25, z0: -20, z1: -16, y: -4, h: 3.0, name: 'Нижний коридор' },
  { x0: -45, x1: -33, z0: -26, z1: -14, y: -4, h: 3.6, name: 'Архив' },
  { x0: -41, x1: -37, z0: -36, z1: -26, y: -4, h: 3.0, name: 'Проход к лаборатории' },
  { x0: -47, x1: -33, z0: -48, z1: -36, y: -4, h: 3.8, name: 'Лаборатория' },
];

export function buildBasement() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c0d);
  scene.fog = new THREE.FogExp2(0x0a0c0d, 0.028);

  const colliders = [];
  const stepTops = [];
  const lights = [];
  const out = { scene, colliders, stepTops, cells: CELLS, lights, techSpots: [], props: [] };

  scene.add(new THREE.AmbientLight(0x39424a, 0.85));

  const wallGeo = [];
  const addWall = (cx, cy, cz, w, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.35 ? MAT.wallB : MAT.wall);
    m.position.set(cx, cy, cz);
    scene.add(m);
    colliders.push({
      min: new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
      max: new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
      cx, cy, cz, r: Math.hypot(w, h, d) / 2, occluder: true,
    });
  };

  // -------- полы, потолки, стены по ячейкам --------
  for (const c of CELLS) {
    const w = c.x1 - c.x0, d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;

    if (!c.stairs) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        c.name === 'Серверная' || c.name === 'Лаборатория' ? MAT.floorAlt : MAT.floor);
      f.rotation.x = -Math.PI / 2; f.position.set(cx, c.y + 0.01, cz);
      scene.add(f);
    }
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MAT.ceil);
    cl.rotation.x = Math.PI / 2; cl.position.set(cx, c.y + c.h - 0.02, cz);
    scene.add(cl);

    // стены: вычитаем проёмы соседних ячеек
    const sides = [
      { axis: 'z', at: c.z0, from: c.x0, to: c.x1, dir: -1 },  // юг
      { axis: 'z', at: c.z1, from: c.x0, to: c.x1, dir: 1 },   // север
      { axis: 'x', at: c.x0, from: c.z0, to: c.z1, dir: -1 },  // запад
      { axis: 'x', at: c.x1, from: c.z0, to: c.z1, dir: 1 },   // восток
    ];
    for (const s of sides) {
      const open = [];
      for (const o of CELLS) {
        if (o === c) continue;
        const touches = s.axis === 'z'
          ? Math.abs(o[s.dir > 0 ? 'z0' : 'z1'] - s.at) < 0.02
          : Math.abs(o[s.dir > 0 ? 'x0' : 'x1'] - s.at) < 0.02;
        if (!touches) continue;
        const a = Math.max(s.from, s.axis === 'z' ? o.x0 : o.z0);
        const b = Math.min(s.to, s.axis === 'z' ? o.x1 : o.z1);
        if (b - a > 0.05) open.push([a - 0.02, b + 0.02]);
      }
      open.sort((p, q) => p[0] - q[0]);
      let cur = s.from;
      for (const [a, b] of open) {
        if (a > cur + 0.05) emit(s, cur, a);
        cur = Math.max(cur, b);
      }
      if (s.to > cur + 0.05) emit(s, cur, s.to);
    }
    function emit(s, a, b) {
      const len = b - a, mid = (a + b) / 2;
      const hh = c.h;
      if (s.axis === 'z') addWall(mid, c.y + hh / 2, s.at, len, hh, 0.4);
      else addWall(s.at, c.y + hh / 2, mid, 0.4, hh, len);
    }
  }

  // -------- лестница вниз (ячейка «Лестница вниз») --------
  {
    const sc = CELLS[4];
    const steps = 12;
    const sx0 = sc.x1, sx1 = sc.x0;         // от -17 (верх) к -25 (низ)
    const totalX = sx0 - sx1;              // 8
    for (let i = 0; i < steps; i++) {
      const xA = sx0 - (i + 1) * (totalX / steps);
      const top = sc.y + 4 - (i + 1) * (4 / steps);
      const m = new THREE.Mesh(new THREE.BoxGeometry(totalX / steps, 4, sc.z1 - sc.z0), MAT.step);
      m.position.set((xA + totalX / steps / 2), top - 2, (sc.z0 + sc.z1) / 2);
      scene.add(m);
      stepTops.push({ x0: xA, x1: xA + totalX / steps, z0: sc.z0, z1: sc.z1, y: top });
    }
    // перила
    for (const z of [sc.z0 + 0.1, sc.z1 - 0.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(totalX, 0.12, 0.12), MAT.metal);
      rail.position.set((sx0 + sx1) / 2, 1.1, z);
      rail.rotation.z = Math.atan2(4, totalX);
      scene.add(rail);
    }
  }

  // -------- лестница наверх из холла (декор, откуда мы спустились) --------
  {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 0.7), MAT.step);
      m.position.set(0, 0.25 + i * 0.42, 9.6 - i * 0.55);
      m.rotation.x = -0.15;
      scene.add(m);
    }
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.4, 0.3), MAT.wallB);
    shaft.position.set(0, 5.2, 4.4); scene.add(shaft);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(6, 3),
      new THREE.MeshBasicMaterial({ color: 0x9fc0d8 }));
    sky.position.set(0, 5.2, 4.25); scene.add(sky);
    const hatchLight = new THREE.PointLight(0xbfd8ee, 1.4, 22, 2);
    hatchLight.position.set(0, 3.2, 6); scene.add(hatchLight);
  }

  // -------- пропы: трубы, лампы, стойки, ящики --------
  function ceilingLamp(x, y, z, flicker) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.28), MAT.lamp);
    l.position.set(x, y - 0.06, z); scene.add(l);
    const pl = new THREE.PointLight(0xffe2a8, 1.15, 15, 2);
    pl.position.set(x, y - 0.3, z); scene.add(pl);
    if (flicker) pl.userData.flicker = true;
    lights.push(pl);
  }
  ceilingLamp(0, 3.6, 6, true);
  ceilingLamp(0, 3.0, -5);
  ceilingLamp(-3, 3.6, -16); ceilingLamp(3, 3.6, -19, true);
  ceilingLamp(-12, 3.0, -16);
  ceilingLamp(-21, 1.0, -18, true);
  ceilingLamp(-29, -1.0, -18);
  ceilingLamp(-39, -0.4, -20, true); ceilingLamp(-41, -0.4, -17);
  ceilingLamp(-39, -1.0, -31, true);
  ceilingLamp(-40, -0.2, -42); ceilingLamp(-36, -0.2, -44, true);

  function pipes(x0, x1, y, z) {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, Math.abs(x1 - x0), 6), MAT.pipe);
      p.rotation.z = Math.PI / 2;
      p.position.set((x0 + x1) / 2, y, z + i * 0.3);
      scene.add(p);
    }
  }
  pipes(-4, 4, 3.3, 2); pipes(-6, 6, 3.3, -13); pipes(-24, -34, -0.8, -19);
  pipes(-44, -34, -0.7, -16);

  function crate(x, y, z, s = 1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 1.2 * s, 1.2 * s), MAT.crate);
    m.position.set(x, y + 0.6 * s, z); scene.add(m);
    colliders.push({
      min: new THREE.Vector3(x - 0.6 * s, y, z - 0.6 * s), max: new THREE.Vector3(x + 0.6 * s, y + 1.2 * s, z + 0.6 * s),
      cx: x, cy: y + 0.6 * s, cz: z, r: 1.2 * s, occluder: true,
    });
  }
  crate(3.6, 0, 8); crate(-3.8, 0, 7); crate(4.8, 0, -11);
  crate(-5.4, 0, -11); crate(-30, -4, -15); crate(-43.6, -4, -17.6);
  crate(-34.5, -4, -46); crate(-46, -4, -38);

  // серверные стойки
  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 2.6;
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.6), MAT.rack);
    r.position.set(x, 1.3, -20.4); scene.add(r);
    colliders.push({
      min: new THREE.Vector3(x - 0.55, 0, -21.2), max: new THREE.Vector3(x + 0.55, 2.6, -19.6),
      cx: x, cy: 1.3, cz: -20.4, r: 1.8, occluder: true,
    });
    for (let k = 0; k < 6; k++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.02),
        new THREE.MeshBasicMaterial({ color: k % 2 ? 0x33ff88 : 0x33aaff }));
      led.position.set(x, 2.2 - k * 0.3, -19.58); scene.add(led);
    }
  }
  // стеллажи архива (между ними проходы, по которым ходит охрана)
  for (const z of [-24.5, -22, -19.5]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.4, 0.7), MAT.crate);
    s.position.set(-42.5, -2.8, z); scene.add(s);
    colliders.push({
      min: new THREE.Vector3(-44.75, -4, z - 0.35), max: new THREE.Vector3(-40.25, -1.6, z + 0.35),
      cx: -42.5, cy: -2.8, cz: z, r: 2.8, occluder: true,
    });
  }
  // лабораторные столы
  for (const [x, z] of [[-44, -45], [-36, -45], [-43.5, -38]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.4), MAT.metal);
    t.position.set(x, -3.55, z); scene.add(t);
    colliders.push({
      min: new THREE.Vector3(x - 1.5, -4, z - 0.7), max: new THREE.Vector3(x + 1.5, -3.1, z + 0.7),
      cx: x, cy: -3.55, cz: z, r: 2, occluder: true,
    });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), MAT.glass);
    glow.position.set(x, -3, z); scene.add(glow);
  }

  // -------- точки секретных технологий --------
  out.techSpots = [
    { pos: new THREE.Vector3(0, 0, -13), name: 'ЯДРО ДАННЫХ' },
    { pos: new THREE.Vector3(-39, -4, -15.5), name: 'ПЛАЗМЕННЫЙ МОДУЛЬ' },
    { pos: new THREE.Vector3(-45, -4, -43), name: 'ЧЕРТЕЖИ ПВО' },
  ];

  // узлы для навигации ИИ (коридоры, комнаты, лестница)
  out.navNodes = [
    // холл и узкий проход
    new THREE.Vector3(0, 0, 7), new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, -7),
    // серверная
    new THREE.Vector3(0, 0, -13), new THREE.Vector3(-5, 0, -13.5), new THREE.Vector3(5, 0, -13.5),
    new THREE.Vector3(-4, 0, -17), new THREE.Vector3(4, 0, -17), new THREE.Vector3(0, 0, -18.5),
    // технический коридор и лестница вниз
    new THREE.Vector3(-10, 0, -16), new THREE.Vector3(-14, 0, -16),
    new THREE.Vector3(-18.9, -0.6, -17), new THREE.Vector3(-21.5, -2, -18), new THREE.Vector3(-24.4, -4, -18),
    new THREE.Vector3(-28, -4, -18), new THREE.Vector3(-31.5, -4, -18),
    // архив: два боковых прохода и открытая северная часть
    new THREE.Vector3(-39, -4, -25.3), new THREE.Vector3(-37, -4, -23),
    new THREE.Vector3(-37, -4, -20), new THREE.Vector3(-37, -4, -16.5),
    new THREE.Vector3(-34.5, -4, -22), new THREE.Vector3(-34.5, -4, -17),
    // проход к лаборатории
    new THREE.Vector3(-39, -4, -30), new THREE.Vector3(-39, -4, -34), new THREE.Vector3(-39, -4, -38),
    // лаборатория
    new THREE.Vector3(-36.5, -4, -39), new THREE.Vector3(-45, -4, -42),
    new THREE.Vector3(-40, -4, -45), new THREE.Vector3(-40, -4, -46.8), new THREE.Vector3(-44, -4, -46.8),
  ];

  out.spawn = new THREE.Vector3(0, 0, 8);
  out.enemySpawns = [
    new THREE.Vector3(0, 0, -19), new THREE.Vector3(-4, 0, -14), new THREE.Vector3(4, 0, -19),
    new THREE.Vector3(-12, 0, -16), new THREE.Vector3(-29, -4, -18), new THREE.Vector3(-36, -4, -21),
    new THREE.Vector3(-36, -4, -17), new THREE.Vector3(-39.5, -4, -23), new THREE.Vector3(-40, -4, -44),
    new THREE.Vector3(-35, -4, -40), new THREE.Vector3(-45, -4, -40), new THREE.Vector3(0, 0, 3),
  ];
  out.exitPos = new THREE.Vector3(-44.5, -4, -46.5);

  return out;
}

/** Функция высоты пола: учитывает этажи и ступени, выбирает поверхность под игроком. */
export function makeBasementGround(steps) {
  return function basementGround(x, z, fromY) {
    let best = null, lowest = Infinity;
    for (const c of CELLS) {
      if (c.stairs) continue;
      if (x >= c.x0 - 0.25 && x <= c.x1 + 0.25 && z >= c.z0 - 0.25 && z <= c.z1 + 0.25) {
        if (c.y < lowest) lowest = c.y;
        if (c.y <= fromY + 0.5 && (best === null || c.y > best)) best = c.y;
      }
    }
    for (const s of steps) {
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) {
        if (s.y < lowest) lowest = s.y;
        if (s.y <= fromY + 0.55 && (best === null || s.y > best)) best = s.y;
      }
    }
    return best === null ? (lowest === Infinity ? -4 : lowest) : best;
  };
}
