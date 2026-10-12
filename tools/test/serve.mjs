// order food at the bar: kitchen pass, plate carried over, placed, eaten
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8192 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); G.NPCS.forEach(n=>{ if(n.role!=='bartender' && n.pos.distanceTo(G.player.pos)<6 && n.pos.x<-3) { n.gone=true; } }); G.player.pos.set(-7.4,0,-9.0); G.player.yaw=Math.PI/2; G.Game.state.hunger=85; G.Game.state.wallet=100; window.__sim(1); })()`);
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : ['burger'];
for (const k of kinds) {
  await g.ev(`window.__game.Game.order(null, 0, '${k}', 'spentFood')`);
  let seen = [];
  for (let i = 0; i < 40; i++) { await g.ev(`window.__sim(0.5)`); const st = await g.ev(`(()=>{ const b=window.__game.bartender(); return JSON.stringify({ph:b.job&&b.job.phase, x:+b.pos.x.toFixed(1), z:+b.pos.z.toFixed(1), plate:!!(b.job&&b.job.plate), items:window.__game.Game.items.length}); })()`); const j = JSON.parse(st); if (!seen.length || seen[seen.length - 1] !== j.ph) seen.push(j.ph); if (i === 6 || i === 10 || i === 14) await g.shot('serve', `${k}_t${i}`); if (j.items) break; }
  console.log(k, 'phases', seen.join(' > '));
  await g.shot('serve', `${k}_placed`);
  await g.ev(`window.__sim(1.5)`); await g.shot('serve', `${k}_steam`);
  const hit = await g.ev(`(()=>{ const G=window.__game; const ia=G.interactables.find(i=>i.id==='item'); if(!ia) return 'none'; ia.action(); return 'ate'; })()`);
  console.log('interact', hit, 'eating', await g.ev(`!!window.__game.Eat.active`));
  await g.ev(`window.__sim(70)`);
  console.log(k, 'after', await g.ev(`JSON.stringify({eating:!!window.__game.Eat.active, hunger:Math.round(window.__game.Game.state.hunger), items:window.__game.Game.items.length})`));
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
await g.close(); done();
