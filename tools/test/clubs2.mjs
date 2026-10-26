// functional: start at the RSL from the day card, order at its bar, staff are where they should be, pool at the Anchor
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8198 });
const { page } = g;
await page.click('#btnNew'); await page.click('.dcard[data-diff=normal]'); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('.vchip[data-v=rsl]').scrollIntoView()); await page.click('.vchip[data-v=rsl]');
console.log('chip on', await g.ev(`document.querySelector('.vchip[data-v=rsl]').className + ' | ' + window.__game.Game.startAt`));
await page.click('#btnGo'); await page.waitForTimeout(800); await g.ev('window.__sim(2)');
console.log('spawn', await g.ev(`JSON.stringify([window.__game.player.pos.x.toFixed(1), window.__game.player.pos.z.toFixed(1), window.__game.VENUE.id])`));
const staff = await g.ev(`JSON.stringify(window.__game.NPCS.filter(n=>n.staff||n.band).map(n=>[n.name, n.club, n.pos.x.toFixed(1), n.pos.z.toFixed(1), !!n.mg, n.h.root.visible]))`);
console.log('staff', staff);
// walk in and order a schooner + schnitty at the RSL bar
await g.at(45.8, 31.2, Math.PI, 0, 0.8);
await g.ev(`(()=>{ const G=window.__game; G.Clubs.order('rsl', 'schooner', 8, 'schnitty'); window.__sim(4); })()`);
console.log('items', await g.ev(`JSON.stringify(window.__game.Game.items.map(i=>i.kind))`), 'venue', await g.ev('window.__game.VENUE.id'));
await g.shot('clubs2', 'rsl_order');
await g.ev(`(()=>{ const G=window.__game; const it=G.interactables.find(i=>i.id==='item'); it && it.action(); window.__sim(0.5); })()`);
console.log('holding', await g.ev(`!!window.__game.player.drink`));
// the Anchor: staff behind the bar, pool table
await g.at(-38, -4, Math.atan2(1, 0.2) , 0, 1.0);
await g.shot('clubs2', 'dive_bar_staff');
await g.at(-34.6, -6.6, Math.PI / 2, 0, 0.6);
await g.ev(`(()=>{ window.PoolGame.begin(0, 'Slick Rick'); window.__sim(1); })()`);
console.log('pool', await g.ev(`(()=>{ const s=window.PoolGame.state(); return s ? s.opp.name + ' @ ' + s.opp.n.pos.x.toFixed(1)+','+s.opp.n.pos.z.toFixed(1) : 'none'; })()`));
await g.ev(`(()=>{ window.__MG.key('KeyQ'); window.__sim(0.5); })()`);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
