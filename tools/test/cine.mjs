import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8180, cine: 'full' });
console.log('boot', g.bootErr || 'ok');
await g.page.click('#btnNew'); await g.page.click('.dcard[data-diff=normal]'); await g.page.click('#btnGo'); await g.page.waitForTimeout(600);
const stepShot = async (name, secs) => { await g.ev(`window.__sim(${secs})`); await g.shot('cine', name); };
console.log('active', await g.ev(`!!window.__game.Cine.active`));
await stepShot('01_opening_a', 1.0); await stepShot('02_opening_b', 3.0); await stepShot('03_opening_c', 3.0);
console.log('after', await g.ev(`!!window.__game.Cine.active`));
await g.ev(`window.__sim(6)`);
console.log('ended', await g.ev(`!!window.__game.Cine.active`), 'fov', await g.ev(`window.__game.camera.fov`));
// last drinks
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); G.player.pos.set(-4,0,-6); const D=G.DAYS[G.Game.state.day]; G.Game.state.time=D.close-0.28; window.__sim(1); })()`);
await stepShot('04_lastcall_a', 1.2); await stepShot('05_lastcall_b', 2.2);
await g.ev(`window.__sim(8)`);
console.log('lastcall panel', await g.ev(`!document.getElementById('panel').classList.contains('hidden')`), 'cine', await g.ev(`!!window.__game.Cine.active`));
// skip test
await g.ev(`window.__game.Game.closePanel(); window.__game.Cine.play([{dur:20,a:{p:[0,2,5],l:[0,2,0],fov:50}}],{}); window.__sim(1); window.__game.keys.KeyE=true; window.__sim(1.0); window.__game.keys.KeyE=false;`);
console.log('skipped', await g.ev(`!window.__game.Cine.active`));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
await g.close(); done();
