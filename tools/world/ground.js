"use strict";
/*
 * Мир: общий «материк», дороги между зонами, невидимые границы, уличные фонари.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const { part, deco, MAT } = K;

/** Прямоугольный «материк» со скатами по краям (чтобы не выглядел плоским блином) */
function build() {
  const out = [];
  const flat = [];

  flat.push(part({ name: "WorldFloor", size: [1700, 7, 1700], cf: C.cfp(0, -4.2, 0), color: [34, 52, 40], material: MAT.Grass, collide: true, query: true }));
  // «скалы» по периметру
  const rng = S.rng(4242);
  for (let i = 0; i < 42; i++) {
    const a = (i / 42) * Math.PI * 2;
    const r = 830 + S.rr(rng, -30, 30);
    const h = S.rr(rng, 40, 110);
    flat.push(deco({
      name: "CliffWall", size: [S.rr(rng, 90, 220), h, S.rr(rng, 60, 140)],
      cf: C.cfDeg([Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r], 0, S.rr(rng, 0, 360), 0),
      color: [58, 62, 70], material: MAT.Basalt,
    }));
  }
  // невидимые границы мира
  flat.push(deco({ name: "BoundaryNorth", size: [1700, 220, 8], cf: C.cfp(0, 100, -850), transparency: 1, color: [0, 0, 0], touch: true, collide: true, query: false }));
  flat.push(deco({ name: "BoundarySouth", size: [1700, 220, 8], cf: C.cfp(0, 100, 850), transparency: 1, color: [0, 0, 0], touch: true, collide: true, query: false }));
  flat.push(deco({ name: "BoundaryEast", size: [8, 220, 1700], cf: C.cfp(850, 100, 0), transparency: 1, color: [0, 0, 0], touch: true, collide: true, query: false }));
  flat.push(deco({ name: "BoundaryWest", size: [8, 220, 1700], cf: C.cfp(-850, 100, 0), transparency: 1, color: [0, 0, 0], touch: true, collide: true, query: false }));
  out.push(K.model({ name: "WorldBase", children: flat }));

  // ---------------------------------------------------------------- дороги
  const roads = [];
  const corridors = [
    { name: "Road_Wasteland", a: [-152, 0], b: [-212, 0], color: [255, 150, 60] },
    { name: "Road_Alien", a: [152, 0], b: [212, 0], color: [255, 90, 220] },
    { name: "Road_Citadel", a: [0, -152], b: [0, -212], color: [90, 220, 255] },
  ];
  for (const c of corridors) {
    const A = [c.a[0], -0.1, c.a[1]], B = [c.b[0], -0.1, c.b[1]];
    roads.push(S.slabBetween(A, B, 46, 1.2, { name: "RoadDeck", color: [42, 44, 54], material: MAT.Asphalt, collide: true, query: true }));
    const perp = C.vnorm(C.vcross(C.vsub(B, A), [0, 1, 0]));
    for (const s of [-1, 1]) {
      roads.push(S.neonStrip(
        [A[0] + perp[0] * 22.4 * s, 0.5, A[2] + perp[2] * 22.4 * s],
        [B[0] + perp[0] * 22.4 * s, 0.5, B[2] + perp[2] * 22.4 * s], 0.6, c.color, { transparency: 0.15 },
      ));
    }
    // фонари вдоль дороги
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = C.vlerp(A, B, t);
      for (const s of [-1, 1]) {
        roads.push(...S.lamp([p[0] + perp[0] * 26 * s, 0, p[2] + perp[2] * 26 * s], 14, c.color, { range: 44, brightness: 1.8 }));
      }
    }
  }
  out.push(K.model({ name: "Roads", children: roads }));

  return out;
}

module.exports = { build };
