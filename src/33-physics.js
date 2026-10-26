
// =====================================================================
//  THINGS YOU CAN DO WITH THE ROOM: surfaces, setting a drink down, sitting anywhere, cheers, the telly
//  Surfaces ("tops") are the flat places a glass can land or be put: bar counters and tables.  They are registered as
//  the world is built (any big barTop slab is picked up automatically) so physics knows where "the bar" is.
// =====================================================================
const Tops = [];
function addTop(cx, cz, w, d, y, club = null) { Tops.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y, club }); }
{
  // every big slab of bar-top material is a surface (counters, tables); small trinkets are ignored
  const _box = addBoxS, _cyl = addCylS, _add = Batcher.prototype.add;
  addBoxS = function (b, mat, x, y, z, w, h, d, ry = 0, uvs = 0) { if (mat === MAT.barTop && w >= 0.55 && d >= 0.35 && h <= 0.12) { const q = Math.abs(Math.sin(ry)) > 0.7; addTop(x, z, q ? d : w, q ? w : d, y + h / 2); } return _box(b, mat, x, y, z, w, h, d, ry, uvs); };
  addCylS = function (b, mat, x, y, z, r, h, seg = 20, ry = 0, rx = 0, rz = 0) { if (mat === MAT.barTop && r >= 0.25 && h <= 0.12) addTop(x, z, r * 1.7, r * 1.7, y + h / 2); return _cyl(b, mat, x, y, z, r, h, seg, ry, rx, rz); };
  Batcher.prototype.add = function (geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) { if (mat === MAT.barTop && geo === G.box && sx >= 0.55 && sz >= 0.35 && sy <= 0.12) { const q = Math.abs(Math.sin(ry)) > 0.7; addTop(x, z, q ? sz : sx, q ? sx : sz, y + sy / 2); } return _add.call(this, geo, mat, x, y, z, ry, rx, rz, sx, sy, sz); };
}
// highest surface at (x, z) that is at or below `y` (+ a little give); the floor if there is none
function supportAt(x, z, y) {
  let best = groundY(x, z, y), isTop = false;
  for (const t of Tops) if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1 && t.y <= y + 0.08 && t.y > best) { best = t.y; isTop = true; }
  return { y: best, top: isTop };
}
// a ray from the eye along the view: where does it land on a surface within arm's reach?
function topInReach(maxDist = 2.3) {
  const o = camera.position, f = V3(0, 0, -1).applyQuaternion(camera.quaternion); let best = null;
  if (f.y > -0.04) return null;
  for (const t of Tops) {
    const k = (t.y - o.y) / f.y; if (k < 0.25 || k > maxDist) continue;
    const x = o.x + f.x * k, z = o.z + f.z * k;
    if (x > t.x0 + 0.04 && x < t.x1 - 0.04 && z > t.z0 + 0.04 && z < t.z1 - 0.04 && (!best || k < best.k)) best = { k, x, z, y: t.y };
  }
  return best;
}
// colliders as walls for flying glass
function bounceOffWalls(pos, vel, r = 0.045) {
  if (pos.y > 1.9) return;
  for (const c of colliders) {
    if (c.lv !== 0 || c.off || (c.h && pos.y > c.h)) continue;
    if (pos.x > c.x0 - r && pos.x < c.x1 + r && pos.z > c.z0 - r && pos.z < c.z1 + r) {
      const l = pos.x - (c.x0 - r), rr = (c.x1 + r) - pos.x, b = pos.z - (c.z0 - r), f = (c.z1 + r) - pos.z, m = Math.min(l, rr, b, f);
      if (m === l) { pos.x = c.x0 - r; vel.x = -Math.abs(vel.x) * 0.35; } else if (m === rr) { pos.x = c.x1 + r; vel.x = Math.abs(vel.x) * 0.35; }
      else if (m === b) { pos.z = c.z0 - r; vel.z = -Math.abs(vel.z) * 0.35; } else { pos.z = c.z1 + r; vel.z = Math.abs(vel.z) * 0.35; }
      vel.y *= 0.9; SFX.tone(rand(1800, 2600), 0.04, { gain: 0.03, pos: pos.clone() });
    }
  }
}
// glass physics: gravity, spin, bounce off walls, land on bars and tables (a gentle landing is a landing, a hard one is a smash)
function updateFalling(dt, t) {
  for (let i = fallingGlasses.length - 1; i >= 0; i--) {
    const f = fallingGlasses[i], g = f.glass.group;
    f.v.y -= 9.8 * dt; g.position.addScaledVector(f.v, dt); bounceOffWalls(g.position, f.v);
    g.rotateX(f.w.x * dt); g.rotateZ(f.w.z * dt); f.glass.update(dt, t);
    if (f.glass.fill > 0.02 && Math.random() < 0.6) { dropFX.emit(g.position.clone().add(V3(0, 0.12, 0)), V3(rand(-.3, .3), 0, rand(-.3, .3)), 0.01, 2, 0.9, f.glass.D.col); f.glass.fill -= dt * 0.5; }
    const sup = supportAt(g.position.x, g.position.z, g.position.y + dt * Math.max(0, -f.v.y) + 0.02);
    if (f.v.y < 0 && g.position.y <= sup.y + 0.015) {
      const speed = -f.v.y, hz = Math.hypot(f.v.x, f.v.z);
      if (sup.top && speed < 2.9 && hz < 3.2) { landGlass(f.glass, g.position.x, sup.y, g.position.z, hz > 0.5 ? Math.atan2(f.v.x, f.v.z) : null, Math.min(1, hz / 3)); fallingGlasses.splice(i, 1); continue; }
      const p = g.position.clone(); p.y = sup.y + 0.01;
      shatterGlass(p, f.glass); scene.remove(g); fallingGlasses.splice(i, 1); Game.onGlassSmash(p);
    }
  }
}
// a glass that has landed upright on a surface: a little splash, then it can be picked up again
function landGlass(glass, x, y, z, slideDir, slide) {
  const g = glass.group; g.quaternion.identity(); g.position.set(x, y, z);
  if (slideDir != null && slide > 0.15) { g.position.x += Math.sin(slideDir) * slide * 0.25; g.position.z += Math.cos(slideDir) * slide * 0.25; const s = supportAt(g.position.x, g.position.z, y + 0.05); if (!s.top || Math.abs(s.y - y) > 0.03) { g.position.set(x, y, z); } }
  SFX.clink(g.position.clone()); if (glass.fill > 0.1) { glass.fill = Math.max(0.05, glass.fill - 0.12); for (let k = 0; k < 6; k++) dropFX.emit(g.position.clone().add(V3(0, 0.1, 0)), V3(rand(-.4, .4), rand(.3, .9), rand(-.4, .4)), 0.01, 3, 0.9, glass.D.col); }
  Game.placeItem({ kind: 'drink', glass, own: true }, g.position.clone());
}
// set the glass in your hand down on the bar or table you're looking at (G); otherwise it drops
function putDownHeld() {
  const d = player.drink; if (!d) return false; if (d.onLedge) { Game.toast('Your drink is on the ledge.'); return true; }
  const hit = topInReach(); if (!hit) return false;
  player.drink = null; vm.R.curl(0.2);
  d.group.updateWorldMatrix(true, false); scene.attach(d.group); d.group.scale.set(1, 1, 1);
  d.group.quaternion.identity(); d.group.position.set(hit.x, hit.y, hit.z);
  SFX.clink(d.group.position.clone());
  Game.placeItem({ kind: 'drink', glass: d, own: true }, d.group.position.clone());
  Game.toast('Put your drink down. Pick it up again with E.');
  return true;
}
{
  const _drop = dropHeld;
  dropHeld = function () { if (putDownHeld()) return; _drop(); };
}

// ---------------------------------------------------------------- sit anywhere
// any free stool or chair: sit, look around, sip, smoke, eat, chat; walk off (or Q) to stand up
player.perch = null;
function sitOn(sp) {
  if (player.perch || player.seated || sp.occ) return;
  sp.occ = { reserved: true, player: true }; player.perch = { sp, from: player.pos.clone(), t: 0, eyeFrom: player.eye };
  player.pos.set(sp.pos.x, 0, sp.pos.z); player.vel.set(0, 0, 0); player.yawTo = sp.ry + Math.PI;
  SFX.thud && SFX.thud(sp.pos.clone()); Game.toast('You sit down. Walk away (or Q) to stand up.');
}
function standUpPerch() {
  const P = player.perch; if (!P) return; const sp = P.sp;
  sp.occ = null; player.perch = null; player.eye = 1.64;
  // step back out of the seat, away from the table
  const bx = -Math.sin(sp.ry), bz = -Math.cos(sp.ry);
  const cand = [[bx, bz], [bz, -bx], [-bz, bx], [-bx, -bz]].map(([dx, dz]) => V3(sp.pos.x + dx * 0.7, 0, sp.pos.z + dz * 0.7));
  const ok = cand.find(p => { const c = p.clone(); collideCircle(c, 0.32, 0); return c.distanceTo(p) < 0.02; }) || cand[0];
  player.pos.copy(ok); collideCircle(player.pos, 0.32, 0);
}
function updatePerch(dt) {
  const P = player.perch; if (!P) return false;
  const sp = P.sp; P.t += dt;
  player.pos.set(sp.pos.x, 0, sp.pos.z); player.vel.set(0, 0, 0);
  player.eye = lerp(P.eyeFrom, (sp.sitH || 0.48) + 0.78, smooth(clamp(P.t / 0.5, 0, 1)));
  if (P.t < 0.6 && player.yawTo != null) player.yaw += angleDiff(player.yaw, player.yawTo) * Math.min(1, dt * 4);
  const wants = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || (TOUCH.on && Math.hypot(TOUCH.mx, TOUCH.my) > 0.45);
  if (P.t > 0.7 && wants && !Game.uiOpen) standUpPerch();
  return true;
}
// "Sit down" shows up in the targeting like any other interaction
const _findTarget = Game.findTarget;
Game.findTarget = function () {
  const t = player.perch ? findTargetFrom.call(this) : _findTarget.call(this);
  if (t && !t.sitHint) return t;
  if (player.perch || player.seated || this.uiOpen || MG.active || Eat.active) return t;
  const fw = V3(0, 0, -1).applyQuaternion(camera.quaternion), cp = camera.position; let best = null, bs = 0.78;
  for (const sp of SPOTS) {
    if ((sp.kind !== 'stool' && sp.kind !== 'chair') || sp.occ || sp.hidden || sp.machine || sp.staff) continue;
    const d = V3(sp.pos.x - cp.x, (sp.sitH || 0.48) + 0.1 - cp.y, sp.pos.z - cp.z), dist = d.length(); if (dist > 1.7) continue;
    const dot = d.normalize().dot(fw); if (dot > bs) { bs = dot; best = sp; }
  }
  if (best) return { sitHint: true, label: () => 'Sit down', action: () => sitOn(best) };
  return t;
};
// the normal targeting, but allowed while perched (everything within reach of the seat)
function findTargetFrom() {
  const fw = V3(0, 0, -1).applyQuaternion(camera.quaternion), cp = camera.position; let best = null, bs = 0;
  for (const it of interactables) {
    if (!it.enabled() || it.zone) continue;
    const d = _v1.copy(it.pos).sub(cp), dist = d.length(); if (dist > Math.min(it.r, 2.4)) continue;
    const dot = d.normalize().dot(fw); if (dot < 0.8) continue;
    const sc = dot - dist * 0.08 + (it.temp ? 0.3 : 0); if (sc > bs) { bs = sc; best = it; }
  }
  return best;
}

// ---------------------------------------------------------------- cheers
// R with a drink in hand: clink with whoever you're facing
function cheers() {
  const d = player.drink;
  if (!d || d.onLedge || d.fill < 0.08) { Game.toast('You need a drink in your hand to say cheers.'); return; }
  const fw = V3(0, 0, -1).applyQuaternion(camera.quaternion), cp = camera.position; let best = null, bs = 0.8;
  for (const n of NPCS) { if (n.state === 'walk' || n.band || n.mg && !n.staff) continue; const dv = V3(n.pos.x - cp.x, 1.4 - cp.y, n.pos.z - cp.z), dist = dv.length(); if (dist > 2.4) continue; const dot = dv.normalize().dot(fw); if (dot > bs) { bs = dot; best = n; } }
  if (!best) { Game.toast('Nobody to cheers. Face someone.'); return; }
  const s = Game.state, key = best.regular || best.local || best.name, mem = DLG.mem(key);
  SFX.clink(best.pos.clone().add(V3(0, 1.3, 0)));
  best.a.sipT = 1.6; best.a.talk = 2; best.cheerT = 0.9;
  if (!best.a.holdDrink && !best.staff) { best.a.holdDrink = true; best.glass.group.visible = true; }
  bark(best, choice(['Cheers, mate!', 'Good health!', 'Chin chin!', 'Yewww!', 'Bottoms up!', 'Cheers big ears.']), true);
  const first = !mem.cheered; mem.cheered = (mem.cheered || 0) + 1;
  s.mood = clamp(s.mood + (first ? 5 : 1.5), 0, 100); relUp(key, first ? 4 : 1);
  if (first) Night.log('🥂', `Cheersed ${best.name}`);
  Night.ev && Night.ev('cheers', key);
  player.sip = 0.8; d.fill = Math.max(0, d.fill - 0.03);
}

// ---------------------------------------------------------------- the telly
const TV_CHANNELS = ['racing', 'footy', 'news', 'weather'];
function drawChannel(tv, kind, x, W, H, t) {
  const bg = x.createLinearGradient(0, 0, 0, H);
  if (kind === 'news') {
    bg.addColorStop(0, '#102a5a'); bg.addColorStop(1, '#061230'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#c8d4f0'; x.beginPath(); x.arc(110, 74, 24, 0, 7); x.fill(); x.fillStyle = '#243a6a'; x.beginPath(); x.moveTo(70, H - 60); x.quadraticCurveTo(110, 96, 150, H - 60); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 18px Inter, sans-serif'; x.fillText('6 NEWS', 190, 38);
    x.font = '13px Inter, sans-serif'; x.fillStyle = '#9fb4e8'; x.fillText(['COUNCIL VOTES ON PUB RE-ZONE', 'WATTLE CREEK RSL RAISES $12K', 'SHIRE WARNS OF SUNDAY SHOWERS', 'LOCAL LEGEND WINS MEAT TRAY'][Math.floor(t / 7) % 4], 190, 62);
    x.fillStyle = '#c8102e'; x.fillRect(0, H - 26, W, 26); x.fillStyle = '#fff'; x.font = 'bold 12px Inter, sans-serif';
    const tick = '   ★ POTHOLES ON MAIN ST   ★ RAIN TO CLEAR BY 9PM   ★ KENO JACKPOT ROLLS OVER   ★ BAZZA\'S UTE FOUND   '; const off = -((t * 40) % 560); for (let k = 0; k < 3; k++) x.fillText(tick, off + k * 560, H - 9);
  } else {
    bg.addColorStop(0, '#2a7ac8'); bg.addColorStop(1, '#0a3a7a'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff'; x.font = 'bold 15px Inter, sans-serif'; x.fillText('WATTLE CREEK · 7 DAY', 10, 22);
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], tmp = [24, 22, 19, 21, 26, 28, 25], ic = ['☀', '⛅', '🌧', '⛅', '☀', '☀', '⛈'];
    days.forEach((dn, i) => { const X = 18 + i * 43; x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(X - 6, 40, 40, 100); x.fillStyle = '#fff'; x.font = 'bold 12px Inter, sans-serif'; x.fillText(dn, X, 56); x.font = '22px sans-serif'; x.fillText(ic[i], X + 2, 94); x.font = 'bold 15px Inter, sans-serif'; x.fillText(tmp[i] + '°', X + 2, 124); });
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, H - 22, W, 22); x.fillStyle = '#ffe27a'; x.font = '12px Inter, sans-serif'; x.fillText('Chance of a shower, then a cold one at the pub.', 10, H - 7);
  }
}
{
  const _drawTV = drawTV;
  drawTV = function (tv, dt) { const k = tv.channel || tv.kind; if (k === 'news' || k === 'weather') { tv.t += dt; drawChannel(tv, k, tv.c.getContext('2d'), 320, 180, tv.t); tv.tex.needsUpdate = true; return; } const was = tv.kind; tv.kind = k; _drawTV(tv, dt); tv.kind = was; };
  const _makeTV = makeTV;
  makeTV = function (x, y, z, ry, kind) {
    const tv = _makeTV(x, y, z, ry, kind);
    addInteract({ id: 'tv', pos: V3(x, Math.min(y, 1.9), z).addScaledVector(V3(Math.sin(ry), 0, Math.cos(ry)), 0.6), r: 4.5, enabled: () => !MG.active && !Game.uiOpen, label: () => `Change the channel (${(tv.channel || tv.kind).toUpperCase()})`,
      action: () => { const cur = TV_CHANNELS.indexOf(tv.channel || tv.kind); tv.channel = TV_CHANNELS[(cur + 1) % TV_CHANNELS.length]; SFX.click(); SFX.noise(0.12, { freq: 3000, q: 1, gain: 0.04, pos: tv.group.position.clone() }); Game.toast(`Channel: ${tv.channel.toUpperCase()}`); } });
    return tv;
  };
}
