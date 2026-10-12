import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8150 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4.4,0,-13); window.PoolGame.begin(5,'Spud'); window.__sim(0.5); })()`);
await g.shot('pool', '01_place');
const { page } = g;
// place the cue ball with a click then aim at the pack and shoot
await page.mouse.move(900, 400); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
await page.mouse.move(300, 360); await page.waitForTimeout(200);
await g.shot('pool', '02_aim');
await page.mouse.down(); await page.waitForTimeout(900); await g.shot('pool', '03_power'); await page.mouse.up();
for (let i = 0; i < 6; i++) { await g.ev('window.__sim(0.7)'); await page.waitForTimeout(100); }
await g.shot('pool', '04_after_break');
const st = await g.ev(`(()=>{ return document.getElementById('poolCv') ? 'cv' : 'nocv'; })()`);
console.log(st);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
