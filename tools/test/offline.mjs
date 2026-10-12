import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', file: 'Last-Drinks-offline.html' });
console.log('boot', g.bootErr || 'ok');
console.log(await g.ev(`JSON.stringify({skins: window.__game.MACHINES.filter(m=>m.skin).length, of: window.__game.MACHINES.length, assets: Object.keys(window.__ASSETS||{}).length, song: window.__music.SONGS.map(s=>s.name)})`));
await g.startNight();
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[0]; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state='idle'; } }); m.occupiedBy=null; G.Game.state.time=19.5; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=100; window.__sim(1.5); })()`);
await g.shot('offline', 'seated');
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently/.test(e)).join('\n'));
await g.close(); done();
