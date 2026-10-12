import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8126 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(2); })()`);
const walk = async (x0, z0, yaw, secs) => {
  await g.at(x0, z0, yaw, 0, 0.3);
  const rec = [];
  for (let i = 0; i < secs; i++) { await g.ev(`window.__game.keys.KeyW=true; window.__sim(1)`); rec.push(await g.ev(`(()=>{const p=window.__game.player.pos; return [+p.x.toFixed(2), +p.z.toFixed(2), ...window.__game.dynamic.doors.slice(0,2).map(d=>+d.ang.toFixed(2))]})()`)); }
  await g.ev(`window.__game.keys.KeyW=false`);
  return rec;
};
console.log('IN  ', JSON.stringify(await walk(0, 6, 0, 6)));
console.log('OUT ', JSON.stringify(await walk(0, -2, Math.PI, 6)));
console.log('INoff', JSON.stringify(await walk(-0.9, 6, 0, 6)));
console.log('doors', await g.ev(`JSON.stringify(window.__game.dynamic.doors.map(d=>({x:d.pivot.position.x,z:d.pivot.position.z,ang:d.ang})))`));
console.log('cols near door', await g.ev(`JSON.stringify(window.__game.colliders.filter(c=>!c.lv && c.z0<3.2 && c.z1>0.5 && c.x0<3.5 && c.x1>-3.5))`));
await g.close(); done();
