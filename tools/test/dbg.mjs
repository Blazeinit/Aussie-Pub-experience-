import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4,0,-6); G.Game.entered=true; window.__sim(8); G.Game.endNight('home'); })()`);
await g.page.waitForTimeout(2500);
console.log(await g.ev(`JSON.stringify({mode:window.__game.Game.mode, sum:document.getElementById('summary').className, len:document.getElementById('summaryInner').innerHTML.length, fade:document.getElementById('fade').style.opacity})`));
await g.shot('night', '05b_summary');
console.log('errors', g.errs.join('\n'));
await g.close(); done();
