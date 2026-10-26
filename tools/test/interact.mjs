// set a drink down, physics landings, sit anywhere, cheers, telly
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8210 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
console.log('tops', await g.ev(`window.__game.Tops.length + ' ' + JSON.stringify(window.__game.Tops.slice(0,3).map(t=>[+t.x0.toFixed(1),+t.x1.toFixed(1),+t.z0.toFixed(1),+t.z1.toFixed(1),+t.y.toFixed(2)]))`));
// 1. a pot from the bar, then set it down on the counter
await g.at(-8.0, -8.0, Math.PI / 2, -0.35, 0.6);
await g.ev(`(()=>{ const G=window.__game; G.Game.order('pot', 0); window.__sim(5); const it=G.interactables.find(i=>i.id==='item'); it && it.action(); window.__sim(0.5); })()`);
console.log('holding', await g.ev(`!!window.__game.player.drink`));
console.log('topInReach', await g.ev(`JSON.stringify(window.__game.topInReach())`));
await g.ev(`window.__game.Game.onKey('KeyG'); window.__sim(0.5)`);
console.log('after G: holding', await g.ev(`!!window.__game.player.drink`), 'items', await g.ev(`JSON.stringify(window.__game.Game.items.map(i=>[i.kind,!!i.own]))`));
await g.shot('interact', '01_set_down');
await g.ev(`(()=>{ const G=window.__game; const it=G.interactables.filter(i=>i.id==='item').pop(); it && it.action(); window.__sim(0.3); })()`);
console.log('picked up again', await g.ev(`!!window.__game.player.drink`));
// 2. physics: a gentle drop onto the bar lands; a hard one from high up smashes
const bar = await g.ev(`JSON.stringify(window.__game.Tops.filter(t=>t.x1-t.x0>5||t.z1-t.z0>5).map(t=>[t.x0,t.x1,t.z0,t.z1,t.y]))`);
console.log('big tops', bar);
const r = await g.ev(`(()=>{ const G=window.__game; const T=G.Tops.filter(t=>t.z1-t.z0>6||t.x1-t.x0>6)[0]; const cx=(T.x0+T.x1)/2, cz=(T.z0+T.z1)/2; const out={};
  for (const [name, h] of [['gentle',0.25],['hard',2.0]]) { const gl=G.makeGlass('schooner'); gl.fill=0.8; G.scene.add(gl.group); gl.group.position.set(cx+(name==='hard'?0.5:0), T.y+h, cz); const before=G.Game.state.night.glasses; const n0=G.Game.items.length; G.fallingGlasses.push({glass:gl,v:G.THREE?new G.THREE.Vector3(0,0,0):null,w:new G.THREE.Vector3(0,0,0)}); window.__sim(2); out[name]={ smashed:G.Game.state.night.glasses-before, landedItems:G.Game.items.length-n0 }; }
  return JSON.stringify(out); })()`);
console.log('physics', r);
// 3. sit on a free stool
const sit = await g.ev(`(()=>{ const G=window.__game; const sp=G.SPOTS.find(s=>s.kind==='stool'&&!s.occ&&!s.club&&s.area==='bar'); if(!sp) return 'no stool'; const bx=-Math.sin(sp.ry), bz=-Math.cos(sp.ry); G.player.pos.set(sp.pos.x+bx*0.9,0,sp.pos.z+bz*0.9); G.player.yaw=sp.ry+Math.PI; G.player.pitch=0.55; window.__sim(0.5); const t=G.Game.findTarget(); G.Game.target=t; const lbl=t&&t.label&&t.label(); if(t&&t.sitHint) t.action(); window.__sim(1.2); return JSON.stringify({label:lbl, perch:!!G.player.perch, eye:+G.player.eye.toFixed(2)}); })()`);
console.log('sit', sit);
await g.shot('interact', '02_seated');
await g.ev(`(()=>{ const k=window.__game.keys; k.KeyW=true; window.__sim(1.0); k.KeyW=false; window.__sim(0.5); })()`);
console.log('stood', await g.ev(`JSON.stringify({perch:!!window.__game.player.perch, eye:window.__game.player.eye})`));
// 4. cheers with a neighbour
const ch = await g.ev(`(()=>{ const G=window.__game; const n=G.NPCS.find(n=>n!==G.bartender()&&n.state==='idle'&&!n.club&&n.spot&&n.spot.area==='bar'); if(!n) return 'no npc'; const gl=G.makeGlass('pot'); gl.fill=0.9; G.giveDrink(gl); G.player.pos.set(n.pos.x+Math.sin(n.ry)*1.2, 0, n.pos.z+Math.cos(n.ry)*1.2); G.player.yaw=Math.atan2(-(n.pos.x-G.player.pos.x),-(n.pos.z-G.player.pos.z)); G.player.pitch=0; window.__sim(0.5); const m0=G.Game.state.mood; G.cheers(); window.__sim(1); return JSON.stringify({npc:n.name, moodUp:+(G.Game.state.mood-m0).toFixed(1)}); })()`);
console.log('cheers', ch);
await g.shot('interact', '03_cheers');
// 5. telly
const tv = await g.ev(`(()=>{ const G=window.__game; const it=G.interactables.find(i=>i.id==='tv'); if(!it) return 'no tv interact'; const a=it.label(); it.action(); return a+' -> '+it.label(); })()`);
console.log('tv', tv);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
