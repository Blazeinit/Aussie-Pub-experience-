// every dialogue graph: random walks must terminate without errors; then screenshot a conversation
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8170 });
console.log('boot', g.bootErr || 'ok');
await g.startNight();
const out = await g.ev(`(()=>{
  const G=window.__game, D=G.DLG, errs=[], stats={};
  G.Game.state.wallet=5000; G.Game.state.flags.rep=60;
  for (const id of Object.keys(D.graphs)) {
    let ended=0, maxDepth=0;
    for (let w=0; w<60; w++) {
      try {
        D.open(id, null, { key: id });
        let depth=0;
        while (D.active && depth++<40) {
          const live = D.opts.map((o,i)=>[o,i]).filter(([o])=>!o.off);
          if (!live.length) { D.close(); break; }
          const origRandom = Math.random; Math.random = () => (w%2 ? 0.01 : 0.99);
          try { D.pick(live[Math.floor(origRandom()*live.length)][1]); } finally { Math.random = origRandom; }
          D.update(0.5);
        }
        if (D.active) { errs.push(id+': did not end'); D.close(); } else ended++;
        maxDepth=Math.max(maxDepth,depth);
      } catch(e) { errs.push(id+': '+e.message); try{D.close()}catch(_){} }
    }
    stats[id]=[ended,maxDepth];
  }
  return JSON.stringify({graphs:Object.keys(D.graphs).length, errs: errs.slice(0,12), ok: Object.values(stats).filter(v=>v[0]===60).length});
})()`);
console.log(out);
// a real conversation with a regular, screenshot mid-typing and options
await g.ev(`(()=>{ const G=window.__game; G.Game.paused=false; document.getElementById('resume').classList.add('hidden'); G.Game.entered=true; G.Game.askedHome=true; G.Game.state.rel['Old Mick']=30; G.Game.state.day=2; const n=G.REG.here('Old Mick'); G.player.pos.set(n.pos.x+1.0,0,n.pos.z+0.2); window.__sim(1); G.DLG.playBeat('Old Mick', n); window.__sim(1.5); })()`);
await g.shot('dlg', '01_mick_typing');
await g.ev(`window.__sim(4)`); await g.shot('dlg', '02_mick_options');
console.log('state', await g.ev(`JSON.stringify({node:window.__game.DLG.nodeId, opts:window.__game.DLG.opts.map(o=>o.o.t)})`));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|willReadFrequently|CORS/.test(e)).join('\n'));
await g.close(); done();
