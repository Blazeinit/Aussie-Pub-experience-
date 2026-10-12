// final verification: each venue boots, a pokie cash-out prints a ticket, patrons eat in the lounge, pool opens
import { launch, done } from './harness.mjs';
const venue = process.argv[2] || 'royal';
const g = await launch({ quality: 'high', port: 8160 + ['royal', 'rsl', 'dive'].indexOf(venue), venue });
console.log(venue, 'boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
// pokie cash-out ticket
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES.find(m=>m.skin)||G.MACHINES[0]; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { G.release(n); n.pos.set(0,0,12); } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=42.5; window.__sim(1.5); G.Game.collect(); window.__sim(0.9); })()`);
await g.shot('verify', venue + '_ticket');
await g.ev(`(()=>{ const G=window.__game; window.__sim(3); try{ G.Game.leaveMachine(); }catch(e){} window.__sim(1); })()`);
// force a patron meal at a lounge chair
const meal = await g.ev(`(()=>{ const G=window.__game; const s=G.SPOTS.find(s=>s.kind==='chair'&&s.area==='lounge'&&!s.occ); const n=G.NPCS.find(n=>n.role==='patron'&&n.state==='idle'&&!n.mg); if(!s||!n) return 'nospot';
  G.release(n); G.claim(n,s); G.seatNPC(n); window.__sim(0.5); if(!n.meal){ const r=Math.random; Math.random=()=>0; G.NpcMeals.seat(n); Math.random=r; } window.__sim(14);
  window.__mealPos=[s.pos.x,s.pos.z]; return JSON.stringify({meal:n.meal&&n.meal.kind, served:!!(n.meal&&n.meal.m), dine:n.a.dine}); })()`);
console.log('meal', meal);
const mp = await g.ev('JSON.stringify(window.__mealPos||[8,-1])'); const [mx, mz] = JSON.parse(mp);
await g.at(mx + 1.6, mz + 1.6, Math.atan2(1.6, 1.6), -0.35, 0.5); await g.shot('verify', venue + '_meal');
// pool opens and closes
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4.4,0,-13); window.PoolGame.begin(0,'Spud'); window.__sim(0.5); })()`);
await g.shot('verify', venue + '_pool');
await g.ev(`(()=>{ window.__MG.key('KeyQ'); window.__sim(0.5); })()`);
const after = await g.ev(`(()=>{ const s=window.PoolGame.state(); return JSON.stringify({pool:!!s, hud:document.getElementById('hud').style.visibility, mg:!!window.__MG.active}); })()`);
console.log('after pool', after);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
