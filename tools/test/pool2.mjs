import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8151 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4.4,0,-13); window.PoolGame.begin(5,'Spud'); window.__sim(0.3); })()`);
const { page } = g;
await page.mouse.move(900, 400); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
const log = [];
for (let turn = 0; turn < 14; turn++) {
  const ph = await g.ev(`(()=>{const s=window.PoolGame.state(); return s? s.phase+':'+s.match.turn+':'+(s.match.winner):'closed'})()`);
  log.push(ph);
  if (ph === 'closed' || ph.includes('over')) break;
  if (ph.startsWith('aim:0')) {
    // aim at the legal ball nearest and shoot at power ~0.6 by setting state directly through pointer: hold then release
    await page.mouse.move(300 + turn * 40, 330 + (turn % 3) * 40);
    await page.mouse.down(); await g.ev('window.__sim(0.5)'); await page.mouse.up();
  } else if (ph.startsWith('place:0')) { await page.mouse.click(900, 360); }
  for (let i = 0; i < 12; i++) { await g.ev('window.__sim(0.5)'); await page.waitForTimeout(30); }
  if (turn === 3) await g.shot('pool', '05_mid');
}
console.log(log.join(' | '));
await g.shot('pool', '06_end');
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
