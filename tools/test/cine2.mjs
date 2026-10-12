import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8181, cine: 'full' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Cine.end(true); G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); G.Game.entered=true; G.Game.askedHome=true; G.player.pos.set(-4,0,-6); window.__sim(1); G.Cine.lastCall(G.bartender()); window.__sim(0.8); })()`);
console.log(await g.ev(`JSON.stringify({a:!!window.__game.Cine.active, i:window.__game.Cine.active&&window.__game.Cine.active.i, cam:window.__game.camera.position.toArray().map(v=>+v.toFixed(2)), fade:document.getElementById('fade').style.opacity, mode: window.__game.Game.mode})`));
await g.shot('cine', 'lc_a');
await g.ev(`window.__sim(2.5)`); await g.shot('cine', 'lc_b');
await g.ev(`window.__sim(2.0)`); await g.shot('cine', 'lc_c');
await g.close(); done();
