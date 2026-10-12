
// =====================================================================
//  CASH, THE ATM AND THE JUKEBOX
// =====================================================================
// ---------------------------------------------------------------- banknotes
const NOTE_COL = { 5: ['#e8a8d8', '#a0408a'], 10: ['#7ab0f0', '#1a4aa8'], 20: ['#f08a5a', '#a8301a'], 50: ['#f0d85a', '#a8800a'], 100: ['#7ad8a0', '#1a7a4a'] };
const _noteTex = {};
function noteTex(d) {
  if (_noteTex[d]) return _noteTex[d];
  const [c1, c2] = NOTE_COL[d], c = mkCanvas(256, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(70, 64, 8 + i * 4, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(70, 64, 26, 32, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(40,20,40,.45)'; x.beginPath(); x.ellipse(70, 58, 12, 15, 0, 0, 7); x.fill(); x.fillRect(56, 72, 28, 18);
  x.fillStyle = 'rgba(220,240,255,.75)'; x.fillRect(196, 14, 44, 100); // the clear window
  x.fillStyle = '#fff'; x.font = 'bold 44px Bebas Neue, Impact'; x.textAlign = 'right'; x.fillText(d, 188, 50);
  x.font = 'bold 12px Inter, sans-serif'; x.fillText('AUSTRALIA', 188, 112);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_noteTex[d] = t);
}
function notesFor(amount) { const out = []; let a = Math.round(amount); for (const d of [100, 50, 20, 10, 5]) while (a >= d && out.length < 8) { out.push(d); a -= d; } if (!out.length) out.push(5); return out; }
const noteGeo = new THREE.PlaneGeometry(0.15, 0.075);

const CashFX = {
  vm: null, anim: null,
  build() {
    // a first-person hand holding a fan of notes
    const g = new THREE.Group(); g.visible = false;
    const hand = buildGripHand(0.005, 0.005, 0.03); hand.rotation.set(0, 0, Math.PI / 2); hand.position.set(-0.01, -0.02, 0); g.add(hand);
    this.notes = new THREE.Group(); g.add(this.notes);
    g.traverse(o => { o.frustumCulled = false; });
    vm.root.add(g); this.vm = g;
  },
  fan(amount) {
    while (this.notes.children.length) this.notes.remove(this.notes.children[0]);
    notesFor(amount).slice(0, 5).forEach((d, i, a) => { const m = new THREE.Mesh(noteGeo, new THREE.MeshBasicMaterial({ map: noteTex(d), side: THREE.DoubleSide })); m.rotation.set(-0.15, 0, (i - (a.length - 1) / 2) * 0.18); m.position.set(0.03 + i * 0.006, 0.03, -0.002 * i); this.notes.add(m); });
  },
  // hand the money over (paying at the bar, feeding a pokie)
  pay(amount, style = 'hand') {
    if (!this.vm || player.cig || MG.active || Game.mode !== 'play') return;
    this.fan(amount); this.anim = { t: 0, T: style === 'insert' ? 1.0 : 1.15, style, dir: 1 };
    SFX.noise(0.12, { freq: 3500, q: 1, gain: 0.05 });
  },
  // take money (ATM, winnings)
  receive(amount) {
    if (!this.vm || Game.mode !== 'play') return;
    this.fan(amount); this.anim = { t: 0, T: 1.2, style: 'receive', dir: -1 };
    SFX.noise(0.18, { freq: 3200, q: 1, gain: 0.06 });
  },
  update(dt) {
    const a = this.anim; if (!a || !this.vm) return;
    a.t += dt; const k = clamp(a.t / a.T, 0, 1), up = Math.sin(k * Math.PI);
    const v = this.vm; v.visible = true;
    if (a.style === 'insert') { v.position.set(0.02, -0.32 + up * 0.12, -0.42 - k * 0.12); v.rotation.set(-0.9 * up, 0, 0); v.scale.setScalar(1); this.notes.scale.set(1, 1 - Math.max(0, k - 0.5) * 1.6, 1); }
    else if (a.style === 'receive') { v.position.set(-0.05, -0.45 + up * 0.22, -0.48 + k * 0.1); v.rotation.set(-0.5, 0.2, 0.15 * up); this.notes.scale.set(1, 1, 1); }
    else { v.position.set(-0.04, -0.45 + up * 0.24, -0.4 - up * 0.12); v.rotation.set(-0.6 * up, 0.15, -0.2 * up); this.notes.scale.set(1, 1, 1); this.notes.visible = k < 0.62; }
    if (k >= 1) { this.anim = null; v.visible = false; this.notes.visible = true; }
  },
};

// ---------------------------------------------------------------- the ATM: card, PIN, menu, dispense
const ATM = {
  pos: V3(12.6, 0, -3.3), FEE: 2.5,
  open() {
    const s = Game.state; this.st = { stage: 'card', pin: '', amt: 0 };
    const wrap = document.createElement('div'); wrap.className = 'atm';
    wrap.innerHTML = `<div class="atmscr"><div class="atmhead">ROYAL CREDIT UNION · ATM 2047</div><div class="atmbody"></div></div>
      <div class="atmpad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CANCEL', '0', 'ENTER'].map(k => `<button data-k="${k}" class="${isNaN(+k) ? 'w ' + k.toLowerCase() : ''}">${k}</button>`).join('')}</div>`;
    this.el = wrap;
    wrap.querySelectorAll('.atmpad button').forEach(b => b.onclick = () => this.key(b.dataset.k));
    Game.openPanel('ATM', 'Royal Credit Union · this machine charges $2.50 per withdrawal', wrap, []);
    this.render(); SFX.beep();
  },
  render() {
    const s = Game.state, st = this.st, body = this.el.querySelector('.atmbody');
    const opt = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'atmopt ' + cls; b.innerHTML = label; b.onclick = () => { SFX.beep(); fn(); }; return b; };
    body.innerHTML = '';
    if (st.stage === 'card') { body.innerHTML = '<p class="big">WELCOME</p><p>Please insert your card</p><div class="cardslot"></div>'; body.appendChild(opt('Insert card ▸', () => { SFX.noise(0.4, { freq: 600, q: 1, gain: 0.08 }); st.stage = 'reading'; this.render(); setTimeout(() => { st.stage = 'pin'; this.render(); }, 900); })); }
    else if (st.stage === 'reading') body.innerHTML = '<p class="big">READING CARD…</p><div class="spin"></div>';
    else if (st.stage === 'pin') body.innerHTML = `<p>Enter your PIN, then press ENTER</p><p class="pin">${'●'.repeat(st.pin.length)}${'○'.repeat(4 - st.pin.length)}</p><p class="small">Cover the keypad when entering your PIN</p>`;
    else if (st.stage === 'menu') { body.innerHTML = '<p>Select a transaction</p>'; const g = document.createElement('div'); g.className = 'atmgrid'; g.append(opt('Withdrawal', () => { st.stage = 'amount'; this.render(); }), opt('Balance', () => { st.stage = 'balance'; this.render(); }), opt('Cancel', () => this.close())); body.appendChild(g); }
    else if (st.stage === 'balance') { body.innerHTML = `<p>Available balance</p><p class="big">${fmt$(s.bank)}</p><p class="small">Withdrawn today: ${fmt0(s.night.atm || 0)} of $500 limit</p>`; body.appendChild(opt('Back', () => { st.stage = 'menu'; this.render(); })); }
    else if (st.stage === 'amount') {
      body.innerHTML = '<p>Select amount</p>'; const g = document.createElement('div'); g.className = 'atmgrid';
      for (const a of [20, 50, 100, 200, 300, 500]) g.appendChild(opt(fmt0(a), () => { st.amt = a; st.stage = 'confirm'; this.render(); }, s.bank < a + this.FEE || (s.night.atm || 0) + a > 500 ? 'off' : ''));
      body.appendChild(g); body.appendChild(opt('Back', () => { st.stage = 'menu'; this.render(); }));
    } else if (st.stage === 'confirm') {
      const bad = s.bank < st.amt + this.FEE ? 'Insufficient funds.' : (s.night.atm || 0) + st.amt > 500 ? 'Daily limit of $500 exceeded.' : null;
      if (bad) { body.innerHTML = `<p class="big err">${bad}</p>`; body.appendChild(opt('Back', () => { st.stage = 'amount'; this.render(); })); return; }
      body.innerHTML = `<p>This ATM operator charges a fee of <b>${fmt$(this.FEE)}</b> for this withdrawal.</p><p class="big">${fmt0(st.amt)} + ${fmt$(this.FEE)}</p><p>Do you accept?</p>`;
      const g = document.createElement('div'); g.className = 'atmgrid'; g.append(opt('Accept', () => this.withdraw()), opt('Decline', () => { st.stage = 'menu'; this.render(); })); body.appendChild(g);
    } else if (st.stage === 'processing') body.innerHTML = '<p class="big">PROCESSING…</p><p>Please wait</p><div class="spin"></div>';
    else if (st.stage === 'take') { body.innerHTML = '<p class="big">PLEASE TAKE YOUR CASH</p><p>Then take your card</p>'; }
  },
  key(k) {
    const st = this.st; SFX.tone(1300, 0.06, { gain: 0.05, type: 'square' });
    if (k === 'CANCEL') { this.close(); return; }
    if (st.stage === 'pin') {
      if (/\d/.test(k) && st.pin.length < 4) st.pin += k;
      if (k === 'ENTER' && st.pin.length === 4) { st.stage = 'reading'; this.render(); setTimeout(() => { st.stage = 'menu'; this.render(); }, 700); return; }
      this.render();
    }
  },
  withdraw() {
    const s = Game.state, st = this.st, a = st.amt;
    s.bank -= a + this.FEE; s.night.atm = (s.night.atm || 0) + a; s.night.fees += this.FEE; s.stats.atmFees += this.FEE;
    st.stage = 'processing'; this.render(); SFX.atm();
    setTimeout(() => { st.stage = 'take'; this.render(); setTimeout(() => { Game.closePanel(); this.dispense(a); }, 600); }, 1500);
  },
  close() { Game.closePanel(); SFX.noise(0.3, { freq: 600, q: 1, gain: 0.06 }); },
  // notes slide out of the slot, then you take them
  dispense(a) {
    const slot = V3(this.pos.x - 0.36, 0.95, this.pos.z);
    const stack = new THREE.Group(); scene.add(stack);
    notesFor(a).forEach((d, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.002, 0.075), [0, 1, 2, 3, 4, 5].map(f => f === 2 || f === 3 ? new THREE.MeshStandardMaterial({ map: noteTex(d), roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: NOTE_COL[d][0], roughness: 0.7 }))); m.position.y = i * 0.0025; m.rotation.y = rand(-0.05, 0.05); stack.add(m); });
    stack.position.copy(slot); stack.rotation.y = Math.PI / 2;
    this.disp = { stack, t: 0, a, from: slot.clone(), state: 'out' };
    for (let i = 0; i < 14; i++) SFX.noise(0.04, { delay: 0.1 + i * 0.05, freq: 2200, q: 2, gain: 0.05, pos: slot });
    const ia = addInteract({ id: 'cash', temp: true, pos: slot.clone().add(V3(-0.1, 0.1, 0)), r: 2.4, label: () => `Take your ${fmt0(a)}`, action: () => { interactables.splice(interactables.indexOf(ia), 1); this.disp.state = 'take'; this.disp.t = 0; } });
    this.disp.ia = ia;
    setTimeout(() => { if (this.disp && this.disp.state === 'out') { interactables.splice(interactables.indexOf(ia), 1); this.disp.state = 'take'; this.disp.t = 0; } }, 6000);
  },
  update(dt) {
    const d = this.disp; if (!d) return;
    d.t += dt;
    if (d.state === 'out') { const k = easeOut(clamp(d.t / 0.9, 0, 1)); d.stack.position.copy(d.from).add(V3(-0.1 * k, 0, 0)); }
    else if (d.state === 'take') {
      const k = clamp(d.t / 0.35, 0, 1), cam = camera.position.clone().add(V3(0, -0.25, 0));
      d.stack.position.lerp(cam, k * 0.5);
      if (k >= 1) { scene.remove(d.stack); const s = Game.state; s.wallet += d.a; CashFX.receive(d.a); Game.toast(`Took ${fmt0(d.a)} from the ATM (${fmt$(this.FEE)} fee).`); this.disp = null; }
    }
  },
};

// ---------------------------------------------------------------- the jukebox
const Juke = {
  build() {
    const c = mkCanvas(512, 512); this.screen = { c, tex: canvasTex(c, 1, 1) };
    const jx = 1.6, jz = -17.45;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ map: this.screen.tex, toneMapped: false })); m.material.color.setScalar(1.3); m.position.set(jx, 1.05, jz + 0.315); scene.add(m);
    this.lastSong = -1; this.draw(0);
  },
  draw(t) {
    const x = this.screen.c.getContext('2d'), W = 512, S = Music.SONGS[Music.song] || Music.SONGS[0];
    const g = x.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#ff8a2a'); g.addColorStop(0.5, '#d01a6a'); g.addColorStop(1, '#3a1aa8'); x.fillStyle = g; x.fillRect(0, 0, W, W);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(30, 150, W - 60, 220);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '62px Bungee, Impact'; x.fillText('JUKEBOX', W / 2, 90);
    x.font = '22px Inter, sans-serif'; x.fillStyle = '#ffd84a'; x.fillText('♫ NOW PLAYING ♫', W / 2, 195);
    x.fillStyle = '#fff'; let fs = 44; x.font = `bold ${fs}px Inter, sans-serif`; while (x.measureText(S.name).width > W - 90 && fs > 20) { fs -= 2; x.font = `bold ${fs}px Inter, sans-serif`; } x.fillText(S.name, W / 2, 262);
    x.font = '24px Inter, sans-serif'; x.fillStyle = '#ddd'; x.fillText(S.file ? S.artist : 'The Royal House Band', W / 2, 305);
    for (let i = 0; i < 24; i++) { const h = 10 + Math.abs(Math.sin(t * 6 + i * 0.7) * Math.cos(t * 2.3 + i)) * 40; x.fillStyle = `hsl(${i * 15},90%,65%)`; x.fillRect(48 + i * 17.5, 345 - h * 0.5, 12, h * 0.5); }
    x.fillStyle = '#fff'; x.font = '30px Bebas Neue, Impact'; x.fillText('$2 A SONG · PICK ONE', W / 2, 440);
    this.screen.tex.needsUpdate = true;
  },
  update(dt) { this.t = (this.t || 0) + dt; if (camera.position.distanceTo(V3(1.6, 1.2, -17.45)) < 12 && Game.frameN % 6 === 0) this.draw(this.t); },
  open() {
    const s = Game.state;
    const list = Music.SONGS.map((sg, i) => ({ sg, i })).sort((a, b) => (b.sg.file ? 1 : 0) - (a.sg.file ? 1 : 0));
    const wrap = document.createElement('div'); wrap.className = 'opts juke';
    for (const { sg, i } of list) {
      const b = document.createElement('button'); b.className = 'opt' + (Music.song === i ? ' playing' : '');
      b.innerHTML = `<span>${Music.song === i ? '▶ ' : ''}${sg.name}<span class="d">${sg.file ? `${sg.artist} · ${sg.feel}` : `The Royal House Band · ${sg.bpm} bpm ${sg.feel}`}</span></span><span class="price">$2.00</span>`;
      b.onclick = () => { SFX.click(); if (!Game.spend(2)) return; s.night.extra -= 2; Music.song = i; Music.level = 0.95; s.mood = Math.min(100, s.mood + 4); SFX.coin(V3(1.6, 1.0, -17.2)); Game.toast('♫ ' + sg.name + (sg.file ? ' — ' + sg.artist : '')); Game.closePanel(); };
      wrap.appendChild(b);
    }
    Game.openPanel('JUKEBOX', `Now playing: <b>${Music.SONGS[Music.song].name}</b> · two bucks a song`, wrap);
  },
};
