"use strict";
/*
 * НЕБО: летающие острова, летающие тарелки на орбите, гигантские кольца-порталы
 * в стратосфере и парящие башни Цитадели.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const G = require("./groups");
const { part, deco, cyl, ball, pillar, pointLight, emit, MAT } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;

/** Конфиг орбитального полёта (обрабатывается клиентом) */
function orbitGroup(center, radius, speedDeg, startDeg) {
  const nv = G.numberValue;
  return {
    className: "Configuration",
    name: "OrbitGroup",
    children: [
      nv("CenterX", center[0]), nv("CenterY", center[1]), nv("CenterZ", center[2]),
      nv("Radius", radius), nv("Speed", speedDeg), nv("StartAngle", startDeg || 0),
    ],
  };
}

/** Летающая тарелка Рика */
function saucer(base, scale, o = {}) {
  const s = scale || 1;
  const out = [];
  const cf = C.cfRel(base, 0, 0, 0);
  out.push(cyl({ name: "SaucerHull", size: [2.8 * s, 20 * s, 20 * s], cf: C.cfMul(cf, C.cfDeg([0, 0, 0], 0, 0, 90)), color: o.color || [220, 226, 238], material: MAT.Metal, collide: false, query: false, cast: false }));
  out.push(cyl({ name: "SaucerSkirt", size: [1.4 * s, 23 * s, 23 * s], cf: C.cfMul(cf, C.cfDeg([0, -1.2 * s, 0], 0, 0, 90)), color: [150, 156, 172], material: MAT.Metal, collide: false, query: false, cast: false }));
  out.push(ball({ name: "SaucerDome", size: [12 * s, 9 * s, 12 * s], cf: C.cfRel(cf, 0, 3 * s, 0), color: [170, 230, 250], material: MAT.Glass, transparency: 0.4, collide: false, query: false, cast: false }));
  out.push(...S.ringXZ(C.cfRel(cf, 0, -0.6 * s, 0), { radius: 11.4 * s, count: Math.round(18 * s), thickness: 0.6 * s, depth: 0.9 * s, color: o.glow || [90, 220, 255], material: MAT.Neon, transparency: 0.15 }));
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90 + 45);
    out.push(ball({ name: "SaucerLight", size: [2.2 * s, 2.2 * s, 2.2 * s], cf: C.cfRel(cf, Math.cos(a) * 7.4 * s, -1.8 * s, Math.sin(a) * 7.4 * s), color: o.glow || [90, 220, 255], material: MAT.Neon, collide: false, query: false, cast: false }));
  }
  out.push(cyl({
    name: "SaucerThruster", size: [3 * s, 8 * s, 8 * s], cf: C.cfMul(cf, C.cfDeg([0, -3 * s, 0], 0, 0, 90)), color: o.glow || [90, 220, 255], material: MAT.Neon, transparency: 0.35, collide: false, query: false, cast: false,
    children: [
      pointLight({ color: [(o.glow || [90, 220, 255])[0] / 255, (o.glow || [90, 220, 255])[1] / 255, (o.glow || [90, 220, 255])[2] / 255], range: 90 * s, brightness: 2.6 }),
      emit({ name: "Thrust", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 30, lifetime: [0.5, 1.2], speed: [4, 10], size: [[0, 3 * s], [1, 10 * s]], transparency: [[0, 0.45], [1, 1]], color: [[0, [0.6, 1.4, 1.6]], [1, [0.05, 0.15, 0.2]]], spread: [18, 18, 0], acceleration: [0, -18, 0], lightEmission: 0.6, lockedToPart: true, rotation: [0, 360] }),
      G.pulseGroup(3, 0.2, 0.6),
    ],
  }));
  out.push(deco({ name: "SaucerAntenna", size: [0.4 * s, 5 * s, 0.4 * s], cf: C.cfRel(cf, 3 * s, 5 * s, 0), color: [120, 126, 140], material: MAT.Metal, collide: false, query: false, cast: false }));
  out.push(ball({ name: "SaucerBeacon", size: [1.6 * s, 1.6 * s, 1.6 * s], cf: C.cfRel(cf, 3 * s, 7.6 * s, 0), color: o.beacon || [255, 90, 90], material: MAT.Neon, collide: false, query: false, cast: false, children: [pointLight({ color: [1, 0.3, 0.3], range: 30, brightness: 2 }), G.pulseGroup(1.4, 0.05, 0.8)] }));
  return out;
}

function build() {
  const out = [];

  // ---------------------------------------------------------------- летающие острова
  const islands = [];
  const spots = [
    { p: [-190, 96, -150], s: 2.1, seed: 11, trees: true },
    { p: [210, 128, -110], s: 1.7, seed: 12, trees: false },
    { p: [-140, 168, 210], s: 2.4, seed: 13, trees: true },
    { p: [160, 96, 190], s: 1.5, seed: 14, trees: false },
    { p: [10, 210, 40], s: 3.0, seed: 15, trees: true },
    { p: [-260, 140, 60], s: 1.9, seed: 16, trees: false },
  ];
  for (const sp of spots) {
    const grp = S.floatingIsland(sp.p, sp.s, { topColor: [78, 126, 92], rockColor: [92, 82, 78] });
    if (sp.trees) {
      grp.push(...S.tree([sp.p[0] + 6, sp.p[1] + 3, sp.p[2] - 4], sp.s * 0.7, { seed: sp.seed, leafColor: [70, 150, 80] }));
      grp.push(...S.tree([sp.p[0] - 8, sp.p[1] + 3, sp.p[2] + 6], sp.s * 0.55, { seed: sp.seed + 1, leafColor: [60, 140, 70] }));
    }
    grp.push(...S.rockCluster([sp.p[0] + 4, sp.p[1] + 3, sp.p[2] + 8], sp.s * 2, [96, 88, 84], sp.seed + 20, { count: 3 }));
    grp.push(...S.crystalCluster([sp.p[0] - 12, sp.p[1] + 3, sp.p[2] - 10], sp.s * 0.5, [150, 255, 210], sp.seed + 30, { count: 3, light: false }));
    grp.push(deco({ name: "IslandGlow", size: [1, 1, 1], cf: C.cfp(sp.p[0], sp.p[1] - 8 * sp.s, sp.p[2]), color: [140, 255, 210], material: MAT.Neon, transparency: 0.9, children: [pointLight({ color: [0.5, 1, 0.85], range: 70, brightness: 1.4 }), G.bobGroup(0.4 + sp.s * 0.05, 3.4), G.spinGroup(6, [0, 1, 0])] }));
    islands.push(K.model({ name: "FloatingIsland", children: grp }));
  }
  out.push(K.model({ name: "SkyIslands", children: islands }));

  // ---------------------------------------------------------------- тарелки на орбите
  const ufos = [];
  const orbits = [
    { center: [0, 78, 0], radius: 150, speed: 5.2, start: 0, scale: 1.0, glow: [90, 220, 255] },
    { center: [0, 110, 0], radius: 220, speed: -3.6, start: 140, scale: 0.8, glow: [255, 90, 220] },
    { center: [-380, 88, 0], radius: 130, speed: 4.4, start: 60, scale: 0.75, glow: [255, 190, 60] },
    { center: [380, 100, 0], radius: 140, speed: -4.0, start: 200, scale: 0.7, glow: [140, 255, 190] },
    { center: [0, 100, -380], radius: 130, speed: 3.8, start: 300, scale: 0.72, glow: [160, 200, 255] },
  ];
  for (const [i, o] of orbits.entries()) {
    const a = rad(o.start);
    const pos = [o.center[0] + Math.cos(a) * o.radius, o.center[1], o.center[2] + Math.sin(a) * o.radius];
    const base = C.cfDeg(pos, 0, -o.start + 90, 0);
    const children = saucer(base, o.scale, { glow: o.glow });
    children.push(orbitGroup(o.center, o.radius, o.speed, o.start));
    ufos.push(K.model({ name: "Saucer_" + (i + 1), children }));
  }
  out.push(K.model({ name: "SkySaucers", children: ufos }));

  // ---------------------------------------------------------------- кольца-порталы в небе
  const rings = [];
  const skyRings = [
    { pos: [0, 420, -140], r: 92, color: [120, 255, 180], speed: -2.4, tilt: [0, 22, 16] },
    { pos: [-420, 320, 180], r: 56, color: [255, 214, 40], speed: 3.2, tilt: [0, -40, 28] },
    { pos: [430, 360, 120], r: 62, color: [255, 90, 220], speed: -3.0, tilt: [0, 55, -22] },
    { pos: [120, 520, 260], r: 44, color: [90, 220, 255], speed: 4.0, tilt: [0, 10, 42] },
  ];
  for (const [i, r] of skyRings.entries()) {
    const cf = C.cfDeg(r.pos, r.tilt[0], r.tilt[1], r.tilt[2]);
    const children = [];
    children.push(deco({ name: "SpinPivot", size: [0.2, 0.2, 0.2], cf, transparency: 1, ref: K.nextRef(), collide: false, query: false, cast: false }));
    children.push(...S.ringYZ(cf, { name: "SkyRingSeg", radius: r.r, count: Math.round(r.r * 0.62), size: [r.r * 0.36, r.r * 0.06, r.r * 0.08], color: r.color, material: MAT.Neon, transparency: 0.08 }));
    children.push(cyl({ name: "SkyDisc", size: [0.6, r.r * 1.8, r.r * 1.8], cf, color: r.color, material: MAT.Neon, transparency: 0.72, collide: false, query: false, cast: false }));
    children.push(deco({
      name: "SkyGlow", size: [1, 1, 1], cf, color: r.color, material: MAT.Neon, transparency: 1,
      children: [
        pointLight({ color: [r.color[0] / 255, r.color[1] / 255, r.color[2] / 255], range: 260, brightness: 3 }),
        emit({ name: "SkySparks", rate: 30, lifetime: [2, 5], speed: [4, 20], size: [[0, r.r * 0.07], [1, 0]], transparency: [[0, 0.15], [1, 1]], color: [[0, [r.color[0] / 110, r.color[1] / 110, r.color[2] / 110]], [1, [0, 0, 0]]], spread: [180, 180, 0], rotSpeed: [-90, 90], acceleration: [0, -2, 0], lightEmission: 1 }),
      ],
    }));
    children.push(G.spinGroup(r.speed, C.mapply(cf.m, [1, 0, 0])));
    rings.push(K.model({ name: "SkyPortal_" + (i + 1), primary: children[0].referent, children }));
  }
  out.push(K.model({ name: "SkyPortals", children: rings }));

  // ---------------------------------------------------------------- парящие башни Цитадели
  const towers = [];
  for (let i = 0; i < 7; i++) {
    const a = rad(i * 51 + 12);
    const r = 150 + (i % 3) * 90;
    const pos = [Math.cos(a) * r, 250 + (i % 4) * 46, -380 + Math.sin(a) * r * 0.8];
    const grp = [];
    const h = 40 + (i % 3) * 22;
    grp.push(cyl({ name: "TowerColumn", size: [h, 26, 26], cf: C.cfMul(C.cfp(pos[0], pos[1], pos[2]), C.cfDeg([0, 0, 0], 0, 0, 90)), color: [196, 200, 216], material: MAT.Marble, collide: false, query: false, cast: false }));
    grp.push(ball({ name: "TowerDome", size: [50, 50, 50], cf: C.cfp(pos[0], pos[1] - h / 2 - 12, pos[2]), color: [180, 186, 204], material: MAT.Marble, collide: false, query: false, cast: false }));
    grp.push(...S.ringXZ(C.cfp(pos[0], pos[1] + h / 2 - 4, pos[2]), { radius: 30, count: 22, thickness: 1, depth: 1.4, color: i % 2 ? [90, 220, 255] : [198, 168, 96], material: MAT.Neon, transparency: 0.2 }));
    grp.push(deco({
      name: "TowerLight", size: [1, 1, 1], cf: C.cfp(pos[0], pos[1] + h / 2 + 6, pos[2]), color: [90, 220, 255], material: MAT.Neon, transparency: 1,
      children: [pointLight({ color: [0.55, 0.85, 1], range: 120, brightness: 2.2 }), G.pulseGroup(0.8 + i * 0.1, 0.2, 0.7)],
    }));
    towers.push(K.model({ name: "CitadelTower_" + (i + 1), children: grp }));
  }
  out.push(K.model({ name: "SkyCitadel", children: towers }));

  return out;
}

module.exports = { build };
