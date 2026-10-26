import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8197 });
const bad = await g.page.evaluate(() => { const out = []; window.__game.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap', 'lightMap', 'envMap']) if (m[k] && !m[k].isTexture) out.push([o.type, o.name, m.type, k, typeof m[k], m[k].constructor && m[k].constructor.name, JSON.stringify(o.position)]); }); return out.slice(0, 10); });
console.log(JSON.stringify(bad, null, 1));
await g.close(); done();
