// boot each venue: signage, lineup, gaming room, bar
import { launch, done } from './harness.mjs';
const which = process.argv.slice(2).length ? process.argv.slice(2) : ['rsl', 'dive'];
let port = 8140;
for (const v of which) {
  const g = await launch({ quality: 'high', port: port++, venue: v });
  console.log(v, 'boot', g.bootErr || 'ok');
  await g.startNight();
  await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
  console.log(v, await g.ev(`JSON.stringify({ lineup: window.__game.MACHINES.map(m=>m.def.game).join(','), npcs: window.__game.NPCS.length, bartender: window.__game.bartender().name, price: window.__game.Game.drinkPrice('pot'), goal: window.__game.STORY.goal().slice(0,60) })`));
  await g.at(-7.5, 21.2, 0.12, 0.04, 1.2); await g.shot('venues', `${v}_01_street`);
  await g.at(0, 8, 0, 0.05, 1.2); await g.shot('venues', `${v}_02_facade`);
  await g.at(2, -3, 0, 0.0, 1.5); await g.ev(`window.__game.Game.closePanel()`); await g.shot('venues', `${v}_03_inside`);
  await g.at(7.4, -14.4, 0, 0.15, 1.5); await g.shot('venues', `${v}_04_gaming`);
  await g.at(-6.5, -5.5, Math.PI / 2 + 0.3, -0.05, 1.5); await g.shot('venues', `${v}_05_bar`);
  console.log(v, 'errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
  await g.close();
}
done();
