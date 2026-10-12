
// =====================================================================
//  OVERHEARD: wander near two patrons who are talking and you catch the gist.
//  Each rumour is worth something small: a tip on a machine, a warning, a nudge to your mood.
//  What you've heard is kept in flags.gossip so it isn't repeated.
// =====================================================================
const GOSSIP = [
  { id: 'hot', lines: [['{a}', "Dragon Link out the back paid {b} three hundred last night. Three hundred!"], ['{b}', "Yeah, then I put it all back in. Don't tell the missus."]], act() { const m = choice(MACHINES.filter(x => !x.def.smoke && x.skin)); if (m) { m.hotTip = true; Game.toast(`Tip: ${m.game.name} has been paying lately.`); Night.log('👂', `Heard ${m.game.name} was running hot`); } } },
  { id: 'inspector', lines: [['{a}', "Reckon there's a liquor inspector doing the rounds tonight."], ['{b}', "Then somebody tell Dazza to stop doing shots off the bar."]], act() { Game.state.flags.inspectorWarn = true; Game.toast('Heard: an inspector is about. Keep it tidy.'); Night.log('👂', 'Heard an inspector might be about'); } },
  { id: 'raffle', lines: [['{a}', "Bev's meat tray raffle is rigged, you know."], ['{b}', "Every Friday for six years and I've never won a snag."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
  { id: 'footy', lines: [['{a}', "Reckon the Tigers get up by two goals."], ['{b}', "Mate, they couldn't get up off the couch."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
  { id: 'council', lines: [['{a}', "They want to knock the Royal down and put up units."], ['{b}', "Over my dead body. Well. Over my cold beer."]], act() { Night.log('👂', 'Heard the council wants the Royal'); } },
  { id: 'cabbie', lines: [['{a}', "Left me car at the servo. Cabbie knows the whole town's business."], ['{b}', "Cabbie knows YOUR business."]], act() { Game.state.mood = clamp(Game.state.mood + 2, 0, 100); } },
  { id: 'tab', lines: [['{a}', "Got a tip on the fifth at Flemington. Bloke at the TAB swears by it."], ['{b}', "The bloke at the TAB swears by everything."]], act() { Game.state.flags.tabTip = true; Game.toast('Heard a racing tip. Maybe worth a flutter at the TAB.'); Night.log('👂', 'Heard a racing tip'); } },
  { id: 'kid', lines: [['{a}', "My boy reckons he's going to be a streamer. Playing video games. For money."], ['{b}', "Mate, that's what you do at the pokies."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
];
const Overheard = {
  cd: 25, cur: null,
  update(dt) {
    if (Game.mode !== 'play' || Game.uiOpen || Cine.active || DLG.active || MG.active) return;
    const c = this.cur;
    if (c) { c.t += dt; const L = c.g.lines[c.i]; if (L && c.t > c.i * 3.6) { Game.subtitle(`<i>(overheard)</i> <b>${L[0].replace('{a}', c.a.name).replace('{b}', c.b.name)}:</b> ${L[1]}`, 3.4); c.i++; } if (c.i >= c.g.lines.length && c.t > c.g.lines.length * 3.6) { this.cur = null; c.g.act && c.g.act(); } return; }
    this.cd -= dt; if (this.cd > 0) return;
    this.cd = rand(35, 70);
    const heard = (Game.state.flags.gossip = Game.state.flags.gossip || []);
    const near = NPCS.filter(n => n !== bartender && n.state !== 'walk' && n.dist2 > 2 && n.dist2 < 20);
    for (const a of near) { const b = near.find(o => o !== a && (o.pos.x - a.pos.x) ** 2 + (o.pos.z - a.pos.z) ** 2 < 5); if (!b) continue;
      const pool = GOSSIP.filter(g => !heard.includes(g.id)); if (!pool.length) return;
      const g = choice(pool); heard.push(g.id); a.a.talk = b.a.talk = 12; this.cur = { a, b, g, i: 0, t: 0 }; return; }
  },
};
