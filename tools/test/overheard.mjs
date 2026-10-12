import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8140 });
await g.startNight();
const r = await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-3,0,0);
  const ns=G.NPCS.filter(n=>n!==G.bartender()); ns[0].pos.set(-1,0,0); ns[1].pos.set(-0.2,0,0.3); ns[0].state='idle'; ns[1].state='idle';
  G.Overheard.cd=0; window.__sim(0.2); const dbg=[G.Game.mode,G.Game.uiOpen,ns[0].dist2,ns[1].dist2,ns[0].pos.x,ns[0].state]; window.__dbg=dbg; G.Overheard.cd=0; dbg.push(G.Overheard.cd, !!G.Overheard.cur, !!G.Cine.active, G.DLG.active?1:0); const out=[]; for(let i=0;i<30;i++){ window.__sim(0.5); out.push(document.getElementById('subtitle').textContent); } return {out:out.filter(x=>x).slice(0,6), gossip:G.Game.state.flags.gossip, dbg:window.__dbg}; })()`);
console.log(JSON.stringify(r));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
