"use strict";
/*
 * Главные герои на площади: Рик C-137 с Морти, Рик Прайм (со сценой) и Злой Морти.
 * Плюс точка спавна игрока и приветственная стела.
 */
const C = require("../lib/cframe");
const K = require("../lib/kit");
const S = require("../lib/shapes");
const G = require("./groups");
const CH = require("../lib/characters");
const { part, deco, cyl, pillar, pointLight, emit, MAT } = { ...K, ...S };

const rad = (d) => (d * Math.PI) / 180;
const DAIS_Y = 3.4;
const SPAWN = [0, 0, 52]; // точка спавна: перед пандусом в лабораторию, лицом к площади

function build() {
  const out = [];

  // ---------------------------------------------------------------- спавн и стела
  const spawn = [];
  spawn.push({
    className: "SpawnLocation", name: "SpawnLocation",
    properties: {
      Size: K.V3([16, 1, 16]), CFrame: K.CFV ? K.CFV(C.cfp(SPAWN[0], 0.5, SPAWN[2])) : C.CFv(C.cfp(SPAWN[0], 0.5, SPAWN[2])),
      Anchored: true, CanCollide: true, Neutral: true, Enabled: true, Duration: 0, Transparency: 0.15,
      Material: MAT.Neon, Color: K.C3(70, 255, 150), TopSurface: 0, BottomSurface: 0,
    },
  });
  spawn.push(...S.ringXZ(C.cfp(SPAWN[0], 0.62, SPAWN[2]), { radius: 14, count: 24, thickness: 0.4, depth: 1.2, color: [70, 255, 150], material: MAT.Neon, transparency: 0.25 }));
  spawn.push(...S.signPanel(C.cfFace([SPAWN[0], 12, SPAWN[2] + 18], [0, 0, 1]), { text: "ПОРТАЛЬНАЯ СТАНЦИЯ 37-C · ДОБРО ПОЖАЛОВАТЬ", width: 46, height: 9, color: [12, 14, 24], textColor: [120, 255, 180], depth: 1.2 }));
  for (const sx of [-1, 1]) spawn.push(...S.lamp([sx * 28, 0, SPAWN[2] + 18], 14, [120, 255, 180], { range: 46, brightness: 2 }));
  out.push(K.model({ name: "SpawnArea", children: spawn }));

  // ---------------------------------------------------------------- Рик C-137 и Морти
  const rickRig = CH.rig({
    cf: C.cfFace([-26, DAIS_Y, 4], [0.25, 0, 1]),
    name: "Rick", modelName: "NPC_Rick", scale: 1.0,
    displayName: CH.HEROES.rick.displayName, subtitle: CH.HEROES.rick.subtitle, nameColor: CH.HEROES.rick.nameColor, subColor: CH.HEROES.rick.subColor,
    kind: "rick", palette: CH.HEROES.rick.palette, gun: CH.HEROES.rick.gun,
    highlight: null,
  });
  const mortyRig = CH.rig({
    cf: C.cfFace([-18, DAIS_Y, -2], [0.55, 0, 1]),
    name: "Morty", modelName: "NPC_Morty", scale: 0.86,
    displayName: CH.HEROES.morty.displayName, subtitle: CH.HEROES.morty.subtitle, nameColor: CH.HEROES.morty.nameColor, subColor: CH.HEROES.morty.subColor,
    kind: "morty", palette: CH.HEROES.morty.palette, gun: null,
  });
  out.push(K.model({ name: "Heroes_RickAndMorty", children: [rickRig.model, mortyRig.model] }));

  // ---------------------------------------------------------------- сцена Рика Прайма
  const stage = [];
  const SX = 0, SZ = -30;
  stage.push(cyl({ name: "StageBase", size: [1.6, 30, 30], cf: C.cfDeg([SX, DAIS_Y + 0.8, SZ], 0, 0, 90), color: [30, 32, 42], material: MAT.Slate, collide: true, query: true }));
  stage.push(cyl({ name: "StageGlow", size: [0.3, 28, 28], cf: C.cfDeg([SX, DAIS_Y + 1.7, SZ], 0, 0, 90), color: [70, 255, 150], material: MAT.Neon, transparency: 0.35, collide: false, query: false, cast: false, children: [G.pulseGroup(0.7, 0.2, 0.6)] }));
  stage.push(S.slabBetween([SX - 15, DAIS_Y + 2, SZ + 12], [SX - 26, DAIS_Y + 2, SZ + 28], 4, 4, { name: "StagePylon", color: [40, 44, 58], material: MAT.Metal, collide: false, query: false, cast: false }));
  stage.push(S.slabBetween([SX + 15, DAIS_Y + 2, SZ + 12], [SX + 26, DAIS_Y + 2, SZ + 28], 4, 4, { name: "StagePylon", color: [40, 44, 58], material: MAT.Metal, collide: false, query: false, cast: false }));
  // прожекторы
  for (const sx of [-1, 1]) {
    stage.push(...S.lamp([SX + sx * 20, DAIS_Y + 1.6, SZ - 12], 20, [70, 255, 150], { range: 60, brightness: 3 }));
  }
  // вывеска сцены
  stage.push(...S.signPanel(C.cfFace([SX, DAIS_Y + 20, SZ - 16], [0, 0, 1]), { text: "РИК ПРАЙМ · ОРИГИНАЛ", width: 40, height: 9, color: [10, 14, 12], textColor: [130, 255, 160], depth: 1.2, frameColor: [70, 255, 150] }));
  // напольный чертёж-обод вокруг сцены
  stage.push(...S.ringXZ(C.cfp(SX, DAIS_Y + 0.2, SZ), { radius: 22, count: 30, thickness: 0.4, depth: 1.4, color: [70, 255, 150], material: MAT.Neon, transparency: 0.35 }));
  stage.push(deco({
    name: "StageLight", size: [1, 1, 1], cf: C.cfp(SX, DAIS_Y + 6, SZ), color: [120, 255, 170], material: MAT.Neon, transparency: 1,
    children: [
      pointLight({ color: [0.35, 1, 0.6], range: 70, brightness: 3 }),
      emit({ name: "StageDust", texture: "rbxasset://textures/particles/sparkles_main.dds", rate: 18, lifetime: [2, 4], speed: [0.5, 2], size: [[0, 0.6], [1, 0]], transparency: [[0, 0.5], [1, 1]], color: [[0, [0.6, 2.4, 1.1]], [1, [0, 0, 0]]], spread: [180, 180, 0], acceleration: [0, 1.6, 0], rotSpeed: [-60, 60], lightEmission: 1 }),
    ],
  }));
  const rickPrime = CH.rig({
    cf: C.cfFace([SX, DAIS_Y + 1.6, SZ], [0, 0, 1]),
    name: "RickPrime", modelName: "NPC_RickPrime", scale: 1.04,
    displayName: CH.HEROES.rickprime.displayName, subtitle: CH.HEROES.rickprime.subtitle, nameColor: CH.HEROES.rickprime.nameColor, subColor: CH.HEROES.rickprime.subColor,
    kind: "rickprime", palette: CH.HEROES.rickprime.palette, gun: CH.HEROES.rickprime.gun, highlight: CH.HEROES.rickprime.highlight,
    light: CH.HEROES.rickprime.light,
  });
  out.push(K.model({ name: "Heroes_RickPrime", children: stage.concat([rickPrime.model]) }));

  // ---------------------------------------------------------------- Злой Морти
  const evStage = [];
  const EX = 26, EZ = 8;
  evStage.push(cyl({ name: "EvilPodium", size: [1.4, 22, 22], cf: C.cfDeg([EX, DAIS_Y + 0.7, EZ], 0, 0, 90), color: [26, 28, 38], material: MAT.Slate, collide: true, query: true }));
  evStage.push(cyl({ name: "EvilPodiumGlow", size: [0.3, 20.6, 20.6], cf: C.cfDeg([EX, DAIS_Y + 1.5, EZ], 0, 0, 90), color: [255, 214, 40], material: MAT.Neon, transparency: 0.4, collide: false, query: false, cast: false, children: [G.pulseGroup(0.9, 0.2, 0.65)] }));
  // трибуна с документами
  evStage.push(part({ name: "Podium", size: [4.4, 5.4, 3], cf: C.cfRelA(C.cfFace([EX - 5, DAIS_Y + 4.4, EZ], [-1, 0, 0.6]), 0, 0, 0, 0, 0, 0), color: [58, 52, 40], material: MAT.WoodPlanks, collide: true, query: true }));
  evStage.push(deco({ name: "PodiumPaper", size: [3.6, 0.2, 2.2], cf: C.cfRel(C.cfFace([EX - 5, DAIS_Y + 7.2, EZ], [-1, 0, 0.6]), 0, 0, 0), color: [240, 240, 236], material: MAT.SmoothPlastic }));
  evStage.push(...S.signPanel(C.cfFace([EX, DAIS_Y + 18, EZ - 12], [-0.6, 0, -1]), { text: "ЗЛОЙ МОРТИ · ПРЕЗИДЕНТ ЦИТАДЕЛИ", width: 38, height: 8, color: [18, 16, 8], textColor: [255, 226, 90], depth: 1.1, frameColor: [255, 214, 40] }));
  for (const sx of [-1, 1]) evStage.push(...S.lamp([EX + sx * 16, DAIS_Y + 1.4, EZ + 10], 16, [255, 214, 40], { range: 50, brightness: 2.4 }));
  const evilMorty = CH.rig({
    cf: C.cfFace([EX, DAIS_Y + 1.4, EZ], [-0.2, 0, 1]),
    name: "EvilMorty", modelName: "NPC_EvilMorty", scale: 0.9,
    displayName: CH.HEROES.evilmorty.displayName, subtitle: CH.HEROES.evilmorty.subtitle, nameColor: CH.HEROES.evilmorty.nameColor, subColor: CH.HEROES.evilmorty.subColor,
    kind: "evilmorty", palette: CH.HEROES.evilmorty.palette, gun: CH.HEROES.evilmorty.gun, highlight: CH.HEROES.evilmorty.highlight,
  });
  out.push(K.model({ name: "Heroes_EvilMorty", children: evStage.concat([evilMorty.model]) }));

  return out;
}

module.exports = { build };
