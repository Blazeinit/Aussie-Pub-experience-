// the one-map town: the street, both new pubs outside and in, people, venue switching
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8195 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const yaw = (dx, dz) => Math.atan2(-dx, -dz);
const shots = [
  ['street_west', -16, 7.5, yaw(-1, -0.25), 0.08],      // looking up the street at the Anchor
  ['dive_front', -37, 9.5, 0, 0.12],
  ['dive_in_bar', -33, -1, yaw(-1, -0.6), 0.02],
  ['dive_in_stage', -36, -6, yaw(0.25, -1), 0.06],
  ['dive_in_pokies', -33, -9, yaw(1, -0.3), 0.04],
  ['street_east', 14, 13, yaw(1, 0.55), 0.06],         // over the road at the RSL
  ['rsl_front', 38.5, 13.5, Math.PI, 0.14],
  ['rsl_foyer', 38.5, 28.4, yaw(-0.4, 1), 0.04],
  ['rsl_bistro', 39.5, 33.5, yaw(-1, 0.9), 0.02],
  ['rsl_bar', 44, 29.6, yaw(0.3, 1), 0.02],
  ['rsl_gaming', 43.5, 37.6, yaw(0.5, 1), 0.08],
  ['rsl_terrace', 51.4, 41, yaw(1, -0.1), 0.05],
];
for (const [n, x, z, yw, p] of shots) {
  await g.at(x, z, yw, p, 1.0);
  const v = await g.ev(`window.__game.VENUE.id + ' npcs:' + window.__game.NPCS.filter(n=>n.h.root.visible).length`);
  console.log(n, v);
  await g.shot('clubs', n);
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
