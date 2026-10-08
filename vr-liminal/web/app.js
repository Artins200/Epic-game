// Liminal VR — белое клетчатое пространство для очков типа Cardboard.
// Стерео side-by-side, гироскоп, распознавание руки по задней камере (MediaPipe Hands),
// кубы + физика, сварка, балончик, меч, пистолет и NPC.
import * as THREE from 'three';

// ----------------------------------------------------------------- настройки
const CFG = {
  ipd: 0.063,                 // межзрачковое расстояние, м
  barrelK: 0.16,              // компенсация дисторсии линз
  eyeHeight: 1.6,
  playerRadius: 0.32,
  walkSpeed: 2.3,
  handRealLen: 0.095,         // запястье -> основание среднего пальца, м
  camTanV: Math.tan(THREE.MathUtils.degToRad(27)), // полуугол вертикального обзора задней камеры
  cell: 8,                    // размер клетки лабиринта, м
  grid: 4,                    // клеток в каждую сторону от центра
  maxCubes: 90,
  maxNpc: 5,
  maxPaint: 9000,
  npcDamage: 9,
  playerMaxHp: 100,
};
const TOOLS = [
  { id: 'cube', name: 'Куб' },
  { id: 'weld', name: 'Сварка' },
  { id: 'spray', name: 'Балончик' },
  { id: 'sword', name: 'Меч' },
  { id: 'gun', name: 'Пистолет' },
];
const PAINT = ['#ff3b30', '#ffcc00', '#0a84ff', '#111111', '#ff2d95', '#30d158', '#7d5cff'];
const WALL_H = 3.2;
const DEG = Math.PI / 180;
const FWD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

const rand = (a, b) => a + Math.random() * (b - a);
const $ = (s) => document.querySelector(s);

// ----------------------------------------------------------------- рендер
const PR = Math.min(window.devicePixelRatio || 1, 1.5);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.id = 'gl';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e9e5);
scene.fog = new THREE.Fog(0xe9e9e5, 7, 30);
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d4, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.45);
sun.position.set(3, 8, 2);
scene.add(sun);

// Клетчатая текстура: 2×2 клетки, светлые тона + тонкие линии
function makeCheckerCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#f3f3f0' : '#dededa';
    g.fillRect(i * 64, j * 64, 64, 64);
  }
  g.strokeStyle = '#bdbdb8';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  return c;
}
const checkerTex = new THREE.CanvasTexture(makeCheckerCanvas());
checkerTex.wrapS = checkerTex.wrapT = THREE.RepeatWrapping;
checkerTex.colorSpace = THREE.SRGBColorSpace;
checkerTex.anisotropy = 4;
const checkerMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.93, metalness: 0 });

const EXT = CFG.cell * CFG.grid;               // половина размера области
const floorTex = checkerTex.clone();
floorTex.repeat.set(EXT, EXT);                  // 1 клетка ~ 1 м
floorTex.needsUpdate = true;
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2.5, EXT * 2.5), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const ceilTex = checkerTex.clone();
ceilTex.repeat.set(EXT, EXT);
ceilTex.needsUpdate = true;
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2.5, EXT * 2.5),
  new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, color: 0xffffff }));
ceil.rotation.x = Math.PI / 2;
ceil.position.y = WALL_H;
scene.add(ceil);

// ----------------------------------------------------------------- лабиринт
const solids = [];          // статические AABB для коллизий
const wallList = [];        // сегменты стен (instanced)
const pillarList = [];      // колонны (instanced)
function addWall(cx, cz, alongZ) {
  if (Math.hypot(cx, cz) < 4.5) return;
  wallList.push({ x: cx, z: cz, alongZ });
  const hx = alongZ ? 0.075 : 1, hz = alongZ ? 1 : 0.075;
  solids.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, minY: 0, maxY: WALL_H });
}
function addPillar(x, z) {
  if (Math.hypot(x, z) < 4) return;
  pillarList.push({ x, z });
  solids.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25, minY: 0, maxY: WALL_H });
}
const lightCells = [];
for (let i = -CFG.grid; i < CFG.grid; i++) for (let j = -CFG.grid; j < CFG.grid; j++) {
  const x0 = i * CFG.cell, z0 = j * CFG.cell;
  for (let s = 0; s < 4; s++) {
    if (Math.random() < 0.78) addWall(x0 + s * 2 + 1, z0, false);
    if (Math.random() < 0.78) addWall(x0, z0 + s * 2 + 1, true);
  }
  if (Math.random() < 0.5) addPillar(x0, z0);
  lightCells.push({ x: x0 + CFG.cell / 2, z: z0 + CFG.cell / 2 });
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, WALL_H, 0.15), checkerMat, Math.max(1, wallList.length));
wallList.forEach((w, i) => {
  _p.set(w.x, WALL_H / 2, w.z);
  _q.setFromAxisAngle(UP, w.alongZ ? Math.PI / 2 : 0);
  _m4.compose(_p, _q, _s1);
  wallMesh.setMatrixAt(i, _m4);
});
wallMesh.count = wallList.length;
wallMesh.frustumCulled = false;
scene.add(wallMesh);

const pillarMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, WALL_H, 0.5), checkerMat, Math.max(1, pillarList.length));
pillarList.forEach((p, i) => {
  _p.set(p.x, WALL_H / 2, p.z);
  _q.identity();
  _m4.compose(_p, _q, _s1);
  pillarMesh.setMatrixAt(i, _m4);
});
pillarMesh.count = pillarList.length;
pillarMesh.frustumCulled = false;
scene.add(pillarMesh);

// Потолочные светильники (иногда мерцают)
const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const panels = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.6), panelMat, lightCells.length);
const _qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
lightCells.forEach((c, i) => {
  _p.set(c.x, WALL_H - 0.01, c.z);
  _m4.compose(_p, _qX, _s1);
  panels.setMatrixAt(i, _m4);
  panels.setColorAt(i, new THREE.Color(1, 1, 1));
});
panels.frustumCulled = false;
scene.add(panels);
const flicker = [];
for (let i = 0; i < 8; i++) flicker.push({ i: Math.floor(Math.random() * lightCells.length), t: rand(0.2, 2), on: true });

// Пыль в воздухе
const dustGeo = new THREE.BufferGeometry();
{
  const arr = new Float32Array(420 * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rand(-EXT, EXT); arr[i + 1] = rand(0.2, WALL_H); arr[i + 2] = rand(-EXT, EXT); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
}
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.6, depthWrite: false }));
scene.add(dust);

// ----------------------------------------------------------------- голова / глаза
const playerPos = new THREE.Vector3(0, CFG.eyeHeight, 0);
const head = new THREE.Group();
scene.add(head);
const eyeL = new THREE.PerspectiveCamera(80, 1, 0.03, 90);
eyeL.position.x = -CFG.ipd / 2;
head.add(eyeL);
const eyeR = new THREE.PerspectiveCamera(80, 1, 0.03, 90);
eyeR.position.x = CFG.ipd / 2;
head.add(eyeR);

const rtL = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
const rtR = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
const quadMat = new THREE.ShaderMaterial({
  uniforms: { tL: { value: rtL.texture }, tR: { value: rtR.texture }, k: { value: CFG.barrelK } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tL; uniform sampler2D tR; uniform float k; varying vec2 vUv;
    void main() {
      float eye = step(0.5, vUv.x);
      vec2 p = vec2((vUv.x - eye * 0.5) * 4.0 - 1.0, vUv.y * 2.0 - 1.0);
      float r2 = dot(p, p);
      vec2 s = p * (1.0 + k * r2);
      if (abs(s.x) > 1.0 || abs(s.y) > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec2 uv = vec2((s.x * 0.5 + 0.5) * 0.5, s.y * 0.5 + 0.5);
      vec3 c = eye < 0.5 ? texture2D(tL, uv).rgb : texture2D(tR, uv).rgb;
      gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});
const quadScene = new THREE.Scene();
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.max(1, Math.floor(innerWidth * PR / 2));
  const h = Math.max(1, Math.floor(innerHeight * PR));
  rtL.setSize(w, h);
  rtR.setSize(w, h);
  eyeL.aspect = eyeR.aspect = (innerWidth / 2) / innerHeight;
  eyeL.updateProjectionMatrix();
  eyeR.updateProjectionMatrix();
}
addEventListener('resize', onResize);
onResize();

// ----------------------------------------------------------------- гироскоп и мышь
let gyroOn = false;
let gyroData = { a: 0, b: 0, g: 0 };
addEventListener('deviceorientation', (e) => {
  if (e.beta == null) return;
  gyroOn = true;
  gyroData = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 };
});
const _eu = new THREE.Euler(), _zee = new THREE.Vector3(0, 0, 1);
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const _qy = new THREE.Quaternion(), _qt = new THREE.Quaternion();
function screenAngle() {
  const o = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
  return o * DEG;
}
function gyroQuat(out) {
  const { a, b, g } = gyroData;
  _eu.set(b * DEG, a * DEG, -g * DEG, 'YXZ');
  out.setFromEuler(_eu);
  out.multiply(_q1);
  out.multiply(_q0.setFromAxisAngle(_zee, -screenAngle()));
  return out;
}
let yawOff = 0, pitchOff = 0;

// ----------------------------------------------------------------- состояние игры
const state = { started: false, hp: CFG.playerMaxHp, kills: 0, deathT: 0, hurtT: 0, shake: 0, slow: 1, slowT: 0 };
let tool = 0;
let msgText = '', msgT = 0;
const hudCache = {};

function setHud(key, text) {
  if (hudCache[key] === text) return;
  hudCache[key] = text;
  document.querySelectorAll(`[data-hud="${key}"]`).forEach((e) => { e.textContent = text; });
}
function setHudStyle(key, prop, value) {
  const k = key + prop;
  if (hudCache[k] === value) return;
  hudCache[k] = value;
  document.querySelectorAll(`[data-hud="${key}"]`).forEach((e) => { e.style[prop] = value; });
}
function msg(text, t = 1.4) { msgText = text; msgT = t; }

// ----------------------------------------------------------------- видеокамера и MediaPipe
const video = $('#cam');
let camOn = false, camAspect = 4 / 3, hands = null, handsReady = false, handsErr = '';
let statusCam = 'камера: выкл';

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    camOn = true;
    statusCam = 'камера: вкл';
  } catch (err) {
    statusCam = 'камера: нет (' + (err && err.name || 'ошибка') + ')';
  }
}

function initHands() {
  if (typeof window.Hands !== 'function') { handsErr = 'MediaPipe не загружен'; return; }
  hands = new window.Hands({ locateFile: (f) => 'vendor/mediapipe/hands/' + f });
  hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
  hands.onResults(onHandResults);
  handsReady = true;
}

function onHandResults(res) {
  const list = res.multiHandLandmarks || [];
  const labels = res.multiHandedness || [];
  const now = performance.now();
  if (video.videoWidth) camAspect = video.videoWidth / video.videoHeight;
  // Порядок MediaPipe не гарантирован: рука 'Right' → rig 0 (ведущая), 'Left' → rig 1.
  const order = list.map((_, i) => i).sort((a, b) =>
    ((labels[a] && labels[a].label) === 'Left') - ((labels[b] && labels[b].label) === 'Left'));
  for (let i = 0; i < 2; i++) {
    const lm = list[order[i]];
    if (lm) { handRigs[i].lm = lm; handRigs[i].seen = now; }
  }
}

async function handLoop() {
  for (;;) {
    if (handsReady && camOn && video.readyState >= 2) {
      try { await hands.send({ image: video }); } catch (e) { handsErr = 'ошибка рук'; }
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
}

// ----------------------------------------------------------------- визуализация руки
const JOINT_R = 0.0075, BONE_R = 0.0035;
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const handMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0x101010 });
const palmMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.5, side: THREE.DoubleSide });
const _d = new THREE.Vector3(), _mid = new THREE.Vector3(), _tv = new THREE.Vector3();

function buildHand() {
  const g = new THREE.Group();
  g.visible = false;
  head.add(g);
  const joints = [];
  for (let i = 0; i < 21; i++) {
    const m = new THREE.Mesh(sphereGeo, handMat);
    m.scale.setScalar(JOINT_R);
    g.add(m);
    joints.push(m);
  }
  const bones = BONES.map(() => { const m = new THREE.Mesh(cylGeo, handMat); g.add(m); return m; });
  const palmGeo = new THREE.BufferGeometry();
  palmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
  const palm = new THREE.Mesh(palmGeo, palmMat);
  g.add(palm);
  return {
    g, joints, bones, palm, palmGeo,
    pos: Array.from({ length: 21 }, () => new THREE.Vector3()),
    inited: false, seen: 0, lm: null, pinch: false,
    anchor: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), prevAnchor: new THREE.Vector3(), speed: 0,
    hasPrev: false,
  };
}
const handRigs = [buildHand(), buildHand()];

function placeBone(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  if (len < 1e-5) { m.visible = false; return; }
  m.visible = true;
  _mid.addVectors(a, b).multiplyScalar(0.5);
  m.position.copy(_mid);
  m.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  m.scale.set(BONE_R, len, BONE_R);
}

// Перевод landmarks MediaPipe в координаты головы: рука «привязана» к задней камере
function updateHandRig(rig, dt, now) {
  const visible = !!rig.lm && now - rig.seen < 350;
  rig.g.visible = visible;
  if (!visible) { rig.pinch = false; rig.hasPrev = false; return; }
  const lm = rig.lm, asp = camAspect, w = lm[0];
  const sizeN = Math.max(0.01, Math.hypot((lm[9].x - w.x) * asp, lm[9].y - w.y));
  const M = CFG.handRealLen / sizeN;             // метров на всю высоту кадра на глубине руки
  const d = M / (2 * CFG.camTanV);               // глубина руки, м
  const bx = (w.x - 0.5) * M * asp, by = -(w.y - 0.5) * M, bz = -d;
  for (let i = 0; i < 21; i++) {
    const p = lm[i];
    _tv.set(bx + (p.x - w.x) * M * asp, by - (p.y - w.y) * M, bz - (p.z - w.z) * M * asp);
    rig.pos[i].lerp(_tv, rig.inited ? 0.55 : 1);
  }
  rig.inited = true;
  const P = rig.pos;
  for (let i = 0; i < 21; i++) rig.joints[i].position.copy(P[i]);
  BONES.forEach(([a, b], i) => placeBone(rig.bones[i], P[a], P[b]));
  const pa = rig.palmGeo.attributes.position.array;
  [0, 5, 9, 0, 9, 13, 0, 13, 17].forEach((idx, k) => { pa[k * 3] = P[idx].x; pa[k * 3 + 1] = P[idx].y; pa[k * 3 + 2] = P[idx].z; });
  rig.palmGeo.attributes.position.needsUpdate = true;
  rig.palmGeo.computeVertexNormals();
  // точка инструмента: центр ладони; направление — от основания указательного к кончику
  rig.anchor.set(0, 0, 0);
  for (const i of [0, 5, 9, 13, 17]) rig.anchor.add(P[i]);
  rig.anchor.multiplyScalar(0.2);
  rig.dir.subVectors(P[8], P[5]).normalize();
  if (rig.hasPrev && dt > 0) rig.speed = rig.anchor.distanceTo(rig.prevAnchor) / dt;
  rig.prevAnchor.copy(rig.anchor);
  rig.hasPrev = true;
  // щипок: большой + указательный
  const pinchD = Math.hypot((lm[4].x - lm[8].x) * asp, lm[4].y - lm[8].y) / sizeN;
  if (!rig.pinch && pinchD < 0.32) rig.pinch = true;
  else if (rig.pinch && pinchD > 0.5) rig.pinch = false;
}

// ----------------------------------------------------------------- инструменты (модели в руке)
const toolRoot = new THREE.Group();
head.add(toolRoot);
const toolGroups = [];
const whiteStd = new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.5 });
const darkStd = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.2 });
const glowOrange = new THREE.MeshBasicMaterial({ color: 0xffa23a });
const bladeMat = new THREE.MeshBasicMaterial({ color: 0xd8f7ff });
const cubeTipMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const canCapMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 });
const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });

function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(r, h, m, seg = 12) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); }

function buildTools() {
  // 0: куб в руке
  const cubeG = new THREE.Group();
  cubeG.add(box(0.1, 0.1, 0.1, cubeTipMat));
  cubeG.children[0].position.z = -0.08;
  toolGroups.push(cubeG);
  // 1: сварочный аппарат
  const weldG = new THREE.Group();
  const wb = cyl(0.018, 0.16, darkStd); wb.rotation.x = Math.PI / 2; wb.position.z = -0.08;
  const wt = cyl(0.008, 0.06, whiteStd, 8); wt.rotation.x = Math.PI / 2; wt.position.z = -0.19;
  weldG.userData.tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), glowOrange);
  weldG.userData.tip.position.z = -0.23;
  weldG.userData.tip.visible = false;
  weldG.add(wb, wt, weldG.userData.tip);
  toolGroups.push(weldG);
  // 2: балончик с краской
  const sprayG = new THREE.Group();
  const can = cyl(0.022, 0.14, whiteStd, 14); can.rotation.x = Math.PI / 2; can.position.z = -0.08;
  const cap = cyl(0.012, 0.03, canCapMat, 10); cap.position.set(0, 0.035, -0.02);
  sprayG.add(can, cap);
  sprayG.userData.cap = cap;
  toolGroups.push(sprayG);
  // 3: меч
  const swordG = new THREE.Group();
  const handle = cyl(0.012, 0.16, darkStd, 8); handle.rotation.x = Math.PI / 2; handle.position.z = -0.08;
  const guard = box(0.12, 0.012, 0.02, darkStd); guard.position.z = -0.16;
  const blade = box(0.03, 0.006, 0.7, bladeMat); blade.position.z = -0.52;
  swordG.add(handle, guard, blade);
  toolGroups.push(swordG);
  // 4: пистолет
  const gunG = new THREE.Group();
  const body = box(0.05, 0.08, 0.22, whiteStd); body.position.z = -0.08;
  const barrel = box(0.03, 0.035, 0.12, darkStd); barrel.position.z = -0.23;
  const grip = box(0.04, 0.1, 0.05, darkStd); grip.position.set(0, -0.085, -0.02);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), muzzleMat);
  flash.position.z = -0.3;
  flash.visible = false;
  const muzzle = new THREE.Object3D();
  muzzle.position.z = -0.3;
  gunG.add(body, barrel, grip, flash, muzzle);
  gunG.userData.flash = flash;
  gunG.userData.muzzle = muzzle;
  toolGroups.push(gunG);
  toolGroups.forEach((g) => { g.visible = false; toolRoot.add(g); });
}
buildTools();

function setTool(i) {
  tool = (i + TOOLS.length) % TOOLS.length;
  toolGroups.forEach((g, k) => { g.visible = k === tool; });
  msg(TOOLS[tool].name, 1.2);
}
function cycleTool(dir = 1) { setTool(tool + dir); }
setTool(0);

// ----------------------------------------------------------------- вспомогательные эффекты
// Искры
const SP_N = 700;
const spPos = new Float32Array(SP_N * 3), spVel = new Float32Array(SP_N * 3), spLife = new Float32Array(SP_N);
for (let i = 0; i < SP_N; i++) spPos[i * 3 + 1] = -999;
let spIdx = 0;
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({
  color: 0xffa640, size: 0.035, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
}));
sparks.frustumCulled = false;
scene.add(sparks);
function emitSparks(p, n, speed = 2.5) {
  for (let k = 0; k < n; k++) {
    const i = spIdx; spIdx = (spIdx + 1) % SP_N;
    spPos[i * 3] = p.x; spPos[i * 3 + 1] = p.y; spPos[i * 3 + 2] = p.z;
    spVel[i * 3] = rand(-1, 1) * speed; spVel[i * 3 + 1] = rand(0.2, 1.2) * speed; spVel[i * 3 + 2] = rand(-1, 1) * speed;
    spLife[i] = rand(0.3, 0.6);
  }
}
function updateSparks(dt) {
  for (let i = 0; i < SP_N; i++) {
    if (spLife[i] <= 0) continue;
    spLife[i] -= dt;
    spVel[i * 3 + 1] -= 6 * dt;
    spPos[i * 3] += spVel[i * 3] * dt;
    spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt;
    spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
    if (spLife[i] <= 0) spPos[i * 3 + 1] = -999;
  }
  spGeo.attributes.position.needsUpdate = true;
}

// Трассеры
const tracers = [];
function addTracer(a, b) {
  const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const m = new THREE.LineBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.95 });
  const l = new THREE.Line(g, m);
  scene.add(l);
  tracers.push({ l, t: 0.09 });
}
function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= dt;
    if (tr.t <= 0) { scene.remove(tr.l); tr.l.geometry.dispose(); tr.l.material.dispose(); tracers.splice(i, 1); }
  }
}

// Дуга меча
const slash = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 36, 1, -0.75, 1.5),
  new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
slash.position.set(0, -0.15, -1.1);
slash.rotation.z = Math.PI / 2;
head.add(slash);
let slashT = 0;

// ----------------------------------------------------------------- краска (балончик)
const paintGeo = new THREE.SphereGeometry(0.022, 6, 4);
const paint = new THREE.InstancedMesh(paintGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), CFG.maxPaint);
paint.count = 0;
paint.frustumCulled = false;
scene.add(paint);
let paintN = 0;
const _pm = new THREE.Matrix4(), _pc = new THREE.Color();
function addPaint(p, colorHex) {
  const i = paintN % CFG.maxPaint;
  _pm.makeTranslation(p.x, p.y, p.z);
  paint.setMatrixAt(i, _pm);
  paint.setColorAt(i, _pc.set(colorHex));
  paintN++;
  paint.count = Math.min(paintN, CFG.maxPaint);
  paint.instanceMatrix.needsUpdate = true;
  paint.instanceColor.needsUpdate = true;
}

// ----------------------------------------------------------------- кубы и физика
const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.6 });
const cubes = [];
const beads = [];
const beadMat = new THREE.MeshBasicMaterial({ color: 0xff9a2e });
let pickables = [];
function rebuildPickables() {
  pickables = [floor, wallMesh, pillarMesh, ...cubes.map((c) => c.mesh)];
}
function spawnCube(p) {
  if (cubes.length >= CFG.maxCubes) removeCube(cubes[0]);
  const c = { mesh: null, pos: p.clone(), vel: new THREE.Vector3(), half: new THREE.Vector3(0.25, 0.25, 0.25), welded: false, wp: 0 };
  c.mesh = new THREE.Mesh(cubeGeo, cubeMat);
  c.mesh.userData.cube = c;
  c.mesh.position.copy(c.pos);
  scene.add(c.mesh);
  cubes.push(c);
  rebuildPickables();
}
function removeCube(c) {
  scene.remove(c.mesh);
  const i = cubes.indexOf(c);
  if (i >= 0) cubes.splice(i, 1);
  rebuildPickables();
}

// Разрешение пересечения двух AABB; mov* — можно ли двигать
function separate(A, B, aMov, bMov) {
  const dx = A.pos.x - B.pos.x, dy = A.pos.y - B.pos.y, dz = A.pos.z - B.pos.z;
  const ox = A.half.x + B.half.x - Math.abs(dx);
  const oy = A.half.y + B.half.y - Math.abs(dy);
  const oz = A.half.z + B.half.z - Math.abs(dz);
  if (ox <= 0 || oy <= 0 || oz <= 0) return null;
  let axis = 'x', m = ox;
  if (oz < m) { axis = 'z'; m = oz; }
  if (oy < m) { axis = 'y'; m = oy; }
  const dv = axis === 'x' ? dx : axis === 'y' ? dy : dz;
  const sgn = dv >= 0 ? 1 : -1;
  const wA = aMov && bMov ? 0.5 : aMov ? 1 : 0;
  const wB = aMov && bMov ? 0.5 : bMov ? 1 : 0;
  A.pos[axis] += sgn * m * wA;
  B.pos[axis] -= sgn * m * wB;
  if (axis === 'y') {
    if (sgn > 0 && A.vel) { A.vel.y = Math.max(0, A.vel.y); A.grounded = true; }
    if (sgn < 0 && B.vel) { B.vel.y = Math.max(0, B.vel.y); B.grounded = true; }
  }
  return axis;
}

function updatePhysics(dt) {
  const sub = 2;
  const h = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (const c of cubes) {
      if (c.welded) continue;
      c.vel.y -= 9.8 * h;
      c.pos.y += c.vel.y * h;
      c.grounded = false;
      if (c.pos.y - c.half.y < 0) { c.pos.y = c.half.y; c.vel.y = 0; c.grounded = true; }
    }
    // статические коллайдеры (боксы предвычислены в solidBoxes)
    for (const c of cubes) {
      if (c.welded) continue;
      for (const B of solidBoxes) {
        if (Math.abs(c.pos.x - B.pos.x) > c.half.x + B.half.x) continue;
        if (Math.abs(c.pos.z - B.pos.z) > c.half.z + B.half.z) continue;
        separate(c, B, true, false);
      }
    }
    // кубы друг с другом
    for (let i = 0; i < cubes.length; i++) {
      for (let j = i + 1; j < cubes.length; j++) {
        const a = cubes[i], b = cubes[j];
        if (a.welded && b.welded) continue;
        separate(a, b, !a.welded, !b.welded);
      }
    }
  }
  for (const c of cubes) c.mesh.position.copy(c.pos);
}
const solidBoxes = solids.map((b) => ({
  pos: new THREE.Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2),
  half: new THREE.Vector3((b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, (b.maxZ - b.minZ) / 2),
}));

// Сварка: соединяем куб с соседями (кубы и пол), рисуем сварные швы
function weldCube(c) {
  c.welded = true;
  c.vel.set(0, 0, 0);
  const e = 0.05;
  const addBead = (min, max) => {
    const sx = Math.max(0.02, max.x - min.x), sy = Math.max(0.02, max.y - min.y), sz = Math.max(0.02, max.z - min.z);
    const bead = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), beadMat);
    bead.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    scene.add(bead);
    beads.push(bead);
    emitSparks(bead.position, 20, 2.5);
  };
  const cmin = new THREE.Vector3().copy(c.pos).addScalar(-0.25 - e);
  const cmax = new THREE.Vector3().copy(c.pos).addScalar(0.25 + e);
  const tryContact = (bmin, bmax) => {
    const min = new THREE.Vector3(Math.max(cmin.x, bmin.x), Math.max(cmin.y, bmin.y), Math.max(cmin.z, bmin.z));
    const max = new THREE.Vector3(Math.min(cmax.x, bmax.x), Math.min(cmax.y, bmax.y), Math.min(cmax.z, bmax.z));
    if (max.x >= min.x && max.y >= min.y && max.z >= min.z) addBead(min, max);
  };
  for (const o of cubes) {
    if (o === c) continue;
    tryContact(new THREE.Vector3().copy(o.pos).addScalar(-0.25 - e), new THREE.Vector3().copy(o.pos).addScalar(0.25 + e));
  }
  for (const b of solids) {
    tryContact(new THREE.Vector3(b.minX, b.minY, b.minZ), new THREE.Vector3(b.maxX, b.maxY, b.maxZ));
  }
  if (c.pos.y - 0.25 < 0.08) tryContact(new THREE.Vector3(-100, -0.05, -100), new THREE.Vector3(100, 0.05, 100));
  msg('Сварено', 1);
}

// ----------------------------------------------------------------- NPC (манекены)
const npcs = [];
let npcRespawnT = 1.5;
const npcGeos = {};
function bgeo(w, h, d) {
  const k = `${w}_${h}_${d}`;
  return npcGeos[k] || (npcGeos[k] = new THREE.BoxGeometry(w, h, d));
}
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
function makeNPC() {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.55, emissive: 0x000000 });
  const mk = (w, h, d, m) => new THREE.Mesh(bgeo(w, h, d), m || mat);
  const torso = mk(0.38, 0.6, 0.22); torso.position.y = 1.2; root.add(torso);
  const head2 = mk(0.22, 0.24, 0.22); head2.position.y = 1.6; root.add(head2);
  const e1 = mk(0.05, 0.02, 0.02, eyeMat); e1.position.set(-0.055, 1.62, -0.115); root.add(e1);
  const e2 = mk(0.05, 0.02, 0.02, eyeMat); e2.position.set(0.055, 1.62, -0.115); root.add(e2);
  const armL = new THREE.Group(); armL.position.set(-0.25, 1.46, 0);
  const armLm = mk(0.1, 0.6, 0.1); armLm.position.y = -0.3; armL.add(armLm); root.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.25, 1.46, 0);
  const armRm = mk(0.1, 0.6, 0.1); armRm.position.y = -0.3; armR.add(armRm); root.add(armR);
  const legL = new THREE.Group(); legL.position.set(-0.1, 0.9, 0);
  const legLm = mk(0.13, 0.9, 0.13); legLm.position.y = -0.45; legL.add(legLm); root.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.1, 0.9, 0);
  const legRm = mk(0.13, 0.9, 0.13); legRm.position.y = -0.45; legR.add(legRm); root.add(legR);
  scene.add(root);
  return { root, mat, armL, armR, legL, legR };
}
function insideSolid(x, z, r) {
  for (const b of solids) {
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
  }
  return false;
}
function pushOut(o, r) {
  for (const b of solids) {
    const cx = Math.max(b.minX, Math.min(o.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(o.z, b.maxZ));
    let dx = o.x - cx, dz = o.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); const k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
    else { // внутри: выталкиваем по ближайшей стороне
      const left = o.x - b.minX, right = b.maxX - o.x, back = o.z - b.minZ, fwd = b.maxZ - o.z;
      const m = Math.min(left, right, back, fwd);
      if (m === left) o.x = b.minX - r; else if (m === right) o.x = b.maxX + r;
      else if (m === back) o.z = b.minZ - r; else o.z = b.maxZ + r;
    }
  }
}
function spawnNPC() {
  for (let t = 0; t < 40; t++) {
    const x = rand(-EXT + 3, EXT - 3), z = rand(-EXT + 3, EXT - 3);
    if (Math.hypot(x - playerPos.x, z - playerPos.z) < 9) continue;
    if (insideSolid(x, z, 0.4)) continue;
    const m = makeNPC();
    npcs.push({ ...m, x, z, tx: x, tz: z, wT: 0, yaw: 0, hp: 3, dead: false, deadT: 0, atk: 0.5, attackAnim: 0, hitT: 0, phase: 0, moving: false });
    return;
  }
}
function npcCenter(n, out) { return out.set(n.x, 1.0, n.z); }

function damageNPC(n, dmg, point) {
  n.hp -= dmg;
  n.hitT = 0.2;
  emitSparks(point || npcCenter(n, _tv), 14, 3);
  if (n.hp <= 0 && !n.dead) {
    n.dead = true;
    n.deadT = 0;
    state.kills++;
    state.slow = 0.35;
    state.slowT = 0.8;
    state.shake = 0.25;
    msg(['Эффектно', 'Красиво', 'Ещё одна'][state.kills % 3], 1.2);
  }
}
function damagePlayer(a) {
  if (state.hp <= 0) return;
  state.hp = Math.max(0, state.hp - a);
  state.hurtT = 0.35;
  state.shake = Math.max(state.shake, 0.12);
  if (state.hp <= 0) { state.deathT = 2.5; msg('Ты пал', 2.5); }
}

const _rd = new THREE.Vector3();
function updateNPCs(dt) {
  npcRespawnT -= dt;
  const alive = npcs.filter((n) => !n.dead).length;
  if (alive < CFG.maxNpc && npcRespawnT <= 0 && state.hp > 0) { spawnNPC(); npcRespawnT = 2.2; }
  for (let i = npcs.length - 1; i >= 0; i--) {
    const n = npcs[i];
    n.hitT = Math.max(0, n.hitT - dt);
    n.mat.emissive.setRGB(n.hitT > 0 ? 0.55 : 0, n.hitT > 0 ? 0.08 : 0, n.hitT > 0 ? 0.08 : 0);
    if (n.dead) {
      n.deadT += dt;
      const f = Math.min(1, n.deadT / 0.45);
      n.root.rotation.x = -f * Math.PI / 2;
      n.root.position.set(n.x, 0, n.z);
      if (n.deadT > 6.5) { scene.remove(n.root); npcs.splice(i, 1); }
      continue;
    }
    const dx = playerPos.x - n.x, dz = playerPos.z - n.z;
    const dist = Math.hypot(dx, dz);
    n.atk = Math.max(0, n.atk - dt);
    n.attackAnim = Math.max(0, n.attackAnim - dt);
    let mx = 0, mz = 0, speed = 0;
    let face = null;
    if (dist < 9 && dist > 1.3 && state.hp > 0) {
      mx = dx / dist; mz = dz / dist; speed = 1.9; face = Math.atan2(-dx, -dz);
    } else if (dist <= 1.3 && state.hp > 0) {
      face = Math.atan2(-dx, -dz);
      if (n.atk <= 0) { n.atk = 1.3; n.attackAnim = 0.45; damagePlayer(CFG.npcDamage); }
    } else {
      n.wT -= dt;
      if (n.wT <= 0) { n.tx = rand(-EXT * 0.8, EXT * 0.8); n.tz = rand(-EXT * 0.8, EXT * 0.8); n.wT = rand(3, 6); }
      const tdx = n.tx - n.x, tdz = n.tz - n.z, td = Math.hypot(tdx, tdz);
      if (td > 0.4) { mx = tdx / td; mz = tdz / td; speed = 0.8; face = Math.atan2(-tdx, -tdz); } else n.wT = 0;
    }
    n.moving = speed > 0;
    if (speed > 0) {
      n.x += mx * speed * dt; n.z += mz * speed * dt;
      pushOut(n, 0.3);
    }
    if (face !== null) {
      let diff = face - n.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      n.root.rotation.y += diff * Math.min(1, dt * 8);
    }
    n.phase += dt * (n.moving ? 7 : 0);
    const sw = n.moving ? Math.sin(n.phase) * 0.7 : 0;
    n.legL.rotation.x = sw; n.legR.rotation.x = -sw;
    if (n.attackAnim > 0) {
      n.armR.rotation.x = -1.9 + (0.45 - n.attackAnim) * 6;
      n.armL.rotation.x = -0.4;
    } else {
      n.armR.rotation.x = -sw * 0.8; n.armL.rotation.x = sw * 0.8;
    }
    n.root.position.set(n.x, 0, n.z);
  }
}

// Пересечение луча со сферой (direction нормализован)
function raySphere(o, d, c, r) {
  _rd.subVectors(o, c);
  const b = _rd.dot(d);
  const cc = _rd.lengthSq() - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

// ----------------------------------------------------------------- управление
const keys = {};
let pointerTrigger = false, mouseRight = false, lastTap = 0, lastMX = 0, lastMY = 0;
let gpPrev = { a: false, b: false, lt: false };
let gpA = false;
const trig = { held: false, pressed: false, prev: false };
let handPinchPrev = false;

addEventListener('pointerdown', (e) => {
  if (!state.started) { startGame(); return; }
  if (e.pointerType === 'mouse' && e.button === 2) { mouseRight = true; lastMX = e.clientX; lastMY = e.clientY; return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const now = performance.now();
  if (now - lastTap < 320) { cycleTool(1); lastTap = 0; return; }
  lastTap = now;
  pointerTrigger = true;
});
const pointerRelease = () => { pointerTrigger = false; mouseRight = false; };
addEventListener('pointerup', pointerRelease);
addEventListener('pointercancel', pointerRelease);
addEventListener('pointermove', (e) => {
  if (!mouseRight && !(e.buttons & 2) ) return;
  if (gyroOn) return;
  yawOff -= (e.clientX - lastMX) * 0.005;
  pitchOff = Math.max(-1.4, Math.min(1.4, pitchOff - (e.clientY - lastMY) * 0.005));
  lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!state.started && (e.code === 'Space' || e.code === 'Enter')) { startGame(); return; }
  if (e.code === 'KeyQ') cycleTool(-1);
  if (e.code === 'KeyE') cycleTool(1);
  if (/^Digit[1-5]$/.test(e.code)) setTool(Number(e.code.slice(5)) - 1);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

function readGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

async function startGame() {
  if (state.started) return;
  state.started = true;
  $('#start').classList.add('hide');
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  } catch (e) { /* разрешение не нужно */ }
  await startCamera();
  if (!handsReady) initHands();
}

// ----------------------------------------------------------------- прицеливание
const raycaster = new THREE.Raycaster();
const aim = { o: new THREE.Vector3(), d: new THREE.Vector3(), point: new THREE.Vector3(), hit: null, fromHand: false };
const _gazeO = new THREE.Vector3(), _gazeD = new THREE.Vector3();
function computeAim(T) {
  head.getWorldPosition(_gazeO);
  _gazeD.copy(FWD).applyQuaternion(head.quaternion).normalize();
  const hand = handRigs[0];
  aim.fromHand = false;
  aim.o.copy(_gazeO);
  aim.d.copy(_gazeD);
  if (hand.g.visible && (T === 'spray' || T === 'weld')) {
    aim.o.copy(hand.anchor).applyMatrix4(head.matrixWorld);
    aim.d.copy(hand.dir).transformDirection(head.matrixWorld);
    aim.fromHand = true;
  }
  raycaster.set(aim.o, aim.d);
  raycaster.far = 60;
  const hits = raycaster.intersectObjects(pickables, false);
  aim.hit = hits[0] || null;
  aim.point.copy(aim.hit ? aim.hit.point : aim.o).addScaledVector(aim.d, aim.hit ? 0 : (aim.fromHand ? 1.4 : 2.5));
}

// ----------------------------------------------------------------- обновление инструментов
let cdTool = 0, swingT = 0, swingCd = 0, sprayColor = PAINT[0], lastPaint = null, weldTimer = 0;

function swingSword() {
  if (swingCd > 0) return;
  swingT = 0.28; swingCd = 0.42; slashT = 0.28;
  // Удары по NPC в дуге перед головой
  const fx = _gazeD.x, fz = _gazeD.z;
  const fl = Math.hypot(fx, fz) || 1;
  for (const n of npcs) {
    if (n.dead) continue;
    const dx = n.x - playerPos.x, dz = n.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.4) continue;
    const cos = (dx * fx + dz * fz) / (d * fl || 1);
    if (cos > 0.5) damageNPC(n, 2, npcCenter(n, new THREE.Vector3()));
  }
}

function updateTools(dt) {
  const T = TOOLS[tool].id;
  cdTool = Math.max(0, cdTool - dt);
  swingCd = Math.max(0, swingCd - dt);
  computeAim(T);
  const hit = aim.hit;
  const crosshairOnNPC = npcs.some((n) => !n.dead && raySphere(aim.o, aim.d, npcCenter(n, _tv), 0.45) !== null);
  document.querySelectorAll('[data-hud="reticle"]').forEach((e) => e.classList.toggle('hot', crosshairOnNPC));

  // Положение инструмента
  if (handRigs[0].g.visible) {
    const hr = handRigs[0];
    toolRoot.position.copy(hr.anchor).addScaledVector(hr.dir, 0.03);
    toolRoot.quaternion.setFromUnitVectors(FWD, hr.dir);
  } else {
    toolRoot.position.set(0.22, -0.22, -0.42);
    toolRoot.quaternion.identity();
  }
  toolRoot.updateMatrixWorld(true);
  // Анимация взмаха
  if (swingT > 0) {
    swingT = Math.max(0, swingT - dt);
    toolGroups[3].rotation.y = (swingT / 0.28 - 0.5) * 1.6;
  } else {
    toolGroups[3].rotation.y = 0;
  }
  if (slashT > 0) {
    slashT = Math.max(0, slashT - dt);
    const k = 1 - slashT / 0.28;
    slash.material.opacity = (1 - k) * 0.9;
    slash.scale.setScalar(1 + k * 0.5);
  } else slash.material.opacity = 0;

  // Скорость руки -> взмах мечом
  if (T === 'sword' && handRigs[0].g.visible && handRigs[0].speed > 2.2 && swingCd <= 0) swingSword();

  switch (T) {
    case 'cube':
      if (trig.pressed && cdTool <= 0) {
        cdTool = 0.25;
        const p = hit ? aim.point.clone().add(new THREE.Vector3(0, 0.27, 0)) : aim.o.clone().addScaledVector(aim.d, 2.2);
        spawnCube(p);
        emitSparks(p, 6, 1.2);
      }
      break;
    case 'weld': {
      const tip = toolGroups[1].userData.tip;
      tip.visible = trig.held;
      if (trig.held && hit) {
        const c = hit.object.userData && hit.object.userData.cube;
        emitSparks(aim.point, 2, 1.6);
        if (c && !c.welded) {
          c.wp = (c.wp || 0) + dt;
          if (c.wp > 0.7) { c.wp = 0; weldCube(c); }
        }
      }
      break;
    }
    case 'spray':
      if (trig.pressed) {
        sprayColor = PAINT[Math.floor(Math.random() * PAINT.length)];
        toolGroups[2].userData.cap.material.color.set(sprayColor);
        lastPaint = null;
      }
      if (trig.held) {
        const p = aim.point;
        if (!lastPaint || p.distanceTo(lastPaint) > 0.028) {
          const j = 0.012;
          const q = new THREE.Vector3(p.x + rand(-j, j), p.y + rand(-j, j), p.z + rand(-j, j)).addScaledVector(aim.d, -0.01);
          addPaint(q, sprayColor);
          lastPaint = p.clone();
        }
      } else lastPaint = null;
      break;
    case 'sword':
      if (trig.pressed) swingSword();
      break;
    case 'gun':
      if (trig.pressed && cdTool <= 0) {
        cdTool = 0.22;
        const g = toolGroups[4];
        g.userData.flash.visible = true;
        g.rotation.x = -0.15;
        flashT = 0.05;
        const muzzleW = g.userData.muzzle.getWorldPosition(new THREE.Vector3());
        let bt = hit ? hit.distance : 60, target = null;
        for (const n of npcs) {
          if (n.dead) continue;
          const t = raySphere(aim.o, aim.d, npcCenter(n, _tv), 0.42);
          if (t !== null && t < bt) { bt = t; target = n; }
        }
        const end = aim.o.clone().addScaledVector(aim.d, bt);
        addTracer(muzzleW, end);
        if (target) {
          const head_ = end.y > 1.42;
          damageNPC(target, head_ ? 3 : 1, end);
        } else if (!hit) {
          // промах — ничего
        } else {
          emitSparks(hit.point, 5, 1.5);
        }
      }
      if (toolGroups[4].rotation.x < 0) toolGroups[4].rotation.x = Math.min(0, toolGroups[4].rotation.x + dt * 1.5);
      break;
  }
  if (T !== 'weld') toolGroups[1].userData.tip.visible = false;
}
let flashT = 0;
function updateFlash(dt) {
  if (flashT > 0) {
    flashT -= dt;
    if (flashT <= 0) toolGroups[4].userData.flash.visible = false;
  }
}

// ----------------------------------------------------------------- движение и ввод
const _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
function updateMovement(dt) {
  let mxIn = 0, mzIn = 0; // mxIn — вперёд, mzIn — вправо
  if (keys.KeyW) mxIn += 1; if (keys.KeyS) mxIn -= 1;
  if (keys.KeyD) mzIn += 1; if (keys.KeyA) mzIn -= 1;
  const gp = readGamepad();
  if (gp) {
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ay) > 0.15) mxIn -= ay;
    if (Math.abs(ax) > 0.15) mzIn += ax;
    const rx = gp.axes[2] || 0;
    if (Math.abs(rx) > 0.15) yawOff -= rx * dt * 2.2;
  }
  _fw.copy(FWD).applyQuaternion(head.quaternion); _fw.y = 0;
  if (_fw.lengthSq() < 1e-6) _fw.set(0, 0, -1);
  _fw.normalize();
  _rt.set(-_fw.z, 0, _fw.x);
  const len = Math.hypot(mxIn, mzIn);
  if (len > 0.01) {
    const s = CFG.walkSpeed * dt * Math.min(1, len);
    playerPos.x += (_fw.x * mxIn + _rt.x * mzIn) / len * s;
    playerPos.z += (_fw.z * mxIn + _rt.z * mzIn) / len * s;
  }
  pushOut(playerPos, CFG.playerRadius);
  const lim = EXT - 2;
  playerPos.x = Math.max(-lim, Math.min(lim, playerPos.x));
  playerPos.z = Math.max(-lim, Math.min(lim, playerPos.z));
  // гамепад: кнопки
  if (gp) {
    const a = !!(gp.buttons[0] && gp.buttons[0].pressed);
    const b = !!(gp.buttons[1] && gp.buttons[1].pressed);
    if (a && !gpPrev.a && !state.started) startGame();
    if (b && !gpPrev.b) cycleTool(1);
    gpA = a;
    gpPrev.a = a; gpPrev.b = b;
  } else gpA = false;
}

function updateTriggers() {
  const hr0 = handRigs[0], hr1 = handRigs[1];
  const pinch0 = hr0.g.visible && hr0.pinch;
  const pinch1 = hr1.g.visible && hr1.pinch;
  if (pinch1 && !handPinchPrev) cycleTool(1);
  handPinchPrev = pinch1;
  const held = pointerTrigger || !!keys.Space || pinch0 || gpA || (!!keys.KeyF);
  trig.pressed = held && !trig.prev;
  trig.held = held;
  trig.prev = held;
}

// ----------------------------------------------------------------- HUD
const hudTpl = $('#hud-tpl');
for (let i = 0; i < 2; i++) {
  const node = hudTpl.content.cloneNode(true);
  node.querySelector('.eye').classList.add(i ? 'right' : 'left');
  $('#hud').appendChild(node);
}
function updateHUD(dt) {
  setHud('tool', TOOLS[tool].name);
  setHud('toolhint', 'щипок / тап — действие · двойной тап — сменить');
  setHud('kills', 'убито: ' + state.kills);
  setHud('status', `${statusCam} · руки: ${handRigs.filter((r) => r.g.visible).length}${gyroOn ? ' · гироскоп' : ''}${handsErr ? ' · ' + handsErr : ''}`);
  setHudStyle('hpfill', 'width', Math.max(0, state.hp) / CFG.playerMaxHp * 100 + '%');
  if (msgT > 0) { msgT -= dt; setHud('msg', msgText); }
  else setHud('msg', '');
  document.querySelectorAll('[data-hud="msg"]').forEach((e) => e.classList.toggle('show', msgT > 0));
  state.hurtT = Math.max(0, state.hurtT - dt);
  const dmgOp = (state.hurtT / 0.35) * 0.9;
  document.querySelectorAll('[data-hud="dmg"]').forEach((e) => { e.style.opacity = dmgOp.toFixed(2); });
  if (state.hp <= 0) setHud('msg', 'Ты пал');
}

// ----------------------------------------------------------------- цикл
function update(dt) {
  if (state.slowT > 0) { state.slowT -= dt; if (state.slowT <= 0) state.slow = 1; }
  const tdt = dt * state.slow;

  if (state.hp <= 0) {
    state.deathT -= dt;
    if (state.deathT <= 0) {
      state.hp = CFG.playerMaxHp;
      playerPos.set(0, CFG.eyeHeight, 0);
      msg('Снова', 1);
    }
  }
  updateMovement(dt);
  // ориентация головы
  const q = new THREE.Quaternion();
  if (gyroOn) {
    gyroQuat(q);
    head.quaternion.copy(_qy.setFromAxisAngle(UP, yawOff)).multiply(q);
  } else {
    head.quaternion.setFromEuler(_eu.set(pitchOff, yawOff, 0, 'YXZ'));
  }
  // тряска
  state.shake = Math.max(0, state.shake - dt);
  const sh = state.shake;
  head.position.set(playerPos.x + rand(-sh, sh) * 0.1, playerPos.y + rand(-sh, sh) * 0.1, playerPos.z + rand(-sh, sh) * 0.1);
  head.updateMatrixWorld(true);

  updateTriggers();
  if (handsReady) {
    const now = performance.now();
    for (const r of handRigs) updateHandRig(r, dt, now);
    head.updateMatrixWorld(true);
  }
  if (!state.started) return;
  updateTools(tdt);
  updateFlash(tdt);
  updateNPCs(tdt);
  updatePhysics(tdt);
  updateSparks(tdt);
  updateTracers(tdt);
  updateHUD(dt);
  // мерцание потолка
  for (const f of flicker) {
    f.t -= dt;
    if (f.t <= 0) {
      f.on = !f.on;
      f.t = f.on ? rand(1.5, 5) : rand(0.05, 0.25);
      panels.setColorAt(f.i, _pc.set(f.on ? 0xffffff : 0x9a9a96));
      panels.instanceColor.needsUpdate = true;
    }
  }
  dust.rotation.y += dt * 0.01;
}

function render() {
  renderer.setRenderTarget(rtL);
  renderer.setClearColor(0xe9e9e5, 1);
  renderer.clear();
  renderer.render(scene, eyeL);
  renderer.setRenderTarget(rtR);
  renderer.clear();
  renderer.render(scene, eyeR);
  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCam);
}

// Игровой старт: если без гироскопа/рук — всё равно работает (мышь, клавиатура)
if (!navigator.mediaDevices) statusCam = 'камера: нет API';

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
handLoop();
// Hands инициализируем заранее, чтобы первая модель загружалась во время меню
setTimeout(() => { if (!handsReady) initHands(); }, 300);
window.__liminal = { state, cubes, npcs, setTool, get tool() { return tool; } };
