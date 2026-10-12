// A whole night in one venue (VENUE=royal|rsl|dive): street, bar, a pokie session with a TITO cash-out, patrons eating
// at tables, every dish eaten in first person, a kitchen-pass plate, overheard chat, a conversation, the settings
// panel, touch controls, then closing time and the end-of-night summary.  Screenshots: tools/test/out/tour_<venue>/
import { launch, done } from './harness.mjs';
const venue = process.env.VENUE || 'royal', dir = 'tour_' + venue;
const g = await launch({ quality: process.env.Q || 'low', port: +(process.env.PORT || 8156), venue });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
const log = [];
const ev = g.ev, sim = s => ev(`window.__sim(${s})`);
const clear = `(()=>{ const G=window.__game; G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); document.getElementById('subtitle').innerHTML=''; })()`;
await ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); G.Game.state.wallet=400; window.__sim(1); })()`);
await g.at(-7.5, 21.2, 0.12, 0.04, 1); await g.shot(dir, '01_street');
await g.at(-3.5, -6, -Math.PI / 2 - 0.3, -0.05, 1); await g.shot(dir, '02_bar');

// ---- pokie session: sit, insert, spin, collect (ticket out of the printer)
const pk = await ev(`(()=>{ const G=window.__game; const m=G.MACHINES.find(m=>!m.occupiedBy && !m.def.smoke && m.skin) || G.MACHINES.find(m=>!m.occupiedBy);
  window.__m=G.MACHINES.indexOf(m); G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=50; window.__sim(1.5); for (let i=0;i<3;i++){ G.Game.deckSpin(); window.__sim(5); } if (m.state==='showWin') m.endShowWin(); window.__sim(2); return m.def.game+' credit '+m.credit.toFixed(2); })()`);
log.push('pokie ' + pk);
await ev(`(()=>{ const G=window.__game; G.Game.collect(); window.__sim(0.9); })()`);
await g.shot(dir, '03_tito_printing');
await sim(1); await g.shot(dir, '04_tito_out');
log.push('tickets ' + await ev(`JSON.stringify(window.__game.Game.state.tickets)`));
await ev(`(()=>{ const G=window.__game; G.Game.leaveMachine(); window.__sim(1); })()`);
log.push('after leaving: seated=' + await ev(`!!window.__game.player.seated`) + ' machine ' + await ev(`(()=>{const m=window.__game.MACHINES[window.__m]; return m.mode+':'+m.state+':'+m.credit})()`));

// ---- patrons with a feed at the lounge tables / beer garden
const meals = await ev(`(()=>{ const G=window.__game, M=G.NpcMeals; G.Game.state.time=19; let n=0;
  for (const p of G.NPCS) if (p.kind==='sit' && p.spot && (p.spot.area==='lounge'||p.spot.area==='garden') && !p.meal) { const r=Math.random; Math.random=()=>0; try { M.seat(p); } finally { Math.random=r; } if (p.meal) { p.meal.next=0; n++; } }
  // seat a few more patrons at lounge tables so there is something to look at
  const free = G.SPOTS.filter(s=>s.kind==='chair' && s.area==='lounge' && !s.occ);
  for (const s of free.slice(0,3)) { const p=G.NPCS.find(q=>q.role==='patron' && q.state==='idle' && q.kind==='stand' && !q.regular && !q.mg); if (!p) break; G.release(p); G.claim(p,s); G.seatNPC(p); if (!p.meal) { const r=Math.random; Math.random=()=>0; try { M.seat(p); } finally { Math.random=r; } } if (p.meal) { p.meal.next=0; n++; } }
  G.player.pos.set(7.4,0,4.5); G.player.yaw=Math.PI; G.player.pitch=-0.25; window.__sim(0.5); return n+' meals, list '+M.list.length; })()`);
log.push('meals ' + meals);
await ev(`(()=>{ const G=window.__game; G.Game.closePanel(); G.player.pos.set(-7.5,0,-12); window.__sim(0.5); G.Game.closePanel(); })()`);   // stand at the far end of the bar so the plates arrive unseen
const lt = await ev(`(()=>{ const G=window.__game, l=G.NpcMeals.list.filter(n=>n.meal&&n.meal.m&&n.spot.area==='lounge'); const p=l[0]||G.NpcMeals.list[0]; return p? [p.pos.x,p.pos.z,p.ry]:null })()`);
if (lt) {
  const [x, z, ry] = lt; await ev(clear);
  await g.at(x + Math.sin(ry) * 0.9 + Math.cos(ry) * 1.2, z + Math.cos(ry) * 0.9 - Math.sin(ry) * 1.2, ry + Math.PI + 0.9, -0.35, 2.5);
  await g.shot(dir, '05_patron_eating');
  await sim(0.6); await g.shot(dir, '06_patron_bite');
  await sim(40); await g.shot(dir, '07_patron_later');
  log.push('meal progress ' + await ev(`JSON.stringify(window.__game.NpcMeals.list.map(n=>n.meal && (n.meal.kind+':'+n.meal.bites+'/'+(n.meal.chunks?n.meal.chunks.length:'?'))))`));
}

// ---- every dish, eaten in first person
await ev(clear);
const dishes = await ev(`Object.keys(window.__game.FOODS)`);
const ate = [];
for (const k of dishes) {
  const r = await ev(`(()=>{ const G=window.__game; G.Game.state.hunger=90; G.player.pos.set(-7.3,0,-9.6); G.player.yaw=Math.PI/2; G.player.pitch=0; window.__sim(0.3); const m=G.makeFood('${k}'); const ok=G.Eat.begin('${k}', m, { place: ()=>{} }); return ok; })()`);
  if (['parma', 'pie', 'nuts', 'pav', 'hsp', 'scallop'].includes(k)) { await sim(1.6); await g.shot(dir, '08_eat_' + k); }
  await sim(45);
  ate.push(k + ':' + r + '>' + await ev(`(()=>{const G=window.__game; const a=G.Eat.active; if (a) G.Eat.stop(true); return (a?'STILL':'done')+' h'+Math.round(G.Game.state.hunger)})()`));
}
log.push('dishes ' + ate.join(' '));

// ---- kitchen pass: order a parma at the bar, the bartender brings it out
await ev(`(()=>{ const G=window.__game; G.NPCS.forEach(n=>{ if(n.role!=='bartender' && n.pos.distanceTo(G.player.pos)<4 && n.pos.x<-3) n.gone=true; }); G.player.pos.set(-7.4,0,-9.0); G.player.yaw=Math.PI/2; G.Game.state.hunger=85; window.__sim(1); G.Game.order(null, 0, 'parma', 'spentFood'); })()`);
let phases = [];
for (let i = 0; i < 50; i++) { await sim(0.5); const j = JSON.parse(await ev(`(()=>{ const b=window.__game.bartender(); return JSON.stringify({ph:b.job&&b.job.phase, items:window.__game.Game.items.length}); })()`)); if (phases[phases.length - 1] !== j.ph) phases.push(j.ph); if (i === 8) await g.shot(dir, '09_kitchen_pass'); if (j.items) break; }
log.push('kitchen pass ' + phases.join('>'));
await g.shot(dir, '10_plate_on_bar');

// ---- overheard
const oh = await ev(`(()=>{ const G=window.__game; G.player.pos.set(-3,0,0); const ns=G.NPCS.filter(n=>n!==G.bartender() && n.state==='idle' && !n.mg).slice(0,2); if (ns.length<2) return 'no npcs'; ns[0].pos.set(-1,0,0); ns[1].pos.set(-0.2,0,0.3); G.Overheard.cd=0; G.Game.state.flags.gossip=[]; window.__sim(0.2); const out=[]; for(let i=0;i<16;i++){ window.__sim(0.5); const t=document.getElementById('subtitle').textContent; if (t && out[out.length-1]!==t) out.push(t); } return out.join(' / '); })()`);
log.push('overheard ' + oh.slice(0, 220));

// ---- a conversation with a local
const talk = await ev(`(()=>{ const G=window.__game; const n=G.NPCS.find(n=>(n.regular||n.local) && n.state==='idle'); if (!n) return 'nobody'; G.player.pos.set(n.pos.x+1.0,0,n.pos.z+0.2); window.__sim(0.5); G.Game.talkTo(n); window.__sim(3); return (n.regular||n.local)+' dlg='+G.DLG.active+' panel='+!document.getElementById('panel').classList.contains('hidden'); })()`);
log.push('talk ' + talk);
await g.shot(dir, '11_talk');
await ev(`(()=>{ const G=window.__game; if (G.DLG.active) G.DLG.close(); G.Game.closePanel(); })()`);

// ---- pool: a frame on this venue's table (break, then walk out with Q)
await ev(`(()=>{ const G=window.__game; G.player.pos.set(-4.4,0,-13); window.PoolGame.begin(0,'A local'); window.__sim(0.3); })()`);
await g.page.keyboard.press('Space'); await sim(0.1); await g.page.keyboard.down('Space'); await sim(0.9); await g.page.keyboard.up('Space');
for (let i = 0; i < 16; i++) { await sim(0.5); }
await g.shot(dir, '115_pool_break');
log.push('pool ' + await ev(`(()=>{const s=window.PoolGame.state(); return s? s.phase+' '+s.match.lastMessage+' moved='+s.sim.balls.filter(b=>b.id&&Math.hypot(b.x-(-0),b.z-(-0.615))>0.25).length : 'closed'})()`));
await g.page.keyboard.press('KeyQ'); await sim(0.3);
log.push('pool closed ' + await ev(`!window.__MG.active && getComputedStyle(document.getElementById('hud')).visibility`));

// ---- settings and touch
await ev(`(()=>{ document.getElementById('btnPauseSettings').click(); })()`); await sim(0.3); await g.shot(dir, '12_settings');
await ev(`(()=>{ const b=[...document.querySelectorAll('#panel button')].find(b=>/back|done|close/i.test(b.textContent)); if (b) b.click(); document.getElementById('resume').classList.add('hidden'); })()`);
await ev(`(()=>{ window.__touchOn(); const G=window.__game; G.Game.paused=false; G.player.pos.set(-3,0,-3); window.__sim(0.5); })()`); await g.shot(dir, '13_touch');

// ---- closing time and the summary
await ev(`(()=>{ const G=window.__game, D=G.DAYS[G.Game.state.day]; G.Game.state.time=D.close-0.3; window.__sim(3); })()`);
await g.shot(dir, '14_last_drinks');
await ev(`(()=>{ const G=window.__game; G.Game.closePanel(); G.Game.endNight('home'); })()`);
await g.page.waitForTimeout(2500);
await g.shot(dir, '15_summary');
log.push('mode after night ' + await ev(`window.__game.Game.mode`));
console.log(log.join('\n'));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
