import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8131 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
const idx = JSON.parse(await g.ev(`JSON.stringify(window.__game.MACHINES.map((m,i)=>[i,m.def.game]))`));
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['qotn', 'bigred', 'buffalo', 'dragon', 'outback'];
for (const [i, id] of idx.filter(([i, id]) => want.includes(id))) {
  await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.Game.state.time=19.5; G.Game.state.drunk=0; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state="idle"; } }); m.occupiedBy=null; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); })()`);
  await g.shot('classics', `${id}_a_idle`);
  await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; m.spin(); window.__sim(6.5); })()`);
  await g.shot('classics', `${id}_b_stopped`);
  if (['qotn', 'bigred', 'buffalo'].includes(id)) {
    // force the free games and watch a few spins
    await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}], sc=m.game.scatter; m.spin(); m.res.grid[0][0]=sc; m.res.grid[2][1]=sc; m.res.grid[4][2]=sc; m.pendingFeat=null; window.__sim(6); })()`);
    console.log(id, 'state', await g.ev(`window.__game.MACHINES[${i}].state`), 'free', await g.ev(`window.__game.MACHINES[${i}].free`), 'left', await g.ev(`window.__game.MACHINES[${i}].freeLeft`));
    await g.ev(`window.__sim(4)`); await g.shot('classics', `${id}_c_free`);
  }
  await g.ev(`(()=>{ const G=window.__game; window.__sim(80); try{ G.Game.leaveMachine(); }catch(e){} G.Game.state.time=19.5; window.__sim(1); })()`);
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently/.test(e)).join('\n'));
await g.close(); done();
