
// =====================================================================
//  PUB CLASSICS: the machines that have been in Aussie pubs and clubs for decades.
//  Queen of the Nile (the free-games-times-three original), Big Red, Buffalo, plus 5 Dragons /
//  Where's the Gold re-titles of the house games.  Original art, same engine.
// =====================================================================
Object.assign(GAMES, {
  qotn: {
    id: 'qotn', name: 'QUEEN OF THE NILE', sub: 'CLASSIC', feature: 'freegames', payScale: 4.7, freeMult: 3,
    theme: { bg1: '#06143a', bg2: '#1a5aa8', frame: '#f6c445', accent: '#e8a020', glow: '#ffe9a0', text: '#fff3cf', scene: 'nile' },
    tag: '3 PYRAMIDS = FREE GAMES · EVERY FREE GAME WIN PAYS TRIPLE', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'ANKH', 'SCARAB', 'EYE', 'PHARAOH', 'WILD', 'PYRAMID'],
    pays: Object.assign({}, ROYAL_PAYS, { ANKH: [0, 0, 0, 12, 40, 150], SCARAB: [0, 0, 0, 15, 50, 200], EYE: [0, 0, 0, 20, 75, 300], PHARAOH: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, ANKH: 6, SCARAB: 5, EYE: 4.5, PHARAOH: 3.5, WILD: 2.4, PYRAMID: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'PYRAMID',
    wildArt(x, g) { // Cleopatra
      rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, ['#1a5aa8', '#06143a']); x.fill(); x.lineWidth = 7; x.strokeStyle = g.theme.frame; x.stroke();
      x.fillStyle = '#1a1a22'; x.beginPath(); x.moveTo(-30, -30); x.lineTo(30, -30); x.lineTo(38, 40); x.lineTo(-38, 40); x.closePath(); x.fill();
      x.fillStyle = '#e8b890'; x.beginPath(); x.ellipse(0, -2, 20, 26, 0, 0, 7); x.fill();
      x.fillStyle = lg(x, 0, -40, 0, -20, ['#ffe27a', '#c08a10']); x.fillRect(-32, -36, 64, 12);
      x.fillStyle = '#0a1a3a'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 8, -4, 5, 3, 0, 0, 7); x.fill(); } x.fillStyle = '#c0282d'; x.beginPath(); x.ellipse(0, 12, 7, 3, 0, 0, 7); x.fill();
      outlineText(x, 'WILD', 0, 36, 30, lg(x, 0, 20, 0, 44, ['#fffbe0', g.theme.glow, g.theme.accent]), '#1a0802', 7);
    }
  },
  bigred: {
    id: 'bigred', name: 'BIG RED', sub: 'CLASSIC', feature: 'freegames', payScale: 4.5, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#3a0d05', bg2: '#c8421a', frame: '#f6c445', accent: '#ff7a18', glow: '#ffd36b', text: '#fff3cf', scene: 'outback' },
    tag: '3 ULURU = FREE GAMES · WILD ROOS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'BOOM', 'KOALA', 'EMU', 'ROO', 'WILD', 'ULURU'],
    pays: Object.assign({}, ROYAL_PAYS, { BOOM: [0, 0, 0, 12, 40, 150], KOALA: [0, 0, 0, 15, 50, 200], EMU: [0, 0, 0, 20, 75, 300], ROO: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, BOOM: 6, KOALA: 5, EMU: 4.5, ROO: 3.5, WILD: 2.4, ULURU: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'ULURU'
  },
  buffalo: {
    id: 'buffalo', name: 'BUFFALO', sub: 'GOLD', feature: 'freegames', payScale: 4.55, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#2a0a14', bg2: '#d8601a', frame: '#e8c060', accent: '#c8301a', glow: '#ffd890', text: '#fff0d8', scene: 'prairie' },
    tag: '3 GOLD PAWS = FREE GAMES · WILD SUNSETS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'COUGAR', 'WOLF', 'EAGLE', 'BUFFALO', 'WILD', 'PAW'],
    pays: Object.assign({}, ROYAL_PAYS, { COUGAR: [0, 0, 0, 12, 40, 150], WOLF: [0, 0, 0, 15, 50, 200], EAGLE: [0, 0, 0, 20, 75, 300], BUFFALO: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, COUGAR: 6, WOLF: 5, EAGLE: 4.5, BUFFALO: 3.5, WILD: 2.4, PAW: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'PAW',
    wildArt(x, g) {
      rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, ['#ff9a3a', '#7a1a0a']); x.fill(); x.lineWidth = 7; x.strokeStyle = g.theme.frame; x.stroke();
      x.fillStyle = rg(x, 0, 14, 4, 52, ['#fff6a0', '#ffb02a', '#e0501a']); x.beginPath(); x.arc(0, 14, 44, Math.PI, 0); x.fill();
      x.fillStyle = '#3a0a10'; x.beginPath(); x.moveTo(-78, 30); x.lineTo(-40, 6); x.lineTo(-20, 22); x.lineTo(10, 0); x.lineTo(40, 24); x.lineTo(78, 8); x.lineTo(78, 48); x.lineTo(-78, 48); x.fill();
      outlineText(x, 'WILD', 0, -18, 38, lg(x, 0, -34, 0, -2, ['#fffbe0', g.theme.glow, g.theme.accent]), '#1a0802', 8);
    }
  }
});
// the house games under their pub names
Object.assign(GAMES.dragon, { name: '5 DRAGONS', sub: 'CLASSIC', wildMults: [40, 35, 18, 7], payScale: 3.75 });
Object.assign(GAMES.outback, { name: "WHERE'S THE GOLD", sub: 'LINK', payScale: 6.1 });

// wild art can be game-specific
const _wildArt = ART.WILD; ART.WILD = (x, g) => g.wildArt ? g.wildArt(x, g) : _wildArt(x, g);

Object.assign(ART, {
  ANKH(x) {
    x.fillStyle = lg(x, 0, -60, 0, 60, ['#fff0a0', '#e8b020', '#8a5a08']); x.strokeStyle = '#2a1604'; x.lineWidth = 5;
    x.beginPath(); x.ellipse(0, -30, 20, 28, 0, 0, 7); x.ellipse(0, -30, 9, 17, 0, 0, 7, true); x.fill('evenodd'); x.stroke();
    rr(x, -9, -4, 18, 70, 5); x.fill(); x.stroke(); rr(x, -40, 6, 80, 17, 6); x.fill(); x.stroke();
  },
  SCARAB(x) {
    x.fillStyle = rg(x, 0, 0, 4, 70, ['#4ad8d0', '#1a8a9a', '#0a3a5a']); x.beginPath(); x.ellipse(0, 6, 42, 52, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#06203a'; x.stroke();
    x.strokeStyle = '#06203a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -46); x.lineTo(0, 58); x.stroke();
    x.fillStyle = '#e8b020'; x.beginPath(); x.ellipse(0, -46, 20, 12, 0, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#e8b020'; x.lineWidth = 5; for (const s of [-1, 1]) for (const dy of [-18, 8, 34]) { x.beginPath(); x.moveTo(s * 40, dy); x.lineTo(s * 62, dy + 10); x.stroke(); }
  },
  EYE(x) {
    x.fillStyle = '#f4f0e0'; x.strokeStyle = '#06203a'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(-64, 0); x.quadraticCurveTo(0, -56, 64, 0); x.quadraticCurveTo(0, 44, -64, 0); x.fill(); x.stroke();
    x.fillStyle = rg(x, 0, 0, 2, 22, ['#101010', '#1a4a9a', '#e8b020']); x.beginPath(); x.arc(0, -2, 20, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(6, -10, 5, 0, 7); x.fill();
    x.strokeStyle = '#e8b020'; x.lineWidth = 6; x.beginPath(); x.moveTo(-60, 4); x.quadraticCurveTo(-70, 30, -40, 56); x.stroke(); x.beginPath(); x.moveTo(20, 24); x.quadraticCurveTo(40, 40, 36, 62); x.stroke();
  },
  PHARAOH(x) {
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#2a60c8', '#f6d040', '#2a60c8', '#f6d040']);
    x.beginPath(); x.moveTo(-44, -56); x.lineTo(44, -56); x.lineTo(56, 56); x.lineTo(-56, 56); x.closePath(); x.fill(); x.lineWidth = 5; x.strokeStyle = '#1a0a02'; x.stroke();
    x.fillStyle = '#d8a070'; x.beginPath(); x.ellipse(0, -4, 26, 34, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#0a0a14'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 10, -10, 6, 3.5, 0, 0, 7); x.fill(); } x.fillRect(-9, 12, 18, 4);
    x.fillStyle = '#d8a020'; x.beginPath(); x.moveTo(-10, 34); x.lineTo(10, 34); x.lineTo(6, 56); x.lineTo(-6, 56); x.fill();
  },
  PYRAMID(x) {
    x.save(); x.beginPath(); x.arc(0, 0, 64, 0, 7); x.clip();
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#1a2a6a', '#ff9a3a', '#ffe08a']); x.fillRect(-64, -64, 128, 128);
    x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(30, -18, 15, 0, 7); x.fill();
    x.fillStyle = lg(x, -40, 0, 40, 40, ['#e8b050', '#a8721a']); x.beginPath(); x.moveTo(-58, 40); x.lineTo(0, -34); x.lineTo(58, 40); x.closePath(); x.fill();
    x.fillStyle = 'rgba(80,40,0,.5)'; x.beginPath(); x.moveTo(0, -34); x.lineTo(58, 40); x.lineTo(14, 40); x.closePath(); x.fill();
    x.fillStyle = '#c8943a'; x.fillRect(-64, 38, 128, 30); x.restore();
    x.lineWidth = 5; x.strokeStyle = '#f6c445'; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.stroke();
  },
  EMU(x) {
    x.fillStyle = rg(x, 0, 0, 10, 64, ['#fff6a0', '#d8b070', '#8a5a2a']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.fillStyle = '#4a3a2a'; x.beginPath(); x.ellipse(-8, 24, 36, 24, 0, 0, 7); x.fill();
    x.strokeStyle = '#4a3a2a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(16, 14); x.quadraticCurveTo(40, -6, 26, -34); x.stroke();
    x.fillStyle = '#4a3a2a'; x.beginPath(); x.ellipse(28, -38, 15, 10, -0.4, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, -42, 4, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(33, -42, 2, 0, 7); x.fill();
    x.fillStyle = '#e8a020'; x.beginPath(); x.moveTo(40, -36); x.lineTo(54, -34); x.lineTo(40, -30); x.fill();
    x.strokeStyle = '#6a4a22'; x.lineWidth = 5; for (const dx of [-16, 0]) { x.beginPath(); x.moveTo(dx, 44); x.lineTo(dx + 4, 66); x.stroke(); }
    x.lineWidth = 5; x.strokeStyle = '#7a2a08'; x.beginPath(); x.arc(0, 0, 62, 0, 7); x.stroke();
  },
  BUFFALO(x) {
    x.fillStyle = rg(x, -6, -6, 6, 70, ['#8a5a3a', '#4a2a16', '#1a0c06']); x.beginPath(); x.ellipse(0, 6, 56, 54, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#0a0402'; x.stroke();
    x.strokeStyle = '#eadcc0'; x.lineWidth = 11; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 44, -22); x.quadraticCurveTo(s * 70, -34, s * 62, -62); x.stroke(); }
    x.fillStyle = '#2a1608'; x.beginPath(); x.ellipse(0, 30, 24, 20, 0, 0, 7); x.fill(); x.fillStyle = '#0a0402'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 9, 32, 4, 6, 0, 0, 7); x.fill(); }
    x.fillStyle = '#f6d040'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 24, -4, 7, 5, 0, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 24, -4, 2.5, 0, 7); x.fill(); }
  },
  WOLF(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#e0e4ea', '#8a909c', '#3a3e48']); x.beginPath(); x.moveTo(-50, -54); x.lineTo(-28, -30); x.lineTo(28, -30); x.lineTo(50, -54); x.lineTo(54, 4); x.lineTo(14, 56); x.lineTo(-14, 56); x.lineTo(-54, 4); x.closePath(); x.fill(); x.lineWidth = 5; x.strokeStyle = '#14161a'; x.stroke();
    x.fillStyle = '#f2f4f8'; x.beginPath(); x.moveTo(-14, 26); x.lineTo(14, 26); x.lineTo(8, 56); x.lineTo(-8, 56); x.fill();
    x.fillStyle = '#f6c820'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 8, 5, s * 0.3, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20, -6, 3, 0, 7); x.fill(); }
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(0, 36, 9, 6, 0, 0, 7); x.fill();
  },
  EAGLE(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#f6f2e8', '#c8b898', '#6a4a22']); x.beginPath(); x.ellipse(0, -4, 34, 44, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#1a0e06'; x.stroke();
    x.fillStyle = '#4a2a10'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 30, 0); x.quadraticCurveTo(s * 80, -10, s * 74, 54); x.quadraticCurveTo(s * 50, 30, s * 30, 40); x.fill(); x.stroke(); }
    x.fillStyle = '#f6b81a'; x.beginPath(); x.moveTo(-9, -4); x.lineTo(9, -4); x.lineTo(0, 22); x.fill(); x.stroke();
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 14, -16, 6, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(s * 14, -16, 3, 0, 7); x.fill(); x.fillStyle = '#fff'; }
  },
  COUGAR(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#f0d098', '#c89858', '#7a4a1a']); x.beginPath(); x.ellipse(0, 4, 50, 48, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a1608'; x.stroke();
    for (const s of [-1, 1]) { x.fillStyle = '#c89858'; x.beginPath(); x.moveTo(s * 30, -34); x.lineTo(s * 46, -62); x.lineTo(s * 52, -20); x.fill(); x.stroke(); }
    x.fillStyle = '#f2e6c8'; x.beginPath(); x.ellipse(0, 28, 22, 16, 0, 0, 7); x.fill();
    x.fillStyle = '#9ad040'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 8, 5, 0, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 2, 5, 0, 0, 7); x.fill(); }
    x.fillStyle = '#c05a4a'; x.beginPath(); x.moveTo(-7, 16); x.lineTo(7, 16); x.lineTo(0, 26); x.fill();
  },
  PAW(x) {
    x.fillStyle = rg(x, -10, -10, 4, 66, ['#fff6a0', '#f0b020', '#a86a08']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = '#6a3a04'; x.stroke();
    x.fillStyle = '#3a1a04'; x.beginPath(); x.ellipse(0, 16, 24, 20, 0, 0, 7); x.fill();
    for (const [dx, dy] of [[-30, -10], [-12, -30], [12, -30], [30, -10]]) { x.beginPath(); x.ellipse(dx, dy, 9, 12, dx * 0.02, 0, 7); x.fill(); }
  }
});

// backdrops
const _drawScene = drawScene;
drawScene = function (x, scene, t) {
  if (scene === 'nile') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#0a1a4a', '#2a6ac8', '#f6c070']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i); x.fillRect((i * 151) % SW, (i * 67) % 260, 2, 2); } x.globalAlpha = 1;
    x.fillStyle = rg(x, 800, 250, 10, 120, ['#fff6b0', 'rgba(255,230,140,.4)', 'rgba(255,200,100,0)']); x.beginPath(); x.arc(800, 250, 120, 0, 7); x.fill();
    for (const [px, s] of [[160, 1.2], [420, 0.9], [650, 1.6]]) { x.fillStyle = '#c8943a'; x.beginPath(); x.moveTo(px - 110 * s, 470); x.lineTo(px, 470 - 150 * s); x.lineTo(px + 110 * s, 470); x.fill(); x.fillStyle = 'rgba(90,50,0,.45)'; x.beginPath(); x.moveTo(px, 470 - 150 * s); x.lineTo(px + 110 * s, 470); x.lineTo(px + 20 * s, 470); x.fill(); }
    x.fillStyle = '#d8b060'; x.fillRect(0, 470, SW, 300);
  } else if (scene === 'prairie') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#2a0a2a', '#d8501a', '#ffc860']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = rg(x, 520, 330, 10, 200, ['#fff6a0', 'rgba(255,200,80,.5)', 'rgba(255,160,40,0)']); x.beginPath(); x.arc(520, 330, 200, 0, 7); x.fill();
    x.fillStyle = '#3a1020'; x.beginPath(); x.moveTo(0, 470); for (let i = 0; i <= 8; i++) x.lineTo(i * SW / 8, 340 + ((i * 53) % 90)); x.lineTo(SW, 470); x.fill();
    x.fillStyle = '#1a0610'; x.fillRect(0, 470, SW, 300);
  } else if (scene === 'outback') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#4a1a3a', '#ff6a3a', '#ffcf5a']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(760, 260, 70, 0, 7); x.fill();
    x.fillStyle = '#a0361a'; x.beginPath(); x.moveTo(0, 470); x.bezierCurveTo(120, 380, 260, 350, 420, 360); x.lineTo(640, 360); x.bezierCurveTo(780, 360, 900, 400, SW, 470); x.fill();
    x.fillStyle = '#5a2a10'; x.fillRect(0, 470, SW, 300);
  } else _drawScene(x, scene, t);
};
