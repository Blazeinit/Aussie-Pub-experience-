// where each RSL row is: positions + a shot standing back from each new machine type
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8192, w: 844, h: 390, mobile: true, venue: 'rsl' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const pos = JSON.parse(await g.ev(`JSON.stringify(window.__game.MACHINES.map(m=>({g:m.def.game, x:+m.seatW.x.toFixed(2), z:+m.seatW.z.toFixed(2), fx:+m.fw.x.toFixed(2), fz:+m.fw.z.toFixed(2), smoke:!!m.def.smoke})))`));
console.log(JSON.stringify(pos));
for (const id of ['te1', 'cashx', 'dtrain', 'bgold', 'twolf']) {
  const m = pos.find(p => p.g === id); if (!m) continue;
  const cx = m.x + m.fx * 1.9, cz = m.z + m.fz * 1.9, yaw = Math.atan2(m.fx, m.fz);
  await g.at(cx, cz, yaw, 0.12, 1.2); await g.shot('howto2', id);
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
