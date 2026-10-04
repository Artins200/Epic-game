"use strict";
/*
 * Мини-библиотека CFrame-математики + обёртки над типами rbx-dom.
 * Позволяет строить сложные конструкции (кольца, купола, трубы) из обычных деталей.
 */
const { types } = require("rbx-dom");

const R = (n) => Math.round(n * 1e5) / 1e5;
const IDENT = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// ---------------------------------------------------------------- vector math
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vlen = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const vnorm = (a) => {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// ---------------------------------------------------------------- matrix math
function matmul(a, b) {
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
      r[i][j] = s;
    }
  return r;
}
function mapply(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
function mcol(m, k) {
  return [m[0][k], m[1][k], m[2][k]];
}
const rotX = (t) => {
  const c = Math.cos(t), s = Math.sin(t);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
};
const rotY = (t) => {
  const c = Math.cos(t), s = Math.sin(t);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
};
const rotZ = (t) => {
  const c = Math.cos(t), s = Math.sin(t);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};

// ---------------------------------------------------------------- cframe API
/** cf: { pos:[x,y,z], m:[[..],[..],[..]] } (m — обычная матрица поворота) */
const cf = (pos, m) => ({ pos: [R(pos[0]), R(pos[1]), R(pos[2])], m: m || IDENT });
const cfp = (x, y, z) => cf([x, y, z]);
/** CFrame.new(pos) * CFrame.Angles(rx, ry, rz) — углы в радианах */
const cfA = (pos, rx = 0, ry = 0, rz = 0) =>
  cf(pos, matmul(matmul(rotX(rx), rotY(ry)), rotZ(rz)));
const cfDeg = (pos, dx = 0, dy = 0, dz = 0) =>
  cfA(pos, (dx * Math.PI) / 180, (dy * Math.PI) / 180, (dz * Math.PI) / 180);
const cfMul = (a, b) => cf(vadd(a.pos, mapply(a.m, b.pos)), matmul(a.m, b.m));
/** CFrame.lookAt: ось -Z смотрит в target */
const cfLook = (pos, target, up = [0, 1, 0]) => {
  const z = vnorm(vsub(pos, target));
  let x = vcross(up, z);
  if (vlen(x) < 1e-6) x = vcross([0, 0, 1], z);
  x = vnorm(x);
  const y = vcross(z, x);
  return cf(pos, [
    [x[0], y[0], z[0]],
    [x[1], y[1], z[1]],
    [x[2], y[2], z[2]],
  ]);
};
const cfAxes = (pos, xa, ya, za) =>
  cf(pos, [
    [xa[0], ya[0], za[0]],
    [xa[1], ya[1], za[1]],
    [xa[2], ya[2], za[2]],
  ]);
/** Кадр, у которого локальная +X смотрит вдоль нормали n (для порталов), +Y — вверх */
const cfNorm = (pos, n, up = [0, 1, 0]) => {
  const x = vnorm(n);
  let y = vsub(up, vmul(x, vdot(up, x)));
  if (vlen(y) < 1e-6) y = vsub([0, 0, 1], vmul(x, vdot([0, 0, 1], x)));
  y = vnorm(y);
  const z = vcross(x, y);
  return cf(pos, [
    [x[0], y[0], z[0]],
    [x[1], y[1], z[1]],
    [x[2], y[2], z[2]],
  ]);
};
/** Кадр, у которого лицевая грань (-Z) смотрит вдоль dir (для вывесок) */
const cfFace = (pos, dir, up = [0, 1, 0]) => cfLook(pos, vadd(pos, dir), up);
/** Смещение в локальных координатах родителя */
const cfRel = (base, x, y, z) => cfMul(base, cfp(x, y, z));
const cfRelA = (base, x, y, z, rx = 0, ry = 0, rz = 0) =>
  cfMul(base, cfA([x, y, z], rx, ry, rz));
const cfInv = (c) => {
  const mt = [
    [c.m[0][0], c.m[1][0], c.m[2][0]],
    [c.m[0][1], c.m[1][1], c.m[2][1]],
    [c.m[0][2], c.m[1][2], c.m[2][2]],
  ];
  return cf(vmul(mapply(mt, c.pos), -1), mt);
};
/** Кольцо из деталей в плоскости XY вокруг локального начала координат */
const cfRing = (base, radius, angle, extraY = 0) =>
  cfMul(base, cfA([Math.cos(angle) * radius, extraY, Math.sin(angle) * radius], 0, -angle, 0));

// ---------------------------------------------------------------- rbx types
const V3 = (v) => types.taggedVariant("Vector3", types.vector3(v[0], v[1], v[2]));
const V3n = (x, y, z) => V3([x, y, z]);
const CFv = (c) =>
  types.taggedVariant("CFrame", {
    position: [R(c.pos[0]), R(c.pos[1]), R(c.pos[2])],
    orientation: [mcol(c.m, 0).map(R), mcol(c.m, 1).map(R), mcol(c.m, 2).map(R)],
  });
/** Color3 из 0..255 */
const C3 = (r, g, b) => types.taggedVariant("Color3uint8", types.color3uint8(Math.round(r), Math.round(g), Math.round(b)));
/** Color3 из 0..1 (HDR-значения > 1 хороши для неона) */
const C3f = (r, g, b) => types.taggedVariant("Color3", types.color3(r, g, b));
const NR = (a, b = a) => types.taggedVariant("NumberRange", types.numberRange(a, b));
const NS = (pts) =>
  types.taggedVariant(
    "NumberSequence",
    types.numberSequence(pts.map((p) => types.numberSequenceKeypoint(p[0], p[1], p[2] || 0))),
  );
const CS = (pts) =>
  types.taggedVariant(
    "ColorSequence",
    types.colorSequence(pts.map((p) => types.colorSequenceKeypoint(p[0], types.color3(p[1][0], p[1][1], p[1][2])))),
  );
const UD = (s, o = 0) => types.udim(s, o);
const UD2 = (xs, xo, ys, yo) => types.taggedVariant("UDim2", types.udim2(UD(xs, xo), UD(ys, yo)));
const URI = (u) => types.taggedVariant("Content", types.contentUri(u));
const REF = (r) => types.refFromString(String(r));

module.exports = {
  R,
  IDENT,
  // vector
  vadd, vsub, vmul, vlen, vnorm, vcross, vdot, vlerp,
  // matrix
  matmul, mapply, mcol, rotX, rotY, rotZ,
  // cframe
  cf, cfp, cfA, cfDeg, cfMul, cfLook, cfNorm, cfFace, cfAxes, cfRel, cfRelA, cfInv, cfRing,
  // rbx
  V3, V3n, CFv, C3, C3f, NR, NS, CS, UD, UD2, URI, REF, types,
};
