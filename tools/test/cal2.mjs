import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8133 });
const all = JSON.parse(await g.ev(`JSON.stringify([...new Set(window.__game.MACHINES.map(m=>m.def.game))])`));
const link = ['am','gc','pm','hp','ldl1','ldl2','ldl3','ldl4','fm','te1','te2','outback'];
for (const id of all) {
  if (link.includes(id)) { const L = await g.ev(`window.__rtpLine('${id}', 600000)`); console.log(id.padEnd(8), 'line@1 =', L, ' -> payScale for 0.90 with F=0.27:', ((0.9 - 0.27) / L).toFixed(2)); }
  else { const r = await g.ev(`window.__rtpCal('${id}', 700000, 0.9)`); console.log(id.padEnd(8), JSON.stringify(r)); }
}
await g.close(); done();
