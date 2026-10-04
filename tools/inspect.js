/* Быстрый разбор готового .rbxlx: что внутри и как оно связано. */
const fs = require("fs");
const { readXml } = require("rbx-dom");
const FILE = process.argv[2] || "/home/user/Epic-game/RickAndMorty_Portals.rbxlx";

const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const root = dom.rootRef;
const snap = (r) => dom.instance(r);
const kids = (r) => dom.children(r);
const byName = (r, n) => kids(r).find((c) => snap(c).name === n);
const unwrap = (v) => {
  if (v === null || typeof v !== "object") return v;
  const keys = Object.keys(v);
  if (keys.length === 1) return unwrap(v[keys[0]]);
  return v;
};
const val = (r, prop) => {
  const p = snap(r).properties[prop];
  return p === undefined ? undefined : unwrap(p);
};
const typeName = (r, prop) => {
  const p = snap(r).properties[prop];
  return p === undefined ? "нет" : Object.keys(p)[0];
};
const path = (r) => dom.fullPath(r);
const all = (r, out = []) => { out.push(r); for (const c of kids(r)) all(c, out); return out; };

const counts = new Map();
for (const r of all(root)) { const c = snap(r).className; counts.set(c, (counts.get(c) || 0) + 1); }
console.log("ФАЙЛ:", FILE, (fs.statSync(FILE).size / 1048576).toFixed(2), "МБ · инстансов:", dom.instanceCount);
console.log("КЛАССЫ:", [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "=" + v).join(", "));

const ws = byName(root, "Workspace");
const world = byName(ws, "World");
console.log("\nWorld: " + kids(world).length + " групп");
console.log("  " + kids(world).map((c) => snap(c).name + "[" + kids(c).length + "]").join(", "));

console.log("\nГЕРОИ:");
for (const nm of ["Heroes_RickAndMorty", "Heroes_RickPrime", "Heroes_EvilMorty", "CouncilDelegates"]) {
  const m = byName(world, nm);
  if (!m) { console.log("  НЕТ " + nm); continue; }
  console.log("  " + nm + ": " + kids(m).map((c) => snap(c).name + " (" + kids(c).length + ")").join(", "));
}

console.log("\nПОРТАЛЫ:");
for (const m of kids(world)) {
  const n = snap(m).name;
  if (!n.startsWith("Portal_")) continue;
  const link = byName(m, "LinkTo");
  const pal = byName(m, "Palette");
  console.log("  " + n + " → " + (link && val(link, "Value")) + " | палитра: " + (pal && val(pal, "Value")) + " | деталей: " + kids(m).length);
}

console.log("\nПЕРСОНАЖИ (детали):");
for (const m of kids(world)) {
  const n = snap(m).name;
  if (!/^NPC_|^Heroes_/.test(n) && !n.startsWith("CitadelRest")) continue;
  for (const m2 of (n.startsWith("NPC_") ? [m] : kids(m))) {
    if (snap(m2).className !== "Model") continue;
    const parts = all(m2).map(snap).filter((x) => ["Part", "WedgePart"].includes(x.className));
    const gunBits = parts.filter((p) => /Muzzle|Vial|Grip|Body|Prong|Antenna/.test(p.name)).map((p) => p.name);
    console.log("  " + snap(m2).name + ": деталей " + parts.length + " | в руке: " + (gunBits.length ? gunBits.join(",") : "НЕТ ПУШКИ") + " | поза: " + val(m2, "Name"));
  }
}

console.log("\nТЕЛЕПОРТ/СВЯЗИ (LinkTo):");
for (const r of all(root)) {
  const i = snap(r);
  if (i.className === "StringValue" && i.name === "LinkTo") console.log("  " + dom.fullPath(r) + " = " + unwrap(i.properties.Value));
}
console.log("\nПАЛИТРЫ ПОРТАЛОВ:");
for (const r of all(root)) {
  const i = snap(r);
  if (i.className === "StringValue" && i.name === "Palette" && dom.fullPath(r).includes("Portal")) console.log("  " + dom.fullPath(r) + " = " + unwrap(i.properties.Value));
}

console.log("\nСКРИПТЫ:");
for (const i of all(root).map(snap)) {
  if (!["Script", "LocalScript", "ModuleScript"].includes(i.className)) continue;
  const src = unwrap(i.properties.Source) || "";
  console.log("  " + dom.fullPath(i.referent) + " [" + i.className + "] " + src.length + " симв. / " + src.split("\n").length + " строк");
}

const pack = byName(root, "StarterPack");
const tool = pack && kids(pack)[0];
if (tool) {
  console.log("\nTOOL: " + snap(tool).name + " | детей: " + kids(tool).map((c) => snap(c).name).join(", "));
  const handle = byName(tool, "Handle");
  if (handle) console.log("  Handle: Size=" + JSON.stringify(val(handle, "Size")) + " CanCollide=" + val(handle, "CanCollide") + " Anchored=" + val(handle, "Anchored"));
  const muzzle = byName(tool, "Muzzle");
  if (muzzle) console.log("  Muzzle: " + snap(muzzle).className + " Size=" + JSON.stringify(val(muzzle, "Size")) + " Neo=" + val(muzzle, "Material"));
}

const sp = byName(world, "SpawnArea") && kids(byName(world, "SpawnArea"))[0];
if (sp) console.log("\nSPAWN: " + JSON.stringify(val(sp, "CFrame")) + "\n  Enabled=" + val(sp, "Enabled") + " Neutral=" + val(sp, "Neutral") + " Duration=" + val(sp, "Duration"));
