import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8185, venue: 'rsl' });
for (const id of ['llmp', 'llhl', 'dtrain', 'cashx', 'bgold', 'twolf']) console.log(id, JSON.stringify(await g.ev(`window.__rtpCal('${id}', 120000, 0.9)`)));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
