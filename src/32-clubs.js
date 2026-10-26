
// =====================================================================
//  ONE TOWN, THREE PUBS
//  The Royal (03-world) sits mid-street.  Wattle Creek RSL is over the road to the east, set back behind a forecourt
//  with its courtesy bus, flagpole and memorial; the Rusty Anchor is up the street to the west.  Each is a real
//  walk-in building with its own bar and staff, machines, crowd, lighting and soundtrack.
//  "The venue" (prices, exposure, songs, story) follows you: it is whichever building you are standing in.
// =====================================================================
const CLUBS = {
  rsl: { id: 'rsl', x0: 27, x1: 50, z0: 27, z1: 46, ceil: 4.2, spawn: V3(38.5, 0, 20.4), yaw: Math.PI, hub: V3(38.5, 0, 30.6), near: { x0: 25, x1: 57, z0: 17, z1: 47 },
    gaming: { x0: 41, x1: 50, z0: 35, z1: 46 }, staffName: 'Lorraine' },
  dive: { id: 'dive', x0: -46, x1: -27.5, z0: -16, z1: 2, ceil: 3.4, spawn: V3(-37.2, 0, 6.4), yaw: 0, hub: V3(-36.5, 0, -2.5), near: { x0: -48, x1: -25, z0: -17, z1: 10 },
    gaming: { x0: -30.5, x1: -27.5, z0: -16, z1: -6 }, staffName: 'Shaz' },
};
const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
function clubInside(x, z) { for (const k in CLUBS) if (inRect(CLUBS[k], x, z)) return CLUBS[k]; return null; }
// inside, or on its own grounds (the RSL forecourt and smokers' terrace, the Anchor's footpath)
function clubAround(x, z) { for (const k in CLUBS) if (inRect(CLUBS[k].near, x, z)) return CLUBS[k]; return null; }

// ---- the rest of the game asks "am I indoors / on carpet / in a gaming room" through these: teach them about the clubs
{
  const _in = isInside, _gam = inGaming, _gy = groundY, _surf = surfaceAt, _zone = zoneFor;
  isInside = (x, z) => _in(x, z) || !!clubInside(x, z);
  inGaming = (x, z) => _gam(x, z) || inRect(CLUBS.rsl.gaming, x, z) || inRect(CLUBS.dive.gaming, x, z);
  // the Anchor's band stage is a step up
  groundY = (x, z, y) => (x > -38 && x < -29.5 && z > -16 && z < -12.6) ? 0.3 : _gy(x, z, y);
  surfaceAt = (x, z, lv) => { const c = clubInside(x, z); return c ? (c.id === 'rsl' ? 'carpet' : 'timber') : _surf(x, z, lv); };
  zoneFor = c => { const k = clubInside(c.x, c.z); if (k) return k.id; if (c.x > 50 && c.x < 56.5 && c.z > 37.5 && c.z < 46) return 'rslTerrace'; return _zone(c); };
}

// ---------------------------------------------------------------- shared bits
const ClubBits = {
  mats: {},
  bottleMats() {
    if (!this.mats.bottles) this.mats.bottles = ['#3a6a2a', '#7a4a14', '#c8c0a8', '#2a3a6a', '#8a1a14', '#d8a040', '#1a1a1a', '#5a2a6a'].map(c => M({ color: new THREE.Color(c), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.86 }));
    return this.mats.bottles;
  },
  // two tiers of bottles on a back-bar shelf running along x (axis 'x') or z (axis 'z')
  bottles(axis, fixed, a0, a1, y0, rows = 2, gap = 0.42) {
    const ms = this.bottleMats();
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * gap;
      addBoxS(SB, MAT.darkWood, axis === 'x' ? (a0 + a1) / 2 : fixed, y - 0.02, axis === 'x' ? fixed : (a0 + a1) / 2, axis === 'x' ? a1 - a0 : 0.26, 0.04, axis === 'x' ? 0.26 : a1 - a0);
      for (let a = a0 + 0.08; a < a1 - 0.06; a += rand(0.09, 0.14)) {
        const m = choice(ms), h = rand(0.22, 0.33), x = axis === 'x' ? a : fixed, z = axis === 'x' ? fixed : a;
        addCylS(SB, m, x, y + h / 2, z, 0.035, h, 8); addCylS(SB, m, x, y + h + 0.05, z, 0.012, 0.1, 6);
      }
    }
  },
  // beer taps along a counter
  taps(axis, fixed, a0, a1, y) {
    for (let a = a0; a <= a1; a += 0.32) {
      const x = axis === 'x' ? a : fixed, z = axis === 'x' ? fixed : a;
      addCylS(SB, MAT.chrome, x, y + 0.2, z, 0.025, 0.4, 8); addBoxS(SB, MAT.chrome, x, y + 0.42, z, 0.07, 0.04, 0.07);
      addBoxS(SB, M({ color: new THREE.Color(choice(['#c7352b', '#1a4a8a', '#e8b020', '#1a7a3a', '#f4f4f0'])), roughness: 0.4 }), x, y + 0.55, z, 0.035, 0.16, 0.035);
    }
  },
  // a square table with four chairs; each chair is a seat for a patron (and a meal)
  table4(b, x, z, club, area, group, tableMat = MAT.barTop) {
    blob(x, z, 1.4); addBoxS(b, tableMat, x, 0.76, z, 0.86, 0.05, 0.86); addCylS(b, MAT.iron, x, 0.38, z, 0.045, 0.76, 8); addCylS(b, MAT.iron, x, 0.02, z, 0.3, 0.04, 14);
    addCol(x, z, 0.9, 0.9);
    for (const [dx, dz, ry] of [[-0.66, 0, Math.PI / 2], [0.66, 0, -Math.PI / 2], [0, -0.66, 0], [0, 0.66, Math.PI]]) {
      chair(b, x + dx, z + dz, ry); addSpot({ kind: 'chair', pos: V3(x + dx, 0, z + dz), ry, sitH: 0.48, area, club, group });
    }
    // salt, pepper and a sauce bottle
    addCylS(b, MAT.white, x - 0.08, 0.82, z, 0.02, 0.08, 8); addCylS(b, MAT.iron, x + 0.06, 0.82, z, 0.02, 0.08, 8); addCylS(b, MAT.redPaint, x, 0.85, z + 0.12, 0.03, 0.14, 8);
  },
  // a lit board facing the given direction (ry), slightly off the wall
  board(lines, o, w, h, x, y, z, ry, glow = 1.1) { return signPlane(signTex(lines, o), w, h, x, y, z, ry, { intensity: glow, toneMapped: glow <= 1.05 }); },
  ceilingTiles() {
    if (!this.mats.tiles) this.mats.tiles = M({ map: mkTex(256, 256, (x, W, H) => { x.fillStyle = '#e8e6de'; x.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); } x.fillStyle = '#b8b4a8'; x.fillRect(0, 0, W, 6); x.fillRect(0, 0, 6, H); }), roughness: 0.95 });
    this.mats.tiles.map.wrapS = this.mats.tiles.map.wrapT = THREE.RepeatWrapping; return this.mats.tiles;
  },
  glowMat(col) { const k = 'g' + col; return this.mats[k] || (this.mats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(col) })); },
};

// an Aussie flag (blue ensign) on a canvas
function texFlag() {
  return mkTex(256, 128, (x, W, H) => {
    x.fillStyle = '#012169'; x.fillRect(0, 0, W, H);
    // the Union Jack in the canton
    x.save(); x.beginPath(); x.rect(0, 0, W / 2, H / 2); x.clip();
    x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.moveTo(0, 0); x.lineTo(W / 2, H / 2); x.moveTo(W / 2, 0); x.lineTo(0, H / 2); x.stroke();
    x.strokeStyle = '#c8102e'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(W / 2, H / 2); x.moveTo(W / 2, 0); x.lineTo(0, H / 2); x.stroke();
    x.fillStyle = '#fff'; x.fillRect(W / 4 - 9, 0, 18, H / 2); x.fillRect(0, H / 4 - 9, W / 2, 18);
    x.fillStyle = '#c8102e'; x.fillRect(W / 4 - 5, 0, 10, H / 2); x.fillRect(0, H / 4 - 5, W / 2, 10);
    x.restore();
    const star = (cx, cy, r, n = 7) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.closePath(); x.fill(); };
    x.fillStyle = '#fff'; star(W / 4, H * 0.76, 14); star(W * 0.75, H * 0.2, 7); star(W * 0.62, H * 0.47, 7); star(W * 0.75, H * 0.85, 7); star(W * 0.87, H * 0.4, 7); star(W * 0.81, H * 0.56, 4, 5);
  });
}
function texHonourBoard(title, names) {
  return mkTex(512, 640, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3a1e0e'); g.addColorStop(0.5, '#4e2a14'); g.addColorStop(1, '#3a1e0e'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#c8a040'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28);
    x.fillStyle = '#e8c86a'; x.textAlign = 'center'; x.font = 'bold 34px Rye, serif'; x.fillText(title, W / 2, 70);
    x.font = '22px Rye, serif'; x.fillText('1914 · 1918 · 1939 · 1945', W / 2, 104);
    x.font = '20px Inter, sans-serif'; names.forEach((n, i) => x.fillText(n, W / 2, 150 + i * 30));
  });
}
const HONOUR = ['ARMSTRONG W.J.', 'BAKER T.', 'CAMPBELL R.H.', 'DONNELLY P.', 'EVANS G.S.', 'FITZGERALD M.', 'GREENE A.', 'HARRIS C.E.', 'KELLY J.', 'MacDONALD D.', "O'BRIEN F.", 'PATTERSON L.', 'ROBERTSON W.', 'SULLIVAN K.', 'WATTS H.'];

// =====================================================================
//  WATTLE CREEK RSL
// =====================================================================
function buildRSL() {
  const C = CLUBS.rsl, X0 = C.x0, X1 = C.x1, Z0 = C.z0, Z1 = C.z1, H = C.ceil;
  const keep = VENUE; VENUE = VENUES.rsl;
  const carpetT = texCarpet(); VENUE = keep; carpetT.repeat.set(8, 7);
  const carpet = M({ map: carpetT, roughness: 0.96 });
  const veneer = M({ map: TEX.wainscot, color: 0xd8b888, roughness: 0.6 }), paint = M({ color: 0xefe8d6, roughness: 0.9 }), navy = M({ color: 0x1a2a5a, roughness: 0.8 }), navyTrim = M({ color: 0x14204a, roughness: 0.6 });
  const render = M({ map: texPaint('#e2d6bc'), roughness: 0.95 }, false), renderBlue = M({ color: 0x173a78, roughness: 0.7 }, false), glass = M({ color: 0x9fb8c8, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.35 }, false);
  // ---- floor, ceiling
  plane(X1 - X0, Z1 - Z0, carpet, (X0 + X1) / 2, 0.006, (Z0 + Z1) / 2);
  const tiles = ClubBits.ceilingTiles(); tiles.map.repeat.set((X1 - X0) / 1.2, (Z1 - Z0) / 1.2);
  plane(X1 - X0, Z1 - Z0, tiles, (X0 + X1) / 2, H, (Z0 + Z1) / 2, Math.PI / 2);
  // fluorescent troffers: bright, a little cool
  const lightPanel = ClubBits.glowMat('#fbfcff');
  for (let x = X0 + 2.2; x < X1 - 1; x += 3.2) for (let z = Z0 + 2.2; z < Z1 - 1; z += 3.0) { if (x > 41 && z > 35) continue; addBoxS(SB, lightPanel, x, H - 0.02, z, 1.2, 0.03, 0.6); }
  // the gaming room gets warm downlights and a LED cove instead
  for (let x = 42.5; x < 50; x += 2.2) for (let z = 36.5; z < 46; z += 2.4) SB.add(G.cyl8, ClubBits.glowMat('#ffe2b0'), x, H - 0.02, z, 0, 0, 0, 0.09, 0.02, 0.09);
  addBoxS(SB, ClubBits.glowMat('#c070ff'), 45.5, H - 0.05, 35.15, 9, 0.04, 0.05); addBoxS(SB, ClubBits.glowMat('#c070ff'), 41.15, H - 0.05, 40.5, 0.05, 0.04, 11);
  // ---- walls (front faces the street at z0; outside is -z)
  const wm = { low: [veneer, render], high: [paint, render] };
  buildWall('x', Z0, X0, X1, H, wm, -1, [{ a: 37.4, b: 39.6, bottom: 0, top: 2.7 }, { a: 28.6, b: 35.4, bottom: 0.9, top: 2.7 }, { a: 41.8, b: 48.6, bottom: 0.9, top: 2.7 }], 0.24);
  buildWall('x', Z1, X0, X1, H, { low: [veneer, render], high: [paint, render] }, 1, [], 0.24);
  buildWall('z', X0, Z0, Z1, H, { low: [veneer, render], high: [paint, render] }, -1, [], 0.24);
  buildWall('z', X1, Z0, Z1, H, { low: [veneer, render], high: [paint, render] }, 1, [{ a: 44.0, b: 45.7, bottom: 0, top: 2.5 }], 0.24);
  // gaming room partitions: the back of the bar (z 35) and the wall to the bistro (x 41) with the doorway
  buildWall('x', 35, 41, X1, H, { low: [navy, veneer], high: [navy, paint] }, -1, [], 0.18);
  buildWall('z', 41, 35, Z1, H, { low: [navy, veneer], high: [navy, paint] }, -1, [{ a: 36.6, b: 38.8, bottom: 0, top: 2.7 }], 0.18);
  // window glass + the lit inside seen from the street
  for (const [a, b] of [[28.6, 35.4], [41.8, 48.6]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 1.8), glass); g.position.set((a + b) / 2, 1.8, Z0); g.rotation.y = Math.PI; scene.add(g); addBoxS(SBX, navyTrim, (a + b) / 2, 0.86, Z0 - 0.14, b - a + 0.1, 0.08, 0.1); }
  // ---- roof and the upper facade (a two-storey club front)
  addBoxS(SBX, MAT.corr, (X0 + X1) / 2, H + 0.12, (Z0 + Z1) / 2, X1 - X0 + 0.4, 0.24, Z1 - Z0 + 0.4);
  addBoxS(SBX, render, (X0 + X1) / 2, H + 1.6, Z0 + 0.15, X1 - X0 + 0.4, 3.2, 0.5);
  const upWin = mkTex(1024, 128, (x, W, Hh) => { x.fillStyle = '#e2d6bc'; x.fillRect(0, 0, W, Hh); for (let i = 0; i < 10; i++) { const wx = 30 + i * 100; x.fillStyle = '#1a2230'; x.fillRect(wx, 26, 60, 76); x.fillStyle = 'rgba(255,220,150,.35)'; if (i % 3 === 1) x.fillRect(wx, 26, 60, 76); x.strokeStyle = '#c8bca0'; x.lineWidth = 5; x.strokeRect(wx, 26, 60, 76); } });
  signPlane(upWin, X1 - X0, 2.2, (X0 + X1) / 2, H + 1.9, Z0 - 0.11, Math.PI);
  // blue fascia band with the big lit name
  addBoxS(SBX, renderBlue, (X0 + X1) / 2, H - 0.25, Z0 - 0.2, X1 - X0 + 0.4, 0.9, 0.2);
  const nameT = signTex(['WATTLE CREEK RSL'], { w: 2048, h: 180, color: '#fff6d8', glow: '#ffd27a', glowB: 24, font: 'Bungee, Impact, sans-serif', size: 128 });
  const nm = signPlane(nameT, 15, 1.3, (X0 + X1) / 2, H - 0.25, Z0 - 0.31, Math.PI, { transparent: true, toneMapped: false, intensity: 1.6 }); dynamic.neon.push(nm);
  ClubBits.board(['SUB-BRANCH · EST. 1921', 'MEMBERS & GUESTS WELCOME'], { w: 1024, h: 256, bg: '#14305a', color: ['#e8c56a', '#fff'], sizes: [80, 64] }, 4, 1, 32, 2.0, Z0 - 0.14, Math.PI);
  // entry canopy with downlights
  addBoxS(SBX, renderBlue, 38.5, 3.05, Z0 - 1.5, 5.4, 0.22, 3.0);
  for (const px of [36.2, 40.8]) addCylS(SBX, MAT.chrome, px, 1.5, Z0 - 2.85, 0.07, 3.0, 10);
  for (const px of [37.2, 38.5, 39.8]) { SBX.add(G.cyl8, ClubBits.glowMat('#fff2d0'), px, 2.93, Z0 - 1.5, 0, 0, 0, 0.12, 0.02, 0.12); atmo.pendants && atmo.pendants.push(V3(px, 2.9, Z0 - 1.5)); }
  haloSprite(V3(38.5, 2.7, Z0 - 1.6), 4, 0xffe0b0, 0.6);
  ClubBits.board(['RSL'], { w: 256, h: 128, bg: '#c8102e', color: '#fff', font: 'Bungee, Impact', size: 84 }, 1.2, 0.6, 38.5, 3.48, Z0 - 3.0, Math.PI, 1.4);
  // automatic glass doors
  C.doors = [-1, 1].map(s => { const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.04), glass); d.position.set(38.5 + s * 0.55, 1.3, Z0); scene.add(d); const fr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.06), MAT.chrome); fr.position.y = 1.32; d.add(fr); return { m: d, s, open: 0 }; });
  // ---- the forecourt: pavers, the courtesy bus, flagpole, memorial, planters
  const pav = M({ map: mkTex(256, 256, (x, W, Hh) => { x.fillStyle = '#8a857a'; x.fillRect(0, 0, W, Hh); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { x.fillStyle = `hsl(35,${8 + Math.random() * 6}%,${44 + Math.random() * 10}%)`; x.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); } }), roughness: 0.9 }, false);
  pav.map.wrapS = pav.map.wrapT = THREE.RepeatWrapping; pav.map.repeat.set(12, 4.5);
  plane(24, 9, pav, 38, 0.012, 22.5);
  buildCourtesyBus(45.6, 21.2);
  // flagpole + flag
  addCylS(SBX, MAT.white, 29.6, 4.5, 21.0, 0.06, 9, 10); SBX.add(G.sph, MAT.brass, 29.6, 9.05, 21.0, 0, 0, 0, 0.1, 0.1, 0.1);
  const fg = new THREE.PlaneGeometry(1.9, 0.95, 12, 6); fg.translate(0.95, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: texFlag(), side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(29.66, 8.35, 21.0); scene.add(flag);
  C.flag = { m: flag, base: Float32Array.from(fg.attributes.position.array) };
  addCol(29.6, 21.0, 0.3, 0.3);
  // the memorial: a sandstone obelisk on a stepped plinth, a wreath of poppies
  const stone = M({ color: 0xc8b088, roughness: 0.9 }, false);
  addBoxS(SBX, stone, 32.8, 0.2, 21.4, 1.6, 0.4, 1.6); addBoxS(SBX, stone, 32.8, 0.55, 21.4, 1.1, 0.3, 1.1);
  SBX.add(new THREE.CylinderGeometry(0.18, 0.36, 2.6, 4), stone, 32.8, 1.95, 21.4, Math.PI / 4);
  SBX.add(new THREE.ConeGeometry(0.2, 0.35, 4), stone, 32.8, 3.42, 21.4, Math.PI / 4);
  ClubBits.board(['LEST WE', 'FORGET'], { w: 256, h: 192, bg: '#2a2418', color: '#e8c86a', font: 'Rye, serif', sizes: [56, 56] }, 0.5, 0.38, 32.8, 0.55, 20.84, Math.PI, 1.0);
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 18), M({ color: 0x1e4a1e, roughness: 0.8 }, false)); wreath.position.set(32.8, 0.95, 20.97); wreath.rotation.y = Math.PI; scene.add(wreath);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; SBX.add(G.sph, M({ color: 0xc81a1a, roughness: 0.6 }, false), 32.8 + Math.cos(a) * 0.22, 0.95 + Math.sin(a) * 0.22, 20.92, 0, 0, 0, 0.045, 0.045, 0.03); }
  addCol(32.8, 21.4, 1.7, 1.7);
  // planters along the footpath edge
  for (const px of [27.6, 31.0, 35.0, 42.0]) { addBoxS(SBX, M({ color: 0x5a5248, roughness: 0.9 }, false), px, 0.35, 18.9, 1.6, 0.7, 0.7); for (let k = 0; k < 4; k++) SBX.add(G.sph, MAT.leaf, px - 0.6 + k * 0.4, 0.85, 18.9, 0, 0, 0, 0.28, 0.32, 0.28); addCol(px, 18.9, 1.6, 0.7); }
  ClubBits.board(['FREE COURTESY BUS', 'ASK AT RECEPTION'], { w: 512, h: 256, bg: '#f4f0e6', color: ['#14305a', '#c8102e'], sizes: [64, 48], border: '#14305a' }, 0.9, 0.45, 36.0, 0.9, 25.6, Math.PI, 1.0);
  addBoxS(SBX, MAT.darkWood, 36.0, 0.45, 25.65, 0.95, 0.9, 0.06, 0); addCol(36, 25.7, 1, 0.3);
  // smokers' spot out front (the club's rules: not under the canopy)
  addSpot({ kind: 'stand', pos: V3(43.5, 0, 24.6), ry: 2.8, area: 'street', smoke: true, club: 'rsl' });
  addSpot({ kind: 'stand', pos: V3(30.6, 0, 24.8), ry: 3.4, area: 'street', smoke: true, club: 'rsl' });

  // ---- inside: the foyer ------------------------------------------------
  // reception / members' sign-in desk
  addBoxS(SB, navyTrim, 33.2, 0.52, 29.6, 2.6, 1.04, 0.7); addBoxS(SB, MAT.barTop, 33.2, 1.06, 29.6, 2.7, 0.05, 0.8); addCol(33.2, 29.6, 2.7, 0.8);
  ClubBits.board(['RECEPTION', 'MEMBERS & GUESTS PLEASE SIGN IN'], { w: 1024, h: 200, bg: '#14305a', color: ['#e8c56a', '#fff'], sizes: [80, 48] }, 2.4, 0.46, 33.2, 0.6, 29.24, Math.PI, 1.0);
  const kiosk = signTex(['SIGN IN', 'tap card ▸'], { w: 256, h: 256, bg: ['#1a3a7a', '#0a1a3a'], color: ['#fff', '#8ad8ff'], sizes: [60, 36] });
  const ks = signPlane(kiosk, 0.32, 0.32, 34.1, 1.32, 29.4, Math.PI, { intensity: 1.3, toneMapped: false }); ks.rotation.x = -0.4; addBoxS(SB, MAT.blackPlastic, 34.1, 1.2, 29.5, 0.36, 0.3, 0.05);
  addSpot({ kind: 'stand', pos: V3(33.2, 0, 30.3), ry: Math.PI, area: 'foyer', club: 'rsl', staff: true });
  // trophy cabinet against the front wall
  addBoxS(SB, MAT.darkWood, 29.4, 1.0, Z0 + 0.4, 2.4, 2.0, 0.5); const tc = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), glass); tc.position.set(29.4, 1.15, Z0 + 0.66); scene.add(tc);
  for (let i = 0; i < 7; i++) { const tx = 28.5 + i * 0.3, ty = i % 2 ? 1.5 : 0.75; addCylS(SB, MAT.brass, tx, ty + 0.12, Z0 + 0.45, 0.05, 0.24, 10); SB.add(G.sph, MAT.brass, tx, ty + 0.28, Z0 + 0.45, 0, 0, 0, 0.08, 0.06, 0.08); addCylS(SB, MAT.darkWood, tx, ty + 0.01, Z0 + 0.45, 0.06, 0.04, 8); }
  addCol(29.4, Z0 + 0.4, 2.4, 0.6);
  // the honour boards and the flags on the west wall
  signPlane(texHonourBoard('HONOUR ROLL', HONOUR.slice(0, 15)), 1.3, 1.62, X0 + 0.14, 2.2, 29.2, Math.PI / 2);
  signPlane(texHonourBoard('THEY SERVED', HONOUR.slice().reverse()), 1.3, 1.62, X0 + 0.14, 2.2, 31.0, Math.PI / 2);
  for (const [fz, rot] of [[29.6, 0.5], [30.6, -0.5]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: texFlag(), side: THREE.DoubleSide })); pl.position.set(X0 + 0.5, 3.35, fz); pl.rotation.set(0, Math.PI / 2, rot * 0.3); scene.add(pl); addCylS(SB, MAT.brass, X0 + 0.3, 3.2, fz, 0.012, 1.2, 6, 0, rot, 0); }
  ClubBits.board(['LEST WE FORGET'], { w: 1024, h: 128, bg: '#2a1a0e', color: '#e8c86a', font: 'Rye, serif', size: 76 }, 1.6, 0.2, 36.4, 2.95, Z0 + 0.14, 0, 1.0);
  const w2 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 18), M({ color: 0x1e4a1e, roughness: 0.8 })); w2.position.set(36.4, 2.35, Z0 + 0.16); scene.add(w2);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; SB.add(G.sph, M({ color: 0xc81a1a, roughness: 0.6 }), 36.4 + Math.cos(a) * 0.28, 2.35 + Math.sin(a) * 0.28, Z0 + 0.2, 0, 0, 0, 0.05, 0.05, 0.03); }
  // ---- the bar (in front of the gaming room, counter along x) -------------
  const BZ = 32.5;
  addBoxS(SB, veneer, 45.8, 0.54, BZ, 7.4, 1.08, 0.62); addBoxS(SB, MAT.barTop, 45.8, 1.1, BZ, 7.6, 0.06, 0.78); addBoxS(SB, MAT.brass, 45.8, 0.16, BZ - 0.36, 7.4, 0.04, 0.04);
  addColBox(42.1, 49.5, BZ - 0.39, BZ + 0.39); addColBox(49.5, X1, BZ - 0.39, BZ + 0.39);
  ClubBits.taps('x', BZ + 0.05, 43.6, 48.0, 1.13);
  ClubBits.bottles('x', 34.72, 42.0, 49.6, 1.25, 3, 0.4);
  addBoxS(SB, M({ color: 0x9aa8b8, roughness: 0.05, metalness: 0.9 }), 45.8, 2.35, 34.86, 7.6, 0.9, 0.02);
  addBoxS(SB, navyTrim, 45.8, 0.55, 34.6, 7.6, 1.1, 0.5);   // fridges under the back bar
  for (let x = 42.6; x < 49.4; x += 1.1) signPlane(TEX.glow, 0.9, 0.7, x, 0.6, 34.34, Math.PI, { transparent: true, intensity: 0.9 });
  neonSign(['BAR'], 45.8, 3.35, 34.82, Math.PI, 1.4, 0.45, '#ffd27a', '#ff9a2a');
  for (let i = 0; i < 6; i++) { const sx = 42.9 + i * 1.18; stool(SB, sx, BZ - 0.95, 0.76, M({ color: 0x1a3a7a, roughness: 0.5 })); addSpot({ kind: 'stool', pos: V3(sx, 0, BZ - 0.95), ry: Math.PI, sitH: 0.76, area: 'bar', club: 'rsl', group: 'rslbar' + (i >> 1) }); }
  C.staffPos = V3(45.8, 0, 33.7); C.staffRy = Math.PI; C.counter = { x: 45.8, z: BZ, axis: 'x', toward: -1 };
  addInteract({ id: 'rslbar', pos: V3(45.8, 1.1, BZ - 0.3), r: 3.6, label: () => `Order at the bar (${C.staffName})`, enabled: () => !MG.active, action: () => Clubs.openBar('rsl') });
  // ---- the bistro: tables, the servery, the TV wall -------------------------
  let tg = 0;
  for (const tx of [30.0, 33.6, 37.2]) for (const tz of [35.4, 39.4, 43.0]) ClubBits.table4(SB, tx, tz, 'rsl', 'lounge', 'rslt' + (tg++));
  // servery along the back wall
  addBoxS(SB, MAT.chrome, 31.6, 0.5, Z1 - 0.5, 7, 1.0, 0.7); addBoxS(SB, MAT.white, 31.6, 1.03, Z1 - 0.5, 7.1, 0.05, 0.8); addColBox(28, 35.2, Z1 - 0.9, Z1);
  for (let x = 28.6; x < 35; x += 1.2) { addBoxS(SB, ClubBits.glowMat('#ff9a3a'), x, 1.7, Z1 - 0.5, 0.5, 0.04, 0.2); SB.add(G.sph, MAT.chrome, x, 1.06, Z1 - 0.5, 0, 0, 0, 0.18, 0.06, 0.14); }
  neonSign(['BISTRO'], 31.6, 3.25, Z1 - 0.16, Math.PI, 2.4, 0.6, '#fff4c8', '#ff7a2a');
  ClubBits.board(['TONIGHT IN THE BISTRO', 'SCHNITZEL NIGHT $14', 'ROAST OF THE DAY $16', 'KIDS EAT FREE SUNDAY'], { w: 768, h: 512, bg: '#1a1a14', color: ['#e8c56a', '#fff', '#fff', '#8ae09a'], sizes: [64, 56, 56, 44], font: "'Permanent Marker', 'Bebas Neue', sans-serif" }, 1.6, 1.07, 36.2, 2.1, Z1 - 0.14, Math.PI, 1.0);
  for (const [tz, kind] of [[35.6, 'footy'], [39.4, 'racing'], [43.2, 'footy']]) makeTV(X0 + 0.2, 2.75, tz, Math.PI / 2, kind);
  ClubBits.board(["MEMBERS' DRAW", '$2,350', 'THURSDAY 7PM · MUST BE PRESENT'], { w: 1024, h: 512, bg: ['#c8102e', '#7a0010'], color: ['#fff', '#ffe27a', '#fff'], sizes: [96, 200, 52] }, 1.8, 0.9, 40.88, 2.6, 42.6, -Math.PI / 2, 1.3);
  ClubBits.board(['BINGO WED 7PM', 'TRIVIA THU 8PM', 'MEAT RAFFLE SAT 5PM'], { w: 768, h: 384, bg: '#f4f0e6', color: ['#14305a', '#c8102e', '#1a6a2a'], sizes: [80, 80, 80], border: '#14305a' }, 1.3, 0.65, X0 + 0.14, 2.3, 33.4, Math.PI / 2, 1.0);
  // pot plants, a fireplace-style feature heater, and a piano in the corner
  for (const [px, pz] of [[X0 + 0.5, 34.0], [40.4, 45.4], [40.4, 33.6], [X0 + 0.5, 45.3]]) { addCylS(SB, MAT.pot, px, 0.3, pz, 0.25, 0.6, 12); for (let k = 0; k < 5; k++) SB.add(G.sph, MAT.leaf, px + rand(-0.2, 0.2), 0.8 + k * 0.18, pz + rand(-0.2, 0.2), 0, 0, 0, 0.3, 0.26, 0.3); addCol(px, pz, 0.55, 0.55); }
  addSpot({ kind: 'stand', pos: V3(38.6, 0, 33.0), ry: Math.PI * 0.8, area: 'bar', club: 'rsl' });
  addSpot({ kind: 'stand', pos: V3(40.0, 0, 30.2), ry: Math.PI * 1.2, area: 'bar', club: 'rsl' });
  // ---- the gaming room ------------------------------------------------------
  const RL = VENUES.rsl.machines;
  RL.back.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(42.0 + i * 1.08, 0, 45.55), ry: Math.PI, smoke: false, club: 'rsl' }));
  RL.front.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(44.3 + i * 1.1, 0, 39.62), ry: Math.PI, smoke: false, club: 'rsl' }));
  RL.rear.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(44.3 + i * 1.1, 0, 40.38), ry: 0, smoke: false, club: 'rsl' }));
  addColBox(43.7, 46.9, 39.25, 40.75); SB.add(G.box, MAT.blackPlastic, 45.4, 1.0, 40.0, 0, 0, 0, 3.4, 2.0, 0.12);
  if (dynamic.jpBoard) for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: dynamic.jpBoard.tex, toneMapped: false })); p.material.color.setScalar(1.5); p.position.set(45.4, 3.0, 40.0 + 0.05 * s); p.rotation.y = s > 0 ? 0 : Math.PI; scene.add(p); }
  SB.add(G.box, MAT.blackPlastic, 45.4, 3.0, 40.0, 0, 0, 0, 3.3, 0.9, 0.08);
  neonSign(['GAMING'], 40.85, 3.05, 37.7, -Math.PI / 2, 1.8, 0.45, '#ffd84a', '#ff7a00');
  neonSign(['JACKPOTS'], 46.0, 3.55, Z1 - 0.18, Math.PI, 2.4, 0.5, '#ff7ad8', '#ff10a0');
  ClubBits.board(['THINK! ABOUT YOUR CHOICES', 'Set a limit. Stick to it.', 'Gambling Help: 24/7 · free · confidential'], { w: 1024, h: 384, bg: '#f4f0e6', color: ['#7a1f14', '#222', '#333'], sizes: [72, 56, 40], border: '#7a1f14', borderW: 10 }, 1.1, 0.41, 41.24, 1.65, 43.5, Math.PI / 2, 1.0);
  // ticket redemption
  addBoxS(SB, MAT.blackPlastic, 49.55, 0.875, 36.2, 0.65, 1.75, 0.75); addCol(49.55, 36.2, 0.7, 0.8);
  signPlane(signTex(['CASH', 'REDEMPTION'], { w: 256, h: 256, bg: ['#1a1a1a', '#2a6a2a'], color: '#7dff9a', sizes: [60, 40] }), 0.42, 0.42, 49.2, 1.3, 36.2, -Math.PI / 2, { toneMapped: false });
  addInteract({ id: 'rslcrt', pos: V3(49.1, 1.2, 36.2), r: 1.8, label: () => Game.state.tickets.length ? `Redeem ${Game.state.tickets.length} ticket(s) — ${fmt$(Game.state.tickets.reduce((a, b) => a + b, 0))}` : 'Cash redemption (no tickets)', action: () => Game.redeem() });
  addSpot({ kind: 'stand', pos: V3(48.6, 0, 37.4), ry: -2.4, area: 'gaming', club: 'rsl' });
  // ---- the smokers' gaming terrace (outside the east door) -----------------
  const deck = M({ map: TEX.deck, roughness: 0.85 }, false);
  plane(6.4, 8.4, deck, 53.2, 0.01, 42);
  for (let x = 50.4; x < 56.5; x += 0.9) addBoxS(SBX, MAT.darkWood, x, 3.0, 42, 0.12, 0.16, 8.4);
  addBoxS(SBX, MAT.darkWood, 53.2, 3.1, 37.9, 6.4, 0.2, 0.2); addBoxS(SBX, MAT.darkWood, 53.2, 3.1, 46.1, 6.4, 0.2, 0.2);
  for (const [px, pz] of [[56.3, 37.9], [56.3, 46.1], [50.3, 37.9]]) addCylS(SBX, MAT.darkWood, px, 1.5, pz, 0.08, 3.0, 8);
  buildWall('z', 56.4, 37.8, 46.2, 1.2, { low: [MAT.lace, MAT.lace], high: [MAT.lace, MAT.lace] }, 1, [], 0.06);
  buildWall('x', 37.8, 50, 56.4, 1.2, { low: [MAT.lace, MAT.lace], high: [MAT.lace, MAT.lace] }, -1, [], 0.06);
  buildWall('x', 46.2, 50, 56.4, 1.2, { low: [MAT.lace, MAT.lace], high: [MAT.lace, MAT.lace] }, 1, [], 0.06);
  RL.terrace.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(55.75, 0, 38.9 + i * 1.1), ry: -Math.PI / 2, smoke: true, club: 'rsl' }));
  SBX.add(new THREE.ConeGeometry(0.3, 0.25, 12), MAT.iron, 51.2, 2.3, 45.4); addCylS(SBX, MAT.iron, 51.2, 1.1, 45.4, 0.05, 2.2, 8); SBX.add(G.cyl8, ClubBits.glowMat('#ff6a1a'), 51.2, 2.17, 45.4, 0, 0, 0, 0.22, 0.02, 0.22); addCol(51.2, 45.4, 0.5, 0.5);
  addSpot({ kind: 'stand', pos: V3(52.4, 0, 44.6), ry: -2.6, area: 'terrace', smoke: true, club: 'rsl' });
  addSpot({ kind: 'stand', pos: V3(51.6, 0, 39.4), ry: 0.6, area: 'terrace', smoke: true, club: 'rsl' });
  // ---- light rigs (borrowed when you are inside; see Clubs.update) ---------
  C.lights = [[31, 3.9, 34.5, 0xfff4e0, 15, 12], [31, 3.9, 42, 0xfff4e0, 14, 12], [37, 3.9, 38.5, 0xfff4e0, 13, 12], [45.8, 3.7, 32.2, 0xffd8a0, 15, 10], [45.4, 3.6, 39.2, 0xffc8e8, 14, 9], [45.6, 3.6, 44.2, 0xc8d4ff, 12, 9]];
  zoneLight('rsl', 38.5, 3.4, 28.8, 0xfff0d8, 9, 10); zoneLight('rsl', 33, 3.8, 44, 0xffe0b0, 6, 9); zoneLight('rsl', 53, 2.8, 42, 0xffa060, 7, 9);
  zoneLight('rslTerrace', 53, 2.8, 42, 0xffa060, 9, 10); zoneLight('rslTerrace', 51.2, 2.0, 45.2, 0xff6a2a, 6, 6); zoneLight('rslTerrace', 47, 3.4, 42, 0xffc8e8, 6, 9);
  // the world edge used to run along the far footpath here; it now steps round the club
  colliders.forEach(c => { if (c.z0 === 26 && c.z1 === 27 && c.x0 === -60) c.x1 = 26.6; });
  addColBox(50, 60, 26, 27);
}
function buildCourtesyBus(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const body = M({ color: 0xf4f4f0, roughness: 0.35, metalness: 0.2 }, false), blue = M({ color: 0x173a78, roughness: 0.4 }, false), dark = M({ color: 0x0e1218, roughness: 0.1, metalness: 0.6 }, false), tyre = M({ color: 0x141414, roughness: 0.9 }, false);
  const add = (geo, m, px, py, pz, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.06), body, 0, 1.6, 0, 7.4, 2.5, 2.3);
  add(G.box, dark, 0.2, 2.15, 0, 6.6, 0.75, 2.32); add(G.box, dark, -3.71, 1.95, 0, 0.02, 1.1, 2.0);
  add(G.box, blue, 0, 1.15, 0, 7.42, 0.3, 2.32);
  for (const [wx, wz] of [[2.5, 1.05], [2.5, -1.05], [-2.4, 1.05], [-2.4, -1.05]]) { const w = add(G.cyl, tyre, wx, 0.45, wz, 0.45, 0.28, 0.45); w.rotation.x = Math.PI / 2; }
  const side = signTex(['WATTLE CREEK RSL', 'FREE COURTESY BUS · 0400 RSL BUS'], { w: 1024, h: 200, color: ['#173a78', '#c8102e'], sizes: [96, 54], font: 'Bungee, Impact' });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.1), new THREE.MeshBasicMaterial({ map: side, transparent: true })); p.position.set(0, 0.78 + 0.0, s * 1.16); p.rotation.y = s > 0 ? 0 : Math.PI; p.position.y = 0.72; g.add(p); }
  for (const s of [-0.75, 0.75]) { const h = haloSprite(V3(0, 0, 0), 0.8, 0xfff0d0, 0.6); scene.remove(h); h.position.set(-3.75, 0.8, s); g.add(h); }
  addColBox(x - 3.8, x + 3.8, z - 1.2, z + 1.2);
}

// =====================================================================
//  THE RUSTY ANCHOR
// =====================================================================
function buildDive() {
  const C = CLUBS.dive, X0 = C.x0, X1 = C.x1, Z0 = C.z0, Z1 = C.z1, H = C.ceil;
  const floor = M({ map: TEX.timber, color: 0x5a4636, roughness: 0.45 }), black = M({ color: 0x141214, roughness: 0.9 }), wain = M({ map: TEX.wainscot, color: 0x5a3a24, roughness: 0.6 });
  const tin = M({ map: TEX.corr, color: 0x2e5a58, roughness: 0.55, metalness: 0.35 }, false), brickOut = M({ map: TEX.brickDark, roughness: 0.9 }, false);
  plane(X1 - X0, Z1 - Z0, floor, (X0 + X1) / 2, 0.006, (Z0 + Z1) / 2, -Math.PI / 2, 0, 2);
  plane(X1 - X0, Z1 - Z0, black, (X0 + X1) / 2, H, (Z0 + Z1) / 2, Math.PI / 2);
  // sticky patches
  for (let i = 0; i < 14; i++) SB.add(G.plane, MAT.blob, rand(X0 + 1, X1 - 1), 0.009, rand(Z0 + 1, Z1 - 1), 0, -Math.PI / 2, 0, rand(0.6, 1.6), rand(0.6, 1.6), 1);
  const wm = { low: [wain, tin], high: [MAT.brickDark, tin] };
  buildWall('x', Z1, X0, X1, H, wm, 1, [{ a: -38.0, b: -36.4, bottom: 0, top: 2.5 }, { a: -44.6, b: -40.0, bottom: 0.95, top: 2.4 }, { a: -34.2, b: -29.4, bottom: 0.95, top: 2.4 }], 0.24);
  buildWall('x', Z0, X0, X1, H, { low: [wain, brickOut], high: [MAT.brickDark, brickOut] }, -1, [], 0.24);
  buildWall('z', X0, Z0, Z1, H, { low: [wain, brickOut], high: [MAT.brickDark, brickOut] }, -1, [], 0.24);
  buildWall('z', X1, Z0, Z1, H, { low: [wain, brickOut], high: [MAT.brickDark, brickOut] }, 1, [], 0.24);
  for (const [a, b] of [[-44.6, -40.0], [-34.2, -29.4]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 1.45), M({ color: 0x10181a, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.55 }, false)); g.position.set((a + b) / 2, 1.68, Z1); scene.add(g); }
  // roof + a weathered false front with the hand-painted name
  addBoxS(SBX, MAT.corr, (X0 + X1) / 2, H + 0.1, (Z0 + Z1) / 2, X1 - X0 + 0.3, 0.2, Z1 - Z0 + 0.3);
  addBoxS(SBX, tin, (X0 + X1) / 2, H + 0.95, Z1 - 0.1, X1 - X0 + 0.3, 1.7, 0.3);
  const painted = mkTex(1024, 160, (x, W, Hh) => {
    x.fillStyle = '#2e5a58'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#e8d8b0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 96px Rye, serif'; x.fillText('THE RUSTY ANCHOR', W / 2, Hh / 2 + 4);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < 0.6 ? '60,30,10' : '200,190,160'},${Math.random() * 0.18})`; x.fillRect(Math.random() * W, Math.random() * Hh, 3, 2); }
  });
  signPlane(painted, 15, 1.55, (X0 + X1) / 2, H + 0.95, Z1 + 0.07);
  // the neon anchor over the door
  const anchor = mkTex(256, 256, (x, W) => {
    x.strokeStyle = '#ff5a3a'; x.shadowColor = '#ff2a1a'; x.shadowBlur = 22; x.lineWidth = 12; x.lineCap = 'round';
    x.beginPath(); x.arc(W / 2, 52, 22, 0, 7); x.moveTo(W / 2, 74); x.lineTo(W / 2, 214); x.moveTo(W / 2 - 52, 104); x.lineTo(W / 2 + 52, 104);
    x.moveTo(W / 2 - 86, 160); x.quadraticCurveTo(W / 2 - 70, 226, W / 2, 222); x.quadraticCurveTo(W / 2 + 70, 226, W / 2 + 86, 160); x.stroke();
  });
  const an = signPlane(anchor, 1.3, 1.3, -37.2, 3.25, Z1 + 0.14, 0, { transparent: true, toneMapped: false, intensity: 2.2 }); dynamic.neon.push(an);
  neonSign(['COLD BEER'], -42.3, 1.95, Z1 - 0.1, 0, 2.0, 0.5, '#7ad8ff', '#1a8aff');
  neonSign(['LIVE MUSIC'], -31.8, 1.95, Z1 - 0.1, 0, 2.0, 0.5, '#ff7ad8', '#ff10a0');
  // the door, propped open with a keg
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.06), M({ color: 0x3a2618, roughness: 0.7 }, false)); leaf.position.set(-36.55, 1.2, Z1 - 0.72); leaf.rotation.y = -Math.PI / 2 + 0.25; scene.add(leaf);
  addCylS(SB, MAT.chrome, -37.6, 0.3, Z1 - 0.4, 0.2, 0.6, 14);
  // out front: chalkboard, motorbikes, a bench for the smokers
  const chalk = signTex(['LIVE TONIGHT', 'THE BOAT RAMPS', '$7 POTS TILL 9', 'NO DRAMA'], { w: 512, h: 640, bg: '#1a1a18', color: ['#fff', '#ffd27a', '#8ae0ff', '#ff8a8a'], sizes: [70, 80, 60, 50], font: "'Permanent Marker', sans-serif" });
  for (const s of [1, -1]) { const p = signPlane(chalk, 0.62, 0.78, -34.9, 0.62, Z1 + 1.2 + s * 0.12, s > 0 ? 0 : Math.PI); p.rotation.x = s * -0.2; }
  addCol(-34.9, Z1 + 1.2, 0.7, 0.4);
  for (const [bx, col] of [[-44.2, 0x1a1a1a], [-42.6, 0x8a1a14]]) buildMotorbike(bx, Z1 + 4.3, col);
  addBoxS(SBX, MAT.darkWood, -31.0, 0.45, Z1 + 0.6, 1.8, 0.06, 0.45); addBoxS(SBX, MAT.darkWood, -31.0, 0.72, Z1 + 0.4, 1.8, 0.4, 0.05); addCol(-31.0, Z1 + 0.6, 1.9, 0.6);
  // Tiny's spot at the door, then the smokers
  addSpot({ kind: 'stand', pos: V3(-38.5, 0, Z1 + 0.9), ry: 0.4, area: 'bar', club: 'dive', door: true });
  addSpot({ kind: 'chair', pos: V3(-31.5, 0, Z1 + 0.6), ry: 0, sitH: 0.48, area: 'street', smoke: true, club: 'dive', group: 'divebench' });
  addSpot({ kind: 'chair', pos: V3(-30.5, 0, Z1 + 0.6), ry: 0, sitH: 0.48, area: 'street', smoke: true, club: 'dive', group: 'divebench' });
  addSpot({ kind: 'stand', pos: V3(-33.0, 0, Z1 + 1.6), ry: 2.2, area: 'street', smoke: true, club: 'dive' });
  // ---- inside: exposed pipes, a net, nautical junk ----------------------------
  for (let x = X0 + 1.5; x < X1; x += 3.0) addBoxS(SB, MAT.darkWood, x, H - 0.12, (Z0 + Z1) / 2, 0.22, 0.24, Z1 - Z0);
  addCylS(SB, MAT.iron, (X0 + X1) / 2, H - 0.32, -9.5, 0.07, X1 - X0, 8, 0, 0, Math.PI / 2); addCylS(SB, MAT.chrome, (X0 + X1) / 2, H - 0.3, -3.0, 0.05, X1 - X0, 8, 0, 0, Math.PI / 2);
  const net = mkTex(256, 256, (x, W) => { x.strokeStyle = 'rgba(200,180,140,.8)'; x.lineWidth = 2; for (let i = -W; i < W * 2; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + W, W); x.stroke(); x.beginPath(); x.moveTo(i, W); x.lineTo(i + W, 0); x.stroke(); } });
  net.wrapS = net.wrapT = THREE.RepeatWrapping; net.repeat.set(3, 2);
  const netM = new THREE.Mesh(new THREE.PlaneGeometry(6, 4, 8, 4), new THREE.MeshBasicMaterial({ map: net, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0x8a7a5a }));
  netM.rotation.x = Math.PI / 2; netM.position.set(-36.5, H - 0.45, -7); { const p = netM.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.9) * 0.25 + Math.cos(p.getY(i) * 1.3) * 0.2); } scene.add(netM);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 10, 24), M({ color: 0xe8401a, roughness: 0.5 })); ring.position.set(X1 - 0.14, 2.3, -3.2); ring.rotation.y = Math.PI / 2; scene.add(ring);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.22), MAT.white); b.position.set(X1 - 0.14, 2.3 + Math.sin(i * Math.PI / 2) * 0.34, -3.2 + Math.cos(i * Math.PI / 2) * 0.34); scene.add(b); }
  const wheel = new THREE.Group(); wheel.position.set(X0 + 0.16, 2.3, -14.0); wheel.rotation.y = Math.PI / 2; scene.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 28), MAT.darkWood)); for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.12, 6), MAT.darkWood); sp.rotation.z = i * Math.PI / 8; wheel.add(sp); }
  poster(['THE BOAT RAMPS', 'LIVE · FRI · SAT', 'NO COVER'], ['#ffd27a', '#fff', '#8ae0ff'], '#1a2a3a', X1 - 0.03, 1.75, -3.6, -Math.PI / 2, 'stripes');
  poster(['PUB ROCK', 'RAFFLE SUNDAY', 'SNAGS $2'], ['#ff8a5a', '#fff', '#ffd27a'], '#2a1410', X0 + 0.03, 1.75, -0.9, Math.PI / 2, 'sun');
  poster(['THURSDAY', 'POOL COMP', '$50 BAR TAB'], ['#7aff9a', '#fff', '#ffd27a'], '#0e2a1a', X1 - 0.03, 1.75, -5.6, -Math.PI / 2, 'checks');
  // ---- the bar along the west wall -----------------------------------------
  const BX = -42.4;
  addBoxS(SB, M({ map: TEX.corr, color: 0x6a4a2a, roughness: 0.6, metalness: 0.3 }), BX, 0.54, -6.2, 0.62, 1.08, 10.6); addBoxS(SB, MAT.barTop, BX, 1.1, -6.2, 0.8, 0.06, 10.8);
  addColBox(BX - 0.4, BX + 0.4, -11.6, -0.8);
  ClubBits.taps('z', BX + 0.02, -8.8, -4.6, 1.13);
  ClubBits.bottles('z', X0 + 0.32, -11.4, -1.2, 1.25, 3, 0.4);
  addBoxS(SB, M({ color: 0x1a1214, roughness: 0.6 }), X0 + 0.3, 0.55, -6.3, 0.5, 1.1, 10.4);
  neonSign(['VB'], X0 + 0.2, 2.9, -9.0, Math.PI / 2, 0.9, 0.5, '#5aff7a', '#1aaa3a');
  neonSign(['XXXX'], X0 + 0.2, 2.9, -6.2, Math.PI / 2, 1.2, 0.45, '#ffd84a', '#ff9a00');
  neonSign(['BUNDY'], X0 + 0.2, 2.9, -3.4, Math.PI / 2, 1.2, 0.45, '#ff8a3a', '#ff3a1a');
  for (let i = 0; i < 7; i++) { const sz = -10.6 + i * 1.45; stool(SB, BX + 0.95, sz, 0.76, MAT.vinylBlack); addSpot({ kind: 'stool', pos: V3(BX + 0.95, 0, sz), ry: -Math.PI / 2, sitH: 0.76, area: 'bar', club: 'dive', group: 'divebar' + (i >> 1) }); }
  C.staffPos = V3(-44.0, 0, -6.2); C.staffRy = Math.PI / 2; C.counter = { x: BX, z: -6.2, axis: 'z', toward: 1 };
  addInteract({ id: 'divebar', pos: V3(BX + 0.4, 1.1, -6.2), r: 3.4, label: () => `Order at the bar (${C.staffName})`, enabled: () => !MG.active, action: () => Clubs.openBar('dive') });
  // ---- the stage -------------------------------------------------------------
  addBoxS(SB, MAT.darkWood, -33.75, 0.15, -14.3, 8.5, 0.3, 3.4);
  addBoxS(SB, ClubBits.glowMat('#ff3a6a'), -33.75, 0.31, -12.62, 8.5, 0.02, 0.04);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(8.4, H - 0.2, 24, 1), M({ color: 0x5a0a14, roughness: 0.9, side: THREE.DoubleSide }));
  { const p = curtain.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.06); } curtain.position.set(-33.75, H / 2, Z0 + 0.2); scene.add(curtain);
  // drum kit, amps, mic stands
  for (const [dx, dz, r, h] of [[-0.5, 0.0, 0.3, 0.42], [0.4, 0.2, 0.22, 0.3], [-0.1, 0.45, 0.18, 0.18], [0.75, -0.25, 0.2, 0.6]]) addCylS(SB, MAT.chrome, -33.0 + dx, 0.3 + h / 2, -15.0 + dz, r, h, 14);
  addCylS(SB, M({ color: 0xe8e0c8, roughness: 0.5 }), -33.5, 0.53, -15.0, 0.3, 0.42, 16, 0, Math.PI / 2, 0);
  for (const cx of [-32.3, -33.9]) { addCylS(SB, MAT.brass, cx, 1.35, -14.7, 0.22, 0.01, 16); addCylS(SB, MAT.chrome, cx, 0.85, -14.7, 0.012, 1.0, 6); }
  for (const [ax, az] of [[-37.0, -15.3], [-30.4, -15.3]]) { addBoxS(SB, M({ color: 0x1a1a1a, roughness: 0.7 }), ax, 0.75, az, 0.8, 0.9, 0.45); addBoxS(SB, M({ color: 0x2a2a2a, roughness: 1 }), ax, 0.75, az + 0.23, 0.7, 0.75, 0.01); }
  for (const mx of [-35.4, -33.75, -32.1]) { addCylS(SB, MAT.chrome, mx, 0.95, -13.2, 0.012, 1.3, 6); SB.add(G.sph, MAT.iron, mx, 1.62, -13.2, 0, 0, 0, 0.04, 0.05, 0.04); }
  addColBox(-38, -29.5, -16, -15.4);
  C.bandSpots = [[-35.4, -13.5, 0, 'stand'], [-33.75, -13.4, 0, 'stand'], [-32.1, -13.5, 0, 'stand'], [-33.6, -15.55, 0, 'sit']];
  // stage light cones
  for (const [lx, col] of [[-35.8, 0xff3a5a], [-33.75, 0xffffff], [-31.6, 0x3a7aff]]) { lightCone(lx, H - 0.1, -13.6, 0.12, 0.9, col, 0.22); SB.add(G.cyl8, MAT.iron, lx, H - 0.15, -13.6, 0, 0, 0, 0.12, 0.2, 0.12); }
  // ---- the pool table ---------------------------------------------------------
  const px = -36.2, pz = -6.4;
  addBoxS(SB, MAT.darkWood, px, 0.78, pz, 1.5, 0.12, 2.7); SB.add(G.box, MAT.felt, px, 0.845, pz, 0, 0, 0, 1.28, 0.01, 2.48);
  for (const cx of [-0.68, 0.68]) SB.add(G.box, MAT.darkWood, px + cx, 0.88, pz, 0, 0, 0, 0.14, 0.08, 2.7);
  for (const cz of [-1.3, 1.3]) SB.add(G.box, MAT.darkWood, px, 0.88, pz + cz, 0, 0, 0, 1.5, 0.08, 0.14);
  for (const [lx, lz] of [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2]]) SB.add(G.box, MAT.darkWood, px + lx, 0.36, pz + lz, 0, 0, 0, 0.16, 0.72, 0.16);
  [0xf2f2ee, 0xe8c52a, 0x1a3aa8, 0xc7352b, 0x5a1a8a, 0xe8772a, 0x1a7a3a, 0x111111, 0xc7352b, 0x1a3aa8].forEach(c => SB.add(G.sph, M({ color: c, roughness: 0.15 }), px + rand(-0.5, 0.5), 0.877, pz + rand(-1.0, 1.0), 0, 0, 0, 0.028, 0.028, 0.028));
  addCol(px, pz, 1.5, 2.7);
  addBoxS(SB, M({ color: 0x1a5a2a, roughness: 0.5, metalness: 0.3 }), px, 2.35, pz, 0.4, 0.14, 1.6); SB.add(G.box, ClubBits.glowMat('#fff2c8'), px, 2.27, pz, 0, 0, 0, 0.34, 0.02, 1.5);
  addCylS(SB, MAT.iron, px, 2.9, pz - 0.6, 0.01, 1.0, 6); addCylS(SB, MAT.iron, px, 2.9, pz + 0.6, 0.01, 1.0, 6);
  addSpot({ kind: 'pool', pos: V3(px + 1.1, 0, pz - 0.6), ry: -Math.PI / 2, area: 'bar', club: 'dive' });
  addSpot({ kind: 'pool', pos: V3(px - 1.1, 0, pz + 0.8), ry: Math.PI / 2, area: 'bar', club: 'dive' });
  addInteract({ id: 'divepool', pos: V3(px, 1.0, pz), r: 2.4, label: () => 'Play pool', enabled: () => !MG.active, action: () => PoolGame.offer(REG && REG.here && REG.here('Slick Rick') ? 'Slick Rick' : 'A local') });
  // a cue rack and the dartboard
  addBoxS(SB, MAT.darkWood, X1 - 0.08, 1.4, -0.8, 0.06, 1.2, 0.8); for (let i = 0; i < 5; i++) addCylS(SB, MAT.darkWood, X1 - 0.12, 1.35, -1.1 + i * 0.15, 0.012, 1.4, 6);
  if (typeof texDartboard === 'function') { const db = new THREE.Mesh(new THREE.CircleGeometry(0.23, 40), new THREE.MeshStandardMaterial({ map: texDartboard(), roughness: 0.9 })); db.position.set(X1 - 0.13, 1.73, -2.6); db.rotation.y = -Math.PI / 2; scene.add(db); }
  // ---- booths by the windows, bar leaners in the middle -------------------------
  let bg = 0;
  for (const tx of [-42.8, -32.2]) { ClubBits.table4(SB, tx, 0.55, 'dive', 'lounge', 'diveb' + (bg++), MAT.darkWood); }
  for (const [tx, tz] of [[-38.6, -10.4], [-33.6, -9.6], [-31.6, -2.6]]) {
    roundTable(SB, tx, tz, 1.05, 0.34);
    for (const [dx, dz, ry] of [[-0.6, 0, Math.PI / 2], [0.6, 0, -Math.PI / 2], [0, 0.6, Math.PI]]) addSpot({ kind: 'stand', pos: V3(tx + dx, 0, tz + dz), ry, area: 'bar', club: 'dive', group: 'divel' + tx });
  }
  // the jukebox in the corner
  const jb = new THREE.Group(); jb.position.set(X0 + 0.5, 0, -12.6); jb.rotation.y = Math.PI / 2; scene.add(jb);
  { const b = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.5, 0.6, 3, 0.2), M({ color: 0x6a2a14, roughness: 0.4 })); b.position.y = 0.75; jb.add(b); const arch = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffa84a })); arch.position.set(0, 1.12, 0.31); jb.add(arch); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ color: 0xff6aa8 })); sc.position.set(0, 0.95, 0.31); jb.add(sc); }
  addCol(X0 + 0.5, -12.6, 0.7, 1.0);
  // ---- the pokies corner ------------------------------------------------------------
  const DL = ['qotn', 'bigred', 'buffalo', 'dragon', 'qotn', 'outback', 'sevens', 'reef'];
  DL.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(X1 - 0.45, 0, -14.85 + i * 1.08), ry: -Math.PI / 2, smoke: false, club: 'dive' }));
  neonSign(['POKIES'], X1 - 0.16, 2.85, -11.0, -Math.PI / 2, 1.6, 0.45, '#ff7ad8', '#ff10a0');
  addSpot({ kind: 'stand', pos: V3(-30.2, 0, -5.0), ry: -2.2, area: 'gaming', club: 'dive' });
  // ---- light rigs --------------------------------------------------------------------
  C.lights = [[-35.6, 2.9, -13.8, 0xff2a4a, 16, 9], [-31.6, 2.9, -13.6, 0x3a6aff, 16, 9], [-44.2, 2.9, -6.0, 0xffb060, 14, 10], [-36.2, 2.2, -6.4, 0xfff0d0, 14, 6], [-29.4, 2.8, -11.0, 0xff4ab0, 11, 8], [-37.0, 2.9, -0.8, 0xffa860, 11, 9]];
  zoneLight('dive', -40, 2.8, -12, 0xff7a2a, 6, 8); zoneLight('dive', -30, 2.8, -3, 0x6a8aff, 6, 8); zoneLight('dive', -37, 2.6, 4.0, 0xff5a3a, 5, 6);
}
function buildMotorbike(x, z, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.3; scene.add(g);
  const paint = M({ color: col, roughness: 0.3, metalness: 0.5 }, false), tyre = M({ color: 0x111111, roughness: 0.9 }, false);
  for (const wz of [-0.7, 0.7]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 20), tyre); w.position.set(0, 0.36, wz); w.rotation.y = Math.PI / 2; g.add(w); }
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), paint); tank.scale.set(0.9, 0.7, 1.4); tank.position.set(0, 0.85, 0.1); g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.6), M({ color: 0x1a1210, roughness: 0.6 }, false)); seat.position.set(0, 0.86, -0.35); g.add(seat);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.3), MAT.chrome); frame.position.set(0, 0.55, 0); g.add(frame);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), MAT.chrome); bars.rotation.z = Math.PI / 2; bars.position.set(0, 1.08, 0.62); g.add(bars);
  addCol(x, z, 0.6, 1.7);
}

// =====================================================================
//  RUNNING THE CLUBS: venue follows you, borrowed lights, staff, residents, the band
// =====================================================================
const Clubs = {
  cam: null, borrowed: null, prevVenue: 'royal',
  build() { buildRSL(); buildDive(); },
  // the Royal's interior lights can't be seen from inside another building: lend them to it
  lend(C) {
    if (!this.borrowed) this.borrowed = LIGHTS.interior.filter(l => l !== dynamic.fire && l !== dynamic.heater).map(l => ({ l, p: l.position.clone(), c: l.color.clone(), i: l.intensity, d: l.distance }));
    this.borrowed.forEach((b, i) => {
      const s = C && C.lights[i];
      if (s) { b.l.position.set(s[0], s[1], s[2]); b.l.color.setHex(s[3]); b.l.intensity = s[4]; b.l.distance = s[5]; }
      else if (C) b.l.intensity = 0;
      else { b.l.position.copy(b.p); b.l.color.copy(b.c); b.l.intensity = b.i; b.l.distance = b.d; }
    });
  },
  // where the camera is; the venue (prices, exposure, songs, story gating) is the building you're in
  update(dt) {
    const c = camera.position, inC = clubInside(c.x, c.z), aroundC = clubAround(c.x, c.z);
    const id = inC ? inC.id : null;
    if (id !== this.cam) { this.cam = id; this.lend(inC); }
    const want = (inC || (aroundC && !isInside(c.x, c.z) && aroundC)) ? (inC || aroundC).id : 'royal';
    if (Game.mode === 'play' && want !== VENUE.id) {
      VENUE = VENUES[want];
      if (want !== this.prevVenue) { this.prevVenue = want; try { Music.song = Music.pick(Game.state.event); } catch (e) { /* music not ready */ } if (Game.entered || want !== 'royal') Game.toast(want === 'royal' ? 'Back at the Royal.' : `Welcome to ${VENUES[want].name}.`); }
    }
    // the RSL's sliding doors and the flag
    const R = CLUBS.rsl;
    if (R.doors) { const near = Math.hypot(c.x - 38.5, c.z - R.z0) < 3.4 || NPCS.some(n => n.state === 'walk' && Math.hypot(n.pos.x - 38.5, n.pos.z - R.z0) < 2.2); for (const d of R.doors) { d.open = damp(d.open, near ? 1 : 0, 5, dt); d.m.position.x = 38.5 + d.s * (0.55 + d.open * 1.0); } }
    if (R.flag && (c.x - 29.6) ** 2 + (c.z - 21) ** 2 < 4000) {
      const p = R.flag.m.geometry.attributes.position, b = R.flag.base, t = elapsed;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; p.setZ(i, Math.sin(x * 3.2 - t * 4.2 + y * 0.8) * 0.12 * (x / 1.9)); p.setY(i, y - x * 0.06 * (1 + Math.sin(t * 1.3) * 0.3)); }
      p.needsUpdate = true;
    }
    // the band rocks out when the music is up
    for (const n of this.band || []) { n.bandT = (n.bandT || rand(1, 4)) - dt; if (n.bandT <= 0) { n.bandT = rand(1.5, 4); if (n.bandRole !== 'drums') n.cheerT = rand(0.5, 1.2); } if (n.mg) n.mg.look = n.bandRole === 'drums' ? null : camera.position; }
  },
  // is this NPC worth simulating and drawing from where the camera is?
  live(n) {
    if (n.club) return this.cam === n.club || inRect(CLUBS[n.club].near, camera.position.x, camera.position.z) || (camera.position.x - CLUBS[n.club].hub.x) ** 2 + (camera.position.z - CLUBS[n.club].hub.z) ** 2 < 1600;
    return !this.cam;
  },
  // the night's crowd: staff behind each bar, residents on stools / at tables / on the machines, the band
  spawn() {
    const D = DAYS[Game.state.day];
    this.band = [];
    for (const id in CLUBS) {
      const C = CLUBS[id], V = VENUES[id];
      // staff
      const st = mkNPC({ name: C.staffName, fem: id === 'rsl' || Math.random() < 0.5, shirt: { tile: 'collar', c: id === 'rsl' ? 0x173a78 : 0x111111 }, pants: { tile: 'cloth', c: 0x15151a } });
      st.club = id; st.staff = true; st.smoker = false; st.gambler = false;
      MG.lockNPC(st, C.staffPos, C.staffRy, 'stand'); st.pos.copy(C.staffPos); st.ry = C.staffRy; C.staff = st;
      // regulars and punters
      const count = clamp(Math.round(D.crowd * V.crowd * 0.85 * (settings.crowd || 1)), 7, 22);
      for (let i = 0; i < count; i++) {
        const n = mkNPC(); n.club = id;
        if (id === 'rsl' && Math.random() < 0.45) { n.gambler = true; }
        const s = chooseNextSpot(n);
        if (!s) { scene.remove(n.h.root); NPCS.splice(NPCS.indexOf(n), 1); continue; }
        claim(n, s); n.pos.copy(s.pos); n.ry = s.ry; seatNPC(n);
      }
    }
    // the band on the Anchor's stage
    const roles = ['guitar', 'vocals', 'bass', 'drums'];
    CLUBS.dive.bandSpots.forEach(([x, z, ry, kind], i) => {
      const n = mkNPC({ name: ['Davo', 'Kez', 'Robbo', 'Macca'][i], shirt: { tile: choice(['hoops', 'collar', 'cloth']), c: choice([0x111111, 0x1a1a3a, 0x3a1a1a]) }, pants: { tile: 'denim', c: 0xffffff } });
      n.club = 'dive'; n.band = true; n.bandRole = roles[i]; n.smoker = false; n.gambler = false;
      MG.lockNPC(n, V3(x, 0, z), ry, kind); n.pos.set(x, 0, z); n.ry = ry; n.a.sitH = 0.55;
      if (roles[i] === 'guitar' || roles[i] === 'bass') {
        const gtr = new THREE.Group(), bodyM = M({ color: roles[i] === 'guitar' ? 0xc8201a : 0x1a1a1a, roughness: 0.3, metalness: 0.2 });
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), bodyM); b.rotation.x = Math.PI / 2; gtr.add(b);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.62), MAT.darkWood); neck.position.set(0.24, 0.12, 0); neck.rotation.y = Math.PI / 2; neck.rotation.z = 0.45; gtr.add(neck);
        gtr.position.set(-0.03, 1.02, 0.2); gtr.rotation.y = -0.3; n.h.root.add(gtr);
      }
      this.band.push(n);
    });
  },
  // ordering at a club bar: the staff pour it and put it on the counter in front of you
  openBar(id) {
    const s = Game.state, C = CLUBS[id];
    if (Game.items.length) { Game.toast('Your order\'s waiting on the bar.'); return; }
    if (s.drunk >= 95) { Game.kickOut(); return; }
    const rsa = s.drunk >= 80, holding = player.drink && player.drink.fill > 0.08, opts = [];
    for (const type of ['pot', 'schooner', 'pint', 'pale', 'scotch', 'bourbon', 'rum', 'vodka', 'water']) {
      const D = DRINKS[type], price = Game.drinkPrice(type);
      opts.push({ label: D.name, d: type === 'water' ? 'Free. Hydrate, legend.' : `${D.std} std drinks`, price: price ? fmt$(price) : 'FREE', disabled: holding || (rsa && D.std > 0), fn: () => this.order(id, type, price) });
    }
    const menu = id === 'rsl' ? [['schnitty', 14], ['roast', 16], ['parma', 19], ['chips', 6], ['pav', 8]] : [['chips', 6], ['pie', 7], ['sausageroll', 5], ['nuts', 4], ['burger', 15]];
    for (const [k, p] of menu) if (FOODS[k]) opts.push({ label: FOODS[k].name, d: id === 'rsl' ? 'From the bistro' : 'Out of the pie warmer', price: fmt$(p), fn: () => this.order(id, null, p, k) });
    opts.push({ label: 'Pack of smokes (20)', d: `You have ${s.cigs}.`, price: '$45.00', fn: () => { if (Game.spend(45, 'spentSmokes')) { s.cigs += 20; Game.toast('20 smokes.'); Game.closePanel(); } } });
    Game.openPanel(id === 'rsl' ? 'THE CLUB BAR' : 'THE BAR', rsa ? '<span style="color:#ff8a7a">"Sorry love, that\'s you done. Water?"</span>' : `Wallet ${fmt$(s.wallet)} · ${C.staffName}'s behind the bar`, Game.optList(opts));
  },
  order(id, type, price, food) {
    const C = CLUBS[id], s = Game.state;
    if (price > 0 && !Game.spend(price, food ? 'spentFood' : 'spentDrinks')) return;
    Game.closePanel(); SFX.register(C.staffPos);
    if (player.drink && player.drink.fill <= 0.08) { const g = player.drink; player.drink = null; g.group.parent && g.group.parent.remove(g.group); vm.R.curl(0.2); }
    if (type && DRINKS[type].std) { s.night.drinks++; s.stats.drinks++; s.flags.lastDrink = type; }
    if (type === 'water') Night.ev('water');
    const st = C.staff; if (st) bark(st, choice(['No worries.', 'Comin\' up.', 'Yep.', 'Easy, love.']), true);
    // where on the counter: the point nearest the player
    const K = C.counter, spot = K.axis === 'x' ? V3(clamp(player.pos.x, K.x - 3.4, K.x + 3.4), 1.14, K.z + K.toward * 0.18) : V3(K.x + K.toward * 0.18, 1.14, clamp(player.pos.z, K.z - 5, K.z + 5));
    setTimeout(() => {
      if (type) { const g = makeGlass(type); g.fill = 1; scene.add(g.group); g.group.position.copy(spot); Game.placeItem({ kind: 'drink', glass: g }, spot.clone()); }
      if (food) { const m = makeFood(food), at = spot.clone().add(K.axis === 'x' ? V3(type ? 0.35 : 0, 0, 0) : V3(0, 0, type ? 0.35 : 0)); m.position.copy(at); scene.add(m); m.userData.placedAt = elapsed + 0.001; Game.placeItem({ kind: 'food', food, mesh: m }, at); }
      if (st) bark(st, choice(['There ya go.', 'Enjoy.', 'Cheers, love.']), true);
    }, type ? 1600 : 3200);
  },
};
