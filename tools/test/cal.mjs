import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8133 });
const all = JSON.parse(await g.ev(`JSON.stringify([...new Set(window.__game.MACHINES.map(m=>m.def.game))])`));
for (const id of all) console.log(JSON.stringify(await g.ev(`window.__rtpCal('${id}', 120000, 0.9)`)));
await g.close(); done();
