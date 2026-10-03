// Трассеры, искры, кровь, дым, взрывы.
import * as THREE from '../../vendor/three.module.js';

class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.siz = new Float32Array(max);
    this.alp = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.cursor = 0;

    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSiz = new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlp = new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSiz);
    g.setAttribute('aAlpha', this.aAlp);
    g.setDrawRange(0, max);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vAlpha; varying vec3 vColor;
        void main(){
          vAlpha = aAlpha; vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (330.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vAlpha; varying vec3 vColor;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.06, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < max; i++) { this.pos[i * 3 + 1] = -9999; }
  }

  emit(p, v, color, size, life, grav = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i3] = v.x; this.vel[i3 + 1] = v.y; this.vel[i3 + 2] = v.z;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.siz[i] = size; this.size0[i] = size;
    this.alp[i] = 1; this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = grav; this.drag[i] = drag;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.pos[i3 + 1] = -9999; this.siz[i] = 0; this.alp[i] = 0;
        continue;
      }
      const d = 1 - this.drag[i] * dt;
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alp[i] = k;
      this.siz[i] = this.size0[i] * (0.35 + 0.65 * k);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true;
    this.aSiz.needsUpdate = true; this.aAlp.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) { this.life[i] = 0; this.pos[i * 3 + 1] = -9999; this.siz[i] = 0; }
    this.aPos.needsUpdate = true; this.aSiz.needsUpdate = true;
  }
}

const SPARK = new THREE.Color(1.0, 0.78, 0.3);
const BLOOD = new THREE.Color(0.55, 0.03, 0.03);
const DUST = new THREE.Color(0.62, 0.56, 0.44);
const SMOKE = new THREE.Color(0.22, 0.22, 0.24);
const FIRE = new THREE.Color(1.0, 0.42, 0.1);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new ParticlePool(scene, 700, true);
    this.smoke = new ParticlePool(scene, 320, false);
    this.tracers = [];
    this.flashes = [];

    this.tracerGeo = new THREE.BufferGeometry();
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));

    this.flashGeo = new THREE.PlaneGeometry(1, 1);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    });
    this.light = new THREE.PointLight(0xffaa44, 0, 26, 2);
    scene.add(this.light);
    this.lightT = 0;
  }

  tracer(a, b, color = 0xffd070) {
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const geo = this.tracerGeo.clone();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]), 3));
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ line, mat, life: 0.07 });
  }

  muzzleFlash(pos, dir) {
    const m = new THREE.Mesh(this.flashGeo, this.flashMat.clone());
    m.position.copy(pos);
    m.scale.setScalar(0.75);
    m.lookAt(pos.clone().add(dir));
    m.rotateZ(Math.random() * Math.PI);
    this.scene.add(m);
    this.flashes.push({ mesh: m, life: 0.05 });
  }

  impact(pos, kind = 'metal') {
    const n = kind === 'flesh' ? 7 : 10;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 4 + 0.5, (Math.random() - 0.5) * 6);
      this.sparks.emit(pos, v, kind === 'flesh' ? BLOOD : SPARK,
        kind === 'flesh' ? 0.13 : 0.09, 0.3 + Math.random() * 0.35, -9, 1.5);
    }
    if (kind !== 'flesh') {
      for (let i = 0; i < 4; i++) {
        this.smoke.emit(pos, new THREE.Vector3((Math.random() - .5) * 1.2, .8, (Math.random() - .5) * 1.2),
          SMOKE, 0.35, 0.6, 0.4, 1.6);
      }
    }
  }

  dust(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      this.smoke.emit(pos, new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 1.6, (Math.random() - .5) * 3),
        DUST, 0.6, 0.9, 0.2, 2.2);
    }
  }

  explosion(pos, radius = 5) {
    const m = new THREE.Mesh(this.flashGeo, this.flashMat.clone());
    m.material.color.set(0xffbb55);
    m.position.copy(pos);
    m.scale.setScalar(radius * 0.6);
    this.scene.add(m);
    this.flashes.push({ mesh: m, life: 0.3, grow: true, r0: radius * 0.6 });
    this.light.position.copy(pos);
    this.light.intensity = 60;
    this.light.distance = radius * 9;
    this.lightT = 0.25;
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3((Math.random() - .5), Math.random() * 0.9, (Math.random() - .5))
        .normalize().multiplyScalar(radius * (0.8 + Math.random()));
      this.sparks.emit(pos, v, Math.random() < .5 ? FIRE : SPARK, 0.5, 0.4 + Math.random() * 0.5, -3, 2);
    }
    for (let i = 0; i < 14; i++) {
      this.smoke.emit(pos.clone().add(new THREE.Vector3(0, 1, 0)),
        new THREE.Vector3((Math.random() - .5) * 3, 1.4 + Math.random(), (Math.random() - .5) * 3),
        SMOKE, 2.2, 1.8, 0.3, 1.4);
    }
  }

  update(dt) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mat.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose(); t.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.grow) {
        f.mesh.scale.setScalar(f.r0 * (1 + (0.3 - f.life) * 5));
        f.mesh.material.opacity = Math.max(0, f.life / 0.3);
      } else {
        f.mesh.material.opacity = Math.max(0, f.life / 0.05);
      }
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, this.light.intensity * (1 - dt * 9));
    }
  }

  clear() {
    this.sparks.clear(); this.smoke.clear();
    this.tracers.forEach(t => { this.scene.remove(t.line); t.line.geometry.dispose(); t.mat.dispose(); });
    this.tracers.length = 0;
    this.flashes.forEach(f => { this.scene.remove(f.mesh); f.mesh.material.dispose(); });
    this.flashes.length = 0;
  }
}
