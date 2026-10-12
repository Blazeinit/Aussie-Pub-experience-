import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low' });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.player.pos.set(-4,0,-6); G.Game.entered=true; window.__sim(5); const M=G.Moments; M.cleanup(); M.id='blackout'; M.started=false; M.at=0; window.__sim(10); })()`);
console.log(await g.ev(`JSON.stringify({md:window.__game.Moments.dark, nd:window.__game.Night.dark, cur:!!window.__game.Moments.cur, exp:window.__game.renderer.toneMappingExposure, t:window.__game.Game.state.time})`));
await g.shot('moments','dbg_blackout'); console.log(await g.ev(`window.__game.renderer.toneMappingExposure+' '+window.__game.Night.dark`)); await g.close(); done();
