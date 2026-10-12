// =====================================================================
//  POKIE MATHS ENGINE  (pure logic — no rendering)
// =====================================================================
const BETS = [0.5, 1, 2, 3, 5, 7.5, 10];
const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
  [2,0,2,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,2,2,2,0],[2,0,0,0,2]];
let rtpMod = 1; // difficulty modifier
const JP_NAMES = ['MINI', 'MINOR', 'MAJOR', 'GRAND'];
const JP_SEED = { MINI: 15, MINOR: 75, MAJOR: 750, GRAND: 7500 };
const JP_INC = { MINI: 0.004, MINOR: 0.003, MAJOR: 0.002, GRAND: 0.001 }; // fraction of each bet

function wpick(items, weights) {
  let t = 0; for (const w of weights) t += w;
  let r = Math.random() * t;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function jpScaleFor(bet) { return 1; }
// jackpot pools are quoted for a $2 bet; the award scales with the bet played
function jpFactor(bet) { return Math.max(0.25, Math.min(2.5, bet / 2)); }

const ROYAL_PAYS = { '9': [0,0,0,4,10,40], '10': [0,0,0,4,10,40], 'J': [0,0,0,5,15,50], 'Q': [0,0,0,5,15,60], 'K': [0,0,0,8,20,80], 'A': [0,0,0,8,25,100] };

const GAMES = {
  outback: {
    id: 'outback', name: 'OUTBACK GOLD', sub: 'LINK', feature: 'holdspin', payScale: 5.5,
    theme: { bg1: '#3a0d05', bg2: '#b5410f', frame: '#f6c445', accent: '#ff7a18', glow: '#ffd36b', text: '#fff3cf' },
    tag: '6 OR MORE GOLD NUGGETS TRIGGER HOLD & SPIN',
    syms: ['9','10','J','Q','K','A','BOOM','KOALA','ULURU','ROO','WILD','COIN'],
    pays: Object.assign({}, ROYAL_PAYS, { BOOM: [0,0,0,12,40,150], KOALA: [0,0,0,15,50,200], ULURU: [0,0,0,20,75,300], ROO: [0,0,0,30,120,600], WILD: [0,0,0,30,120,800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, BOOM: 6, KOALA: 5, ULURU: 4.5, ROO: 3.5, WILD: 2.2, COIN: 11.3 },
    noWild: [0], wild: 'WILD', bonusSym: 'COIN'
  },
  dragon: {
    id: 'dragon', name: 'DRAGON PEARL', sub: 'FORTUNE', feature: 'freegames', payScale: 3.6,
    theme: { bg1: '#2a0208', bg2: '#9c0f1d', frame: '#f2c14e', accent: '#ff3045', glow: '#ffdf7e', text: '#fff1d6' },
    tag: '3 GOLD COINS = FREE GAMES · WILD MULTIPLIERS x2 x3 x5',
    syms: ['9','10','J','Q','K','A','LANTERN','ENVELOPE','KOI','INGOT','WILD','SCAT'],
    pays: Object.assign({}, ROYAL_PAYS, { LANTERN: [0,0,0,12,40,150], ENVELOPE: [0,0,0,15,50,200], KOI: [0,0,0,20,80,300], INGOT: [0,0,0,30,120,500], WILD: [0,0,0,30,120,750] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, LANTERN: 6, ENVELOPE: 5, KOI: 4.5, INGOT: 3.5, WILD: 2.4, SCAT: 2.2 },
    free: { WILD: 6 },
    noWild: [0], wild: 'WILD', scatter: 'SCAT', mystery: 1 / 650
  },
  sevens: {
    id: 'sevens', name: 'LUCKY 7s', sub: 'WHEEL', feature: 'wheel', payScale: 1,
    theme: { bg1: '#06103a', bg2: '#1b3fb8', frame: '#e8e8f8', accent: '#ff2b5a', glow: '#8fd3ff', text: '#ffffff' },
    tag: '3 BONUS WHEELS ON REELS 1, 3 & 5 SPIN THE JACKPOT WHEEL',
    syms: ['CHERRY','BELL','BAR','DIAMOND','SEVENB','SEVENR','WILD','BONUS'],
    pays: { CHERRY: [0,0,0,4,10,40], BELL: [0,0,0,6,15,60], BAR: [0,0,0,8,25,100], DIAMOND: [0,0,0,12,40,160], SEVENB: [0,0,0,20,80,300], SEVENR: [0,0,0,40,150,1000], WILD: [0,0,0,40,150,1000] },
    base: { CHERRY: 22, BELL: 18, BAR: 15, DIAMOND: 9, SEVENB: 6, SEVENR: 3.8, WILD: 2.3, BONUS: 4.9 },
    noWild: [0], wild: 'WILD', bonusSym: 'BONUS', bonusReels: [0, 2, 4]
  },
  reef: {
    id: 'reef', name: 'REEF RICHES', sub: 'TREASURE', feature: 'pick', payScale: 3.8,
    theme: { bg1: '#011f2e', bg2: '#05829a', frame: '#7ff3e4', accent: '#ffcf3d', glow: '#9ffcff', text: '#e9ffff' },
    tag: '3 TREASURE CHESTS = JACKPOT PICK · MATCH 3 TO WIN',
    syms: ['9','10','J','Q','K','A','SHELL','STAR','FISH','TURTLE','WILD','CHEST'],
    pays: Object.assign({}, ROYAL_PAYS, { SHELL: [0,0,0,12,40,150], STAR: [0,0,0,15,50,200], FISH: [0,0,0,20,80,300], TURTLE: [0,0,0,30,120,500], WILD: [0,0,0,30,120,750] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, SHELL: 6, STAR: 5, FISH: 4.5, TURTLE: 3.5, WILD: 2.4, CHEST: 1.9 },
    noWild: [0], wild: 'WILD', scatter: 'CHEST'
  }
};

// ---- LICENSED SKIN GAMES: the supplied machine screens, played with this engine --------------------
// Each one is a hold & spin "link" game (6+ fireballs start it, 3 respins, fill all 15 for the Grand). The art, symbols and layout come
// from assets/slots (see tools/slots/extract.py); the sym names here must match the keys in each skin's sprite atlas.
const ROYAL_W = { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9 };
const THEMED_W = [6, 5, 4.5, 3.5, 3, 2.6], THEMED_P = [[12, 40, 150], [15, 50, 200], [20, 75, 300], [30, 120, 600], [40, 150, 800], [50, 200, 1000]];
function skinGame(id, name, sub, royals, themed, theme, extra = {}) {
  const base = {}, pays = Object.assign({}, ROYAL_PAYS);
  royals.forEach(r => base[r] = ROYAL_W[r]);
  themed.forEach((t, i) => { base[t] = THEMED_W[i]; pays[t] = [0, 0, 0, ...THEMED_P[i]]; });
  const T = Object.values(base).reduce((a, b) => a + b, 0);   // fireballs and wilds keep the same share of the reel whatever the symbol count, so every game triggers hold & spin about as often
  base.WILD = 0.0289 * T; base.COIN = 0.1481 * T; pays.WILD = [0, 0, 0, 30, 120, 800];
  GAMES[id] = Object.assign({ id, name, sub, skin: true, feature: 'holdspin', link: true, payScale: 3.67, theme, tag: '6 OR MORE FIREBALLS START HOLD & SPIN · FILL ALL 15 FOR THE GRAND',
    syms: [...royals, ...themed, 'WILD', 'COIN'], pays, base, noWild: [0], wild: 'WILD', bonusSym: 'COIN' }, extra);
}
const TH_DL = { bg1: '#2a0408', bg2: '#8a1a10', frame: '#f6c445', accent: '#ff3a1a', glow: '#ffd36b', text: '#fff3cf' };
skinGame('am', 'AUTUMN MOON', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['PIPA', 'MOONCAKE', 'RABBIT', 'LADY'], Object.assign({}, TH_DL, { bg2: '#3a2a8a', led: [0.4, 0.5, 1] }));
skinGame('pm', 'PANDA MAGIC', 'DRAGON LINK', ['9', '10', 'J', 'K'], ['LOTUS', 'JUNK', 'LANTERN'], Object.assign({}, TH_DL, { bg2: '#2a8a2a', led: [1, 0.2, 0.2] }), { payScale: 2.42 });
skinGame('gc', 'GOLDEN CENTURY', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['WALL', 'SUN', 'CROWN', 'EMPEROR'], Object.assign({}, TH_DL, { bg2: '#d8780a', led: [1, 0.6, 0.1] }));
skinGame('hp', 'HAPPY & PROSPEROUS', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['LOTUS', 'JUNK', 'LANTERN', 'INGOT'], Object.assign({}, TH_DL, { led: [1, 0.35, 0.1] }));
skinGame('fm', 'FIRE MOUNTAIN', 'KONAMI', ['J', 'Q', 'K', 'A'], ['FAN', 'GOURD', 'CHEST', 'MALLET', 'INGOT', 'BULL'], { bg1: '#3a0505', bg2: '#d8301a', frame: '#ff8a1a', accent: '#ff4a1a', glow: '#ffd36b', text: '#fff3cf', led: [1, 0.25, 0.1] }, { payScale: 2.72 });
const TH_LDL = { bg1: '#04103a', bg2: '#1a4ad8', frame: '#4aa8ff', accent: '#3a8aff', glow: '#bfe0ff', text: '#fff', led: [0.15, 0.4, 1] };
for (const [id, nm] of [['ldl1', 'CHECKERED FLAG'], ['ldl2', 'CHICA BONITA'], ['ldl3', 'CORRIDA DE TOROS'], ['ldl4', 'KUNG FU MASTER']]) skinGame(id, nm, 'LIGHTNING DOLLAR LINK', ['9', '10', 'J', 'Q', 'K'], ['S2', 'S3', 'S1', 'LOGO'], TH_LDL);
const TH_TE = { bg1: '#1a0438', bg2: '#7a1ad8', frame: '#e07aff', accent: '#c03aff', glow: '#f0c0ff', text: '#fff', led: [0.8, 0.2, 1] };
for (const [id, nm] of [['te1', 'INCA DIAMONDS'], ['te2', 'MAGIC EMPEROR']]) skinGame(id, nm, 'THUNDER EMPIRE', ['9', '10', 'J', 'Q', 'K'], ['S2', 'S3', 'S1', 'LOGO'], TH_TE);

function reelWeights(game, reel, free) {
  const w = [];
  for (const s of game.syms) {
    let v = (free && game.free && game.free[s] != null) ? game.free[s] : game.base[s];
    if (s === game.wild && game.noWild.includes(reel)) v = 0;
    if (game.bonusReels && s === game.bonusSym && !game.bonusReels.includes(reel)) v = 0;
    w.push(v);
  }
  return w;
}

function coinValue(bet) {
  const js = jpScaleFor(bet);
  const r = Math.random();
  if (r < 0.0015 * js) return { jp: 'MAJOR' };
  if (r < 0.0015 * js + 0.008 * js) return { jp: 'MINOR' };
  if (r < 0.0015 * js + 0.008 * js + 0.03) return { jp: 'MINI' };
  const m = wpick([1, 2, 3, 5, 8, 10, 15, 25], [24, 26, 20, 12, 8, 5, 3, 2]);
  return { m };
}

// spin one grid. returns {grid, mults, coins}
function spinGrid(game, bet, free) {
  const grid = [], mults = [], coins = [];
  for (let r = 0; r < 5; r++) {
    const w = reelWeights(game, r, free);
    const col = [], mc = [], cc = [];
    for (let row = 0; row < 3; row++) {
      const s = wpick(game.syms, w);
      col.push(s);
      mc.push(free && s === game.wild && game.wildMults && r > 0 && r < 4 ? wpick([1, 2, 3, 5], game.wildMults) : 1);
      cc.push(s === 'COIN' ? coinValue(bet) : null);
    }
    grid.push(col); mults.push(mc); coins.push(cc);
  }
  return { grid, mults, coins };
}

function evalLines(game, res, bet, free) {
  const lineBet = bet / 25 * (game.payScale || 1) * rtpMod;
  const wins = [];
  let total = 0;
  for (let li = 0; li < LINES.length; li++) {
    const L = LINES[li];
    const seq = L.map((row, r) => res.grid[r][row]);
    const ms = L.map((row, r) => res.mults[r][row]);
    // wild-only run
    let wn = 0; while (wn < 5 && seq[wn] === game.wild) wn++;
    let best = null;
    if (wn >= 3 && game.pays[game.wild]) {
      let m = 1; for (let i = 0; i < wn; i++) m *= ms[i];
      best = { sym: game.wild, n: wn, pay: game.pays[game.wild][wn] * lineBet * m };
    }
    const first = seq.find(s => s !== game.wild);
    if (first && game.pays[first]) {
      let n = 0, m = 1;
      while (n < 5 && (seq[n] === first || seq[n] === game.wild)) { m *= ms[n]; n++; }
      if (n >= 3) {
        const pay = game.pays[first][n] * lineBet * m;
        if (!best || pay > best.pay) best = { sym: first, n, pay };
      }
    }
    if (best && best.pay > 0) {
      if (free && game.freeMult) best.pay *= game.freeMult;   // Queen of the Nile: every free game win is tripled
      best.line = li; best.mult = 1;
      wins.push(best); total += best.pay;
    }
  }
  return { wins, total };
}

function countSym(res, s) {
  let n = 0; const pos = [];
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) if (res.grid[r][row] === s) { n++; pos.push([r, row]); }
  return { n, pos };
}

// ---- features (pure simulations; the renderer replays these step lists) ----
function playHoldSpin(game, bet, res) {
  const cells = [];
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) cells.push(res.coins[r][row]);
  const steps = []; // each step: array of {idx, val}
  let respins = 3;
  while (respins > 0) {
    respins--;
    const landed = [];
    for (let i = 0; i < 15; i++) if (!cells[i] && Math.random() < 0.055) { const v = coinValue(bet); cells[i] = v; landed.push({ idx: i, val: v }); }
    if (landed.length) respins = 3;
    steps.push({ landed, respins });
    if (cells.every(c => c)) break;
  }
  let credit = 0; const jps = [];
  for (const c of cells) { if (!c) continue; if (c.jp) jps.push(c.jp); else credit += c.m * bet; }
  const full = cells.every(c => c);
  if (full) jps.push('GRAND');
  return { cells, steps, credit, jps, full };
}

const WHEEL_SEGS = [
  { m: 10 }, { jp: 'MINI' }, { m: 20 }, { m: 8 }, { jp: 'MINOR' }, { m: 15 }, { m: 50 }, { m: 10 },
  { jp: 'MAJOR' }, { m: 25 }, { m: 8 }, { jp: 'MINI' }, { m: 100 }, { m: 12 }, { jp: 'GRAND' }, { m: 30 }];
function wheelWeights(bet) {
  const js = jpScaleFor(bet);
  return WHEEL_SEGS.map(s => s.jp ? ({ MINI: 7, MINOR: 4 * js, MAJOR: 0.5 * js, GRAND: 0.06 * js })[s.jp] : ({ 8: 14, 10: 13, 12: 10, 15: 9, 20: 7, 25: 5, 30: 4, 50: 2.5, 100: 0.8 })[s.m]);
}
function playWheel(bet) {
  const idx = wpick(WHEEL_SEGS.map((_, i) => i), wheelWeights(bet));
  const seg = WHEEL_SEGS[idx];
  return { idx, seg, credit: seg.m ? seg.m * bet : 0, jps: seg.jp ? [seg.jp] : [] };
}

function playPick(bet, mystery) {
  const js = jpScaleFor(bet);
  const win = mystery
    ? wpick(JP_NAMES, [55, 33, 10 * js, 1.2 * js])
    : wpick(JP_NAMES, [70, 24, 5 * js, 0.6 * js]);
  // build reveal sequence: winner appears 3 times, others at most 2, winner's 3rd is last
  const counts = { MINI: 0, MINOR: 0, MAJOR: 0, GRAND: 0 };
  const seq = [];
  const others = JP_NAMES.filter(j => j !== win);
  const decoys = Math.floor(Math.random() * 6);
  const pool = [];
  for (const o of others) { pool.push(o, o); }
  pool.sort(() => Math.random() - 0.5);
  const dec = pool.slice(0, decoys);
  const body = [win, win, ...dec].sort(() => Math.random() - 0.5);
  for (const b of body) { seq.push(b); counts[b]++; }
  seq.push(win);
  // fill the rest (unrevealed at end) with a plausible board
  const rest = [];
  for (const j of JP_NAMES) { const lim = j === win ? 3 : 2; for (let k = counts[j] + (j === win ? 1 : 0); k < lim; k++) rest.push(j); }
  while (seq.length + rest.length < 12) rest.push(others[Math.floor(Math.random() * others.length)]);
  rest.sort(() => Math.random() - 0.5);
  return { win, seq, rest: rest.slice(0, 12 - seq.length), jps: [win], credit: mystery ? 0 : bet * wpick([5, 10, 15, 20, 30], [30, 30, 20, 12, 8]) };
}

// Full spin incl. features — used by NPC machines + RTP sim. Player machine uses
// the same pieces but replays features visually.
function fullSpin(game, bet, jpValues, free) {
  const res = spinGrid(game, bet, free);
  const lw = evalLines(game, res, bet, free);
  const out = { res, lw, win: lw.total, feature: null };
  if (game.feature === 'holdspin') {
    const c = countSym(res, 'COIN');
    if (c.n >= 6) { const f = playHoldSpin(game, bet, res); out.feature = { type: 'holdspin', f }; out.win += f.credit + f.jps.reduce((a, j) => a + jpValues[j] * jpFactor(bet), 0); }
  } else if (game.feature === 'freegames') {
    const c = countSym(res, game.scatter);
    if (!free && c.n >= 3) {
      out.win += bet * [0, 0, 0, 2, 10, 50][Math.min(5, c.n)];
      let left = [0, 0, 0, 8, 12, 20][Math.min(5, c.n)], fw = 0, played = 0;
      while (left > 0 && played < 200) { left--; played++; const s = fullSpin(game, bet, jpValues, true); fw += s.win; if (countSym(s.res, game.scatter).n >= 3) left += 5; }
      out.feature = { type: 'freegames', games: played, win: fw }; out.win += fw;
    } else if (free && c.n >= 2) {
      out.win += c.n >= 3 ? bet * 2 : 0;
    }
    if (!free && !out.feature && Math.random() < game.mystery * jpScaleFor(bet)) {
      const p = playPick(bet, true); out.feature = { type: 'pick', f: p }; out.win += jpValues[p.win] * jpFactor(bet);
    }
  } else if (game.feature === 'wheel') {
    const c = countSym(res, 'BONUS');
    if (c.n >= 3) { const f = playWheel(bet); out.feature = { type: 'wheel', f }; out.win += f.credit + f.jps.reduce((a, j) => a + jpValues[j] * jpFactor(bet), 0); }
  } else if (game.feature === 'pick') {
    const c = countSym(res, game.scatter);
    if (c.n >= 3) { out.win += bet * [0, 0, 0, 3, 15, 60][Math.min(5, c.n)]; const f = playPick(bet, false); out.feature = { type: 'pick', f }; out.win += jpValues[f.win] * jpFactor(bet) + f.credit; }
  }
  return out;
}
