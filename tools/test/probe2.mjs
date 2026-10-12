import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low' });
console.log(await g.ev(`JSON.stringify(window.__game.colliders.filter(c=>!c.lv && c.x0<-4.5 && c.x1>-7.5 && c.z0<13.2 && c.z1>11.8))`));
console.log(await g.ev(`JSON.stringify(window.__game.colliders.filter(c=>!c.lv && c.z0<13.2 && c.z1>11.8 && c.x1-c.x0 > 3))`));
await g.close(); done();
