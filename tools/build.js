"use strict";
/*
 * Сборщик единого файла проекта (.rbxlx) для Roblox Studio.
 * Запуск:  node tools/build.js
 * Результат: RickAndMorty_Portals.rbxlx в корне репозитория
 */
const fs = require("fs");
const path = require("path");
const { createDom, readXml } = require("rbx-dom");

const C = require("./lib/cframe");
const K = require("./lib/kit");
const S = require("./lib/shapes");
const CH = require("./lib/characters");

const sections = {
  ground: require("./world/ground"),
  plaza: require("./world/plaza"),
  wasteland: require("./world/wasteland"),
  alien: require("./world/alien"),
  citadel: require("./world/citadel"),
  garage: require("./world/garage"),
  sky: require("./world/sky"),
  heroes: require("./world/heroes"),
  lighting: require("./world/lighting"),
};

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "RickAndMorty_Portals.rbxlx");

// ------------------------------------------------------------------ Lua-исходники
function lua(rel) {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) throw new Error("Нет файла Lua: " + p);
  return fs.readFileSync(p, "utf8");
}

function buildSystemFolder() {
  const remotes = K.folder("Remotes", [
    K.remote("FirePortal"),
    K.remote("PortalEvent"),
    K.remote("Talk"),
    (() => { const s = K.remote("Ping"); return s; })(),
  ]);
  return K.folder("PortalGunSystem", [
    K.script_({ name: "Config", module: true, source: lua("shared/PortalConfig.lua") }),
    K.script_({ name: "Fx", module: true, source: lua("shared/PortalFx.lua") }),
    K.script_({ name: "RigAnim", module: true, source: lua("shared/RigAnim.lua") }),
    remotes,
  ]);
}

/** Инструмент «Портальная пушка» для игрока */
function buildPortalGunTool() {
  const base = C.cfp(0, 0, 0);
  const gun = CH.portalGun(base, { vial: [70, 255, 150] });
  // детали инструмента: не привязаны к миру и не влияют на физику игрока
  for (const p of gun.parts) {
    p.properties.Anchored = false;
    p.properties.Massless = true;
    p.properties.CanCollide = false;
    p.properties.CanQuery = false;
    p.properties.CanTouch = false;
  }
  const handle = gun.parts.find((p) => p.name === "Handle");
  // переносим хват на рукоять: origin оружия окажется над ладонью
  handle.properties.CFrame = C.CFv(C.cfp(0, -0.62, 0.06));
  const welds = gun.parts
    .filter((p) => p !== handle)
    .map((p) => K.weldC(handle.referent, p.referent));
  const children = gun.parts
    .filter((p) => p !== handle)
    .concat(welds)
    .concat([
      K.script_({ name: "PortalGunController", local: true, source: lua("tool/PortalGun.client.lua") }),
    ]);
  return {
    className: "Tool", name: "Portal Gun",
    properties: {
      RequiresHandle: true,
      CanBeDropped: false,
      ManualActivationOnly: false,
      Enabled: true,
      Grip: C.CFv(C.cfp(0, 0, 0)),
      ToolTip: "Портальная пушка · ЛКМ — открыть портал",
    },
    children: [handle].concat(children),
  };
}

// ------------------------------------------------------------------ сборка мира
function buildWorld() {
  const world = K.folder("World", []);
  for (const [name, mod] of Object.entries(sections)) {
    if (name === "lighting") continue;
    const parts = mod.build();
    for (const p of parts) world.children.push(p);
  }
  return world;
}

function main() {
  console.log("Сборка мира…");
  const world = buildWorld();
  const partCount = (function count(node) {
    let n = node.className === "Part" || node.className === "WedgePart" || node.className === "CornerWedgePart" || node.className === "SpawnLocation" ? 1 : 0;
    for (const c of node.children || []) n += count(c);
    return n;
  })(world);
  console.log("  деталей в мире:", partCount);

  const ws = {
    className: "Workspace", name: "Workspace",
    properties: sections.lighting.workspaceProps(),
    children: [world, K.folder("LivePortals", []), K.folder("Effects", [])],
  };

  const repStorage = { className: "ReplicatedStorage", name: "ReplicatedStorage", children: [buildSystemFolder()] };

  const starterPlayer = sections.lighting.starterPlayer();
  starterPlayer.children[0].children.push(
    K.script_({ name: "WorldClient", local: true, source: lua("client/WorldClient.client.lua") }),
  );

  const root = {
    className: "DataModel",
    children: [
      ws,
      sections.lighting.build(),
      repStorage,
      { className: "ServerScriptService", name: "ServerScriptService", children: [
        K.script_({ name: "PortalServer", source: lua("server/PortalServer.lua") }),
      ] },
      starterPlayer,
      { className: "StarterPack", name: "StarterPack", children: [buildPortalGunTool()] },
      { className: "StarterGui", name: "StarterGui", children: [] },
      { className: "SoundService", name: "SoundService", properties: { RespectFilteringEnabled: true, AmbientReverb: 5, DistanceFactor: 3.33, RolloffScale: 1 } },
      { className: "Players", name: "Players", properties: { RespawnTime: 3, CharacterAutoLoads: true } },
      { className: "Teams", name: "Teams", children: [] },
      { className: "Chat", name: "Chat", properties: { LoadDefaultChat: true } },
    ],
  };

  // ------------------------------------------------------------------ предпроверка имён классов и свойств
  function validateSpec(root) {
    const { reflection } = require("rbx-dom");
    const cache = new Map();
    const allowed = (cls) => {
      if (cache.has(cls)) return cache.get(cls);
      const set = new Set();
      let c = reflection.class(cls);
      let guard = 0;
      while (c && guard++ < 12) {
        for (const [key, prop] of Object.entries(c.Properties)) {
          const ser = prop.Kind && prop.Kind.Canonical && prop.Kind.Canonical.Serialization;
          if (ser === "DoesNotSerialize") continue;
          set.add(key);
          set.add(prop.Name);
          if (ser && typeof ser === "object") {
            if (ser.SerializesAs) set.add(ser.SerializesAs);
            if (ser.Migrate && ser.Migrate.To) set.add(ser.Migrate.To);
          }
        }
        c = c.Superclass && c.Superclass !== "" ? reflection.class(c.Superclass) : null;
      }
      cache.set(cls, set);
      return set;
    };
    // Классы, которые Roblox Studio разрешает держать только под определённым родителем.
    // Нарушение = место не откроется: «Animator has to be placed under Humanoid or AnimationController!»
    const isA = (cls, base) => {
      let c = reflection.class(cls);
      let guard = 0;
      while (c && guard++ < 20) {
        if (c.Name === base) return true;
        c = c.Superclass && c.Superclass !== "" ? reflection.class(c.Superclass) : null;
      }
      return false;
    };
    const PARENT_RULES = {
      Animator: ["Humanoid", "AnimationController"],
      Humanoid: ["Model"],
    };

    const problems = [];
    const walk = (node, path, parentClass) => {
      const cls = node.className;
      if (!reflection.class(cls)) problems.push("неизвестный класс: " + cls + " (" + path + ")");
      const set = allowed(cls);
      for (const key of Object.keys(node.properties || {})) {
        if (set.has(key)) continue;
        const norm = key.replace(/[^A-Za-z0-9_]/g, "");
        if (set.has(norm)) continue;
        problems.push("свойство " + cls + "." + key + " (" + path + ")");
      }
      const rule = PARENT_RULES[cls];
      if (rule && parentClass && !rule.some((r) => isA(parentClass, r))) {
        problems.push(cls + " должен лежать под " + rule.join("/") + ", а не под " + parentClass + " (" + path + ")");
      }
      for (const c of node.children || []) walk(c, path + "/" + (c.name || c.className), cls);
    };
    walk(root, "root", null);
    return problems;
  }
  const problems = validateSpec(root);
  if (problems.length) {
    console.log("  ПРОБЛЕМЫ (" + problems.length + "):");
    for (const p of problems.slice(0, 40)) console.log("   -", p);
    if (problems.length > 40) console.log("   … и ещё", problems.length - 40);
    process.exit(1);
  }
  console.log("  имена классов и свойств проверены");

  console.log("Генерация XML…");
  const dom = createDom(root);
  const xml = dom.toXml({ propertyBehavior: "errorOnUnknown" });
  fs.writeFileSync(OUT, xml);
  console.log("  записано:", OUT, (xml.length / 1024 / 1024).toFixed(2), "МБ");

  // ------------------------------------------------------------------ проверка
  const back = readXml(xml, { propertyBehavior: "errorOnUnknown" });
  const re = back.toXml({ propertyBehavior: "errorOnUnknown" });
  console.log("Проверка: инстансов", back.instanceCount, "· повторная кодировка", (re.length / 1024 / 1024).toFixed(2), "МБ — OK");
  const names = back.children(back.rootRef).map((r) => back.instance(r).name);
  console.log("Сервисы:", names.join(", "));

  // ------------------------------------------------------------------ ссылки между инстансами
  // Ссылка обязана уезжать в XML тегом <Ref>. Если передать rbx-dom голую строку,
  // получится <string name="PrimaryPart">…</string>, Studio прочитает её как nil —
  // и PrimaryPart, Motor6D.Part0/Part1, сварки, Adornee и Beam.Attachment* будут пустыми.
  const xmlText = Buffer.isBuffer(xml) ? xml.toString("utf8") : String(xml);
  const fakeRefs = xmlText.match(/<string name="(PrimaryPart|Part0|Part1|Part0Internal|Part1Internal|Adornee|Attachment0|Attachment1)">/g) || [];
  if (fakeRefs.length) {
    console.log("  ПРОБЛЕМЫ: ссылок, записанных как <string> вместо <Ref>:", fakeRefs.length);
    for (const f of fakeRefs.slice(0, 10)) console.log("   -", f);
    process.exit(1);
  }
  let refCount = 0;
  const brokenRefs = [];
  const walkRefs = (r) => {
    const props = back.instance(r).properties;
    for (const [key, v] of Object.entries(props)) {
      if (!v || typeof v !== "object" || v.Ref === undefined) continue;
      refCount++;
      let target = null;
      try { target = back.instance(v.Ref); } catch (e) { target = null; }
      if (!target) brokenRefs.push(back.instance(r).className + "." + key + " → " + back.fullPath(r));
    }
    for (const c of back.children(r)) walkRefs(c);
  };
  walkRefs(back.rootRef);
  if (brokenRefs.length) {
    console.log("  ПРОБЛЕМЫ: битых ссылок", brokenRefs.length);
    for (const b of brokenRefs.slice(0, 10)) console.log("   -", b);
    process.exit(1);
  }
  console.log("Ссылки: <Ref> в файле", (xmlText.match(/<Ref /g) || []).length, "· разрешается", refCount, "· битых 0 — OK");
}

main();
