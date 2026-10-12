
// =====================================================================
//  NIGHT MOMENTS: one-off events that make each night different.
//  Each night (Mon-Sat) rolls one moment that hasn't happened yet this week.
//    blackout  the power goes; phone torch and candles
//    bucks     a bucks party dares you to skull a schooner
//    wake      a wake in the lounge; keep your voice down, raise a glass
//    footy     a preliminary final; back a team, watch the scoreboard
//    inspector the licensing inspector does the rounds; stay presentable
//    busker    a bloke with a guitar sets up by the fire; take requests
// =====================================================================
const Moments = {
  dark: false, cur: null, at: 0, started: false,
  names: ['blackout', 'bucks', 'wake', 'footy', 'inspector', 'busker'],
  plan() {
    const s = Game.state, f = s.flags; this.cleanup();
    this.started = false; this.id = null;
    if (s.day === 6) return;   // Sunday is the council meeting
    const used = f.momentsUsed || (f.momentsUsed = []);
    let pool = this.names.filter(n => !used.includes(n)); if (!pool.length) { used.length = 0; pool = this.names.slice(); }
    this.id = window.__moment || choice(pool);
    const D = DAYS[s.day]; this.at = s.startTime + (D.close - s.startTime) * rand(0.3, 0.5);
    window.__moment = null;
  },
  cleanup() { if (this.cur && this.cur.cleanup) this.cur.cleanup(); this.cur = null; this.dark = false; player.chug = false; Night.ticker = ''; Night.house = 0; if (this.torch) this.torch.visible = false; this.setScreens(true); },
  update(dt) {
    const s = Game.state;
    if (!this.started && this.id && Game.entered && s.time >= this.at) { this.started = true; (s.flags.momentsUsed = s.flags.momentsUsed || []).push(this.id); this.cur = this[this.id](); }
    if (this.cur && this.cur.update) { if (this.cur.update(dt) === 'done') { if (this.cur.cleanup) this.cur.cleanup(); this.cur = null; } }
    Night.hud();
  },
  // ---------------------------------------------------------- helpers
  arrive(opts, spotFilter) {
    const n = mkNPC(Object.assign({ pos: V3(rand(-4, 4), 0, 21) }, opts)); n.timer = 1e9;
    const sp = freeSpots(spotFilter)[0] || freeSpots(s => s.area === 'bar' || s.area === 'lounge')[0];
    if (sp) { sendTo(n, sp); n.path.unshift(...streetApproach(n)); n.a.holdDrink = true; n.glass.group.visible = true; } else { scene.remove(n.h.root); NPCS.pop(); return null; }
    return n;
  },
  leave(list) { for (const n of list) { if (!n || n.gone) continue; n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); n.timer = 20; } },
  setScreens(on) { for (const m of MACHINES) if (m.scr) m.scr.visible = on; if (PokieFX.group) PokieFX.group.visible = on; },

  // ---------------------------------------------------------- 1. BLACKOUT
  blackout() {
    Game.fade(1, 0); SFX.noise(0.5, { freq: 120, q: 0.6, gain: 0.2 });
    this.dark = true; this.setScreens(false); Music.level = 0.05;
    Night.banner('BLACKOUT', 'The power\'s gone. Dead quiet, then somebody laughs.', 5);
    if (!this.torch) { const t = new THREE.SpotLight(0xfff0d8, 0, 16, 0.55, 0.65, 1.3); t.position.set(0.15, -0.1, 0); t.target.position.set(0, 0, -1); camera.add(t); camera.add(t.target); if (!camera.parent) scene.add(camera); this.torch = t; }
    this.torch.visible = true; this.torch.intensity = 26;
    Night.log('⚡', 'The power went out');
    const e = { t: 0, said: 0, lines: [['Shazza', 'WHO TURNED OFF THE LIGHTS?!'], ['Kenno', 'Ahh, bloody council.'], ['Old Mick', 'Eighty-one blackouts I\'ve sat through. This is a good one.'], ['Davo', 'My machine was about to go OFF!']],
      update: dt => {
        e.t += dt;
        if (e.t > 6 * (e.said + 1) && e.said < e.lines.length) { const [who, l] = e.lines[e.said++]; const n = REG.here(who) || choice(NPCS.filter(n => n.role === 'patron')); if (n) bark(n, l, true); }
        this.torch.intensity = 22 + Math.sin(e.t * 2.1) * 1.5;
        if (e.t > 50) { this.back(); return 'done'; }
      }, cleanup: () => { this.dark = false; this.setScreens(true); this.torch.visible = false; this.torch.intensity = 0; } };
    return e;
  },
  back() {
    Game.fade(0.9, 0); this.dark = false; this.setScreens(true); this.torch.visible = false; this.torch.intensity = 0; Music.level = 0.5;
    SFX.cheer(V3(-4, 1.5, -6), 3); SFX.noise(0.4, { freq: 3000, q: 0.5, gain: 0.1 });
    Night.banner('POWER\'S BACK', 'Every machine reboots at once. The pub cheers.', 4);
    NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 1.8; });
    bark(bartender, 'First one\'s on the house — candlelit special!', true);
    if (!Game.items.length && !(player.drink && player.drink.fill > 0.08)) bartenderOrder({ type: 'pot', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => Game.placeItem(item, spot) });
    Night.log('💡', 'Power came back; free pot on the house'); Night.addRep(1);
  },

  // ---------------------------------------------------------- 2. BUCKS PARTY: the skull dare
  bucks() {
    const col = 0xff4fa0, look = { shirt: { tile: 'collar', c: col }, pants: { tile: 'cloth', c: 0x2a2a30 }, girth: 1.1 };
    const names = ['Tezza (the groom)', 'Gaz', 'Brodie'];
    const lads = names.map(nm => this.arrive(Object.assign({ name: nm }, look), s => s.area === 'bar' && (s.kind === 'stand' || s.kind === 'lean'))).filter(Boolean);
    if (!lads.length) return null;
    Night.banner('BUCKS PARTY', 'Three blokes in matching pink shirts have taken over the bar.', 5);
    Night.log('👔', 'A bucks party rolled in');
    const e = { lads, skull: null, done: false };
    const dare = () => {
      const s = Game.state, holding = player.drink && player.drink.fill > 0.08;
      Game.openPanel('THE DARE', `<b>Tezza:</b> "Oi! Fresh face! Twenty bucks says you can't skull a schooner in twenty-five seconds. Win and the lads pay <b>$60</b>."`, Game.optList([
        { label: 'Take the dare', d: holding ? 'Finish or drop your drink first' : 'Hold F to chug. Don\'t spill it', price: '$20.00', disabled: s.wallet < 20 || holding || s.drunk > 70, fn: () => { if (!Game.spend(20)) return; s.night.extra -= 20; Game.closePanel(); e.skull = { state: 'wait', stake: 20, t: 0, tick: 0 }; bark(lads[0], 'ON! Barkeep, a schooner for the champ!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => Game.placeItem(item, spot) }); Night.banner('THE DARE', 'Pick up your schooner. The clock starts when you do.', 4); } },
        { label: '"Nah, I\'ve got a bit of self-respect."', fn: () => { Game.closePanel(); bark(lads[0], 'Weak as, mate!', true); } }]), []);
    };
    for (const n of lads) n.eventTalk = () => { if (e.skull) { Game.toast('The lads are waiting on you.'); return; } if (e.over) { bark(n, 'Legends never die, mate.', true); return; } dare(); };
    e.update = dt => {
      const k = e.skull; const s = Game.state;
      if (e.over && s.time > e.leaveAt) { this.leave(lads); return 'done'; }
      if (!k) return;
      if (k.state === 'wait') { k.t += dt; Night.ticker = 'DARE: grab your schooner'; if (player.drink && player.drink.fill > 0.8 && !player.drink.onLedge) { k.state = 'go'; k.t = 25; player.chug = true; Night.ticker = ''; Night.banner('SKULL! SKULL! SKULL!', 'Hold F. Twenty-five seconds.', 3); SFX.cheer(lads[0].pos, 2); lads.forEach(n => n.cheerT = 3); } else if (k.t > 90) { e.skull = null; Game.state.wallet += k.stake; Game.toast('The lads got bored. Stake refunded.'); Night.ticker = ''; } }
      else if (k.state === 'go') {
        k.t -= dt; k.tick -= dt; Night.ticker = `SKULL! ${Math.ceil(k.t)}s`;
        if (k.tick <= 0) { k.tick = 3; Game.subtitle('<b>The lads:</b> SKULL! SKULL! SKULL!', 2); }
        const d = player.drink;
        if (!d) { this.skullEnd(e, false, 'You dropped it. Tezza claps you on the back. "Mate."'); }
        else if (d.fill < 0.04) this.skullEnd(e, true);
        else if (k.t <= 0) this.skullEnd(e, false, 'Time! Half a glass left. The lads are howling.');
      }
    };
    e.cleanup = () => { player.chug = false; Night.ticker = ''; for (const n of lads) n.eventTalk = null; };
    return e;
  },
  skullEnd(e, win, why) {
    const k = e.skull, s = Game.state; player.chug = false; Night.ticker = ''; e.skull = null; e.over = true; e.leaveAt = s.time + 0.45;
    if (win) { s.wallet += k.stake * 3; s.night.extra += k.stake * 2; s.mood = Math.min(100, s.mood + 15); SFX.cheer(e.lads[0].pos, 3); e.lads.forEach(n => n.cheerT = 3); Game.toast(`SKULLED IT! The lads pay up: +${fmt0(k.stake * 3)}`, true); Game.subtitle('<b>Tezza:</b> ABSOLUTE LEGEND! Get this bloke a medal!', 4); Night.log('🍺', 'Skulled a schooner for the bucks party (+$40 net)'); Night.addRep(3); achieve('skull'); }
    else { s.mood = Math.max(0, s.mood - 3); Game.toast(why, true); Night.log('🍺', 'Lost the skull dare ($20 down)'); }
  },

  // ---------------------------------------------------------- 3. A WAKE in the lounge
  wake() {
    const dark = { shirt: { tile: 'collar', c: 0x101012 }, pants: { tile: 'cloth', c: 0x15151a } };
    const mourners = ['Pam', 'Rob', 'Jill', 'Col', 'Meg'].map(nm => this.arrive(Object.assign({ name: nm }, dark, { fem: ['Pam', 'Jill', 'Meg'].includes(nm) }), s => s.area === 'lounge')).filter(Boolean);
    if (!mourners.length) return null;
    Night.banner('A WAKE', 'They\'re farewelling Terry "Tezza" Dwyer, 71. Keep your voice down.', 6);
    Night.log('🕯', 'A wake for Tezza Dwyer in the lounge');
    const saved = { music: Music.level, crowd: AudioSys.amp.crowd }; Music.level = 0.12; AudioSys.amp.crowd = Math.max(0.35, saved.crowd * 0.6);
    const e = { mourners, done: false, toast: false, start: Game.state.time, toasted: false, paid: false };
    const raise = () => {
      if (e.toasted) return; e.toasted = true;
      Game.fade(0.5, 0); Game.subtitle('<b>Pam:</b> To Tezza. Never bought a round in his life, bless him.', 4);
      setTimeout(() => { SFX.cheer(mourners[0].pos, 3); NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 3; }); Music.level = saved.music; AudioSys.amp.crowd = saved.crowd; Game.subtitle('<b>The whole pub:</b> TO TEZZA!', 3.5); Game.state.mood = Math.min(100, Game.state.mood + 8); }, 2200);
      Night.log('🥃', 'Raised a glass to Tezza'); Night.addRep(2); relUp('Old Mick', 5);
    };
    for (const n of mourners) n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel(n.name.toUpperCase(), '<span style="opacity:.7">Black ties, a photo of a grinning bloke with a kelpie, a jar for the funeral fund.</span><br><br>"Thanks for coming, love. He\'d have wanted a big turnout. And free beer."', Game.optList([
        { label: 'Chip in $20 to the kitty', d: 'For the funeral costs', price: '$20.00', disabled: e.paid || s.wallet < 20, fn: () => { if (!Game.spend(20)) return; s.night.extra -= 20; e.paid = true; Game.closePanel(); bark(n, 'God bless you. Tezza would\'ve loved you.', true); Night.addRep(4, 'Chipped in for Tezza\'s wake'); s.mood = Math.min(100, s.mood + 6); for (const k in REGULARS) relUp(k, 2); } },
        { label: 'Raise a glass to Tezza', d: e.toasted ? 'You already have' : 'The whole room will join in', disabled: e.toasted, fn: () => { Game.closePanel(); raise(); } },
        { label: '"Sorry for your loss."', fn: () => { Game.closePanel(); s.mood = Math.min(100, s.mood + 2); bark(n, 'Thanks, love.', true); } }]), []);
    };
    e.update = dt => {
      if (!e.toasted && Game.state.time > e.start + 0.5) raise();
      if (Game.state.time > e.start + 0.75) { this.leave(mourners); return 'done'; }
    };
    e.cleanup = () => { for (const n of mourners) n.eventTalk = null; Music.level = saved.music; AudioSys.amp.crowd = saved.crowd; };
    return e;
  },

  // ---------------------------------------------------------- 4. FOOTY: a preliminary final on the big screen
  footy() {
    const f = { Swans: { g: 0, b: 0 }, Pies: { g: 0, b: 0 } }, pts = k => f[k].g * 6 + f[k].b;
    const e = { f, q: 1, qt: 0, bet: null, t: 3, done: false, start: Game.state.time };
    Night.banner('PRELIMINARY FINAL', 'Swans v Pies on every screen. Back a team at the bar.', 6);
    Night.log('🏉', 'Swans v Pies prelim final on the telly');
    Music.level = Math.max(0.15, Music.level - 0.2);
    e.options = (opts, holding, rsa) => { if (e.done || e.bet) return; const s = Game.state; for (const t of ['Swans', 'Pies']) opts.push({ label: `Back the ${t} ($10)`, d: `Pays $19 if they win. ${t === 'Swans' ? 'Favourites.' : 'Underdogs, if you believe in them.'}`, price: '$10.00', disabled: s.wallet < 10, fn: () => { if (!Game.spend(10)) return; s.night.extra -= 10; e.bet = t; Game.closePanel(); Night.log('🏉', `$10 on the ${t}`); Game.toast(`$10 on the ${t}. Come on!`); } }); };
    e.tick = () => `Q${e.q} · SWANS ${f.Swans.g}.${f.Swans.b}.${pts('Swans')} – PIES ${f.Pies.g}.${f.Pies.b}.${pts('Pies')}`;
    e.update = dt => {
      e.t -= dt; e.qt += dt; Night.ticker = e.done ? Night.ticker : e.tick() + (e.bet ? ` · you: ${e.bet}` : '');
      if (e.done) { if (Game.state.time > e.endAt + 0.25) { Night.ticker = ''; return 'done'; } return; }
      if (e.t <= 0) {
        e.t = rand(3, 7); const team = Math.random() < 0.52 ? 'Swans' : 'Pies', goal = Math.random() < 0.45;
        if (goal) { f[team].g++; SFX.cheer(V3(0, 2.5, 0), 2); bark(choice(NPCS.filter(n => n.role !== 'bartender')) || bartender, choice(['GOAAAL!', 'Get in!', 'Ump! Was that out?!', 'Beauty!', 'Kick it long!']), true); NPCS.forEach(n => { if (n.role === 'patron' && Math.random() < 0.4) n.cheerT = 1.4; }); } else f[team].b++;
      }
      if (e.qt > 15) { e.qt = 0; e.q++; Night.banner(`QUARTER ${e.q > 4 ? 'TIME' : 'TIME'}`, e.tick(), 2.5); if (e.q > 4) { e.done = true; e.endAt = Game.state.time; const a = pts('Swans'), b = pts('Pies'), w = a === b ? (Math.random() < 0.5 ? 'Swans' : 'Pies') : a > b ? 'Swans' : 'Pies'; Night.ticker = `FULL TIME · SWANS ${a} – PIES ${b}`; Night.banner('FULL TIME', `${w} win ${Math.max(a, b)} to ${Math.min(a, b)}`, 5); SFX.cheer(V3(0, 2.5, 0), 3);
        if (e.bet) { if (e.bet === w) { Game.state.wallet += 19; Game.state.night.extra += 19; Game.state.mood = Math.min(100, Game.state.mood + 12); Game.toast(`The ${w} got up! +$19`, true); Night.log('🏉', `The ${w} won: $10 became $19`); Night.addRep(1); } else { Game.state.mood = Math.max(0, Game.state.mood - 4); Game.toast(`The ${w} won. $10 down the drain.`); Night.log('🏉', `The ${w} won. Lost the $10`); } } else Night.log('🏉', `The ${w} won, ${Math.max(a, b)}–${Math.min(a, b)}`); } }
    };
    e.cleanup = () => { Night.ticker = ''; };
    this.footyE = e; return e;
  },
  barOptions(opts, holding, rsa) { if (this.cur && this.cur.options) this.cur.options(opts, holding, rsa); },

  // ---------------------------------------------------------- 5. LICENSING INSPECTOR
  inspector() {
    const n = this.arrive({ name: 'Ms Whitlock', fem: true, shirt: { tile: 'collar', c: 0x2a4a6a }, pants: { tile: 'cloth', c: 0x20242c }, hair: 0x3a3030, style: 'bob', glasses: true, role: 'patron' }, s => s.area === 'bar' && s.kind === 'stand');
    if (!n) return null;
    n.smoker = false; n.a.holdDrink = false; n.glass.group.visible = false;
    Night.banner('LICENSING INSPECTOR', 'Ms Whitlock is doing the rounds with a clipboard. Stay presentable.', 6);
    Night.log('📋', 'The licensing inspector came through');
    const e = { n, flagged: false, watch: 5, end: Game.state.time + 0.55, offered: false };
    n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel('MS WHITLOCK', '<span style="opacity:.7">Office of Liquor &amp; Gaming. Lanyard. Clipboard. Expressionless.</span><br><br>"Evening. Routine inspection. RSA signage, responsible-service records, and patrons. Nothing to worry about, if everyone\'s behaving."', Game.optList([
        { label: 'Offer her a water', d: 'Hospitality', disabled: e.offered, fn: () => { e.offered = true; Game.closePanel(); bark(n, 'Very kind. Noted.', true); Night.addRep(1); } },
        { label: 'Ask what she\'s looking for', fn: () => { Game.closePanel(); bark(n, 'Anyone visibly intoxicated being served. Machines unattended. You know. The fun stuff.', true); } },
        { label: '"Have a lovely evening."', fn: () => Game.closePanel() }]), []);
    };
    e.update = dt => {
      const s = Game.state; e.watch -= dt;
      if (e.watch <= 0) { e.watch = 4; if (!e.flagged && n.pos.distanceTo(player.pos) < 9 && s.drunk >= 58) { e.flagged = true; bark(n, `Excuse me, sir. Have you had a few tonight? ${bartender.name}, I'd like a word.`, true); Game.toast('The inspector has clocked you. Water. Now.', true); } }
      if (e.flagged && s.drunk < 40 && !e.cleared) { e.cleared = true; bark(n, 'Better. I\'ll let it go.', true); }
      if (s.time > e.end) {
        if (e.flagged && !e.cleared) { const fine = 80; const from = Math.min(s.wallet, fine); s.wallet -= from; s.bank -= Math.min(s.bank, fine - from); s.night.extra -= fine; Game.toast(`The pub copped a warning, and you got a ${fmt0(fine)} on-the-spot fine for being intoxicated on licensed premises.`, true); Night.log('📋', `Fined ${fmt0(fine)} by the inspector`); Night.addRep(-6); }
        else { Game.subtitle(`<b>Ms Whitlock:</b> A clean venue. Well done, ${bartender.name}.`, 3.5); bark(bartender, 'Cheers. Have one on us.', true); Night.log('📋', 'Passed the inspection with flying colours'); Night.addRep(3); if (!Game.items.length) bartenderOrder({ type: 'water', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (it, sp) => Game.placeItem(it, sp) }); }
        this.leave([n]); return 'done';
      }
    };
    e.cleanup = () => { n.eventTalk = null; };
    return e;
  },

  // ---------------------------------------------------------- 6. BUSKER by the fire
  busker() {
    const n = this.arrive({ name: 'Sparrow', shirt: { tile: 'collar', c: 0x6a4a2a }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x4a3a2a, style: 'mullet', beard: 'full', glasses: false }, s => s.area === 'lounge' && (s.kind === 'chair' || s.kind === 'stool'));
    if (!n) return null;
    // a guitar across his lap
    const gt = new THREE.Group(), wood = M({ color: 0xb7772e, roughness: 0.5 }), dk = M({ color: 0x2a1608, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), wood); body.scale.set(1, 0.18, 0.78); gt.add(body);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), dk); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.03; gt.add(hole);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.04), dk); neck.position.set(0.3, 0, 0); gt.add(neck);
    gt.position.set(0, 0.62, 0.2); gt.rotation.set(0.1, 0.3, 0.45); n.h.root.add(gt); n.guitar = gt;
    Night.banner('LIVE MUSIC', 'A busker\'s set up by the fire. Requests are $5.', 5);
    Night.log('🎸', 'Sparrow busked by the fire');
    Music.level = Math.max(0.12, Music.level - 0.25);
    const scale = [196, 220, 261.6, 293.7, 329.6, 392, 440], melody = [0, 2, 4, 2, 3, 1, 2, 0, 4, 5, 4, 3, 2, 1, 0, 0];
    const MATILDA = [392, 392, 392, 329.6, 392, 392, 329.6, 392, 440, 392, 329.6, 293.7, 261.6];
    const e = { n, i: 0, t: 0, song: null, end: Game.state.time + 0.85, tipped: false };
    n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel('SPARROW', '<span style="opacity:.7">Beard like a bush fire. Guitar case open for coins.</span><br><br>"Evenin\'. Got a request? I know three songs and one of them\'s Waltzing Matilda."', Game.optList([
        { label: 'Request a song', d: 'A proper singalong', price: '$5.00', disabled: s.wallet < 5, fn: () => { if (!Game.spend(5)) return; s.night.extra -= 5; Game.closePanel(); e.song = { i: 0, t: 0 }; bark(n, 'Righto — everyone knows this one!', true); Night.log('🎸', 'Requested Waltzing Matilda'); Night.addRep(2); s.mood = Math.min(100, s.mood + 8); } },
        { label: 'Chuck a gold coin in the case', price: '$2.00', disabled: s.wallet < 2, fn: () => { if (!Game.spend(2)) return; s.night.extra -= 2; Game.closePanel(); SFX.coin(n.pos); bark(n, 'Ta, mate.', true); s.mood = Math.min(100, s.mood + 2); } },
        { label: '"Sounds great."', fn: () => Game.closePanel() }]), []);
    };
    const pluck = (f, g = 0.05) => { SFX.tone(f, 0.9, { gain: g, type: 'triangle', pos: n.pos.clone().add(V3(0, 1, 0)) }); SFX.tone(f * 2, 0.5, { gain: g * 0.3, type: 'sine', pos: n.pos.clone().add(V3(0, 1, 0)) }); };
    e.update = dt => {
      const s = Game.state; e.t -= dt;
      if (e.t <= 0) {
        if (e.song) { pluck(MATILDA[e.song.i++]); e.t = e.song.i % 4 === 0 ? 0.7 : 0.38; if (e.song.i >= MATILDA.length) { e.song = null; SFX.cheer(n.pos, 2); NPCS.forEach(o => { if (o.role === 'patron' && Math.random() < 0.5) o.cheerT = 1.6; }); } }
        else { pluck(scale[melody[e.i++ % melody.length]], 0.04); e.t = rand(0.45, 0.9); }
      }
      if (s.time > e.end) { bark(n, 'That\'s me. Thanks, folks!', true); this.leave([n]); return 'done'; }
    };
    e.cleanup = () => { n.eventTalk = null; if (n.guitar) n.h.root.remove(n.guitar); };
    return e;
  },
};
ACH_LIST.push(['skull', 'Skull! Skull! Skull!', 'Win the bucks party skull dare.']);
