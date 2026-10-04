/* Геометрические проверки готового .rbxlx: есть ли пол под ключевыми точками,
   не висит ли что-то в воздухе, какие группы анимации попали в файл. */
const fs = require("fs");
const path = require("path");
const { readXml } = require("rbx-dom");
const ROOT = path.resolve(__dirname, "..");
const FILE = process.argv[2] || path.join(ROOT, "RickAndMorty_Portals.rbxlx");
const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const snap = (r) => dom.instance(r);
const kids = (r) => dom.children(r);
const unwrap = (v) => (v === null || typeof v !== "object" ? v : Object.keys(v).length === 1 ? unwrap(v[Object.keys(v)[0]]) : v);
const val = (r, p) => (snap(r).properties[p] === undefined ? undefined : unwrap(snap(r).properties[p]));
const all = (r, out = []) => { out.push(r); for (const c of kids(r)) all(c, out); return out; };
const root = dom.rootRef;
const every = all(root);

const boxes = [];
for (const r of every) {
  const i = snap(r);
  if (!["Part", "WedgePart", "SpawnLocation"].includes(i.className)) continue;
  const cf = val(r, "CFrame");
  const size = val(r, "Size");
  if (!cf || !size) continue;
  boxes.push({ ref: r, name: i.name, path: dom.fullPath(r), t: cf.position, R: cf.orientation, size, collide: val(r, "CanCollide"), anchored: val(r, "Anchored") });
}

const toLocal = (b, p) => {
  const d = [p[0] - b.t[0], p[1] - b.t[1], p[2] - b.t[2]];
  const R = b.R; // строки: X, Y, Z локальные оси
  return [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2],
          R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2],
          R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];
};
const inside = (b, p) => { const l = toLocal(b, p); return Math.abs(l[0]) <= b.size[0] / 2 && Math.abs(l[1]) <= b.size[1] / 2 && Math.abs(l[2]) <= b.size[2] / 2; };

// поверхность под точкой: пересечение вертикального луча вниз с боксами деталей
function surfaceBelow(p, collideOnly) {
  let best = null;
  for (const b of boxes) {
    if (collideOnly && !b.collide) continue;
    const d = [p[0] - b.t[0], p[1] - b.t[1], p[2] - b.t[2]];
    const R = b.R;
    const l = [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2],
               R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2],
               R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];
    const dir = [-R[0][1], -R[1][1], -R[2][1]]; // мировой −Y в локальных осях детали
    const half = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2];
    let tmin = -Infinity, tmax = Infinity, miss = false;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) { if (Math.abs(l[a]) > half[a]) { miss = true; break; } continue; }
      const t1 = (-half[a] - l[a]) / dir[a], t2 = (half[a] - l[a]) / dir[a];
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (miss || tmax < Math.max(tmin, 0)) continue;
    const t = Math.max(tmin, 0);
    const y = p[1] - t;
    if (!best || y > best.y) best = { y, name: b.name, path: b.path, walk: b.collide, inside: tmin < 0 };
  }
  return best;
}

const points = {
  "спавн (0,52)": [0, 2, 52],
  "над траншеей (0,86)": [0, 2, 86],
  "пандус (0,-20,80)": [0, -19, 80],
  "пандус (0,-40,55)": [0, -39, 55],
  "пандус (0,-60,30)": [0, -59, 30],
  "площадь (0,20)": [0, 20, 20],
  "у Рика (-26,6)": [-26, 6, 6],
  "у Злого Морти (26,10)": [26, 10, 10],
  "хаб-портал пустоши (0,-60)": [0, 8, -60],
  "ворота гаража (0,40,128)": [0, 40, 128],
  "лаборатория (0,-60,0)": [0, -60, 0],
  "пустошь (-380,20)": [-380, 20, 0],
  "портал возврата пустоши (-212,8)": [-212, 8, 0],
  "алиен-мир (380,20)": [380, 20, 0],
  "цитадель (0,20,-380)": [0, 20, -380],
  "зал совета (0,20,-452)": [0, 20, -452],
};
console.log("ПОЛ ПОД ТОЧКАМИ (вертикальный луч вниз, только проходимые детали):");
for (const [label, p] of Object.entries(points)) {
  const hit = surfaceBelow(p, true);
  const gap = hit ? p[1] - hit.y : Infinity;
  const mark = !hit ? "ПУСТОТА (падение в пустоту)" : gap > 80 ? "ВЫСОКО (" + gap.toFixed(0) + ")" : "ок";
  console.log("  " + label.padEnd(32) + (hit ? ("пол: " + hit.name + " @" + hit.y.toFixed(1) + " · до пола " + gap.toFixed(1) + (hit.inside ? " · точка внутри детали" : "")).padEnd(74) : "".padEnd(74)) + mark);
}

console.log("\nГРУППЫ АНИМАЦИИ:");
for (const r of every) {
  const i = snap(r);
  if (!["SpinGroup", "PulseGroup", "BobGroup", "OrbitGroup"].includes(i.name)) continue;
  const props = kids(r).map((c) => snap(c).name + ":" + (snap(c).className === "NumberValue" ? val(c, "Value") : snap(c).className === "Vector3Value" ? JSON.stringify(val(c, "Value")) : snap(c).className)).join(", ");
  console.log("  " + dom.fullPath(r) + " → " + props);
}

console.log("\nSWIRL-детали:");
let sw = 0;
for (const r of every) { const i = snap(r); if (i.className === "StringValue" && i.name === "Swirl") { sw++; if (sw <= 5) console.log("  " + dom.fullPath(r) + " = " + val(r, "Value")); } }
console.log("  всего:", sw);

console.log("\nПОДОЗРИТЕЛЬНАЯ ГЕОМЕТРИЯ:");
let big = 0, far = 0, odd = 0;
for (const b of boxes) {
  const m = Math.max(...b.size);
  if (m > 400) { big++; if (big <= 6) console.log("  огромная деталь " + b.name + " " + JSON.stringify(b.size.map((x) => +x.toFixed(1))) + " @ " + b.path); }
  if (Math.max(Math.abs(b.t[0]), Math.abs(b.t[2])) > 900 || b.t[1] > 800) { far++; if (far <= 6) console.log("  далеко " + b.name + " @ " + JSON.stringify(b.t.map((x) => +x.toFixed(0))) + " " + b.path); }
  if (Math.min(...b.size) <= 0.001) { odd++; if (odd <= 6) console.log("  нулевой размер " + b.name + " @ " + b.path); }
}
console.log("  огромных:", big, "· далёких:", far, "· нулевых:", odd, "· всего деталей:", boxes.length);
