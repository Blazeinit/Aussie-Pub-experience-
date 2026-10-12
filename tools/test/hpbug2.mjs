// Natural-path repro for the Happy & Prosperous medal bug: real spins, a forced hold & spin in the middle,
// then normal spins again; plus an NPC leaving mid-feature and an NPC walking onto the player's machine.
// Saves the machine's own canvas (tools/test/out/hpbug2/*.png) so the medal can be checked frame by frame.
import { launch, done, SP } from './harness.mjs';
import fs from 'fs';
const port = +(process.env.PORT || 8153);
const g = await launch({ quality: 'low', port });
await g.startNight();
fs.mkdirSync(SP + 'hpbug2', { recursive: true });
const snap = async (name) => {
  const d = await g.ev(`(()=>{ const m=window.__game.MACHINES[window.__hpI]; return m.canvas ? m.canvas.toDataURL('image/png') : null })()`);
  if (d) fs.writeFileSync(SP + 'hpbug2/' + name + '.png', Buffer.from(d.split(',')[1], 'base64'));
};
const st = () => g.ev(`(()=>{ const m=window.__game.MACHINES[window.__hpI]; return m.mode+':'+m.state+':'+(m.hs?'hs':'-')+':c'+m.credit.toFixed(2)+':w'+(m.win||0).toFixed(2)+':occ='+(m.occupiedBy==='player'?'P':m.occupiedBy?'N':'-') })()`);
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2);
  window.__hpI = G.MACHINES.findIndex(m=>m.def.game==='hp');
  // count draws of the medal in the wrong state: wrap drawSkin and check the state on every paint
  const M = G.MACHINES[window.__hpI]; window.__bad = []; const P = Object.getPrototypeOf(M), orig = P.drawSkin;
  if (!P.__wrapped) { P.__wrapped = true; P.drawSkin = function(){ try { return orig.call(this); } catch(e) { window.__bad.push('throw '+this.def.game+' '+this.state+' '+e.message); throw e; } }; }
})()`);
const i = await g.ev('window.__hpI');
const free = `(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.NPCS.forEach(n=>{ if (n.spot && n.spot.machine===m) { n.spot.occ=null; n.spot=null; n.pos.set(0,0,12); n.state="idle"; } }); m.occupiedBy=null; })()`;
const log = [];
const forceHS = `(()=>{ const m=window.__game.MACHINES[${i}]; for(let r=0;r<5;r++) for(let row=0;row<3;row++) if((r+row)%2===0){ m.res.grid[r][row]='COIN'; m.res.coins[r][row]={m:[1,2,5,10][(r+row)%4]}; } m.pendingFeat='holdspin'; m.startFeature(); })()`;
const spinAndWait = async () => { await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; if (m.state==='showWin') m.endShowWin(); m.spin(); })()`); for (let k = 0; k < 40; k++) { await g.ev('window.__sim(0.5)'); const s = await st(); if (/:(ready|showWin):/.test(s)) break; } };

// ---- A: natural spins, a hold & spin, natural spins again
await g.ev(free);
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.Game.state.time=19.5; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); })()`);
for (let k = 0; k < 6; k++) { await spinAndWait(); log.push('A' + k + ' ' + await st()); await snap('A' + String(k).padStart(2, '0')); }
await g.ev(forceHS);
for (let k = 0; k < 40; k++) { await g.ev('window.__sim(1)'); const s = await st(); if (k % 4 === 0) await snap('A_hs' + String(k).padStart(2, '0')); if (/:(ready|showWin):/.test(s)) { log.push('A-hs end ' + s); break; } }
for (let k = 0; k < 6; k++) { await spinAndWait(); log.push('A+' + k + ' ' + await st()); await snap('A_after' + String(k).padStart(2, '0')); }
await g.shot('hpbug2', 'A_after');
await g.ev(`window.__game.Game.leaveMachine()`); await g.ev('window.__sim(1)');
log.push('A stood ' + await st());

// ---- B: an NPC sits at the machine, hits hold & spin and wants to leave in the middle of it
const B = await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; const sp=G.SPOTS.find(s=>s.machine===m); const n=G.NPCS.find(n=>n.role!=='bartender' && !n.regular && n.state==='idle' && !(n.spot&&n.spot.machine)) || G.NPCS.find(n=>n.role!=='bartender');
  window.__npc=G.NPCS.indexOf(n); G.release(n); G.claim(n, sp); G.seatNPC(n); window.__sim(0.2); m.spin(); window.__sim(5); return n.name+' '+m.mode+' '+m.state; })()`);
log.push('B start ' + B + ' ' + await st());
await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; if (m.state==='showWin') m.endShowWin(); m.state='ready'; m.spin(); window.__sim(5); })()`);
await g.ev(forceHS);
await g.ev(`(()=>{ const n=window.__game.NPCS[window.__npc]; n.timer=0; window.__sim(3); })()`);
log.push('B npc wants to leave mid-feature: ' + await st() + ' npcStill=' + await g.ev(`window.__game.NPCS[window.__npc].spot && window.__game.NPCS[window.__npc].spot.machine===window.__game.MACHINES[${i}]`));
await snap('B_npc_hs');
// last drinks style release in the middle of a feature: the npc finishes it at once and takes the money
await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; if (!m.hs || m.state!=='holdspin') { m.state='ready'; m.credit=50; m.spin(); window.__sim(5); if (m.state==='showWin') m.endShowWin(); m.state='ready'; m.spin(); window.__sim(5);} })()`);
await g.ev(forceHS);
await g.ev(`window.__sim(2)`);
log.push('B before release ' + await st());
await g.ev(`(()=>{ const G=window.__game, n=G.NPCS[window.__npc]; G.release(n); n.pos.set(0,0,12); n.state='idle'; window.__sim(1); })()`);
log.push('B released ' + await st());
await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; G.player.pos.copy(m.seatW); G.Game.sitAt(m); m.credit=200; window.__sim(1.5); })()`);
log.push('B sat ' + await st()); await snap('B_sat'); await g.shot('hpbug2', 'B_sat');
await spinAndWait(); log.push('B spin ' + await st()); await snap('B_spin');

// ---- C: the player is seated; NPCs must not see the pokie seat as free
const C = await g.ev(`(()=>{ const G=window.__game, m=G.MACHINES[${i}]; const sp=G.SPOTS.find(s=>s.machine===m); const free = G.SPOTS.filter(s => !s.occ && !s.hidden && !(s.machine && s.machine.occupiedBy)); return 'player machine offered to NPCs: ' + free.includes(sp); })()`);
log.push('C ' + C);
// ---- D: closing time in the middle of a feature: it is paid out and collected as a ticket
await g.ev(`(()=>{ const m=window.__game.MACHINES[${i}]; if (m.state==='showWin') m.endShowWin(); m.state='ready'; m.spin(); window.__sim(5); })()`);
await g.ev(forceHS); await g.ev('window.__sim(2)');
log.push('D before close ' + await st() + ' tickets=' + await g.ev('JSON.stringify(window.__game.Game.state.tickets)'));
await g.ev(`(()=>{ const G=window.__game; G.Game.endNight('close'); })()`);
log.push('D after close ' + await st() + ' tickets=' + await g.ev('JSON.stringify(window.__game.Game.state.tickets)'));
console.log(log.join('\n'));
console.log('bad', JSON.stringify(await g.ev('window.__bad')));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
