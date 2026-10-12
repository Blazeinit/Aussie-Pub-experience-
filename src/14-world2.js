
// =====================================================================
//  MORE OF THE MAP: gents, beer garden, TAB corner, drive-thru bottle-o,
//  Room 4 upstairs + balcony, the kebab shop over the road, taxis & traffic
// =====================================================================
const ZONES = {}; // per-area light rigs, played through a fixed pool of lights (constant light count = no shader recompiles)
function zoneLight(zone, x, y, z, col, inten, dist) { (ZONES[zone] = ZONES[zone] || []).push({ p: V3(x, y, z), col: new THREE.Color(col), inten, dist }); }
function plane(w, d, mat, x, y, z, rx = -Math.PI / 2, ry = 0, uvs = 0) { const g = new THREE.PlaneGeometry(w, d); if (uvs) uvScale(g, w / uvs, d / uvs); const m = new THREE.Mesh(g, mat); m.rotation.set(rx, ry, 0, 'YXZ'); m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }
function addSwingDoor(x, z, s, w, mat, h = 2.1) {
  const pivot = new THREE.Group(); pivot.position.set(x, 0, z); scene.add(pivot);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h, 0.045), mat); leaf.position.set(-s * w / 2, h / 2, 0); pivot.add(leaf);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.06), MAT.brass); plate.position.set(-s * (w - 0.12), 1.05, 0); pivot.add(plate);
  dynamic.doors.push({ pivot, s, w, ang: 0, vel: 0, lastSound: 0 });
  return pivot;
}
function mkTex(w, h, draw, srgb = true) { const c = mkCanvas(w, h); draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------------------------------------------------------------- the gents
let gentsMirror = null;
function buildToilets() {
  const tiles = M({ map: TEX.tileCream, roughness: 0.25 });
  plane(3.6, 4.6, tiles, -11.2, 0.004, -20.3, -Math.PI / 2, 0, 0.6);
  plane(3.6, 4.6, M({ color: 0xd8d4c4, roughness: 0.8 }), -11.2, 2.9, -20.3, Math.PI / 2);
  const wm = { low: [MAT.tileGreen, MAT.brick], high: [MAT.paintCream, MAT.brick] };
  buildWall('z', -13, -22.6, -18.15, 2.9, wm, -1, [], 0.3);
  buildWall('z', -9.4, -22.6, -18.15, 2.9, wm, 1, [], 0.3);
  buildWall('x', -22.6, -13.1, -9.3, 2.9, wm, -1, [], 0.3);
  buildWall('z', -11.0, -22.45, -18.15, 2.9, { low: [MAT.tileGreen, MAT.tileGreen], high: [MAT.paintCream, MAT.paintCream] }, 1, [], 0.12);
  addBoxS(SBX, MAT.corr, -11.2, 3.0, -20.35, 3.9, 0.2, 4.8); // roof of the block, seen from the garden
  addSwingDoor(-12.45, -18.0, -1, 0.9, M({ color: 0x3a2618, roughness: 0.5 }));
  // stainless urinal trough on the back wall
  addBoxS(SB, MAT.chrome, -12.05, 1.05, -22.42, 1.7, 1.1, 0.03);
  addBoxS(SB, MAT.chrome, -12.05, 0.52, -22.32, 1.7, 0.08, 0.22);
  addCylS(SB, MAT.chrome, -12.05, 1.62, -22.38, 0.015, 1.7, 8, 0, 0, Math.PI / 2);
  addColBox(-12.95, -11.15, -22.45, -22.15);
  // cubicle on the left with a toilet in it, door ajar
  addBoxS(SB, M({ color: 0x4a5a4a, roughness: 0.5 }), -12.55, 1.1, -19.25, 0.9, 1.9, 0.04);
  addBoxS(SB, M({ color: 0x4a5a4a, roughness: 0.5 }), -12.55, 1.1, -20.75, 0.9, 1.9, 0.04);
  const cd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.85, 1.4), M({ color: 0x4a5a4a, roughness: 0.5 })); cd.position.set(-12.05, 1.08, -20.3); cd.rotation.y = -0.6; scene.add(cd);
  addCylS(SB, MAT.white, -12.75, 0.22, -20.0, 0.17, 0.44, 16); addBoxS(SB, MAT.white, -12.9, 0.65, -20.0, 0.16, 0.38, 0.42);
  addColBox(-13, -12.05, -20.8, -19.2);
  // basin, sticker-covered mirror, hand dryer, condom machine
  addBoxS(SB, MAT.white, -11.25, 0.82, -19.1, 0.4, 0.14, 0.5); addCylS(SB, MAT.chrome, -11.15, 0.95, -19.1, 0.012, 0.15, 6);
  addColBox(-11.5, -11.0, -19.4, -18.8);
  gentsMirror = new Reflector(new THREE.PlaneGeometry(0.55, 0.7), { clipBias: 0.003, textureWidth: 256, textureHeight: 320, color: 0x9a9890 });
  gentsMirror.position.set(-11.07, 1.62, -19.1); gentsMirror.rotation.y = -Math.PI / 2; scene.add(gentsMirror); window.__gentsMirror = gentsMirror;
  const mob = gentsMirror.onBeforeRender;
  gentsMirror.onBeforeRender = function (...a) { const c = camera.position; if (Game.frameN % 2 || !roomAt(c.x, c.z) || roomAt(c.x, c.z).id !== 'toilets') return; if (playerBody) playerBody.root.visible = true; mob.apply(this, a); if (playerBody) playerBody.root.visible = false; };
  const stick = mkTex(256, 320, (x, W, H) => { x.clearRect(0, 0, W, H); [['#e8c52a', 'PIES'], ['#c7352b', 'XXXX'], ['#1a3a8a', 'NRL'], ['#fff', 'LOVE YA MUM']].forEach(([c, t], i) => { x.save(); x.translate(30 + (i % 2) * 180, 30 + i * 80); x.rotate(rand(-0.4, 0.4)); x.fillStyle = c; x.fillRect(-26, -12, 70, 24); x.fillStyle = '#111'; x.font = 'bold 14px Inter'; x.fillText(t, -20, 5); x.restore(); }); });
  signPlane(stick, 0.6, 0.75, -11.06, 1.62, -19.1, -Math.PI / 2, { transparent: true });
  addBoxS(SB, MAT.chrome, -11.08, 1.25, -20.0, 0.15, 0.3, 0.25);
  addBoxS(SB, M({ color: 0x8a1a1a, roughness: 0.4 }), -12.92, 1.35, -18.75, 0.12, 0.6, 0.35);
  // graffiti, of course
  const graf = mkTex(512, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H); const lines = [['DAZZA WOZ ERE 09', '#222', 0.1], ['KENNO IS A DART GOD', '#1a3a8a', -0.05], ['the pies will win a flag (lol)', '#7a1f14', 0.03], ['IIII IIII III', '#333', 0], ['don\'t eat the yellow snow - mgmt', '#2a5a2a', -0.08]];
    lines.forEach(([t, c, r], i) => { x.save(); x.translate(20 + (i % 2) * 60, 40 + i * 46); x.rotate(r); x.fillStyle = c; x.font = `${rand(22, 30)}px 'Permanent Marker', cursive`; x.fillText(t, 0, 0); x.restore(); });
  });
  signPlane(graf, 1.4, 0.7, -12.98, 1.75, -21.4, Math.PI / 2, { transparent: true });
  signPlane(graf, 1.2, 0.6, -11.12, 1.9, -21.6, -Math.PI / 2, { transparent: true });
  SB.add(G.box, MAT.bulbCool, -11.9, 2.86, -20.3, 0, 0, 0, 0.06, 0.04, 1.2);
  zoneLight('toilets', -11.9, 2.6, -20.4, 0xe0f0ff, 7, 7);
  addInteract({ id: 'urinal', pos: V3(-12.05, 1.0, -22.1), r: 1.9, label: () => 'Use the trough', action: () => Needs.toilet() });
}

// ---------------------------------------------------------------- beer garden
function texGravel() {
  return mkTex(512, 512, (x, W, H) => {
    x.fillStyle = '#8a8070'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const l = rand(30, 78); x.fillStyle = `hsl(${rand(20, 45)},${rand(5, 20)}%,${l}%)`; x.beginPath(); x.ellipse(Math.random() * W, Math.random() * H, rand(1, 3.5), rand(1, 3), rand(0, 3), 0, 7); x.fill(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(40,30,20,.12)'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(10, 40), 0, 7); x.fill(); }
  });
}
function texGumLeaves() {
  const t = mkTex(256, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 110, px = W / 2 + Math.cos(a) * r, py = H / 2 + Math.sin(a) * r * 0.8;
      x.save(); x.translate(px, py); x.rotate(rand(1.2, 1.9) + Math.sin(a) * 0.4);
      x.fillStyle = `hsl(${rand(85, 110)},${rand(14, 30)}%,${rand(24, 44)}%)`;
      x.beginPath(); x.ellipse(0, 0, rand(2.2, 3.4), rand(9, 15), 0, 0, 7); x.fill(); x.restore();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function gumTree(x, z, h = 8, seed = 0) {
  const bark = M({ color: 0xd2c9b8, roughness: 0.85 }, false);
  const lean = V3(Math.sin(seed) * 0.6, 0, Math.cos(seed) * 0.4);
  const trunk = [V3(x, 0, z), V3(x + lean.x * 0.3, h * 0.35, z + lean.z * 0.3), V3(x + lean.x, h * 0.65, z + lean.z), V3(x + lean.x * 1.3, h * 0.85, z + lean.z * 1.2)];
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunk), 12, 0.2, 8); SBX.add(tg, bark);
  const leafM = new THREE.MeshStandardMaterial({ map: TEX.gum, alphaTest: 0.45, side: THREE.DoubleSide, color: 0xa8b8a0, roughness: 0.85 });
  const top = trunk[3];
  for (let i = 0; i < 5; i++) {
    const a = seed + i * 1.3, br = [trunk[2].clone(), trunk[2].clone().add(V3(Math.cos(a) * 1.4, 1.2 + i * 0.25, Math.sin(a) * 1.4)), top.clone().add(V3(Math.cos(a) * 2.4, 0.4 + i * 0.3, Math.sin(a) * 2.4))];
    SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br), 8, 0.07, 5), bark);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), r = rand(0.3, 2.6), c = top.clone().add(V3(Math.cos(a) * r, rand(-1.2, 1.6), Math.sin(a) * r)), s = rand(1.8, 3.0);
    for (let k = 0; k < 2; k++) SBX.add(G.plane, leafM, c.x, c.y, c.z, a + k * Math.PI / 2, rand(-0.3, 0.3), 0, s, s * 0.8, 1);
  }
  addCol(x, z, 0.5, 0.5);
}
function picnicTable(i, x, z, umbrella) {
  const pine = M({ color: 0x8a6a48, map: TEX.deck, roughness: 0.85 }, false);
  addBoxS(SBX, pine, x, 0.76, z, 1.8, 0.05, 0.75, 0, 0.6);
  for (const dz of [-0.62, 0.62]) addBoxS(SBX, pine, x, 0.45, z + dz, 1.8, 0.05, 0.28, 0, 0.6);
  for (const dx of [-0.7, 0.7]) { SBX.add(G.box, pine, x + dx, 0.38, z, 0, 0.55, 0, 0.07, 0.86, 0.07); SBX.add(G.box, pine, x + dx, 0.38, z, 0, -0.55, 0, 0.07, 0.86, 0.07); SBX.add(G.box, pine, x + dx, 0.42, z, 0, 0, 0, 0.07, 0.05, 1.5); }
  SBX.add(G.plane, MAT.blob, x, 0.006, z, 0, -Math.PI / 2, 0, 2.6, 2.0, 1);
  addCol(x, z, 1.85, 1.55);
  for (const dz of [-0.62, 0.62]) for (const dx of [-0.45, 0.45]) addSpot({ kind: 'chair', pos: V3(x + dx, 0, z + dz), ry: dz > 0 ? Math.PI : 0, sitH: 0.47, area: 'garden', smoke: true, group: 'pt' + i });
  if (umbrella) {
    addCylS(SBX, MAT.creamPaint, x, 1.3, z, 0.025, 2.6, 8);
    const ut = mkTex(256, 64, (c, W, H) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#c7352b' : '#f3d27a'; c.fillRect(k * W / 8, 0, W / 8, H); } c.fillStyle = '#fff'; c.font = 'bold 16px Bebas Neue, Impact'; c.fillText('GOLDEN LAGER', 10, H - 8); });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: ut, side: THREE.DoubleSide, roughness: 0.8 }));
    canopy.position.set(x, 2.45, z); canopy.castShadow = true; scene.add(canopy);
  }
}
function festoon(a, b, sag, every = 0.55) {
  const pts = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0))); }
  SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 4), MAT.iron);
  const n = Math.round(a.distanceTo(b) / every);
  for (let k = 1; k < n; k++) { const t = k / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag - 0.05, 0)); SBX.add(G.sph, MAT.bulb, p.x, p.y, p.z, 0, 0, 0, 0.035, 0.045, 0.035); if (k % 3 === 0) atmo.gardenHalos.push(haloSprite(p, 0.45, 0xffc890, 0.55)); }
}
function buildGarden() {
  TEX.gravel = texGravel(); TEX.gravel.wrapS = TEX.gravel.wrapT = THREE.RepeatWrapping; TEX.gum = texGumLeaves();
  atmo.gardenHalos = [];
  plane(29.2, 10.9, M({ map: TEX.gravel, roughness: 0.95 }, false), 5.1, 0.003, -23.57, -Math.PI / 2, 0, 2.2);
  // Colorbond fence (Woodland Grey, naturally)
  const cb = M({ color: 0x5c615a, map: TEX.corr, metalness: 0.45, roughness: 0.5 }, false);
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2; SBX.add(uvBox(new THREE.BoxGeometry(len, 1.8, 0.04), len, 1.8, 0.04, 0.8), cb, (x0 + x1) / 2, 0.9, (z0 + z1) / 2, ry); addColBox(Math.min(x0, x1) - 0.05, Math.max(x0, x1) + 0.05, Math.min(z0, z1) - 0.05, Math.max(z0, z1) + 0.05); for (let k = 0; k <= len / 2.4; k++) { const t = k * 2.4 / len; SBX.add(G.box, cb, lerp(x0, x1, t), 0.92, lerp(z0, z1, t), ry, 0, 0, 0.06, 1.84, 0.06); } };
  fence(-9.4, -29, 19.6, -29); fence(19.6, -29, 19.6, -18.2); fence(-9.4, -29, -9.4, -22.75);
  // tables, umbrellas, a shade sail, a couple of gums, the barbie
  [[-6, -21.6], [-2, -21.6], [2, -21.6], [-6, -26.1], [-2, -26.1], [2, -26.1], [8.8, -21.9], [8.8, -26.3], [13.4, -24.4]].forEach(([x, z], i) => picnicTable(i, x, z, i === 1 || i === 4 || i === 6));
  const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([-8.6, 3.3, -19.4, 3.8, 3.0, -19.6, -3.2, 3.5, -28.4], 3)); sail.computeVertexNormals();
  const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: 0xd8c8a0, side: THREE.DoubleSide, roughness: 0.9 })); sm.castShadow = true; scene.add(sm);
  for (const [px, pz, h] of [[-8.6, -19.4, 3.3], [3.8, -19.6, 3.0], [-3.2, -28.4, 3.5]]) { addCylS(SBX, MAT.iron, px, h / 2, pz, 0.05, h, 8); addCol(px, pz, 0.2, 0.2); }
  gumTree(16.8, -27.2, 8.5, 0.6); gumTree(-7.8, -27.8, 7.2, 2.4); gumTree(6.2, -28.4, 6.5, 4.1);
  addBoxS(SBX, MAT.chrome, 11.2, 0.5, -28.4, 1.3, 0.9, 0.6); addBoxS(SBX, MAT.blackPlastic, 11.2, 1.05, -28.4, 1.25, 0.2, 0.58); addCylS(SBX, M({ color: 0xc7352b, roughness: 0.4 }, false), 12.2, 0.32, -28.4, 0.15, 0.64, 12); addColBox(10.5, 12.4, -28.8, -28);
  addBoxS(SBX, M({ color: 0x2a6ab8, roughness: 0.4 }, false), -8.6, 0.25, -24.2, 0.7, 0.45, 0.45); addBoxS(SBX, MAT.white, -8.6, 0.5, -24.2, 0.72, 0.06, 0.47); addCol(-8.6, -24.2, 0.8, 0.55);
  // festoon lights
  for (const [px, pz] of [[-9.1, -18.6], [5, -18.6], [19.3, -18.6], [-9.1, -28.7], [5, -28.7], [19.3, -28.7]]) { addCylS(SBX, MAT.iron, px, 1.7, pz, 0.04, 3.4, 6); }
  festoon(V3(-9.1, 3.35, -18.6), V3(5, 3.35, -28.7), 0.5); festoon(V3(-9.1, 3.35, -28.7), V3(5, 3.35, -18.6), 0.5);
  festoon(V3(5, 3.35, -18.6), V3(19.3, 3.35, -28.7), 0.5); festoon(V3(5, 3.35, -28.7), V3(19.3, 3.35, -18.6), 0.5);
  zoneLight('garden', -2, 2.9, -23.6, 0xffc890, 16, 15); zoneLight('garden', 12, 2.9, -23.6, 0xffc890, 14, 14);
  // sign over the gate
  const gs = signTex(['BEER GARDEN'], { w: 512, h: 128, bg: ['#1f4d34', '#123222'], color: '#f0cf6a', font: 'Rye, serif', size: 70, border: '#f0cf6a', borderW: 6 });
  signPlane(gs, 1.4, 0.35, 16.3, 3.4, -17.9, 0); signPlane(gs, 1.4, 0.35, 16.3, 3.4, -18.2, Math.PI);
}

// ---------------------------------------------------------------- TAB corner
function buildTABCorner() {
  SB.add(new RoundedBoxGeometry(0.5, 1.3, 0.55, 2, 0.04), M({ color: 0x0f5a2a, roughness: 0.45 }), 2.62, 0.65, -12.45);
  const kt = signTex(['TAB', 'BET HERE'], { w: 256, h: 256, bg: ['#0f8a3a', '#085a22'], color: '#fff', sizes: [100, 40] });
  const ks = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), new THREE.MeshBasicMaterial({ map: kt, toneMapped: false })); ks.position.set(2.36, 1.08, -12.45); ks.rotation.y = -Math.PI / 2; scene.add(ks);
  addColBox(2.35, 2.9, -12.75, -12.15);
  const c = mkCanvas(512, 288); dynamic.tab = { c, tex: canvasTex(c, 1, 1) };
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: dynamic.tab.tex })); scr.material.color.setScalar(1.25); scr.position.set(2.87, 2.25, -12.45); scr.rotation.y = -Math.PI / 2; scene.add(scr);
  SB.add(G.box, MAT.blackPlastic, 2.92, 2.25, -12.45, 0, 0, 0, 0.05, 0.68, 1.16);
  addInteract({ id: 'tab', pos: V3(2.4, 1.2, -12.45), r: 2.2, label: () => 'TAB — bet on the races', action: () => Racing.open() });
}

// ---------------------------------------------------------------- drive-thru bottle-o in the side lane
function buildBottleO() {
  plane(6.6, 9.85, MAT.concrete, 16.3, 0.004, -2.93, -Math.PI / 2, 0, 3);
  plane(6.6, 9.85, M({ color: 0x9a9e9a, map: TEX.corr, roughness: 0.6, metalness: 0.4 }), 16.3, 3.4, -2.93, Math.PI / 2, 0, 1.5);
  addBoxS(SBX, MAT.corr, 16.3, 3.5, -2.93, 6.8, 0.1, 10);
  // lightbox over the entry
  const lb = signTex(['ROYAL CELLARS', 'DRIVE-THRU BOTTLE-O'], { w: 1024, h: 200, bg: ['#c7352b', '#8a1a12'], color: ['#fff', '#ffd84a'], sizes: [86, 52], font: 'Bungee, Impact' });
  const s1 = signPlane(lb, 4.6, 0.9, 16.3, 3.05, 2.06, 0, { intensity: 1.6, toneMapped: false }); dynamic.neon.push(s1);
  addBoxS(SBX, MAT.iron, 16.3, 3.05, 1.98, 4.7, 1.0, 0.12);
  // coolroom doors along the far wall: a backlit image of the shelves behind glass
  const fridgeTex = mkTex(1024, 256, (x, W, H) => {
    x.fillStyle = '#cfe4ee'; x.fillRect(0, 0, W, H);
    const brands = ['#d9a12a', '#2a6b2f', '#b5541b', '#22477a', '#c7352b', '#f2f2ee', '#111'];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 64; i++) { x.fillStyle = choice(brands); const bx = i * 16 + 2, by = 10 + row * 49; x.fillRect(bx, by, 13, 36); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(bx + 2, by + 3, 2, 30); }
    x.fillStyle = 'rgba(150,170,180,.9)'; for (let row = 0; row < 5; row++) x.fillRect(0, 47 + row * 49, W, 4);
    x.fillStyle = '#7a8a90'; for (let d = 1; d < 7; d++) x.fillRect(d * W / 7 - 3, 0, 6, H);
  });
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 2.2), new THREE.MeshBasicMaterial({ map: fridgeTex })); fr.material.color.setScalar(1.15); fr.position.set(19.45, 1.2, -3.0); fr.rotation.y = -Math.PI / 2; scene.add(fr);
  addColBox(19.2, 19.6, -6.6, 0.6);
  // carton stacks and pallets
  const cartonTex = col => mkTex(256, 128, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = 'bold 34px Bebas Neue, Impact'; x.fillText('GOLDEN LAGER', 16, 52); x.font = '22px Inter'; x.fillText('24 × 375ml CANS', 16, 92); });
  const cartons = [M({ map: cartonTex('#c7352b'), roughness: 0.8 }, false), M({ map: cartonTex('#1a5a2a'), roughness: 0.8 }, false), M({ map: cartonTex('#22477a'), roughness: 0.8 }, false)];
  for (let st = 0; st < 3; st++) { const px = 14.6 + st * 1.6, pz = -6.8; addBoxS(SBX, MAT.darkWood, px, 0.07, pz, 1.2, 0.14, 1.0); for (let k = 0; k < 4 + st; k++) for (let j = 0; j < 2; j++) SBX.add(G.box, cartons[(k + st) % 3], px + (j - 0.5) * 0.52, 0.27 + k * 0.26, pz + rand(-0.03, 0.03), rand(-0.05, 0.05), 0, 0, 0.5, 0.25, 0.4); addCol(px, pz, 1.3, 1.1); }
  // counter with the till and the scratchie dispenser
  addBoxS(SBX, MAT.darkWood, 14.4, 0.5, -0.6, 0.8, 1.0, 2.6); addBoxS(SBX, MAT.barTop, 14.4, 1.02, -0.6, 0.9, 0.05, 2.7);
  addBoxS(SBX, MAT.blackPlastic, 14.3, 1.18, -1.2, 0.35, 0.26, 0.4);
  const scr = mkTex(256, 256, (x, W, H) => { const cols = ['#ffd84a', '#ff4a8a', '#4ad8ff', '#7dff9a', '#ff8a2a', '#c48aff']; for (let i = 0; i < 6; i++) { x.fillStyle = cols[i]; x.fillRect((i % 3) * 85, Math.floor(i / 3) * 128, 82, 124); x.fillStyle = '#111'; x.font = 'bold 18px Bungee, Impact'; x.fillText(['$2', '$5', '$10', 'LUCKY', 'CASH', 'GOLD'][i], (i % 3) * 85 + 10, Math.floor(i / 3) * 128 + 60); } });
  const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })); sd.position.set(14.86, 1.32, 0.2); sd.rotation.y = Math.PI / 2; scene.add(sd);
  addColBox(13.95, 14.9, -1.95, 0.75);
  signPlane(signTex(['NO ID', 'NO SALE'], { w: 256, h: 256, bg: '#f4f0e6', color: '#c7352b', sizes: [80, 70], border: '#c7352b', borderW: 10 }), 0.4, 0.4, 13.17, 2.0, -0.6, Math.PI / 2);
  signPlane(signTex(['CARTON $58', '6 PACK $24', 'SMOKES $42'], { w: 512, h: 384, bg: '#111', color: ['#ffd84a', '#fff', '#ff8a7a'], sizes: [80, 80, 80], font: 'Bebas Neue, Impact' }), 1.1, 0.82, 13.17, 2.35, -3.4, Math.PI / 2);
  SB.add(G.box, MAT.bulbCool, 16.3, 3.36, -2.9, 0, 0, 0, 0.08, 0.04, 2.4);
  zoneLight('street', 16.3, 3.0, -2.6, 0xe8f4ff, 10, 11);
  addInteract({ id: 'bottleo', pos: V3(14.9, 1.15, -0.6), r: 2.2, label: () => 'Bottle-O: scratchies, smokes & takeaway', action: () => Shops.bottleO() });
}

// ---------------------------------------------------------------- Room 4 upstairs + the balcony
function buildUpstairs() {
  const y = UP.y;
  colLevel = 1;
  const wall = { low: [MAT.paintCream, MAT.brick], high: [MAT.paintCream, MAT.brick] };
  buildWall('z', 5.0, -2.0, 1.85, 3.0, wall, -1, [], 0.15, 99, true, y);
  buildWall('z', 12.6, -2.0, 1.85, 3.0, wall, 1, [], 0.15, 99, true, y);
  buildWall('x', -2.0, 4.9, 12.7, 3.0, wall, -1, [], 0.15, 99, true, y);
  // balcony edges
  addColBox(-13.1, 13.1, 9.38, 9.6); addColBox(-13.3, -13.0, 2.0, 9.6); addColBox(13.0, 13.3, 2.0, 9.6);
  // furniture
  addColBox(10.6, 12.6, -1.0, 0.45); addColBox(5.0, 6.05, -2.0, -1.35); addColBox(7.7, 9.3, -2.0, -1.45); addColBox(12.0, 12.6, -1.6, -1.05);
  colLevel = 0;
  const carpet = M({ map: TEX.carpet, color: 0x8a7070, roughness: 1 });
  plane(7.6, 3.85, carpet, 8.8, y + 0.003, -0.075, -Math.PI / 2, 0, 1.2);
  plane(7.6, 3.85, M({ color: 0xe0d8c4, roughness: 0.9 }), 8.8, y + 3.0, -0.075, Math.PI / 2);
  addBoxS(SB, MAT.darkWood, 8.8, y + 2.55, -1.92, 7.6, 0.05, 0.03); // picture rail
  // iron double bed with a chenille spread
  const iron = M({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
  addBoxS(SB, MAT.white, 11.6, y + 0.48, -0.28, 1.95, 0.22, 1.4); addBoxS(SB, M({ color: 0xd9c9a8, roughness: 0.95 }), 11.45, y + 0.6, -0.28, 1.6, 0.04, 1.46);
  for (const dz of [-0.4, 0.4]) addBoxS(SB, MAT.white, 12.3, y + 0.66, -0.28 + dz, 0.38, 0.12, 0.55);
  for (const bx of [10.6, 12.55]) { for (const dz of [-0.7, 0.7]) addCylS(SB, iron, bx, y + 0.55, -0.28 + dz, 0.02, 1.1, 8); addCylS(SB, iron, bx, y + 1.05, -0.28, 0.015, 1.4, 6, 0, Math.PI / 2); addCylS(SB, iron, bx, y + 0.8, -0.28, 0.012, 1.4, 6, 0, Math.PI / 2); }
  // bedside table + lamp, wardrobe, dresser + old telly, armchair, basin
  addBoxS(SB, MAT.darkWood, 12.3, y + 0.3, -1.35, 0.45, 0.6, 0.45);
  SB.add(new THREE.ConeGeometry(0.14, 0.18, 12, 1, true), M({ color: 0xf2dca8, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x5a3a10 }), 12.3, y + 0.86, -1.35); addCylS(SB, MAT.brass, 12.3, y + 0.7, -1.35, 0.012, 0.22, 6);
  addBoxS(SB, MAT.darkWood, 5.55, y + 1.0, -1.65, 1.0, 2.0, 0.6);
  addBoxS(SB, MAT.darkWood, 8.5, y + 0.4, -1.72, 1.4, 0.8, 0.5); addBoxS(SB, MAT.blackPlastic, 8.5, y + 1.05, -1.72, 0.55, 0.45, 0.45);
  addBoxS(SB, M({ color: 0x2a3a3a, roughness: 0.2 }), 8.5, y + 1.05, -1.49, 0.42, 0.32, 0.01);
  addBoxS(SB, M({ color: 0x5a3a2a, roughness: 0.9 }), 6.6, y + 0.25, 1.05, 0.75, 0.5, 0.7); addBoxS(SB, M({ color: 0x5a3a2a, roughness: 0.9 }), 6.6, y + 0.6, 1.36, 0.75, 0.6, 0.12);
  addBoxS(SB, MAT.white, 5.25, y + 0.85, 0.6, 0.4, 0.14, 0.5);
  framed(12.57, y + 1.8, -0.3, -Math.PI / 2, 2);
  signPlane(signTex(['CHECKOUT 10AM', 'No visitors after midnight', '— Mgmt'], { w: 512, h: 256, bg: '#f4ead6', color: ['#7a1f14', '#222', '#555'], sizes: [52, 34, 30] }), 0.4, 0.2, 7.2, y + 1.5, -1.92, 0);
  // door back down to the bar
  addBoxS(SB, MAT.darkWood, 7.0, y + 1.05, -1.95, 0.9, 2.1, 0.06);
  zoneLight('upstairs', 12.1, y + 1.1, -1.3, 0xffb870, 6, 7); zoneLight('upstairs', 8.6, y + 2.7, 0, 0xffd8a8, 5, 9);
  addInteract({ id: 'bed', pos: V3(11.4, y + 0.7, -0.28), r: 2.4, enabled: () => player.level === 1, label: () => 'Get some kip (end the night)', action: () => { Game.closePanel(); achieve('upstairs'); Game.endNight('room'); } });
  addInteract({ id: 'downstairs', pos: V3(7.0, y + 1.1, -1.9), r: 2.0, enabled: () => player.level === 1, label: () => 'Head back down to the bar', action: () => Shops.goStairs(0) });
  // ground floor: the residents' door in the lounge
  addBoxS(SB, MAT.darkWood, 12.0, 1.05, 1.83, 0.9, 2.1, 0.06); SB.add(G.box, MAT.brass, 11.66, 1.0, 1.79, 0, 0, 0, 0.04, 0.12, 0.04);
  signPlane(signTex(['ACCOMMODATION', 'Residents only'], { w: 512, h: 160, bg: '#1a1a1a', color: ['#e8c56a', '#ccc'], sizes: [60, 36] }), 0.6, 0.19, 12.0, 2.3, 1.79, Math.PI);
  addInteract({ id: 'upstairs', pos: V3(12.0, 1.2, 1.7), r: 2.0, enabled: () => player.level === 0, label: () => Game.state.tonight.room ? 'Go up to Room 4' : 'Room 4 upstairs ($45 a night)', action: () => Shops.room() });
}

// ---------------------------------------------------------------- the kebab shop over the road
function buildKebab() {
  const x0 = 7.6, x1 = 12.4, zf = 24.0, zb = 27.75;
  const shell = M({ map: TEX.paintDark, color: 0x6a645a, roughness: 0.95 }, false);
  // building mass around the shop: upper floor + the back of house
  SBX.add(uvBox(new THREE.BoxGeometry(x1 - x0, 3.8, 12), x1 - x0, 3.8, 12, 2.5), shell, (x0 + x1) / 2, 5.1, zf + 6);
  SBX.add(uvBox(new THREE.BoxGeometry(x1 - x0, 3.2, 36 - zb), x1 - x0, 3.2, 36 - zb, 2.5), shell, (x0 + x1) / 2, 1.6, (zb + 36) / 2);
  addColBox(x0, x1, zb, 36);
  const white = M({ map: TEX.tileCream, color: 0xf2f2ee, roughness: 0.3 }, false);
  plane(x1 - x0, zb - zf, M({ map: TEX.tileRed, roughness: 0.4 }, false), (x0 + x1) / 2, 0.004, (zf + zb) / 2, -Math.PI / 2, 0, 0.6);
  plane(x1 - x0, zb - zf, M({ color: 0xe8e8e4, roughness: 0.8 }, false), (x0 + x1) / 2, 3.0, (zf + zb) / 2, Math.PI / 2);
  for (const sx of [x0 + 0.02, x1 - 0.02]) plane(zb - zf, 3.0, white, sx, 1.5, (zf + zb) / 2, 0, sx < 10 ? Math.PI / 2 : -Math.PI / 2, 0.6);
  plane(x1 - x0, 3.0, white, (x0 + x1) / 2, 1.5, zb - 0.02, 0, Math.PI, 0.6);
  // shopfront: glass with a doorway on the left, tiled stallriser, big lightbox
  addBoxS(SBX, M({ map: TEX.tileRed, roughness: 0.3 }, false), 10.6, 0.45, zf, 3.6, 0.9, 0.12);
  mesh(new THREE.PlaneGeometry(3.6, 2.0), MAT.window, 10.6, 1.9, zf).rotation.y = Math.PI;
  for (const fx of [7.65, 8.8, 12.35]) addBoxS(SBX, MAT.chrome, fx, 1.5, zf, 0.08, 3.0, 0.1);
  addBoxS(SBX, MAT.chrome, 10.0, 2.95, zf, 4.8, 0.1, 0.1);
  addColBox(8.8, x1, zf - 0.1, zf + 0.1);
  const sign = signTex(['KEBAB PALACE', 'OPEN LATE · HSP · PIZZA'], { w: 1024, h: 220, bg: ['#ffd84a', '#ff9a1a'], color: ['#b0140a', '#2a1a0a'], sizes: [110, 46], font: 'Bungee, Impact' });
  const sg = signPlane(sign, 4.6, 1.0, 10.0, 3.55, zf - 0.08, Math.PI, { intensity: 1.5, toneMapped: false }); dynamic.neon.push(sg);
  // counter with a glowing bain-marie, the spit, menu boards, drinks fridge
  addBoxS(SBX, MAT.chrome, 10.4, 0.5, 26.7, 3.6, 1.0, 0.6); addColBox(8.5, x1, 26.35, 27.05);
  const bm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.6) })); bm.position.set(10.6, 1.15, 26.7); scene.add(bm);
  addBoxS(SBX, MAT.window, 10.6, 1.35, 26.45, 2.5, 0.4, 0.02);
  const meat = mkTex(128, 128, (x, W, H) => { x.fillStyle = '#7a4018'; x.fillRect(0, 0, W, H); for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${rand(18, 32)},${rand(40, 70)}%,${rand(18, 42)}%)`; x.fillRect(Math.random() * W, Math.random() * H, rand(2, 8), rand(1, 3)); } });
  dynamic.doner = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.55, 16), new THREE.MeshStandardMaterial({ map: meat, roughness: 0.6, emissive: 0x3a1000, emissiveIntensity: 0.6 }));
  dynamic.doner.position.set(11.6, 1.3, 27.35); scene.add(dynamic.doner);
  addCylS(SBX, MAT.chrome, 11.6, 1.3, 27.35, 0.008, 0.9, 6);
  const heater = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.9, 0.2) })); heater.position.set(11.6, 1.3, 27.68); heater.rotation.y = Math.PI; scene.add(heater);
  const menu = mkTex(1024, 256, (x, W, H) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, W, H);
    [['DONER KEBAB', '$14'], ['HSP (SNACK PACK)', '$18'], ['HOT CHIPS', '$6'], ['PIZZA SLICE', '$5'], ['CAN OF DRINK', '$3.50']].forEach(([t, p], i) => { x.fillStyle = ['#ffd84a', '#ff7a5a', '#fff', '#fff', '#8ad8ff'][i]; x.font = 'bold 34px Bebas Neue, Impact'; x.fillText(t, 30 + (i % 3) * 330, 70 + Math.floor(i / 3) * 110); x.fillStyle = '#fff'; x.fillText(p, 230 + (i % 3) * 330, 70 + Math.floor(i / 3) * 110); x.fillStyle = choice(['#c87a2a', '#a8501a', '#e8c040']); x.fillRect(30 + (i % 3) * 330, 82 + Math.floor(i / 3) * 110, 260, 10); });
  });
  const mb = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: menu, toneMapped: false })); mb.material.color.setScalar(1.3); mb.position.set(10.2, 2.45, zb - 0.04); mb.rotation.y = Math.PI; scene.add(mb);
  const fridge = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), new THREE.MeshBasicMaterial({ map: mkTex(128, 256, (x, W, H) => { x.fillStyle = '#dff'; x.fillRect(0, 0, W, H); for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) { x.fillStyle = choice(['#c7352b', '#1a5aa8', '#e8c52a', '#2a8a3a', '#f2f2ee']); x.fillRect(6 + i * 20, 10 + r * 50, 15, 34); } }) }));
  fridge.position.set(x0 + 0.05, 1.1, 25.0); fridge.rotation.y = Math.PI / 2; scene.add(fridge);
  for (const tz of [25.3, 26.0]) SBX.add(G.box, MAT.bulbCool, 10.0, 2.97, tz, 0, 0, 0, 3.0, 0.03, 0.06);
  // a plastic table by the window
  addCylS(SBX, MAT.white, 11.5, 0.72, 24.75, 0.35, 0.03, 16); addCylS(SBX, MAT.white, 11.5, 0.36, 24.75, 0.03, 0.72, 6); addCol(11.5, 24.75, 0.6, 0.6);
  zoneLight('street', 10.0, 2.6, 25.6, 0xe8f6ff, 18, 14);
  // a little cool light spills onto the footpath
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), new THREE.MeshBasicMaterial({ map: spillTex(), color: new THREE.Color(0.55, 0.75, 0.8), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2; spill.rotation.z = Math.PI; spill.position.set(10.0, 0.015, 22.4); scene.add(spill);
  addInteract({ id: 'kebab', pos: V3(10.2, 1.2, 26.3), r: 2.4, label: () => 'Kebab Palace — order', action: () => Shops.kebab() });
}

// ---------------------------------------------------------------- taxis and the odd passing car
const Traffic = { cars: [], taxi: null };
function makeCar(col, taxi = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e12, metalness: 0.9, roughness: 0.05 });
  const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, 0, 0.6, 0, 4.5, 0.55, 1.8);
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), paint, -0.2, 1.08, 0, 2.4, 0.5, 1.64); add(G.box, glass, -0.2, 1.1, 0, 2.2, 0.38, 1.66);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[1.4, 0.82], [1.4, -0.82], [-1.4, 0.82], [-1.4, -0.82]]) { const w = add(G.cyl, tyre, wx, 0.34, wz, 0.34, 0.24, 0.34); w.rotation.x = Math.PI / 2; }
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.0) }), tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.15, 0.1) });
  for (const s of [-0.62, 0.62]) { add(G.box, head, 2.26, 0.68, s, 0.03, 0.12, 0.3); add(G.box, tail, -2.26, 0.7, s, 0.03, 0.1, 0.28); }
  g.userData.halos = [-0.62, 0.62].map(s => { const h = haloSprite(V3(0, 0, 0), 1.2, 0xfff0d0, 0.8); scene.remove(h); h.position.set(2.4, 0.68, s); g.add(h); return h; });
  if (taxi) { const ts = signTex(['TAXI'], { w: 256, h: 96, bg: '#ffd84a', color: '#111', size: 70 }); const sgn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.2), new THREE.MeshBasicMaterial({ map: ts, toneMapped: false })); sgn.position.set(-0.2, 1.42, 0); g.add(sgn); add(G.box, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0.7, 0.905, 3.6, 0.12, 0.01); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false; scene.add(g);
  return g;
}
function buildTraffic() {
  Traffic.cars = [makeCar(0x8a8a90), makeCar(0x2a3a5a)];
  Traffic.cars.forEach(c => c.userData.active = false);
  Traffic.taxi = makeCar(0xf2f2ee, true); Traffic.taxi.userData.state = 'idle';
  // taxi rank on our footpath
  addCylS(SBX, MAT.chrome, -11.5, 1.3, 9.6, 0.04, 2.6, 8);
  const ts = signTex(['TAXI'], { w: 256, h: 128, bg: '#ffd84a', color: '#111', size: 92, border: '#111', borderW: 8 });
  signPlane(ts, 0.5, 0.25, -11.5, 2.5, 9.64, 0); signPlane(ts, 0.5, 0.25, -11.5, 2.5, 9.56, Math.PI);
  addInteract({ id: 'taxi', pos: V3(-11.5, 1.4, 9.4), r: 2.4, enabled: () => Traffic.taxi.userData.state === 'idle', label: () => `Call a cab home (${fmt0(Shops.fare())})`, action: () => Shops.callTaxi() });
  SFX.carHook = () => { const c = Traffic.cars.find(c => !c.userData.active); if (!c || Game.mode !== 'play') return; const dir = Math.random() < 0.5 ? 1 : -1; c.userData = Object.assign(c.userData, { active: true, dir, x: -dir * 70, z: dir > 0 ? 15.6 : 12.2, v: rand(12, 16) }); c.visible = true; c.rotation.y = dir > 0 ? 0 : Math.PI; };
}
function updateTraffic(dt) {
  const night = atmo.night > 0.5;
  for (const c of Traffic.cars) {
    const u = c.userData; if (!u.active) continue;
    u.x += u.dir * u.v * dt; c.position.set(u.x, -0.15, u.z);
    u.halos.forEach(h => h.visible = night);
    if (Math.abs(u.x) > 72) { u.active = false; c.visible = false; }
  }
  const t = Traffic.taxi, u = t.userData;
  u.halos.forEach(h => h.visible = night);
  if (u.state === 'arriving') {
    const dx = u.stopX - u.x, sp = Math.min(14, Math.max(1.2, Math.abs(dx) * 0.9));
    u.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); t.position.set(u.x, -0.15, 11.4); t.rotation.y = Math.PI;
    if (Math.abs(dx) < 0.05) { u.state = 'waiting'; SFX.tone(420, 0.15, { gain: 0.06, pos: t.position, type: 'square' }); SFX.tone(420, 0.15, { delay: 0.3, gain: 0.06, pos: t.position, type: 'square' }); Game.toast('Your cab\'s here.'); u.ia = addInteract({ id: 'getin', temp: true, pos: V3(u.x, 1.0, 10.6), r: 3.0, label: () => 'Get in the cab', action: () => { interactables.splice(interactables.indexOf(u.ia), 1); u.state = 'leaving'; achieve('taxi'); Game.endNight('taxi'); } }); }
  } else if (u.state === 'leaving') { u.x -= 10 * dt; t.position.x = u.x; if (u.x < -75) { u.state = 'idle'; t.visible = false; } }
}

// ---------------------------------------------------------------- zone lights
const ZL = { lights: [], zone: null, k: 0 };
function buildZoneLights() { for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); ZL.lights.push(l); } }
function zoneFor(c) {
  if (player.level === 1 && Game.mode === 'play' && c.y > UP.y + 0.5) return c.z < 2.1 ? 'upstairs' : 'street';
  const r = roomAt(c.x, c.z);
  if (r) return r.id === 'toilets' ? 'toilets' : 'street';
  if (inGarden(c.x, c.z) || onTerrace(c.x, c.z)) return 'garden';
  if (!isInside(c.x, c.z)) return 'street';
  return 'pub';
}
function updateZones(dt) {
  const want = zoneFor(camera.position);
  if (want !== ZL.zone) { ZL.k = Math.max(0, ZL.k - dt * 6); if (ZL.k <= 0) { ZL.zone = want; const specs = ZONES[want] || []; ZL.lights.forEach((l, i) => { const s = specs[i]; if (s) { l.position.copy(s.p); l.color.copy(s.col); l.distance = s.dist; l.userData.inten = s.inten; } else l.userData.inten = 0; }); } }
  else ZL.k = Math.min(1, ZL.k + dt * 3);
  const night = clamp(atmo.nightF * 1.4 + 0.25, 0, 1);
  ZL.lights.forEach(l => { l.intensity = (l.userData.inten || 0) * ZL.k * (ZL.zone === 'garden' || ZL.zone === 'street' ? night : 1); });
  if (dynamic.doner) dynamic.doner.rotation.y += dt * 0.8;
  if (atmo.gardenHalos) { const v = atmo.night > 0.5; for (const h of atmo.gardenHalos) h.visible = v; }
  if (dynamic.roomGlow) dynamic.roomGlow.visible = atmo.night > 0.5 || player.level !== 1;
}

// ---------------------------------------------------------------- nav graph additions
Object.assign(NODES, { Y0: V3(16.3, 0, -19.3), Y1: V3(11.0, 0, -24.1), Y2: V3(4.6, 0, -23.9), Y3: V3(-3.8, 0, -23.9) });
for (const [a, b] of [['T3', 'Y0'], ['Y0', 'Y1'], ['Y1', 'Y2'], ['Y2', 'Y3']]) { ADJ[a] = ADJ[a] || []; ADJ[b] = ADJ[b] || []; ADJ[a].push(b); ADJ[b].push(a); }
