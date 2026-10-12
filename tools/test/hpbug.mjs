import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8152 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
const i = await g.ev(`window.__game.MACHINES.findIndex(m=>m.def.game==='hp')`);
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.Game.state.time=19.5; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state="idle"; } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); m.spin(); window.__sim(6);
 for(let r=0;r<5;r++) for(let row=0;row<3;row++) if((r+row)%2===0){ m.res.grid[r][row]='COIN'; m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; } m.pendingFeat='holdspin'; m.startFeature(); })()`);
const log = [];
for (let k = 0; k < 14; k++) {
  await g.ev(`window.__sim(1.5)`);
  const s = await g.ev(`(()=>{const m=window.__game.MACHINES[${i}]; return m.state+':'+(m.hs?m.hs.collect+'/'+m.hs.shown.filter(Boolean).length:'-')})()`);
  log.push(s); await g.shot('hpbug', `t${String(k).padStart(2,'0')}_${s.replace(/[:\/]/g,'_')}`);
}
console.log(log.join(' | '));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
