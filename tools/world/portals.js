"use strict";
/*
 * Портал-конструктор: сочная «живая» арка с вращающимися слоями, свечением,
 * частицами и триггером телепорта. Используется для порталов-хаба и зон.
 *
 * Соглашение: локальная ось +X модели = нормаль портала (сторона выхода).
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const { part, deco, cyl, ball, pointLight, emit, arc, MAT } = { ...K, ...S };
const rad = (d) => (d * Math.PI) / 180;

const PALETTES = {
  green: { core: [150, 255, 190], mid: [50, 230, 120], deep: [12, 130, 60], light: [0.35, 1, 0.6], spark: [0.4, 2.6, 1.1] },
  yellow: { core: [255, 246, 190], mid: [255, 208, 40], deep: [168, 112, 8], light: [1, 0.86, 0.3], spark: [2.6, 2.0, 0.5] },
  cyan: { core: [200, 250, 255], mid: [80, 210, 255], deep: [16, 108, 168], light: [0.35, 0.85, 1], spark: [0.8, 2.2, 3] },
  magenta: { core: [255, 210, 250], mid: [255, 100, 220], deep: [150, 24, 130], light: [1, 0.35, 0.9], spark: [2.8, 0.7, 2.4] },
  orange: { core: [255, 230, 190], mid: [255, 150, 50], deep: [170, 70, 10], light: [1, 0.6, 0.22], spark: [3, 1.3, 0.4] },
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * staticPortal({ name, cf, radius, palette, linkTo, frame=true, sign=null, base=true, sparks=true })
 * cf — кадр портала: центр диска, +X — наружу.
 */
function staticPortal(o) {
  const P = PALETTES[o.palette || "green"];
  const R = o.radius || 10;
  const cf = o.cf;
  const children = [];

  // --- светящийся «зев» (несколько слоёв диска)
  children.push(cyl({
    name: "PortalCore",
    size: [0.22, R * 1.86, R * 1.86],
    cf: cf, color: P.mid, material: MAT.Neon, transparency: 0.32,
    collide: false, query: false, cast: false,
  }));
  children.push(cyl({
    name: "PortalHole",
    size: [0.34, R * 1.28, R * 1.28],
    cf: C.cfMul(cf, C.cfp(0.06, 0, 0)), color: P.deep, material: MAT.Neon, transparency: 0.18,
    collide: false, query: false, cast: false,
  }));
  children.push(ball({
    name: "PortalHot",
    size: [R * 0.5, R * 0.5, R * 0.5],
    cf: C.cfMul(cf, C.cfp(0.1, 0, 0)), color: P.core, material: MAT.Neon, transparency: 0.35,
    collide: false, query: false, cast: false,
  }));

  // --- вращающиеся слои-«завихрения»
  const swirlSpecs = [
    { r: 0.86, arcs: 2, span: 150, thick: 0.95, speed: 0.5, color: P.mid },
    { r: 0.66, arcs: 3, span: 96, thick: 0.8, speed: -0.72, color: mix(P.mid, P.core, 0.35) },
    { r: 0.45, arcs: 2, span: 120, thick: 0.7, speed: 0.95, color: P.core },
    { r: 0.24, arcs: 3, span: 84, thick: 0.6, speed: -1.3, color: [255, 255, 255] },
  ];
  for (const s of swirlSpecs) {
    for (let i = 0; i < s.arcs; i++) {
      const startDeg = (i / s.arcs) * 360 + 20;
      const segs = S.ringYZ(cf, {
        name: "PortalSwirl", radius: R * s.r, count: Math.max(5, Math.round((R * s.r * s.span) / 42)),
        span: rad(s.span), start: rad(startDeg), size: [R * s.r * (s.span / 360) * 1.02, s.thick, R * 0.09],
        color: s.color, material: MAT.Neon,
      });
      for (const seg of segs) {
        seg.properties.Transparency = 0.12;
        seg.children = [{ className: "StringValue", name: "Swirl", properties: { Value: String(s.speed) } }];
        children.push(seg);
      }
    }
  }

  // --- внешний обод
  const rim = S.ringYZ(cf, {
    name: "PortalRing", radius: R * 1.02, count: Math.max(16, Math.round(R * 1.6)),
    size: [R * 0.16, R * 0.1, R * 0.13], color: P.core, material: MAT.Neon, transparency: 0.05,
  });
  children.push(...rim);
  const rim2 = S.ringYZ(cf, {
    name: "PortalRingOuter", radius: R * 1.16, count: Math.max(12, Math.round(R * 1.1)),
    size: [R * 0.12, R * 0.075, R * 0.1], color: P.mid, material: MAT.Neon, transparency: 0.25,
  });
  children.push(...rim2);

  // --- свет и частицы
  children.push(deco({
    name: "PortalLightRig", size: [0.6, 0.6, 0.6], cf: C.cfMul(cf, C.cfp(-R * 0.25, 0, 0)),
    color: P.core, material: MAT.Neon,
    children: [
      pointLight({ color: P.light, range: R * 4.2, brightness: 3.4, shadows: true }),
      emit({
        name: "PortalSparks", rate: 34, lifetime: [0.5, 1.4], speed: [6, 18], size: [[0, R * 0.14], [1, 0]],
        transparency: [[0, 0.1], [1, 1]], color: [[0, P.spark], [0.6, [P.spark[0] * 0.5, P.spark[1] * 0.5, P.spark[2] * 0.5]], [1, [0, 0, 0]]],
        spread: [40, 40, 0], rotSpeed: [-200, 200], acceleration: [0, -6, 0], zOffset: 0.5, lightEmission: 1,
      }),
      emit({
        name: "PortalWisps", texture: "rbxasset://textures/particles/smoke_main.dds", rate: 12, lifetime: [1.4, 3.2],
        speed: [1, 5], size: [[0, R * 0.2], [1, R * 0.62]], transparency: [[0, 0.55], [1, 1]],
        color: [[0, [P.light[0] * 0.8, P.light[1] * 0.8, P.light[2] * 0.8]], [1, [0, 0, 0]]],
        spread: [60, 60, 0], rotSpeed: [-24, 24], lightEmission: 0.85, lightInfluence: 0.1, zOffset: -1,
      }),
      emit({
        name: "PortalDust", texture: "rbxasset://textures/particles/sparkles_main.dds", rate: 26, lifetime: [1.6, 3.4],
        speed: [0.5, 2.5], size: [[0, R * 0.1], [0.5, R * 0.16], [1, 0]], transparency: [[0, 0.35], [1, 1]],
        color: [[0, P.spark], [1, [0, 0, 0]]], spread: [180, 180, 0], acceleration: [0, 9, 0], rotSpeed: [-90, 90], lightEmission: 1,
      }),
    ],
  }));

  // --- триггер телепорта
  children.push(deco({
    name: "PortalTrigger", size: [3.2, R * 2.3, R * 2.3], cf: cf,
    transparency: 1, color: [255, 255, 255], material: MAT.SmoothPlastic, touch: true, query: false, collide: false,
  }));

  // --- металлическая рама
  if (o.frame !== false) {
    const metal = o.frameColor || [58, 62, 74];
    const fr = S.ringYZ(cf, {
      name: "PortalFrame", radius: R * 1.34, count: Math.max(8, Math.round(R * 0.65)),
      size: [R * 0.5, R * 0.26, R * 0.3], color: metal, material: MAT.Metal, collide: true, query: true,
    });
    children.push(...fr);
    for (let i = 0; i < 8; i++) {
      const a = rad((i / 8) * 360 + 22);
      children.push(deco({
        name: "PortalBolt", size: [0.7, 0.7, 0.7],
        cf: C.cfMul(cf, C.cfA([0, Math.sin(a) * R * 1.34, Math.cos(a) * R * 1.34], 0, 0, 0)),
        color: [188, 194, 206], material: MAT.Metal,
      }));
    }
    // ножки-опоры
    for (const sx of [-1, 1]) {
      const base = C.cfMul(cf, C.cfp(0, -R * 1.5, sx * R * 0.72));
      children.push(deco({ name: "PortalLeg", size: [1.1, R * 0.85, 1.1], cf: C.cfRel(base, 0, R * 0.42, 0), color: metal, material: MAT.Metal }));
    }
  }

  const vals = [];
  if (o.linkTo) vals.push(K.stringValue("LinkTo", o.linkTo));
  vals.push(K.stringValue("Palette", o.palette || "green"));
  vals.push(K.numberValue("Radius", R));

  const model = K.model({
    name: o.name, primary: null, children: children.concat(vals),
  });
  return model;
}

/** Изящная арка/пьедестал под портал-хаб */
function portalDais(cf, o = {}) {
  const R = o.radius || 10;
  const out = [];
  const color = o.color || [46, 50, 62];
  out.push(cyl({
    name: "Dais", size: [2.2, R * 3.4, R * 3.4], cf: C.cfMul(cf, C.cfp(-R * 0.42, -R * 1.72, 0)),
    color: [64, 68, 84], material: MAT.Concrete, collide: true, query: true,
  }));
  out.push(cyl({
    name: "DaisGlow", size: [0.28, R * 3.1, R * 3.1], cf: C.cfMul(cf, C.cfp(-R * 0.36, -R * 0.72, 0)),
    color: o.glow || [90, 220, 255], material: MAT.Neon, transparency: 0.25, collide: false, query: false, cast: false,
  }));
  // ступени
  for (let i = 0; i < 3; i++) {
    out.push(cyl({
      name: "DaisStep", size: [1.0, R * (3.4 - i * 0.45), R * (3.4 - i * 0.45)],
      cf: C.cfMul(cf, C.cfp(-R * 0.42 - (i + 1) * 0.7, -R * 1.5 + i * 0.9, 0)),
      color: [56, 60, 74], material: MAT.Concrete, collide: true, query: true,
    }));
  }
  return out;
}

module.exports = { PALETTES, staticPortal, portalDais, mix };
