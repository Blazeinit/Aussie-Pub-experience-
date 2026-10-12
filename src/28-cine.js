
// =====================================================================
//  CINEMATIC DIRECTOR: skippable camera moves over the live world.
//  Cine.play([{ dur, a: {p, l, fov}, b: {p, l, fov}, ease, sub, title, shake, slow, duck, fn }], { onEnd, bars, skippable })
//  p / l are [x, y, z] (position, look-at).  A shot moves from a to b (or holds a when b is omitted).
//  Hold E / SPACE (or tap the screen on a phone) to skip: the world is left exactly as the cinematic's end would leave it.
//  settings.cinematics: 'full' | 'short' (only the quick ones) | 'off'.
// =====================================================================
const Cine = {
  active: null, bars: 0, slow: 1, skipT: 0, saved: null, t: 0,
  ok(kind = 'full') { const m = settings.cinematics || 'full'; return m === 'off' ? false : m === 'short' ? kind !== 'long' : true; },
  play(shots, o = {}) {
    if (this.active) this.end(true);
    if (!this.ok(o.kind)) { o.onEnd && o.onEnd(); return false; }
    const A = this.active = { shots, i: -1, t: 0, o, seen: 0, fovStart: camera.fov };
    this.saved = { fov: camera.fov, music: Music.level, uiOpen: Game.uiOpen };
    this.skipT = 0; this.slow = 1; document.body.classList.add('cine'); $('lbT').style.height = $('lbB').style.height = (o.bars === 0 ? 0 : 11) + 'vh';
    $('cineHint').classList.toggle('hidden', o.skippable === false); $('cineHint').firstChild.textContent = TOUCH.on ? 'TOUCH & HOLD ' : 'HOLD '; this.next();
    return true;
  },
  next() {
    const A = this.active; if (!A) return;
    const prev = A.shots[A.i]; if (prev && prev.end) prev.end();
    A.i++; A.t = 0; const s = A.shots[A.i];
    if (!s) { this.end(false); return; }
    if (s.sub) Game.subtitle(s.sub, s.dur + 0.4);
    if (s.title) this.title(s.title[0], s.title[1], Math.min(s.dur, 4.5));
    if (s.fn) s.fn();
    if (s.duck != null) Music.level = Math.max(0.05, this.saved.music * s.duck);
  },
  title(a, b, dur) { const e = $('cineTitle'); e.innerHTML = `<b>${a}</b>${b ? `<span>${b}</span>` : ''}`; e.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove('on'), dur * 1000); },
  // the camera for this frame
  update(dt) {
    const A = this.active; if (!A) return;
    dt = this.rdt || dt; A.t += dt; const s = A.shots[A.i]; if (!s) return;
    const k = clamp(A.t / s.dur, 0, 1), e = s.ease === 'lin' ? k : s.ease === 'out' ? easeOut(k) : smooth(k);
    const a = s.a, b = s.b || s.a;
    const pos = V3(lerp(a.p[0], b.p[0], e), lerp(a.p[1], b.p[1], e), lerp(a.p[2], b.p[2], e));
    const look = V3(lerp(a.l[0], b.l[0], e), lerp(a.l[1], b.l[1], e), lerp(a.l[2], b.l[2], e));
    // handheld breath so a locked-off shot never feels dead
    const t = elapsed; if (!settings.reduceMotion) { pos.x += Math.sin(t * 0.9) * 0.012; pos.y += Math.sin(t * 1.3) * 0.01; }
    if (s.shake) { const sh = s.shake * (1 - k); pos.x += (Math.random() - 0.5) * 0.03 * sh; pos.y += (Math.random() - 0.5) * 0.03 * sh; }
    camera.position.copy(pos); camera.lookAt(look);
    const fov = lerp(a.fov || 60, b.fov || a.fov || 60, e); if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    this.slow = s.slow != null ? s.slow : 1;
    // skipping: hold the key
    const held = keys.KeyE || keys.Space || keys.Enter || this.touchHeld;
    this.skipT = held ? this.skipT + dt : Math.max(0, this.skipT - dt * 2);
    $('cineSkip').style.width = Math.min(100, this.skipT / 0.7 * 100) + '%';
    if (A.o.skippable !== false && this.skipT >= 0.7) { this.end(true); return; }
    if (A.t >= s.dur) this.next();
  },
  end(skipped) {
    const A = this.active; if (!A) return; this.active = null;
    // run any remaining shots' end hooks so state is left as the full cinematic would have left it
    for (let i = Math.max(0, A.i); i < A.shots.length; i++) { const s = A.shots[i]; if (skipped && i > A.i && s.fn) s.fn(); if (s.end) s.end(); }
    if (skipped) { Game.subtitle('', 0); $('subtitle').innerHTML = ''; }
    document.body.classList.remove('cine'); $('cineHint').classList.add('hidden'); $('lbT').style.height = $('lbB').style.height = 0; $('cineTitle').classList.remove('on'); $('cineSkip').style.width = 0;
    camera.fov = this.saved.fov; camera.updateProjectionMatrix(); Music.level = this.saved.music; this.slow = 1; this.skipT = 0; this.touchHeld = false;
    if (A.o.onEnd) A.o.onEnd(skipped);
  },
  // ------------------------------------------------------------ ready-made sequences
  // the establishing shot at the start of a night: the street, a drift in towards the door, then you
  opening(first) {
    const D = DAYS[Game.state.day];
    return this.play([
      { dur: first ? 5.5 : 3.6, ease: 'lin', a: { p: [-34, 5.8, 21], l: [-4, 3.2, 2], fov: 50 }, b: { p: [-17, 3.6, 19.5], l: [0, 2.6, 2], fov: 52 }, title: first ? [VENUE.name, `${DAYS[Game.state.day].name} · ${CHAPTERS[Game.state.day].title.split('— ')[1] || ''}`] : [VENUE.name, D.title], sub: first ? '<i>The street\'s dead. Only thing lit up for blocks is ' + VENUE.short + '.</i>' : null, duck: 0.6 },
      { dur: first ? 3 : 2.2, a: { p: [-17, 3.6, 19.5], l: [0, 2.6, 2], fov: 52 }, b: { p: [-8.5, 1.9, 22], l: [-2, 2.2, 3], fov: 60 }, ease: 'out' },
    ], { kind: 'short', onEnd: () => { player.pos.set(-7.5, 0, 21.2); player.yaw = 0.12; player.pitch = 0.04; } });
  },
  // last drinks: the bell, the lights come up, the whole bar turns
  lastCall(bt) {
    const p = bt.pos, bell = [-9.0, 1.3, -8.0];
    return this.play([
      { dur: 2.4, a: { p: [-6.3, 1.55, -7.2], l: [bell[0], bell[1] + 0.1, bell[2]], fov: 38 }, b: { p: [-6.6, 1.5, -7.6], l: [bell[0], bell[1], bell[2]], fov: 34 }, slow: 0.55, sub: `<b>${bt.name}:</b> LAST DRINKS, EVERYBODY!`, fn: () => { SFX.bell(V3(-9, 2.5, -8), 3); }, duck: 0.35 },
      { dur: 3.2, a: { p: [-5.2, 1.7, -4.5], l: [-9, 1.5, -8], fov: 60 }, b: { p: [-1.5, 2.2, 0.2], l: [-7, 1.6, -9], fov: 66 }, ease: 'out', fn: () => { Music.level = Math.max(0.2, this.saved.music * 0.5); } },
    ], { kind: 'short' });
  },
  // a pokie jackpot: the screen fills your view, the room goes quiet for a second
  jackpot(m, name) {
    const s = m.screenW, f = m.fw, up = V3(0, 1, 0), eye = player.pos.clone().add(V3(0, 1.3, 0)).addScaledVector(f, 0.2);
    const near = s.clone().addScaledVector(f, 0.42).add(V3(0, -0.02, 0));
    return this.play([
      { dur: 3.4, a: { p: [eye.x, eye.y, eye.z], l: [s.x, s.y - 0.1, s.z], fov: 55 }, b: { p: [near.x, near.y, near.z], l: [s.x, s.y, s.z], fov: 42 }, slow: 0.5, shake: 1.2, ease: 'out', sub: `<b>${name} JACKPOT!</b>`, duck: 0.3 },
      { dur: 1.2, a: { p: [near.x, near.y, near.z], l: [s.x, s.y, s.z], fov: 42 }, b: { p: [eye.x, eye.y, eye.z], l: [s.x, s.y - 0.1, s.z], fov: 55 } },
    ], { kind: 'short', bars: 11 });
  },
  // follow somebody for a few seconds (a scuffle being walked out, a patron leaving)
  follow(n, dur = 4, sub) {
    const tgt = () => [n.pos.x, 1.4, n.pos.z];
    const a = n.pos.clone().add(V3(-2.2, 0.4, 2.8));
    return this.play([{ dur, a: { p: [a.x, 1.7, a.z], l: tgt(), fov: 50 }, b: { p: [a.x + 1.4, 1.5, a.z - 0.6], l: tgt(), fov: 46 }, sub, ease: 'lin' }], { kind: 'short' });
  },
  // the council decides: slow shots across the packed bar, one line per beat
  council(lines, then) {
    const poses = [
      { a: { p: [-3.5, 1.7, -3.2], l: [-9, 1.5, -8], fov: 52 }, b: { p: [-4.5, 1.7, -4.5], l: [-9, 1.5, -8], fov: 48 } },
      { a: { p: [0, 1.6, -9], l: [-6, 1.6, -4], fov: 55 }, b: { p: [-1.2, 1.6, -8.4], l: [-6, 1.6, -4], fov: 50 } },
      { a: { p: [-6.5, 1.5, -3.5], l: [-1, 1.5, -7], fov: 58 }, b: { p: [-5.5, 1.6, -4], l: [-1, 1.5, -7], fov: 50 } },
    ];
    const shots = lines.map(([who, l], i) => ({ dur: Math.max(3.2, 1.4 + l.length * 0.045), ease: 'lin', ...poses[i % poses.length], sub: `<b>${who}:</b> ${l}`, duck: 0.2 }));
    return this.play(shots, { kind: 'long', onEnd: then });
  },
  // the cab ride home
  taxi(then) {
    return this.play([
      { dur: 2.2, a: { p: [-4, 1.3, 9.2], l: [-11.5, 1.1, 11.4], fov: 55 }, b: { p: [-9, 1.25, 10.3], l: [-11.5, 1.1, 11.4], fov: 45 }, ease: 'out', sub: '<i>The back seat smells of pine and last night.</i>', duck: 0.5 },
      { dur: 3.6, ease: 'lin', a: { p: [-12.5, 1.15, 12.6], l: [-30, 1.4, 12], fov: 62 }, b: { p: [-24, 1.15, 12.6], l: [-44, 1.4, 12], fov: 62 }, sub: '<b>Driver:</b> Big night, mate? You want me to drop you at the corner?' },
    ], { kind: 'short', onEnd: then });
  },
};
addEventListener('touchstart', () => { if (Cine.active) Cine.touchHeld = true; }, { passive: true });
addEventListener('touchend', () => { Cine.touchHeld = false; });
