// final smoke test of the offline file on an emulated iPhone (landscape): boot, start, walk, floating stick, pokie
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8190, w: 844, h: 390, mobile: true, file: 'Last-Drinks-offline.html', venue: 'rsl' });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
// thumb down on the left half: the stick should jump there and move the player
const p0 = await g.ev(`JSON.stringify([window.__game.player.pos.x, window.__game.player.pos.z])`);
const cdp = await g.page.context().newCDPSession(g.page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 260, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 200, id: 1 }] });
await g.ev('window.__sim(1.2)');
await g.shot('final', 'stick');
const st = await g.ev(`JSON.stringify({ float: document.getElementById('tStick').classList.contains('float'), left: document.getElementById('tStick').style.left, pos: [window.__game.player.pos.x, window.__game.player.pos.z] })`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('before', p0, 'stick', st);
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES.find(m=>m.def.game==='llmp'); G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { G.release(n); n.pos.set(0,0,12); } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=20; window.__sim(1.2); })()`);
await g.shot('final', 'pokie');
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D|CORS|file:\/\//.test(e)).join('\n'));
await g.close(); done();
