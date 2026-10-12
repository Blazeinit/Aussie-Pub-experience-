
// =====================================================================
//  DRINKS: liquid shader (world-plane clip + back-face surface trick)
// =====================================================================
const DRINKS = {
  pot:      { name: 'Pot of Golden Lager', short: 'pot', price: 6.5, std: 0.9, h: 0.118, rb: 0.026, rt: 0.035, col: [0.95, 0.55, 0.08], col2: [0.55, 0.25, 0.02], foam: 0.012, beer: true },
  schooner: { name: 'Schooner of Southerly Bitter', short: 'schooner', price: 9.5, std: 1.4, h: 0.15, rb: 0.029, rt: 0.04, col: [0.9, 0.45, 0.06], col2: [0.45, 0.18, 0.02], foam: 0.014, beer: true },
  pint:     { name: "Pint of Drover's Draught", short: 'pint', price: 12.5, std: 2.0, h: 0.165, rb: 0.032, rt: 0.045, col: [0.85, 0.38, 0.05], col2: [0.4, 0.14, 0.01], foam: 0.016, beer: true },
  pale:     { name: 'Larrikin Pale Ale (schooner)', short: 'pale', price: 10.5, std: 1.5, h: 0.15, rb: 0.029, rt: 0.04, col: [1.0, 0.62, 0.18], col2: [0.7, 0.35, 0.06], foam: 0.016, beer: true, cloudy: 0.5 },
  scotch:   { name: 'Scotch on the rocks', short: 'scotch', price: 12, std: 1.1, h: 0.088, rb: 0.037, rt: 0.041, col: [0.85, 0.42, 0.08], col2: [0.5, 0.2, 0.02], foam: 0.0, beer: false, spirit: 'scotch', ice: 3, pourTo: 0.45 },
  bourbon:  { name: 'Bourbon & Coke', short: 'bourbon & coke', price: 11, std: 1.2, h: 0.135, rb: 0.033, rt: 0.035, col: [0.3, 0.1, 0.03], col2: [0.09, 0.03, 0.0], foam: 0.0, beer: false, spirit: 'bourbon', mixer: 'coke', ice: 4, pourTo: 0.2 },
  rum:      { name: 'Rum & Coke', short: 'rum & coke', price: 11, std: 1.2, h: 0.135, rb: 0.033, rt: 0.035, col: [0.25, 0.08, 0.02], col2: [0.08, 0.02, 0.0], foam: 0.0, beer: false, spirit: 'rum', mixer: 'coke', ice: 4, pourTo: 0.2 },
  vodka:    { name: 'Vodka, lime & soda', short: 'vodka soda', price: 11, std: 1.0, h: 0.135, rb: 0.033, rt: 0.035, col: [0.88, 0.95, 0.82], col2: [0.7, 0.85, 0.65], foam: 0.0, beer: false, cloudy: 0.25, spirit: 'vodka', mixer: 'soda', ice: 4, pourTo: 0.2 },
  llb:      { name: 'Lemon Lime & Bitters', short: 'LLB', price: 5, std: 0, h: 0.135, rb: 0.033, rt: 0.035, col: [1.0, 0.55, 0.45], col2: [0.8, 0.3, 0.25], foam: 0.0, beer: false, cloudy: 0.7, mixer: 'lemonade', ice: 3 },
  water:    { name: 'Glass of tap water', short: 'water', price: 0, std: 0, h: 0.12, rb: 0.03, rt: 0.034, col: [0.75, 0.85, 0.9], col2: [0.6, 0.75, 0.85], foam: 0.0, beer: false, clear: true, mixer: 'water', ice: 2 },
};
const liquidVS = `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
const liquidFS = `
uniform vec3 uP, uN, uCol, uCol2, uFoamCol; uniform float uFoamH, uTime, uCloudy, uClear, uLight;
varying vec3 vW; varying vec3 vN;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  float d = dot(vW - uP, uN);
  if (d > 0.0) discard;
  vec3 V = normalize(cameraPosition - vW);
  if (!gl_FrontFacing) {
    // inside surface seen through the cut: the liquid's top
    vec3 top = uFoamH > 0.0005 ? uFoamCol : mix(uCol, vec3(1.), .15);
    float spec = pow(max(dot(reflect(-V, uN), normalize(vec3(.3,1.,.2))), 0.), 30.);
    gl_FragColor = vec4(top * (0.38 + 0.3*uLight) + spec*.25, 1.0); return;
  }
  float depth = -d;
  vec3 c = mix(uCol2, uCol, smoothstep(0.0, 0.12, depth*3.0 + 0.2));
  float fres = pow(1.0 - abs(dot(V, vN)), 2.5);
  c = mix(c, c*1.25 + 0.02, fres*0.45);
  // rising bubbles
  vec2 g = vec2(atan(vN.z, vN.x)*12.0, vW.y*90.0 - uTime*25.0);
  vec2 cell = floor(g); vec2 f = fract(g) - .5;
  float b = step(0.92, h1(cell)) * smoothstep(.25, .05, length(f));
  c += b * 0.22 * (1.0 - uClear*0.5);
  c = mix(c, vec3(dot(c,vec3(.33)))*1.1, uCloudy*0.25);
  if (uFoamH > 0.0005 && depth < uFoamH) c = uFoamCol * (0.85 + 0.15*h1(floor(vW.xy*900.)));
  c *= 0.3 + 0.42*uLight;
  gl_FragColor = vec4(c, uClear > 0.5 ? 0.5 : 0.96);
}`;
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.2 });
interiorMats.push(glassMat);
let _iceGeo, _iceMat;
function iceGeo() { return _iceGeo || (_iceGeo = new RoundedBoxGeometry(0.022, 0.02, 0.022, 2, 0.004)); }
function iceMat() { if (!_iceMat) { _iceMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }); interiorMats.push(_iceMat); } return _iceMat; }
function makeGlass(type) {
  const D = DRINKS[type];
  const g = new THREE.Group();
  const outer = new THREE.LatheGeometry([V3(0, 0), V3(D.rb + 0.003, 0), V3(D.rb + 0.003, 0.006), V3(D.rt + 0.002, D.h), V3(D.rt, D.h)], 24);
  const gm = new THREE.Mesh(outer, glassMat); gm.renderOrder = 3; g.add(gm);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(D.rb + 0.003, D.rb + 0.004, 0.008, 20), glassMat); base.position.y = 0.004; base.renderOrder = 3; g.add(base);
  const y0 = 0.009, y1 = D.h * 0.985;
  const inner = new THREE.LatheGeometry([V3(0, y0), V3(D.rb - 0.001, y0), V3(D.rt - 0.002, y1)], 24);
  const mat = new THREE.ShaderMaterial({
    vertexShader: liquidVS, fragmentShader: liquidFS, side: THREE.DoubleSide, transparent: !!D.clear,
    uniforms: { uP: { value: V3() }, uN: { value: V3(0, 1, 0) }, uCol: { value: new THREE.Color(...D.col) }, uCol2: { value: new THREE.Color(...D.col2) }, uFoamCol: { value: new THREE.Color(0.86, 0.8, 0.68) }, uFoamH: { value: D.foam }, uTime: { value: 0 }, uCloudy: { value: D.cloudy || 0 }, uClear: { value: D.clear ? 1 : 0 }, uLight: { value: 1 } }
  });
  const lm = new THREE.Mesh(inner, mat); lm.renderOrder = 2; lm.frustumCulled = false; g.add(lm);
  const ice = new THREE.Group(); g.add(ice);
  const o = { type, D, group: g, mat, liquid: lm, ice, fill: 1, y0, y1,
    addIce(n) { for (let i = 0; i < n; i++) { const c = new THREE.Mesh(iceGeo(), iceMat()); const a = i * 2.3 + Math.random(); c.position.set(Math.cos(a) * D.rb * 0.45, 0.02 + i * 0.012, Math.sin(a) * D.rb * 0.45); c.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1)); c.renderOrder = 3; ice.add(c); } }, slosh: new THREE.Vector2(), sloshV: new THREE.Vector2(), lastPos: null, lastVel: V3(), foam: D.foam,
    update(dt, t) {
      const u = mat.uniforms; u.uTime.value = t;
      g.updateWorldMatrix(true, false);
      const up = _v1.set(0, 1, 0).transformDirection(g.matrixWorld);
      const base = _v2.setFromMatrixPosition(g.matrixWorld);
      // volume-ish: tilted glass raises the level along its axis a little
      const tilt = Math.acos(clamp(up.y, -1, 1));
      const hh = this.y0 + (this.y1 - this.y0) * this.fill;
      u.uP.value.copy(base).addScaledVector(up, hh + Math.min(0.03, tilt * 0.02 * this.fill));
      u.uN.value.set(this.slosh.x, 1, this.slosh.y).normalize();
      u.uFoamH.value = this.fill > 0.02 ? this.foam : 0;
      lm.visible = this.fill > 0.004;
      // ice floats on whatever's in the glass
      const top = this.y0 + (this.y1 - this.y0) * this.fill;
      ice.children.forEach((c, i) => { c.position.y = Math.max(0.018 + (i % 2) * 0.012, Math.min(top - 0.008 - (i % 3) * 0.01, this.D.h - 0.02)); });
    },
    // spring-damper slosh driven by acceleration of the glass
    physics(dt) {
      g.updateWorldMatrix(true, false);
      const p = _v3.setFromMatrixPosition(g.matrixWorld);
      if (!this.lastPos) { this.lastPos = p.clone(); return 0; }
      const vel = p.clone().sub(this.lastPos).divideScalar(Math.max(dt, 1e-4));
      const acc = vel.clone().sub(this.lastVel).divideScalar(Math.max(dt, 1e-4));
      this.lastPos.copy(p); this.lastVel.copy(vel);
      acc.clampLength(0, 40);
      const k = 140, c = 4.5;
      this.sloshV.x += (-k * this.slosh.x - c * this.sloshV.x - acc.x * 0.9) * dt;
      this.sloshV.y += (-k * this.slosh.y - c * this.sloshV.y - acc.z * 0.9) * dt;
      this.slosh.addScaledVector(this.sloshV, dt);
      this.slosh.clampLength(0, 1.2);
      // spill when the surface reaches the rim
      const margin = (1 - this.fill) * 1.6 + 0.12;
      const amp = this.slosh.length();
      if (amp > margin && this.fill > 0.02) { const spill = Math.min(this.fill, (amp - margin) * 0.25); this.fill -= spill; return spill; }
      return 0;
    }
  };
  return o;
}

// =====================================================================
//  PARTICLES: smoke (soft billboard) + droplets/sparks; puddles; shards
// =====================================================================
class Particles {
  constructor(n, tex, opts) {
    this.n = n; this.i = 0; this.opts = opts;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3); this.grow = new Float32Array(n); this.a0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: tex }, uScale: { value: innerHeight / 2 } }, transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); float z=-mv.z; vA=alpha*smoothstep(0.12,0.7,z); gl_PointSize = min(size*uScale/max(0.05,z), 420.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D tex; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); if(gl_FragColor.a<0.004) discard; }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
    this.onHit = null;
  }
  emit(p, v, size, life, alpha, col = [1, 1, 1], grow = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.a0[i] = alpha; this.alpha[i] = alpha; this.col.set(col, i * 3); this.grow[i] = grow;
  }
  update(dt, t) {
    const o = this.opts;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3, f = this.life[i] / this.max[i];
      if (o.smoke) {
        this.vel[k] += Math.sin(t * 1.7 + i * 0.37 + this.pos[k + 1] * 4) * 0.25 * dt;
        this.vel[k + 2] += Math.cos(t * 1.3 + i * 0.71 + this.pos[k + 1] * 3) * 0.25 * dt;
        this.vel[k + 1] += 0.08 * dt;
        const drag = Math.exp(-1.6 * dt); this.vel[k] *= drag; this.vel[k + 1] *= Math.exp(-0.6 * dt); this.vel[k + 2] *= drag;
        this.size[i] += this.grow[i] * dt;
        this.alpha[i] = this.a0[i] * Math.min(1, (1 - f) * 6) * f;
        if (this.pos[k + 1] > PUB.ceil - 0.1 && isInside(this.pos[k], this.pos[k + 2])) { this.vel[k + 1] = 0; this.pos[k + 1] = PUB.ceil - 0.1; this.vel[k] *= 1.02; }
      } else {
        this.vel[k + 1] -= 9.8 * dt;
        this.alpha[i] = this.a0[i] * Math.min(1, f * 3);
        const gy = groundY(this.pos[k], this.pos[k + 2], this.pos[k + 1]);
        if (this.pos[k + 1] < gy + 0.005 && this.vel[k + 1] < 0) {
          if (this.onHit) this.onHit(this.pos[k], gy, this.pos[k + 2], i);
          this.life[i] = 0; this.alpha[i] = 0;
        }
      }
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.color.needsUpdate = true;
  }
}
let smokeFX, dropFX, sparkFX;
const puddles = [];
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x3a2008, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
function addPuddle(x, y, z, s) {
  for (const p of puddles) if (Math.hypot(p.position.x - x, p.position.z - z) < p.scale.x * 0.7) { p.userData.target = Math.min(0.6, p.userData.target + s * 0.3); return; }
  if (puddles.length > 40) { const old = puddles.shift(); scene.remove(old); }
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), puddleMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.008, z);
  m.scale.setScalar(0.01); m.userData.target = s; scene.add(m); puddles.push(m);
}
function initFX() {
  smokeFX = new Particles(700, TEX.smoke, { smoke: true });
  dropFX = new Particles(300, TEX.dot, {});
  sparkFX = new Particles(120, TEX.dot, { additive: true });
  dropFX.onHit = (x, y, z, i) => { if (Math.random() < 0.35) addPuddle(x, y, z, rand(0.04, 0.09)); };
}
function updatePuddles(dt) { for (const p of puddles) { const s = p.scale.x; p.scale.setScalar(damp(s, p.userData.target, 2, dt)); } }
function spillDrops(pos, amount, col) {
  const n = Math.min(40, Math.ceil(amount * 120));
  for (let i = 0; i < n; i++) dropFX.emit(pos, V3(rand(-0.6, 0.6), rand(-0.2, 0.8), rand(-0.6, 0.6)), rand(0.006, 0.014), 2, 0.9, col);
}

// glass shards — tiny rigid bodies with floor bounce + friction
const shards = [];
function shatterGlass(pos, glass) {
  const D = glass.D;
  for (let i = 0; i < 22; i++) {
    const s = rand(0.012, 0.035);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, s, rand(-s, s), 0, rand(0, s), s, rand(-s / 2, s / 2)], 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, glassMat); m.position.copy(pos).add(V3(rand(-.03, .03), rand(0, .1), rand(-.03, .03))); m.renderOrder = 3; scene.add(m);
    shards.push({ m, v: V3(rand(-2, 2), rand(0.5, 2.8), rand(-2, 2)), w: V3(rand(-20, 20), rand(-20, 20), rand(-20, 20)), life: 25 + rand(0, 10) });
  }
  if (glass.fill > 0.02) { spillDrops(pos, glass.fill * 0.8, [D.col[0] * 0.8, D.col[1] * 0.8, D.col[2] * 0.8]); addPuddle(pos.x, groundY(pos.x, pos.z, pos.y), pos.z, 0.25 + glass.fill * 0.35); }
  SFX.smash(pos);
}
function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]; s.life -= dt;
    const gy = groundY(s.m.position.x, s.m.position.z, s.m.position.y) + 0.004;
    s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
    if (s.m.position.y < gy) { s.m.position.y = gy; if (s.v.y < -0.3) { s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.5); if (Math.random() < 0.3) SFX.tone(rand(4000, 7000), 0.05, { gain: 0.02, pos: s.m.position }); } else { s.v.set(0, 0, 0); s.w.multiplyScalar(0.8); } }
    if (s.life <= 0) { scene.remove(s.m); s.m.geometry.dispose(); shards.splice(i, 1); }
  }
}
// free-falling dropped glass (until impact)
const fallingGlasses = [];
function dropGlass(glass, vel) {
  glass.group.updateWorldMatrix(true, false);
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(); glass.group.matrixWorld.decompose(wp, wq, _v3);
  glass.group.parent && glass.group.parent.remove(glass.group);
  scene.add(glass.group); glass.group.position.copy(wp); glass.group.quaternion.copy(wq); glass.group.scale.set(1, 1, 1);
  fallingGlasses.push({ glass, v: vel.clone(), w: V3(rand(-6, 6), rand(-2, 2), rand(-6, 6)) });
}
function updateFalling(dt, t) {
  for (let i = fallingGlasses.length - 1; i >= 0; i--) {
    const f = fallingGlasses[i], g = f.glass.group;
    f.v.y -= 9.8 * dt; g.position.addScaledVector(f.v, dt);
    g.rotateX(f.w.x * dt); g.rotateZ(f.w.z * dt);
    f.glass.update(dt, t);
    if (f.glass.fill > 0.02 && Math.random() < 0.6) { dropFX.emit(g.position.clone().add(V3(0, 0.12, 0)), V3(rand(-.3, .3), 0, rand(-.3, .3)), 0.01, 2, 0.9, f.glass.D.col); f.glass.fill -= dt * 0.5; }
    if (g.position.y < groundY(g.position.x, g.position.z, g.position.y) + 0.02) { shatterGlass(g.position.clone(), f.glass); scene.remove(g); fallingGlasses.splice(i, 1); Game.onGlassSmash(g.position.clone()); }
  }
}

// beer stream from tap to glass
function makeStream() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 0.6, 0.1) } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.x += sin(uv.y*20.+uTime*30.)*0.0008; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol; void main(){ float s = 0.75+0.25*sin(vUv.y*60.-uTime*40.); float edge = smoothstep(0.,.3,vUv.x)*smoothstep(1.,.7,vUv.x); gl_FragColor=vec4(uCol*s*1.3, .85*edge); }`
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.004, 1, 8, 1, true), mat); m.visible = false; m.renderOrder = 4; scene.add(m);
  return m;
}

// =====================================================================
//  HUMANS: procedural rig, poses, IK
// =====================================================================
const NPC_NAMES = ['Davo', 'Shazza', 'Gazza', 'Kev', 'Bazza', 'Trev', 'Macca', 'Robbo', 'Jonesy', 'Tracey', 'Kylie', 'Big Sue', 'Old Mick', 'Nev', 'Dazza', 'Steve-O', 'Brenda', 'Noddy', 'Spud', 'Fitzy', 'Wazza', 'Lorraine', 'Bev', 'Sticks', 'Kenno', 'Deb', 'Mully', 'Chook'];
const SKIN = [0xf0c4a0, 0xd9a383, 0xc68a64, 0x9a6440, 0x6a4028, 0xe8b894];
// outfit = { tile: atlas pattern, c: tint }
const SHIRTS = [{ tile: 'hivis', c: 0xff7a1a }, { tile: 'hivis', c: 0xe8e01a }, { tile: 'flannel', c: 0xb02424 }, { tile: 'flannel', c: 0x2a5aa8 }, { tile: 'flannel', c: 0x2f7a34 },
  { tile: 'collar', c: 0x1a2a4a }, { tile: 'collar', c: 0x161616 }, { tile: 'cloth', c: 0xe8e8e8 }, { tile: 'hoops', c: 0xffffff }, { tile: 'hoops', c: 0xb03040 }, { tile: 'collar', c: 0x4a2a5a }, { tile: 'hivis', c: 0xff7a1a }, { tile: 'cloth', c: 0x2a5a2a }];
const PANTS = [{ tile: 'denim', c: 0xffffff }, { tile: 'denim', c: 0xcfd6e0 }, { tile: 'cloth', c: 0x6a5a3a }, { tile: 'cloth', c: 0x222222 }, { tile: 'cloth', c: 0x1a2440 }, { tile: 'denim', c: 0xffffff }];
const HAIR = [0x1a120a, 0x3a2412, 0x6a4a2a, 0xa8a8a8, 0xd8c08a, 0x2a1a0a, 0x8a3a18];
const capsGeo = new THREE.CapsuleGeometry(1, 1, 5, 14);
const sphGeoH = new THREE.SphereGeometry(1, 24, 18);
const matCache = {};
function cm(col, rough = 0.7) { const k = col + '_' + rough; if (!matCache[k]) { matCache[k] = M({ color: col, roughness: rough }); } return matCache[k]; }
function flannelMat(col) {
  const k = 'fl' + col; if (matCache[k]) return matCache[k];
  const c = mkCanvas(64, 64), x = c.getContext('2d'); const base = new THREE.Color(col);
  x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 6, 64); x.fillRect(0, i, 64, 6); }
  x.fillStyle = 'rgba(255,255,255,.15)'; for (let i = 8; i < 64; i += 16) { x.fillRect(i, 0, 2, 64); x.fillRect(0, i, 64, 2); }
  const fm = M({ map: canvasTex(c, 3, 3), roughness: 0.9 }); fm.userData.base = col;
  return (matCache[k] = fm);
}

// ---------- character texture atlas: fabrics, hair, painted faces (one texture for everyone) ----------
const ATLAS = { tex: null, rect: {} };
function buildAtlas() {
  const N = 4, T = 256, c = mkCanvas(N * T, N * T), x = c.getContext('2d');
  const names = ['cloth', 'skin', 'flannel', 'hivis', 'hoops', 'denim', 'hair', 'shoe', 'collar', 'face0', 'face1', 'face2', 'face3', 'face4', 'face5', 'mouth'];
  const grain = (x0, y0, amt, a = 0.08) => { for (let i = 0; i < amt; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(x0 + Math.random() * T, y0 + Math.random() * T, rand(1, 3), rand(1, 3)); } };
  names.forEach((n, i) => {
    const x0 = (i % N) * T, y0 = Math.floor(i / N) * T;
    x.save(); x.beginPath(); x.rect(x0, y0, T, T); x.clip();
    if (n === 'cloth' || n === 'collar') { x.fillStyle = '#f2f2f2'; x.fillRect(x0, y0, T, T); grain(x0, y0, 2500, 0.06); for (let k = 0; k < T; k += 3) { x.fillStyle = 'rgba(0,0,0,.035)'; x.fillRect(x0, y0 + k, T, 1); }
      if (n === 'collar') { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(x0, y0 + 8, T, 5); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(x0 + T * 0.24, y0 + 14, 3, 40); for (let b = 0; b < 3; b++) { x.fillStyle = '#ddd'; x.beginPath(); x.arc(x0 + T * 0.25 + 6, y0 + 24 + b * 14, 3, 0, 7); x.fill(); } } }
    if (n === 'skin') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1800, 0.035); }
    if (n === 'flannel') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); for (let k = 0; k < T; k += 42) { x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(x0 + k, y0, 16, T); x.fillRect(x0, y0 + k, T, 16); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(x0 + k + 26, y0, 3, T); x.fillRect(x0, y0 + k + 26, T, 3); } grain(x0, y0, 2000, 0.07); }
    if (n === 'hivis') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1500, 0.05); for (const yy of [0.42, 0.62]) { x.fillStyle = '#5a5a5a'; x.fillRect(x0, y0 + T * (1 - yy) - 9, T, 18); x.fillStyle = '#a8a8a8'; x.fillRect(x0, y0 + T * (1 - yy) - 6, T, 12); } }
    if (n === 'hoops') { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#262626' : '#ffffff'; x.fillRect(x0, y0 + k * T / 8, T, T / 8); } grain(x0, y0, 1500, 0.06); }
    if (n === 'denim') { x.fillStyle = '#3c5a86'; x.fillRect(x0, y0, T, T); for (let k = 0; k < 3000; k++) { x.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,30,60' : '170,190,220'},.18)`; const px = x0 + Math.random() * T, py = y0 + Math.random() * T; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4, py + 4); x.stroke(); } x.fillStyle = 'rgba(200,150,60,.6)'; x.fillRect(x0 + T * 0.5, y0, 2, T); }
    if (n === 'hair') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); for (let k = 0; k < 900; k++) { x.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.25)})`; x.lineWidth = rand(0.5, 1.5); const px = x0 + Math.random() * T; x.beginPath(); x.moveTo(px, y0); x.bezierCurveTo(px + rand(-6, 6), y0 + T / 3, px + rand(-6, 6), y0 + T * 2 / 3, px + rand(-8, 8), y0 + T); x.stroke(); } }
    if (n === 'shoe') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1500, 0.08); x.fillStyle = '#222'; x.fillRect(x0, y0 + T * 0.82, T, T * 0.18); x.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < 6; k++) x.fillRect(x0 + T * 0.2 + k * 10, y0 + T * 0.3, 5, 3); }
    if (n === 'mouth') { x.fillStyle = '#5a1a18'; x.fillRect(x0, y0, T, T); x.fillStyle = '#e8e0d4'; x.fillRect(x0, y0 + T * 0.4, T, T * 0.14); }
    if (n.startsWith('face')) {
      const tone = new THREE.Color(SKIN[+n[4]]), hex = '#' + tone.getHexString(), dark = '#' + tone.clone().multiplyScalar(0.62).getHexString();
      x.fillStyle = hex; x.fillRect(x0, y0, T, T); grain(x0, y0, 1600, 0.03);
      // head sphere UVs: front of the face sits at u = 0.25; v = 1 - polar/π
      const U = u => x0 + u * T, Vy = v => y0 + (1 - v) * T;
      const blush = x.createRadialGradient(U(0.25), Vy(0.45), 2, U(0.25), Vy(0.45), 40); blush.addColorStop(0, 'rgba(190,70,60,.18)'); blush.addColorStop(1, 'rgba(190,70,60,0)'); x.fillStyle = blush; x.fillRect(x0, y0, T, T);
      for (const s of [-1, 1]) {
        const ex = U(0.25 + s * 0.052), ey = Vy(0.555);
        x.fillStyle = dark; x.beginPath(); x.ellipse(ex, ey + 1, 10, 6.5, 0, 0, 7); x.fill(); // socket shadow
        x.fillStyle = '#f4f0ea'; x.beginPath(); x.ellipse(ex, ey, 8, 4.6, 0, 0, 7); x.fill();
        x.fillStyle = choice(['#4a2a14', '#2a4a7a', '#3a5a2a', '#1a1208']); x.beginPath(); x.arc(ex + s * -0.8, ey, 3.6, 0, 7); x.fill();
        x.fillStyle = '#050505'; x.beginPath(); x.arc(ex + s * -0.8, ey, 1.7, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(ex + s * -0.8 + 1, ey - 2, 1.5, 1.5);
        x.strokeStyle = '#2a1a10'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(ex - 9, ey - 9 + s * 0); x.quadraticCurveTo(ex, ey - 13, ex + 9, ey - 9); x.stroke();
      }
      x.strokeStyle = dark; x.lineWidth = 2; x.beginPath(); x.moveTo(U(0.25), Vy(0.53)); x.lineTo(U(0.255), Vy(0.46)); x.stroke(); // nose ridge shade
      x.strokeStyle = '#7a3a30'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(U(0.25) - 13, Vy(0.392)); x.quadraticCurveTo(U(0.25), Vy(0.385), U(0.25) + 13, Vy(0.392)); x.stroke();
      x.strokeStyle = 'rgba(150,70,60,.6)'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(U(0.25) - 9, Vy(0.375)); x.quadraticCurveTo(U(0.25), Vy(0.366), U(0.25) + 9, Vy(0.375)); x.stroke();
    }
    x.restore();
    ATLAS.rect[n] = [(i % N) / N, 1 - (Math.floor(i / N) + 1) / N, (i % N + 1) / N, 1 - Math.floor(i / N) / N];
  });
  ATLAS.tex = new THREE.CanvasTexture(c); ATLAS.tex.colorSpace = THREE.SRGBColorSpace; ATLAS.tex.anisotropy = 4;
}

function limb(parent, r, len, tile, col, y = 0, sx = 1) {
  const m = new THREE.Mesh(capsGeo); m.scale.set(r * sx, len / 2, r); m.position.y = -len / 2 + y;
  m.userData = { tile, col }; parent.add(m); return m;
}
function part(parent, geo, tile, col, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.userData = { tile, col }; parent.add(m); return m;
}
function makeHuman(o = {}) {
  if (!ATLAS.tex) buildAtlas();
  const fem = o.fem ?? Math.random() < 0.38;
  const skinI = o.skinI ?? randi(0, SKIN.length - 1), skin = SKIN[skinI];
  const sh = o.shirt ?? choice(SHIRTS), pa = o.pants ?? choice(PANTS);
  const hairC = o.hair ?? choice(HAIR), shoeC = o.shoes ?? choice([0x2a1a0a, 0x161616, 0x6a4a2a, 0xe8e8e8]);
  const sc = o.scale ?? (fem ? rand(0.92, 0.99) : rand(0.97, 1.08)), girth = o.girth ?? (fem ? rand(0.88, 1.02) : rand(0.95, 1.3));
  const gC = Math.min(girth, 1.15), shorts = o.shorts ?? (!fem && Math.random() < 0.45), skirt = o.skirt ?? (fem && Math.random() < 0.45);
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(sc); root.add(body);
  const J = {};
  J.hips = new THREE.Group(); J.hips.position.y = 0.92; body.add(J.hips);
  part(J.hips, sphGeoH, pa.tile, pa.c, 0, 0, 0, 0.165 * girth * (fem ? 1.08 : 1), 0.11, 0.12 * girth);
  part(J.hips, new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), 'cloth', 0x2a1a10, 0, 0.05, 0, 0.158 * girth * (fem ? 1.06 : 1), 0.03, 0.118 * girth); // belt
  if (skirt) part(J.hips, new THREE.CylinderGeometry(0.6, 1, 1, 20, 1, false), pa.tile === 'denim' ? 'denim' : 'cloth', pa.c, 0, -0.16, 0, 0.21 * girth, 0.3, 0.17 * girth);
  J.spine = new THREE.Group(); J.spine.position.y = 0.05; J.hips.add(J.spine);
  part(J.spine, capsGeo, sh.tile, sh.c, 0, 0.12, girth > 1.15 ? 0.02 : 0, 0.15 * girth, 0.08, 0.125 * girth * (girth > 1.15 ? 1.12 : 1));
  J.chest = new THREE.Group(); J.chest.position.y = 0.24; J.spine.add(J.chest);
  part(J.chest, capsGeo, sh.tile, sh.c, 0, 0.07, 0, 0.19 * gC * (fem ? 0.92 : 1), 0.075, 0.118 * Math.min(girth, 1.1));
  if (fem) for (const s of [-1, 1]) part(J.chest, sphGeoH, sh.tile, sh.c, s * 0.06, 0.06, 0.075, 0.06, 0.055, 0.05);
  part(J.chest, sphGeoH, sh.tile, sh.c, 0, 0.16, 0, 0.21 * gC * (fem ? 0.9 : 1), 0.06, 0.11); // shoulders
  J.neck = new THREE.Group(); J.neck.position.y = 0.24; J.chest.add(J.neck);
  limb(J.neck, 0.047, 0.07, 'skin', skin, 0.055);
  if (sh.tile === 'collar') part(J.neck, new THREE.CylinderGeometry(1, 1.1, 1, 16, 1, true), 'collar', sh.c, 0, -0.005, 0, 0.058, 0.035, 0.058);
  J.head = new THREE.Group(); J.head.position.y = 0.07; J.neck.add(J.head);
  part(J.head, sphGeoH, 'face' + skinI, 0xffffff, 0, 0.085, 0, 0.093, 0.115, 0.104);
  part(J.head, sphGeoH, 'skin', skin, 0, 0.03, 0.03, 0.075, 0.05, 0.075); // jaw / chin
  part(J.head, sphGeoH, 'skin', skin, 0, 0.074, 0.103, 0.015, 0.024, 0.02); // nose
  for (const s of [-1, 1]) part(J.head, sphGeoH, 'skin', skin, s * 0.092, 0.085, -0.005, 0.014, 0.026, 0.02); // ears
  // eyelids (blink) and mouth (talk) get their own bones
  J.lids = new THREE.Group(); J.lids.position.set(0, 0.101, 0.083); J.head.add(J.lids);
  for (const s of [-1, 1]) part(J.lids, sphGeoH, 'skin', skin, s * 0.034, 0, 0.004, 0.019, 0.011, 0.012);
  J.jaw = new THREE.Group(); J.jaw.position.set(0, 0.046, 0.09); J.head.add(J.jaw);
  part(J.jaw, sphGeoH, 'mouth', 0xffffff, 0, 0, 0.004, 0.016, 0.009, 0.01);
  // hair / hats / facial hair / glasses
  const style = o.style ?? (fem ? choice(['long', 'bob', 'pony', 'long']) : choice(['short', 'short', 'bald', 'cap', 'bucket', 'mullet', 'short']));
  if (style !== 'bald') {
    part(J.head, sphGeoH, 'hair', hairC, 0, 0.122, -0.01, 0.099, 0.095, 0.11);
    if (style === 'long' || style === 'mullet') part(J.head, sphGeoH, 'hair', hairC, 0, style === 'long' ? 0.0 : 0.03, -0.065, 0.098, style === 'long' ? 0.17 : 0.1, 0.06);
    if (style === 'pony') part(J.head, capsGeo, 'hair', hairC, 0, 0.06, -0.12, 0.03, 0.06, 0.03, 0.5);
    if (style === 'bob') part(J.head, sphGeoH, 'hair', hairC, 0, 0.065, -0.02, 0.108, 0.1, 0.1);
    if (fem) part(J.head, sphGeoH, 'hair', hairC, 0, 0.16, 0.06, 0.08, 0.035, 0.05, 0.3); // fringe
  } else part(J.head, sphGeoH, 'hair', hairC, 0, 0.07, -0.03, 0.098, 0.05, 0.09); // fringe of a bald head
  if (style === 'cap') { const cc = choice([0x1a2a5a, 0x8a1a1a, 0x161616, 0x2a5a2a, 0xe8e8e8]); part(J.head, sphGeoH, 'cloth', cc, 0, 0.14, 0, 0.102, 0.075, 0.112); part(J.head, new THREE.CylinderGeometry(1, 1, 1, 18), 'cloth', cc, 0, 0.145, 0.1, 0.07, 0.008, 0.056, 0.15); if (Math.random() < 0.4) part(J.head, new THREE.BoxGeometry(1, 1, 1), 'cloth', 0x111111, 0, 0.17, 0.06, 0.12, 0.03, 0.03, 0.2); }
  if (style === 'bucket') { const hc = choice([0xd8c8a0, 0x3a4a2a]); part(J.head, new THREE.CylinderGeometry(0.85, 1, 1, 18), 'cloth', hc, 0, 0.175, 0, 0.1, 0.08, 0.1); part(J.head, new THREE.CylinderGeometry(1, 1, 1, 20), 'cloth', hc, 0, 0.14, 0, 0.15, 0.008, 0.15, 0.08); }
  const beard = o.beard ?? (!fem && Math.random() < 0.4 ? (Math.random() < 0.6 ? 'full' : 'mo') : null);
  if (beard) { const full = beard === 'full'; part(J.head, sphGeoH, 'hair', hairC, 0, full ? 0.022 : 0.05, full ? 0.05 : 0.093, full ? 0.083 : 0.03, full ? 0.06 : 0.009, full ? 0.068 : 0.012); }
  if (o.glasses ?? Math.random() < 0.18) { const gc = Math.random() < 0.5 ? 0x111111 : 0x6a4a2a; for (const s of [-1, 1]) part(J.head, new THREE.TorusGeometry(1, 0.18, 6, 16), 'cloth', gc, s * 0.034, 0.1, 0.104, 0.018, 0.014, 0.01); part(J.head, new THREE.BoxGeometry(1, 1, 1), 'cloth', gc, 0, 0.103, 0.106, 0.03, 0.003, 0.003); }
  // arms & legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'l' : 'r';
    const ua = new THREE.Group(); ua.position.set(s * 0.2 * Math.min(girth, 1.12) * (fem ? 0.92 : 1), 0.18, 0); J.chest.add(ua);
    limb(ua, 0.05 * (fem ? 0.88 : 1), 0.27, sh.tile, sh.c);
    const el = new THREE.Group(); el.position.y = -0.29; ua.add(el);
    const longSleeve = sh.tile === 'flannel' || sh.tile === 'hivis';
    limb(el, 0.042 * (fem ? 0.88 : 1), 0.23, longSleeve ? sh.tile : 'skin', longSleeve ? sh.c : skin);
    const hand = new THREE.Group(); hand.position.y = -0.26; el.add(hand);
    part(hand, sphGeoH, 'skin', skin, 0, -0.035, 0, 0.034, 0.05, 0.02);
    part(hand, capsGeo, 'skin', skin, s * -0.02, -0.03, 0.012, 0.009, 0.018, 0.009, 0.5, 0, s * -0.5); // thumb
    J[side + 'UA'] = ua; J[side + 'EL'] = el; J[side + 'H'] = hand;
    const th = new THREE.Group(); th.position.set(s * 0.09 * (fem ? 1.05 : 1), -0.04, 0); J.hips.add(th);
    limb(th, 0.072 * Math.min(girth, 1.15), 0.41, skirt ? 'skin' : pa.tile, skirt ? skin : pa.c);
    const kn = new THREE.Group(); kn.position.y = -0.43; th.add(kn);
    limb(kn, 0.054, 0.38, shorts || skirt ? 'skin' : pa.tile, shorts || skirt ? skin : pa.c);
    if (shorts) part(kn, new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), 'cloth', 0xe8e8e8, 0, -0.33, 0, 0.056, 0.05, 0.056); // footy socks
    const ft = new THREE.Group(); ft.position.y = -0.42; kn.add(ft);
    part(ft, new RoundedBoxGeometry(0.09, 0.07, 0.25, 2, 0.03), 'shoe', shoeC, 0, -0.035, 0.05, 1, 1, 1);
    J[side + 'TH'] = th; J[side + 'KN'] = kn; J[side + 'FT'] = ft;
  }
  return skinify({ root, J, fem, scale: sc, style });
}

// Collapse the procedural body into ONE skinned mesh (rigid weights) using the shared atlas:
// identical animation code (it drives Bones instead of Groups), one draw call per person.
let npcSkinMat = null;
function skinify(h) {
  if (!npcSkinMat) { npcSkinMat = new THREE.MeshStandardMaterial({ map: ATLAS.tex, vertexColors: true, roughness: 0.78, metalness: 0 }); interiorMats.push(npcSkinMat); }
  const body = h.root.children[0], groups = [body], names = ['body'];
  for (const k in h.J) { groups.push(h.J[k]); names.push(k); }
  h.root.updateMatrixWorld(true);
  const bones = groups.map(g => { const b = new THREE.Bone(); b.position.copy(g.position); b.quaternion.copy(g.quaternion); b.scale.copy(g.scale); return b; });
  groups.forEach((g, i) => { if (i === 0) h.root.add(bones[0]); else bones[groups.indexOf(g.parent)].add(bones[i]); });
  const inv = new THREE.Matrix4().copy(h.root.matrixWorld).invert(), geos = [], col = new THREE.Color();
  groups.forEach((g, bi) => {
    for (const m of g.children) {
      if (!m.isMesh) continue;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      const n = geo.attributes.position.count, ca = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const ud = m.userData || {}, r = ATLAS.rect[ud.tile || 'cloth'];
      col.set(ud.col ?? 0xffffff);
      const pad = 0.004, uv = geo.attributes.uv;
      for (let i = 0; i < n; i++) {
        ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; si[i * 4] = bi; sw[i * 4] = 1;
        if (uv) uv.setXY(i, lerp(r[0] + pad, r[2] - pad, clamp(uv.getX(i), 0, 1)), lerp(r[1] + pad, r[3] - pad, clamp(uv.getY(i), 0, 1)));
      }
      if (!uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2).fill((r[0] + r[2]) / 2), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(geo);
    }
  });
  const sm = new THREE.SkinnedMesh(mergeGeometries(geos), npcSkinMat);
  geos.forEach(g => g.dispose());
  h.root.remove(body); h.root.add(sm);
  h.root.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  const J = {}; names.forEach((n, i) => { if (i > 0) J[n] = bones[i]; });
  J.lids.scale.y = 0.05; J.jaw.scale.y = 0.35;
  h.J = J; h.mesh = sm;
  return h;
}

// pose targets in radians. Convention: x<0 swings a limb forward (+z).
function poseFor(kind, t, a) {
  const p = { hipsY: 0.92, hipsX: 0, hipsZ: 0, spineZ: 0, spine: 0, chest: 0, neck: 0, headX: 0, headY: 0, lUAx: 0.05, lUAz: 0.12, lEL: -0.15, rUAx: 0.05, rUAz: -0.12, rEL: -0.15, lTH: 0, lKN: 0, rTH: 0, rKN: 0, lFT: 0, rFT: 0 };
  const breath = Math.sin(t * 1.6) * 0.02;
  p.chest = breath; p.headX = Math.sin(t * 0.3) * 0.05; p.headY = Math.sin(t * 0.21 + a.seed) * 0.3;
  if (kind === 'walk') {
    const ph = a.walkPh, sw = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
    p.lTH = -sw * 0.5; p.rTH = -s2 * 0.5;
    p.lKN = Math.max(0, Math.sin(ph - 1.2)) * 0.9 + 0.05; p.rKN = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 0.9 + 0.05;
    p.lUAx = sw * 0.38; p.rUAx = s2 * 0.38; p.lEL = -0.3; p.rEL = -0.3;
    p.hipsY = 0.92 - Math.abs(Math.cos(ph)) * 0.025 + 0.012; p.spine = 0.05; p.headY = 0;
    if (a.drunk > 0.5) { p.hipsX = Math.sin(t * 1.3) * 0.08; p.headX = 0.2; }
  } else if (kind === 'sit' || kind === 'pokie' || kind === 'sitTable') {
    p.hipsY = a.sitH + 0.08; p.lTH = -1.5; p.rTH = -1.5; p.lKN = 1.45; p.rKN = 1.45; p.spine = 0.1; p.lFT = 0.1; p.rFT = 0.1;
    if (kind === 'pokie') {
      p.spine = 0.18; p.chest = 0.05 + breath; p.headX = 0.05; p.headY = 0;
      const tap = a.tapT > 0 ? Math.sin(a.tapT * 18) * 0.5 + 0.5 : 0;
      p.rUAx = -0.9 - tap * 0.15; p.rUAz = 0.15; p.rEL = -0.9 + tap * 0.25;
      p.lUAx = -0.5; p.lUAz = 0.2; p.lEL = -1.4;
    } else { p.lUAx = -0.35; p.rUAx = -0.35; p.lEL = -1.0; p.rEL = -1.0; p.lUAz = 0.1; p.rUAz = -0.1; }
  } else if (kind === 'lean') { p.spine = 0.08; p.lUAx = -0.6; p.lEL = -1.3; p.rUAx = -0.2; p.rEL = -1.1; p.lTH = -0.1; p.rKN = 0.2; p.rTH = 0.15; }
  else if (kind === 'pool') { p.spine = 0.65; p.chest = 0.25; p.headX = -0.6; p.rUAx = 0.3 + Math.sin(t * 2) * 0.25; p.rEL = -1.4; p.lUAx = -1.2; p.lEL = -0.2; p.lTH = -0.3; p.lKN = 0.3; p.rTH = 0.25; }
  else if (kind === 'darts') { const th = a.dartT != null ? (a.dartT > 0 ? Math.sin((1 - a.dartT / 0.5) * Math.PI) : 0) : (t % 4) < 0.5 ? Math.sin(((t % 4) / 0.5) * Math.PI) : 0; p.rUAx = -1.6 + th * 0.4; p.rEL = -1.8 + th * 1.6; p.lUAx = 0; p.headX = -0.05; p.rTH = 0.15; }
  else if (kind === 'cheer') { p.lUAx = -2.8; p.rUAx = -2.8; p.lUAz = 0.3; p.rUAz = -0.3; p.lEL = -0.3 + Math.sin(t * 12) * 0.3; p.rEL = -0.3 + Math.sin(t * 12 + 1) * 0.3; p.headX = -0.3; }
  else if (kind === 'wipe') { p.spine = 0.2; p.rUAx = -0.9; p.rEL = -0.6 + Math.sin(t * 5) * 0.4; p.rUAz = -0.2 + Math.sin(t * 5) * 0.25; p.headX = 0.3; }
  else if (kind === 'stand') {
    // weight shift from foot to foot
    const w = Math.sin(t * 0.32 + a.seed * 3);
    p.lUAz = 0.1 + Math.sin(t * 0.7) * 0.02; p.hipsZ = w * 0.05; p.spineZ = -w * 0.04; p.lKN = Math.max(0, w) * 0.18; p.rKN = Math.max(0, -w) * 0.18; p.lTH = -Math.max(0, w) * 0.08; p.rTH = -Math.max(0, -w) * 0.08;
    if (a.crossed && !a.holdDrink && !a.smoking && !a.phone) { p.lUAx = -0.55; p.lUAz = 0.38; p.lEL = -1.95; p.rUAx = -0.6; p.rUAz = -0.38; p.rEL = -1.9; }
  }
  // overlays
  if (a.phone && kind !== 'walk' && kind !== 'pokie' && !a.smoking) { p.lUAx = -0.42; p.lUAz = 0.15; p.lEL = -1.8; p.headX = 0.42; p.headY = 0.12; }
  if (a.talk > 0 && !a.phone) { p.lUAx = -0.6 + Math.sin(t * 4) * 0.25; p.lEL = -1.2 + Math.sin(t * 5.3) * 0.3; p.lUAz = 0.3; }
  if (a.listen) { p.headX += Math.max(0, Math.sin(t * 2.6)) * 0.08; }
  if (a.laughT > 0) { const k = Math.min(1, a.laughT); p.spine -= 0.12 * k; p.headX = -0.35 * k; p.chest += Math.sin(t * 22) * 0.05 * k; p.hipsY += Math.abs(Math.sin(t * 22)) * 0.006 * k; }
  if (a.holdDrink && kind !== 'pokie' && kind !== 'pool' && kind !== 'darts' && kind !== 'wipe' && kind !== 'cheer') { p.rUAx = -0.25; p.rEL = -1.35; p.rUAz = -0.08; }
  if (a.sipT > 0) { const k = Math.sin(clamp(a.sipT / 1.6, 0, 1) * Math.PI); p.rUAx = lerp(p.rUAx, -1.1, k); p.rEL = lerp(p.rEL, -2.2, k); p.rUAz = lerp(p.rUAz, 0.35, k); p.headX = lerp(p.headX, -0.35, k); }
  if (a.smoking) { const k = a.dragT > 0 ? Math.sin(clamp(a.dragT / 2, 0, 1) * Math.PI) : 0; p.lUAx = lerp(-0.2, -0.9, k); p.lEL = lerp(-1.5, -2.35, k); p.lUAz = lerp(0.15, -0.3, k); }
  return p;
}
const JOINT_MAP = [['hips', 'x', 'hipsX'], ['hips', 'z', 'hipsZ'], ['spine', 'z', 'spineZ'], ['spine', 'x', 'spine'], ['chest', 'x', 'chest'], ['head', 'x', 'headX'], ['head', 'y', 'headY'], ['lUA', 'x', 'lUAx'], ['lUA', 'z', 'lUAz'], ['lEL', 'x', 'lEL'], ['rUA', 'x', 'rUAx'], ['rUA', 'z', 'rUAz'], ['rEL', 'x', 'rEL'], ['lTH', 'x', 'lTH'], ['lKN', 'x', 'lKN'], ['rTH', 'x', 'rTH'], ['rKN', 'x', 'rKN'], ['lFT', 'x', 'lFT'], ['rFT', 'x', 'rFT']];
function applyPose(h, p, dt, speed = 10, skip = {}) {
  const J = h.J;
  J.hips.position.y = damp(J.hips.position.y, p.hipsY, speed, dt);
  for (const [j, ax, k] of JOINT_MAP) { if (skip[j]) continue; J[j].rotation[ax] = damp(J[j].rotation[ax], p[k], speed, dt); }
  // keep shoulders rotating around x before z, so arm swing reads naturally
}
// analytic two-bone IK for an arm, target in world space
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikM = new THREE.Matrix4();
function armIK(h, side, target, pole = V3(0, -0.6, -1)) {
  const J = h.J, ua = J[side + 'UA'], el = J[side + 'EL'];
  const s = h.scale, L1 = 0.29 * s, L2 = 0.29 * s;
  J.chest.updateWorldMatrix(true, false);
  const tl = J.chest.worldToLocal(_ikA.copy(target)).sub(ua.position);
  // work in chest-local units (chest inherits body scale)
  const ws = new THREE.Vector3(); J.chest.getWorldScale(ws); const l1 = 0.29, l2 = 0.29;
  const d = clamp(tl.length(), 0.05, l1 + l2 - 0.001);
  const dir = tl.clone().normalize();
  const a1 = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const pl = pole.clone().applyAxisAngle(V3(0, 1, 0), 0); pl.x *= side === 'l' ? 1 : -1;
  const n = new THREE.Vector3().crossVectors(dir, pl).normalize();
  if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
  const u = dir.clone().applyAxisAngle(n, -a1); // upper arm direction (bent toward pole)
  const yAx = u.clone().negate(), xAx = n.clone(), zAx = new THREE.Vector3().crossVectors(xAx, yAx).normalize(); xAx.crossVectors(yAx, zAx).normalize();
  _ikM.makeBasis(xAx, yAx, zAx); ua.quaternion.setFromRotationMatrix(_ikM);
  const elbow = u.clone().multiplyScalar(l1); const f = tl.clone().sub(elbow).normalize();
  const fl = f.applyQuaternion(ua.quaternion.clone().invert());
  el.rotation.set(Math.atan2(-fl.z, -fl.y), 0, 0);
}

// =====================================================================
//  NPC NAVIGATION GRAPH
// =====================================================================
const NODES = {
  S2: V3(-6, 0, 8), S0: V3(0, 0, 6), S1: V3(0, 0, 3.4), D0: V3(0, 0, 0.6), D1: V3(2.6, 0, -0.6), P1: V3(-2, 0, -2.2), P2: V3(-6.9, 0, -2.4), P3: V3(-6.9, 0, -8), P4: V3(-6.9, 0, -13.2),
  P5: V3(-3.4, 0, -8.2), P6: V3(-0.6, 0, -11), P7: V3(1.6, 0, -10), P8: V3(-6.5, 0, -16.3), G1: V3(4.3, 0, -10), G2: V3(4.0, 0, -15.2), G3: V3(9.6, 0, -15.2), G4: V3(9.6, 0, -9.2),
  G5: V3(7.5, 0, -5.6), L1: V3(7.5, 0, -2.9), L2: V3(4.4, 0, -0.5), L3: V3(11.0, 0, -0.5), G6: V3(11.6, 0, -13), T1: V3(14.5, 0, -13), T2: V3(16.4, 0, -10.6), T3: V3(16.2, 0, -15.6),
  FB: V3(-10.4, 0, -8)
};
const EDGES = [['S2', 'S0'], ['S0', 'S1'], ['S1', 'D0'], ['D0', 'P1'], ['D0', 'D1'], ['D1', 'L2'], ['L2', 'L1'], ['L2', 'L3'], ['L3', 'L1'], ['L1', 'G5'], ['P1', 'P2'], ['P2', 'P3'], ['P3', 'P4'], ['P4', 'P8'], ['P1', 'P5'], ['P5', 'P3'], ['P5', 'P6'], ['P6', 'P4'], ['P6', 'P7'], ['P5', 'P7'], ['P7', 'G1'], ['G1', 'G2'], ['G1', 'G4'], ['G2', 'G3'], ['G3', 'G4'], ['G3', 'G6'], ['G4', 'G6'], ['G4', 'G5'], ['G6', 'T1'], ['T1', 'T2'], ['T1', 'T3'], ['T2', 'T3'], ['P6', 'P8']];
const ADJ = {}; for (const k in NODES) ADJ[k] = []; for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
function nearestNode(p, filter) {
  let best = null, bd = 1e9;
  for (const k in NODES) { if (k === 'FB') continue; if (filter && !filter(k)) continue; const n = NODES[k]; const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}
function nodeRegion(k) { return k[0] === 'S' ? 'out' : k[0] === 'T' ? 'ter' : k[0] === 'G' ? 'gam' : k[0] === 'L' ? 'lou' : k[0] === 'Y' ? 'gar' : 'bar'; }
function regionOf(p) { if (onTerrace(p.x, p.z)) return 'ter'; if (inGarden(p.x, p.z)) return 'gar'; if (!isInside(p.x, p.z)) return 'out'; if (inGaming(p.x, p.z)) return 'gam'; if (p.x > 3 && p.z > -4) return 'lou'; return 'bar'; }
function findPath(from, to) {
  const rf = regionOf(from), rt = regionOf(to);
  const a = nearestNode(from, k => nodeRegion(k) === rf || (rf === 'lou' && k === 'D1')) || nearestNode(from);
  const b = nearestNode(to, k => nodeRegion(k) === rt || (rt === 'lou' && k === 'D1')) || nearestNode(to);
  const prev = { [a]: null }, q = [a];
  while (q.length) { const c = q.shift(); if (c === b) break; for (const n of ADJ[c]) if (!(n in prev)) { prev[n] = c; q.push(n); } }
  const path = []; let c = b; while (c) { path.unshift(NODES[c].clone()); c = prev[c]; }
  return path;
}

// =====================================================================
//  NPCs
// =====================================================================
const NPCS = [];
const BARKS = {
  any: ["G'day.", "How ya goin'?", "Flat out like a lizard drinkin'.", "Not bad, not bad. Yourself?", "Strewth, what a week.", "Have a good one, mate.", "Yeah, nah. Nah, yeah.", "Fair dinkum, the prices in here.", "She'll be right."],
  bar: ["These schooners are gettin' smaller, I swear.", "Your shout next, mate.", "Nine-fifty for a schooner? Daylight robbery.", "Tap beer's cold tonight, at least.", "Barry reckons the bitter's off. Barry reckons a lot of things."],
  pokie: ["This thing's eaten fifty already.", "She's due. She's GOTTA be due.", "Don't sit at that one, it's cursed.", "Got the feature and it paid forty cents. Forty cents!", "Told meself twenty bucks. That was a hundred ago.", "Missus thinks I'm at footy training."],
  smoke: ["Got a light, mate?", "Forty-five bucks a pack now. Forty-five!", "Gonna quit after this one. Again.", "Only place left you can have a dart and a punt."],
  lounge: ["Chips are ripper here.", "Parma's the size of a hubcap.", "Kids are at their nan's. Freedom."],
  street: ["Cold one tonight.", "Bloody bus never came.", "Just havin' a quick dart before I go in."],
};
function mkNPC(o = {}) {
  const h = makeHuman(o);
  const n = {
    h, name: o.name || choice(NPC_NAMES), pos: (o.pos || V3()).clone(), ry: o.ry || 0, vel: V3(), state: 'idle', spot: null, path: [], timer: rand(20, 80),
    a: { seed: Math.random() * 10, walkPh: 0, sitH: 0.75, tapT: 0, talk: 0, holdDrink: false, sipT: 0, smoking: false, dragT: 0, drunk: rand(0, 0.6) },
    kind: 'stand', speed: rand(1.0, 1.3), barkT: rand(5, 30), cheerT: 0, prop: null, cig: null, role: o.role || 'patron', smoker: o.smoker ?? Math.random() < 0.3, gambler: o.gambler ?? Math.random() < 0.45, hasPhone: false
  };
  h.root.position.copy(n.pos); h.root.rotation.y = n.ry; scene.add(h.root);
  // drink prop
  n.glass = makeGlass(choice(['schooner', 'schooner', 'pot', 'pint', 'rum']));
  n.glass.fill = rand(0.3, 1);
  h.J.rH.add(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.x = 0;
  n.glass.group.visible = false;
  // cigarette prop in left hand
  const cig = new THREE.Group(); const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6), MAT.white); cb.rotation.z = Math.PI / 2; cig.add(cb);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), MAT.ember); tip.position.x = 0.036; cig.add(tip);
  cig.position.set(0, -0.07, 0.02); cig.visible = false; h.J.lH.add(cig); n.cig = cig; n.cigTip = tip;
  // phone (a glowing screen in the left hand) and face animation state
  const ph = new THREE.Mesh(phoneGeo(), phoneMats()); ph.position.set(0.0, -0.075, 0.025); ph.rotation.x = -1.2; ph.visible = false; h.J.lH.add(ph); n.phone = ph;
  n.blinkT = rand(1, 5); n.idleT = rand(8, 25);
  if (Math.random() < 0.35) n.a.crossed = true;
  NPCS.push(n);
  return n;
}
function freeSpots(filter) { return SPOTS.filter(s => !s.occ && !s.hidden && filter(s)); }
function claim(n, s) { if (n.spot) n.spot.occ = null; n.spot = s; s.occ = n; if (s.machine) s.machine.occupiedBy = n; }
function release(n) { if (n.spot) { if (n.spot.machine && n.spot.machine.occupiedBy === n) { n.spot.machine.occupiedBy = null; n.spot.machine.setMode('idle'); } n.spot.occ = null; } n.spot = null; }
function chooseNextSpot(n) {
  const ev = Game.state.event;
  const w = [];
  const add = (f, weight) => { const list = freeSpots(f); if (list.length) w.push([list, weight]); };
  if (n.gambler) add(s => s.kind === 'pokie' && (!s.smoke || n.smoker), 4);
  add(s => s.area === 'bar' && (s.kind === 'stool' || s.kind === 'stand' || s.kind === 'lean'), 3);
  add(s => s.area === 'lounge', ev === 'parma' ? 4 : 1.5);
  add(s => s.kind === 'pool' || s.anim === 'darts', 0.8);
  if (n.smoker) add(s => s.smoke && s.kind !== 'pokie', 1.6);
  add(s => s.area === 'garden', Game.state.time < 19 ? 2.2 : 1.1);
  if (!w.length) return null;
  const list = wpick(w.map(x => x[0]), w.map(x => x[1]));
  return choice(list);
}
// people walking in from the street go round the parked ute / planter in front of the pub (box x -7.7..-2.7, z 10.4..12.3)
function streetApproach(n) { const w = [V3(-8.6, 0, 13.0), V3(-8.6, 0, 9.4), NODES.S2.clone(), NODES.S0.clone()]; if (n.pos.z < 12.9 || n.pos.x < -9) return w.slice(2); return w; }
function sendTo(n, s) {
  claim(n, s);
  n.path = findPath(n.pos, s.pos); n.path.push(s.pos.clone());
  n.state = 'walk'; n.kind = 'walk';
  n.a.holdDrink = Math.random() < 0.6; n.glass.group.visible = n.a.holdDrink;
}
function spawnPatrons(count) {
  // pre-seat most people; a couple arrive from the street over time
  for (let i = 0; i < count; i++) {
    const n = mkNPC();
    const s = chooseNextSpot(n);
    if (!s) { scene.remove(n.h.root); NPCS.pop(); continue; }
    claim(n, s); n.pos.copy(s.pos); n.ry = s.ry; seatNPC(n);
  }
}
function seatNPC(n) {
  const s = n.spot; n.state = 'idle'; n.pos.copy(s.pos); n.ry = s.ry; n.vel.set(0, 0, 0);
  n.a.sitH = s.sitH || 0.75;
  n.kind = s.kind === 'pokie' ? 'pokie' : (s.kind === 'stool' || s.kind === 'chair') ? 'sit' : s.kind === 'lean' ? 'lean' : s.kind === 'pool' ? 'pool' : s.anim === 'darts' ? 'darts' : 'stand';
  n.timer = s.kind === 'pokie' ? rand(60, 200) : rand(40, 160);
  n.a.smoking = n.smoker && !!s.smoke; n.cig.visible = n.a.smoking;
  n.a.holdDrink = n.kind !== 'pokie' && n.kind !== 'pool' && n.kind !== 'darts' && Math.random() < 0.8; n.glass.group.visible = n.a.holdDrink || n.kind === 'pokie';
  if (n.kind === 'pokie') { s.machine.occupiedBy = n; s.machine.setMode('npc'); s.machine.betIdx = choice([0, 1, 1, 2, 3]); s.machine.credit = choice([20, 50, 50, 100]);
    // glass sits on the ledge
    n.h.root.attach(n.glass.group); n.glass.group.position.copy(s.machine.ledge).sub(n.pos).applyAxisAngle(V3(0, 1, 0), -n.ry); n.glass.group.position.y = s.machine.ledge.y; n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = true;
  } else if (n.glassOnLedge) { n.h.J.rH.attach(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = false; }
}
function updateNPC(n, dt, t, player) {
  const a = n.a;
  a.tapT = Math.max(0, a.tapT - dt); a.sipT = Math.max(0, a.sipT - dt); a.talk = Math.max(0, a.talk - dt); a.dragT = Math.max(0, a.dragT - dt); n.cheerT = Math.max(0, n.cheerT - dt);
  if (n.role === 'bartender') return updateBartender(n, dt, t, player);
  if (n.mg) return updateMGNPC(n, dt, t, player);
  if (n.state === 'walk') {
    if (n.glassOnLedge) { n.h.J.rH.attach(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = false; }
    const tgt = n.path[0];
    if (!tgt) { seatNPC(n); }
    else {
      const dx = tgt.x - n.pos.x, dz = tgt.z - n.pos.z, d = Math.hypot(dx, dz);
      const last = n.path.length === 1;
      if (d < (last ? 0.08 : 0.45)) { n.path.shift(); if (!n.path.length) seatNPC(n); }
      else {
        let vx = dx / d * n.speed, vz = dz / d * n.speed;
        // separation from player + others
        const sep = (ox, oz, r) => { const ex = n.pos.x - ox, ez = n.pos.z - oz, e = Math.hypot(ex, ez); if (e < r && e > 0.01) { vx += ex / e * (r - e) * 3; vz += ez / e * (r - e) * 3; } };
        sep(player.x, player.z, 0.9);
        for (const o of NPCS) if (o !== n && o.state === 'walk') sep(o.pos.x, o.pos.z, 0.6);
        n.vel.x = damp(n.vel.x, vx, 8, dt); n.vel.z = damp(n.vel.z, vz, 8, dt);
        n.pos.x += n.vel.x * dt; n.pos.z += n.vel.z * dt;
        if (!last || d > 0.9) collideCircle(n.pos, 0.22);
        n.ry = n.ry + angleDiff(n.ry, Math.atan2(n.vel.x, n.vel.z)) * Math.min(1, dt * 8);
        a.walkPh += dt * n.speed * 5.4;
      }
    }
    if (n.leaving && !isInside(n.pos.x, n.pos.z) && n.pos.z > 7.5) { n.gone = true; }
  } else {
    // idle at spot
    const s = n.spot;
    if (s) n.ry = n.ry + angleDiff(n.ry, s.ry) * Math.min(1, dt * 5);
    n.timer -= dt;
    if (n.kind === 'pokie' && s && s.machine) {
      const m = s.machine; m.npcTick(dt); if (m.state === 'spinning' && m.st < 0.1) a.tapT = 0.35;
      if (m.state === 'showWin' && m.win > m.bet * 10 && m.st < 0.1) { n.cheerT = 2; bark(n, choice(["Get in!", "YES! About bloody time!", "Come on!"]), true); }
      if (m.credit < m.bet && m.state === 'ready' && Math.random() < dt * 0.1) n.timer = 0;
    }
    // social life: chat with whoever shares your table / neighbouring stool
    const partner = s && s.group ? SPOTS.find(o => o !== s && o.group === s.group && o.occ && o.occ !== n && o.occ.state === 'idle' && o.occ.role !== 'bartender') : null;
    n.partner = partner ? partner.occ : null;
    if (n.partner) {
      const cv = CONVS[s.group] || (CONVS[s.group] = { talker: n, t: rand(2, 5) });
      cv.t -= dt / 2; // two members tick it
      if (cv.t <= 0) { cv.talker = cv.talker === n ? n.partner : n; cv.t = rand(2.5, 6); if (Math.random() < 0.22) { n.a.laughT = 1.3; n.partner.a.laughT = 1.3; if (n.dist2 < 60) SFX.laugh(n.pos.clone().add(V3(0, 1.6, 0))); } }
      a.listen = cv.talker !== n; if (!a.listen) a.talk = Math.max(a.talk, 0.25);
      a.phone = false;
    } else {
      a.listen = false;
      n.idleT -= dt;
      if (n.idleT <= 0) { n.idleT = rand(10, 30); a.phone = n.kind !== 'pokie' && !a.smoking && Math.random() < 0.4; }
    }
    if (a.holdDrink && a.sipT <= 0 && Math.random() < dt * 0.06) { a.sipT = 1.6; n.glass.fill = Math.max(0.1, n.glass.fill - 0.08); }
    if (a.smoking) { if (a.dragT <= 0 && Math.random() < dt * 0.08) a.dragT = 2; n.cigTip.material = MAT.ember; if (Math.random() < dt * 6) { n.cigTip.updateWorldMatrix(true, false); smokeFX.emit(_v1.setFromMatrixPosition(n.cigTip.matrixWorld), V3(rand(-.02, .02), 0.12, rand(-.02, .02)), 0.02, rand(3, 5), 0.22, [0.85, 0.85, 0.88], 0.06); }
      if (a.dragT > 0 && a.dragT < 0.3 && Math.random() < dt * 30) { n.h.J.head.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(n.h.J.head.matrixWorld).add(V3(0, 0.08, 0)); const fw = V3(Math.sin(n.ry), 0.15, Math.cos(n.ry)); smokeFX.emit(hp.addScaledVector(fw, 0.12), fw.multiplyScalar(0.5), 0.05, 3, 0.18, [0.9, 0.9, 0.92], 0.18); } }
    if (n.timer <= 0) {
      const ns = Math.random() < 0.1 ? SPOTS.find(s => s.kind === 'toilet') : chooseNextSpot(n);
      if (ns && ns !== n.spot && !ns.occ) { release(n); sendTo(n, ns); }
      else n.timer = rand(20, 60);
      if (ns && ns.kind === 'toilet') ns.occ = null;
    }
  }
  // barks when player nearby
  const pd = Math.hypot(player.x - n.pos.x, player.z - n.pos.z);
  n.barkT -= dt;
  if (pd < 3.2 && n.barkT <= 0 && n.state === 'idle') { n.barkT = rand(25, 60); const ar = n.spot ? (n.spot.kind === 'pokie' ? 'pokie' : n.a.smoking ? 'smoke' : n.spot.area) : 'any'; bark(n, choice((BARKS[ar] || []).concat(BARKS.any, Game.dayBarks()))); }
  // look at player when close
  const lookAt = pd < 2.6 && n.state === 'idle';
  const kind = n.cheerT > 0 ? 'cheer' : n.kind;
  const p = poseFor(kind, t + a.seed, a);
  if (lookAt) { const ang = angleDiff(n.ry, Math.atan2(player.x - n.pos.x, player.z - n.pos.z)); p.headY = clamp(ang, -1.1, 1.1); p.headX = -0.05; }
  else if (n.partner && n.state === 'idle') { const ang = angleDiff(n.ry, Math.atan2(n.partner.pos.x - n.pos.x, n.partner.pos.z - n.pos.z)); p.headY = clamp(ang, -1.1, 1.1); }
  if (n.glassOnLedge) { p.rUAx = kind === 'pokie' ? p.rUAx : p.rUAx; }
  applyPose(n.h, p, dt, n.state === 'walk' ? 14 : 6);
  faceAnim(n, dt, t);
  n.phone.visible = !!a.phone && n.state === 'idle' && n.dist2 < 600;
  n.h.root.position.set(n.pos.x, groundY(n.pos.x, n.pos.z), n.pos.z); n.h.root.rotation.y = n.ry;
  if (!n.glassOnLedge && n.glass.group.visible && n.dist2 < 400) uprightInHand(n.glass.group, n.ry, a.sipT > 0 ? Math.sin(clamp(a.sipT / 1.6, 0, 1) * Math.PI) * 1.3 : 0);
  if (n.glass.group.visible && n.dist2 < 400) n.glass.update(dt, t);
}
const CONVS = {};
// soft contact shadows under every person (one instanced draw call)
let peopleShadows = null;
function updatePeopleShadows() {
  if (!peopleShadows) { peopleShadows = new THREE.InstancedMesh(G.plane, MAT.blob, 64); peopleShadows.frustumCulled = false; peopleShadows.renderOrder = 1; scene.add(peopleShadows); }
  let i = 0;
  for (const n of NPCS) { if (i >= 64) break; const s = n.state === 'walk' ? 0.75 : (n.kind === 'sit' || n.kind === 'pokie') ? 0.95 : 0.8; _m1.compose(_v1.set(n.pos.x, groundY(n.pos.x, n.pos.z) + 0.006, n.pos.z), _q1.setFromEuler(_e1.set(-Math.PI / 2, 0, 0)), _v2.set(s, s, 1)); peopleShadows.setMatrixAt(i++, _m1); }
  peopleShadows.count = i; peopleShadows.instanceMatrix.needsUpdate = true;
}
let _phoneGeo, _phoneMats;
function phoneGeo() { return _phoneGeo || (_phoneGeo = new THREE.BoxGeometry(0.07, 0.14, 0.009)); }
function phoneMats() { if (_phoneMats) return _phoneMats; const body = M({ color: 0x111114, roughness: 0.3, metalness: 0.4 }); const scr = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.7, 0.95) }); return (_phoneMats = [body, body, body, body, scr, body]); }
// blinking eyelids and a jaw that moves while talking / laughing
function faceAnim(n, dt, t) {
  const J = n.h.J, a = n.a;
  if (!J.lids) return;
  n.blinkT -= dt;
  if (n.blinkT < 0) { n.blinkT = rand(2.2, 6); n.blinkLeft = 0.14; }
  if (n.blinkLeft > 0) n.blinkLeft -= dt;
  J.lids.scale.y = n.blinkLeft > 0 ? 1 : 0.05;
  const open = a.laughT > 0 ? 1.5 + Math.abs(Math.sin(t * 20)) * 0.4 : a.talk > 0 ? 0.35 + Math.abs(Math.sin(t * 13 + a.seed)) * 0.95 * (Math.sin(t * 2.3 + a.seed) > -0.6 ? 1 : 0.2) : 0.35;
  J.jaw.scale.y = damp(J.jaw.scale.y, open, 20, dt);
  if (a.laughT > 0) a.laughT -= dt;
}
const _uq = new THREE.Quaternion(), _uq2 = new THREE.Quaternion();
function uprightInHand(g, yaw, tiltToFace) {
  g.parent.updateWorldMatrix(true, false);
  g.parent.getWorldQuaternion(_uq).invert();
  _uq2.setFromEuler(_e1.set(-tiltToFace, yaw, 0, 'YXZ'));
  g.quaternion.copy(_uq).multiply(_uq2);
}
function bark(n, line, loud = false) {
  if (!line) return;
  n.a.talk = 2.2;
  const pd = Game.player ? Math.hypot(Game.player.pos.x - n.pos.x, Game.player.pos.z - n.pos.z) : 0;
  if (pd < (loud ? 8 : 4.5)) Game.subtitle(`<b>${n.name}:</b> ${line}`, 3.5);
  // murmur blip
  SFX.noise(0.5, { freq: rand(400, 900), q: 4, gain: 0.05, attack: 0.05, pos: n.pos.clone().add(V3(0, 1.6, 0)) });
}

// ---------------- bartender: serves & pours ----------------
let bartender = null, beerStream = null;
function makeBartender() {
  bartender = mkNPC({ name: choice(VENUE.bartenders), shirt: { tile: 'collar', c: 0x161616 }, pants: { tile: 'cloth', c: 0x161616 }, role: 'bartender', smoker: false, gambler: false, pos: BAR.tender.home, ry: BAR.tender.ry });
  bartender.glass.group.visible = false;
  // apron
  const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5), cm(0x1f4d34, 0.9)); ap.position.set(0, -0.05, 0.135); bartender.h.J.spine.add(ap);
  bartender.queue = []; bartender.job = null; bartender.kind = 'wipe';
  beerStream = makeStream();
  return bartender;
}
// order: {type, food, forZ, cb}
function bartenderOrder(o) { bartender.queue.push(o); }
// which tap pours which beer (each T-bar tower has the same four handles)
const TAP_FOR = { pot: 0, schooner: 1, pale: 2, pint: 3 };
const SPIRIT_Z = { scotch: -9.6, bourbon: -8.4, rum: -7.0, vodka: -5.6 }; // where each bottle lives on the back-bar shelves
const SPIRIT_COL = { scotch: 0x8a5a14, bourbon: 0x7a3010, rum: 0x2a1206, vodka: 0xd8e4e8 };
const MIXER_COL = { coke: [0.18, 0.06, 0.02], soda: [0.85, 0.92, 0.95], lemonade: [0.95, 0.95, 0.85], water: [0.8, 0.88, 0.95] };
const BAR_WORK = { iceZ: -10.35, pourZ: -9.85, gunZ: -10.85 };
let iceScoop = null, sodaGun = null;
function buildBarService() {
  const F = BAR.front;
  // ice well set into the back of the counter, full of ice, with the scoop in it
  addBoxS(SB, MAT.chrome, F - 0.5, 1.07, BAR_WORK.iceZ, 0.3, 0.1, 0.42);
  for (let i = 0; i < 26; i++) SB.add(iceGeo(), iceMat(), F - 0.5 + rand(-0.12, 0.12), 1.115 + rand(0, 0.012), BAR_WORK.iceZ + rand(-0.18, 0.18), rand(0, 3), rand(0, 1), rand(0, 1));
  iceScoop = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 1, roughness: 0.15, side: THREE.DoubleSide })); cup.rotation.z = Math.PI / 2; iceScoop.add(cup);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), MAT.chrome); handle.rotation.z = Math.PI / 2; handle.position.x = -0.08; iceScoop.add(handle);
  iceScoop.userData.home = V3(F - 0.45, 1.13, BAR_WORK.iceZ + 0.1); iceScoop.position.copy(iceScoop.userData.home); iceScoop.rotation.set(0.4, 0, 0); scene.add(iceScoop);
  // soda gun in its holster by the drip tray
  sodaGun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), MAT.chrome); sodaGun.add(body);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.04, 8), MAT.blackPlastic); nozzle.position.y = -0.075; sodaGun.add(nozzle);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.012), M({ color: [0xc8201a, 0x2a8a3a, 0xf0d040, 0x3a6ad8, 0xffffff][i], roughness: 0.4 })); b.position.set(0.022, 0.04 - i * 0.016, 0); sodaGun.add(b); }
  sodaGun.userData.home = V3(F - 0.62, 1.22, BAR_WORK.gunZ); sodaGun.position.copy(sodaGun.userData.home); scene.add(sodaGun);
  addBoxS(SB, MAT.chrome, F - 0.64, 1.17, BAR_WORK.gunZ, 0.05, 0.1, 0.06);
  // the kitchen pass: a stainless hot bench with heat lamps and the order-up bell, at the lounge end of the back bar
  addBoxS(SB, MAT.chrome, -11.3, 0.9, -2.72, 1.0, 0.05, 0.42); addBoxS(SB, MAT.chrome, -11.3, 0.45, -2.72, 0.96, 0.9, 0.4);
  for (const dx of [-0.3, 0.3]) { addCylS(SB, MAT.blackPlastic, -11.3 + dx, 1.62, -2.72, 0.07, 0.12, 12); SB.add(G.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.25) }), -11.3 + dx, 1.54, -2.72, 0, 0, 0, 0.055, 0.025, 0.055); addCylS(SB, MAT.chrome, -11.3 + dx, 1.9, -2.72, 0.012, 0.6, 6); }
  addCylS(SB, MAT.brass, -10.95, 0.95, -2.72, 0.04, 0.035, 14); addBoxS(SB, MAT.brass, -10.95, 0.99, -2.72, 0.012, 0.012, 0.012);
  signPlane(signTex(['ORDER UP'], { w: 256, h: 64, bg: '#7a1f14', color: '#f3e2b8', size: 38 }), 0.5, 0.12, -11.3, 1.32, -2.52, Math.PI);
  // a black rubber hose snaking down under the bar
  SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(F - 0.64, 1.12, BAR_WORK.gunZ), V3(F - 0.7, 0.9, BAR_WORK.gunZ - 0.05), V3(F - 0.68, 0.5, BAR_WORK.gunZ - 0.1)]), 10, 0.008, 5), MAT.rubber);
}
function makeBottle(kind) {
  const g = new THREE.Group(), col = SPIRIT_COL[kind] || 0x6a3a10;
  const glass = M({ color: col, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.2, 14), glass); body.position.y = 0.1; g.add(body);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.038, 0.05, 14), glass); sh.position.y = 0.225; g.add(sh);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.06, 10), glass); neck.position.y = 0.28; g.add(neck);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.045, 8), MAT.chrome); spout.position.set(0, 0.33, 0); spout.rotation.z = 0.35; g.add(spout);
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.08, 14, 1, true, -0.9, 1.8), M({ color: kind === 'vodka' ? 0x1a3a8a : kind === 'rum' ? 0xe8c070 : 0xf2e6c8, roughness: 0.8 })); lbl.position.y = 0.1; g.add(lbl);
  g.userData.tip = V3(0.012, 0.35, 0);
  return g;
}
function updateBartender(n, dt, t, player) {
  const a = n.a; let p;
  const F = BAR.front;
  const goTo = (x, z, spd = 1.5) => { const dx = x - n.pos.x, dz = z - n.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) return true; const s = Math.min(d, spd * dt); n.pos.x += dx / d * s; n.pos.z += dz / d * s; n.ry += angleDiff(n.ry, Math.atan2(dx, dz)) * Math.min(1, dt * 10); a.walkPh += dt * 7; return false; };
  const face = (ry, k = 8) => { n.ry += angleDiff(n.ry, ry) * Math.min(1, dt * k); };
  if (!n.job && n.queue.length) {
    const j = n.job = n.queue.shift(); j.t = 0;
    const D = j.type ? DRINKS[j.type] : null;
    if (D && D.beer) { // right beer, right tap, nearest tower
      const base = Math.abs(-11.5 - j.forZ) < Math.abs(-6.5 - j.forZ) ? 0 : 4;
      j.tap = BAR.taps[base + (TAP_FOR[j.type] ?? 1)]; j.phase = 'toTap';
    } else if (D) j.phase = D.ice ? 'toIce' : 'toShelf';
    else j.phase = j.food ? 'toPass' : 'toCustomer';
  }
  const j = n.job;
  let ik = null, ikL = null, walking = false, pole = V3(0.6, -0.8, -0.6);
  const glassAt = V3(F - 0.5, 1.115, BAR_WORK.pourZ);
  const newGlass = () => { if (!j.glass) { j.glass = makeGlass(j.type); j.glass.fill = 0; j.glass.foam = 0; scene.add(j.glass.group); j.glass.group.position.copy(glassAt); } };
  const stream = (from, toY, col) => { beerStream.visible = true; beerStream.material.uniforms.uTime.value = t; beerStream.material.uniforms.uCol.value.setRGB(...col); const len = Math.max(0.01, from.y - toY); beerStream.position.set(from.x, from.y - len / 2, from.z); beerStream.scale.set(1, len, 1); };
  if (!j) {
    walking = !goTo(BAR.tender.home.x, BAR.shift ? -12.6 : clamp(player.z, BAR.z0 + 1, BAR.z1 - 1) * 0.3 + BAR.tender.home.z * 0.7, 0.8);
    if (!walking) face(Math.PI / 2, 4);
    p = poseFor(walking ? 'walk' : (Math.sin(t * 0.13) > 0.2 ? 'wipe' : 'stand'), t, a);
  } else {
    j.t += dt;
    const D = j.type ? DRINKS[j.type] : null;
    // ---------------- beer from the tap
    if (j.phase === 'toTap') { if (goTo(-9.42, j.tap.z)) { face(Math.PI / 2); if (j.t > 0.5) { j.phase = 'grab'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'grab') { newGlass(); if (j.t > 0.45) { j.phase = 'pour'; j.t = 0; SFX.pourStart(); } }
    else if (j.phase === 'pour') {
      const dur = 4.2, k = clamp(j.t / dur, 0, 1);
      j.glass.fill = k;
      const tilt = lerp(0.75, 0.0, smooth(clamp((k - 0.15) / 0.6, 0, 1)));
      j.glass.foam = D.foam * smooth(clamp((k - 0.55) / 0.45, 0, 1)) * 1.4;
      const spout = j.tap.spout;
      ik = V3(spout.x - 0.01, spout.y - 0.16 + 0.03 * (1 - k), spout.z); j.tilt = tilt;
      ikL = V3(F - 0.43, 1.62, spout.z + 0.02);
      j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0.7, 10, dt);
      j.glass.group.updateWorldMatrix(true, false);
      stream(V3(spout.x, spout.y - 0.005, spout.z), _v1.setFromMatrixPosition(j.glass.group.matrixWorld).y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * k, D.col);
      SFX.pourUpdate(k);
      if (Math.random() < dt * 30) dropFX.emit(V3(spout.x, ik.y, spout.z), V3(rand(-.1, .1), rand(0.2, 0.5), rand(-.1, .1)), 0.004, 0.3, 0.5, [1, 0.95, 0.85]);
      if (k >= 1) { j.phase = 'settle'; j.t = 0; SFX.pourStop(); beerStream.visible = false; }
    } else if (j.phase === 'settle') { j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0, 10, dt); if (j.t > 0.5) { j.phase = 'toCustomer'; j.t = 0; } }
    // ---------------- spirits & mixers: ice → bottle → pour → mixer → bottle back → serve
    else if (j.phase === 'toIce') { if (goTo(-9.42, BAR_WORK.iceZ)) { face(Math.PI / 2); newGlass(); if (j.t > 0.3) { j.phase = 'scoop'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'scoop') {
      const k = j.t;
      const well = V3(F - 0.5, 1.12, BAR_WORK.iceZ), above = glassAt.clone().add(V3(0, 0.22, 0));
      ik = k < 0.5 ? well.clone().add(V3(0, 0.08 - k * 0.1, 0)) : above.clone().lerp(well.clone().add(V3(0, 0.1, 0)), Math.max(0, 1 - (k - 0.5) * 2.5));
      iceScoop.position.copy(ik).add(V3(0.02, -0.04, 0)); iceScoop.rotation.set(0.4, 0, k > 0.9 ? -1.2 : 0);
      if (k > 0.5 && !j.scooped) { j.scooped = true; SFX.noise(0.25, { freq: 2600, q: 1.2, gain: 0.08, pos: well }); }
      if (k > 1.05 && !j.iced) { j.iced = true; j.glass.addIce(D.ice || 3); for (let i = 0; i < 3; i++) SFX.tone(rand(2800, 4200), 0.12, { delay: i * 0.06, gain: 0.04, pos: glassAt }); }
      if (k > 1.5) { iceScoop.position.copy(iceScoop.userData.home); iceScoop.rotation.set(0.4, 0, 0); j.phase = D.spirit ? 'toShelf' : 'mixer'; j.t = 0; }
    } else if (j.phase === 'toShelf') {
      const z = SPIRIT_Z[D.spirit] ?? -8;
      if (goTo(-12.05, z)) { face(-Math.PI / 2); ik = V3(-12.62, 1.78, z); if (j.t > 0.6 && !j.bottle) { j.bottle = makeBottle(D.spirit); scene.add(j.bottle); SFX.tone(1800, 0.05, { gain: 0.04, pos: ik }); } if (j.t > 0.9) { j.phase = 'toPour'; j.t = 0; } } else walking = true;
    } else if (j.phase === 'toPour') { if (goTo(-9.42, BAR_WORK.pourZ + 0.08)) { face(Math.PI / 2); if (j.t > 0.3) { j.phase = 'pourSpirit'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'pourSpirit') {
      const dur = 1.8, k = clamp(j.t / dur, 0, 1), tilt = smooth(clamp(j.t / 0.35, 0, 1)) * (1 - smooth(clamp((j.t - dur) / 0.3, 0, 1)));
      ik = glassAt.clone().add(V3(-0.06, 0.25, 0.05)); j.bottleTilt = tilt * 2.1;
      ikL = glassAt.clone().add(V3(0.02, 0.07, -0.03)); // steadying the glass
      if (tilt > 0.8 && k < 1) { j.glass.fill = Math.max(j.glass.fill, (D.pourTo || 0.3) * clamp((j.t - 0.3) / (dur - 0.3), 0, 1)); j.pouring = true; SFX.pourUpdate(0.3); if (!j.glug) { j.glug = true; SFX.pourStart(); } } else j.pouring = false;
      if (j.t > dur + 0.35) { SFX.pourStop(); beerStream.visible = false; j.phase = D.mixer ? 'mixer' : 'putBack'; j.t = 0; }
    } else if (j.phase === 'mixer') {
      if (!goTo(-9.42, BAR_WORK.pourZ + 0.08)) { walking = true; }
      else {
        face(Math.PI / 2);
        const dur = 2.0, k = clamp(j.t / dur, 0, 1), aboveGlass = glassAt.clone().add(V3(0, 0.24, 0));
        ikL = aboveGlass.clone().add(V3(0, 0.07, 0)); sodaGun.position.copy(ikL).add(V3(0, -0.02, 0)); sodaGun.rotation.set(0, 0, 0);
        if (j.t > 0.3 && k < 1) { if (!j.gun) { j.gun = true; SFX.pourStart(); } const from = (D.pourTo || 0); j.glass.fill = from + (0.95 - from) * clamp((j.t - 0.3) / (dur - 0.3), 0, 1); stream(aboveGlass, glassAt.y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * j.glass.fill, MIXER_COL[D.mixer] || [0.8, 0.8, 0.8]); SFX.pourUpdate(0.6); }
        if (k >= 1) { SFX.pourStop(); beerStream.visible = false; sodaGun.position.copy(sodaGun.userData.home); j.phase = j.bottle ? 'putBack' : 'toCustomer'; j.t = 0; }
      }
    } else if (j.phase === 'putBack') {
      const z = SPIRIT_Z[D.spirit] ?? -8;
      if (goTo(-12.05, z)) { face(-Math.PI / 2); ik = V3(-12.62, 1.78, z); if (j.t > 0.5 && j.bottle) { scene.remove(j.bottle); j.bottle = null; SFX.tone(1500, 0.05, { gain: 0.04, pos: ik }); } if (j.t > 0.8) { j.phase = 'fetchGlass'; j.t = 0; } } else walking = true;
    } else if (j.phase === 'fetchGlass') { if (goTo(-9.42, BAR_WORK.pourZ)) { face(Math.PI / 2); ik = glassAt.clone().add(V3(0, 0.07, 0)); if (j.t > 0.4) { j.phase = 'toCustomer'; j.t = 0; j.carry = true; } } else walking = true; }
    // ---------------- food: out to the kitchen pass, ding the bell, collect the plate, carry it back
    else if (j.phase === 'toPass') {
      const PX = -11.3, PZ = -3.05;
      if (goTo(PX, PZ)) { face(Math.PI); ik = V3(PX + 0.1, 1.2, PZ - 0.45); if (j.t > 0.25 && !j.dinged) { j.dinged = true; SFX.bell(V3(PX, 1.3, PZ - 0.5), 1); SFX.noise(0.7, { freq: 3500, q: 1.5, gain: 0.05, pos: V3(PX, 1.2, PZ - 0.5) }); } if (j.t > 1.15) { j.plate = makeFood(legacyFood(j.food, Game.state.event)); scene.add(j.plate); j.hot = FOODS[j.plate.userData.kind].hot; j.phase = 'toCustomer'; j.t = 0; } } else walking = true;
    }
    // ---------------- serve
    else if (j.phase === 'toCustomer') {
      j.tap && (j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0, 10, dt));
      if (j.glass && !j.tap) j.carry = true;
      if (j.plate) ik = V3(n.pos.x + Math.sin(n.ry) * 0.36, 1.12, n.pos.z + Math.cos(n.ry) * 0.36);
      if (goTo(-9.35, clamp(j.forZ, BAR.z0 + 0.6, BAR.z1 - 0.6))) { face(Math.PI / 2); j.phase = 'place'; j.t = 0; } else walking = true;
    } else if (j.phase === 'place') {
      const spot = V3(BAR.front - 0.18, 1.115, clamp(j.forZ, BAR.z0 + 0.6, BAR.z1 - 0.6));
      ik = spot.clone().add(V3(0, 0.07, 0));
      if (j.t > 0.6) {
        let item;
        if (j.glass) { j.glass.group.position.copy(spot); j.glass.group.rotation.set(0, 0, 0); item = { kind: 'drink', glass: j.glass }; SFX.glassDown(spot); }
        else { const plate = j.plate || makeFood(legacyFood(j.food, Game.state.event)); plate.position.copy(spot); plate.rotation.set(0, 0, 0); if (!plate.parent) scene.add(plate); plate.userData.placedAt = elapsed + 0.001; item = { kind: 'food', food: j.food, mesh: plate, spot: spot.clone() }; SFX.glassDown(spot); SFX.noise(0.9, { freq: 4200, q: 1.2, gain: FOODS[plate.userData.kind].hot ? 0.035 : 0, pos: spot }); j.plate = null; }
        bark(n, choice(["There ya go, love.", "Enjoy, mate.", "Cheers.", "There you are.", "Get that into ya."]));
        j.cb && j.cb(item, spot);
        n.job = null;
      }
    }
    p = poseFor(walking ? 'walk' : 'stand', t, a);
  }
  if (walking) p = poseFor('walk', t, a);
  applyPose(n.h, p, dt, 10, ik ? (ikL ? { rUA: 1, rEL: 1, lUA: 1, lEL: 1 } : { rUA: 1, rEL: 1 }) : ikL ? { lUA: 1, lEL: 1 } : {});
  n.h.root.position.set(n.pos.x, 0, n.pos.z); n.h.root.rotation.y = n.ry;
  n.h.root.updateMatrixWorld(true);
  if (ik) armIK(n.h, 'r', ik, pole);
  if (ikL) armIK(n.h, 'l', ikL, pole);
  if (j && j.plate) { n.h.J.rH.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld); j.plate.position.set(hp.x, hp.y - 0.025, hp.z); j.plate.rotation.set(0, n.ry, 0); }
  if (j) {
    // the bottle sits in his right hand, tipped up while pouring
    if (j.bottle) {
      n.h.J.rH.updateWorldMatrix(true, false);
      const hp = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld);
      j.bottle.position.copy(hp).add(V3(0, -0.12, 0)); j.bottle.rotation.set(0, 0, -(j.bottleTilt || 0));
      j.bottle.updateMatrixWorld(true);
      if (j.phase === 'pourSpirit' && j.pouring) { const tip = j.bottle.userData.tip.clone().applyMatrix4(j.bottle.matrixWorld); stream(tip, glassAt.y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * j.glass.fill, DRINKS[j.type].col); }
    }
    if (j.glass) {
      const g = j.glass.group;
      if (j.phase === 'pour' && ik) { g.position.copy(ik).add(V3(0, -0.075, 0)); g.rotation.set(0, 0, -(j.tilt || 0)); }
      else if (j.phase === 'place' && ik) { g.position.copy(ik).add(V3(0, -0.07, 0)); g.rotation.set(0, 0, 0); }
      else if (j.carry || j.tap) { n.h.J.rH.updateWorldMatrix(true, false); g.position.setFromMatrixPosition(n.h.J.rH.matrixWorld).add(V3(0, -0.1, 0)); g.rotation.set(0, 0, 0); }
      else { g.position.copy(glassAt); g.rotation.set(0, 0, 0); }
      j.glass.update(dt, t);
    }
  }
}
// food on a plate: a crumbed schnitzel with napoli + melted cheese, chips and salad (parma); a roast; or a bowl of chips
let _foodTex = null;
function foodTextures() {
  if (_foodTex) return _foodTex;
  const crumb = mkCanvas(128, 128), c = crumb.getContext('2d');
  c.fillStyle = '#c8862e'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { c.fillStyle = `hsl(${rand(28, 40)},${rand(55, 75)}%,${rand(30, 58)}%)`; c.fillRect(Math.random() * 128, Math.random() * 128, rand(1, 3), rand(1, 3)); }
  const sauce = mkCanvas(128, 128), x = sauce.getContext('2d');
  x.fillStyle = '#b3240f'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${randi(200, 255)},${randi(190, 220)},${randi(90, 140)},${rand(0.55, 0.95)})`; x.beginPath(); x.ellipse(Math.random() * 128, Math.random() * 128, rand(5, 16), rand(4, 12), rand(0, 3), 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,60,10,.5)'; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, rand(1, 3), 0, 7); x.fill(); }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  _foodTex = { crumb: mk(crumb), sauce: mk(sauce) };
  return _foodTex;
}
function makeFoodOld(kind) {
  const g = new THREE.Group(), T = foodTextures();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.016, 32), MAT.white); plate.position.y = 0.008; g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.006, 6, 32), MAT.white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.017; g.add(rim);
  g.userData.bites = [];
  const chips = (cx, cz, n, spread) => { for (let i = 0; i < n; i++) { const c = new THREE.Mesh(G.box, cm(choice([0xe8b84a, 0xdca33a, 0xf0c860]), 0.6)); c.scale.set(0.011, 0.011, rand(0.05, 0.075)); c.position.set(cx + rand(-spread, spread), 0.024 + (i % 3) * 0.009, cz + rand(-spread, spread)); c.rotation.set(rand(-0.25, 0.25), rand(0, 3.14), rand(-0.2, 0.2)); g.add(c); g.userData.bites.push(c); } };
  if (kind === 'parma' || kind === 'roast') {
    if (kind === 'parma') {
      // a schnitzel: an irregular flat crumbed shape, sauce and cheese on top
      const sh = new THREE.Shape(); const pts = 14;
      for (let i = 0; i <= pts; i++) { const a = i / pts * Math.PI * 2, r = 0.075 + Math.sin(a * 3 + 1) * 0.008 + Math.sin(a * 5) * 0.005; const px = Math.cos(a) * r * 1.35, pz = Math.sin(a) * r * 0.9; i ? sh.lineTo(px, pz) : sh.moveTo(px, pz); }
      const sch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6 }), new THREE.MeshStandardMaterial({ map: T.crumb, roughness: 0.85 }));
      sch.geometry.rotateX(-Math.PI / 2); sch.position.set(-0.035, 0.02, 0.0); g.add(sch);
      const top = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ map: T.sauce, roughness: 0.35 }));
      top.geometry.rotateX(-Math.PI / 2); top.scale.set(0.86, 1, 0.84); top.position.set(-0.035, 0.0375, 0.0); g.add(top);
      g.userData.main = [sch, top];
    } else {
      for (let i = 0; i < 3; i++) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 16), cm(0xc8a088, 0.7)); sl.scale.set(1.3, 1, 0.8); sl.position.set(-0.05 + i * 0.012, 0.022 + i * 0.006, -0.01 + i * 0.02); sl.rotation.z = 0.12; g.add(sl); g.userData.bites.push(sl); }
      for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(G.sph, cm(0xd8a050, 0.6)); p.scale.set(0.022, 0.017, 0.02); p.position.set(0.06 + rand(-0.02, 0.02), 0.03, rand(-0.06, 0.06)); g.add(p); g.userData.bites.push(p); }
      const gravy = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), cm(0x5a2e12, 0.25)); gravy.rotation.x = -Math.PI / 2; gravy.position.set(-0.04, 0.0175, 0); g.add(gravy);
      g.userData.main = [];
    }
    chips(0.085, 0.045, 12, 0.03);
    // salad: a few leaves and a tomato wedge
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.018, 7), new THREE.MeshStandardMaterial({ color: choice([0x5a9a2a, 0x7ab83a, 0x4a8a2a]), roughness: 0.7, side: THREE.DoubleSide })); l.position.set(0.075 + rand(-0.02, 0.02), 0.022 + i * 0.002, -0.06 + rand(-0.015, 0.015)); l.rotation.set(-Math.PI / 2 + rand(-0.4, 0.4), 0, rand(0, 6)); g.add(l); g.userData.bites.push(l); }
    const tom = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6, 0, Math.PI), cm(0xc02a18, 0.4)); tom.position.set(0.1, 0.024, -0.055); tom.rotation.x = -Math.PI / 2; g.add(tom); g.userData.bites.push(tom);
    const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6, 0, Math.PI), cm(0xf2d23a, 0.5)); lemon.position.set(-0.11, 0.024, 0.07); lemon.rotation.set(-Math.PI / 2, 0, 0.6); g.add(lemon);
  } else chips(0, 0, 28, 0.07);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
