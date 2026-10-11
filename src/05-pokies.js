
// =====================================================================
//  POKIES: symbol art, screen rendering, machine state machine
// =====================================================================
const JP = Object.assign({}, JP_SEED);           // live linked progressive pools (quoted @ $2 bet)
const SW = 1024, SH = 768;                        // logical screen resolution
const RX = 52, RY = 172, CW = 184, CH = 160;      // reel window
const symCache = {};

function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function lg(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function rg(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function outlineText(x, txt, X, Y, size, fill, stroke = '#120a04', sw = 10, font = 'Bungee, Impact, sans-serif') {
  x.font = `${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = sw; x.strokeStyle = stroke; x.strokeText(txt, X, Y); x.fillStyle = fill; x.fillText(txt, X, Y);
}
const ROYAL_COL = { '9': ['#5ff0e0', '#0a6a7a'], '10': ['#7ab8ff', '#103a8a'], 'J': ['#8aff7a', '#16701a'], 'Q': ['#ff8ae8', '#7a1070'], 'K': ['#ff7a6a', '#8a1010'], 'A': ['#ffe07a', '#a85a08'] };

const ART = {
  royal(x, ch) {
    const [c1, c2] = ROYAL_COL[ch];
    x.font = `${ch === '10' ? 84 : 104}px Bungee, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 14; x.strokeStyle = '#0d0703'; x.strokeText(ch, 0, 8);
    x.fillStyle = lg(x, 0, -50, 0, 60, ['#ffffff', c1, c2]); x.fillText(ch, 0, 8);
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.7)'; x.strokeText(ch, 0, 8);
  },
  BOOM(x) {
    x.rotate(-0.25);
    x.beginPath(); x.moveTo(-66, 28); x.quadraticCurveTo(-30, -30, 0, -44); x.quadraticCurveTo(30, -30, 66, 28); x.quadraticCurveTo(58, 40, 48, 34); x.quadraticCurveTo(22, -6, 0, -16); x.quadraticCurveTo(-22, -6, -48, 34); x.quadraticCurveTo(-58, 40, -66, 28); x.closePath();
    x.fillStyle = lg(x, -60, -40, 60, 40, ['#e8a050', '#a85a20', '#5a2a0a']); x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a1204'; x.stroke();
    x.fillStyle = '#fff2d8'; for (let i = 0; i < 14; i++) { const t = i / 13, px = lerp(-54, 54, t), py = 22 - Math.sin(t * Math.PI) * 50; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); }
    x.fillStyle = '#ffd24a'; for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, px = lerp(-50, 50, t), py = 26 - Math.sin(t * Math.PI) * 42; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); }
  },
  KOALA(x) {
    for (const s of [-1, 1]) { x.fillStyle = '#7d8187'; x.beginPath(); x.arc(s * 46, -32, 28, 0, 7); x.fill(); x.fillStyle = '#efe9df'; x.beginPath(); x.arc(s * 46, -30, 17, 0, 7); x.fill(); }
    x.fillStyle = rg(x, -10, -10, 5, 60, ['#b8bcc2', '#8a8e94', '#5e6268']); x.beginPath(); x.ellipse(0, 6, 50, 46, 0, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#2a2c30'; x.stroke();
    x.fillStyle = '#eee'; x.beginPath(); x.ellipse(0, 34, 26, 14, 0, 0, 7); x.fill();
    x.fillStyle = '#111'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20, -4, 6, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20 + 2, -6, 2, 0, 7); x.fill(); }
    x.fillStyle = lg(x, 0, 2, 0, 40, ['#3a3a40', '#0a0a0c']); x.beginPath(); x.ellipse(0, 18, 15, 21, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(-5, 8, 4, 7, -0.3, 0, 7); x.fill();
  },
  ULURU(x) {
    x.save(); x.beginPath(); x.arc(0, 0, 64, 0, 7); x.clip();
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#3a1a5a', '#ff6a3a', '#ffcf5a']); x.fillRect(-64, -64, 128, 128);
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(30, 14, 22, 0, 7); x.fill();
    x.beginPath(); x.moveTo(-70, 34); x.bezierCurveTo(-60, -2, -46, -10, -30, -12); x.lineTo(30, -16); x.bezierCurveTo(46, -12, 58, 4, 70, 34); x.closePath();
    x.fillStyle = lg(x, 0, -16, 0, 34, ['#e0602a', '#a0361a', '#5a1a0a']); x.fill();
    x.strokeStyle = 'rgba(60,15,5,.6)'; x.lineWidth = 2; for (let i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(i * 12, -12); x.quadraticCurveTo(i * 13, 10, i * 14, 34); x.stroke(); }
    x.fillStyle = '#5a2a10'; x.fillRect(-70, 30, 140, 40);
    x.restore(); x.lineWidth = 5; x.strokeStyle = '#f6c445'; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.stroke();
  },
  ROO(x) {
    x.fillStyle = rg(x, 0, 0, 10, 64, ['#fff6a0', '#ffb02a', '#e0501a']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.save(); x.scale(1.15, 1.15); x.translate(-4, 0);
    x.beginPath(); x.moveTo(-55, 40); x.quadraticCurveTo(-30, 30, -12, 22); x.bezierCurveTo(-22, -5, -5, -22, 12, -20); x.lineTo(18, -34); x.lineTo(16, -46); x.lineTo(22, -38); x.lineTo(26, -48); x.lineTo(28, -36);
    x.quadraticCurveTo(42, -34, 44, -28); x.lineTo(30, -24); x.lineTo(24, -14); x.lineTo(31, -4); x.lineTo(27, -1); x.lineTo(18, -6); x.quadraticCurveTo(22, 10, 14, 22); x.lineTo(30, 38); x.lineTo(30, 42); x.lineTo(2, 42); x.lineTo(0, 34); x.quadraticCurveTo(-14, 34, -20, 30); x.lineTo(-55, 44); x.closePath();
    x.fillStyle = '#1a0a04'; x.fill(); x.restore();
    x.lineWidth = 5; x.strokeStyle = '#7a2a08'; x.beginPath(); x.arc(0, 0, 62, 0, 7); x.stroke();
  },
  WILD(x, g) {
    const t = g.theme;
    rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, [t.bg2, t.bg1]); x.fill(); x.lineWidth = 7; x.strokeStyle = t.frame; x.stroke();
    if (g.id === 'dragon') { x.fillStyle = rg(x, -10, -12, 4, 46, ['#ffffff', '#ffd6f0', '#9ad0ff', '#4a2a8a']); x.beginPath(); x.arc(0, 0, 44, 0, 7); x.fill(); }
    if (g.id === 'reef') { x.fillStyle = '#ffb8c8'; x.beginPath(); x.ellipse(0, 18, 60, 24, 0, 0, Math.PI); x.fill(); x.fillStyle = rg(x, -6, -6, 2, 24, ['#fff', '#e8e8ff', '#b8b8d8']); x.beginPath(); x.arc(0, 4, 22, 0, 7); x.fill(); }
    if (g.id === 'sevens') { x.fillStyle = '#ffd84a'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 22 : 50; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
    outlineText(x, 'WILD', 0, 4, 46, lg(x, 0, -20, 0, 24, ['#fffbe0', t.glow, t.accent]), '#1a0802', 9);
  },
  COIN(x) {
    x.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 52 + Math.sin(i * 2.7) * 7; x.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.9); } x.closePath();
    x.fillStyle = rg(x, -18, -18, 4, 64, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-20, -20, 10, 6, -0.6, 0, 7); x.fill();
  },
  LANTERN(x) {
    x.strokeStyle = '#ffd84a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -66); x.lineTo(0, -50); x.stroke();
    x.fillStyle = lg(x, -44, 0, 44, 0, ['#7a0a0a', '#ff3a2a', '#7a0a0a']); x.beginPath(); x.ellipse(0, 0, 46, 46, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,210,80,.6)'; x.lineWidth = 2; for (let i = -2; i <= 2; i++) { x.beginPath(); x.ellipse(0, 0, Math.abs(i) * 11 + 2, 46, 0, 0, 7); x.stroke(); }
    x.fillStyle = lg(x, 0, -56, 0, -42, ['#fff2a0', '#c88a10']); rr(x, -28, -54, 56, 12, 3); x.fill(); rr(x, -28, 42, 56, 12, 3); x.fill();
    x.strokeStyle = '#ff3a2a'; x.lineWidth = 3; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 5, 54); x.lineTo(i * 6, 70); x.stroke(); }
  },
  ENVELOPE(x) {
    rr(x, -44, -56, 88, 112, 8); x.fillStyle = lg(x, 0, -56, 0, 56, ['#ff4a3a', '#a00a0a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffd84a'; x.stroke();
    x.beginPath(); x.moveTo(-44, -30); x.lineTo(0, 0); x.lineTo(44, -30); x.strokeStyle = 'rgba(255,210,80,.6)'; x.stroke();
    x.fillStyle = rg(x, -6, -6, 2, 24, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 6, 22, 0, 7); x.fill();
    outlineText(x, '8', 0, 9, 30, '#a00a0a', '#ffeaa0', 2);
  },
  KOI(x) {
    x.rotate(-0.35);
    x.fillStyle = '#ff7a2a'; x.beginPath(); x.moveTo(36, 0); x.lineTo(66, -24); x.quadraticCurveTo(56, 0, 66, 24); x.closePath(); x.fill();
    x.fillStyle = lg(x, 0, -24, 0, 24, ['#ffffff', '#ffe8d8', '#ff9a5a']); x.beginPath(); x.ellipse(-4, 0, 48, 24, 0, 0, 7); x.fill();
    x.fillStyle = '#ff4a1a'; for (const [px, py, r] of [[-10, -8, 12], [12, 6, 10], [-28, 8, 7]]) { x.beginPath(); x.ellipse(px, py, r * 1.3, r, 0.4, 0, 7); x.fill(); }
    x.fillStyle = '#ff9a5a'; x.beginPath(); x.ellipse(0, 22, 14, 6, 0.6, 0, 7); x.fill(); x.beginPath(); x.ellipse(0, -22, 14, 6, -0.6, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(-36, -5, 4, 0, 7); x.fill();
    x.lineWidth = 3; x.strokeStyle = '#7a2a08'; x.beginPath(); x.ellipse(-4, 0, 48, 24, 0, 0, 7); x.stroke();
  },
  INGOT(x) {
    x.beginPath(); x.moveTo(-66, -4); x.quadraticCurveTo(-60, 40, 0, 42); x.quadraticCurveTo(60, 40, 66, -4); x.quadraticCurveTo(40, 6, 26, -8); x.quadraticCurveTo(26, -42, 0, -42); x.quadraticCurveTo(-26, -42, -26, -8); x.quadraticCurveTo(-40, 6, -66, -4); x.closePath();
    x.fillStyle = lg(x, 0, -42, 0, 42, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-8, -26, 8, 5, -0.5, 0, 7); x.fill();
  },
  SCAT(x) {
    x.fillStyle = rg(x, -16, -16, 6, 70, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke(); x.beginPath(); x.arc(0, 0, 50, 0, 7); x.stroke();
    x.fillStyle = '#7a0a0a'; x.fillRect(-14, -14, 28, 28); x.strokeRect(-14, -14, 28, 28);
    outlineText(x, 'FREE', 0, -32, 20, '#a00a0a', '#ffeaa0', 3); outlineText(x, 'GAMES', 0, 32, 18, '#a00a0a', '#ffeaa0', 3);
  },
  CHERRY(x) {
    x.strokeStyle = '#3a6a1a'; x.lineWidth = 5; x.beginPath(); x.moveTo(-22, 14); x.quadraticCurveTo(-8, -30, 14, -50); x.moveTo(24, 22); x.quadraticCurveTo(22, -20, 14, -50); x.stroke();
    x.fillStyle = '#4aa02a'; x.beginPath(); x.ellipse(32, -48, 22, 10, -0.3, 0, 7); x.fill();
    for (const [cx, cy] of [[-24, 24], [24, 30]]) { x.fillStyle = rg(x, cx - 8, cy - 8, 2, 30, ['#ffb0b0', '#e0101a', '#5a0005']); x.beginPath(); x.arc(cx, cy, 26, 0, 7); x.fill(); x.lineWidth = 3; x.strokeStyle = '#3a0002'; x.stroke(); }
  },
  BELL(x) {
    x.beginPath(); x.moveTo(-50, 36); x.quadraticCurveTo(-40, 20, -38, -10); x.quadraticCurveTo(-36, -52, 0, -54); x.quadraticCurveTo(36, -52, 38, -10); x.quadraticCurveTo(40, 20, 50, 36); x.closePath();
    x.fillStyle = lg(x, -40, 0, 40, 0, ['#a86a08', '#ffe88a', '#ffd84a', '#8a5004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = '#c88a10'; rr(x, -54, 32, 108, 12, 6); x.fill(); x.stroke();
    x.fillStyle = '#8a5004'; x.beginPath(); x.arc(0, 52, 10, 0, 7); x.fill();
  },
  BAR(x) {
    rr(x, -72, -34, 144, 68, 10); x.fillStyle = lg(x, 0, -34, 0, 34, ['#333', '#000']); x.fill(); x.lineWidth = 6; x.strokeStyle = '#ffd84a'; x.stroke();
    outlineText(x, 'BAR', 0, 4, 46, lg(x, 0, -20, 0, 20, ['#fff', '#ddd', '#888']), '#000', 4);
  },
  DIAMOND(x) {
    const pts = [[-56, -14], [-30, -42], [30, -42], [56, -14], [0, 52]];
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
    x.fillStyle = lg(x, -50, -40, 50, 50, ['#d8f4ff', '#3ab0ff', '#0a3a9a']); x.fill(); x.lineWidth = 3; x.strokeStyle = '#04205a'; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-56, -14); x.lineTo(56, -14); x.moveTo(-30, -42); x.lineTo(-14, -14); x.lineTo(0, 52); x.lineTo(14, -14); x.lineTo(30, -42); x.moveTo(-14, -14); x.lineTo(0, -42); x.lineTo(14, -14); x.stroke();
  },
  seven(x, c1, c2) {
    x.font = '150px Bungee, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 16; x.strokeStyle = '#000'; x.strokeText('7', 0, 10);
    x.lineWidth = 8; x.strokeStyle = '#fff'; x.strokeText('7', 0, 10);
    x.fillStyle = lg(x, 0, -60, 0, 70, ['#fff', c1, c2]); x.fillText('7', 0, 10);
  },
  SEVENB(x) { ART.seven(x, '#5ab0ff', '#0a2a8a'); },
  SEVENR(x) { ART.seven(x, '#ff6a5a', '#8a0a0a'); },
  BONUS(x) {
    const cols = ['#ff3a4a', '#ffd84a', '#3ab0ff', '#4ae07a'];
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.moveTo(0, -6); x.arc(0, -6, 50, i * Math.PI / 4, (i + 1) * Math.PI / 4); x.closePath(); x.fill(); }
    x.lineWidth = 5; x.strokeStyle = '#fff'; x.beginPath(); x.arc(0, -6, 50, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -6, 10, 0, 7); x.fill();
    rr(x, -60, 30, 120, 34, 8); x.fillStyle = '#c0102a'; x.fill(); x.strokeStyle = '#ffd84a'; x.lineWidth = 4; x.stroke();
    outlineText(x, 'BONUS', 0, 48, 24, '#fff', '#5a0010', 4);
  },
  SHELL(x) {
    x.beginPath(); x.moveTo(0, 46);
    for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI, r = 58; x.quadraticCurveTo(Math.cos(a - 0.2) * r * 1.1, Math.sin(a - 0.2) * r * 1.1 + 10, Math.cos(a) * r, Math.sin(a) * r + 10); }
    x.closePath(); x.fillStyle = lg(x, 0, -50, 0, 46, ['#fff0e0', '#ffb08a', '#e0604a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#7a2a1a'; x.stroke();
    x.strokeStyle = 'rgba(120,40,20,.6)'; x.lineWidth = 2; for (let i = 1; i < 8; i++) { const a = Math.PI + i / 8 * Math.PI; x.beginPath(); x.moveTo(0, 46); x.lineTo(Math.cos(a) * 56, Math.sin(a) * 56 + 10); x.stroke(); }
    x.fillStyle = '#e0604a'; x.fillRect(-20, 40, 40, 12);
  },
  STAR(x) {
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 24 : 62; const px = Math.cos(a) * r, py = Math.sin(a) * r + 4; if (i === 0) x.moveTo(px, py); else x.quadraticCurveTo(Math.cos(a - Math.PI / 10) * (r + 10) * 0.7, Math.sin(a - Math.PI / 10) * (r + 10) * 0.7 + 4, px, py); }
    x.closePath(); x.fillStyle = rg(x, 0, 0, 4, 64, ['#fff0a0', '#ff8a2a', '#c0401a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#6a1a04'; x.stroke();
    x.fillStyle = 'rgba(255,240,200,.85)'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(Math.cos(a) * k * 13, Math.sin(a) * k * 13 + 4, 3, 0, 7); x.fill(); } }
  },
  FISH(x) {
    x.fillStyle = '#ff7a1a'; x.beginPath(); x.moveTo(36, 0); x.lineTo(64, -24); x.lineTo(58, 0); x.lineTo(64, 24); x.closePath(); x.fill();
    x.fillStyle = lg(x, 0, -30, 0, 30, ['#ffb04a', '#ff6a0a', '#c03a00']); x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.fill();
    x.save(); x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.clip();
    for (const sx of [-28, 0, 26]) { x.fillStyle = '#111'; x.fillRect(sx - 9, -40, 18, 80); x.fillStyle = '#fff'; x.fillRect(sx - 6, -40, 12, 80); }
    x.restore(); x.lineWidth = 3; x.strokeStyle = '#5a1a00'; x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-36, -6, 7, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(-37, -6, 4, 0, 7); x.fill();
  },
  TURTLE(x) {
    x.fillStyle = '#5aa04a'; for (const [fx, fy, a] of [[-40, -30, -0.8], [40, -30, 0.8], [-36, 34, 0.6], [36, 34, -0.6]]) { x.beginPath(); x.ellipse(fx, fy, 24, 11, a, 0, 7); x.fill(); }
    x.beginPath(); x.arc(0, -52, 14, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(-5, -55, 2.5, 0, 7); x.arc(5, -55, 2.5, 0, 7); x.fill();
    x.fillStyle = rg(x, -10, -10, 4, 50, ['#9ae07a', '#3a8a2a', '#1a4a12']); x.beginPath(); x.ellipse(0, 0, 40, 46, 0, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#123a0a'; x.stroke();
    x.strokeStyle = 'rgba(220,255,180,.6)'; x.lineWidth = 2;
    const hex = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.stroke(); };
    hex(0, 0, 14); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; hex(Math.cos(a) * 26, Math.sin(a) * 28, 11); }
  },
  CHEST(x) {
    x.fillStyle = rg(x, 0, -30, 4, 50, ['rgba(255,240,150,.9)', 'rgba(255,200,60,0)']); x.beginPath(); x.arc(0, -24, 50, 0, 7); x.fill();
    x.fillStyle = lg(x, 0, -10, 0, 50, ['#a0602a', '#5a300a']); x.fillRect(-60, -6, 120, 56);
    x.beginPath(); x.moveTo(-60, -6); x.quadraticCurveTo(0, -60, 60, -6); x.closePath(); x.fillStyle = lg(x, 0, -50, 0, -6, ['#c0783a', '#7a4010']); x.fill();
    x.fillStyle = '#ffd84a'; for (const bx of [-44, 36]) x.fillRect(bx, -30, 8, 80); x.fillRect(-60, -10, 120, 8);
    x.fillStyle = '#fff0a0'; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(-30 + i * 10, -18 - Math.sin(i) * 6, 8, 4, 0, 0, 7); x.fill(); }
    x.fillStyle = '#ffd84a'; rr(x, -10, 4, 20, 24, 4); x.fill(); x.fillStyle = '#3a1a04'; x.beginPath(); x.arc(0, 13, 4, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#2a1202'; x.strokeRect(-60, -6, 120, 56);
  },
};
function buildSymbolCache(g) {
  const out = {};
  for (const s of g.syms) {
    const c = mkCanvas(CW, CH), x = c.getContext('2d');
    x.translate(CW / 2, CH / 2);
    if (ROYAL_COL[s]) ART.royal(x, s); else if (s === 'WILD') ART.WILD(x, g); else ART[s](x, g);
    const b = mkCanvas(CW, CH), bx = b.getContext('2d');
    for (let k = -5; k <= 5; k++) { bx.globalAlpha = 0.16; bx.drawImage(c, 0, k * 7); }
    out[s] = { sharp: c, blur: b };
  }
  symCache[g.id] = out;
}

// ---------- shared attract & topper canvases per game ----------
const shared = {};
function drawLogo(x, g, cx, cy, sc, t) {
  x.save(); x.translate(cx, cy); x.scale(sc, sc);
  const th = g.theme;
  x.shadowColor = th.glow; x.shadowBlur = 24 + Math.sin(t * 3) * 8;
  outlineText(x, g.name, 0, 0, 74, lg(x, 0, -40, 0, 40, ['#fffbe8', th.glow, th.accent]), '#1a0802', 14);
  x.shadowBlur = 0;
  rr(x, -110, 34, 220, 42, 21); x.fillStyle = lg(x, 0, 34, 0, 76, [th.accent, th.bg1]); x.fill(); x.lineWidth = 4; x.strokeStyle = th.frame; x.stroke();
  outlineText(x, g.sub, 0, 56, 30, '#fff', '#1a0802', 6);
  x.restore();
}
function drawBG(x, g, t) {
  const th = g.theme;
  x.fillStyle = rg(x, SW / 2, SH * 0.45, 40, SW * 0.75, [th.bg2, th.bg1, '#000']); x.fillRect(0, 0, SW, SH);
  x.save(); x.translate(SW / 2, 300); x.rotate(t * 0.08); x.globalAlpha = 0.07;
  for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 0); x.lineTo(900, -70); x.lineTo(900, 70); x.closePath(); x.fill(); }
  x.restore(); x.globalAlpha = 1;
}
function jpVal(name, bet) { return JP[name] * (bet ? jpFactor(bet) : 1); }
function drawJackpotBar(x, g, bet, t, y = 104) {
  const names = ['GRAND', 'MAJOR', 'MINOR', 'MINI'], cols = [['#ff3a5a', '#7a0018'], ['#b05aff', '#3a0a7a'], ['#3ab0ff', '#0a3a7a'], ['#4ae07a', '#0a5a1a']];
  names.forEach((n, i) => {
    const w = 232, X = 30 + i * 246;
    rr(x, X, y, w, 60, 10); x.fillStyle = lg(x, 0, y, 0, y + 60, cols[i]); x.fill(); x.lineWidth = 3; x.strokeStyle = g.theme.frame; x.stroke();
    outlineText(x, n, X + w / 2, y + 16, 20, '#fff', '#000', 4);
    outlineText(x, fmt$(jpVal(n, bet)), X + w / 2, y + 42, 28, '#ffe98a', '#000', 5, 'Bebas Neue, Impact, sans-serif');
  });
}
function buildShared() {
  for (const id in GAMES) {
    const g = GAMES[id]; buildSymbolCache(g);
    const ac = mkCanvas(512, 384), tc = mkCanvas(512, 256);
    shared[id] = { attract: ac, at: canvasTex(ac, 1, 1), topper: tc, tt: canvasTex(tc, 1, 1), t: Math.random() * 10 };
  }
}
function drawAttract(id, dt) {
  const s = shared[id], g = GAMES[id], x = s.attract.getContext('2d'); s.t += dt;
  x.setTransform(0.5, 0, 0, 0.5, 0, 0);
  drawBG(x, g, s.t); drawLogo(x, g, SW / 2, 54, 0.85, s.t); drawJackpotBar(x, g, 0, s.t, 140);
  // symbol parade
  const syms = g.syms.filter(q => !ROYAL_COL[q]);
  for (let i = 0; i < 5; i++) { const k = syms[(Math.floor(s.t * 0.7) + i) % syms.length]; const bob = Math.sin(s.t * 2 + i) * 10; x.drawImage(symCache[id][k].sharp, RX + i * CW, 260 + bob); }
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 600, SW, 168);
  outlineText(x, 'INSERT CASH TO PLAY', SW / 2, 638, 36, g.theme.glow, '#000', 6);
  outlineText(x, g.tag, SW / 2, 688, 21, '#fff', '#000', 4);
  outlineText(x, '1c · 25 LINES · BETS $0.50 – $10', SW / 2, 732, 21, '#ddd', '#000', 4);
  s.at.needsUpdate = true;
}
function drawTopper(id) {
  const s = shared[id], g = GAMES[id], x = s.topper.getContext('2d');
  x.setTransform(0.5, 0, 0, 0.5, 0, 0);
  x.fillStyle = rg(x, SW / 2, 256, 30, 700, [g.theme.bg2, g.theme.bg1, '#000']); x.fillRect(0, 0, SW, 512);
  drawLogo(x, g, SW / 2, 120, 1.3, s.t);
  rr(x, 180, 300, 664, 150, 20); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill(); x.lineWidth = 5; x.strokeStyle = g.theme.frame; x.stroke();
  outlineText(x, 'GRAND', SW / 2, 336, 40, '#ff6a7a', '#000', 6);
  outlineText(x, fmt$(JP.GRAND), SW / 2, 400, 80, '#ffe98a', '#000', 8, 'Bebas Neue, Impact, sans-serif');
  s.tt.needsUpdate = true;
}
function drawJPBoard(t) {
  const b = dynamic.jpBoard, x = b.c.getContext('2d');
  x.fillStyle = '#050208'; x.fillRect(0, 0, 1024, 256);
  // LED dot texture
  const names = ['GRAND', 'MAJOR', 'MINOR', 'MINI'], cols = ['#ff3a5a', '#c07aff', '#5ac0ff', '#5aff8a'];
  names.forEach((n, i) => {
    const X = 20 + i * 250;
    x.fillStyle = cols[i]; x.font = '34px Bungee, Impact'; x.textAlign = 'center'; x.fillText(n, X + 115, 70);
    x.shadowColor = cols[i]; x.shadowBlur = 18; x.fillStyle = '#ffe98a'; x.font = '64px Bebas Neue, Impact'; x.fillText(fmt$(JP[n]), X + 115, 150); x.shadowBlur = 0;
  });
  x.fillStyle = '#ffd84a'; x.font = '26px Bungee, Impact'; x.textAlign = 'center';
  const msgs = ['LINKED PROGRESSIVE JACKPOTS', 'JACKPOTS QUOTED FOR A $2 BET', 'ANY MACHINE CAN WIN!', Game.state.event === 'jackpot' ? 'JACKPOT THURSDAY: DOUBLE INCREMENTS' : 'THINK! SET A LIMIT'];
  x.fillText(msgs[Math.floor(t / 3) % msgs.length], 512, 220);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < 256; y += 4) x.fillRect(0, y, 1024, 1.5);
  b.tex.needsUpdate = true;
}

// ---------- machine meshes ----------
let _cab, _deckMat, _spinMat, MGEO = null;
const _gameMats = {};
function gameMats(id) {
  if (_gameMats[id]) return _gameMats[id];
  const th = GAMES[id].theme;
  const topper = new THREE.MeshBasicMaterial({ map: shared[id].tt }); topper.color.setScalar(1.2);
  const belly = new THREE.MeshBasicMaterial({ map: shared[id].tt }); belly.color.setScalar(0.85);
  if (!MGEO) MGEO = {
    body: new RoundedBoxGeometry(0.66, 0.92, 0.62, 2, 0.04), deckBox: new THREE.BoxGeometry(0.66, 0.1, 0.36), head: new RoundedBoxGeometry(0.66, 0.8, 0.3, 2, 0.04), top: new RoundedBoxGeometry(0.62, 0.42, 0.22, 2, 0.04),
    strip: new THREE.BoxGeometry(0.015, 1.4, 0.03), crown: new THREE.BoxGeometry(0.62, 0.05, 0.2), topper: new THREE.PlaneGeometry(0.56, 0.28), belly: new THREE.PlaneGeometry(0.58, 0.29),
    bezH: new THREE.BoxGeometry(0.61, 0.012, 0.012), bezV: new THREE.BoxGeometry(0.012, 0.46, 0.012), bezB: new THREE.BoxGeometry(0.6, 0.012, 0.012), note: new THREE.BoxGeometry(0.12, 0.05, 0.04),
    ledge: new THREE.BoxGeometry(0.2, 0.025, 0.24), ashtray: new THREE.CylinderGeometry(0.06, 0.05, 0.03, 16), seat: new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18), back: new RoundedBoxGeometry(0.4, 0.35, 0.06, 2, 0.03),
    leg: new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), base: new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), screen: new THREE.PlaneGeometry(0.58, 0.435), deck: new THREE.PlaneGeometry(0.62, 0.32), spin: new RoundedBoxGeometry(0.105, 0.135, 0.026, 3, 0.012)
  };
  return (_gameMats[id] = { accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.accent).multiplyScalar(1.5) }), bez: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.frame).multiplyScalar(1.25) }), topper, belly });
}
function cabMat() { if (!_cab) { _cab = new THREE.MeshStandardMaterial({ color: 0x17171c, metalness: 0.65, roughness: 0.28 }); interiorMats.push(_cab); } return _cab; }
function spinMat() { return _spinMat || (_spinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.7, 0.55) })); }
// deck layout in canvas pixels (512 x 264); top of the canvas is the edge nearest the screen
const DECK_BTNS = [{ id: 'cash', x: 52, label: 'CASH', c: '#d8d8e0' }, { id: 'betdn', x: 132, label: 'BET −', c: '#5aa7f3' }, { id: 'betup', x: 212, label: 'BET +', c: '#5aa7f3' }, { id: 'gamble', x: 292, label: 'GAMBLE', c: '#ffd84a' }, { id: 'collect', x: 372, label: 'COLLECT', c: '#ffd84a' }];
function deckMat() {
  if (_deckMat) return _deckMat;
  const c = mkCanvas(512, 264), x = c.getContext('2d');
  x.fillStyle = lg(x, 0, 0, 0, 264, ['#1c1c22', '#0c0c10']); x.fillRect(0, 0, 512, 264);
  x.fillStyle = '#05050a'; rr(x, 14, 14, 484, 40, 8); x.fill();
  x.fillStyle = '#ff6a3a'; x.font = 'bold 22px Bungee, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THE ROYAL · GAMING · 1c', 256, 35);
  for (const b of DECK_BTNS) {
    x.fillStyle = '#000'; rr(x, b.x - 37, 140, 74, 78, 12); x.fill();
    x.fillStyle = lg(x, 0, 146, 0, 212, ['#ffffff', b.c]); rr(x, b.x - 32, 145, 64, 66, 10); x.fill();
    x.fillStyle = '#111'; x.font = 'bold 15px Inter, sans-serif'; x.fillText(b.label, b.x, 179);
  }
  x.fillStyle = '#000'; rr(x, 403, 54, 104, 156, 16); x.fill();
  x.fillStyle = '#7dff9a'; x.font = 'bold 16px Inter, sans-serif'; x.fillText('SPIN', 455, 228);
  x.fillStyle = '#555'; x.font = '12px Inter, sans-serif'; x.textAlign = 'left'; x.fillText('Gambling Help 24/7 · Set a limit', 20, 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  _deckMat = new THREE.MeshBasicMaterial({ map: t }); _deckMat.color.setScalar(1.05);
  return _deckMat;
}
function deckHit(uv) {
  const px = uv.x * 512, py = (1 - uv.y) * 264;
  if (px > 400 && py > 50 && py < 214) return 'spin';
  for (const b of DECK_BTNS) if (Math.abs(px - b.x) < 38 && py > 138 && py < 220) return b.id;
  return null;
}
function buildMachineMesh(def, idx) {
  const g = GAMES[def.game], th = g.theme;
  const root = new THREE.Group(); root.position.copy(def.pos); root.rotation.y = def.ry; scene.add(root);
  const cab = cabMat(), gm = gameMats(def.game);
  root.updateMatrixWorld(true);
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; root.add(o); return o; };
  // static parts go into the shared static batch (merged per material across ALL machines)
  const addS = (geo, m, x, y, z, rx = 0) => { const lm = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), V3(1, 1, 1)); SB.addM(geo, m, new THREE.Matrix4().multiplyMatrices(root.matrixWorld, lm)); };
  addS(MGEO.body, cab, 0, 0.46, 0);
  addS(MGEO.deckBox, cab, 0, 0.98, 0.16, -0.25);
  addS(MGEO.head, cab, 0, 1.42, -0.12);
  addS(MGEO.top, cab, 0, 2.08, -0.15);
  for (const sx of [-0.335, 0.335]) addS(MGEO.strip, gm.accent, sx, 1.45, 0.03);
  addS(MGEO.crown, gm.accent, 0, 2.32, -0.15);
  addS(MGEO.topper, gm.topper, 0, 2.08, -0.035);
  addS(MGEO.belly, gm.belly, 0, 0.6, 0.312);
  for (const [x, y, k] of [[0, 1.664, 'bezH'], [0, 1.216, 'bezH'], [-0.299, 1.44, 'bezV'], [0.299, 1.44, 'bezV'], [0, 0.75, 'bezB'], [0, 0.45, 'bezB']]) addS(MGEO[k], gm.bez, x, y, y < 1 ? 0.312 : 0.044);
  addS(MGEO.note, MAT.chrome, 0.2, 0.86, 0.32);
  addS(MGEO.ledge, MAT.darkWood, -0.45, 0.98, 0.18);
  if (def.smoke) { addS(MGEO.ashtray, MAT.chrome, 0.45, 0.99, 0.18); addS(MGEO.ledge, MAT.darkWood, 0.45, 0.965, 0.18); }
  // stool
  addS(MGEO.seat, MAT.vinylBlack, 0, 0.66, 0.82); addS(MGEO.back, MAT.vinylBlack, 0, 0.95, 1.02);
  addS(MGEO.leg, MAT.chrome, 0, 0.31, 0.82); addS(MGEO.base, MAT.chrome, 0, 0.015, 0.82);
  // live parts: the screen, the clickable deck and the pressable SPIN button
  const scrMat = new THREE.MeshBasicMaterial({ map: shared[def.game].at }); scrMat.color.setScalar(1.12);
  const scr = add(MGEO.screen, scrMat, 0, 1.44, 0.04, 0);
  const deck = add(MGEO.deck, deckMat(), 0, 1.0295, 0.1476, -Math.PI / 2 - 0.25);
  const spinB = new THREE.Mesh(MGEO.spin, spinMat()); spinB.position.set(0.241, 0, 0.012); deck.add(spinB);
  const btns = [deck, deck, deck, deck, deck, spinB];
  // world-space helpers
  const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyEuler(new THREE.Euler(0, def.ry, 0)).add(def.pos);
  const fw = toW(0, 0, 1).sub(def.pos);
  addColBox(...(() => { const c = toW(0, 0, -0.02); const w = Math.abs(fw.x) > 0.5 ? 0.7 : 0.72, d = Math.abs(fw.x) > 0.5 ? 0.72 : 0.7; return [c.x - w / 2, c.x + w / 2, c.z - d / 2, c.z + d / 2]; })());
  const seatW = toW(0, 0, 0.82);
  const m = new Machine(def, idx, { root, scr, btns, deck, seatW, fw, ledge: toW(-0.45, 0.995, 0.18), ash: toW(0.45, 1.01, 0.18), screenW: toW(0, 1.44, 0.04), ashLocal: V3(0.45, 1.01, 0.18) });
  MACHINES.push(m);
  addSpot({ kind: 'pokie', pos: seatW.clone(), ry: def.ry + Math.PI, sitH: 0.7, area: def.smoke ? 'terrace' : 'gaming', machine: m, smoke: def.smoke });
  addInteract({ id: 'machine' + idx, pos: toW(0, 1.3, 0.3), r: 1.7, label: () => m.occupiedBy ? `${g.name} ${g.sub} — in use` : `Sit at ${g.name} ${g.sub}${def.smoke ? '  (smoking area)' : ''}`, enabled: () => !m.occupiedBy, action: () => Game.sitAt(m) });
  return m;
}

// ---------- the machine ----------
class Machine {
  constructor(def, idx, parts) {
    Object.assign(this, parts);
    this.def = def; this.idx = idx; this.game = GAMES[def.game]; this.mode = 'idle'; this.occupiedBy = null;
    this.credit = 0; this.betIdx = 1; this.state = 'ready'; this.t = 0; this.st = 0;
    this.reels = [0, 1, 2, 3, 4].map(() => ({ pos: 0, v: 0, strip: {}, phase: 'idle', t0: 0, p0: 0, P: 0, dur: 0, stopAt: 0 }));
    this.grid = null; this.wins = []; this.win = 0; this.shownWin = 0; this.msg = ''; this.particles = [];
    this.lastWin = 0; this.gambleAmt = 0; this.npcTimer = rand(2, 5);
    this.rand0();
  }
  get bet() { return BETS[this.betIdx]; }
  rand0() { const res = spinGrid(this.game, 1, false); this.grid = res.grid; this.res = res; for (let r = 0; r < 5; r++) { const R = this.reels[r]; R.pos = 100; R.strip = {}; for (let k = 0; k < 3; k++) R.strip[100 - k] = res.grid[r][k]; } }
  symAt(r, j) { const R = this.reels[r]; if (R.strip[j] == null) R.strip[j] = wpick(this.game.syms, reelWeights(this.game, r, this.free)); return R.strip[j]; }
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'idle') { this.scr.material.map = shared[this.def.game].at; }
    else {
      const res = mode === 'player' ? 1 : 0.5;
      if (!this.canvas || this.res_ !== res) { this.canvas = mkCanvas(SW * res, SH * res); this.ctx = this.canvas.getContext('2d'); this.tex = canvasTex(this.canvas, 1, 1); this.res_ = res; }
      this.scr.material.map = this.tex;
    }
    this.scr.material.needsUpdate = true;
  }
  // ---------------- spin flow ----------------
  canSpin() { return this.state === 'ready' || this.state === 'showWin'; }
  spin(free = false) {
    if (this.state === 'showWin') this.endShowWin();
    if (!this.canSpin() && !free) return false;
    const bet = this.bet;
    if (!free) {
      if (this.credit + 1e-9 < bet) { this.msg = 'INSERT CASH'; return false; }
      this.credit -= bet; this.wagered = (this.wagered || 0) + bet;
      const inc = Game.state.event === 'jackpot' ? 2 : 1;
      for (const k of JP_NAMES) JP[k] += bet * JP_INC[k] * inc;
      if (this.mode === 'player') Game.onPlayerBet(bet);
    }
    this.free = free;
    this.res = spinGrid(this.game, bet, free);
    this.lw = evalLines(this.game, this.res, bet);
    this.wins = this.lw.wins; this.win = this.lw.total; this.shownWin = 0; this.winLineI = -1; this.lastWin = 0; this.gambleOK = false;
    // decide anticipation
    const trig = this.game.scatter || this.game.bonusSym;
    let antFrom = 9;
    if (trig) {
      let cnt = 0;
      for (let r = 0; r < 5; r++) { if (cnt >= 2 && antFrom === 9) antFrom = r; cnt += this.res.grid[r].filter(s => s === trig).length; }
      if (this.game.bonusSym === 'COIN') { let c = 0; for (let r = 0; r < 3; r++) c += this.res.grid[r].filter(s => s === 'COIN').length; antFrom = c >= 4 ? 3 : 9; }
    }
    const fast = this.mode === 'npc' ? 0.7 : 1;
    let t = 0.5 * fast;
    this.reels.forEach((R, r) => {
      R.phase = 'spin'; R.v = 0; R.t0 = this.t + r * 0.05; t += (r >= antFrom ? 1.1 : 0.22) * fast;
      R.stopAt = this.t + t; R.ant = r >= antFrom;
    });
    this.state = 'spinning'; this.msg = free ? '' : 'GOOD LUCK!';
    if (this.mode === 'player') SFX.button();
    return true;
  }
  slam() { if (this.state !== 'spinning') return; this.reels.forEach((R, r) => { if (R.phase === 'spin') R.stopAt = Math.min(R.stopAt, this.t + r * 0.04); }); }
  stopReel(r) {
    const R = this.reels[r];
    const P = Math.ceil(R.pos) + 5;
    for (let k = 0; k < 3; k++) R.strip[P - k] = this.res.grid[r][k];
    R.phase = 'stopping'; R.p0 = R.pos; R.P = P; R.ts = this.t; R.dur = 0.32;
  }
  update(dt) {
    this.t += dt;
    for (let r = 0; r < 5; r++) {
      const R = this.reels[r];
      if (R.phase === 'spin') {
        if (this.t < R.t0) { R.pos -= dt * 1.5; continue; }
        R.v = Math.min(R.v + dt * 90, R.ant ? 30 : 22); R.pos += R.v * dt;
        if (this.mode === 'player' && Math.random() < dt * 14) SFX.spinTick();
        if (this.mode === 'player' && R.ant && Math.random() < dt * 4) SFX.anticip(r * 2 + Math.floor((this.t * 4) % 4));
        if (this.t >= R.stopAt) this.stopReel(r);
      } else if (R.phase === 'stopping') {
        const k = clamp((this.t - R.ts) / R.dur, 0, 1);
        R.pos = R.p0 + (R.P - R.p0) * easeOutBack(k);
        if (k >= 1) {
          R.pos = R.P; R.phase = 'idle';
          if (this.mode === 'player') { SFX.reelStop(r); const trig = this.game.scatter || this.game.bonusSym; if (trig && this.res.grid[r].includes(trig)) SFX.tone(880 + r * 110, 0.25, { gain: 0.08, type: 'triangle' }); }
          else if (this.mode === 'npc' && Math.random() < 0.3) SFX.tone(150, 0.08, { gain: 0.03, pos: this.screenW });
        }
      }
    }
    if (this.state === 'spinning' && this.reels.every(R => R.phase === 'idle')) this.onStopped();
    this.updateState(dt);
    // particles (coin shower)
    for (const p of this.particles) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
    this.particles = this.particles.filter(p => p.y < SH + 60);
  }
  onStopped() {
    this.grid = this.res.grid;
    const g = this.game, bet = this.bet;
    // features
    let feat = null;
    if (g.feature === 'holdspin' && countSym(this.res, 'COIN').n >= 6) feat = 'holdspin';
    if (g.feature === 'freegames' && countSym(this.res, g.scatter).n >= 3) feat = this.free ? 'retrigger' : 'freegames';
    if (g.feature === 'wheel' && countSym(this.res, 'BONUS').n >= 3) feat = 'wheel';
    if (g.feature === 'pick' && countSym(this.res, g.scatter).n >= 3) feat = 'pick';
    if (!feat && !this.free && g.mystery && Math.random() < g.mystery) feat = 'mystery';
    let scatPay = 0;
    if (feat === 'freegames') scatPay = bet * [0, 0, 0, 2, 10, 50][Math.min(5, countSym(this.res, g.scatter).n)];
    if (feat === 'pick') scatPay = bet * [0, 0, 0, 3, 15, 60][Math.min(5, countSym(this.res, g.scatter).n)];
    if (this.free && countSym(this.res, g.scatter).n >= 3) scatPay = bet * 2;
    this.win += scatPay;
    if (this.free) { this.featWin += this.win; }
    if (feat === 'retrigger') { this.freeLeft += 5; this.flash('+5 FREE GAMES', 1.6); if (this.mode === 'player') SFX.fanfare(); }
    if (feat && feat !== 'retrigger') { this.pendingFeat = feat; this.state = 'featIntro'; this.st = 0; if (this.mode === 'player') { SFX.fanfare(); Game.onFeature(feat, this); } this.featBaseWin = this.win; return; }
    this.state = 'showWin'; this.st = 0;
    if (this.win > 0) {
      this.winLevel = this.win / bet;
      if (this.mode === 'player') { SFX.win(Math.min(4, Math.floor(Math.log2(1 + this.winLevel)))); if (this.winLevel >= 15 && !this.free) this.bigWin(); }
      else if (this.mode === 'npc') { if (this.winLevel > 4) SFX.chimeAt(this.screenW, 1.2); }
    } else if (!this.free) this.msg = this.credit < bet ? 'INSERT CASH' : 'PLAY AGAIN';
  }
  bigWin() {
    const lvl = this.winLevel >= 100 ? 'EPIC WIN' : this.winLevel >= 50 ? 'MEGA WIN' : 'BIG WIN';
    this.flash(lvl, 3.5); SFX.fanfare(); this.coinShower(80);
    Game.onBigWin(this, lvl);
  }
  coinShower(n) { for (let i = 0; i < n; i++) this.particles.push({ x: rand(0, SW), y: rand(-400, -20), vx: rand(-80, 80), vy: rand(0, 200), r: rand(0, 6), vr: rand(-8, 8), s: rand(18, 34) }); }
  flash(txt, dur) { this.flashTxt = txt; this.flashT = dur; this.flashT0 = dur; }
  endShowWin() {
    if (this.shownWin < this.win) this.shownWin = this.win;
    if (!this.free && this.win > 0 && !this.credited) { this.credit += this.win; this.credited = true; if (this.mode === 'player') Game.onPlayerWin(this.win); }
  }
  updateState(dt) {
    this.st += dt;
    if (this.flashT > 0) this.flashT -= dt;
    const bet = this.bet;
    if (this.state === 'showWin') {
      if (this.win > 0) {
        const rollDur = clamp(0.4 + Math.log2(1 + this.win / bet) * 0.6, 0.5, 6);
        const prev = this.shownWin; this.shownWin = Math.min(this.win, this.win * (this.st / rollDur));
        if (this.mode === 'player' && this.shownWin < this.win && Math.floor(prev * 20) !== Math.floor(this.shownWin * 20)) SFX.rollTick();
        if (this.wins.length) this.winLineI = Math.floor(this.st / 1.1) % (this.wins.length + 1) - 1;
        if (this.shownWin >= this.win && !this.credited && !this.free) { this.credited = true; this.credit += this.win; this.lastWin = this.win; this.gambleOK = this.mode === 'player'; if (this.mode === 'player') Game.onPlayerWin(this.win); }
        this.msg = this.free ? '' : 'WIN ' + fmt$(this.shownWin);
      }
      if (this.free && this.st > (this.win > 0 ? 1.6 : 0.6)) this.nextFree();
    } else this.credited = false;
    if (this.state === 'featIntro' && this.st > 2.2) this.startFeature();
    if (this.state === 'holdspin') this.updateHold(dt);
    if (this.state === 'wheel') this.updateWheel(dt);
    if (this.state === 'pick') this.updatePick(dt);
    if (this.state === 'featOutro') {
      const total = this.featTotal, dur = clamp(1 + Math.log2(1 + total / bet) * 0.6, 1.5, 7);
      const prev = this.shownWin; this.shownWin = Math.min(total, total * this.st / dur);
      if (this.mode === 'player' && Math.floor(prev * 10) !== Math.floor(this.shownWin * 10)) SFX.rollTick();
      if (this.st > dur + 2.2) { this.credit += total; if (this.mode === 'player') Game.onPlayerWin(total, true); this.win = total; this.shownWin = total; this.credited = true; this.state = 'showWin'; this.st = 99; this.free = false; this.wins = []; this.msg = 'FEATURE WIN ' + fmt$(total); this.lastWin = total; this.gambleOK = false; if (this.mode === 'player' && total / bet >= 15) { this.winLevel = total / bet; this.bigWin(); } }
    }
    if (this.state === 'gamble' && this.gambleRes && this.st > 1.6) {
      const r = this.gambleRes; this.gambleRes = null;
      if (r.win) { this.gambleAmt *= 2; this.gambleN++; if (this.gambleN >= 5) this.takeGamble(); }
      else { this.gambleAmt = 0; this.state = 'ready'; this.msg = 'GAMBLE LOST'; this.lastWin = 0; }
    }
  }
  // ---------------- free games ----------------
  nextFree() {
    if (this.freeLeft > 0) { this.freeLeft--; this.freeN++; this.spin(true); }
    else { this.featTotal = this.featWin; this.state = 'featOutro'; this.st = 0; this.shownWin = 0; this.free = false; }
  }
  startFeature() {
    const f = this.pendingFeat, bet = this.bet; this.pendingFeat = null; this.st = 0;
    this.featTotal = this.featBaseWin || 0;
    if (f === 'freegames') { this.freeLeft = [0, 0, 0, 8, 12, 20][Math.min(5, countSym(this.res, this.game.scatter).n)]; this.freeN = 0; this.featWin = this.win; this.state = 'showWin'; this.free = true; this.win = 0; this.st = 99; }
    else if (f === 'holdspin') { this.hs = playHoldSpin(this.game, bet, this.res); this.hs.cells0 = []; for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) this.hs.cells0.push(this.res.coins[r][row]); this.hs.shown = this.hs.cells0.slice(); this.hs.step = 0; this.hs.respins = 3; this.hs.t = -1; this.hs.collect = -1; this.state = 'holdspin'; }
    else if (f === 'wheel') { this.wh = playWheel(bet); this.wh.ang = 0; const segA = Math.PI * 2 / 16; this.wh.target = Math.PI * 2 * 6 + this.wh.idx * segA; this.wh.dur = 6; this.wh.done = false; this.wh.lastSeg = 0; this.state = 'wheel'; }
    else if (f === 'pick' || f === 'mystery') { this.pk = playPick(bet, f === 'mystery'); this.pk.tiles = new Array(12).fill(null); this.pk.n = 0; this.pk.done = false; this.pk.mystery = f === 'mystery'; this.state = 'pick'; this.pk.autoT = this.mode === 'npc' ? 0.6 : 999; }
  }
  // ---------------- hold & spin ----------------
  updateHold(dt) {
    const h = this.hs;
    h.t += dt;
    if (h.collect < 0) {
      if (h.t >= 1.15) {
        h.t = 0;
        if (h.step < h.steps.length) {
          const s = h.steps[h.step++];
          for (const l of s.landed) { h.shown[l.idx] = l.val; }
          h.respins = s.respins; h.lastLanded = s.landed.map(l => l.idx); h.landT = 0;
          if (this.mode === 'player') { if (s.landed.length) { s.landed.forEach((l, i) => SFX.coin()); SFX.tone(660, 0.2, { gain: 0.1, type: 'triangle' }); } else SFX.tone(200, 0.15, { gain: 0.06 }); }
        } else { h.collect = 0; h.ct = 0; h.acc = 0; }
      }
      h.landT = (h.landT || 0) + dt;
    } else {
      h.ct += dt;
      if (h.ct > 0.28) {
        h.ct = 0;
        while (h.collect < 15 && !h.shown[h.collect]) h.collect++;
        if (h.collect < 15) {
          const c = h.shown[h.collect];
          const v = c.jp ? JP[c.jp] * jpFactor(this.bet) : c.m * this.bet;
          if (c.jp) this.awardJP(c.jp);
          h.acc += v; h.collect++;
          if (this.mode === 'player') SFX.coin();
        } else {
          if (h.full) { const v = JP.GRAND * jpFactor(this.bet); this.awardJP('GRAND'); h.acc += v; }
          this.featTotal += h.acc; this.state = 'featOutro'; this.st = 0; this.shownWin = 0;
        }
      }
    }
  }
  awardJP(name) {
    const amt = JP[name] * jpFactor(this.bet);
    JP[name] = JP_SEED[name] * (0.95 + Math.random() * 0.1);
    this.flash(name + ' JACKPOT!', 3); this.coinShower(name === 'MINI' ? 30 : 120);
    Game.onJackpot(this, name, amt);
    return amt;
  }
  // ---------------- wheel ----------------
  updateWheel(dt) {
    const w = this.wh;
    if (!w.done) {
      const k = clamp(this.st / w.dur, 0, 1);
      w.ang = w.target * easeOut(Math.min(1, k * 1.0)) ;
      const seg = Math.floor((w.ang / (Math.PI * 2 / 16)) + 0.5);
      if (seg !== w.lastSeg) { w.lastSeg = seg; if (this.mode === 'player') SFX.tone(1800, 0.03, { gain: 0.05, type: 'square' }); }
      if (k >= 1) { w.done = true; w.doneT = this.st; if (w.seg.jp) w.jpAmt = this.awardJP(w.seg.jp); else if (this.mode === 'player') SFX.win(3); }
    } else if (this.st - w.doneT > 2.5) {
      this.featTotal += w.seg.jp ? (w.jpAmt || 0) : w.credit; this.state = 'featOutro'; this.st = 0; this.shownWin = 0;
    }
  }
  // ---------------- pick ----------------
  pickTile(i) {
    const p = this.pk; if (!p || p.done || p.tiles[i]) return;
    p.tiles[i] = { v: p.seq[p.n++], t: 0 };
    if (this.mode === 'player') SFX.tone(700 + p.n * 60, 0.2, { gain: 0.1, type: 'triangle' });
    if (p.n >= p.seq.length) {
      p.done = true; p.doneT = this.st;
      // reveal remaining
      let ri = 0; for (let k = 0; k < 12; k++) if (!p.tiles[k]) p.tiles[k] = { v: p.rest[ri++] || 'MINI', t: 0, dim: true };
    }
  }
  updatePick(dt) {
    const p = this.pk;
    p.tiles.forEach(t => { if (t) t.t += dt; });
    if (!p.done) { p.autoT -= dt; if (p.autoT <= 0) { p.autoT = this.mode === 'npc' ? 0.5 : 999; const free = p.tiles.map((t, i) => t ? -1 : i).filter(i => i >= 0); this.pickTile(choice(free)); } }
    else if (!p.awarded && this.st - p.doneT > 0.8) { p.awarded = true; const amt = this.awardJP(p.win); this.featTotal += amt + p.credit; }
    else if (p.awarded && this.st - p.doneT > 3.4) { this.state = 'featOutro'; this.st = 0; this.shownWin = 0; }
  }
  // ---------------- gamble ----------------
  startGamble() { if (!this.gambleOK || this.lastWin <= 0 || this.state !== 'showWin') return; this.credit -= this.lastWin; this.gambleAmt = this.lastWin; this.gambleN = 0; this.state = 'gamble'; this.st = 0; this.gambleHist = this.gambleHist || []; this.gambleOK = false; this.gambleRes = null; this.msg = 'PICK RED OR BLACK'; }
  gamble(color) {
    if (this.state !== 'gamble' || this.gambleRes) return;
    const suit = choice(['♥', '♦', '♣', '♠']), red = suit === '♥' || suit === '♦';
    const win = (color === 'red') === red;
    this.gambleRes = { suit, red, win, card: choice(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) };
    this.gambleHist.unshift(suit); this.gambleHist = this.gambleHist.slice(0, 6); this.st = 0;
    if (win) { SFX.win(2); this.msg = 'WIN ' + fmt$(this.gambleAmt * 2); } else { SFX.tone(160, 0.5, { gain: 0.12, type: 'sawtooth', fEnd: 80 }); this.msg = 'BAD LUCK'; }
    Game.onGamble(win, this.gambleAmt);
  }
  takeGamble() { if (this.state !== 'gamble' || this.gambleRes) return; this.credit += this.gambleAmt; Game.onPlayerWin(this.gambleAmt, false, true); this.msg = 'COLLECTED ' + fmt$(this.gambleAmt); this.lastWin = 0; this.gambleAmt = 0; this.state = 'ready'; SFX.coin(); }

  // ---------------- NPC autoplay ----------------
  npcTick(dt) {
    this.update(dt);
    if (this.state === 'ready' || (this.state === 'showWin' && this.st > 1.8)) {
      this.npcTimer -= dt;
      if (this.npcTimer <= 0) { this.npcTimer = rand(1.0, 3.0); if (this.credit < this.bet) this.credit += choice([20, 20, 50]); this.spin(); }
    }
  }

  // =================== RENDER ===================
  draw() {
    if (this.mode === 'idle') return;
    const x = this.ctx, sc = this.res_;
    x.setTransform(sc, 0, 0, sc, 0, 0);
    const g = this.game, t = this.t, bet = this.bet;
    drawBG(x, g, t);
    drawLogo(x, g, SW / 2, 42, 0.7, t);
    drawJackpotBar(x, g, bet, t);
    if (this.state === 'holdspin') this.drawHold(x);
    else if (this.state === 'wheel') this.drawWheel(x);
    else if (this.state === 'pick') this.drawPick(x);
    else if (this.state === 'gamble') this.drawGamble(x);
    else this.drawReels(x);
    if (this.state === 'featIntro') {
      const k = clamp(this.st / 0.4, 0, 1);
      x.fillStyle = `rgba(0,0,0,${0.55 * k})`; x.fillRect(0, RY, SW, CH * 3);
      const names = { holdspin: 'HOLD & SPIN', freegames: 'FREE GAMES', wheel: 'JACKPOT WHEEL', pick: 'TREASURE PICK', mystery: 'MYSTERY JACKPOT' };
      x.save(); x.translate(SW / 2, RY + CH * 1.5); x.scale(0.5 + easeOutBack(k) * 0.5, 0.5 + easeOutBack(k) * 0.5);
      x.shadowColor = g.theme.glow; x.shadowBlur = 40; outlineText(x, names[this.pendingFeat] || 'FEATURE', 0, -20, 92, lg(x, 0, -60, 0, 40, ['#fff', g.theme.glow, g.theme.accent]), '#1a0802', 14); x.shadowBlur = 0;
      outlineText(x, 'TRIGGERED!', 0, 70, 50, '#fff', '#000', 8);
      x.restore();
    }
    if (this.state === 'featOutro') {
      x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, RY, SW, CH * 3);
      outlineText(x, 'FEATURE COMPLETE', SW / 2, RY + 120, 60, g.theme.glow, '#000', 10);
      x.shadowColor = '#ffb000'; x.shadowBlur = 30; outlineText(x, fmt$(this.shownWin), SW / 2, RY + 260, 110, lg(x, 0, RY + 200, 0, RY + 320, ['#fff', '#ffe27a', '#ff9d00']), '#3a1a00', 12, 'Bebas Neue, Impact'); x.shadowBlur = 0;
    }
    if (this.free && this.state !== 'featOutro') {
      rr(x, SW / 2 - 230, RY - 6, 460, 46, 12); x.fillStyle = 'rgba(0,0,0,.75)'; x.fill(); x.strokeStyle = g.theme.frame; x.lineWidth = 3; x.stroke();
      outlineText(x, `FREE GAME ${this.freeN} OF ${this.freeN + this.freeLeft}   ·   ${fmt$(this.featWin || 0)}`, SW / 2, RY + 17, 26, '#fff', '#000', 5);
    }
    this.drawInfo(x);
    // flash text
    if (this.flashT > 0) {
      const k = 1 - this.flashT / this.flashT0, s = k < 0.15 ? easeOutBack(k / 0.15) : 1, a = this.flashT < 0.4 ? this.flashT / 0.4 : 1;
      x.save(); x.globalAlpha = a; x.translate(SW / 2, SH / 2 - 20); x.scale(s, s); x.rotate(Math.sin(this.t * 6) * 0.03);
      x.shadowColor = '#ff9d00'; x.shadowBlur = 50; outlineText(x, this.flashTxt, 0, 0, 120, lg(x, 0, -60, 0, 60, ['#fff', '#ffe27a', '#ff7a00']), '#3a1000', 16); x.restore();
    }
    for (const p of this.particles) { x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(Math.cos(p.r * 2), 1); x.fillStyle = rg(x, -4, -4, 1, p.s, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 0, p.s / 2, 0, 7); x.fill(); x.strokeStyle = '#6a4004'; x.lineWidth = 2; x.stroke(); x.restore(); }
    this.tex.needsUpdate = true;
  }
  drawReels(x) {
    const g = this.game, cache = symCache[g.id];
    // reel window
    rr(x, RX - 14, RY - 10, CW * 5 + 28, CH * 3 + 20, 18); x.fillStyle = g.theme.frame; x.fill();
    rr(x, RX - 6, RY - 4, CW * 5 + 12, CH * 3 + 8, 12); x.fillStyle = '#000'; x.fill();
    const showing = this.state === 'showWin' && this.win > 0 && this.wins.length;
    const cur = showing && this.winLineI >= 0 ? this.wins[this.winLineI] : null;
    const hot = new Set();
    if (showing) { const list = cur ? [cur] : this.wins; for (const w of list) for (let r = 0; r < w.n; r++) hot.add(r * 3 + LINES[w.line][r]); }
    for (let r = 0; r < 5; r++) {
      const R = this.reels[r], X = RX + r * CW;
      x.fillStyle = lg(x, 0, RY, 0, RY + CH * 3, ['#1a1a24', '#2c2c3a', '#1a1a24']); x.fillRect(X, RY, CW - 4, CH * 3);
      if (R.ant && R.phase !== 'idle') { x.fillStyle = `rgba(255,200,40,${0.25 + 0.2 * Math.sin(this.t * 20)})`; x.fillRect(X, RY, CW - 4, CH * 3); }
      x.save(); x.beginPath(); x.rect(X, RY, CW - 4, CH * 3); x.clip();
      const fast = R.phase === 'spin' && R.v > 8;
      const base = Math.floor(R.pos);
      for (let j = base + 1; j >= base - 3; j--) {
        const y = RY + (R.pos - j) * CH;
        if (y < RY - CH || y > RY + CH * 3) continue;
        const s = this.symAt(r, j), img = cache[s][fast ? 'blur' : 'sharp'];
        const row = Math.round(R.pos - j);
        const isHot = R.phase === 'idle' && hot.has(r * 3 + row);
        if (isHot) {
          const pulse = 1 + Math.sin(this.t * 10) * 0.06;
          x.save(); x.translate(X + CW / 2 - 2, y + CH / 2); x.scale(pulse, pulse);
          x.shadowColor = g.theme.glow; x.shadowBlur = 30; x.drawImage(img, -CW / 2, -CH / 2); x.restore();
        } else {
          if (showing && R.phase === 'idle') x.globalAlpha = 0.45;
          x.drawImage(img, X - 2, y);
          x.globalAlpha = 1;
        }
        // coin values (hold & spin game) on nuggets
        if (s === 'COIN' && R.phase === 'idle' && this.res && row >= 0 && row < 3 && this.res.coins[r][row]) {
          const c = this.res.coins[r][row];
          outlineText(x, c.jp || fmt$(c.m * this.bet), X + CW / 2 - 2, y + CH / 2 + 4, c.jp ? 28 : 30, c.jp ? '#ff4a6a' : '#fff', '#3a1a00', 6, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
        }
        if (s === 'WILD' && this.free && this.res && row >= 0 && row < 3 && this.res.mults[r][row] > 1 && R.phase === 'idle') {
          rr(x, X + CW - 70, y + 6, 60, 40, 10); x.fillStyle = '#c00'; x.fill(); outlineText(x, 'x' + this.res.mults[r][row], X + CW - 40, y + 27, 28, '#fff', '#000', 5);
        }
      }
      x.restore();
      // reel shading
      x.fillStyle = lg(x, 0, RY, 0, RY + CH * 3, ['rgba(0,0,0,.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.55)']); x.fillRect(X, RY, CW - 4, CH * 3);
    }
    // win lines
    if (showing) {
      const list = cur ? [cur] : this.wins;
      for (const w of list) {
        const L = LINES[w.line], col = `hsl(${(w.line * 47) % 360},100%,60%)`;
        x.lineWidth = 7; x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 16; x.lineJoin = 'round';
        x.beginPath(); for (let r = 0; r < 5; r++) { const px = RX + r * CW + CW / 2 - 2, py = RY + L[r] * CH + CH / 2; if (r === 0) x.moveTo(px - CW / 2, py); x.lineTo(px, py); if (r === 4) x.lineTo(px + CW / 2, py); } x.stroke(); x.shadowBlur = 0;
        for (let r = 0; r < w.n; r++) { x.lineWidth = 5; x.strokeRect(RX + r * CW + 4, RY + L[r] * CH + 6, CW - 12, CH - 12); }
      }
      if (cur) { rr(x, SW / 2 - 200, RY + CH * 3 - 54, 400, 46, 10); x.fillStyle = 'rgba(0,0,0,.8)'; x.fill(); outlineText(x, `LINE ${cur.line + 1}: ${cur.n} × ${cur.sym} = ${fmt$(cur.pay)}`, SW / 2, RY + CH * 3 - 31, 24, '#fff', '#000', 4); }
    }
  }
  drawInfo(x) {
    const g = this.game;
    x.fillStyle = lg(x, 0, 660, 0, SH, ['#111', '#000']); x.fillRect(0, 660, SW, SH - 660);
    x.fillStyle = g.theme.frame; x.fillRect(0, 660, SW, 4);
    const cols = [['CREDIT', fmt$(this.credit)], ['BET · 25 LINES', fmt$(this.bet)], ['WIN', fmt$(this.state === 'gamble' ? this.gambleAmt : (this.shownWin || 0))]];
    cols.forEach(([l, v], i) => { const X = 30 + i * 330; x.fillStyle = '#ffcf4a'; x.font = '22px Bungee, Impact'; x.textAlign = 'left'; x.fillText(l, X, 698); x.fillStyle = '#fff'; x.font = '48px Bebas Neue, Impact'; x.fillText(v, X, 744); });
    const showMsg = this.msg && (this.state === 'ready' || this.state === 'gamble' || (this.state === 'showWin' && !(this.win > 0 && this.wins.length && this.winLineI >= 0)));
    if (showMsg && !this.free) { rr(x, SW / 2 - 210, RY + CH * 3 - 50, 420, 40, 10); x.fillStyle = 'rgba(0,0,0,.72)'; x.fill(); outlineText(x, this.msg, SW / 2, RY + CH * 3 - 30, 24, '#8aff9a', '#000', 4); }
  }
  drawHold(x) {
    const g = this.game, h = this.hs, cache = symCache[g.id];
    rr(x, RX - 14, RY - 10, CW * 5 + 28, CH * 3 + 20, 18); x.fillStyle = g.theme.frame; x.fill();
    for (let i = 0; i < 15; i++) {
      const r = Math.floor(i / 3), row = i % 3, X = RX + r * CW, Y = RY + row * CH, c = h.shown[i];
      x.fillStyle = c ? '#3a1a04' : '#0a0a12'; x.fillRect(X, Y, CW - 4, CH - 4);
      if (c) {
        const isNew = h.lastLanded && h.lastLanded.includes(i) && h.landT < 0.5;
        const sc = isNew ? easeOutBack(clamp(h.landT / 0.35, 0, 1)) : 1;
        const col = h.collect >= 0 && i < h.collect;
        x.save(); x.translate(X + CW / 2 - 2, Y + CH / 2); x.scale(sc, sc); x.globalAlpha = col ? 0.35 : 1;
        x.shadowColor = '#ffd84a'; x.shadowBlur = 20; x.drawImage(cache.COIN.sharp, -CW / 2, -CH / 2); x.shadowBlur = 0;
        outlineText(x, c.jp || fmt$(c.m * this.bet), 0, 4, c.jp ? 28 : 34, c.jp ? '#ff4a6a' : '#fff', '#3a1a00', 6, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
        x.restore();
      } else if (h.collect < 0) {
        // spinning blank cells
        const s = cache[choice(['COIN', 'COIN', g.syms[0]])].blur; x.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 30 + i); x.drawImage(s, X - 2, Y + ((this.t * 900 + i * 50) % CH) - CH / 2); x.globalAlpha = 1;
      }
    }
    rr(x, SW / 2 - 200, RY + CH * 3 + 14, 400, 50, 12); x.fillStyle = 'rgba(0,0,0,.8)'; x.fill(); x.strokeStyle = g.theme.frame; x.lineWidth = 3; x.stroke();
    if (h.collect < 0) outlineText(x, `RESPINS: ${h.respins}`, SW / 2, RY + CH * 3 + 40, 30, h.respins === 3 ? '#8aff9a' : '#fff', '#000', 5);
    else outlineText(x, `COLLECTING: ${fmt$(h.acc || 0)}`, SW / 2, RY + CH * 3 + 40, 30, '#ffe27a', '#000', 5);
  }
  drawWheel(x) {
    const g = this.game, w = this.wh, cx = SW / 2, cy = RY + 250, R = 230;
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    x.save(); x.translate(cx, cy); x.rotate(-w.ang);
    const segA = Math.PI * 2 / 16;
    WHEEL_SEGS.forEach((s, i) => {
      const a0 = -Math.PI / 2 + (i - 0.5) * segA;
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a0, a0 + segA); x.closePath();
      x.fillStyle = s.jp ? ({ MINI: '#2a9a4a', MINOR: '#2a6aca', MAJOR: '#8a2aca', GRAND: '#d01a3a' })[s.jp] : (i % 2 ? '#f2f2f8' : '#ffd84a'); x.fill();
      x.strokeStyle = '#333'; x.lineWidth = 2; x.stroke();
      x.save(); x.rotate(a0 + segA / 2); x.translate(R * 0.66, 0); x.rotate(Math.PI / 2);
      x.font = s.jp ? '22px Bungee, Impact' : '30px Bebas Neue, Impact'; x.fillStyle = s.jp ? '#fff' : '#222'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(s.jp || fmt$(s.m * this.bet), 0, 0); x.restore();
    });
    for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i - 0.5) * segA; x.fillStyle = (Math.floor(this.t * 6) + i) % 2 ? '#fff' : '#ffd84a'; x.beginPath(); x.arc(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8), 6, 0, 7); x.fill(); }
    x.lineWidth = 10; x.strokeStyle = g.theme.frame; x.beginPath(); x.arc(0, 0, R + 4, 0, 7); x.stroke();
    x.restore();
    x.fillStyle = rg(x, cx - 10, cy - 10, 4, 50, ['#fff', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(cx, cy, 44, 0, 7); x.fill();
    outlineText(x, 'SPIN', cx, cy + 2, 26, '#c00', '#fff', 3);
    // pointer
    x.fillStyle = '#ff2a4a'; x.beginPath(); x.moveTo(cx - 22, cy - R - 30); x.lineTo(cx + 22, cy - R - 30); x.lineTo(cx, cy - R + 14); x.closePath(); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
    if (w.done) { const s = w.seg; outlineText(x, s.jp ? s.jp + '!' : fmt$(w.credit), SW / 2, RY + 470, 70, '#ffe27a', '#000', 10); }
  }
  drawPick(x) {
    const g = this.game, p = this.pk;
    x.fillStyle = 'rgba(0,10,30,.6)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    outlineText(x, p.mystery ? 'MYSTERY JACKPOT — PICK TO MATCH 3' : 'PICK THE PEARLS — MATCH 3 TO WIN', SW / 2, RY + 18, 30, g.theme.glow, '#000', 6);
    const jcol = { MINI: '#4ae07a', MINOR: '#3ab0ff', MAJOR: '#b05aff', GRAND: '#ff3a5a' };
    const counts = { MINI: 0, MINOR: 0, MAJOR: 0, GRAND: 0 }; p.tiles.forEach(t => { if (t && !t.dim) counts[t.v]++; });
    for (let i = 0; i < 12; i++) {
      const cx = RX + 70 + (i % 6) * 154, cy = RY + 120 + Math.floor(i / 6) * 190, t = p.tiles[i];
      if (!t) {
        const bob = Math.sin(this.t * 2 + i) * 6;
        x.fillStyle = rg(x, cx - 18, cy - 18 + bob, 4, 64, ['#ffffff', '#e8e0ff', '#9a8ac8', '#3a2a6a']); x.beginPath(); x.arc(cx, cy + bob, 58, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(cx - 20, cy - 22 + bob, 14, 8, -0.6, 0, 7); x.fill();
        outlineText(x, '?', cx, cy + bob + 4, 44, '#5a3a9a', '#fff', 4);
      } else {
        const s = easeOutBack(clamp(t.t / 0.35, 0, 1)), win = p.done && t.v === p.win && !t.dim;
        x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha = t.dim ? 0.35 : 1;
        if (win) { x.shadowColor = jcol[t.v]; x.shadowBlur = 40 + Math.sin(this.t * 10) * 15; }
        x.fillStyle = rg(x, -10, -10, 4, 64, ['#fff', jcol[t.v], '#111']); x.beginPath(); x.arc(0, 0, 60, 0, 7); x.fill(); x.shadowBlur = 0;
        x.lineWidth = 4; x.strokeStyle = '#fff'; x.stroke();
        outlineText(x, t.v, 0, 4, 24, '#fff', '#000', 5);
        x.restore();
      }
    }
    const tip = p.done ? `${p.win} JACKPOT  ${fmt$(JP[p.win] * jpFactor(this.bet))}${p.credit ? ' + ' + fmt$(p.credit) + ' BONUS' : ''}` : (this.mode === 'player' ? 'CLICK A PEARL ON THE SCREEN (or press SPIN)' : '');
    outlineText(x, tip, SW / 2, RY + CH * 3 - 6, 28, '#fff', '#000', 5);
  }
  drawGamble(x) {
    const g = this.game, r = this.gambleRes;
    x.fillStyle = 'rgba(0,30,10,.85)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    outlineText(x, 'GAMBLE — RED OR BLACK DOUBLES YOUR WIN', SW / 2, RY + 24, 30, '#fff', '#000', 6);
    const cx = SW / 2, cy = RY + 250;
    rr(x, cx - 100, cy - 140, 200, 280, 18);
    if (r && this.st > 0.3) {
      x.fillStyle = '#fafafa'; x.fill(); x.strokeStyle = '#333'; x.lineWidth = 4; x.stroke();
      x.fillStyle = r.red ? '#d01a2a' : '#111'; x.font = '120px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r.suit, cx, cy + 20);
      x.font = 'bold 48px Georgia, serif'; x.fillText(r.card, cx - 60, cy - 95);
    } else {
      x.fillStyle = (Math.floor(this.t * 4) % 2) ? '#b01a2a' : '#1a1a2a'; x.fill(); x.strokeStyle = '#ffd84a'; x.lineWidth = 6; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(cx - 90, cy - 130 + i * 28); x.lineTo(cx + 90, cy - 102 + i * 28); x.stroke(); }
    }
    outlineText(x, 'HISTORY', 170, RY + 120, 22, '#ffd84a', '#000', 4);
    (this.gambleHist || []).forEach((s, i) => { x.fillStyle = (s === '♥' || s === '♦') ? '#ff3a4a' : '#ddd'; x.font = '40px Georgia, serif'; x.textAlign = 'center'; x.fillText(s, 120 + (i % 3) * 50, RY + 180 + Math.floor(i / 3) * 56); });
    outlineText(x, 'GAMBLE AMOUNT', SW - 190, RY + 120, 22, '#ffd84a', '#000', 4);
    outlineText(x, fmt$(this.gambleAmt), SW - 190, RY + 180, 50, '#fff', '#000', 6, 'Bebas Neue, Impact');
    outlineText(x, 'TO WIN ' + fmt$(this.gambleAmt * 2), SW - 190, RY + 230, 24, '#8aff9a', '#000', 4);
  }
}
