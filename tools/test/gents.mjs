import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8124 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(3); })()`);
const views = [['door', -12.2, -16.6, 0, -0.05], ['mid', -11.4, -19.0, 0, -0.1], ['mid_left', -11.4, -19.0, Math.PI / 2, -0.1], ['mid_right', -11.4, -19.4, -Math.PI / 2, -0.1], ['back', -11.4, -20.2, Math.PI, -0.05], ['trough', -12.0, -21.2, 0, -0.35], ['outside', -9.0, -17.0, Math.PI / 2, 0.0]];
for (const [n, x, z, yaw, p] of views) { await g.at(x, z, yaw, p, 1.2); await g.shot('gents', n); }
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
