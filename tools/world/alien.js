"use strict";
/*
 * ЗОНА 2 — «АЛИЕН-МИР»: фиолетовые пустоши, гигантские грибы, светящиеся кристаллы,
 * летающие скалы, круг монолитов, разбитая летающая тарелка и река портальной жидкости.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const P = require("./portals");
const G = require("./groups");
const { part, deco, cyl, ball, pillar, pointLight, emit, MAT } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;
const CX = 380;

/** Круг монолитов с общим ядром */
function monolithCircle(pos, radius) {
  const out = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos[0] + Math.cos(a) * radius, z = pos[2] + Math.sin(a) * radius;
    const h = 26 + (i % 3) * 7;
    out.push(part({ name: "Monolith", size: [7, h, 3], cf: C.cfFace([x, pos[1] + h / 2, z], [-Math.cos(a), 0, -Math.sin(a)]), color: [22, 20, 30], material: MAT.Slate, collide: true, query: true }));
    for (let r = 0; r < 4; r++) {
      out.push(deco({ name: "Rune", size: [0.9, 2.6, 3.2], cf: C.cfFace([x, pos[1] + 6 + r * 5.5, z], [-Math.cos(a), 0, -Math.sin(a)]), color: [140, 255, 210], material: MAT.Neon }));
    }
  }
  out.push(ball({
    name: "Core", size: [13, 13, 13], cf: C.cfp(pos[0], pos[1] + 13, pos[2]), color: [160, 255, 220], material: MAT.Neon, transparency: 0.2, collide: false, query: false, cast: false,
    children: [
      pointLight({ color: [0.5, 1, 0.85], range: 90, brightness: 3, shadows: true }),
      emit({ name: "CoreSparks", rate: 30, lifetime: [1, 2.6], speed: [2, 8], size: [[0, 1.4], [1, 0]], transparency: [[0, 0.15], [1, 1]], color: [[0, [0.6, 3, 2]], [1, [0, 0, 0]]], spread: [180, 180, 0], rotSpeed: [-140, 140], acceleration: [0, 8, 0], lightEmission: 1 }),
      G.pulseGroup(0.7, 0.1, 0.45, 1.12), G.spinGroup(26, [0, 1, 0]),
    ],
  }));
  out.push(...S.ringXZ(C.cfp(pos[0], pos[1] + 1.4, pos[2]), { radius: radius - 4, count: 24, thickness: 0.45, depth: 1.2, color: [120, 255, 200], material: MAT.Neon, transparency: 0.3 }));
  return out;
}

/** Летающая скала с кристаллами */
function floatRock(pos, scale, seed) {
  const rng = S.rng(seed);
  const out = [];
  out.push(ball({ name: "FloatCore", size: [22 * scale, 11 * scale, 22 * scale], cf: C.cfp(pos[0], pos[1], pos[2]), color: [78, 62, 92], material: MAT.Rock, collide: true, query: true }));
  for (let i = 0; i < 3; i++) {
    out.push(ball({ name: "FloatChunk", size: [8 * scale, 6 * scale, 8 * scale], cf: C.cfDeg([pos[0] + S.rr(rng, -6, 6) * scale, pos[1] + S.rr(rng, 2, 7) * scale, pos[2] + S.rr(rng, -6, 6) * scale], 0, S.rr(rng, 0, 360), 0), color: [88, 72, 104], material: MAT.Rock, collide: false, query: false, cast: false }));
  }
  out.push(...S.crystalCluster([pos[0], pos[1] + 4 * scale, pos[2]], scale * 0.7, [150, 255, 210], seed, { light: true }));
  out.push(deco({ name: "FloatGlow", size: [1, 1, 1], cf: C.cfp(pos[0], pos[1] - 6 * scale, pos[2]), color: [140, 255, 210], material: MAT.Neon, transparency: 0.85, children: [pointLight({ color: [0.5, 1, 0.85], range: 60 * scale, brightness: 1.6 }), G.bobGroup(0.55, 2.6 * scale), G.spinGroup(8, [0, 1, 0])] }));
  return out;
}

/** Разбитая летающая тарелка в кратере */
function crashedSaucer(pos) {
  const out = [];
  out.push(...S.ringXZ(C.cfp(pos[0], 1.2, pos[2]), { radius: 34, count: 30, thickness: 3.4, depth: 8, color: [62, 50, 74], material: MAT.Rock, transparency: 0 }));
  out.push(cyl({ name: "SaucerBody", size: [8, 54, 54], cf: C.cfDeg([pos[0] + 6, pos[1] + 7, pos[2] - 4], 0, 18, 68), color: [176, 182, 196], material: MAT.Metal, collide: true, query: true }));
  out.push(ball({ name: "SaucerDome", size: [26, 20, 26], cf: C.cfDeg([pos[0] - 6, pos[1] + 12, pos[2] + 2], 0, 18, 68), color: [150, 220, 240], material: MAT.Glass, transparency: 0.45, collide: false, query: false, cast: false }));
  out.push(part({ name: "SaucerHole", size: [12, 5, 34], cf: C.cfDeg([pos[0] + 10, pos[1] + 11, pos[2] - 6], 0, 18, 68), color: [24, 22, 28], material: MAT.Slate, collide: false, query: false, cast: false }));
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90 + 30);
    out.push(deco({ name: "SaucerLight", size: [2.2, 2.2, 2.2], cf: C.cfDeg([pos[0] + Math.cos(a) * 22, pos[1] + 3.4, pos[2] + Math.sin(a) * 22], 0, 18, 68), color: [255, 120, 90], material: MAT.Neon, children: [pointLight({ color: [1, 0.4, 0.25], range: 26, brightness: 1.8 })] }));
  }
  out.push(deco({
    name: "SaucerSmoke", size: [1, 1, 1], cf: C.cfp(pos[0] + 6, pos[1] + 14, pos[2] - 6), color: [255, 255, 255], transparency: 1,
    children: [emit({ name: "Smoke", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 22, lifetime: [2.4, 5], speed: [2, 6], size: [[0, 5], [1, 20]], transparency: [[0, 0.55], [1, 1]], color: [[0, [0.2, 0.18, 0.24]], [1, [0, 0, 0]]], spread: [22, 22, 0], acceleration: [0, 4, 0], rotSpeed: [-20, 20], lightEmission: 0.1 })],
  }));
  return out;
}

/** Улей-башня пришельцев */
function hiveTower(pos) {
  const out = [];
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const d = 30 - t * 20;
    out.push(cyl({
      name: "HiveLayer", size: [12, d, d], cf: C.cfDeg([pos[0], pos[1] + 6 + i * 11, pos[2]], 0, 0, 90), color: [96, 62, 128], material: MAT.Sandstone, collide: true, query: true,
    }));
    out.push(cyl({ name: "HiveGlow", size: [0.6, d * 1.02, d * 1.02], cf: C.cfDeg([pos[0], pos[1] + 11.6 + i * 11, pos[2]], 0, 0, 90), color: [180, 255, 140], material: MAT.Neon, transparency: 0.35, collide: false, query: false, cast: false }));
    for (let w = 0; w < 5; w++) {
      const a = rad(w * 72 + i * 26);
      out.push(deco({ name: "HiveWindow", size: [3.4, 4.4, 3.4], cf: C.cfp(pos[0] + Math.cos(a) * (d / 2 - 1.4), pos[1] + 7 + i * 11, pos[2] + Math.sin(a) * (d / 2 - 1.4)), color: [255, 220, 120], material: MAT.Neon, transparency: 0.1 }));
    }
  }
  out.push(cyl({ name: "HiveTop", size: [26, 12, 12], cf: C.cfDeg([pos[0], pos[1] + 6 + layers * 11 + 4, pos[2]], 0, 0, 90), color: [120, 255, 200], material: MAT.Neon, transparency: 0.3, collide: false, query: false, cast: false, children: [pointLight({ color: [0.5, 1, 0.8], range: 80, brightness: 3 }), emit({ name: "Spores", rate: 26, lifetime: [2, 4.4], speed: [1, 4], size: [[0, 1.6], [1, 0.3]], transparency: [[0, 0.4], [1, 1]], color: [[0, [1.6, 3, 1.8]], [1, [0, 0, 0]]], spread: [60, 60, 0], acceleration: [0, 3, 0], lightEmission: 1, rotSpeed: [-90, 90] })] }));
  return out;
}

function build() {
  const out = [];
  const ground = [];

  ground.push(part({ name: "AlienSoil", size: [380, 6, 380], cf: C.cfp(CX, -2.6, 0), color: [86, 56, 116], material: MAT.Slate, collide: true, query: true }));
  const rng = S.rng(777);
  // светящийся мох
  for (let i = 0; i < 60; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 10, 180);
    ground.push(deco({ name: "GlowMoss", size: [S.rr(rng, 4, 12), 0.3, S.rr(rng, 4, 12)], cf: C.cfDeg([CX + Math.cos(a) * r, 0.2, Math.sin(a) * r], 0, S.rr(rng, 0, 360), 0), color: i % 3 ? [180, 120, 255] : [120, 255, 210], material: MAT.Neon, transparency: 0.55 }));
  }
  // «река» портальной жидкости
  const riverPts = [[CX - 190, 0.1, -120], [CX - 60, 0.1, -30], [CX + 60, 0.1, 30], [CX + 190, 0.1, 120]];
  for (let i = 0; i < riverPts.length - 1; i++) {
    ground.push(S.slabBetween(riverPts[i], riverPts[i + 1], 26, 1.2, { name: "FluidRiver", color: [70, 255, 150], material: MAT.Neon, transparency: 0.25, collide: true, query: true }));
  }
  ground.push(deco({ name: "RiverGlow", size: [1, 1, 1], cf: C.cfp(CX - 40, 3, -12), color: [120, 255, 190], material: MAT.Neon, transparency: 0.9, children: [pointLight({ color: [0.4, 1, 0.7], range: 120, brightness: 2.2 }), emit({ name: "RiverMist", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 20, lifetime: [2, 4], speed: [0.6, 2.4], size: [[0, 6], [1, 20]], transparency: [[0, 0.72], [1, 1]], color: [[0, [0.4, 1, 0.7]], [1, [0.05, 0.2, 0.12]]], spread: [90, 90, 0], acceleration: [0, 2.4, 0], lightEmission: 0.5, rotSpeed: [-16, 16] })] }));
  out.push(K.model({ name: "AlienGround", children: ground }));

  // ---------------------------------------------------------------- флора
  const flora = [];
  for (let i = 0; i < 11; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 45, 175);
    flora.push(...S.mushroom([CX + Math.cos(a) * r, 0, Math.sin(a) * r], S.rr(rng, 0.9, 1.9), {
      capColor: i % 2 ? [226, 88, 164] : [150, 90, 220], glowColor: [170, 255, 150], seed: 300 + i,
    }));
  }
  for (let i = 0; i < 13; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 40, 180);
    flora.push(...S.crystalCluster([CX + Math.cos(a) * r, 0, Math.sin(a) * r], S.rr(rng, 0.8, 1.8), i % 3 ? [150, 255, 210] : [120, 200, 255], 400 + i, { count: 5 }));
  }
  // «щупальца»-растения
  for (let i = 0; i < 8; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 60, 160);
    const base = [CX + Math.cos(a) * r, 0, Math.sin(a) * r];
    const pts = [base, [base[0] + 2, 6, base[2] + 1], [base[0] - 3, 12, base[2] + 3], [base[0] + 1, 17, base[2] - 2]];
    flora.push(...S.pipeRun(pts, 2.2, [126, 82, 140], { name: "Tentacle", material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
    flora.push(ball({ name: "TentacleTip", size: [4.4, 4.4, 4.4], cf: C.cfp(pts[3][0], pts[3][1] + 1, pts[3][2]), color: [255, 190, 120], material: MAT.Neon, collide: false, query: false, cast: false, children: [pointLight({ color: [1, 0.7, 0.4], range: 30, brightness: 1.8 })] }));
  }
  out.push(K.model({ name: "AlienFlora", children: flora }));

  // ---------------------------------------------------------------- конструкции и достопримечательности
  const props = [];
  props.push(...monolithCircle([CX - 90, 0, -120], 40));
  props.push(...hiveTower([CX + 130, 0, -70]));
  props.push(...crashedSaucer([CX - 40, 0, 130]));
  for (const [i, fr] of [[-120, 40, 20], [30, 62, -150], [150, 46, 60], [-160, 54, -60], [80, 70, 150]].entries()) {
    props.push(...floatRock([CX + fr[0], fr[1], fr[2]], 1 + (i % 3) * 0.35, 500 + i));
  }
  // мост через реку
  const bp = [[CX + 12, 0.4, -22], [CX + 44, 0.4, 22]];
  props.push(S.slabBetween(bp[0], bp[1], 16, 1.4, { name: "Bridge", color: [92, 76, 108], material: MAT.WoodPlanks, collide: true, query: true }));
  const bdir = C.vnorm(C.vsub(bp[1], bp[0]));
  const bperp = C.vnorm(C.vcross(bdir, [0, 1, 0]));
  for (const s of [-1, 1]) {
    const off = [bperp[0] * 8 * s, 0, bperp[2] * 8 * s];
    props.push(...S.railing(C.vadd(bp[0], off), C.vadd(bp[1], off), 5, [140, 120, 160]));
  }
  // «глаза» в кустах
  for (let i = 0; i < 10; i++) {
    const a = S.rr(rng, 0, 6.28), r = S.rr(rng, 70, 170);
    props.push(deco({ name: "WildEyes", size: [0.8, 0.8, 0.8], cf: C.cfp(CX + Math.cos(a) * r, S.rr(rng, 1, 3), Math.sin(a) * r), color: [255, 240, 120], material: MAT.Neon, transparency: 0.15, children: [pointLight({ color: [1, 0.9, 0.4], range: 12, brightness: 1.2 }), G.bobGroup(0.9, 0.4)] }));
  }
  out.push(K.model({ name: "AlienProps", children: props }));

  // ---------------------------------------------------------------- портал возврата и вывески
  const rest = [];
  rest.push(...S.signPanel(C.cfFace([CX - 20, 26, 150], [0, 0, -1]), { text: "АЛИЕН-МИР · ГАЗОРПАЗОРП", width: 56, height: 11, color: [24, 14, 34], textColor: [200, 140, 255], depth: 1.5 }));
  rest.push(...S.signPanel(C.cfFace([CX + 120, 20, -108], [-1, 0, 1]), { text: "ТЕРРИТОРИЯ УЛЬЯ", width: 28, height: 8, color: [22, 12, 30], textColor: [255, 220, 120], depth: 1.2 }));

  const portalCF = C.cfNorm([CX - 168, 13.5, 0], [-1, 0, 0], [0, 1, 0]);
  rest.push(P.staticPortal({ name: "Portal_Alien_Return", cf: portalCF, radius: 11, palette: "magenta", linkTo: "Portal_Hub_Alien" }));
  rest.push(K.model({ name: "Dais_Portal_Alien_Return", children: P.portalDais(portalCF, { radius: 11, glow: [255, 90, 220] }) }));
  rest.push(...S.signPanel(C.cfFace([CX - 168, 31, 2], [1, 0, 0]), { text: "← НАЗАД НА СТАНЦИЮ", width: 30, height: 7, color: [14, 16, 26], textColor: [255, 120, 230], depth: 1.1 }));
  for (const sx of [-1, 1]) rest.push(...S.lamp([CX - 168 + sx * 22, 3.5, 6], 12, [255, 90, 220], { range: 40, brightness: 1.8 }));
  out.push(K.model({ name: "AlienRest", children: rest }));

  return out;
}

module.exports = { build };
