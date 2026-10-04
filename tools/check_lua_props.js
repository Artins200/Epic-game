/* Проверяет имена свойств, которые Lua-скрипты присваивают инстансам:
   каждое имя должно существовать хотя бы у одного класса Roblox. */
const fs = require("fs");
const path = require("path");
const { reflection } = require("rbx-dom");

const all = new Set();
for (const cls of reflection.classNames()) {
  const c = reflection.class(cls);
  for (const [k, p] of Object.entries(c.Properties || {})) {
    const ser = p.Kind && p.Kind.Canonical && p.Kind.Canonical.Serialization;
    if (ser === "DoesNotSerialize") continue;
    all.add(k); all.add(p.Name);
    if (ser && typeof ser === "object") {
      if (ser.SerializesAs) all.add(ser.SerializesAs);
      if (ser.Migrate && ser.Migrate.To) all.add(ser.Migrate.To);
    }
  }
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".lua")) files.push(p);
  }
})(path.join(__dirname, "..", "src"));

// поля таблиц-описателей в src — не Roblox-свойства, а ключи наших же структур
const ignore = new Set([
  "Palette", "Radius", "Kind", "Scale", "Speed", "Axis", "MinTransparency", "MaxTransparency",
  "Amplitude", "CenterX", "CenterY", "CenterZ", "StartAngle", "Swirl", "LinkTo", "Muzzle",
  "Vial", "WorldClientSource", "Source", "Parent",
]);

let bad = 0, total = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const re = /(?:^|[^A-Za-z0-9_.])([a-z_][A-Za-z0-9_]*|s|e|part|light|beam|t|hum|cfg|value|model)\.([A-Z][A-Za-z0-9_]*)\s*=/g;
    const re2 = /^\s*([A-Z][A-Za-z0-9_]*)\s*=/gm;
    let m;
    while ((m = re.exec(line))) {
      total++;
      if (!all.has(m[2]) && !ignore.has(m[2])) { console.log("  " + f + ":" + (i + 1) + " — " + m[1] + "." + m[2] + " нет ни у одного класса"); bad++; }
    }
    re2.lastIndex = 0;
    while ((m = re2.exec(line))) {
      total++;
      if (!all.has(m[1]) && !ignore.has(m[1])) { console.log("  " + f + ":" + (i + 1) + " — ключ " + m[1] + " не похож на свойство Roblox"); bad++; }
    }
  });
}
console.log("Проверено присваиваний:", total, "· подозрительных:", bad);
