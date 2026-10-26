// what costs GPU time? (SwiftShader is fragment-bound, so relative numbers are meaningful)
import { launch, done } from './harness.mjs';
const g = await launch({ quality: process.argv[2] || 'high', port: 8203, w: 844, h: 390 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
const stops = [['street', -7.5, 15, 0.1], ['royal_gaming', 8, -9, 0.1], ['rsl_gaming', 45, 38, 0.3], ['dive_in', -37, -2, -1.2]];
for (const [n, x, z, yaw] of stops) {
  await g.at(x, z, yaw, 0.05, 1.0);
  const r = await g.ev(`(()=>{ const G=window.__game, R=G.renderer, S=G.scene, cam=G.camera; const T=(f,k=6)=>{ f(); R.render(S,cam); const t0=performance.now(); for(let i=0;i<k;i++){ R.render(S,cam); } const gl=R.getContext(); gl.finish(); return +((performance.now()-t0)/k).toFixed(1); };
    const out={}; out.base=T(()=>{});
    const lights=[]; S.traverse(o=>{ if(o.isPointLight&&o.visible) lights.push(o); });
    out.lightsOn=lights.length;
    const saved=lights.map(l=>l.visible); lights.forEach(l=>l.visible=false); out.noPointLights=T(()=>{}); lights.forEach((l,i)=>l.visible=saved[i]);
    const npcs=G.NPCS.map(n=>n.h.root.visible); G.NPCS.forEach(n=>n.h.root.visible=false); out.noNPCs=T(()=>{}); G.NPCS.forEach((n,i)=>n.h.root.visible=npcs[i]);
    const sm=R.shadowMap.enabled; R.shadowMap.enabled=false; S.traverse(o=>{ if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); }); out.noShadows=T(()=>{}); R.shadowMap.enabled=sm; S.traverse(o=>{ if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); });
    const pr=R.getPixelRatio(); out.pixelRatio=pr; R.setPixelRatio(pr*0.7); out.px70=T(()=>{}); R.setPixelRatio(pr);
    out.size=[R.domElement.width,R.domElement.height];
    return JSON.stringify(out); })()`);
  console.log(n.padEnd(14), r);
}
await g.close(); done();
