/* Профиль прохода: идём по маршруту, на каждом шаге проверяем перепад высоты пола
   и не упираемся ли мы в геометрию. */
const fs = require("fs");
const path = require("path");
const { readXml } = require("rbx-dom");
const ROOT = path.resolve(__dirname, "..");
const FILE = process.argv[2] || path.join(ROOT, "RickAndMorty_Portals.rbxlx");
const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const snap = (r) => dom.instance(r);
const unwrap = (v) => (v === null || typeof v !== "object" ? v : Object.keys(v).length === 1 ? unwrap(v[Object.keys(v)[0]]) : v);
const val = (r, p) => (snap(r).properties[p] === undefined ? undefined : unwrap(snap(r).properties[p]));

const boxes = [];
(function walk(r) {
  const i = snap(r);
  if (["Part", "WedgePart"].includes(i.className)) {
    const cf = val(r, "CFrame"), size = val(r, "Size");
    if (cf && size) boxes.push({ name: i.name, t: cf.position, R: cf.orientation, size, collide: val(r, "CanCollide"), path: dom.fullPath(r) });
  }
  for (const c of dom.children(r)) walk(c);
})(dom.rootRef);

const toLocal = (b, p) => {
  const d = [p[0] - b.t[0], p[1] - b.t[1], p[2] - b.t[2]];
  const R = b.R;
  return [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2],
          R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2],
          R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];
};
const inside = (b, p) => { const l = toLocal(b, p); return Math.abs(l[0]) <= b.size[0] / 2 && Math.abs(l[1]) <= b.size[1] / 2 && Math.abs(l[2]) <= b.size[2] / 2; };
function floorUnder(p) {
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
}

function walkPath(label, from, to, eye) {
  console.log("МАРШРУТ: " + label);
  let prev = null, worst = { step: 0 }, blocked = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const a = i / N;
    const x = from[0] + (to[0] - from[0]) * a;
    const z = from[2] + (to[2] - from[2]) * a;
    // стартовая высота: берём пол под точкой на уровне прошлого шага
    const probeY = prev === null ? from[1] : prev.y + 3.5;
    const hit = floorUnder([x, probeY + eye, z]);
    if (!hit) { console.log("  z=" + z.toFixed(1) + " — пол не найден (падение)"); blocked++; prev = null; continue; }
    const step = prev ? hit.y - prev.y : 0;
    if (prev && Math.abs(step) > worst.step) worst = { step, z, name: hit.name };
    if (i % 10 === 0 || (prev && Math.abs(step) > 3)) {
      console.log("  z=" + z.toFixed(1).padStart(6) + "  пол " + hit.name.padEnd(14) + " y=" + hit.y.toFixed(1).padStart(7) + (prev ? "   шаг " + (step > 0 ? "+" : "") + step.toFixed(1) : ""));
    }
    prev = hit;
  }
  console.log("  максимальный перепад: " + worst.step.toFixed(1) + " у " + (worst.z !== undefined ? "z=" + worst.z.toFixed(1) + " (" + worst.name + ")" : "—") + " · обрывов: " + blocked);
}

// из спавна по площади к устью пандуса и вниз в лабораторию
walkPath("спавн → устье пандуса", [0, 0.5, 52], [0, 0.5, 118], 3);
walkPath("устье → лаборатория", [0, -0.5, 117], [0, -70, 10], 3);
walkPath("лаборатория: вдоль зала", [0, -70, 20], [0, -70, -60], 3);
walkPath("площадь: спавн → хаб порталов", [0, 0.5, 52], [0, 0.5, -70], 3);
walkPath("площадь: спавн → Рик Прайм", [0, 0.5, 52], [0, 5, -30], 3);
