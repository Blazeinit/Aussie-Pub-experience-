import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8125 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(3); })()`);
const views = [['street', -7.5, 21.2, 0.12, 0.04], ['door_far', 0, 14, 0, 0.02], ['door_near', 0, 6.2, 0, 0.02], ['door_close', 0.4, 3.9, -0.15, 0.0], ['inside_door', 0, -1.4, Math.PI, 0.0], ['left', -16, 12, -0.9, 0.05], ['right', 16, 12, 0.9, 0.05], ['corner', 22, 14, 0.75, 0.1]];
for (const [n, x, z, yaw, p] of views) { await g.at(x, z, yaw, p, 1.5); await g.shot('ext', n); }
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
