// node example.mjs  — boots the game, starts a night, sits at a pokie, takes shots. Copy this for new scenarios.
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high' });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[0]; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); })()`);
await g.shot('example', '01_pokie');
await g.at(7.1, -14.6, 0, 0.05, 1.5); await g.shot('example', '02_machine_bank');
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
