/* Проверка порталов: нормаль (+X), точка выхода свободна и есть ли пол под ней. */
const fs = require("fs");
const { readXml } = require("rbx-dom");
const FILE = process.argv[2] || "/home/user/Epic-game/RickAndMorty_Portals.rbxlx";
const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const snap = (r) => dom.instance(r);
const unwrap = (v) => (v === null || typeof v !== "object" ? v : Object.keys(v).length === 1 ? unwrap(v[Object.keys(v)[0]]) : v);
const val = (r, p) => (snap(r).properties[p] === undefined ? undefined : unwrap(snap(r).properties[p]));
const kids = (r) => dom.children(r);
const all = (r, o = []) => { o.push(r); for (const c of kids(r)) all(c, o); return o; };
const byName = (r, n) => kids(r).find((c) => snap(c).name === n);

const every = all(dom.rootRef);
const boxes = [];
for (const r of every) {
  const i = snap(r);
  if (!["Part", "WedgePart"].includes(i.className)) continue;
  const cf = val(r, "CFrame"), size = val(r, "Size");
  if (cf && size) boxes.push({ t: cf.position, R: cf.orientation, size, collide: val(r, "CanCollide"), path: dom.fullPath(r), name: i.name });
}
const toLocal = (b, p) => {
  const d = [p[0] - b.t[0], p[1] - b.t[1], p[2] - b.t[2]];
  const R = b.R;
  return [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2],
          R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2],
          R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];
};
const insideBox = (b, p) => { const l = toLocal(b, p); return Math.abs(l[0]) <= b.size[0] / 2 && Math.abs(l[1]) <= b.size[1] / 2 && Math.abs(l[2]) <= b.size[2] / 2; };
const surfaceBelow = (p) => {
  let best = null;
  for (const b of boxes) {
    if (!b.collide) continue;
    const l = toLocal(b, p);
    const dir = [-b.R[0][1], -b.R[1][1], -b.R[2][1]];
    const half = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2];
    let tmin = -Infinity, tmax = Infinity, miss = false;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) { if (Math.abs(l[a]) > half[a]) { miss = true; break; } continue; }
      const t1 = (-half[a] - l[a]) / dir[a], t2 = (half[a] - l[a]) / dir[a];
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (miss || tmax < Math.max(tmin, 0)) continue;
    const y = p[1] - Math.max(tmin, 0);
    if (!best || y > best.y) best = { y, name: b.name };
  }
  return best;
};

console.log("ПОРТАЛЫ (локальная +X — нормаль; RADIUS из NumberValue):");
let bad = 0;
for (const r of every) {
  const i = snap(r);
  if (!(i.className === "Model" && i.name.startsWith("Portal_"))) continue;
  const trig = byName(r, "PortalTrigger");
  if (!trig) continue;
  const cf = val(trig, "CFrame");
  const pos = cf.position;
  const nx = [cf.orientation[0][0], cf.orientation[1][0], cf.orientation[2][0]]; // столбец X
  const radius = (byName(r, "Radius") && val(byName(r, "Radius"), "Value")) || 11;
  const link = byName(r, "LinkTo") && unwrap(snap(byName(r, "LinkTo")).properties.Value);
  const exit = [pos[0] + nx[0] * (radius + 4), pos[1] + nx[1] * (radius + 4), pos[2] + nx[2] * (radius + 4)];
  const back = [pos[0] - nx[0] * (radius + 4), pos[1] - nx[1] * (radius + 4), pos[2] - nx[2] * (radius + 4)];
  const inExit = boxes.filter((b) => b.collide && insideBox(b, exit));
  const inBack = boxes.filter((b) => b.collide && insideBox(b, back));
  const floorExit = surfaceBelow(exit);
  const floorHere = surfaceBelow(pos);
  const problems = [];
  if (inExit.length) problems.push("точка выхода внутри " + inExit[0].path);
  if (!floorExit) problems.push("под точкой выхода нет пола");
  else if (exit[1] - floorExit.y > 60) problems.push("до пола выхода " + (exit[1] - floorExit.y).toFixed(0) + " (падение)");
  if (inBack.length) problems.push("вход внутри " + inBack[0].path);
  if (problems.length) bad++;
  console.log("  " + i.name.padEnd(28) + "→ " + String(link).padEnd(24) + " R=" + radius +
    " · нормаль " + JSON.stringify(nx.map((v) => +v.toFixed(2))) +
    " · выход " + JSON.stringify(exit.map((v) => +v.toFixed(1))) +
    " · пол под порталом " + (floorHere ? floorHere.y.toFixed(1) : "НЕТ") +
    (problems.length ? "  ⚠ " + problems.join("; ") : "  ок"));
}
console.log("Проблемных порталов:", bad);
