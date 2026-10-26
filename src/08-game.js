
// =====================================================================
//  GAME: the week loop, economy, menus, events, HUD, main loop
// =====================================================================
const DIFF = {
  easy: { label: 'The Tradie', wallet: 220, bank: 1600, pay: 310, rent: 480, rtp: 1.04, hang: 0.75, cigs: 14 },
  normal: { label: 'The Shiftie', wallet: 120, bank: 650, pay: 190, rent: 420, rtp: 1.0, hang: 1.0, cigs: 9 },
  hard: { label: 'The Uni Student', wallet: 55, bank: 140, pay: 95, rent: 330, rtp: 0.95, hang: 1.3, cigs: 4 },
};
const DAYS = [
  { name: 'MONDAY', start: 19.0, close: 23.0, event: 'monday', title: 'Quiet Monday', weather: 'clear', crowd: 10, work: true,
    desc: "Knocked off from a long shift. The Royal's quiet tonight — a few regulars at the bar, the racing on the telly, and the pokies chiming away out the back.", board: ['MONDAY', '$6.50 POTS', 'TILL 9PM'] },
  { name: 'TUESDAY', start: 18.5, close: 23.0, event: 'parma', title: 'Parma Night', weather: 'cloudy', crowd: 13, work: true,
    desc: "Tuesday means $15 Parma & Pot. The bistro's pumping and you can smell the chips from the footpath.", board: ['TUESDAY', 'PARMA & POT', '$15'] },
  { name: 'WEDNESDAY', start: 19.5, close: 23.5, event: 'trivia', title: 'Trivia Night · 8:30pm', weather: 'rain', crowd: 12, work: true,
    desc: "It's bucketing down. Trivia kicks off at 8:30 — a $50 bar tab for anyone who can name the first PM.", board: ['WEDNESDAY', 'TRIVIA 8:30', '$50 BAR TAB'] },
  { name: 'THURSDAY', start: 17.5, close: 24.0, event: 'jackpot', title: 'Payday · Jackpot Thursday', weather: 'clear', crowd: 16, work: true, payday: true,
    desc: "Payday! Jackpot Thursday — linked jackpots grow twice as fast tonight. Every bloke with a pay slip is in.", board: ['THURSDAY', 'JACKPOT', 'THURSDAY'] },
  { name: 'FRIDAY', start: 16.5, close: 25.0, event: 'knockoff', title: 'Knock-off Drinks', weather: 'clear', crowd: 22, work: true,
    desc: "Knock-off drinks with the crew. It's packed, the jukebox is up, and someone's always shouting a round. $8 schooners 4–6.", board: ['FRIDAY', 'KNOCK-OFF', '$8 SCHOONERS 4-6'] },
  { name: 'SATURDAY', start: 14.0, close: 25.0, event: 'raffle', title: 'Footy + Meat Raffle · 5pm', weather: 'clear', crowd: 24, work: false,
    desc: "Big game on the telly this arvo and the famous Royal meat raffle at 5pm. Tickets $2 each or three for $5 at the bar.", board: ['SATURDAY', 'MEAT RAFFLE', '5PM'] },
  { name: 'SUNDAY', start: 15.0, close: 22.0, event: 'sunday', title: 'Sunday Session · Rent Due', weather: 'clear', crowd: 14, work: false,
    desc: "The Sunday sesh. Rent comes out of the account tonight. Don't do anything stupid.", board: ['SUNDAY', 'SESSION', 'ROAST $22'] },
];
const TRIVIA = [
  ['What is a "schooner" in a NSW pub?', ['A 425ml glass of beer', 'A 285ml glass of beer', 'A jug', 'A small sailing boat']],
  ['Which city is called the "City of Churches"?', ['Adelaide', 'Hobart', 'Perth', 'Brisbane']],
  ['In what year did Australia federate?', ['1901', '1788', '1854', '1915']],
  ['Which race "stops the nation" in November?', ['The Melbourne Cup', 'The Golden Slipper', 'The Cox Plate', 'The Caulfield Cup']],
  ["Who was Australia's first Prime Minister?", ['Edmund Barton', 'Robert Menzies', 'Alfred Deakin', 'John Curtin']],
  ['Phar Lap was a famous what?', ['Racehorse', 'Shipwreck', 'Footy club', 'Pie shop']],
  ["What's the longest river in Australia?", ['The Murray', 'The Darling', 'The Murrumbidgee', 'The Yarra']],
  ['What does "arvo" mean?', ['Afternoon', 'Avocado', 'Evening', 'A long weekend']],
  ['Uluru is in which state or territory?', ['The Northern Territory', 'South Australia', 'Western Australia', 'Queensland']],
  ['Which animal shares the coat of arms with the emu?', ['Kangaroo', 'Koala', 'Wombat', 'Platypus']],
  ['How many states does Australia have?', ['Six', 'Seven', 'Five', 'Eight']],
  ['What is a "pot" in a Victorian pub?', ['A 285ml beer', 'A 425ml beer', 'A pint', 'A jug']],
  ['The Big Banana is in which state?', ['New South Wales', 'Queensland', 'Victoria', 'Tasmania']],
  ['What is the capital of Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Albury']],
];
const KENO_PAY = { 0: 2, 5: 2, 6: 15, 7: 50, 8: 400, 9: 4000, 10: 100000 };

const Game = {
  mode: 'loading', paused: false, uiOpen: false, player, time: 0, frameN: 0, entered: false, startAt: store('ld_start') || 'royal',
  state: { day: 0, time: 19, wallet: 0, bank: 0, drunk: 0, mood: 60, crave: 30, hunger: 20, bladder: 0, cigs: 0, tickets: [], event: null, stats: {}, night: {}, debts: [], next: {}, cigsTonight: 0, strikes: 0, rel: {}, flags: {}, tonight: {} },
  items: [], // drinks/food sitting on the bar for the player
  keno: { next: 0, drawing: false, drawn: [], shown: 0, t: 0, game: 412, tickets: [] },
  trivia: { done: false }, raffle: { tickets: 0, drawn: false },
  // -------------------------------------------------- lifecycle
  newWeek(diff) {
    const D = DIFF[diff];
    Object.assign(this.state, { diff, day: 0, wallet: D.wallet, bank: D.bank, cigs: D.cigs, tickets: [], debts: [], next: {}, mood: 60, rel: {}, flags: {},
      stats: { wagered: 0, won: 0, drinks: 0, spentDrinks: 0, spentFood: 0, spentSmokes: 0, cigs: 0, jackpots: 0, biggest: 0, glasses: 0, meat: 0, keno: 0, trivia: 0, shouts: 0, atmFees: 0, startWorth: D.wallet + D.bank } });
    rtpMod = D.rtp;
    this.save(); this.showDayCard();
  },
  netWorth() { const s = this.state; return s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0) + this.machineCredit(); },
  machineCredit() { return player.seated ? player.seated.credit : 0; },
  save() { const s = this.state; store('ld_save', { diff: s.diff, day: s.day, wallet: s.wallet, bank: s.bank, cigs: s.cigs, tickets: s.tickets, debts: s.debts, next: s.next, stats: s.stats, mood: s.mood, rel: s.rel, flags: s.flags, JP, morningDone: s.morningDone, startHang: s.startHang, startEarly: s.startEarly, morningMsgs: s.morningMsgs }); },
  load() { const d = store('ld_save'); if (!d || d.day == null || d.day > 6) return false; Object.assign(this.state, d); if (d.JP) Object.assign(JP, d.JP); rtpMod = DIFF[d.diff].rtp; return true; },
  showDayCard() {
    const s = this.state, D = DAYS[s.day], dd = DIFF[s.diff];
    const msgs = [];
    // morning: wages, hangover, early-night bonus, debts
    if (!s.morningDone) {
      if (s.day > 0) {
        const prev = DAYS[s.day - 1];
        if (prev.work) {
          let pay = dd.pay * (D.payday ? 1.0 : 1.0);
          if (s.next.hang) { const dock = Math.round(pay * 0.4 * dd.hang); pay -= dock; msgs.push(`<span class="neg">Rolled into work hungover — docked ${fmt0(dock)}.</span>`); }
          if (s.next.early) { const ot = Math.round(dd.pay * 0.5); pay += ot; msgs.push(`<span class="pos">Early night paid off: picked up an overtime shift, +${fmt0(ot)}.</span>`); }
          s.bank += pay; msgs.push(`Pay for ${prev.name[0] + prev.name.slice(1).toLowerCase()}: <b>${fmt0(pay)}</b> into the bank.`);
        } else if (s.next.early) { s.mood = Math.min(100, s.mood + 15); msgs.push('<span class="pos">Slept like a log after an early night. Feeling sharp.</span>'); }
        if (D.payday) { const bonus = Math.round(dd.pay * 0.6); s.bank += bonus; msgs.push(`<span class="pos">Payday top-up (penalty rates): +${fmt0(bonus)}.</span>`); }
        for (const d of s.debts.filter(d => d.day < s.day)) { if (Math.random() < d.chance) { s.wallet += d.amt + 5; msgs.push(`<span class="pos">${d.name} paid back the ${fmt0(d.amt)} he owed you, plus a fiver for your trouble. Legend.</span>`); } else msgs.push(`<span class="neg">${d.name} still hasn't paid back your ${fmt0(d.amt)}. Classic.</span>`); }
        s.debts = s.debts.filter(d => d.day >= s.day);
      }
      s.morningDone = true; s.startHang = !!s.next.hang; s.startEarly = !!s.next.early; s.morningMsgs = msgs.slice();
    } else msgs.push(...(s.morningMsgs || []));
    const start = D.start + (s.startHang ? 1 : 0);
    s.startTime = start;
    const hh = h => { const hr = Math.floor(h) % 24, m = Math.round((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`; };
    $('dayCardInner').innerHTML = `
      <div class="dname">${D.name}</div><div class="dtime">${hh(start)} · DAY ${s.day + 1} OF 7 · ${dd.label.toUpperCase()}</div>
      <div class="event">${D.title}</div>
      <div class="chapter"><small>${CHAPTERS[s.day].title.toUpperCase()}</small>${CHAPTERS[s.day].narr}</div>
      ${s.day < 6 ? `<div class="venues"><small>WHERE TO START TONIGHT? (ALL ON THE ONE STREET)</small>${Object.values(VENUES).map(v => { const here = v.id === (this.startAt || 'royal'); return `<button class="vchip ${here ? 'on' : ''}" data-v="${v.id}"><b>${v.name}</b><span>${v.blurb}</span><i>${here ? 'start here tonight' : v.story ? 'story night · walk over any time' : 'on the same street · walk over any time'}</i></button>`; }).join('')}</div>` : ''}
      <p>${D.desc}</p>
      ${s.startHang ? '<p class="neg"><b>Hungover.</b> You got going an hour late and everything is a bit too loud.</p>' : ''}
      ${msgs.map(m => `<p style="margin:4px 0">${m}</p>`).join('')}
      <div class="stats"><div>Wallet<b>${fmt0(s.wallet)}</b></div><div>Bank<b>${fmt0(s.bank)}</b></div><div>Smokes<b>${s.cigs}</b></div><div>Standing<b style="font-size:15px">${Night.tier().name}</b></div><div>Rent (Sun)<b>${fmt0(dd.rent)}</b></div></div>
      <div class="note">Pub shuts at ${hh(D.close)}. Leave early & sober for a bonus tomorrow.</div>
      <div style="margin-top:18px"><button class="cbtn" id="btnGo">HEAD TO THE PUB →</button></div>`;
    $('title').classList.add('hidden'); $('summary').classList.add('hidden'); $('dayCard').classList.remove('hidden');
    $('btnGo').onclick = () => { AudioSys.init(); $('dayCard').classList.add('hidden'); this.startNight(); };
    document.querySelectorAll('.vchip').forEach(b => b.onclick = () => { if (b.classList.contains('off')) return; this.startAt = b.dataset.v; store('ld_start', this.startAt); document.querySelectorAll('.vchip').forEach(o => { o.classList.toggle('on', o === b); const i = o.querySelector('i'); if (i) i.textContent = o === b ? 'start here tonight' : (VENUES[o.dataset.v].story ? 'story night · walk over any time' : 'on the same street · walk over any time'); }); SFX.click && SFX.click(); });
    this.mode = 'card';
  },
  startNight() {
    const s = this.state, D = DAYS[s.day];
    s.event = D.event; s.time = s.startTime; s.drunk = s.startHang ? 12 : 0; s.crave = 40; s.hunger = 35; s.bladder = 5; s.cigsTonight = 0; s.strikes = 0; s.kicked = false; s.tonight = {}; s.rel = s.rel || {}; s.flags = s.flags || {};
    s.night = { startWallet: s.wallet, startBank: s.bank, startTickets: s.tickets.reduce((a, b) => a + b, 0), drinks: 0, spentDrinks: 0, spentFood: 0, spentSmokes: 0, wagered: 0, won: 0, atm: 0, fees: 0, keno: 0, extra: 0, glasses: 0 };
    s.next = {}; s.morningDone = false;
    this.trivia = { done: false }; this.raffle = { tickets: 0, drawn: false }; this.keno.tickets = []; this.keno.next = s.time + 0.05; this.lastDrinks = false; this.entered = false; this.footyT = 0;
    // reset world
    for (const n of NPCS.slice()) if (n !== bartender) { release(n); scene.remove(n.h.root); }
    NpcMeals.clear();
    NPCS.length = 0; NPCS.push(bartender); bartender.queue = []; bartender.job = null; bartender.pos.copy(BAR.tender.home);
    for (const it of this.items) { scene.remove(it.glass ? it.glass.group : it.mesh); }
    this.items = []; interactables.splice(0, interactables.length, ...interactables.filter(i => !i.temp));
    MACHINES.forEach(m => { m.resetPlay(); m.setMode('idle'); m.occupiedBy = null; m.credit = 0; });
    SPOTS.forEach(sp => sp.occ = null);
    if (player.drink) { player.drink.group.parent && player.drink.group.parent.remove(player.drink.group); player.drink = null; }
    player.cig = null; player.cigMesh.g.visible = false; player.seated = null; player.sip = 0;
    puddles.forEach(p => scene.remove(p)); puddles.length = 0;
    REG.spawnAll(); VenueLocals.spawn(); Shops.spawnStaff(); STORY.spawn();
    VENUE = VENUES.royal; Clubs.prevVenue = 'royal';
    spawnPatrons(Math.round(D.crowd * VENUE.crowd * (0.85 + Math.random() * 0.3) * settings.crowd));
    Clubs.spawn();
    Night.start(); RANDOM.plan(); Racing.setup(); Karaoke.started = Karaoke.awarded = false; Karaoke.scores = []; Karaoke.draw(); BAR.shift = false; player.level = 0; player.auto = null;
    this.arrivals = Math.round(D.crowd * 0.35); this.arriveT = 20;
    AudioSys.amp.crowd = clamp(D.crowd / 18, 0.4, 1.4);
    Music.song = Music.pick(D.event); Music.level = D.event === 'knockoff' || D.event === 'raffle' ? 0.9 : 0.45;
    // player on the far footpath, facing the pub
    const startC = CLUBS[this.startAt];
    if (startC) { player.pos.copy(startC.spawn); player.yaw = startC.yaw; } else { player.pos.set(-7.5, 0, 21.2); player.yaw = 0.12; }
    player.pitch = 0.04; player.vel.set(0, 0, 0);
    updateBoards(D);
    setTimeOfDay(s.time, D.weather);
    this.mode = 'play'; this.paused = false;
    $('hud').classList.remove('hidden'); $('deck').classList.add('hidden');
    this.fade(1, 0); lockPointer(); this.useTab = false;
    this.objective();
    { const seen = s.flags.seen = s.flags.seen || {}; const first = !seen.royal; seen.royal = 1; if (!startC) Cine.opening(first); }
    const where = startC ? VENUES[this.startAt].short : 'the Royal';
    setTimeout(() => this.subtitle(startC ? `<i>${where[0].toUpperCase() + where.slice(1)} tonight. The Royal's just up the street if it's dead.</i>` : s.startHang ? '<i>Head\'s pounding. The street\'s too quiet. Only thing lit up is the Royal.</i>' : '<i>The street\'s dead. Only thing lit up for blocks is the Royal.</i>', 5), 600);
  },
  endNight(reason) {
    if (this.mode !== 'play') return;
    const s = this.state, D = DAYS[s.day], dd = DIFF[s.diff];
    if (MG.active) MG.stop(true);
    if (player.seated) { player.seated.settle(); this.collect(true); standUp(); }   // a feature still running at closing time is paid out, not lost
    Moments.cleanup(); this.mode = 'ending'; this.fade(0, 1); document.exitPointerLock && document.exitPointerLock();
    setTimeout(() => {
      $('hud').classList.add('hidden'); $('deck').classList.add('hidden'); this.closePanel();
      const early = s.time < 22 && s.drunk < 35 && ['home', 'taxi', 'room'].includes(reason);
      if (early) achieve('early'); if (reason === 'kicked') achieve('legless');
      const hung = s.drunk > 62 || reason === 'kicked';
      s.next = { early, hang: hung, room: reason === 'room' };
      const n = s.night, tick = s.tickets.reduce((a, b) => a + b, 0);
      const worthNow = s.wallet + s.bank + tick, worthStart = n.startWallet + n.startBank + n.startTickets;
      const isSunday = s.day === 6;
      const tabHtml = Night.settleTab(); const nsum = Night.finish(reason);
      const reasonTxt = { home: early ? 'You called it early and walked home under the streetlights.' : 'You wandered home.', close: '"Righto folks, time to go!" — you got turfed out at close.', kicked: 'The bouncer walked you out. Not your finest hour.', broke: 'Skint. Nothing left but the walk home.', taxi: 'You caught a cab home. The driver had opinions about the footy.', room: 'You crashed in Room 4 upstairs. The pub hummed through the floorboards.' }[reason] || '';
      const rows = [['Started with (wallet + bank)', fmt$(n.startWallet + n.startBank)], ['Drinks (' + n.drinks + ')', fmt$(-n.spentDrinks)], ['Food', fmt$(-n.spentFood)], ['Smokes', fmt$(-n.spentSmokes)], ['Pokies — wagered', fmt$(-n.wagered)], ['Pokies — won', fmt$(n.won)], ['Keno / raffle / trivia', fmt$(n.keno + n.extra)], ['ATM fees', fmt$(-n.fees)]];
      let rentHtml = '';
      if (isSunday) {
        let rent = dd.rent; const fromBank = Math.min(s.bank, rent); s.bank -= fromBank; rent -= fromBank;
        const fromWallet = Math.min(s.wallet, rent); s.wallet -= fromWallet; rent -= fromWallet;
        s.evicted = rent > 0.01;
        rentHtml = s.evicted ? `<p class="neg"><b>Rent bounced.</b> You were ${fmt$(rent)} short. The landlord's not having it.</p>` : `<p class="pos">Rent of ${fmt0(dd.rent)} paid. Roof over your head for another week.</p>`;
      }
      $('summaryInner').innerHTML = `
        <div class="dname">${D.name} NIGHT</div><div class="dtime">${this.clockText()} · ${reasonTxt}</div>
        <table class="ledger">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
        <tr class="tot"><td>Net for the night</td><td class="${worthNow - worthStart >= 0 ? 'pos' : 'neg'}">${fmt$(worthNow - worthStart)}</td></tr></table>
        ${rentHtml}${tabHtml}
        ${nsum}
        <p>${hung ? '<span class="neg">You\'re going to feel this tomorrow.</span>' : early ? '<span class="pos">Early night — you\'ll be fresh tomorrow (bonus).</span>' : 'You\'ll be right tomorrow.'}</p>
        <div class="stats"><div>Wallet<b>${fmt0(s.wallet)}</b></div><div>Bank<b>${fmt0(s.bank)}</b></div><div>Tickets<b>${fmt0(tick)}</b></div><div>Mood<b>${Math.round(s.mood)}</b></div></div>
        <button class="cbtn" id="btnNext">${isSunday ? 'SEE YOUR WEEK →' : 'SLEEP IT OFF →'}</button>`;
      $('summary').classList.remove('hidden'); this.fade(1, 0);
      $('btnNext').onclick = () => { if (isSunday) this.weekSummary(); else { s.day++; this.save(); this.showDayCard(); } };
      this.mode = 'summary';
    }, 900);
  },
  weekSummary() {
    const s = this.state, st = s.stats, worth = s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0), net = worth - st.startWorth;
    let grade, line;
    if (s.evicted) { grade = 'EVICTED'; line = 'Couldn\'t make rent. Maybe give the pokies a miss next week, champ.'; }
    else if (net >= 400) { grade = 'LEGEND OF THE ROYAL'; line = 'Walked out of the week ahead. The house always wins — just not this time. Don\'t push your luck.'; }
    else if (net >= -150) { grade = 'A BATTLER\'S WEEK'; line = 'Rent paid, a few laughs, a few beers. That\'s a good week at the local.'; }
    else { grade = 'SKINT BUT HOUSED'; line = 'Rent\'s paid but the account\'s crying. Something to think about.'; }
    $('summaryInner').innerHTML = `<div class="dname">${grade}</div><div class="dtime">THE WEEK AT THE ROYAL · ${DIFF[s.diff].label.toUpperCase()}</div><p>${line}</p>
      <table class="ledger"><tr><td>Started the week with</td><td>${fmt$(st.startWorth)}</td></tr><tr><td>Ended the week with</td><td>${fmt$(worth)}</td></tr>
      <tr><td>Drinks (${st.drinks})</td><td>${fmt$(-st.spentDrinks)}</td></tr><tr><td>Food</td><td>${fmt$(-st.spentFood)}</td></tr><tr><td>Smokes (${st.cigs} smoked)</td><td>${fmt$(-st.spentSmokes)}</td></tr>
      <tr><td>Total wagered on pokies</td><td>${fmt$(-st.wagered)}</td></tr><tr><td>Total pokie wins</td><td>${fmt$(st.won)}</td></tr><tr><td>Biggest single win</td><td>${fmt$(st.biggest)}</td></tr>
      <tr><td>Jackpots / meat trays / trivia wins</td><td>${st.jackpots} / ${st.meat} / ${st.trivia}</td></tr><tr><td>Glasses smashed</td><td>${st.glasses}</td></tr><tr><td>ATM fees</td><td>${fmt$(-st.atmFees)}</td></tr>
      <tr class="tot"><td>Net for the week</td><td class="${net >= 0 ? 'pos' : 'neg'}">${fmt$(net)}</td></tr></table>
      <p class="note">Pokies returned ${st.wagered > 0 ? Math.round(st.won / st.wagered * 100) : 0}c in the dollar this week.</p>
      ${STORY.epilogue()}
      <button class="cbtn" id="btnAgain">ANOTHER WEEK →</button>`;
    store('ld_save', null);
    $('btnAgain').onclick = () => { $('summary').classList.add('hidden'); this.toTitle(); };
  },
  toTitle() {
    this.mode = 'title'; $('hud').classList.add('hidden'); $('deck').classList.add('hidden'); $('resume').classList.add('hidden'); this.closePanel();
    $('title').classList.remove('hidden'); $('diffMenu').classList.add('hidden'); $('mainMenu').classList.remove('hidden');
    const sv = store('ld_save'); $('btnContinue').classList.toggle('hidden', !(sv && sv.day != null && sv.day <= 6));
    $('achInfo').textContent = `${Object.keys(ACH.got).length} of ${ACH_LIST.length} unlocked`;
    if (sv && sv.day != null) $('contInfo').textContent = `${DAYS[Math.min(6, sv.day)].name} · ${DIFF[sv.diff].label} · ${fmt0(sv.wallet + sv.bank)}`;
    setTimeOfDay(18.4, 'clear'); this.fade(1, 0);
  },
  fade(from, to) { const f = $('fade'); f.style.transition = 'none'; f.style.opacity = from; void f.offsetWidth; f.style.transition = 'opacity .9s'; f.style.opacity = to; },
  // -------------------------------------------------- HUD
  clockText() { const h = this.state.time, hr = Math.floor(h) % 24, m = Math.floor((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')}${hr >= 12 ? 'pm' : 'am'}`; },
  _hud: {},
  setText(id, v) { if (this._hud[id] !== v) { this._hud[id] = v; $(id).innerHTML = v; } },
  updateHUD() {
    const s = this.state;
    this.setText('clock', this.clockText());
    this.setText('daylbl', DAYS[s.day].name + ' · ' + DAYS[s.day].title.toUpperCase());
    this.setText('walletv', fmt$(s.wallet)); this.setText('bankvv', fmt$(s.bank));
    const tk = s.tickets.reduce((a, b) => a + b, 0);
    this.setText('items', `${s.cigs} smokes${tk > 0 ? ` · ${s.tickets.length} ticket${s.tickets.length > 1 ? 's' : ''} (${fmt$(tk)})` : ''}${player.drink ? ` · ${player.drink.D.short} ${Math.round(player.drink.fill * 100)}%` : ''}`);
    $('mDrunk').querySelector('i').style.width = s.drunk + '%'; $('mMood').querySelector('i').style.width = s.mood + '%'; $('mCrave').querySelector('i').style.width = s.crave + '%';
    $('mHunger').querySelector('i').style.width = s.hunger + '%'; $('mBladder').querySelector('i').style.width = s.bladder + '%';
    this.setText('hungerTxt', s.hunger > 80 ? 'Starving' : s.hunger > 55 ? 'Peckish' : 'Fed'); this.setText('bladderTxt', s.bladder > 80 ? 'Busting' : s.bladder > 50 ? 'Could go' : '');
    this.setText('drunkTxt', s.drunk < 12 ? 'Sober' : s.drunk < 30 ? 'Merry' : s.drunk < 50 ? 'Tipsy' : s.drunk < 70 ? 'Pissed' : s.drunk < 85 ? 'Maggot' : 'Legless');
    this.setText('moodTxt', s.mood > 75 ? 'Stoked' : s.mood > 50 ? 'Good' : s.mood > 30 ? 'Meh' : s.mood > 15 ? 'Cranky' : 'Gutted');
    if (player.seated) {
      const m = player.seated;
      this.setText('dkCredit', fmt$(m.credit)); this.setText('dkBet', fmt$(m.bet));
      const gm = m.state === 'gamble';
      this.setText('dkBetDn', gm ? 'RED' : 'Bet −'); this.setText('dkBetUp', gm ? 'BLACK' : 'Bet +');
      this.setText('dkCollect', gm ? 'Take<small>win</small>' : 'Collect');
      this.setText('dkAuto', `Gamble<small>${m.gambleOK && m.lastWin > 0 ? fmt$(m.lastWin) : '—'}</small>`);
      $('dkAuto').disabled = !(m.gambleOK && m.lastWin > 0 && m.state === 'showWin');
      $('dkSpin').textContent = m.state === 'pick' ? 'PICK' : m.state === 'spinning' ? 'STOP' : 'SPIN';
      $('dkBetDn').className = 'dk ' + (gm ? 'red' : 'blue'); $('dkBetUp').className = 'dk ' + (gm ? 'grey' : 'blue');
      $('dkSmoke').disabled = !m.def.smoke;
    }
  },
  objective() {
    const s = this.state, D = DAYS[s.day];
    let o;
    if (!this.entered) o = `Cross the road and head into ${VENUE.short}.`;
    else {
      const tips = { monday: 'Grab a pot at the bar (pots $6.50 till 9). Machines are out the back.', parma: 'Parma & Pot is $15 tonight — order at the bar.', trivia: this.trivia.done ? 'Trivia\'s done. Enjoy the night.' : 'Trivia starts at 8:30pm. Stay inside.', jackpot: 'Jackpots grow twice as fast tonight.', knockoff: 'Shout the crew a round, or let them shout you.', raffle: this.raffle.drawn ? 'Footy\'s on. Have a good one.' : 'Meat raffle draws at 5pm. Tickets at the bar.', sunday: `Rent of ${fmt0(DIFF[s.diff].rent)} comes out tonight. Bank: ${fmt0(s.bank)}.` };
      o = tips[D.event] || '';
      if (s.drunk > 75) o = 'You\'re very drunk. Bar staff may cut you off. Water\'s free.';
    }
    const html = `<span class="storygoal">★ ${STORY.goal()}</span><br>` + o + '<br><span style="opacity:.6">Leave early & sober = bonus tomorrow. Close: ' + (() => { const c = DAYS[s.day].close, h = Math.floor(c) % 24, m = Math.round((c % 1) * 60); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`; })() + '</span>';
    if (this._hud.objective !== html) { this.objShownAt = elapsed; $('objective').style.opacity = 1; }
    this.setText('objective', html);
  },
  toast(msg, big = false) {
    const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.innerHTML = msg; $('toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, big ? 3800 : 2800);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  },
  subT: 0,
  subtitle(html, dur = 3) { if (!settings.subtitles && !/^<i>/.test(html)) return; $('subtitle').innerHTML = html; this.subT = dur; },
  dayBarks() {
    return ({ monday: ['Mondays, eh.', 'Quiet one tonight.'], parma: ["Parma's ripper tonight.", 'Get the parma, mate. Trust me.'], trivia: ["Reckon we'll win trivia this week?", 'Who was the first PM again? Barton?', 'Bloody rain.'], jackpot: ["Grand's getting up there, isn't it?", 'Payday! Shout ya one later.'], knockoff: ['Thank God it\'s Friday.', 'Whose shout is it?', 'Big week. Big week.'], raffle: ['Come on the Pies!', "Ump, you're blind!", 'Got me raffle tickets. Feelin\' lucky.'], sunday: ['Sunday sesh, can\'t beat it.', 'Back to work tomorrow. Don\'t remind me.'] })[this.state.event] || [];
  },
  // -------------------------------------------------- panels
  openPanel(title, sub, body, btns = [{ label: 'Close', fn: () => this.closePanel() }]) {
    this.uiOpen = true; document.exitPointerLock && document.exitPointerLock();
    $('pTitle').innerHTML = title; $('pSub').innerHTML = sub || ''; $('pBody').innerHTML = ''; if (typeof body === 'string') $('pBody').innerHTML = body; else $('pBody').appendChild(body);
    $('pBtns').innerHTML = ''; for (const b of btns) { const e = document.createElement('button'); e.className = 'pbtn'; e.textContent = b.label; e.onclick = b.fn; $('pBtns').appendChild(e); }
    $('panel').classList.remove('hidden');
  },
  closePanel() { $('panel').classList.add('hidden'); $('panel').classList.remove('wide'); if (this.uiOpen) { this.uiOpen = false; if (this.mode === 'play' && !player.seated && !(MG.active && MG.active.cursor)) lockPointer(); } },
  optList(opts) {
    const wrap = document.createElement('div'); wrap.className = 'opts';
    for (const o of opts) { const b = document.createElement('button'); b.className = 'opt'; b.disabled = !!o.disabled; b.innerHTML = `<span>${o.label}${o.d ? `<span class="d">${o.d}</span>` : ''}</span>${o.price != null ? `<span class="price">${o.price}</span>` : ''}`; b.onclick = () => { SFX.click(); o.fn(); }; wrap.appendChild(b); }
    return wrap;
  },
  spend(amt, cat) { const s = this.state; if (this.useTab && amt > 0 && (cat === 'spentDrinks' || cat === 'spentFood') && Night.tabOK(amt)) { Night.tabAdd(amt); s.night[cat] += amt; s.stats[cat] += amt; this.toast(`On the tab: ${fmt$(Night.tab())} of ${fmt0(Night.tabLimit())}.`); return true; }
    if (s.wallet + 1e-9 < amt) { this.toast(`Not enough cash (${fmt$(s.wallet)}). ATM's in the lounge.`); return false; } s.wallet -= amt; if (cat) { s.night[cat] += amt; s.stats[cat] += amt; } if (amt > 0) CashFX.pay(amt); return true; },
  drinkPrice(type) {
    const s = this.state, D = DRINKS[type];
    if (s.event === 'knockoff' && type === 'schooner' && s.time >= 16 && s.time < 18) return 8;
    let p = D.price;
    if (s.event === 'monday' && type === 'pot' && s.time < 21) p = 6.5;
    p = Math.round(p * VENUE.priceMul * 4) / 4;
    if (p > 1 && Night.hasPerk(2)) p = Math.max(1, p - 0.5);
    if (p > 1 && s.flags.spudMates) p = Math.max(1, p - 0.5);
    return p;
  },
  openBar() {
    const s = this.state;
    if (bartender.job || bartender.queue.length) { this.toast('Hang on, the bartender\'s pouring.'); return; }
    if (this.items.length) { this.toast('Your order\'s waiting on the bar.'); return; }
    if (s.drunk >= 95) { this.kickOut(); return; }
    const rsa = s.drunk >= 80;
    const holding = player.drink && player.drink.fill > 0.08;
    const opts = [];
    for (const type of ['pot', 'schooner', 'pint', 'pale', 'scotch', 'bourbon', 'rum', 'vodka', 'llb', 'water']) {
      const D = DRINKS[type], price = this.drinkPrice(type);
      opts.push({ label: D.name, d: type === 'water' ? 'Free. Hydrate, legend.' : D.std ? `${D.std} std drinks` : 'No alcohol', price: price ? fmt$(price) : 'FREE', disabled: holding || (rsa && D.std > 0), fn: () => this.order(type, price) });
    }
    const dish = (k, extra = {}) => { const F = FOODS[k]; return Object.assign({ label: F.name, d: this.foodBlurb(k), price: fmt$(F.price), disabled: rsa && false, fn: () => this.order(null, F.price, k, 'spentFood') }, extra); };
    if (s.event === 'parma') opts.push({ label: 'Parma & Pot (Tuesday special)', d: 'Chicken parmigiana, chips, salad + a pot', price: '$15.00', disabled: holding || rsa, fn: () => this.order('pot', 15, 'parma', 'spentFood') });
    opts.push(dish(s.event === 'sunday' ? 'roast' : 'parma'), dish('schnitty'), dish('burger'), dish('pie'), dish('sausageroll'), dish('snags'), dish('chips'), dish('nuts'), dish('cheese'));
    if (s.event === 'sunday' || s.event === 'raffle' || s.event === 'knockoff') opts.push(dish('pav'));
    if (!s.tonight.shift && s.drunk < 25 && s.day < 5 && s.time < DAYS[s.day].close - 2) opts.push({ label: 'Ask about a shift behind the bar', d: 'Cash in hand + tips. You need to be sober.', fn: () => { this.closePanel(); BarShift.offer(); } });
    opts.push({ label: 'Pack of smokes (20)', d: `You have ${s.cigs}. Yes, they're really this much.`, price: '$45.00', fn: () => { if (this.spend(45, 'spentSmokes')) { s.cigs += 20; SFX.register(V3(-9, 1.2, -9)); this.toast('20 smokes. Your wallet weeps.'); this.closePanel(); } } });
    if (s.event === 'raffle' && !this.raffle.drawn) opts.push({ label: 'Meat raffle tickets ×3', d: `Draw at 5pm. You have ${this.raffle.tickets}.`, price: '$5.00', fn: () => { if (this.spend(5)) { s.night.extra -= 5; this.raffle.tickets += 3; SFX.register(V3(-9, 1.2, -9)); this.toast('Three raffle tickets. Come on, meat tray!'); this.closePanel(); } } });
    if (s.event === 'knockoff') opts.push({ label: 'Shout the crew a round', d: 'Five schooners. Mateship +, wallet −', price: '$45.00', fn: () => { if (this.spend(45, 'spentDrinks')) { s.stats.shouts++; s.mood = Math.min(100, s.mood + 18); this.crewOwes = true; Night.ev('shouted'); SFX.cheer(V3(-5, 1.5, -6), 1); this.toast('"Legend!" — the crew owes you one.', true); this.closePanel(); } } });
    Moments.barOptions(opts, holding, rsa);
    if (Night.tabLimit() > 0) opts.push({ label: this.useTab ? 'Paying: on the TAB' : 'Paying: cash', d: `Tab ${fmt$(Night.tab())} of ${fmt0(Night.tabLimit())} — settled from your account at the end of the night`, fn: () => { this.useTab = !this.useTab; this.closePanel(); this.openBar(); } });
    if (Night.hasPerk(3) && s.flags.lastDrink && !holding && !rsa && DRINKS[s.flags.lastDrink]) { const t = s.flags.lastDrink, pr = this.drinkPrice(t); opts.unshift({ label: `The usual (${DRINKS[t].name})`, d: `${bartender.name} already has the glass out`, price: pr ? fmt$(pr) : 'FREE', fn: () => this.order(t, pr) }); }
    if (Night.hasPerk(4) && !s.night.freeUsed && !holding && !rsa) opts.unshift({ label: 'Your free schooner', d: 'Local Legend perk: on the house, once a night', price: 'FREE', fn: () => { s.night.freeUsed = true; this.order('schooner', 0); } });
    this.openPanel('THE BAR', rsa ? '<span style="color:#ff8a7a">"Sorry mate, I can\'t serve you any more alcohol. Have a water."</span>' : `Wallet ${fmt$(s.wallet)} · ${bartender.name}'s behind the bar`, this.optList(opts));
  },
  foodBlurb(k) { return ({ parma: 'Chicken parmigiana, chips and salad. The size of a hubcap.', schnitty: 'Golden crumbed chook, lemon, chips.', roast: 'Lamb, crispy spuds, peas, gravy.', burger: 'Beetroot, egg, bacon, the lot.', pie: 'Mince and onion. Tomato sauce.', sausageroll: 'Hot, flaky, a bit dangerous.', snags: 'Sausage in bread, onions underneath.', chips: 'With chicken salt, obviously.', nuts: 'A bowl of salty peanuts.', cheese: 'Brie, cheddar, blue, quince, crackers, grapes.', pav: 'Meringue, cream and passionfruit.' })[k] || ''; },
  order(type, price, food, cat = 'spentDrinks') {
    if (price > 0 && !this.spend(price, cat)) return;
    this.useTab = false; if (type === 'water') Night.ev('water');
    this.closePanel();
    SFX.register(V3(-9, 1.2, player.pos.z));
    if (player.drink && player.drink.fill <= 0.08) { const g = player.drink; player.drink = null; g.group.parent && g.group.parent.remove(g.group); vm.R.curl(0.2); this.toast('Handed back your empty.'); }
    const z = clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6);
    if (type) { if (DRINKS[type].std) { this.state.night.drinks++; this.state.stats.drinks++; this.state.flags.lastDrink = type; } bartenderOrder({ type, forZ: z, cb: (item, spot) => this.placeItem(item, spot) }); }
    if (food) setTimeout(() => bartenderOrder({ food, forZ: z + (type ? 0.35 : 0), cb: (item, spot) => this.placeItem(item, spot) }), 400);
    this.subtitle(`<b>${bartender.name}:</b> ${choice(['No worries.', 'Coming right up.', 'Yep, can do.', 'Easy.'])}`, 2);
  },
  placeItem(item, spot) {
    this.items.push(item);
    const kind = item.kind === 'food' ? legacyFood(item.food, this.state.event) : null;
    const lbl = item.kind === 'drink' ? `Take your ${item.glass.D.short}` : `Eat your ${FOODS[kind].name.toLowerCase()}`;
    const ia = addInteract({ id: 'item', temp: true, pos: spot.clone().add(V3(0, 0.08, 0)), r: 2.0, label: () => lbl, action: () => {
      if (item.kind === 'drink') { if (player.drink) { this.toast('Hands full — finish or drop (G) what you\'ve got.'); return; } giveDrink(item.glass); SFX.clink(spot); }
      else if (!this.eat(item, spot)) return;
      this.items.splice(this.items.indexOf(item), 1); interactables.splice(interactables.indexOf(ia), 1);
    } });
  },
  // sit the plate in front of you and eat it, knife and fork or bare hands
  eat(item, spot) {
    const kind = legacyFood(item.food, this.state.event), model = item.mesh;
    const ok = Eat.begin(kind, model, { place: (m, frac) => { scene.add(m); m.position.copy(spot); m.rotation.set(0, 0, 0); m.scale.setScalar(1); player.drink && (player.drink.group.visible = true); setTimeout(() => scene.remove(m), frac > 0.9 ? 25000 : 90000); } });
    if (!ok) { this.toast('Not now.'); return false; }
    if (kind === 'chips' || kind === 'parma') Needs.ateKind = kind;
    return true;
  },
  openATM() { ATM.open(); },
  openJukebox() { Juke.open(); },
  openKeno() {
    const s = this.state, k = this.keno;
    const picked = new Set();
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="font-size:13px;opacity:.75">Pick up to 10 numbers (or Quick Pick). $5 per game. Next draw in ${Math.max(0, Math.round((k.next - s.time) * 60))} min. Pays: 0 hits ×2, 5×2, 6×15, 7×50, 8×400, 9×4000, 10 = $100k per $1.</div>`;
    const grid = document.createElement('div'); grid.className = 'kgrid';
    for (let i = 1; i <= 80; i++) { const b = document.createElement('button'); b.textContent = i; b.onclick = () => { if (picked.has(i)) { picked.delete(i); b.classList.remove('on'); } else if (picked.size < 10) { picked.add(i); b.classList.add('on'); } SFX.click(); }; grid.appendChild(b); }
    wrap.appendChild(grid);
    const buy = nums => { if (!nums.length) { this.toast('Pick some numbers first.'); return; } if (!this.spend(5)) return; s.night.keno -= 5; k.tickets.push({ nums, bet: 5, game: k.game }); SFX.print(); this.toast(`Keno ticket for game ${k.game}: ${nums.join(', ')}`); this.closePanel(); };
    this.openPanel('KENO', `Game ${k.game} · ${k.tickets.length} ticket(s) in play`, wrap, [
      { label: 'Quick Pick 10 ($5)', fn: () => { const a = []; while (a.length < 10) { const n = randi(1, 80); if (!a.includes(n)) a.push(n); } buy(a.sort((x, y) => x - y)); } },
      { label: 'Buy my numbers ($5)', fn: () => buy([...picked].sort((x, y) => x - y)) }, { label: 'Close', fn: () => this.closePanel() }]);
  },
  updateKeno(dt) {
    const s = this.state, k = this.keno;
    if (!k.drawing && s.time >= k.next) { k.drawing = true; k.drawn = []; while (k.drawn.length < 20) { const n = randi(1, 80); if (!k.drawn.includes(n)) k.drawn.push(n); } k.shown = 0; k.t = 0; }
    if (k.drawing) {
      k.t += dt;
      if (k.t > 0.55 && k.shown < 20) { k.t = 0; k.shown++; if (Math.hypot(player.pos.x - 2.5, player.pos.z + 14) < 8) SFX.tone(900 + k.drawn[k.shown - 1] * 6, 0.08, { gain: 0.03, pos: V3(2.8, 2.3, -14.2) }); }
      if (k.shown >= 20 && k.t > 6) {
        for (const tk of k.tickets.filter(t => t.game === k.game)) {
          const hits = tk.nums.filter(n => k.drawn.includes(n)).length, mult = tk.nums.length === 10 ? (KENO_PAY[hits] || 0) : (hits >= Math.ceil(tk.nums.length * 0.6) ? hits : 0);
          const win = mult * tk.bet / 1 * (tk.nums.length === 10 ? 1 : 0.5);
          if (win > 0) { s.wallet += win; s.night.keno += win; s.stats.keno += win; s.mood = Math.min(100, s.mood + 6); this.toast(`Keno game ${k.game}: ${hits} hits — won ${fmt$(win)}!`, win > 50); SFX.win(2); }
          else this.toast(`Keno game ${k.game}: ${hits} hit${hits === 1 ? '' : 's'}. No luck.`);
        }
        k.tickets = k.tickets.filter(t => t.game !== k.game);
        k.drawing = false; k.game++; k.next = s.time + 4 / 60 * 1.0 + 0.04;
      }
    }
  },
  drawKeno() {
    const k = this.keno, x = dynamic.keno.c.getContext('2d');
    x.fillStyle = '#100808'; x.fillRect(0, 0, 512, 384);
    x.fillStyle = '#c7352b'; x.fillRect(0, 0, 512, 44); x.fillStyle = '#fff'; x.font = '30px Bungee, Impact'; x.textAlign = 'left'; x.fillText('KENO', 14, 34);
    x.textAlign = 'right'; x.font = '18px Inter, sans-serif'; x.fillText(k.drawing ? `GAME ${k.game} · DRAWING ${k.shown}/20` : `GAME ${k.game} · NEXT DRAW ${Math.max(0, Math.round((k.next - this.state.time) * 60))}m`, 500, 30);
    const shown = new Set(k.drawn.slice(0, k.drawing ? k.shown : 20));
    for (let i = 0; i < 80; i++) {
      const cx = 14 + (i % 10) * 49, cy = 56 + Math.floor(i / 10) * 40, on = shown.has(i + 1), last = k.drawing && k.drawn[k.shown - 1] === i + 1;
      x.fillStyle = on ? (last ? '#ffe27a' : (i < 40 ? '#ff4a3a' : '#3a8aff')) : '#2a1a1a'; x.beginPath(); x.arc(cx + 20, cy + 16, 17, 0, 7); x.fill();
      x.fillStyle = on ? '#000' : '#7a6a6a'; x.font = 'bold 16px Inter, sans-serif'; x.textAlign = 'center'; x.fillText(i + 1, cx + 20, cy + 22);
    }
    dynamic.keno.tex.needsUpdate = true;
  },
  // -------------------------------------------------- pokies glue
  sitAt(m) {
    if (player.cig && !m.def.smoke) { this.toast('Can\'t smoke in the gaming room — finish it outside first.'); return; }
    sitAt(m); this.uiOpen = false; document.exitPointerLock && document.exitPointerLock();
    $('deck').classList.remove('hidden'); $('hints').classList.add('hidden'); $('cross').classList.add('hidden');
    if (m.credit <= 0) this.toast('Insert cash to play (I).');
    this.state.mood = Math.max(0, this.state.mood - 0);
  },
  leaveMachine() {
    const m = player.seated; if (!m) return;
    if (!m.canSpin() && m.state !== 'gamble') { this.toast('Wait for the game to finish.'); return; }
    if (m.state === 'gamble') m.takeGamble();
    if (m.state === 'showWin') m.endShowWin();
    if (m.credit > 0.004) this.collect(true);
    standUp(); $('deck').classList.add('hidden'); $('hints').classList.remove('hidden'); $('cross').classList.remove('hidden');
    lockPointer();
  },
  insertCash() {
    const s = this.state, m = player.seated; if (!m) return;
    const opts = [10, 20, 50, 100].map(a => ({ label: `Insert ${fmt0(a)} note`, price: fmt0(a), disabled: s.wallet < a, fn: () => { s.wallet -= a; m.credit += a; SFX.print(); this.closePanel(); m.msg = 'PRESS SPIN TO PLAY'; CashFX.pay(a, 'insert'); } }));
    if (s.wallet >= 1) opts.push({ label: 'Insert everything in your wallet', price: fmt$(Math.floor(s.wallet)), fn: () => { const a = Math.floor(s.wallet); s.wallet -= a; m.credit += a; SFX.print(); this.closePanel(); } });
    if (s.tickets.length) opts.push({ label: `Insert ticket(s)`, price: fmt$(s.tickets.reduce((a, b) => a + b, 0)), fn: () => { m.credit += s.tickets.reduce((a, b) => a + b, 0); s.tickets = []; SFX.print(); this.closePanel(); } });
    this.openPanel('INSERT CASH', `Wallet ${fmt$(s.wallet)} · Max $5,000 credit · <i>Set a limit. Stick to it.</i>`, this.optList(opts));
  },
  collect(silent) {
    const m = player.seated; if (!m || m.credit <= 0.004) { if (!silent) this.toast('No credit to collect.'); return; }
    if (!m.canSpin()) return;
    if (m.state === 'showWin') m.endShowWin();
    const amt = Math.round(m.credit * 100) / 100; m.credit = 0; this.state.tickets.push(amt);
    SFX.print(); PokieFX.ticket(amt); this.toast(`Ticket printed: ${fmt$(amt)} — redeem at the cash machine in the gaming room.`);
  },
  redeem() {
    const s = this.state; if (!s.tickets.length) { this.toast('No tickets to redeem.'); return; }
    const amt = s.tickets.reduce((a, b) => a + b, 0); s.tickets = []; s.wallet += amt; SFX.atm(); CashFX.receive(amt); this.toast(`Redeemed ${fmt$(amt)} cash.`);
  },
  onPlayerBet(bet) { const s = this.state; s.night.wagered += bet; s.stats.wagered += bet; s.mood = Math.max(0, s.mood - 0.15); },
  onPlayerWin(amt, feature, gambleCollect) {
    if (gambleCollect) return;
    const s = this.state; s.night.won += amt; s.stats.won += amt; s.stats.biggest = Math.max(s.stats.biggest, amt);
    const m = player.seated; if (m) s.mood = Math.min(100, s.mood + Math.min(15, amt / m.bet * 0.4));
  },
  onGamble(win, amt) { const s = this.state; if (win) { s.night.won += amt; s.stats.won += amt; s.mood = Math.min(100, s.mood + 4); } else { s.night.won -= amt; s.stats.won -= amt; s.mood = Math.max(0, s.mood - 8); } },
  onFeature(f, m) { this.state.mood = Math.min(100, this.state.mood + 6); },
  onBigWin(m, lvl) { Night.log('🎰', `${lvl} on ${m.game.name} (${fmt$(m.win || 0)})`); $('bigwin').textContent = lvl + '!'; $('bigwin').style.opacity = 1; setTimeout(() => $('bigwin').style.opacity = 0, 2500); SFX.cheer(m.screenW, 1); NPCS.forEach(n => { if (n.pos.distanceTo(m.seatW) < 6 && n.role !== 'bartender') { n.cheerT = 2; } }); },
  onJackpot(m, name, amt) {
    const who = m.mode === 'player' ? 'You' : (m.occupiedBy && m.occupiedBy.name) || 'Someone';
    if (m.mode === 'player' && !m._settling && this.mode === 'play' && (name === 'GRAND' || name === 'MAJOR')) Cine.jackpot(m, name);
    if (m.mode === 'player') { this.state.stats.jackpots++; Night.log('🔔', `${name} jackpot: ${fmt$(amt)}`); SFX.jackpotBell(); this.toast(`${name} JACKPOT! ${fmt$(amt)}`, true); }
    else if (name !== 'MINI') { SFX.jackpotBell(); this.toast(`🔔 ${who} just hit the ${name} — ${fmt$(amt)} on ${m.game.name}!`, name === 'GRAND' || name === 'MAJOR'); SFX.cheer(m.screenW, 2); }
  },
  onDrag() { const s = this.state; s.crave = Math.max(0, s.crave - 12); s.mood = Math.min(100, s.mood + 2.5); s.cigsTonight++; },
  onIndoorSmoke() { this.state.strikes++; this.subtitle(`<b>${bartender.name}:</b> ${this.state.strikes > 1 ? 'Last warning! Out the front with that or you\'re out!' : 'Oi! Not inside, mate! Put that out!'}`, 3.5); this.state.mood -= 5; if (this.state.strikes >= 3) this.kickOut(); },
  onSipAmount(std, vol = 0) { const s = this.state; s.drunk = Math.min(100, s.drunk + std * 7.2 * DIFF[s.diff].hang ** 0.5 * (s.hunger > 70 ? 1.3 : s.hunger < 25 ? 0.85 : 1)); s.mood = Math.min(100, s.mood + std * 2.2); s.bladder = Math.min(100, s.bladder + vol * 30); },
  walkHome() { if (this.mode !== 'play' || player.auto) return; player.auto = V3(player.pos.x - 30, 0, 21.2); this.subtitle('<i>The street\'s quiet. The Royal hums behind you.</i>', 3); setTimeout(() => { player.auto = null; this.endNight('home'); }, 3600); },
  onSpill(a) { if (a > 0.05) this.toast(choice(['Whoa — sloshed half your beer.', 'Steady! You\'re wearing it.', 'That\'s a waste of good beer.'])); },
  onBump() { this.state.mood = Math.max(0, this.state.mood - 2); },
  onGlassSmash(pos) {
    const s = this.state; s.stats.glasses++; s.night.glasses++; if (s.night.glasses === 1) Night.log('🥴', 'Smashed a glass. WAHEY!'); s.mood = Math.max(0, s.mood - 3);
    if (isInside(pos.x, pos.z)) {
      setTimeout(() => { SFX.cheer(pos, 3); NPCS.forEach(n => { if (n.role !== 'bartender' && n.pos.distanceTo(pos) < 14) n.cheerT = 1.6; }); this.subtitle('<b>The whole pub:</b> WAHEYYYYY!', 2.5); }, 350);
      if (s.night.glasses >= 3) setTimeout(() => this.subtitle(`<b>${bartender.name}:</b> Right, that's three. Maybe call it a night, champ.`, 3), 3000);
    }
  },
  kickOut() { Night.log('🚪', 'Bouncer walked you out'); this.closePanel(); this.subtitle('<b>Bouncer:</b> Alright mate, you\'ve had enough. Out you go.', 3); this.state.kicked = true; setTimeout(() => this.endNight('kicked'), 2200); },
  // -------------------------------------------------- talking
  talkTo(n) {
    const s = this.state; n.a.talk = 2; Night.ev('talk', n.regular || n.name);
    if (n.regular) { REG.talk(n); return; }
    if (n.eventTalk) { n.eventTalk(); return; }
    const line = choice((BARKS[n.spot ? (n.spot.kind === 'pokie' ? 'pokie' : n.a.smoking ? 'smoke' : n.spot.area) : 'any'] || BARKS.any).concat(this.dayBarks()));
    const opts = [{ label: 'Have a yarn', d: 'Chew the fat for a bit', fn: () => { this.closePanel(); if (!n.yarned) { s.mood = Math.min(100, s.mood + 4); n.yarned = true; } bark(n, choice(["Ha! Too right.", "You're alright, you know that?", "Heard the Grand went off at the Commercial last week. Forty grand!", "My cousin won a meat tray three weeks running. Rigged, I reckon.", "Nah you're dreamin', mate.", "Machine four's due. Trust me. (It isn't.)"]), true); } }];
    if (n.smoker && s.cigs > 0 && !n.gotCig) opts.push({ label: 'Offer a smoke', d: 'They look like they need one', fn: () => { this.closePanel(); s.cigs--; n.gotCig = true; s.mood = Math.min(100, s.mood + 5); bark(n, 'Ahh, you beauty. Owe ya one.', true); } });
    if (!n.asked && Math.random() < 0.3 && s.wallet >= 20) { n.asked = true; opts.push({ label: `Lend ${n.name} $20 till tomorrow`, d: '"Pay ya back, I promise."', fn: () => { this.closePanel(); s.wallet -= 20; s.debts.push({ name: n.name, amt: 20, day: s.day, chance: 0.65 }); bark(n, 'Legend. Tomorrow, I swear on me mum.', true); } }); }
    if (s.event === 'knockoff' && this.crewOwes && !this.crewPaid) opts.push({ label: 'Remind them it\'s their shout', fn: () => { this.closePanel(); this.crewPaid = true; bark(n, 'Fair call! Schooner for this one, thanks!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => this.placeItem(item, spot) }); this.toast('The crew shouted you a schooner. It\'s at the bar.'); } });
    opts.push({ label: 'See ya', fn: () => this.closePanel() });
    this.openPanel(n.name.toUpperCase(), `"${line}"`, this.optList(opts), []);
  },
  // -------------------------------------------------- scheduled events
  updateEvents(dt) {
    const s = this.state, D = DAYS[s.day];
    // trivia
    if (s.event === 'trivia' && !this.trivia.done && s.time >= 20.5) {
      this.trivia.done = true;
      if (isInside(player.pos.x, player.pos.z) && !player.seated) this.runTrivia(); else this.toast('Trivia started without you. Oh well.');
      SFX.bell(V3(-9, 2.5, -8), 1);
    }
    // meat raffle
    if (s.event === 'raffle' && !this.raffle.drawn && s.time >= 17) {
      this.raffle.drawn = true; SFX.bell(V3(-9, 2.5, -8), 2);
      this.subtitle('<b>Raffle lady:</b> Righto everyone, MEAT RAFFLE! First tray goes to… green ticket, number forty-two!', 5);
      const sold = 160, trays = 10; let won = 0; for (let i = 0; i < this.raffle.tickets; i++) if (Math.random() < trays / sold) won++;
      setTimeout(() => { if (won) { s.stats.meat += won; s.night.extra += 40 * won; s.bank += 40 * won; s.mood = Math.min(100, s.mood + 25); SFX.cheer(player.pos, 2); this.toast(`🥩 YOU WON ${won > 1 ? won + ' MEAT TRAYS' : 'A MEAT TRAY'}! (~$${40 * won} of groceries saved)`, true); } else if (this.raffle.tickets) this.toast('No meat tray this week. Next Saturday…'); }, 4500);
    }
    // footy noise on Saturday
    if (s.event === 'raffle' && s.time < 18 && isInside(player.pos.x, player.pos.z)) { this.footyT -= dt; if (this.footyT <= 0) { this.footyT = rand(25, 60); SFX.cheer(V3(0, 2.5, 0), 2); bark(choice(NPCS.filter(n => n.role !== 'bartender')) || bartender, choice(['GOOOAL!', 'Ump! Are you blind?!', 'Kick it!', 'BALL!']), true); } }
    // last drinks + close
    if (!this.lastDrinks && s.time >= D.close - 0.25) { this.lastDrinks = true; Night.lastCall(); SFX.bell(V3(-9, 2.5, -8), 3); this.subtitle(`<b>${bartender.name}:</b> LAST DRINKS, EVERYBODY! LAST DRINKS!`, 4); NPCS.forEach(n => { if (n.role !== 'bartender' && Math.random() < 0.4 && n.state === 'idle') { n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); } }); }
    if (s.time >= D.close) { this.subtitle(`<b>${bartender.name}:</b> Righto folks, time to go home!`, 3); this.endNight('close'); }
    Night.update(dt); Moments.update(dt); RANDOM.update(dt); STORY.update(); Needs.update(dt); Racing.update(dt); Karaoke.tick(dt);
    // arrivals
    this.arriveT -= dt;
    if (this.arrivals > 0 && this.arriveT <= 0 && s.time < D.close - 1) {
      this.arriveT = rand(25, 70); this.arrivals--;
      const n = mkNPC({ pos: V3(rand(-20, 20), 0, 21) }); const sp = chooseNextSpot(n);
      if (sp) { sendTo(n, sp); n.path.unshift(...streetApproach(n)); } else { scene.remove(n.h.root); NPCS.pop(); }
    }
    // gone NPCs
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].gone) { scene.remove(NPCS[i].h.root); NPCS.splice(i, 1); }
    // leaving NPCs walk off down the street
    for (const n of NPCS) if (n.leaving && n.state === 'walk' && n.path.length === 0) { n.path = [V3(n.pos.x < 0 ? -40 : 40, 0, 21)]; }
    // drink/smoke/mood dynamics (per game minute)
    const gm = dt * this.timeScale * 60;
    s.drunk = Math.max(0, s.drunk - 0.11 * gm);
    s.crave = Math.min(100, s.crave + 0.18 * gm);
    if (s.crave > 75) s.mood = Math.max(0, s.mood - 0.04 * gm);
    if (s.drunk >= 98 && !s.kicked) this.kickOut();
    // leaving via the street
    if (this.entered && player.pos.z > 18.6 && player.pos.x < 22 && !clubAround(player.pos.x, player.pos.z) && !this.askedHome && !this.uiOpen) { this.askedHome = true; this.openPanel('HEAD HOME?', `It's ${this.clockText()}. ${s.time < 22 && s.drunk < 35 ? 'An early, sober night means a bonus tomorrow.' : ''}`, '', [{ label: 'Walk home', fn: () => { this.closePanel(); this.walkHome(); } }, { label: 'One more', fn: () => { this.closePanel(); } }]); }
    if (player.pos.z < 17 && this.askedHome) this.askedHome = false;
    if (!this.entered && isInside(player.pos.x, player.pos.z)) { this.entered = true; this.toast(`Welcome to ${VENUE.id === 'royal' ? 'the Royal' : VENUE.name.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}.`); this.objective(); this.subtitle(`<b>${bartender.name}:</b> ${choice(["G'day! What can I get ya?", 'Evenin\'! Bar\'s open.', "How ya goin', mate?"])}`, 3); }
    if (s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0) + this.machineCredit() < 0.5 && !this.brokeWarned) { this.brokeWarned = true; this.toast('You\'re completely skint. Water\'s free, the walk home is too.', true); }
  },
  runTrivia() {
    const qs = TRIVIA.slice().sort(() => Math.random() - 0.5).slice(0, 5); let i = 0, score = 0;
    const ask = () => {
      if (i >= qs.length) {
        const s = this.state; let prize = '';
        if (score >= 4) { s.wallet += 50; s.night.extra += 50; s.stats.trivia++; s.mood = Math.min(100, s.mood + 15); prize = 'Your table WINS! $50 bar tab (cash).'; SFX.cheer(player.pos, 2); if (s.day === 2) STORY.addFund(50, 'Bev matched your trivia prize'); }
        else if (score === 3) { prize = 'Second place — a free schooner on the house.'; bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + .6, BAR.z1 - .6), cb: (it, sp) => this.placeItem(it, sp) }); }
        else prize = 'Wooden spoon. Better luck next week.';
        Night.ev('trivia', score); Night.log('❓', `Trivia: ${score}/5`);
        this.openPanel('TRIVIA RESULTS', `${score} / 5`, `<p>${prize}</p>`); return;
      }
      const [q, a] = qs[i], right = a[0], opts = a.slice().sort(() => Math.random() - 0.5);
      this.openPanel(`TRIVIA · Q${i + 1}`, 'Host: "Pens down in thirty!"', this.optList(opts.map(o => ({ label: o, fn: () => { if (o === right) { score++; SFX.win(1); this.toast('Correct!'); } else { SFX.tone(160, 0.3, { gain: 0.1, type: 'sawtooth' }); this.toast(`Nope — ${right}.`); } i++; ask(); } }))), []);
      $('pTitle').insertAdjacentHTML('afterend', '');
      $('pSub').innerHTML = `<b style="font-size:17px;color:#fff">${q}</b>`;
    };
    this.subtitle('<b>Host:</b> Welcome to Royal Trivia! Five questions, fifty-dollar bar tab!', 3);
    ask();
  },
  // -------------------------------------------------- input
  canMove() { return this.mode === 'play' && !this.uiOpen && !this.paused && !player.seated && !MG.active && !Cine.active && !Eat.active; },
  onKey(code) {
    if (this.mode !== 'play') return;
    if (DLG.active) { DLG.key(code); return; }
    if (Cine.active) return;
    if (Eat.active) { if (code === 'KeyQ' || code === 'Escape') Eat.stop(true); return; }
    if (code === 'Escape') { if (!$('panel').classList.contains('hidden')) { this.closePanel(); return; } if (player.seated) { this.leaveMachine(); return; } return; }
    if (this.uiOpen || this.paused) return;
    if (MG.active) { MG.key(code); return; }
    const m = player.seated;
    if (m) {
      if (code === 'Space') { this.deckSpin(); }
      else if (code === 'ArrowUp' || code === 'Equal') this.betUp();
      else if (code === 'ArrowDown' || code === 'Minus') this.betDn();
      else if (code === 'KeyQ' || code === 'Backspace') this.leaveMachine();
      else if (code === 'KeyI') this.insertCash();
      else if (code === 'Enter') { if (m.state === 'gamble') m.takeGamble(); else this.collect(); }
      else if (code === 'KeyG') m.startGamble();
      else if (code === 'KeyR') m.gamble('red');
      else if (code === 'KeyB') m.gamble('black');
      else if (code === 'KeyF') sipDrink();
      else if (code === 'KeyC') { if (m.def.smoke) startSmoke(); else this.toast('No smoking in the gaming room. The terrace machines allow it.'); }
      return;
    }
    if (code === 'KeyE') this.interact();
    else if (code === 'KeyF') sipDrink();
    else if (code === 'KeyG') dropHeld();
    else if (code === 'KeyC') startSmoke();
    else if (code === 'Tab') this.phone();
  },
  deckSpin() {
    const m = player.seated; if (!m) return;
    vm.pressT = 0.25; m.btns[5].position.z = 0.003; setTimeout(() => m.btns[5].position.z = 0.012, 140);
    if (m.state === 'spinning') { m.slam(); return; }
    if (m.state === 'pick') { const free = m.pk.tiles.map((t, i) => t ? -1 : i).filter(i => i >= 0); if (free.length) m.pickTile(choice(free)); return; }
    if (m.state === 'gamble') return;
    if (m.credit + 1e-9 < m.bet) { if (m.credit > 0 && m.betIdx > 0) { this.toast('Not enough credit for that bet — lower it.'); } else this.insertCash(); return; }
    m.spin();
  },
  betUp() { const m = player.seated; if (!m) return; if (m.state === 'gamble') { m.gamble('black'); return; } if (!m.canSpin()) return; m.betIdx = Math.min(BETS.length - 1, m.betIdx + 1); SFX.button(); },
  betDn() { const m = player.seated; if (!m) return; if (m.state === 'gamble') { m.gamble('red'); return; } if (!m.canSpin()) return; m.betIdx = Math.max(0, m.betIdx - 1); SFX.button(); },
  onLockChange(locked) {
    if (this.mode !== 'play') return;
    if (!locked && !this.uiOpen && (!player.seated || MG.active) && !(MG.active && MG.active.cursor) && this.mode === 'play') { this.paused = true; $('resume').classList.remove('hidden'); }
    if (locked) { this.paused = false; $('resume').classList.add('hidden'); }
  },
  onCanvasClick(e) {
    if (this.mode !== 'play') return;
    if (MG.active) { if (!this.uiOpen && !this.paused) MG.down(e); return; }
    if (player.seated) {
      const m = player.seated;
      const ray = new THREE.Raycaster(), nd = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(nd, camera);
      const hit = ray.intersectObjects([m.btns[5], m.deck, m.scr], false)[0];
      if (!hit) return;
      if (hit.object === m.scr && m.state === 'pick' && hit.uv) { const px = hit.uv.x * SW, py = (1 - hit.uv.y) * SH; for (let i = 0; i < 12; i++) { const cx = RX + 70 + (i % 6) * 154, cy = RY + 120 + Math.floor(i / 6) * 190; if (Math.hypot(px - cx, py - cy) < 64) { m.pickTile(i); break; } } }
      else if (hit.object === m.scr) this.deckSpin();
      else {
        const id = hit.object === m.btns[5] ? 'spin' : deckHit(hit.uv);
        if (id === 'spin') this.deckSpin(); else if (id === 'betup') this.betUp(); else if (id === 'betdn') this.betDn();
        else if (id === 'cash') this.insertCash(); else if (id === 'gamble') m.startGamble();
        else if (id === 'collect') { if (m.state === 'gamble') m.takeGamble(); else this.collect(); }
        if (id) { SFX.button(); PokieFX.press(id); }
      }
      return;
    }
    if (!input.locked && !this.uiOpen) lockPointer();
  },
  // -------------------------------------------------- interaction targeting
  target: null,
  findTarget() {
    if (player.seated || this.uiOpen || MG.active) return null;
    const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), cp = camera.position;
    let best = null, bs = 0;
    for (const it of interactables) {
      if (!it.enabled()) continue;
      if (it.zone) { const z = it.zone; if (player.pos.x > z.x0 && player.pos.x < z.x1 && player.pos.z > z.z0 && player.pos.z < z.z1 && fw.x < -0.35) { const sc = 0.5; if (sc > bs) { bs = sc; best = it; } } continue; }
      const d = _v1.copy(it.pos).sub(cp), dist = d.length(); if (dist > it.r) continue;
      const dot = d.normalize().dot(fw); if (dot < 0.8) continue;
      const sc = dot - dist * 0.08 + (it.temp ? 0.3 : 0); if (sc > bs) { bs = sc; best = it; }
    }
    // NPCs to talk to
    for (const n of NPCS) {
      if (n.role === 'bartender' || n.state === 'walk') continue;
      const hp = _v2.set(n.pos.x, 1.45, n.pos.z), d = hp.clone().sub(cp), dist = d.length(); if (dist > 1.9) continue;
      const dot = d.normalize().dot(fw); if (dot < 0.88) continue;
      const sc = dot - dist * 0.08 + 0.05; if (sc > bs) { bs = sc; best = { npc: n, label: () => `Talk to ${n.name}`, action: () => this.talkTo(n) }; }
    }
    return best;
  },
  interact() { const t = this.target; if (t) { SFX.click(); t.action(); } },
  phone() {
    const s = this.state, dd = DIFF[s.diff], n = s.night;
    this.openPanel('YOUR PHONE', `${DAYS[s.day].name} ${this.clockText()} · 23% battery`, `
      ${Night.phoneHTML()}
      <div class="setrow"><span>Wallet</span><b>${fmt$(s.wallet)}</b></div><div class="setrow"><span>Bank</span><b>${fmt$(s.bank)}</b></div>
      <div class="setrow"><span>Rent due Sunday</span><b>${fmt0(dd.rent)}</b></div><div class="setrow"><span>Tonight: drinks / pokies in / pokies won</span><b>${fmt$(n.spentDrinks)} / ${fmt$(n.wagered)} / ${fmt$(n.won)}</b></div>
      <div class="setrow"><span>Week so far: wagered / won</span><b>${fmt$(s.stats.wagered)} / ${fmt$(s.stats.won)}</b></div>
      <p style="font-size:13px;opacity:.75;margin-top:10px">💬 <b>Mum:</b> Don't stay out too late love xx<br>💬 <b>Landlord:</b> Reminder rent is due Sunday.<br>${['💬 <b>Jess (sis):</b> Heard the Royal\'s up for sale?? Isn\'t that your local?', '💬 <b>Bev:</b> There\'s a bloke in a suit sniffing around. Keep an eye out.', `💬 <b>Bev:</b> Jar\'s on the bar. ${fmt0(STORY.st().fund)} so far!`, '💬 <b>Old Mick:</b> (voicemail, 4 minutes long, mostly about 1977)', '💬 <b>Shazza:</b> KARAOKE TONIGHT!!! 🎤🎤🎤 every point = $1 for the jar', '💬 <b>Bev:</b> Petition\'s ready. Come see me.', '💬 <b>Bev:</b> Council\'s at the pub at 8. Don\'t be late.'][s.day]}<br>${s.debts.length ? `💬 <b>You:</b> ${s.debts.map(d => d.name).join(', ')} owe${s.debts.length === 1 ? 's' : ''} you money.` : ''}</p>`);
  },
  timeScale: 0.8 / 60 * settings.timeSpeed, // game hours per real second (0.8 game-min / sec at normal speed)
};

function updateBoards(D) {
  const draw = (b, lines, big) => {
    const x = b.c.getContext('2d'), W = b.c.width, H = b.c.height;
    x.fillStyle = '#1a1e1c'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * W, Math.random() * H, rand(20, 120), rand(1, 4)); }
    x.textAlign = 'center'; x.fillStyle = '#f2efe6';
    lines.forEach((l, i) => { let fs = i === 0 ? 70 : 60; x.font = `${fs}px 'Permanent Marker', cursive`; while (fs > 24 && x.measureText(l).width > W - 48) { fs -= 4; x.font = `${fs}px 'Permanent Marker', cursive`; } x.fillStyle = ['#f2efe6', '#ffd84a', '#ff8a7a', '#8ad8ff', '#f2efe6'][i % 5]; x.fillText(l, W / 2, 110 + i * (H - 160) / Math.max(1, lines.length - 1) * 0.85); });
    b.tex.needsUpdate = true;
  };
  draw(dynamic.boards.aframe, [VENUE.name, ...D.board, 'POKIES · TAB · KENO']);
  draw(dynamic.boards.specials, ['SPECIALS', 'PARMA $26', 'CHIPS $9', D.event === 'parma' ? 'PARMA+POT $15' : D.event === 'sunday' ? 'ROAST $22' : 'SCHOONER $9.50', 'NO SHIRT NO SERVICE']);
}

// =====================================================================
//  MAIN LOOP
// =====================================================================
const clock = new THREE.Clock();
const _hazeCol = new THREE.Color();
let elapsed = 0, titleT = 0, attractT = 0, topT = 0, tvT = 0, jpT = 0, kenoT = 0, envT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (Game.mode === 'loading') return;
  simulate(dt);
  fxPass.uniforms.uTime.value = elapsed;
  // shadows are static-ish: refresh a couple of times a second instead of every frame
  if (shadowDirty > 0) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }
  renderer.info.reset();
  composer.render();
  perfOverlay(dt);
  // dynamic resolution: keep ~55-60fps by trading pixels for frames
  perf.ema = perf.ema * 0.95 + dt * 0.05; perf.t += dt;
  // one-way: only ever steps DOWN after sustained slowness, so it can't oscillate or pop back and forth
  if (Game.mode === 'play' && perf.t > 3 && !window.__noDynRes && settings.dynres) {
    perf.t = 0;
    perf.slow = perf.ema > 1 / 42 ? perf.slow + 1 : 0;
    if (perf.slow >= 3 && renderScale > 0.62) { setRenderScale(renderScale - 0.15); perf.slow = 0; }
  }
}
const perf = { ema: 1 / 60, t: 0, slow: 0, show: /[?&]perf/.test(location.search), ot: 0, frames: 0, worst: 0 };
// F3: frame rate, frame time, draw calls and triangles (counted across every post-processing pass)
function perfOverlay(dt) {
  perf.frames++; perf.ot += dt; perf.worst = Math.max(perf.worst, dt);
  if (perf.ot < 0.5) return;
  const el = $('perf');
  if (perf.show) {
    const i = renderer.info;
    el.innerHTML = `<b>${Math.round(perf.frames / perf.ot)}</b> fps · ${(perf.ot / perf.frames * 1000).toFixed(1)} ms (worst ${(perf.worst * 1000).toFixed(0)})<br>${i.render.calls} draws · ${(i.render.triangles / 1000).toFixed(0)}k tris · ${i.memory.textures} tex<br>${settings.quality.toUpperCase()} · res ${Math.round(renderScale * 100)}% · ${renderer.getPixelRatio().toFixed(2)}x${ASSETS.lightmaps ? ' · baked light' : ''}${window.__gpu ? '<br><span>' + window.__gpu.slice(0, 48) + '</span>' : ''}`;
  }
  el.classList.toggle('hidden', !perf.show);
  perf.frames = 0; perf.ot = 0; perf.worst = 0;
}
// debug/test helper: fast-forward the simulation without rendering
window.__sim = (sec, step = 1 / 30) => { for (let i = 0; i < sec / step; i++) simulate(step); };
function simulate(dt) {
  if (Cine.active) { Cine.rdt = dt; dt *= Cine.slow; }
  elapsed += dt;
  const s = Game.state;
  const playing = Game.mode === 'play' && !Game.paused;
  if (Game.mode === 'title' || Game.mode === 'card') {
    titleT += dt;
    const a = -0.35 + Math.sin(titleT * 0.05) * 0.3;
    camera.position.set(Math.sin(a) * 19 + 2, 2.4 + Math.sin(titleT * 0.1) * 0.4, 6 + Math.cos(a) * 15);
    camera.lookAt(0, 4.2, 1);
  }
  vm.root.visible = Game.mode === 'play' && !MG.active;
  if (playing) {
    if (!Cine.active) s.time += dt * Game.timeScale;
    updatePlayer(dt, elapsed);
    Game.updateEvents(dt); DLG.update(dt); Overheard.update(dt); Eat.update(dt, elapsed); Food.update(dt); NpcMeals.update(dt);
    Game.updateKeno(dt);
    setTimeOfDay(s.time, DAYS[s.day].weather); // every frame: lighting changes smoothly, no steps
    const t = Game.findTarget(); Game.target = t;
    const pr = $('prompt');
    if (t) { pr.innerHTML = `<kbd>E</kbd>${t.label()}`; pr.classList.remove('hidden'); $('cross').classList.add('on'); } else { pr.classList.add('hidden'); $('cross').classList.remove('on'); }
    if (Game.subT > 0) { Game.subT -= dt; if (Game.subT <= 0) $('subtitle').innerHTML = ''; }
    if (Game.objShownAt != null && elapsed - Game.objShownAt > 9) $('objective').style.opacity = keys.Tab ? 1 : 0;
    if (Game.frameN % 6 === 0) { Game.updateHUD(); if (Game.frameN % 120 === 0) Game.objective(); }
    // FX uniforms
    fxPass.uniforms.uDrunk.value = damp(fxPass.uniforms.uDrunk.value, clamp((s.drunk - 25) / 70, 0, 1) * (settings.reduceMotion ? 0 : settings.drunkFx), 1, dt);
    fxPass.uniforms.uHang.value = s.startHang ? Math.max(0, 0.5 - (s.time - s.startTime) * 0.4) : 0;
  }
  if (Game.mode === 'play' || Game.mode === 'title' || Game.mode === 'card') {
    // world simulation (also runs behind title for ambience)
    const pp = Game.mode === 'play' ? player.pos : camera.position;
    const actors = [{ x: pp.x, z: pp.z, r: 0.32 }];
    for (const n of NPCS) { n.dist2 = (n.pos.x - camera.position.x) ** 2 + (n.pos.z - camera.position.z) ** 2; const live = n === bartender || Clubs.live(n); n.h.root.visible = live; if (!live) continue; if (Game.mode !== 'play' || !Game.paused) updateNPC(n, dt, elapsed, pp); if (n.state === 'walk') actors.push({ x: n.pos.x, z: n.pos.z, r: 0.25 }); }
    updateDoors(dt, actors);
    for (const m of MACHINES) {
      if (m.mode === 'player') { m.update(dt); m.draw(); }
      else if (m.mode === 'npc') { const d2 = (m.def.pos.x - camera.position.x) ** 2 + (m.def.pos.z - camera.position.z) ** 2; if (d2 < 140 && (Game.frameN + m.idx) % 4 === 0) m.draw(); }
    }
    attractT += dt; if (attractT > 0.16) { attractT = 0; for (const id in shared) drawAttract(id, 0.16); }
    topT += dt; if (topT > 0.5) { topT = 0; for (const id in shared) drawTopper(id); }
    jpT += dt; if (jpT > 0.25) { jpT = 0; drawJPBoard(elapsed); }
    tvT += dt; if (tvT > 0.1) { for (const tv of dynamic.tvs) drawTV(tv, tvT); tvT = 0; }
    kenoT += dt; if (kenoT > 0.25) { kenoT = 0; Game.drawKeno(); Racing.drawBoard(); }
    for (const f of dynamic.fans) f.rotation.y += dt * 3.2;
    if (dynamic.flames) dynamic.flames.forEach((f, i) => { f.scale.set(0.28 + Math.sin(elapsed * 2.1 + i) * 0.03, 0.44 + Math.sin(elapsed * 3.3 + i * 2) * 0.06, 1); });
    dynamic.fire.intensity = 7.5 + Math.sin(elapsed * 1.9) * 0.6 + Math.sin(elapsed * 3.1) * 0.3; dynamic.heater.intensity = 9;
    smokeFX.update(dt, elapsed); dropFX.update(dt, elapsed); sparkFX.update(dt, elapsed);
    updateShards(dt); updateFalling(dt, elapsed); updatePuddles(dt);
    updateRain(dt, camera.position);
    const inside = isInside(camera.position.x, camera.position.z);
    // warm, smoky indoor haze vs the outdoor sky fog
    const gam = inGaming(camera.position.x, camera.position.z);
    atmo.iF = damp(atmo.iF || 0, inside ? 1 : 0, 3, dt);
    if (window.__fogOut) { scene.fog.color.copy(window.__fogOut.c).lerp(_hazeCol.set(gam ? 0x26131f : 0x2c1c11), atmo.iF); scene.fog.density = lerp(window.__fogOut.d, gam ? 0.032 : 0.026, atmo.iF); }
    Town.glow(atmo.nightF); fxPass.uniforms.uWarm.value = atmo.iF * VENUE.warm * (1 - Night.house * 0.55); fxPass.uniforms.uDim.value = Night.dark * 0.5 * atmo.iF; fxPass.uniforms.uNight.value = atmo.nightF;
    updateAtmosphere(dt, elapsed, camera.position, inside);
    Clubs.update(dt); updateZones(dt); updateTraffic(dt); TOUCH.update(); PokieFX.update(dt); CashFX.update(dt); ATM.update(dt); Juke.update(dt);
    updatePeopleShadows();
    bloom.threshold = damp(bloom.threshold, inside ? 0.82 : lerp(0.82, 4.0, window.__dayF || 0), 3, dt);
    renderer.toneMappingExposure = damp(renderer.toneMappingExposure, (inside ? (1.15 * VENUE.exposure + Night.house * 0.55) * (1 - Night.dark * 0.8) : lerp(1.25, 0.62, window.__dayF || 0)) * settings.brightness, 2, dt);
    fxPass.uniforms.uSmoke.value = damp(fxPass.uniforms.uSmoke.value, onTerrace(camera.position.x, camera.position.z) ? 0.6 : 0, 1, dt);
    AudioSys.update(dt, { inside, gaming: inGaming(camera.position.x, camera.position.z), pos: camera.position, machinePositions: MACHINES.filter(m => m.mode !== 'idle' || Math.random() < 0.3).map(m => m.screenW), firePos: dynamic.firePos, jukePos: dynamic.jukePos });
  }
  Game.frameN++;
}

// =====================================================================
//  UI WIRING
// =====================================================================
function wireUI() {
  $('btnNew').onclick = () => { AudioSys.init(); $('mainMenu').classList.add('hidden'); $('diffMenu').classList.remove('hidden'); };
  document.querySelectorAll('.dcard').forEach(c => c.onclick = () => { AudioSys.init(); SFX.click(); Game.newWeek(c.dataset.diff); });
  $('btnContinue').onclick = () => { AudioSys.init(); if (Game.load()) Game.showDayCard(); };
  $('btnAch').onclick = () => { $('title').classList.add('hidden'); achievementsPanel(() => $('title').classList.remove('hidden')); };
  $('btnControls').onclick = () => {
    $('title').classList.add('hidden');
    Game.openPanel('HOW TO PLAY', 'A week at the Royal Hotel. Make rent on Sunday. Have a good time.', `
      <div class="ctrls"><span class="kbd">WASD</span><span>Walk (SHIFT to run — careful, you'll slosh your beer)</span><span class="kbd">MOUSE</span><span>Look</span>
      <span class="kbd">E</span><span>Interact: bar, ATM, Keno, jukebox, machines, talk to locals, pick up drinks</span><span class="kbd">F</span><span>Sip your drink</span>
      <span class="kbd">C</span><span>Smoke (outside, or at the terrace machines). Press again for another drag.</span><span class="kbd">G</span><span>Drop your glass (the pub will cheer)</span><span class="kbd">TAB</span><span>Phone: money & messages</span>
      <span class="kbd">SPACE</span><span>At a pokie: spin / slam-stop / pick</span><span class="kbd">↑ ↓</span><span>Change bet</span><span class="kbd">I</span><span>Insert cash</span><span class="kbd">ENTER</span><span>Collect a ticket</span><span class="kbd">G R B</span><span>Gamble a win: red or black</span><span class="kbd">Q</span><span>Stand up</span></div>
      <p style="font-size:13px;opacity:.75;line-height:1.5">Each night starts at a different time with its own event. Leave early & sober and you'll pick up overtime tomorrow. Get legless and you'll be docked pay and start late. The pokies are tuned like real ones — about 85–95% return. Over a week, the house wins.</p>`, [{ label: 'Back', fn: () => { Game.closePanel(); $('title').classList.remove('hidden'); } }]);
  };
  $('btnSettings').onclick = () => { $('title').classList.add('hidden'); openSettings(() => $('title').classList.remove('hidden')); };
  $('btnPauseSettings').onclick = () => { $('resume').classList.add('hidden'); openSettings(() => { $('resume').classList.remove('hidden'); }); };
  $('btnResume').onclick = () => { lockPointer(); };
  $('btnHome').onclick = () => { $('resume').classList.add('hidden'); Game.paused = false; Game.endNight('home'); };
  $('btnQuit').onclick = () => { $('resume').classList.add('hidden'); Game.paused = false; Game.save(); Game.mode = 'title'; Game.toTitle(); };
  // deck
  const D = (id, fn) => { $(id).onclick = e => { e.stopPropagation(); AudioSys.init(); fn(); }; };
  D('dkSpin', () => Game.deckSpin()); D('dkBetUp', () => Game.betUp()); D('dkBetDn', () => Game.betDn());
  D('dkCash', () => Game.insertCash()); D('dkCollect', () => { const m = player.seated; if (m && m.state === 'gamble') m.takeGamble(); else Game.collect(); });
  D('dkAuto', () => player.seated && player.seated.startGamble());
  D('dkSip', () => sipDrink()); D('dkSmoke', () => { const m = player.seated; if (m && m.def.smoke) startSmoke(); else Game.toast('No smoking in here — use the terrace machines.'); });
  D('dkLeave', () => Game.leaveMachine());
}

