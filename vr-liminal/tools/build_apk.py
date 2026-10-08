#!/usr/bin/env python3
"""Сборка Liminal-VR.apk из исходников (smali + AXML + web/).

Конвейер:
  1. smali (android/smali/*.smali) -> classes.dex   (apktool SmaliBuilder через JPype)
  2. AndroidManifest.xml в бинарном виде            (tools/axml.py)
  3. web/ -> assets/                                 (приложение целиком внутри APK)
  4. zip -> unsigned.apk, затем подпись v1+v2+v3     (tools/sign_apk.mjs)

usage: <toolchain>/venv/bin/python tools/build_apk.py   (или python3 tools/build_apk.py после setup)
"""
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TC = Path(os.environ.get("LIMINAL_TOOLCHAIN", Path.home() / ".cache" / "liminal-toolchain"))
PKG = "com.liminal.vr"
ACTIVITY = "com.liminal.vr.MainActivity"
VERSION_CODE = 1
VERSION_NAME = "1.0"
OUT = ROOT / "dist" / "Liminal-VR.apk"
BUILD = ROOT / "build"


def ensure_jpype():
    try:
        import jpype  # noqa: F401
        return
    except ImportError:
        py = TC / "venv" / "bin" / "python"
        if not py.exists():
            sys.exit("Нет тулчейна. Сначала: python3 tools/setup_toolchain.py")
        os.execv(str(py), [str(py), __file__, *sys.argv[1:]])


def check_inputs():
    need = [ROOT / "web" / "vendor" / "three" / "three.module.js",
            ROOT / "web" / "vendor" / "mediapipe" / "hands" / "hands.js"]
    for p in need:
        if not p.exists():
            sys.exit(f"Нет {p}. Запустите: python3 tools/setup_toolchain.py")


def jvm_start():
    import jpype
    jvm = TC / "jre" / "java-runtime" / "lib" / "server" / "libjvm.so"
    if not jpype.isJVMStarted():
        jpype.startJVM(str(jvm), classpath=[str(TC / "jars" / "apktool.jar")], convertStrings=True)


def assemble_dex(smali_dir: Path, out_dex: Path):
    jvm_start()
    from jpype import JClass
    SmaliBuilder = JClass("brut.androlib.src.SmaliBuilder")
    ExtFile = JClass("brut.directory.ExtFile")
    File = JClass("java.io.File")
    out_dex.parent.mkdir(parents=True, exist_ok=True)
    if out_dex.exists():
        out_dex.unlink()
    SmaliBuilder.build(ExtFile(File(str(smali_dir))), File(str(out_dex)), 24)
    if not out_dex.exists():
        sys.exit("smali: classes.dex не создан")
    data = out_dex.read_bytes()
    for name in (b"Lcom/liminal/vr/MainActivity;", b"Lcom/liminal/vr/VrWebViewClient;", b"Lcom/liminal/vr/VrWebChromeClient;"):
        if name not in data:
            sys.exit(f"smali: в dex нет класса {name.decode()}")


def ensure_keys():
    key, cert = TC / "keys" / "liminal-debug.key.pem", TC / "keys" / "liminal-debug.cert.pem"
    if not (key.exists() and cert.exists()):
        sys.exit("Нет ключа подписи. Запустите: python3 tools/setup_toolchain.py")
    return key, cert


def main():
    ensure_jpype()
    check_inputs()
    sys.path.insert(0, str(ROOT / "tools"))
    import axml

    if BUILD.exists():
        shutil.rmtree(BUILD)
    stage = BUILD / "apk"
    stage.mkdir(parents=True)

    # 1. dex
    dex = BUILD / "dex" / "classes.dex"
    assemble_dex(ROOT / "android" / "smali", dex)
    shutil.copy(dex, stage / "classes.dex")

    # 2. манифест
    man = axml.manifest(PKG, VERSION_CODE, VERSION_NAME, 24, 33, "Liminal VR", ACTIVITY)
    (stage / "AndroidManifest.xml").write_bytes(axml.encode_manifest(man))

    # 3. web -> assets
    assets = stage / "assets"
    shutil.copytree(ROOT / "web", assets)

    # 4. zip (несжатые .so/resources не нужны — их нет)
    unsigned = BUILD / "Liminal-VR-unsigned.apk"
    with zipfile.ZipFile(unsigned, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(stage / "AndroidManifest.xml", "AndroidManifest.xml")
        z.write(stage / "classes.dex", "classes.dex")
        for f in sorted(assets.rglob("*")):
            if f.is_file():
                arc = "assets/" + f.relative_to(assets).as_posix()
                # бинарные ассеты (wasm/tflite/data) храним без сжатия — грузятся быстрее
                ctype = zipfile.ZIP_STORED if f.suffix in (".wasm", ".tflite", ".data", ".binarypb") else zipfile.ZIP_DEFLATED
                z.write(f, arc, compress_type=ctype)

    # 5. подпись
    OUT.parent.mkdir(parents=True, exist_ok=True)
    key, cert = ensure_keys()
    run = subprocess.run(["node", str(ROOT / "tools" / "sign_apk.mjs"), str(unsigned), str(OUT), str(key),
                          str(cert), str(TC / "node" / "node_modules" / "apk_sign_ts")])
    if run.returncode != 0:
        sys.exit("подпись не удалась")

    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
    print(f"APK: {OUT}  {OUT.stat().st_size / 1e6:.1f} MB  sha256={digest[:16]}…")


if __name__ == "__main__":
    main()
