import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8191 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); G.player.pos.set(-7.3,0,-9.6); G.player.yaw=Math.PI/2; window.__sim(1); })()`);
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : ['parma', 'burger', 'chips', 'kebab', 'pizza', 'dimsim'];
const shots = { parma: [0.6, 2.0, 3.4, 4.1, 5.0], burger: [0.5, 1.2, 1.6, 2.2], chips: [0.8, 1.6, 2.4], kebab: [0.8, 1.3, 1.7], pizza: [0.8, 1.3, 1.7], dimsim: [0.8, 1.6, 2.4] };
for (const k of kinds) {
  await g.ev(`(()=>{ const G=window.__game; G.Game.state.hunger=90; G.Game.state.drunk=30; G.player.pos.set(-7.3,0,-9.6); G.player.yaw=Math.PI/2; G.player.pitch=0; window.__sim(0.5); const m=G.makeFood('${k}'); window.__ok=G.Eat.begin('${k}', m, { place: ()=>{} }); })()`);
  console.log(k, 'started', await g.ev(`window.__ok`));
  let t0 = 0;
  for (const t of (shots[k] || [0.8, 2, 3.5])) { await g.ev(`window.__sim(${(t - t0).toFixed(2)})`); t0 = t; await g.shot('eat', `${k}_${String(t).replace('.', '_')}s`); }
  await g.ev(`window.__sim(60)`);
  console.log(k, 'done', await g.ev(`JSON.stringify({active: !!window.__game.Eat.active, hunger: Math.round(window.__game.Game.state.hunger), drunk: Math.round(window.__game.Game.state.drunk)})`));
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
await g.close(); done();
