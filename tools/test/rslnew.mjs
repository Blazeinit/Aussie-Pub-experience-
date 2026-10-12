// the RSL's own machines: the bank, a seat at each new one, a forced feature on two of them
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8186, venue: 'rsl' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
console.log(await g.ev(`JSON.stringify(window.__game.MACHINES.map(m=>m.def.game))`));
await g.at(8, -14.2, 0, 0.18, 1.5); await g.shot('rslnew', 'bank_back');
await g.at(11.5, -14.2, 0.5, 0.18, 1.5); await g.shot('rslnew', 'bank_back_right');
for (const id of ['llmp', 'llhl', 'dtrain', 'cashx', 'bgold', 'twolf']) {
  await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES.find(m=>m.def.game==='${id}'); try{G.Game.leaveMachine();}catch(e){} G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { G.release(n); n.pos.set(0,0,12); } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=100; window.__sim(1); m.spin(); window.__sim(5); })()`);
  await g.shot('rslnew', id + '_seat');
  if (id === 'llmp' || id === 'cashx') {
    await g.ev(`(()=>{ const m=window.__game.MACHINES.find(m=>m.def.game==='${id}'); for(let r=0;r<5;r++) for(let row=0;row<3;row++) if((r+row)%2===0){ m.res.grid[r][row]='COIN'; m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; } m.pendingFeat='holdspin'; m.startFeature(); window.__sim(4); })()`);
    await g.shot('rslnew', id + '_hold');
    await g.ev(`window.__sim(30)`);
  }
}
console.log('rtp', JSON.stringify(await g.ev(`['llmp','llhl','dtrain','cashx','bgold','twolf'].map(id=>[id, window.__rtp(id, 60000).rtp])`)));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
