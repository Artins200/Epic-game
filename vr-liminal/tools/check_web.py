#!/usr/bin/env python3
"""Статическая проверка web/-приложения до сборки APK.

Проверяет:
  * все ссылки из index.html (script/link/img) существуют;
  * все селекторы $('#id') и data-hud-поля из app.js присутствуют в разметке;
  * importmap и вендорные библиотеки на месте;
  * файлы, которые MediaPipe грузит через locateFile, присутствуют;
  * синтаксис JS (через `node --check`).

usage: python3 tools/check_web.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
problems: list[str] = []


def ok(cond: bool, msg: str, detail: str = "") -> None:
    mark = "\033[32m✓\033[0m" if cond else "\033[31m✗\033[0m"
    print(f"  {mark} {msg}" + (f" — {detail}" if detail else ""))
    if not cond:
        problems.append(msg + (f": {detail}" if detail else ""))


def main() -> int:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8")

    print("[ссылки из index.html]")
    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if ref.startswith(("http:", "https:", "//", "#")):
            continue
        # путь относительно web/ (без учёта якоря и query)
        target = (WEB / ref.split("?")[0].split("#")[0]).resolve()
        ok(target.exists(), f"{ref}", "файл есть" if target.exists() else "НЕТ ФАЙЛА")

    print("[importmap / модули]")
    m = re.search(r'"three"\s*:\s*"([^"]+)"', html)
    ok(bool(m), "importmap для three объявлен")
    if m:
        target = (WEB / m.group(1).lstrip("./")).resolve()
        ok(target.exists(), f"vendor three: {m.group(1)}")
    ok("type=\"module\"" in html, "app.js подключён как module")

    print("[разметка ↔ код]")
    ids_in_html = set(re.findall(r'id="([^"]+)"', html))
    used_ids = set(re.findall(r"""\$\(['"]#([\w-]+)['"]\)""", js))
    missing = sorted(used_ids - ids_in_html)
    ok(not missing, "все $('#id') из app.js есть в index.html",
       f"используется {len(used_ids)} id" + (f", нет: {missing}" if missing else ""))

    hud_in_html = set(re.findall(r'data-hud="([\w-]+)"', html))
    hud_in_js = set(re.findall(r"""data-hud=['"]?([\w-]+)""", js)) | \
        set(re.findall(r"""querySelector\(['"][^'"]*\[data-hud="?([\w-]+)""", js))
    missing_hud = sorted(hud_in_js - hud_in_html)
    ok(not missing_hud, "поля data-hud совпадают", f"в шаблоне: {sorted(hud_in_html)}"
       + (f", нет: {missing_hud}" if missing_hud else ""))

    print("[MediaPipe: файлы, запрашиваемые по locateFile]")
    mp = WEB / "vendor" / "mediapipe" / "hands"
    ok(mp.exists(), "каталог vendor/mediapipe/hands")
    expected = ["hands.js", "hands_solution_packed_assets_loader.js", "hands_solution_packed_assets.data",
                "hands_solution_simd_wasm_bin.js", "hands_solution_simd_wasm_bin.wasm",
                "hands_solution_wasm_bin.js", "hands_solution_wasm_bin.wasm",
                "hand_landmark_full.tflite", "hand_landmark_lite.tflite", "hands.binarypb"]
    for name in expected:
        p = mp / name
        ok(p.exists() and p.stat().st_size > 0, f"mediapipe/{name}",
           f"{p.stat().st_size:,} Б" if p.exists() else "НЕТ")

    print("[синтаксис JS]")
    for name in ("app.js",):
        tmp = Path("/tmp") / (name.replace(".js", ".mjs"))
        tmp.write_text(js, encoding="utf-8")
        r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
        ok(r.returncode == 0, f"node --check {name}", r.stderr.strip().splitlines()[0] if r.returncode else "")
    r = subprocess.run(["node", "--check", str(mp / "hands.js")], capture_output=True, text=True)
    ok(r.returncode == 0, "node --check vendor/.../hands.js",
       r.stderr.strip().splitlines()[0] if r.returncode else "")

    print()
    if problems:
        print(f"\033[31mПРОБЛЕМЫ ({len(problems)}):\033[0m")
        for p in problems:
            print("  -", p)
        return 1
    print("\033[32mВЕБ-ЧАСТЬ ОК\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
