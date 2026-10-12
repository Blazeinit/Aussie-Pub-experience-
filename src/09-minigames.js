
// =====================================================================
//  MINIGAMES: shared framework (camera, input, HUD) + DARTS
// =====================================================================
// A minigame owns the camera and input while it runs. It implements any of:
//   enter(), exit(silent), update(dt,t), key(code), down(e), up(e), quit()
const MG = {
  active: null, hideHands: true,
  start(g) {
    if (this.active) this.stop(true);
    this.active = g; Game.closePanel();
    $('mg').classList.remove('hidden'); $('hints').classList.add('hidden'); $('prompt').classList.add('hidden'); $('cross').classList.add('hidden');
    this.camPos = camera.position.clone(); this.camQ = camera.quaternion.clone();
    g.enter && g.enter(); if (!g.cursor) lockPointer();
  },
  stop(silent) {
    const g = this.active; if (!g) return;
    this.active = null; g.exit && g.exit(silent);
    for (const id of ['mg', 'mgRet', 'mgPow']) $(id).classList.add('hidden');
    $('hints').classList.remove('hidden'); $('cross').classList.remove('hidden');
    Game.setText('mgTop', ''); Game.setText('mgHelp', '');
    if (Game.mode === 'play') lockPointer();
  },
  update(dt, t) { const g = this.active; if (g) g.update(dt, t); input.mx = input.my = 0; },
  top(html) { Game.setText('mgTop', html); },
  help(html) { Game.setText('mgHelp', html); },
  key(code) { const g = this.active; if (!g) return; if (code === 'KeyQ') { g.quit ? g.quit() : this.stop(); return; } g.key && g.key(code); },
  down(e) { const g = this.active; if (g && g.down) g.down(e); else if (!input.locked) lockPointer(); },
  up(e) { const g = this.active; if (g && g.up) g.up(e); },
  // smooth camera move towards pos, looking at look
  cam(pos, look, dt, k = 5, fov = null) {
    const q = _q1.setFromRotationMatrix(_m1.lookAt(pos, look, V3(0, 1, 0)));
    camera.position.lerp(pos, 1 - Math.exp(-k * dt)); camera.quaternion.slerp(q, 1 - Math.exp(-k * dt));
    if (fov && Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
  },
  // put a DOM element over a world point
  pin(el, p) { _v1.copy(p).project(camera); el.style.left = ((_v1.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _v1.y) / 2 * innerHeight) + 'px'; },
  // take an NPC out of the crowd simulation and drive them directly
  lockNPC(n, pos, ry, kind = 'stand') { n.mg = { pos: pos.clone(), ry, kind, look: null }; n.a.holdDrink = false; n.glass.group.visible = false; n.a.phone = false; n.cig.visible = false; n.a.smoking = false; },
  unlockNPC(n, spot) {
    if (!n.mg) return; n.mg = null;
    if (spot && (!spot.occ || spot.occ.reserved)) { spot.occ = null; claim(n, spot); seatNPC(n); }
    else { n.timer = 0; n.state = 'idle'; n.kind = 'stand'; }
  },
  // find someone to play: whoever is at the spot, a regular who is in tonight, or a fresh local
  opponent(spotFilter, preferName) {
    const sp = SPOTS.find(spotFilter);
    let n = sp && sp.occ && sp.occ.role === 'patron' ? sp.occ : null;
    if (!n && preferName) n = NPCS.find(o => o.name === preferName && o.state === 'idle' && !o.mg && o.role !== 'bartender');
    if (!n) { n = mkNPC({ pos: NODES.P8.clone().add(V3(0.6, 0, 0.4)) }); n.state = 'idle'; n.kind = 'stand'; }
    release(n);
    if (sp) sp.occ = { reserved: true };
    return { n, sp };
  },
};
function updateMGNPC(n, dt, t, pl) {
  const m = n.mg, a = n.a;
  const dx = m.pos.x - n.pos.x, dz = m.pos.z - n.pos.z, d = Math.hypot(dx, dz);
  let kind = m.kind;
  if (d > 0.04) { const sp = Math.min(d, 1.2 * dt); n.pos.x += dx / d * sp; n.pos.z += dz / d * sp; n.ry += angleDiff(n.ry, Math.atan2(dx, dz)) * Math.min(1, dt * 8); a.walkPh += dt * 6.5; kind = 'walk'; }
  else n.ry += angleDiff(n.ry, m.ry) * Math.min(1, dt * 6);
  const p = poseFor(n.cheerT > 0 ? 'cheer' : kind, t + a.seed, a);
  const lk = m.look || (Math.hypot(pl.x - n.pos.x, pl.z - n.pos.z) < 3 ? pl : null);
  if (lk && kind !== 'walk') { p.headY = clamp(angleDiff(n.ry, Math.atan2(lk.x - n.pos.x, lk.z - n.pos.z)), -1.1, 1.1); }
  applyPose(n.h, p, dt, 10); faceAnim(n, dt, t);
  n.phone.visible = false;
  n.h.root.position.set(n.pos.x, groundY(n.pos.x, n.pos.z), n.pos.z); n.h.root.rotation.y = n.ry;
}

// ---------------------------------------------------------------------
//  DARTS — 3 rounds of 3 darts, highest total wins, against a local
// ---------------------------------------------------------------------
const DARTS = {
  C: V3(-7.0, 1.73, -17.8), R: 0.2255, OCHE_Z: -17.8 + 2.37,
  SEG: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],
  RAD: { bullIn: 0.00635, bullOut: 0.0159, trebIn: 0.099, trebOut: 0.107, dblIn: 0.162, dblOut: 0.170 },
  board: null, darts: [], skill: 0,
};
function texDartboard() {
  const S = 1024, c = mkCanvas(S, S), x = c.getContext('2d'), cx = S / 2, k = (S / 2) / DARTS.R, R = DARTS.RAD;
  x.fillStyle = '#0d0d0d'; x.beginPath(); x.arc(cx, cx, S / 2, 0, 7); x.fill();
  const seg = (r0, r1, a0, a1, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cx, r1 * k, a0, a1); x.arc(cx, cx, r0 * k, a1, a0, true); x.closePath(); x.fill(); };
  for (let i = 0; i < 20; i++) {
    // canvas angles: 0 = +x, clockwise. segment i is centred i*18° clockwise from the top.
    const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10, dark = i % 2 === 0;
    seg(R.bullOut, R.trebIn, a0, a1, dark ? '#151311' : '#efe3c2');
    seg(R.trebOut, R.dblIn, a0, a1, dark ? '#151311' : '#efe3c2');
    seg(R.trebIn, R.trebOut, a0, a1, dark ? '#c0281f' : '#1d7a3c');
    seg(R.dblIn, R.dblOut, a0, a1, dark ? '#c0281f' : '#1d7a3c');
  }
  x.fillStyle = '#1d7a3c'; x.beginPath(); x.arc(cx, cx, R.bullOut * k, 0, 7); x.fill();
  x.fillStyle = '#c0281f'; x.beginPath(); x.arc(cx, cx, R.bullIn * k, 0, 7); x.fill();
  // sisal fibre: tiny radial specks
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
  // spider wire
  x.strokeStyle = 'rgba(205,205,210,.9)'; x.lineWidth = 2.2;
  for (const r of [R.bullIn, R.bullOut, R.trebIn, R.trebOut, R.dblIn, R.dblOut]) { x.beginPath(); x.arc(cx, cx, r * k, 0, 7); x.stroke(); }
  for (let i = 0; i < 20; i++) { const a = (-90 - 9 + i * 18) * Math.PI / 180; x.beginPath(); x.moveTo(cx + Math.cos(a) * R.bullOut * k, cx + Math.sin(a) * R.bullOut * k); x.lineTo(cx + Math.cos(a) * R.dblOut * k, cx + Math.sin(a) * R.dblOut * k); x.stroke(); }
  // number ring
  x.fillStyle = '#f2f0ea'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 54px "Bebas Neue", Impact, sans-serif';
  for (let i = 0; i < 20; i++) { const a = (-90 + i * 18) * Math.PI / 180, r = 0.197 * k; x.save(); x.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r); x.rotate(a + Math.PI / 2); x.fillText(DARTS.SEG[i], 0, 0); x.restore(); }
  x.strokeStyle = 'rgba(205,205,210,.6)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cx, 0.181 * k, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function buildDartboard() {
  const g = new THREE.Group(); g.position.copy(DARTS.C); scene.add(g);
  const bt = texDartboard(); // the board's own little lamp: a touch of self-light instead of another real light
  const face = new THREE.Mesh(new THREE.CircleGeometry(DARTS.R, 72), new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.95 }));
  face.position.z = 0.021; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(DARTS.R + 0.004, DARTS.R + 0.004, 0.042, 64, 1, true), MAT.blackPlastic); rim.rotation.x = Math.PI / 2; g.add(rim);
  // surround ring (protects the wall) + little lamp
  const sur = new THREE.Mesh(new THREE.RingGeometry(DARTS.R + 0.004, 0.3, 48), M({ color: 0x2a2624, roughness: 0.9 })); sur.position.z = 0.004; g.add(sur);
  SB.add(G.box, MAT.iron, -7.0, 2.14, -17.7, 0, 0, 0, 0.6, 0.03, 0.22);
  const lampGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), MAT.bulb); lampGlow.rotation.x = Math.PI / 2; lampGlow.position.set(-7.0, 2.124, -17.66); scene.add(lampGlow);
  // oche: brass strip on the floor 2.37 m from the face
  SB.add(G.box, MAT.brass, -7.0, 0.004, DARTS.OCHE_Z, 0, 0, 0, 0.6, 0.008, 0.04);
  // chalk scoreboard beside the board
  const sc = mkCanvas(512, 640); DARTS.chalk = { c: sc, tex: canvasTex(sc, 1, 1) };
  const cb = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: DARTS.chalk.tex, roughness: 0.95 })); cb.position.set(-6.25, 1.65, -17.83); scene.add(cb);
  SB.add(G.box, MAT.darkWood, -6.25, 1.65, -17.86, 0, 0, 0, 0.66, 0.81, 0.03);
  drawDartChalk(null);
  DARTS.board = g;
  addInteract({ id: 'darts', pos: V3(-7.0, 1.5, DARTS.OCHE_Z - 0.6), r: 3.2, label: () => 'Play darts', enabled: () => !MG.active, action: () => Darts.offer() });
}
function drawDartChalk(gm) {
  const b = DARTS.chalk; if (!b) return;
  const x = b.c.getContext('2d'), W = 512, H = 640;
  x.fillStyle = '#1b201d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, rand(20, 140), rand(1, 3)); }
  x.fillStyle = '#efeee6'; x.textAlign = 'center'; x.font = "54px 'Permanent Marker', cursive"; x.fillText(gm ? 'GAME ON' : 'DARTS', W / 2, 70);
  x.font = "34px 'Permanent Marker', cursive";
  if (!gm) { ['Winner stays on', 'Highest score', '3 rounds · 3 darts', 'Ask at the oche'].forEach((l, i) => { x.fillStyle = ['#ffd84a', '#efeee6', '#8ad8ff', '#efeee6'][i]; x.fillText(l, W / 2, 170 + i * 80); }); }
  else {
    x.fillStyle = '#ffd84a'; x.fillText('YOU', W * 0.3, 140); x.fillText(gm.opp.name.toUpperCase().slice(0, 9), W * 0.72, 140);
    x.fillStyle = '#efeee6';
    for (let r = 0; r < 3; r++) { x.fillText(gm.rounds[0][r] ?? '–', W * 0.3, 210 + r * 70); x.fillText(gm.rounds[1][r] ?? '–', W * 0.72, 210 + r * 70); }
    x.strokeStyle = '#efeee6'; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 420); x.lineTo(W - 40, 420); x.moveTo(W / 2, 110); x.lineTo(W / 2, 500); x.stroke();
    x.fillStyle = '#7dff9a'; x.fillText(gm.total(0), W * 0.3, 480); x.fillText(gm.total(1), W * 0.72, 480);
    if (gm.stake) { x.fillStyle = '#ff9a7a'; x.fillText(`$${gm.stake} a side`, W / 2, 590); }
  }
  b.tex.needsUpdate = true;
}
function dartScore(dx, dy) {
  const R = DARTS.RAD, r = Math.hypot(dx, dy);
  if (r <= R.bullIn) return { pts: 50, label: 'BULLSEYE' };
  if (r <= R.bullOut) return { pts: 25, label: 'OUTER BULL' };
  if (r > R.dblOut) return { pts: 0, label: r > DARTS.R ? 'MISSED THE BOARD' : 'NO SCORE' };
  const ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360 + 9) % 360, base = DARTS.SEG[Math.floor(ang / 18)];
  if (r > R.trebIn && r <= R.trebOut) return { pts: base * 3, label: 'TREBLE ' + base };
  if (r > R.dblIn) return { pts: base * 2, label: 'DOUBLE ' + base };
  return { pts: base, label: String(base) };
}
// board-plane offset (right, up) of a segment target
function dartTarget(num, ring) { const i = DARTS.SEG.indexOf(num), a = i * 18 * Math.PI / 180, r = ring === 't' ? 0.103 : ring === 'd' ? 0.166 : ring === 'bull' ? 0 : 0.135; return [Math.sin(a) * r, Math.cos(a) * r]; }
const _dartGeo = {};
function makeDart(col) {
  if (!_dartGeo.tip) {
    _dartGeo.tip = new THREE.CylinderGeometry(0.0006, 0.0012, 0.032, 6).rotateX(Math.PI / 2).translate(0, 0, -0.016);
    _dartGeo.barrel = new THREE.CylinderGeometry(0.0034, 0.0028, 0.048, 10).rotateX(Math.PI / 2).translate(0, 0, -0.056);
    _dartGeo.shaft = new THREE.CylinderGeometry(0.0017, 0.0017, 0.036, 6).rotateX(Math.PI / 2).translate(0, 0, -0.098);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.016, 0.006); sh.lineTo(0.016, 0.034); sh.lineTo(0.003, 0.04); sh.lineTo(0, 0.04);
    const fl = new THREE.ShapeGeometry(sh); fl.rotateY(-Math.PI / 2); fl.translate(0, 0, -0.084);
    _dartGeo.flight = fl;
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(_dartGeo.tip, MAT.chrome), new THREE.Mesh(_dartGeo.barrel, M({ color: 0x6a6c72, metalness: 0.9, roughness: 0.35 })), new THREE.Mesh(_dartGeo.shaft, M({ color: col, roughness: 0.4 })));
  const fm = M({ color: col, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(_dartGeo.flight, fm); f.rotation.z = i * Math.PI / 2; g.add(f); }
  return g;
}
SFX.dartThunk = pos => { SFX.noise(0.05, { freq: 900, q: 1.5, gain: 0.22, pos }); SFX.tone(140, 0.07, { gain: 0.12, fEnd: 90, pos }); };
SFX.whoosh = () => SFX.noise(0.18, { freq: 1800, q: 0.8, gain: 0.05, fEnd: 700 });

const Darts = {
  offer() {
    const s = Game.state;
    const preferred = (typeof REG !== 'undefined' && REG.here('Kenno')) ? 'Kenno' : null;
    const sp = SPOTS.find(o => o.anim === 'darts');
    const who = sp && sp.occ && sp.occ.role === 'patron' ? sp.occ.name : preferred || 'A local';
    const opts = [0, 5, 10, 20].map(st => ({ label: st ? `Play for $${st}` : 'Friendly game', d: st ? 'Winner takes the lot' : 'Just for bragging rights', price: st ? fmt0(st) : '', disabled: st > s.wallet, fn: () => { Game.closePanel(); this.begin(st, preferred); } }));
    Game.openPanel('DARTS', `${who} is keen for a game. Three rounds, three darts each — highest total wins.`, Game.optList(opts));
  },
  begin(stake, preferName, comp) {
    const { n, sp } = MG.opponent(o => o.anim === 'darts', preferName);
    const regular = typeof REG !== 'undefined' ? REG.get(n.name) : null;
    const skill = regular && regular.dartSkill != null ? regular.dartSkill : rand(0.35, 0.7);
    const gm = this.gm = {
      opp: n, sp, stake, comp, skill, rounds: [[], []], cur: 0, round: 0, phase: 'intro', t: 0, darts: [], thrown: 0, roundPts: 0,
      aimX: 0, aimY: 0.103, power: 0, charging: false, breath: 1, steady: false, sway: rand(0, 10), msg: '',
      total(i) { return this.rounds[i].reduce((a, b) => a + b, 0); },
    };
    if (stake) { Game.state.wallet -= stake; }
    MG.lockNPC(n, V3(-8.2, 0, DARTS.OCHE_Z + 0.3), Math.PI * 0.85);
    MG.start(this);
    bark(n, choice(["Righto, let's have ya.", "You're on, mate.", "Hope you've been practising.", "Loser shouts, yeah?"]), true);
  },
  enter() { drawDartChalk(this.gm); this.setPhase('player'); },
  exit(silent) {
    const gm = this.gm; if (!gm) return;
    for (const d of gm.darts) scene.remove(d.g);
    if (gm.inHand) camera.remove(gm.inHand);
    MG.unlockNPC(gm.opp, gm.sp);
    drawDartChalk(null);
    this.gm = null;
    if (!silent) { player.pos.set(-7.0, 0, DARTS.OCHE_Z + 0.6); player.yaw = 0; player.pitch = 0.05; }
  },
  quit() {
    const gm = this.gm;
    if (gm && gm.phase !== 'done' && gm.stake) { Game.toast(`Forfeited — ${gm.opp.name} keeps your $${gm.stake}.`); }
    else if (gm && gm.phase !== 'done') Game.toast('Called it off.');
    MG.stop();
  },
  setPhase(ph) {
    const gm = this.gm; gm.phase = ph; gm.t = 0;
    if (ph === 'player' || ph === 'ai') { gm.thrown = 0; gm.roundPts = 0; gm.cur = ph === 'player' ? 0 : 1; }
    if (ph === 'player') {
      MG.lockNPC(gm.opp, V3(-8.25, 0, DARTS.OCHE_Z + 0.5), Math.PI * 0.8);
      gm.opp.mg.look = V3(-7, 0, -17.8);
      if (!gm.inHand) { gm.inHand = makeDart(0x1d7a3c); gm.inHand.traverse(o => { o.frustumCulled = false; }); camera.add(gm.inHand); }
      gm.inHand.visible = true;
    }
    if (ph === 'ai') { MG.lockNPC(gm.opp, V3(-7.05, 0, DARTS.OCHE_Z + 0.08), Math.PI, 'darts'); gm.opp.a.dartT = 0; if (gm.inHand) gm.inHand.visible = false; }
    this.hud();
  },
  hud() {
    const gm = this.gm; if (!gm) return;
    const name = gm.opp.name;
    MG.top(`<div class="mgscore"><span>ROUND ${Math.min(3, gm.round + 1)} / 3</span><span><b>YOU</b> ${gm.total(0)}</span><span><b>${name.toUpperCase()}</b> ${gm.total(1)}</span>${gm.stake ? `<span class="stk">$${gm.stake} a side</span>` : ''}</div>${gm.msg ? `<div class="mgmsg">${gm.msg}</div>` : ''}`);
    MG.help(gm.phase === 'player' ? '<kbd>MOUSE</kbd> aim · hold <kbd>LMB</kbd> to wind up, release in the gold · hold <kbd>SHIFT</kbd> to steady your breath · <kbd>Q</kbd> forfeit' : gm.phase === 'ai' ? `${name} is throwing…` : '');
    drawDartChalk(gm);
  },
  down(e) { const gm = this.gm; if (!gm || gm.phase !== 'player' || gm.flying || e.button !== 0) return; gm.charging = true; gm.power = 0; gm.pdir = 1; },
  up(e) { const gm = this.gm; if (!gm || !gm.charging) return; gm.charging = false; this.playerThrow(); },
  key(code) { if (code === 'Space') { const gm = this.gm; if (gm && gm.phase === 'player' && !gm.flying) { if (!gm.charging) { gm.charging = true; gm.power = 0; gm.pdir = 1; } else { gm.charging = false; this.playerThrow(); } } } },
  boardPoint(dx, dy) { return V3(DARTS.C.x + dx, DARTS.C.y + dy, DARTS.C.z + 0.021); },
  throwDart(from, dx, dy, col, who) {
    const gm = this.gm, to = this.boardPoint(dx, dy);
    const g = makeDart(col); g.position.copy(from); scene.add(g);
    const d = { g, from: from.clone(), to, t: 0, T: from.distanceTo(to) / 9.5, h: 0.09 + from.distanceTo(to) * 0.025, dx, dy, who, stuck: false, wob: 0 };
    gm.darts.push(d); gm.flying = d; SFX.whoosh();
    return d;
  },
  playerThrow() {
    const gm = this.gm, drunk = Game.state.drunk / 100;
    // release error: power off the sweet spot moves the dart up/down; hands shake with the grog
    const perr = (gm.power - 0.62) * 0.33;
    const spread = 0.006 + 0.026 * drunk * drunk + 0.006 * drunk - (typeof REG !== 'undefined' ? REG.dartBonus() : 0);
    const dx = gm.aimX + gm.swX + gaussian() * spread, dy = gm.aimY + gm.swY + perr + gaussian() * spread;
    const from = camera.localToWorld(V3(0.11, -0.08, -0.25));
    this.throwDart(from, dx, dy, 0x1d7a3c, 0);
    gm.inHand.visible = false;
    gm.thrown++;
  },
  aiThrow() {
    const gm = this.gm, n = gm.opp, sk = gm.skill;
    // pick a target: mostly treble 20; good players switch to 19 when the 20 bed is crowded; the bull when chasing late
    let tgt = dartTarget(20, 't');
    const behind = gm.round === 2 && gm.total(0) - gm.total(1) > 120 - gm.thrown * 20;
    if (behind && Math.random() < 0.3) tgt = dartTarget(20, 't');
    else if (gm.darts.filter(d => d.who === 1 && Math.hypot(d.dx - tgt[0], d.dy - tgt[1]) < 0.012).length >= 2 && sk > 0.6) tgt = dartTarget(19, 't');
    const sigma = lerp(0.045, 0.012, sk);
    n.h.J.rH.updateWorldMatrix(true, false);
    const from = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld).clone().add(V3(0, 0.05, -0.1));
    this.throwDart(from, tgt[0] + gaussian() * sigma, tgt[1] + gaussian() * sigma, 0x111111, 1);
    gm.thrown++;
  },
  land(d) {
    const gm = this.gm;
    d.stuck = true; d.g.position.copy(d.to); d.wob = 1;
    const sc = dartScore(d.dx, d.dy);
    // bounce-outs off the wire, now and then
    const nearWire = Object.values(DARTS.RAD).some(r => Math.abs(Math.hypot(d.dx, d.dy) - r) < 0.0012);
    if (nearWire && Math.random() < 0.5) { d.bounce = true; d.v = V3(rand(-0.3, 0.3), 0.6, 1.2); sc.pts = 0; sc.label = 'BOUNCE-OUT!'; SFX.tone(2400, 0.05, { gain: 0.05, pos: d.to }); }
    else SFX.dartThunk(d.to);
    gm.roundPts += sc.pts;
    gm.msg = `<b>${d.who === 0 ? 'You' : gm.opp.name}:</b> ${sc.label}${sc.pts ? ` — ${sc.pts}` : ''}`;
    if (d.who === 0) {
      if (sc.pts === 50) { achieve('bullseye'); Game.state.mood = Math.min(100, Game.state.mood + 4); }
      if (gm.thrown === 3 && gm.roundPts === 180) { achieve('oneeighty'); SFX.cheer(d.to, 3); gm.msg = '<b>ONE HUNDRED AND EIGHTYYYY!</b>'; }
      else if (gm.thrown === 3 && gm.roundPts >= 100) { achieve('tonup'); SFX.cheer(d.to, 1); gm.msg += ` · <b>TON${gm.roundPts > 100 ? '-' + (gm.roundPts - 100) : ''}!</b>`; }
    } else if (sc.pts >= 57) bark(gm.opp, choice(['Get in there!', 'Too easy.', 'Treble top, baby!']), true);
    this.hud();
  },
  update(dt, t) {
    const gm = this.gm; if (!gm) return;
    gm.t += dt;
    const drunk = Game.state.drunk / 100;
    // darts in flight / wobbling / bouncing out
    for (const d of gm.darts) {
      if (!d.stuck) {
        d.t += dt; const s = clamp(d.t / d.T, 0, 1);
        const p = _v2.lerpVectors(d.from, d.to, s); p.y += d.h * 4 * s * (1 - s);
        const s2 = clamp(s + 0.02, 0, 1), p2 = _v3.lerpVectors(d.from, d.to, s2); p2.y += d.h * 4 * s2 * (1 - s2);
        d.g.position.copy(p); if (s < 0.999) d.g.lookAt(p2);
        if (s >= 1) { this.land(d); if (gm.flying === d) gm.flying = null; }
      } else if (d.bounce) {
        d.v.y -= 9.8 * dt; d.g.position.addScaledVector(d.v, dt); d.g.rotation.x += dt * 9;
        if (d.g.position.y < 0.02) { d.g.position.y = 0.02; d.v.set(0, 0, 0); d.bounce = false; d.dead = true; SFX.tone(1800, 0.04, { gain: 0.04, pos: d.g.position }); }
      } else if (d.wob > 0 && !d.dead) {
        d.wob = Math.max(0, d.wob - dt * 2.2);
        const w = Math.sin(t * 60) * 0.06 * d.wob; d.g.lookAt(d.g.position.x + w, d.g.position.y - 0.05 + w * 0.5, d.g.position.z - 1);
      }
    }
    const opp = gm.opp;
    opp.a.dartT = Math.max(0, (opp.a.dartT || 0) - dt);
    if (gm.phase === 'player') {
      // camera at the oche, right eye over the dart
      const eye = V3(-6.93, 1.64, DARTS.OCHE_Z + 0.05);
      MG.cam(eye, V3(-7.0, DARTS.C.y - 0.01, DARTS.C.z), dt, 6, 52);
      // aim with the mouse (pointer locked), sway grows with the drink
      gm.aimX = clamp(gm.aimX + input.mx * 0.00022 * settings.sens, -0.3, 0.3);
      gm.aimY = clamp(gm.aimY - input.my * 0.00022 * settings.sens, -0.3, 0.3);
      gm.steady = !!(keys.ShiftLeft || keys.ShiftRight) && gm.breath > 0;
      gm.breath = clamp(gm.breath + (gm.steady ? -dt / 2.6 : dt / 4), 0, 1);
      const amp = (0.0035 + 0.042 * Math.pow(drunk, 1.25)) * (gm.steady ? 0.35 : 1) * (gm.breath <= 0.01 ? 1.6 : 1);
      gm.sway += dt;
      gm.swX = (Math.sin(gm.sway * 0.9) + Math.sin(gm.sway * 2.3 + 1) * 0.35) * amp;
      gm.swY = (Math.cos(gm.sway * 0.7) + Math.sin(gm.sway * 1.9) * 0.4) * amp;
      if (gm.charging) { gm.power += gm.pdir * dt * (1.05 + drunk * 0.8); if (gm.power >= 1) { gm.power = 1; gm.pdir = -1; } if (gm.power <= 0) { gm.power = 0; gm.pdir = 1; } }
      // dart in hand follows the aim; pulls back while winding up
      if (gm.inHand) { const bp = this.boardPoint(gm.aimX + gm.swX, gm.aimY + gm.swY); camera.worldToLocal(bp); const dir = bp.clone().normalize(); gm.inHand.position.set(0.09 + dir.x * 0.05, -0.07 + dir.y * 0.05, -0.22 + (gm.charging ? gm.power * 0.07 : 0)); gm.inHand.quaternion.setFromUnitVectors(_v3.set(0, 0, 1), bp.sub(gm.inHand.position).normalize()); }
      const ret = $('mgRet'), pow = $('mgPow');
      ret.classList.toggle('hidden', !!gm.flying || gm.thrown >= 3); MG.pin(ret, this.boardPoint(gm.aimX + gm.swX, gm.aimY + gm.swY));
      pow.classList.toggle('hidden', !gm.charging); pow.firstElementChild.style.height = (gm.power * 100) + '%';
      ret.style.opacity = gm.steady ? 1 : 0.75;
      if (gm.thrown < 3 && !gm.flying && gm.inHand) gm.inHand.visible = true;
      if (gm.thrown >= 3 && !gm.flying && gm.t > 0.5 && !gm.endT) gm.endT = gm.t;
      if (gm.endT && gm.t - gm.endT > 1.6) { gm.endT = null; this.endTurn(); }
    } else if (gm.phase === 'ai') {
      $('mgRet').classList.add('hidden'); $('mgPow').classList.add('hidden');
      MG.cam(V3(-5.35, 1.72, DARTS.OCHE_Z + 1.25), V3(-7.0, 1.42, -16.7), dt, 3, 58);
      if (Math.hypot(opp.pos.x - opp.mg.pos.x, opp.pos.z - opp.mg.pos.z) < 0.06 && !gm.flying && gm.thrown < 3 && gm.t > 1.2 + gm.thrown * 1.5) {
        if (!gm.windT) { gm.windT = 0.32; opp.a.dartT = 0.5; }
      }
      if (gm.windT) { gm.windT -= dt; if (gm.windT <= 0) { gm.windT = 0; this.aiThrow(); } }
      if (gm.thrown >= 3 && !gm.flying && !gm.endT) gm.endT = gm.t;
      if (gm.endT && gm.t - gm.endT > 1.8) { gm.endT = null; this.endTurn(); }
    } else if (gm.phase === 'done') {
      MG.cam(V3(-5.9, 1.62, DARTS.OCHE_Z + 0.4), V3(-7.0, 1.5, -17.2), dt, 3, 58);
      if (gm.t > 4.5) MG.stop();
    }
  },
  endTurn() {
    const gm = this.gm;
    gm.rounds[gm.cur].push(gm.roundPts);
    // pull the darts out
    for (const d of gm.darts) scene.remove(d.g); gm.darts = [];
    if (gm.cur === 0) { gm.msg = `You scored <b>${gm.roundPts}</b>.`; this.setPhase('ai'); return; }
    gm.msg = `${gm.opp.name} scored <b>${gm.roundPts}</b>.`;
    gm.round++;
    if (gm.round < 3) { this.setPhase('player'); return; }
    const a = gm.total(0), b = gm.total(1);
    if (a === b) { gm.msg = 'Dead heat! One more round each.'; gm.rounds[0].pop(); gm.rounds[1].pop(); gm.round = 2; this.setPhase('player'); return; }
    this.finish(a > b);
  },
  finish(won) {
    const gm = this.gm, s = Game.state;
    gm.phase = 'done'; gm.t = 0; $('mgRet').classList.add('hidden');
    MG.lockNPC(gm.opp, V3(-7.6, 0, DARTS.OCHE_Z + 0.6), Math.PI * 0.75);
    if (won) {
      if (gm.stake) { s.wallet += gm.stake * 2; s.night.extra += gm.stake; }
      s.mood = Math.min(100, s.mood + 10); s.stats.dartsWon = (s.stats.dartsWon || 0) + 1; achieve('darts');
      if (gm.comp) { s.wallet += 60; s.night.extra += 60; s.flags.compWon = true; achieve('champ'); Night.addRep(5, 'Won the Royal darts comp'); Night.log('🏆', 'Won the Royal darts comp (+$60)'); Game.toast('🏆 ROYAL DARTS CHAMPION! The trophy and $60 prize pool are yours.', true); } Night.ev('dartsWon'); Night.log('🎯', `Beat ${gm.opp.name} at darts`);
      gm.msg = `<b>YOU WIN</b> ${gm.total(0)} to ${gm.total(1)}${gm.stake ? ` — +$${gm.stake}` : ''}`;
      bark(gm.opp, choice(['Fair play. Good arrows.', 'Bloody hell. Rematch next week.', 'Beginner\'s luck, that.']), true); SFX.cheer(DARTS.C, 1);
      if (typeof REG !== 'undefined') REG.bump(gm.opp.name, 4);
    } else {
      if (gm.stake) s.night.extra -= gm.stake;
      s.mood = Math.max(0, s.mood - 4);
      gm.msg = `<b>${gm.opp.name.toUpperCase()} WINS</b> ${gm.total(1)} to ${gm.total(0)}${gm.stake ? ` — −$${gm.stake}` : ''}`;
      gm.opp.cheerT = 1.6; bark(gm.opp, choice(['Too easy!', 'Thanks for the donation, mate.', 'Unlucky. Close one.']), true);
      if (typeof REG !== 'undefined') REG.bump(gm.opp.name, 2);
    }
    this.hud(); MG.help('');
  },
};
function gaussian() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
