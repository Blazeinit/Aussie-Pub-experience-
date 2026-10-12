// each Night Moment in turn: node moments.mjs [ids...]
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high' });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4,0,-6); G.Game.entered=true; G.Game.state.drunk=0; window.__sim(5); })()`);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['blackout', 'bucks', 'wake', 'footy', 'inspector', 'busker'];
const go = (id, sec) => g.ev(`(()=>{ const G=window.__game, M=G.Moments; M.cleanup(); M.id='${id}'; M.started=false; M.at=0; window.__sim(${sec}); })()`);
for (const id of ids) {
  await go(id, 40);
  const who = { bucks: 'Gaz', wake: 'Pam', inspector: 'Whitlock', busker: 'Sparrow' }[id];
  const tgt = who && await g.ev(`(()=>{ const n=window.__game.NPCS.filter(n=>/${who}/.test(n.name)).pop(); return n?[n.pos.x,n.pos.z]:null; })()`);
  if (tgt) { const [tx, tz] = tgt; const dx = 0 - tx, dz = -6 - tz, l = Math.hypot(dx, dz) || 1; const px = tx + dx / l * 2.6, pz = tz + dz / l * 2.6; await g.at(px, pz, Math.atan2(-(tx - px), -(tz - pz)), -0.12, 1); await g.shot('moments', id + '_b'); console.log(id, 'npc at', tx.toFixed(1), tz.toFixed(1)); continue; }
  const pos = { blackout: [-4, -6, 0.3, -0.05], bucks: [-5, -7, 1.57, -0.05], wake: [8, 0, -1.2, -0.05], footy: [-3, -5, 0.2, 0.05], inspector: [-5.5, -9, 1.57, -0.05], busker: [8, 0.5, -1.2, -0.05] }[id];
  await g.at(pos[0], pos[1], pos[2], pos[3], 1);
  await g.shot('moments', id + '_a');
  console.log(id, 'ticker=', await g.ev(`window.__game.Night.ticker||''`), 'cur=', await g.ev(`!!window.__game.Moments.cur`), 'npcs=', await g.ev(`window.__game.NPCS.length`));
}
// run the skull dare end to end
if (ids.includes('bucks')) {
  await go('bucks', 14);
  await g.ev(`(()=>{ const G=window.__game; const lad=G.NPCS.filter(n=>/Gaz/.test(n.name)&&n.eventTalk).pop(); lad.eventTalk(); })()`);
  await g.shot('moments', 'bucks_dare');
  await g.ev(`(()=>{ [...document.querySelectorAll('.opt')][0].click(); window.__sim(14); })()`);
  await g.ev(`(()=>{ const G=window.__game; const it=G.interactables.find(i=>i.id==='item'); it.action(); window.__sim(0.6); })()`);
  console.log('after pickup', await g.ev(`JSON.stringify(window.__game.Moments.cur.skull)`));
  for (let i = 0; i < 25; i++) { await g.ev(`window.__game.sipDrink(); window.__sim(1)`); const st = await g.ev(`JSON.stringify(window.__game.Moments.cur&&window.__game.Moments.cur.skull)`); if (st === 'null' || st === undefined) break; }
  await g.shot('moments', 'bucks_result');
  console.log('wallet', await g.ev(`window.__game.Game.state.wallet`), 'log', await g.ev(`JSON.stringify(window.__game.Game.state.night.log.slice(-3).map(l=>l.text))`));
  console.log('skull state', await g.ev(`JSON.stringify(window.__game.Moments.cur && window.__game.Moments.cur.skull)`), 'items', await g.ev(`window.__game.Game.items.length`));
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
