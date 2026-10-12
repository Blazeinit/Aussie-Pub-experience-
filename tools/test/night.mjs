import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high' });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4,0,-6); G.Game.entered=true; window.__sim(8); })()`);
console.log('goals', await g.ev(`JSON.stringify(window.__game.Game.state.tonight.goals)`));
await g.shot('night', '01_hud_goals');
// complete a social goal, add rep, drive up a tier
await g.ev(`(()=>{ const N=window.__game.Night; N.ev('talk','Bev'); N.ev('talk','Mick'); N.ev('talk','Shaz'); N.ev('shouted'); N.ev('tipped'); N.addRep(20,'test'); window.__sim(2); })()`);
await g.shot('night', '02_goal_done');
console.log('rep', await g.ev(`window.__game.Night.rep()+' '+window.__game.Night.tier().name+' limit '+window.__game.Night.tabLimit()`));
// tab purchase
await g.ev(`(()=>{ const G=window.__game.Game; G.useTab=true; G.order('pot',6.5); window.__sim(1); })()`);
console.log('tab', await g.ev(`window.__game.Night.tab()+' wallet '+window.__game.Game.state.wallet`));
// bar menu
await g.ev(`window.__game.player.pos.set(-7.5,0,-6); window.__game.Game.openBar && 0`);
// jump to last call
await g.ev(`(()=>{ const G=window.__game, D=G.DAYS[G.Game.state.day]; G.Game.state.time=D.close-0.3; window.__sim(3); })()`);
await g.shot('night', '03_lastcall_banner');
await g.ev(`window.__sim(3.2)`);
await g.shot('night', '04_lastcall_panel');
await g.ev(`window.__game.Game.closePanel(); window.__game.Game.endNight('home')`);
await g.page.waitForTimeout(1500);
await g.shot('night', '05_summary');
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter/.test(e)).join('\n'));
await g.close(); done();
