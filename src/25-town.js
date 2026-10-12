
// =====================================================================
//  WATTLE CREEK MAIN STREET: the buildings either side of the Royal.
//  Every shopfront gets a painted facade (windows, awning, signage, plinth) with a matching emissive map so lit
//  windows and lightbox signs glow after dark; rooftop plant, downpipes and a parapet make the roofline read.
// =====================================================================
const Town = {
  mats: [], lastGlow: -1,
  glow(night) { if (Math.abs(night - this.lastGlow) < 0.02) return; this.lastGlow = night; for (const m of this.mats) m.emissiveIntensity = 0.04 + night * 1.3; },
};
const TOWN_KINDS = {
  hardware: { wall: '#6f808c', trim: '#e6e6e0', sign: ['#1a4a8a', '#fff', "CAMPBELL & SON HARDWARE"], shutter: true, awning: ['#1a4a8a', '#e8e8e8'] },
  bakery: { wall: '#8e3c2c', trim: '#f2e6c8', sign: ['#f2e8c8', '#5a2a14', 'WATTLE CREEK BAKERY'], awning: ['#c7352b', '#f4ead6'] },
  vacant: { wall: '#7b756a', trim: '#cfc8b8', sign: null, shutter: true, closed: true },
  newsagent: { wall: '#d9c9a2', trim: '#8a7a5a', sign: ['#c7352b', '#fff', 'NEWSAGENCY · LOTTO'], awning: ['#2a2a30', '#f2c230'] },
  chemist: { wall: '#c9d9cd', trim: '#5a7a66', sign: ['#1a8a4a', '#fff', 'WATTLE CHEMIST'], awning: ['#1a8a4a', '#f4f4ee'] },
  opshop: { wall: '#a9b9d1', trim: '#e8e8f0', sign: ['#8a2a6a', '#fff', 'SECOND CHANCE OP SHOP'], awning: ['#8a2a6a', '#f4ead6'] },
  offices: { wall: '#b9a98f', trim: '#6a5a44', sign: ['#2a2c34', '#e8c56a', 'GREENE & PARTNERS · SOLICITORS'], awning: null },
  brick: { wall: '#7a3a2a', trim: '#4a2a20', sign: null, awning: null },
};
function townRng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function texFacade(kind, wM, hM, seed) {
  const K = TOWN_KINDS[kind], rnd = townRng(seed), PX = 36, W = Math.min(1024, Math.round(wM * PX)), H = Math.round(hM * PX), s = W / wM;
  const c = mkCanvas(W, H), x = c.getContext('2d'), e = mkCanvas(W, H), ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  x.fillStyle = K.wall; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 500; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.05})`; x.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 10, 1 + rnd() * 4); }
  if (kind === 'brick') for (let y = 0; y < H; y += 5) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, W, 1); for (let xx = (y / 5 % 2) * 8; xx < W; xx += 16) x.fillRect(xx, y, 1, 5); }
  const groundH = 3.3 * s, plinth = 0.5 * s;
  // parapet cap + cornice
  x.fillStyle = K.trim; x.fillRect(0, 0, W, 0.35 * s); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0.35 * s, W, 3);
  // upper floor windows
  if (hM > 4.8) {
    const ww = 1.1 * s, wh = 1.5 * s, gap = 2.6 * s, y0 = H - groundH - 0.5 * s - wh - 0.3 * s;
    for (let wx = 0.9 * s; wx + ww < W - 0.5 * s; wx += gap) {
      const lit = rnd() < 0.3;
      x.fillStyle = K.trim; x.fillRect(wx - 5, y0 - 5, ww + 10, wh + 10);
      x.fillStyle = lit ? '#ffcf80' : '#10141c'; x.fillRect(wx, y0, ww, wh);
      if (lit) { ex.fillStyle = '#ffb860'; ex.fillRect(wx, y0, ww, wh); x.fillStyle = 'rgba(80,40,10,.35)'; for (let by = y0 + 4; by < y0 + wh; by += 7) x.fillRect(wx, by, ww, 2); }
      x.fillStyle = K.trim; x.fillRect(wx + ww / 2 - 1, y0, 2, wh); x.fillRect(wx, y0 + wh * 0.45, ww, 2); x.fillRect(wx - 7, y0 + wh + 5, ww + 14, 5);
    }
  }
  // ground floor
  const gy = H - groundH;
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, H - plinth, W, plinth); x.fillStyle = 'rgba(255,255,255,.08)'; for (let tx = 0; tx < W; tx += 0.45 * s) x.fillRect(tx, H - plinth, 1, plinth);
  if (K.sign) { // lightbox sign band
    const sy = gy + 0.1 * s, sh = 0.75 * s;
    x.fillStyle = K.sign[0]; x.fillRect(0.5 * s, sy, W - s, sh); x.strokeStyle = K.trim; x.lineWidth = 3; x.strokeRect(0.5 * s, sy, W - s, sh);
    ex.fillStyle = K.sign[0]; ex.fillRect(0.5 * s, sy, W - s, sh);
    for (const g of [x, ex]) { g.fillStyle = K.sign[1]; g.font = `${Math.round(sh * 0.58)}px Rye, Bungee, Impact, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.sign[2], W / 2, sy + sh / 2 + 2, W - 1.4 * s); }
  }
  if (K.shutter) { // roller shutter
    x.fillStyle = '#7d8284'; x.fillRect(0.5 * s, gy + 1 * s, W - s, groundH - 1 * s - plinth); x.fillStyle = 'rgba(0,0,0,.28)'; for (let ry = gy + 1 * s; ry < H - plinth; ry += 5) x.fillRect(0.5 * s, ry, W - s, 1.5);
    if (K.closed) { x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) x.fillRect(rnd() * W, gy + rnd() * groundH, 30 + rnd() * 90, 3); }   // graffiti tags and grime
  } else { // shop window and door
    const wy = gy + (K.sign ? 1.0 : 0.5) * s, wh = groundH - (K.sign ? 1.0 : 0.5) * s - plinth - 0.1 * s, doorW = 1.1 * s, doorX = W * 0.3;
    x.fillStyle = K.trim; x.fillRect(0.4 * s, wy - 4, W - 0.8 * s, wh + 8);
    const gl = x.createLinearGradient(0, wy, 0, wy + wh); gl.addColorStop(0, '#2a323c'); gl.addColorStop(1, '#10151c'); x.fillStyle = gl; x.fillRect(0.5 * s, wy, W - s, wh);
    ex.fillStyle = '#ffcf90'; ex.globalAlpha = kind === 'offices' ? 0.2 : 0.55; ex.fillRect(0.5 * s, wy + wh * 0.3, W - s, wh * 0.7); ex.globalAlpha = 1;   // shop lights spilling through the glass
    x.fillStyle = 'rgba(255,255,255,.10)'; x.beginPath(); x.moveTo(0.5 * s, wy + wh); x.lineTo(0.5 * s + 80, wy); x.lineTo(0.5 * s + 150, wy); x.lineTo(0.5 * s + 70, wy + wh); x.fill();
    x.fillStyle = K.trim; x.fillRect(doorX - 3, wy, doorW + 6, wh); x.fillStyle = '#0a0d12'; x.fillRect(doorX, wy + 4, doorW, wh - 4); x.fillStyle = '#d8b050'; x.fillRect(doorX + doorW - 8, wy + wh * 0.5, 3, 24);
    for (let mx = 0.5 * s + 40; mx < W - 0.6 * s; mx += 70 + rnd() * 90) { if (mx > doorX - 10 && mx < doorX + doorW + 10) continue; x.fillStyle = K.trim; x.fillRect(mx, wy, 3, wh); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const emap = new THREE.CanvasTexture(e); emap.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.9 }); Town.mats.push(mat);
  return mat;
}
function awningTex(a, b) { return mkTex(128, 64, (x, W, H) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * W / 8, 0, W / 8, H); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, H - 6, W, 6); }); }
function townBlock(x0, x1, zf, depth, h, facing, kind) {
  const K = TOWN_KINDS[kind], w = x1 - x0, cx = (x0 + x1) / 2, cz = zf + depth / 2 * (facing > 0 ? -1 : 1), seed = Math.round(x0 * 7 + zf * 3);
  const fac = texFacade(kind, w, h, seed), side = M({ map: TEX.brickDark, color: 0x9a8a80, roughness: 0.95 }, false), roof = M({ color: 0x4a4c50, roughness: 0.8 }, false);
  const faces = [side, side, roof, side, facing > 0 ? fac : side, facing > 0 ? side : fac];
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), faces); body.position.set(cx, h / 2, cz); body.castShadow = body.receiveShadow = true; scene.add(body);
  addColBox(x0, x1, cz - depth / 2, cz + depth / 2);
  const fz = zf + 0.0 * facing, rnd = townRng(seed + 11);
  // awning over the footpath
  if (K.awning) {
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w - 1.0, 0.06, 1.7), new THREE.MeshStandardMaterial({ map: awningTex(...K.awning), roughness: 0.8 })); aw.position.set(cx, 3.05, fz + 0.85 * facing); aw.rotation.x = 0.12 * facing; aw.castShadow = true; scene.add(aw);
    for (const ax of [x0 + 0.7, x1 - 0.7]) addCylS(SBX, MAT.iron, ax, 1.5, fz + 1.6 * facing, 0.03, 3.0, 8);
  }
  // parapet lip, downpipes, rooftop plant and an aerial
  SBX.add(G.box, MAT.iron, cx, h + 0.1, cz, 0, 0, 0, w + 0.1, 0.2, depth + 0.1);
  for (const px of [x0 + 0.25, x1 - 0.25]) addCylS(SBX, M({ color: 0x4a4e52, roughness: 0.6 }, false), px, h / 2, fz + 0.06 * facing, 0.04, h, 8);
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) SBX.add(G.box, MAT.shutter, x0 + 1.5 + rnd() * (w - 3), h + 0.55, cz + (rnd() - 0.5) * depth * 0.5, 0, 0, 0, 1.0 + rnd(), 0.7 + rnd() * 0.5, 0.9 + rnd() * 0.6);
  if (rnd() < 0.7) { const ax = x0 + 1 + rnd() * (w - 2); addCylS(SBX, MAT.iron, ax, h + 1.4, cz, 0.02, 2.4, 6); SBX.add(G.box, MAT.iron, ax, h + 2.3, cz, 0, 0, 0, 1.0, 0.03, 0.03); }
  return body;
}
