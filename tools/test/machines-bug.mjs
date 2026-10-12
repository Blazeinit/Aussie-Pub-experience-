// bug-test every machine: spins, features, gamble, NPC play, redraw cost
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8134 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const n = await g.ev(`window.__game.MACHINES.length`);
const fails = [];
for (let i = 0; i < n; i++) {
  const r = await g.ev(`(()=>{
    const G=window.__game, m=G.MACHINES[${i}]; const out={id:m.def.game, skin:!!m.skin};
    G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state='idle'; } }); m.occupiedBy=null;
    G.Game.state.time=19.5; G.Game.state.drunk=0; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=500; m.betIdx=2;
    let spins=0, feat=0, stuck=0, maxCredit=0;
    for (let k=0;k<5;k++) { G.Game.state.time=19.5; if (!m.canSpin()) { window.__sim(1); } m.spin(); window.__sim(2.5);
      let guard=0; while (!m.canSpin() && guard++<60) { if (m.state==='gamble') m.takeGamble(); window.__sim(1); }
      if (!m.canSpin()) { stuck++; break; } spins++; if (m.hs) feat++; }
    out.spins=spins; out.stuck=stuck; out.state=m.state; out.credit=Math.round(m.credit*100)/100;
    // gamble round trip
    m.state='showWin'; m.lastWin=2; m.win=2; m.gambleOK=true; m.credit+=2; m.startGamble(); window.__sim(0.5); m.gamble('red'); window.__sim(3); if (m.state==='gamble') m.takeGamble(); out.gambleState=m.state;
    // forced hold & spin
    for (let r=0;r<5;r++) for (let row=0;row<3;row++) { m.res.grid[r][row]=(r+row)%2===0?'COIN':m.res.grid[r][row]; if ((r+row)%2===0) m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; }
    if (["am","fm","hp","outback"].includes(m.def.game)) { m.pendingFeat='holdspin'; const c0=m.credit; m.state='featIntro'; m.st=0; window.__sim(35); out.hs=m.state; out.hsGain=Math.round((m.credit-c0)*100)/100; }
    try { G.Game.leaveMachine(); } catch(e) { out.leaveErr=String(e); }
    window.__sim(1); out.after=m.state;
    return out; })()`);
  console.log(JSON.stringify(r));
  if (r.stuck || r.leaveErr) fails.push(r);
}
// NPC play + redraw cost
const perf = await g.ev(`(()=>{ const G=window.__game; const res=[]; for (const m of G.MACHINES) { m.setMode('npc'); }
  const t0=performance.now(); for (let k=0;k<60;k++) for (const m of G.MACHINES) { m.npcTick(1/30); m.draw(); } const dt=(performance.now()-t0)/60; return Math.round(dt*100)/100; })()`);
console.log('ms per frame to tick+draw all', n, 'machines in NPC mode:', perf);
console.log('FAILS', fails.length);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently/.test(e)).join('\n'));
await g.close(); done();
