/* Проверка иерархии персонажей в готовом .rbxlx — то, из-за чего Roblox Studio
   отказывается открывать место или молча ломает анимацию NPC:

     1. Animator обязан лежать ВНУТРИ Humanoid (или AnimationController).
        Иначе Studio выдаёт: «Animator has to be placed under Humanoid or
        AnimationController!» и место не открывается.
     2. Humanoid может жить только в Model.
     3. Суставы R6 (RootJoint, Neck, Right/Left Shoulder, Right/Left Hip) должны
        лежать в Torso — именно там их ищет src/shared/RigAnim.lua. Если Motor6D
        оставить прямым ребёнком Model, RigAnim.new() вернёт nil и NPC не будут
        ни двигаться, ни говорить (bindNPC тоже не сработает).
     4. У Model-рига должны быть PrimaryPart, Torso, HumanoidRootPart и Head.

   Запуск: node tools/check_rig.js [путь_к_файлу.rbxlx] */
const fs = require("fs");
const path = require("path");
const { readXml } = require("rbx-dom");

const ROOT = path.resolve(__dirname, "..");
const FILE = process.argv[2] || path.join(ROOT, "RickAndMorty_Portals.rbxlx");

const R6_JOINTS = ["RootJoint", "Neck", "Right Shoulder", "Left Shoulder", "Right Hip", "Left Hip"];
const BODY_PARTS = ["HumanoidRootPart", "Torso", "Head", "Right Arm", "Left Arm", "Right Leg", "Left Leg"];
const PARENT_RULES = {
  Animator: ["Humanoid", "AnimationController"],
  Humanoid: ["Model"],
};

const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const snap = (r) => dom.instance(r);
const kids = (r) => dom.children(r);
const all = (r, out = []) => {
  out.push(r);
  for (const c of kids(r)) all(c, out);
  return out;
};

const refs = all(dom.rootRef);
const parentOf = new Map();
for (const r of refs) for (const c of kids(r)) parentOf.set(c, r);
const parentClass = (r) => {
  const p = parentOf.get(r);
  return p ? snap(p).className : null;
};
const has = (r, className) => kids(r).some((c) => snap(c).className === className);
const childByName = (r, name) => kids(r).find((c) => snap(c).name === name);

let problems = 0;
const bad = (msg) => {
  problems++;
  console.log("  ОШИБКА: " + msg);
};

// ------------------------------------------------------- 1–2. правила родительства
const counts = {};
for (const r of refs) {
  const cls = snap(r).className;
  counts[cls] = (counts[cls] || 0) + 1;
  const rule = PARENT_RULES[cls];
  if (!rule) continue;
  const p = parentClass(r);
  if (!rule.includes(p)) bad(cls + " лежит под " + (p || "ничем") + ", а должен под " + rule.join("/") + " — " + dom.fullPath(r));
}

// ------------------------------------------------------- 3–4. риги персонажей
let rigs = 0;
for (const r of refs) {
  if (snap(r).className !== "Model" || !snap(r).name.startsWith("NPC_")) continue;
  rigs++;
  const name = snap(r).name + " (" + dom.fullPath(r) + ")";

  const primary = snap(r).properties.PrimaryPart;
  if (!primary || primary.Ref === undefined) {
    bad("нет PrimaryPart — Model:GetPivot()/PivotTo() сломаются: " + name);
  } else {
    let target = null;
    try { target = snap(primary.Ref); } catch (e) { target = null; }
    if (!target) bad("PrimaryPart — битая ссылка (в Studio будет nil): " + name);
    else if (!kids(r).includes(primary.Ref) && !["Part", "MeshPart", "SpawnLocation"].includes(target.className))
      bad("PrimaryPart указывает на " + target.className + " вместо детали тела: " + name);
  }
  if (!has(r, "Humanoid")) bad("нет Humanoid: " + name);
  else if (!has(childByName(r, "Humanoid") || r, "Animator")) bad("в Humanoid нет Animator: " + name);

  const missingParts = BODY_PARTS.filter((p) => !childByName(r, p));
  if (missingParts.length) bad("нет частей тела " + missingParts.join(", ") + ": " + name);

  const torso = childByName(r, "Torso");
  const joints = torso ? R6_JOINTS.filter((j) => {
    const m = childByName(torso, j);
    return m && snap(m).className === "Motor6D";
  }) : [];
  if (joints.length !== R6_JOINTS.length) {
    bad("в Torso нет суставов R6 (" + joints.length + "/" + R6_JOINTS.length + ") — RigAnim.new() вернёт nil: " + name);
  }
  // сустав обязан ссылаться на живые детали: иначе RigAnim пропустит его (isPart(nil) == false)
  for (const j of R6_JOINTS) {
    const m = torso && childByName(torso, j);
    if (!m) continue;
    for (const prop of ["Part0", "Part1"]) {
      const v = snap(m).properties[prop];
      let t = null;
      if (v && v.Ref !== undefined) { try { t = snap(v.Ref); } catch (e) { t = null; } }
      if (!t) bad(j + "." + prop + " — не ссылка или битая ссылка (сустав пустой): " + name);
      else if (!["Part", "MeshPart", "SpawnLocation"].includes(t.className)) bad(j + "." + prop + " указывает на " + t.className + ": " + name);
    }
  }

  if (!has(r, "ProximityPrompt")) bad("нет ProximityPrompt (реплика на E): " + name);
  if (!has(r, "ClickDetector")) bad("нет ClickDetector (реплика на клик): " + name);
}

console.log("ФАЙЛ:", path.relative(ROOT, FILE));
console.log("Ригов NPC:", rigs, "· Humanoid:", counts.Humanoid || 0, "· Animator:", counts.Animator || 0, "· Motor6D:", counts.Motor6D || 0);
console.log(problems ? "Проблем иерархии: " + problems : "Иерархия персонажей корректна — Studio откроет место без ошибок");
process.exit(problems ? 1 : 0);
