import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8132 });
const ids = JSON.parse(await g.ev(`JSON.stringify(Object.keys(window.__game ? {} : {}).length ? [] : ${JSON.stringify([])})`));
const all = await g.ev(`JSON.stringify([...new Set(window.__game.MACHINES.map(m=>m.def.game))])`);
for (const id of JSON.parse(all)) console.log(id.padEnd(8), JSON.stringify(await g.ev(`window.__rtp('${id}', 400000, 1)`)));
await g.close(); done();
