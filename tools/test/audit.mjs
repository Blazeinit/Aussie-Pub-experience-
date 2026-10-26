// map logic audit: spots inside colliders, doorways blocked, unreachable seats, interactables unreachable/overlapping, items floating
import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8201 });
await g.startNight();
const r = await g.ev(`(()=>{ const G = window.__game, C = G.colliders, out = { spotsInWall: [], doorBlocked: [], interactBlocked: [], seatsNoPath: [], lonely: [] };
  const inCol = (x, z, rad = 0.2) => C.filter(c => c.lv === 0 && !c.off && x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad);
  // 1. every standing/sitting spot must be free of colliders (a seat is allowed to touch its own table/machine, not be inside)
  for (const s of G.SPOTS) { const hit = inCol(s.pos.x, s.pos.z, 0.05); const solid = hit.filter(c => s.pos.x > c.x0 && s.pos.x < c.x1 && s.pos.z > c.z0 && s.pos.z < c.z1); if (solid.length) out.spotsInWall.push([s.kind, s.area, s.club || 'royal', +s.pos.x.toFixed(1), +s.pos.z.toFixed(1)]); }
  // 2. the doors and passages the player must use: can a circle of r=0.3 walk through them?
  const walk = (x0, z0, x1, z1, label) => { const p = { x: x0, z: z0 }; let blocked = false; for (let i = 0; i <= 60; i++) { const t = i / 60; p.x = x0 + (x1 - x0) * t; p.z = z0 + (z1 - z0) * t; const before = { x: p.x, z: p.z }; G.collideCircle ? 0 : 0; const hit = inCol(p.x, p.z, 0.3).filter(c => p.x > c.x0 - 0.3 && p.x < c.x1 + 0.3 && p.z > c.z0 - 0.3 && p.z < c.z1 + 0.3); if (hit.length) { blocked = [+p.x.toFixed(2), +p.z.toFixed(2)]; break; } } if (blocked) out.doorBlocked.push([label, blocked]); };
  walk(-7.5, 8, -7.5, -2, 'royal front door'); walk(-2, 3, 2, 3, 'royal verandah');
  walk(38.5, 22, 38.5, 28, 'rsl front doors'); walk(37.7, 36.6, 37.7, 31, 'rsl bistro->gaming doorway'); walk(40, 37.7, 43, 37.7, 'rsl gaming doorway x');
  walk(-37.2, 6, -37.2, 0, 'dive front door'); walk(-37, 0, -37, -5, 'dive inside');
  walk(7.5, -3, 7.5, -8, 'royal gaming doorway');
  // 3. every interactable must be standable-near
  for (const it of G.interactables) { if (it.temp) continue; const near = inCol(it.pos.x, it.pos.z, 0).length; /* inside a solid? report if every ring point at r*0.7 is blocked */ let free = false; for (let a = 0; a < 16 && !free; a++) { const x = it.pos.x + Math.cos(a / 16 * 6.283) * Math.min(it.r, 1.4) * 0.7, z = it.pos.z + Math.sin(a / 16 * 6.283) * Math.min(it.r, 1.4) * 0.7; if (!inCol(x, z, 0.28).some(c => x > c.x0 - 0.28 && x < c.x1 + 0.28 && z > c.z0 - 0.28 && z < c.z1 + 0.28)) free = true; } if (!free) out.interactBlocked.push([it.id, +it.pos.x.toFixed(1), +it.pos.z.toFixed(1)]); }
  // 4. every seat should have a nav path from the street
  const from = new G.THREE.Vector3(-7.5, 0, 12);
  for (const s of G.SPOTS) { if (s.club) continue; try { const p = G.findPath(from, s.pos); if (!p || p.length < 2) out.seatsNoPath.push([s.kind, s.area, +s.pos.x.toFixed(1), +s.pos.z.toFixed(1)]); } catch (e) { out.seatsNoPath.push(['err', e.message]); } }
  out.counts = { spots: G.SPOTS.length, colliders: C.length, interactables: G.interactables.length, machines: G.MACHINES.length };
  return JSON.stringify(out); })()`);
console.log(r);
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
