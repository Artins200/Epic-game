"""Минимальный кодировщик бинарного AndroidManifest.xml (AXML) без aapt/android.jar.

ID атрибутов Android (android:name и т.д.) зашиты в resource map — так же, как это делает aapt.
Проверка результата: aapt2 dump xmltree <apk> AndroidManifest.xml
"""
import struct

ANDROID_NS = "http://schemas.android.com/apk/res/android"

RES_STRING_POOL = 0x0001
RES_XML = 0x0003
RES_XML_START_NS = 0x0100
RES_XML_END_NS = 0x0101
RES_XML_START_EL = 0x0102
RES_XML_END_EL = 0x0103
RES_XML_RESOURCE_MAP = 0x0180

TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_BOOLEAN = 0x12
NONE = 0xFFFFFFFF

# Идентификаторы ресурсов атрибутов платформы
ATTR_IDS = [
    ("versionCode", 0x0101021B),
    ("versionName", 0x0101021C),
    ("minSdkVersion", 0x0101020C),
    ("targetSdkVersion", 0x01010270),
    ("name", 0x01010003),
    ("label", 0x01010001),
    ("hardwareAccelerated", 0x010102D3),
    ("exported", 0x01010010),
    ("screenOrientation", 0x0101001E),
    ("configChanges", 0x0101001F),
]
ATTR_ID = dict(ATTR_IDS)


class _Pool:
    def __init__(self):
        self.strings = []
        self.index = {}

    def add(self, s):
        if s not in self.index:
            self.index[s] = len(self.strings)
            self.strings.append(s)
        return self.index[s]

    def encode(self):
        n = len(self.strings)
        data = bytearray()
        offsets = []
        for s in self.strings:
            offsets.append(len(data))
            enc = s.encode("utf-16-le")
            data += struct.pack("<H", len(s)) + enc + b"\x00\x00"
        while len(data) % 4:
            data += b"\x00"
        header_size = 28
        strings_start = header_size + 4 * n
        size = strings_start + len(data)
        out = struct.pack("<HHIIIIII", RES_STRING_POOL, header_size, size, n, 0, 0, strings_start, 0)
        out += b"".join(struct.pack("<I", o) for o in offsets)
        out += bytes(data)
        return out


def _chunk(kind, header_size, body):
    size = 8 + len(body)
    return struct.pack("<HHI", kind, header_size, size) + body


def _attr(pool, ns_idx, name, value):
    name_idx = pool.add(name)
    kind, v = value
    if kind == "s":
        idx = pool.add(v)
        typed = struct.pack("<HBBI", 8, 0, TYPE_STRING, idx)
        raw = idx
    elif kind == "i":
        typed = struct.pack("<HBBI", 8, 0, TYPE_INT_DEC, v & 0xFFFFFFFF)
        raw = NONE
    elif kind == "b":
        typed = struct.pack("<HBBI", 8, 0, TYPE_INT_BOOLEAN, 0xFFFFFFFF if v else 0)
        raw = NONE
    else:
        raise ValueError(kind)
    return struct.pack("<II I", ns_idx, name_idx, raw) + typed


def _element(pool, node, ns_android_idx):
    name_idx = pool.add(node["name"])
    attrs = b""
    count = 0
    for ns, name, value in node.get("attrs", []):
        ns_idx = ns_android_idx if ns == "android" else NONE
        attrs += _attr(pool, ns_idx, name, value)
        count += 1
    body = struct.pack("<II", 1, NONE)              # lineNumber, comment
    body += struct.pack("<II", NONE, name_idx)      # ns, name
    body += struct.pack("<HHHHHH", 20, 20, count, 0, 0, 0)
    body += attrs
    out = _chunk(RES_XML_START_EL, 16, body)
    for child in node.get("children", []):
        out += _element(pool, child, ns_android_idx)
    end_body = struct.pack("<II", 1, NONE) + struct.pack("<II", NONE, name_idx)
    out += _chunk(RES_XML_END_EL, 16, end_body)
    return out


def encode_manifest(root):
    pool = _Pool()
    for name, _ in ATTR_IDS:       # атрибуты с ID идут первыми в пуле
        pool.add(name)
    prefix = pool.add("android")
    uri = pool.add(ANDROID_NS)
    ns_body = struct.pack("<II", 1, NONE) + struct.pack("<II", prefix, uri)
    body = _chunk(RES_XML_START_NS, 16, ns_body)
    body += _element(pool, root, uri)
    body += _chunk(RES_XML_END_NS, 16, ns_body)

    strings = pool.encode()
    res_map_body = b"".join(struct.pack("<I", ATTR_ID[n]) for n, _ in ATTR_IDS)
    res_map = _chunk(RES_XML_RESOURCE_MAP, 8, res_map_body)
    doc = strings + res_map + body
    return struct.pack("<HHI", RES_XML, 8, 8 + len(doc)) + doc


def el(name, attrs=(), children=()):
    return {"name": name, "attrs": list(attrs), "children": list(children)}


def A(name, value):
    """Атрибут android:*; value — ('s', str) | ('i', int) | ('b', bool)."""
    return ("android", name, value)


def P(name, value):
    return (None, name, value)


def manifest(package, version_code, version_name, min_sdk, target_sdk, label, activity):
    return el("manifest", [
        A("versionCode", ("i", version_code)),
        A("versionName", ("s", version_name)),
        P("package", ("s", package)),
    ], [
        el("uses-sdk", [A("minSdkVersion", ("i", min_sdk)), A("targetSdkVersion", ("i", target_sdk))]),
        el("uses-permission", [A("name", ("s", "android.permission.CAMERA"))]),
        el("application", [A("label", ("s", label)), A("hardwareAccelerated", ("b", True))], [
            el("activity", [
                A("name", ("s", activity)),
                A("exported", ("b", True)),
                A("screenOrientation", ("i", 6)),      # sensorLandscape
                A("configChanges", ("i", 0xDA0)),      # orientation|screenSize|keyboardHidden|...
            ], [
                el("intent-filter", [], [
                    el("action", [A("name", ("s", "android.intent.action.MAIN"))]),
                    el("category", [A("name", ("s", "android.intent.category.LAUNCHER"))]),
                ]),
            ]),
        ]),
    ])
