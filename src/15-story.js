
// =====================================================================
//  ACHIEVEMENTS (saved in this browser across weeks)
// =====================================================================
const ACH_LIST = [
  ['firstpot', 'First of Many', 'Buy your first drink.'],
  ['bullseye', 'Bullseye', 'Hit the bull in a game of darts.'],
  ['tonup', 'Ton-Up', 'Score 100 or more in one round of darts.'],
  ['oneeighty', 'ONE-HUNDRED-AND-EIGHTY', 'Three treble twenties.'],
  ['darts', 'Good Arrows', 'Win a game of darts.'],
  ['pool', 'Pot Luck', 'Win a game of pool.'],
  ['shark', 'Pool Shark', 'Win three games of pool in one week.'],
  ['jackpot', 'Ding Ding Ding', 'Win a linked jackpot on the pokies.'],
  ['grand', 'The Grand', 'Win the Grand jackpot.'],
  ['feature', 'Feature Presentation', 'Trigger a pokie feature.'],
  ['early', 'Responsible Adult', 'Leave early and sober.'],
  ['legless', 'Legless', 'Get walked out by the bouncer.'],
  ['wahey', 'WAHEYYY', 'Smash five glasses in one week.'],
  ['meat', 'Meat Tray Royalty', 'Win the Saturday meat raffle.'],
  ['trivia', 'Trivia Buff', 'Win trivia night.'],
  ['shift', 'Hospo Life', 'Finish a shift behind the bar.'],
  ['pour', 'Perfect Pour', 'Pour a perfect beer on shift.'],
  ['longshot', 'Long Shot', 'Win a race bet at 10/1 or longer.'],
  ['karaoke', 'Karaoke Legend', 'Win karaoke night.'],
  ['samaritan', 'Good Samaritan', 'Hand in a lost wallet.'],
  ['kebab', "Kebab O'Clock", 'Eat a kebab after 11pm.'],
  ['scratchie', 'Scratch and Win', 'Win on a scratchie.'],
  ['regular', 'One of Us', 'Become proper mates with a regular.'],
  ['toilet', 'Breaking the Seal', 'Visit the gents.'],
  ['upstairs', 'Room With a View', 'Sleep in a room upstairs.'],
  ['taxi', 'Home, James', 'Catch a cab home.'],
  ['rent', 'Roof Over Your Head', 'Make rent on Sunday.'],
  ['legend', 'Legend of the Royal', 'Finish a week ahead of where you started.'],
];
const ACH = { got: store('ld_ach') || {} };
function achieve(id) {
  if (ACH.got[id]) return;
  const a = ACH_LIST.find(x => x[0] === id); if (!a) return;
  ACH.got[id] = Date.now(); store('ld_ach', ACH.got);
  const el = document.createElement('div'); el.className = 'ach';
  el.innerHTML = `<small>ACHIEVEMENT UNLOCKED</small><b>${a[1]}</b><span>${a[2]}</span>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 600); }, 4200);
  [784, 988, 1175, 1568].forEach((f, i) => SFX.tone(f, 0.4, { delay: i * 0.08, gain: 0.07, type: 'triangle' }));
}
function achievementsPanel(back) {
  const n = Object.keys(ACH.got).length;
  const grid = `<div class="achgrid">${ACH_LIST.map(([id, t, d]) => `<div class="achc ${ACH.got[id] ? 'on' : ''}"><b>${ACH.got[id] ? t : '???'}</b><span>${d}</span></div>`).join('')}</div>`;
  Game.openPanel('ACHIEVEMENTS', `${n} of ${ACH_LIST.length} unlocked`, grid, [{ label: 'Back', fn: () => { Game.closePanel(); back && back(); } }]);
}

// =====================================================================
//  REGULARS: the same six faces every night, each with a week-long story
// =====================================================================
// lines[day] is what they say when you have a yarn (Mon = 0). Choices can change flags and relationships.
const REGULARS = {
  'Old Mick': {
    look: { fem: false, skinI: 0, shirt: { tile: 'collar', c: 0x5a4632 }, pants: { tile: 'cloth', c: 0x3a3a40 }, hair: 0xd8d8d8, style: 'cap', scale: 0.95, girth: 1.0, shorts: false, beard: 'mo', glasses: true },
    spot: s => s.kind === 'stool' && s.area === 'bar' && s.pos.z < -13.3, bio: 'Drinking at the Royal since 1968. Same stool.',
    lines: [
      "Been drinking here since '68. Same stool. They put a plaque on it once. Somebody nicked the plaque.",
      "My Joanie loved the parma here. Said it was the only thing in this town bigger than my ego.",
      "Trivia? I AM the trivia, son. First PM — Barton. Next question.",
      "Today would've been Joanie's eightieth birthday.",
      "We had six o'clock closing when I started. The six o'clock swill. Animals, we were.",
      "Footy's not what it was. Nothing is. Except the beer. Beer's the same.",
      "Rumour is the owners are selling up. Where'll I go? Me stool's here.",
    ],
    extra(n, s, opts) {
      if (s.day === 3 && rel('Old Mick') >= 25 && !s.flags.mickTip) opts.push({ label: 'Ask about Joan', d: 'He looks like he wants to talk', fn: () => { s.flags.mickTip = true; relUp('Old Mick', 10); Game.closePanel(); bark(n, "She always backed the grey in the last race. Here — race eight tonight, number six, Joan's Delight. Put a tenner on her for me.", true); Game.toast('Tip: Race 8 tonight, #6 Joan\'s Delight (TAB terminal by the Keno).', true); } });
    },
  },
  'Shazza': {
    look: { fem: true, skinI: 5, shirt: { tile: 'collar', c: 0xd04a8a }, pants: { tile: 'denim', c: 0xffffff }, hair: 0xe8d080, style: 'bob', skirt: false, girth: 1.0 },
    spot: s => s.kind === 'stool' && s.group === 'ht-6.5', bio: 'Loudest laugh in the pub. Saving for Bali.',
    lines: [
      "Darl! You look like you need a bevvie. Mondays, honestly.",
      "Saving every cent for Bali. Every cent. Except this one. And this one.",
      "If anyone asks, I was NOT the one who answered 'Kylie' for every trivia question.",
      "Payday! Don't let me near the pokies. Seriously, physically stop me.",
      "KARAOKE tonight, baby! I'm doing the big ballad. You should get up too!",
      "Bali's booked!! Ten days in Kuta. I'm never coming back. (I'm back Tuesday.)",
      "Bev reckons there's an offer on the pub. Over my dead body.",
    ],
    extra(n, s, opts) {
      if (rel('Shazza') >= 20 && !s.tonight.shazShout) opts.push({ label: '"Your shout, is it Shaz?"', d: 'Worth a try', fn: () => { s.tonight.shazShout = true; Game.closePanel(); bark(n, 'Ahh go on then, you charmer. Schooner for this one!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (it, sp) => Game.placeItem(it, sp) }); Game.toast('Shazza shouted you a schooner. It\'s at the bar.'); } });
    },
  },
  'Davo': {
    look: { fem: false, skinI: 2, shirt: { tile: 'hivis', c: 0xff7a1a }, pants: { tile: 'cloth', c: 0x2a3a5a }, hair: 0x3a2412, style: 'cap', girth: 1.25, shorts: true, beard: 'full' },
    spot: s => s.kind === 'pokie' && !s.smoke && s.machine && s.machine.idx === 7, bio: 'Concreter. Three kids. Always "due" on the Dragon.',
    lines: [
      "Up two hundred on the Dragon, mate! TWO HUNDRED! Tonight's the night.",
      "Gave it all back last night. And then some. She's due though. She's gotta be due.",
      "Lend us fifty? Just till tomorrow. Payday. Promise.",
      "Payday. Gonna win it all back tonight. All of it.",
      null, null, null,
    ],
    good: () => Game.state.flags.davoGood || 0,
    line(s) {
      const g = this.good();
      if (s.day === 4) return g >= 3 ? "Took the kids to the beach instead of coming here early. Best arvo in ages. Thanks for being straight with me." : "Down six hundred this week. Don't tell Kylie. Please.";
      if (s.day === 5) return g >= 3 ? "Haven't touched a machine in two days. Feels weird. Good weird." : "Had to sell the ute. Don't wanna talk about it.";
      if (s.day === 6) return g >= 3 ? "Rang the Gambling Help line today. Should've done it years ago. Cheers, mate." : "Rent's gonna bounce. Again. Yeah. I know.";
      return this.lines[s.day];
    },
    extra(n, s, opts) {
      const f = s.flags, push = (good, bad) => {
        opts.push({ label: good[0], d: good[1], fn: () => { f.davoGood = (f.davoGood || 0) + 1; s.tonight.davoChoice = 1; relUp('Davo', 6); Game.closePanel(); bark(n, good[2], true); } });
        opts.push({ label: bad[0], d: bad[1], fn: () => { s.tonight.davoChoice = 1; relUp('Davo', 3); Game.closePanel(); bark(n, bad[2], true); } });
      };
      if (s.tonight.davoChoice) return;
      if (s.day === 0) push(['"Cash out while you\'re ahead, mate."', 'Be straight with him', 'Yeah… yeah, maybe you\'re right. Maybe.'], ['"Let it ride!"', 'Egg him on', 'THAT\'S what I\'m talkin\' about!']);
      if (s.day === 1) push(['"Go home to the kids, Davo."', 'Be straight with him', '…Yeah. Kylie\'s been on me about it. Fair enough.'], ['"Yeah, she\'s due."', 'Tell him what he wants to hear', 'See! You get it.']);
      if (s.day === 2) {
        opts.push({ label: 'Lend him $50', d: '"Just till tomorrow"', disabled: s.wallet < 50, fn: () => { s.tonight.davoChoice = 1; s.wallet -= 50; s.debts.push({ name: 'Davo', amt: 50, day: s.day, chance: (f.davoGood || 0) >= 2 ? 0.95 : 0.35 }); relUp('Davo', 8); Game.closePanel(); bark(n, 'You\'re a legend. Tomorrow, I swear on me kids.', true); } });
        push(['"Not for the pokies, mate. Sorry."', 'Say no', '…Nah, you\'re right. Wasn\'t a fair ask.'], ['"Ask someone else, mate."', 'Brush him off', 'Yeah, righto. Cheers for nothing.']);
      }
      if (s.day === 3) push(['"Your kids need that money more than the machine does."', 'Be straight with him', '…Bloody hell. Yeah. Yeah, they do.'], ['"Go get \'em, champ."', 'Egg him on', 'Too right!']);
    },
  },
  'Kenno': {
    look: { fem: false, skinI: 1, shirt: { tile: 'collar', c: 0x161616 }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x6a4a2a, style: 'mullet', girth: 1.1, beard: 'mo' },
    spot: s => s.anim === 'darts', dartSkill: 0.85, bio: 'Two-time Royal darts champion (2009, 2014).',
    lines: [
      "Kenno. Two-time Royal darts champ. Oh-nine and fourteen. Fancy a game?",
      "Darts is ninety percent mental. The other half's physical.",
      "Trivia's for nerds. Arrows is for legends.",
      "You're getting better, I'll give ya that.",
      "Big crowd tonight. Good night to take someone's money on the oche.",
      "Footy's on. Board's free. You and me?",
      "If they sell the Royal, where's the board go? Some bloody wine bar?",
    ],
    extra(n, s, opts) {
      opts.push({ label: 'Challenge him to darts', d: 'He\'s good. Really good.', fn: () => { Game.closePanel(); Darts.offer(); } });
      if (rel('Kenno') >= 20 && !s.flags.dartTip) opts.push({ label: 'Ask for a tip', d: 'Swallow your pride', fn: () => { s.flags.dartTip = true; Game.closePanel(); bark(n, 'Elbow up, eyes on the treble, and follow through like you\'re posting a letter.', true); Game.toast('Kenno\'s tip: your darts are steadier now.'); } });
    },
  },
  'Bev': {
    look: { fem: true, skinI: 0, shirt: { tile: 'cloth', c: 0x7a3a5a }, pants: { tile: 'cloth', c: 0x2a2a2a }, hair: 0xb8b8b8, style: 'bob', scale: 0.93, girth: 1.08, glasses: true },
    spot: s => s.kind === 'chair' && s.group === 'lt9.4_0.6' && s.pos.x > 9.4, bio: 'Runs the raffle and trivia. Knows everything.',
    lines: [
      "I'm Bev. I've run the raffle and the trivia here since before you were born, love.",
      "Parma night keeps this place alive. Without it we'd be a pokies den with a carpet.",
      "Trivia starts at half eight. Phones away. I WILL check.",
      "Between you and me, the owners have had an offer. Developers. Apartments.",
      "If you're ever short, the bar could use a hand some nights. I'll put in a word with the boss.",
      "Raffle's at five. Here, have a ticket on me.",
      "I've got a petition to heritage-list the Royal. The council needs enough of us to sign.",
    ],
    extra(n, s, opts) {
      if (s.day === 4 && !s.flags.shiftOK) { s.flags.shiftOK = true; }
      if (s.day === 5 && rel('Bev') >= 15 && !s.tonight.bevTicket && !Game.raffle.drawn) opts.push({ label: 'Take the raffle ticket', fn: () => { s.tonight.bevTicket = true; Game.raffle.tickets++; Game.closePanel(); bark(n, 'Green forty-two. Lucky number.', true); } });
      if (s.day === 6 && !s.flags.petition) opts.push({ label: 'Sign the petition', d: 'Save the Royal', fn: () => { s.flags.petition = true; relUp('Bev', 12); Game.closePanel(); bark(n, 'Good on you, love. Every name counts.', true); } });
    },
  },
  'Spud': {
    look: { fem: false, skinI: 3, shirt: { tile: 'hoops', c: 0xb03040 }, pants: { tile: 'cloth', c: 0x222222 }, hair: 0x2a1a0a, style: 'bucket', scale: 1.02, girth: 0.9, beard: null },
    spot: s => s.kind === 'pool', poolSkill: 0.72, bio: 'Apprentice sparky. Pool shark. Always skint.',
    lines: [
      "Spud. Apprentice sparky. Wanna play pool? Ten bucks?",
      "Lend us twenty? I'll pay ya back Wednesday. Promise.",
      "Got paid today!",
      "I'm the best pool player in this pub. Ask anyone. Don't ask Kenno.",
      "Knock-off drinks! Apprentices don't knock off, we just get told to go home.",
      "Tip: aim at where the cue ball needs to BE, not at the ball. Changed my life.",
      "Sunday sesh, then TAFE tomorrow. Kill me.",
    ],
    extra(n, s, opts) {
      opts.push({ label: 'Challenge him to pool', d: 'Eight-ball, on the house table', fn: () => { Game.closePanel(); if (typeof Pool !== 'undefined') Pool.offer('Spud'); else Game.toast('Table\'s booked tonight — Spud reckons next week.'); } });
      if (s.day === 1 && !s.flags.spudLoan) opts.push({ label: 'Lend him $20', disabled: s.wallet < 20, fn: () => { s.flags.spudLoan = 1; s.wallet -= 20; relUp('Spud', 6); Game.closePanel(); bark(n, 'Champion. Wednesday. On me nan\'s life.', true); } });
      if (s.day === 2 && s.flags.spudLoan === 1) { s.flags.spudLoan = 2; s.wallet += 30; Game.toast('Spud paid back your $20 — plus a tenner. Legend.', true); relUp('Spud', 6); }
      if (s.day >= 5 && rel('Spud') >= 15 && !s.flags.poolTip) { s.flags.poolTip = true; Game.toast('Spud\'s tip: your pool aim line is longer now.'); }
    },
  },
};
function rel(name) { return (Game.state.rel && Game.state.rel[name]) || 0; }
function relUp(name, k) { const s = Game.state; s.rel[name] = clamp(rel(name) + k, 0, 100); if (s.rel[name] >= 60) achieve('regular'); }
const REG = {
  get(name) { return REGULARS[name] || null; },
  here(name) { return NPCS.find(n => n.regular === name && !n.gone) || null; },
  bump(name, k) { if (REGULARS[name]) relUp(name, k); },
  dartBonus() { return (Game.state.flags.dartTip ? 0.004 : 0) + (Night.hasPerk(4) ? 0.004 : 0); },
  spawnAll() {
    if (!VENUE.story) return;   // the Royal's locals drink at the Royal
    for (const name in REGULARS) {
      const R = REGULARS[name];
      const n = mkNPC(Object.assign({ name, smoker: name === 'Davo', gambler: name === 'Davo' }, R.look));
      n.regular = name;
      const sp = SPOTS.find(s => !s.occ && R.spot(s));
      if (sp) { claim(n, sp); n.pos.copy(sp.pos); n.ry = sp.ry; seatNPC(n); }
      else { n.pos.copy(NODES.P5); n.state = 'idle'; n.kind = 'stand'; }
      n.timer = 1e9; // regulars stay put
    }
  },
  talk(n) {
    const s = Game.state, R = REGULARS[n.regular], name = n.regular; Night.ev('talk', name);
    const line = (R.line ? R.line(s) : R.lines[s.day]) || choice(BARKS.any);
    const first = !s.tonight['talk_' + name];
    if (first) { s.tonight['talk_' + name] = 1; relUp(name, 5); s.mood = Math.min(100, s.mood + 3); }
    const opts = [];
    R.extra && R.extra(n, s, opts);
    STORY.talkOpts(n, opts);
    const price = Game.drinkPrice('schooner');
    if (!s.tonight['shout_' + name]) opts.push({ label: `Shout ${name} a drink`, d: 'Mateship is a currency', price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentDrinks')) return; s.tonight['shout_' + name] = 1; Night.ev('shouted'); Night.log('🍺', `Shouted ${name} a drink`); relUp(name, 10); n.glass.fill = 1; Game.closePanel(); bark(n, choice(['You beauty! Cheers.', 'Ahh, you\'re a gentleman and a scholar.', 'Legend. Owe ya one.']), true); SFX.register(V3(-9, 1.2, -9)); } });
    opts.push({ label: 'See ya', fn: () => Game.closePanel() });
    const hearts = '♥'.repeat(Math.round(rel(name) / 20)) + '♡'.repeat(5 - Math.round(rel(name) / 20));
    Game.openPanel(name.toUpperCase(), `<span style="opacity:.7">${R.bio} · <span style="color:#ff8a9a">${hearts}</span></span><br><br>"${line}"`, Game.optList(opts), []);
    bark(n, '…', false); n.a.talk = 3;
  },
};

// =====================================================================
//  RANDOM EVENTS: a couple each night (wallet, birthday, scuffle, charity tin, dodgy seller)
// =====================================================================
const RANDOM = {
  queue: [], live: [],
  plan() {
    const s = Game.state, D = DAYS[s.day];
    this.queue = []; this.live.forEach(e => e.cleanup && e.cleanup()); this.live = [];
    const pool = ['wallet', 'birthday', 'scuffle', 'charity', 'dodgy'].sort(() => Math.random() - 0.5);
    const n = D.crowd > 18 ? 3 : 2;
    for (let i = 0; i < n; i++) this.queue.push({ kind: pool[i], at: s.startTime + 0.4 + i * (D.close - s.startTime - 1) / n + rand(0, 0.5) });
  },
  update(dt) {
    const s = Game.state;
    for (const e of this.queue) if (!e.started && s.time >= e.at && Game.entered) { e.started = true; const ev = this[e.kind](); if (ev) this.live.push(ev); }
    for (const e of this.live) e.update && e.update(dt);
  },
  patron(filter = () => true) { return choice(NPCS.filter(n => n.role === 'patron' && !n.regular && !n.mg && n.state === 'idle' && n.spot && filter(n))); },
  wallet() {
    const spots = [V3(-4.6, 0, -4.3), V3(-6.2, 0, -11.6), V3(6.9, 0, -0.4), V3(-1.2, 0, -14.8), V3(10.6, 0, -2.6)];
    const p = choice(spots), cash = choice([120, 150, 180, 220]);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.09), M({ color: 0x3a2412, roughness: 0.6 })); w.position.set(p.x, 0.01, p.z); w.rotation.y = rand(0, 3); scene.add(w);
    const ia = addInteract({ id: 'wallet', temp: true, pos: V3(p.x, 0.3, p.z), r: 2.2, label: () => 'Pick up the wallet', action: () => {
      interactables.splice(interactables.indexOf(ia), 1); scene.remove(w);
      Game.openPanel('A WALLET', `Brown leather. ${fmt0(cash)} in cash, a licence for one <b>Graham Pike</b>, a photo of a kelpie.`, Game.optList([
        { label: 'Hand it in at the bar', d: 'The right thing', fn: () => { Game.closePanel(); achieve('samaritan'); Game.state.mood = Math.min(100, Game.state.mood + 10); for (const k in REGULARS) relUp(k, 3); Game.subtitle(`<b>${bartender.name}:</b> Good on ya. That's Pikey's — he'll be stoked.`, 4); setTimeout(() => { if (Game.mode !== 'play') return; Game.state.wallet += 40; Game.state.night.extra += 40; Game.toast('Graham Pike came back for his wallet and left you $40 at the bar. "Legend."', true); }, 45000); } },
        { label: `Keep the cash (${fmt0(cash)})`, d: 'Finders keepers…', fn: () => { Game.closePanel(); Game.state.wallet += cash; Game.state.night.extra += cash; Game.state.mood = Math.max(0, Game.state.mood - 12); if (Math.random() < 0.5) { for (const k in REGULARS) relUp(k, -8); setTimeout(() => Game.subtitle('<b>Bev:</b> I saw that. Shame on you.', 4), 2500); } Game.toast('You pocket the cash and bin the wallet. Feels grubby.'); } },
      ]));
    } });
    return { cleanup() { scene.remove(w); const i = interactables.indexOf(ia); if (i >= 0) interactables.splice(i, 1); } };
  },
  birthday() {
    const n = this.patron(); if (!n) return null;
    const age = choice([30, 40, 50, 60, 21]);
    SFX.bell(V3(-9, 2.5, -8), 1);
    Game.subtitle(`<b>${bartender.name}:</b> Oi! It's ${n.name}'s ${age}th! Everybody!`, 4);
    setTimeout(() => { NPCS.forEach(o => { if (o.role === 'patron' && o.state === 'idle' && Math.random() < 0.6) o.cheerT = 2.4; }); SFX.cheer(n.pos, 2); Music.level = 0.9; }, 2500);
    n.eventTalk = () => {
      const s = Game.state, price = Game.drinkPrice('schooner');
      Game.openPanel(n.name.toUpperCase(), `"It's me ${age}th! Can you believe it?"`, Game.optList([
        { label: 'Shout the birthday legend a drink', price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentDrinks')) return; n.eventTalk = null; Game.closePanel(); s.mood = Math.min(100, s.mood + 10); n.cheerT = 2; bark(n, 'You absolute LEGEND! Cheers!', true); } },
        { label: '"Happy birthday, mate."', fn: () => { n.eventTalk = null; Game.closePanel(); s.mood = Math.min(100, s.mood + 2); bark(n, 'Cheers, mate!', true); } }]), []);
    };
    return { cleanup() { n.eventTalk = null; } };
  },
  scuffle() {
    const a = this.patron(o => o.spot.area === 'bar'), b = a && this.patron(o => o !== a && o.spot.area === 'bar');
    if (!a || !b) return null;
    const lines = [[a, 'Oi, that was MY schooner, champ.'], [b, 'Wasn\'t. Sit down.'], [a, 'You wanna say that again?'], [b, 'Yeah I do. Sit. Down.'], [a, 'Right, OUTSIDE.']];
    const ev = { t: 0, k: 0, done: false, update(dt) {
      if (this.done) return;
      this.t -= dt;
      if (this.t <= 0 && this.k < lines.length) { const [who, l] = lines[this.k++]; bark(who, l, true); who.cheerT = 0; this.t = 4; }
      else if (this.t <= 0 && this.k >= lines.length) { this.done = true; Game.subtitle('<b>Bouncer:</b> Right, you two. Out. Now.', 4); for (const n of [a, b]) { n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); } }
    } };
    const calm = () => {
      if (ev.done) return; ev.done = true; a.eventTalk = b.eventTalk = null; Game.closePanel();
      const drunk = Game.state.drunk / 100;
      if (Math.random() < 0.75 - drunk * 0.4) { Game.subtitle('<b>You:</b> Settle down fellas, it\'s not worth it. I\'ll get the next one.', 3); setTimeout(() => { bark(a, '…Yeah. Fair enough. Sorry, mate.', true); }, 2500); Game.state.mood = Math.min(100, Game.state.mood + 8); for (const k in REGULARS) relUp(k, 2); }
      else { Game.subtitle(`<b>${a.name}:</b> Stay out of it!`, 3); setTimeout(() => { if (player.drink && !player.drink.onLedge) dropHeld(); Game.toast('You got shoved and lost your drink.'); Game.state.mood = Math.max(0, Game.state.mood - 8); }, 600); }
    };
    a.eventTalk = b.eventTalk = () => Game.openPanel('A BLUE BREWING', `${a.name} and ${b.name} are squaring up.`, Game.optList([{ label: '"Settle down, fellas."', d: 'Step in', fn: calm }, { label: 'Stay out of it', fn: () => Game.closePanel() }]));
    return ev;
  },
  charity() {
    const n = mkNPC({ name: 'Lions Club volunteer', shirt: { tile: 'collar', c: 0xe8c52a }, pants: { tile: 'cloth', c: 0x1a2440 }, fem: Math.random() < 0.5 });
    n.pos.copy(NODES.S0); const sp = SPOTS.find(s => !s.occ && s.area === 'bar' && s.kind === 'stand');
    if (sp) sendTo(n, sp); n.timer = 140; n.role = 'patron';
    n.eventTalk = () => Game.openPanel('LIONS CLUB', '"Collecting for the local hospital, love. Every gold coin helps."', Game.optList([
      { label: 'Drop in $5', price: '$5.00', disabled: Game.state.wallet < 5, fn: () => { Game.state.wallet -= 5; Game.state.night.extra -= 5; Game.state.mood = Math.min(100, Game.state.mood + 6); n.eventTalk = null; Game.closePanel(); bark(n, 'Bless you, darl.', true); SFX.coin(n.pos); } },
      { label: 'Drop in a gold coin', price: '$2.00', disabled: Game.state.wallet < 2, fn: () => { Game.state.wallet -= 2; Game.state.night.extra -= 2; Game.state.mood = Math.min(100, Game.state.mood + 3); n.eventTalk = null; Game.closePanel(); bark(n, 'Thank you!', true); SFX.coin(n.pos); } },
      { label: 'Sorry, no cash', fn: () => { n.eventTalk = null; Game.closePanel(); } }]));
    return null;
  },
  dodgy() {
    const n = this.patron(); if (!n) return null;
    n.eventTalk = () => Game.openPanel(n.name.toUpperCase(), '"Psst. Wanna buy a Rolex? Genuine. Fell off a truck. Sixty bucks."', Game.optList([
      { label: 'Buy the "Rolex"', price: '$60.00', disabled: Game.state.wallet < 60, fn: () => { Game.state.wallet -= 60; Game.state.night.extra -= 60; n.eventTalk = null; Game.closePanel(); setTimeout(() => { Game.toast('The "Rolex" says ROLAX on the face. And it\'s already stopped.', true); Game.state.mood = Math.max(0, Game.state.mood - 8); }, 4000); } },
      { label: '"Nah, you\'re right."', fn: () => { n.eventTalk = null; Game.closePanel(); bark(n, 'Your loss, mate.', true); } }]));
    return { cleanup() { n.eventTalk = null; } };
  },
};
