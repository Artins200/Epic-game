"use strict";
/*
 * Процедурные формы: кольца порталов, купола, арки, мосты, скалы, деревья,
 * кристаллы, фонари, вывески, трубы. Всё собирается из обычных деталей.
 */
const C = require("./cframe");
const K = require("./kit");
const { part, deco, cyl, ball, wedge, pillar, cylBetween, pointLight, MAT } = K;

// ---------------------------------------------------------------- генератор случайных чисел
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rr = (r, a, b) => a + (b - a) * r();

// ---------------------------------------------------------------- кольца
/**
 * Кольцо сегментов вокруг локальной оси X (плоскость YZ). Используется для порталов,
 * где ось диска = локальная X.
 */
function ringYZ(base, o) {
  const count = o.count || 24;
  const radius = o.radius;
  const span = o.span !== undefined ? o.span : Math.PI * 2;
  const start = o.start || 0;
  const size = o.size || [radius * 0.28, radius * 0.09, o.depth || radius * 0.1];
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = start + (i / count) * span;
    const pos = C.vadd(base.pos, C.mapply(base.m, [0, Math.sin(a) * (o.radiusY || radius), Math.cos(a) * radius]));
    const frame = C.cfAxes(
      [pos[0], pos[1], pos[2]],
      C.mapply(base.m, [0, Math.cos(a), -Math.sin(a)]), // вдоль кольца
      C.mapply(base.m, [0, Math.sin(a), Math.cos(a)]), // наружу
      C.mapply(base.m, [1, 0, 0]), // ось кольца
    );
    const seg = o.segment || {};
    out.push(
      part(
        Object.assign(
          {
            name: o.name || "RingSegment",
            size,
            cf: frame,
            color: o.color,
            material: o.material !== undefined ? o.material : MAT.Neon,
            cast: false,
          },
          seg,
          o.tint && i % 2 ? { color: o.tint } : {},
        ),
      ),
    );
  }
  return out;
}

/** Кольцо сегментов вокруг локальной оси Y (плоскость XZ) — узоры на полу. */
function ringXZ(base, o) {
  const count = o.count || 32;
  const radius = o.radius;
  const span = o.span !== undefined ? o.span : Math.PI * 2;
  const size = o.size || [(2 * Math.PI * radius) / count * 0.92, o.thickness || 0.4, o.depth || 1];
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * span;
    const pos = C.vadd(base.pos, C.mapply(base.m, [Math.sin(a) * radius, 0, Math.cos(a) * radius]));
    const frame = C.cfAxes(
      pos,
      C.mapply(base.m, [Math.cos(a), 0, -Math.sin(a)]),
      C.mapply(base.m, [Math.sin(a), 0, Math.cos(a)]),
      C.mapply(base.m, [0, -1, 0]),
    );
    out.push(
      part({
        name: o.name || "FloorRing",
        size,
        cf: frame,
        color: o.color,
        material: o.material !== undefined ? o.material : MAT.Neon,
        transparency: o.transparency || 0,
        collide: false,
        query: false,
        cast: false,
      }),
    );
  }
  return out;
}

/** Купол из сегментов (полусфера). */
function dome(base, o) {
  const radius = o.radius;
  const rings = o.rings || 6;
  const segs = o.segs || 24;
  const out = [];
  for (let i = 0; i < rings; i++) {
    const phi = (i / rings) * (o.span ? o.span : Math.PI / 2);
    const y = Math.cos(phi) * radius * (o.flat || 1);
    const r = Math.sin(phi) * radius;
    if (r < 0.6) continue;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2 + (i % 2) * (Math.PI / segs);
      const pos = C.vadd(base.pos, C.mapply(base.m, [Math.sin(a) * r, y, Math.cos(a) * r]));
      const frame = C.cfAxes(
        pos,
        C.mapply(base.m, [-Math.sin(a), 0, Math.cos(a)]),
        C.mapply(base.m, [Math.cos(phi) * Math.cos(a), -Math.sin(phi), Math.cos(phi) * Math.sin(a)]),
        C.mapply(base.m, [Math.sin(phi) * Math.cos(a), Math.cos(phi) * (o.flat || 1), Math.sin(phi) * Math.sin(a)]),
      );
      out.push(
        part({
          name: o.name || "DomePanel",
          size: [(2 * Math.PI * r) / segs * 1.06, (Math.PI * radius) / (2 * rings) * 1.15, o.thickness || 1.2],
          cf: frame,
          color: o.color,
          material: o.material !== undefined ? o.material : MAT.Metal,
          transparency: o.transparency || 0,
          collide: o.collide !== false,
          query: o.query,
          cast: o.cast !== false,
          reflectance: o.reflectance,
        }),
      );
    }
  }
  return out;
}

/** Арка (полукольцо) — каркас портала. */
function arch(base, o) {
  return ringYZ(base, Object.assign({ span: Math.PI * 2, start: -Math.PI / 2 }, o));
}

/** Наклонная плита между двумя точками (мост, пандус, дорога). */
function slabBetween(a, b, width, thickness, o = {}) {
  const dir = C.vnorm(C.vsub(b, a));
  const mid = C.vmul(C.vadd(a, b), 0.5);
  const len = C.vlen(C.vsub(b, a));
  let up = Math.abs(dir[1]) > 0.97 ? [0, 0, 1] : [0, 1, 0];
  const za = C.vnorm(C.vcross(dir, up));
  const ya = C.vnorm(C.vcross(za, dir));
  const frame = C.cfAxes(mid, dir, ya, za);
  return part(Object.assign({ name: o.name || "Slab", size: [len, thickness || 1.5, width], cf: frame, collide: true }, o, { size: [len, thickness || 1.5, width] }));
}

// ---------------------------------------------------------------- природа
function rockCluster(pos, scale, color, seed, opts = {}) {
  const r = rng(seed);
  const out = [];
  const n = opts.count || 4;
  for (let i = 0; i < n; i++) {
    const s = scale * rr(r, 0.5, 1.1);
    const p = [pos[0] + rr(r, -scale, scale), pos[1] + s * 0.35, pos[2] + rr(r, -scale, scale)];
    out.push(
      deco({
        name: "Rock",
        size: [s * 2, s * 1.4, s * 1.8],
        cf: C.cfDeg(p, rr(r, -20, 20), rr(r, 0, 360), rr(r, -20, 20)),
        color: color,
        material: opts.material !== undefined ? opts.material : MAT.Slate,
      }),
    );
  }
  return out;
}

function tree(pos, scale, o = {}) {
  const r = rng(o.seed || 7);
  const out = [];
  const trunkH = 8 * scale;
  const trunkC = o.trunkColor || [96, 66, 42];
  const leafC = o.leafColor || [58, 120, 52];
  out.push(
    cyl({ name: "Trunk", size: [trunkH, 2.2 * scale, 2.2 * scale], cf: C.cfMul(C.cfp(pos[0], pos[1] + trunkH / 2, pos[2]), C.cfA([0, 0, 0], 0, 0, Math.PI / 2)), color: trunkC, material: MAT.Wood, collide: true, query: true }),
  );
  const blobs = o.blobs || 3;
  for (let i = 0; i < blobs; i++) {
    const s = rr(r, 2.6, 4.2) * scale;
    out.push(
      deco({
        name: "Leaves",
        size: [s * 2, s * 1.7, s * 2],
        cf: C.cfp(pos[0] + rr(r, -1.6, 1.6) * scale, pos[1] + trunkH * rr(r, 0.86, 1.15), pos[2] + rr(r, -1.6, 1.6) * scale),
        color: o.leafColor ? o.leafColor : [leafC[0] * rr(r, 0.85, 1.1), leafC[1] * rr(r, 0.85, 1.15), leafC[2] * rr(r, 0.85, 1.1)],
        material: MAT.LeafyGrass,
      }),
    );
  }
  return out;
}

function deadTree(pos, scale, o = {}) {
  const r = rng(o.seed || 3);
  const out = [];
  const h = 9 * scale;
  const col = o.color || [92, 68, 48];
  out.push(cyl({ name: "DeadTrunk", size: [h, 1.8 * scale, 1.8 * scale], cf: C.cfMul(C.cfp(pos[0], pos[1] + h / 2, pos[2]), C.cfA([0, 0, 0], 0, 0, Math.PI / 2)), color: col, material: MAT.Wood, collide: true, query: true }));
  for (let i = 0; i < (o.branches || 4); i++) {
    const a = rr(r, 0, Math.PI * 2);
    const bl = rr(r, 2.5, 5) * scale;
    const base = [pos[0], pos[1] + h * rr(r, 0.55, 0.95), pos[2]];
    const tip = [base[0] + Math.cos(a) * bl, base[1] + rr(r, 1, 2.5) * scale, base[2] + Math.sin(a) * bl];
    out.push(cylBetween(base, tip, 0.55 * scale, { name: "Branch", color: col, material: MAT.Wood, collide: false, query: false, cast: false }));
  }
  return out;
}

function mushroom(pos, scale, o = {}) {
  const out = [];
  const h = 11 * scale;
  const capC = o.capColor || [226, 88, 164];
  out.push(
    cyl({ name: "ShroomStem", size: [h, 2.4 * scale, 2.4 * scale], cf: C.cfMul(C.cfp(pos[0], pos[1] + h / 2, pos[2]), C.cfA([0, 0, 0], 0, 0, Math.PI / 2)), color: o.stemColor || [232, 224, 210], material: MAT.SmoothPlastic, collide: true, query: true }),
  );
  out.push(
    ball({ name: "ShroomCap", size: [11 * scale, 4.2 * scale, 11 * scale], cf: C.cfp(pos[0], pos[1] + h, pos[2]), color: capC, material: o.capMaterial !== undefined ? o.capMaterial : MAT.SmoothPlastic, collide: true, query: true }),
  );
  const r = rng(o.seed || 11);
  out.push(
    ball({
      name: "ShroomGlow", size: [4.6 * scale, 2.6 * scale, 4.6 * scale],
      cf: C.cfp(pos[0], pos[1] + h + 0.6 * scale, pos[2]),
      color: o.glowColor || [180, 255, 140], material: MAT.Neon, collide: false, query: false, cast: false,
      children: [pointLight({ color: [0.55, 1, 0.5], range: 26 * scale, brightness: 1.6 })],
    }),
  );
  return out;
}

/** Кристалл: призма + две «крыши» сверху (стрелка из двух WedgePart). */
function crystal(pos, height, width, color, angleDeg, seed) {
  const out = [];
  const cf = C.cfDeg(pos, 0, angleDeg || 0, 0);
  out.push(deco({ name: "Crystal", size: [width, height, width], cf: C.cfRel(cf, 0, height / 2, 0), color, material: MAT.Neon, transparency: 0.15 }));
  const capH = width * 1.25;
  out.push(wedge({ name: "CrystalTip", size: [width, capH, width], cf: C.cfMul(cf, C.cfA([0, height + capH / 2, 0], 0, 180, 0)), color, material: MAT.Neon, transparency: 0.15, collide: false, query: false, cast: false }));
  out.push(wedge({ name: "CrystalTip", size: [width, capH, width], cf: C.cfMul(cf, C.cfA([0, height + capH / 2, 0], 0, 0, 0)), color, material: MAT.Neon, transparency: 0.15, collide: false, query: false, cast: false }));
  return out;
}

function crystalCluster(pos, scale, color, seed, o = {}) {
  const r = rng(seed);
  const out = [];
  const n = o.count || 5;
  for (let i = 0; i < n; i++) {
    const h = rr(r, 0.6, 1.35) * 7 * scale;
    const w = rr(r, 0.35, 0.7) * 2.4 * scale;
    const p = [pos[0] + rr(r, -4, 4) * scale, pos[1], pos[2] + rr(r, -4, 4) * scale];
    out.push(...crystal(p, h, w, color, rr(r, 0, 360), 0));
  }
  if (o.light !== false) {
    out.push(deco({
      name: "CrystalGlow", size: [1, 1, 1], cf: C.cfp(pos[0], pos[1] + 3 * scale, pos[2]),
      color: color, material: MAT.Neon,
      children: [pointLight({ color: [color[0] / 255 * 1.4, color[1] / 255 * 1.4, color[2] / 255 * 1.4], range: 34 * scale, brightness: 2 })],
    }));
  }
  return out;
}

// ---------------------------------------------------------------- архитектура
function lamp(pos, height, color, o = {}) {
  const out = [];
  out.push(pillar({ name: "LampPole", size: [height, 0.7, 0.7], cf: C.cfp(pos[0], pos[1] + height / 2, pos[2]), color: o.poleColor || [48, 52, 62], material: MAT.Metal, collide: true, query: true }));
  out.push(deco({ name: "LampHead", size: [1.9, 0.5, 1.9], cf: C.cfp(pos[0], pos[1] + height, pos[2]), color, material: MAT.Neon, children: [pointLight({ color: [color[0] / 255, color[1] / 255, color[2] / 255], range: o.range || 46, brightness: o.brightness || 2.2 })] }));
  return out;
}

function neonStrip(a, b, thickness, color, o = {}) {
  return cylBetween(a, b, thickness, { name: o.name || "NeonStrip", color, material: MAT.Neon, collide: false, query: false, cast: false, transparency: o.transparency || 0 });
}

function pipeRun(points, diameter, color, o = {}) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push(cylBetween(points[i], points[i + 1], diameter, { name: o.name || "Pipe", color, material: o.material !== undefined ? o.material : MAT.Metal, collide: o.collide !== false, query: o.query, cast: o.cast }));
    if (i > 0) out.push(ball({ name: "PipeJoint", size: [diameter * 1.25, diameter * 1.25, diameter * 1.25], cf: C.cfp(...points[i]), color, material: o.material !== undefined ? o.material : MAT.Metal, collide: false, query: false, cast: false }));
  }
  return out;
}

function signPanel(cf, o) {
  const w = o.width || 24;
  const h = o.height || 8;
  const body = part({
    name: o.name || "Sign",
    size: [w, h, o.depth || 0.8],
    cf,
    color: o.color || [18, 20, 30],
    material: MAT.SmoothPlastic,
    collide: o.collide !== false,
    query: o.query,
    cast: true,
    children: [
      K.surfaceGui({
        face: o.face !== undefined ? o.face : 5,
        canvas: [w * 20, h * 20],
        lightInfluence: 0,
        brightness: 1.4,
        alwaysOnTop: false,
        children: [
          K.textLabel({
            name: "SignText",
            text: o.text || "",
            textColor: o.textColor || [255, 255, 255],
            stroke: o.stroke !== undefined ? o.stroke : 0.3,
            strokeColor: o.strokeColor || [10, 10, 14],
            size: [1, 0, 1, 0],
            backgroundTransparency: 1,
            textScaled: true,
            rich: true,
          }),
        ],
      }),
    ],
  });
  const out = [body];
  if (o.frame !== false) {
    const frames = [
      [[0, h / 2 + 0.4, 0], [w + 1.6, 0.8, (o.depth || 0.8) + 0.5]],
      [[0, -h / 2 - 0.4, 0], [w + 1.6, 0.8, (o.depth || 0.8) + 0.5]],
      [[-w / 2 - 0.4, 0, 0], [0.8, h + 1.6, (o.depth || 0.8) + 0.5]],
      [[w / 2 + 0.4, 0, 0], [0.8, h + 1.6, (o.depth || 0.8) + 0.5]],
    ];
    for (const [off, size] of frames) {
      out.push(deco({ name: "SignFrame", size, cf: C.cfRel(cf, off[0], off[1], off[2]), color: o.frameColor || o.textColor || [255, 255, 255], material: MAT.Neon }));
    }
  }
  return out;
}

function banner(cf, o) {
  return [
    part({ name: "Banner", size: [o.width || 8, o.height || 20, 0.3], cf, color: o.color || [40, 44, 60], material: MAT.Fabric, collide: false, query: false, cast: false }),
    deco({ name: "BannerEmblem", size: [(o.width || 8) * 0.55, (o.width || 8) * 0.55, 0.32], cf, color: o.emblem || [255, 180, 40], material: MAT.Neon }),
  ];
}

function column(base, h, r, o = {}) {
  const out = [];
  out.push(pillar({ name: o.name || "Column", size: [h, r * 2, r * 2], cf: C.cfp(base[0], base[1] + h / 2, base[2]), color: o.color || [180, 184, 196], material: o.material !== undefined ? o.material : MAT.Marble, collide: true, query: true }));
  out.push(deco({ name: "ColumnBase", size: [r * 3.2, 1.2, r * 3.2], cf: C.cfp(base[0], base[1] + 0.6, base[2]), color: o.trim || [120, 126, 140], material: MAT.Concrete }));
  out.push(deco({ name: "ColumnTop", size: [r * 3.2, 1.2, r * 3.2], cf: C.cfp(base[0], base[1] + h - 0.6, base[2]), color: o.trim || [120, 126, 140], material: MAT.Concrete }));
  if (o.glow) {
    out.push(deco({ name: "ColumnGlow", size: [r * 2.3, 0.5, r * 2.3], cf: C.cfp(base[0], base[1] + h * 0.5, base[2]), color: o.glow, material: MAT.Neon }));
  }
  return out;
}

function railing(a, b, h, color, o = {}) {
  const out = [];
  const dir = C.vnorm(C.vsub(b, a));
  const len = C.vlen(C.vsub(b, a));
  const n = Math.max(2, Math.round(len / 6));
  for (let i = 0; i <= n; i++) {
    const p = C.vlerp(a, b, i / n);
    out.push(pillar({ name: "RailPost", size: [h, 0.5, 0.5], cf: C.cfp(p[0], p[1] + h / 2, p[2]), color, material: MAT.Metal, collide: false, query: false, cast: false }));
  }
  const railY = h;
  out.push(cylBetween([a[0], a[1] + railY, a[2]], [b[0], b[1] + railY, b[2]], 0.45, { name: "RailTop", color, material: MAT.Metal, collide: false, query: false, cast: false }));
  out.push(cylBetween([a[0], a[1] + railY * 0.55, a[2]], [b[0], b[1] + railY * 0.55, b[2]], 0.3, { name: "RailMid", color, material: MAT.Metal, collide: false, query: false, cast: false }));
  return out;
}

function barrel(pos, color, o = {}) {
  const out = [];
  out.push(pillar({ name: "Barrel", size: [4.4, 3, 3], cf: C.cfp(pos[0], pos[1] + 2.2, pos[2]), color, material: MAT.CorrodedMetal, collide: true, query: true }));
  out.push(pillar({ name: "BarrelRim", size: [0.5, 3.3, 3.3], cf: C.cfp(pos[0], pos[1] + 3.9, pos[2]), color: [40, 40, 44], material: MAT.Metal, collide: false, query: false, cast: false }));
  out.push(pillar({ name: "BarrelRim", size: [0.5, 3.3, 3.3], cf: C.cfp(pos[0], pos[1] + 0.6, pos[2]), color: [40, 40, 44], material: MAT.Metal, collide: false, query: false, cast: false }));
  return out;
}

function crate(pos, size, color, o = {}) {
  const out = [];
  out.push(part({ name: "Crate", size, cf: C.cfp(pos[0], pos[1] + size[1] / 2, pos[2]), color, material: o.material !== undefined ? o.material : MAT.WoodPlanks, collide: true, query: true }));
  out.push(deco({ name: "CrateBand", size: [size[0] * 1.02, size[1] * 0.16, size[2] * 1.02], cf: C.cfp(pos[0], pos[1] + size[1] * 0.5, pos[2]), color: o.band || [70, 70, 78], material: MAT.Metal }));
  return out;
}

/** Летающая скала: верх + «корень» из сужающихся цилиндров. */
function floatingIsland(pos, scale, o = {}) {
  const out = [];
  const topC = o.topColor || [86, 132, 74];
  const rockC = o.rockColor || [96, 84, 76];
  out.push(ball({ name: "IslandTop", size: [26 * scale, 7 * scale, 26 * scale], cf: C.cfp(pos[0], pos[1], pos[2]), color: topC, material: MAT.Grass, collide: true, query: true }));
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    out.push(ball({
      name: "IslandRock",
      size: [26 * scale * (1 - t * 0.72), 13 * scale * (1 - t * 0.45), 26 * scale * (1 - t * 0.72)],
      cf: C.cfDeg([pos[0], pos[1] - 5 * scale - i * 6 * scale, pos[2]], 0, i * 24, 0),
      color: rockC, material: MAT.Rock, collide: true, query: true,
    }));
  }
  return out;
}

/** Обломки/руины здания: стены с «зубцами» сверху + мусор. pos — угол пола, yaw — поворот. */
function ruin(pos, w, h, d, color, seed, o = {}) {
  const r = rng(seed);
  const base = C.cfDeg(pos, 0, o.yaw || 0, 0);
  const out = [];
  const wallT = 2.2;
  const mat = o.material !== undefined ? o.material : MAT.Concrete;
  const walls = [
    [[0, 0, -d / 2], [w, h, wallT]],
    [[0, 0, d / 2], [w, h * 0.72, wallT]],
    [[-w / 2, 0, 0], [wallT, h * 0.55, d]],
  ];
  for (const [off, size] of walls) {
    out.push(part({
      name: "RuinWall", size,
      cf: C.cfRelA(base, off[0], size[1] / 2, off[2], 0, 0, 0),
      color, material: mat, collide: true, query: true,
    }));
    const teeth = Math.max(2, Math.floor(size[0] / 6));
    for (let i = 0; i < teeth; i++) {
      const th = rr(r, 0.6, 2.6);
      out.push(deco({
        name: "RuinTooth", size: [size[0] / teeth * 0.9, th, size[2]],
        cf: C.cfRel(base, off[0] - size[0] / 2 + (i + 0.5) * (size[0] / teeth), size[1] + th / 2, off[2]),
        color, material: mat,
      }));
    }
  }
  for (let i = 0; i < 5; i++) {
    const s = rr(r, 1.2, 3);
    out.push(deco({
      name: "Rubble", size: [s, s * 0.7, s * 0.9],
      cf: C.cfRelA(base, rr(r, -w / 2, w / 2), s * 0.35, rr(r, -d / 2, d / 2), rr(r, -12, 12), rr(r, 0, 360), rr(r, -12, 12)),
      color, material: mat,
    }));
  }
  return out;
}

/** Костёр/бочка с огнём. */
function fireBarrel(pos, o = {}) {
  const out = barrel(pos, o.color || [96, 62, 40], o);
  out.push(part({
    name: "FireCore", size: [1.6, 1.2, 1.6], cf: C.cfp(pos[0], pos[1] + 4.2, pos[2]), color: [255, 140, 40], material: MAT.Neon, collide: false, query: false, cast: false,
    children: [
      K.emit({
        name: "Fire", texture: "rbxasset://textures/particles/fire_main.dds", rate: 45, lifetime: [0.5, 1.1],
        speed: [2, 5], size: [[0, 2.6], [0.6, 4.4], [1, 0.4]], transparency: [[0, 0.25], [1, 1]],
        color: [[0, [2.2, 1.1, 0.25]], [0.45, [2, 0.7, 0.1]], [1, [0.5, 0.12, 0.03]]],
        spread: [12, 12, 0], rotSpeed: [-40, 40], acceleration: [0, 6, 0], lightEmission: 1, lightInfluence: 0, zOffset: 1.2,
      }),
      pointLight({ color: [1, 0.55, 0.2], range: 34, brightness: 3.2, shadows: true }),
    ],
  }));
  return out;
}

module.exports = {
  rng, rr, ringYZ, ringXZ, dome, arch, slabBetween, rockCluster, tree, deadTree, mushroom,
  crystal, crystalCluster, lamp, neonStrip, pipeRun, signPanel, banner, column, railing,
  barrel, crate, floatingIsland, ruin, fireBarrel,
};
