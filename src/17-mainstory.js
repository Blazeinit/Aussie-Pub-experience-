
// =====================================================================
//  MAIN STORY: "Save the Royal" — seven chapters, one per night, three endings
// =====================================================================
// The Royal's owner is selling to a developer. Over the week you can raise money,
// dig up the pub's 1888 licence, gather signatures, and turn down a bribe.
// On Sunday night the council comes to the pub and decides.
const CHAPTERS = [
  { title: 'Chapter 1 — New in Town', narr: 'Six months since you moved to Wattle Creek for the warehouse job. You don\'t know many people yet. Everyone, it turns out, knows the Royal.', goal: 'Meet the regulars. Bev runs the raffle and knows everything — she\'s in the lounge.' },
  { title: 'Chapter 2 — The Suit', narr: 'Word\'s out: old Frank is selling the Royal. Tonight there\'s a bloke in a suit in the lounge, and he isn\'t here for the parma.', goal: 'There\'s a man in a suit in the lounge. Find out what he wants.' },
  { title: 'Chapter 3 — The Jar', narr: 'Bev has had enough. A big jar has appeared on the bar with SAVE THE ROYAL written on it in texta. Trivia proceeds go in the jar tonight.', goal: 'Chip in to the Save the Royal jar on the bar. Win trivia and the prize goes in too.' },
  { title: 'Chapter 4 — 1888', narr: 'Old Mick swears the pub\'s original 1888 licence still exists. Joan\'s grandfather framed it, and Frank hung a footy photo over the top years ago.', goal: 'Find the 1888 licence. Mick reckons it\'s behind an old footy photo on the front wall of the bar.' },
  { title: 'Chapter 5 — The Big Night', narr: 'Friday. Karaoke\'s a fundraiser tonight — every point you score, the crowd puts a dollar in the jar. Shazza\'s been warming up since lunch.', goal: 'Karaoke fundraiser from 8:30pm: sing at the mic in the lounge. Points become dollars for the jar.' },
  { title: 'Chapter 6 — Signatures', narr: 'The council will only heritage-list the Royal if the locals put their names to it. Bev has a petition. The suit is back, with a fatter envelope.', goal: 'Get the petition from Bev, then get the regulars to sign it.' },
  { title: 'Chapter 7 — Last Drinks', narr: 'Sunday. The council is coming to the Royal at 8pm to decide its future. Rent\'s due tonight too. No pressure.', goal: 'The council meeting starts at 8pm in the bar. Be there.' },
];
const STORY = {
  st() { const f = Game.state.flags; return f.story || (f.story = { fund: 0, letter: null, licence: false, sigs: {}, sheet: false, bribe2: null, ending: null, met: false }); },
  chapter() { return CHAPTERS[Game.state.day]; },
  goal() {
    const s = Game.state, S = this.st(), d = s.day;
    if (!VENUE.story) return `A night out at ${VENUE.name}. The Royal's story can wait a night. Make some mates, back a few winners.`;
    if (d === 0 && S.met) return 'Have a yarn with the regulars. Shout one a drink.';
    if (d === 1 && S.letter) return S.letter === 'signed' ? 'You signed the suit\'s letter. Hope nobody finds out.' : 'You told the suit where to go. The regulars will hear about it.';
    if (d === 2) return `Chip in to the Save the Royal jar on the bar. Fund: ${fmt0(S.fund)}.`;
    if (d === 3 && S.licence) return 'You found the 1888 licence. Bev will want to see that.';
    if (d === 5) { const n = Object.keys(S.sigs).length; return S.sheet ? `Get the regulars to sign the petition (${n}/6, including you).` : 'Get the petition from Bev in the lounge.'; }
    if (d === 6 && S.ending) return 'The meeting\'s over. Enjoy the rest of the night.';
    return this.chapter().goal;
  },
  // ---------------------------------------------------------- world bits
  build() {
    // the jar on the bar
    const F = BAR.front, jar = new THREE.Group(); jar.position.set(F - 0.16, 1.112, -5.3); scene.add(jar);
    const glass = new THREE.Mesh(new THREE.LatheGeometry([V3(0, 0), V3(0.075, 0), V3(0.08, 0.02), V3(0.08, 0.2), V3(0.06, 0.22), V3(0.06, 0.24)], 20), glassMat); jar.add(glass);
    this.coins = new THREE.Group(); jar.add(this.coins);
    const lbl = signTex(['SAVE THE', 'ROYAL!'], { w: 256, h: 160, bg: '#f4ead6', color: ['#c7352b', '#c7352b'], sizes: [56, 64], font: "'Permanent Marker', cursive" });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshBasicMaterial({ map: lbl, transparent: true })); lp.position.set(0.083, 0.11, 0); lp.rotation.y = Math.PI / 2; jar.add(lp);
    this.jar = jar; jar.visible = false;
    addInteract({ id: 'jar', pos: V3(F - 0.16, 1.25, -5.3), r: 2.2, enabled: () => this.jar.visible && !MG.active, label: () => `Save the Royal jar — ${fmt0(this.st().fund)} so far`, action: () => this.donate() });
    // the licence behind the footy photo
    addInteract({ id: 'licence', pos: V3(2.2, 2.4, 1.7), r: 2.4, enabled: () => VENUE.story && (Game.state.day >= 3 || Game.state.flags.mickLicenceHint) && !this.st().licence, label: () => 'Look behind the old footy photo', action: () => this.findLicence() });
  },
  spawn() {
    const s = Game.state, S = this.st();
    this.jar.visible = VENUE.story && s.day >= 2 && S.ending !== 'sold';
    this.refreshCoins();
    this.clive = null; this.meetingDone = !!S.ending;
    if (VENUE.story && (s.day === 1 || s.day === 5)) {
      const n = mkNPC({ name: 'Clive Marsh', role: 'staff', shirt: { tile: 'collar', c: 0x2a2c34 }, pants: { tile: 'cloth', c: 0x2a2c34 }, hair: 0x8a8a8a, style: 'short', glasses: true, beard: null, skinI: 0, girth: 1.05 });
      const p = V3(7.6, 0, -2.9); n.pos.copy(p); n.ry = Math.PI * 0.85; MG.lockNPC(n, p, Math.PI * 0.85, 'stand');
      n.eventTalk = () => this.talkClive(n); this.clive = n;
    }
  },
  refreshCoins() {
    const c = this.coins; while (c.children.length) c.remove(c.children[0]);
    const n = Math.min(60, Math.round(this.st().fund / 6));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.cyl8, i % 4 ? MAT.brass : M({ color: 0x3a8a4a, roughness: 0.8 })); const a = rand(0, 6.28), r = rand(0, 0.06); m.position.set(Math.cos(a) * r, 0.01 + i * 0.0028, Math.sin(a) * r); m.scale.set(i % 4 ? 0.013 : 0.03, 0.002, i % 4 ? 0.013 : 0.015); m.rotation.set(rand(-0.3, 0.3), rand(0, 3), 0); c.add(m); }
  },
  addFund(amt, why) { const S = this.st(); S.fund += amt; this.refreshCoins(); if (why) Game.toast(`${why} — the Save the Royal fund is at ${fmt0(S.fund)}.`); },
  donate() {
    const s = Game.state;
    const give = a => () => { if (!Game.spend(a)) return; s.night.extra -= a; this.addFund(a, `You put ${fmt0(a)} in the jar`); relUp('Bev', Math.min(12, a / 5)); s.mood = Math.min(100, s.mood + 3); SFX.coin(V3(BAR.front, 1.2, -5.3)); Game.closePanel(); };
    Game.openPanel('SAVE THE ROYAL', `Bev's jar. ${fmt0(this.st().fund)} so far. Every dollar goes to the community bid for the freehold.`, Game.optList([5, 20, 50, 100].map(a => ({ label: `Put in ${fmt0(a)}`, price: fmt0(a), disabled: s.wallet < a, fn: give(a) })).concat([{ label: 'Not right now', fn: () => Game.closePanel() }])));
  },
  findLicence() {
    const S = this.st(); S.licence = true;
    SFX.noise(0.4, { freq: 900, q: 0.8, gain: 0.08 });
    achieve('historian');
    Game.openPanel('THE 1888 LICENCE', '<i>Behind the footy photo, taped to the backing board, a brittle yellow document in copperplate:</i>', `<p style="font-family:Rye,serif;font-size:17px;line-height:1.6;text-align:center;padding:10px;background:#efe2c0;color:#3a2410;border-radius:4px">COLONY OF NEW SOUTH WALES<br>PUBLICAN'S GENERAL LICENSE<br><b>THE ROYAL HOTEL, WATTLE CREEK</b><br>granted this 14th day of March, 1888</p><p>That's exactly the kind of thing a heritage council loves. Mick's going to cry.</p>`);
    const mick = REG.here('Old Mick'); if (mick) setTimeout(() => bark(mick, 'You FOUND it? Joanie\'s grandad\'s licence! Well I\'ll be…', true), 1500);
  },
  talkClive(n) {
    const s = Game.state, S = this.st();
    if (s.day === 1) {
      if (S.letter) { Game.openPanel('CLIVE MARSH', '"Pleasure doing business." / "Your loss, champ."'); return; }
      Game.openPanel('CLIVE MARSH', '<span style="opacity:.7">Marsh Living · "Boutique apartments for the modern country lifestyle"</span><br><br>"You look like a reasonable person. Frank\'s selling, the council\'s dithering, and I need a few locals to sign a little letter of support. Hundred and fifty bucks for your trouble. Cash."', Game.optList([
        { label: 'Sign the letter', d: 'Easy money. Nobody will know. Probably.', price: '+$150', fn: () => { S.letter = 'signed'; s.wallet += 150; s.night.extra += 150; Game.closePanel(); bark(n, 'Smart. Very smart.', true); Game.toast('You signed. $150 cash. It feels heavier than it should.'); } },
        { label: '"Not for sale, mate."', d: 'Turn him down', fn: () => { S.letter = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 4); Game.closePanel(); bark(n, 'Suit yourself. Everyone\'s got a price.', true); } },
        { label: '"Get out of our pub."', d: 'Loudly. In front of everyone.', fn: () => { S.letter = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 7); s.mood = Math.min(100, s.mood + 8); Game.closePanel(); SFX.cheer(n.pos, 1); Game.subtitle('<b>Shazza:</b> YEAH! You tell him!', 3); bark(n, 'You\'ll regret this.', true); } }]), []);
    } else {
      if (S.bribe2) { Game.openPanel('CLIVE MARSH', '"…"'); return; }
      Game.openPanel('CLIVE MARSH', '"Last offer. Five hundred dollars for that petition sheet. It gets lost, nobody\'s the wiser, everyone moves on."', Game.optList([
        { label: 'Hand over the sheet', d: 'Five hundred dollars is five hundred dollars', price: '+$500', disabled: !S.sheet, fn: () => { S.bribe2 = 'took'; S.sheet = false; S.sigs = {}; s.wallet += 500; s.night.extra += 500; for (const k in REGULARS) relUp(k, -25); Game.closePanel(); bark(n, 'Pleasure.', true); Game.toast('The petition is gone. So is the trust of everyone who signed it.', true); } },
        { label: '"Shove it, Clive."', fn: () => { S.bribe2 = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 5); Game.closePanel(); bark(n, 'Fine. See you at the meeting.', true); } }]), []);
    }
  },
  // extra options when you yarn with a regular
  talkOpts(n, opts) {
    const s = Game.state, S = this.st(), name = n.regular;
    if (s.day === 0 && name === 'Bev') S.met = true;
    if (s.day === 5 && name === 'Bev' && !S.sheet && S.bribe2 !== 'took') opts.unshift({ label: 'Take the petition', d: 'Get the regulars to sign it', fn: () => { S.sheet = true; S.sigs.Bev = true; Game.closePanel(); bark(n, 'Every name counts, love. Start with Mick — he\'d sign anything for this place.', true); } });
    if (s.day >= 5 && S.sheet && !S.sigs[name]) {
      const ok = rel(name) >= 15 || (name === 'Old Mick');
      opts.unshift({ label: `Ask ${name} to sign the petition`, d: ok ? 'They\'ll sign' : 'They don\'t know you well enough yet', fn: () => { Game.closePanel(); if (ok) { S.sigs[name] = true; bark(n, choice(['Give it here. Where do I sign?', 'For the Royal? Too right.', 'Done. Bloody developers.']), true); SFX.tone(1400, 0.1, { gain: 0.04 }); } else bark(n, 'Dunno, mate. I barely know ya. Ask me after a schooner or two.', true); } });
    }
    if (s.day === 3 && name === 'Old Mick' && !S.licence) opts.unshift({ label: 'Ask about the 1888 licence', fn: () => { Game.closePanel(); bark(n, 'Front wall of the bar, by the door. Frank stuck a footy photo over it in \'92. It\'s still under there, I\'d put money on it.', true); } });
    if (S.licence && name === 'Bev' && !S.showedBev) opts.unshift({ label: 'Show Bev the 1888 licence', fn: () => { S.showedBev = true; relUp('Bev', 15); Game.closePanel(); bark(n, 'Oh my word. Oh, that changes EVERYTHING. The council can\'t ignore this.', true); } });
  },
  // ---------------------------------------------------------- nightly hooks
  update() {
    const s = Game.state, S = this.st();
    if (VENUE.story && s.day === 6 && !this.meetingDone && s.time >= 20) { this.meetingDone = true; this.meeting(); }
  },
  score() { const S = this.st(), sigs = Object.keys(S.sigs).length + (Game.state.flags.petition ? 1 : 0); return Math.min(6, sigs) + (S.licence ? 3 : 0) + Math.min(3, Math.floor(S.fund / 100)) + Math.min(3, Game.state.flags.goodwill || 0) + (S.letter === 'signed' ? -2 : 0) + (S.bribe2 === 'took' ? -4 : 0); },
  meeting() {
    const S = this.st(), sc = this.score(), there = isInside(player.pos.x, player.pos.z) && player.level === 0;
    S.ending = sc >= 7 ? 'saved' : sc >= 4 ? 'reprieve' : 'sold';
    const sigs = Object.keys(S.sigs).length + (Game.state.flags.petition ? 1 : 0);
    const lines = [
      ['Councillor Hayes', 'Right. We\'re here to decide on the Marsh Living application for the Royal Hotel site.'],
      ['Clive Marsh', 'Forty-two boutique apartments. Jobs. Progress. Frankly this building is past it.'],
      ['Bev', `We've got a petition with ${sigs} signature${sigs === 1 ? '' : 's'}${S.fund ? `, and ${fmt0(S.fund)} raised by the people who drink here` : ''}.`],
      S.licence ? ['Bev', 'And THIS. The original publican\'s licence. Eighteen eighty-eight. This pub is older than Federation.'] : ['Old Mick', 'This pub\'s older than all of us. That ought to count for something.'],
      S.letter === 'signed' ? ['Clive Marsh', 'I also have letters of support from locals. Including one from somebody in this very room.'] : ['Shazza', 'And nobody in here took his dirty money, either!'],
      ['Councillor Hayes', { saved: 'Given the heritage evidence and the community\'s support, council will list the Royal. The application is refused.', reprieve: 'Council will defer the decision for twelve months to look at the heritage question properly.', sold: 'I\'m sorry. Without more support, council can\'t stand in the way of the sale.' }[S.ending]],
    ];
    if (!there) { Game.toast(`📱 <b>Bev:</b> ${S.ending === 'saved' ? 'WE DID IT!!! The Royal is SAVED. Where ARE you?!' : S.ending === 'reprieve' ? 'Twelve months reprieve. We fight on. Missed you there, love.' : 'It\'s over. They\'re selling. Wish you\'d been there.'}`, true); this.finale(); return; }
    Game.fade(0, 0.7); SFX.bell(V3(-9, 2.5, -8), 2);
    if (Cine.council(lines, () => { Game.fade(0.7, 0); this.finale(); })) return;
    let i = 0;
    const next = () => {
      if (i >= lines.length) { Game.closePanel(); Game.fade(0.7, 0); this.finale(); return; }
      const [who, l] = lines[i++];
      Game.openPanel('THE COUNCIL MEETING', `<span style="opacity:.6">The bar is packed. Even the pokies have gone quiet.</span>`, `<p style="font-size:18px;line-height:1.5"><b style="color:var(--gold)">${who}:</b> ${l}</p>`, [{ label: i < lines.length ? 'Continue' : 'And…', fn: next }]);
    };
    next();
  },
  finale() {
    const S = this.st();
    if (S.ending === 'saved') { achieve('saved'); SFX.cheer(V3(-5, 1.5, -8), 3); NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 3; }); Game.subtitle('<b>The whole pub:</b> ROYAL! ROYAL! ROYAL!', 5); Music.song = 0; Music.level = 1; Game.state.mood = 100; }
    else if (S.ending === 'reprieve') { SFX.cheer(V3(-5, 1.5, -8), 1); Game.subtitle('<b>Bev:</b> Twelve months. We\'ll take it. Drinks are on me — well, one each.', 5); Game.state.mood = Math.min(100, Game.state.mood + 15); }
    else { Game.subtitle('<b>Old Mick:</b> …Well. Last drinks, then.', 5); Game.state.mood = Math.max(0, Game.state.mood - 20); Music.song = 1; }
  },
  // shown in the end-of-week summary
  epilogue() {
    const S = this.st(), f = Game.state.flags, e = S.ending || (this.score() >= 7 ? 'saved' : this.score() >= 4 ? 'reprieve' : 'sold');
    const head = { saved: ['THE ROYAL IS SAVED', 'Council heritage-listed the Royal. With the community fund behind her, Bev put in a bid for the freehold — and got it. The Royal pours on.'], reprieve: ['A TWELVE-MONTH REPRIEVE', 'The council kicked the can down the road. The fight for the Royal goes on, and so do the Thursday raffles.'], sold: ['LAST DRINKS', 'Marsh Living got its apartments. The Royal poured its final beer in March. Somebody nicked the bell on the way out.'] }[e];
    const lines = [
      ['Old Mick', e === 'sold' ? 'Drinks at the RSL now. Says the stools are wrong.' : 'Got his plaque back on the stool. Bolted down this time.'],
      ['Davo', (f.davoGood || 0) >= 3 ? 'Four months off the pokies. Took the kids to the Gold Coast.' : 'Still says she\'s due.'],
      ['Shazza', 'Went to Bali. Came back Tuesday. Telling everyone about it still.'],
      ['Kenno', f.dartTip ? 'Reckons you\'re the only one who\'s ever been worth teaching.' : 'Won the Royal darts comp again. Third title.'],
      ['Spud', 'Finished his apprenticeship. Still owes everyone money.'],
      ['Bev', e === 'saved' ? 'The new licensee of the Royal Hotel. First rule: no suits.' : 'Still runs the raffle. Somewhere.'],
    ];
    return `<div class="epi"><h3>${head[0]}</h3><p>${head[1]}</p><ul>${lines.map(([n, l]) => `<li><b>${n}</b> — ${l}</li>`).join('')}</ul></div>`;
  },
};
ACH_LIST.push(['historian', 'History Buff', 'Find the Royal\'s 1888 licence.'], ['incorruptible', 'Not For Sale', 'Turn down the developer\'s money.'], ['saved', 'Save the Royal', 'Win the council vote and save the pub.']);
