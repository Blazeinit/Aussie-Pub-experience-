import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8205 });
const r = await g.ev(`JSON.stringify(window.__game.colliders.filter(c=>c.lv===0&&!c.off&&c.x1>26&&c.x0<58&&c.z1>26.5&&c.z0<47).map(c=>[+c.x0.toFixed(2),+c.x1.toFixed(2),+c.z0.toFixed(2),+c.z1.toFixed(2)]))`);
console.log(r);
await g.close(); done();
