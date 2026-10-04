"use strict";
/*
 * ПОДЗЕМНАЯ ЛАБОРАТОРИЯ РИКА: пандус-туннель от площади, верстак, колба с портальной
 * жидкостью, летающая тарелка, доска с формулами, аркада, диван, огурчик-Рик в банке.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const G = require("./groups");
const CH = require("../lib/characters");
const { part, deco, cyl, ball, pillar, pointLight, emit, MAT } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;
const FLOOR_Y = -70;
const CEIL_Y = -52;
const X0 = -100, X1 = 100, Z0 = -72, Z1 = 26;
const CEIL_OPEN_Z = 74; // до этой отметки пандус идёт открытой траншеей, дальше — под землёй

/** Светящаяся лампа-панель на потолке */
function ceilLamp(x, z, w) {
  return deco({
    name: "CeilLamp", size: [w, 0.7, 3.4], cf: C.cfp(x, CEIL_Y + 1.4, z), color: [235, 245, 255], material: MAT.Neon,
    children: [pointLight({ color: [0.9, 0.96, 1], range: 46, brightness: 2.2 })],
  });
}

function build() {
  const out = [];

  // ---------------------------------------------------------------- туннель-пандус
  const tunnel = [];
  const A = [0, -1.2, 118], B = [0, FLOOR_Y - 1.2, Z1 + 2]; // устье на площади → пол лаборатории
  tunnel.push(S.slabBetween(A, B, 40, 2.4, { name: "RampDeck", color: [58, 60, 70], material: MAT.Concrete, collide: true, query: true }));
  const dir = C.vnorm(C.vsub(B, A));
  const perp = C.vnorm(C.vcross(dir, [0, 1, 0]));
  for (const s of [-1, 1]) {
    const off = [perp[0] * 20 * s, 0, perp[2] * 20 * s];
    tunnel.push(S.slabBetween(C.vadd(A, off), C.vadd(B, off), 3, 30, { name: "RampWall", color: [70, 72, 84], material: MAT.Concrete, collide: true, query: true }));
    // неоновые ленты по стенам
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const p = C.vlerp(A, B, t);
      tunnel.push(deco({ name: "RampLight", size: [2.4, 0.5, 0.5], cf: C.cfp(p[0] + off[0] * 0.92, p[1] + 6, p[2] + off[2] * 0.92), color: [90, 220, 255], material: MAT.Neon, children: [pointLight({ color: [0.5, 0.85, 1], range: 22, brightness: 1.4 })] }));
    }
  }
  // Потолок — только над подземной частью: начинается там, где уходит под пол площади.
  const ceilT = (A[2] - CEIL_OPEN_Z) / (A[2] - B[2]);
  const C0 = C.vlerp(A, B, ceilT);
  tunnel.push(S.slabBetween([C0[0], C0[1] + 26, C0[2]], [B[0], B[1] + 26, B[2]], 42, 2.6, { name: "RampCeiling", color: [64, 66, 78], material: MAT.Concrete, collide: true, query: true }));
  out.push(K.model({ name: "GarageTunnel", children: tunnel }));

  // ---------------------------------------------------------------- въездные ворота на площади
  const gate = [];
  for (const sx of [-1, 1]) {
    gate.push(part({ name: "GatePillar", size: [6, 26, 8], cf: C.cfp(sx * 23, 13, 128), color: [96, 98, 110], material: MAT.Concrete, collide: true, query: true }));
    gate.push(deco({ name: "GateStripe", size: [6.2, 2, 8.2], cf: C.cfp(sx * 23, 20, 128), color: [255, 200, 40], material: MAT.SmoothPlastic }));
  }
  gate.push(part({ name: "GateLintel", size: [54, 6, 8], cf: C.cfp(0, 29, 128), color: [86, 88, 100], material: MAT.Concrete, collide: true, query: true }));
  gate.push(...S.signPanel(C.cfFace([0, 30, 123.6], [0, 0, 1]), { text: "ГАРАЖ РИКА · ПОСТОРОННИМ НЕ ВХОДИТЬ", width: 46, height: 8, color: [12, 14, 22], textColor: [120, 255, 180], depth: 1 }));
  gate.push(part({ name: "GateDoor", size: [44, 10, 1.2], cf: C.cfp(0, 34.5, 128), color: [110, 112, 124], material: MAT.DiamondPlate, collide: false, query: false, cast: false }));
  for (let i = 0; i < 6; i++) {
    gate.push(deco({ name: "GateBrace", size: [44, 0.6, 1.4], cf: C.cfp(0, 30.5 + i * 1.6, 128), color: [86, 88, 100], material: MAT.Metal }));
  }
  out.push(K.model({ name: "GarageGate", children: gate }));

  // ---------------------------------------------------------------- помещение
  const room = [];
  room.push(part({ name: "LabFloor", size: [220, 4, 110], cf: C.cfp(0, FLOOR_Y - 2, -23), color: [64, 66, 78], material: MAT.Concrete, collide: true, query: true }));
  room.push(part({ name: "LabWallNorth", size: [220, 20, 4], cf: C.cfp(0, FLOOR_Y + 9, Z0 - 2), color: [78, 80, 94], material: MAT.Concrete, collide: true, query: true }));
  room.push(part({ name: "LabWallEast", size: [4, 20, 110], cf: C.cfp(X1 + 2, FLOOR_Y + 9, -23), color: [78, 80, 94], material: MAT.Concrete, collide: true, query: true }));
  room.push(part({ name: "LabWallWest", size: [4, 20, 110], cf: C.cfp(X0 - 2, FLOOR_Y + 9, -23), color: [78, 80, 94], material: MAT.Concrete, collide: true, query: true }));
  // южная стена с проёмом под пандус
  for (const sx of [-1, 1]) {
    room.push(part({ name: "LabWallSouth", size: [X1 - 10, 20, 4], cf: C.cfp(sx * (X1 + 10) / 2, FLOOR_Y + 9, Z1 + 2), color: [78, 80, 94], material: MAT.Concrete, collide: true, query: true }));
  }
  room.push(part({ name: "LabLintel", size: [46, 8, 4], cf: C.cfp(0, FLOOR_Y + 16, Z1 + 2), color: [78, 80, 94], material: MAT.Concrete, collide: true, query: true }));
  room.push(part({ name: "LabCeiling", size: [224, 3, 114], cf: C.cfp(0, CEIL_Y + 1.5, -23), color: [58, 60, 72], material: MAT.Concrete, collide: true, query: true }));
  // разметка пола + пятна
  for (const z of [-60, -20, 18]) {
    room.push(S.neonStrip([X0 + 6, FLOOR_Y + 0.12, z], [X1 - 6, FLOOR_Y + 0.12, z], 0.4, [70, 90, 130], { transparency: 0.4 }));
  }
  const rng = S.rng(2024);
  for (let i = 0; i < 10; i++) {
    room.push(deco({ name: "OilStain", size: [S.rr(rng, 6, 18), 0.2, S.rr(rng, 6, 14)], cf: C.cfDeg([S.rr(rng, X0 + 12, X1 - 12), FLOOR_Y + 0.16, S.rr(rng, Z0 + 8, Z1 - 8)], 0, S.rr(rng, 0, 360), 0), color: [28, 28, 34], material: MAT.SmoothPlastic, transparency: 0.35 }));
  }
  // лампы
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) room.push(ceilLamp(X0 + 28 + i * 48, Z0 + 20 + j * 30, 16));
  // трубы под потолком
  room.push(...S.pipeRun([[X0 + 4, CEIL_Y + 5, -50], [X1 - 4, CEIL_Y + 5, -50]], 1.6, [110, 116, 130], { name: "LabPipe" }));
  room.push(...S.pipeRun([[X0 + 4, CEIL_Y + 5.6, -46], [X1 - 4, CEIL_Y + 5.6, -46]], 1.1, [90, 96, 110], { name: "LabPipe" }));
  room.push(...S.pipeRun([[-70, CEIL_Y + 5, -50], [-70, FLOOR_Y + 22, -50], [-70, FLOOR_Y + 22, -30]], 1.1, [70, 255, 150], { name: "FluidPipe", material: MAT.Neon }));
  out.push(K.model({ name: "LabRoom", children: room }));

  // ---------------------------------------------------------------- верстак, стеллаж, инструменты
  const shop = [];
  const bx = -62, bz = -52;
  shop.push(part({ name: "WorkbenchTop", size: [30, 2.4, 10], cf: C.cfp(bx, FLOOR_Y + 8, bz), color: [92, 74, 56], material: MAT.WoodPlanks, collide: true, query: true }));
  shop.push(deco({ name: "WorkbenchShelf", size: [30, 1.2, 9], cf: C.cfp(bx, FLOOR_Y + 4, bz + 0.4), color: [76, 60, 46], material: MAT.WoodPlanks }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    shop.push(deco({ name: "BenchLeg", size: [1.4, 9, 1.4], cf: C.cfp(bx + sx * 13.6, FLOOR_Y + 3.6, bz + sz * 4.2), color: [70, 74, 86], material: MAT.Metal }));
  }
  shop.push(deco({ name: "Toolbox", size: [7, 4, 4], cf: C.cfp(bx - 10, FLOOR_Y + 11.2, bz), color: [186, 60, 50], material: MAT.SmoothPlastic }));
  shop.push(deco({ name: "ToolboxHandle", size: [3.4, 0.6, 1], cf: C.cfp(bx - 10, FLOOR_Y + 13.6, bz), color: [60, 62, 70], material: MAT.Metal }));
  shop.push(deco({ name: "Vise", size: [3.6, 3, 3.2], cf: C.cfp(bx + 11, FLOOR_Y + 10.8, bz - 1), color: [86, 90, 100], material: MAT.Metal }));
  // стеллаж с колбами
  const rackX = bx + 2;
  shop.push(part({ name: "VialRack", size: [22, 14, 1.2], cf: C.cfp(rackX, FLOOR_Y + 15, bz - 5.6), color: [58, 60, 72], material: MAT.Metal, collide: false, query: false, cast: false }));
  const vialColors = [[70, 255, 150], [255, 214, 40], [90, 220, 255], [255, 90, 220], [70, 255, 150], [180, 255, 120]];
  for (let i = 0; i < 6; i++) {
    const y = FLOOR_Y + 10 + Math.floor(i / 3) * 5;
    const x = rackX - 6 + (i % 3) * 6;
    shop.push(cyl({ name: "Vial", size: [3.4, 2.2, 2.2], cf: C.cfDeg([x, y, bz - 5.6], 0, 0, 90), color: vialColors[i], material: MAT.Neon, transparency: 0.1, collide: false, query: false, cast: false, children: [pointLight({ color: [vialColors[i][0] / 255, vialColors[i][1] / 255, vialColors[i][2] / 255], range: 8, brightness: 1.1 })] }));
  }
  // разобранная портальная пушка на верстаке
  const halfGun = CH.portalGun(C.cfMul(C.cfp(bx + 4, FLOOR_Y + 10.6, bz + 0.6), C.cfDeg([0, 0, 0], 0, 118, 0)), { vial: [70, 255, 150] });
  shop.push(...halfGun.parts);
  // доска с чертежом
  shop.push(part({ name: "Blueprint", size: [30, 18, 0.6], cf: C.cfFace([bx, FLOOR_Y + 16, Z0 + 2.6], [0, 0, 1]), color: [16, 40, 70], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  for (let i = 0; i < 7; i++) {
    shop.push(deco({ name: "BlueprintLine", size: [S.rr(rng, 3, 12), 0.4, 0.3], cf: C.cfRelA(C.cfFace([bx, FLOOR_Y + 16, Z0 + 2.3], [0, 0, 1]), S.rr(rng, -12, 12), S.rr(rng, -7, 7), 0, 0, 0, 0), color: [170, 220, 255], material: MAT.Neon, transparency: 0.2 }));
  }
  shop.push(deco({ name: "BlueprintRing", size: [8, 8, 0.3], cf: C.cfRelA(C.cfFace([bx + 6, FLOOR_Y + 18, Z0 + 2.3], [0, 0, 1]), 0, 0, 0, 0, 90, 0), color: [180, 255, 210], material: MAT.Neon, transparency: 0.55, shape: 2 }));
  out.push(K.model({ name: "LabWorkshop", children: shop }));

  // ---------------------------------------------------------------- колба с портальной жидкостью
  const vat = [];
  const vx = -28, vz = -58;
  vat.push(pillar({ name: "FluidTankGlass", size: [24, 16, 16], cf: C.cfp(vx, FLOOR_Y + 12, vz), color: [200, 230, 240], material: MAT.Glass, transparency: 0.62, collide: true, query: true }));
  vat.push(pillar({ name: "FluidTank", size: [20, 13.4, 13.4], cf: C.cfp(vx, FLOOR_Y + 10, vz), color: [70, 255, 150], material: MAT.Neon, transparency: 0.12, collide: false, query: false, cast: false, children: [
    pointLight({ color: [0.3, 1, 0.55], range: 60, brightness: 3.2, shadows: true }),
    emit({ name: "TankBubbles", rate: 26, lifetime: [1.6, 3.2], speed: [1.2, 3.4], size: [[0, 1], [1, 1.8]], transparency: [[0, 0.2], [1, 1]], color: [[0, [0.5, 2.6, 1.1]], [1, [0.1, 0.7, 0.35]]], spread: [180, 180, 0], acceleration: [0, 5, 0], lightEmission: 1, lockedToPart: true }),
    G.pulseGroup(1.2, 0.08, 0.3),
  ] }));
  vat.push(pillar({ name: "TankBase", size: [3, 18, 18], cf: C.cfp(vx, FLOOR_Y + 1.4, vz), color: [96, 100, 112], material: MAT.Metal, collide: true, query: true }));
  vat.push(pillar({ name: "TankTop", size: [3, 18, 18], cf: C.cfp(vx, FLOOR_Y + 22, vz), color: [96, 100, 112], material: MAT.Metal, collide: true, query: true }));
  vat.push(...S.pipeRun([[vx, FLOOR_Y + 22, vz], [vx, CEIL_Y + 4.4, vz], [vx - 42, CEIL_Y + 4.4, vz]], 1.2, [70, 255, 150], { name: "FluidPipe", material: MAT.Neon }));
  vat.push(...S.signPanel(C.cfFace([vx, FLOOR_Y + 16, vz + 12], [0, 0, 1]), { text: "ПОРТАЛЬНАЯ ЖИДКОСТЬ · НЕ ПИТЬ", width: 22, height: 5, color: [20, 24, 14], textColor: [170, 255, 150], depth: 0.6 }));
  out.push(K.model({ name: "LabFluidTank", children: vat }));

  // ---------------------------------------------------------------- летающая тарелка
  const ship = [];
  const sx = 52, sz = -40;
  ship.push(part({ name: "ShipPad", size: [46, 1.6, 46], cf: C.cfp(sx, FLOOR_Y + 0.8, sz), color: [70, 72, 86], material: MAT.DiamondPlate, collide: true, query: true }));
  ship.push(...S.ringXZ(C.cfp(sx, FLOOR_Y + 1.7, sz), { radius: 22, count: 24, thickness: 0.35, depth: 1.2, color: [90, 220, 255], material: MAT.Neon, transparency: 0.3 }));
  ship.push(cyl({ name: "ShipBody", size: [7, 32, 32], cf: C.cfDeg([sx, FLOOR_Y + 14, sz], 0, 0, 90), color: [214, 220, 232], material: MAT.Metal, collide: true, query: true }));
  ship.push(cyl({ name: "ShipSkirt", size: [3.4, 38, 38], cf: C.cfDeg([sx, FLOOR_Y + 11, sz], 0, 0, 90), color: [120, 126, 142], material: MAT.Metal, collide: true, query: true }));
  ship.push(ball({ name: "ShipDome", size: [22, 17, 22], cf: C.cfp(sx, FLOOR_Y + 21, sz), color: [150, 220, 240], material: MAT.Glass, transparency: 0.45, collide: false, query: false, cast: false }));
  ship.push(ball({ name: "ShipCore", size: [12, 9, 12], cf: C.cfp(sx, FLOOR_Y + 19, sz), color: [90, 220, 255], material: MAT.Neon, transparency: 0.25, collide: false, query: false, cast: false, children: [pointLight({ color: [0.5, 0.85, 1], range: 40, brightness: 2.4 }), G.pulseGroup(0.8, 0.15, 0.5)] }));
  ship.push(...S.ringXZ(C.cfp(sx, FLOOR_Y + 12.4, sz), { radius: 17.4, count: 26, thickness: 0.5, depth: 1.4, color: [90, 220, 255], material: MAT.Neon, transparency: 0.15 }));
  for (let i = 0; i < 3; i++) {
    const a = rad(i * 120 + 30);
    ship.push(pillar({ name: "ShipLeg", size: [10, 2.4, 2.4], cf: C.cfp(sx + Math.cos(a) * 15, FLOOR_Y + 5.4, sz + Math.sin(a) * 15), color: [110, 116, 130], material: MAT.Metal, collide: true, query: true }));
    ship.push(ball({ name: "ShipFoot", size: [5, 3, 5], cf: C.cfp(sx + Math.cos(a) * 15, FLOOR_Y + 1.4, sz + Math.sin(a) * 15), color: [80, 84, 96], material: MAT.Rubber, collide: false, query: false, cast: false }));
  }
  ship.push(...S.signPanel(C.cfFace([sx, FLOOR_Y + 26, sz + 20], [0, 0, 1]), { text: "РЕЖИМ «МОРТИ-ПРОТЕСТ» ОТКЛЮЧЁН", width: 24, height: 5, color: [14, 18, 28], textColor: [120, 220, 255], depth: 0.7 }));
  // статичный «луч» под тарелкой
  ship.push(cyl({ name: "ShipBeam", size: [10, 22, 22], cf: C.cfp(sx, FLOOR_Y + 5.6, sz), color: [120, 220, 255], material: MAT.Neon, transparency: 0.86, collide: false, query: false, cast: false }));
  out.push(K.model({ name: "LabShip", children: ship }));

  // ---------------------------------------------------------------- уютный уголок: диван, ТВ, аркада, стол
  const den = [];
  const dx = 40, dz = 8;
  den.push(part({ name: "CouchBase", size: [18, 3.4, 8], cf: C.cfp(dx, FLOOR_Y + 2.4, dz), color: [86, 44, 52], material: MAT.Leather, collide: true, query: true }));
  den.push(part({ name: "CouchBack", size: [18, 5, 2], cf: C.cfp(dx, FLOOR_Y + 5, dz + 4), color: [78, 38, 46], material: MAT.Leather, collide: true, query: true }));
  for (const s of [-1, 1]) den.push(part({ name: "CouchArm", size: [2.4, 4.4, 8], cf: C.cfp(dx + s * 8.6, FLOOR_Y + 3.6, dz), color: [78, 38, 46], material: MAT.Leather, collide: true, query: true }));
  den.push(part({ name: "TVStand", size: [16, 2.4, 6], cf: C.cfp(dx, FLOOR_Y + 4.6, dz - 14), color: [62, 58, 54], material: MAT.WoodPlanks, collide: true, query: true }));
  den.push(part({ name: "TV", size: [20, 12, 1.4], cf: C.cfFace([dx, FLOOR_Y + 11, dz - 16.4], [0, 0, 1]), color: [26, 26, 32], material: MAT.SmoothPlastic, collide: true, query: true }));
  den.push(deco({ name: "TVScreen", size: [18, 10, 0.4], cf: C.cfFace([dx, FLOOR_Y + 11, dz - 17.1], [0, 0, 1]), color: [70, 255, 170], material: MAT.Neon, transparency: 0.25, children: [pointLight({ color: [0.4, 1, 0.6], range: 30, brightness: 1.8 }), G.pulseGroup(2.4, 0.15, 0.55)] }));
  den.push(...S.signPanel(C.cfFace([dx, FLOOR_Y + 12.4, dz - 17.4], [0, 0, 1]), { text: "ПОРТАЛ-ТВ", width: 18, height: 10, color: [0, 0, 0], textColor: [220, 255, 235], depth: 0.2, frame: false }));
  // аркада
  const arc = C.cfFace([dx + 30, FLOOR_Y + 8, dz - 16], [0, 0, 1]);
  den.push(part({ name: "ArcadeBody", size: [7, 16, 5], cf: C.cfRel(arc, 0, 0, 0), color: [40, 44, 70], material: MAT.SmoothPlastic, collide: true, query: true }));
  den.push(deco({ name: "ArcadeScreen", size: [5.4, 4.4, 0.4], cf: C.cfRel(arc, 0, 3.4, -2.6), color: [255, 90, 220], material: MAT.Neon, children: [pointLight({ color: [1, 0.4, 0.9], range: 24, brightness: 1.6 }), G.pulseGroup(3, 0.1, 0.5)] }));
  den.push(deco({ name: "ArcadeMarquee", size: [6.6, 1.8, 0.4], cf: C.cfRel(arc, 0, 6.6, -2.6), color: [90, 220, 255], material: MAT.Neon }));
  den.push(deco({ name: "ArcadePanel", size: [5.6, 0.5, 2.2], cf: C.cfRelA(arc, 0, 1.2, -1.6, 24, 0, 0), color: [60, 64, 84], material: MAT.SmoothPlastic }));
  for (let i = 0; i < 3; i++) {
    den.push(ball({ name: "ArcadeButton", size: [0.5, 0.5, 0.5], cf: C.cfRelA(arc, -1.4 + i * 1.4, 1.6, -2.1, 24, 0, 0), color: [[255, 90, 90], [90, 255, 140], [90, 180, 255]][i], material: MAT.Neon, collide: false, query: false, cast: false }));
  }
  den.push(...S.signPanel(C.cfFace([dx + 30, FLOOR_Y + 17.4, dz - 18.6], [0, 0, 1]), { text: "ПОРТАЛ-МАНИЯ", width: 8, height: 2.4, color: [10, 12, 20], textColor: [255, 120, 230], depth: 0.4, frame: false }));
  // стол с мониторами
  const desk = C.cfFace([dx - 34, FLOOR_Y + 6, dz - 14], [0, 0, 1]);
  den.push(part({ name: "Desk", size: [18, 1.6, 7], cf: C.cfRel(desk, 0, 0, 0), color: [78, 80, 92], material: MAT.Metal, collide: true, query: true }));
  for (let i = 0; i < 3; i++) {
    den.push(part({ name: "Monitor", size: [5.6, 4, 0.5], cf: C.cfRelA(desk, -5.4 + i * 5.4, 3.4, -1.6, 0, -12 + i * 12, 0), color: [28, 30, 38], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
    den.push(deco({ name: "MonitorScreen", size: [5.1, 3.5, 0.2], cf: C.cfRelA(desk, -5.4 + i * 5.4, 3.4, -1.9, 0, -12 + i * 12, 0), color: [90, 220, 255], material: MAT.Neon, transparency: 0.15, children: [G.pulseGroup(1.6 + i * 0.4, 0.1, 0.45)] }));
  }
  den.push(deco({ name: "DeskChair", size: [4, 1, 4], cf: C.cfRel(desk, 0, -1.6, 6), color: [52, 54, 64], material: MAT.Fabric }));
  den.push(deco({ name: "DeskChairBack", size: [4, 5, 0.8], cf: C.cfRel(desk, 0, 1.4, 7.6), color: [52, 54, 64], material: MAT.Fabric }));
  out.push(K.model({ name: "LabDen", children: den }));

  // ---------------------------------------------------------------- мелочи: огурчик, соус, полки, лестница
  const misc = [];
  // огурчик-Рик в банке
  const jx = -84, jz = -60;
  misc.push(pillar({ name: "PickleJarGlass", size: [9, 8, 8], cf: C.cfp(jx, FLOOR_Y + 5.6, jz), color: [210, 235, 245], material: MAT.Glass, transparency: 0.55, collide: true, query: true }));
  misc.push(pillar({ name: "PickleJarJuice", size: [7.6, 6.6, 6.6], cf: C.cfp(jx, FLOOR_Y + 5, jz), color: [150, 220, 120], material: MAT.Neon, transparency: 0.78, collide: false, query: false, cast: false }));
  misc.push(pillar({ name: "PickleBody", size: [7, 3.4, 3.4], cf: C.cfp(jx, FLOOR_Y + 5.4, jz), color: [110, 176, 72], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  misc.push(part({ name: "PickleEye", size: [0.7, 0.7, 0.4], cf: C.cfp(jx - 1.8, FLOOR_Y + 6.2, jz - 1.8), color: [250, 250, 250], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  misc.push(part({ name: "PickleEye", size: [0.7, 0.7, 0.4], cf: C.cfp(jx + 1.8, FLOOR_Y + 6.2, jz - 1.8), color: [250, 250, 250], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  misc.push(part({ name: "PicklePupil", size: [0.3, 0.3, 0.2], cf: C.cfp(jx - 1.8, FLOOR_Y + 6.2, jz - 2.0), color: [20, 20, 24], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  misc.push(part({ name: "PicklePupil", size: [0.3, 0.3, 0.2], cf: C.cfp(jx + 1.8, FLOOR_Y + 6.2, jz - 2.0), color: [20, 20, 24], material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  misc.push(...S.signPanel(C.cfFace([jx, FLOOR_Y + 12, jz + 2], [0, 0, 1]), { text: "Я В БАНКЕ. МНЕ НОРМ.", width: 12, height: 3.4, color: [16, 22, 14], textColor: [190, 255, 160], depth: 0.4, frame: false }));
  // ящик соуса
  misc.push(...S.crate([-58, FLOOR_Y, -30], [7, 6, 7], [140, 96, 52], { band: [200, 60, 40] }));
  misc.push(...S.signPanel(C.cfFace([-58, FLOOR_Y + 8, -26.5], [0, 0, 1]), { text: "СИЧУАНСКИЙ СОУС · 1 ШТ", width: 12, height: 3, color: [40, 18, 12], textColor: [255, 220, 120], depth: 0.4, frame: false }));
  // полки на стене
  for (let i = 0; i < 3; i++) {
    misc.push(deco({ name: "Shelf", size: [26, 0.8, 5], cf: C.cfp(X0 + 16, FLOOR_Y + 8 + i * 6, -30), color: [96, 78, 60], material: MAT.WoodPlanks }));
    for (let j = 0; j < 5; j++) {
      misc.push(cyl({ name: "Jar", size: [3.2, 2.2, 2.2], cf: C.cfDeg([X0 + 7 + j * 4.6, FLOOR_Y + 10.2 + i * 6, -30], 0, 0, 90), color: [[120, 200, 255], [255, 180, 120], [180, 255, 150], [255, 120, 180], [200, 200, 120]][j], material: MAT.Glass, transparency: 0.35, collide: false, query: false, cast: false }));
    }
  }
  // стремянка и антресоль
  misc.push(part({ name: "Mezzanine", size: [70, 1.6, 16], cf: C.cfp(-64, FLOOR_Y + 18, Z0 + 10), color: [86, 88, 100], material: MAT.DiamondPlate, collide: true, query: true }));
  misc.push(...S.railing([-99, FLOOR_Y + 18.8, Z0 + 18], [X0 + 6, FLOOR_Y + 18.8, Z0 + 18], 4.6, [120, 126, 142]));
  misc.push(S.slabBetween([-30, FLOOR_Y + 0.4, Z0 + 22], [-30, FLOOR_Y + 17.2, Z0 + 6], 8, 1.2, { name: "MezzStairs", color: [96, 98, 112], material: MAT.DiamondPlate, collide: true, query: true }));
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    misc.push(deco({ name: "StairStep", size: [8, 0.5, 1.6], cf: C.cfp(-30, FLOOR_Y + 1 + t * 16, Z0 + 22 - t * 16), color: [104, 106, 120], material: MAT.DiamondPlate }));
  }
  for (let i = 0; i < 4; i++) {
    misc.push(...S.crate([X0 + 20 + i * 8, FLOOR_Y + 19, Z0 + 8], [6, 5, 6], i % 2 ? [110, 86, 60] : [86, 96, 110]));
  }
  // робо-рука
  const rx = 8, rz = -44;
  misc.push(...S.pipeRun([[rx, FLOOR_Y + 2, rz], [rx, FLOOR_Y + 12, rz], [rx + 6, FLOOR_Y + 16, rz + 4]], 1.6, [140, 146, 160], { name: "RobotArm", material: MAT.Metal }));
  misc.push(ball({ name: "RobotJoint", size: [3.4, 3.4, 3.4], cf: C.cfp(rx, FLOOR_Y + 12, rz), color: [255, 180, 60], material: MAT.Metal, collide: false, query: false, cast: false }));
  misc.push(ball({ name: "RobotClaw", size: [4, 3, 4], cf: C.cfp(rx + 6, FLOOR_Y + 16, rz + 4), color: [90, 220, 255], material: MAT.Neon, collide: false, query: false, cast: false, children: [pointLight({ color: [0.5, 0.85, 1], range: 20, brightness: 1.4 }), G.pulseGroup(2, 0.1, 0.6)] }));
  out.push(K.model({ name: "LabMisc", children: misc }));

  // ---------------------------------------------------------------- постеры
  const posters = [];
  posters.push(...S.signPanel(C.cfFace([X1 - 3, FLOOR_Y + 14, -40], [-1, 0, 0]), { text: "МЕГА-СЕМЕНА", width: 26, height: 12, color: [30, 60, 24], textColor: [190, 255, 140], depth: 0.6, frameColor: [120, 255, 160] }));
  posters.push(...S.signPanel(C.cfFace([X1 - 3, FLOOR_Y + 12, 6], [-1, 0, 0]), { text: "РИК И МОРТИ · 100 ЛЕТ ПРИКЛЮЧЕНИЙ", width: 24, height: 10, color: [26, 30, 52], textColor: [255, 220, 120], depth: 0.6, frameColor: [255, 200, 80] }));
  posters.push(...S.signPanel(C.cfFace([X0 + 3, FLOOR_Y + 12, 10], [1, 0, 0]), { text: "ПЛАН: НЕ УМИРАТЬ", width: 20, height: 8, color: [46, 20, 20], textColor: [255, 150, 150], depth: 0.6, frameColor: [255, 120, 120] }));
  out.push(K.model({ name: "LabPosters", children: posters }));

  return out;
}

module.exports = { build };
