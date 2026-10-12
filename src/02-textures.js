
// =====================================================================
//  PROCEDURAL TEXTURES  (+ optional online upgrades with graceful fallback)
// =====================================================================
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
function noiseFill(ctx, w, h, amt, mono = true) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += mono ? n : (Math.random() - .5) * amt; d[i + 2] += mono ? n : (Math.random() - .5) * amt; }
  ctx.putImageData(id, 0, 0);
}
const TEX = {};
function tryOnline(url, apply) {
  const l = new THREE.TextureLoader(); l.setCrossOrigin('anonymous');
  l.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; apply(t); }, undefined, () => {});
}
const ONLINE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/';

function texTimber() {
  const W = 1024, H = 1024, c = mkCanvas(W, H), x = c.getContext('2d');
  const r = mkCanvas(W, H), rx = r.getContext('2d');
  const planks = 20, pw = W / planks;
  rx.fillStyle = '#7a7a7a'; rx.fillRect(0, 0, W, H);
  for (let i = 0; i < planks; i++) {
    let y = -Math.random() * H;
    while (y < H) {
      const len = rand(H * 0.35, H * 0.9);
      const hue = rand(24, 31), light = rand(27, 34), sat = rand(48, 58);
      const g = x.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
      g.addColorStop(0, hsl(hue, sat, light - 3)); g.addColorStop(.5, hsl(hue, sat, light + 2)); g.addColorStop(1, hsl(hue, sat, light - 4));
      x.fillStyle = g; x.fillRect(i * pw, y, pw, len);
      // grain
      for (let k = 0; k < 14; k++) {
        x.strokeStyle = hsl(hue - 4, sat, light - rand(6, 14), rand(.15, .45)); x.lineWidth = rand(0.5, 2.2);
        x.beginPath(); const gx = i * pw + rand(2, pw - 2); x.moveTo(gx, y);
        for (let s = 0; s <= 12; s++) x.lineTo(gx + Math.sin(s * rand(.3, .8) + k) * rand(1, 4), y + len * s / 12);
        x.stroke();
      }
      // knots
      if (Math.random() < 0.35) { const kx = i * pw + rand(10, pw - 10), ky = y + rand(20, len - 20); const kg = x.createRadialGradient(kx, ky, 1, kx, ky, rand(5, 11)); kg.addColorStop(0, hsl(hue - 6, 60, 12, .9)); kg.addColorStop(1, hsl(hue, 50, light, 0)); x.fillStyle = kg; x.beginPath(); x.ellipse(kx, ky, 5, 10, 0, 0, 7); x.fill(); }
      // joints
      x.fillStyle = 'rgba(15,8,3,.85)'; x.fillRect(i * pw, y + len - 2, pw, 3);
      rx.fillStyle = `rgb(${randi(70, 140)},0,0)`; rx.fillRect(i * pw, y, pw, len);
      y += len;
    }
    x.fillStyle = 'rgba(10,5,2,.85)'; x.fillRect(i * pw, 0, 1.6, H);
  }
  // wear: lighter, rougher traffic path
  noiseFill(x, W, H, 14);
  const rid = rx.getImageData(0, 0, W, H), d = rid.data;
  for (let i = 0; i < d.length; i += 4) { const v = clamp(d[i] * 0.6 + 30 + (Math.random() - .5) * 40, 0, 255); d[i] = d[i + 1] = d[i + 2] = v; }
  rx.putImageData(rid, 0, 0);
  return { map: canvasTex(c, 3, 3), rough: canvasTex(r, 3, 3, false) };
}
function texBrick(dark = false) {
  const W = 512, H = 512, c = mkCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = dark ? '#3b3632' : '#8e8478'; x.fillRect(0, 0, W, H);
  const bw = 64, bh = 24, m = 4;
  for (let row = 0; row < H / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < W / bw + 1; col++) {
      const h = rand(4, 16), s = rand(40, 62), l = dark ? rand(14, 22) : rand(26, 40);
      x.fillStyle = hsl(h, s, l); x.fillRect(col * bw + off + m / 2, row * bh + m / 2, bw - m, bh - m);
      x.fillStyle = hsl(h, s, l - 8, .5); x.fillRect(col * bw + off + m / 2, row * bh + bh - m - 3, bw - m, 3);
      if (Math.random() < .2) { x.fillStyle = hsl(h, 20, l + 15, .25); x.fillRect(col * bw + off + rand(5, 40), row * bh + rand(4, 12), rand(5, 20), rand(2, 6)); }
    }
  }
  noiseFill(x, W, H, 26);
  return canvasTex(c, 1, 1);
}
function texTiles(base = '#1f5a3a', w = 256) {
  const c = mkCanvas(w, w), x = c.getContext('2d');
  x.fillStyle = '#d8d2c0'; x.fillRect(0, 0, w, w);
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const g = x.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    const col = new THREE.Color(base); const hs = {}; col.getHSL(hs);
    g.addColorStop(0, hsl(hs.h * 360, hs.s * 100, hs.l * 100 + rand(2, 8))); g.addColorStop(1, hsl(hs.h * 360, hs.s * 100, hs.l * 100 - rand(2, 8)));
    x.fillStyle = g; x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  noiseFill(x, w, w, 8);
  return canvasTex(c);
}
function texCarpet() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#3b0c14'; x.fillRect(0, 0, W, W);
  const cell = 128;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
    x.save(); x.translate(cx, cy);
    // diamond lattice
    x.strokeStyle = '#c99a2e'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -cell / 2); x.lineTo(cell / 2, 0); x.lineTo(0, cell / 2); x.lineTo(-cell / 2, 0); x.closePath(); x.stroke();
    // floral rosette
    for (let p = 0; p < 8; p++) { x.rotate(Math.PI / 4); x.fillStyle = p % 2 ? '#1b6d73' : '#d6a838'; x.beginPath(); x.ellipse(0, -20, 7, 18, 0, 0, 7); x.fill(); }
    x.fillStyle = '#7a1424'; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill();
    x.fillStyle = '#e8c35a'; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
    // swirls
    x.strokeStyle = '#2a8a7f'; x.lineWidth = 2.5;
    for (let q = 0; q < 4; q++) { x.rotate(Math.PI / 2); x.beginPath(); x.arc(cell / 2 - 18, 0, 12, Math.PI * .5, Math.PI * 1.8); x.stroke(); }
    x.restore();
  }
  noiseFill(x, W, W, 30, false);
  return canvasTex(c, 6, 6);
}
function texPressedMetal() {
  const W = 256, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, W, W);
  x.strokeStyle = '#c8c8c8'; x.lineWidth = 6;
  x.strokeRect(8, 8, W - 16, W - 16);
  x.strokeStyle = '#555'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, W - 40);
  x.save(); x.translate(W / 2, W / 2);
  for (let i = 0; i < 8; i++) { x.rotate(Math.PI / 4); x.fillStyle = '#cfcfcf'; x.beginPath(); x.ellipse(0, -46, 12, 34, 0, 0, 7); x.fill(); x.fillStyle = '#666'; x.beginPath(); x.ellipse(3, -44, 6, 26, 0, 0, 7); x.fill(); }
  x.fillStyle = '#ddd'; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill();
  x.restore();
  for (const [px, py] of [[0, 0], [W, 0], [0, W], [W, W]]) { x.fillStyle = '#d0d0d0'; x.beginPath(); x.arc(px, py, 22, 0, 7); x.fill(); }
  return canvasTex(c, 1, 1, false);
}
function texAsphalt() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#2b2b2d'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 9000; i++) { const v = randi(20, 80); x.fillStyle = `rgb(${v},${v},${v + 2})`; x.fillRect(rand(0, W), rand(0, W), rand(1, 2.5), rand(1, 2.5)); }
  for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(0,0,0,${rand(.05, .18)})`; x.beginPath(); x.ellipse(rand(0, W), rand(0, W), rand(20, 90), rand(10, 40), rand(0, 3), 0, 7); x.fill(); }
  noiseFill(x, W, W, 16);
  return canvasTex(c, 1, 1);
}
function texConcrete() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#8f8b84'; x.fillRect(0, 0, W, W);
  noiseFill(x, W, W, 30);
  for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(40,35,30,${rand(.04, .12)})`; x.beginPath(); x.ellipse(rand(0, W), rand(0, W), rand(10, 70), rand(8, 50), rand(0, 3), 0, 7); x.fill(); }
  // chewing gum spots
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(30,30,30,${rand(.3, .6)})`; x.beginPath(); x.arc(rand(0, W), rand(0, W), rand(2, 5), 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(30,28,25,.7)'; x.lineWidth = 3; x.strokeRect(0, 0, W, W);
  x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, W); x.stroke();
  return canvasTex(c, 1, 1);
}
function texWainscot() {
  const W = 256, H = 256, c = mkCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#3a1d0d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const g = x.createLinearGradient(i * 64, 0, i * 64 + 64, 0); g.addColorStop(0, '#4b2812'); g.addColorStop(.5, '#5d3418'); g.addColorStop(1, '#40210e');
    x.fillStyle = g; x.fillRect(i * 64 + 2, 0, 60, H);
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(i * 64, 0, 2, H);
    for (let k = 0; k < 18; k++) { x.strokeStyle = `rgba(20,8,2,${rand(.1, .35)})`; x.beginPath(); const gx = i * 64 + rand(4, 60); x.moveTo(gx, 0); x.bezierCurveTo(gx + rand(-4, 4), H / 3, gx + rand(-4, 4), H * 2 / 3, gx + rand(-3, 3), H); x.stroke(); }
  }
  return canvasTex(c, 1, 1);
}
function texPaint(col = '#d9cfae', streaks = true) {
  const W = 256, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, W, W); noiseFill(x, W, W, 10);
  if (streaks) for (let i = 0; i < 20; i++) { x.fillStyle = `rgba(80,60,30,${rand(.02, .05)})`; x.fillRect(rand(0, W), 0, rand(2, 20), W); }
  return canvasTex(c, 1, 1);
}
function texFelt() { const W = 256, c = mkCanvas(W, W), x = c.getContext('2d'); x.fillStyle = '#145a32'; x.fillRect(0, 0, W, W); noiseFill(x, W, W, 22); return canvasTex(c, 2, 2); }
function texDeck() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { const l = rand(28, 38); x.fillStyle = hsl(30, 12, l); x.fillRect(0, i * 64, W, 62); for (let k = 0; k < 30; k++) { x.fillStyle = hsl(30, 10, l - rand(4, 9), .3); x.fillRect(0, i * 64 + rand(0, 60), W, rand(.5, 1.5)); } x.fillStyle = '#111'; x.fillRect(0, i * 64 + 62, W, 2); }
  noiseFill(x, W, W, 12);
  return canvasTex(c, 2, 2);
}
function texCorrugated() {
  const W = 64, H = 256, c = mkCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#2a2a2a'); g.addColorStop(.25, '#f0f0f0'); g.addColorStop(.5, '#7a7a7a'); g.addColorStop(.75, '#151515'); g.addColorStop(1, '#2a2a2a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return canvasTex(c, 30, 2, false);
}
function texLace() {
  const W = 256, H = 128, c = mkCanvas(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 5;
  x.strokeRect(2, 2, W - 4, H - 4);
  x.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const cx = i * 64 + 32;
    x.beginPath(); x.arc(cx, 64, 22, 0, 7); x.stroke();
    x.beginPath(); x.arc(cx, 64, 10, 0, 7); x.stroke();
    for (let p = 0; p < 4; p++) { const a = p * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * 22, 64 + Math.sin(a) * 22); x.quadraticCurveTo(cx + Math.cos(a) * 40, 64 + Math.sin(a) * 30, cx + Math.cos(a) * 32 + (p % 3 ? 0 : 0), p < 2 ? 124 : 4); x.stroke(); }
    x.beginPath(); x.moveTo(i * 64, 4); x.lineTo(i * 64, 124); x.stroke();
    x.beginPath(); x.arc(cx, 10, 6, 0, 7); x.fill(); x.beginPath(); x.arc(cx, 118, 6, 0, 7); x.fill();
  }
  return canvasTex(c, 1, 1);
}
function texSoft(stops = [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  const c = mkCanvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
}
function texSmoke() {
  const s = 128, c = mkCanvas(s, s), x = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const px = s / 2 + rand(-22, 22), py = s / 2 + rand(-22, 22), r = rand(14, 40);
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(255,255,255,${rand(.08, .2)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  return new THREE.CanvasTexture(c);
}

// Text sign texture (lightbox / neon / painted)
function signTex(lines, o = {}) {
  const W = o.w || 1024, H = o.h || 256, c = mkCanvas(W, H), x = c.getContext('2d');
  if (o.bg) { if (Array.isArray(o.bg)) { const g = x.createLinearGradient(0, 0, 0, H); o.bg.forEach((col, i) => g.addColorStop(i / (o.bg.length - 1), col)); x.fillStyle = g; } else x.fillStyle = o.bg; x.fillRect(0, 0, W, H); }
  if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.borderW || 10; x.strokeRect(x.lineWidth / 2 + 4, x.lineWidth / 2 + 4, W - x.lineWidth - 8, H - x.lineWidth - 8); }
  const arr = Array.isArray(lines) ? lines : [lines];
  const fs = o.size || H * 0.6 / arr.length;
  arr.forEach((ln, i) => {
    const sz = Array.isArray(o.sizes) ? o.sizes[i] : fs;
    x.font = `${o.weight || 'bold'} ${sz}px ${o.font || "'Bebas Neue', Impact, sans-serif"}`;
    x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
    const ty = H / 2 + (i - (arr.length - 1) / 2) * (o.lh || fs * 1.08);
    const tx = o.align === 'left' ? (o.pad || 40) : W / 2;
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.glowB || 30; }
    if (o.stroke) { x.lineWidth = o.strokeW || 8; x.strokeStyle = o.stroke; x.strokeText(ln, tx, ty); }
    x.fillStyle = Array.isArray(o.color) ? o.color[i] : (o.color || '#fff'); x.fillText(ln, tx, ty);
    x.shadowBlur = 0;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

// Victorian damask wallpaper: cream ground, gilt motif, two motifs per tile
function texDamask() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#d6c49a'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '90,60,20' : '255,245,220'},${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  const motif = (cx, cy, s) => {
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = 'rgba(150,108,40,.55)'; x.strokeStyle = 'rgba(120,80,25,.5)'; x.lineWidth = 3;
    for (const m of [1, -1]) {
      x.save(); x.scale(m, 1);
      x.beginPath(); x.moveTo(0, -110); x.bezierCurveTo(40, -90, 60, -40, 20, -10); x.bezierCurveTo(70, 10, 70, 70, 0, 110); x.bezierCurveTo(30, 60, 30, 20, 0, 0); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(20, -60); x.bezierCurveTo(70, -80, 90, -30, 60, -10); x.stroke();
      x.beginPath(); x.arc(46, 40, 12, 0, 7); x.stroke();
      x.restore();
    }
    x.fillStyle = 'rgba(170,125,50,.6)'; x.beginPath(); x.ellipse(0, 0, 12, 22, 0, 0, 7); x.fill();
    x.restore();
  };
  motif(W / 4, W / 4, 0.95); motif(W * 3 / 4, W * 3 / 4, 0.95); motif(W * 3 / 4, W / 4, 0.45); motif(W / 4, W * 3 / 4, 0.45);
  x.strokeStyle = 'rgba(110,80,30,.15)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, W); x.stroke(); }
  return canvasTex(c, 1, 1);
}
// soft ground shadow + vertical ambient-occlusion gradient
function texLaceCurtain() {
  const W = 256, H = 420, c = mkCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W); g.addColorStop(0, 'rgba(255,214,150,.95)'); g.addColorStop(1, 'rgba(200,130,60,.75)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,248,230,.55)'; x.lineWidth = 1.2;
  for (let yy = 0; yy < H; yy += 18) for (let xx = 0; xx < W; xx += 18) { x.beginPath(); x.arc(xx + (yy / 18 % 2) * 9, yy, 6, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(60,30,10,.35)'; x.fillRect(W * 0.47, 0, W * 0.06, H); // gap between the curtains
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texBlob() { const c = mkCanvas(128, 128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function texAO() { const c = mkCanvas(8, 128), x = c.getContext('2d'); const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(0.35, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); }
function buildTextures() {
  TEX.timber = texTimber();
  TEX.brick = texBrick(); TEX.brickDark = texBrick(true);
  TEX.tileGreen = texTiles('#1d5b3c'); TEX.tileCream = texTiles('#d9c79a'); TEX.tileRed = texTiles('#7a2318');
  TEX.carpet = texCarpet();
  TEX.pressed = texPressedMetal();
  TEX.asphalt = texAsphalt();
  TEX.concrete = texConcrete();
  TEX.wainscot = texWainscot();
  TEX.paintCream = texDamask(); TEX.blob = texBlob(); TEX.ao = texAO(); TEX.paintGreen = texPaint('#2f4a3a'); TEX.paintRed = texPaint('#5a1f1a'); TEX.paintDark = texPaint('#2a2622', false);
  TEX.felt = texFelt(); TEX.deck = texDeck(); TEX.corr = texCorrugated(); TEX.lace = texLace();
  TEX.smoke = texSmoke();
  TEX.glow = texSoft([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,240,200,.6)'], [1, 'rgba(255,200,120,0)']]);
  TEX.dot = texSoft([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']], 32);
}
