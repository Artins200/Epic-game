#!/usr/bin/env python3
"""Независимая проверка готового APK без Android SDK.

Что проверяется:
  1. ZIP: End of Central Directory, целостность записей, ЦС, подпись ZIP.
  2. APK Signing Block: магия, размеры, пары ID-value.
  3. Подпись схемы v2 (0x7109871a) и v3 (0xf05368c0):
       - подпись `signed data` ключом из сертификата (RSASSA-PKCS1-v1_5 / PSS / ECDSA),
       - совпадение списка algorithm ID в `digests` и `signatures`,
       - пересчёт digest содержимого APK (0xa5/0x5a-схема, 1 МиБ) и сверка,
       - совпадение SubjectPublicKeyInfo сертификата и `public key`.
  4. Схема v1 (JAR): META-INF/MANIFEST.MF, CERT.SF, CERT.RSA.
  5. AndroidManifest.xml: разбор бинарного AXML (собственный парсер).
  6. classes.dex: контрольные суммы заголовка, размер, списки классов/методов.
  7. Требования установки: resources.arsc без сжатия и выровнен (targetSdk 30+),
     отсутствие лишних байт после EOCD.

usage: python3 tools/verify_apk.py [apk]        (нужен пакет cryptography)
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import struct
import sys
import zipfile
from pathlib import Path

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding
from cryptography.hazmat.primitives.serialization import pkcs7

OK, FAIL = "\033[32m✓\033[0m", "\033[31m✗\033[0m"
problems: list[str] = []


def check(cond: bool, msg: str, detail: str = "") -> bool:
    if cond:
        print(f"  {OK} {msg}" + (f" — {detail}" if detail else ""))
    else:
        print(f"  {FAIL} {msg}" + (f" — {detail}" if detail else ""))
        problems.append(msg + (f": {detail}" if detail else ""))
    return cond


# --------------------------------------------------------------------- ZIP
EOCD_SIG = b"PK\x05\x06"
SIGNING_BLOCK_MAGIC = b"APK Sig Block 42"


def find_eocd(data: bytes) -> tuple[int, int]:
    """Возвращает (offset EOCD, offset Central Directory). Бросает при ошибке."""
    limit = max(0, len(data) - 65557)
    pos = len(data)
    while True:
        pos = data.rfind(EOCD_SIG, limit, pos)
        if pos < 0:
            raise ValueError("нет ZIP End of Central Directory")
        if pos + 22 > len(data):
            continue
        comment_len = struct.unpack_from("<H", data, pos + 20)[0]
        if pos + 22 + comment_len != len(data):
            continue  # ложное совпадение сигнатуры внутри данных
        cd_off = struct.unpack_from("<I", data, pos + 16)[0]
        return pos, cd_off


def parse_central_directory(data: bytes, cd_off: int, eocd_off: int) -> list[dict]:
    entries, p = [], cd_off
    while p < eocd_off and data[p:p + 4] == b"PK\x01\x02":
        (_, ver, flags, method, mtime, mdate, crc, csize, usize, nlen, elen, clen,
         disk, iattr, eattr, lho) = struct.unpack_from("<HHHHHHIIIHHHHHII", data, p + 4)
        name = data[p + 46:p + 46 + nlen].decode("utf-8", "replace")
        entry = dict(name=name, method=method, crc=crc, csize=csize, usize=usize,
                     local_header_off=lho, cd_off=p,
                     cd_len=46 + nlen + elen + clen, flags=flags)
        # реальные смещения данных из локального заголовка
        if data[lho:lho + 4] == b"PK\x03\x04":
            ln, le = struct.unpack_from("<HH", data, lho + 26)
            entry["data_off"] = lho + 30 + ln + le
        entries.append(entry)
        p += 46 + nlen + elen + clen
    return entries


# ------------------------------------------------------- APK Signing Block
def parse_signing_block(data: bytes, cd_off: int) -> tuple[int, dict[int, bytes]]:
    """Возвращает (смещение начала блока, {id: value})."""
    if data[cd_off - 16:cd_off] != SIGNING_BLOCK_MAGIC:
        raise ValueError("нет APK Signing Block (магии перед Central Directory)")
    size = struct.unpack_from("<Q", data, cd_off - 24)[0]   # второе поле размера = S
    block_start = cd_off - size - 8                        # расположение: [S][pairs][S][magic]
    first = struct.unpack_from("<Q", data, block_start)[0]
    if first != size:
        raise ValueError("несовпадение двух полей размера в APK Signing Block")
    pairs: dict[int, bytes] = {}
    p = block_start + 8
    end = cd_off - 24
    while p < end:
        pair_len = struct.unpack_from("<Q", data, p)[0]
        pid = struct.unpack_from("<I", data, p + 8)[0]
        pairs[pid] = data[p + 12:p + 8 + pair_len]
        p += 8 + pair_len
    return block_start, pairs


def read_lp(buf: bytes, p: int) -> tuple[bytes, int]:
    n = struct.unpack_from("<I", buf, p)[0]
    return buf[p + 4:p + 4 + n], p + 4 + n


def read_lp_entries(buf: bytes, p: int) -> tuple[list[bytes], int]:
    """length-prefixed последовательность length-prefixed элементов: u32 total, затем элементы."""
    total = struct.unpack_from("<I", buf, p)[0]
    end = p + 4 + total
    p += 4
    items = []
    while p < end:
        item, p = read_lp(buf, p)
        items.append(item)
    return items, end


SIG_ALGS = {  # id -> (хеш, описание)
    0x0101: ("sha256", "RSASSA-PSS/SHA-256"),
    0x0102: ("sha512", "RSASSA-PSS/SHA-512"),
    0x0103: ("sha256", "RSASSA-PKCS1-v1_5/SHA-256"),
    0x0104: ("sha512", "RSASSA-PKCS1-v1_5/SHA-512"),
    0x0201: ("sha256", "ECDSA/SHA-256"),
    0x0202: ("sha512", "ECDSA/SHA-512"),
    0x0301: ("sha256", "DSA/SHA-256"),
}
_HASHES = {"sha256": hashes.SHA256, "sha512": hashes.SHA512}
CHUNK = 1024 * 1024


def content_digest(data: bytes, block_start: int, cd_off: int, eocd_off: int, hash_name: str) -> bytes:
    """Digest разделов 1, 3 и 4 (раздел 2 — сам блок — исключён)."""
    eocd = bytearray(data[eocd_off:])
    struct.pack_into("<I", eocd, 16, block_start)  # поле «offset of Central Directory» → начало блока
    sections = [memoryview(data)[:block_start],
                memoryview(data)[cd_off:eocd_off],
                memoryview(bytes(eocd))]
    chunk_digests = []
    h = lambda: hashlib.new(hash_name)
    for sec in sections:
        if len(sec) == 0:
            continue
        for i in range(0, len(sec), CHUNK):
            chunk = bytes(sec[i:i + CHUNK])
            m = h()
            m.update(b"\xa5" + struct.pack("<I", len(chunk)) + chunk)
            chunk_digests.append(m.digest())
    m = h()
    m.update(b"\x5a" + struct.pack("<I", len(chunk_digests)) + b"".join(chunk_digests))
    return m.digest()


def verify_signature(pub, alg_id: int, signature: bytes, signed_data: bytes) -> bool:
    hash_name, desc = SIG_ALGS[alg_id]
    h = _HASHES[hash_name]()
    try:
        if alg_id in (0x0101, 0x0102):     # PSS
            pub.verify(signature, signed_data,
                       padding.PSS(mgf=padding.MGF1(h), salt_length=h.digest_size), h)
        elif alg_id in (0x0103, 0x0104):   # PKCS#1 v1.5
            pub.verify(signature, signed_data, padding.PKCS1v15(), h)
        elif alg_id in (0x0201, 0x0202):
            pub.verify(signature, signed_data, ec.ECDSA(h))
        else:
            return False
        return True
    except InvalidSignature:
        return False


def verify_scheme(pairs: dict[int, bytes], scheme_id: int, name: str, data: bytes,
                  block_start: int, cd_off: int, eocd_off: int) -> bool:
    print(f"[{name}] блок 0x{scheme_id:08x}")
    if scheme_id not in pairs:
        return check(False, f"{name}: блок присутствует")
    value = pairs[scheme_id]
    signers, _ = read_lp_entries(value, 0)
    check(len(signers) > 0, f"{name}: есть подписанты", f"{len(signers)}")
    all_ok = True
    for si, signer in enumerate(signers):
        p = 0
        signed_data, p = read_lp(signer, p)
        if scheme_id == 0xf05368c0:
            # v3: minSdkVersion/maxSdkVersion идут сразу за signed data
            # (ApkSignatureSchemeV3Verifier.verifySigner: getInt(), getInt())
            signer_min, signer_max = struct.unpack_from("<II", signer, p)
            p += 8
        else:
            signer_min = signer_max = None
        signatures, p = read_lp_entries(signer, p)
        public_key, p = read_lp(signer, p)

        # --- разбор signed data
        sp = 0
        digests, sp = read_lp_entries(signed_data, sp)
        certs, sp = read_lp_entries(signed_data, sp)
        if scheme_id == 0xf05368c0:
            sd_min, sd_max = struct.unpack_from("<II", signed_data, sp)
            sp += 8
        attrs, sp = read_lp_entries(signed_data, sp)
        # AOSP-верификатор не требует вычитывания signed data до конца (apksig оставляет
        # за собой байты), поэтому это информационная строка, а не ошибка.
        print(f"     signed data: разобрано {sp} из {len(signed_data)} байт, "
              f"доп. атрибутов: {len(attrs)}")
        check(len(certs) > 0, f"{name}: сертификаты", f"{len(certs)}")
        cert = x509.load_der_x509_certificate(certs[0])
        pub = cert.public_key()
        spki = cert.public_bytes(serialization.Encoding.DER)

        # --- public key в блоке = SubjectPublicKeyInfo первого сертификата
        check(public_key == _spki_from_cert(cert),
              f"{name}: public key совпадает с сертификатом")
        if scheme_id == 0xf05368c0:
            check((signer_min, signer_max) == (sd_min, sd_max),
                  f"{name}: minSdk/maxSdk внутри и вне signed data совпадают",
                  f"{signer_min}..{signer_max}")

        # --- подпись
        alg_ids_in_sigs, alg_ids_in_digests = [], []
        verified = False
        for sig_item in signatures:
            alg_id = struct.unpack_from("<I", sig_item, 0)[0]
            sig, _ = read_lp(sig_item, 4)
            alg_ids_in_sigs.append(alg_id)
            if alg_id not in SIG_ALGS:
                continue
            hash_name, desc = SIG_ALGS[alg_id]
            if verify_signature(pub, alg_id, sig, signed_data):
                verified = True
                digest = content_digest(data, block_start, cd_off, eocd_off, hash_name)
                expected = None
                for d in digests:
                    d_alg = struct.unpack_from("<I", d, 0)[0]
                    d_val, _ = read_lp(d, 4)
                    alg_ids_in_digests.append(d_alg)
                    if d_alg == alg_id:
                        expected = d_val
                ok_digest = expected == digest
                check(ok_digest, f"{name}: digest содержимого APK совпадает ({desc})",
                      f"{digest.hex()[:16]}…" + ("" if ok_digest else f" ≠ {expected.hex()[:16] if expected else 'нет'}…"))
                break
        check(verified, f"{name}: подпись signed data верна")
        check(alg_ids_in_sigs == alg_ids_in_digests or not alg_ids_in_digests,
              f"{name}: список algorithm ID в digests и signatures", str(alg_ids_in_sigs))
        all_ok &= verified
        cn = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
        print(f"     сертификат: {cn[0].value if cn else '?'}, "
              f"действителен до {cert.not_valid_after_utc.date()}")
    return all_ok


def _spki_from_cert(cert) -> bytes:
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    return cert.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)


# ------------------------------------------------------------------- v1 JAR
def verify_v1(apk: Path, data: bytes) -> None:
    print("[v1 JAR] META-INF/MANIFEST.MF, CERT.SF, CERT.RSA")
    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
        mf_names = [n for n in names if n.upper() == "META-INF/MANIFEST.MF"]
        check(bool(mf_names), "v1: есть META-INF/MANIFEST.MF")
        if not mf_names:
            return
        sf_names = [n for n in names if n.upper().startswith("META-INF/") and n.upper().endswith(".SF")]
        rsa_names = [n for n in names if n.upper().startswith("META-INF/")
                     and n.upper().endswith((".RSA", ".DSA", ".EC"))]
        check(bool(sf_names) and bool(rsa_names), "v1: есть .SF и блок подписи",
              f"{sf_names} {rsa_names}")
        if not (sf_names and rsa_names):
            return
        mf = z.read(mf_names[0])
        sf = z.read(sf_names[0])
        block = z.read(rsa_names[0])

        # digest секций MANIFEST.MF против содержимого записей
        sections = _parse_manifest(mf)
        bad = []
        for name, digests in sections.items():
            try:
                content = z.read(name)
            except KeyError:
                bad.append(name)
                continue
            want = digests.get("SHA-256") or digests.get("SHA-1")
            alg = "sha256" if "SHA-256" in digests else "sha1"
            got = hashlib.new(alg, content).digest()
            if got != want:
                bad.append(name)
        check(not bad, f"v1: digest записей в MANIFEST.MF", f"{len(sections)} записей"
              + (f", плохие: {bad[:3]}" if bad else ""))

        # X-Android-APK-Signed
        signed_attr = _sf_attr(sf, b"X-Android-APK-Signed")
        print(f"     X-Android-APK-Signed: {signed_attr.decode() if signed_attr else 'нет'}")

        # CERT.RSA: PKCS#7 detached-подпись над .SF
        certs = pkcs7.load_der_pkcs7_certificates(block)
        check(bool(certs), "v1: сертификат в блоке подписи",
              str(certs[0].subject.rfc4514_string()) if certs else "")
        ok, why = _verify_jar_signature(block, sf, certs[0] if certs else None)
        check(ok, "v1: подпись PKCS#7 над CERT.SF", why)


# --- разбор DER/PKCS#7 без внешних зависимостей ---------------------------
OID_SIGNED_DATA = bytes.fromhex("2a864886f70d010702")
OID_MESSAGE_DIGEST = bytes.fromhex("2a864886f70d010904")
_DIGEST_OIDS = {bytes.fromhex("608648016503040201"): hashes.SHA256,
                bytes.fromhex("608648016503040202"): hashes.SHA384,
                bytes.fromhex("608648016503040203"): hashes.SHA512,
                bytes.fromhex("2b0e03021a"): hashes.SHA1}


def _tlv(buf: bytes, p: int) -> tuple[int, int, int, int]:
    """(tag, начало заголовка, начало содержимого, конец содержимого)."""
    p0 = p
    tag = buf[p]
    p += 1
    ln = buf[p]
    p += 1
    if ln & 0x80:
        n = ln & 0x7F
        ln = int.from_bytes(buf[p:p + n], "big")
        p += n
    if p + ln > len(buf):
        raise ValueError("повреждённый DER: выход за границы")
    return tag, p0, p, p + ln


def _verify_jar_signature(block: bytes, sf: bytes, cert) -> tuple[bool, str]:
    """Проверка PKCS#7 (CERT.RSA) по алгоритму JAR-подписи: подпись над signed attributes."""
    if cert is None:
        return False, "нет сертификата"
    try:
        # ContentInfo SEQUENCE { OID signedData, [0] EXPLICIT { SignedData } }
        _, _, cs, _ = _tlv(block, 0)
        tag, _, ocs, oce = _tlv(block, cs)
        if block[ocs:oce] != OID_SIGNED_DATA:
            return False, "объект не PKCS#7 SignedData"
        _, _, ecs, _ = _tlv(block, oce)              # [0] EXPLICIT
        _, _, p, sd_end = _tlv(block, ecs)           # SignedData SEQUENCE
        _, _, _, p = _tlv(block, p)                  # version → следующий элемент
        _, _, _, p = _tlv(block, p)                  # digestAlgorithms SET → следующий

        signer = None
        while p < sd_end:                            # ищем signerInfos SET (0x31)
            tag, _, cs, ce = _tlv(block, p)
            if tag == 0x31:
                _, _, scs, sce = _tlv(block, cs)     # первый SignerInfo SEQUENCE
                signer = (scs, sce)
                break
            p = ce
        if signer is None:
            return False, "нет SignerInfo"

        # Поля SignerInfo ищем по смыслу (порядок у разных инструментов отличается)
        sp, sp_end = signer
        digest_oid = attrs_der = signature = None
        while sp < sp_end:
            tag, hs, cs, ce = _tlv(block, sp)
            if tag == 0xA0:                          # signedAttrs [0] IMPLICIT SET OF
                attrs_der = b"\x31" + block[hs + 1:ce]
            elif tag == 0x04:                        # signature OCTET STRING
                signature = block[cs:ce]
            elif tag == 0x30:                        # sid / digestAlgorithm / signatureAlgorithm
                try:
                    ot, _, ocs, oce = _tlv(block, cs)
                except ValueError:
                    ot = None
                if ot == 0x06:
                    oid = block[ocs:oce]
                    if digest_oid is None and oid in _DIGEST_OIDS:
                        digest_oid = oid
            sp = ce
        if signature is None:
            return False, "нет поля signature"

        digest_cls = _DIGEST_OIDS.get(digest_oid)
        if digest_cls is None:
            return False, f"неизвестный digestAlgorithm {digest_oid.hex()}"

        if attrs_der is None:
            # вариант без signed attributes: подпись непосредственно над содержимым CERT.SF
            cert.public_key().verify(signature, sf, padding.PKCS1v15(), digest_cls())
            return True, f"{digest_cls.name}: подпись над CERT.SF (без signed attributes)"

        # messageDigest в атрибутах обязан равняться digest .SF
        found = _find_attr_value(attrs_der, OID_MESSAGE_DIGEST)
        if found is None:
            return False, "нет атрибута messageDigest"
        want = hashlib.new(digest_cls.name, sf).digest()
        if found != want:
            return False, "messageDigest ≠ digest(CERT.SF)"

        cert.public_key().verify(signature, attrs_der, padding.PKCS1v15(), digest_cls())
        return True, f"{digest_cls.name}: подпись и messageDigest(CERT.SF) сходятся"
    except InvalidSignature:
        return False, "подпись не сходится"
    except Exception as e:  # noqa: BLE001
        return False, f"разбор PKCS#7: {e!r}"


def _find_attr_value(attrs_der: bytes, oid: bytes) -> bytes | None:
    """Значение (OCTET STRING) атрибута с данным OID в signed attributes."""
    _, _, p, end = _tlv(attrs_der, 0)
    while p < end:
        _, _, ap, ae = _tlv(attrs_der, p)            # Attribute SEQUENCE
        _, _, oid_p, oid_e = _tlv(attrs_der, ap)     # OID
        if attrs_der[oid_p:oid_e] == oid:
            _, _, sp, _ = _tlv(attrs_der, oid_e)     # SET OF
            _, _, vp, ve = _tlv(attrs_der, sp)       # значение
            return attrs_der[vp:ve]
        p = ae
    return None


def _parse_manifest(mf: bytes) -> dict[str, dict[str, bytes]]:
    """Разбор MANIFEST.MF с учётом переноса длинных строк (продолжение начинается с пробела)."""
    import base64
    text = mf.decode("utf-8", "replace").replace("\r\n", "\n").replace("\r", "\n")
    logical: list[str] = []
    for raw in text.split("\n"):
        if raw.startswith(" ") and logical:
            logical[-1] += raw[1:]          # склейка перенесённой строки
        elif raw.strip():
            logical.append(raw)
    out: dict[str, dict[str, bytes]] = {}
    cur = None
    for line in logical:
        key, _, val = line.partition(": ")
        if key == "Name":
            cur = val
            out[cur] = {}
        elif cur and key.endswith("Digest"):
            name = "SHA-256" if "256" in key else "SHA-1"
            out[cur][name] = base64.b64decode(val)
    return out


def _sf_attr(sf: bytes, attr: bytes) -> bytes | None:
    for line in sf.replace(b"\r\n", b"\n").split(b"\n"):
        if line.lower().startswith(attr.lower() + b":"):
            return line.split(b":", 1)[1].strip()
    return None


# ------------------------------------------------------------------- AXML
def parse_axml(buf: bytes) -> str:
    """Разбор бинарного AndroidManifest.xml: возвращает дерево в виде текста."""
    if struct.unpack_from("<H", buf, 0)[0] != 0x0003:
        raise ValueError("это не бинарный AXML (RES_XML_TYPE)")
    pool: list[str] = []
    tree: list[str] = []
    depth = 0
    p = 8
    while p < len(buf):
        kind, hsize, size = struct.unpack_from("<HHI", buf, p)
        if size == 0:
            break
        if kind == 0x0001:  # строковый пул
            str_count, style_count, flags, str_start = struct.unpack_from("<IIII", buf, p + 8)
            utf8 = bool(flags & (1 << 8))
            offsets = struct.unpack_from("<%dI" % str_count, buf, p + 28)
            for off in offsets:
                sp = p + str_start + off
                if utf8:
                    raise ValueError("UTF-8 строковый пул не поддерживается (у нас UTF-16)")
                else:
                    ln = struct.unpack_from("<H", buf, sp)[0]
                    raw = buf[sp + 2:sp + 2 + ln * 2]
                    pool.append(raw.decode("utf-16-le", "replace"))
        elif kind == 0x0102:  # START_ELEMENT
            ns, name_idx = struct.unpack_from("<II", buf, p + 16)
            attr_count = struct.unpack_from("<H", buf, p + 28)[0]
            name = pool[name_idx] if name_idx < len(pool) else f"#{name_idx}"
            attrs = []
            ap = p + 36
            for _ in range(attr_count):
                a_ns, a_name, a_raw = struct.unpack_from("<III", buf, ap)
                a_type = buf[ap + 15]
                a_data = struct.unpack_from("<I", buf, ap + 16)[0]
                key = pool[a_name] if a_name < len(pool) else f"#{a_name}"
                if a_type == 0x03:
                    val = pool[a_data] if a_data < len(pool) else f"#{a_data}"
                elif a_type == 0x12:
                    val = "true" if a_data else "false"
                elif a_type == 0x11:
                    val = hex(a_data)
                else:
                    val = str(a_data if a_data < 0x80000000 else a_data - 0x100000000)
                attrs.append(f"android:{key}={val!r}" if a_ns else f"{key}={val!r}")
                ap += 20
            tree.append("  " * depth + f"<{name} " + " ".join(attrs) + ">")
            depth += 1
        elif kind == 0x0103:  # END_ELEMENT
            depth -= 1
        p += size
    return "\n".join(tree)


# ------------------------------------------------------------------- DEX
def verify_dex(data: bytes, classes: list[str]) -> None:
    print("[classes.dex]")
    check(data[:8] == b"dex\n035\x00" or data[:4] == b"dex\n", "dex: магия", repr(data[:8]))
    file_size = struct.unpack_from("<I", data, 32)[0]
    check(file_size == len(data), "dex: file_size совпадает", f"{file_size} = {len(data)}")
    want_sha1 = data[12:32]
    got_sha1 = hashlib.sha1(data[32:]).digest()
    check(want_sha1 == got_sha1, "dex: SHA-1 подпись заголовка")
    want_adler = struct.unpack_from("<I", data, 8)[0]
    got_adler = _adler32(data[12:])
    check(want_adler == got_adler, "dex: adler32 контрольная сумма", hex(got_adler))
    for cls in classes:
        check(cls in data, f"dex: класс {cls.decode()} присутствует")


def _adler32(buf: bytes) -> int:
    a, b = 1, 0
    for byte in buf:
        a = (a + byte) % 65521
        b = (b + a) % 65521
    return (b << 16) | a


# ------------------------------------------------------------------- main
def main() -> int:
    apk = Path(sys.argv[1] if len(sys.argv) > 1 else
               Path(__file__).resolve().parent.parent / "dist" / "Liminal-VR.apk")
    data = apk.read_bytes()
    print(f"APK: {apk}  {len(data) / 1e6:.1f} MB  sha256={hashlib.sha256(data).hexdigest()[:16]}…\n")

    print("[ZIP]")
    eocd_off, cd_off = find_eocd(data)
    check(True, "ZIP: EOCD найден, файл им заканчивается", f"offset {eocd_off}, CD {cd_off}")
    entries = parse_central_directory(data, cd_off, eocd_off)
    check(len(entries) > 0, "ZIP: записи в Central Directory", str(len(entries)))
    with zipfile.ZipFile(apk) as z:
        bad = z.testzip()
    check(bad is None, "ZIP: CRC всех записей", bad or "ок")

    print("\n[APK Signing Block]")
    block_start, pairs = parse_signing_block(data, cd_off)
    check(True, "блок разобран", f"начало {block_start}, пар: {len(pairs)}, "
          f"ID: {', '.join('0x%08x' % k for k in pairs)}")

    print()
    v2 = verify_scheme(pairs, 0x7109871a, "v2", data, block_start, cd_off, eocd_off)
    v3 = verify_scheme(pairs, 0xf05368c0, "v3", data, block_start, cd_off, eocd_off)

    print("\n[v1]")
    verify_v1(apk, data)

    print("\n[AndroidManifest.xml]")
    try:
        with zipfile.ZipFile(apk) as z:
            raw = z.read("AndroidManifest.xml")
        check(True, "манифест: бинарный AXML прочитан")
        tree = parse_axml(raw)
        check("manifest" in tree and "application" in tree and "activity" in tree,
              "манифест: структура manifest/application/activity")
        print("\n".join("     " + l for l in tree.splitlines()))
        check('android:name=\'com.liminal.vr.MainActivity\'' in tree or
              "com.liminal.vr.MainActivity" in tree, "манифест: главная Activity")
        check("android.permission.CAMERA" in tree, "манифест: разрешение CAMERA")
    except Exception as e:  # noqa: BLE001
        check(False, "манифест разобран", repr(e))

    print("\n[classes.dex]")
    with zipfile.ZipFile(apk) as z:
        verify_dex(z.read("classes.dex"), [b"Lcom/liminal/vr/MainActivity;",
                                           b"Lcom/liminal/vr/VrWebViewClient;",
                                           b"Lcom/liminal/vr/VrWebChromeClient;"])

    print("\n[требования установки]")
    with zipfile.ZipFile(apk) as z:
        infos = z.infolist()
        arsc = [i for i in infos if i.filename == "resources.arsc"]
        if arsc:
            i = arsc[0]
            check(i.compress_type == zipfile.ZIP_STORED, "resources.arsc без сжатия (targetSdk 30+)")
            off = entries[[e["name"] for e in entries].index("resources.arsc")]["data_off"]
            check(off % 4 == 0, "resources.arsc выровнен на 4 байта", f"offset {off}")
        else:
            print("     resources.arsc отсутствует (ресурсов нет — правило не применяется)")
        so = [i for i in infos if i.filename.endswith(".so")]
        if so:
            print(f"     .so файлов: {len(so)} (для API 23+ нужны выровненными по 4096)")
        check(any(i.filename == "assets/index.html" for i in infos), "assets/index.html внутри APK")
        check(any(i.filename.startswith("assets/vendor/mediapipe/hands/") for i in infos),
              "MediaPipe Hands внутри APK")
        check(any(i.filename.startswith("assets/vendor/three/three.module.js") for i in infos),
              "three.js внутри APK")
        total = sum(i.file_size for i in infos)
        print(f"     записей: {len(infos)}, распакованный размер {total / 1e6:.1f} MB")

    print()
    if problems:
        print(f"\033[31mПРОБЛЕМЫ ({len(problems)}):\033[0m")
        for p in problems:
            print("  -", p)
        return 1
    print(f"\033[32mВСЕ ПРОВЕРКИ ПРОШЛИ\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
