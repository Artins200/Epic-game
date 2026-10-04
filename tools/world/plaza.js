"use strict";
/*
 * Центральная площадь «Портальная станция 37-C»: главный хаб мира.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const P = require("./portals");
const G = require("./groups");
const { part, deco, cyl, pillar, pointLight, emit, MAT, banner } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;

/** Вращающееся кольцо как самостоятельная модель с pivot + SpinGroup */
function spinRing(name, cf, opts) {
  const pivotRef = K.nextRef();
  const axis = C.mapply(cf.m, [1, 0, 0]);
  const children = [
    deco({ name: "SpinPivot", size: [0.2, 0.2, 0.2], cf, transparency: 1, ref: pivotRef, collide: false, query: false, cast: false }),
    ...S.ringYZ(cf, { name: "SpinRingSeg", radius: opts.radius, count: opts.count || 22, size: [opts.segW || opts.radius * 0.3, opts.segH || 0.8, opts.segD || 1.2], color: opts.color, material: MAT.Neon, transparency: opts.segT || 0.1 }),
    cyl({ name: "SpinDisc", size: [0.35, opts.radius * 1.75, opts.radius * 1.75], cf, color: opts.color, material: MAT.Neon, transparency: opts.discT || 0.72, collide: false, query: false, cast: false }),
  ];
  if (opts.hot) {
    children.push(cyl({ name: "SpinHot", size: [0.5, opts.radius * 0.9, opts.radius * 0.9], cf, color: [255, 255, 255], material: MAT.Neon, transparency: 0.75, collide: false, query: false, cast: false }));
  }
  if (opts.light) {
    children.push(deco({
      name: "SpinGlow", size: [0.6, 0.6, 0.6], cf, color: opts.color, material: MAT.Neon,
      children: [
        pointLight({ color: [opts.color[0] / 255, opts.color[1] / 255, opts.color[2] / 255], range: opts.lightRange || 90, brightness: opts.lightBright || 2.6 }),
        emit({ name: "RingSparks", rate: 22, lifetime: [1, 2.6], speed: [2, 10], size: [[0, opts.radius * 0.09], [1, 0]], transparency: [[0, 0.2], [1, 1]], color: [[0, [opts.color[0] / 130, opts.color[1] / 130, opts.color[2] / 130]], [1, [0, 0, 0]]], spread: [180, 180, 0], rotSpeed: [-140, 140], acceleration: [0, -5, 0], lightEmission: 1 }),
      ],
    }));
  }
  children.push(G.spinGroup(opts.speed, axis));
  return K.model({ name, primary: pivotRef, children });
}

// ---------------------------------------------------------------- траншея-пандус
const TRENCH = { x0: -21.5, x1: 21.5, z0: 74, z1: 118 };

/** Позиция детали из её спецификации (CFrame — tagged variant) */
function posOf(spec) {
  const cf = spec && spec.properties && spec.properties.CFrame;
  const inner = cf && (cf.CFrame || cf);
  return inner && inner.position ? inner.position : null;
}

/** Попала ли деталь (по центру) в проём траншеи? pad — запас в студах */
function inTrench(pos, pad) {
  if (!pos) return false;
  const p = pad || 0;
  return pos[0] > TRENCH.x0 - p && pos[0] < TRENCH.x1 + p && pos[2] > TRENCH.z0 - p && pos[2] < TRENCH.z1 + p;
}

function build() {
  const out = [];

  // ---------------------------------------------------------------- пол площади
  // Проём под пандус в подземную лабораторию: пол разрезан на четыре плиты,
  // чтобы траншея (z от TRENCH.z0 до TRENCH.z1) осталась открытой.
  const floor = [
    part({ name: "PlazaFloor", size: [150 + TRENCH.x0, 6, 300], cf: C.cfp((TRENCH.x0 - 150) / 2, -3, 0), color: [52, 56, 72], material: MAT.Concrete, collide: true, query: true }),
    part({ name: "PlazaFloor", size: [150 - TRENCH.x1, 6, 300], cf: C.cfp((TRENCH.x1 + 150) / 2, -3, 0), color: [52, 56, 72], material: MAT.Concrete, collide: true, query: true }),
    part({ name: "PlazaFloor", size: [TRENCH.x1 - TRENCH.x0, 6, TRENCH.z0 + 150], cf: C.cfp(0, -3, (TRENCH.z0 - 150) / 2), color: [52, 56, 72], material: MAT.Concrete, collide: true, query: true }),
    part({ name: "PlazaFloor", size: [TRENCH.x1 - TRENCH.x0, 6, 150 - TRENCH.z1], cf: C.cfp(0, -3, (TRENCH.z1 + 150) / 2), color: [52, 56, 72], material: MAT.Concrete, collide: true, query: true }),
  ];
  const ringColors = [[90, 220, 255], [255, 150, 60], [150, 120, 255], [70, 255, 150]];
  [34, 62, 92, 126].forEach((r, i) => {
    floor.push(...S.ringXZ(C.cfp(0, 0.22, 0), {
      radius: r, count: Math.round((2 * Math.PI * r) / 11), thickness: 0.35, depth: r === 126 ? 1.6 : 1.1,
      color: ringColors[i % ringColors.length], material: MAT.Neon, transparency: 0.25,
    }).filter((seg) => !inTrench(posOf(seg), 2)));
  });
  for (let i = 0; i < 16; i++) {
    const a = rad(i * 22.5 + 11.25);
    const strip = S.neonStrip([Math.cos(a) * 32, 0.2, Math.sin(a) * 32], [Math.cos(a) * 142, 0.2, Math.sin(a) * 142], 0.5, [70, 96, 140], { transparency: 0.45 });
    const stripParts = Array.isArray(strip) ? strip : [strip];
    floor.push(...stripParts.filter((seg) => !inTrench(posOf(seg), 2)));
  }
  // ограждение траншеи: неоновый бортик по краю проёма
  const kerb = [70, 255, 150];
  for (const x of [TRENCH.x0, TRENCH.x1]) {
    floor.push(deco({ name: "TrenchKerb", size: [0.6, 0.8, TRENCH.z1 - TRENCH.z0], cf: C.cfp(x, 0.5, (TRENCH.z0 + TRENCH.z1) / 2), color: kerb, material: MAT.Neon, transparency: 0.15 }));
  }
  floor.push(deco({ name: "TrenchKerb", size: [TRENCH.x1 - TRENCH.x0, 0.8, 0.6], cf: C.cfp(0, 0.5, TRENCH.z0), color: kerb, material: MAT.Neon, transparency: 0.15 }));
  out.push(K.model({ name: "PlazaFloor", children: floor }));

  // ---------------------------------------------------------------- центральный постамент
  const dais = [
    cyl({ name: "Dais", size: [3.4, 68, 68], cf: C.cfp(0, 1.7, 0), color: [66, 70, 88], material: MAT.Concrete, collide: true, query: true }),
    cyl({ name: "DaisRing", size: [0.5, 96, 96], cf: C.cfp(0, 3.5, 0), color: [120, 130, 158], material: MAT.Metal, collide: true, query: true }),
    cyl({ name: "DaisGlow", size: [0.35, 68.6, 68.6], cf: C.cfp(0, 3.55, 0), color: [90, 220, 255], material: MAT.Neon, transparency: 0.35, collide: false, query: false, cast: false, children: [G.pulseGroup(1.4, 0.2, 0.6)] }),
  ];
  for (let i = 0; i < 8; i++) {
    const a = rad(i * 45);
    const x = Math.cos(a) * 40, z = Math.sin(a) * 40;
    const col = i % 2 ? [90, 220, 255] : [255, 150, 60];
    dais.push(...S.column([x, 3.5, z], 22, 1.6, { color: [96, 102, 124], trim: [58, 62, 78], glow: col }));
    dais.push(...S.lamp([x * 1.45, 3.5, z * 1.45], 15, col, { range: 54, brightness: 2.2 }));
  }
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90 + 45);
    const x = Math.cos(a) * 56, z = Math.sin(a) * 56;
    dais.push(pillar({ name: "FlagPole", size: [30, 0.8, 0.8], cf: C.cfp(x, 18, z), color: [180, 186, 200], material: MAT.Metal, collide: true, query: true }));
    dais.push(...banner(C.cfFace([x + 0.3, 26, z], [Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2)]), { width: 8, height: 15, color: [40, 44, 62], emblem: [255, 180, 40] }));
  }
  out.push(K.model({ name: "PlazaDais", children: dais }));

  // ---------------------------------------------------------------- «портальная буря» над площадью
  const mainCF = C.cfDeg([0, 36, 0], 0, 26, 14);
  out.push(spinRing("Storm_Main", mainCF, { radius: 26, count: 40, segW: 5.6, segH: 1.6, segD: 2.4, color: [140, 255, 190], speed: -9, light: true, lightRange: 170, lightBright: 3.6, discT: 0.6, segT: 0.06, hot: true }));
  out.push(spinRing("Storm_Mini1", C.cfDeg([-32, 48, 14], 0, 42, 60), { radius: 11, count: 18, color: [255, 214, 40], speed: -16, light: true, lightRange: 80, lightBright: 2.2 }));
  out.push(spinRing("Storm_Mini2", C.cfDeg([30, 54, -20], 0, -34, -50), { radius: 8, count: 16, color: [255, 90, 220], speed: 20, light: true, lightRange: 70, lightBright: 2 }));
  out.push(spinRing("Storm_Mini3", C.cfDeg([6, 68, 28], 0, 16, 22), { radius: 15, count: 22, color: [90, 220, 255], speed: 12, light: true, lightRange: 90, lightBright: 2.2 }));
  out.push(K.model({
    name: "NexusBeam",
    children: [
      cyl({ name: "Beam", size: [320, 26, 26], cf: C.cfp(0, 160, 0), color: [120, 255, 180], material: MAT.Neon, transparency: 0.9, collide: false, query: false, cast: false, children: [G.pulseGroup(0.6, 0.82, 0.94)] }),
      cyl({ name: "BeamCore", size: [320, 9, 9], cf: C.cfp(0, 160, 0), color: [220, 255, 235], material: MAT.Neon, transparency: 0.78, collide: false, query: false, cast: false }),
    ],
  }));

  // ---------------------------------------------------------------- три портала-хаба
  const hub = [];
  const stations = [
    { x: -74, name: "Portal_Hub_Wasteland", palette: "orange", label: "ЗОНА 1 · МАД МАКС", link: "Portal_Wasteland_Return", color: [255, 150, 60] },
    { x: 0, name: "Portal_Hub_Alien", palette: "magenta", label: "ЗОНА 2 · АЛИЕН-МИР", link: "Portal_Alien_Return", color: [255, 90, 220] },
    { x: 74, name: "Portal_Hub_Citadel", palette: "cyan", label: "ЗОНА 3 · ЦИТАДЕЛЬ", link: "Portal_Citadel_Return", color: [90, 220, 255] },
  ];
  for (const st of stations) {
    const pos = [st.x, 13.5, -102];
    const cf = C.cfNorm(pos, [0, 0, 1], [0, 1, 0]);
    hub.push(P.staticPortal({ name: st.name, cf, radius: 11, palette: st.palette, linkTo: st.link }));
    hub.push(K.model({ name: "Dais_" + st.name, children: P.portalDais(cf, { radius: 11, glow: st.color }) }));
    hub.push(K.model({ name: "Sign_" + st.name, children: S.signPanel(C.cfFace([st.x, 31, -104], [0, 0, 1]), { text: st.label, width: 30, height: 7, color: [14, 16, 26], textColor: st.color, depth: 1.1 }) }));
    for (const sx of [-1, 1]) hub.push(...S.lamp([st.x + sx * 24, 3.5, -96], 12, st.color, { range: 40, brightness: 1.8 }));
    // трафарет на полу перед порталом
    hub.push(...S.ringXZ(C.cfp(st.x, 3.62, -80), { radius: 9, count: 18, thickness: 0.3, depth: 0.8, color: st.color, material: MAT.Neon, transparency: 0.35 }));
  }
  out.push(K.model({ name: "PortalHub", children: hub }));

  // ---------------------------------------------------------------- рекламные экраны
  const signs = [];
  const ads = [
    { pos: [-124, 24, 62], text: "ПОРТАЛЬНАЯ СТАНЦИЯ 37-C", color: [90, 220, 255], w: 44, h: 11 },
    { pos: [126, 24, 60], text: "НЕ ПИТЬ ПОРТАЛЬНУЮ ЖИДКОСТЬ", color: [255, 120, 60], w: 42, h: 11 },
    { pos: [-122, 24, -70], text: "СОВЕТ РИКОВ: НАБЛЮДАЕМ", color: [255, 90, 220], w: 40, h: 11 },
    { pos: [124, 24, -72], text: "МЕГА-СЕМЕНА · 24/7", color: [140, 255, 190], w: 40, h: 11 },
  ];
  for (const a of ads) {
    const dir = C.vnorm(C.vsub([0, a.pos[1], 0], a.pos));
    const cf = C.cfFace(a.pos, [dir[0], 0, dir[2]]);
    signs.push(...S.signPanel(cf, { text: a.text, width: a.w, height: a.h, color: [10, 12, 22], textColor: a.color, depth: 1.4, frameColor: a.color }));
    for (const sx of [-1, 1]) {
      signs.push(pillar({ name: "AdPole", size: [24, 1.2, 1.2], cf: C.cfRel(cf, sx * a.w * 0.4, -a.h * 0.5 - 12, 0), color: [70, 74, 88], material: MAT.Metal, collide: true, query: true }));
    }
  }
  out.push(K.model({ name: "PlazaSigns", children: signs }));

  // ---------------------------------------------------------------- декор, ёмкости, лавки
  const props = [];
  const vx = -48, vz = 62;
  props.push(pillar({ name: "VatBody", size: [14, 12, 12], cf: C.cfp(vx, 7, vz), color: [86, 92, 108], material: MAT.Metal, collide: true, query: true }));
  props.push(pillar({
    name: "VatFluid", size: [10, 11, 11], cf: C.cfp(vx, 6.5, vz), color: [70, 255, 150], material: MAT.Neon, transparency: 0.15, collide: false, query: false, cast: false,
    children: [
      pointLight({ color: [0.3, 1, 0.55], range: 46, brightness: 2.6, shadows: true }),
      emit({ name: "VatBubbles", rate: 20, lifetime: [1.4, 2.6], speed: [1.2, 3], size: [[0, 0.9], [1, 1.6]], transparency: [[0, 0.25], [1, 1]], color: [[0, [0.4, 2.4, 1]], [1, [0.1, 0.6, 0.3]]], spread: [180, 180, 0], acceleration: [0, 4, 0], lightEmission: 1, lockedToPart: true }),
      G.pulseGroup(1.1, 0.1, 0.35),
    ],
  }));
  props.push(pillar({ name: "VatCap", size: [0.8, 12.6, 12.6], cf: C.cfp(vx, 14.4, vz), color: [120, 126, 142], material: MAT.Metal, collide: true, query: true }));
  props.push(...S.pipeRun([[vx - 5, 14, vz], [vx - 14, 18, vz + 6], [vx - 22, 18, vz + 16]], 0.9, [120, 126, 142]));
  for (let i = 0; i < 3; i++) props.push(...S.barrel([62 + i * 6, 0, 58 - i * 5], i % 2 ? [96, 120, 96] : [70, 92, 74]));
  for (let i = 0; i < 4; i++) props.push(...S.crate([-92 + i * 5.4, 0, -44 - i * 6], [5, 5, 5], [126, 96, 62], { band: [80, 82, 90] }));
  for (let i = 0; i < 6; i++) {
    const a = rad(i * 60 + 30);
    const x = Math.cos(a) * 84, z = Math.sin(a) * 84;
    if (inTrench([x, 2.2, z], 8)) continue; // над траншеей скамейку не ставим
    const cfBench = C.cfFace([x, 2.2, z], [-x, 0, -z]);
    props.push(part({ name: "Bench", size: [9, 0.7, 2.4], cf: cfBench, color: [120, 88, 60], material: MAT.WoodPlanks, collide: true, query: true }));
    props.push(deco({ name: "BenchLeg", size: [0.7, 2, 2], cf: C.cfRel(cfBench, -3.5, -1.2, 0), color: [66, 70, 80], material: MAT.Metal }));
    props.push(deco({ name: "BenchLeg", size: [0.7, 2, 2], cf: C.cfRel(cfBench, 3.5, -1.2, 0), color: [66, 70, 80], material: MAT.Metal }));
  }
  out.push(K.model({ name: "PlazaProps", children: props }));

  return out;
}

module.exports = { build };
