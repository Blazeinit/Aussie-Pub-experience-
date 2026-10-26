// flood-fill the walkable map (circle r=0.3 vs colliders) from the street: what can the player actually reach?
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8204 });
await g.startNight();
const r = await g.ev(`(()=>{ const G = window.__game, C = G.colliders.filter(c => c.lv === 0 && !c.off); const R = 0.3, CS = 0.25, X0 = -62, X1 = 62, Z0 = -32, Z1 = 50, NX = Math.round((X1 - X0) / CS), NZ = Math.round((Z1 - Z0) / CS);
  const blocked = new Uint8Array(NX * NZ);
  // bucket colliders into coarse cells so the fill is fast
  const B = 4, bx = Math.ceil((X1 - X0) / B), bz = Math.ceil((Z1 - Z0) / B), buckets = Array.from({ length: bx * bz }, () => []);
  C.forEach(c => { for (let i = Math.floor((c.x0 - R - X0) / B); i <= Math.floor((c.x1 + R - X0) / B); i++) for (let j = Math.floor((c.z0 - R - Z0) / B); j <= Math.floor((c.z1 + R - Z0) / B); j++) if (i >= 0 && j >= 0 && i < bx && j < bz) buckets[i * bz + j].push(c); });
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const x = X0 + (i + 0.5) * CS, z = Z0 + (j + 0.5) * CS; const bl = buckets[Math.floor((x - X0) / B) * bz + Math.floor((z - Z0) / B)] || []; for (const c of bl) { const nx = Math.max(c.x0, Math.min(x, c.x1)), nz = Math.max(c.z0, Math.min(z, c.z1)); if ((x - nx) ** 2 + (z - nz) ** 2 < R * R) { blocked[i * NZ + j] = 1; break; } } }
  const idx = (x, z) => [Math.floor((x - X0) / CS), Math.floor((z - Z0) / CS)];
  const seen = new Uint8Array(NX * NZ); const [si, sj] = idx(-7.5, 21.2); const q = [si * NZ + sj]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const k = q[h], i = (k / NZ) | 0, j = k % NZ; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NZ) continue; const kk = a * NZ + b; if (!seen[kk] && !blocked[kk]) { seen[kk] = 1; q.push(kk); } } }
  const reach = (x, z, rad = 0.6) => { const [i0, j0] = idx(x, z); const n = Math.round(rad / CS); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const i = i0 + a, j = j0 + b; if (i >= 0 && j >= 0 && i < NX && j < NZ && seen[i * NZ + j]) return true; } return false; };
  const out = { reachableCells: q.length, spots: [], inter: [], places: {} };
  for (const s of G.SPOTS) if (!reach(s.pos.x, s.pos.z, 0.9)) out.spots.push([s.kind, s.area, s.club || 'royal', +s.pos.x.toFixed(1), +s.pos.z.toFixed(1), !!s.machine]);
  for (const it of G.interactables) if (!it.temp && !reach(it.pos.x, it.pos.z, Math.max(1.0, Math.min(it.r || 2, 2.4)))) out.inter.push([it.id, +it.pos.x.toFixed(1), +it.pos.z.toFixed(1), it.r]);
  for (const [n, x, z] of [['royal_bar', -8, -8], ['royal_lounge', 7, -1], ['royal_gaming', 8, -9], ['royal_terrace', 16, -12], ['garden', 0, -25], ['toilets', -11, -20], ['upstairs_stairs', 0, 2.5], ['rsl_foyer', 38, 28], ['rsl_bistro', 33, 38], ['rsl_gaming', 44, 42], ['rsl_terrace', 53, 42], ['dive_door', -37.2, 5], ['dive_bar', -40, -6], ['dive_stage', -34, -11], ['dive_pokies', -30, -9], ['kebab', 10, 25], ['bottleo', 16, -3], ['tab', -1, 6]]) out.places[n] = reach(x, z, 0.6);
  // an ASCII picture of the street level, 1 char = 2 m (R reachable, # solid, . open but cut off)
  const rows = []; for (let z = Z0; z < Z1; z += 2) { let row = ''; for (let x = X0; x < X1; x += 2) { const [i, j] = idx(x + 0.5, z + 0.5); const k = i * NZ + j; row += seen[k] ? 'R' : blocked[k] ? '#' : '.'; } rows.push(row); }
  out.map = rows; return JSON.stringify(out); })()`);
const d = JSON.parse(r);
console.log('places', JSON.stringify(d.places));
console.log('unreachable spots', d.spots.length, JSON.stringify(d.spots.slice(0, 30)));
console.log('unreachable interactables', JSON.stringify(d.inter));
console.log(d.map.join('\n'));
await g.close(); done();
