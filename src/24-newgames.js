
// =====================================================================
//  CLUB FLOOR FAVOURITES: the newer titles you find on an RSL club floor.
//  Lightning Link (Magic Pearl, Happy Lantern), Dragon Train, Cash Express, Buffalo Gold, Timber Wolf.
//  Original art over the same engine; these live at Wattle Creek RSL (see VENUES.rsl.machines).
// =====================================================================
const LINK_TAG = '6 OR MORE {C} START HOLD & SPIN · FILL ALL 15 FOR THE GRAND';
Object.assign(GAMES, {
  llmp: {
    id: 'llmp', name: 'MAGIC PEARL', sub: 'LIGHTNING LINK', feature: 'holdspin', link: true, payScale: 8.56, coinArt: 'PEARL',
    theme: { bg1: '#0a0630', bg2: '#2a7ab8', frame: '#c8e8ff', accent: '#7a4ae8', glow: '#bff4ff', text: '#eafcff', scene: 'ocean' },
    tag: LINK_TAG.replace('{C}', 'PEARLS'), syms: ['9', '10', 'J', 'Q', 'K', 'A', 'SHELL', 'STAR', 'FISH', 'TURTLE', 'WILD', 'COIN'],
    pays: Object.assign({}, ROYAL_PAYS, { SHELL: [0, 0, 0, 12, 40, 150], STAR: [0, 0, 0, 15, 50, 200], FISH: [0, 0, 0, 20, 75, 300], TURTLE: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, SHELL: 6, STAR: 5, FISH: 4.5, TURTLE: 3.5, WILD: 2.2, COIN: 11.3 }, noWild: [0], wild: 'WILD', bonusSym: 'COIN',
    wildArt(x, g) { wildPlate(x, g, ['#7a4ae8', '#0a0630']); x.fillStyle = rg(x, -8, -10, 3, 34, ['#ffffff', '#f0e8ff', '#b8b0e8']); x.beginPath(); x.arc(0, -4, 30, 0, 7); x.fill(); wildWord(x, g, 30); }
  },
  llhl: {
    id: 'llhl', name: 'HAPPY LANTERN', sub: 'LIGHTNING LINK', feature: 'holdspin', link: true, payScale: 6.96, coinArt: 'LANTERNCOIN',
    theme: { bg1: '#2a0004', bg2: '#d8201a', frame: '#ffd84a', accent: '#ff7a10', glow: '#fff0a0', text: '#fff3d0', scene: 'lanterns' },
    tag: LINK_TAG.replace('{C}', 'LANTERNS'), syms: ['9', '10', 'J', 'Q', 'K', 'A', 'ENVELOPE', 'KOI', 'INGOT', 'LANTERN', 'WILD', 'COIN'],
    pays: Object.assign({}, ROYAL_PAYS, { ENVELOPE: [0, 0, 0, 12, 40, 150], KOI: [0, 0, 0, 15, 50, 200], INGOT: [0, 0, 0, 20, 75, 300], LANTERN: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, ENVELOPE: 6, KOI: 5, INGOT: 4.5, LANTERN: 3.5, WILD: 2.2, COIN: 11.3 }, noWild: [0], wild: 'WILD', bonusSym: 'COIN',
    wildArt(x, g) { wildPlate(x, g, ['#ff3a2a', '#4a0004']); ART.LANTERNCOIN(x, g, 0.62); wildWord(x, g, 34); }
  },
  dtrain: {
    id: 'dtrain', name: 'DRAGON TRAIN', sub: 'GRAND STAR', feature: 'holdspin', link: true, payScale: 4.03, coinArt: 'TRAINCOIN',
    theme: { bg1: '#06200a', bg2: '#1a8a3a', frame: '#ffd84a', accent: '#e8301a', glow: '#d8ffb0', text: '#f4ffe8', scene: 'rails' },
    tag: LINK_TAG.replace('{C}', 'DRAGON PEARLS'), syms: ['9', '10', 'J', 'Q', 'K', 'A', 'FAN', 'VASE', 'JUNK', 'PANDA', 'WILD', 'COIN'],
    pays: Object.assign({}, ROYAL_PAYS, { FAN: [0, 0, 0, 12, 40, 150], VASE: [0, 0, 0, 15, 50, 200], JUNK: [0, 0, 0, 20, 75, 300], PANDA: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, FAN: 6, VASE: 5, JUNK: 4.5, PANDA: 3.5, WILD: 2.2, COIN: 11.3 }, noWild: [0], wild: 'WILD', bonusSym: 'COIN',
    wildArt(x, g) { wildPlate(x, g, ['#1a8a3a', '#06200a']); drawLoco(x, 0, -4, 0.62); wildWord(x, g, 34); }
  },
  cashx: {
    id: 'cashx', name: 'CASH EXPRESS', sub: 'LUXURY LINE', feature: 'holdspin', link: true, payScale: 1.35, coinArt: 'TRAINCOIN',
    theme: { bg1: '#0a0a18', bg2: '#5a2a8a', frame: '#e8e8f8', accent: '#d8a020', glow: '#ffe9a0', text: '#ffffff', scene: 'rails' },
    tag: LINK_TAG.replace('{C}', 'CASH TRAINS'), syms: ['CHERRY', 'BELL', 'BAR', 'DIAMOND', 'SEVENB', 'SEVENR', 'WILD', 'COIN'],
    pays: { CHERRY: [0, 0, 0, 4, 10, 40], BELL: [0, 0, 0, 6, 15, 60], BAR: [0, 0, 0, 8, 25, 100], DIAMOND: [0, 0, 0, 12, 40, 160], SEVENB: [0, 0, 0, 20, 80, 300], SEVENR: [0, 0, 0, 40, 150, 1000], WILD: [0, 0, 0, 40, 150, 1000] },
    base: { CHERRY: 22, BELL: 18, BAR: 15, DIAMOND: 9, SEVENB: 6, SEVENR: 3.8, WILD: 2.3, COIN: 9.5 }, noWild: [0], wild: 'WILD', bonusSym: 'COIN',
    wildArt(x, g) { wildPlate(x, g, ['#5a2a8a', '#0a0a18']); drawLoco(x, 0, -4, 0.62, '#d8a020'); wildWord(x, g, 34); }
  },
  bgold: {
    id: 'bgold', name: 'BUFFALO GOLD', sub: 'COLLECTION', feature: 'freegames', payScale: 4.54, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#1a0a02', bg2: '#c8901a', frame: '#fff0a0', accent: '#e8b020', glow: '#fff6c0', text: '#fff8e0', scene: 'prairie' },
    tag: '3 GOLD COINS = FREE GAMES · GOLD WILDS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'COUGAR', 'WOLF', 'EAGLE', 'BUFFALO', 'WILD', 'PAW'],
    pays: Object.assign({}, ROYAL_PAYS, { COUGAR: [0, 0, 0, 12, 40, 150], WOLF: [0, 0, 0, 15, 50, 200], EAGLE: [0, 0, 0, 20, 75, 300], BUFFALO: [0, 0, 0, 40, 150, 800], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, COUGAR: 6, WOLF: 5, EAGLE: 4.5, BUFFALO: 3.2, WILD: 2.4, PAW: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'PAW',
    wildArt(x, g) { wildPlate(x, g, ['#ffd84a', '#7a4a04']); x.fillStyle = '#3a1a04'; x.beginPath(); x.ellipse(0, -2, 34, 26, 0, 0, 7); x.fill(); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 26, -16); x.quadraticCurveTo(s * 50, -30, s * 44, -46); x.lineWidth = 7; x.strokeStyle = '#f4ead0'; x.stroke(); } wildWord(x, g, 34); }
  },
  twolf: {
    id: 'twolf', name: 'TIMBER WOLF', sub: 'DELUXE', feature: 'freegames', payScale: 4.54, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#040a1a', bg2: '#2a4a7a', frame: '#d8e8ff', accent: '#4a8ad8', glow: '#cfe4ff', text: '#eef6ff', scene: 'moon' },
    tag: '3 MOONS = FREE GAMES · HOWLING WILDS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'EAGLE', 'COUGAR', 'BUFFALO', 'WOLF', 'WILD', 'MOONSCAT'],
    pays: Object.assign({}, ROYAL_PAYS, { EAGLE: [0, 0, 0, 12, 40, 150], COUGAR: [0, 0, 0, 15, 50, 200], BUFFALO: [0, 0, 0, 20, 75, 300], WOLF: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, EAGLE: 6, COUGAR: 5, BUFFALO: 4.5, WOLF: 3.5, WILD: 2.4, MOONSCAT: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'MOONSCAT',
    wildArt(x, g) { wildPlate(x, g, ['#2a4a7a', '#040a1a']); x.fillStyle = rg(x, 0, -4, 4, 34, ['#ffffff', '#dfe8ff', '#8aa0d0']); x.beginPath(); x.arc(0, -4, 30, 0, 7); x.fill(); x.fillStyle = '#0a1020'; x.beginPath(); x.moveTo(-26, 26); x.lineTo(-12, -6); x.lineTo(-4, 2); x.lineTo(4, -18); x.lineTo(10, 4); x.lineTo(26, 26); x.fill(); wildWord(x, g, 34); }
  },
});
function wildPlate(x, g, cols) { rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, cols); x.fill(); x.lineWidth = 7; x.strokeStyle = g.theme.frame; x.stroke(); }
function wildWord(x, g, y) { outlineText(x, 'WILD', 0, y, 30, lg(x, 0, y - 16, 0, y + 14, ['#fffbe0', g.theme.glow, g.theme.accent]), '#1a0802', 7); }
// a little steam engine, side on
function drawLoco(x, cx, cy, s, body = '#c8201a') {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = body; rr(x, -58, -14, 84, 40, 8); x.fill(); x.fillStyle = '#1a1a1a'; rr(x, 14, -44, 40, 70, 6); x.fill();
  x.fillStyle = '#ffe27a'; x.fillRect(22, -36, 24, 18); x.fillStyle = '#2a2a2a'; x.fillRect(-46, -40, 14, 28); x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(-60, 6, 8, 0, 7); x.fill();
  x.fillStyle = '#111'; for (const wx of [-40, -12, 30]) { x.beginPath(); x.arc(wx, 32, 13, 0, 7); x.fill(); x.strokeStyle = '#d8a020'; x.lineWidth = 3; x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.75)'; for (const [px, py, r] of [[-40, -52, 10], [-30, -64, 13], [-14, -72, 15]]) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  x.restore();
}
// each link game's own bonus coin
const _coinArt = ART.COIN; ART.COIN = (x, g) => g && g.coinArt && ART[g.coinArt] ? ART[g.coinArt](x, g) : _coinArt(x, g);
Object.assign(ART, {
  PEARL(x) {
    x.fillStyle = 'rgba(160,120,255,.35)'; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.fill();
    x.fillStyle = '#e8b8d8'; x.beginPath(); x.ellipse(0, 26, 62, 30, 0, 0, Math.PI); x.fill(); x.lineWidth = 4; x.strokeStyle = '#7a3a6a'; x.stroke();
    x.fillStyle = rg(x, -14, -16, 4, 50, ['#ffffff', '#f4eeff', '#c8c0e8', '#8a80b8']); x.beginPath(); x.arc(0, 0, 46, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(-16, -18, 12, 7, -0.6, 0, 7); x.fill();
  },
  LANTERNCOIN(x, g, s = 1) {
    x.save(); x.scale(s, s);
    x.fillStyle = 'rgba(255,180,60,.3)'; x.beginPath(); x.arc(0, 0, 66, 0, 7); x.fill();
    x.fillStyle = '#ffd84a'; x.fillRect(-20, -62, 40, 12); x.fillRect(-20, 50, 40, 12);
    x.fillStyle = rg(x, -10, -10, 4, 60, ['#ffe0a0', '#ff4a2a', '#a00a0a']); x.beginPath(); x.ellipse(0, 0, 54, 50, 0, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffd84a'; x.stroke();
    x.strokeStyle = 'rgba(255,216,74,.7)'; x.lineWidth = 3; for (const k of [-0.5, 0, 0.5]) { x.beginPath(); x.ellipse(0, 0, 54 * Math.abs(k) + 2, 50, 0, 0, 7); x.stroke(); }
    x.strokeStyle = '#ffd84a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 62); x.lineTo(0, 76); x.stroke();
    x.restore();
  },
  TRAINCOIN(x, g) {
    x.fillStyle = rg(x, -14, -16, 4, 60, ['#fffbe0', '#ffe27a', '#e0a010', '#7a4a04']); x.beginPath(); x.arc(0, 0, 56, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#5a3404'; x.stroke();
    x.lineWidth = 2; x.strokeStyle = 'rgba(90,52,4,.6)'; x.beginPath(); x.arc(0, 0, 46, 0, 7); x.stroke();
    drawLoco(x, 2, 4, 0.42, g && g.id === 'cashx' ? '#5a2a8a' : '#1a8a3a');
  },
  MOONSCAT(x) {
    x.fillStyle = rg(x, 0, 0, 4, 66, ['#ffffff', '#e0e8ff', '#5a7ab8', '#0a1430']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#cfe4ff'; x.stroke();
    x.fillStyle = 'rgba(120,140,190,.45)'; for (const [cx, cy, r] of [[-18, -14, 12], [16, 10, 16], [-6, 24, 8]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    outlineText(x, 'BONUS', 0, 4, 26, '#fff', '#0a1430', 6);
  },
});
// backdrops for the club games
const _drawScene2 = drawScene;
drawScene = function (x, scene, t) {
  if (scene === 'ocean') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#0a0630', '#1a4a9a', '#2ab0c8']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = 'rgba(200,240,255,.12)'; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(i * 160 - 40, 0); x.lineTo(i * 160 + 40, 0); x.lineTo(i * 160 + 140, SH); x.lineTo(i * 160 + 60, SH); x.fill(); }
    x.strokeStyle = 'rgba(220,250,255,.5)'; x.lineWidth = 2; for (let i = 0; i < 26; i++) { const bx = (i * 97) % SW, by = SH - ((t * 40 + i * 53) % SH); x.beginPath(); x.arc(bx, by, 3 + (i % 4) * 2, 0, 7); x.stroke(); }
  } else if (scene === 'lanterns') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#1a0004', '#7a0a0a', '#e8501a']); x.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 9; i++) { const lx = 60 + i * 115, ly = 90 + (i % 3) * 60 + Math.sin(t * 1.2 + i) * 8; x.save(); x.translate(lx, ly); x.globalAlpha = 0.55; ART.LANTERNCOIN(x, null, 0.55); x.restore(); }
    x.globalAlpha = 1;
  } else if (scene === 'rails') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#0a0a1a', '#3a2a5a', '#e8904a']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = 'rgba(255,230,160,.9)'; x.beginPath(); x.arc(780, 330, 60, Math.PI, 0); x.fill();
    x.fillStyle = '#1a1020'; x.fillRect(0, 440, SW, 330);
    x.strokeStyle = '#8a7a6a'; x.lineWidth = 6; for (const y of [470, 500]) { x.beginPath(); x.moveTo(0, y); x.lineTo(SW, y); x.stroke(); }
    x.fillStyle = '#4a3a2a'; for (let i = 0; i < 24; i++) x.fillRect(((i * 48 - t * 120) % (SW + 48) + SW + 48) % (SW + 48) - 24, 462, 10, 46);
  } else _drawScene2(x, scene, t);
};
