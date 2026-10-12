// every dish: a contact sheet of the models on the bar, then eat each one in first person
import { launch, done } from './harness.mjs';
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : null;
const g = await launch({ quality: 'high', port: 8190 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const list = JSON.parse(await g.ev(`JSON.stringify(Object.keys(window.__game.FOODS))`));
const ks = kinds || list;
// one close-up per dish
for (const k of ks) {
  await g.ev(`(()=>{ const G=window.__game; for (const o of (window.__fm||[])) G.scene.remove(o); window.__fm=[]; const m=G.makeFood('${k}'); m.position.set(-8.62, 1.115, -9.8); if (m.userData.type==='hand') { m.rotation.x = 0; m.position.y = 1.115; } G.scene.add(m); window.__fm.push(m); })()`);
  await g.at(-8.12, -9.8, Math.PI / 2, -0.82, 0.6);
  await g.ev(`window.__sim(0.4)`);
  await g.shot('food', `model_${k}`);
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
await g.close(); done();
