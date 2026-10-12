#!/usr/bin/env python3
"""Procedural, smooth, skinned NPC body meshes (no head) -> assets/char/bodies.json

Pipeline (pure numpy, no Blender needed):
  1. The body SHAPE is an implicit surface (signed-distance-ish field) built from a lofted
     trunk + smooth-unioned ellipsoids / tapered capsules (neck, chest, buttocks, deltoids,
     arms, mitten hands, legs, feet).  Arms are separate components that only blend into the
     torso around the shoulder (so they never fuse with the hips).
  2. The TOPOLOGY is a hand-designed low-poly quad cage (rings around torso / limbs, sockets
     for arms, legs, thumbs, feet) whose rings sit exactly on the clothing-segment
     boundaries.  The cage is Catmull-Clark subdivided once, projected onto the implicit
     surface, segment-boundary loops are snapped to their planes, then the mesh is relaxed.
  3. Weights: signed geodesic distance from the shoulder / groin / neck seams + smooth
     blends along the limb bones.  Heavy morph: same vertices pushed onto a heavier field.
  4. Export: vertices split per clothing segment and at the U wrap seam (back of each part).

Run:  <python with numpy> tools/bodies/make_bodies.py   [--obj <dir>]
"""
import numpy as np, json, base64, heapq, math, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'char', 'bodies.json')

BONES = ["hips", "spine", "chest", "neck", "head", "lUA", "lEL", "lH", "rUA", "rEL", "rH",
         "lTH", "lKN", "lFT", "rTH", "rKN", "rFT"]
BI = {b: i for i, b in enumerate(BONES)}

# regions = (clothing segment, side)
REG_NAMES = ['pelvis', 'torso', 'neck', 'lUA', 'lFA', 'lHA', 'lTH', 'lSH', 'lFT', 'rUA', 'rFA', 'rHA', 'rTH', 'rSH', 'rFT']
SEG = [0, 1, 2, 3, 4, 5, 6, 7, 8, 3, 4, 5, 6, 7, 8]
SIDE = [0, 0, 0, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1]
PELVIS, TORSO, NECK = 0, 1, 2
def RG(name, s): return REG_NAMES.index(('l' if s > 0 else 'r') + name)
ARM_REGS = {1: {3, 4, 5}, -1: {9, 10, 11}}
LEG_REGS = {1: {6, 7, 8}, -1: {12, 13, 14}}

Y_REF = 1.60       # v = Y_REF - y for every vertical part (stripes line up across parts)
FOOT_Z0 = -0.06    # foot: v = z - FOOT_Z0 (along the foot)

# ----------------------------------------------------------------------------- params
def params(fem):
    Y = [0.775, 0.82, 0.88, 0.94, 0.98, 1.05, 1.12, 1.20, 1.27, 1.33, 1.38, 1.43, 1.47]
    if not fem:
        P = dict(fem=False, sx=0.200, hx=0.090,
                 loftY=Y,
                 loftW=[0.118, 0.150, 0.162, 0.158, 0.152, 0.145, 0.146, 0.149, 0.150, 0.160, 0.166, 0.160, 0.15],
                 loftDf=[0.062, 0.080, 0.090, 0.094, 0.096, 0.099, 0.104, 0.116, 0.124, 0.115, 0.098, 0.074, 0.06],
                 loftDb=[0.068, 0.088, 0.094, 0.086, 0.082, 0.080, 0.085, 0.097, 0.108, 0.110, 0.104, 0.092, 0.08],
                 loftN=[2.2, 2.25, 2.3, 2.3, 2.3, 2.3, 2.35, 2.45, 2.5, 2.5, 2.5, 2.4, 2.3],
                 loftZ=[0.0, 0.0, -0.004, -0.004, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.004, -0.008, -0.01],
                 topY=1.480, topSlope=0.46,
                 neck=((0, 1.40, -0.014), (0, 1.515, 0.0), 0.052, 0.048),
                 chest=dict(c=(0.072, 1.282, 0.072), r=(0.078, 0.058, 0.055), k=0.035),
                 butt=dict(c=(0.070, 0.862, -0.055), r=(0.082, 0.090, 0.068), k=0.03),
                 belly=None,
                 delt=(0.0, 1.348, 0.0, 0.048, 0.064, 0.056),
                 ua=(0.049, 0.041), bicep=(0.040, 0.075, 0.042),
                 fa=(0.040, 0.042, 0.024, 0.031), fbulge=(0.040, 0.075, 0.044),
                 hs=1.0,
                 thigh=(0.080, 0.052), quad=(0.068, 0.17, 0.068), calf=(0.050, 0.034), calfm=(0.050, 0.105, 0.053),
                 knee=(0.048, 0.055, 0.044),
                 yb=0.82, groin_slope=0.30)
    else:
        P = dict(fem=True, sx=0.184, hx=0.0945,
                 loftY=Y,
                 loftW=[0.125, 0.160, 0.172, 0.163, 0.146, 0.128, 0.124, 0.130, 0.136, 0.146, 0.152, 0.148, 0.14],
                 loftDf=[0.060, 0.078, 0.088, 0.090, 0.088, 0.085, 0.087, 0.092, 0.096, 0.094, 0.088, 0.068, 0.055],
                 loftDb=[0.070, 0.092, 0.100, 0.092, 0.080, 0.072, 0.074, 0.084, 0.090, 0.092, 0.092, 0.085, 0.075],
                 loftN=[2.15, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.25, 2.3, 2.3, 2.3, 2.3, 2.2],
                 loftZ=[0.0, 0.0, -0.006, -0.006, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.004, -0.008, -0.01],
                 topY=1.468, topSlope=0.36,
                 neck=((0, 1.40, -0.014), (0, 1.515, 0.0), 0.046, 0.043),
                 chest=dict(c=(0.070, 1.245, 0.070), r=(0.066, 0.063, 0.060), k=0.035),
                 butt=dict(c=(0.074, 0.858, -0.060), r=(0.088, 0.096, 0.076), k=0.03),
                 belly=None,
                 delt=(0.002, 1.347, 0.0, 0.046, 0.06, 0.05),
                 ua=(0.043, 0.036), bicep=(0.034, 0.07, 0.036),
                 fa=(0.035, 0.037, 0.022, 0.028), fbulge=(0.034, 0.07, 0.038),
                 hs=0.93,
                 thigh=(0.083, 0.050), quad=(0.070, 0.17, 0.070), calf=(0.049, 0.032), calfm=(0.049, 0.10, 0.051),
                 knee=(0.046, 0.052, 0.042),
                 yb=0.815, groin_slope=0.30)
    P['gate0'], P['gate1'] = 1.225, 1.29
    P['xa'] = P['sx'] - 0.047          # armscye seam x at armpit height
    return P


def heavy_params(P):
    H = dict(P)
    add = lambda a, b: [x + y for x, y in zip(a, b)]
    #        0.775 0.82  0.88  0.94  0.98  1.05  1.12  1.20  1.27  1.33  1.38  1.43  1.47
    H['loftW'] = add(P['loftW'], [0.0, 0.012, 0.02, 0.032, 0.040, 0.044, 0.038, 0.024, 0.010, 0.007, 0.005, 0.004, 0.004])
    H['loftDb'] = add(P['loftDb'], [0.0, 0.010, 0.014, 0.022, 0.026, 0.028, 0.026, 0.020, 0.014, 0.011, 0.008, 0.006, 0.005])
    H['loftDf'] = add(P['loftDf'], [0.0, 0.006, 0.010, 0.020, 0.030, 0.035, 0.032, 0.026, 0.020, 0.014, 0.010, 0.006, 0.005])
    a, b, r0, r1 = P['neck']
    H['neck'] = (a, b, r0 + 0.014, r1 + 0.010)
    c = dict(P['chest']); r = c['r']
    c['r'] = (r[0] + 0.012, r[1] + 0.008, r[2] + 0.012); c['c'] = (c['c'][0] + 0.004, c['c'][1] - 0.012, c['c'][2] + 0.008)
    H['chest'] = c
    bt = dict(P['butt']); r = bt['r']; bt['r'] = (r[0] + 0.014, r[1] + 0.008, r[2] + 0.016); H['butt'] = bt
    if P['fem']:
        H['belly'] = dict(c=(0.0, 1.025, 0.072), r=(0.150, 0.150, 0.128), k=0.07)
    else:
        H['belly'] = dict(c=(0.0, 1.035, 0.078), r=(0.162, 0.160, 0.138), k=0.07)
    d = P['delt']; H['delt'] = d[:3] + (d[3] + 0.010, d[4] + 0.006, d[5] + 0.010)
    H['ua'] = (P['ua'][0] + 0.014, P['ua'][1] + 0.010)
    H['bicep'] = tuple(x + 0.010 for x in P['bicep'])
    fa = P['fa']; H['fa'] = (fa[0] + 0.007, fa[1] + 0.007, fa[2] + 0.002, fa[3] + 0.002)
    H['fbulge'] = tuple(x + 0.006 for x in P['fbulge'])
    H['thigh'] = (P['thigh'][0] + 0.022, P['thigh'][1] + 0.008)
    H['quad'] = (P['quad'][0] + 0.016, P['quad'][1], P['quad'][2] + 0.016)
    H['calf'] = (P['calf'][0] + 0.006, P['calf'][1] + 0.002)
    H['calfm'] = tuple(x + 0.006 for x in P['calfm'])
    H['knee'] = tuple(x + 0.006 for x in P['knee'])
    return H


def skeleton(P):
    sx, hx = P['sx'], P['hx']
    R = {"hips": (0, 0.92, 0), "spine": (0, 0.97, 0), "chest": (0, 1.21, 0), "neck": (0, 1.45, 0), "head": (0, 1.52, 0)}
    for s, pre in ((1, 'l'), (-1, 'r')):
        R[pre + 'UA'] = (s * sx, 1.39, 0); R[pre + 'EL'] = (s * sx, 1.10, 0); R[pre + 'H'] = (s * sx, 0.84, 0)
    for s, pre in ((1, 'l'), (-1, 'r')):
        R[pre + 'TH'] = (s * hx, 0.88, 0); R[pre + 'KN'] = (s * hx, 0.45, 0); R[pre + 'FT'] = (s * hx, 0.03, 0)
    return {b: [float(v) for v in R[b]] for b in BONES}

# ----------------------------------------------------------------------------- SDF toolkit
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def smin(a, b, k):
    k = np.maximum(k, 1e-7)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

def sd_ell(p, c, r):
    r = np.asarray(r, float)
    q = (p - np.asarray(c, float)) / r
    k0 = np.sqrt((q * q).sum(1)); q2 = q / r
    k1 = np.sqrt((q2 * q2).sum(1))
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)

def sd_caps(p, a, b, ra, rb):
    a = np.asarray(a, float); b = np.asarray(b, float); ba = b - a
    t = np.clip(((p - a) @ ba) / (ba @ ba), 0, 1)
    q = p - (a + t[:, None] * ba)
    return np.sqrt((q * q).sum(1)) - (ra + (rb - ra) * t)

def sd_vell(p, cx, cz, ya, yb, rxa, rza, rxb, rzb):
    """vertical capsule with tapered elliptic cross-section"""
    t = np.clip((ya - p[:, 1]) / (ya - yb), 0, 1)
    rx = rxa + (rxb - rxa) * t; rz = rza + (rzb - rza) * t; r0 = np.minimum(rx, rz)
    dx = (p[:, 0] - cx) * r0 / rx; dz = (p[:, 2] - cz) * r0 / rz
    dy = p[:, 1] - (ya + (yb - ya) * t)
    return np.sqrt(dx * dx + dy * dy + dz * dz) - r0

def rotx(a):
    c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

def rotz(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def sd_sell(p, c, h, n, R=None):
    q = p - np.asarray(c, float)
    if R is not None:
        q = q @ R
    q = np.abs(q / np.asarray(h, float)) + 1e-12
    rho = ((q ** n).sum(1)) ** (1.0 / n)
    return (rho - 1) * min(h)

def cr_interp(x, X, Y):
    """C1 cubic Hermite (Catmull-Rom style) interpolation, clamped at the ends"""
    X = np.asarray(X, float); Y = np.asarray(Y, float); n = len(X)
    m = np.zeros(n)
    m[1:-1] = (Y[2:] - Y[:-2]) / (X[2:] - X[:-2])
    m[0] = (Y[1] - Y[0]) / (X[1] - X[0]); m[-1] = (Y[-1] - Y[-2]) / (X[-1] - X[-2])
    xc = np.clip(x, X[0], X[-1])
    i = np.clip(np.searchsorted(X, xc) - 1, 0, n - 2)
    h = X[i + 1] - X[i]; t = (xc - X[i]) / h
    t2 = t * t; t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1]

def softpos(u, e=0.02):
    return 0.5 * (u + np.sqrt(u * u + e * e))

# ----------------------------------------------------------------------------- body field
def trunk(p, P):
    y = p[:, 1]; Y = P['loftY']
    w = cr_interp(y, Y, P['loftW']); df = cr_interp(y, Y, P['loftDf']); db = cr_interp(y, Y, P['loftDb'])
    n = cr_interp(y, Y, P['loftN']); zc = cr_interp(y, Y, P['loftZ'])
    dz = p[:, 2] - zc
    d = db + (df - db) * smoothstep(-0.03, 0.03, dz)
    qx = np.abs(p[:, 0]) / w + 1e-12; qz = np.abs(dz) / d + 1e-12
    rho = (qx ** n + qz ** n) ** (1 / n)
    f = (rho - 1) * np.minimum(w, d)
    f = smax(f, Y[0] - y, 0.03)
    top = P['topY'] - P['topSlope'] * softpos(np.abs(p[:, 0]) - 0.05)
    f = smax(f, y - top, 0.045)
    return f

def leg(p, P, s):
    q = p.copy(); q[:, 0] *= s
    hx = P['hx']
    f = sd_caps(q, (hx, 0.90, 0.0), (hx, 0.455, 0.004), *P['thigh'])
    f = smin(f, sd_ell(q, (hx + 0.006, 0.665, 0.014), P['quad']), 0.05)
    f = smin(f, sd_ell(q, (hx, 0.452, 0.016), P['knee']), 0.03)
    ca = sd_caps(q, (hx, 0.45, -0.004), (hx, 0.06, -0.006), *P['calf'])
    ca = smin(ca, sd_ell(q, (hx + 0.003, 0.325, -0.017), P['calfm']), 0.04)
    f = smin(f, ca, 0.035)
    heel = sd_ell(q, (hx, 0.014, -0.008), (0.037, 0.046, 0.042))
    fore = sd_sell(q, (hx, 0.002, 0.075), (0.046, 0.032, 0.102), 2.3, rotx(0.10))
    foot = smin(heel, fore, 0.035)
    foot = smax(foot, -0.03 - q[:, 1], 0.012)
    return smin(f, foot, 0.03)

def body(p, P):
    f = trunk(p, P)
    a, b, r0, r1 = P['neck']
    f = smin(f, sd_caps(p, a, b, r0, r1), 0.035)
    pa = p.copy(); pa[:, 0] = np.abs(pa[:, 0])
    c = P['chest']; f = smin(f, sd_ell(pa, c['c'], c['r']), c['k'])
    c = P['butt']; f = smin(f, sd_ell(pa, c['c'], c['r']), c['k'])
    if P.get('belly'):
        c = P['belly']; f = smin(f, sd_ell(p, c['c'], c['r']), c['k'])
    kl = 0.008 + 0.03 * smoothstep(0.74, 0.80, p[:, 1])   # legs blend into trunk, not each other
    f = smin(f, leg(p, P, 1), kl)
    f = smin(f, leg(p, P, -1), kl)
    return f

def hand(q, P):
    sx, k = P['sx'], P['hs']
    r = (q - np.array([sx, 0.84, 0.0])) / k
    palm = sd_sell(r, (-0.003, -0.050, 0.006), (0.0155, 0.052, 0.043), 2.6)
    fing = sd_sell(r, (-0.011, -0.127, 0.004), (0.0125, 0.042, 0.040), 2.4, rotz(-0.28))
    h = smin(palm, fing, 0.02)
    thumb = sd_caps(r, (-0.006, -0.036, 0.028), (-0.022, -0.086, 0.056), 0.0135, 0.0105)
    h = smin(h, thumb, 0.012)
    return h * k

def arm(p, P, s):
    q = p.copy(); q[:, 0] *= s
    sx = P['sx']; d = P['delt']
    f = sd_ell(q, (sx + d[0], d[1], d[2]), d[3:6])
    f = smin(f, sd_caps(q, (sx, 1.37, 0), (sx, 1.10, 0), *P['ua']), 0.04)
    f = smin(f, sd_ell(q, (sx, 1.215, 0.010), P['bicep']), 0.03)
    fa = sd_vell(q, sx, 0.0, 1.10, 0.85, *P['fa'])
    fa = smin(fa, sd_ell(q, (sx + 0.002, 1.035, 0.004), P['fbulge']), 0.035)
    f = smin(f, fa, 0.03)
    f = smin(f, hand(q, P), 0.018)
    return f

KJ = 0.035
class Field:
    """Implicit functions per vertex category: 'B' body, ('A',s) arm, ('J',s) shoulder junction"""
    def __init__(self, P):
        self.P = P
    def gate(self, p):
        return smoothstep(self.P['gate0'], self.P['gate1'], p[:, 1])
    def __call__(self, cat, p):
        P = self.P
        if cat == 'B':
            b = body(p, P); w = self.gate(p)
            m = w > 0
            if not m.any():
                return b
            out = b.copy(); pm = p[m]
            j = smin(smin(b[m], arm(pm, P, 1), KJ), arm(pm, P, -1), KJ)
            out[m] = b[m] + (j - b[m]) * w[m]
            return out
        kind, s = cat
        a = arm(p, P, s)
        if kind == 'J':
            return smin(body(p, P), a, KJ)
        w = self.gate(p); m = w > 0
        if not m.any():
            return a
        out = a.copy(); pm = p[m]
        j = smin(body(pm, P), a[m], KJ)
        out[m] = a[m] + (j - a[m]) * w[m]
        return out
    def grad(self, cat, p, e=1e-4):
        g = np.zeros_like(p)
        for i in range(3):
            d = np.zeros(3); d[i] = e
            g[:, i] = (self(cat, p + d) - self(cat, p - d)) / (2 * e)
        return g

def raycast(fun, O, D, tmax=0.45, step=0.0015):
    O = np.atleast_2d(np.asarray(O, float)); D = np.atleast_2d(np.asarray(D, float))
    D = D / np.linalg.norm(D, axis=1, keepdims=True)
    if len(O) == 1 and len(D) > 1:
        O = np.repeat(O, len(D), 0)
    T = np.arange(0, tmax, step)
    pts = O[:, None, :] + T[None, :, None] * D[:, None, :]
    v = fun(pts.reshape(-1, 3)).reshape(len(O), len(T))
    out = np.zeros(len(O))
    for i in range(len(O)):
        idx = np.nonzero(v[i] > 0)[0]
        if len(idx) == 0 or idx[0] == 0:
            raise RuntimeError('raycast failed for ray %d origin %s dir %s (v0=%g)' % (i, O[i], D[i], v[i, 0]))
        a, b = T[idx[0] - 1], T[idx[0]]
        for _ in range(30):
            m = 0.5 * (a + b)
            if fun((O[i] + m * D[i])[None])[0] > 0: b = m
            else: a = m
        out[i] = 0.5 * (a + b)
    return O + out[:, None] * D

# ----------------------------------------------------------------------------- cage
class Cage:
    def __init__(self):
        self.V = []; self.F = []; self.R = []; self.ang = {}
    def v(self, p):
        self.V.append(np.asarray(p, float)); return len(self.V) - 1
    def vs(self, pts):
        return [self.v(p) for p in pts]
    def face(self, vids, reg, angs=None):
        assert all(v is not None for v in vids), vids
        self.F.append(list(vids)); self.R.append(reg)
        if angs is not None:
            for v, a in zip(vids, angs):
                self.ang[(v, reg)] = a
    def strip(self, ra, aa, rb, ab, reg, skip=()):
        n = len(ra)
        for k in range(n):
            if k in skip: continue
            k1 = (k + 1) % n
            self.face([ra[k], ra[k1], rb[k1], rb[k]], reg, [aa[k], aa[k1], ab[k1], ab[k]])
    def cap(self, ring, angs, reg):
        """ladder fill of an even ring: tri, quads..., tri"""
        n = len(ring); h = n // 2
        self.face([ring[n - 1], ring[0], ring[1]], reg, [angs[n - 1], angs[0], angs[1]])
        for i in range(1, h - 1):
            j = n - i
            self.face([ring[i], ring[i + 1], ring[j - 1], ring[j]], reg, [angs[i], angs[i + 1], angs[j - 1], angs[j]])
        self.face([ring[h - 1], ring[h], ring[h + 1]], reg, [angs[h - 1], angs[h], angs[h + 1]])

def mir(a, s):
    return a if s > 0 else (360.0 - a) % 360.0

def hdirs(angles, s=1):
    a = np.radians(np.asarray(angles, float))
    return np.stack([s * np.sin(a), 0 * a, np.cos(a)], 1)

PHI8 = [0, 45, 90, 135, 180, 225, 270, 315]
TH12 = [30.0 * k for k in range(12)]

def build_cage(P, field):
    C = Cage()
    sx, hx, yb, sl = P['sx'], P['hx'], P['yb'], P['groin_slope']
    FB = lambda p: field('B', p)
    # ---- torso rings (12 around, angle from front toward +X)
    T = {}
    for name, y in (('R1', 0.98), ('R2', 1.07), ('R3', 1.17), ('R4', 1.30), ('R5', 1.37)):
        T[name] = C.vs(raycast(FB, (0, y, 0), hdirs(TH12)))
    el = math.radians(25)
    a = np.radians(TH12)
    T['R6'] = C.vs(raycast(FB, (0, 1.36, 0), np.stack([np.sin(a) * math.cos(el), np.full(12, math.sin(el)), np.cos(a) * math.cos(el)], 1)))
    nd = np.stack([np.sin(a), -0.3 * np.cos(a), np.cos(a)], 1)
    T['N0'] = C.vs(raycast(FB, (0, 1.445, 0.0), nd))
    T['N1'] = C.vs(raycast(FB, (0, 1.535, 0.0), hdirs(TH12)))
    # leg-hole ring R0: on two tilted planes y = yb + sl*|x|
    d0 = np.stack([np.sin(a), sl * np.abs(np.sin(a)), np.cos(a)], 1)
    T['R0'] = C.vs(raycast(FB, (0, yb, 0), d0))
    crotch = C.v(raycast(FB, (0, yb + 0.02, 0), [(0, -1, 0)])[0])
    # torso / pelvis / neck faces
    C.strip(T['R0'], TH12, T['R1'], TH12, PELVIS)
    C.strip(T['R1'], TH12, T['R2'], TH12, TORSO)
    C.strip(T['R2'], TH12, T['R3'], TH12, TORSO)
    C.strip(T['R3'], TH12, T['R4'], TH12, TORSO)
    C.strip(T['R4'], TH12, T['R5'], TH12, TORSO, skip=(2, 3, 8, 9))
    C.strip(T['R5'], TH12, T['R6'], TH12, TORSO, skip=(2, 3, 8, 9))
    C.strip(T['R6'], TH12, T['N0'], TH12, TORSO)
    C.strip(T['N0'], TH12, T['N1'], TH12, NECK)
    C.cap(T['N1'], TH12, NECK)

    for s in (1, -1):
        FA = lambda p, s=s: field(('A', s), p)
        kf, ks, kb = (2, 3, 4) if s > 0 else (10, 9, 8)
        rUA, rFA, rHA = RG('UA', s), RG('FA', s), RG('HA', s)
        A = lambda lst: [mir(x, s) for x in lst]
        # ---------------- arm
        A0 = [T['R5'][kf], T['R6'][kf], T['R6'][ks], T['R6'][kb], T['R5'][kb], T['R4'][kb], T['R4'][ks], T['R4'][kf]]
        # two tilted rings over the deltoid cap: outer side high on the cap, inner side under the armpit
        ph = np.radians(PHI8)
        def tilted(c, o, rz, ro):
            c = np.array([s * c[0], c[1], 0.0]); o = np.array([s * o[0], o[1], 0.0]); o /= np.linalg.norm(o)
            return C.vs(c + rz * np.cos(ph)[:, None] * np.array([0, 0, 1.0]) + ro * np.sin(ph)[:, None] * o)
        A0b = tilted((sx - 0.012, 1.356), (0.45, 0.89), 0.056, 0.074)
        A1 = tilted((sx, 1.308), (0.663, 0.749), 0.054, 0.070)
        rings = [A0, A0b, A1]
        for y in (1.215, 1.155, 1.10, 1.045, 0.84):
            rings.append(C.vs(raycast(FA, (s * sx, y, 0), hdirs(PHI8, s))))
        regs = [rUA, rUA, rUA, rUA, rUA, rFA, rFA]
        for i in range(7):
            C.strip(rings[i], A(PHI8), rings[i + 1], A(PHI8), regs[i])
        wrist = rings[-1]
        H1 = C.vs(raycast(FA, (s * (sx - 0.005), 0.80, 0.005), hdirs(PHI8, s)))
        H2 = C.vs(raycast(FA, (s * (sx - 0.008), 0.755, 0.005), hdirs(PHI8, s)))
        H4 = C.vs(raycast(FA, (s * (sx - 0.016), 0.692, 0.004), hdirs(PHI8, s)))
        C.strip(wrist, A(PHI8), H1, A(PHI8), rHA)
        C.strip(H1, A(PHI8), H2, A(PHI8), rHA, skip=(7,))
        C.strip(H2, A(PHI8), H4, A(PHI8), rHA)
        C.cap(H4, A(PHI8), rHA)
        # thumb on the front/palm corner between H1 and H2
        S = [H1[7], H1[0], H2[0], H2[7]]
        Sp = np.array([C.V[v] for v in S]); c0 = Sp.mean(0)
        dt = np.array([s * -0.30, -0.75, 0.58]); dt /= np.linalg.norm(dt)
        def tring(dist, rad):
            cc = c0 + dist * dt; out = []
            for p in Sp:
                r = p - c0; r -= dt * (r @ dt); r /= np.linalg.norm(r)
                out.append(cc + rad * r)
            return out
        T1 = C.vs(tring(0.022, 0.012)); T2 = C.vs(tring(0.044, 0.010))
        def gang(vids, cx=s * sx):
            return [math.degrees(math.atan2(C.V[v][0] - cx, C.V[v][2])) % 360 for v in vids]
        C.strip(S, [mir(315, s), mir(0, s), mir(0, s), mir(315, s)], T1, gang(T1), rHA)
        C.strip(T1, gang(T1), T2, gang(T2), rHA)
        C.face(T2, rHA, gang(T2))
        # ---------------- leg
        rTH, rSH, rFT = RG('TH', s), RG('SH', s), RG('FT', s)
        roles = [0, 1, 2, 3, 4, 5, 6] if s > 0 else [0, 11, 10, 9, 8, 7, 6]
        L0 = [T['R0'][k] for k in roles] + [crotch]
        LPHI = [315, 0, 45, 90, 135, 180, 225, 270]
        rings = [L0]
        for y in (0.60, 0.45, 0.37, 0.24, 0.08):
            rings.append(C.vs(raycast(FB, (s * hx, y, -0.004), hdirs(LPHI, s))))
        regs = [rTH, rTH, rSH, rSH, rSH]
        for i in range(5):
            C.strip(rings[i], A(LPHI), rings[i + 1], A(LPHI), regs[i])
        ank = rings[-1]
        # foot tube along +Z, psi from top toward +X (left)
        FR = []
        spec = [(-0.036, 0.016, 0.046, 0.036), (0.0, 0.012, 0.045, 0.042), (0.045, 0.006, 0.038, 0.045), (0.100, -0.002, 0.030, 0.046)]
        ps = np.radians(PHI8)
        for (z, yc, h, w) in spec:
            pts = np.stack([s * hx + s * w * np.sin(ps), yc + h * np.cos(ps), np.full(8, z)], 1)
            FR.append(pts)
        FRv = []
        for j, pts in enumerate(FR):
            vids = []
            for i in range(8):
                vids.append(None if (j == 1 and i == 0) else C.v(pts[i]))
            FRv.append(vids)
        P8 = A(PHI8)
        C.strip(FRv[0], P8, FRv[1], P8, rFT, skip=(7, 0))
        C.strip(FRv[1], P8, FRv[2], P8, rFT, skip=(7, 0))
        C.strip(FRv[2], P8, FRv[3], P8, rFT)
        C.cap(FRv[3], P8, rFT)
        heel = [FRv[0][(8 - i) % 8] for i in range(8)]       # reversed so the ladder walks the other way
        C.cap(heel, [P8[(8 - i) % 8] for i in range(8)], rFT)
        sock = [FRv[2][0], FRv[2][1], FRv[1][1], FRv[0][1], FRv[0][0], FRv[0][7], FRv[1][7], FRv[2][7]]
        sock_psi = A([0, 45, 45, 45, 0, 315, 315, 315])
        C.strip(ank, sock_psi, sock, sock_psi, rFT)
    return C

# ----------------------------------------------------------------------------- mesh ops
def compact(V, F):
    used = sorted({v for f in F for v in f})
    remap = {v: i for i, v in enumerate(used)}
    return np.array([V[v] for v in used]), [[remap[v] for v in f] for f in F], remap

def edge_faces(F):
    ef = {}
    for fi, f in enumerate(F):
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            ef.setdefault((min(a, b), max(a, b)), []).append(fi)
    return ef

def orient(V, F):
    ef = edge_faces(F)
    bad = [k for k, v in ef.items() if len(v) != 2]
    if bad:
        raise RuntimeError('non-manifold edges: %d e.g. %s' % (len(bad), bad[:5]))
    nf = len(F); done = [False] * nf
    for seed in range(nf):
        if done[seed]: continue
        done[seed] = True; stack = [seed]
        while stack:
            fi = stack.pop(); f = F[fi]
            for i in range(len(f)):
                a, b = f[i], f[(i + 1) % len(f)]
                for g in ef[(min(a, b), max(a, b))]:
                    if g == fi or done[g]: continue
                    fg = F[g]
                    same = any(fg[j] == a and fg[(j + 1) % len(fg)] == b for j in range(len(fg)))
                    if same: F[g] = fg[::-1]
                    done[g] = True; stack.append(g)
    vol = 0.0
    for f in F:
        for i in range(1, len(f) - 1):
            vol += np.dot(V[f[0]], np.cross(V[f[i]], V[f[i + 1]]))
    if vol < 0:
        F = [f[::-1] for f in F]
    return F

def catmull_clark(V, F, R, ang):
    nV = len(V)
    ef = edge_faces(F)
    E = list(ef.keys()); eidx = {e: i for i, e in enumerate(E)}; nE = len(E)
    FP = np.array([V[f].mean(0) for f in F])
    EP = np.array([(V[a] + V[b] + FP[ef[(a, b)][0]] + FP[ef[(a, b)][1]]) / 4 for (a, b) in E])
    vf = [[] for _ in range(nV)]; ve = [[] for _ in range(nV)]
    for fi, f in enumerate(F):
        for v in f: vf[v].append(fi)
    for i, (a, b) in enumerate(E):
        ve[a].append(i); ve[b].append(i)
    VP = np.zeros_like(V)
    for v in range(nV):
        n = len(ve[v]); Q = FP[vf[v]].mean(0)
        Rm = np.mean([(V[E[e][0]] + V[E[e][1]]) / 2 for e in ve[v]], 0)
        VP[v] = (Q + 2 * Rm + (n - 3) * V[v]) / n
    NV = np.vstack([VP, EP, FP])
    NF, NR = [], []
    nang = {}
    def u2(a):
        r = math.radians(a); return np.array([math.cos(r), math.sin(r)])
    for (v, r), a in ang.items():
        nang[(v, r)] = u2(a)
    for fi, f in enumerate(F):
        k = len(f); reg = R[fi]; fp = nV + nE + fi
        nang[(fp, reg)] = np.sum([u2(ang[(v, reg)]) for v in f], 0)
        for i in range(k):
            a, b, p = f[i], f[(i + 1) % k], f[(i - 1) % k]
            eab = nV + eidx[(min(a, b), max(a, b))]; epa = nV + eidx[(min(p, a), max(p, a))]
            NF.append([a, eab, fp, epa]); NR.append(reg)
            nang[(eab, reg)] = u2(ang[(a, reg)]) + u2(ang[(b, reg)])
    out = {}
    for k, vec in nang.items():
        out[k] = math.degrees(math.atan2(vec[1], vec[0])) % 360 if np.linalg.norm(vec) > 1e-6 else 0.0
    return NV, NF, NR, out

# ----------------------------------------------------------------------------- constraints
def plane_list(regs, P):
    """planes (n, d) with n.p = d for every pair of regions meeting at a vertex"""
    out = []
    xa, yb, sl = P['xa'], P['yb'], P['groin_slope']
    def add(n, d):
        n = np.asarray(n, float); l = np.linalg.norm(n); out.append((n / l, d / l))
    rs = sorted(regs)
    for i in range(len(rs)):
        for j in range(i + 1, len(rs)):
            a, b = rs[i], rs[j]
            pair = {a, b}
            if pair == {PELVIS, TORSO}: add((0, 1, 0), 0.98)
            elif pair == {TORSO, NECK}: add((0, 1, 0.3), 1.445)
            elif pair == {RG('TH', 1), RG('TH', -1)}: add((1, 0, 0), 0.0)
            else:
                for s in (1, -1):
                    if pair == {TORSO, RG('UA', s)}: add((s, -0.25, 0), xa - 0.25 * 1.30)
                    elif pair == {RG('UA', s), RG('FA', s)}: add((0, 1, 0), 1.10)
                    elif pair == {RG('FA', s), RG('HA', s)}: add((0, 1, 0), 0.84)
                    elif pair == {PELVIS, RG('TH', s)}: add((-sl * s, 1, 0), yb)
                    elif pair == {RG('TH', s), RG('SH', s)}: add((0, 1, 0), 0.45)
                    elif pair == {RG('SH', s), RG('FT', s)}: add((0, 1, 0), 0.08)
    return out

def vertex_regions(nV, F, R):
    vr = [set() for _ in range(nV)]
    for f, r in zip(F, R):
        for v in f: vr[v].add(r)
    return vr

def vertex_cat(regs):
    for s in (1, -1):
        if regs & ARM_REGS[s]:
            return ('J', s) if (regs - ARM_REGS[s]) else ('A', s)
    return 'B'

class Projector:
    def __init__(self, field, cats, planes):
        self.field = field; self.cats = cats; self.planes = planes
        self.groups = {}
        for i, c in enumerate(cats):
            self.groups.setdefault(c, []).append(i)
        self.groups = {c: np.array(ix) for c, ix in self.groups.items()}
        self.con = [i for i in range(len(cats)) if planes[i]]
    def newton(self, X, iters=12, maxstep=0.01, subset=None):
        X = X.copy()
        for c, ix in self.groups.items():
            if subset is not None:
                ix = ix[subset[ix]]
                if len(ix) == 0: continue
            p = X[ix]
            for _ in range(iters):
                f = self.field(c, p); g = self.field.grad(c, p)
                st = -(f / ((g * g).sum(1) + 1e-12))[:, None] * g
                ln = np.linalg.norm(st, axis=1)
                st *= np.minimum(1.0, maxstep / np.maximum(ln, 1e-12))[:, None]
                p = p + st
            X[ix] = p
        return X
    def project(self, X, rounds=6):
        X = self.newton(X, 20)
        if self.con:
            mask = np.zeros(len(X), bool); mask[self.con] = True
        for _ in range(rounds):
            if not self.con: break
            for i in self.con:
                for (n, d) in self.planes[i]:
                    X[i] -= (X[i] @ n - d) * n
            X = self.newton(X, 4, subset=mask)
        for i in self.con:  # final exact plane snap (tiny residual off-surface is fine)
            for _ in range(3):
                for (n, d) in self.planes[i]:
                    X[i] -= (X[i] @ n - d) * n
        return X
    def normals(self, X):
        Nn = np.zeros_like(X)
        for c, ix in self.groups.items():
            g = self.field.grad(c, X[ix]); Nn[ix] = g / np.linalg.norm(g, axis=1, keepdims=True)
        return Nn

def neighbors(nV, F):
    nb = [set() for _ in range(nV)]
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            nb[a].add(b); nb[b].add(a)
    return [sorted(x) for x in nb]

def relax(X, nb, vregs, proj, iters=8, lam=0.5):
    nV = len(X)
    # boundary vertices only average along their own loop, corners stay put
    nbl = []
    for i in range(nV):
        if len(vregs[i]) == 1: nbl.append(nb[i])
        elif len(vregs[i]) == 2: nbl.append([j for j in nb[i] if vregs[j] == vregs[i]])
        else: nbl.append([])
    for _ in range(iters):
        N = proj.normals(X)
        L = np.array([X[n].mean(0) if len(n) else X[i] for i, n in enumerate(nbl)])
        D = L - X
        D -= N * (D * N).sum(1, keepdims=True)
        X = proj.project(X + lam * D, rounds=3)
    return X

def tri_split(X, F, R):
    tris, treg = [], []
    for f, r in zip(F, R):
        a, b, c, d = f
        if np.linalg.norm(X[a] - X[c]) <= np.linalg.norm(X[b] - X[d]):
            tris += [(a, b, c), (a, c, d)]
        else:
            tris += [(a, b, d), (b, c, d)]
        treg += [r, r]
    return np.array(tris), np.array(treg)

def vnormals(X, T):
    N = np.zeros_like(X)
    fn = np.cross(X[T[:, 1]] - X[T[:, 0]], X[T[:, 2]] - X[T[:, 0]])
    for k in range(3):
        np.add.at(N, T[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)

def geodesic(nV, nb, X, sources):
    dist = np.full(nV, np.inf); h = []
    for s in sources:
        dist[s] = 0.0; h.append((0.0, s))
    heapq.heapify(h)
    while h:
        d, v = heapq.heappop(h)
        if d > dist[v]: continue
        for w in nb[v]:
            nd = d + float(np.linalg.norm(X[v] - X[w]))
            if nd < dist[w]:
                dist[w] = nd; heapq.heappush(h, (nd, w))
    return dist

# ----------------------------------------------------------------------------- weights
def compute_weights(X, nb, vregs, P):
    nV = len(X); y = X[:, 1]
    W = np.zeros((nV, len(BONES)))
    def signed(child_regs, parent_regs):
        src = [i for i in range(nV) if (vregs[i] & child_regs) and (vregs[i] & parent_regs)]
        d = geodesic(nV, nb, X, src)
        sgn = np.array([1.0 if (vregs[i] & child_regs) else -1.0 for i in range(nV)])
        return d * sgn
    rA, rL = {}, {}
    for s in (1, -1):
        sd = signed(ARM_REGS[s], {TORSO})
        rA[s] = smoothstep(-0.05, 0.06, sd)
        sd = signed({RG('TH', s)}, {PELVIS})
        rL[s] = smoothstep(-0.06, 0.06, sd)
    sdn = signed({NECK}, {TORSO})
    rN = smoothstep(-0.02, 0.04, sdn)
    limb = rA[1] + rA[-1] + rL[1] + rL[-1]
    sc = np.where(limb > 1, 1 / np.maximum(limb, 1e-9), 1.0)
    for s in (1, -1):
        rA[s] = rA[s] * sc; rL[s] = rL[s] * sc
    central = np.clip(1 - (rA[1] + rA[-1] + rL[1] + rL[-1]), 0, 1)
    neck = central * rN; tor = central * (1 - rN)
    cs = smoothstep(1.12, 1.30, y); ss = smoothstep(0.90, 1.03, y)
    W[:, BI['hips']] = tor * (1 - ss)
    W[:, BI['spine']] = tor * ss * (1 - cs)
    W[:, BI['chest']] = tor * ss * cs
    hs = 0.5 * smoothstep(1.50, 1.565, y)
    W[:, BI['neck']] = neck * (1 - hs)
    W[:, BI['head']] = neck * hs
    e = smoothstep(1.10 + 0.045, 1.10 - 0.045, y); hnd = smoothstep(0.87, 0.835, y)
    kn = smoothstep(0.45 + 0.055, 0.45 - 0.055, y); ft = smoothstep(0.12, 0.065, y)
    for s, pre in ((1, 'l'), (-1, 'r')):
        W[:, BI[pre + 'UA']] = rA[s] * (1 - e)
        W[:, BI[pre + 'EL']] = rA[s] * e * (1 - hnd)
        W[:, BI[pre + 'H']] = rA[s] * e * hnd
        W[:, BI[pre + 'TH']] = rL[s] * (1 - kn)
        W[:, BI[pre + 'KN']] = rL[s] * kn * (1 - ft)
        W[:, BI[pre + 'FT']] = rL[s] * kn * ft
    # the shin/foot are geodesically far from the groin: rL already 1 there
    W[W < 1e-4] = 0
    idx = np.argsort(-W, axis=1)[:, :4]
    wt = np.take_along_axis(W, idx, 1)
    wt /= wt.sum(1, keepdims=True)
    # sort indices for neatness; zero-weight slots point at bone 0
    idx = np.where(wt > 0, idx, 0)
    return idx.astype(np.uint8), wt.astype(np.float32)

# ----------------------------------------------------------------------------- heavy
def heavy_positions(X, N, cats, planes, fieldH, nb, vregs):
    H = X.copy()
    groups = {}
    for i, c in enumerate(cats): groups.setdefault(c, []).append(i)
    ts = np.arange(-0.03, 0.26, 0.002)
    for c, ix in groups.items():
        ix = np.array(ix)
        P0 = X[ix]; D = N[ix]
        pts = P0[:, None, :] + ts[None, :, None] * D[:, None, :]
        v = fieldH(c, pts.reshape(-1, 3)).reshape(len(ix), len(ts))
        i0 = np.searchsorted(ts, 0.0)
        for k in range(len(ix)):
            row = v[k]
            # nearest sign change to t=0
            sc = np.nonzero(np.sign(row[:-1]) != np.sign(row[1:]))[0]
            if len(sc) == 0:
                continue
            j = sc[np.argmin(np.abs(sc - i0))]
            a, b = ts[j], ts[j + 1]; fa = row[j]
            for _ in range(25):
                m = 0.5 * (a + b); fm = fieldH(c, (P0[k] + m * D[k])[None])[0]
                if np.sign(fm) == np.sign(fa): a, fa = m, fm
                else: b = m
            H[ix[k]] = P0[k] + 0.5 * (a + b) * D[k]
    proj = Projector(fieldH, cats, planes)
    H = proj.project(H, rounds=4)
    H = relax(H, nb, vregs, proj, iters=4, lam=0.35)
    return H

# ----------------------------------------------------------------------------- build one variant
def b64(a, dt):
    return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode('ascii')

def build_variant(fem, obj_dir=None):
    P = params(fem); field = Field(P)
    C = build_cage(P, field)
    V, F, remap = compact(C.V, C.F)
    ang = {(remap[v], r): a for (v, r), a in C.ang.items() if v in remap}
    F = orient(V, F)
    R = list(C.R)
    print('  cage: %d verts %d faces' % (len(V), len(F)))
    X, F2, R2, ang2 = catmull_clark(V, F, R, ang)
    nV = len(X)
    vregs = vertex_regions(nV, F2, R2)
    cats = [vertex_cat(r) for r in vregs]
    planes = [plane_list(r, P) if len(r) > 1 else [] for r in vregs]
    proj = Projector(field, cats, planes)
    X = proj.project(X, rounds=8)
    nb = neighbors(nV, F2)
    X = relax(X, nb, vregs, proj, iters=10, lam=0.5)
    T, TR = tri_split(X, F2, R2)
    N = vnormals(X, T)
    # heavy
    PH = heavy_params(P); fieldH = Field(PH)
    H = heavy_positions(X, N, cats, planes, fieldH, nb, vregs)
    # smooth the delta a touch (keeps it free of high-frequency noise)
    Dl = H - X
    nba = [np.array(n) for n in nb]
    for _ in range(2):
        Dl = 0.5 * Dl + 0.5 * np.array([Dl[n].mean(0) for n in nba])
    H = X + Dl
    NH = vnormals(H, T)
    sk_i, sk_w = compute_weights(X, nb, vregs, P)
    # ---- split per (vertex, region, wrap)
    def uval(v, r):
        a = ang2.get((v, r), 0.0)
        u = (a / 360.0 + 0.5) % 1.0
        return 0.0 if u > 0.99995 else u
    def vval(p, r):
        if SEG[r] == 8: return p[2] - FOOT_Z0
        return Y_REF - p[1]
    keymap = {}; verts = []; idx = []
    for t, r in zip(T, TR):
        us = [uval(v, r) for v in t]
        wrap = (max(us) - min(us)) > 0.5
        tri = []
        for v, u in zip(t, us):
            w = 1 if (wrap and u < 0.5) else 0
            key = (int(v), int(r), w)
            if key not in keymap:
                keymap[key] = len(verts); verts.append((int(v), int(r), u + w))
            tri.append(keymap[key])
        idx.append(tri)
    src = np.array([v for v, _, _ in verts]); regs = np.array([r for _, r, _ in verts])
    pos = X[src]; nrm = N[src]
    uv = np.array([[u, vval(X[v], r)] for v, r, u in verts])
    out = dict(rest=skeleton(P), count=int(len(verts)),
               position=b64(pos, '<f4'), normal=b64(nrm, '<f4'), uv=b64(uv, '<f4'),
               heavy=b64(H[src] - X[src], '<f4'), heavyNormal=b64(NH[src], '<f4'),
               skinIndex=b64(sk_i[src], 'u1'), skinWeight=b64(sk_w[src], '<f4'),
               seg=b64(np.array(SEG)[regs], 'u1'), side=b64(np.array(SIDE)[regs], 'i1'),
               index=b64(np.array(idx).reshape(-1), '<u2'))
    print('  final: %d welded verts, %d split verts, %d tris' % (nV, len(verts), len(idx)))
    if obj_dir:
        os.makedirs(obj_dir, exist_ok=True)
        nm = 'female' if fem else 'male'
        for tag, XX in (('', X), ('_heavy', H)):
            with open(os.path.join(obj_dir, nm + tag + '.obj'), 'w') as fo:
                for p in XX: fo.write('v %.5f %.5f %.5f\n' % tuple(p))
                for t in T: fo.write('f %d %d %d\n' % (t[0] + 1, t[1] + 1, t[2] + 1))
    return out


def main():
    obj_dir = None
    if '--obj' in sys.argv:
        obj_dir = sys.argv[sys.argv.index('--obj') + 1]
    data = {'bones': BONES}
    for fem in (False, True):
        print('building', 'female' if fem else 'male')
        data['female' if fem else 'male'] = build_variant(fem, obj_dir)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')

if __name__ == '__main__':
    main()
