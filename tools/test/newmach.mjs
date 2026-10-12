// which machines are in each venue, and do their real screens load (served build and offline file)
import { launch, done } from './harness.mjs';
const venue = process.argv[2] || 'rsl', file = process.argv[3] || null;
const g = await launch({ quality: 'low', port: 8180, venue, file });
console.log(venue, file || 'served', 'boot', g.bootErr || 'ok');
const info = await g.ev(`JSON.stringify({ venue: window.__game.VENUE.id, machines: window.__game.MACHINES.map(m => m.def.game + (m.skin ? '*' : ''))})`);
console.log(info);
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
await g.at(8, -14.2, 0, 0.18, 1.5); await g.shot('newmach', `${venue}_${file ? 'off' : 'srv'}_bank`);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
