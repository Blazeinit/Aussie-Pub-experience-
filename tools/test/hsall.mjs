// Hold & spin on every skinned machine: force a feature, play it out, spin again; saves each machine's canvas
// mid-feature, after the feature and after the next spin (tools/test/out/hsall/<game>_*.png).
import { launch, done, SP } from './harness.mjs';
import fs from 'fs';
const g = await launch({ quality: 'low', port: +(process.env.PORT || 8154), venue: process.env.VENUE || null });
await g.startNight();
fs.mkdirSync(SP + 'hsall', { recursive: true });
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
const games = (process.env.GAMES || 'am,pm,gc,hp,ldl1,te1,fm').split(',');
const log = [];
for (const id of games) {
  const i = await g.ev(`window.__game.MACHINES.findIndex(m=>m.def.game==='${id}')`);
  if (i < 0) { log.push(id + ' not in venue'); continue; }
  const snap = async n => { const d = await g.ev(`window.__game.MACHINES[${i}].canvas.toDataURL('image/jpeg',0.8)`); fs.writeFileSync(SP + `hsall/${id}_${n}.jpg`, Buffer.from(d.split(',')[1], 'base64')); };
  const st = () => g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; return m.state+':'+(m.hs?'hs':'-')+':'+m.credit.toFixed(2) })()`);
  await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; const n=m.occupiedBy; if (n && n!=='player') { G.release(n); n.pos.set(0,0,12); n.state='idle'; }
    G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=100; window.__sim(1); m.spin(); window.__sim(6); if (m.state==='showWin') m.endShowWin();
    for(let r=0;r<5;r++) for(let row=0;row<3;row++) if((r+row)%2===0){ m.res.grid[r][row]='COIN'; m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; } m.pendingFeat='holdspin'; m.startFeature(); window.__sim(4); })()`);
  log.push(id + ' mid ' + await st()); await snap('1mid');
  for (let k = 0; k < 40; k++) { await g.ev('window.__sim(1)'); if (/^(ready|showWin)/.test(await st())) break; }
  log.push(id + ' end ' + await st()); await snap('2end');
  await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; m.endShowWin(); m.spin(); window.__sim(7); })()`);
  log.push(id + ' next ' + await st()); await snap('3next');
  await g.ev(`(()=>{ const G=window.__game; G.Game.leaveMachine(); window.__sim(0.5); })()`);
}
console.log(log.join('\n'));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
