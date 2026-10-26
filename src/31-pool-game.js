
// =====================================================================
//  POOL (8-ball): the playable game on the pub table, over the physics/rules/AI in 10-pool-sim.js.
//  A top-down table on a full-screen canvas.  Aim with the mouse (or arrow keys / finger), hold click or SPACE to
//  pull the cue back, release to hit.  Click the little ball (bottom right) to put spin on it.
//  Ball in hand: move the ball, click to place it.  Winner takes the pot; the loser shouts the next round.
// =====================================================================
const PoolGame = (() => {
  const BALL_CANVAS = { 1: '#e8c52a', 2: '#1a3aa8', 3: '#c7352b', 4: '#5a1a8a', 5: '#e8772a', 6: '#1a7a3a', 7: '#7a1a1a', 8: '#111111' };
  const colOf = id => BALL_CANVAS[id > 8 ? id - 8 : id];
  const R = POOL.BALL_R, T = POOL.TABLE, HW = 0.61, HL = 1.23, RAIL = 0.13;
  const qRot = (q, v) => { const [x, y, z, w] = q, [vx, vy, vz] = v; const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  let cv, cx, W = 0, H = 0, VW = 0, VH = 0, rot = false, S = 1, ox = 0, oy = 0, gm = null, ptr = { x: 0, y: 0, down: false, on: false }, spinDrag = false;

  function layout() {
    const d = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cx.setTransform(d, 0, 0, d, 0, 0);
    // a phone held upright: the table stands on its end (drawn rotated a quarter turn) so it fills the screen
    rot = H > W * 1.05; VW = rot ? H : W; VH = rot ? W : H;
    if (rot) { S = Math.min((VW - 230) / (2 * (HL + RAIL)), (VH - 130) / (2 * (HW + RAIL))); ox = VW / 2 + 10; oy = VH / 2 + 8; }
    else { S = Math.min(W * 0.9 / (2 * (HL + RAIL)), H * 0.68 / (2 * (HW + RAIL))); ox = W / 2; oy = H * 0.5 - H * 0.02; }
  }
  // table (x across, z along) -> canvas, and back.  The long axis runs left-right, foot (rack) on the left.
  const sx = z => ox + z * S, sy = x => oy + x * S, tz = px => (px - ox) / S, tx = py => (py - oy) / S;

  function drawTable() {
    const L = (HL + RAIL) * S, Wd = (HW + RAIL) * S;
    cx.save(); cx.shadowColor = 'rgba(0,0,0,.7)'; cx.shadowBlur = 40; cx.shadowOffsetY = 14;
    const wood = cx.createLinearGradient(0, oy - Wd, 0, oy + Wd); wood.addColorStop(0, '#5a3418'); wood.addColorStop(0.5, '#3e2210'); wood.addColorStop(1, '#2c180a');
    cx.fillStyle = wood; rr(ox - L - 14, oy - Wd - 14, 2 * L + 28, 2 * Wd + 28, 26); cx.fill(); cx.restore();
    // cushions + felt
    cx.fillStyle = '#0d4a2e'; rr(ox - L + 10, oy - Wd + 10, 2 * L - 20, 2 * Wd - 20, 10); cx.fill();
    const fg = cx.createRadialGradient(ox, oy, S * 0.1, ox, oy, S * 1.5); fg.addColorStop(0, '#1b8a52'); fg.addColorStop(1, '#0f5c37');
    cx.fillStyle = fg; cx.fillRect(sx(-HL), sy(-HW), 2 * HL * S, 2 * HW * S);
    // diamonds
    cx.fillStyle = '#d9c28a'; for (let i = 1; i < 8; i++) { const z = -HL + i * (2 * HL / 8); for (const x of [-HW - RAIL * 0.55, HW + RAIL * 0.55]) { cx.beginPath(); cx.arc(sx(z), sy(x), 3, 0, 7); cx.fill(); } }
    for (let i = 1; i < 4; i++) { const x = -HW + i * (2 * HW / 4); for (const z of [-HL - RAIL * 0.55, HL + RAIL * 0.55]) { cx.beginPath(); cx.arc(sx(z), sy(x), 3, 0, 7); cx.fill(); } }
    // head string + spots
    cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(sx(T.headString), sy(-HW)); cx.lineTo(sx(T.headString), sy(HW)); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,.2)'; for (const p of [T.footSpot, T.cueStart]) { cx.beginPath(); cx.arc(sx(p.z), sy(p.x), 2.5, 0, 7); cx.fill(); }
    // pockets
    for (const p of T.pockets) { cx.fillStyle = '#050403'; cx.beginPath(); cx.arc(sx(p.z), sy(p.x), S * 0.062, 0, 7); cx.fill(); cx.strokeStyle = '#b8903a'; cx.lineWidth = 2; cx.stroke(); }
  }
  function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

  function drawBall(id, x, z, q, r = R * S, alpha = 1) {
    const X = sx(z), Y = sy(x); cx.save(); cx.globalAlpha = alpha;
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.arc(X + r * 0.25, Y + r * 0.32, r, 0, 7); cx.fill();
    const stripe = id > 8, col = id === 0 ? '#f4f2ea' : colOf(id);
    cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.save(); cx.clip();
    cx.fillStyle = stripe ? '#f4f2ea' : col; cx.fillRect(X - r, Y - r, 2 * r, 2 * r);
    if (stripe) {
      const ax = q ? qRot(q, [0, 1, 0]) : [1, 0, 0], ang = Math.atan2(ax[0], ax[2]), half = r * (0.55 + 0.35 * (1 - Math.abs(ax[1])));
      cx.save(); cx.translate(X, Y); cx.rotate(ang); cx.fillStyle = col; cx.fillRect(-r, -half, 2 * r, 2 * half); cx.restore();
    }
    cx.restore();
    // the number disc rolls around with the ball
    if (id > 0) {
      const v = q ? qRot(q, [0, 0, 1]) : [0, 1, 0];
      for (const k of [1, -1]) {
        const vx = v[0] * k, vy = v[1] * k, vz = v[2] * k; if (vy < 0.08) continue;
        const dr = r * 0.44 * (0.55 + 0.45 * vy), X2 = X + vz * r * 0.9, Y2 = Y + vx * r * 0.9;
        cx.fillStyle = '#f4f2ea'; cx.beginPath(); cx.arc(X2, Y2, dr, 0, 7); cx.fill();
        cx.fillStyle = '#141414'; cx.font = `bold ${Math.max(6, Math.round(dr * 1.5))}px "Inter", sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(id, X2, Y2 + 0.5);
      }
    }
    const g = cx.createRadialGradient(X - r * 0.38, Y - r * 0.4, r * 0.05, X, Y, r); g.addColorStop(0, 'rgba(255,255,255,.65)'); g.addColorStop(0.28, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); cx.restore();
  }

  // trace the cue ball along `ang` to its first contact (ball or cushion)
  function trace(sim, ang) {
    const c = sim.balls[0], dx = Math.sin(ang), dz = Math.cos(ang); let best = Infinity, hit = null;
    for (const b of sim.balls) {
      if (b.id === 0 || b.pocketed) continue; const ex = b.x - c.x, ez = b.z - c.z, along = ex * dx + ez * dz; if (along <= 0) continue;
      const perp2 = ex * ex + ez * ez - along * along; if (perp2 > 4 * R * R) continue; const t = along - Math.sqrt(4 * R * R - perp2); if (t < best) { best = t; hit = b; }
    }
    let wall = Infinity; if (dx > 1e-6) wall = Math.min(wall, (HW - R - c.x) / dx); else if (dx < -1e-6) wall = Math.min(wall, (-HW + R - c.x) / dx);
    if (dz > 1e-6) wall = Math.min(wall, (HL - R - c.z) / dz); else if (dz < -1e-6) wall = Math.min(wall, (-HL + R - c.z) / dz);
    const t = Math.min(best, wall); return { t, hit: best < wall ? hit : null, gx: c.x + dx * t, gz: c.z + dz * t };
  }

  function drawCue(sim, ang, pull, alpha = 1) {
    const c = sim.balls[0]; if (c.pocketed) return; const dx = Math.sin(ang), dz = Math.cos(ang), gap = R + 0.012 + pull * 0.28, len = 1.45;
    const x0 = c.x - dx * gap, z0 = c.z - dz * gap, x1 = c.x - dx * (gap + len), z1 = c.z - dz * (gap + len);
    cx.save(); cx.globalAlpha = alpha; cx.lineCap = 'round';
    const g = cx.createLinearGradient(sx(z0), sy(x0), sx(z1), sy(x1)); g.addColorStop(0, '#e8d8b0'); g.addColorStop(0.05, '#d8b478'); g.addColorStop(0.55, '#7a4a22'); g.addColorStop(1, '#2a1608');
    cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = S * 0.017; cx.beginPath(); cx.moveTo(sx(z0) + 4, sy(x0) + 6); cx.lineTo(sx(z1) + 4, sy(x1) + 6); cx.stroke();
    cx.strokeStyle = g; cx.lineWidth = S * 0.013; cx.beginPath(); cx.moveTo(sx(z0), sy(x0)); cx.lineTo(sx(z1), sy(x1)); cx.stroke();
    cx.strokeStyle = '#4a9ad8'; cx.lineWidth = S * 0.0135; cx.beginPath(); cx.moveTo(sx(z0), sy(x0)); cx.lineTo(sx(z0 - dz * 0.012), sy(x0 - dx * 0.012)); cx.stroke(); cx.restore();
  }

  function hud() {
    const m = gm.match, me = 0, ai = 1, y0 = 30, my = TOUCH.on || W < 640 ? y0 + 46 : y0;
    cx.textBaseline = 'middle'; cx.textAlign = 'left'; cx.fillStyle = '#f0e2bf'; cx.font = '700 26px "Bebas Neue", Impact, sans-serif';
    const tag = (i, x, al) => { cx.textAlign = al; const g = m.groups[i]; cx.fillStyle = m.turn === i && m.winner === null ? '#ffd27a' : '#a89a78'; cx.fillText(`${i === 0 ? 'YOU' : gm.opp.name.toUpperCase()}${g ? '  ·  ' + g.toUpperCase() : ''}`, x, y0); };
    tag(me, 24, 'left'); tag(ai, W - 24, 'right');
    cx.textAlign = 'center'; cx.fillStyle = '#f0e2bf'; cx.font = '600 15px "Inter", sans-serif'; cx.fillText(gm.msg || m.lastMessage, W / 2, my + 0.5);
    if (gm.stake) { cx.fillStyle = '#9fd49a'; cx.font = '600 13px "Inter", sans-serif'; cx.fillText(`POT $${gm.stake * 2}`, W / 2, my + 20); }
    const rest = p => { const g = m.groups[p]; if (!g) return null; let n = 0; for (const b of gm.sim.balls) if (!b.pocketed && b.id && b.id !== 8 && POOL.groupOf(b.id) === g) n++; return n; };
    cx.font = '600 13px "Inter", sans-serif'; cx.fillStyle = '#a89a78';
    const a = rest(me), b = rest(ai); cx.textAlign = 'left'; cx.fillText(a == null ? 'Table open' : a === 0 ? 'Now the black' : `${a} to go`, 24, y0 + 22); cx.textAlign = 'right'; cx.fillText(b == null ? '' : b === 0 ? 'Now the black' : `${b} to go`, W - 24, y0 + 22);
    // controls
    cx.textAlign = 'center'; cx.fillStyle = 'rgba(240,226,191,.55)'; cx.font = '500 12px "Inter", sans-serif';
    const help = TOUCH.on ? (gm.phase === 'place' ? 'Tap where the cue ball goes' : gm.phase === 'aim' ? 'Touch to aim, hold to pull back (drag to adjust), let go to shoot' : gm.phase === 'over' ? 'Tap to finish' : '')
      : gm.phase === 'place' ? 'Move the ball · click (or SPACE) to place it' : gm.phase === 'aim' ? 'Aim with the mouse / arrows · hold click or SPACE, release to shoot · Q to forfeit' : gm.phase === 'over' ? 'Click or SPACE to finish' : '';
    if (W < 640) cx.font = '500 11px "Inter", sans-serif';
    cx.fillText(help, W / 2, H - (rot ? 12 : 22));
  }

  function powerBar() {
    const x = rot ? 14 : 34, y = H * 0.25, h = H * 0.5, w = rot ? 14 : 16; cx.fillStyle = 'rgba(0,0,0,.5)'; rr(x, y, w, h, 8); cx.fill(); cx.strokeStyle = 'rgba(240,226,191,.4)'; cx.lineWidth = 1; cx.stroke();
    const p = gm.power; if (p > 0) { const g = cx.createLinearGradient(0, y + h, 0, y); g.addColorStop(0, '#5cc05c'); g.addColorStop(0.6, '#e8c52a'); g.addColorStop(1, '#d6382a'); cx.fillStyle = g; rr(x + 2, y + h - (h - 4) * p - 2, w - 4, (h - 4) * p, 6); cx.fill(); }
    cx.fillStyle = 'rgba(240,226,191,.6)'; cx.font = '600 11px "Inter", sans-serif'; cx.textAlign = 'center'; cx.fillText('POWER', x + w / 2, y - 12);
  }
  function spinDial() {
    const r = rot ? 30 : 34, X = rot ? W / 2 : W - 64, Y = rot ? H - 62 : H - 82 - (TOUCH.on ? 96 : 0); gm.dial = { x: X, y: Y, r };   // clear of the touch DONE button
    cx.fillStyle = '#f4f2ea'; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.lineWidth = 2; cx.stroke();
    cx.strokeStyle = 'rgba(0,0,0,.15)'; cx.beginPath(); cx.moveTo(X - r, Y); cx.lineTo(X + r, Y); cx.moveTo(X, Y - r); cx.lineTo(X, Y + r); cx.stroke();
    cx.fillStyle = '#c7352b'; cx.beginPath(); cx.arc(X + gm.spin.side * r * 0.7, Y - gm.spin.top * r * 0.7, 6, 0, 7); cx.fill();
    cx.fillStyle = 'rgba(240,226,191,.6)'; cx.font = '600 11px "Inter", sans-serif'; cx.textAlign = 'center'; cx.fillText('SPIN', X, Y - r - 12);
  }

  function frame(dt) {
    cx.clearRect(0, 0, W, H); cx.fillStyle = 'rgba(7,4,3,.95)'; cx.fillRect(0, 0, W, H);
    cx.save(); if (rot) { cx.translate(W / 2, H / 2); cx.rotate(Math.PI / 2); cx.translate(-VW / 2, -VH / 2); }
    drawTable();
    const sim = gm.sim, m = gm.match;
    // aim guide for the human
    const showAim = gm.phase === 'aim' && m.turn === 0;
    if (showAim) {
      const tr = trace(sim, gm.angle), c = sim.balls[0];
      cx.save(); cx.setLineDash([6, 7]); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(sx(c.z), sy(c.x)); cx.lineTo(sx(tr.gz), sy(tr.gx)); cx.stroke(); cx.setLineDash([]);
      cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.beginPath(); cx.arc(sx(tr.gz), sy(tr.gx), R * S, 0, 7); cx.stroke();
      if (tr.hit) { const nx = tr.hit.x - tr.gx, nz = tr.hit.z - tr.gz, nl = Math.hypot(nx, nz) || 1; cx.strokeStyle = 'rgba(255,230,120,.8)'; cx.beginPath(); cx.moveTo(sx(tr.hit.z), sy(tr.hit.x)); cx.lineTo(sx(tr.hit.z + nz / nl * 0.35), sy(tr.hit.x + nx / nl * 0.35)); cx.stroke(); }
      cx.restore();
    }
    // balls (pocketed ones animate sinking for a moment)
    for (const b of sim.balls) { if (b.pocketed) { const a = gm.sink[b.id]; if (a != null && a < 0.35) { const k = 1 - a / 0.35, p = T.pockets[b.pocket] || { x: b.x, z: b.z }; drawBall(b.id, lerp(b.x, p.x, 1 - k), lerp(b.z, p.z, 1 - k), b.q, R * S * k, k); } continue; } drawBall(b.id, b.x, b.z, b.q); }
    if (gm.phase === 'place' && m.turn === 0) { const ok = sim.canPlaceCue(gm.px, gm.pz, m.kitchen); drawBall(0, gm.px, gm.pz, null, R * S, ok ? 0.95 : 0.35); if (!ok) { cx.strokeStyle = '#d6382a'; cx.lineWidth = 2; cx.beginPath(); cx.arc(sx(gm.pz), sy(gm.px), R * S + 4, 0, 7); cx.stroke(); } }
    if (showAim) drawCue(sim, gm.angle, gm.power);
    if (gm.phase === 'ai' && gm.aiShot && gm.t > gm.aiAt - 0.9) drawCue(sim, gm.aiShot.angle, clamp((gm.t - (gm.aiAt - 0.9)) / 0.5, 0, 1) * (gm.aiShot.power / 7) * 0.7 + 0.05);
    cx.restore();
    hud(); if (showAim || gm.phase === 'roll') { powerBar(); } spinDial();
    if (gm.phase === 'over') { cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(0, H * 0.4, W, H * 0.2); cx.fillStyle = gm.won ? '#ffd27a' : '#e8a08a'; cx.font = '700 54px "Bebas Neue", Impact, sans-serif'; cx.textAlign = 'center'; cx.fillText(gm.won ? 'YOU WIN' : gm.opp.name.toUpperCase() + ' WINS', W / 2, H * 0.5 - 6); cx.font = '500 15px "Inter", sans-serif'; cx.fillStyle = '#f0e2bf'; cx.fillText(gm.endTxt || '', W / 2, H * 0.5 + 34); }
  }

  const clickSfx = sp => SFX.noise(0.05, { freq: 2600 + sp * 120, q: 4, gain: clamp(0.02 + sp * 0.018, 0.02, 0.11) });
  function events(ev) {
    for (const e of ev) {
      if (e.type === 'ball') clickSfx(e.speed);
      else if (e.type === 'cushion') SFX.noise(0.07, { freq: 420, q: 1.2, gain: clamp(0.01 + e.speed * 0.02, 0.01, 0.07) });
      else if (e.type === 'pocket') { SFX.tone(150, 0.25, { gain: 0.09, type: 'triangle' }); SFX.noise(0.2, { freq: 300, q: 1, gain: 0.05 }); gm.sink[e.id] = 0; }
    }
  }
  function startShot(shot) {
    const sim = gm.sim, m = gm.match;
    if (shot.place) sim.placeCue(shot.place.x, shot.place.z, m.kitchen);
    m.beginShot(); sim.shoot({ angle: shot.angle, power: shot.power, spin: shot.spin }); gm.phase = 'roll'; gm.t = 0; gm.rollT = 0;
    SFX.noise(0.06, { freq: 1500, q: 3, gain: 0.08 }); if (gm.opp.n && m.turn === 1) bark(gm.opp.n, choice(["Watch this.", "Here we go.", "Easy.", "Rack 'em up."]), false);
  }
  function afterShot() {
    const m = gm.match, sim = gm.sim, prev = m.turn, r = m.endShot();
    gm.msg = m.lastMessage;
    if (m.winner !== null) return finish(m.winner === 0);
    if (r && r.rerack) { gm.sink = {}; }
    nextTurn();
    if (prev === 0 && m.turn === 1 && r && r.foul === null && r.potted.length === 0) { /* a missed shot: nothing extra */ }
    void sim;
  }
  function nextTurn() {
    const m = gm.match; gm.power = 0; gm.charging = false;
    if (m.turn === 0) { if (m.ballInHand) { gm.phase = 'place'; gm.px = sim0().balls[0].x; gm.pz = sim0().balls[0].z; if (!sim0().canPlaceCue(gm.px, gm.pz, m.kitchen)) { const s = sim0().findCueSpot(gm.px, gm.pz, m.kitchen); if (s) { gm.px = s.x; gm.pz = s.z; } } } else { gm.phase = 'aim'; aimAtNearest(); } }
    else { gm.phase = 'ai'; gm.t = 0; gm.aiShot = null; gm.aiAt = 1.5 + rand(0, 0.6); }
  }
  const sim0 = () => gm.sim;
  function aimAtNearest() {
    const c = gm.sim.balls[0], m = gm.match, ids = m.legalTargets(0); let best = null, bd = 1e9;
    for (const id of ids) { const b = gm.sim.balls[id]; const d = (b.x - c.x) ** 2 + (b.z - c.z) ** 2; if (d < bd) { bd = d; best = b; } }
    if (best) gm.angle = Math.atan2(best.x - c.x, best.z - c.z);
  }
  function finish(won) {
    const s = Game.state; gm.phase = 'over'; gm.won = won; gm.t = 0;
    if (won) { if (gm.stake) { s.wallet += gm.stake * 2; s.night.extra += gm.stake; } s.mood = Math.min(100, s.mood + 10); s.stats.poolWon = (s.stats.poolWon || 0) + 1; achieve('pool'); if (s.stats.poolWon >= 3) achieve('shark'); Night.ev('poolWon'); Night.log('🎱', `Beat ${gm.opp.name} at pool${gm.stake ? ` (+$${gm.stake})` : ''}`); Night.addRep(1.5, 'Won at pool'); if (typeof REG !== 'undefined') REG.bump(gm.opp.name, 4); SFX.cheer && SFX.cheer(V3(-3, 1, -13), 1); gm.endTxt = gm.stake ? `+$${gm.stake}` : 'Bragging rights'; }
    else { if (gm.stake) s.night.extra -= gm.stake; s.mood = Math.max(0, s.mood - 3); Night.log('🎱', `Lost at pool to ${gm.opp.name}${gm.stake ? ` (−$${gm.stake})` : ''}`); gm.endTxt = gm.stake ? `−$${gm.stake}` : 'Better luck next time'; }
    gm.msg = gm.match.lastMessage;
  }

  // ------------------------------------------------------------ input
  function toTable(e) { const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; }
  // the pointer in the table's (unrotated) drawing space
  const vx = () => rot ? VW / 2 + (ptr.y - H / 2) : ptr.x, vy = () => rot ? VH / 2 - (ptr.x - W / 2) : ptr.y;
  function updateAimFromPointer() { const c = gm.sim.balls[0], dx = tx(vy()) - c.x, dz = tz(vx()) - c.z; if (Math.hypot(dx, dz) > 0.03) gm.angle = Math.atan2(dx, dz); }
  function onDown(e) {
    toTable(e); ptr.down = true; ptr.on = true; if (e.pointerType === 'touch' || e.pointerType === 'pen') cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    if (gm.phase === 'over' && gm.t > 0.8) return PoolGame.close();
    const d = gm.dial; if (d && Math.hypot(ptr.x - d.x, ptr.y - d.y) < d.r + 6) { spinDrag = true; setSpin(); return; }
    if (gm.phase === 'place') { if (e.pointerType !== 'mouse') { gm.px = clamp(tx(vy()), -HW + R, HW - R); gm.pz = clamp(tz(vx()), -HL + R, HL - R); } place(); return; }
    if (gm.phase === 'aim') { updateAimFromPointer(); gm.charging = true; gm.power = 0.02; gm.pdir = 1; }
  }
  function onMove(e) { toTable(e); ptr.on = true; if (spinDrag) { setSpin(); return; } if (gm && gm.phase === 'place') { gm.px = clamp(tx(vy()), -HW + R, HW - R); gm.pz = clamp(tz(vx()), -HL + R, HL - R); } else if (gm && gm.phase === 'aim' && (!gm.charging || (e.pointerType === 'touch' && ptr.down))) updateAimFromPointer(); }
  function onUp() { ptr.down = false; spinDrag = false; release(); }
  function setSpin() { const d = gm.dial; gm.spin.side = clamp((ptr.x - d.x) / (d.r * 0.7), -1, 1); gm.spin.top = clamp(-(ptr.y - d.y) / (d.r * 0.7), -1, 1); const l = Math.hypot(gm.spin.side, gm.spin.top); if (l > 1) { gm.spin.side /= l; gm.spin.top /= l; } }
  function place() { if (gm.sim.placeCue(gm.px, gm.pz, gm.match.kitchen)) { SFX.click(); gm.phase = 'aim'; gm.match.lastMessage = gm.match.lastMessage; aimAtNearest(); } else SFX.tone(160, 0.12, { gain: 0.05, type: 'sawtooth' }); }
  function release() {
    if (!gm || !gm.charging) return; gm.charging = false;
    if (gm.power < 0.06) { gm.power = 0; return; }
    const pw = 0.45 + gm.power * 6.4; startShot({ angle: gm.angle, power: Math.min(7, pw), spin: { top: gm.spin.top, side: gm.spin.side } }); gm.power = 0;
  }

  const api = {
    cursor: true, state: () => gm,
    offer(who) {
      const s = Game.state, opp = who || (typeof REG !== 'undefined' && REG.here && REG.here('Spud') ? 'Spud' : 'A local');
      const opts = [0, 5, 10, 20].map(st => ({ label: st ? `Play for $${st}` : 'Friendly game', d: st ? 'Winner takes the lot' : 'Eight-ball, the way God intended', price: st ? fmt0(st) : '', disabled: st > s.wallet, fn: () => { Game.closePanel(); api.begin(st, opp); } }));
      Game.openPanel('POOL', `${opp} is keen for a frame on the house table. Eight-ball, standard rules; you break.`, Game.optList(opts));
    },
    begin(stake, who) {
      const skills = { Spud: 0.5, 'Slick Rick': 0.85, Kenno: 0.55, Bev: 0.3 }, skill = skills[who] != null ? skills[who] : rand(0.35, 0.7);
      // whichever table you're standing at (the Royal's, or the one at the Rusty Anchor)
      const tbl = SPOTS.filter(o => o.kind === 'pool').sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos))[0];
      const club = tbl ? tbl.club || null : null;
      const { n, sp } = MG.opponent(o => o.kind === 'pool' && (o.club || null) === club, who && who !== 'A local' ? who : null);
      const sim = new POOL.Sim(), match = new POOL.Match(sim, ['You', n.name], { breaker: 0, rack: false });
      gm = { sim, match, opp: { name: n.name, n }, sp, stake, skill, phase: 'place', angle: 0, power: 0, charging: false, spin: { top: 0, side: 0 }, sink: {}, t: 0, msg: '', px: T.cueStart.x, pz: T.cueStart.z, pdir: 1 };
      sim.rack(); match.newGame(0, false);
      if (stake) { Game.state.wallet -= stake; }
      MG.lockNPC(n, tbl ? tbl.pos.clone() : V3(-4.1, 0, -12.6), tbl ? tbl.ry : -Math.PI / 2); if (club) n.club = club; if (tbl && n.pos.distanceTo(tbl.pos) > 6) n.pos.copy(tbl.pos);   // a fresh local appears at the table rather than walking through walls
      MG.start(api);
    },
    enter() {
      document.exitPointerLock && document.exitPointerLock();
      if (!cv) { cv = document.createElement('canvas'); cv.id = 'poolCv'; cv.style.cssText = 'position:fixed;inset:0;z-index:22;touch-action:none;cursor:crosshair'; cx = cv.getContext('2d'); document.body.appendChild(cv); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('resize', () => { if (gm) layout(); }); }
      cv.style.display = 'block'; $('hud').style.visibility = 'hidden'; layout(); gm.msg = gm.match.lastMessage; $('mg').classList.add('hidden');
      bark(gm.opp.n, choice(["Rack's yours. Break 'em.", "Loser shouts, yeah?", "Hope you've been practising."]), true);
    },
    exit() { if (cv) cv.style.display = 'none'; $('hud').style.visibility = ''; if (gm && gm.opp.n) { MG.unlockNPC(gm.opp.n, gm.sp); } gm = null; },
    close() { MG.stop(); },
    quit() { if (gm && gm.phase !== 'over') { if (gm.stake) Game.toast(`You forfeit — ${gm.opp.name} takes the $${gm.stake * 2}.`); if (gm.stake) Game.state.night.extra -= gm.stake; Night.log('🎱', 'Walked out on a frame of pool'); } MG.stop(); },
    down() {}, up() {},
    key(code) {
      if (!gm) return;
      if (code === 'Space') { if (gm.phase === 'place') place(); else if (gm.phase === 'aim' && !gm.charging) { gm.charging = true; gm.power = 0.02; gm.pdir = 1; } else if (gm.phase === 'over') api.close(); }
    },
    keyup(code) { if (code === 'Space' && gm && gm.charging) release(); },
    update(dt) {
      if (!gm) return; gm.t += dt;
      for (const k in gm.sink) gm.sink[k] += dt;
      const sim = gm.sim, m = gm.match;
      if (gm.phase === 'aim') {
        if (keys.ArrowLeft) gm.angle -= dt * (keys.ShiftLeft ? 0.15 : 0.6); if (keys.ArrowRight) gm.angle += dt * (keys.ShiftLeft ? 0.15 : 0.6);
        if (gm.charging) { gm.power += gm.pdir * dt * 0.9; if (gm.power >= 1) { gm.power = 1; gm.pdir = -1; } if (gm.power <= 0.02) gm.pdir = 1; }
        if (!keys.Space && !ptr.down && gm.charging) release();
      } else if (gm.phase === 'roll') {
        gm.rollT += dt; events(sim.step(dt * (gm.rollT > 7 ? 3 : 1)));
        if (!sim._active || (!sim.moving() && gm.rollT > 0.3)) { if (sim.moving()) sim.simulateUntilRest(10); sim._active = false; afterShot(); }
      } else if (gm.phase === 'ai') {
        if (!gm.aiShot && gm.t > 0.7) { gm.aiShot = POOL.AI.chooseShot(sim, m, 1, gm.skill); if (gm.aiShot.place) sim.placeCue(gm.aiShot.place.x, gm.aiShot.place.z, m.kitchen); }
        if (gm.aiShot && gm.t > gm.aiAt) startShot(gm.aiShot);
      }
      frame(dt);
    },
  };
  addEventListener('keyup', e => { if (MG.active === api) api.keyup(e.code); });
  return api;
})();
globalThis.PoolGame = PoolGame;
addInteract({ id: 'pool', pos: V3(-3, 1.0, -13.2), r: 2.4, label: () => 'Play pool', enabled: () => !MG.active, action: () => PoolGame.offer() });
