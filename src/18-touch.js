
// =====================================================================
//  TOUCH CONTROLS: left stick to walk, drag anywhere else to look, context buttons
// =====================================================================
const TOUCH = {
  on: false, mx: 0, my: 0, run: false, stickId: null, lookId: null, lx: 0, ly: 0, mode: '',
  detect() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0; },
  apply() {
    this.on = settings.touch === 'on' || (settings.touch === 'auto' && this.detect());
    document.body.classList.toggle('touchmode', this.on);
    $('touch').classList.toggle('hidden', !this.on || Game.mode !== 'play');
    if (this.on) { input.locked = true; }
    this.mode = '';
  },
  build() {
    const st = $('tStick'), knob = st.firstElementChild;
    const stickMove = t => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (t.clientX - cx) / R, dy = (t.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.mx = dx; this.my = dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; };
    st.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; this.stickId = t.identifier; stickMove(t); }, { passive: false });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) { e.preventDefault(); stickMove(t); }
        else if (t.identifier === this.lookId) { e.preventDefault(); input.mx += (t.clientX - this.lx) * 1.7; input.my += (t.clientY - this.ly) * 1.7 * (settings.invertY ? -1 : 1); this.lx = t.clientX; this.ly = t.clientY; }
      }
    }, { passive: false });
    // the stick floats: put your thumb down anywhere on the left of the screen and it appears under it
    const home = () => { st.style.left = st.style.top = st.style.bottom = ''; st.classList.remove('float'); };
    const end = e => { for (const t of e.changedTouches) { if (t.identifier === this.stickId) { this.stickId = null; this.mx = this.my = 0; knob.style.transform = ''; home(); } if (t.identifier === this.lookId) this.lookId = null; } };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    // drag on the 3D view to look (not while sat at a pokie or scratching a card — those need taps)
    renderer.domElement.addEventListener('touchstart', e => {
      if (!this.on || Game.mode !== 'play' || player.seated || (MG.active && MG.active.cursor)) return;
      e.preventDefault(); AudioSys.init();
      for (const t of e.changedTouches) {
        if (this.stickId == null && this.mode === 'walk' && t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.32) {
          const R = st.offsetWidth / 2; st.classList.add('float');
          st.style.left = clamp(t.clientX - R, 4, innerWidth * 0.42) + 'px'; st.style.top = clamp(t.clientY - R, 4, innerHeight - 2 * R - 4) + 'px'; st.style.bottom = 'auto';
          this.stickId = t.identifier; stickMove(t);
        } else if (this.lookId == null) { this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; }
      }
    }, { passive: false });
    // no pinch-zoom on iPhone (double-tap zoom and callouts are switched off in the CSS)
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    $('tPhone').addEventListener('touchstart', e => { e.preventDefault(); AudioSys.init(); Game.onKey('Tab'); }, { passive: false });
    // tap the prompt itself to do it; tap the objective to read all of it
    $('prompt').addEventListener('click', () => { if (this.on && Game.canMove()) Game.onKey('KeyE'); });
    $('objective').addEventListener('click', () => { if (this.on) $('objective').classList.toggle('open'); });
    addEventListener('resize', () => { if (this.on) this.layout(); });
    $('tMenu').onclick = () => { if (Game.mode !== 'play') return; if (!$('panel').classList.contains('hidden')) { Game.closePanel(); return; } Game.paused = true; $('resume').classList.remove('hidden'); };
  },
  // buttons change with what you're doing
  buttons() {
    let mode = 'walk';
    if (Game.mode !== 'play') mode = 'none';
    else if (player.seated) mode = 'pokie';
    else if (player.perch && !(typeof Eat !== 'undefined' && Eat.active) && !MG.active) mode = 'perch';
    else if (typeof Eat !== 'undefined' && Eat.active) mode = 'eat';
    else if (MG.active) mode = MG.active === Darts ? 'darts' : MG.active === BarShift ? 'shift' : MG.active === Karaoke ? 'karaoke' : 'mg';
    if (mode === this.mode) return;
    this.mode = mode;
    const B = $('tBtns'); B.innerHTML = '';
    const btn = (label, cls, down, up) => { const b = document.createElement('button'); b.innerHTML = label; b.className = cls || ''; b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); AudioSys.init(); down && down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); b.classList.remove('on'); up && up(); }, { passive: false }); b.onclick = () => { if (!('ontouchstart' in window)) { down && down(); up && up(); } }; B.appendChild(b); return b; };
    const key = code => () => Game.onKey(code);
    $('tStick').style.display = mode === 'walk' || mode === 'perch' ? '' : 'none';
    $('tPhone').style.display = mode === 'walk' || mode === 'perch' ? '' : 'none';
    if (mode === 'walk') {
      btn('USE', 'big', key('KeyE'));
      btn('SIP', '', key('KeyF')); btn('SMOKE', '', key('KeyC')); btn('SET<br>DOWN', '', key('KeyG')); btn('CHEERS', '', key('KeyR'));
      const r = btn('RUN', 'tog', () => { this.run = !this.run; r.classList.toggle('lit', this.run); });
    } else if (mode === 'perch') {
      btn('USE', 'big', key('KeyE'));
      btn('SIP', '', key('KeyF')); btn('SMOKE', '', key('KeyC')); btn('SET<br>DOWN', '', key('KeyG')); btn('CHEERS', '', key('KeyR')); btn('STAND', 'quit', key('KeyQ'));
    } else if (mode === 'darts') {
      btn('THROW<small>hold · let go in the gold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('STEADY', '', () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
      btn('QUIT', 'quit', key('KeyQ'));
    } else if (mode === 'shift') {
      btn('POUR<small>hold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('SERVE', '', key('Space')); btn('POT', '', key('Digit1')); btn('SCHOO-<br>NER', '', key('Digit2')); btn('PINT', '', key('Digit3'));
      btn('CLOCK<br>OFF', 'quit', key('KeyQ'));
    } else if (mode === 'karaoke') {
      btn('SING!', 'big huge', key('Space')); btn('QUIT', 'quit', key('KeyQ'));
    } else if (mode === 'eat') {
      btn('PUT IT<br>DOWN', '', key('KeyQ'));
    } else if (mode === 'mg') {
      btn('DONE', 'quit', key('KeyQ'));
    }
    this.layout();
  },
  // a thumb cluster: the main action in the bottom-right corner, the rest on arcs around it
  layout() {
    const B = $('tBtns'), all = [...B.children]; if (!all.length) return;
    const u = clamp(Math.min(innerWidth, innerHeight) / 420, 0.78, 1.1), big = all.find(b => b.classList.contains('big')), ring = all.filter(b => b !== big);
    const huge = big && big.classList.contains('huge'), bs = Math.round((huge ? 128 : 92) * u), ss = Math.round(56 * u), R0 = 14, B0 = 16;
    const place = (b, right, bottom, size) => { Object.assign(b.style, { width: size + 'px', height: size + 'px', right: `calc(${Math.round(right)}px + env(safe-area-inset-right))`, bottom: `calc(${Math.round(bottom)}px + env(safe-area-inset-bottom))` }); };
    if (big) place(big, R0, B0, bs);
    const cr = R0 + bs / 2, cb = B0 + bs / 2;
    let r = bs / 2 + ss / 2 + 10 * u, step = (ss + 8 * u) / r, a = 200 * Math.PI / 180, i = 0;
    for (const b of ring) {
      if (!big) { place(b, R0 + i * (ss + 10), B0, ss); i++; continue; }
      if (a < 72 * Math.PI / 180) { r += ss + 10 * u; step = (ss + 8 * u) / r; a = 196 * Math.PI / 180; }
      place(b, cr - Math.cos(a) * r - ss / 2, cb + Math.sin(a) * r - ss / 2, ss); a -= step;
    }
  },
  // what's in front of you decides what the screen shows: menus, conversations and minigames clear the clutter away
  states() {
    const ui = Game.uiOpen || Game.paused || !!(typeof DLG !== 'undefined' && DLG.active), b = document.body.classList;
    b.toggle('tui', ui); b.toggle('inmg', !!MG.active);
  },
  update() {
    if (!this.on) return;
    $('touch').classList.toggle('hidden', Game.mode !== 'play');
    this.buttons(); this.states();
  },
};
