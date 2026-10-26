
// =====================================================================
//  CONVERSATIONS: three "dig deeper" beats for each of the Royal's regulars, and the locals at the other pubs.
//  The choices matter: they move relationships, unlock things (the licence hint, a karaoke duet, the lucky flights,
//  mates' rates), shift the Save the Royal fund and the council vote ("goodwill"), and are remembered across nights.
// =====================================================================
function startPool(who) { const P = globalThis.PoolGame; if (P) P.offer(who); else Game.toast(`The table's booked tonight. ${who} says next week.`); }
const GW = c => { c.flags.goodwill = (c.flags.goodwill || 0) + 1; };   // community goodwill: counts towards the council vote
const need = (rl, arc, day = 0) => c => c.rel >= rl && DLG.arc(c.key) >= arc && c.day >= day;

// ---------------------------------------------------------------- OLD MICK
DLG.def('mick1', { start: 'a', nodes: {
  a: { say: ["He turns a creased photograph over in his big hands before he'll let you see it.", '"That\'s Joanie. Christmas dance at the Royal, nineteen seventy-one. She told me I danced like a bloke killing snakes."'], opts: [
    { t: '"She looks like she could handle you."', go: 'b', do: c => c.up(4) },
    { t: '"Is that why they pinched your plaque?" (a joke)', check: { stat: 'Charm', dc: 55 }, pass: 'c', fail: 'd' },
    { t: 'Say nothing. Buy him Joanie\'s drink.', d: 'A sweet sherry. She always had one.', cost: 7, cat: 'spentDrinks', go: 'e' }] },
  b: { say: '"Handle me? She ran me. Fifty-one years. Wouldn\'t let me pay a bill late, wouldn\'t let me skip church, and she\'d never ask for a thing. Best woman in the district."', next: 'z1' },
  c: { say: '"Ha! Ha! The PLAQUE. Joanie nicked it herself — said I\'d been warming that stool so long it deserved a medal. She hid it in the cellar. Still down there, I reckon."', do: c => { c.up(8); c.mem.plaque = 1; }, next: 'z1' },
  d: { say: '"That\'s not funny, son." He puts the photo away. "Not today."', do: c => c.up(-5), end: true },
  e: { say: ['You set the little glass on the bar in front of the empty stool beside him.', 'He doesn\'t say anything for a long time. Then he nods once, very slowly.', '"…Thanks, mate."'], do: c => { c.up(14); c.mem.sherry = 1; c.mood_(6); }, next: 'z1' },
  z1: { say: '"Come and see me again. I\'ve got something to show you. About the pub."', do: c => c.done(), end: true },
} });
DLG.def('mick2', { start: 'a', nodes: {
  a: { say: ['"You know the licence story? Joanie\'s grandad framed the Royal\'s original licence in eighteen eighty-eight. When Frank took over he stuck a footy photo on top of it. Front wall, by the door."', '"I\'m too old to get up there. Do us a favour. Have a look."'], opts: [
    { t: '"Leave it with me, Mick."', d: 'You can look behind the photo from tonight', go: 'b' },
    { t: '"That\'s just a pub legend, mate."', go: 'c' },
    { t: '"What\'s in it for the pub?"', go: 'd' }] },
  b: { say: '"Good lad. If it\'s there, it proves she\'s older than Federation. A council can\'t ignore that."', do: c => { c.up(10); c.flags.mickLicenceHint = true; c.done(); }, end: true },
  c: { say: '"Legend, is it." He looks at you for a bit. "Everything\'s a legend till someone checks."', do: c => { c.up(-6); c.flags.mickLicenceHint = true; c.done(); }, end: true },
  d: { say: '"A heritage listing is what\'s in it. Can\'t knock down a listed pub. Not even Clive Marsh can."', do: c => { c.up(4); c.flags.mickLicenceHint = true; c.done(); }, end: true },
} });
DLG.def('mick3', { start: 'a', nodes: {
  a: { say: ['Mick\'s sitting very straight tonight, hands flat on the bar.', '"I\'ve put it in writing. When I go — and it\'ll be soon, don\'t pretend — I want my ashes under the gum tree in the beer garden. Joanie\'s there already. Frank knows. But Frank\'s selling."', '"Will you make sure it happens? Whatever happens to this place."'], opts: [
    { t: '"I promise, Mick."', d: 'A promise is a promise', go: 'b' },
    { t: '"You\'ve got years left, mate."', go: 'c' },
    { t: '"I\'ll fight for the pub. Then you won\'t need to ask."', check: { stat: 'Nerve', dc: 50 }, pass: 'd', fail: 'c' }] },
  b: { say: '"Then I can rest easy." He pushes the plaque across the bar, the one Joanie hid. "This goes on the stool. Bolted down."', do: c => { c.up(25); c.flags.mickPromise = true; GW(c); c.log('🌳', 'Promised Mick the gum tree'); Night.addRep(3); c.done(); }, end: true },
  c: { say: '"Years." He chuckles. "Righto. Years."', do: c => { c.up(6); c.done(); }, end: true },
  d: { say: '"Then fight for her. Properly. Not just with a petition — with your feet. Turn up."', do: c => { c.up(20); c.flags.mickPromise = true; GW(c); c.mood_(10); c.done(); }, end: true },
} });
DLG.addArc('Old Mick', [{ id: 'mick1', title: "Joanie's photo", need: need(8, 0) }, { id: 'mick2', title: 'Behind the footy photo', need: need(25, 1, 1) }, { id: 'mick3', title: 'The gum tree', need: need(40, 2, 3) }]);

// ---------------------------------------------------------------- SHAZZA
DLG.def('shaz1', { start: 'a', nodes: {
  a: { say: ['Shazza slaps a glossy Bali brochure on the bar. There are Post-it flags in it.', '"Ten days in Kuta. I\'m $400 short and the flights go up Monday. Don\'t say anything. I know. I know."'], opts: [
    { t: 'Lend her $50', d: 'She\'ll pay you back', cost: 50, go: 'b' },
    { t: '"Maybe skip the third schooner a night?"', check: { stat: 'Charm', dc: 60 }, pass: 'c', fail: 'd' },
    { t: '"Bali sounds amazing, Shaz."', go: 'e' }] },
  b: { say: '"You ABSOLUTE legend. I\'ll pay you back with interest and a bracelet."', do: c => { c.up(14); c.flags.shazLoan = 1; c.log('🌴', 'Lent Shazza $50 for Bali'); c.done(); }, end: true },
  c: { say: '"Ugh. Fine. FINE. You\'re right. Water. For one whole night."', do: c => { c.up(10); c.mood_(3); c.flags.shazWater = 1; c.done(); }, end: true },
  d: { say: '"Oh, are you my mum now?" She laughs but it\'s sharp. "Sorry. Touchy subject."', do: c => { c.up(-4); c.done(); }, end: true },
  e: { say: '"RIGHT?! The beaches! The smoothies! I\'m going to be someone different over there."', do: c => { c.up(7); c.done(); }, end: true },
} });
DLG.def('shaz2', { start: 'a', nodes: {
  a: { say: ['"Karaoke, Friday. I need a duet partner. And it\'s you. I\'ve decided."', '"It\'s \'Islands In The Stream\'. You\'re Kenny. No arguments."'], opts: [
    { t: '"Deal. I\'ll be Kenny."', d: 'Your Friday karaoke score gets a boost', go: 'b' },
    { t: '"I can\'t sing, Shaz."', check: { stat: 'Charm', dc: 50 }, pass: 'c', fail: 'd' },
    { t: '"Only if you pay for the first round."', go: 'e' }] },
  b: { say: '"YES. We\'re going to bring the house DOWN."', do: c => { c.up(14); c.flags.shazDuet = true; c.done(); }, end: true },
  c: { say: '"Nobody can, babe, that\'s what the Dolly part\'s for. You\'ll be a lovely terrible Kenny."', do: c => { c.up(8); c.flags.shazDuet = true; c.done(); }, end: true },
  d: { say: '"…fine, I\'ll ask Davo." She does not look pleased.', do: c => { c.up(-3); c.done(); }, end: true },
  e: { say: '"Cheeky! …Deal."', do: c => { c.up(6); c.flags.shazDuet = true; c.done(); }, end: true },
} });
DLG.def('shaz3', { start: 'a', nodes: {
  a: { say: ['Shazza is not laughing. That\'s how you know it\'s serious.', '"Can I tell you something? That Bali money? Eleven years I\'ve been putting a twenty a week in the jar behind the bar. For the roof fund. Never told anyone. Bev knows."', '"If they sell, I\'ll have been paying for somebody else\'s apartment block."'], opts: [
    { t: '"You\'re the heart of this place, Shaz."', go: 'b' },
    { t: '"Then let\'s make sure they can\'t."', go: 'c' },
    { t: 'Squeeze her hand. Say nothing.', go: 'd' }] },
  b: { say: '"Stop it, I\'ll ruin my eyeliner."', do: c => { c.up(12); STORY.addFund(60, 'Shazza emptied her Bali envelope into the jar'); GW(c); c.done(); }, end: true },
  c: { say: '"There it is. There\'s the person Bev said you were."', do: c => { c.up(15); STORY.addFund(100, 'Shazza matched your pledge'); GW(c); c.done(); }, end: true },
  d: { say: 'She squeezes back, hard. Then she sniffs, grabs a napkin, and is Shazza again. "Right. Who\'s getting the drinks?"', do: c => { c.up(10); STORY.addFund(30); c.done(); }, end: true },
} });
DLG.addArc('Shazza', [{ id: 'shaz1', title: 'The Bali fund', need: need(8, 0) }, { id: 'shaz2', title: 'The duet', need: need(25, 1) }, { id: 'shaz3', title: 'Eleven years of twenties', need: need(40, 2, 3) }]);

// ---------------------------------------------------------------- DAVO
DLG.def('davo1', { start: 'a', nodes: {
  a: { say: ['Davo\'s phone lights up on the ledge. KYLIE ♥. He stares at it until it stops. It starts again.', '"She knows. About last week. Don\'t say anything to her if she comes in, yeah?"'], time: 20, timeout: 1, opts: [
    { t: '"Answer it, Davo."', go: 'b' },
    { t: '"Not my business, mate."', go: 'c' },
    { t: '"If she asks, I haven\'t seen you."', d: 'Cover for him', go: 'd' }] },
  b: { say: 'He stares at you. Then he answers. "Yeah. …Yeah, I\'m at the Royal. …I know. I KNOW. …Okay. Okay. I\'ll come home." He hangs up, shaking.', do: c => { c.up(12); c.flags.davoGood = (c.flags.davoGood || 0) + 1; c.log('📞', 'Told Davo to answer Kylie'); c.done(); }, next: 'b2' },
  b2: { say: '"Cheers. I\'d have let it ring out. Again."', end: true },
  c: { say: '"Yeah. Yeah. Fair enough." The phone rings out.', do: c => { c.up(-2); c.done(); }, end: true },
  d: { say: '"You\'re a good bloke." He doesn\'t look at you when he says it.', do: c => { c.up(5); c.flags.davoGood = Math.max(0, (c.flags.davoGood || 0) - 1); c.done(); }, end: true },
} });
DLG.def('davo2', { start: 'a', nodes: {
  a: { say: ['Davo\'s slumped at the machine, credit meter blinking $0.00.', '"I\'ve got a card in my wallet. Gambling Help. Somebody put it there. I haven\'t… I don\'t…"', 'He holds it out like it\'s hot.'], opts: [
    { t: '"I\'ll walk you out front. Let\'s ring them."', d: 'Be there for him', go: 'b' },
    { t: '"Keep it. Just in case."', go: 'c' },
    { t: '"Last go. She\'s due."', d: 'Tell him what he wants to hear', go: 'd' }] },
  b: { say: ['You stand on the footpath while he talks to a stranger on the phone for twenty minutes. His voice gets steadier.', '"They\'ve got a counsellor Thursday. I\'m going."'], do: c => { c.up(20); c.flags.davoGood = (c.flags.davoGood || 0) + 2; c.mood_(8); c.log('📞', 'Walked Davo out to ring Gambling Help'); GW(c); c.done(); }, end: true },
  c: { say: '"Yeah. In case." He tucks it in his wallet, behind the photo of the kids.', do: c => { c.up(8); c.flags.davoGood = (c.flags.davoGood || 0) + 1; c.done(); }, end: true },
  d: { say: '"…Yeah. Last go." He feeds the machine his last twenty. You watch it go.', do: c => { c.up(-8); c.flags.davoGood = Math.max(0, (c.flags.davoGood || 0) - 2); c.mood_(-5); c.done(); }, end: true },
} });
DLG.def('davo3', { start: 'a', nodes: {
  a: { say: ['Davo\'s in a clean shirt. He smells of soap. He is holding a Coke.', '"Thirteen days. I wanted you to be first to know. Kylie\'s picking me up at ten and she\'s bringing the kids. We\'re doing pizza."'], opts: [
    { t: '"Mate. I\'m proud of you."', go: 'b' },
    { t: 'Shout him a lemon squash. "To thirteen."', cost: 4, go: 'c' },
    { t: '"Don\'t let the pub drag you back in."', check: { stat: 'Charm', dc: 55 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Don\'t. You\'ll set me off."', do: c => { c.up(15); GW(c); c.done(); }, end: true },
  c: { say: 'He holds it up. "Thirteen." You clink.', do: c => { c.up(18); GW(c); c.done(); }, end: true },
  d: { say: '"I know. I\'ve told the boys. Not here after dark. Not yet." He grins. "I\'ll come for the parma."', do: c => { c.up(12); GW(c); c.done(); }, end: true },
  e: { say: '"Hey. Easy. I\'m doing the work."', do: c => { c.up(-3); c.done(); }, end: true },
} });
DLG.addArc('Davo', [{ id: 'davo1', title: "Kylie's calling", need: need(8, 0) }, { id: 'davo2', title: 'The card in his wallet', need: need(22, 1, 1) }, { id: 'davo3', title: 'Thirteen days', need: c => c.rel >= 35 && DLG.arc(c.key) >= 2 && c.day >= 4 && (c.flags.davoGood || 0) >= 3 }]);

// ---------------------------------------------------------------- KENNO
DLG.def('kenno1', { start: 'a', nodes: {
  a: { say: ['Kenno\'s chalking up the board with great ceremony.', '"Royal Darts Comp. Saturday arvo. Sixteen entries. I\'ve won it twice. You\'re not on the sheet. Why aren\'t you on the sheet?"'], opts: [
    { t: '"Put me down."', d: 'You\'ll play in the Saturday comp', go: 'b' },
    { t: '"I\'d embarrass myself."', check: { stat: 'Charm', dc: 55 }, pass: 'c', fail: 'd' },
    { t: '"Fifty bucks says I beat you."', go: 'e' }] },
  b: { say: '"Atta boy. Elbow up. Eyes on the treble."', do: c => { c.up(12); c.flags.compEntered = true; c.done(); }, end: true },
  c: { say: '"Everyone\'s embarrassed their first time, mate. Ask me about 2006." He writes your name down anyway.', do: c => { c.up(10); c.flags.compEntered = true; c.done(); }, end: true },
  d: { say: '"Suit yourself. More glory for me."', do: c => { c.up(-3); c.done(); }, end: true },
  e: { say: 'He laughs for a very long time. "You\'re on. Not tonight — Saturday. Bring your wallet."', do: c => { c.up(8); c.flags.compEntered = true; c.flags.kennoBet = true; c.done(); }, end: true },
} });
DLG.def('kenno2', { start: 'a', nodes: {
  a: { say: ['"See that bloke in the RSL jersey? Big Terry. Pinched my trophy off me in \'14 at the Surfie. Never forgave him."', '"I\'m not saying you should sabotage his arrows. I\'m saying a man should have a hobby."'], opts: [
    { t: '"We could challenge him properly."', go: 'b' },
    { t: '"Let it go, Kenno."', go: 'c' },
    { t: '"What did he do exactly?"', go: 'd' }] },
  b: { say: '"A challenge match at the RSL. Winner takes the trophy and the bragging rights. Oh, I like you."', do: c => { c.up(14); c.flags.kennoRival = true; c.done(); }, end: true },
  c: { say: '"Easy for you to say. Your trophy wasn\'t used as a doorstop."', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: '"He said — in front of everybody — that my grouping was \'agricultural\'." He is still hurt.', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.def('kenno3', { start: 'a', nodes: {
  a: { say: ['Kenno puts his case on the bar and opens it. Three arrows nest in worn red felt, flights frayed.', '"Forty years. Never lent them to anyone. They\'ve found a lot of trebles and a lot of dartboards\' edges."', '"You throw like a bloke who\'s listening. Take them."'], opts: [
    { t: '"I can\'t take your arrows, Kenno."', go: 'b' },
    { t: 'Take them. Carefully.', go: 'c' }] },
  b: { say: '"You can and you will. Rule is: they stay at the Royal. Whoever plays for the Royal, plays with those."', next: 'c' },
  c: { say: 'They\'re warm from his hand and heavier than they look.', do: c => { c.up(25); c.flags.dartTip = true; c.flags.luckyFlights = true; GW(c); c.log('🎯', "Kenno handed over his lucky flights"); c.done(); }, end: true },
} });
DLG.addArc('Kenno', [{ id: 'kenno1', title: 'The Royal darts comp', need: need(8, 0) }, { id: 'kenno2', title: 'Big Terry', need: need(25, 1, 1) }, { id: 'kenno3', title: 'Forty years of arrows', need: need(42, 2, 3) }]);

// ---------------------------------------------------------------- BEV
DLG.def('bev1', { start: 'a', nodes: {
  a: { say: ['Bev has a ledger open, a pencil behind her ear and a very flat expression.', '"Frank hasn\'t paid the cleaning bill since March. The roof fund\'s forty dollars. I do the books for free, love, and I\'m telling you: this pub could be saved by one good year."'], opts: [
    { t: '"What\'s the one good year look like?"', go: 'b' },
    { t: '"Can I help with the books?"', check: { stat: 'Charm', dc: 50 }, pass: 'c', fail: 'd' },
    { t: 'Put $20 in the roof fund jar.', cost: 20, go: 'e' }] },
  b: { say: '"Busy Thursdays. A proper Friday. Trivia that fills the lounge. And somebody sensible running the raffle." She taps the ledger. "Me. I can do that."', do: c => { c.up(8); c.done(); }, end: true },
  c: { say: 'She slides the ledger to you. You find $340 of double-billed beer deliveries. She stares at it. Then at you. "Oh, you are GOOD."', do: c => { c.up(16); STORY.addFund(40, 'You found $340 in double-billed deliveries'); GW(c); c.done(); }, end: true },
  d: { say: '"Thanks, love. I\'ve got it." She closes the ledger.', do: c => { c.up(-2); c.done(); }, end: true },
  e: { say: '"Bless you."', do: c => { c.up(10); STORY.addFund(20); c.done(); }, end: true },
} });
DLG.def('bev2', { start: 'a', nodes: {
  a: { say: ['"Frank\'s in the office with Clive Marsh\'s lawyer. He won\'t look at me. He\'s sixty-eight and tired and he\'s got an offer for four million."', '"If someone — a friendly face — took him a schooner and reminded him whose pub it was…"'], opts: [
    { t: 'Take Frank a schooner and talk to him.', d: 'Check: Charm', check: { stat: 'Charm', dc: 55 }, pass: 'b', fail: 'c' },
    { t: '"I\'m not going near that."', go: 'd' }] },
  b: { say: ['You find Frank staring at a photograph of the Royal\'s centenary. You don\'t say much. You don\'t need to.', 'He lets out a long breath. "Tell Bev I\'ll hold off on signing till the council\'s had a look."'], do: c => { c.up(18); c.flags.frankStalls = true; GW(c); c.done(); }, end: true },
  c: { say: 'Frank takes the schooner, thanks you politely, and doesn\'t change a single thing.', do: c => { c.up(4); c.done(); }, end: true },
  d: { say: '"No, love. Fair enough. I\'ll try Mick."', do: c => { c.up(-4); c.done(); }, end: true },
} });
DLG.def('bev3', { start: 'a', nodes: {
  a: { say: ['"Here\'s the thing. A community trust can bid for the freehold. The bank wants a guarantor to put his name behind the first hundred. Not hand it over, love — just have your name on the paper."', '"You\'d be on the hook if it all goes wrong. It\'s a lot to ask."'], opts: [
    { t: '"Put my name down."', d: 'A real risk: it costs $100 now', cost: 100, go: 'b' },
    { t: '"I can\'t. I\'m skint."', go: 'c' },
    { t: '"What if I just come to the meeting?"', go: 'd' }] },
  b: { say: 'She writes your name in careful capitals. "Wattle Creek Hotel Community Trust. Founding member number one."', do: c => { c.up(30); STORY.addFund(100, 'You put your name on the trust'); c.flags.guarantor = true; GW(c); GW(c); c.log('📜', 'Became founding member of the community trust'); Night.addRep(5); achieve('trust'); c.done(); }, end: true },
  c: { say: '"Course you are, love. No shame in it."', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: '"Oh, I\'ll take that. A warm body at that meeting is worth its weight."', do: c => { c.up(10); c.done(); }, end: true },
} });
DLG.addArc('Bev', [{ id: 'bev1', title: 'The books', need: need(8, 0) }, { id: 'bev2', title: 'Frank in the office', need: need(25, 1, 2) }, { id: 'bev3', title: 'The guarantor', need: need(42, 2, 4) }]);

// ---------------------------------------------------------------- SPUD
DLG.def('spud1', { start: 'a', nodes: {
  a: { say: ['Spud has his work boots up on the stool and his phone in his hand. He looks about twelve.', '"Boss says he\'s \'letting me go at the end of the month\'. I\'m two years into a four year apprenticeship. What do I do?"'], opts: [
    { t: '"Ask for it in writing. It\'s not legal otherwise."', go: 'b' },
    { t: '"Tell him to get stuffed. Find a better sparky."', go: 'c' },
    { t: '"Want me to come and have a chat with him?"', check: { stat: 'Nerve', dc: 50 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Writing. Right. That\'s smart. I\'ll ask in the morning."', do: c => { c.up(12); c.flags.spudWriting = true; c.done(); }, end: true },
  c: { say: '"I… yeah. Can\'t afford to, though."', do: c => { c.up(4); c.done(); }, end: true },
  d: { say: 'You do. You\'re polite and extremely patient. The boss goes grey. Spud keeps his job.', do: c => { c.up(25); GW(c); c.done(); }, end: true },
  e: { say: 'You go in too hard. The boss laughs at you. Spud looks at his boots. "…Cheers for trying."', do: c => { c.up(2); c.done(); }, end: true },
} });
DLG.def('spud2', { start: 'a', nodes: {
  a: { say: ['"I\'ve been practising. Eight ball, Saturday, a tenner. You and me." He\'s grinning but the grin\'s thin.', '"Honestly, I need the win. Rent."'], opts: [
    { t: 'Play him.', d: 'On the house table', go: 'b' },
    { t: 'Give him $10 and say you lost.', cost: 10, go: 'c' },
    { t: '"Rent comes from a job, mate. Not pool."', go: 'd' }] },
  b: { say: '"You beauty. I\'ll rack."', do: c => { c.up(8); startPool('Spud'); c.done(); }, end: true },
  c: { say: '"Oh. Oh, mate. You didn\'t have to…" He takes it. His ears go red.', do: c => { c.up(16); c.done(); }, end: true },
  d: { say: '"…Yeah." He looks at the table. "Yeah. That\'s fair."', do: c => { c.up(6); c.flags.spudNoGamble = true; c.done(); }, end: true },
} });
DLG.def('spud3', { start: 'a', nodes: {
  a: { say: ['Spud pulls a fistful of electrical tape and a multimeter out of his back pocket.', '"Right. The Royal\'s wiring is a crime. Bev says I can rewire the neon and the fuse board, on the cheap, as a favour. Needs a second pair of hands, one night. Interested?"'], opts: [
    { t: '"Count me in."', d: 'Spud\'s mates\' rates at the bar for you', go: 'b' },
    { t: '"I\'d probably electrocute us both."', go: 'c' }] },
  b: { say: 'You hold a torch for two hours. Nothing explodes. Afterwards Spud gets the boss to knock fifty cents off every round "for the sparkies".', do: c => { c.up(25); c.flags.spudMates = true; GW(c); c.log('⚡', 'Helped Spud rewire the neon'); c.done(); }, end: true },
  c: { say: '"Fair call. Probably."', do: c => { c.up(3); c.done(); }, end: true },
} });
DLG.addArc('Spud', [{ id: 'spud1', title: 'Skint sparky', need: need(8, 0) }, { id: 'spud2', title: 'Eight ball for rent', need: need(25, 1) }, { id: 'spud3', title: 'The rewire', need: need(42, 2, 3) }]);
ACH_LIST.push(['trust', 'Founding Member', 'Put your name on the community trust.']);

// ---------------------------------------------------------------- LOCALS AT THE OTHER PUBS
const LOCALS = {
  rsl: [
    { name: 'Digger Dave', look: { fem: false, skinI: 1, shirt: { tile: 'collar', c: 0x1a2a4a }, pants: { tile: 'cloth', c: 0x2a2a30 }, hair: 0xe8e8e8, style: 'short', scale: 0.96, girth: 1.0, beard: 'mo', glasses: false }, spot: s => s.kind === 'stool' && s.area === 'bar', bio: 'Vietnam. Two-up Tuesdays. Sixty-one years a member.' },
    { name: 'Lorraine', look: { fem: true, skinI: 0, shirt: { tile: 'collar', c: 0x2a5a8a }, pants: { tile: 'cloth', c: 0x1a1a22 }, hair: 0xcfa070, style: 'bob', scale: 0.95, girth: 1.0, glasses: true }, spot: s => s.kind === 'chair' && s.area === 'lounge', bio: 'Runs the Members\' Draw. Sees everything.' },
  ],
  dive: [
    { name: 'Tiny', look: { fem: false, skinI: 3, shirt: { tile: 'collar', c: 0x121212 }, pants: { tile: 'cloth', c: 0x15151a }, hair: 0x1a1210, style: 'short', scale: 1.08, girth: 1.4, beard: 'full', glasses: false }, spot: s => s.kind === 'stand' && s.area === 'bar', bio: "The bouncer. Six foot six. Won't hurt a fly. Will hurt a bloke who hurts a fly." },
    { name: 'Slick Rick', look: { fem: false, skinI: 2, shirt: { tile: 'hoops', c: 0x203060 }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x2a1a0a, style: 'mullet', girth: 0.9, beard: 'mo' }, spot: s => s.kind === 'pool' || (s.kind === 'stool' && s.area === 'bar'), bio: 'Pool hustler. Has never once lost a game he cared about.' },
  ],
};
// generic hub for a local: yarn (their arc), shout them a drink, ask about the place, a tip
function localHub(key, lore, tipLines) {
  DLG.def(key + '.hub', { start: 'a', nodes: {
    a: { say: c => c.mem.met ? choice(['Back again. Good.', 'Mate. Pull up a stool.', "Look who it is."]) : (c.mem.met = 1, `"${choice(['New face. Welcome.', "Haven't seen you in here before.", 'G\'day. First time?'])}"`), opts: [
      { t: 'Have a proper yarn', d: () => (DLG.nextBeat(key) || {}).title, do: c => { DLG.close(); DLG.playBeat(key, c.n); }, end: true, if: c => !!DLG.nextBeat(key) },
      { t: 'Have a yarn', go: 'chat', if: c => !DLG.nextBeat(key) },
      { t: c => `Shout ${c.name} a drink`, go: 'shout', cost: 6, if: c => !c.s.tonight['shout_' + key] },
      { t: 'Ask about the place', go: 'lore' },
      { t: 'Ask for a tip', go: 'tip', if: c => c.rel >= 15 },
      { t: 'See ya', end: true }] },
    chat: { say: () => `"${choice(tipLines.chat)}"`, do: c => { if (!c.s.tonight['talk_' + key]) { c.s.tonight['talk_' + key] = 1; c.up(5); c.mood_(3); } }, next: 'a' },
    shout: { say: () => `"${choice(['You beauty.', "Cheers, mate. I'll get the next one.", 'A gentleman and a scholar.'])}"`, do: c => { c.s.tonight['shout_' + key] = 1; c.up(10); Night.ev('shouted'); Night.log('🍺', `Shouted ${c.name} a drink`); }, next: 'a' },
    lore: { say: lore, next: 'a' },
    tip: { say: () => `"${choice(tipLines.tip)}"`, do: c => c.up(1), next: 'a' },
  } });
}
localHub('Digger Dave', '"Wattle Creek RSL opened in 1921. We\'ve got a courtesy bus, a meat raffle on Fridays and a plaque with the names of every local who went. I read it every Anzac Day. All of them."', {
  chat: ['Two-up Tuesdays used to be illegal except Anzac Day. We played anyway.', "The schnitty's the best in the shire. Don't tell the Royal I said so.", 'Marg runs the bistro like a drill sergeant. We love her.'],
  tip: ["Number four on the Thunder Empire's been paying better than the rest. Doesn't mean a thing, mind.", "Bet small and leave while you're up. That's the only system there is."]
});
localHub('Lorraine', '"I\'ve run the Members\' Draw since 1994. Every Friday: the badge draw, the raffle, the jackpot. If your name\'s in the drum and you\'re not here, it goes back in. Rules."', {
  chat: ["I know everyone's business and I'll take it to my grave. Mostly.", 'The club puts back more than the pokies take out. Ask me about the netball courts.', 'You look like you need a cuppa more than a pot.'],
  tip: ['Back the 4 horse in race 3. Not advice. I just like his name.', 'Never leave your handbag on the floor in this place. Not because of thieves. Because of the dogs.']
});
localHub('Tiny', '"Rusty Anchor\'s been here since \'64. Fishermen first, then wharfies, then everyone. I keep it quiet. I ask nicely first, twice, and then I\'m not so nice."', {
  chat: ["Don't mind the stickiness. It's heritage.", 'Last bloke who tried to take a stool outside brought it back himself, apologising.', 'You can leave your drink if you want a dance. I\'ll watch it.'],
  tip: ["If you get in a barney, don't swing first. I see everything.", "Cab rank's on the corner. Don't walk past the bait shop on your own."]
});
localHub('Slick Rick', '"Table\'s level, cues are straight, the felt\'s older than me. It\'s the best table in three towns, and I\'d tell you why but then you\'d be better."', {
  chat: ["I play a dollar a game and I never lose. Funny, that.", 'Everything\'s angles, mate. Pool. Life. The odds on the TAB. Angles.', 'I once played a bloke for his ute. I won the ute. Gave it back. Never touched pool again. For a week.'],
  tip: ["Don't play for money until you can run a rack. Never play for the rent.", "Machine three on the left's due. Joking. They're all random. Remember that."]
});
DLG.def('digger1', { start: 'a', nodes: {
  a: { say: ['Digger Dave rubs a thumb over a worn brass badge on his lapel.', '"Fifty-four years old when I got this. Can you believe that? I thought the Army was over for me. Then came the call, and then the jungle."', '"Do you know what I came home to? A bloke in a tie telling me to take my medals off on the bus."'], opts: [
    { t: '"I\'m sorry, Dave."', go: 'b' },
    { t: '"What did you do?"', go: 'c' },
    { t: 'Buy him a pot.', cost: 6, cat: 'spentDrinks', go: 'd' }] },
  b: { say: '"No need, son. It\'s the ones who didn\'t come home. I\'m just the one who did."', do: c => { c.up(10); c.done(); }, end: true },
  c: { say: '"Took them off, got on the bus, rang my mum from the pay phone, and cried my eyes out. First and last time. Then I joined the RSL."', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: 'He takes the pot, holds it up to the empty chair next to him, and drinks half of it in one go. "Ta."', do: c => { c.up(16); c.done(); }, end: true },
} });
DLG.def('digger2', { start: 'a', nodes: {
  a: { say: ['"Two-up. Tuesdays. Fifty cents a spin, kids play for lollies. It\'s the one day of the year it\'s legal and the one day I\'d like to beat Kev Jones. Will you spin for me?"', 'He holds out two pennies and a wooden kip.'], opts: [
    { t: 'Spin for him. "Heads!"', check: { stat: 'Luck', dc: 50, bonus: () => 0 }, pass: 'b', fail: 'c' },
    { t: '"I don\'t gamble, Dave."', go: 'd' }] },
  b: { say: 'Two heads. Dave whoops like a man half his age. "Beat Kev! BEAT KEV!" He buys you a schooner.', do: c => { c.up(18); c.cash(0); c.mood_(10); c.done(); }, end: true },
  c: { say: 'Tails. Dave shrugs. "Well, Kev\'s a prick anyway."', do: c => { c.up(10); c.done(); }, end: true },
  d: { say: '"Good on you. Smartest man in the room." He pockets the pennies.', do: c => { c.up(12); c.done(); }, end: true },
} });
DLG.addArc('Digger Dave', [{ id: 'digger1', title: 'The brass badge', need: need(8, 0) }, { id: 'digger2', title: 'Two-up', need: need(25, 1) }]);
DLG.def('lorraine1', { start: 'a', nodes: {
  a: { say: ['"Raffle\'s down on tickets. And I\'ll tell you why. There\'s a poker machine room out the back that doesn\'t need a raffle to fill it."', '"The club\'s paid for a minibus, a netball court and the footy club\'s lights with that money. I know what it costs, too. I see it every Friday."'], opts: [
    { t: '"It\'s complicated, Lorraine."', go: 'b' },
    { t: '"Maybe a cap on how much a person can lose a night?"', go: 'c' },
    { t: 'Buy ten tickets.', cost: 10, go: 'd' }] },
  b: { say: '"Isn\'t it just."', do: c => { c.up(8); c.done(); }, end: true },
  c: { say: '"Pre-commitment cards. Yes. Don\'t think I haven\'t pushed. The board says it\'s \'bad for the experience\'." She says the last words like they taste of metal.', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: 'She counts them out slowly. "Good on you. Doesn\'t fix the problem. But it\'s a start."', do: c => { c.up(12); Game.raffle.tickets += 5; c.done(); }, end: true },
} });
DLG.def('lorraine2', { start: 'a', nodes: {
  a: { say: ['"I\'m retiring in June. After thirty years. Nobody\'s lined up to run the Draw. Would you ever consider it?"'], opts: [
    { t: '"I\'ll help. A couple of Fridays."', go: 'b' },
    { t: '"I\'m only in town a week."', go: 'c' }] },
  b: { say: '"Ha! A couple of Fridays. That\'s how it starts. Here — hold the drum."', do: c => { c.up(16); c.standing(3, 'Held the drum at the Members\' Draw'); c.done(); }, end: true },
  c: { say: '"Course. Well. If you ever change your mind."', do: c => { c.up(4); c.done(); }, end: true },
} });
DLG.addArc('Lorraine', [{ id: 'lorraine1', title: 'The Members\' Draw', need: need(8, 0) }, { id: 'lorraine2', title: 'Who takes over', need: need(25, 1) }]);
DLG.def('tiny1', { start: 'a', nodes: {
  a: { say: ['"Everyone thinks I\'m paid to throw people out. I\'m paid to make sure nobody has to get thrown out. That\'s the job."', '"Last week I walked a lad home. Nineteen. Drank too much, couldn\'t stand. I put him in a cab and stood on the footpath till it turned the corner. That\'s the job."'], opts: [
    { t: '"That\'s a good job, Tiny."', go: 'b' },
    { t: '"Do you ever get scared?"', go: 'c' },
    { t: '"Could you walk me home tonight?"', go: 'd' }] },
  b: { say: '"It is." He nods. "It really is."', do: c => { c.up(12); c.done(); }, end: true },
  c: { say: '"Every night. Fear\'s what keeps you honest." He grins. "Don\'t tell anyone."', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: '"Of course. Just say when."', do: c => { c.up(10); c.flags.tinyWalk = true; c.done(); }, end: true },
} });
DLG.def('tiny2', { start: 'a', nodes: {
  a: { say: ['A bloke at the bar is getting loud. Tiny puts a hand flat on the bar, not looking at him.', '"Watch this. Lesson one." He steps over, says three quiet words, and the bloke deflates like a tyre. He comes back.', '"You try."'], opts: [
    { t: 'Try it on the next loud bloke.', check: { stat: 'Nerve', dc: 55 }, pass: 'b', fail: 'c' },
    { t: '"I\'ll leave that to the professionals."', go: 'd' }] },
  b: { say: 'You walk up. You don\'t quite know what you say. But the bloke apologises, shakes your hand and goes to the toilets. Tiny stares at you. "…Where did you learn that?"', do: c => { c.up(20); c.standing(2, 'Cooled things down at the Rusty Anchor'); c.done(); }, end: true },
  c: { say: 'The bloke laughs at you. Tiny walks over, says three words, and the pub is quiet again. "Practice."', do: c => { c.up(8); c.done(); }, end: true },
  d: { say: '"Probably wise."', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.addArc('Tiny', [{ id: 'tiny1', title: 'The job', need: need(8, 0) }, { id: 'tiny2', title: 'Lesson one', need: need(25, 1) }]);
DLG.def('rick1', { start: 'a', nodes: {
  a: { say: ['Rick racks without looking, a cigarette that isn\'t lit behind his ear.', '"Ten bucks a game. Winner stays on. You\'ll lose, but you\'ll learn."'], opts: [
    { t: '"Let\'s play."', go: 'b' },
    { t: '"What\'s your secret?"', go: 'c' },
    { t: '"Not for money."', go: 'd' }] },
  b: { say: '"Righto. Rack\'s yours."', do: c => { c.up(6); startPool('Slick Rick'); c.done(); }, end: true },
  c: { say: '"Never play a bloke who\'s better than you. And never show them you\'re better than they think. Boom. Secret."', do: c => { c.up(10); c.done(); }, end: true },
  d: { say: '"Smart. Now you\'re learning."', do: c => { c.up(10); c.done(); }, end: true },
} });
DLG.def('rick2', { start: 'a', nodes: {
  a: { say: ['Rick isn\'t playing. He\'s watching a bloke at the machines drop hundreds into a Big Red and he\'s got a thin look on his face.', '"Seen him in here every night for a month. Wife left in June. Won\'t talk to anyone. I\'d say something. Not my business."'], opts: [
    { t: '"Maybe somebody should."', go: 'b' },
    { t: '"Not my business either."', go: 'c' },
    { t: 'Go and talk to him.', check: { stat: 'Charm', dc: 55 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Maybe. Yeah." He puts the cue down. "I\'ll buy him a pot."', do: c => { c.up(10); c.done(); }, end: true },
  c: { say: '"Yeah." He goes back to the table. His shoulders are tight.', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: 'You sit next to the bloke at the machine for a while. He talks. You listen. At the end he feeds the machine his last five and doesn\'t buy more. He takes a card from your hand. Rick nods at you across the room.', do: c => { c.up(25); c.standing(4, 'Talked a bloke away from the pokies'); c.mood_(10); achieve('listener'); c.done(); }, end: true },
  e: { say: 'He waves you off. "Mind your business, mate." He doesn\'t say it unkindly.', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.addArc('Slick Rick', [{ id: 'rick1', title: 'Ten bucks a game', need: need(8, 0) }, { id: 'rick2', title: 'The bloke at the machine', need: need(25, 1) }]);
ACH_LIST.push(['listener', 'A Good Listener', 'Talk someone away from the pokies.']);

const VenueLocals = {
  spawn() {
    for (const id in LOCALS) for (const L of LOCALS[id]) {
      const n = mkNPC(Object.assign({ name: L.name, smoker: false, gambler: false }, L.look)); n.local = L.name; n.club = CLUBS[id] ? id : null;
      const sp = SPOTS.find(s => !s.occ && !(s.machine && s.machine.occupiedBy) && (s.club || null) === n.club && L.spot(s));
      if (sp) { claim(n, sp); n.pos.copy(sp.pos); n.ry = sp.ry; seatNPC(n); } else { n.pos.copy(n.club ? CLUBS[n.club].hub : NODES.P5); n.state = 'idle'; n.kind = 'stand'; }
      n.timer = 1e9; n.eventTalk = () => { Night.ev('talk', L.name); DLG.open(L.name + '.hub', n, { key: L.name, bio: L.bio }); };
    }
  },
};
