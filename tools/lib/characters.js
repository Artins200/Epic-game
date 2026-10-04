"use strict";
/*
 * Портальная пушка (модель из деталей) и R6-риги персонажей
 * (Рик, Рик Прайм, Злой Морти, Морти, члены Совета Риков).
 */
const C = require("./cframe");
const K = require("./kit");
const { part, deco, ball, cyl, pillar, wedge, weldC, pointLight, emit, MAT, C3, C3f } = K;
const rad = (d) => (d * Math.PI) / 180;

// ================================================================ ПОРТАЛЬНАЯ ПУШКА
/**
 * Строит портальную пушку. Начало координат — точка хвата, ствол смотрит по -Z.
 * Возвращает { parts, refs: { handle, muzzle, vial } } — все детали уже с referent'ами.
 */
function portalGun(base, o = {}) {
  const vial = o.vial || [70, 255, 150];
  const vialHot = [vial[0] / 255, vial[1] / 255, vial[2] / 255];
  const shell = o.shell || [238, 240, 245];
  const dark = o.dark || [56, 58, 66];
  const P = (name, size, loc, props = {}) =>
    part(Object.assign({ name, size, cf: C.cfRel(base, loc[0], loc[1], loc[2]), ref: true, collide: false, query: false, cast: false }, props));
  const PA = (name, size, loc, rot, props = {}) =>
    part(Object.assign({ name, size, cf: C.cfRelA(base, loc[0], loc[1], loc[2], rad(rot[0]), rad(rot[1]), rad(rot[2])), ref: true, collide: false, query: false, cast: false }, props));

  const parts = [];
  const handle = P("Handle", [0.3, 0.3, 0.3], [0, -0.35, 0], { transparency: 1, material: MAT.SmoothPlastic });
  parts.push(handle);

  // рукоять + спуск
  parts.push(PA("Grip", [0.46, 1.05, 0.52], [0, -0.62, 0.06], [10, 0, 0], { color: dark, material: MAT.Rubber }));
  parts.push(P("Trigger", [0.2, 0.34, 0.24], [0, -0.32, -0.24], { color: [214, 66, 66], material: MAT.SmoothPlastic }));
  parts.push(P("TriggerGuard", [0.44, 0.12, 0.7], [0, -0.52, -0.24], { color: [92, 96, 106], material: MAT.Metal }));

  // корпус
  parts.push(P("Body", [0.98, 1.06, 2.5], [0, 0.5, -1.02], { color: shell, material: MAT.SmoothPlastic }));
  parts.push(P("RailLow", [0.62, 0.28, 1.7], [0, -0.12, -0.85], { color: [148, 154, 166], material: MAT.Metal }));
  parts.push(P("RearCap", [1.02, 1.0, 0.5], [0, 0.5, 0.35], { color: [178, 184, 196], material: MAT.Metal }));
  for (const s of [-1, 1]) {
    parts.push(P("Vent", [0.14, 0.55, 1.0], [s * 0.52, 0.55, -1.0], { color: [124, 130, 142], material: MAT.Metal }));
    parts.push(P("Greeble", [0.3, 0.22, 0.4], [s * 0.55, 0.16, -1.5], { color: [96, 100, 110], material: MAT.Metal }));
  }

  // «нос» и дуло
  parts.push(ball({ name: "Nose", size: [1.14, 1.14, 1.14], cf: C.cfRel(base, 0, 0.5, -2.22), ref: true, color: shell, material: MAT.SmoothPlastic, collide: false, query: false, cast: false }));
  parts.push(cyl({ name: "MuzzleRing", size: [0.36, 1.2, 1.2], cf: C.cfRelA(base, 0, 0.5, -2.42, 0, 90, 0), ref: true, color: vial, material: MAT.Neon, transparency: 0.15, collide: false, query: false, cast: false }));
  const core = ball({
    name: "Muzzle", size: [0.66, 0.66, 0.66], cf: C.cfRel(base, 0, 0.5, -2.56), ref: true,
    color: vial, material: MAT.Neon, collide: false, query: false, cast: false,
    children: [
      pointLight({ color: [vialHot[0] * 1.6, vialHot[1] * 1.6, vialHot[2] * 1.6], range: 16, brightness: 2.6 }),
      emit({
        name: "MuzzleSparks", rate: 14, lifetime: [0.3, 0.8], speed: [2, 6], size: [[0, 0.9], [1, 0]],
        transparency: [[0, 0.2], [1, 1]], color: [[0, [vialHot[0] * 2, vialHot[1] * 2, vialHot[2] * 2]], [1, [vialHot[0], vialHot[1], vialHot[2]]]],
        spread: [40, 40, 0], rotSpeed: [-120, 120], zOffset: 1, acceleration: [0, -8, 0], lightEmission: 1,
      }),
    ],
  });
  parts.push(core);
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90 + 45);
    parts.push(PA("Prong", [0.22, 0.22, 1.05], [Math.cos(a) * 0.62, 0.5 + Math.sin(a) * 0.62, -2.2], [0, 0, i * 90 + 45], { color: [78, 82, 92], material: MAT.Metal }));
  }

  // колба с портальной жидкостью
  parts.push(cyl({ name: "Vial", size: [1.8, 0.78, 0.78], cf: C.cfRelA(base, 0, 1.32, -1.0, 0, 90, 0), ref: true, color: vial, material: MAT.Neon, transparency: 0.08, collide: false, query: false, cast: false }));
  parts.push(cyl({ name: "VialGlass", size: [1.92, 0.95, 0.95], cf: C.cfRelA(base, 0, 1.32, -1.0, 0, 90, 0), ref: true, color: [214, 232, 240], material: MAT.Glass, transparency: 0.6, reflectance: 0.15, collide: false, query: false, cast: false }));
  for (const z of [-0.04, -1.96]) {
    parts.push(cyl({ name: "VialCap", size: [0.24, 0.98, 0.98], cf: C.cfRelA(base, 0, 1.32, z, 0, 90, 0), ref: true, color: [84, 88, 98], material: MAT.Metal, collide: false, query: false, cast: false }));
  }
  parts.push(cylBetweenLocal(base, [0, 1.05, -0.12], [0, 1.28, -0.55], 0.26, { name: "VialFeed", ref: true, color: [64, 68, 78], material: MAT.Metal }));
  parts.push(cylBetweenLocal(base, [0, 1.05, -1.9], [0, 1.24, -1.45], 0.26, { name: "VialFeed", ref: true, color: [64, 68, 78], material: MAT.Metal }));

  // антенна-излучатель
  parts.push(cylBetweenLocal(base, [0, 1.16, 0.1], [0.0, 1.85, -0.35], 0.16, { name: "Antenna", ref: true, color: [96, 100, 110], material: MAT.Metal }));
  parts.push(ball({
    name: "AntennaTip", size: [0.34, 0.34, 0.34], cf: C.cfRel(base, 0, 1.9, -0.4), ref: true,
    color: vial, material: MAT.Neon, collide: false, query: false, cast: false,
    children: [pointLight({ color: [vialHot[0] * 1.4, vialHot[1] * 1.4, vialHot[2] * 1.4], range: 10, brightness: 1.6 })],
  }));
  for (const s of [-1, 1]) {
    parts.push(cylBetweenLocal(base, [s * 0.34, 0.5, -0.35], [s * 0.34, 1.24, -0.9], 0.12, { name: "Wire", ref: true, color: [38, 40, 48], material: MAT.Rubber }));
  }

  const byName = {};
  for (const p of parts) byName[p.name] = byName[p.name] ? byName[p.name] : p.referent;
  return { parts, refs: { handle: handle.referent, muzzle: core.referent, vial: parts[3].referent }, byName, core };
}

/** Цилиндр между двумя точками в локальных координатах пушки */
function cylBetweenLocal(base, a, b, d, o = {}) {
  const wa = C.cfRel(base, a[0], a[1], a[2]).pos;
  const wb = C.cfRel(base, b[0], b[1], b[2]).pos;
  const spec = K.cylBetween(wa, wb, d, { collide: false, query: false, cast: false, material: MAT.Metal });
  Object.assign(spec, { name: o.name }, o);
  if (o.ref) spec.referent = K.nextRef();
  return spec;
}

// ================================================================ R6-РИГ
/**
 * Собирает человекоподобный риг (R6) с лицом, причёской, одеждой и (опционально) пушкой.
 * base — CFrame уровня пола (ноги на Y=0 по локальной оси).
 */
function rig(o) {
  const s = o.scale || 1;
  const base = o.cf;
  const pal = o.palette || {};
  const skin = pal.skin || [246, 226, 205];
  const coat = pal.coat || [178, 219, 240];
  const pants = pal.pants || [116, 96, 68];
  const hair = pal.hair || [186, 214, 236];
  const shoe = pal.shoe || [66, 50, 38];
  const shirt = pal.shirt || null;
  const parts = [];
  const local = (x, y, z) => C.cfRel(base, x * s, y * s, z * s);
  const L = (name, size, x, y, z, props) =>
    part(Object.assign({ name, size: size.map((v) => v * s), cf: local(x, y, z), ref: true, collide: false, cast: true }, props));

  // --- корневые части
  const hrp = L("HumanoidRootPart", [2, 2, 1], 0, 3, 0, { transparency: 1, collide: false, query: false, cast: false, material: MAT.SmoothPlastic });
  hrp.properties.Anchored = true;
  const torso = L("Torso", [2, 2, 1], 0, 3, 0, { color: coat, material: MAT.Fabric, collide: true, query: true });
  const head = L("Head", [2, 1.02, 1.02], 0, 4.5, 0, { color: skin, material: MAT.SmoothPlastic, shape: 0, query: true });
  const rarm = L("Right Arm", [1, 2, 1], 1.5, 3, 0, { color: skin, material: MAT.SmoothPlastic });
  const larm = L("Left Arm", [1, 2, 1], -1.5, 3, 0, { color: skin, material: MAT.SmoothPlastic });
  const rleg = L("Right Leg", [1, 2, 1], 0.5, 1, 0, { color: pants, material: MAT.Fabric });
  const lleg = L("Left Leg", [1, 2, 1], -0.5, 1, 0, { color: pants, material: MAT.Fabric });
  parts.push(hrp, torso, head, rarm, larm, rleg, lleg);

  // --- суставы
  const J = (n, p0, p1, c0, c1) => K.motor(n, p0, p1, C.cfMul(C.cfp(c0[0] * s, c0[1] * s, c0[2] * s), C.IDENT && C.cfA([0, 0, 0], 0, 0, 0)), C.cfMul(C.cfp(c1[0] * s, c1[1] * s, c1[2] * s), C.cfA([0, 0, 0], 0, 0, 0)));
  const joints = [
    J("RootJoint", hrp.referent, torso.referent, [0, 0, 0], [0, 0, 0]),
    J("Neck", torso.referent, head.referent, [0, 1, 0], [0, -0.5, 0]),
    J("Right Shoulder", torso.referent, rarm.referent, [1, 0.5, 0], [-0.5, 0.5, 0]),
    J("Left Shoulder", torso.referent, larm.referent, [-1, 0.5, 0], [0.5, 0.5, 0]),
    J("Right Hip", torso.referent, rleg.referent, [1, -1, 0], [0.5, 1, 0]),
    J("Left Hip", torso.referent, lleg.referent, [-1, -1, 0], [-0.5, 1, 0]),
  ];

  // --- одежда и лицо
  const dec = (name, size, x, y, z, props, parent) => {
    const p = L(name, size, x, y, z, Object.assign({ collide: false, query: false, cast: false }, props));
    p._parent = parent || head.referent;
    return p;
  };
  const dR = (name, size, loc, rot, props, parent) => {
    const p = part(Object.assign({
      name, size: size.map((v) => v * s), ref: true, collide: false, query: false, cast: false,
      cf: C.cfMul(base, C.cfA([loc[0] * s, loc[1] * s, loc[2] * s], rad(rot[0]), rad(rot[1]), rad(rot[2]))),
    }, props));
    p._parent = parent || head.referent;
    return p;
  };

  const eyeW = pal.eyeWhite || [252, 252, 255];
  const pupils = pal.pupil || [26, 26, 30];
  const eyeH = pal.eyeY !== undefined ? pal.eyeY : 0.1;
  // глаза
  for (const sx of [-1, 1]) {
    parts.push(dR("Eye", [0.34 * (pal.eyeScale || 1), 0.3 * (pal.eyeScale || 1), 0.16], [sx * (pal.eyeX || 0.34), eyeH, -0.5], [0, sx * -6, 0], { color: eyeW, material: MAT.SmoothPlastic }));
    parts.push(dR("Pupil", [0.13 * (pal.pupilScale || 1), 0.16 * (pal.pupilScale || 1), 0.1], [sx * (pal.eyeX || 0.34), eyeH, -0.58], [0, 0, 0], { color: pupils, material: MAT.SmoothPlastic }));
  }
  // брови / монобровь
  if (pal.unibrow) {
    parts.push(dR("Unibrow", [1.02, 0.15, 0.16], [0, 0.34, -0.53], [pal.browTilt || 0, 0, 0], { color: pal.browColor || [138, 152, 166], material: MAT.SmoothPlastic }));
  } else if (pal.brows) {
    for (const sx of [-1, 1]) {
      parts.push(dR("Brow", [0.44, 0.13, 0.16], [sx * 0.34, 0.34, -0.53], [0, 0, sx * (pal.browTilt || 14)], { color: pal.browColor || [112, 74, 44], material: MAT.SmoothPlastic }));
    }
  }
  // рот
  parts.push(dR("Mouth", [pal.mouthW || 0.5, 0.12, 0.14], [0, -0.26, -0.53], [0, 0, pal.mouthTilt || 0], { color: [92, 52, 52], material: MAT.SmoothPlastic }));
  if (pal.drool) parts.push(dR("Drool", [0.08, 0.34, 0.08], [0.22, -0.4, -0.5], [0, 0, 0], { color: [178, 216, 232], transparency: 0.25, material: MAT.SmoothPlastic }));
  // шевелюра
  if (pal.hairStyle === "rick") {
    parts.push(dR("Hair", [2.06, 0.62, 1.06], [0, 0.62, 0], [0, 0, 0], { color: hair, material: MAT.SmoothPlastic }));
    for (let i = 0; i < 5; i++) {
      const a = (-1 + (i / 4) * 2) * 0.42;
      parts.push(dR("HairSpike", [0.2, 0.5 + (i % 2) * 0.22, 0.3], [a, 1.0, -0.24 + (i % 2) * 0.2], [0, 0, a * -55], { color: hair, material: MAT.SmoothPlastic }));
    }
  } else if (pal.hairStyle === "morty") {
    parts.push(dR("Hair", [2.04, 0.72, 1.04], [0, 0.6, 0], [0, 0, 0], { color: hair, material: MAT.SmoothPlastic }));
    for (let i = 0; i < 7; i++) {
      const a = (-1 + (i / 3) * 2) * 0.5;
      parts.push(dR("HairSpike", [0.22, 0.4 + (i % 3) * 0.16, 0.26], [a, 1.02, -0.3 + (i % 3) * 0.28], [0, 0, a * -40], { color: hair, material: MAT.SmoothPlastic }));
    }
  }
  // уши
  for (const sx of [-1, 1]) parts.push(dR("Ear", [0.12, 0.36, 0.3], [sx * 1.02, 0.05, 0.06], [0, 0, 0], { color: skin }));
  // глазная повязка (Злой Морти)
  if (pal.eyePatch) {
    const sx = pal.eyePatchSide || 1;
    parts.push(dR("EyePatch", [0.62, 0.56, 0.12], [sx * 0.34, eyeH, -0.55], [0, sx * -6, sx * -6], { color: [24, 24, 28], material: MAT.Fabric }));
    parts.push(dR("EyePatchStrap", [2.1, 0.12, 1.06], [0, eyeH + 0.06, 0.02], [0, 0, sx * 8], { color: [24, 24, 28], material: MAT.Fabric }));
  }
  // одежда на торсе
  if (shirt) {
    parts.push(dR("Shirt", [1.05, 1.5, 0.16], [0, 0.14, -0.53], [0, 0, 0], { color: shirt, material: MAT.Fabric }, torso.referent));
    parts.push(dR("ShirtSide", [1.05, 1.5, 0.16], [0, 0.14, 0.53], [0, 0, 0], { color: shirt, material: MAT.Fabric }, torso.referent));
  }
  if (pal.jacket) {
    for (const sx of [-1, 1]) parts.push(dR("JacketPanel", [0.7, 1.96, 0.22], [sx * 0.5, 0.02, -0.5], [0, sx * 3, 0], { color: pal.jacket, material: MAT.Fabric }, torso.referent));
    parts.push(dR("JacketBack", [1.9, 1.9, 0.2], [0, 0.02, 0.52], [0, 0, 0], { color: pal.jacket, material: MAT.Fabric }, torso.referent));
    for (const sx of [-1, 1]) parts.push(dR("Collar", [0.72, 0.4, 0.24], [sx * 0.5, 0.92, -0.5], [0, 0, sx * -26], { color: pal.jacket, material: MAT.Fabric }, torso.referent));
  } else if (pal.labCoat) {
    for (const sx of [-1, 1]) parts.push(dR("CoatPanel", [0.72, 1.9, 0.2], [sx * 1.06, 0.02, -0.05], [0, 0, 0], { color: coat, material: MAT.Fabric }, torso.referent));
    parts.push(dR("CoatBack", [1.9, 1.9, 0.2], [0, 0.02, 0.52], [0, 0, 0], { color: coat, material: MAT.Fabric }, torso.referent));
    for (const sx of [-1, 1]) parts.push(dR("CoatCollar", [0.7, 0.34, 0.22], [sx * 0.5, 0.94, -0.5], [0, 0, sx * -30], { color: [236, 244, 250], material: MAT.Fabric }, torso.referent));
    parts.push(dR("Belt", [2.06, 0.28, 1.06], [0, -0.86, 0], [0, 0, 0], { color: [78, 62, 48], material: MAT.Fabric }, torso.referent));
  }
  // рюкзак
  if (pal.backpack) {
    parts.push(dR("Backpack", [1.5, 1.4, 0.55], [0, 0.05, 0.78], [0, 0, 0], { color: pal.backpack, material: MAT.Fabric }, torso.referent));
    for (const sx of [-1, 1]) parts.push(dR("Strap", [0.18, 1.5, 0.2], [sx * 0.6, 0.2, -0.52], [0, sx * 12, 0], { color: [70, 60, 52], material: MAT.Fabric }, torso.referent));
  }
  // обувь
  for (const sx of [-1, 1]) {
    parts.push(dR("Shoe", [1.06, 0.4, 1.3], [sx * 0.5, -1.8, -0.16], [0, 0, 0], { color: shoe, material: MAT.SmoothPlastic }, sx > 0 ? rleg.referent : lleg.referent));
  }

  // --- пушка в правой руке
  let gun = null;
  if (o.gun) {
    // точка хвата — та же, что у инструмента игрока: рукоять пушки оказывается в ладони
    const gunBase = C.cfMul(C.cfRel(base, 1.9 * s, 3.62 * s, -0.21 * s), C.cfA([0, 0, 0], rad(o.gun.tiltX || -14), 0, rad(o.gun.tiltZ || 0)));
    gun = portalGun(gunBase, { vial: o.gun.vial });
    parts.push(...gun.parts);
  }

  // --- режим «статуя»: одна монолитная позолоченная копия без гуманоида
  if (o.statue) {
    const stColor = o.statueColor || [196, 172, 108];
    for (const p of parts) {
      if (p.className !== "Part" && p.className !== "Ball") continue;
      p.properties.Transparency = 0;
      p.properties.Color = C3(...stColor);
      p.properties.Material = MAT.Metal;
      p.properties.Reflectance = 0.08;
      p.children = [];
    }
    for (const p of gun ? gun.parts : []) {
      p.properties.Color = C3(...stColor);
      p.properties.Material = MAT.Metal;
      p.properties.Transparency = 0;
      p.children = [];
    }
    const fixed = parts.filter((p) => p.className !== "Motor6D").map((p) => {
      if (p._parent) delete p._parent;
      return p;
    });
    // переводим суставы в жёсткие сварки
    const rigid = joints.map((j) => weldC(j.properties.Part0, j.properties.Part1));
    return { model: K.model({ name: o.modelName || o.name, primary: hrp.referent, children: fixed.concat(rigid) }), refs: { hrp: hrp.referent, head: head.referent }, gun, base, scale: s };
  }

  // --- сборка модели: все детали (тело, лицо, одежда, пушка) + сварки.
  // Суставы R6 кладём ВНУТРЬ Torso — так устроен канонический риг Roblox и именно там
  // их ищет RigAnim (torso:FindFirstChild("RootJoint") …). Если оставить Motor6D
  // прямыми детьми Model, процедурная анимация, реплики и клики NPC не заработают.
  torso.children.push(...joints);
  const children = [...parts];
  const welds = [];
  for (const p of parts) {
    if (p._parent) welds.push(weldC(p._parent, p.referent));
    delete p._parent;
  }
  const gunWelds = [];
  if (gun) for (const p of gun.parts) gunWelds.push(weldC(rarm.referent, p.referent));
  children.push(...welds, ...gunWelds);

  // --- гуманоид + служебные объекты
  // ВАЖНО: Animator обязан лежать ВНУТРИ Humanoid (или AnimationController).
  // Если положить его рядом с Humanoid (прямо в Model), Roblox Studio не открывает место:
  // «Animator has to be placed under Humanoid or AnimationController!»
  children.push({
    className: "Humanoid",
    name: "Humanoid",
    properties: {
      RigType: 0, Health_XML: 100, MaxHealth: 100, HealthDisplayType: 2, DisplayDistanceType: 2,
      NameDisplayDistance: 0, HealthDisplayDistance: 0, WalkSpeed: 0, JumpPower: 0, JumpHeight: 0,
      HipHeight: 0, AutoRotate: false, BreakJointsOnDeath: false, RequiresNeck: false,
      EvaluateStateMachine: false, DisplayName: o.displayName || o.name,
    },
    children: [{ className: "Animator", name: "Animator" }],
  });
  children.push({ className: "Configuration", name: "RigConfig", children: [
    K.stringValue("Kind", o.kind || "rick"),
    K.numberValue("Scale", s),
  ] });
  children.push(K.clickDetector({ dist: o.clickDist || 32 }));
  children.push(K.prompt({ action: "Поговорить", object: o.promptObject || o.displayName || "?", dist: 16, key: 69, style: 0 }));

  // табличка с именем
  const plate = K.billboard({
    name: "Nameplate", size: [0, 250, 0, 68], offset: [0, 3.5 * s, 0], maxDistance: 300, alwaysOnTop: false,
    children: [
      K.textLabel({
        name: "Title", text: o.displayName || o.name, textColor: o.nameColor || [255, 255, 255],
        size: [1, 0, 0.62, 0], stroke: 0.1, strokeColor: [0, 0, 0], textScaled: true,
        backgroundTransparency: 1, zIndex: 2,
      }),
      K.frame({
        name: "SubBg", size: [1, 0, 0.42, 0], position: [0, 0, 0.6, 0], color: [8, 9, 16], transparency: 0.25, corner: 6,
        children: [
          K.textLabel({
            name: "Sub", text: o.subtitle || "", textColor: o.subColor || [190, 230, 255],
            size: [1, -6, 1, 0], stroke: 0.6, backgroundTransparency: 1, zIndex: 3, textScaled: true,
          }),
        ],
      }),
    ],
  });
  plate.properties.Adornee = K.REF(head.referent);
  children.push(plate);

  // Подсветка: без Adornee Highlight берёт родителя (Model) и обводит весь силуэт.
  // Adornee = HumanoidRootPart давал бы светящийся прямоугольник вокруг невидимой детали.
  if (o.highlight) children.push(K.highlight({ color: o.highlight, outline: o.highlight, fillTransparency: 0.72, outlineTransparency: 0.15, depthMode: 1 }));
  // Свет в Roblox работает только внутри BasePart: PointLight как ребёнок Model не светит.
  if (o.light) torso.children.push(pointLight({ color: o.light, range: 22, brightness: 1.4 }));

  const modelSpec = K.model({ name: o.modelName || o.name, primary: hrp.referent, children });
  return { model: modelSpec, refs: { hrp: hrp.referent, torso: torso.referent, head: head.referent, rarm: rarm.referent, larm: larm.referent, rleg: rleg.referent, lleg: lleg.referent }, gun, base, scale: s };
}

// ================================================================ ПЕРСОНАЖИ
const HEROES = {
  rick: {
    modelName: "NPC_Rick", displayName: "РИК С-137", subtitle: "учёный, алкоголик, легенда",
    nameColor: [150, 220, 255], subColor: [200, 235, 255], kind: "rick",
    palette: {
      skin: [246, 226, 205], coat: [232, 240, 248], pants: [126, 102, 74], hair: [186, 214, 236],
      shoe: [70, 52, 40], eyeWhite: [250, 250, 255], pupil: [28, 28, 32], unibrow: true, browColor: [130, 146, 162],
      drool: true, labCoat: true, mouthW: 0.46, mouthTilt: -4,
    },
    gun: { vial: [70, 255, 150] },
    highlight: [0.35, 1, 0.6],
  },
  rickprime: {
    modelName: "NPC_RickPrime", displayName: "РИК ПРАЙМ", subtitle: "оригинал. убийца. легенда о себе",
    nameColor: [130, 255, 160], subColor: [170, 255, 190], kind: "rickprime",
    palette: {
      skin: [240, 214, 186], coat: [226, 214, 206], pants: [78, 72, 70], hair: [216, 220, 216],
      shoe: [40, 38, 42], eyeWhite: [250, 250, 252], pupil: [24, 24, 28], unibrow: true, browColor: [96, 100, 104],
      browTilt: 0, mouthW: 0.6, mouthTilt: 6, jacket: [122, 42, 44],
    },
    gun: { vial: [70, 255, 150] },
    highlight: [0.25, 1, 0.5],
    light: [0.3, 1, 0.5],
  },
  evilmorty: {
    modelName: "NPC_EvilMorty", displayName: "ЗЛОЙ МОРТИ", subtitle: "президент. кукловод. не морти.",
    nameColor: [255, 226, 90], subColor: [255, 244, 180], kind: "evilmorty",
    palette: {
      skin: [248, 226, 202], coat: [255, 216, 74], pants: [62, 74, 118], hair: [138, 88, 48],
      shoe: [58, 46, 40], eyeWhite: [252, 252, 255], pupil: [22, 22, 26], eyePatch: true, eyePatchSide: 1,
      brows: true, browTilt: -18, mouthW: 0.42, mouthTilt: -6, hairStyle: "morty", eyeScale: 1.05, eyeX: 0.32,
    },
    gun: { vial: [255, 214, 40] },
    highlight: [1, 0.85, 0.2],
  },
  morty: {
    modelName: "NPC_Morty", displayName: "МОРТИ", subtitle: "внук, который просто хочет домой",
    nameColor: [255, 236, 130], subColor: [255, 250, 200], kind: "morty",
    palette: {
      skin: [250, 228, 204], coat: [255, 216, 74], pants: [86, 118, 196], hair: [120, 78, 46],
      shoe: [78, 58, 44], eyeWhite: [252, 252, 255], pupil: [28, 28, 34], brows: true, browTilt: 16,
      mouthW: 0.4, mouthTilt: 10, hairStyle: "morty", eyeScale: 1.12, eyeX: 0.32, backpack: [86, 118, 196],
    },
    gun: null,
  },
};

const COUNCIL_COLORS = [
  { coat: [255, 236, 180], hair: [120, 90, 60], unibrow: true },
  { coat: [190, 255, 190], hair: [150, 150, 160], unibrow: true },
  { coat: [255, 190, 190], hair: [100, 60, 60], unibrow: true },
  { coat: [200, 200, 255], hair: [80, 80, 90], unibrow: true },
  { coat: [255, 210, 150], hair: [180, 180, 180], unibrow: true },
  { coat: [170, 240, 240], hair: [200, 200, 200], unibrow: true },
];

/** Член Совета Риков (для зала Совета) */
function councilRick(name, base, i) {
  const c = COUNCIL_COLORS[i % COUNCIL_COLORS.length];
  const r = rig({
    cf: base, name: name, modelName: "NPC_" + name, displayName: "СОВЕТ РИКОВ", subtitle: "делегат #" + (100 + i),
    kind: "council", scale: 0.98, palette: {
      skin: [246, 226, 205], coat: c.coat, pants: [110, 96, 76], hair: c.hair, shoe: [64, 52, 42],
      eyeWhite: [250, 250, 255], pupil: [30, 30, 34], unibrow: true, browColor: c.hair,
      labCoat: true, mouthW: 0.44,
    },
    nameColor: [200, 220, 255], subColor: [150, 190, 230], gun: { vial: [120, 220, 255] },
  });
  return r;
}

module.exports = { portalGun, rig, HEROES, councilRick };
