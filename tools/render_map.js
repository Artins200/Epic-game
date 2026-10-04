/* Быстрый превью-рендер мира из .rbxlx: вид сверху (карта) и изометрия площади.
   Никаких внешних зависимостей — только zlib из Node для PNG. */
const fs = require("fs");
const zlib = require("zlib");
const { readXml } = require("rbx-dom");

const FILE = process.argv[2] || "/home/user/Epic-game/RickAndMorty_Portals.rbxlx";
const dom = readXml(fs.readFileSync(FILE), { propertyBehavior: "errorOnUnknown" });
const snap = (r) => dom.instance(r);
const unwrap = (v) => (v === null || typeof v !== "object" ? v : Object.keys(v).length === 1 ? unwrap(v[Object.keys(v)[0]]) : v);
const val = (r, p) => (snap(r).properties[p] === undefined ? undefined : unwrap(snap(r).properties[p]));

const parts = [];
(function walk(r) {
  const i = snap(r);
  if (["Part", "WedgePart", "SpawnLocation", "TrussPart"].includes(i.className)) {
    const cf = val(r, "CFrame");
    const size = val(r, "Size");
    if (cf && size && (val(r, "Transparency") || 0) < 0.98) {
      parts.push({
        name: i.name, t: cf.position, R: cf.orientation, size,
        color: val(r, "Color") || [163, 162, 165],
        transparency: val(r, "Transparency") || 0,
        material: val(r, "Material"),
        path: dom.fullPath(r),
      });
    }
  }
  for (const c of dom.children(r)) walk(c);
})(dom.rootRef);

// ---------------------------------------------------------------- PNG
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

// ---------------------------------------------------------------- камера
function makeCamera(mode, span) {
  if (mode === "top") {
    return (p) => [(p[0] / span) * 0.5 + 0.5, 0.5 - (p[2] / span) * 0.5]; // x → вправо, −z → вверх
  }
  // изометрия: смотрим на площадь
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const cx = 0, cy = 30, cz = 0;
  return (p, depthOut) => {
    const x = p[0] - cx, y = p[1] - cy, z = p[2] - cz;
    const sx = x * c - z * c;
    const sy = -y * 0.9 + (x + z) * s * 0.5;
    if (depthOut) depthOut.v = y * 0.8 + (x + z) * 0.5;
    return [sx / span + 0.5, sy / span + 0.5];
  };
}

function render(mode, W, H, span, out, bg) {
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = bg[0]; buf[i * 3 + 1] = bg[1]; buf[i * 3 + 2] = bg[2]; }
  const project = makeCamera(mode, span);
  const items = parts.map((p) => {
    const hx = p.size[0] / 2, hy = p.size[1] / 2, hz = p.size[2] / 2;
    const R = p.R, t = p.t;
    const corners = [];
    let depth = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const l = [sx * hx, sy * hy, sz * hz];
      const w = [
        t[0] + l[0] * R[0][0] + l[1] * R[0][1] + l[2] * R[0][2],
        t[1] + l[0] * R[1][0] + l[1] * R[1][1] + l[2] * R[1][2],
        t[2] + l[0] * R[2][0] + l[1] * R[2][1] + l[2] * R[2][2],
      ];
      const d = { v: 0 };
      const [px, py] = project(w, d);
      depth += d.v;
      corners.push([px * W, py * H]);
    }
    depth /= 8;
    return { ...p, corners, depth };
  }).sort((a, b) => a.depth - b.depth);

  for (const it of items) {
    // выпуклая оболочка (простая: монотонная цепь)
    const pts = it.corners.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    if (hull.length < 3) continue;
    const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    if (x1 < x0 || y1 < y0 || x1 - x0 > W || y1 - y0 > H) continue;
    // освещение: чуть ярче верхние грани
    const shade = 0.72 + Math.min(0.5, Math.max(-0.12, (it.t[1] - 6) / 220));
    const col = [it.color[0] * shade, it.color[1] * shade, it.color[2] * shade];
    const alpha = 1 - it.transparency;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let inside = false;
        for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
          const xi = hull[i][0], yi = hull[i][1], xj = hull[j][0], yj = hull[j][1];
          if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        const o = (y * W + x) * 3;
        buf[o] = Math.min(255, col[0] * alpha + buf[o] * (1 - alpha));
        buf[o + 1] = Math.min(255, col[1] * alpha + buf[o + 1] * (1 - alpha));
        buf[o + 2] = Math.min(255, col[2] * alpha + buf[o + 2] * (1 - alpha));
      }
    }
  }
  const size = writePng(out, W, H, buf);
  console.log("  " + out + " (" + W + "×" + H + ", " + (size / 1024).toFixed(0) + " КБ)");
}

console.log("Деталей для рендера:", parts.length);
render("top", 1100, 1100, 2000, "/home/user/Epic-game/preview_map.png", [10, 12, 20]);
render("iso", 1400, 900, 230, "/home/user/Epic-game/preview_plaza.png", [12, 14, 24]);
