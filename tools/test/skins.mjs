// seat at each licensed machine and shoot idle / spin / win / hold & spin
import { launch, done } from './harness.mjs';
const only = process.argv.slice(2);
const g = await launch({ quality: 'high', port: 8130 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
const ids = await g.ev(`JSON.stringify(window.__game.MACHINES.map((m,i)=>[i,m.def.game,m.skin?1:0]))`);
console.log(ids);
const list = JSON.parse(ids).filter(([i, id, s]) => s && (!only.length || only.includes(id)));
// the bank first
await g.at(8, -14.2, 0, 0.18, 1.5); await g.shot('skins', '00_bank_left');
await g.at(11, -14.2, 0.35, 0.18, 1.5); await g.shot('skins', '00_bank_right');
for (const [i, id] of list) {
  await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.Game.state.time=19.5; G.Game.state.drunk=0; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state="idle"; } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); })()`);
  await g.shot('skins', `${id}_a_idle`);
  await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; m.spin(); window.__sim(0.7); })()`);
  await g.shot('skins', `${id}_b_spin`);
  await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; window.__sim(5); })()`);
  await g.shot('skins', `${id}_c_stopped`);
  await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; window.__sim(6); for(let r=0;r<5;r++) for(let row=0;row<3;row++) if((r+row)%2===0){ m.res.grid[r][row]='COIN'; m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; } m.pendingFeat='holdspin'; m.startFeature(); window.__sim(3); })()`);
  await g.shot('skins', `${id}_d_hold`);
  await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; window.__sim(30); try{ G.Game.leaveMachine(); }catch(e){} G.Game.state.time=19.5; window.__sim(1); })()`);
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
