"use strict";
/*
 * Набор конструкторов инстансов Roblox (детали, свет, партиклы, звуки, GUI, скрипты).
 * Возвращает обычные "spec"-объекты, которые понимает rbx-dom.
 */
const C = require("./cframe");
const { V3, CFv, C3, C3f, NR, NS, CS, UD2, URI, REF, types } = C;

// ---------------------------------------------------------------- материалы (Enum.Material)
const MAT = {
  Plastic: 256, SmoothPlastic: 272, Neon: 288, Wood: 512, WoodPlanks: 528, Marble: 784,
  Basalt: 788, Slate: 800, CrackedLava: 804, Concrete: 816, Limestone: 820, Granite: 832,
  Pavement: 836, Brick: 848, Pebble: 864, Cobblestone: 880, Rock: 896, Sandstone: 912,
  CorrodedMetal: 1040, DiamondPlate: 1056, Foil: 1072, Metal: 1088, Grass: 1280,
  LeafyGrass: 1284, Sand: 1296, Fabric: 1312, Snow: 1328, Mud: 1344, Ground: 1360,
  Asphalt: 1376, Salt: 1392, Ice: 1536, Glacier: 1552, Glass: 1568, ForceField: 1584,
  Cardboard: 2304, Carpet: 2305, CeramicTiles: 2306, ClayRoofTiles: 2307, RoofShingles: 2308,
  Leather: 2309, Plaster: 2310, Rubber: 2311, Water: 2048,
};

// ---------------------------------------------------------------- палитры
const PAL = {
  night: { name: "Ночь", sky: [14, 16, 34], steel: [96, 104, 122], darksteel: [52, 58, 74] },
  portalGreen: [70, 255, 150],
  portalYellow: [255, 214, 40],
  portalCyan: [90, 220, 255],
  portalMagenta: [255, 90, 220],
  rickCoat: [178, 219, 240],
  rickSkin: [246, 226, 205],
  rickHair: [186, 214, 236],
  mortyShirt: [255, 216, 74],
  mortyPants: [86, 118, 196],
  brownHair: [120, 78, 46],
  rust: [128, 68, 40],
  sand: [214, 178, 112],
  alien: [120, 60, 180],
  crystal: [150, 255, 210],
};

// ---------------------------------------------------------------- ссылки
let _refNext = 100000;
const nextRef = () => String(_refNext++);

// ---------------------------------------------------------------- базовая деталь
/**
 * part({ name, size:[x,y,z], cf, color:[r,g,b], material, transparency, reflectance,
 *        shape, class, collide, query, touch, cast, children, props, ref })
 */
function part(o) {
  const props = Object.assign(
    {
      Size: V3(o.size),
      CFrame: CFv(o.cf),
      Anchored: o.anchored !== false,
      CanCollide: o.collide !== false,
      CanTouch: o.touch !== false,
      Material: o.material !== undefined ? o.material : MAT.SmoothPlastic,
      Color: C3(...(o.color || [163, 162, 165])),
      Transparency: o.transparency || 0,
      CastShadow: o.cast !== false,
      TopSurface: 0,
      BottomSurface: 0,
      LeftSurface: 0,
      RightSurface: 0,
      FrontSurface: 0,
      BackSurface: 0,
      CollisionGroupId: 0,
    },
    o.props || {},
  );
  if (o.query === false) props.CanQuery = false;
  if (o.query === true) props.CanQuery = true;
  if (o.reflectance) props.Reflectance = o.reflectance;
  if (o.shape !== undefined) props.Shape = o.shape;
  if (o.massless) props.Massless = true;
  const cls = o.class || "Part";
  const spec = { className: cls, name: o.name || cls, properties: props, children: o.children || [] };
  if (o.ref) spec.referent = typeof o.ref === "string" ? o.ref : nextRef();
  return spec;
}

/** Деталь-декор: не мешает ходьбе и не ловит рейкаст портальной пушки */
const deco = (o) => part(Object.assign({ collide: false, query: false, cast: false }, o));

const block = (o) => part(o);
const ball = (o) => part(Object.assign({ shape: 0 }, o));
const cyl = (o) => part(Object.assign({ shape: 2 }, o));
const wedge = (o) => part(Object.assign({ class: "WedgePart" }, o));
const wedgeC = (o) => part(Object.assign({ class: "CornerWedgePart" }, o));

/** Вертикальный цилиндр (ось Y) */
function pillar(o) {
  return cyl(Object.assign({}, o, { cf: C.cfMul(o.cf, C.cfA([0, 0, 0], 0, 0, Math.PI / 2)) }));
}
/** Цилиндр между двумя точками (ось X смотрит вдоль отрезка) */
function cylBetween(a, b, diameter, o = {}) {
  const dir = C.vnorm(C.vsub(b, a));
  const mid = C.vmul(C.vadd(a, b), 0.5);
  const len = C.vlen(C.vsub(a, b));
  let up = Math.abs(dir[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0];
  const ya = C.vnorm(C.vcross(dir, up));
  const za = C.vnorm(C.vcross(dir, ya));
  const frame = C.cfAxes(mid, dir, ya, za);
  return cyl(Object.assign({ size: [len, diameter, diameter], cf: frame }, o));
}

// ---------------------------------------------------------------- эффекты
function pointLight(o) {
  return {
    className: "PointLight",
    name: o.name || "Light",
    properties: {
      Color: C3f(...(o.color || [1, 1, 1])),
      Range: o.range || 16,
      Brightness: o.brightness !== undefined ? o.brightness : 2,
      Shadows: !!o.shadows,
      Enabled: o.enabled !== false,
    },
  };
}
function spotLight(o) {
  return {
    className: "SpotLight",
    name: o.name || "Spot",
    properties: {
      Color: C3f(...(o.color || [1, 1, 1])),
      Range: o.range || 60,
      Brightness: o.brightness || 2,
      Angle: o.angle || 60,
      Face: o.face !== undefined ? o.face : 5,
      Shadows: !!o.shadows,
    },
  };
}
/** Партиклы. Цвета/прозрачности/размеры можно задавать массивами ключевых точек. */
function emit(o) {
  const props = {
    Texture: URI(o.texture || "rbxasset://textures/particles/sparkles_main.dds"),
    Rate: o.rate !== undefined ? o.rate : 20,
    Lifetime: NR(...(o.lifetime || [1, 2])),
    Speed: NR(...(o.speed || [1, 3])),
    Rotation: NR(...(o.rotation || [0, 360])),
    RotSpeed: NR(...(o.rotSpeed || [-60, 60])),
    Size: NS(o.size || [[0, 1], [1, 0]]),
    Transparency: NS(o.transparency || [[0, 0.3], [1, 1]]),
    Color: CS(o.color || [[0, [1, 1, 1]], [1, [1, 1, 1]]]),
    LightEmission: o.lightEmission !== undefined ? o.lightEmission : 1,
    LightInfluence: o.lightInfluence !== undefined ? o.lightInfluence : 0,
    SpreadAngle: V3(o.spread || [0, 0, 0]),
    Acceleration: V3(o.acceleration || [0, 0, 0]),
    Drag: o.drag || 0,
    Squash: o.squash || 0,
    ZOffset: o.zOffset || 0,
    Enabled: o.enabled !== false,
    LockedToPart: !!o.lockedToPart,
    VelocityInheritance: o.velocityInherit || 0,
    Shape: o.shape !== undefined ? o.shape : 0,
    ShapeStyle: o.shapeStyle !== undefined ? o.shapeStyle : 0,
    ShapeInOut: o.shapeInOut !== undefined ? o.shapeInOut : 0,
    EmissionDirection: o.direction !== undefined ? o.direction : 1,
    Orientation: o.orientation !== undefined ? o.orientation : 0,
  };
  if (o.shapePartial !== undefined) props.ShapePartial = o.shapePartial;
  return { className: "ParticleEmitter", name: o.name || "Particles", properties: props };
}
function sound(o) {
  return {
    className: "Sound",
    name: o.name || "Sound",
    properties: {
      SoundId: URI(o.id),
      Volume: o.volume !== undefined ? o.volume : 1,
      PlaybackSpeed: o.speed !== undefined ? o.speed : 1,
      Looped: !!o.looped,
      RollOffMode: o.rollOff !== undefined ? o.rollOff : 0,
      RollOffMinDistance: o.minDist || 8,
      RollOffMaxDistance: o.maxDist || 240,
      TimePosition: o.timePosition || 0,
    },
  };
}
function beam(o) {
  const props = {
    Attachment0: REF(o.from),
    Attachment1: REF(o.to),
    Width0: o.width0 !== undefined ? o.width0 : 1,
    Width1: o.width1 !== undefined ? o.width1 : 1,
    LightEmission: o.lightEmission !== undefined ? o.lightEmission : 1,
    LightInfluence: o.lightInfluence || 0,
    FaceCamera: o.faceCamera !== false,
    Segments: o.segments || 6,
    Color: CS(o.color || [[0, [1, 1, 1]], [1, [1, 1, 1]]]),
    Transparency: NS(o.transparency || [[0, 0.2], [1, 0.6]]),
  };
  if (o.texture) props.Texture = URI(o.texture);
  return { className: "Beam", name: o.name || "Beam", properties: props };
}
function attachment(name, cf, ref) {
  const spec = { className: "Attachment", name, properties: { CFrame: CFv(cf) } };
  if (ref) spec.referent = ref;
  return spec;
}
function highlight(o) {
  const props = {
    FillColor: C3f(...(o.color || [1, 1, 1])),
    FillTransparency: o.fillTransparency !== undefined ? o.fillTransparency : 0.6,
    OutlineColor: C3f(...(o.outline || o.color || [1, 1, 1])),
    OutlineTransparency: o.outlineTransparency !== undefined ? o.outlineTransparency : 0.1,
    DepthMode: o.depthMode !== undefined ? o.depthMode : 1,
    Enabled: o.enabled !== false,
  };
  if (o.adornee) props.Adornee = REF(o.adornee);
  return { className: "Highlight", name: o.name || "Highlight", properties: props };
}

// ---------------------------------------------------------------- GUI
function textLabel(o) {
  const props = {
    Size: o.size ? UD2(o.size[0], o.size[1], o.size[2], o.size[3]) : UD2(1, 0, 1, 0),
    Position: o.position ? UD2(o.position[0], o.position[1], o.position[2], o.position[3]) : UD2(0, 0, 0, 0),
    AnchorPoint: o.anchor ? types.taggedVariant("Vector2", types.vector2(o.anchor[0], o.anchor[1])) : types.taggedVariant("Vector2", types.vector2(0.5, 0.5)),
    BackgroundTransparency: o.backgroundTransparency !== undefined ? o.backgroundTransparency : 1,
    BackgroundColor3: C3(...(o.backgroundColor || [0, 0, 0])),
    Text: o.text || "",
    TextColor3: C3(...(o.textColor || [255, 255, 255])),
    TextScaled: o.textScaled !== false,
    TextStrokeTransparency: o.stroke !== undefined ? o.stroke : 0.4,
    TextStrokeColor3: C3(...(o.strokeColor || [0, 0, 0])),
    TextWrapped: !!o.wrapped,
    TextXAlignment: o.alignX !== undefined ? o.alignX : 1,
    TextYAlignment: o.alignY !== undefined ? o.alignY : 1,
    Visible: o.visible !== false,
    RichText: !!o.rich,
    ZIndex: o.zIndex || 1,
  };
  if (o.textSize) {
    props.TextSize = o.textSize;
    props.TextScaled = false;
  }
  if (o.corner) props.__corner = true; // обрабатывается ниже
  const spec = { className: "TextLabel", name: o.name || "Label", properties: props };
  if (o.corner) {
    spec.children = [
      { className: "UICorner", name: "UICorner", properties: { CornerRadius: types.taggedVariant("UDim", types.udim(0, o.corner)) } },
    ].concat(spec.children || []);
    delete spec.properties.__corner;
  }
  if (o.children) spec.children = (spec.children || []).concat(o.children);
  return spec;
}
function textButton(o) {
  const spec = textLabel(o);
  spec.className = "TextButton";
  spec.properties.AutoButtonColor = true;
  if (o.color) spec.properties.BackgroundColor3 = C3(...o.color);
  spec.name = o.name || "Button";
  return spec;
}
function frame(o = {}) {
  return {
    className: o.class || "Frame",
    name: o.name || "Frame",
    properties: {
      Size: o.size ? UD2(o.size[0], o.size[1], o.size[2], o.size[3]) : UD2(1, 0, 1, 0),
      Position: o.position ? UD2(o.position[0], o.position[1], o.position[2], o.position[3]) : UD2(0, 0, 0, 0),
      AnchorPoint: o.anchor ? types.taggedVariant("Vector2", types.vector2(o.anchor[0], o.anchor[1])) : types.taggedVariant("Vector2", types.vector2(0, 0)),
      BackgroundColor3: C3(...(o.color || [0, 0, 0])),
      BackgroundTransparency: o.transparency !== undefined ? o.transparency : 0,
      BorderSizePixel: o.border !== undefined ? o.border : 0,
      Visible: o.visible !== false,
      ZIndex: o.zIndex || 1,
    },
    children: (o.corner
      ? [{ className: "UICorner", name: "UICorner", properties: { CornerRadius: types.taggedVariant("UDim", types.udim(0, o.corner)) } }]
      : []).concat(
      o.stroke
        ? [{ className: "UIStroke", name: "UIStroke", properties: { Color: C3(...(o.strokeColor || [255, 255, 255])), Thickness: o.stroke, Transparency: o.strokeTransparency || 0 } }]
        : [],
    ).concat(o.children || []),
  };
}
function surfaceGui(o) {
  return {
    className: "SurfaceGui",
    name: o.name || "SurfaceGui",
    properties: {
      Face: o.face !== undefined ? o.face : 5,
      CanvasSize: types.taggedVariant("Vector2", types.vector2(o.canvas ? o.canvas[0] : 400, o.canvas ? o.canvas[1] : 200)),
      SizingMode: o.sizingMode !== undefined ? o.sizingMode : 0,
      LightInfluence: o.lightInfluence || 0,
      Brightness: o.brightness || 1,
      PixelsPerStud: o.ppi || 50,
      AlwaysOnTop: !!o.alwaysOnTop,
      Adornee: o.adornee ? REF(o.adornee) : undefined,
    },
    children: o.children || [],
  };
}
function billboard(o) {
  const spec = {
    className: "BillboardGui",
    name: o.name || "Billboard",
    properties: {
      Size: UD2(o.size ? o.size[0] : 0, o.size ? o.size[1] : 200, o.size ? o.size[2] : 0, o.size ? o.size[3] : 60),
      StudsOffset: V3(o.offset || [0, 3, 0]),
      AlwaysOnTop: o.alwaysOnTop !== false,
      LightInfluence: o.lightInfluence || 0,
      MaxDistance: o.maxDistance || 250,
      ClipsDescendants: !!o.clips,
      Enabled: o.enabled !== false,
    },
    children: o.children || [],
  };
  if (o.adornee) spec.properties.Adornee = REF(o.adornee);
  return spec;
}

// ---------------------------------------------------------------- логика
function clickDetector(o = {}) {
  return { className: "ClickDetector", name: "ClickDetector", properties: { MaxActivationDistance: o.dist || 40 } };
}
function prompt(o) {
  return {
    className: "ProximityPrompt",
    name: o.name || "ProximityPrompt",
    properties: {
      ActionText: o.action || "Поговорить",
      ObjectText: o.object || "",
      HoldDuration: o.hold || 0,
      MaxActivationDistance: o.dist || 14,
      RequiresLineOfSight: false,
      KeyboardKeyCode: o.key !== undefined ? o.key : 69,
      ClickablePrompt: true,
      Style: o.style !== undefined ? o.style : 0,
      UIOffset: V3(o.offset || [0, 0, 0]),
    },
  };
}
function motor(name, ref0, ref1, c0, c1) {
  return {
    className: "Motor6D",
    name,
    properties: { Part0: REF(ref0), Part1: REF(ref1), C0: CFv(c0), C1: CFv(c1) },
  };
}
function weld(ref0, ref1, c0, c1, name) {
  return {
    className: "Weld",
    name: name || "Weld",
    properties: { Part0: REF(ref0), Part1: REF(ref1), C0: CFv(c0 || C.cfp(0, 0, 0)), C1: CFv(c1 || C.cfp(0, 0, 0)) },
  };
}
function weldC(ref0, ref1, name) {
  return { className: "WeldConstraint", name: name || "WeldConstraint", properties: { Part0: REF(ref0), Part1: REF(ref1) } };
}
const folder = (name, children) => ({ className: "Folder", name, children: children || [] });
const model = (o) => {
  const spec = { className: "Model", name: o.name, properties: {}, children: o.children || [] };
  if (o.primary) spec.properties.PrimaryPart = REF(o.primary);
  if (o.props) Object.assign(spec.properties, o.props);
  return spec;
};
const script_ = (o) => {
  const className = o.local ? "LocalScript" : o.module ? "ModuleScript" : "Script";
  const properties = { Source: o.source };
  if (className !== "ModuleScript") properties.Disabled = false;
  return { className, name: o.name, properties };
};
const remote = (name) => ({ className: "RemoteEvent", name });
const bindable = (name) => ({ className: "BindableEvent", name });
const stringValue = (name, value) => ({ className: "StringValue", name, properties: { Value: value } });
const objectValue = (name, ref) => ({ className: "ObjectValue", name, properties: { Value: REF(ref) } });
const numberValue = (name, value) => ({ className: "NumberValue", name, properties: { Value: value } });

module.exports = {
  MAT, PAL, part, deco, block, ball, cyl, pillar, cylBetween, wedge, wedgeC,
  pointLight, spotLight, emit, sound, beam, attachment, highlight,
  textLabel, textButton, frame, surfaceGui, billboard,
  clickDetector, prompt, motor, weld, weldC, folder, model, script_, remote, bindable,
  stringValue, objectValue, numberValue, nextRef,
  // сглаженные алиасы типов
  V3, CFv, C3, C3f, NR, NS, CS, URI, REF, types,
};
