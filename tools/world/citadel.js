"use strict";
/*
 * ЗОНА 3 — «ЦИТАДЕЛЬ РИКОВ»: парадная площадь, зал Совета с куполом,
 * голографическая галактика, статуя Рика-первооткрывателя, сторожевые башни.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const P = require("./portals");
const G = require("./groups");
const CH = require("../lib/characters");
const { part, deco, cyl, ball, pillar, pointLight, spotLight, emit, MAT, banner } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;
const CZ = -380;
const HALL = { x: 0, z: -452, w: 176, d: 150, wall: 36 };
const hallFloorY = 3.6;

/** Сторожевая башня с прожектором */
function watchtower(pos, h) {
  const out = [];
  out.push(pillar({ name: "TowerShaft", size: [h, 9, 9], cf: C.cfp(pos[0], pos[1] + h / 2, pos[2]), color: [172, 176, 192], material: MAT.Marble, collide: true, query: true }));
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90 + 45);
    out.push(pillar({ name: "TowerRib", size: [h * 0.94, 1.4, 1.4], cf: C.cfp(pos[0] + Math.cos(a) * 5, pos[1] + h / 2, pos[2] + Math.sin(a) * 5), color: [120, 126, 146], material: MAT.Metal, collide: false, query: false, cast: false }));
  }
  out.push(cyl({ name: "TowerTop", size: [4.4, 16, 16], cf: C.cfDeg([pos[0], pos[1] + h + 2, pos[2]], 0, 0, 90), color: [196, 200, 214], material: MAT.Marble, collide: true, query: true }));
  out.push(cyl({ name: "TowerGlow", size: [0.5, 16.4, 16.4], cf: C.cfDeg([pos[0], pos[1] + h, pos[2]], 0, 0, 90), color: [90, 220, 255], material: MAT.Neon, transparency: 0.2, collide: false, query: false, cast: false }));
  out.push(part({
    name: "SearchLight", size: [2.6, 2.6, 6], cf: C.cfDeg([pos[0], pos[1] + h + 5, pos[2]], 32, 0, 0), color: [222, 228, 240], material: MAT.Metal, collide: false, query: false, cast: false,
    children: [
      spotLight({ color: [0.7, 0.92, 1], range: 320, brightness: 4, angle: 42, face: 0, shadows: false }),
      pointLight({ color: [0.7, 0.92, 1], range: 30, brightness: 3 }),
    ],
  }));
  return out;
}

function build() {
  const out = [];

  // ---------------------------------------------------------------- площадь
  const plaza = [
    part({ name: "CitadelPlaza", size: [400, 6, 400], cf: C.cfp(0, -2.6, CZ), color: [186, 190, 206], material: MAT.Marble, collide: true, query: true }),
  ];
  const rng = S.rng(31337);
  // тёмные вставки-кольца
  for (const r of [40, 78, 118, 160]) {
    plaza.push(...S.ringXZ(C.cfp(0, 0.25, CZ), { radius: r, count: Math.round((2 * Math.PI * r) / 14), thickness: 0.3, depth: 2.6, color: [86, 92, 116], material: MAT.Slate, transparency: 0.1 }));
  }
  // парадная аллея к залу
  plaza.push(S.slabBetween([0, 0.5, CZ + 210], [0, hallFloorY, CZ - 118], 40, 1.4, { name: "Avenue", color: [206, 210, 226], material: MAT.Marble, collide: true, query: true }));
  for (const r of [66, 92, 130]) {
    plaza.push(...S.ringXZ(C.cfp(0, 0.3, CZ), { radius: r, count: Math.round((2 * Math.PI * r) / 30), thickness: 0.25, depth: 1.4, color: [90, 220, 255], material: MAT.Neon, transparency: 0.55 }));
  }
  plaza.push(cyl({ name: "Medallion", size: [0.6, 52, 52], cf: C.cfp(0, 0.6, CZ + 40), color: [198, 168, 96], material: MAT.Metal, collide: false, query: false, cast: false }));
  plaza.push(cyl({ name: "MedallionGlow", size: [0.4, 40, 40], cf: C.cfp(0, 0.95, CZ + 40), color: [90, 220, 255], material: MAT.Neon, transparency: 0.45, collide: false, query: false, cast: false, children: [G.pulseGroup(0.5, 0.35, 0.7)] }));
  // фонарные ряды
  for (let i = 0; i < 7; i++) {
    for (const sx of [-1, 1]) {
      plaza.push(...S.column([sx * 30, 0, CZ + 190 - i * 34], 16, 1.3, { color: [206, 210, 226], trim: [140, 146, 164], glow: [90, 220, 255] }));
      plaza.push(...S.lamp([sx * 30, 16, CZ + 190 - i * 34], 6, [120, 220, 255], { range: 46, brightness: 2 }));
    }
  }
  // сторожевые башни
  plaza.push(...watchtower([-150, 0, CZ + 120], 46));
  plaza.push(...watchtower([150, 0, CZ + 120], 46));
  plaza.push(...watchtower([-150, 0, CZ - 40], 40));
  plaza.push(...watchtower([150, 0, CZ - 40], 40));
  out.push(K.model({ name: "CitadelPlaza", children: plaza }));

  // ---------------------------------------------------------------- зал Совета
  const hall = [];
  const hw = HALL.w / 2, hd = HALL.d / 2, wl = HALL.wall;
  const HX = HALL.x, HZ = HALL.z;
  // пол зала (приподнят)
  hall.push(part({ name: "HallFloor", size: [HALL.w + 24, 3.6, HALL.d + 24], cf: C.cfp(HX, hallFloorY - 1.8, HZ), color: [212, 214, 226], material: MAT.Marble, collide: true, query: true }));
  hall.push(part({ name: "HallInlay", size: [HALL.w - 20, 0.5, HALL.d - 20], cf: C.cfp(HX, hallFloorY + 0.2, HZ), color: [70, 74, 96], material: MAT.Slate, collide: false, query: false, cast: false }));
  hall.push(...S.ringXZ(C.cfp(HX, hallFloorY + 0.5, HZ), { radius: 60, count: 36, thickness: 0.3, depth: 2, color: [198, 168, 96], material: MAT.Metal, transparency: 0.1 }));
  // ступени ко входу
  for (let i = 0; i < 3; i++) {
    hall.push(part({ name: "HallStep", size: [64 + i * 8, 1.4, 7], cf: C.cfp(HX, hallFloorY - 0.7 - i * 1.3, HZ + hd + 12 + i * 6), color: [200, 204, 218], material: MAT.Marble, collide: true, query: true }));
  }
  // стены
  const wallSeg = (cf, w) => part({ name: "HallWall", size: [w, wl, 4], cf, color: [204, 208, 222], material: MAT.Marble, collide: true, query: true });
  for (let i = 0; i < 6; i++) {
    const w = HALL.w / 6;
    hall.push(wallSeg(C.cfp(HX - hw + w / 2 + i * w, hallFloorY + wl / 2, HZ - hd), w - 0.2));
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const w = HALL.d / 5;
      const cf = C.cfMul(C.cfp(HX + sx * hw, hallFloorY + wl / 2, HZ - hd + w / 2 + i * w), C.cfA([0, 0, 0], 0, sx * Math.PI / 2, 0));
      hall.push(wallSeg(cf, w - 0.2));
    }
  }
  // южная стена с проёмом
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = (HALL.w - 40) / 6;
      hall.push(wallSeg(C.cfp(HX + sx * (20 + w / 2 + i * w), hallFloorY + wl / 2, HZ + hd), w - 0.2));
    }
  }
  hall.push(part({ name: "HallLintel", size: [44, 10, 4], cf: C.cfp(HX, hallFloorY + wl - 5, HZ + hd), color: [204, 208, 222], material: MAT.Marble, collide: true, query: true }));
  // колонны внутри и снаружи
  for (let i = 0; i < 8; i++) {
    const x = HX - hw + 16 + i * ((HALL.w - 32) / 7);
    hall.push(...S.column([x, hallFloorY - 3.6, HZ - hd + 10], 34, 1.8, { color: [216, 218, 230], trim: [150, 154, 172], glow: i % 2 ? [198, 168, 96] : null }));
    hall.push(...S.column([x, hallFloorY - 3.6, HZ + hd - 12], 34, 1.8, { color: [216, 218, 230], trim: [150, 154, 172], glow: i % 2 ? null : [198, 168, 96] }));
  }
  // купол
  hall.push(...S.dome(C.cfp(HX, hallFloorY + wl, HZ), { radius: 92, rings: 6, segs: 26, color: [196, 200, 216], material: MAT.Metal, thickness: 1.5, collide: true, query: true }));
  hall.push(cyl({ name: "DomeEye", size: [6, 26, 26], cf: C.cfDeg([HX, hallFloorY + wl + 92, HZ], 0, 0, 90), color: [120, 210, 255], material: MAT.Glass, transparency: 0.35, collide: false, query: false, cast: false }));
  // свет в зале
  for (let i = 0; i < 6; i++) {
    const a = rad(i * 60 + 30), r = 52;
    hall.push(deco({ name: "HallLamp", size: [3.4, 1.2, 3.4], cf: C.cfp(HX + Math.cos(a) * r, hallFloorY + 30, HZ + Math.sin(a) * r), color: [255, 238, 200], material: MAT.Neon, children: [pointLight({ color: [1, 0.95, 0.82], range: 60, brightness: 2.6 })] }));
    hall.push(cylBetweenLocalPoint([HX + Math.cos(a) * r, hallFloorY + wl + 52, HZ + Math.sin(a) * r], [HX + Math.cos(a) * r, hallFloorY + 30, HZ + Math.sin(a) * r]));
  }
  out.push(K.model({ name: "CouncilHall", children: hall }));

  // ---------------------------------------------------------------- стол Совета + галактика
  const council = [];
  const tableY = hallFloorY + 4;
  council.push(cyl({ name: "CouncilTable", size: [3.4, 54, 54], cf: C.cfDeg([HX, tableY, HZ], 0, 0, 90), color: [64, 48, 40], material: MAT.WoodPlanks, collide: true, query: true }));
  council.push(cyl({ name: "CouncilTableTop", size: [1.2, 58, 58], cf: C.cfDeg([HX, tableY + 2.2, HZ], 0, 0, 90), color: [30, 32, 44], material: MAT.Slate, collide: true, query: true }));
  council.push(cyl({ name: "CouncilTableGlow", size: [0.4, 46, 46], cf: C.cfDeg([HX, tableY + 3, HZ], 0, 0, 90), color: [90, 220, 255], material: MAT.Neon, transparency: 0.35, collide: false, query: false, cast: false, children: [G.pulseGroup(0.8, 0.25, 0.6)] }));
  // стулья
  for (let i = 0; i < 20; i++) {
    const a = rad((i / 20) * 360);
    const x = HX + Math.cos(a) * 38, z = HZ + Math.sin(a) * 38;
    const cf = C.cfFace([x, hallFloorY + 3, z], [-Math.cos(a), 0, -Math.sin(a)]);
    council.push(part({ name: "Chair", size: [3.2, 0.5, 3.2], cf, color: [84, 62, 50], material: MAT.Leather, collide: true, query: true }));
    council.push(deco({ name: "ChairBack", size: [3.2, 4.4, 0.6], cf: C.cfRel(cf, 0, 2.2, 1.4), color: [70, 52, 42], material: MAT.Leather }));
    council.push(deco({ name: "ChairLeg", size: [1.4, 3, 1.4], cf: C.cfRel(cf, 0, -1.6, 0), color: [110, 116, 132], material: MAT.Metal }));
  }
  // голографическая галактика
  council.push(deco({ name: "HoloPivot", size: [0.2, 0.2, 0.2], cf: C.cfp(HX, tableY + 26, HZ), transparency: 1, ref: K.nextRef(), collide: false, query: false, cast: false }));
  council.push(cyl({ name: "HoloDisc", size: [0.6, 40, 40], cf: C.cfp(HX, tableY + 26, HZ), color: [120, 210, 255], material: MAT.Neon, transparency: 0.72, collide: false, query: false, cast: false }));
  council.push(ball({ name: "HoloCore", size: [10, 10, 10], cf: C.cfp(HX, tableY + 26, HZ), color: [220, 245, 255], material: MAT.Neon, transparency: 0.3, collide: false, query: false, cast: false }));
  for (let i = 0; i < 5; i++) {
    const cf = C.cfDeg([HX, tableY + 26, HZ], S.rr(rng, -80, 80), S.rr(rng, 0, 360), S.rr(rng, -80, 80));
    council.push(...S.ringYZ(cf, { name: "HoloRing", radius: 10 + i * 4.2, count: 14 + i * 3, size: [2.6, 0.4, 0.6], color: i % 2 ? [120, 210, 255] : [198, 168, 96], material: MAT.Neon, transparency: 0.45 }));
  }
  council.push(deco({ name: "HoloGlow", size: [1, 1, 1], cf: C.cfp(HX, tableY + 26, HZ), color: [150, 220, 255], material: MAT.Neon, transparency: 1, children: [pointLight({ color: [0.55, 0.85, 1], range: 100, brightness: 3.4 }), emit({ name: "HoloStars", rate: 34, lifetime: [2, 4], speed: [0.4, 2], size: [[0, 1.2], [1, 0.2]], transparency: [[0, 0.2], [1, 1]], color: [[0, [1.4, 2.6, 3.2]], [1, [0, 0, 0]]], spread: [180, 180, 0], rotSpeed: [-60, 60], lightEmission: 1, acceleration: [0, 1.2, 0] })] }));
  // модели галактики
  const galaxy = K.model({ name: "HoloGalaxy", children: [] });
  const galaxyPivot = K.nextRef();
  galaxy.children.push(deco({ name: "SpinPivot", size: [0.2, 0.2, 0.2], cf: C.cfp(HX, tableY + 26, HZ), transparency: 1, ref: galaxyPivot, collide: false, query: false, cast: false }));
  for (let i = 0; i < 4; i++) {
    galaxy.children.push(cyl({ name: "GalaxyDisc", size: [0.3, 44 - i * 9, 44 - i * 9], cf: C.cfDeg([HX, tableY + 26, HZ], 0, 0, 18 * i), color: i % 2 ? [180, 140, 255] : [120, 210, 255], material: MAT.Neon, transparency: 0.85 - i * 0.06, collide: false, query: false, cast: false }));
  }
  galaxy.children.push(G.spinGroup(7, [0.2, 0.4, 0.1]));
  council.push(galaxy);
  // флаги-баннеры зала
  for (let i = 0; i < 6; i++) {
    const x = HX - hw + 22 + i * ((HALL.w - 44) / 5);
    council.push(...banner(C.cfFace([x, hallFloorY + 26, HZ - hd + 6], [0, 0, 1]), { width: 10, height: 22, color: [30, 42, 74], emblem: [198, 168, 96] }));
  }
  out.push(K.model({ name: "CouncilTable", children: council }));

  // ---------------------------------------------------------------- статуя
  const statueBase = [];
  statueBase.push(part({ name: "StatuePedestal", size: [30, 10, 30], cf: C.cfp(HX, hallFloorY + 5, HZ - hd + 30), color: [190, 194, 208], material: MAT.Marble, collide: true, query: true }));
  statueBase.push(part({ name: "StatuePedestalTop", size: [34, 1.6, 34], cf: C.cfp(HX, hallFloorY + 10.6, HZ - hd + 30), color: [198, 168, 96], material: MAT.Metal, collide: true, query: true }));
  statueBase.push(...S.signPanel(C.cfFace([HX, hallFloorY + 4, HZ - hd + 45.2], [0, 0, 1]), { text: "РИК · ПЕРВООТКРЫВАТЕЛЬ ПОРТАЛОВ", width: 26, height: 5.4, color: [24, 26, 38], textColor: [198, 220, 255], depth: 0.8, frameColor: [198, 168, 96] }));
  const statue = CH.rig({
    cf: C.cfMul(C.cfp(HX, hallFloorY + 11.4, HZ - hd + 30), C.cfDeg([0, 0, 0], 0, 180, 0)),
    name: "Statue_Rick", modelName: "Statue_Rick", scale: 4.6, statue: true, statueColor: [198, 172, 104],
    palette: { skin: [240, 226, 200], coat: [200, 210, 226], pants: [150, 130, 96], hair: [210, 216, 220], shoe: [120, 100, 70], unibrow: true, labCoat: true, eyeWhite: [255, 255, 255], pupil: [40, 40, 44] },
    gun: { vial: [140, 255, 190] },
  });
  statue.model.name = "Statue_Rick";
  // зелёный портал над дулом статуи
  const statuePortalCF = C.cfNorm([HX, hallFloorY + 11.4 + 22.3 * 4.6, HZ - hd + 30 - 3 * 4.6], [0, 0, 1], [0, 1, 0]);
  out.push(P.staticPortal({ name: "Portal_Statue", cf: statuePortalCF, radius: 9, palette: "green", frame: false }));
  out.push(K.model({ name: "StatueBase", children: statueBase }));
  out.push(statue.model);

  // ---------------------------------------------------------------- делегаты Совета
  const delegates = [];
  for (let i = 0; i < 12; i++) {
    const a = rad((i / 12) * 360 + 8);
    const r = 46;
    const x = HX + Math.cos(a) * r, z = HZ + Math.sin(a) * r;
    const rig = CH.councilRick("CouncilRick" + (i + 1), C.cfFace([x, hallFloorY, z], [-Math.cos(a), 0, -Math.sin(a)]), i);
    delegates.push(rig.model);
  }
  out.push(K.model({ name: "CouncilDelegates", children: delegates }));

  // ---------------------------------------------------------------- вывески, портал возврата, стража
  const rest = [];
  rest.push(...S.signPanel(C.cfFace([0, 44, CZ + 208], [0, 0, 1]), { text: "ЦИТАДЕЛЬ РИКОВ · ЗАЛ СОВЕТА", width: 76, height: 14, color: [16, 20, 34], textColor: [198, 220, 255], depth: 1.8, frameColor: [198, 168, 96] }));
  rest.push(...S.signPanel(C.cfFace([HX, hallFloorY + 22, HZ + hd + 4.4], [0, 0, 1]), { text: "СЕССИЯ № 37-C · ЗАСЕДАНИЕ ИДЁТ", width: 40, height: 8, color: [18, 20, 32], textColor: [120, 210, 255], depth: 1 }));
  const portalCF = C.cfNorm([0, 13.5, CZ + 168], [0, 0, 1], [0, 1, 0]);
  rest.push(P.staticPortal({ name: "Portal_Citadel_Return", cf: portalCF, radius: 11, palette: "cyan", linkTo: "Portal_Hub_Citadel" }));
  rest.push(K.model({ name: "Dais_Portal_Citadel_Return", children: P.portalDais(portalCF, { radius: 11, glow: [90, 220, 255] }) }));
  rest.push(...S.signPanel(C.cfFace([0, 31, CZ + 170], [0, 0, -1]), { text: "↓ НАЗАД НА СТАНЦИЮ", width: 30, height: 7, color: [14, 16, 26], textColor: [120, 220, 255], depth: 1.1 }));
  for (const sx of [-1, 1]) rest.push(...S.lamp([sx * 22, 3.5, CZ + 168], 12, [90, 220, 255], { range: 40, brightness: 1.8 }));
  // охрана у входа
  for (const sx of [-1, 1]) {
    const rig = CH.rig({
      cf: C.cfFace([sx * 26, hallFloorY + 0.2, HZ + hd + 16], [-sx, 0, -1]), name: "Guard_Rick" + sx, modelName: "NPC_Guard_Rick", scale: 1.02,
      displayName: "СТРАЖ СОВЕТА", subtitle: "не морти", nameColor: [190, 220, 255], subColor: [150, 190, 230], kind: "guard",
      palette: { skin: [246, 226, 205], coat: [70, 96, 150], pants: [64, 72, 96], hair: [200, 205, 210], shoe: [40, 42, 50], eyeWhite: [250, 250, 255], pupil: [28, 28, 32], unibrow: true, labCoat: true, mouthW: 0.42 },
      gun: { vial: [120, 220, 255] },
    });
    rest.push(rig.model);
  }
  out.push(K.model({ name: "CitadelRest", children: rest }));

  return out;
}

/** Тонкий тросик от потолка к лампе (упрощённо: вертикальный цилиндр) */
function cylBetweenLocalPoint(a, b) {
  return cyl({ name: "HallCable", size: [Math.abs(b[1] - a[1]), 0.3, 0.3], cf: C.cfDeg([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], 0, 0, 90), color: [60, 62, 74], material: MAT.Metal, collide: false, query: false, cast: false });
}

module.exports = { build };
