/* Проверяет Enum.*.* и ключевые сервисные вызовы в Lua-исходниках
   против базы рефлексии Roblox (rbx-dom). Ловит опечатки вроде Enum.Font.SciPhi. */
const fs = require("fs");
const path = require("path");
const { reflection } = require("rbx-dom");

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".lua")) files.push(p);
  }
})(path.join(__dirname, "..", "src"));

const custom = {
  RollOffMode: ["InverseTapered", "Inverse", "Linear", "LinearSquare"],
  RenderPriority: ["First", "Input", "Camera", "Character", "Last"],
};

let bad = 0, total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const re = /Enum\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g;
    let m;
    while ((m = re.exec(line))) {
      total++;
      const [, en, item] = m;
      let items = custom[en];
      if (!items) {
        const e = reflection.enum(en);
        items = e && e.items ? Object.keys(e.items) : null;
      }
      if (!items) {
        console.log("  " + f + ":" + (i + 1) + " — нет перечисления Enum." + en);
        bad++;
      } else if (!items.includes(item)) {
        console.log("  " + f + ":" + (i + 1) + " — нет Enum." + en + "." + item);
        bad++;
      }
    }
  });
}
console.log("Проверено обращений к Enum:", total, "· ошибок:", bad);
