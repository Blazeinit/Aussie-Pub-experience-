
// =====================================================================
//  ACTIVITIES: needs, shops (bottle-o, kebabs, Room 4, cabs), TAB racing,
//  scratchies, a shift behind the bar, Friday karaoke
// =====================================================================

// ---------------------------------------------------------------- needs: hunger & bladder
const Needs = {
  update(dt) {
    const s = Game.state, gm = dt * Game.timeScale * 60;
    s.hunger = Math.min(100, s.hunger + 0.11 * gm);
    s.bladder = Math.min(100, s.bladder + 0.025 * gm);
    if (s.hunger > 75) s.mood = Math.max(0, s.mood - 0.03 * gm);
    if (s.bladder > 80) { s.mood = Math.max(0, s.mood - 0.05 * gm); if (!this.warned) { this.warned = true; Game.toast('You\'re busting. The gents is out the back, past the dartboard.'); } }
    if (s.bladder < 60) this.warned = false;
    if (s.bladder >= 100 && !MG.active && !Game.uiOpen) { s.mood = Math.max(0, s.mood - 10); Game.toast('Couldn\'t hold it any longer — you sprint for the gents. Just made it.', true); this.toilet(true); }
    if (s.hunger > 85 && !this.hungry) { this.hungry = true; Game.toast('Your stomach\'s growling. A parma, chips, or a kebab over the road would sort you out.'); }
    if (s.hunger < 60) this.hungry = false;
  },
  toilet(rushed) {
    const s = Game.state;
    Game.fade(0, 1);
    setTimeout(() => {
      if (rushed) { player.level = 0; player.pos.set(-12.0, 0, -21.4); player.yaw = Math.PI; }
      s.bladder = 0; achieve('toilet'); s.mood = Math.min(100, s.mood + 4);
      SFX.noise(2.2, { freq: 2600, q: 0.8, gain: 0.05, attack: 0.3 }); SFX.noise(0.4, { delay: 2.3, freq: 600, q: 0.5, gain: 0.1 });
      Game.fade(1, 0); Game.subtitle(choice(['<i>Ahh. That\'s better.</i>', '<i>You read the graffiti twice. Kenno is, apparently, a dart god.</i>', '<i>Breaking the seal. It\'s all downhill from here.</i>']), 3);
    }, 900);
  },
  eat(food) {
    const s = Game.state, F = { parma: [55, 14, 10], roast: [60, 14, 12], chips: [25, 6, 5], kebab: [50, 10, 10], hsp: [65, 16, 12], pizza: [20, 4, 4], can: [0, 0, 2] }[food] || [20, 5, 5];
    s.hunger = Math.max(0, s.hunger - F[0]); s.drunk = Math.max(0, s.drunk - F[1]); s.mood = Math.min(100, s.mood + F[2]);
    SFX.eat();
  },
};

// ---------------------------------------------------------------- shops & places
const Shops = {
  staff: [],
  spawnStaff() {
    this.staff = [];
    const mk = (name, look, pos, ry, open) => { const n = mkNPC(Object.assign({ name, role: 'staff', smoker: false, gambler: false }, look)); n.pos.copy(pos); n.ry = ry; MG.lockNPC(n, pos, ry, 'stand'); n.eventTalk = open; this.staff.push(n); return n; };
    mk('Raj', { shirt: { tile: 'collar', c: 0xc7352b }, pants: { tile: 'cloth', c: 0x222222 }, skinI: 3 }, V3(13.6, 0, -0.6), Math.PI / 2, () => this.bottleO());
    mk('Tony', { shirt: { tile: 'cloth', c: 0xf2f2ee }, pants: { tile: 'cloth', c: 0x333333 }, skinI: 2, style: 'short', beard: 'full' }, V3(10.4, 0, 27.3), Math.PI, () => this.kebab());
  },
  bottleO() {
    const s = Game.state;
    const buy = (price, fn) => () => { if (!Game.spend(price)) return; s.night.extra -= price; SFX.register(V3(14.3, 1.2, -1.2)); fn(); };
    Game.openPanel('ROYAL CELLARS', '<b>Raj:</b> "G\'day boss. What can I get ya?"', Game.optList([
      { label: 'Lucky 7s scratchie', d: 'Match three to win up to $1,000', price: '$2.00', disabled: s.wallet < 2, fn: buy(2, () => Scratchie.start(2)) },
      { label: 'Cash Splash scratchie', d: 'Match three to win up to $5,000', price: '$5.00', disabled: s.wallet < 5, fn: buy(5, () => Scratchie.start(5)) },
      { label: 'Golden Ticket scratchie', d: 'Match three to win up to $25,000', price: '$10.00', disabled: s.wallet < 10, fn: buy(10, () => Scratchie.start(10)) },
      { label: 'Six-pack to take home', d: 'For the couch tomorrow arvo (+mood tomorrow)', price: '$24.00', disabled: s.wallet < 24 || s.next.sixpack, fn: buy(24, () => { s.flags.sixpack = true; Game.closePanel(); Game.toast('Six-pack of Golden for tomorrow. Responsible.'); }) },
      { label: 'Pack of smokes (20)', d: `Cheaper than the bar. You have ${s.cigs}.`, price: '$42.00', disabled: s.wallet < 42, fn: buy(42, () => { s.cigs += 20; s.night.extra += 42; s.night.spentSmokes += 42; s.stats.spentSmokes += 42; Game.closePanel(); Game.toast('20 smokes.'); }) },
      { label: 'Nah, all good', fn: () => Game.closePanel() }]));
  },
  kebab() {
    const s = Game.state;
    const food = (name, price, kind, line) => ({ label: name, price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentFood')) return; Game.closePanel(); SFX.register(V3(10.4, 1.2, 26.7)); Game.subtitle('<b>Tony:</b> ' + choice(['Garlic and chilli? Of course garlic and chilli.', 'Coming up, boss.', 'Best kebab in the state. Every night.']), 3); setTimeout(() => { Needs.eat(kind); Game.toast(line); if (s.time >= 23 && kind !== 'can') achieve('kebab'); }, 2200); } });
    Game.openPanel('KEBAB PALACE', `<b>Tony:</b> "What'll it be, my friend?" · Wallet ${fmt$(s.wallet)}`, Game.optList([
      food('Doner kebab — lamb, garlic, chilli', 14, 'kebab', 'Absolutely demolished that kebab. Garlic sauce on your chin. Worth it.'),
      food('HSP — halal snack pack', 18, 'hsp', 'The holy trinity: chips, meat, sauce. You feel almost sober.'),
      food('Hot chips', 6, 'chips', 'Chicken salt. Always chicken salt.'),
      food('Slice of pizza', 5, 'pizza', 'Cold-ish pizza. Somehow perfect.'),
      food('Can of soft drink', 3.5, 'can', 'Ice cold. Bliss.'),
      { label: 'Just looking', fn: () => Game.closePanel() }]));
  },
  room() {
    const s = Game.state;
    if (s.tonight.room) { this.goStairs(1); return; }
    Game.openPanel('ROOM 4', 'Single iron bed, a telly from 1994 and a balcony over the street. $45 the night — sleep here instead of going home.', Game.optList([
      { label: 'Take the room', price: '$45.00', disabled: s.wallet < 45, fn: () => { if (!Game.spend(45)) return; s.night.extra -= 45; s.tonight.room = true; Game.closePanel(); this.goStairs(1); } },
      { label: 'Not tonight', fn: () => Game.closePanel() }]));
  },
  goStairs(lv) {
    Game.fade(0, 1); SFX.step('timber', player.pos.clone());
    setTimeout(() => {
      player.level = lv;
      if (lv === 1) { player.pos.set(7.0, 0, -1.3); player.yaw = Math.PI; } else { player.pos.set(12.0, 0, 1.1); player.yaw = 0; }
      player.groundY = lv ? UP.y : 0; player.vel.set(0, 0, 0); player.pitch = 0;
      Game.fade(1, 0);
      if (lv === 1) Game.subtitle('<i>Room 4. The carpet\'s seen things. The balcony\'s through the French doors.</i>', 4);
    }, 650);
  },
  fare() { return Game.state.time >= 24 ? 38 : 28; },
  callTaxi() {
    const s = Game.state, f = this.fare(), u = Traffic.taxi.userData;
    if (s.wallet >= f) { s.wallet -= f; s.night.extra -= f; }
    else if (s.bank >= f) { s.bank -= f; s.night.extra -= f; Game.toast('Paid the fare on card.'); }
    else { Game.toast('Can\'t afford a cab. It\'s shanks\'s pony tonight.'); return; }
    u.state = 'arriving'; u.x = 75; u.stopX = -11.5; Traffic.taxi.visible = true; Traffic.taxi.position.set(75, -0.15, 11.4);
    Game.subtitle('<b>Dispatch:</b> Cab\'s on its way, love. Two minutes.', 3);
  },
};

// ---------------------------------------------------------------- TAB: horse racing on every telly
const HORSES = ['Southern Belle', 'Larrikin Lad', 'Red Dust', 'Bush Telegraph', "Mate's Rates", 'Last Drinks', 'Blue Heeler', 'Stubby Holder', 'Thongs at Dawn', 'Servo Pie', 'Big Wet', 'Drop Bear', 'Fair Dinkum', 'Ute Muster', 'Barbie Queen', 'Sunburnt Country', 'Two-Up Tommy', 'Chook Raffle', 'No Worries', 'Yeah Nah', 'Dunny Door', 'Esky Lid', 'Pav Night', 'Bottle-O'];
const SILKS = ['#d22', '#22d', '#dd2', '#fff', '#2a2', '#f80', '#a2a', '#222'];
const Racing = {
  venue: '', races: [], bets: [], next: 0, cur: null, caller: 0,
  setup() {
    const s = Game.state, D = DAYS[s.day];
    this.venue = ['RANDWICK', 'FLEMINGTON', 'EAGLE FARM', 'MORPHETTVILLE', 'ROSEHILL', 'CAULFIELD', 'DOOMBEN'][s.day];
    this.races = []; this.bets = []; this.cur = null;
    const n = Math.max(3, Math.floor((D.close - s.startTime - 0.4) / 0.45));
    for (let i = 0; i < Math.min(8, n); i++) {
      const names = HORSES.slice().sort(() => Math.random() - 0.5).slice(0, 8);
      const runners = names.map((nm, k) => ({ no: k + 1, name: nm, r: gaussian() }));
      const race = { no: i + 1, dist: choice([1000, 1200, 1400, 1600, 2000]), jump: s.startTime + 0.35 + i * 0.45, runners, state: 'betting', t: 0, result: null };
      if (s.day === 3 && i === Math.min(8, n) - 1) { runners[5].name = "Joan's Delight"; runners[5].r = -1.2; race.mick = true; }
      const ex = runners.map(r => Math.exp(1.4 * r.r)), sum = ex.reduce((a, b) => a + b, 0);
      runners.forEach((r, k) => { r.p = ex[k] / sum; r.div = Math.max(1.3, Math.round(0.85 / r.p * 10) / 10); r.pos = 0; r.v = 0; r.ph = Math.random() * 10; });
      this.races.push(race);
    }
  },
  upcoming() { return this.races.find(r => r.state === 'betting') || null; },
  update(dt) {
    const s = Game.state;
    for (const r of this.races) {
      if (r.state === 'betting' && s.time >= r.jump) { r.state = 'running'; r.t = 0; this.cur = r; this.caller = 0; }
      if (r.state === 'running') {
        r.t += dt; const T = 42, L = r.dist;
        for (const h of r.runners) {
          const prog = h.pos / L, kick = prog > 0.7 ? 1 : 0;
          const boost = r.mick && Game.state.flags.mickTip && h.no === 6 ? (prog > 0.65 ? 2.6 : 0) : 0;
          const target = L / T * (1 + 0.035 * h.r + 0.02 * Math.sin(r.t * 0.7 + h.ph) + kick * 0.03 * (h.r + gaussian() * 0.6) + boost * 0.05);
          h.v = damp(h.v, target, 0.8, dt); h.pos = Math.min(L, h.pos + h.v * dt);
        }
        this.commentary(r);
        if (r.runners.every(h => h.pos >= L)) { r.state = 'result'; r.t = 0; r.result = r.runners.slice().sort((a, b) => a.finT - b.finT).map(h => h.no); this.settle(r); }
        for (const h of r.runners) if (h.pos >= L && h.finT == null) h.finT = r.t + Math.random() * 0.01;
      }
      if (r.state === 'result') { r.t += dt; if (r.t > 30) r.state = 'done'; }
    }
  },
  near() { const p = camera.position; return dynamic.tvs.some(tv => tv.kind === 'racing' && tv.group.position.distanceTo(p) < 9) || p.distanceTo(V3(2.6, 1.5, -12.45)) < 7; },
  commentary(r) {
    const L = r.dist, ord = r.runners.slice().sort((a, b) => b.pos - a.pos), lead = ord[0].pos / L;
    const marks = [0.01, 0.3, 0.62, 0.86, 0.995];
    if (this.caller < marks.length && lead >= marks[this.caller]) {
      const c = this.caller++;
      const lines = [`And they're racing in race ${r.no} at ${this.venue}!`, `${ord[0].name} leads, ${ord[1].name} sits second, ${ord[2].name} handy on the rail.`, `Round the turn — ${ord[0].name} kicks clear, ${ord[1].name} chasing!`, `${ord[1].name} is FLYING down the outside! ${ord[0].name} hanging on!`, `${ord[0].name} WINS IT! ${ord[1].name} second, ${ord[2].name} third.`];
      if (this.near() && Game.mode === 'play') { Game.subtitle(`<b>Race caller:</b> ${lines[c]}`, 4); if (c >= 3) SFX.cheer(V3(-8.4, 2.5, -15.3), 1); }
    }
  },
  settle(r) {
    const s = Game.state;
    for (const b of this.bets.filter(b => b.race === r.no && !b.done)) {
      b.done = true; const h = r.runners[b.runner - 1], place = r.result.indexOf(b.runner);
      let win = 0;
      if (b.type === 'win' && place === 0) win = b.amt * h.div;
      if (b.type === 'place' && place >= 0 && place < 3) win = b.amt * Math.max(1.1, 1 + (h.div - 1) / 3.5);
      if (win > 0) { win = Math.round(win * 100) / 100; s.wallet += win; s.night.extra += win; s.mood = Math.min(100, s.mood + 12); SFX.win(3); Game.toast(`🐎 ${h.name} ${b.type === 'win' ? 'won' : 'placed'}! TAB pays ${fmt$(win)}.`, true); if (b.type === 'win' && h.div >= 11) achieve('longshot'); if (r.mick && b.runner === 6) { relUp('Old Mick', 15); Game.subtitle('<b>Old Mick:</b> That\'s my Joanie! HA! That\'s my girl!', 5); } }
      else Game.toast(`${h.name} ran ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', 'last'][place]}. Ticket's in the bin.`);
    }
  },
  open() {
    const s = Game.state, r = this.upcoming();
    if (!r) { Game.openPanel('TAB', 'That\'s the last race for tonight. Back tomorrow.'); return; }
    const mins = Math.max(0, Math.round((r.jump - s.time) * 60));
    const wrap = document.createElement('div');
    let sel = null, type = 'win';
    const pending = this.bets.filter(b => !b.done).map(b => `R${b.race} #${b.runner} ${b.type} ${fmt0(b.amt)}`).join(' · ');
    wrap.innerHTML = `<div style="font-size:13px;opacity:.75;margin-bottom:8px">${this.venue} · Race ${r.no} · ${r.dist}m · jumps in ${mins} min${pending ? `<br>Your tickets: ${pending}` : ''}</div>`;
    const list = document.createElement('div'); list.className = 'opts';
    r.runners.forEach(h => { const b = document.createElement('button'); b.className = 'opt'; b.innerHTML = `<span><b style="color:${SILKS[h.no - 1]};text-shadow:0 0 2px #000">■</b> ${h.no}. ${h.name}<span class="d">Win $${h.div.toFixed(2)} · Place $${Math.max(1.1, 1 + (h.div - 1) / 3.5).toFixed(2)}</span></span>`; b.onclick = () => { sel = h.no; list.querySelectorAll('.opt').forEach(o => o.style.outline = ''); b.style.outline = '2px solid var(--gold)'; SFX.click(); }; list.appendChild(b); });
    wrap.appendChild(list);
    const place = amt => () => { if (!sel) { Game.toast('Pick a runner first.'); return; } if (!Game.spend(amt)) return; s.night.extra -= amt; this.bets.push({ race: r.no, runner: sel, type, amt }); SFX.print(); Game.toast(`TAB ticket: R${r.no} #${sel} ${r.runners[sel - 1].name} — ${type.toUpperCase()} ${fmt0(amt)}`); Game.closePanel(); };
    Game.openPanel('TAB', 'Pick a runner, then a bet. <span style="opacity:.6">Odds are fixed when you bet. Gamble responsibly.</span>', wrap, [
      { label: 'Win / Place: WIN', fn: e => { type = type === 'win' ? 'place' : 'win'; $('pBtns').firstChild.textContent = 'Win / Place: ' + type.toUpperCase(); } },
      { label: '$5', fn: place(5) }, { label: '$10', fn: place(10) }, { label: '$20', fn: place(20) }, { label: '$50', fn: place(50) }, { label: 'Close', fn: () => Game.closePanel() }]);
  },
  // drawn onto every racing telly + the TAB screen
  drawTV(x, W, H, t) {
    const r = this.races.find(q => q.state === 'running') || this.races.find(q => q.state === 'result');
    if (r && r.state === 'running') {
      const L = r.dist, ord = r.runners.slice().sort((a, b) => b.pos - a.pos), lead = ord[0].pos;
      x.fillStyle = '#4a8a3a'; x.fillRect(0, 0, W, H); x.fillStyle = '#7fb8e8'; x.fillRect(0, 0, W, H * 0.22);
      x.fillStyle = '#c8a878'; x.fillRect(0, H * 0.38, W, H * 0.5);
      x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect(((i * 40 - lead * 3) % 480 + 480) % 480 - 80, H * 0.36, 3, 8);
      r.runners.forEach((h, k) => {
        const hx = W * 0.62 + (h.pos - lead) * 6, hy = H * 0.45 + k * H * 0.05;
        x.fillStyle = SILKS[k]; x.fillRect(hx, hy - 4, W * 0.03, 4);
        x.fillStyle = '#3a2210'; x.fillRect(hx - 8, hy, W * 0.07, 7); const leg = Math.sin(t * 20 + k) * 3; x.fillRect(hx - 6 + leg, hy + 7, 2, 6); x.fillRect(hx + 10 - leg, hy + 7, 2, 6);
      });
      x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, H - 26, W, 26); x.fillStyle = '#fff'; x.font = 'bold 13px Inter, sans-serif'; x.textAlign = 'left';
      x.fillText(`R${r.no} ${this.venue} ${r.dist}m · ${ord.slice(0, 3).map(h => h.no).join('-')}  ${Math.round(lead)}m`, 8, H - 9);
      x.fillStyle = '#1a7a3a'; x.fillRect(W - 60, 6, 54, 20); x.fillStyle = '#fff'; x.fillText('LIVE', W - 48, 21);
      return;
    }
    const nx = this.upcoming();
    x.fillStyle = '#062a16'; x.fillRect(0, 0, W, H); x.fillStyle = '#0f8a3a'; x.fillRect(0, 0, W, H * 0.16);
    x.fillStyle = '#fff'; x.font = `bold ${Math.round(H * 0.1)}px Inter, sans-serif`; x.textAlign = 'left';
    if (r && r.state === 'result') { x.fillText(`R${r.no} ${this.venue} — RESULT`, 8, H * 0.12); r.result.slice(0, 4).forEach((no, i) => { const h = r.runners[no - 1]; x.fillStyle = i === 0 ? '#ffd84a' : '#fff'; x.fillText(`${['1st', '2nd', '3rd', '4th'][i]}  ${no}. ${h.name}  ${i === 0 ? '$' + h.div.toFixed(2) : ''}`, 10, H * (0.3 + i * 0.16)); }); return; }
    if (!nx) { x.fillText(`${this.venue} — RACING COMPLETE`, 8, H * 0.12); return; }
    const mins = Math.max(0, Math.round((nx.jump - Game.state.time) * 60));
    x.fillText(`R${nx.no} ${this.venue} ${nx.dist}m · ${mins}m`, 8, H * 0.12);
    x.font = `${Math.round(H * 0.075)}px Inter, sans-serif`;
    nx.runners.forEach((h, k) => { const yy = H * (0.25 + k * 0.095); x.fillStyle = SILKS[k]; x.fillRect(8, yy - H * 0.06, H * 0.06, H * 0.06); x.fillStyle = '#fff'; x.fillText(`${h.no}. ${h.name}`, 14 + H * 0.06, yy); x.textAlign = 'right'; x.fillStyle = '#ffd84a'; x.fillText('$' + h.div.toFixed(2), W - 8, yy); x.textAlign = 'left'; });
  },
  drawBoard() { if (!dynamic.tab) return; const c = dynamic.tab.c; this.drawTV(c.getContext('2d'), c.width, c.height, elapsed); dynamic.tab.tex.needsUpdate = true; },
};

// ---------------------------------------------------------------- scratchies (scratch with the mouse)
const Scratchie = {
  cursor: true,
  start(price) {
    Game.closePanel();
    const mult = price / 2, table = [[2, 0.2], [4, 0.06], [10, 0.03], [20, 0.01], [100, 0.0015], [1000, 0.0001]];
    let prize = 0, r = Math.random(); for (const [a, p] of table) { if (r < p) { prize = a * mult; break; } r -= p; }
    const amounts = [...new Set(table.map(t => t[0] * mult))];
    const grid = []; if (prize) grid.push(prize, prize, prize);
    while (grid.length < 9) { const a = choice(amounts); if (grid.filter(g => g === a).length < 2 && !(a === prize)) grid.push(a); }
    grid.sort(() => Math.random() - 0.5);
    this.g = { price, prize, grid, scratched: false, done: false, name: { 2: 'LUCKY 7s', 5: 'CASH SPLASH', 10: 'GOLDEN TICKET' }[price] };
    MG.start(this);
  },
  enter() {
    const g = this.g; document.exitPointerLock && document.exitPointerLock();
    const wrap = document.createElement('div'); wrap.id = 'scratch';
    wrap.innerHTML = `<div class="sch">${g.name}<small>MATCH 3 AMOUNTS — WIN THAT AMOUNT</small></div><div class="scg"><canvas width="330" height="330"></canvas><canvas width="330" height="330"></canvas></div><div class="scf"><button class="pbtn" id="scAll">Reveal all</button><button class="pbtn" id="scDone">Done</button></div>`;
    document.body.appendChild(wrap);
    const [under, over] = wrap.querySelectorAll('canvas');
    const u = under.getContext('2d'); u.fillStyle = '#fff8e0'; u.fillRect(0, 0, 330, 330);
    g.grid.forEach((a, i) => { const cx = (i % 3) * 110 + 55, cy = Math.floor(i / 3) * 110 + 55; u.fillStyle = a === g.prize && g.prize ? '#c7352b' : '#2a2a2a'; u.font = `bold ${a >= 1000 ? 26 : 34}px Bungee, Impact`; u.textAlign = 'center'; u.textBaseline = 'middle'; u.fillText('$' + a.toLocaleString('en-AU'), cx, cy); });
    const o = over.getContext('2d'); const gr = o.createLinearGradient(0, 0, 330, 330); gr.addColorStop(0, '#c8c8cc'); gr.addColorStop(0.5, '#efeff2'); gr.addColorStop(1, '#a8a8ae'); o.fillStyle = gr; o.fillRect(0, 0, 330, 330);
    o.fillStyle = 'rgba(120,120,130,.6)'; o.font = 'bold 18px Bungee, Impact'; for (let i = 0; i < 9; i++) o.fillText('★ SCRATCH ★', (i % 3) * 110 + 8, Math.floor(i / 3) * 110 + 60);
    let down = false, scratchT = 0;
    const scratch = e => { if (!down) return; const b = over.getBoundingClientRect(), x = (e.clientX - b.left) * 330 / b.width, y = (e.clientY - b.top) * 330 / b.height; o.globalCompositeOperation = 'destination-out'; o.beginPath(); o.arc(x, y, 17, 0, 7); o.fill(); o.globalCompositeOperation = 'source-over'; if (performance.now() - scratchT > 60) { scratchT = performance.now(); SFX.noise(0.05, { freq: rand(2500, 4500), q: 1.2, gain: 0.05 }); } g.scratched = true; };
    over.onmousedown = e => { down = true; scratch(e); }; addEventListener('mouseup', this._up = () => { down = false; this.check(o); }); over.onmousemove = scratch;
    over.addEventListener('touchstart', e => { e.preventDefault(); down = true; scratch(e.touches[0]); }, { passive: false }); over.addEventListener('touchmove', e => { e.preventDefault(); scratch(e.touches[0]); }, { passive: false }); over.addEventListener('touchend', () => { down = false; this.check(o); });
    wrap.querySelector('#scAll').onclick = () => { o.clearRect(0, 0, 330, 330); this.check(o, true); };
    wrap.querySelector('#scDone').onclick = () => { if (!g.done) { o.clearRect(0, 0, 330, 330); this.check(o, true); } MG.stop(); };
    this.el = wrap;
    MG.top(''); MG.help('Click and drag to scratch · <kbd>Q</kbd> to put it away');
  },
  check(o, force) {
    const g = this.g; if (g.done) return;
    const d = o.getImageData(0, 0, 330, 330).data; let clear = 0; for (let i = 3; i < d.length; i += 64) if (d[i] < 20) clear++;
    if (!force && clear / (d.length / 64) < 0.62) return;
    g.done = true;
    const s = Game.state;
    if (g.prize) { s.wallet += g.prize; s.night.extra += g.prize; s.mood = Math.min(100, s.mood + 10); SFX.win(g.prize >= 20 ? 4 : 2); MG.top(`<div class="mgscore"><span><b>WINNER!</b> ${fmt$(g.prize)}</span></div>`); achieve('scratchie'); }
    else { s.mood = Math.max(0, s.mood - 2); MG.top('<div class="mgscore"><span>No luck. Better luck next time.</span></div>'); }
  },
  exit() { if (this.el) this.el.remove(); removeEventListener('mouseup', this._up); this.el = null; },
  update() { MG.cam(V3(15.2, 1.6, -0.6), V3(14.4, 1.0, -0.6), 1 / 60, 3); },
  quit() { MG.stop(); },
};

// ---------------------------------------------------------------- a shift behind the bar
const TAP_BEERS = ['GOLDEN LAGER', 'SOUTHERLY BITTER', 'LARRIKIN PALE ALE', "DROVER'S DRAUGHT"];
const BarShift = {
  hideHands: true,
  offer() {
    const s = Game.state, bev = rel('Bev') >= 15 || s.flags.shiftOK, wage = bev ? 40 : 32;
    Game.openPanel('A SHIFT ON THE BAR?', `<b>${bartender.name}:</b> "We're short tonight. ${wage} bucks for a couple of hours plus whatever tips you earn. Pour 'em right — glass on an angle, straighten it up, two fingers of head."`, Game.optList([
      { label: 'Get behind the bar', d: '1/2/3 glass · aim at a tap · hold mouse to pour · mouse up/down tilts · SPACE serves', fn: () => { Game.closePanel(); this.start(wage); } },
      { label: 'Nah, I\'m here to drink', fn: () => Game.closePanel() }]));
  },
  start(wage) {
    const s = Game.state; s.tonight.shift = true;
    this.g = { wage, t: 0, T: 120, served: 0, tips: 0, orders: [], spawnT: 2, glass: null, tilt: 0.75, pouring: null, foam: 0, best: 0, lookYaw: 0, lookPitch: -0.25, slots: [-7.82, -6.77, -5.72, -4.67].map(z => ({ z, n: null })) };
    if (player.drink) { const d = player.drink; player.drink = null; d.group.parent && d.group.parent.remove(d.group); }
    BAR.shift = true; Game.fade(0, 1);
    setTimeout(() => { MG.start(this); Game.fade(1, 0); }, 700);
  },
  enter() { this.stream = this.stream || makeStream(); this.hud(); },
  exit() {
    const g = this.g; BAR.shift = false;
    if (g.glass) scene.remove(g.glass.group);
    if (this.stream) this.stream.visible = false;
    for (const o of g.orders) { if (o.n) { o.n.mg = null; o.n.leaving = true; o.n.state = 'walk'; o.n.kind = 'walk'; o.n.path = findPath(o.n.pos, NODES.S2); } if (o.tag) o.tag.remove(); }
    BAR.taps.forEach(t => t.handle.rotation.z = 0);
    player.pos.set(-7.4, 0, -6.5); player.yaw = -Math.PI / 2; player.level = 0;
    const s = Game.state, pay = g.wage + g.tips; s.wallet += pay; s.night.extra += pay;
    if (g.served >= 3) achieve('shift');
    Game.openPanel('SHIFT OVER', `Served ${g.served} · Tips ${fmt$(g.tips)} · Wage ${fmt0(g.wage)}`, `<p><b>${bartender.name}:</b> ${g.served >= 6 ? '"You\'re a natural. Come back any time."' : g.served >= 3 ? '"Not bad. You\'ll get there."' : '"Right. Maybe stick to drinking."'}</p><p>${fmt$(pay)} cash in hand.</p>`);
    SFX.register(V3(-9, 1.2, -9));
  },
  quit() { MG.stop(); },
  hud() {
    const g = this.g, left = Math.max(0, g.T - g.t);
    MG.top(`<div class="mgscore"><span>SHIFT ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</span><span><b>SERVED</b> ${g.served}</span><span><b>TIPS</b> ${fmt$(g.tips)}</span></div>${g.msg ? `<div class="mgmsg">${g.msg}</div>` : ''}`);
    MG.help(`<kbd>1</kbd> pot <kbd>2</kbd> schooner <kbd>3</kbd> pint · look at a tap and hold <kbd>LMB</kbd> to pour · <kbd>MOUSE ↑↓</kbd> tilt the glass · <kbd>SPACE</kbd> serve · <kbd>Q</kbd> clock off`);
  },
  key(code) {
    const g = this.g, type = { Digit1: 'pot', Digit2: 'schooner', Digit3: 'pint' }[code];
    if (type && !g.pouring) { if (g.glass) scene.remove(g.glass.group); g.glass = makeGlass(type); g.glass.fill = 0; g.glass.foam = 0; g.foam = 0; g.tilt = 0.75; scene.add(g.glass.group); g.tap = null; SFX.clink(V3(-9, 1.2, -6.5)); }
    if (code === 'Space') this.serve();
  },
  aimTap() { // which handle is under the crosshair?
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    let best = null, bd = 0.07;
    for (const tp of BAR.taps) { tp.handle.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(tp.handle.matrixWorld).add(V3(0, 0.1, 0)); const d = ray.ray.distanceToPoint(hp); if (d < bd) { bd = d; best = tp; } }
    return best;
  },
  down(e) { const g = this.g; if (e.button !== 0 || !g.glass) return; const tp = this.aimTap(); if (!tp) { g.msg = 'Look at a tap handle, then hold the mouse.'; this.hud(); return; } g.pouring = tp; g.tap = tp; SFX.pourStart(); },
  up() { const g = this.g; if (g.pouring) { g.pouring = null; SFX.pourStop(); } },
  serve() {
    const g = this.g; if (!g.glass || g.pouring || g.glass.fill < 0.05) return;
    const beer = g.tapIdx != null ? TAP_BEERS[g.tapIdx] : null, type = g.glass.type;
    const o = g.orders.filter(o => o.state === 'waiting').sort((a, b) => (b.beer === beer && b.type === type) - (a.beer === beer && a.type === type) || a.t0 - b.t0)[0];
    if (!o) { g.msg = 'Nobody\'s waiting for that one.'; this.hud(); return; }
    const right = o.beer === beer && o.type === type;
    const fillQ = 1 - clamp(Math.abs(g.glass.fill - 0.93) * 6, 0, 1), headQ = 1 - clamp(Math.abs(g.foam - 0.016) * 60, 0, 1);
    const q = Math.round((fillQ * 0.55 + headQ * 0.45) * 100);
    const tip = right ? Math.round((q / 100) * (1.5 + Math.random() * 2.5) * 2) / 2 : 0;
    g.served++; g.tips += tip; o.state = 'served';
    if (right && q >= 92) { achieve('pour'); }
    g.msg = right ? `${q >= 92 ? 'Perfect pour!' : q >= 70 ? 'Good pour.' : q >= 40 ? 'Bit rough.' : 'Ugly. They drink it anyway.'} (${q}%)${tip ? ` · tip ${fmt$(tip)}` : ''}` : `Wrong drink — they wanted a ${o.type} of ${o.beer.toLowerCase()}.`;
    bark(o.n, right ? (q >= 70 ? choice(['Beautiful. Cheers.', 'That\'s a proper pour.', 'Lovely, ta.']) : 'Ehh. She\'ll do.') : 'That\'s not what I ordered, mate.', true);
    // hand it over
    o.n.glass.group.visible = true; o.n.a.holdDrink = true; o.n.glass.fill = g.glass.fill;
    scene.remove(g.glass.group); g.glass = null;
    setTimeout(() => { if (o.tag) o.tag.remove(); if (o.n) { o.slot.n = null; o.n.mg = null; o.n.timer = 0; o.n.state = 'idle'; o.n.kind = 'stand'; } g.orders.splice(g.orders.indexOf(o), 1); }, 1200);
    this.hud();
  },
  spawnOrder() {
    const g = this.g, slot = g.slots.find(s => !s.n); if (!slot) return;
    const n = mkNPC({ pos: choice([V3(-6.9, 0, -2.4), V3(-4.6, 0, -4.0), V3(-5.5, 0, -8.6)]) });
    n.state = 'idle'; MG.lockNPC(n, V3(-7.72, 0, slot.z), -Math.PI / 2); n.mg.look = null;
    slot.n = n;
    const beer = choice(TAP_BEERS), type = choice(['pot', 'schooner', 'schooner', 'pint']);
    const tag = document.createElement('div'); tag.className = 'otag'; tag.innerHTML = `<b>${type.toUpperCase()}</b><br>${beer}<i></i>`; document.body.appendChild(tag);
    g.orders.push({ n, slot, beer, type, t0: g.t, pat: 38, state: 'waiting', tag });
  },
  update(dt, t) {
    const g = this.g; g.t += dt;
    // camera behind the bar, looking at the customers; the mouse looks around a little
    g.lookYaw = clamp(g.lookYaw - input.mx * 0.0022 * settings.sens, -1.0, 1.0);
    if (!g.pouring) g.lookPitch = clamp(g.lookPitch - input.my * 0.0022 * settings.sens, -0.7, 0.3);
    const eye = V3(-9.55, 1.62, -6.5), dir = V3(Math.cos(g.lookYaw) * Math.cos(g.lookPitch), Math.sin(g.lookPitch), -Math.sin(g.lookYaw) * Math.cos(g.lookPitch));
    MG.cam(eye, eye.clone().add(dir), dt, 14, 62);
    $('cross').classList.remove('hidden');
    // orders
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.t < g.T - 10) { g.spawnT = rand(7, 13); this.spawnOrder(); }
    for (const o of g.orders) {
      if (o.state !== 'waiting') continue;
      const left = 1 - (g.t - o.t0) / o.pat;
      o.n.h.root.updateWorldMatrix(true, false); MG.pin(o.tag, _v1.set(o.n.pos.x, 2.05, o.n.pos.z));
      o.tag.querySelector('i').style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) { o.state = 'gone'; g.msg = 'A customer gave up and left.'; bark(o.n, 'Forget it. I\'ll go to the Commercial.', true); setTimeout(() => { o.tag.remove(); o.slot.n = null; o.n.mg = null; o.n.leaving = true; o.n.state = 'walk'; o.n.kind = 'walk'; o.n.path = findPath(o.n.pos, NODES.S2); g.orders.splice(g.orders.indexOf(o), 1); }, 600); this.hud(); }
    }
    // the glass under the spout, tilted toward the tap
    if (g.glass) {
      const tap = g.tap || BAR.taps[6];
      g.tapIdx = BAR.taps.indexOf(tap) % 4;
      if (g.pouring) { g.tilt = clamp(g.tilt + input.my * 0.004, 0, 0.85); }
      const gp = V3(tap.spout.x + 0.02, 1.13 + 0.03 * g.tilt, tap.spout.z);
      g.glass.group.position.copy(gp); g.glass.group.rotation.set(0, 0, -g.tilt);
      if (g.pouring) {
        const D = g.glass.D, rate = 0.3 * dt;
        g.glass.fill = Math.min(1.05, g.glass.fill + rate);
        g.foam += rate * (0.004 + 0.07 * Math.pow(1 - g.tilt / 0.85, 2) * (g.glass.fill > 0.3 ? 1 : 0.5));
        g.pouring.handle.rotation.z = damp(g.pouring.handle.rotation.z, 0.7, 12, dt);
        const st = this.stream; st.visible = true; st.material.uniforms.uTime.value = t; st.material.uniforms.uCol.value.setRGB(...D.col);
        const surf = gp.y + g.glass.y0 + (g.glass.y1 - g.glass.y0) * Math.min(1, g.glass.fill), top = tap.spout.y - 0.005, len = Math.max(0.01, top - surf);
        st.position.set(tap.spout.x, top - len / 2, tap.spout.z); st.scale.set(1, len, 1);
        SFX.pourUpdate(g.glass.fill);
        if (g.glass.fill + g.foam / D.h > 1.02) { g.glass.fill = Math.min(g.glass.fill, 1.0); g.foam = Math.max(0, D.h * (1.02 - g.glass.fill)); if (Math.random() < dt * 20) dropFX.emit(V3(gp.x, gp.y + D.h, gp.z), V3(rand(-.2, .2), 0, rand(-.2, .2)), 0.008, 1.5, 0.8, [0.95, 0.9, 0.8]); g.msg = 'Overflowing! Let go!'; }
      } else { this.stream.visible = false; BAR.taps.forEach(tp => tp.handle.rotation.z = damp(tp.handle.rotation.z, 0, 10, dt)); g.foam = Math.max(0, g.foam - dt * 0.0006); }
      g.glass.foam = Math.min(g.foam, g.glass.D.h * 0.5); g.glass.fill = clamp(g.glass.fill, 0, 1); g.glass.update(dt, t);
    }
    if (Game.frameN % 10 === 0) this.hud();
    if (g.t >= g.T && !g.pouring) MG.stop();
  },
};

// ---------------------------------------------------------------- Friday karaoke
const SONG = {
  name: 'Last Drinks at the Royal', bpm: 108,
  lines: ['Knocked off at five with me pay in me hand', 'Down to the Royal to hear the old band', 'Schooner of bitter and a bowl of hot chips', 'Shazza on the mic with a song on her lips',
    'Oh oh, last drinks at the Royal', 'Oh oh, we\'re here till they call it', 'Mick on his stool and the pokies are singing', 'Bev\'s got the raffle and the bell is still ringing',
    'Oh oh, last drinks at the Royal', 'Oh oh, one more and we\'ll go'],
};
function songNotes() {
  const beat = 60 / SONG.bpm, notes = [], scale = [0, 2, 4, 7, 9, 12];
  SONG.lines.forEach((ln, li) => {
    const words = ln.split(' '), t0 = 4 * beat + li * 8 * beat, step = Math.min(0.5, 6.5 / words.length) * beat * 2;
    words.forEach((w, wi) => notes.push({ t: t0 + wi * step, w, line: li, pitch: scale[(li * 3 + wi * 2 + (wi % 3)) % scale.length], hit: null }));
  });
  return notes;
}
const Karaoke = {
  hideHands: true,
  build() {
    // mic stand + speaker + lyric screen in the lounge, by the gaming room wall
    addCylS(SB, MAT.iron, 11.2, 0.75, -3.15, 0.012, 1.5, 6); addCylS(SB, MAT.iron, 11.2, 0.01, -3.15, 0.18, 0.02, 12); SB.add(G.sph, MAT.blackPlastic, 11.2, 1.52, -3.15, 0, 0, 0, 0.025, 0.04, 0.025);
    addBoxS(SB, MAT.blackPlastic, 12.4, 0.45, -3.5, 0.45, 0.9, 0.4); addCol(12.4, -3.5, 0.5, 0.45);
    const c = mkCanvas(512, 288); this.screen = { c, tex: canvasTex(c, 1, 1) };
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), new THREE.MeshBasicMaterial({ map: this.screen.tex })); scr.position.set(11.2, 2.05, -3.86); scene.add(scr);
    SB.add(G.box, MAT.blackPlastic, 11.2, 2.05, -3.9, 0, 0, 0, 1.26, 0.74, 0.04);
    addInteract({ id: 'mic', pos: V3(11.2, 1.4, -3.15), r: 2.2, enabled: () => !MG.active, label: () => DAYS[Game.state.day].event === 'knockoff' && Game.state.time >= 20.5 ? (Game.state.tonight.sang ? 'Karaoke (you\'ve had your go)' : 'Get up and sing (karaoke)') : 'Karaoke — Fridays from 8:30pm', action: () => this.offer() });
    this.draw();
  },
  scores: [],
  draw(live) {
    const x = this.screen.c.getContext('2d'), W = 512, H = 288;
    x.fillStyle = '#16063a'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#ff3a9a'); g.addColorStop(1, '#3ad8ff'); x.fillStyle = g; x.fillRect(0, 0, W, 50);
    x.fillStyle = '#fff'; x.font = '30px Bungee, Impact'; x.textAlign = 'center'; x.fillText('ROYAL KARAOKE', W / 2, 38);
    x.font = '20px Inter, sans-serif';
    if (live) { x.fillStyle = '#ffd84a'; x.fillText(live, W / 2, 150); }
    else if (!this.scores.length) { x.fillText('FRIDAYS FROM 8:30PM', W / 2, 130); x.fillText('Best singer wins a $50 bar tab', W / 2, 170); }
    else { x.fillText('TONIGHT\'S SCORES', W / 2, 90); this.scores.slice().sort((a, b) => b.s - a.s).slice(0, 5).forEach((r, i) => { x.fillStyle = i ? '#fff' : '#ffd84a'; x.fillText(`${r.name} — ${r.s}%`, W / 2, 130 + i * 30); }); }
    this.screen.tex.needsUpdate = true;
  },
  tick(dt) { // NPCs take turns on Friday night
    const s = Game.state;
    if (MG.active === this || DAYS[s.day].event !== 'knockoff' || s.time < 20.5) return;
    if (!this.started) { this.started = true; this.scores = []; this.nextT = 6; Game.subtitle('<b>MC:</b> Righto Royal, KARAOKE TIME! Sign up at the mic!', 4); }
    if (s.time > 23.6 && !this.awarded) { this.awarded = true; const best = this.scores.slice().sort((a, b) => b.s - a.s)[0]; if (best) { Game.subtitle(`<b>MC:</b> And the winner of the fifty-dollar bar tab is… ${best.name.toUpperCase()}!`, 5); SFX.cheer(V3(11.2, 1.5, -3.1), 2); if (best.name === 'You') { s.wallet += 50; s.night.extra += 50; achieve('karaoke'); } } return; }
    this.nextT -= dt;
    if (this.nextT <= 0 && !this.awarded) {
      this.nextT = rand(70, 120);
      const n = this.scores.length === 0 ? REG.here('Shazza') : choice(NPCS.filter(o => o.role === 'patron' && o.state === 'idle' && !o.mg));
      if (!n) return;
      const sc = n.regular === 'Shazza' ? randi(80, 93) : randi(38, 82);
      this.scores.push({ name: n.name, s: sc }); this.draw(`${n.name.toUpperCase()} IS SINGING`); STORY.st().fund += Math.round(sc / 3); STORY.refreshCoins();
      if (camera.position.distanceTo(V3(11.2, 1.5, -3.1)) < 14) { Game.subtitle(`<b>${n.name}:</b> ♪ ${choice(SONG.lines)} ♪`, 4); SFX.cheer(V3(11.2, 1.5, -3.1), 1); }
      n.cheerT = 3; setTimeout(() => this.draw(), 9000);
    }
  },
  offer() {
    const s = Game.state;
    if (DAYS[s.day].event !== 'knockoff' || s.time < 20.5) { Game.toast('Karaoke\'s on Friday night from 8:30.'); return; }
    if (s.tonight.sang) { Game.toast('You\'ve had your turn. The crowd remembers.'); return; }
    Game.openPanel('KARAOKE', `"${SONG.name}" — press <b>SPACE</b> (or click) on each word as it hits the line. Best score of the night wins a $50 bar tab.`, Game.optList([{ label: 'Grab the mic', fn: () => { Game.closePanel(); s.tonight.sang = true; this.begin(); } }, { label: 'Maybe after another schooner', fn: () => Game.closePanel() }]));
  },
  begin() { this.g = { t: -1.5, notes: songNotes(), beat: 60 / SONG.bpm, nextBeat: 0, score: 0, hits: 0 }; Music.level = 0; MG.start(this); },
  enter() {
    const el = document.createElement('div'); el.id = 'kara'; el.innerHTML = '<div class="klane"><div class="kline"></div></div><div class="klyr"></div>'; document.body.appendChild(el); this.el = el;
    this.noteEls = this.g.notes.map(n => { const d = document.createElement('div'); d.className = 'knote'; d.textContent = n.w; d.style.top = (70 - n.pitch * 4.5) + '%'; el.querySelector('.klane').appendChild(d); return d; });
    player.level = 0; MG.help('<kbd>SPACE</kbd> or click on each word as it crosses the line · <kbd>Q</kbd> chicken out');
  },
  exit() {
    if (this.el) this.el.remove(); this.el = null; Music.level = 0.9;
    const g = this.g, pct = Math.round(g.score / g.notes.length * 100);
    this.scores.push({ name: 'You', s: pct }); this.draw();
    if (DAYS[Game.state.day].event === 'knockoff') STORY.addFund(pct, `The crowd chipped in $${pct} for your performance`);
    const s = Game.state; s.mood = Math.min(100, s.mood + (pct > 60 ? 15 : 5));
    Game.toast(`You scored ${pct}%. ${pct >= 85 ? 'The room is on its feet!' : pct >= 60 ? 'Solid effort. Shazza gives you a nod.' : 'The crowd was… supportive.'}`, true);
    player.pos.set(10.6, 0, -2.2); player.yaw = -2.4;
  },
  quit() { MG.stop(); },
  sing(n, good) {
    const f = 220 * Math.pow(2, n.pitch / 12) * (good ? 1 : 1.06);
    // a vowel-ish voice: saw through two formant bandpasses
    SFX.tone(f, 0.32, { type: 'sawtooth', gain: 0.05, attack: 0.03 }); SFX.noise(0.3, { freq: 800 + n.pitch * 20, q: 6, gain: 0.05, attack: 0.03 }); SFX.noise(0.3, { freq: 1200 + n.pitch * 30, q: 8, gain: 0.04, attack: 0.03 });
  },
  press() {
    const g = this.g, drunk = Game.state.drunk / 100;
    const n = g.notes.filter(n => n.hit === null).sort((a, b) => Math.abs(a.t - g.t) - Math.abs(b.t - g.t))[0];
    if (!n) return;
    const err = Math.abs(n.t - g.t), win = 0.09 + drunk * 0.04;
    if (err < win) { n.hit = 1; g.score += 1; this.sing(n, true); }
    else if (err < win * 2.2) { n.hit = 0.6; g.score += 0.6; this.sing(n, true); }
    else { SFX.tone(160, 0.15, { type: 'sawtooth', gain: 0.05 }); }
  },
  key(code) { if (code === 'Space') this.press(); },
  down(e) { if (e.button === 0) this.press(); },
  update(dt) {
    const g = this.g; g.t += dt;
    MG.cam(V3(11.2, 1.62, -3.0), V3(7.5, 1.3, -0.2), dt, 3, 64);
    // backing band: kick + chord stab on every beat
    if (g.t >= g.nextBeat * g.beat && g.t > 0) { const b = g.nextBeat++; SFX.tone(70, 0.18, { gain: 0.18, fEnd: 40 }); if (b % 2) SFX.noise(0.08, { freq: 1800, q: 0.8, gain: 0.07 }); const root = [196, 147, 165, 131][Math.floor(b / 4) % 4]; [1, 1.26, 1.5].forEach(m => SFX.tone(root * m, 0.25, { type: 'triangle', gain: 0.03 })); }
    for (const n of g.notes) if (n.hit === null && g.t - n.t > 0.25) n.hit = 0;
    const lane = 0.42; // seconds per 10% of the lane
    this.g.notes.forEach((n, i) => { const el = this.noteEls[i], x = 20 + (n.t - g.t) / lane * 10; el.style.left = x + '%'; el.style.display = x < -10 || x > 110 ? 'none' : ''; el.className = 'knote' + (n.hit === 1 ? ' hit' : n.hit === 0.6 ? ' ok' : n.hit === 0 ? ' miss' : ''); });
    const cur = g.notes.find(n => n.t > g.t - 0.3) || g.notes[g.notes.length - 1];
    this.el.querySelector('.klyr').textContent = SONG.lines[cur.line];
    const done = g.notes.filter(n => n.hit !== null);
    MG.top(`<div class="mgscore"><span>♪ ${SONG.name}</span><span><b>SCORE</b> ${Math.round(g.score / Math.max(1, done.length) * 100)}%</span></div>`);
    if (Math.random() < dt * 0.6) SFX.cheer(V3(8, 1.5, -1), 0.3);
    if (g.t > g.notes[g.notes.length - 1].t + 2) MG.stop();
  },
};
