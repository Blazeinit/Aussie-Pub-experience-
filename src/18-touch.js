
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
    const end = e => { for (const t of e.changedTouches) { if (t.identifier === this.stickId) { this.stickId = null; this.mx = this.my = 0; knob.style.transform = ''; } if (t.identifier === this.lookId) this.lookId = null; } };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    // drag on the 3D view to look (not while sat at a pokie or scratching a card — those need taps)
    renderer.domElement.addEventListener('touchstart', e => {
      if (!this.on || Game.mode !== 'play' || player.seated || (MG.active && MG.active.cursor)) return;
      const t = e.changedTouches[0]; this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; e.preventDefault();
    }, { passive: false });
    $('tMenu').onclick = () => { if (Game.mode !== 'play') return; if (!$('panel').classList.contains('hidden')) { Game.closePanel(); return; } Game.paused = true; $('resume').classList.remove('hidden'); };
  },
  // buttons change with what you're doing
  buttons() {
    let mode = 'walk';
    if (Game.mode !== 'play') mode = 'none';
    else if (player.seated) mode = 'pokie';
    else if (typeof Eat !== 'undefined' && Eat.active) mode = 'eat';
    else if (MG.active) mode = MG.active === Darts ? 'darts' : MG.active === BarShift ? 'shift' : MG.active === Karaoke ? 'karaoke' : 'mg';
    if (mode === this.mode) return;
    this.mode = mode;
    const B = $('tBtns'); B.innerHTML = '';
    const btn = (label, cls, down, up) => { const b = document.createElement('button'); b.innerHTML = label; b.className = cls || ''; b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); AudioSys.init(); down && down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); b.classList.remove('on'); up && up(); }, { passive: false }); b.onclick = () => { if (!('ontouchstart' in window)) { down && down(); up && up(); } }; B.appendChild(b); return b; };
    const key = code => () => Game.onKey(code);
    $('tStick').style.display = mode === 'walk' ? '' : 'none';
    if (mode === 'walk') {
      btn('USE<small>E</small>', 'big', key('KeyE'));
      btn('SIP', '', key('KeyF')); btn('SMOKE', '', key('KeyC')); btn('DROP', '', key('KeyG'));
      const r = btn('RUN', 'tog', () => { this.run = !this.run; r.classList.toggle('lit', this.run); });
      btn('📱', '', key('Tab'));
    } else if (mode === 'darts') {
      btn('THROW<small>hold, release in the gold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('STEADY', '', () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
      btn('QUIT', '', key('KeyQ'));
    } else if (mode === 'shift') {
      btn('POUR<small>hold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('POT', '', key('Digit1')); btn('SCHOONER', '', key('Digit2')); btn('PINT', '', key('Digit3'));
      btn('SERVE', '', key('Space')); btn('CLOCK OFF', '', key('KeyQ'));
    } else if (mode === 'karaoke') {
      btn('SING!', 'big huge', key('Space')); btn('QUIT', '', key('KeyQ'));
    } else if (mode === 'eat') {
      btn('PUT IT DOWN', '', key('KeyQ'));
    } else if (mode === 'mg') {
      btn('DONE', '', key('KeyQ'));
    }
  },
  update() {
    if (!this.on) return;
    $('touch').classList.toggle('hidden', Game.mode !== 'play');
    this.buttons();
  },
};
