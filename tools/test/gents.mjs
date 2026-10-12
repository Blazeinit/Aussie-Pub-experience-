import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8124 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(3); })()`);
const views = [['door', -12.45, -16.6, 0, -0.05], ['enter', -12.4, -18.7, 0.25, -0.12], ['left', -12.0, -20.0, Math.PI / 2, -0.1], ['right', -12.2, -20.3, -Math.PI / 2, -0.1], ['trough', -12.0, -21.1, 0, -0.35], ['basin', -12.3, -18.9, -Math.PI / 2, -0.15], ['outside', -9.0, -17.0, Math.PI / 2, 0.0]];
for (const [n, x, z, yaw, p] of views) { await g.at(x, z, yaw, p, 1.2); await g.shot('gents', n); }
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
