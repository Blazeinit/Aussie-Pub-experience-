
// =====================================================================
//  LICENSED MACHINE SKINS
//  The supplied machine screenshots (Dragon Link family, Konami Fire Mountain, Lightning Dollar Link,
//  Thunder Empire) are used as-is: the exact screen art is the machine's display, the symbols on the
//  reels are cut out of those screens, and the game only paints live values (credit / bet / win /
//  jackpots) over the numbers that were baked into the pictures.  Assets: assets/slots, tools/slots/extract.py
// =====================================================================
const SKIN_STRIP = { am: ['#140a2e', '#2a1a5a'], pm: ['#1a0505', '#3a0a0a'], gc: ['#1a0505', '#3a0a0a'], hp: ['#0a0000', '#3a0808'], fm: ['#0a1030', '#1a2a5a'] };
const JP_COL = { GRAND: ['#ff1a1a', '#4a0000'], MAJOR: ['#1ad81a', '#003a00'], MINOR: ['#2a7aff', '#001050'], MINI: ['#ff8a1a', '#4a1c00'], MEGA: ['#ff2a2a', '#400000'] };
function skinOK(id) { const S = SLOTSKIN[id]; return !!(S && S.imgMain && S.imgSprites); }
// prepare every skin: sample the background behind each HUD value so the live numbers blend in, build the belly decal
function skinInit() {
  for (const id in GAMES) {
    const g = GAMES[id]; if (!g.skin) continue;
    if (!skinOK(id)) { g.skin = false; continue; }
    const S = SLOTSKIN[id]; S.id = id; S.hudBg = {};
    const c = mkCanvas(S.mw, S.mh), x = c.getContext('2d'); x.drawImage(S.imgMain, 0, 0, S.mw, S.mh);
    const px = (X, Y) => x.getImageData(clamp(Math.round(X), 0, S.mw - 1), clamp(Math.round(Y), 0, S.mh - 1), 1, 1).data;
    for (const k in S.hud) { const r = S.hud[k], a = px(r[0] - 3, r[1] + r[3] / 2), b = px(r[0] + r[2] + 3, r[1] + r[3] / 2); S.hudBg[k] = `rgb(${(a[0] + b[0]) >> 1},${(a[1] + b[1]) >> 1},${(a[2] + b[2]) >> 1})`; }
    S.strip = SKIN_STRIP[id] || ['#0a1030', '#1a2a5a'];
    // the belly decal on the front of the cabinet: the Konami front panel, or the logo strip from the top screen
    const bc = mkCanvas(512, 256), bx = bc.getContext('2d'); bx.fillStyle = '#0a0a10'; bx.fillRect(0, 0, 512, 256);
    if (S.imgFront) bx.drawImage(S.imgFront, 0, 0, 512, 256);
    else if (S.imgTop) { const lh = S.th * 0.30; bx.drawImage(S.imgTop, 0, 0, S.tw, lh, 20, 60, 472, 472 * lh / S.tw); }
    S.belly = canvasTex(bc, 1, 1);
    S.dims = skinDims(S); S.useHS = ['am', 'pm', 'gc', 'hp'].includes(id);
  }
}
// physical size of the screens (metres) and how the player's eye frames them
function skinDims(S) {
  let h = 0.9, w = h * S.mw / S.mh; if (w > 0.6) { w = 0.6; h = w * S.mh / S.mw; }
  const th = S.imgTop ? 0.58 * S.th / S.tw : 0, tw = 0.58;
  const headH = h + 0.1, headCy = 1.045 + headH / 2, top = headCy + headH / 2;
  return { w, h, cy: 1.05 + 0.05 + h / 2, headH, headCy, tw, th, topCy: top + 0.03 + th / 2, portrait: true, eyeY: 1.3, eyeBack: 0.14, fov: 62 + (h > 0.8 ? 3 : 0), lookY: Math.min(1.58, (1.03 + 1.1 + h) / 2 + 0.02) };
}
const _STD_DIMS = { w: 0.58, h: 0.435, cy: 1.44, portrait: false, eyeY: 1.37, eyeBack: 0, fov: 55, lookY: null };

// ---------------------------------------------------------------- painting the live numbers over the baked ones
function skinText(x, txt, cx, cy, size, fill, stroke, maxW, font = "'Bebas Neue', Impact, sans-serif") {
  x.font = `bold ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  let s = size; while (s > 8 && x.measureText(txt).width > maxW) { s -= 2; x.font = `bold ${s}px ${font}`; }
  if (stroke) { x.lineJoin = 'round'; x.lineWidth = Math.max(3, s * 0.14); x.strokeStyle = stroke; x.strokeText(txt, cx, cy + s * 0.04); }
  x.fillStyle = fill; x.fillText(txt, cx, cy + s * 0.04);
}
function skinJP(x, S, rects, bet) {
  for (const name in rects) {
    const r = rects[name], key = name === 'MEGA' ? 'MAJOR' : name, col = JP_COL[name] || JP_COL.GRAND;
    x.fillStyle = '#000'; x.fillRect(r[0], r[1], r[2], r[3]);
    const v = bet ? jpVal(key, bet) : JP[key];
    skinText(x, fmt$(v), r[0] + r[2] / 2, r[1] + r[3] / 2, Math.round(r[3] * 0.98), S.id === 'fm' && name === 'GRAND' ? '#ffe27a' : col[0], col[1], r[2] - 8);
  }
}
function skinHUD(x, S, m, hud = S.hud) {
  const credits = { credit: m.credit * 100, bet: m.bet * 100, win: (m.state === 'gamble' ? m.gambleAmt : (m.shownWin || 0)) * 100 };
  for (const k in hud) {
    const r = hud[k]; x.fillStyle = S.hudBg[k] || '#000'; x.fillRect(r[0] - 4, r[1] - 1, r[2] + 8, r[3] + 2);
    skinText(x, String(Math.round(credits[k])), r[0] + r[2] / 2, r[1] + r[3] / 2, Math.round(r[3] * 1.0), '#fff', '#000', r[2] + 4);
  }
}

// Happy & Prosperous: the supplied screen is its hold & spin screen, so the big gold coin carries the game's name between features
function skinTitle(x, S) {
  if (S.id !== 'hp' || !S.medal) return;
  const cx = S.medal[0] + S.medal[2] / 2, cy = S.medal[1] + S.medal[3] / 2;
  skinText(x, 'HAPPY &', cx, cy - 40, 92, '#1a0a00', '#ffd84a', 400, "Bungee, Impact, sans-serif");
  skinText(x, 'PROSPEROUS', cx, cy + 48, 74, '#1a0a00', '#ffd84a', 420, "Bungee, Impact, sans-serif");
  skinText(x, 'DRAGON LINK', cx, cy + 128, 34, '#8a1a00', null, 380, "Bungee, Impact, sans-serif");
}

// ---------------------------------------------------------------- Machine: draw with the skin
Machine.prototype.drawSkin = function () {
  const S = this.skin, x = this.ctx, sc = this.res_ * S.k, g = this.game, st = this.state, W = S.mw, H = S.mh;
  // a big canvas: when nothing is moving (waiting for a spin, nothing flashing) repaint only a few times a second
  if (st === 'ready' && !(this.flashT > 0) && !this.particles.length) { this._idleN = (this._idleN || 0) + 1; if (this._idleN % 10 !== 1 && this._lastCredit === this.credit && this._lastBet === this.bet) return; }
  this._lastCredit = this.credit; this._lastBet = this.bet;
  x.setTransform(sc, 0, 0, sc, 0, 0);
  const hs = st === 'holdspin' && S.useHS && SLOTSKIN.hsImg;
  const win = hs ? SLOTSKIN.hp.win.map((v, i) => v * (i % 2 ? H / SLOTSKIN.hp.mh : W / SLOTSKIN.hp.mw)) : S.win;
  x.drawImage(hs ? SLOTSKIN.hsImg : S.imgMain, 0, 0, W, H);
  skinHUD(x, S, this, hs ? SLOTSKIN.hp.hud : S.hud);
  if (!hs) skinTitle(x, S);
  if (S.jpm) skinJP(x, S, { GRAND: S.jpm.GRAND, MEGA: S.jpm.MEGA }, 0);
  // the reel stage: the engine's normal reel / hold & spin / gamble drawing, squeezed into the screen's own reel window
  x.save(); x.beginPath(); x.rect(win[0] - 3, win[1] - 3, win[2] + 6, win[3] + 6); x.clip();
  x.translate(win[0], win[1]); x.scale(win[2] / (5 * CW), win[3] / (3 * CH)); x.translate(-RX, -RY);
  if (st === 'holdspin') this.drawHold(x); else if (st === 'gamble') this.drawGamble(x); else this.drawReels(x);
  if (st === 'featIntro') {
    const k = clamp(this.st / 0.4, 0, 1);
    x.fillStyle = `rgba(0,0,0,${0.6 * k})`; x.fillRect(0, RY, SW, CH * 3);
    x.save(); x.translate(SW / 2, RY + CH * 1.5); x.scale(0.5 + easeOutBack(k) * 0.5, 0.5 + easeOutBack(k) * 0.5);
    x.shadowColor = g.theme.glow; x.shadowBlur = 40; outlineText(x, 'HOLD & SPIN', 0, -20, 96, lg(x, 0, -60, 0, 40, ['#fff', g.theme.glow, g.theme.accent]), '#1a0802', 14); x.shadowBlur = 0;
    outlineText(x, 'TRIGGERED!', 0, 70, 50, '#fff', '#000', 8); x.restore();
  }
  if (st === 'featOutro') {
    x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(0, RY, SW, CH * 3);
    outlineText(x, 'FEATURE COMPLETE', SW / 2, RY + 120, 60, g.theme.glow, '#000', 10);
    x.shadowColor = '#ffb000'; x.shadowBlur = 30; outlineText(x, fmt$(this.shownWin), SW / 2, RY + 260, 110, lg(x, 0, RY + 200, 0, RY + 320, ['#fff', '#ffe27a', '#ff9d00']), '#3a1a00', 12, 'Bebas Neue, Impact'); x.shadowBlur = 0;
  }
  if (this.free && st !== 'featOutro') { outlineText(x, `FREE GAME ${this.freeN} OF ${this.freeN + this.freeLeft}`, SW / 2, RY + 17, 26, '#fff', '#000', 5); }
  const showMsg = this.msg && (st === 'ready' || st === 'gamble' || (st === 'showWin' && !(this.win > 0 && this.wins.length && this.winLineI >= 0)));
  if (showMsg && !this.free && st !== 'holdspin') { rr(x, SW / 2 - 210, RY + CH * 3 - 50, 420, 40, 10); x.fillStyle = 'rgba(0,0,0,.72)'; x.fill(); outlineText(x, this.msg, SW / 2, RY + CH * 3 - 30, 24, '#8aff9a', '#000', 4); }
  x.restore();
  // hold & spin medal: the live count in the big gold coin
  if (hs) {
    const h = this.hs, n = h.shown.filter(Boolean).length, M = SLOTSKIN.hp.medal, cx = (M[0] + M[2] / 2) * W / SLOTSKIN.hp.mw, cy = (M[1] + M[3] / 2) * H / SLOTSKIN.hp.mh;
    const ink = '#1a0a00', gold = '#ffd84a';
    skinText(x, String(h.collect >= 0 ? Math.min(15, n) : n), cx, cy - 36, 190, ink, gold, 300, "Bungee, Impact, sans-serif");
    skinText(x, h.collect >= 0 ? 'COLLECTING' : 'COLLECTED', cx, cy + 70, 46, ink, gold, 360, "Bungee, Impact, sans-serif");
    skinText(x, h.collect >= 0 ? fmt$(h.acc || 0) : '15 WIN GRAND JACKPOT', cx, cy + 135, 32, ink, null, 330, "Bungee, Impact, sans-serif");
  }
  // big win / jackpot text and the coin shower, in screen space
  x.save(); x.scale(W / SW, H / SH);
  if (this.flashT > 0) {
    const k = 1 - this.flashT / this.flashT0, s = k < 0.15 ? easeOutBack(k / 0.15) : 1, a = this.flashT < 0.4 ? this.flashT / 0.4 : 1;
    x.save(); x.globalAlpha = a; x.translate(SW / 2, SH * 0.38); x.scale(s, s); x.rotate(Math.sin(this.t * 6) * 0.03);
    x.shadowColor = '#ff9d00'; x.shadowBlur = 50; outlineText(x, this.flashTxt, 0, 0, 120, lg(x, 0, -60, 0, 60, ['#fff', '#ffe27a', '#ff7a00']), '#3a1000', 16); x.restore();
  }
  for (const p of this.particles) { x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(Math.cos(p.r * 2), 1); x.fillStyle = rg(x, -4, -4, 1, p.s, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 0, p.s / 2, 0, 7); x.fill(); x.strokeStyle = '#6a4004'; x.lineWidth = 2; x.stroke(); x.restore(); }
  x.restore();
  this.tex.needsUpdate = true;
};

// ---------------------------------------------------------------- attract (idle) screen and top screen, shared per game
function skinAttract(id, dt) {
  const s = shared[id]; s.acc = (s.acc || 0) + dt; if (s.acc < 0.45) return; dt = s.acc; s.acc = 0;   // the idle screens only need a refresh now and then
  const S = SLOTSKIN[id], g = GAMES[id], x = s.attract.getContext('2d'); s.t += dt;
  const sc = s.attract.width / S.mw; x.setTransform(sc, 0, 0, sc, 0, 0);
  x.drawImage(S.imgMain, 0, 0, S.mw, S.mh);
  skinHUD(x, S, { credit: 0, bet: 0.5, shownWin: 0, state: 'ready' }); skinTitle(x, S);
  if (S.jpm) skinJP(x, S, { GRAND: S.jpm.GRAND, MEGA: S.jpm.MEGA }, 0);
  // a soft sheen sweeps the glass now and then
  const k = (s.t % 6) / 6; if (k < 0.35) { const X = (k / 0.35) * (S.mw + 400) - 200; const gr = x.createLinearGradient(X - 120, 0, X + 120, S.mh); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, S.mw, S.mh); }
  s.at.needsUpdate = true;
}
function skinTopper(id) {
  const s = shared[id], S = SLOTSKIN[id]; if (!S.imgTop) return;
  const x = s.topper.getContext('2d'), sc = s.topper.width / S.tw; x.setTransform(sc, 0, 0, sc, 0, 0);
  x.drawImage(S.imgTop, 0, 0, S.tw, S.th);
  if (S.jp) skinJP(x, S, S.jp, 0);
  s.tt.needsUpdate = true;
}

// ---------------------------------------------------------------- the cabinet: portrait screen, top box, LED bezel
const _skinGeo = {};
function skinHead(addS, S, gm) {
  const D = S.dims, th = GAMES[S.id].theme, hw = Math.max(0.66, D.w + 0.08), cab = cabMat();
  const led = S.led || (S.led = new THREE.MeshBasicMaterial({ color: new THREE.Color(...(th.led || [1, 0.3, 0.1])).multiplyScalar(1.4) }));
  addS(new THREE.BoxGeometry(hw, D.headH, 0.3), cab, 0, D.headCy, -0.12);
  addS(new THREE.BoxGeometry(D.w + 0.04, 0.012, 0.012), led, 0, D.cy + D.h / 2 + 0.01, 0.047); addS(new THREE.BoxGeometry(D.w + 0.04, 0.012, 0.012), led, 0, D.cy - D.h / 2 - 0.01, 0.047);
  for (const sx of [-1, 1]) { addS(new THREE.BoxGeometry(0.012, D.h + 0.04, 0.012), led, sx * (D.w / 2 + 0.01), D.cy, 0.047); addS(new THREE.BoxGeometry(0.016, D.headH, 0.03), led, sx * hw / 2, D.headCy, 0.03); }
  if (S.imgTop) {
    addS(new THREE.BoxGeometry(hw, D.th + 0.07, 0.22), cab, 0, D.topCy, -0.15);
    addS(new THREE.PlaneGeometry(D.tw, D.th), gm.topper, 0, D.topCy, -0.035);
    addS(new THREE.BoxGeometry(hw, 0.03, 0.2), led, 0, D.topCy + D.th / 2 + 0.05, -0.15);
  } else addS(new THREE.BoxGeometry(hw, 0.05, 0.2), led, 0, D.headCy + D.headH / 2 + 0.03, -0.12);
  const bm = S.bellyMat || (S.bellyMat = new THREE.MeshBasicMaterial({ map: S.belly })); bm.color.setScalar(0.85);
  addS(new THREE.PlaneGeometry(0.58, 0.29), bm, 0, 0.6, 0.312);
}
function skinScreen(add, S) {
  const D = S.dims, mat = new THREE.MeshBasicMaterial({ map: shared[S.id].at }); mat.color.setScalar(1.12);
  return add(new THREE.PlaneGeometry(D.w, D.h), mat, 0, D.cy, 0.04, 0);
}

// the Lightning Dollar Link header sign over the four-machine bank (the supplied banner, as is)
function buildSkinSigns() {
  const img = SLOTSKIN.bannerImg; if (!img) return;
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  const w = 4.36, h = w * img.height / img.width;
  signPlane(t, w, h, 10.44, 2.8, -17.82, 0, { toneMapped: false, intensity: 1.1 });
  addBoxS(SB, MAT.blackPlastic, 10.44, 2.8, -17.86, w + 0.08, h + 0.08, 0.04);
}
