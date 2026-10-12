import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8150, venue: 'rsl' });
console.log(await g.ev(`(()=>{ const t=window.__game.TEX.paintCream; const c=t.image; const x=c.getContext('2d'); const d=x.getImageData(5,5,1,1).data; const e=window.__game.TEX.carpet.image.getContext('2d').getImageData(5,5,1,1).data; return JSON.stringify({damask:[...d], carpet:[...e], venue:window.__game.VENUE.id, matColor: window.__game.MAT.paintCream.color.getHexString(), map: window.__game.MAT.paintCream.map===t}); })()`));
await g.close(); done();
