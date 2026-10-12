// =====================================================================
//  POOL (8-BALL) — 2D physics, rules and AI. Pure logic: no three.js, no DOM.
//  Table-local coords in metres: x across (width), z along (length), y up.
// =====================================================================
const POOL = (() => {
  const BALL_R = 0.0286;
  const HALF_W = 0.61, HALF_L = 1.23;
  const GRAV = 9.81;
  const SQ2 = Math.SQRT2;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);

  const PHYS = {
    tick: 1 / 240,          // fixed simulation tick (substepped further by speed)
    maxDisp: 0.4 * BALL_R,  // max travel of any ball per substep (anti-tunnelling)
    muSlide: 0.2,           // sliding friction (cloth)
    rollDecel: 0.12,        // m/s^2 when rolling
    spinDecel: 12,          // rad/s^2 decay of vertical-axis (side) spin
    ballE: 0.94,            // ball-ball restitution (isolated contacts)
    clusterE: 0.99,         // per-contact restitution inside touching clusters (rack) — offsets multi-contact losses
    contactTime: 0.00015,   // contact duration used by the cluster solver (s)
    cushionE: 0.75,         // cushion restitution (normal)
    cushionMu: 0.2,         // cushion friction (tangential loss / side-spin effect)
    slipEps: 0.002,         // m/s, below which sliding is considered rolling
    maxShotSpeed: 7,
  };

  // ------------------------------------------------------------------
  //  TABLE GEOMETRY
  // ------------------------------------------------------------------
  const TABLE = (() => {
    const cornerMouth = 0.115, middleMouth = 0.125;
    const dC = cornerMouth / SQ2;          // jaw point distance from the corner along each rail
    const hm = middleMouth / 2;
    const cornerJawAng = 38 * Math.PI / 180, cornerJawLen = 0.055;
    const midJawAng = 14 * Math.PI / 180, midJawLen = 0.04;
    const pockets = [], cushions = [];
    const P = (x, z) => ({ x, z });
    const seg = (a, b, jaw, pocket) => cushions.push({ a, b, jaw, pocket });

    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, row = Math.floor(i / 2), sz = row - 1;
      if (sz !== 0) {
        const cx = sx * HALF_W, cz = sz * HALF_L;
        const a = P(cx, sz * (HALF_L - dC)), b = P(sx * (HALF_W - dC), cz);
        const s = Math.sin(cornerJawAng), c = Math.cos(cornerJawAng);
        const a2 = P(a.x + sx * s * cornerJawLen, a.z + sz * c * cornerJawLen);
        const b2 = P(b.x + sx * c * cornerJawLen, b.z + sz * s * cornerJawLen);
        seg(a, a2, true, i); seg(b, b2, true, i);
        pockets.push({
          id: i, kind: 'corner', x: cx, z: cz,
          dir: P(sx / SQ2, sz / SQ2),                  // unit vector pointing out of the table into the pocket
          mouth: { a, b, width: cornerMouth },
          jaws: [{ a, b: a2 }, { a: b, b: b2 }],
          capture: { x: cx + sx * 0.01, z: cz + sz * 0.01, r: 0.058 },
          aim: P(cx - sx * 0.012, cz - sz * 0.012),    // point the AI aims object balls at
          minCos: Math.cos(60 * Math.PI / 180),
        });
      } else {
        const cx = sx * HALF_W;
        const a = P(cx, -hm), b = P(cx, hm);
        const s = Math.sin(midJawAng), c = Math.cos(midJawAng);
        const a2 = P(cx + sx * c * midJawLen, -hm + s * midJawLen);
        const b2 = P(cx + sx * c * midJawLen, hm - s * midJawLen);
        seg(a, a2, true, i); seg(b, b2, true, i);
        pockets.push({
          id: i, kind: 'middle', x: cx, z: 0,
          dir: P(sx, 0),
          mouth: { a, b, width: middleMouth },
          jaws: [{ a, b: a2 }, { a: b, b: b2 }],
          capture: { x: cx + sx * 0.03, z: 0, r: 0.032 },
          aim: P(cx + sx * 0.006, 0),
          minCos: Math.cos(50 * Math.PI / 180),
        });
      }
    }
    // straight cushion noses
    for (const sx of [-1, 1]) {
      seg(P(sx * HALF_W, -(HALF_L - dC)), P(sx * HALF_W, -hm), false, null);
      seg(P(sx * HALF_W, hm), P(sx * HALF_W, HALF_L - dC), false, null);
    }
    for (const sz of [-1, 1]) seg(P(-(HALF_W - dC), sz * HALF_L), P(HALF_W - dC, sz * HALF_L), false, null);
    for (const c of cushions) {
      c.dx = c.b.x - c.a.x; c.dz = c.b.z - c.a.z; c.len2 = c.dx * c.dx + c.dz * c.dz;
    }
    return {
      halfWidth: HALF_W, halfLength: HALF_L, width: 2 * HALF_W, length: 2 * HALF_L,
      bounds: { minX: -HALF_W, maxX: HALF_W, minZ: -HALF_L, maxZ: HALF_L },
      ballRadius: BALL_R,
      headString: 0.615,                 // kitchen is z > headString
      headSpot: P(0, 0.615),
      footSpot: P(0, -0.615),
      cueStart: P(0, 0.85),
      pockets, cushions,
    };
  })();

  const groupOf = id => (id >= 1 && id <= 7) ? 'solids' : (id >= 9 && id <= 15) ? 'stripes' : null;
  const otherGroup = g => g === 'solids' ? 'stripes' : 'solids';

  function randomQuat(rng) {
    const u1 = rng(), u2 = rng() * 2 * Math.PI, u3 = rng() * 2 * Math.PI;
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  }

  // returns pocket index if a ball centre at (x, z) has dropped, else -1
  function pocketAt(x, z) {
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax < HALF_W - 0.05 && az < HALF_L - 0.05) return -1;
    const pk = TABLE.pockets;
    for (let i = 0; i < 6; i++) {
      const c = pk[i].capture, dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return i;
    }
    if (ax > HALF_W + 0.6 * BALL_R || az > HALF_L + 0.6 * BALL_R) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < 6; i++) { const d = (x - pk[i].x) ** 2 + (z - pk[i].z) ** 2; if (d < bd) { bd = d; best = i; } }
      return best;
    }
    return -1;
  }

  // closest cushion contact (penetration > 0) for a ball centre; writes into out
  function cushionContact(x, z, out) {
    if (Math.abs(x) < HALF_W - BALL_R && Math.abs(z) < HALF_L - BALL_R) return false;
    let best = 0, found = false;
    for (const c of TABLE.cushions) {
      let t = ((x - c.a.x) * c.dx + (z - c.a.z) * c.dz) / c.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x - (c.a.x + c.dx * t), pz = z - (c.a.z + c.dz * t);
      const d2 = px * px + pz * pz;
      if (d2 < BALL_R * BALL_R) {
        const d = Math.sqrt(d2), pen = BALL_R - d;
        if (pen > best) {
          best = pen; found = true;
          out.pen = pen; out.nx = d > 1e-9 ? px / d : 0; out.nz = d > 1e-9 ? pz / d : 0; out.seg = c;
          if (d <= 1e-9) { out.nx = -Math.sign(x); out.nz = 0; }
        }
      }
    }
    return found;
  }

  // ------------------------------------------------------------------
  //  PHYSICS
  // ------------------------------------------------------------------
  class Sim {
    constructor(opts = {}) {
      this.rng = opts.rng || Math.random;
      this.balls = [];
      for (let id = 0; id < 16; id++) {
        this.balls.push({ id, x: 0, z: 0, vx: 0, vz: 0, w: { x: 0, y: 0, z: 0 }, pocketed: false, pocket: null, q: [0, 0, 0, 1] });
      }
      this.time = 0;
      this.shotEvents = [];
      this._acc = 0;
      this._active = false;
      this._c = { pen: 0, nx: 0, nz: 0, seg: null };
      if (opts.rack !== false) this.rack();
    }

    get cue() { return this.balls[0]; }

    rack() {
      const rng = this.rng, R = BALL_R;
      const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
      const take = (arr) => arr.splice(Math.floor(rng() * arr.length), 1)[0];
      const cs = take(solids), ct = take(stripes);
      const rest = solids.concat(stripes);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const flip = rng() < 0.5;
      const sp = 2 * R + 0.0002 + rng() * 0.0002;   // spacing with a small gap
      const rowDz = sp * Math.sqrt(3) / 2;
      let k = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          let id;
          if (row === 2 && i === 1) id = 8;
          else if (row === 4 && i === 0) id = flip ? cs : ct;
          else if (row === 4 && i === 4) id = flip ? ct : cs;
          else id = rest[k++];
          const b = this.balls[id];
          b.x = TABLE.footSpot.x + (i - row / 2) * sp + (rng() - 0.5) * 0.00012;
          b.z = TABLE.footSpot.z - row * rowDz + (rng() - 0.5) * 0.00012;
        }
      }
      const c = this.balls[0];
      c.x = TABLE.cueStart.x; c.z = TABLE.cueStart.z;
      for (const b of this.balls) {
        b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; b.pocketed = false; b.pocket = null;
        b.q = randomQuat(rng);
      }
      this.shotEvents = [];
      this._acc = 0; this._active = false;
    }

    clone() {
      const s = new Sim({ rng: this.rng, rack: false });
      for (let i = 0; i < 16; i++) {
        const a = this.balls[i], b = s.balls[i];
        b.x = a.x; b.z = a.z; b.vx = a.vx; b.vz = a.vz; b.w.x = a.w.x; b.w.y = a.w.y; b.w.z = a.w.z;
        b.pocketed = a.pocketed; b.pocket = a.pocket; b.q = a.q.slice();
      }
      s.time = this.time; s._acc = this._acc; s._active = this._active;
      return s;
    }

    moving() {
      for (const b of this.balls) if (!b.pocketed && isMoving(b)) return true;
      return false;
    }

    canPlaceCue(x, z, behindHeadString = false) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if (Math.abs(x) > HALF_W - BALL_R || Math.abs(z) > HALF_L - BALL_R) return false;
      if (behindHeadString && z <= TABLE.headString) return false;
      if (pocketAt(x, z) >= 0 || cushionContact(x, z, this._c)) return false;
      for (const b of this.balls) {
        if (b.id === 0 || b.pocketed) continue;
        if ((b.x - x) ** 2 + (b.z - z) ** 2 < (2 * BALL_R + 0.0005) ** 2) return false;
      }
      return true;
    }

    placeCue(x, z, behindHeadString = false) {
      if (!this.canPlaceCue(x, z, behindHeadString)) return false;
      const c = this.balls[0];
      c.x = x; c.z = z; c.vx = c.vz = 0; c.w.x = c.w.y = c.w.z = 0; c.pocketed = false; c.pocket = null;
      return true;
    }

    // nearest valid cue spot to (x, z), searching outward in rings
    findCueSpot(x = TABLE.cueStart.x, z = TABLE.cueStart.z, behindHeadString = false) {
      if (this.canPlaceCue(x, z, behindHeadString)) return { x, z };
      for (let r = 0.02; r < 2.6; r += 0.02) {
        const n = Math.max(8, Math.round(2 * Math.PI * r / 0.02));
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (this.canPlaceCue(px, pz, behindHeadString)) return { x: px, z: pz };
        }
      }
      return null;
    }

    // angle: direction (sin a, cos a) in (x, z). power: cue speed m/s. spin.top/side in [-1, 1].
    shoot({ angle, power, spin = {} }) {
      const c = this.balls[0];
      const v = Math.max(0, Math.min(PHYS.maxShotSpeed, +power || 0));
      const top = Math.max(-1, Math.min(1, +spin.top || 0)), side = Math.max(-1, Math.min(1, +spin.side || 0));
      const dx = Math.sin(angle), dz = Math.cos(angle);
      c.vx = dx * v; c.vz = dz * v;
      // tip offset up to half a radius => spin up to 1.25 v/R
      const k = 1.25 * v / BALL_R;
      c.w.x = top * k * dz; c.w.z = -top * k * dx; c.w.y = -side * k * 0.8;
      this.shotEvents = [];
      this._acc = 0; this._kicked = false;
      this._active = true;
    }

    // advance by dt seconds of real time (fixed internal ticks); returns events for this call
    step(dt) {
      const ev = [];
      if (!this._active) { this._acc = 0; return ev; }
      this._acc += Math.min(Math.max(dt || 0, 0), 0.1);
      while (this._acc >= PHYS.tick && this._active) {
        this._acc -= PHYS.tick;
        this._tick(ev);
      }
      for (const e of ev) this.shotEvents.push(e);
      return ev;
    }

    simulateUntilRest(maxSeconds = 20) {
      const ev = [];
      const end = this.time + maxSeconds;
      while (this._active && this.time < end) this._tick(ev);
      if (this._active) {
        for (const b of this.balls) { b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; }
        this._active = false;
        ev.push({ type: 'stopped' });
      }
      this._acc = 0;
      for (const e of ev) this.shotEvents.push(e);
      return ev;
    }

    _tick(ev) {
      let rem = PHYS.tick;
      while (rem > 1e-12) {
        let vmax = 0, any = false;
        for (const b of this.balls) {
          if (b.pocketed) continue;
          if (isMoving(b)) { any = true; const s = hyp(b.vx, b.vz); if (s > vmax) vmax = s; }
          else if (b.vx || b.vz || b.w.x || b.w.y || b.w.z) { b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; }
        }
        if (!any) {
          if (this._active) { this._active = false; ev.push({ type: 'stopped' }); }
          return;
        }
        const n = Math.max(1, Math.ceil(rem * vmax / PHYS.maxDisp));
        const h = rem / n;
        this._substep(h, ev);
        rem -= h;
        this.time += h;
      }
    }

    _substep(h, ev) {
      const balls = this.balls, R = BALL_R;
      for (const b of balls) {
        if (b.pocketed || !isMoving(b)) continue;
        friction(b, h);
        b.x += b.vx * h; b.z += b.vz * h;
        rotate(b, h);
      }
      // ball-ball: resolve contacts that happened during this substep, earliest first
      const done = this._done || (this._done = new Uint8Array(256));
      if (this._dirty) { done.fill(0); this._dirty = false; }
      let hits = 0;
      const R2 = 4 * R * R;
      for (let iter = 0; iter < 48; iter++) {
        let bs = -1, bi = -1, bj = -1;
        for (let i = 0; i < 16; i++) {
          const a = balls[i];
          if (a.pocketed) continue;
          for (let j = i + 1; j < 16; j++) {
            const b = balls[j];
            if (b.pocketed) continue;
            const dvx = b.vx - a.vx, dvz = b.vz - a.vz;
            if (dvx === 0 && dvz === 0) continue;
            const px = b.x - a.x, pz = b.z - a.z;
            const reach = 2 * R + (Math.abs(dvx) + Math.abs(dvz)) * h + 1e-6;
            if (px > reach || px < -reach || pz > reach || pz < -reach) continue;
            const pp = px * px + pz * pz, pd = px * dvx + pz * dvz, dd = dvx * dvx + dvz * dvz;
            const c = pp - R2;
            if (done[i * 16 + j]) { if (!(c < -1e-8 && pd < 0)) continue; }
            const disc = pd * pd - dd * c;
            if (disc <= 0) continue;
            let s = (pd + Math.sqrt(disc)) / dd;      // time back to first touch
            if (s < 0) continue;                      // contact lies in the future
            if (s > h) { if (c < 0 && pd < 0) s = 0; else continue; }
            if (s > bs) { bs = s; bi = i; bj = j; }
          }
        }
        if (bi < 0) break;
        hits++; this._dirty = true;
        const a = balls[bi], b = balls[bj];
        a.x -= a.vx * bs; a.z -= a.vz * bs; b.x -= b.vx * bs; b.z -= b.vz * bs;
        const cl = this._cluster(bi, bj, bs);
        if (cl) {
          this._softCollide(cl, bs, ev);
          for (const i of cl) for (const j of cl) if (i < j) done[i * 16 + j] = 1;
          continue;
        }
        const sp = collide(a, b);
        a.x += a.vx * bs; a.z += a.vz * bs; b.x += b.vx * bs; b.z += b.vz * bs;
        done[bi * 16 + bj] = 1;
        if (sp > 0) ev.push({ type: 'ball', a: a.id, b: b.id, speed: sp });
      }
      // positional safety: separate any residual overlap
      if (hits) for (let i = 0; i < 16; i++) {
        const a = balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < 16; j++) {
          const b = balls[j];
          if (b.pocketed) continue;
          const px = b.x - a.x, pz = b.z - a.z, pp = px * px + pz * pz;
          if (pp < R2 - 1e-9 && pp > 1e-14) {
            const d = Math.sqrt(pp), push = (2 * R - d) / 2 + 1e-7;
            a.x -= px / d * push; a.z -= pz / d * push; b.x += px / d * push; b.z += pz / d * push;
          }
        }
      }
      this._cushionsAndPockets(h, ev);
    }

    // Balls (a, b already rewound to contact) touching or nearly touching others: returns the
    // cluster (array of indices, others rewound by s too) or null when the contact is isolated.
    _cluster(ia, ib, s) {
      const balls = this.balls, lim = (2 * BALL_R + 0.002) ** 2;
      const px = this._px || (this._px = new Float64Array(16)), pz = this._pz || (this._pz = new Float64Array(16));
      for (let k = 0; k < 16; k++) {
        const b = balls[k];
        if (k === ia || k === ib) { px[k] = b.x; pz[k] = b.z; } else { px[k] = b.x - b.vx * s; pz[k] = b.z - b.vz * s; }
      }
      let near = false;
      for (let k = 0; k < 16 && !near; k++) {
        if (k === ia || k === ib || balls[k].pocketed) continue;
        near = (px[k] - px[ia]) ** 2 + (pz[k] - pz[ia]) ** 2 < lim || (px[k] - px[ib]) ** 2 + (pz[k] - pz[ib]) ** 2 < lim;
      }
      if (!near) return null;
      const list = [ia, ib], inSet = new Uint8Array(16);
      inSet[ia] = inSet[ib] = 1;
      for (let q = 0; q < list.length; q++) {
        const i = list[q];
        for (let k = 0; k < 16; k++) {
          if (inSet[k] || balls[k].pocketed) continue;
          if ((px[k] - px[i]) ** 2 + (pz[k] - pz[i]) ** 2 < lim) { inSet[k] = 1; list.push(k); }
        }
      }
      for (let q = 2; q < list.length; q++) { const k = balls[list[q]]; k.x = px[list[q]]; k.z = pz[list[q]]; }
      return list;
    }

    // Short stiff spring-damper simulation of a contact cluster (racked balls, frozen balls):
    // spreads impulses the way near-simultaneous real collisions do. Advances the cluster by s.
    _softCollide(list, s, ev) {
      const balls = this.balls, n = list.length, R2 = 2 * BALL_R;
      const omega = Math.PI / PHYS.contactTime, lnE = Math.log(PHYS.clusterE);
      const zeta = -lnE / Math.sqrt(Math.PI * Math.PI + lnE * lnE);
      const km = omega * omega / 2, cm = zeta * omega;
      const dt = PHYS.contactTime / 40;
      const x = new Float64Array(n), z = new Float64Array(n), vx = new Float64Array(n), vz = new Float64Array(n);
      for (let i = 0; i < n; i++) { const b = balls[list[i]]; x[i] = b.x; z[i] = b.z; vx[i] = b.vx; vz[i] = b.vz; }
      let vin = 0; for (let i = 0; i < n; i++) vin = Math.max(vin, Math.hypot(vx[i], vz[i]));
      const touching = new Uint8Array(n * n);
      let t = 0;
      for (let step = 0; step < 1200; step++) {
        let active = false;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const px = x[j] - x[i], pz = z[j] - z[i], d2 = px * px + pz * pz;
          if (d2 >= (R2 + 0.0005) ** 2) { touching[i * n + j] = 0; continue; }
          const d = Math.sqrt(d2), nx = px / d, nz = pz / d;
          const vr = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
          const pen = R2 - d;
          if (pen <= 0) { touching[i * n + j] = 0; if (vr < 0 && -pen < -vr * dt * 8) active = true; continue; }
          active = true;
          if (!touching[i * n + j]) {
            touching[i * n + j] = 1;
            if (vr < 0) ev.push({ type: 'ball', a: balls[list[i]].id, b: balls[list[j]].id, speed: -vr });
          }
          let f = km * pen - cm * vr;
          if (f < 0) f = 0;
          const ix = f * nx * dt, iz = f * nz * dt;
          vx[i] -= ix; vz[i] -= iz; vx[j] += ix; vz[j] += iz;
        }
        for (let i = 0; i < n; i++) { x[i] += vx[i] * dt; z[i] += vz[i] * dt; }
        t += dt;
        if (!active) break;
      }
      // breaking a full rack: an ideal frictionless rack sends nearly all the energy into the two back corners and leaves
      // the rest sitting there.  Real racks have tiny gaps and bad contacts that scatter it, so give every racked ball a
      // little outward kick in proportion to the hit (once per shot) and the break opens up the way it does on a real table.
      if (n >= 10 && !this._kicked) {
        this._kicked = true; let cx = 0, cz = 0, m = 0;
        for (let i = 0; i < n; i++) if (balls[list[i]].id) { cx += x[i]; cz += z[i]; m++; }
        cx /= m; cz /= m;
        for (let i = 0; i < n; i++) { if (!balls[list[i]].id) continue; const dx = x[i] - cx, dz = z[i] - cz, d = Math.hypot(dx, dz) || 1, k = vin * (0.1 + this.rng() * 0.16); vx[i] += dx / d * k; vz[i] += dz / d * k; }
      }
      const rest = Math.max(0, s - t);
      for (let i = 0; i < n; i++) {
        const b = balls[list[i]];
        b.vx = vx[i]; b.vz = vz[i];
        b.x = x[i] + vx[i] * rest; b.z = z[i] + vz[i] * rest;
      }
    }

    _cushionsAndPockets(h, ev) {
      const balls = this.balls;
      const C = this._c;
      for (const b of balls) {
        if (b.pocketed) continue;
        for (let it = 0; it < 4 && cushionContact(b.x, b.z, C); it++) {
          const vn = b.vx * C.nx + b.vz * C.nz;
          if (vn < 0 && it < 3) {
            const s = Math.min(C.pen / -vn, h);
            b.x -= b.vx * s; b.z -= b.vz * s;
            cushionBounce(b, C.nx, C.nz, vn);
            b.x += b.vx * s; b.z += b.vz * s;
            ev.push(C.seg.jaw ? { type: 'cushion', id: b.id, speed: -vn, jaw: true, pocket: C.seg.pocket } : { type: 'cushion', id: b.id, speed: -vn });
          } else {
            b.x += C.nx * (C.pen + 1e-7); b.z += C.nz * (C.pen + 1e-7);
          }
        }
        if (b.vx || b.vz) {
          const p = pocketAt(b.x, b.z);
          if (p >= 0) {
            b.pocketed = true; b.pocket = p; b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0;
            ev.push({ type: 'pocket', id: b.id, pocket: p });
          }
        }
      }
    }
  }

  function isMoving(b) {
    if (b.vx !== 0 || b.vz !== 0) return true;
    return Math.abs(b.w.x) * BALL_R > PHYS.slipEps || Math.abs(b.w.z) * BALL_R > PHYS.slipEps;
  }

  function friction(b, h) {
    const R = BALL_R, w = b.w;
    const ux = b.vx + R * w.z, uz = b.vz - R * w.x;
    const us = hyp(ux, uz);
    let rest = h;
    if (us > PHYS.slipEps) {
      const a = PHYS.muSlide * GRAV;
      const tRoll = us / (3.5 * a);
      const t = tRoll < h ? tRoll : h;
      const fx = ux / us, fz = uz / us;
      b.vx -= fx * a * t; b.vz -= fz * a * t;
      w.x += 2.5 * a * fz * t / R;
      w.z -= 2.5 * a * fx * t / R;
      rest = h - t;
      if (tRoll >= h) rest = 0;
    }
    if (rest > 0) {
      const s = hyp(b.vx, b.vz), dv = PHYS.rollDecel * rest;
      if (s <= dv) { b.vx = b.vz = 0; }
      else { const k = (s - dv) / s; b.vx *= k; b.vz *= k; }
      w.x = b.vz / R; w.z = -b.vx / R;
    }
    if (w.y) { const d = PHYS.spinDecel * h; w.y = Math.abs(w.y) <= d ? 0 : w.y - Math.sign(w.y) * d; }
    if (b.vx === 0 && b.vz === 0 && Math.abs(w.x) * R <= PHYS.slipEps && Math.abs(w.z) * R <= PHYS.slipEps) {
      w.x = w.y = w.z = 0;
    }
  }

  function rotate(b, h) {
    const w = b.w, wl = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (wl < 1e-9) return;
    const half = wl * h / 2, s = Math.sin(half) / wl;
    const ax = w.x * s, ay = w.y * s, az = w.z * s, aw = Math.cos(half);
    const q = b.q, bx = q[0], by = q[1], bz = q[2], bw = q[3];
    let x = aw * bx + ax * bw + ay * bz - az * by;
    let y = aw * by - ax * bz + ay * bw + az * bx;
    let z = aw * bz + ax * by - ay * bx + az * bw;
    let ww = aw * bw - ax * bx - ay * by - az * bz;
    const l = 1 / Math.sqrt(x * x + y * y + z * z + ww * ww);
    q[0] = x * l; q[1] = y * l; q[2] = z * l; q[3] = ww * l;
  }

  // equal-mass, frictionless contact; returns approach speed (0 if separating)
  function collide(a, b) {
    let nx = b.x - a.x, nz = b.z - a.z;
    const d = hyp(nx, nz) || 1e-9;
    nx /= d; nz /= d;
    const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (vrel >= 0) return 0;
    const j = (1 + PHYS.ballE) / 2 * vrel;
    a.vx += j * nx; a.vz += j * nz;
    b.vx -= j * nx; b.vz -= j * nz;
    return -vrel;
  }

  function cushionBounce(b, nx, nz, vn) {
    const R = BALL_R, e = PHYS.cushionE, w = b.w;
    b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
    // tangential friction at the contact (couples with side spin)
    const tx = -nz, tz = nx;
    const s = b.vx * tx + b.vz * tz + R * w.y;
    const J = Math.min(PHYS.cushionMu * (1 + e) * -vn, Math.abs(s) / 3.5);
    const sg = s > 0 ? 1 : -1;
    b.vx -= sg * J * tx; b.vz -= sg * J * tz;
    w.y -= sg * 2.5 * J / R;
    // cushion nose sits above centre: kills roll spin into the rail
    const comp = w.x * nz - w.z * nx;
    w.x -= comp * nz; w.z += comp * nx;
  }

  // ------------------------------------------------------------------
  //  RULES
  // ------------------------------------------------------------------
  function targetsFor(sim, group) {
    const ids = [];
    for (const b of sim.balls) {
      if (b.pocketed || b.id === 0 || b.id === 8) continue;
      if (group === null || groupOf(b.id) === group) ids.push(b.id);
    }
    if (ids.length === 0 && !sim.balls[8].pocketed) ids.push(8);
    return ids;
  }

  const ballName = id => id === 8 ? 'the black' : id === 0 ? 'the cue ball' : `the ${id}`;

  class Match {
    constructor(sim, names = ['Player 1', 'Player 2'], opts = {}) {
      this.sim = sim;
      this.names = names;
      this.newGame(opts.breaker || 0, opts.rack === true);
    }

    newGame(breaker = 0, rack = true) {
      if (rack) this.sim.rack();
      this.turn = breaker;
      this.groups = [null, null];
      this.winner = null;
      this.isBreak = true;
      this.ballInHand = true;     // on the break the cue ball may be placed behind the head string
      this.kitchen = true;
      this.shots = 0;
      this.fouls = [0, 0];
      this.lastShot = null;
      this.lastMessage = `${this._n(breaker)} to break.`;
    }

    _n(p) { return this.names[p]; }
    _is(p) { const n = this.names[p]; return n === 'You' ? "You're" : `${n}'s`; }
    _has(p) { const n = this.names[p]; return n === 'You' ? 'You have' : `${n} has`; }
    _v(p, you, other) { return `${this.names[p]} ${this.names[p] === 'You' ? you : other}`; }
    _your(p) { const n = this.names[p]; return n === 'You' ? 'Your' : `${n}'s`; }

    legalTargets(player = this.turn) {
      if (this.isBreak) return targetsFor(this.sim, null);
      return targetsFor(this.sim, this.groups[player]);
    }

    remaining(player = this.turn) {
      const g = this.groups[player];
      let n = 0;
      for (const b of this.sim.balls) if (!b.pocketed && b.id !== 0 && b.id !== 8 && (g === null || groupOf(b.id) === g)) n++;
      return n;
    }

    beginShot() {
      this.ballInHand = false;
      this.kitchen = false;
      this._pre = this.sim.balls.filter(b => !b.pocketed).map(b => b.id);
    }

    // Pure adjudication of a finished shot (no state change). Used by endShot and by the AI on clones.
    evaluate(events, sim = this.sim, player = this.turn) {
      const potted = [];
      let first = null, firstIdx = -1, cushionAfter = false;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'pocket') { if (!potted.includes(e.id)) potted.push(e.id); }
        else if (e.type === 'ball' && first === null && (e.a === 0 || e.b === 0)) { first = e.a === 0 ? e.b : e.a; firstIdx = i; }
        else if (e.type === 'cushion' && firstIdx >= 0) cushionAfter = true;
      }
      const scratch = potted.includes(0), eight = potted.includes(8);
      const obj = potted.filter(id => id !== 0 && id !== 8);
      const group = this.groups[player];
      const out = { player, potted, objPotted: obj, firstContact: first, scratch, eight, foul: null, win: false, lose: false, rerack: false, assign: null, continues: false };
      if (this.isBreak) {
        out.foul = scratch ? 'scratch' : first === null ? 'no contact' : null;
        if (eight) { out.rerack = true; return out; }
        out.continues = !out.foul && obj.length > 0;
        return out;
      }
      // what was legal before the shot
      let preRemaining = 0;
      for (const b of sim.balls) if (!b.pocketed && b.id !== 0 && b.id !== 8 && (group === null || groupOf(b.id) === group)) preRemaining++;
      for (const id of obj) if (group === null || groupOf(id) === group) preRemaining++;
      const onEight = preRemaining === 0;
      const legalFirst = id => onEight ? id === 8 : (id !== 8 && (group === null || groupOf(id) === group));
      if (scratch) out.foul = 'scratch';
      else if (first === null) out.foul = 'no contact';
      else if (!legalFirst(first)) out.foul = 'wrong ball first';
      else if (potted.length === 0 && !cushionAfter) out.foul = 'no cushion';
      if (eight) {
        if (!out.foul && onEight) out.win = true; else out.lose = true;
        return out;
      }
      if (out.foul) return out;
      let g = group;
      if (g === null && obj.length) { g = groupOf(obj[0]); out.assign = g; }
      out.continues = g === null ? obj.length > 0 : obj.some(id => groupOf(id) === g);
      return out;
    }

    endShot(events = this.sim.shotEvents) {
      if (this.winner !== null) return this.lastShot;
      const p = this.turn, o = 1 - p, r = this.evaluate(events, this.sim, p);
      this.shots++;
      if (r.foul) this.fouls[p]++;
      this.lastShot = r;
      const foulTxt = { 'scratch': 'scratch', 'no contact': 'no ball hit', 'wrong ball first': 'wrong ball first', 'no cushion': 'no cushion after contact' };
      if (r.rerack) {
        const breaker = r.foul ? o : p;
        this.sim.rack();
        this.isBreak = true; this.ballInHand = true; this.kitchen = true; this.turn = breaker;
        this.lastMessage = `Black off the break — re-rack. ${this._n(breaker)} to break.`;
        return r;
      }
      if (r.win) { this.winner = p; this.lastMessage = `${this._v(p, 'sink', 'sinks')} the black. ${this._v(p, 'win', 'wins')}!`; return r; }
      if (r.lose) {
        this.winner = o;
        const why = r.foul ? `Black down on a foul (${foulTxt[r.foul]})` : 'Black down early';
        this.lastMessage = `${why}. ${this._v(o, 'win', 'wins')}!`;
        return r;
      }
      this.isBreak = false;
      if (r.assign) { this.groups[p] = r.assign; this.groups[o] = otherGroup(r.assign); }
      if (r.foul) {
        this.turn = o; this.ballInHand = true; this.kitchen = false;
        if (r.scratch || this.sim.balls[0].pocketed) {
          const spot = this.sim.findCueSpot(TABLE.cueStart.x, TABLE.cueStart.z) || { x: 0, z: 0.85 };
          const c = this.sim.balls[0];
          c.pocketed = false; c.pocket = null; c.x = spot.x; c.z = spot.z; c.vx = c.vz = 0; c.w.x = c.w.y = c.w.z = 0;
        }
        this.lastMessage = `Foul — ${foulTxt[r.foul]}. ${this._has(o)} ball in hand.`;
        return r;
      }
      if (r.continues) {
        this.lastMessage = r.assign ? `${this._is(p)} on ${r.assign}.` : `${this._v(p, 'pot', 'pots')} ${r.objPotted.map(ballName).join(' and ')}.`;
        if (this.remaining(p) === 0 && this.groups[p]) this.lastMessage += ` ${this._is(p)} on the black.`;
        return r;
      }
      this.turn = o;
      this.lastMessage = `${this._your(o)} shot.`;
      return r;
    }
  }

  // ------------------------------------------------------------------
  //  AI
  // ------------------------------------------------------------------
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function gauss(rng) {
    let u = 0; while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  const aimNoise = skill => 0.0005 + 0.04 * Math.pow(1 - Math.max(0, Math.min(1, skill)), 2);

  // is the segment (x1,z1)->(x2,z2) clear of balls by `clear` (centre distance)?
  function pathClear(sim, x1, z1, x2, z2, skipA, skipB, clear = 2 * BALL_R) {
    const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz;
    for (const b of sim.balls) {
      if (b.pocketed || b.id === skipA || b.id === skipB) continue;
      let t = L2 > 0 ? ((b.x - x1) * dx + (b.z - z1) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = b.x - (x1 + dx * t), pz = b.z - (z1 + dz * t);
      if (px * px + pz * pz < clear * clear - 1e-9) return false;
    }
    return true;
  }

  // cue speed so the object ball reaches the pocket with a little pace to spare
  function potPower(d1, d2, cosCut) {
    const ur = Math.sqrt(2 * PHYS.rollDecel * (d2 + 0.12) + 0.09);
    const u0 = ur * 7 / 5;
    const vc = u0 / (cosCut * (1 + PHYS.ballE) / 2);
    const f = 5 / 7 + (2 / 7) * Math.exp(-d1 / (0.125 * vc * vc + 0.05));
    return Math.max(0.5, Math.min(5.5, Math.sqrt(vc * vc + 2 * PHYS.rollDecel * d1) / f));
  }

  // geometric pot evaluation of ball `id` into pocket `pi` from cue at (cx, cz)
  function potGeom(sim, cx, cz, id, pi, sigma) {
    const o = sim.balls[id], pk = TABLE.pockets[pi], R = BALL_R;
    const tx = pk.aim.x, tz = pk.aim.z;
    let dx = tx - o.x, dz = tz - o.z;
    const d2 = hyp(dx, dz);
    if (d2 < 1e-6) return null;
    dx /= d2; dz /= d2;
    const entry = dx * pk.dir.x + dz * pk.dir.z;
    if (entry < pk.minCos) return null;
    const gx = o.x - dx * 2 * R, gz = o.z - dz * 2 * R;
    if (Math.abs(gx) > HALF_W - R + 0.002 || Math.abs(gz) > HALF_L - R + 0.002) return null;
    let ex = gx - cx, ez = gz - cz;
    const d1 = hyp(ex, ez);
    if (d1 < 1e-6) return null;
    ex /= d1; ez /= d1;
    const cosCut = ex * dx + ez * dz;
    if (cosCut < 0.2) return null;
    if (!pathClear(sim, cx, cz, gx, gz, 0, id)) return null;
    if (!pathClear(sim, o.x, o.z, tx, tz, 0, id)) return null;
    const half = pk.mouth.width / 2 * (pk.kind === 'corner' ? entry : entry * entry);
    const tol = Math.max(0.003, half - 0.5 * R) / (d2 + 0.03);
    const sObj = sigma * d1 / (2 * R * cosCut) + 0.004 + 0.01 * (1 - cosCut);
    const p = erf(tol / (sObj * SQ2));
    return { id, pocket: pi, angle: Math.atan2(ex, ez), d1, d2, cosCut, p, power: potPower(d1, d2, cosCut), gx, gz };
  }

  function potOptions(sim, cx, cz, targets, sigma) {
    const out = [];
    for (const id of targets) for (let pi = 0; pi < 6; pi++) { const g = potGeom(sim, cx, cz, id, pi, sigma); if (g) out.push(g); }
    out.sort((a, b) => b.p - a.p);
    return out;
  }

  // how good is the table for `group`'s shooter with the cue where it lies (0..~1.5)
  function positionValue(sim, group, sigma) {
    const c = sim.balls[0];
    if (c.pocketed) return 0;
    const opts = potOptions(sim, c.x, c.z, targetsFor(sim, group), sigma);
    if (!opts.length) return 0;
    let v = opts[0].p;
    const others = new Set(opts.filter(o => o.p > 0.5).map(o => o.id));
    v += Math.min(3, others.size) * 0.12;
    return v;
  }

  function postGroup(match, player, outcome) {
    if (outcome.assign) return outcome.assign;
    return match.isBreak ? null : match.groups[player];
  }

  const AI = {
    aimNoise,
    potOptions,

    // returns { angle, power, spin:{top, side}, place:{x,z}|null, kind, target, pocket }
    // When `place` is set, call sim.placeCue(place.x, place.z, match.kitchen) before sim.shoot(shot).
    chooseShot(sim, match, player = match.turn, skill = 0.6, opts = {}) {
      const rng = opts.rng || sim.rng || Math.random;
      const t0 = now(), budget = opts.budgetMs || 18, maxSims = opts.maxSims || 14;
      const hardStop = () => now() - t0 > budget * 1.3;
      const sigma = aimNoise(skill);
      const R = BALL_R;
      let sims = 0;
      const finish = (shot) => {
        const n = aimNoise(skill);
        shot.angle += gauss(rng) * n;
        shot.power = Math.max(0.2, Math.min(PHYS.maxShotSpeed, shot.power * (1 + gauss(rng) * 0.04 * (1 - skill))));
        shot.spin = shot.spin || { top: 0, side: 0 };
        shot.spin.top = Math.max(-1, Math.min(1, (shot.spin.top || 0) + gauss(rng) * 0.05 * (1 - skill)));
        shot.spin.side = shot.spin.side || 0;
        shot.thinkMs = now() - t0;
        shot.sims = sims;
        return shot;
      };

      // ---- break
      if (match.isBreak) {
        let place = null;
        const cue = sim.balls[0];
        let cx = cue.x, cz = cue.z;
        if (match.ballInHand) {
          const want = { x: (rng() - 0.5) * 0.25, z: 0.86 + rng() * 0.1 };
          const s = sim.findCueSpot(want.x, want.z, true);
          if (s) { place = s; cx = s.x; cz = s.z; }
        }
        // aim at the apex ball (closest ball to the foot spot)
        let apex = null, bd = Infinity;
        for (const b of sim.balls) {
          if (b.pocketed || b.id === 0) continue;
          const d = (b.x - TABLE.footSpot.x) ** 2 + (b.z - TABLE.footSpot.z) ** 2;
          if (d < bd) { bd = d; apex = b; }
        }
        const ang = apex ? Math.atan2(apex.x - cx, apex.z - cz) : Math.PI;
        return finish({ kind: 'break', angle: ang + gauss(rng) * 0.002, power: 6.0 + 0.4 * skill + rng() * 0.1, spin: { top: -0.1, side: 0 }, place, target: apex ? apex.id : null, pocket: null });
      }

      const targets = match.legalTargets(player);
      const myGroupNow = match.groups[player];

      const runTrial = (shot, place) => {
        const s = sim.clone();
        if (place) s.placeCue(place.x, place.z);
        s.shoot(shot);
        const ev = s.simulateUntilRest(20);
        sims++;
        const out = match.evaluate(ev, s, player);
        return { sim: s, ev, out };
      };
      const overBudget = () => sims >= maxSims || now() - t0 > budget;

      // ---- ball in hand: pick a placement giving an easy pot
      let place = null;
      if (match.ballInHand) {
        const cands = [];
        for (const id of targets) {
          const o = sim.balls[id];
          for (let pi = 0; pi < 6; pi++) {
            const pk = TABLE.pockets[pi];
            let dx = pk.aim.x - o.x, dz = pk.aim.z - o.z;
            const d2 = hyp(dx, dz); dx /= d2; dz /= d2;
            if (dx * pk.dir.x + dz * pk.dir.z < pk.minCos) continue;
            if (!pathClear(sim, o.x, o.z, pk.aim.x, pk.aim.z, 0, id)) continue;
            const gx = o.x - dx * 2 * R, gz = o.z - dz * 2 * R;
            for (const phi of [0.12, -0.12, 0.3, -0.3, 0]) {
              for (const L of [0.3, 0.5]) {
                const cdx = dx * Math.cos(phi) - dz * Math.sin(phi), cdz = dx * Math.sin(phi) + dz * Math.cos(phi);
                const px = gx - cdx * L, pz = gz - cdz * L;
                if (!sim.canPlaceCue(px, pz, match.kitchen)) continue;
                const g = potGeom(sim, px, pz, id, pi, sigma);
                if (g) cands.push({ g, place: { x: px, z: pz } });
              }
            }
          }
        }
        cands.sort((a, b) => b.g.p - a.g.p);
        // try the best few placements by simulation
        let best = null;
        const seen = new Set();
        for (const c of cands) {
          if (seen.has(c.g.id * 10 + c.g.pocket)) continue;
          seen.add(c.g.id * 10 + c.g.pocket);
          for (const top of [0, 0.3]) {
            const shot = { angle: c.g.angle, power: c.g.power, spin: { top, side: 0 } };
            const tr = runTrial(shot, c.place);
            const sc = scoreTrial(tr, c.g.p, match, player, sigma);
            if (!best || sc > best.sc) best = { sc, shot, place: c.place, g: c.g };
            if (overBudget()) break;
          }
          if (overBudget() || seen.size >= 4) break;
        }
        if (best && best.sc > 0.5) {
          return finish(Object.assign(best.shot, { kind: 'pot', place: best.place, target: best.g.id, pocket: best.g.pocket }));
        }
        // fall back to a decent spot near the head spot
        const s = sim.findCueSpot(0, 0.75, match.kitchen) || { x: sim.balls[0].x, z: sim.balls[0].z };
        place = s;
      }
      const cueX = place ? place.x : sim.balls[0].x, cueZ = place ? place.z : sim.balls[0].z;

      // ---- pot attempts
      const opts0 = potOptions(sim, cueX, cueZ, targets, sigma).slice(0, 5);
      let best = null;
      const variants = [{ m: 1, top: 0.2 }, { m: 1, top: -0.35 }, { m: 1.3, top: 0.4 }];
      const queue = [];
      for (let v = 0; v < variants.length; v++) for (let k = 0; k < opts0.length; k++) if (v === 0 || k < 2) queue.push([opts0[k], variants[v]]);
      for (const [g, v] of queue) {
        if (sims > 0 && overBudget()) break;
        const shot = { angle: g.angle, power: Math.min(6, g.power * v.m), spin: { top: v.top, side: 0 } };
        const tr = runTrial(shot, place);
        const sc = scoreTrial(tr, g.p, match, player, sigma);
        if (!best || sc > best.sc) best = { sc, shot, g };
      }
      // weaker players have a go at most things; strong players prefer a safety over a low-percentage pot
      if (best && best.sc > 0 && (best.g.p > 0.4 * skill * skill || best.sc > 1)) {
        return finish(Object.assign(best.shot, { kind: 'pot', place, target: best.g.id, pocket: best.g.pocket }));
      }

      // ---- safety: soft legal contact leaving the opponent little
      let safe = null;
      const cue = { x: cueX, z: cueZ };
      const direct = targets.filter(id => pathClear(sim, cueX, cueZ, sim.balls[id].x, sim.balls[id].z, 0, id, 2 * R - 0.001));
      const tryList = [];
      for (const id of direct) {
        const o = sim.balls[id];
        const base = Math.atan2(o.x - cue.x, o.z - cue.z), d = hyp(o.x - cue.x, o.z - cue.z);
        const off = Math.asin(Math.min(1, R / Math.max(d, 2 * R)));
        for (const da of [0, off * 0.9, -off * 0.9]) tryList.push({ id, angle: base + da, power: Math.min(3, 0.9 + d * 0.9) });
      }
      // one-cushion kicks when nothing is directly visible
      if (!tryList.length) {
        for (const id of targets) {
          const o = sim.balls[id];
          const mirrors = [
            { x: 2 * (HALF_W - R) - o.x, z: o.z }, { x: -2 * (HALF_W - R) - o.x, z: o.z },
            { x: o.x, z: 2 * (HALF_L - R) - o.z }, { x: o.x, z: -2 * (HALF_L - R) - o.z },
          ];
          for (const m of mirrors) tryList.push({ id, angle: Math.atan2(m.x - cue.x, m.z - cue.z), power: Math.min(4.5, 1.6 + hyp(m.x - cue.x, m.z - cue.z) * 0.8) });
        }
      }
      for (let i = 0; i < tryList.length; i++) {
        if (safe && (overBudget() || sims > maxSims + 6)) break;
        if (hardStop() && (safe || best)) break;
        const t = tryList[i];
        const shot = { angle: t.angle, power: t.power, spin: { top: 0, side: 0 } };
        const tr = runTrial(shot, place);
        const o = tr.out;
        let sc;
        if (o.lose) sc = -100;
        else if (o.win) sc = 100;
        else if (o.foul) sc = -10;
        else if (o.continues) sc = 2 + positionValue(tr.sim, postGroup(match, player, o), sigma);
        else {
          const og = o.assign ? otherGroup(o.assign) : (myGroupNow ? match.groups[1 - player] : null);
          sc = 1 - positionValue(tr.sim, og, sigma) * 0.8;
        }
        if (!safe || sc > safe.sc) safe = { sc, shot, id: t.id };
      }
      if (best && (!safe || best.sc >= safe.sc || safe.sc < 0)) return finish(Object.assign(best.shot, { kind: 'pot', place, target: best.g.id, pocket: best.g.pocket }));
      if (safe && safe.sc > -5) return finish(Object.assign(safe.shot, { kind: 'safety', place, target: safe.id, pocket: null }));
      // last resort: straight at the nearest legal ball
      let nb = null, nd = Infinity;
      for (const id of targets) { const o = sim.balls[id], d = hyp(o.x - cueX, o.z - cueZ); if (d < nd) { nd = d; nb = o; } }
      const ang = nb ? Math.atan2(nb.x - cueX, nb.z - cueZ) : rng() * 2 * Math.PI;
      return finish({ kind: 'fallback', angle: ang, power: 2.5, spin: { top: 0, side: 0 }, place, target: nb ? nb.id : null, pocket: null });
    },
  };

  function scoreTrial(tr, p, match, player, sigma) {
    const o = tr.out;
    if (o.lose) return -100;
    if (o.win) return 50 * p;
    if (o.foul) return -10;
    if (o.continues) return p * (1.2 + 0.6 * positionValue(tr.sim, postGroup(match, player, o), sigma));
    return 0.05 * p;
  }

  return { Sim, Match, AI, TABLE, BALL_R, PHYS, groupOf, targetsFor };
})();
