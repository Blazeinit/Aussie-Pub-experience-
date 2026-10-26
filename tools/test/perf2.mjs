// attribute draw calls: by owner (machine / npc / static batch / other), who casts shadows
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'high', port: 8202 });
await g.startNight();
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.askedHome=true; G.Game.closePanel(); window.__sim(1); })()`);
await g.at(8, -9, 0, 0.05, 1.0);
const r = await g.ev(`(()=>{ const G=window.__game, R=G.renderer, S=G.scene, cam=G.camera; const THREE=G.THREE;
  cam.updateMatrixWorld(); const fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const machineRoots = new Set(G.MACHINES.map(m=>m.root)), npcRoots = new Set(G.NPCS.map(n=>n.h.root));
  const owner = o => { let p=o; while(p){ if(machineRoots.has(p)) return 'machine'; if(npcRoots.has(p)) return 'npc'; p=p.parent; } return null; };
  const cat = {}, sh = {}; const add=(m,k,o,tri)=>{ (m[k]=m[k]||{n:0,tri:0}); m[k].n++; m[k].tri+=tri; };
  S.traverse(o=>{ if(!o.isMesh||!o.visible) return; let p=o, vis=true; while(p){ if(!p.visible) vis=false; p=p.parent; } if(!vis) return; if(o.geometry.boundingSphere===null) o.geometry.computeBoundingSphere(); const bs=o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); if(!fr.intersectsSphere(bs)) return;
    const tri=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3; let k=owner(o); if(!k){ k = o.isSkinnedMesh?'skinned': (o.material&&o.material.isShaderMaterial)?'shader': (o.userData&&o.userData.batch)?'batch':'other'; }
    add(cat,k,o,tri); if(o.castShadow) add(sh,k,o,tri); });
  // biggest "other" meshes by triangle count
  const big=[]; S.traverse(o=>{ if(o.isMesh&&o.visible&&!owner(o)){ const tri=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3; if(tri>8000) big.push([o.name||o.type, tri, o.castShadow, Math.round(o.position.x), Math.round(o.position.z)]); } });
  big.sort((a,b)=>b[1]-a[1]);
  const perMachine = G.MACHINES.slice(0,3).map(m=>{ let n=0, cs=0, tri=0; m.root.traverse(o=>{ if(o.isMesh){ n++; if(o.castShadow) cs++; tri+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3; } }); return [m.def.game,n,cs,Math.round(tri)]; });
  const npc = G.NPCS[1]; let nm=0, ncs=0, ntri=0; npc.h.root.traverse(o=>{ if(o.isMesh){ nm++; if(o.castShadow) ncs++; ntri+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3; } });
  return JSON.stringify({ cat, shadowCats: sh, big: big.slice(0,12), perMachine, npc:[nm,ncs,Math.round(ntri)], lights: S.children.filter(c=>c.isLight).map(l=>[l.type, +l.intensity.toFixed(1), l.castShadow, l.visible]).slice(0,40) }); })()`);
console.log(r);
await g.close(); done();
