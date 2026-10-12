// Patrons eating at the lounge tables: seat four with a feed, let the plates arrive, watch them eat.
import { launch, done } from './harness.mjs';
const g = await launch({ quality: process.env.Q || 'low', port: +(process.env.PORT || 8157), venue: process.env.VENUE || null });
await g.startNight();
const ev = g.ev, sim = s => ev(`window.__sim(${s})`);
const r = await ev(`(()=>{ const G=window.__game, M=G.NpcMeals; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); G.Game.state.time=19;
  const kinds=['parma','burger','chips','pie']; let k=0, out=[];
  const seats = G.SPOTS.filter(s=>s.kind==='chair' && s.area==='lounge' && Math.abs(s.pos.x-5.5)<1 && s.pos.z<0);
  for (const s of seats) { if (s.occ) G.release(s.occ);
    const p=G.NPCS.find(q=>q.role==='patron' && q.state==='idle' && !q.regular && !q.mg && !(q.spot && q.spot.kind==='chair')); if (!p) break;
    G.release(p); G.claim(p,s); G.seatNPC(p); M.leave(p); p.meal={ kind:kinds[k%4], type:G.FOODS[kinds[k%4]].type, spot:s, m:null, next:0, bites:0, pending:true }; M.list.push(p); k++; out.push(p.name+':'+p.meal.kind); }
  G.player.pos.set(-7.5,0,-12); window.__sim(1.0); return out.join(' '); })()`);
console.log('seated', r);
console.log('served', await ev(`JSON.stringify(window.__game.NpcMeals.list.map(n=>n.meal && (n.meal.kind+':'+!!n.meal.m)))`));
await g.at(5.5, -3.1, Math.PI, -0.32, 0.6);
await g.shot('meals', '01_table');
await sim(0.75); await g.shot('meals', '02_bite');
await sim(30); await g.shot('meals', '03_later');
console.log('progress', await ev(`JSON.stringify(window.__game.NpcMeals.list.map(n=>n.meal && (n.meal.kind+':'+n.meal.bites+'/'+(n.meal.chunks?n.meal.chunks.length:'?'))))`));
await sim(120); await g.shot('meals', '04_finished');
console.log('end', await ev(`JSON.stringify(window.__game.NpcMeals.list.map(n=>n.meal && (n.meal.kind+':'+n.meal.bites+' dine='+n.a.dine+' drink='+n.a.holdDrink)))`));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
