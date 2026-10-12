
// =====================================================================
//  NIGHT DIRECTOR: the shape of an evening, nightly goals, your standing at the Royal,
//  the bar tab, and the log that feeds the end-of-night summary.
//  (Night Moments, the one-off events, live in 22-moments.js)
// =====================================================================
const STANDING = [
  { name: 'Blow-in', at: 0, perk: null },
  { name: 'Local', at: 15, perk: 'You can run a tab at the bar (up to $40).' },
  { name: 'Familiar Face', at: 30, perk: 'Mates\' rates: 50c off every drink.' },
  { name: 'Regular', at: 50, perk: 'Bigger tab ($120) and "The usual" one-tap orders.' },
  { name: 'Local Legend', at: 70, perk: 'Your own set of darts (steadier) and a free schooner every night.' },
  { name: 'Royal Royalty', at: 85, perk: 'Your name on the brass plaque behind the bar.' },
];
// goals: 'live' ones tick over as you play, 'end' ones are judged when you leave
const GOALS = [
  { id: 'mates', text: 'Have a yarn with 3 different locals', cash: 10, rep: 3, prog: (s, n) => `${Object.keys(n.talked).length}/3`, test: (s, n) => Object.keys(n.talked).length >= 3 },
  { id: 'shout', text: 'Shout someone a drink', cash: 0, rep: 4, test: (s, n) => n.shouted },
  { id: 'feed', text: 'Get a proper feed in you', cash: 5, rep: 2, test: (s, n) => n.ate },
  { id: 'water', text: 'Have a water between drinks', cash: 5, rep: 2, test: (s, n) => n.water },
  { id: 'darts', text: 'Beat someone at darts', cash: 25, rep: 5, test: (s, n) => n.dartsWon },
  { id: 'pool', text: 'Win a frame of pool', cash: 15, rep: 4, test: (s, n) => n.poolWon },
  { id: 'tab', text: 'Back a horse at the TAB', cash: 10, rep: 2, test: (s, n) => n.horse },
  { id: 'tip', text: 'Tip the bartender', cash: 0, rep: 3, test: (s, n) => n.tipped },
  { id: 'garden', text: 'Check out the beer garden', cash: 5, rep: 2, test: (s, n) => n.visited.garden },
  { id: 'trivia', text: 'Get 4 out of 5 at trivia', cash: 20, rep: 4, avail: s => s.event === 'trivia', test: (s, n) => n.triviaScore >= 4 },
  { id: 'sing', text: 'Get up and sing karaoke', cash: 15, rep: 4, avail: s => s.event === 'knockoff' || s.day === 4, test: (s, n) => n.sang },
  { id: 'sober', text: 'Leave without ever getting past "Tipsy"', cash: 20, rep: 4, type: 'end', prog: (s, n) => n.maxDrunk < 50 ? 'on track' : 'blown', test: (s, n) => n.maxDrunk < 50 },
  { id: 'ahead', text: 'Walk out ahead on the pokies', cash: 15, rep: 3, type: 'end', avail: s => s.day !== 2, prog: (s, n) => n.wagered > 0 ? `${fmt$(n.won - n.wagered)}` : 'play a few', test: (s, n) => n.wagered > 0 && n.won >= n.wagered },
  { id: 'frugal', text: 'Spend less than $60 all night', cash: 15, rep: 3, type: 'end', prog: (s, n) => `${fmt0(n.spentDrinks + n.spentFood + n.wagered - n.won)}`, test: (s, n) => n.spentDrinks + n.spentFood + Math.max(0, n.wagered - n.won) < 60 },
  { id: 'early', text: 'Be on your way home before 10pm', cash: 20, rep: 3, type: 'end', prog: s => Game.clockText(), test: s => s.time < 22 },
];
const Night = {
  house: 0, dark: 0, banner_t: 0,
  // ---------------------------------------------------------- standing
  rep() { return clamp((Game.state.flags.rep || 0), 0, 100); },
  tierIdx(r = this.rep()) { let k = 0; STANDING.forEach((t, i) => { if (r >= t.at) k = i; }); return k; },
  tier() { return STANDING[this.tierIdx()]; },
  addRep(k, why) {
    const f = Game.state.flags, was = this.tierIdx(); f.rep = clamp((f.rep || 0) + k, 0, 100);
    const now = this.tierIdx();
    if (why) this.log(k >= 0 ? '★' : '▼', `${why} (${k >= 0 ? '+' : ''}${Math.round(k * 10) / 10} standing)`);
    if (now > was) {
      const T = STANDING[now];
      this.log('★', `New standing: ${T.name}`);
      Game.toast(`<small style="display:block;font-size:12px;letter-spacing:3px;opacity:.7">STANDING UP</small>${T.name.toUpperCase()}`, true);
      if (T.perk) setTimeout(() => Game.toast('Perk unlocked: ' + T.perk), 1200);
      [523, 659, 784, 1047].forEach((fq, i) => SFX.tone(fq, 0.5, { delay: i * 0.1, gain: 0.07, type: 'triangle' }));
      if (now >= 5) achieve('royalty');
      this.refreshPlaque();
    } else if (now < was) Game.toast(`Your standing at the Royal slipped: ${STANDING[now].name}.`);
  },
  hasPerk(i) { return this.tierIdx() >= i; },
  // ---------------------------------------------------------- tab
  tabLimit() { return this.hasPerk(3) ? 120 : this.hasPerk(1) ? 40 : 0; },
  tab() { return Game.state.flags.tab || 0; },
  tabOK(amt) { return this.tab() + amt <= this.tabLimit() + 1e-9; },
  tabAdd(amt) { Game.state.flags.tab = this.tab() + amt; },
  settleTab() {
    const s = Game.state, owed = this.tab(); if (owed <= 0) return '';
    let rest = owed; const fromBank = Math.min(s.bank, rest); s.bank -= fromBank; rest -= fromBank;
    const fromW = Math.min(s.wallet, rest); s.wallet -= fromW; rest -= fromW;
    s.flags.tab = Math.round(rest * 100) / 100;
    if (rest > 0.01) { this.addRep(-8, `Couldn't clear the tab (${fmt$(rest)} still owing)`); return `<p class="neg">Tab: you paid ${fmt$(owed - rest)} of ${fmt$(owed)}. ${fmt$(rest)} carries over and ${bartender.name} noticed.</p>`; }
    this.addRep(1.5, 'Tab cleared'); return `<p class="pos">Tab of ${fmt$(owed)} settled from the account. ${bartender.name} gives you a nod.</p>`;
  },
  // ---------------------------------------------------------- log (feeds the summary)
  log(icon, text) { const n = Game.state.night; if (!n || !n.log) return; n.log.push({ icon, text, t: Game.state.time }); },
  // ---------------------------------------------------------- nightly set-up
  start() {
    const s = Game.state, n = s.night;
    Object.assign(n, { maxDrunk: 0, talked: {}, ate: false, water: false, dartsWon: false, poolWon: false, shouted: false, tipped: false, visited: {}, horse: false, triviaScore: 0, sang: false, log: [], relStart: Object.assign({}, s.rel), repStart: this.rep(), tabStart: this.tab(), freeUsed: false });
    // three goals: one social, one skill/activity, one end-of-night
    const ok = g => !g.avail || g.avail(s);
    const pick = (list, k) => list.filter(ok).sort(() => Math.random() - 0.5).slice(0, k);
    const social = ['mates', 'shout', 'tip', 'garden', 'water'].map(id => GOALS.find(g => g.id === id)), skill = GOALS.filter(g => ['feed', 'darts', 'tab', 'trivia', 'sing'].includes(g.id));
    const end = GOALS.filter(g => g.type === 'end');
    const sel = [...pick(social, 1), ...pick(skill.filter(g => g.avail), 1).concat(pick(skill.filter(g => !g.avail), 1)).slice(0, 1), ...pick(end, 1)];
    // event-specific goals win a slot when they exist (trivia on Wednesday, karaoke on Friday)
    s.tonight.goals = sel.map(g => ({ id: g.id, done: false, failed: false }));
    this.beat = 0; this.beatsDone = {}; this.house = 0; this.dark = 0; this.rushed = false; this.lastCalled = false; this.tickT = 0;
    if (!this.plaqueBuilt) this.buildPlaque();
    this.refreshPlaque(); this.hud(true);
    Moments.plan();
  },
  goalDef(id) { return GOALS.find(g => g.id === id); },
  // an in-game thing happened: remember it and re-judge
  ev(name, v = true) {
    const n = Game.state.night; if (!n || !n.log) return;
    if (name === 'talk') n.talked[v] = 1; else if (name === 'trivia') n.triviaScore = v; else if (name === 'visit') n.visited[v] = 1; else n[name] = v;
    this.judge();
  },
  judge() {
    const s = Game.state, n = s.night, gs = s.tonight.goals; if (!gs) return;
    for (const g of gs) {
      const d = this.goalDef(g.id); if (g.done || g.failed || d.type === 'end') continue;
      if (d.test(s, n)) this.complete(g, d);
    }
  },
  complete(g, d) {
    const s = Game.state; g.done = true; g.paid = true;
    if (d.cash) { s.wallet += d.cash; s.night.extra += d.cash; }
    this.addRep(d.rep);
    this.log('✔', `Goal: ${d.text}${d.cash ? ` (+${fmt0(d.cash)})` : ''}`);
    Game.toast(`<small style="display:block;font-size:12px;letter-spacing:3px;opacity:.7">GOAL COMPLETE</small>${d.text}${d.cash ? ` · +${fmt0(d.cash)}` : ''}`, true);
    [659, 880, 1109].forEach((fq, i) => SFX.tone(fq, 0.3, { delay: i * 0.08, gain: 0.06, type: 'triangle' }));
    this.hud(true);
  },
  // end-of-night: judge the 'end' goals, pay out, adjust standing for how the night went. Returns summary html.
  finish(reason) {
    const s = Game.state, n = s.night, gs = s.tonight.goals || [];
    const early = s.time < 22 && s.drunk < 35 && ['home', 'taxi', 'room'].includes(reason);
    const rows = [];
    for (const g of gs) {
      const d = this.goalDef(g.id);
      if (d.type === 'end' && !g.done) {
        const good = !['kicked'].includes(reason) && d.test(s, n);
        if (good) { g.done = true; if (d.cash) { s.bank += d.cash; n.extra += d.cash; } this.addRep(d.rep); this.log('✔', `Goal: ${d.text}${d.cash ? ` (+${fmt0(d.cash)} to the account)` : ''}`); } else g.failed = true;
      }
      rows.push(`<li class="${g.done ? 'ok' : 'no'}"><span>${g.done ? '✔' : '✘'}</span>${d.text}${g.done && d.cash ? `<b>+${fmt0(d.cash)}</b>` : ''}</li>`);
    }
    if (reason === 'kicked') this.addRep(-10, 'Turfed out by the bouncer');
    else if (early) this.addRep(3, 'Called it early and sober');
    else if (s.drunk < 35 && ['home', 'taxi', 'room', 'close'].includes(reason)) this.addRep(1, 'Held your drink');
    if (n.glasses >= 3) this.addRep(-3, 'Smashed three glasses');
    // relationships that moved tonight
    const moved = [];
    for (const k in REGULARS) { const a = rel(k), b = n.relStart[k] || 0, d = Math.round((a - b) / 5); if (d !== 0) moved.push(`<span class="${d > 0 ? 'ok' : 'no'}">${k} ${d > 0 ? '▲' : '▼'}</span>`); }
    const T = this.tier(), next = STANDING[this.tierIdx() + 1], gain = this.rep() - n.repStart;
    const bar = next ? Math.round((this.rep() - T.at) / (next.at - T.at) * 100) : 100;
    const log = n.log.filter(l => !/standing\)$/.test(l.text) || /^New/.test(l.text)).slice(-6);
    const hh = h => { const hr = Math.floor(h) % 24, m = Math.floor((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')}${hr >= 12 ? 'pm' : 'am'}`; };
    return `<div class="nsum">
      <div class="nsgoals"><h4>TONIGHT'S GOALS</h4><ul>${rows.join('')}</ul></div>
      <div class="nsrep"><h4>YOUR STANDING</h4><div class="nsname">${T.name}<small>${gain >= 0 ? '+' : ''}${Math.round(gain * 10) / 10} tonight</small></div>
        <div class="nsbar"><i style="width:${bar}%"></i></div><div class="nsnext">${next ? `Next: ${next.name} at ${next.at}` : 'Top of the tree.'}</div>${moved.length ? `<div class="nsrel">${moved.join(' ')}</div>` : ''}</div>
      ${log.length ? `<div class="nslog"><h4>THE NIGHT IN BRIEF</h4>${log.map(l => `<p><span>${hh(l.t)}</span>${l.icon} ${l.text}</p>`).join('')}</div>` : ''}
    </div>`;
  },
  phoneHTML() {
    const s = Game.state, T = this.tier(), next = STANDING[this.tierIdx() + 1], gs = s.tonight.goals || [];
    return `<div class="setrow"><span>Standing at the Royal</span><b>${T.name} · ${Math.round(this.rep())}${next ? ` / ${next.at}` : ''}</b></div>
      ${this.tab() > 0 ? `<div class="setrow"><span>Bar tab</span><b>${fmt$(this.tab())} / ${fmt0(this.tabLimit())}</b></div>` : ''}
      <div style="font-size:13px;margin:6px 0 10px;line-height:1.6">${gs.map(g => { const d = this.goalDef(g.id); return `<div style="opacity:${g.done ? .5 : 1}">${g.done ? '✔' : g.failed ? '✘' : '○'} ${d.text}${d.cash ? ` <span style="opacity:.6">(+${fmt0(d.cash)})</span>` : ''}</div>`; }).join('')}</div>`;
  },
  // ---------------------------------------------------------- HUD
  hud(force) {
    const s = Game.state, gs = s.tonight && s.tonight.goals; if (!gs || !$('goals')) return;
    const n = s.night;
    let html = gs.map(g => { const d = this.goalDef(g.id), p = !g.done && !g.failed && d.prog ? ` <i>${d.prog(s, n)}</i>` : ''; return `<div class="g ${g.done ? 'ok' : ''}"><span>${g.done ? '✔' : d.type === 'end' ? '◷' : '○'}</span><div>${d.text}${p}</div></div>`; }).join('');
    if (this.ticker) html += `<div class="tick">${this.ticker}</div>`;
    if (this._hudHtml !== html) { this._hudHtml = html; $('goals').innerHTML = html; }
  },
  banner(title, sub, dur = 4) {
    const el = $('beat'); if (!el) return;
    el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; el.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), dur * 1000);
  },
  // ---------------------------------------------------------- the shape of the night
  compPrompt() {
    const s = Game.state, stake = s.flags.kennoBet && s.wallet >= 50 ? 50 : 0;
    Game.openPanel('ROYAL DARTS COMP', `Kenno's chalked up the final. ${stake ? 'Fifty dollars says he wins.' : 'Winner takes the trophy and the $60 prize pool.'} Sixteen entries, two left standing.`, Game.optList([
      { label: 'Step up to the oche', d: stake ? `Your $${stake} bet is on` : 'Three rounds, three darts each', fn: () => { Game.closePanel(); Darts.begin(stake, 'Kenno', true); } },
      { label: 'Forfeit', d: 'Kenno will be very quiet about it', fn: () => { Game.closePanel(); Night.addRep(-2, 'Forfeited the darts comp'); } }]), []);
  },
  update(dt) {
    const s = Game.state, D = DAYS[s.day]; if (!Game.entered) return;
    if (VENUE.story && s.day === 5 && s.flags.compEntered && !s.tonight.comp && s.time >= s.startTime + 1.5 && !Game.uiOpen && !MG.active && !player.seated && isInside(player.pos.x, player.pos.z)) { s.tonight.comp = 1; this.compPrompt(); }
    const span = D.close - s.startTime, f = (s.time - s.startTime) / span, B = this.beatsDone;
    s.night.maxDrunk = Math.max(s.night.maxDrunk || 0, s.drunk);
    this.tickT -= dt;
    if (this.tickT <= 0) { this.tickT = 0.6; this.judge(); this.hud(); this.visit(); }
    if (!B.settle && f > 0.04) { B.settle = 1; this.banner('SETTLE IN', `${D.title}. ${STORY.chapter().title.split('— ')[1] || ''}`, 4); }
    if (!B.rush && f > 0.58 && D.crowd >= 12) { B.rush = 1; this.rush(); }
    if (!B.warn && s.time >= D.close - 0.5) { B.warn = 1; this.banner('LAST CALL IN 30', 'Order now, or don\'t', 4); SFX.bell(V3(-9, 2.5, -8), 1); }
    // house lights: up for the last drinks bell, then back down
    const target = this.lastCalled ? 1 : 0; this.house = damp(this.house, target, 1.6, dt);
    this.dark = damp(this.dark, Moments.dark ? 1 : 0, 3, dt);
  },
  visit() {
    const p = player.pos;
    if (inGarden(p.x, p.z)) this.ev('visit', 'garden');
  },
  rush() {
    this.banner('THE RUSH', 'The bar\'s three deep. Somebody\'s shouting a round.', 5);
    Game.arrivals += Math.round(DAYS[Game.state.day].crowd * 0.25); Game.arriveT = 3;
    Music.level = Math.min(1.1, Music.level + 0.25); AudioSys.amp.crowd = Math.min(1.6, AudioSys.amp.crowd + 0.25);
    this.log('🍻', 'The Friday-night rush hit');
  },
  // the lights come up, the bell goes, and you decide how this ends
  lastCall() {
    if (this.lastCalled) return; this.lastCalled = true;
    const s = Game.state;
    this.banner('LAST DRINKS', 'House lights up. The bell\'s gone. Make it count.', 6);
    Music.level = Math.max(0.2, Music.level - 0.3);
    this.log('🔔', 'Last drinks called');
    if (Game.mode !== 'play' || Game.uiOpen || MG.active || player.seated) { if (player.seated) Game.toast('Last drinks! Wrap it up, champ.'); return; }
    if (Cine.lastCall(bartender)) { const iv = setInterval(() => { if (!Cine.active) { clearInterval(iv); if (Game.mode === 'play' && !Game.uiOpen && !MG.active) setTimeout(() => this.lastCallPanel(), 400); } }, 300); return; }
    setTimeout(() => { if (Game.mode !== 'play' || Game.uiOpen || MG.active) return; this.lastCallPanel(); }, 3600);
  },
  lastCallPanel() {
    const s = Game.state, price = Game.drinkPrice('schooner'), rsa = s.drunk >= 80, holding = player.drink && player.drink.fill > 0.08;
    const opts = [
      { label: 'One for the road', d: rsa ? '"Sorry mate, I can\'t."' : 'A schooner, last of the night', price: fmt$(price), disabled: rsa || holding, fn: () => { Game.closePanel(); Game.order('schooner', price); } },
      { label: 'Grab a kebab on the way home', d: 'Soaks it up. Clive\'s Kebabs is still open', fn: () => { Game.closePanel(); Game.toast('Kebab shop\'s on the corner. Walk out the front, turn left.'); } },
      { label: 'Call a taxi', d: Shops.fare ? `About ${fmt0(Shops.fare())}` : '', fn: () => { Game.closePanel(); if (Shops.callTaxi) Shops.callTaxi(); else Game.walkHome(); } },
      { label: 'Walk home', d: 'Head out the front', fn: () => { Game.closePanel(); Game.walkHome(); } },
      { label: 'Stay until they chuck you out', fn: () => Game.closePanel() }];
    Game.openPanel('LAST DRINKS', `${bartender.name}: "Last drinks, folks! Get em in!" — ${Game.clockText()}`, Game.optList(opts), []);
  },
  // ---------------------------------------------------------- the brass plaque and the tip jar
  buildPlaque() {
    this.plaqueBuilt = true;
    const F = BAR.front;
    this.plaqueTex = { c: mkCanvas(512, 256) }; this.plaqueTex.tex = canvasTex(this.plaqueTex.c, 1, 1);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: this.plaqueTex.tex, roughness: 0.4, metalness: 0.7 }));
    p.position.set(-12.85, 2.65, -4.2); p.rotation.y = Math.PI / 2; scene.add(p); this.plaque = p; p.visible = false;
    // tip jar by the till
    const jar = new THREE.Group(); jar.position.set(F - 0.12, 1.112, -9.35); scene.add(jar);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.16, 18, 1, true), glassMat); glass.position.y = 0.08; jar.add(glass);
    const lbl = signTex(['TIPS'], { w: 128, h: 64, bg: '#f4ead6', color: '#7a1f18', sizes: [46], font: "'Permanent Marker', cursive" });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ map: lbl })); lp.position.set(0.071, 0.09, 0); lp.rotation.y = Math.PI / 2; jar.add(lp);
    this.tipCoins = new THREE.Group(); jar.add(this.tipCoins);
    addInteract({ id: 'tipjar', pos: V3(F - 0.12, 1.25, -9.35), r: 2.1, label: () => 'Tip the bartender', action: () => this.tip() });
  },
  refreshPlaque() {
    if (!this.plaque) return;
    this.plaque.visible = this.tierIdx() >= 5;
    const x = this.plaqueTex.c.getContext('2d'); x.fillStyle = lg(x, 0, 0, 512, 256, ['#8a6a22', '#d9b24a', '#8a6a22']); x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#5a4210'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 236); x.fillStyle = '#2b1e06'; x.textAlign = 'center';
    x.font = 'bold 30px Rye, serif'; x.fillText('ROYAL HOTEL · ROLL OF HONOUR', 256, 78, 460); x.font = 'bold 60px Rye, serif'; x.fillText('YOU', 256, 158); x.font = '22px Inter, sans-serif'; x.fillText('"Pulled up a stool and never left"', 256, 208, 460);
    this.plaqueTex.tex.needsUpdate = true;
  },
  tip() {
    const s = Game.state, n = s.night;
    const give = a => () => { if (!Game.spend(a)) return; n.extra -= a; n.tipped = true; Game.closePanel(); SFX.coin(V3(BAR.front, 1.2, -9.35)); bark(bartender, choice(['Cheers, legend.', 'Ripper. Cheers mate.', 'You\'re too kind.', 'Appreciate it!']), true); this.addRep(a >= 5 ? 2 : 1, 'Tipped the bartender'); this.judge(); this.log('🪙', `Tipped ${bartender.name} ${fmt0(a)}`); this.refreshTips(); };
    Game.openPanel('TIP JAR', 'Nobody expects it in Australia. Everybody notices.', Game.optList([{ label: 'Chuck in a gold coin', price: '$2.00', disabled: s.wallet < 2, fn: give(2) }, { label: 'Leave a fiver', price: '$5.00', disabled: s.wallet < 5, fn: give(5) }, { label: 'Not tonight', fn: () => Game.closePanel() }]));
  },
  refreshTips() {
    if (!this.tipCoins) return;
    const c = this.tipCoins; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(G.cyl8, MAT.brass); m.scale.set(0.014, 0.002, 0.014); m.position.set(rand(-0.03, 0.03), 0.01 + c.children.length * 0.0028, rand(-0.03, 0.03)); m.rotation.set(rand(-0.3, 0.3), rand(0, 3), 0); c.add(m); }
    while (c.children.length > 40) c.remove(c.children[0]);
  },
};
ACH_LIST.push(['royalty', 'Royal Royalty', 'Reach the top standing at the Royal.'], ['champ', 'Royal Darts Champion', 'Win the Saturday darts comp.']);
