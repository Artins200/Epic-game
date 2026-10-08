#!/usr/bin/env python3
"""Скачивает всё, что нужно для сборки APK, только из разрешённых источников (PyPI и npm).

Что ставится в ~/.cache/liminal-toolchain (или $LIMINAL_TOOLCHAIN):
  jre/        Java runtime из PyPI-пакета jdk4py (нужен apktool и keytool)
  venv/       Python-окружение с JPype1 (вызов Java из Python)
  jars/       apktool.jar (smali-ассемблер внутри: сборка .smali -> classes.dex)
  node/       apk_sign_ts (подпись APK v1/v2/v3)
  keys/       отладочный ключ подписи (PEM, создаётся один раз)
и кладёт веб-зависимости в web/vendor: three.js и MediaPipe Hands.

usage: python3 tools/setup_toolchain.py
"""
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TC = Path(os.environ.get("LIMINAL_TOOLCHAIN", Path.home() / ".cache" / "liminal-toolchain"))
THREE = "three@0.186.1"
MEDIAPIPE = "@mediapipe/hands@0.4.1675469240"
APKTOOL = "apktool-jar@2.4.1"
SIGNER = "apk_sign_ts@1.0.1"


KEYGEN = """
import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Liminal VR'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'Liminal')])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=20000)).sign(key, hashes.SHA256()))
open({key!r}, 'wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
open({cert!r}, 'wb').write(cert.public_bytes(serialization.Encoding.PEM))
"""


def run(cmd, **kw):
    print("+", " ".join(map(str, cmd)))
    subprocess.run(cmd, check=True, **kw)


def copy_file(src, dst):
    """Копия с обычными правами (файлы из npm приходят только на чтение)."""
    dst = Path(dst)
    if dst.exists():
        dst.chmod(0o644)
    shutil.copyfile(src, dst)
    dst.chmod(0o644)


def npm_pack(spec, dest):
    dest.mkdir(parents=True, exist_ok=True)
    out = subprocess.run(["npm", "pack", spec, "--silent"], cwd=dest, check=True, capture_output=True, text=True)
    tgz = dest / out.stdout.strip().splitlines()[-1]
    with tarfile.open(tgz) as t:
        t.extractall(dest / "x")
    return dest / "x" / "package"


def main():
    TC.mkdir(parents=True, exist_ok=True)
    (TC / "jars").mkdir(exist_ok=True)
    tmp = Path(tempfile.mkdtemp())

    # 1. JRE из jdk4py
    jre = TC / "jre"
    if not (jre / "java-runtime" / "bin" / "java").exists():
        run([sys.executable, "-m", "pip", "download", "--no-deps", "-q", "-d", str(tmp), "jdk4py==25.0.2.1"])
        whl = next(tmp.glob("jdk4py-*.whl"))
        with zipfile.ZipFile(whl) as z:
            z.extractall(tmp / "jdk4py")
        shutil.rmtree(jre, ignore_errors=True)
        shutil.move(str(tmp / "jdk4py" / "jdk4py" / "java-runtime"), str(jre / "java-runtime"))
    for p in (jre / "java-runtime" / "bin").iterdir():
        p.chmod(p.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    # 2. venv + JPype1
    venv = TC / "venv"
    if not (venv / "bin" / "python").exists():
        run([sys.executable, "-m", "venv", str(venv)])
    run([str(venv / "bin" / "pip"), "install", "-q", "JPype1"])

    # 3. apktool.jar (содержит smali)
    apk_pkg = npm_pack(APKTOOL, tmp / "apktool")
    copy_file(next((apk_pkg / "bin").glob("*.jar")), TC / "jars" / "apktool.jar")

    # 4. apk_sign_ts
    node = TC / "node"
    node.mkdir(exist_ok=True)
    run(["npm", "install", "--no-audit", "--no-fund", "--prefix", str(node), SIGNER])

    # 5. ключ подписи: самоподписанный RSA-2048 в PEM (отладочный, один раз)
    keys = TC / "keys"
    keys.mkdir(exist_ok=True)
    key_pem, cert_pem = keys / "liminal-debug.key.pem", keys / "liminal-debug.cert.pem"
    if not (key_pem.exists() and cert_pem.exists()):
        run([str(venv / "bin" / "pip"), "install", "-q", "cryptography"])
        run([str(venv / "bin" / "python"), "-c", KEYGEN.format(key=str(key_pem), cert=str(cert_pem))])

    # 6. веб-зависимости
    vendor = ROOT / "web" / "vendor"
    three_pkg = npm_pack(THREE, tmp / "three")
    tv = vendor / "three"
    tv.mkdir(parents=True, exist_ok=True)
    for f in ("three.module.js", "three.core.js"):
        copy_file(three_pkg / "build" / f, tv / f)
    copy_file(three_pkg / "LICENSE", tv / "LICENSE.three.txt")
    mp_pkg = npm_pack(MEDIAPIPE, tmp / "mediapipe")
    mv = vendor / "mediapipe" / "hands"
    mv.mkdir(parents=True, exist_ok=True)
    for f in mp_pkg.iterdir():
        if f.suffix in (".md", ".json", ".ts") or f.name == "package.json":
            continue
        copy_file(f, mv / f.name)

    shutil.rmtree(tmp, ignore_errors=True)
    print("toolchain ready:", TC)


if __name__ == "__main__":
    main()
