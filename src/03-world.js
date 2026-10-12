
// =====================================================================
//  WORLD: layout constants, collision, materials, builders
// =====================================================================
const PUB = { x0: -13, x1: 13, z0: -18, z1: 2, ceil: 4.0 };
// covered rooms beyond the main bar: the toilets, the drive-through bottle shop and the kebab shop over the road
const ROOMS = [
  { id: 'toilets', x0: -13, x1: -9.4, z0: -22.6, z1: -18, ceil: 2.9, surface: 'tile' },
  { id: 'bottleo', x0: 13, x1: 19.6, z0: -7.85, z1: 2, ceil: 3.4, surface: 'concrete' },
  { id: 'kebab', x0: 7.6, x1: 12.4, z0: 24.05, z1: 27.6, ceil: 3.0, surface: 'tile' },
];
const UP = { y: 4.29, x0: -13, x1: 13, z0: -2.0, z1: 9.5 }; // level 1: Room 4 upstairs + the verandah balcony
function roomAt(x, z) { for (const r of ROOMS) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r; return null; }
function isInside(x, z) { return (x > PUB.x0 && x < PUB.x1 && z > PUB.z0 && z < PUB.z1) || !!roomAt(x, z); }
function inGaming(x, z) { return x > 3 && x < 13 && z > -18 && z < -4; }
function onTerrace(x, z) { return x >= 13 && x < 19.6 && z > -18 && z < -8; }
function inGarden(x, z) { return x > -9.4 && x < 19.6 && z > -29 && z <= -18.1 && !roomAt(x, z); }
function smokingAllowed(x, z) { return !isInside(x, z); }
// y (optional) lets particles find the upstairs floor
function groundY(x, z, y) { if (y !== undefined && y > UP.y - 0.2 && x > UP.x0 && x < UP.x1 && z > UP.z0 && z < UP.z1) return UP.y; return (z > 10.05 && z < 17.95) ? -0.15 : 0; }
function surfaceAt(x, z, lv = 0) {
  if (lv === 1) return z > 2 ? 'timber' : 'carpet';
  const r = roomAt(x, z); if (r) return r.surface;
  if (onTerrace(x, z)) return 'deck';
  if (inGarden(x, z)) return 'gravel';
  if (isInside(x, z)) return inGaming(x, z) ? 'carpet' : 'timber';
  if (z > 10.05 && z < 17.95) return 'road';
  return 'concrete';
}

const colliders = [];   // 2D AABBs {x0,x1,z0,z1,lv}; lv 1 = upstairs
let colLevel = 0;      // builders set this while adding upstairs walls
function addCol(cx, cz, w, d) { colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, lv: colLevel }); }
function addColBox(x0, x1, z0, z1) { const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), lv: colLevel }; colliders.push(c); return c; }
function collideCircle(p, r, lv = 0) {
  for (let it = 0; it < 2; it++) for (const c of colliders) {
    if (c.lv !== lv || c.off) continue;
    const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside box: push out along smallest axis
        const l = p.x - c.x0, rr = c.x1 - p.x, b = p.z - c.z0, f = c.z1 - p.z, m = Math.min(l, rr, b, f);
        if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === b) p.z = c.z0 - r; else p.z = c.z1 + r;
      }
    }
  }
}

const interactables = [];
function addInteract(o) { interactables.push(Object.assign({ r: 2.0, enabled: () => true }, o)); return o; }

const SPOTS = [];
function addSpot(o) { const s = Object.assign({ occ: null, sitH: 0, kind: 'stand' }, o); SPOTS.push(s); return s; }

const MAT = {};
const interiorMats = [];
// identical untextured materials are shared, so the static batcher can merge their geometry into one draw call
const _matCache = new Map();
function M(o, interior = true) {
  const key = Object.values(o).some(v => v && v.isTexture) ? null : JSON.stringify(o) + '|' + interior;
  if (key && _matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial(o); if (interior) interiorMats.push(m);
  if (key) _matCache.set(key, m);
  return m;
}
function buildMaterials() {
  MAT.timber = M({ map: TEX.timber.map, roughnessMap: TEX.timber.rough, bumpMap: TEX.timber.map, bumpScale: 1.4, roughness: 0.85, metalness: 0, color: 0xffffff });
  MAT.carpet = M({ map: TEX.carpet, bumpMap: TEX.carpet, bumpScale: 2.2, roughness: 1 });
  MAT.blob = new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3 });
  MAT.ao = new THREE.MeshBasicMaterial({ map: TEX.ao, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  MAT.deck = M({ map: TEX.deck, roughness: 0.85 }, false);
  MAT.concrete = M({ map: TEX.concrete, roughness: 0.92 }, false);
  MAT.asphalt = M({ map: TEX.asphalt, roughness: 0.82, color: 0xbbbbbb }, false);
  MAT.brick = M({ map: TEX.brick, roughness: 0.9 }, false);
  MAT.brickDark = M({ map: TEX.brickDark, roughness: 0.95 }, false);
  MAT.tileGreen = M({ map: TEX.tileGreen, roughness: 0.12, metalness: 0.05 }, false);
  MAT.tileCream = M({ map: TEX.tileCream, roughness: 0.15, metalness: 0.05 }, false);
  MAT.wainscot = M({ map: TEX.wainscot, roughness: 0.45 });
  MAT.paintCream = M({ map: TEX.paintCream, bumpMap: TEX.paintCream, bumpScale: 0.6, roughness: 0.82 });
  MAT.paintGreen = M({ map: TEX.paintGreen, roughness: 0.85 });
  MAT.paintRed = M({ map: TEX.paintRed, roughness: 0.85 });
  MAT.gamingWall = M({ map: TEX.paintDark, color: 0x6a3a4a, roughness: 0.8 });
  MAT.ceiling = M({ color: 0xc8bca0, bumpMap: TEX.pressed, bumpScale: 2.5, roughness: 0.75, metalness: 0.0 });
  MAT.barTop = M({ map: TEX.wainscot, color: 0x9a6a4a, roughness: 0.18, metalness: 0.05 });
  MAT.darkWood = M({ map: TEX.wainscot, color: 0x7a5a48, roughness: 0.4 });
  MAT.brass = M({ color: 0xd4a94e, metalness: 1, roughness: 0.28 });
  MAT.chrome = M({ color: 0xe8e8ee, metalness: 1, roughness: 0.12 });
  MAT.iron = M({ color: 0x1a1d1c, metalness: 0.6, roughness: 0.5 }, false);
  MAT.creamPaint = M({ color: 0xe9dfc6, roughness: 0.6 }, false);
  MAT.greenPaint = M({ color: 0x1f4d34, roughness: 0.55 }, false);
  MAT.redPaint = M({ color: 0x8c2a1f, roughness: 0.55 }, false);
  MAT.blackPlastic = M({ color: 0x111114, roughness: 0.35, metalness: 0.2 });
  MAT.greyPlastic = M({ color: 0x55575c, roughness: 0.45, metalness: 0.2 });
  MAT.vinylRed = M({ color: 0x8e1a1a, roughness: 0.35 });
  MAT.vinylBlack = M({ color: 0x1b1716, roughness: 0.4 });
  MAT.felt = M({ map: TEX.felt, roughness: 1 });
  MAT.corr = M({ color: 0xbfc4c4, map: TEX.corr, metalness: 0.7, roughness: 0.4 }, false);
  MAT.lace = M({ map: TEX.lace, color: 0x1f2a24, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.15, roughness: 0.65 }, false);
  MAT.window = new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  MAT.mirrorFake = M({ color: 0x8a9496, metalness: 1, roughness: 0.05 });
  MAT.leaf = M({ color: 0x2f5a2a, roughness: 0.8, side: THREE.DoubleSide }, false);
  MAT.pot = M({ color: 0x7a4a2a, roughness: 0.9 }, false);
  MAT.rubber = M({ color: 0x151515, roughness: 0.9 });
  MAT.skin = M({ color: 0xd9a383, roughness: 0.6 });
  MAT.white = M({ color: 0xf2f2ee, roughness: 0.5 });
  MAT.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.25) });
  MAT.bulbCool = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.8, 3.2) });
  MAT.sodium = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 0.9) });
  MAT.ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.6, 0.3) });
  MAT.darkWindow = M({ color: 0x0a0c10, roughness: 0.1, metalness: 0.8 }, false);
  MAT.litWindow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.55) });
  MAT.shutter = M({ map: TEX.corr, color: 0x5c6060, metalness: 0.6, roughness: 0.6 }, false);
  // online upgrades (keep procedural if blocked/offline)
  tryOnline(ONLINE + 'hardwood2_diffuse.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 1); t.rotation = Math.PI / 2; MAT.timber.map = t; MAT.timber.color.set(0xd8b090); MAT.timber.needsUpdate = true; });
  tryOnline(ONLINE + 'hardwood2_roughness.jpg', t => { MAT.timber.roughnessMap = t; t.rotation = Math.PI / 2; MAT.timber.roughness = 0.7; MAT.timber.needsUpdate = true; });
  tryOnline(ONLINE + 'brick_diffuse.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; MAT.brick.map = t; MAT.brick.needsUpdate = true; });
  tryOnline(ONLINE + 'brick_bump.jpg', t => { MAT.brick.bumpMap = t; MAT.brick.bumpScale = 3; MAT.brick.needsUpdate = true; });
}

// world-scale UV helpers
function uvBox(geo, w, h, d, s = 1) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  return geo;
}
function uvScale(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

// ---- static batcher: merges static props per material (huge draw-call saver)
class Batcher {
  constructor() { this.map = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m1.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(rx, ry, rz, 'YXZ')), _v2.set(sx, sy, sz));
    return this.addM(geo, mat, _m1);
  }
  addM(geo, mat, m) {
    let g = geo.clone(); g.applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
  }
  flush(parent, cast = false, receive = true) {
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); list.forEach(g => g.dispose());
    }
    this.map.clear();
  }
}
const SB = new Batcher();      // interior static
const SBX = new Batcher();     // exterior static (casts shadows)

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  sph: new THREE.SphereGeometry(1, 16, 12),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 24),
  plane: new THREE.PlaneGeometry(1, 1),
};
function addBoxS(b, mat, x, y, z, w, h, d, ry = 0, uvs = 0) {
  const g = uvs ? uvBox(new THREE.BoxGeometry(w, h, d), w, h, d, uvs) : G.box;
  if (uvs) b.add(g, mat, x, y, z, ry); else b.add(g, mat, x, y, z, ry, 0, 0, w, h, d);
}
function addCylS(b, mat, x, y, z, r, h, seg = 20, ry = 0, rx = 0, rz = 0) { b.add(seg > 10 ? G.cyl : G.cyl8, mat, x, y, z, ry, rx, rz, r, h, r); }

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
function signPlane(tex, w, h, x, y, z, ry = 0, o = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, toneMapped: o.toneMapped ?? true, side: o.side || THREE.FrontSide, depthWrite: !o.transparent });
  if (o.intensity) mat.color.setScalar(o.intensity);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}

// split a multi-material box into per-face pieces so each face can join its material's batch
function addBoxFaces(batch, geo, mats, matrix) {
  for (const g of geo.groups) {
    const sub = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) sub.setAttribute(k, geo.attributes[k]);
    sub.setIndex(Array.from(geo.index.array.slice(g.start, g.start + g.count)));
    batch.addM(sub, mats[g.materialIndex], matrix);
  }
}
// ---- walls with openings --------------------------------------------------
// axis 'x': wall runs along X at fixed z; 'z': wall runs along Z at fixed x.
// mats: {low:[inMat,outMat], high:[inMat,outMat]}, outSign: which side (+1/-1) is "out"
function buildWall(axis, fixed, a0, a1, h, mats, outSign = 1, openings = [], t = 0.22, split = 1.1, collide = true, yBase = 0) {
  const segs = []; let cur = a0;
  openings = openings.slice().sort((p, q) => p.a - q.a);
  for (const o of openings) { if (o.a > cur) segs.push({ a: cur, b: o.a, y0: 0, y1: h }); if (o.bottom > 0) segs.push({ a: o.a, b: o.b, y0: 0, y1: o.bottom, sill: true }); if (o.top < h) segs.push({ a: o.a, b: o.b, y0: o.top, y1: h }); cur = o.b; }
  if (cur < a1) segs.push({ a: cur, b: a1, y0: 0, y1: h });
  for (const s of segs) {
    const pieces = [];
    if (s.y0 < split && s.y1 > split) { pieces.push([s.y0, split, 'low'], [split, s.y1, 'high']); }
    else pieces.push([s.y0, s.y1, s.y1 <= split ? 'low' : 'high']);
    for (const [y0, y1, k] of pieces) {
      const len = s.b - s.a, hh = y1 - y0, mid = (s.a + s.b) / 2;
      const [mi, mo] = mats[k];
      let geo, arr, pos;
      if (axis === 'x') {
        geo = uvBox(new THREE.BoxGeometry(len, hh, t), len, hh, t, 1.2);
        arr = [mi, mi, mi, mi, outSign > 0 ? mo : mi, outSign > 0 ? mi : mo]; pos = V3(mid, yBase + y0 + hh / 2, fixed);
      } else {
        geo = uvBox(new THREE.BoxGeometry(t, hh, len), t, hh, len, 1.2);
        arr = [outSign > 0 ? mo : mi, outSign > 0 ? mi : mo, mi, mi, mi, mi]; pos = V3(fixed, yBase + y0 + hh / 2, mid);
      }
      addBoxFaces(SBX, geo, arr, new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z));
    }
    if (collide && s.y0 < 1.0) { if (axis === 'x') addColBox(s.a, s.b, fixed - t / 2, fixed + t / 2); else addColBox(fixed - t / 2, fixed + t / 2, s.a, s.b); }
  }
}

// ---- lights -------------------------------------------------------------
const LIGHTS = { interior: [], street: [], flicker: [] };
function pLight(col, inten, dist, x, y, z, group = 'interior') {
  const l = new THREE.PointLight(col, inten, dist, 2); l.position.set(x, y, z); scene.add(l);
  (LIGHTS[group] || LIGHTS.interior).push(l); return l;
}
function optionalLight(l) { (window.__optionalLights = window.__optionalLights || []).push(l); return l; }
function pendant(x, z, y = 3.1, shade = 0x1f4d34) {
  atmo.pendants.push(V3(x, y, z));
  addCylS(SB, MAT.brass, x, (PUB.ceil + y + 0.2) / 2, z, 0.008, PUB.ceil - y - 0.2, 6);
  SB.add(new THREE.ConeGeometry(0.22, 0.2, 18, 1, true), M({ color: shade, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }), x, y + 0.1, z);
  SB.add(G.sph, MAT.bulb, x, y + 0.02, z, 0, 0, 0, 0.06, 0.06, 0.06);
}

// =====================================================================
//  BUILD: STREET & EXTERIOR
// =====================================================================
const dynamic = { doors: [], fans: [], tvs: [], boards: {}, neon: [], heater: null, fire: null, streetBulbs: [], winLit: [] };
let skyObj, sun, hemi, stars, moon, rainSys;

function buildStreet() {
  // ground planes
  const fp = uvScale(new THREE.PlaneGeometry(120, 8), 60, 4); fp.rotateX(-Math.PI / 2);
  mesh(fp, MAT.concrete, 0, 0, 6).receiveShadow = true;
  const road = uvScale(new THREE.PlaneGeometry(120, 7.9), 20, 1.3); road.rotateX(-Math.PI / 2);
  mesh(road, MAT.asphalt, 0, -0.15, 14).receiveShadow = true;
  const fp2 = uvScale(new THREE.PlaneGeometry(120, 8), 60, 4); fp2.rotateX(-Math.PI / 2);
  mesh(fp2, MAT.concrete, 0, 0, 22).receiveShadow = true;
  const dirt = new THREE.PlaneGeometry(400, 400); dirt.rotateX(-Math.PI / 2);
  mesh(dirt, M({ color: 0x1a1814, roughness: 1 }, false), 0, -0.2, 0);
  // kerbs + gutters
  const kerbMat = M({ color: 0x8d8a83, roughness: 0.9 }, false);
  addBoxS(SBX, kerbMat, 0, -0.06, 10.05, 120, 0.18, 0.18);
  addBoxS(SBX, kerbMat, 0, -0.06, 17.95, 120, 0.18, 0.18);
  // lane markings
  const lm = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.6 });
  for (let x = -58; x < 60; x += 6) addBoxS(SBX, lm, x, -0.145, 14, 3, 0.005, 0.12);
  addBoxS(SBX, lm, 0, -0.145, 11.0, 120, 0.005, 0.1); addBoxS(SBX, lm, 0, -0.145, 17.0, 120, 0.005, 0.1);
  // parking bay lines
  for (let x = -14; x <= 14; x += 6) addBoxS(SBX, lm, x, -0.145, 10.6, 0.1, 0.005, 1.0);

  // ---- street lights (cobra head, sodium) ----
  const pole = M({ color: 0x6d7275, metalness: 0.7, roughness: 0.4 }, false);
  for (const sx of [-26, -8, 16, 34]) {
    atmo.streetHeads.push(V3(sx, 6.85, 12.4));
    addCylS(SBX, pole, sx, 3.5, 10.4, 0.08, 7, 10);
    SBX.add(G.box, pole, sx, 7.0, 11.4, 0, 0, 0, 0.08, 0.08, 2.0);
    SBX.add(G.box, pole, sx, 6.95, 12.4, 0, 0, 0, 0.3, 0.12, 0.55);
    SBX.add(G.box, MAT.sodium, sx, 6.88, 12.4, 0, 0, 0, 0.22, 0.02, 0.4);
    if (sx === -8 || sx === 16) dynamic.streetBulbs.push(pLight(0xff9a3c, 0, 26, sx, 6.6, 12.4, 'street'));
  }
  // ---- power poles + sagging wires ----
  const timberPole = M({ color: 0x4a3a2c, roughness: 0.95 }, false);
  const polesX = [-44, -20, 4, 28, 52];
  for (const px of polesX) { addCylS(SBX, timberPole, px, 4.5, 10.6, 0.13, 9, 10); SBX.add(G.box, timberPole, px, 8.6, 10.6, 0, 0, 0, 0.12, 0.12, 2.2); for (const dz of [-0.9, -0.3, 0.3, 0.9]) SBX.add(G.cyl8, MAT.white, px, 8.72, 10.6 + dz, 0, 0, 0, 0.03, 0.12, 0.03); }
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (let i = 0; i < polesX.length - 1; i++) for (const dz of [-0.9, -0.3, 0.3, 0.9]) {
    const a = V3(polesX[i], 8.78, 10.6 + dz), b = V3(polesX[i + 1], 8.78, 10.6 + dz), pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * 0.9, 0))); }
    SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), wireMat);
  }
  // ---- parked ute + sedan ----
  buildUte(-5.2, 11.35, 0x9a2b1f);
  buildUte(22, 16.65, 0x2b3f5a, Math.PI, true);
  // ---- bins, bench, bus stop ----
  for (const [bx, lid] of [[-14.5, 0xc23b22], [-13.8, 0xe2c22b]]) { addBoxS(SBX, M({ color: 0x1f4d2a, roughness: 0.6 }, false), bx, 0.5, 9.2, 0.58, 1.0, 0.7); addBoxS(SBX, M({ color: lid, roughness: 0.5 }, false), bx, 1.03, 9.2, 0.62, 0.06, 0.74); addCol(-14.15, 9.2, 1.4, 0.8); }
  // bus stop pole on far side
  addCylS(SBX, pole, -12, 1.4, 18.6, 0.04, 2.8, 8);
  const bs = signTex(['BUS STOP', 'ROUTE 412'], { w: 256, h: 256, bg: '#f2d42e', color: '#111', sizes: [64, 44] });
  signPlane(bs, 0.45, 0.45, -12, 2.6, 18.64, 0); signPlane(bs, 0.45, 0.45, -12, 2.6, 18.56, Math.PI);
  // bench far side
  addBoxS(SBX, MAT.darkWood, -9.5, 0.45, 19.0, 1.8, 0.06, 0.45); addBoxS(SBX, MAT.darkWood, -9.5, 0.75, 19.22, 1.8, 0.4, 0.05);
  for (const dx of [-0.8, 0.8]) addBoxS(SBX, MAT.iron, -9.5 + dx, 0.22, 19.0, 0.05, 0.45, 0.45);
  addCol(-9.5, 19.05, 1.9, 0.5);

  // ---- bland neighbours: dark, shuttered, forgettable ----
  const shopMat = [MAT.brickDark, M({ map: TEX.paintDark, color: 0x55504a, roughness: 0.95 }, false), M({ map: TEX.paintDark, color: 0x3a3c40, roughness: 0.95 }, false)];
  function blandBlock(x0, x1, zf, depth, h, facing, mat) {
    const w = x1 - x0, cx = (x0 + x1) / 2, cz = zf + depth / 2 * (facing > 0 ? -1 : 1);
    const g = uvBox(new THREE.BoxGeometry(w, h, depth), w, h, depth, 2.5);
    const m = new THREE.Mesh(g, mat); m.position.set(cx, h / 2, cz); m.castShadow = m.receiveShadow = true; scene.add(m);
    addColBox(x0, x1, cz - depth / 2, cz + depth / 2);
    // shutters / dark shopfront + awning
    for (let sx = x0 + 1.2; sx < x1 - 2.4; sx += 4.5) {
      SBX.add(uvBox(new THREE.BoxGeometry(3.2, 2.6, 0.05), 3.2, 2.6, .05, 1), MAT.shutter, sx + 1.6, 1.3, zf + 0.03 * facing);
      if (h > 5) { const lit = Math.random() < 0.12; const wm = lit ? MAT.litWindow : MAT.darkWindow; SBX.add(G.box, wm, sx + 1.6, h - 2.0, zf + 0.02 * facing, 0, 0, 0, 1.2, 1.4, 0.05); }
    }
    SBX.add(G.box, MAT.iron, cx, 3.0, zf + 0.9 * facing, 0, 0, 0, w, 0.08, 1.8);
  }
  blandBlock(-46, -27, 2, 12, 5.2, 1, shopMat[1]);
  blandBlock(-27, -14, 2, 12, 4.4, 1, shopMat[2]);
  blandBlock(19.6, 33, 2, 22, 4.6, 1, shopMat[1]);
  blandBlock(33, 50, 2, 14, 6.2, 1, shopMat[0]);
  blandBlock(-50, -30, 24, 12, 6.5, -1, shopMat[0]);
  blandBlock(-30, -12, 24, 10, 4.2, -1, shopMat[2]);
  blandBlock(-12, 6, 24, 10, 5.0, -1, shopMat[1]);
  blandBlock(6, 7.6, 24, 12, 7.0, -1, shopMat[0]);
  blandBlock(12.4, 26, 24, 12, 7.0, -1, shopMat[0]); // the gap is the kebab shop (buildKebab)
  blandBlock(26, 50, 24, 10, 4.5, -1, shopMat[2]);
  // FOR LEASE sign
  const fl = signTex(['FOR LEASE', '0400 000 000'], { w: 512, h: 256, bg: '#f4f4f0', color: ['#c7352b', '#222'], sizes: [110, 50], border: '#c7352b' });
  signPlane(fl, 1.6, 0.8, -20, 2.2, 2.09, 0);
  signPlane(fl, 1.6, 0.8, 16, 2.2, 23.9, Math.PI);
  // side lane wall between pub and neighbour
  // (the side lane is now the drive-through bottle shop; see buildBottleO)
  // world bounds
  addColBox(-60, 60, 26, 27); addColBox(-61, -60, -30, 30); addColBox(60, 61, -30, 30);
  addColBox(-14, -13, -18, 2); addColBox(13, 15.6, -18.2, -17.9); addColBox(17.0, 19.7, -18.2, -17.9); addColBox(19.6, 19.9, -18.2, 2.1); addColBox(13, 19.6, -8.1, -7.85);
}

function buildUte(x, z, col, ry = 0, sedan = false) {
  const g = new THREE.Group(); g.position.set(x, -0.15, z); g.rotation.y = ry; scene.add(g);
  const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e12, metalness: 0.9, roughness: 0.05 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const add = (geo, m, px, py, pz, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), paint, 0, 0.62, 0, 4.9, 0.55, 1.82);
  if (sedan) { add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, -0.1, 1.1, 0, 2.5, 0.5, 1.66); add(G.box, glass, -0.1, 1.12, 0, 2.3, 0.4, 1.68); }
  else { add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, 0.55, 1.12, 0, 1.6, 0.55, 1.7); add(G.box, glass, 0.55, 1.15, 0, 1.45, 0.42, 1.72); add(G.box, glass, 1.34, 1.13, 0, 0.05, 0.4, 1.5); add(G.box, paint, -1.4, 1.0, 0.86, 2.0, 0.22, 0.05); add(G.box, paint, -1.4, 1.0, -0.86, 2.0, 0.22, 0.05); add(G.box, paint, -2.42, 1.0, 0, 0.05, 0.22, 1.7); add(G.box, MAT.chrome, 0, 1.24, 0, 0.04, 0.04, 1.7).position.set(-0.3, 1.38, 0); }
  for (const [wx, wz] of [[1.5, 0.82], [1.5, -0.82], [-1.5, 0.82], [-1.5, -0.82]]) { const w = add(G.cyl, tyre, wx, 0.36, wz, 0.36, 0.26, 0.36); w.rotation.x = Math.PI / 2; const h = add(G.cyl, MAT.chrome, wx, 0.36, wz * 1.02, 0.2, 0.26, 0.2); h.rotation.x = Math.PI / 2; }
  add(G.box, new THREE.MeshBasicMaterial({ color: 0x400808 }), -2.46, 0.72, 0.65, 0.03, 0.12, 0.22); add(G.box, new THREE.MeshBasicMaterial({ color: 0x400808 }), -2.46, 0.72, -0.65, 0.03, 0.12, 0.22);
  add(G.box, MAT.chrome, 2.46, 0.6, 0, 0.05, 0.18, 1.6);
  add(G.box, new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222 }), 2.46, 0.78, 0.6, 0.03, 0.12, 0.3); add(G.box, new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222 }), 2.46, 0.78, -0.6, 0.03, 0.12, 0.3);
  const c = _v1.set(x, 0, z); const w = Math.abs(Math.cos(ry)) > 0.5 ? 5.0 : 1.9, d = Math.abs(Math.cos(ry)) > 0.5 ? 1.9 : 5.0; addCol(c.x, c.z, w, d);
  // parked cars never move: fold them into the static batch
  g.updateMatrixWorld(true);
  g.traverse(o => { if (o.isMesh) SBX.addM(o.geometry, o.material, o.matrixWorld.clone()); });
  scene.remove(g);
}

function buildFacade() {
  const H1 = 4.2, H2 = 8.4;
  // ---- ground floor front wall (tiles outside, timber/paint inside) ----
  const front = { low: [MAT.wainscot, MAT.tileGreen], high: [MAT.paintCream, MAT.tileCream] };
  buildWall('x', 2, -13.1, 13.1, H1, front, 1, [
    { a: -10.5, b: -4.5, bottom: 1.0, top: 3.2 }, { a: -1.3, b: 1.3, bottom: 0, top: 2.75 }, { a: 4.5, b: 10.5, bottom: 1.0, top: 3.2 }], 0.3);
  // window glass + frames + gold-leaf lettering
  for (const [cx, txt] of [[-7.5, 'PUBLIC BAR'], [7.5, 'LOUNGE · BISTRO']]) {
    const gl = mesh(new THREE.PlaneGeometry(6, 2.2), MAT.window, cx, 2.1, 2.0);
    for (const dx of [-3, -1, 1, 3]) addBoxS(SBX, MAT.greenPaint, cx + dx, 2.1, 2.0, 0.08, 2.2, 0.12);
    addBoxS(SBX, MAT.greenPaint, cx, 3.2, 2.0, 6.1, 0.1, 0.14); addBoxS(SBX, MAT.creamPaint, cx, 1.0, 2.05, 6.2, 0.08, 0.3);
    const lt = signTex([txt], { w: 1024, h: 160, color: '#e8c56a', font: "Rye, serif", size: 90, stroke: '#4a2a08', strokeW: 4 });
    signPlane(lt, 3.6, 0.56, cx, 2.75, 2.02, 0, { transparent: true });
    signPlane(lt, 3.6, 0.56, cx, 2.75, 1.98, Math.PI, { transparent: true });
  }
  // neon OPEN in lounge window
  const open = signTex(['OPEN'], { w: 512, h: 200, color: '#ff4a5a', glow: '#ff0022', glowB: 40, font: "Bungee, sans-serif", size: 130, transparent: true });
  const openSign = signPlane(open, 1.0, 0.4, 9.4, 2.5, 1.9, 0, { transparent: true, toneMapped: false, intensity: 2.2 });
  dynamic.neon.push(openSign);
  // upper storey: brick with sash windows. Room 4 (behind windows 4 & 5) is real: a glass window and French doors onto the balcony.
  colLevel = 1;
  buildWall('x', 2, -13.1, 13.1, H2 - H1, { low: [MAT.paintCream, MAT.brick], high: [MAT.paintCream, MAT.brick] }, 1, [{ a: 5.64, b: 6.84, bottom: 0.9, top: 2.9 }, { a: 9.8, b: 11.0, bottom: 0, top: 2.42 }], 0.3, 99, true, H1);
  colLevel = 0;
  for (let i = 0; i < 6; i++) {
    const wx = -10.4 + i * 4.16, lit = i === 1;
    if (i === 4) { // real glass, with a warm lace curtain that glows when you're not in the room
      mesh(new THREE.PlaneGeometry(1.2, 2.0), MAT.window, wx, 6.1, 2.1);
      dynamic.roomGlow = signPlane(texLaceCurtain(), 1.18, 1.96, wx, 6.1, 1.95, 0, { transparent: true, intensity: 1.0 });
    } else if (i === 5) { // French doors standing open onto the balcony
      for (const sd of [-1, 1]) { addBoxS(SBX, MAT.creamPaint, wx + sd * 0.64, 5.47, 2.17, 0.1, 2.36, 0.12); const leaf = new THREE.Group(); leaf.position.set(wx + sd * 0.6, 4.3, 2.22); leaf.rotation.y = sd * 1.25; scene.add(leaf); const fr = new THREE.Mesh(new THREE.BoxGeometry(0.58, 2.3, 0.05), MAT.greenPaint); fr.position.set(-sd * 0.29, 1.15, 0); leaf.add(fr); const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 1.7), MAT.window); gl.position.set(-sd * 0.29, 1.3, 0.03); leaf.add(gl); }
      addBoxS(SBX, MAT.creamPaint, wx, 6.68, 2.17, 1.4, 0.12, 0.12); addBoxS(SBX, MAT.creamPaint, wx, 7.15, 2.2, 1.5, 0.14, 0.12);
      continue;
    } else SBX.add(G.box, lit ? MAT.litWindow : MAT.darkWindow, wx, 6.1, 2.16, 0, 0, 0, 1.2, 2.0, 0.04);
    addBoxS(SBX, MAT.creamPaint, wx, 6.1, 2.17, 1.36, 0.08, 0.06); addBoxS(SBX, MAT.creamPaint, wx, 7.15, 2.2, 1.5, 0.14, 0.12); addBoxS(SBX, MAT.creamPaint, wx, 5.05, 2.2, 1.5, 0.1, 0.16);
    addBoxS(SBX, MAT.creamPaint, wx - 0.64, 6.1, 2.17, 0.08, 2.1, 0.06); addBoxS(SBX, MAT.creamPaint, wx + 0.64, 6.1, 2.17, 0.08, 2.1, 0.06);
  }
  // string courses + parapet
  addBoxS(SBX, MAT.creamPaint, 0, H1 + 0.05, 2.18, 26.6, 0.2, 0.4);
  addBoxS(SBX, MAT.creamPaint, 0, H2 + 0.1, 2.15, 26.8, 0.25, 0.5);
  const par = new THREE.Mesh(uvBox(new THREE.BoxGeometry(26.4, 1.4, 0.3), 26.4, 1.4, .3, 1.5), MAT.creamPaint); par.position.set(0, H2 + 0.9, 2); par.castShadow = true; scene.add(par);
  // pediment
  const ped = new THREE.Shape(); ped.moveTo(-3.2, 0); ped.lineTo(3.2, 0); ped.lineTo(0, 1.5); ped.lineTo(-3.2, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.3, bevelEnabled: false }); const pm = new THREE.Mesh(pg, MAT.creamPaint); pm.position.set(0, H2 + 1.6, 1.85); pm.castShadow = true; scene.add(pm);
  const est = signTex(['EST. 1888'], { w: 512, h: 128, color: '#6b2a18', font: "Rye, serif", size: 72 });
  signPlane(est, 1.8, 0.45, 0, H2 + 2.05, 2.17, 0, { transparent: true });
  const name = signTex(['ROYAL HOTEL'], { w: 2048, h: 256, color: '#7a1f14', font: "Rye, serif", size: 200, stroke: '#f3e2b8', strokeW: 6 });
  signPlane(name, 14, 1.75, 0, H2 + 0.92, 2.16, 0, { transparent: true });
  // rear/upper volume so the building has depth from the street
  // (stops short of the front rooms upstairs so the real room behind the facade isn't buried in it)
  const body = new THREE.Mesh(uvBox(new THREE.BoxGeometry(26.2, 4.4, 15.85), 26.2, 4.4, 15.85, 2.4), MAT.brick);
  body.position.set(0, H1 + 2.2, -10.075); body.castShadow = true; scene.add(body);
  for (const sx of [-13.05, 13.05]) addBoxS(SBX, MAT.brick, sx, H1 + 2.2, -0.15, 0.1, 4.4, 4.0, 0, 2.4);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.15, 20.4), MAT.corr); roof.position.set(0, H2 + 0.08, -8); scene.add(roof);
  // side walls (exterior only visible from lane)
  buildWall('z', -13, -18, 2, H1, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintCream, MAT.brick] }, -1, [], 0.3);
  buildWall('x', -18, -13.1, 13.1, H1, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintCream, MAT.brick] }, -1, [{ a: -12.45, b: -11.55, bottom: 0, top: 2.1 }], 0.3);

  // ---- two-storey verandah with cast-iron lace ----
  const postX = [-12.8, -8.6, -4.3, 4.3, 8.6, 12.8];
  for (const px of postX) {
    addCylS(SBX, MAT.greenPaint, px, H1 / 2 - 0.1, 9.5, 0.07, H1 - 0.2, 10);
    addCylS(SBX, MAT.greenPaint, px, 0.12, 9.5, 0.12, 0.24, 10);
    addCylS(SBX, MAT.greenPaint, px, 6.0, 9.5, 0.06, 3.8, 10);
    addCol(px, 9.5, 0.2, 0.2);
  }
  // balcony floor + fascia
  addBoxS(SBX, MAT.creamPaint, 0, H1, 5.85, 26.4, 0.18, 7.6);
  addBoxS(SBX, MAT.greenPaint, 0, H1 - 0.05, 9.62, 26.4, 0.3, 0.06);
  // lace frieze under balcony and balustrade above
  const laceGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < postX.length - 1; i++) {
    const a = postX[i], b = postX[i + 1], w = b - a, cx = (a + b) / 2;
    const fr = new THREE.Mesh(laceGeo, MAT.lace); fr.scale.set(w - 0.15, 0.45, 1); fr.position.set(cx, H1 - 0.42, 9.55); scene.add(fr);
    const bal = new THREE.Mesh(laceGeo, MAT.lace); bal.scale.set(w - 0.15, 0.95, 1); bal.position.set(cx, H1 + 0.6, 9.55); scene.add(bal);
    addBoxS(SBX, MAT.greenPaint, cx, H1 + 1.1, 9.55, w, 0.08, 0.12);
    const fr2 = new THREE.Mesh(laceGeo, MAT.lace); fr2.scale.set(w - 0.15, 0.4, 1); fr2.position.set(cx, 7.55, 9.55); scene.add(fr2);
  }
  // centre span over the door
  const cs = new THREE.Mesh(laceGeo, MAT.lace); cs.scale.set(8.4, 0.45, 1); cs.position.set(0, H1 - 0.42, 9.55); scene.add(cs);
  // bullnose-ish corrugated roof (two sloped planes)
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(26.6, 7.9), MAT.corr); r1.rotation.x = -Math.PI / 2 - 0.08; r1.position.set(0, 7.95, 5.9); r1.castShadow = true; scene.add(r1);
  const r1b = r1.clone(); r1b.rotation.x = Math.PI / 2 - 0.08; r1b.position.y = 7.94; scene.add(r1b);
  const ceilV = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 7.5), MAT.creamPaint); ceilV.rotation.x = Math.PI / 2; ceilV.position.set(0, H1 - 0.1, 5.85); scene.add(ceilV);
  // verandah lamps + under-verandah lightbox signs
  for (const lx of [-6.5, 6.5]) { SBX.add(G.sph, MAT.bulb, lx, 3.7, 5.5, 0, 0, 0, 0.12, 0.12, 0.12); optionalLight(pLight(0xffc27a, 14, 12, lx, 3.5, 5.6, 'street')); atmo.verandahLamps.push(V3(lx, 3.7, 5.5)); }
  const blade = [['COLD BEER', '#ffffff', ['#8a1a12', '#c7352b']], ['TAB · KENO', '#fff', ['#1a4d1a', '#2f8a3a']], ['GAMING', '#ffe27a', ['#2a0d3a', '#6a1d8a']], ['BISTRO', '#2a1d10', ['#f4e3b0', '#e3c47a']]];
  blade.forEach(([t, c, bg], i) => {
    const tx = signTex([t], { w: 512, h: 128, bg, color: c, size: 92, border: '#e8c56a', borderW: 6 });
    const sx = [-11, -3.1, 3.1, 11][i];
    const s1 = signPlane(tx, 1.6, 0.4, sx, 3.55, 7.2, 0, { intensity: 1.6, toneMapped: false });
    const s2 = signPlane(tx, 1.6, 0.4, sx, 3.55, 7.16, Math.PI, { intensity: 1.6, toneMapped: false });
    addBoxS(SBX, MAT.iron, sx, 3.78, 7.18, 1.65, 0.04, 0.1); addBoxS(SBX, MAT.iron, sx, 3.55, 7.18, 1.68, 0.44, 0.03);
    s1.position.z = 7.2; s2.position.z = 7.16; dynamic.neon.push(s1, s2);
  });
  // fascia sign over the door
  const fas = signTex(['THE ROYAL'], { w: 1024, h: 200, bg: ['#1f4d34', '#123222'], color: '#f0cf6a', font: 'Rye, serif', size: 130, border: '#f0cf6a', borderW: 8 });
  signPlane(fas, 3.4, 0.66, 0, 3.4, 2.17, 0, { intensity: 1.3, toneMapped: false });
  // door frame + front step (terrazzo)
  addBoxS(SBX, MAT.greenPaint, -1.38, 1.4, 2.0, 0.12, 2.8, 0.36); addBoxS(SBX, MAT.greenPaint, 1.38, 1.4, 2.0, 0.12, 2.8, 0.36); addBoxS(SBX, MAT.greenPaint, 0, 2.8, 2.0, 2.9, 0.1, 0.36);
  const terr = signTex(['ROYAL'], { w: 512, h: 256, bg: '#b9ae9a', color: '#7a1f14', font: 'Rye, serif', size: 100, border: '#2f4a3a', borderW: 16 });
  const step = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: terr, roughness: 0.3 })); step.rotation.x = -Math.PI / 2; step.position.set(0, 0.006, 2.8); step.receiveShadow = true; scene.add(step);
  // A-frame chalk board (updated each day)
  const ab = new THREE.Group(); ab.position.set(2.6, 0, 6.2); ab.rotation.y = -0.4; scene.add(ab);
  const bc = mkCanvas(512, 720); dynamic.boards.aframe = { c: bc, tex: canvasTex(bc, 1, 1) };
  const abm = new THREE.MeshStandardMaterial({ map: dynamic.boards.aframe.tex, roughness: 0.9 });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.03), [MAT.darkWood, MAT.darkWood, MAT.darkWood, MAT.darkWood, s > 0 ? abm : MAT.darkWood, s > 0 ? MAT.darkWood : abm]); p.position.set(0, 0.47, 0.17 * s); p.rotation.x = -0.18 * s; p.castShadow = true; ab.add(p); }
  addCol(2.6, 6.2, 0.7, 0.5);
  // pot plants by the door
  for (const px of [-2.2, 2.2]) { addCylS(SBX, MAT.pot, px, 0.3, 2.6, 0.28, 0.6, 12); for (let k = 0; k < 7; k++) SBX.add(new THREE.ConeGeometry(0.12, 0.9, 5), MAT.leaf, px + rand(-.12, .12), 0.95, 2.6 + rand(-.12, .12), rand(0, 6), rand(-.5, .5), rand(-.5, .5)); addCol(px, 2.6, 0.6, 0.6); }
  // smoker's butt bin on a post
  addCylS(SBX, MAT.chrome, -3.4, 0.55, 3.2, 0.09, 1.1, 12); addCol(-3.4, 3.2, 0.25, 0.25);
}

// ---- double swing doors with spring physics ----
function buildDoors() {
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f4d34, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(1.3 * s, 0, 2.0); scene.add(pivot);
    const leaf = new THREE.Group(); pivot.add(leaf);
    const w = 1.28;
    const lo = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.05), leafMat); lo.position.set(-s * w / 2, 0.6, 0); leaf.add(lo);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.06), leafMat); fr.position.set(-s * w / 2, 2.62, 0); leaf.add(fr);
    for (const fx of [0.04, w - 0.04]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.06), leafMat); st.position.set(-s * fx, 1.9, 0); leaf.add(st); }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 1.45), MAT.window); gl.position.set(-s * w / 2, 1.9, 0); leaf.add(gl);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.07), MAT.brass); pl.position.set(-s * (w - 0.25), 1.15, 0); leaf.add(pl);
    const et = signTex(['PUSH'], { w: 256, h: 64, color: '#e8c56a', size: 44 });
    const ep = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: et, transparent: true })); ep.position.set(-s * w / 2, 1.0, 0.03); leaf.add(ep);
    pivot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    dynamic.doors.push({ pivot, s, w, ang: 0, vel: 0, lastSound: 0 });
  }
}
function updateDoors(dt, actors) {
  for (const d of dynamic.doors) {
    let torque = -d.ang * 9 - d.vel * 3.2; // spring + damper
    for (const a of actors) {
      // test against leaf segment
      const hx = d.pivot.position.x, hz = d.pivot.position.z;
      const tipx = hx - d.s * Math.cos(d.ang) * d.w, tipz = hz + Math.sin(d.ang) * d.w;
      const ex = tipx - hx, ez = tipz - hz, len2 = ex * ex + ez * ez;
      const t = clamp(((a.x - hx) * ex + (a.z - hz) * ez) / len2, 0.05, 1);
      const px = hx + ex * t, pz = hz + ez * t, dx = a.x - px, dz = a.z - pz, dist = Math.hypot(dx, dz);
      const r = a.r + 0.08;
      if (dist < r) {
        // direction the tip moves for +ang; push the leaf away from the actor
        const mx = d.s * Math.sin(d.ang), mz = Math.cos(d.ang);
        const side = Math.sign(dx * mx + dz * mz) || Math.sign(a.z - hz) || 1;
        torque += -side * (r - dist) * 70 * t;
      }
    }
    d.vel += torque * dt; d.ang += d.vel * dt; d.ang = clamp(d.ang, -1.6, 1.6);
    if (Math.abs(d.vel) > 1.6 && performance.now() - d.lastSound > 700) { d.lastSound = performance.now(); SFX.door(d.pivot.position); }
    d.pivot.rotation.y = d.ang * d.s;
  }
}

// =====================================================================
//  BUILD: INTERIOR
// =====================================================================
let backMirror;
const BAR = { front: -8.5, taps: [], z0: -14.5, z1: -2.5, tender: null, shelfZ: [] };
const MACHINES = [];
const MACHINE_DEFS = [];

function buildInterior() {
  // floors
  const fl = new THREE.PlaneGeometry(26, 20); fl.rotateX(-Math.PI / 2); uvScale(fl, 26 / 3, 20 / 3);
  const floor = mesh(fl, MAT.timber, 0, 0.002, -8); floor.receiveShadow = true;
  const cp = new THREE.PlaneGeometry(10, 14); cp.rotateX(-Math.PI / 2); uvScale(cp, 10 / 6 * 6 / 6, 14 / 6);
  const carpet = mesh(cp, MAT.carpet, 8, 0.006, -11); carpet.receiveShadow = true;
  MAT.carpet.map.repeat.set(1.7, 1.7);
  const dk = new THREE.PlaneGeometry(6.6, 10); dk.rotateX(-Math.PI / 2); uvScale(dk, 1.6, 2.5);
  mesh(dk, MAT.deck, 16.3, 0.004, -13).receiveShadow = true;
  // ceiling
  const cg = new THREE.PlaneGeometry(26, 20); cg.rotateX(Math.PI / 2); uvScale(cg, 26 / 0.9, 20 / 0.9);
  mesh(cg, MAT.ceiling, 0, PUB.ceil, -8);
  addBoxS(SB, MAT.darkWood, 0, PUB.ceil - 0.08, 1.85, 26, 0.16, 0.12);
  // interior partitions: gaming room
  const gmat = { low: [MAT.wainscot, MAT.gamingWall], high: [MAT.paintCream, MAT.gamingWall] };
  buildWall('z', 3, -18, -4, PUB.ceil, gmat, 1, [{ a: -11, b: -9, bottom: 0, top: 2.6 }], 0.18);
  buildWall('x', -4, 3, 13, PUB.ceil, { low: [MAT.gamingWall, MAT.wainscot], high: [MAT.gamingWall, MAT.paintGreen] }, 1, [{ a: 6.5, b: 8.5, bottom: 0, top: 2.6 }], 0.18);
  // right exterior wall with terrace door + fireplace
  buildWall('z', 13, -18, 2, PUB.ceil, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintGreen, MAT.brick] }, 1, [{ a: -14, b: -12, bottom: 0, top: 2.6 }], 0.3);
  // gaming room inner walls colour (inside faces of right wall in gaming area) — overlay panels
  addBoxS(SB, MAT.gamingWall, 12.84, 2.0, -16, 0.02, 4.0, 4.0); addBoxS(SB, MAT.gamingWall, 12.84, 2.0, -8, 0.02, 4.0, 8.0);
  addBoxS(SB, MAT.gamingWall, 8, 2.0, -17.84, 10, 4.0, 0.02);
  // sliding glass terrace door frame
  addBoxS(SB, MAT.chrome, 13, 2.62, -13, 0.32, 0.06, 2.0);
  const tdg = mesh(new THREE.PlaneGeometry(1.0, 2.55), MAT.window, 13, 1.3, -13.5); tdg.rotation.y = Math.PI / 2;
  // dado rail on walls
  for (const [x, z, w, d] of [[-12.88, -8, 0.04, 20], [0, -17.88, 26, 0.04], [0, 1.84, 26, 0.04]]) addBoxS(SB, MAT.darkWood, x, 1.12, z, w, 0.06, d);

  buildBar();
  buildPublicBar();
  buildLounge();
  buildGamingRoom();
  buildTerrace();
  buildBarClutter();
  // lights
  pLight(0xffc98a, 15, 16, -9.6, 2.9, -10.5);
  pLight(0xffc98a, 15, 16, -9.6, 2.9, -4.5);
  spotShadow(0xffcf98, 70, -4.6, 3.95, -7.6, 1.15);
  pLight(0xfff0d8, 16, 6, -3.0, 2.2, -13.2);
  pLight(0xffbf7a, 13, 14, 7.5, 3.0, -0.8);
  spotShadow(0xe0b8ff, 85, 7.3, 3.95, -11.0, 1.25);
  optionalLight(pLight(0xffc0d8, 17, 12, 7.5, 3.0, -15));
  dynamic.fire = pLight(0xff7a2a, 8, 7, 12.2, 0.7, -1.2);
  dynamic.heater = pLight(0xff6a2a, 16, 9, 15.6, 2.3, -10.5);
  optionalLight(pLight(0xffd29a, 9, 10, 16.5, 2.9, -14.5));
  // ceiling fans
  for (const [fx, fz] of [[-3.5, -4], [-3.5, -11], [8, -0.5]]) {
    const g = new THREE.Group(); g.position.set(fx, PUB.ceil - 0.5, fz); scene.add(g);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 16), MAT.brass); g.add(hub);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), MAT.brass); rod.position.y = 0.3; g.add(rod);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.14), MAT.darkWood); b.position.set(Math.cos(i * Math.PI / 2) * 0.4, -0.02, Math.sin(i * Math.PI / 2) * 0.4); b.rotation.y = -i * Math.PI / 2; b.rotation.x = 0.12; g.add(b); }
    dynamic.fans.push(g);
  }
  // pendants
  for (const [px, pz] of [[-9.6, -12.5], [-9.6, -9], [-9.6, -5.5], [-5.5, -10.5], [-5.5, -6.5], [-5.5, -2.5], [5.5, -1.5], [9.5, -1.5], [5.5, 0.8], [9.5, 0.8]]) pendant(px, pz);
  // pool table lamp
  SB.add(G.box, MAT.greenPaint, -3, 2.45, -13.2, 0, 0, 0, 0.5, 0.18, 1.5); SB.add(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.0) }), -3, 2.35, -13.2, 0, 0, 0, 0.4, 0.02, 1.3);
}

function buildBar() {
  const F = BAR.front, z0 = BAR.z0, z1 = BAR.z1, L = z1 - z0;
  // counter body
  const body = uvBox(new THREE.BoxGeometry(0.55, 1.05, L), 0.55, 1.05, L, 1);
  SB.add(body, MAT.wainscot, F - 0.3, 0.525, (z0 + z1) / 2);
  // returns to wall
  SB.add(uvBox(new THREE.BoxGeometry(4.5, 1.05, 0.55), 4.5, 1.05, .55, 1), MAT.wainscot, -10.75, 0.525, z0 + 0.27);
  SB.add(uvBox(new THREE.BoxGeometry(4.5, 1.05, 0.55), 4.5, 1.05, .55, 1), MAT.wainscot, -10.75, 0.525, z1 - 0.27);
  // polished top with overhang
  SB.add(uvBox(new THREE.BoxGeometry(0.8, 0.06, L + 0.3), .8, .06, L, 1), MAT.barTop, F - 0.25, 1.08, (z0 + z1) / 2);
  SB.add(uvBox(new THREE.BoxGeometry(4.6, 0.06, 0.8), 4.6, .06, .8, 1), MAT.barTop, -10.75, 1.08, z0 + 0.27);
  SB.add(uvBox(new THREE.BoxGeometry(4.6, 0.06, 0.8), 4.6, .06, .8, 1), MAT.barTop, -10.75, 1.08, z1 - 0.27);
  // brass foot rail
  addCylS(SB, MAT.brass, F + 0.12, 0.22, (z0 + z1) / 2, 0.025, L, 12, 0, Math.PI / 2);
  for (let z = z0 + 0.5; z < z1; z += 1.6) SB.add(G.box, MAT.brass, F + 0.06, 0.22, z, 0, 0, 0, 0.12, 0.03, 0.03);
  // trough / drip rail line
  addBoxS(SB, MAT.chrome, F - 0.42, 1.115, (z0 + z1) / 2, 0.12, 0.012, L - 0.4);
  addColBox(F - 0.65, F + 0.05, z0, z1); addColBox(-13, F, z0 - 0.05, z0 + 0.55); addColBox(-13, F, z1 - 0.55, z1 + 0.05);
  addColBox(-13, F, z0, z1); // staff-only area
  // tap towers (T-bar with 4 handles)
  const tapNames = [['GOLDEN', 'LAGER', '#d9a12a'], ['SOUTHERLY', 'BITTER', '#2a6b2f'], ['LARRIKIN', 'PALE ALE', '#b5541b'], ['DROVER\'S', 'DRAUGHT', '#22477a']];
  for (const tz of [-11.5, -6.5]) {
    // T-bar tower: badges face the customer, spouts and drip tray face the bartender
    SB.add(G.box, MAT.chrome, F - 0.38, 1.26, tz, 0, 0, 0, 0.06, 0.3, 0.06);
    SB.add(G.box, MAT.chrome, F - 0.38, 1.42, tz, 0, 0, 0, 0.07, 0.07, 1.1);
    SB.add(G.box, MAT.chrome, F - 0.53, 1.12, tz, 0, 0, 0, 0.2, 0.02, 1.15); // drip tray
    SB.add(G.box, MAT.iron, F - 0.53, 1.131, tz, 0, 0, 0, 0.17, 0.004, 1.1); // drip grate
    for (let k = 0; k < 4; k++) {
      const z = tz - 0.42 + k * 0.28, [a, b, col] = tapNames[k];
      SB.add(G.cyl8, MAT.chrome, F - 0.45, 1.42, z, 0, 0, Math.PI / 2, 0.016, 0.14, 0.016);
      SB.add(G.cyl8, MAT.chrome, F - 0.52, 1.39, z, 0, 0, 0, 0.011, 0.06, 0.011);
      // handle (dynamic so it can be pulled)
      const hg = new THREE.Group(); hg.position.set(F - 0.38, 1.455, z); scene.add(hg);
      const ht = signTex([a, b], { w: 128, h: 256, bg: ['#111', col], color: '#fff', sizes: [30, 34], border: '#d4a94e', borderW: 6 });
      const hm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.05), [MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic]);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.2), new THREE.MeshBasicMaterial({ map: ht })); face.rotation.y = Math.PI / 2; face.position.x = 0.019;
      hm.position.y = 0.1; face.position.y = 0.1; hg.add(hm); hg.add(face);
      BAR.taps.push({ handle: hg, spout: V3(F - 0.52, 1.355, z), z, name: a + ' ' + b, col });
    }
  }
  // beer mats & bar runners along counter
  const runner = M({ color: 0x1a3a6a, roughness: 0.95 });
  for (let z = z0 + 0.8; z < z1 - 0.3; z += 1.05) SB.add(G.box, runner, F - 0.12, 1.116, z, 0, 0, 0, 0.3, 0.006, 0.42);
  // till / register
  SB.add(G.box, MAT.blackPlastic, F - 0.55, 1.25, -9, 0, 0, 0, 0.35, 0.25, 0.4); SB.add(G.box, MAT.bulbCool, F - 0.4, 1.38, -9, 0, 0.5, 0, 0.01, 0.15, 0.25);
  // back bar: cabinets, fridges, shelves, mirror
  SB.add(uvBox(new THREE.BoxGeometry(0.6, 0.95, 12), .6, .95, 12, 1), MAT.darkWood, -12.6, 0.475, -8.5);
  SB.add(uvBox(new THREE.BoxGeometry(0.66, 0.05, 12), .66, .05, 12, 1), MAT.barTop, -12.6, 0.97, -8.5);
  // fridges with glowing glass doors
  for (let i = 0; i < 3; i++) {
    const fz = -13.6 + i * 0.9;
    SB.add(G.box, MAT.chrome, -12.62, 1.6, fz, 0, 0, 0, 0.6, 1.3, 0.86);
    SB.add(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.48, 0.55) }), -12.3, 1.6, fz, 0, 0, 0, 0.02, 1.15, 0.74);
    for (let sh = 0; sh < 4; sh++) for (let b = 0; b < 6; b++) SB.add(G.cyl8, M({ color: choice([0x2a5a1a, 0x7a4a10, 0x10305a, 0xa8a8a0]), roughness: 0.2, metalness: 0.3 }), -12.4, 1.1 + sh * 0.3, fz - 0.3 + b * 0.12, 0, 0, 0, 0.03, 0.22, 0.03);
  }
  // spirit shelves with bottles in front of mirror
  const mirrorZ0 = -10.6, mirrorZ1 = -2.9;
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(mirrorZ1 - mirrorZ0, 1.5), MAT.mirrorFake); mm.rotation.y = Math.PI / 2; mm.position.set(-12.86, 1.95, (mirrorZ0 + mirrorZ1) / 2); scene.add(mm);
  for (let s = 0; s < 3; s++) {
    const y = 1.25 + s * 0.42;
    SB.add(G.box, MAT.glassShelf || (MAT.glassShelf = M({ color: 0xbcd8d8, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.5 })), -12.7, y, (mirrorZ0 + mirrorZ1) / 2, 0, 0, 0, 0.3, 0.015, mirrorZ1 - mirrorZ0);
    for (let z = mirrorZ0 + 0.15; z < mirrorZ1 - 0.1; z += rand(0.11, 0.16)) {
      const col = choice([0x6a3a10, 0x8a5a14, 0x1a4a2a, 0xd8d8c8, 0x3a1010, 0x101010, 0xb8a050, 0x5a1a4a]);
      const h = rand(0.24, 0.34), r = rand(0.03, 0.045);
      const bm = M({ color: col, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
      SB.add(G.cyl8, bm, -12.7 + rand(-0.06, 0.06), y + h / 2 + 0.01, z, 0, 0, 0, r, h, r);
      SB.add(G.cyl8, bm, -12.7, y + h + 0.04, z, 0, 0, 0, r * 0.35, 0.08, r * 0.35);
      if (Math.random() < 0.5) SB.add(G.cyl8, MAT.white, -12.68, y + h * 0.45, z, 0, 0, 0, r * 1.02, h * 0.35, r * 1.02);
    }
  }
  // gilt mirror frame + bar sign
  addBoxS(SB, MAT.brass, -12.84, 2.72, (mirrorZ0 + mirrorZ1) / 2, 0.04, 0.08, mirrorZ1 - mirrorZ0 + 0.1);
  const barSign = signTex(['PUBLIC BAR'], { w: 1024, h: 160, color: '#f0cf6a', font: 'Rye, serif', size: 100 });
  signPlane(barSign, 3.6, 0.56, -12.84, 3.2, -6.7, Math.PI / 2, { transparent: true });
  // glass racks below counter (dish of schooners)
  for (let i = 0; i < 10; i++) SB.add(G.cyl8, MAT.glassShelf, F - 0.75, 1.0 - 0.15, -4 - i * 0.12, 0, 0, 0, 0.035, 0.15, 0.035);
  // bartender spots
  BAR.tender = { home: V3(-10.0, 0, -8), ry: Math.PI / 2 };
  addInteract({ id: 'bar', pos: V3(F - 0.1, 1.2, -8.5), r: 0, label: () => 'Order at the bar', zone: { x0: F, x1: F + 1.9, z0: z0 + 0.3, z1: z1 - 0.3 }, action: () => Game.openBar() });
}

function blob(x, z, s, y = 0.004) { SB.add(G.plane, MAT.blob, x, y, z, 0, -Math.PI / 2, 0, s, s, 1); }
function stool(b, x, z, h = 0.76, mat = MAT.vinylRed) {
  blob(x, z, 0.62);
  addCylS(b, mat, x, h, z, 0.19, 0.07, 18);
  addCylS(b, MAT.chrome, x, h / 2, z, 0.025, h, 8);
  b.add(G.torus, MAT.chrome, x, 0.3, z, 0, Math.PI / 2, 0, 0.17, 0.17, 0.17);
  addCylS(b, MAT.chrome, x, 0.015, z, 0.2, 0.03, 16);
}
function roundTable(b, x, z, h, r = 0.38) {
  blob(x, z, 1.1);
  addCylS(b, MAT.barTop, x, h, z, r, 0.05, 24);
  addCylS(b, MAT.iron, x, h / 2, z, 0.04, h, 8);
  addCylS(b, MAT.iron, x, 0.02, z, 0.3, 0.04, 16);
  addCol(x, z, r * 1.6, r * 1.6);
}
function chair(b, x, z, ry) {
  blob(x, z, 0.75);
  const s = Math.sin(ry), c = Math.cos(ry);
  b.add(G.box, MAT.darkWood, x, 0.46, z, ry, 0, 0, 0.44, 0.05, 0.44);
  for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) b.add(G.box, MAT.darkWood, x + lx * c + lz * s, 0.23, z - lx * s + lz * c, ry, 0, 0, 0.04, 0.46, 0.04);
  const bx = x - s * 0.2, bz = z - c * 0.2;
  b.add(G.box, MAT.darkWood, bx, 0.72, bz, ry, 0, 0, 0.44, 0.5, 0.04);
}

function buildPublicBar() {
  // bar stools
  for (let i = 0; i < 11; i++) {
    const z = -13.6 + i * 1.05; stool(SB, -7.9, z);
    addSpot({ kind: 'stool', pos: V3(-7.9, 0, z), ry: -Math.PI / 2, sitH: 0.8, area: 'bar', node: 'P3', group: 'bs' + Math.floor(i / 2) });
  }
  // high tables
  for (const tz of [-10.5, -6.5, -2.5]) {
    roundTable(SB, -5.4, tz, 1.05);
    for (const dz of [-0.6, 0.6]) { stool(SB, -5.4, tz + dz, 0.72, MAT.vinylBlack); addSpot({ kind: 'stool', pos: V3(-5.4, 0, tz + dz), ry: dz > 0 ? Math.PI : 0, sitH: 0.76, area: 'bar', group: 'ht' + tz }); }
  }
  // standing spots near bar ends / poles
  addSpot({ kind: 'lean', pos: V3(-7.6, 0, -1.8), ry: -2.3, area: 'bar' });
  addSpot({ kind: 'stand', pos: V3(-2.5, 0, -8.2), ry: 1.2, area: 'bar' });
  addSpot({ kind: 'stand', pos: V3(-1.6, 0, -7.2), ry: -2.2, area: 'bar' });
  // pool table
  const px = -3, pz = -13.2;
  SB.add(uvBox(new THREE.BoxGeometry(1.5, 0.12, 2.7), 1.5, .12, 2.7, 1), MAT.darkWood, px, 0.78, pz);
  SB.add(G.box, MAT.felt, px, 0.845, pz, 0, 0, 0, 1.28, 0.01, 2.48);
  for (const [cx, cz] of [[-.68, 0], [.68, 0]]) SB.add(G.box, MAT.darkWood, px + cx, 0.88, pz, 0, 0, 0, 0.14, 0.08, 2.7);
  for (const cz of [-1.3, 1.3]) SB.add(G.box, MAT.darkWood, px, 0.88, pz + cz, 0, 0, 0, 1.5, 0.08, 0.14);
  for (const [lx, lz] of [[-.6, -1.2], [.6, -1.2], [-.6, 1.2], [.6, 1.2]]) SB.add(G.box, MAT.darkWood, px + lx, 0.36, pz + lz, 0, 0, 0, 0.16, 0.72, 0.16);
  const ballCols = [0xf2f2ee, 0xe8c52a, 0x1a3aa8, 0xc7352b, 0x5a1a8a, 0xe8772a, 0x1a7a3a, 0x7a1a1a, 0x111111, 0xe8c52a, 0x1a3aa8, 0xc7352b];
  ballCols.forEach((c, i) => SB.add(G.sph, M({ color: c, roughness: 0.15 }), px + rand(-0.5, 0.5), 0.877, pz + rand(-1.0, 1.0), 0, 0, 0, 0.028, 0.028, 0.028));
  addCol(px, pz, 1.5, 2.7);
  SB.add(G.plane, MAT.blob, px, 0.004, pz, 0, -Math.PI / 2, 0, 2.3, 3.6, 1);
  addSpot({ kind: 'pool', pos: V3(px + 1.1, 0, pz - 0.6), ry: -Math.PI / 2, area: 'bar' });
  addSpot({ kind: 'pool', pos: V3(px - 1.1, 0, pz + 0.8), ry: Math.PI / 2, area: 'bar' });
  // cue rack + dartboard + toilets on back wall
  SB.add(G.box, MAT.darkWood, 0.2, 1.4, -17.85, 0, 0, 0, 0.8, 1.2, 0.06);
  for (let i = 0; i < 5; i++) SB.add(G.cyl8, MAT.darkWood, -0.1 + i * 0.15, 1.35, -17.8, 0, 0, 0.0, 0.012, 1.4, 0.012);
  SB.add(G.box, MAT.darkWood, -7.0, 1.73, -17.87, 0, 0, 0, 0.78, 0.78, 0.04); // backboard (the board itself is built by the darts game)
  addSpot({ kind: 'stand', pos: V3(-7.0, 0, -15.6), ry: Math.PI, area: 'bar', anim: 'darts' });
  for (const [tx, t] of [[-12.0, 'GENTS'], [-10.3, 'LADIES']]) {
    if (t === 'LADIES') { SB.add(G.box, MAT.darkWood, tx, 1.05, -17.86, 0, 0, 0, 0.9, 2.1, 0.06); SB.add(G.box, MAT.brass, tx + 0.32, 1.0, -17.82, 0, 0, 0, 0.04, 0.12, 0.04); }
    else { addBoxS(SB, MAT.darkWood, tx, 2.16, -17.83, 1.06, 0.12, 0.08); for (const dx of [-0.49, 0.49]) addBoxS(SB, MAT.darkWood, tx + dx, 1.05, -17.83, 0.08, 2.1, 0.08); }
    signPlane(signTex([t], { w: 256, h: 96, bg: '#1a1a1a', color: '#e8c56a', size: 64 }), 0.5, 0.18, tx, 1.75, -17.82, 0);
  }
  addSpot({ kind: 'toilet', pos: V3(-11.1, 0, -17.2), ry: Math.PI, area: 'bar', hidden: true });
  // big vintage mirror on back wall — reflects the windows & street (real reflection)
  const mw = 3.4, mh = 1.5, mx = -3.4, my = 2.35;
  backMirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: 640, textureHeight: 320, color: 0xb8b0a0 });
  backMirror.position.set(mx, my, -17.84); scene.add(backMirror); window.__mirror = backMirror;
  const fb = mesh(new THREE.PlaneGeometry(mw, mh), MAT.mirrorFake, mx, my, -17.845); window.__mirrorFallback = fb; fb.visible = false;
  const frameM = M({ color: 0xb8902e, metalness: 1, roughness: 0.35 });
  for (const [fx, fy, fw, fh] of [[0, mh / 2 + 0.08, mw + 0.3, 0.16], [0, -mh / 2 - 0.08, mw + 0.3, 0.16], [-mw / 2 - 0.08, 0, 0.16, mh], [mw / 2 + 0.08, 0, 0.16, mh]]) SB.add(G.box, frameM, mx + fx, my + fy, -17.82, 0, 0, 0, fw, fh, 0.06);
  const mt = signTex(['THE ROYAL HOTEL', 'FINE ALES · WINES · SPIRITS'], { w: 1024, h: 256, color: ['#f3d27a', '#e8dcc0'], font: 'Rye, serif', sizes: [86, 40] });
  signPlane(mt, 2.4, 0.6, mx, my + 0.35, -17.83, 0, { transparent: true });
  // TVs: racing above bar end, footy over door
  const tvA = makeTV(-8.65, 3.0, -0.6, Math.PI / 2 * 0 + Math.PI, 'racing'); // facing -z? placed near bar return
  tvA.group.position.set(-8.4, 3.0, -15.3); tvA.group.rotation.y = 0.35;
  makeTV(0, 3.15, 1.75, Math.PI, 'footy');
  makeTV(12.85, 2.6, -2.6, -Math.PI / 2, 'footy');
  // Keno screen on partition (bar side) + keno counter
  const kc = mkCanvas(512, 384); dynamic.keno = { c: kc, tex: canvasTex(kc, 1, 1) };
  const ks = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: dynamic.keno.tex, toneMapped: true })); ks.material.color.setScalar(1.2);
  ks.position.set(2.88, 2.3, -14.2); ks.rotation.y = -Math.PI / 2; scene.add(ks);
  SB.add(G.box, MAT.blackPlastic, 2.92, 2.3, -14.2, 0, 0, 0, 0.06, 1.15, 1.5);
  SB.add(G.box, MAT.darkWood, 2.6, 0.55, -14.2, 0, 0, 0, 0.5, 1.1, 1.2); SB.add(G.box, MAT.barTop, 2.55, 1.12, -14.2, 0, 0, 0, 0.62, 0.04, 1.3);
  signPlane(signTex(['KENO'], { w: 256, h: 96, bg: ['#c7352b', '#7a1f14'], color: '#fff', size: 72 }), 0.6, 0.22, 2.3, 1.0, -14.2, -Math.PI / 2);
  addColBox(2.3, 3, -14.85, -13.55);
  addInteract({ id: 'keno', pos: V3(2.4, 1.3, -14.2), r: 2.2, label: () => 'Play Keno', action: () => Game.openKeno() });
  // jukebox
  const jx = 1.6, jz = -17.45;
  SB.add(new RoundedBoxGeometry(0.9, 1.5, 0.6, 3, 0.12), MAT.darkWood, jx, 0.75, jz);
  addCol(jx, jz, 1.0, 0.7);
  dynamic.jukePos = V3(jx, 1.2, jz);
  addInteract({ id: 'juke', pos: V3(jx, 1.1, jz + 0.3), r: 2.0, label: () => `Jukebox — ♫ ${Music.SONGS[Music.song].name}`, action: () => Game.openJukebox() });
  // memorabilia frames on left & back walls
  [[-3.9, 1.84, Math.PI], [-2.3, 1.84, Math.PI], [2.2, 1.84, Math.PI]].forEach(([fx, fz, fr], i) => framed(fx, 2.4, fz, fr, i));
  framed(2.9, 2.3, -8.1, -Math.PI / 2, 3); framed(2.9, 2.3, -4.75, -Math.PI / 2, 4);
  // fridge magnet style specials chalkboard on partition (bar side)
  const cb = mkCanvas(512, 640); dynamic.boards.specials = { c: cb, tex: canvasTex(cb, 1, 1) };
  const cbm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshStandardMaterial({ map: dynamic.boards.specials.tex, roughness: 0.9 }));
  cbm.position.set(2.88, 2.1, -6.0); cbm.rotation.y = -Math.PI / 2; scene.add(cbm);
  SB.add(G.box, MAT.darkWood, 2.9, 2.1, -6.0, 0, 0, 0, 0.04, 1.35, 1.1);
}
function framed(x, y, z, ry, i) {
  const c = mkCanvas(256, 320), g = c.getContext('2d');
  const themes = [['#1a1a5a', '#fff', '1977'], ['#7a1f14', '#e8c56a', 'PREMIERS'], ['#0a3a1a', '#e8dcc0', 'CUP DAY'], ['#222', '#ddd', 'FIRST PINT'], ['#3a2a10', '#e8c56a', '1956']];
  const [bg, fg, t] = themes[i % themes.length];
  g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, 256, 320); g.fillStyle = bg; g.fillRect(24, 24, 208, 230);
  if (i % 2 === 0) { // footy jersey silhouette
    g.fillStyle = fg; g.beginPath(); g.moveTo(80, 60); g.lineTo(176, 60); g.lineTo(215, 100); g.lineTo(190, 125); g.lineTo(176, 112); g.lineTo(176, 230); g.lineTo(80, 230); g.lineTo(80, 112); g.lineTo(66, 125); g.lineTo(41, 100); g.closePath(); g.fill();
    g.fillStyle = bg; g.font = 'bold 60px Bebas Neue, Impact'; g.textAlign = 'center'; g.fillText(String(randi(1, 44)), 128, 170);
  } else { // sepia photo
    const gr = g.createLinearGradient(0, 24, 0, 254); gr.addColorStop(0, '#9a8a6a'); gr.addColorStop(1, '#4a3a2a'); g.fillStyle = gr; g.fillRect(24, 24, 208, 230);
    g.fillStyle = 'rgba(30,20,10,.7)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(50 + k * 32, 150, 14, 0, 7); g.fill(); g.fillRect(38 + k * 32, 162, 24, 70); }
  }
  g.fillStyle = '#2a1d10'; g.font = 'bold 34px Bebas Neue, Impact'; g.textAlign = 'center'; g.fillText(t, 128, 295);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); p.position.set(x + Math.sin(ry) * 0.02, y, z + Math.cos(ry) * 0.02); p.rotation.y = ry; scene.add(p);
  SB.add(G.box, MAT.darkWood, x, y, z, ry, 0, 0, 0.58, 0.7, 0.03);
}

function buildLounge() {
  for (const [tx, tz] of [[5.5, -1.7], [9.4, -1.7], [5.5, 0.6], [9.4, 0.6]]) {
    SB.add(uvBox(new THREE.BoxGeometry(1.2, 0.05, 0.9), 1.2, .05, .9, 1), MAT.barTop, tx, 0.76, tz);
    addCylS(SB, MAT.iron, tx, 0.38, tz, 0.05, 0.76, 8); SB.add(G.box, MAT.iron, tx, 0.02, tz, 0, 0, 0, 0.6, 0.04, 0.6);
    addCol(tx, tz, 1.2, 0.9);
    for (const [dx, dz, ry] of [[-0.75, 0, Math.PI / 2], [0.75, 0, -Math.PI / 2]]) {
      chair(SB, tx + dx, tz + dz, ry);
      addSpot({ kind: 'chair', pos: V3(tx + dx, 0, tz + dz), ry, sitH: 0.48, area: 'lounge', group: 'lt' + tx + '_' + tz });
    }
    // salt/pepper + menu + condiments
    SB.add(G.cyl8, MAT.white, tx - 0.1, 0.83, tz, 0, 0, 0, 0.02, 0.09, 0.02); SB.add(G.cyl8, MAT.iron, tx + 0.1, 0.83, tz, 0, 0, 0, 0.02, 0.09, 0.02);
  }
  // fireplace
  const fx = 12.75, fz = -1.2;
  SB.add(uvBox(new THREE.BoxGeometry(0.5, 1.3, 1.8), .5, 1.3, 1.8, 1), MAT.brickDark, fx, 0.65, fz);
  SB.add(G.box, MAT.darkWood, fx - 0.05, 1.35, fz, 0, 0, 0, 0.62, 0.1, 2.0);
  SB.add(G.box, new THREE.MeshBasicMaterial({ color: 0x050302 }), fx - 0.26, 0.45, fz, 0, 0, 0, 0.02, 0.7, 1.0);
  for (let i = 0; i < 4; i++) SB.add(G.cyl8, MAT.darkWood, fx - 0.3, 0.16, fz - 0.3 + i * 0.2, 0, Math.PI / 2, 0.3, 0.05, 0.6, 0.05);
  const flameMat = new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(3, 1.2, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  dynamic.flames = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Sprite(flameMat.clone()); f.position.set(fx - 0.32, 0.35, fz - 0.35 + i * 0.18); f.scale.set(0.3, 0.5, 1); scene.add(f); dynamic.flames.push(f); }
  addColBox(12.5, 13, fz - 0.9, fz + 0.9);
  dynamic.firePos = V3(fx - 0.4, 0.5, fz);
  // ATM
  const ax = 12.6, az = -3.3;
  SB.add(new RoundedBoxGeometry(0.7, 1.6, 0.6, 2, 0.05), MAT.greyPlastic, ax, 0.8, az);
  const atmT = signTex(['ATM', 'CASH OUT'], { w: 256, h: 256, bg: ['#0a4aa8', '#062a6a'], color: '#fff', sizes: [90, 40] });
  const atmS = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshBasicMaterial({ map: atmT, toneMapped: false })); atmS.position.set(ax - 0.31, 1.25, az); atmS.rotation.y = -Math.PI / 2; scene.add(atmS);
  SB.add(G.box, MAT.blackPlastic, ax - 0.32, 0.95, az, 0, 0, 0, 0.06, 0.08, 0.35);
  addCol(ax, az, 0.75, 0.65);
  addInteract({ id: 'atm', pos: V3(ax - 0.3, 1.2, az), r: 1.8, label: () => 'Use ATM', action: () => Game.openATM() });
  // lounge standing spot + fireside
  addSpot({ kind: 'stand', pos: V3(11.4, 0, -2.6), ry: 2.6, area: 'lounge' });
  // potted palm
  addCylS(SB, MAT.pot, 3.6, 0.3, 1.4, 0.25, 0.6, 12); for (let k = 0; k < 9; k++) SB.add(new THREE.ConeGeometry(0.1, 1.1, 4), MAT.leaf, 3.6 + rand(-.1, .1), 1.1, 1.4 + rand(-.1, .1), rand(0, 6), rand(-.7, .7), rand(-.7, .7)); addCol(3.6, 1.4, 0.5, 0.5);
}

function buildGamingRoom() {
  // signage
  const gs = signTex(['GAMING ROOM'], { w: 1024, h: 200, color: '#ffd84a', glow: '#ff7a00', glowB: 30, font: 'Bungee, sans-serif', size: 110 });
  const g1 = signPlane(gs, 2.4, 0.47, 7.5, 3.15, -3.89, 0, { transparent: true, toneMapped: false, intensity: 2 }); dynamic.neon.push(g1);
  const g2 = signPlane(gs, 2.0, 0.39, 3.11, 2.9, -10, Math.PI / 2, { transparent: true, toneMapped: false, intensity: 2 }); dynamic.neon.push(g2);
  const rg = signTex(['THINK! ABOUT YOUR CHOICES', 'Set a limit. Stick to it.', 'Gambling Help: 24/7 · free · confidential'], { w: 1024, h: 384, bg: '#f4f0e6', color: ['#7a1f14', '#222', '#333'], sizes: [72, 56, 40], border: '#7a1f14', borderW: 10 });
  signPlane(rg, 1.2, 0.45, 11.5, 1.7, -17.82, 0);
  signPlane(rg, 1.0, 0.375, 3.11, 1.6, -15.5, Math.PI / 2);
  const ns = signTex(['NO SMOKING', 'Smokers: use the gaming terrace →'], { w: 1024, h: 256, bg: '#c7352b', color: '#fff', sizes: [100, 46] });
  signPlane(ns, 1.0, 0.25, 12.83, 2.85, -13, -Math.PI / 2);
  // machines: back row facing +z, island bank (both faces)
  const games = ['outback', 'dragon', 'sevens', 'reef'];
  let gi = 0;
  const link = ['moon', 'dynasty', 'panda'];
  for (let i = 0; i < 6; i++) MACHINE_DEFS.push({ game: link[i % 3], pos: V3(4.4 + i * 1.1, 0, -17.45), ry: 0, smoke: false });
  for (let i = 0; i < 3; i++) MACHINE_DEFS.push({ game: games[(gi++) % 4], pos: V3(5.6 + i * 1.1, 0, -11.62), ry: 0, smoke: false });
  for (let i = 0; i < 3; i++) MACHINE_DEFS.push({ game: games[(gi++) % 4], pos: V3(5.6 + i * 1.1, 0, -12.38), ry: Math.PI, smoke: false });
  addColBox(5.0, 8.2, -12.75, -11.25);
  SB.add(G.box, MAT.blackPlastic, 6.7, 1.0, -12, 0, 0, 0, 3.4, 2.0, 0.12);
  // jackpot LED board above island
  const jc = mkCanvas(1024, 256); dynamic.jpBoard = { c: jc, tex: canvasTex(jc, 1, 1) };
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: dynamic.jpBoard.tex, toneMapped: false })); p.material.color.setScalar(1.5); p.position.set(6.7, 3.0, -12 + 0.05 * s); p.rotation.y = s > 0 ? 0 : Math.PI; scene.add(p); dynamic.neon.push(p); }
  SB.add(G.box, MAT.blackPlastic, 6.7, 3.0, -12, 0, 0, 0, 3.3, 0.9, 0.08); addCylS(SB, MAT.chrome, 6.7, 3.7, -12, 0.02, 0.6, 6);
  // cash redemption terminal
  const cx = 12.55, cz = -6.2;
  SB.add(new RoundedBoxGeometry(0.75, 1.75, 0.65, 2, 0.06), MAT.blackPlastic, cx, 0.875, cz);
  const crt = signTex(['CASH', 'REDEMPTION', 'insert ticket'], { w: 256, h: 256, bg: ['#1a1a1a', '#2a6a2a'], color: ['#7dff9a', '#7dff9a', '#ccc'], sizes: [60, 40, 28] });
  const crs = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: crt, toneMapped: false })); crs.position.set(cx - 0.33, 1.3, cz); crs.rotation.y = -Math.PI / 2; scene.add(crs);
  addCol(cx, cz, 0.8, 0.7);
  addInteract({ id: 'crt', pos: V3(cx - 0.3, 1.2, cz), r: 1.8, label: () => Game.state.tickets.length ? `Redeem ${Game.state.tickets.length} ticket(s) — ${fmt$(Game.state.tickets.reduce((a, b) => a + b, 0))}` : 'Cash redemption (no tickets)', action: () => Game.redeem() });
  // stand spot + attendant post
  addSpot({ kind: 'stand', pos: V3(11.5, 0, -9.5), ry: -2.4, area: 'gaming' });
}

function buildTerrace() {
  // louvre roof slats
  for (let i = 0; i < 18; i++) SB.add(G.box, MAT.creamPaint, 16.3, 3.2, -17.7 + i * 0.55, 0, 0.6, 0, 6.6, 0.02, 0.22);
  for (const [x, z] of [[13.3, -8.3], [19.3, -8.3], [19.3, -17.7]]) addCylS(SB, MAT.creamPaint, x, 1.6, z, 0.06, 3.2, 8);
  SB.add(G.box, MAT.creamPaint, 16.3, 3.25, -8.3, 0, 0, 0, 6.6, 0.12, 0.12); SB.add(G.box, MAT.creamPaint, 19.3, 3.25, -13, 0, 0, 0, 0.12, 0.12, 9.6);
  // slatted screens
  for (let y = 0.1; y < 2.4; y += 0.16) { SB.add(G.box, MAT.darkWood, 19.45, y, -13, 0, 0, 0, 0.04, 0.1, 10); SB.add(G.box, MAT.darkWood, 16.3, y, -8.1, 0, 0, 0, 6.6, 0.1, 0.04); }
  // back wall with a gate through to the beer garden
  SB.add(uvBox(new THREE.BoxGeometry(2.6, 3.2, 0.25), 2.6, 3.2, .25, 1.2), MAT.brick, 14.3, 1.6, -18.05);
  SB.add(uvBox(new THREE.BoxGeometry(2.6, 3.2, 0.25), 2.6, 3.2, .25, 1.2), MAT.brick, 18.3, 1.6, -18.05);
  SB.add(uvBox(new THREE.BoxGeometry(1.4, 0.9, 0.25), 1.4, 0.9, .25, 1.2), MAT.brick, 16.3, 2.75, -18.05);
  // festoon lights strung across the terrace
  for (const zz of [-16.5, -13.5, -10.5]) {
    const a = V3(13.3, 3.0, zz), b = V3(19.3, 3.0, zz + 0.6), pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * 0.35, 0))); }
    SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.006, 4), MAT.iron);
    for (let k = 1; k < 10; k++) SB.add(G.sph, MAT.bulb, pts[k].x, pts[k].y - 0.05, pts[k].z, 0, 0, 0, 0.035, 0.045, 0.035);
  }
  // signage
  const ss = signTex(['GAMING TERRACE', 'Smoking permitted in this area'], { w: 1024, h: 256, bg: ['#1a3a1a', '#0e220e'], color: ['#e8c56a', '#ddd'], sizes: [96, 44], border: '#e8c56a', borderW: 6 });
  signPlane(ss, 1.6, 0.4, 16.3, 2.5, -17.9, 0);
  // machines along slatted wall facing -x
  for (let i = 0; i < 4; i++) MACHINE_DEFS.push({ game: ['dragon', 'outback', 'reef', 'sevens'][i], pos: V3(19.0, 0, -16.9 + i * 1.1), ry: -Math.PI / 2, smoke: true });
  // mushroom heater
  const hx = 15.6, hz = -10.5;
  addCylS(SB, MAT.chrome, hx, 1.1, hz, 0.05, 2.2, 8); addCylS(SB, MAT.chrome, hx, 0.15, hz, 0.25, 0.3, 16);
  SB.add(new THREE.ConeGeometry(0.55, 0.25, 20, 1, true), MAT.chrome, hx, 2.35, hz);
  SB.add(G.cyl, MAT.ember, hx, 2.15, hz, 0, 0, 0, 0.12, 0.25, 0.12);
  addCol(hx, hz, 0.5, 0.5);
  // bench + milk crate + ashtray stands + bin
  SB.add(G.box, MAT.darkWood, 16.3, 0.45, -8.55, 0, 0, 0, 3.5, 0.06, 0.4); for (const dx of [-1.5, 1.5]) SB.add(G.box, MAT.iron, 16.3 + dx, 0.22, -8.55, 0, 0, 0, 0.06, 0.45, 0.4);
  addColBox(14.5, 18.1, -8.8, -8.3);
  addSpot({ kind: 'chair', pos: V3(15.6, 0, -8.6), ry: Math.PI, sitH: 0.48, area: 'terrace', smoke: true, group: 'tb' });
  addSpot({ kind: 'chair', pos: V3(17.0, 0, -8.6), ry: Math.PI, sitH: 0.48, area: 'terrace', smoke: true, group: 'tb' });
  SB.add(G.box, M({ color: 0x1a4aa8, roughness: 0.6 }), 14.2, 0.17, -17.4, 0.3, 0, 0, 0.36, 0.34, 0.36);
  for (const [ax, az] of [[14.0, -10.2], [17.6, -10.9]]) { addCylS(SB, MAT.chrome, ax, 0.5, az, 0.03, 1.0, 8); addCylS(SB, MAT.chrome, ax, 1.0, az, 0.16, 0.06, 16); }
  addSpot({ kind: 'stand', pos: V3(14.3, 0, -11.0), ry: 0.6, area: 'terrace', smoke: true });
  addSpot({ kind: 'stand', pos: V3(17.2, 0, -11.6), ry: -2.4, area: 'terrace', smoke: true });
  // out-front smoker spot (classic)
  addSpot({ kind: 'stand', pos: V3(-3.0, 0, 3.7), ry: 2.6, area: 'street', smoke: true });
  addSpot({ kind: 'stand', pos: V3(3.8, 0, 4.4), ry: -2.2, area: 'street', smoke: true });
}

// ---- TVs with animated content ----
function makeTV(x, y, z, ry, kind) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = ry; scene.add(group);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.76, 0.06), MAT.blackPlastic); group.add(body);
  const c = mkCanvas(320, 180), tex = canvasTex(c, 1, 1);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.7), new THREE.MeshBasicMaterial({ map: tex })); scr.material.color.setScalar(1.3); scr.position.z = 0.031; group.add(scr);
  const tv = { group, c, tex, kind, t: Math.random() * 100 };
  dynamic.tvs.push(tv); return tv;
}
function drawTV(tv, dt) {
  tv.t += dt; const x = tv.c.getContext('2d'), W = 320, H = 180, t = tv.t;
  if (tv.kind === 'racing' && Racing.races.length) { Racing.drawTV(x, W, H, t); }
  else if (tv.kind === 'racing') {
    const race = t % 40, prog = clamp(race / 32, 0, 1);
    x.fillStyle = '#4a8a3a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#7fb8e8'; x.fillRect(0, 0, W, 40);
    x.fillStyle = '#c8a878'; x.fillRect(0, 70, W, 90);
    x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect(((i * 40 - t * 120 * (prog < 1 ? 1 : 0)) % 480 + 480) % 480 - 80, 66, 3, 8);
    for (let h = 0; h < 8; h++) {
      const off = Math.sin(h * 7.3 + t * 0.3) * 18 + h * 4 * prog;
      const hx = 60 + off + (h === 3 ? prog * 40 : 0), hy = 82 + h * 9;
      x.fillStyle = ['#d22', '#22d', '#dd2', '#fff', '#2a2', '#f80', '#a2a', '#222'][h];
      x.fillRect(hx, hy - 4, 10, 4);
      x.fillStyle = '#3a2210'; x.fillRect(hx - 8, hy, 22, 7); const leg = Math.sin(t * 20 + h) * 3; x.fillRect(hx - 6 + leg, hy + 7, 2, 6); x.fillRect(hx + 10 - leg, hy + 7, 2, 6);
    }
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, H - 26, W, 26); x.fillStyle = '#fff'; x.font = 'bold 14px Inter, sans-serif';
    x.fillText(race > 32 ? 'RESULT: 4 - 7 - 1 - 2' : `R${(Math.floor(t / 40) % 8) + 1} FLEMINGTON 1200m   ${Math.floor(prog * 1200)}m`, 8, H - 9);
    x.fillStyle = '#1a7a3a'; x.fillRect(W - 60, 6, 54, 20); x.fillStyle = '#fff'; x.fillText('LIVE', W - 48, 21);
  } else {
    x.fillStyle = '#2f7a2a'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#2a722a' : '#338533'; x.fillRect(0, i * 24 + ((t * 10) % 24) - 24, W, 24); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(160 + Math.sin(t * .2) * 60, 90, 100, 60, 0, 0, 7); x.stroke();
    for (let p = 0; p < 14; p++) { const px = 160 + Math.sin(t * 0.7 + p * 2.1) * 120, py = 90 + Math.cos(t * 0.5 + p * 1.3) * 60; x.fillStyle = p < 7 ? '#fff' : '#111'; x.fillRect(px, py, 5, 8); x.fillStyle = p < 7 ? '#1a3a8a' : '#c7352b'; x.fillRect(px, py + 8, 5, 4); }
    const bx = 160 + Math.sin(t * 1.3) * 110, by = 90 + Math.sin(t * 0.9) * 55; x.fillStyle = '#c8461a'; x.beginPath(); x.ellipse(bx, by, 4, 2.6, t, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(6, 6, 170, 22); x.fillStyle = '#fff'; x.font = 'bold 13px Inter, sans-serif';
    const q = Math.floor((t / 60) % 4) + 1, ha = 30 + Math.floor(t / 9) % 60, aw = 24 + Math.floor(t / 11) % 60;
    x.fillText(`MAGPIES ${Math.floor(ha / 6)}.${ha % 6} (${ha + Math.floor(ha / 6) * 0})  Q${q}`, 12, 21);
    x.fillText(`SWANS ${Math.floor(aw / 6)}.${aw % 6}`, 12, 44);
  }
  tv.tex.needsUpdate = true;
}

// =====================================================================
//  SKY, SUN, STARS, RAIN  + time of day
// =====================================================================
function buildSky() {
  skyObj = new Sky(); skyObj.scale.setScalar(900); scene.add(skyObj);
  const u = skyObj.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82;
  sun = new THREE.DirectionalLight(0xffe2c0, 2.5);
  sun.castShadow = true; sun.shadow.mapSize.setScalar(settings.preset === 'ultra' ? 4096 : HIGH() ? 2048 : 1024);
  const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 0, 4);
  hemi = new THREE.HemisphereLight(0xa8c0e0, 0x2a2018, 0.4); scene.add(hemi);
  // stars
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.02) v.y = Math.abs(v.y) + 0.02; v.multiplyScalar(420); sp.push(v.x, v.y, v.z); }
  // southern cross, roughly
  for (const [a, e] of [[2.2, .55], [2.32, .62], [2.26, .48], [2.15, .58], [2.28, .56]]) { const v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(420); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  moon = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), fog: false, transparent: true, opacity: 0 }));
  moon.position.set(-170, 200, 320); moon.scale.setScalar(0.3); moon.lookAt(0, 0, 0); scene.add(moon);
  // rain streaks
  const rc = 5000, rg = new THREE.BufferGeometry(), rp = new Float32Array(rc * 6);
  for (let i = 0; i < rc; i++) { const x = rand(-30, 30), y = rand(0, 20), z = rand(-10, 30); rp.set([x, y, z, x + 0.02, y - 0.5, z], i * 6); }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainSys = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9aa8b8, transparent: true, opacity: 0.35 }));
  rainSys.visible = false; rainSys.frustumCulled = false; scene.add(rainSys);
}
let skyEnvRT = null, lastEnvHour = -99;
const lastShadowSun = new THREE.Vector3();
function setTimeOfDay(h, weather) {
  // Autumn in Oz: sunset ~17:50. elevation in degrees
  const dayLen = 11.2, rise = 6.6;
  const tday = (h - rise) / dayLen;
  const elev = tday >= -0.15 && tday <= 1.15 ? Math.sin(tday * Math.PI) * 46 : -30;
  const az = lerp(-80, 85, clamp(tday, 0, 1)) * Math.PI / 180;
  const phi = THREE.MathUtils.degToRad(90 - elev), theta = Math.PI / 2 + az * 0.6 + 1.2;
  const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyObj.material.uniforms.sunPosition.value.copy(sunPos);
  const rainy = weather === 'rain', cloudy = weather === 'cloudy' || rainy;
  skyObj.material.uniforms.turbidity.value = rainy ? 18 : cloudy ? 12 : 6;
  skyObj.material.uniforms.rayleigh.value = elev < 8 ? 3.2 : 2.0;
  const dayF = clamp((elev + 4) / 18, 0, 1), duskF = clamp(1 - Math.abs(elev - 2) / 10, 0, 1);
  const nightF = 1 - clamp((elev + 8) / 10, 0, 1);
  // sun / moon light
  if (elev > -2) {
    sun.position.copy(sunPos).multiplyScalar(80).add(sun.target.position);
    sun.color.setHSL(0.08 + 0.05 * dayF, 0.8 - 0.4 * dayF, 0.6 + 0.2 * dayF);
    sun.intensity = 3.2 * dayF * (cloudy ? 0.45 : 1) + 0.3 * duskF;
  } else {
    sun.position.set(-40, 70, 60).add(sun.target.position);
    sun.color.set(0x8aa0d8); sun.intensity = 0.35 * nightF * (cloudy ? 0.4 : 1);
  }
  hemi.intensity = 0.08 + 0.55 * dayF * (cloudy ? 0.8 : 1);
  hemi.color.setHSL(0.6, 0.4, 0.25 + 0.45 * dayF);
  hemi.groundColor.setHSL(0.08, 0.3, 0.06 + 0.15 * dayF);
  const fogC = new THREE.Color().setHSL(0.6 - duskF * 0.53, 0.3 + duskF * 0.25, 0.05 + 0.42 * dayF * (cloudy ? 0.75 : 1));
  if (nightF > 0.5) fogC.setHSL(0.62, 0.3, 0.035);
  scene.fog.color.copy(fogC); scene.fog.density = rainy ? 0.03 : lerp(0.016, 0.0045, dayF) + nightF * 0.004;
  stars.material.opacity = nightF * (cloudy ? 0.15 : 0.9);
  moon.material.opacity = nightF * (rainy ? 0.1 : 0.9);
  window.__dayF = dayF;
  const streetOn = elev < 6 ? 1 : 0;
  dynamic.streetBulbs.forEach(l => l.intensity = streetOn * 55);
  atmo.night = streetOn; atmo.nightF = nightF;
  window.__fogOut = { c: fogC.clone(), d: scene.fog.density };
  // re-render shadow maps only when the sun has visibly moved
  dynamic.winLit.forEach(l => l.intensity = streetOn * 3);
  MAT.sodium.color.setRGB(streetOn ? 5 : 0.4, streetOn ? 2.6 : 0.35, streetOn ? 0.9 : 0.3);
  AudioSys.amp.outdoorNight = nightF;
  rainSys.visible = rainy;
  AudioSys.amp.rain = rainy ? 1 : 0;
  MAT.asphalt.roughness = rainy ? 0.18 : 0.82; MAT.asphalt.color.setScalar(rainy ? 0.45 : 0.73);
  MAT.concrete.roughness = rainy ? 0.35 : 0.92;
  _v1.copy(sun.position).sub(sun.target.position).normalize();
  if (_v1.angleTo(lastShadowSun) > 0.012 || lastShadowSun.lengthSq() === 0) { lastShadowSun.copy(_v1); if (typeof shadowDirty !== 'undefined') shadowDirty = 1; }
  // refresh the sky reflection rarely, and only while indoors so the change is never seen popping
  const camIn = isInside(camera.position.x, camera.position.z);
  if (lastEnvHour < -50 || (Math.abs(h - lastEnvHour) > 1.0 && camIn)) {
    lastEnvHour = h;
    const envScene = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(100); s2.material.uniforms.sunPosition.value.copy(sunPos);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = skyObj.material.uniforms[k].value;
    envScene.add(s2);
    if (skyEnvRT) skyEnvRT.dispose();
    skyEnvRT = pmrem.fromScene(envScene, 0, 0.1, 200);
    scene.environment = skyEnvRT.texture;
    scene.environmentIntensity = 0.5;
    s2.material.dispose(); s2.geometry.dispose();
  }
  return { elev, dayF, nightF };
}
function updateRain(dt, camPos) {
  if (!rainSys.visible) return;
  const p = rainSys.geometry.attributes.position, a = p.array;
  for (let i = 0; i < a.length; i += 6) {
    a[i + 1] -= 18 * dt; a[i + 4] -= 18 * dt;
    if (a[i + 4] < 0 || isInside(a[i], a[i + 2]) && a[i + 1] < PUB.ceil + 4.6 || (a[i + 2] > 1.8 && a[i + 2] < 9.6 && Math.abs(a[i]) < 13.2 && a[i + 1] < 7.9)) {
      const x = camPos.x + rand(-25, 25), z = camPos.z + rand(-20, 25), y = rand(10, 20);
      a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = x + 0.02; a[i + 4] = y - 0.5; a[i + 5] = z;
    }
  }
  p.needsUpdate = true;
}

// interior env-map capture (real reflections of the room on varnish, glass & cabinets)
function captureInteriorEnv() {
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.1, 100, cubeRT); cc.position.set(0, 1.8, -8); scene.add(cc);
  const wasMirror = backMirror.visible; backMirror.visible = false;
  cc.update(renderer, scene);
  backMirror.visible = wasMirror;
  const env = pmrem.fromCubemap(cubeRT.texture).texture;
  for (const m of interiorMats) { m.envMap = env; m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.6; m.needsUpdate = true; }
  cubeRT.dispose(); scene.remove(cc);
  return env;
}

// =====================================================================
//  ATMOSPHERE: shadowed spots, light shafts, dust, neon, spill, moths
// =====================================================================
const atmo = { pendants: [], streetHeads: [], verandahLamps: [], streetCones: [], cones: [], dust: null, moths: null, spill: [], flicker: null, neonFlicker: null, night: 1, nightF: 1, halosOut: [] };
const spots = [];
function spotShadow(col, inten, x, y, z, angle) {
  const l = new THREE.SpotLight(col, inten, 15, angle, 0.85, 2);
  l.position.set(x, y, z); l.target.position.set(x, 0, z); scene.add(l); scene.add(l.target);
  l.castShadow = true; l.shadow.mapSize.set(HIGH() ? 1024 : 512, HIGH() ? 1024 : 512); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.02; l.shadow.radius = 4;
  spots.push(l); return l;
}
function coneMaterial(col, str) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col) }, uStr: { value: str } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uStr; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.8); float fall = pow(vUv.y, 1.6); float near = smoothstep(0.35, 1.8, vD);
        gl_FragColor = vec4(uCol * edge * fall * near * uStr, 1.0); }`
  });
}
function lightCone(x, yTop, z, rTop, rBot, col, str, seg = 24, sx = 1, sz = 1, ry = 0) {
  const h = yTop, m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true), coneMaterial(col, str));
  m.position.set(x, yTop / 2, z); m.scale.set(sx, 1, sz); m.rotation.y = ry; m.renderOrder = 6; scene.add(m); atmo.cones.push(m); return m;
}
function haloSprite(p, scale, col, str = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(col).multiplyScalar(str), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.position.copy(p); s.scale.setScalar(scale); s.renderOrder = 7; scene.add(s); return s;
}
function neonSign(lines, x, y, z, ry, w, h, col, glow, font = 'Bungee, Impact, sans-serif', sizes) {
  const t = signTex(lines, { w: 1024, h: Math.round(1024 * h / w), color: col, glow, glowB: 36, font, sizes, stroke: 'rgba(255,255,255,.55)', strokeW: 2 });
  const p = signPlane(t, w, h, x, y, z, ry, { transparent: true, toneMapped: false, intensity: 2.1 });
  // dark backing board + soft wall wash
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 2.2), new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(glow).multiplyScalar(0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  wash.position.copy(p.position).add(new THREE.Vector3(0, 0, -0.005).applyAxisAngle(V3(0, 1, 0), ry)); wash.rotation.y = ry; scene.add(wash);
  dynamic.neon.push(p); return p;
}
function poster(lines, colors, bg, x, y, z, ry, accent) {
  const c = mkCanvas(320, 440), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 320, 440);
  if (accent === 'sun') { g.save(); g.translate(160, 300); for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.fillStyle = i % 2 ? '#f6b23a' : '#e8772a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(400, -40); g.lineTo(400, 40); g.closePath(); g.fill(); } g.restore(); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(160, 300, 70, 0, 7); g.fill(); }
  if (accent === 'checks') { for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(j * 54, 220 + i * 28, 54, 28); } }
  if (accent === 'stripes') { for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'; g.fillRect(0, i * 50, 320, 25); } }
  g.textAlign = 'center';
  lines.forEach((l, i) => { g.font = `${i === 0 ? 64 : 30}px 'Bebas Neue', Impact, sans-serif`; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; const yy = 90 + i * (i === 0 ? 0 : 52) + (i > 0 ? 40 : 0); g.strokeText(l, 160, yy); g.fillStyle = colors[i % colors.length]; g.fillText(l, 160, yy); });
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,240,210'},${Math.random() * 0.07})`; g.fillRect(Math.random() * 320, Math.random() * 440, 2, 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const n = V3(Math.sin(ry), 0, Math.cos(ry));
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), M({ map: tex, roughness: 0.35 })); pm.position.set(x + n.x * 0.025, y, z + n.z * 0.025); pm.rotation.y = ry; scene.add(pm);
  SB.add(G.box, MAT.darkWood, x, y, z, ry, 0, 0, 0.7, 0.93, 0.03);
}
function pennants(a, b, sag) {
  const cols = [0x111111, 0xf2f2ee, 0x1a3a8a, 0xc7352b, 0xe8c52a, 0x6a1a2a].map(c => M({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
  const pts = [], n = Math.round(a.distanceTo(b) / 0.32);
  for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0))); }
  SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.004, 4), MAT.iron);
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.24, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, .5, 0], 2)); tri.computeVertexNormals();
  const ry = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
  for (let i = 1; i < n; i++) { const t = i / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0)); SB.add(tri, cols[i % cols.length], p.x, p.y, p.z, ry, rand(-0.08, 0.08)); }
}
function spillTex() {
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const side = g.createLinearGradient(0, 0, 128, 0); side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.18, 'rgba(0,0,0,0)'); side.addColorStop(0.82, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = side; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// fake ambient occlusion: soft dark gradients where walls meet floor and ceiling
function aoStrip(x1, z1, x2, z2, nx, nz, h = 0.5, ceiling = false) {
  const len = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2 + nx * 0.012, cz = (z1 + z2) / 2 + nz * 0.012;
  const ry = Math.atan2(nx, nz);
  if (!ceiling) SB.add(G.plane, MAT.ao, cx, h / 2 + 0.002, cz, ry, 0, 0, len, h, 1);
  else SB.add(G.plane, MAT.ao, cx, PUB.ceil - h / 2 - 0.002, cz, ry, 0, Math.PI, len, h, 1);
}
function buildAO() {
  const segs = [ // [x1,z1,x2,z2, normal x, normal z]
    [-12.84, -17.8, -12.84, 1.8, 1, 0], [12.84, -17.8, 12.84, 1.8, -1, 0], [-12.9, -17.84, 12.9, -17.84, 0, 1],
    [-12.9, 1.84, -10.5, 1.84, 0, -1], [-4.5, 1.84, -1.3, 1.84, 0, -1], [1.3, 1.84, 4.5, 1.84, 0, -1], [10.5, 1.84, 12.9, 1.84, 0, -1],
    [2.9, -17.8, 2.9, -11, -1, 0], [2.9, -9, 2.9, -4.1, -1, 0], [3.1, -17.8, 3.1, -11, 1, 0], [3.1, -9, 3.1, -4.1, 1, 0],
    [3.1, -4.1, 6.5, -4.1, 0, -1], [8.5, -4.1, 12.9, -4.1, 0, -1], [3.1, -3.9, 6.5, -3.9, 0, 1], [8.5, -3.9, 12.9, -3.9, 0, 1],
  ];
  for (const [x1, z1, x2, z2, nx, nz] of segs) { aoStrip(x1, z1, x2, z2, nx, nz, 0.5); aoStrip(x1, z1, x2, z2, nx, nz, 0.4, true); }
  aoStrip(BAR.front, BAR.z0, BAR.front, BAR.z1, 1, 0, 0.35); // foot of the bar
}
function buildAtmosphere() {
  buildAO();
  // light shafts under pendants, pool lamp, gaming rows
  for (const p of atmo.pendants) lightCone(p.x, p.y, p.z, 0.13, 1.05, 0xffc890, 0.055);
  lightCone(-3, 2.35, -13.2, 0.42, 1.0, 0xfff0d0, 0.05, 4, 0.75, 1.9, Math.PI / 4);
  lightCone(7.1, 3.9, -16.2, 0.5, 1.6, 0xc890ff, 0.035, 24, 2.2, 0.8);
  lightCone(6.7, 3.9, -12, 0.4, 1.4, 0xff90c8, 0.03, 24, 1.8, 0.9);
  for (const p of atmo.pendants) haloSprite(p.clone().add(V3(0, -0.03, 0)), 0.5, 0xffc890, 0.6);
  // streetlights: sodium shafts + halos + moths
  for (const h of atmo.streetHeads) { atmo.streetCones.push(lightCone(h.x, h.y - 0.1, h.z, 0.22, 3.4, 0xff9a3c, 0.04, 20)); atmo.halosOut.push(haloSprite(h.clone().add(V3(0, -0.1, 0)), 2.2, 0xffa050, 1)); }
  for (const h of atmo.verandahLamps) atmo.halosOut.push(haloSprite(h, 1.1, 0xffc27a, 0.9));
  // dust motes floating in the warm air
  const dn = 700, dg = new THREE.BufferGeometry(), dp = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dp[i * 3] = rand(-12.5, 12.5); dp[i * 3 + 1] = rand(0.4, 3.8); dp[i * 3 + 2] = rand(-17.5, 1.5); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  atmo.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.011, map: TEX.dot, color: 0xffd6a0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  atmo.dust.frustumCulled = false; atmo.dustBase = dp.slice(); scene.add(atmo.dust);
  const mn = 40, mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mn * 3), 3));
  atmo.moths = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.035, map: TEX.dot, color: 0xffe0b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmo.moths.frustumCulled = false; atmo.mothSeed = Array.from({ length: mn }, () => [Math.random() * 10, rand(0.3, 0.9), rand(1.5, 3.5), Math.floor(Math.random() * 6)]); scene.add(atmo.moths);
  // warm window light pooling on the footpath
  const st = spillTex();
  for (const [cx, w] of [[-7.5, 6.6], [0, 3.0], [7.5, 6.6]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.0, 0.62, 0.3), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.014, 3.7); scene.add(m); atmo.spill.push(m);
  }
  // dead shop with a flickering fluoro tube
  const fl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.0) }));
  fl.position.set(-33.5, 2.55, 2.12); scene.add(fl); atmo.flicker = fl;
  atmo.flickerGlow = haloSprite(V3(-33.5, 2.4, 2.3), 2.0, 0xa8d8ff, 0.5);
  // neon on the walls
  neonSign(['COLD BEER'], -9.0, 1.72, 1.83, 0, 1.5, 0.4, '#ff5a6a', '#ff1030');
  neonSign(['SOUTHERLY', 'BITTER'], -8.7, 2.95, -17.83, 0, 1.2, 0.5, ['#7dff9a', '#ffffff'], '#18ff60', 'Bungee, Impact', [150, 110]);
  neonSign(['BISTRO'], 11.1, 3.0, -3.88, 0, 1.2, 0.35, '#ffcf5a', '#ff9a10', 'Rye, serif');
  neonSign(['TAB'], 2.87, 3.05, -11.3, -Math.PI / 2, 0.75, 0.38, '#5aff8a', '#10c040');
  atmo.neonFlicker = neonSign(['JACKPOTS'], 5.2, 3.3, -17.82, 0, 1.4, 0.34, '#ff7ad8', '#ff10a0');
  // posters + pennants
  poster(['GOLDEN', 'LAGER', 'brewed under the southern sun'], ['#7a1f14', '#7a1f14', '#2a1d10'], '#f3d27a', -9.2, 2.0, -17.84, 0, 'sun');
  poster(['MEAT', 'RAFFLE', 'EVERY SATURDAY · 5PM', '3 TICKETS $5'], ['#fff', '#fff', '#ffe27a', '#fff'], '#9b2216', 12.84, 2.25, 0.9, -Math.PI / 2, 'checks');
  poster(['TRIVIA', 'WEDNESDAYS', '8:30PM · $50 BAR TAB'], ['#ffe27a', '#fff', '#fff'], '#1a3a6a', 4.7, 2.25, -3.88, 0, 'stripes');
  poster(['PARMA', '& POT', 'TUESDAYS · $15'], ['#fff6d8', '#fff6d8', '#ffe27a'], '#3a5a1a', 9.4, 2.25, -3.88, 0, 'stripes');
  poster(['LARRIKIN', 'PALE ALE', 'a beer with a grin'], ['#2a1d10', '#b5541b', '#2a1d10'], '#efe2c4', 3.12, 2.15, -6.6, Math.PI / 2, 'sun');
  pennants(V3(-12.8, 3.85, -9.5), V3(2.8, 3.85, -9.5), 0.45);
  pennants(V3(-8.2, 3.8, -14.3), V3(-8.2, 3.8, -2.7), 0.35);
}
function updateAtmosphere(dt, t, camPos, inside) {
  // dust drifts slowly, only simulated when you can see it
  if (inside && atmo.dust && settings.shafts) {
    const a = atmo.dust.geometry.attributes.position, b = atmo.dustBase;
    for (let i = 0; i < a.count; i++) { const k = i * 3; a.array[k] = b[k] + Math.sin(t * 0.13 + i) * 0.25; a.array[k + 1] = b[k + 1] + Math.sin(t * 0.09 + i * 1.7) * 0.18; a.array[k + 2] = b[k + 2] + Math.cos(t * 0.11 + i * 0.6) * 0.25; }
    a.needsUpdate = true;
  }
  if (atmo.dust) atmo.dust.visible = inside && settings.shafts;
  for (const c of atmo.cones) if (!atmo.streetCones.includes(c)) c.visible = settings.shafts;
  const night = atmo.night;
  if (atmo.moths) {
    atmo.moths.visible = night > 0.5 && !inside;
    if (atmo.moths.visible) {
      const lamps = atmo.streetHeads.concat(atmo.verandahLamps), a = atmo.moths.geometry.attributes.position;
      atmo.mothSeed.forEach((m, i) => { const c = lamps[m[3] % lamps.length], tt = t * m[2] + m[0]; a.setXYZ(i, c.x + Math.cos(tt) * m[1] + Math.sin(tt * 3.7) * 0.08, c.y - 0.2 + Math.sin(tt * 1.3) * m[1] * 0.6, c.z + Math.sin(tt) * m[1]); });
      a.needsUpdate = true;
    }
  }
  for (const c of atmo.streetCones) c.visible = night > 0.5 && settings.shafts;
  for (const h of atmo.halosOut) h.visible = night > 0.5;
  for (const sp of atmo.spill) sp.material.opacity = 0.08 + 0.3 * atmo.nightF;
  if (atmo.flickerGlow) atmo.flickerGlow.visible = night > 0.5;
}

// =====================================================================
//  BAR CLUTTER: glasses, mats, towels, tips, snacks, wine rack, bell
// =====================================================================
function buildBarClutter() {
  const F = BAR.front;
  const glassL = new THREE.LatheGeometry([V3(0, 0), V3(0.032, 0), V3(0.032, 0.006), V3(0.041, 0.15), V3(0.039, 0.15)], 14);
  const potL = new THREE.LatheGeometry([V3(0, 0), V3(0.029, 0), V3(0.029, 0.006), V3(0.037, 0.118), V3(0.035, 0.118)], 14);
  const wineL = new THREE.LatheGeometry([V3(0, 0), V3(0.034, 0), V3(0.034, 0.004), V3(0.004, 0.008), V3(0.004, 0.085), V3(0.022, 0.097), V3(0.038, 0.128), V3(0.035, 0.168), V3(0.033, 0.172)], 14);
  const decoGlass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  interiorMats.push(decoGlass);
  const beer = M({ color: 0xc8780e, roughness: 0.2, transparent: true, opacity: 0.88, emissive: 0x3a1a00 });
  const foam = M({ color: 0xf2e8d2, roughness: 0.9 });
  const matCols = [0x9b2216, 0x1a3a8a, 0x1f6b2a, 0xe8c52a, 0x222222].map(c => M({ color: c, roughness: 0.95 }));
  const glassAt = (x, y, z, fill, pot = false, mat = true) => {
    const G2 = pot ? potL : glassL, h = pot ? 0.118 : 0.15, rb = pot ? 0.029 : 0.032, rt = pot ? 0.037 : 0.041;
    if (mat) SB.add(G.cyl, choice(matCols), x, y + 0.0015, z, 0, 0, 0, 0.048, 0.003, 0.048);
    SB.add(G2, decoGlass, x, y + 0.003, z);
    if (fill > 0.05) { const fh = h * fill * 0.95, r = lerp(rb, rt, fill * 0.5) * 0.92; SB.add(G.cyl, beer, x, y + 0.009 + fh / 2, z, 0, 0, 0, r, fh, r); SB.add(G.cyl, foam, x, y + 0.009 + fh + 0.006, z, 0, 0, 0, lerp(rb, rt, fill) * 0.93, 0.012, lerp(rb, rt, fill) * 0.93); }
    else SB.add(G.cyl, foam, x, y + 0.012, z, 0, 0, 0, rb * 0.9, 0.004, rb * 0.9);
  };
  // half-finished drinks along the customer side of the bar
  [-13.6, -12.55, -10.45, -9.4, -7.3, -5.2, -4.15].forEach(z => glassAt(F - 0.13 + rand(-0.03, 0.03), 1.119, z + rand(-0.15, 0.15), choice([0, 0.2, 0.45, 0.7]), Math.random() < 0.4));
  // inverted glasses drying on a rubber mat by the till
  SB.add(G.box, MAT.rubber, F - 0.45, 1.114, -3.8, 0, 0, 0, 0.3, 0.008, 0.62);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) SB.add(glassL, decoGlass, F - 0.55 + r * 0.09, 1.268, -4.05 + k * 0.095, 0, Math.PI, 0);
  // tip jar with coins, lemon & lime tray, form guide, bar towel
  const tip = new THREE.LatheGeometry([V3(0, 0), V3(0.06, 0), V3(0.06, 0.16), V3(0.055, 0.17)], 16);
  SB.add(tip, decoGlass, F - 0.22, 1.112, -9.55);
  for (let i = 0; i < 18; i++) SB.add(G.cyl8, i % 3 ? MAT.brass : MAT.chrome, F - 0.22 + rand(-0.04, 0.04), 1.118 + i * 0.0035, -9.55 + rand(-0.04, 0.04), rand(0, 3), rand(-0.3, 0.3), 0, 0.012, 0.002, 0.012);
  const tipSign = signTex(['TIPS'], { w: 128, h: 64, bg: '#f4ead6', color: '#7a1f14', size: 44 });
  signPlane(tipSign, 0.07, 0.035, F - 0.159, 1.2, -9.55, Math.PI / 2);
  SB.add(G.box, MAT.blackPlastic, F - 0.45, 1.135, -8.4, 0, 0, 0, 0.12, 0.04, 0.3);
  for (let i = 0; i < 8; i++) SB.add(G.cyl, M({ color: i % 2 ? 0xe8d83a : 0x6ab83a, roughness: 0.6 }), F - 0.45 + rand(-0.03, 0.03), 1.16, -8.5 + i * 0.03, 0, Math.PI / 2, rand(-0.5, 0.5), 0.018, 0.006, 0.018);
  const fg = mkCanvas(256, 360), fx = fg.getContext('2d'); fx.fillStyle = '#ede6d4'; fx.fillRect(0, 0, 256, 360); fx.fillStyle = '#1a1a1a'; fx.font = 'bold 34px "Bebas Neue", Impact'; fx.fillText('FORM GUIDE', 18, 44); fx.font = '13px Georgia, serif';
  for (let i = 0; i < 18; i++) { fx.fillStyle = '#333'; fx.fillText(`${i + 1}. ${choice(['Southern Belle', 'Larrikin Lad', 'Red Dust', 'Bush Telegraph', 'Mate\'s Rates', 'Last Drinks', 'Blue Heeler', 'Stubby Holder'])}  ${randi(2, 30)}/1`, 18, 72 + i * 16); }
  const fgm = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fg), roughness: 0.9 })); fgm.material.map.colorSpace = THREE.SRGBColorSpace;
  fgm.rotation.set(-Math.PI / 2, 0, 0.25); fgm.position.set(F - 0.2, 1.121, -11.0); scene.add(fgm);
  SB.add(G.box, M({ color: 0xe8e2d0, roughness: 1 }), F + 0.02, 1.0, -12.05, 0, 0, 0, 0.05, 0.22, 0.3);
  SB.add(G.box, M({ color: 0x9b2216, roughness: 1 }), F + 0.025, 0.93, -12.05, 0, 0, 0, 0.05, 0.03, 0.3);
  // overhead rack of hanging wine glasses above the counter
  SB.add(G.box, MAT.darkWood, -9.25, 2.6, -7.5, 0, 0, 0, 0.42, 0.07, 5.6);
  for (const dz of [-10.25, -4.75]) SB.add(G.box, MAT.brass, -9.25, 3.3, dz, 0, 0, 0, 0.02, 1.36, 0.02);
  for (const rx of [-9.37, -9.13]) for (let z = -10.1; z < -4.9; z += 0.17) SB.add(wineL, decoGlass, rx, 2.565, z + (rx > -9.2 ? 0.085 : 0), 0, Math.PI, 0);
  // brass last-drinks bell at the end of the bar
  SB.add(G.box, MAT.brass, -8.55, 2.32, -2.6, 0, 0, 0, 0.3, 0.025, 0.025);
  SB.add(new THREE.LatheGeometry([V3(0, 0), V3(0.085, 0), V3(0.075, 0.03), V3(0.05, 0.11), V3(0.02, 0.135), V3(0, 0.14)], 18), MAT.brass, -8.42, 2.12, -2.6);
  SB.add(G.cyl8, M({ color: 0xc8b08a, roughness: 1 }), -8.42, 1.92, -2.6, 0, 0, 0, 0.006, 0.3, 0.006);
  // RSA notice + snack clip strip on the back bar
  signPlane(signTex(['WE PRACTISE THE RESPONSIBLE', 'SERVICE OF ALCOHOL', 'Intoxicated persons will not be served · No ID, no service'], { w: 768, h: 256, bg: '#f4f0e6', color: ['#111', '#111', '#555'], sizes: [46, 46, 26], border: '#1f4d34', borderW: 8 }), 0.6, 0.2, -12.82, 1.22, -10.0, Math.PI / 2);
  SB.add(G.box, MAT.chrome, -12.86, 1.85, -11.3, 0, 0, 0, 0.01, 0.7, 0.03);
  [0xd02020, 0x2050d0, 0xe0c020, 0x20a040, 0xe07020].forEach((c, i) => SB.add(new RoundedBoxGeometry(0.03, 0.17, 0.12, 2, 0.012), M({ color: c, roughness: 0.25, metalness: 0.4 }), -12.83, 2.12 - i * 0.12, -11.3 + (i % 2 ? 0.02 : -0.02), 0, 0, (i % 2 ? 0.08 : -0.08)));
  // high tables: drinks, mats, peanuts
  for (const tz of [-10.5, -6.5, -2.5]) {
    glassAt(-5.4 + rand(-0.15, 0.15), 1.077, tz + 0.12, choice([0.25, 0.6, 0.85]));
    if (Math.random() < 0.7) glassAt(-5.4 + rand(-0.15, 0.15), 1.077, tz - 0.14, choice([0, 0.4]), true);
    SB.add(G.cyl, MAT.darkWood, -5.25, 1.095, tz, 0, 0, 0, 0.06, 0.035, 0.06);
    for (let i = 0; i < 10; i++) SB.add(G.sph, M({ color: 0xb8823a, roughness: 0.8 }), -5.25 + rand(-0.035, 0.035), 1.115, tz + rand(-0.035, 0.035), 0, 0, 0, 0.012, 0.009, 0.009);
  }
  // lounge tables: rolled cutlery, sauce bottles, a menu card
  for (const [tx, tz] of [[5.5, -1.7], [9.4, -1.7], [5.5, 0.6], [9.4, 0.6]]) {
    for (const dx of [-0.35, 0.35]) SB.add(G.cyl8, MAT.white, tx + dx, 0.795, tz + 0.2, 0, Math.PI / 2, 0, 0.014, 0.2, 0.014);
    SB.add(G.cyl8, M({ color: 0xb01a10, roughness: 0.4 }), tx + 0.02, 0.84, tz - 0.25, 0, 0, 0, 0.022, 0.11, 0.022);
    SB.add(G.cyl8, M({ color: 0x4a2a10, roughness: 0.4 }), tx + 0.08, 0.84, tz - 0.25, 0, 0, 0, 0.022, 0.11, 0.022);
    SB.add(G.box, M({ color: 0xf4ead6, roughness: 0.9 }), tx - 0.15, 0.85, tz - 0.25, 0, 0.2, 0, 0.1, 0.13, 0.004);
    if (Math.random() < 0.6) glassAt(tx + rand(-0.3, 0.3), 0.785, tz + rand(-0.1, 0.1), choice([0.3, 0.7]), Math.random() < 0.5);
  }
  // kegs stacked in the terrace corner
  for (const [kx, kz, ky] of [[18.9, -9.0, 0.3], [18.9, -9.48, 0.3], [18.9, -9.24, 0.9]]) { SB.add(G.cyl, MAT.chrome, kx, ky, kz, 0, 0, 0, 0.21, 0.6, 0.21); for (const dy of [-0.2, 0.2]) SB.add(G.torus, MAT.chrome, kx, ky + dy, kz, 0, Math.PI / 2, 0, 0.215, 0.215, 0.215); }
  addColBox(18.6, 19.3, -9.8, -8.7);
}
