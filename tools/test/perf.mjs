// where does the frame go? draw calls / triangles / lights / CPU sim time at stops in each pub
import { launch, done } from './harness.mjs';
const g = await launch({ quality: process.argv[2] || 'high', port: 8200 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const stops = [['street_royal', -7.5, 21, 0.12], ['royal_bar', -4, -8, -1.57], ['royal_gaming', 8, -9, 0], ['royal_garden', 6, -22, 1.6], ['rsl_front', 38.5, 14, Math.PI], ['rsl_bistro', 36, 36, -1], ['rsl_gaming', 45, 38, 0.3], ['dive_front', -37, 9, 0], ['dive_in', -37, -2, -1.2]];
const out = [];
for (const [n, x, z, yaw] of stops) {
  await g.at(x, z, yaw, 0.05, 1.0);
  const r = await g.ev(`(()=>{ const G=window.__game, R=G.renderer; R.info.autoReset=false; R.info.reset(); const t0=performance.now(); window.__sim(0.5); const sim=performance.now()-t0; R.info.reset(); G.renderer.render(G.scene, G.camera); const i=R.info;
    let meshes=0, vis=0, shadowCasters=0, pl=0, skinned=0; G.scene.traverse(o=>{ if(o.isMesh||o.isSprite||o.isPoints){ meshes++; if(o.visible) vis++; if(o.castShadow) shadowCasters++; } if(o.isPointLight&&o.visible&&o.intensity>0) pl++; if(o.isSkinnedMesh) skinned++; });
    return { calls:i.render.calls, tris:i.render.triangles, geoms:i.memory.geometries, tex:i.memory.textures, meshes, vis, shadowCasters, litPoint:pl, npcsVisible:G.NPCS.filter(n=>n.h.root.visible).length, simMs:+(sim/0.5*0.0166*60).toFixed(1) }; })()`);
  out.push([n, r]); console.log(n.padEnd(14), JSON.stringify(r));
}
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
