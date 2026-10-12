import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4,0,-6); G.Game.entered=true; G.Game.arrivals=6; G.Game.arriveT=0; window.__sim(120); })()`);
console.log(await g.ev(`JSON.stringify(window.__game.NPCS.filter(n=>n.pos.z>6).map(n=>[n.name,+n.pos.x.toFixed(1),+n.pos.z.toFixed(1),n.state,n.path.length]))`));
await g.ev(`(()=>{ const G=window.__game; const n=mkN; })`).catch(()=>{});
await g.close(); done();
