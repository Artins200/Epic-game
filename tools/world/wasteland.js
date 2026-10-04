"use strict";
/*
 * ЗОНА 1 — «МАД МАКС»: песчаная пустошь, руины, разбитые машины, башня-радиомаяк,
 * пылевой смерч, огромный череп в скале и обратный портал.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const P = require("./portals");
const G = require("./groups");
const { part, deco, cyl, ball, pillar, pointLight, emit, MAT } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;
const CX = -380;

/** Разбитая машина из деталей */
function wreckCar(pos, yaw, color, o = {}) {
  const cf = C.cfDeg([pos[0], pos[1] + 2.2, pos[2]], o.tilt || 0, yaw, o.roll || 0);
  const out = [];
  out.push(part({ name: "CarBody", size: [12, 3.2, 5.6], cf, color, material: MAT.CorrodedMetal, collide: true, query: true }));
  out.push(deco({ name: "CarCabin", size: [5.4, 3, 4.8], cf: C.cfRel(cf, -1.2, 3, 0), color: [color[0] * 0.8, color[1] * 0.8, color[2] * 0.8], material: MAT.CorrodedMetal }));
  out.push(deco({ name: "CarGlass", size: [5.0, 2.2, 4.6], cf: C.cfRel(cf, -1.2, 3, 0), color: [70, 90, 100], material: MAT.Glass, transparency: 0.5 }));
  out.push(deco({ name: "CarHood", size: [3.4, 0.6, 5.2], cf: C.cfRelA(cf, 4.4, 1.6, 0, 0, 0, rad(18)), color, material: MAT.CorrodedMetal }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(cyl({
      name: "Wheel", size: [1.6, 4.2, 4.2], cf: C.cfRelA(cf, sx * 3.6, -1.9, sz * 2.6, 0, 0, rad(90)),
      color: [34, 34, 38], material: MAT.Rubber, collide: false, query: false, cast: false,
    }));
  }
  if (o.fire) {
    out.push(part({
      name: "CarFire", size: [4, 2, 4], cf: C.cfRel(cf, 3.6, 2.2, 0), color: [255, 140, 40], material: MAT.Neon, collide: false, query: false, cast: false,
      children: [
        emit({ name: "Fire", texture: "rbxasset://textures/particles/fire_main.dds", rate: 40, lifetime: [0.6, 1.4], speed: [3, 7], size: [[0, 3], [0.5, 5], [1, 0.6]], transparency: [[0, 0.2], [1, 1]], color: [[0, [2.4, 1.1, 0.2]], [0.5, [2, 0.6, 0.08]], [1, [0.4, 0.1, 0.02]]], spread: [14, 14, 0], rotSpeed: [-40, 40], acceleration: [0, 7, 0], lightEmission: 1, zOffset: 1 }),
        emit({ name: "Smoke", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 16, lifetime: [2, 4], speed: [2, 5], size: [[0, 5], [1, 14]], transparency: [[0, 0.5], [1, 1]], color: [[0, [0.25, 0.25, 0.26]], [1, [0, 0, 0]]], spread: [20, 20, 0], acceleration: [0, 5, 0], lightEmission: 0, lightInfluence: 0.4 }),
        pointLight({ color: [1, 0.55, 0.2], range: 40, brightness: 3, shadows: true }),
      ],
    }));
  }
  return out;
}

/** Радиомаяк с мигающим огнём */
function radioTower(pos) {
  const out = [];
  const h = 120;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(pillar({ name: "TowerLeg", size: [h, 1.4, 1.4], cf: C.cfp(pos[0] + sx * 6, pos[1] + h / 2, pos[2] + sz * 6), color: [96, 78, 62], material: MAT.CorrodedMetal, collide: true, query: true }));
  }
  for (let i = 1; i <= 7; i++) {
    const y = (h / 8) * i;
    const w = 6 + i * 0.2;
    out.push(S.slabBetween([pos[0] - w, pos[1] + y, pos[2] - w], [pos[0] + w, pos[1] + y, pos[2] - w], 0.8, 0.8, { name: "TowerBrace", color: [86, 70, 56], material: MAT.CorrodedMetal, collide: false, query: false, cast: false, size: [w * 2, 0.8, 0.8] }));
    out.push(S.slabBetween([pos[0] - w, pos[1] + y, pos[2] + w], [pos[0] + w, pos[1] + y, pos[2] + w], 0.8, 0.8, { name: "TowerBrace", color: [86, 70, 56], material: MAT.CorrodedMetal, collide: false, query: false, cast: false, size: [w * 2, 0.8, 0.8] }));
    out.push(S.slabBetween([pos[0] - w, pos[1] + y, pos[2] - w], [pos[0] - w, pos[1] + y, pos[2] + w], 0.8, 0.8, { name: "TowerBrace", color: [86, 70, 56], material: MAT.CorrodedMetal, collide: false, query: false, cast: false, size: [w * 2, 0.8, 0.8] }));
    out.push(S.slabBetween([pos[0] + w, pos[1] + y, pos[2] - w], [pos[0] + w, pos[1] + y, pos[2] + w], 0.8, 0.8, { name: "TowerBrace", color: [86, 70, 56], material: MAT.CorrodedMetal, collide: false, query: false, cast: false, size: [w * 2, 0.8, 0.8] }));
  }
  out.push(part({
    name: "TowerBeacon", size: [2.4, 2.4, 2.4], cf: C.cfp(pos[0], pos[1] + h + 1, pos[2]), color: [255, 60, 60], material: MAT.Neon, collide: false, query: false, cast: false,
    children: [pointLight({ color: [1, 0.2, 0.2], range: 90, brightness: 3 }), G.pulseGroup(1.2, 0.05, 0.85, 1.35)],
  }));
  out.push(cyl({ name: "TowerDish", size: [1.2, 22, 22], cf: C.cfDeg([pos[0] - 14, pos[1] + h * 0.72, pos[2] + 4], 0, 0, 68), color: [148, 140, 128], material: MAT.Metal, collide: false, query: false, cast: false }));
  return out;
}

/** Пылевой смерч */
function dustDevil(pos, height) {
  return [deco({
    name: "DustDevil", size: [26, height, 26], cf: C.cfp(pos[0], pos[1] + height / 2, pos[2]), transparency: 1, color: [255, 255, 255], material: MAT.SmoothPlastic,
    children: [
      emit({ name: "Dust", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 60, lifetime: [2, 3.6], speed: [4, 12], size: [[0, 6], [0.4, 12], [1, 18]], transparency: [[0, 0.6], [0.6, 0.82], [1, 1]], color: [[0, [0.85, 0.62, 0.34]], [1, [0.5, 0.34, 0.18]]], spread: [26, 26, 0], rotation: [0, 360], rotSpeed: [-160, 160], acceleration: [0, 12, 0], lightEmission: 0.2, lightInfluence: 0.3, velocityInherit: 0.4, lockedToPart: true, zOffset: 0, drag: 0 }),
      emit({ name: "Dust2", texture: "rbxasset://textures/particles/sparkles_main.dds", rate: 22, lifetime: [1.4, 2.6], speed: [6, 14], size: [[0, 3], [1, 0.4]], transparency: [[0, 0.7], [1, 1]], color: [[0, [1.4, 1, 0.5]], [1, [0, 0, 0]]], spread: [30, 30, 0], rotSpeed: [-200, 200], acceleration: [0, 10, 0], lightEmission: 0.6, lockedToPart: true }),
      G.spinGroup(70, [0, 1, 0]),
    ],
  })];
}

/** Огромный череп, вырубленный в скале */
function skullRock(pos, scale) {
  const out = [];
  out.push(ball({ name: "SkullRock", size: [70 * scale, 62 * scale, 76 * scale], cf: C.cfp(pos[0], pos[1] + 26 * scale, pos[2]), color: [126, 108, 88], material: MAT.Sandstone, collide: true, query: true }));
  for (const sx of [-1, 1]) {
    out.push(ball({ name: "SkullSocket", size: [18 * scale, 20 * scale, 18 * scale], cf: C.cfp(pos[0] + sx * 15 * scale, pos[1] + 32 * scale, pos[2] - 30 * scale), color: [18, 14, 12], material: MAT.Slate, collide: false, query: false, cast: false }));
    out.push(part({ name: "SkullGlow", size: [10 * scale, 10 * scale, 6 * scale], cf: C.cfp(pos[0] + sx * 15 * scale, pos[1] + 32 * scale, pos[2] - 34 * scale), color: [255, 90, 30], material: MAT.Neon, transparency: 0.25, collide: false, query: false, cast: false, children: [pointLight({ color: [1, 0.35, 0.1], range: 60, brightness: 2.4 }), G.pulseGroup(0.8, 0.15, 0.6)] }));
  }
  out.push(part({ name: "SkullNose", size: [8 * scale, 12 * scale, 12 * scale], cf: C.cfp(pos[0], pos[1] + 16 * scale, pos[2] - 32 * scale), color: [18, 14, 12], material: MAT.Slate, collide: false, query: false, cast: false }));
  out.push(part({ name: "SkullJaw", size: [44 * scale, 16 * scale, 30 * scale], cf: C.cfp(pos[0], pos[1] + 2 * scale, pos[2] - 24 * scale), color: [134, 114, 92], material: MAT.Sandstone, collide: true, query: true }));
  for (let i = 0; i < 7; i++) {
    out.push(deco({ name: "SkullTooth", size: [5 * scale, 8 * scale, 5 * scale], cf: C.cfp(pos[0] - 18 * scale + i * 6 * scale, pos[1] + 12 * scale, pos[2] - 38 * scale), color: [222, 212, 190], material: MAT.Sandstone }));
  }
  return out;
}

/** Арена-клетка с костром внутри */
function cagedArena(pos, radius) {
  const out = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos[0] + Math.cos(a) * radius, z = pos[2] + Math.sin(a) * radius;
    out.push(pillar({ name: "CagePost", size: [22, 1.6, 1.6], cf: C.cfp(x, pos[1] + 11, z), color: [92, 74, 58], material: MAT.CorrodedMetal, collide: true, query: true }));
  }
  for (let r = 0; r < 3; r++) {
    const y = pos[1] + 6 + r * 7;
    out.push(...S.ringXZ(C.cfp(pos[0], y, pos[2]), { radius, count: Math.round(radius / 2.4), thickness: 0.7, depth: 0.7, color: [92, 74, 58], material: MAT.CorrodedMetal, transparency: 0 }));
  }
  out.push(...S.fireBarrel([pos[0], pos[1], pos[2]], { color: [88, 58, 40] }));
  out.push(...S.fireBarrel([pos[0] + 7, pos[1], pos[2] + 4], { color: [88, 58, 40] }));
  return out;
}

function build() {
  const out = [];
  const ground = [];

  // ---------------------------------------------------------------- земля зоны
  ground.push(part({ name: "Sand", size: [380, 6, 380], cf: C.cfp(CX, -2.6, 0), color: [186, 148, 96], material: MAT.Sand, collide: true, query: true }));
  const rng = S.rng(1337);
  // дюны
  for (let i = 0; i < 26; i++) {
    const a = S.rr(rng, 0, Math.PI * 2), r = S.rr(rng, 40, 185);
    const s = S.rr(rng, 20, 52);
    ground.push(deco({ name: "Dune", size: [s, s * 0.28, s * S.rr(rng, 0.7, 1.4)], cf: C.cfDeg([CX + Math.cos(a) * r, S.rr(rng, -2, 3), Math.sin(a) * r], 0, S.rr(rng, 0, 360), S.rr(rng, -6, 6)), color: [206, 168, 112], material: MAT.Sand }));
  }
  // трещины с лавой
  for (let i = 0; i < 9; i++) {
    const a = S.rr(rng, 0, Math.PI * 2), r = S.rr(rng, 30, 150);
    const x = CX + Math.cos(a) * r, z = Math.sin(a) * r;
    const cp = [[x, 0.1, z], [x + S.rr(rng, -30, 30), 0.1, z + S.rr(rng, -30, 30)], [x + S.rr(rng, -55, 55), 0.1, z + S.rr(rng, -55, 55)]];
    ground.push(...S.pipeRun(cp, 2.6, [255, 110, 30], { name: "LavaCrack", material: MAT.CrackedLava, collide: false, query: false, cast: false }));
    ground.push(deco({
      name: "LavaGlow", size: [1, 1, 1], cf: C.cfp(cp[1][0], 1.5, cp[1][2]), color: [255, 120, 40], material: MAT.Neon, transparency: 0.6,
      children: [pointLight({ color: [1, 0.45, 0.15], range: 40, brightness: 1.6 }), emit({ name: "Heat", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 8, lifetime: [1.6, 3], speed: [1, 2.6], size: [[0, 6], [1, 16]], transparency: [[0, 0.82], [1, 1]], color: [[0, [0.5, 0.22, 0.08]], [1, [0.1, 0.05, 0.02]]], spread: [40, 40, 0], acceleration: [0, 2, 0], lightEmission: 0.3 })],
    }));
  }
  out.push(K.model({ name: "WastelandGround", children: ground }));

  // ---------------------------------------------------------------- руины и техника
  const props = [];
  const ruins = [
    { p: [CX - 110, 6, -90], w: 70, h: 40, d: 46, yaw: 12 },
    { p: [CX - 70, 0, 105], w: 90, h: 30, d: 60, yaw: -24 },
    { p: [CX + 95, 0, -110], w: 60, h: 52, d: 54, yaw: 37 },
    { p: [CX + 120, 0, 70], w: 80, h: 26, d: 44, yaw: -8 },
    { p: [CX + 10, 0, -150], w: 54, h: 34, d: 40, yaw: 62 },
    { p: [CX - 150, 0, 40], w: 58, h: 22, d: 74, yaw: -46 },
  ];
  for (const [i, r] of ruins.entries()) {
    props.push(...S.ruin(r.p, r.w, r.h, r.d, [148, 130, 108], 100 + i, { yaw: r.yaw }));
  }
  props.push(...wreckCar([CX - 60, 0, 40], 22, [152, 68, 48], { fire: true }));
  props.push(...wreckCar([CX + 46, 0, 62], -64, [96, 104, 118]));
  props.push(...wreckCar([CX - 20, 0, -70], 108, [132, 116, 62], { tilt: 14, roll: 8 }));
  props.push(...wreckCar([CX + 130, 0, -30], 200, [78, 92, 84], { fire: true }));
  props.push(...wreckCar([CX - 140, 0, -120], 45, [110, 74, 58]));
  for (let i = 0; i < 7; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 30, 160);
    props.push(...S.fireBarrel([CX + Math.cos(a) * r, 0, Math.sin(a) * r]));
  }
  for (let i = 0; i < 9; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 40, 175);
    props.push(...S.deadTree([CX + Math.cos(a) * r, 0, Math.sin(a) * r], S.rr(rng, 0.9, 1.7), { seed: 20 + i }));
  }
  props.push(...radioTower([CX + 150, 0, -80]));
  props.push(...dustDevil([CX - 40, 0, -40], 90));
  props.push(...dustDevil([CX + 90, 0, 120], 60));
  props.push(...skullRock([CX - 165, 0, -30], 1));
  props.push(...cagedArena([CX + 60, 0, -110], 26));
  // битое шоссе
  props.push(S.slabBetween([CX + 40, 8, -200], [CX + 70, 26, -60], 44, 1.6, { name: "BrokenHighway", color: [58, 58, 64], material: MAT.Asphalt, collide: true, query: true }));
  props.push(...wreckCar([CX + 62, 18, -110], 86, [128, 96, 52], { tilt: -8 }));
  out.push(K.model({ name: "WastelandProps", children: props }));

  // ---------------------------------------------------------------- вывески и обратный портал
  const rest = [];
  rest.push(...S.signPanel(C.cfFace([CX + 20, 26, 150], [0, 0, -1]), { text: "СВАЛКА МАД МАКСА · ОСТОРОЖНО: МУТАНТЫ", width: 60, height: 12, color: [26, 18, 12], textColor: [255, 170, 60], depth: 1.6 }));
  rest.push(...S.signPanel(C.cfFace([CX - 100, 18, -60], [1, 0, 0.4]), { text: "ТОПЛИВО", width: 26, height: 9, color: [30, 16, 10], textColor: [255, 90, 40], depth: 1.2 }));
  rest.push(...S.signPanel(C.cfFace([CX + 88, 16, 118], [-1, 0, -0.6]), { text: "НЕ ВХОДИТЬ", width: 24, height: 8, color: [28, 14, 10], textColor: [255, 60, 60], depth: 1.2 }));

  const portalCF = C.cfNorm([CX + 168, 13.5, 0], [1, 0, 0], [0, 1, 0]);
  rest.push(P.staticPortal({ name: "Portal_Wasteland_Return", cf: portalCF, radius: 11, palette: "orange", linkTo: "Portal_Hub_Wasteland" }));
  rest.push(K.model({ name: "Dais_Portal_Wasteland_Return", children: P.portalDais(portalCF, { radius: 11, glow: [255, 150, 60] }) }));
  rest.push(...S.signPanel(C.cfFace([CX + 168, 31, 2], [-1, 0, 0]), { text: "← НАЗАД НА СТАНЦИЮ", width: 30, height: 7, color: [14, 16, 26], textColor: [255, 150, 60], depth: 1.1 }));
  for (const sx of [-1, 1]) rest.push(...S.lamp([CX + 168 + sx * 22, 3.5, 6], 12, [255, 150, 60], { range: 40, brightness: 1.8 }));
  // пылевая дымка по краям
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    rest.push(deco({
      name: "DustHaze", size: [1, 1, 1], cf: C.cfp(CX + Math.cos(a) * 170, 6, Math.sin(a) * 170), color: [255, 255, 255], transparency: 1,
      children: [emit({ name: "Haze", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 10, lifetime: [3, 6], speed: [1, 3], size: [[0, 20], [1, 44]], transparency: [[0, 0.78], [1, 1]], color: [[0, [0.72, 0.54, 0.32]], [1, [0.3, 0.2, 0.12]]], spread: [80, 80, 0], acceleration: [0, 2, 0], lightEmission: 0.15, rotSpeed: [-14, 14] })],
    }));
  }
  out.push(K.model({ name: "WastelandRest", children: rest }));

  return out;
}

module.exports = { build };
