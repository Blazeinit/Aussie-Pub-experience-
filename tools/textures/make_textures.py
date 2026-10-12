"""Procedural PBR texture generator for The Royal Hotel.

Run with the Blender-venv python (numpy/scipy/pillow needed, bpy not needed):
    python tools/textures/make_textures.py            # all materials
    python tools/textures/make_textures.py floor brick # just some

Writes <name>_c.jpg (albedo, sRGB), <name>_n.jpg (normal, OpenGL +Y, linear),
<name>_r.jpg (roughness, linear) and manifest.json into assets/tex/.

Every map is synthesised on a periodic domain (FFT noise, wrap-mode filters,
periodic Voronoi, periodic layouts) so all maps tile seamlessly.
Internal resolution is 2048^2 (supersampled), downsampled to 1024 (colour,
normal) and 512 (roughness).
"""
import sys
import time

import numpy as np

from texlib import (WrapCanvas, blur, col, fft_noise, lerp, local_patch, norm01, rng,
                    sample_wrap, save_set, seam_report, smoothstep, warp, worley, OUT_DIR)

S = 2048
MATERIALS = {}


def material(fn):
    MATERIALS[fn.__name__.replace("mat_", "")] = fn
    return fn


def grid():
    R, C = np.mgrid[0:S, 0:S].astype(np.float32)
    return R, C


def lum(c):
    return (c[..., 0] * 0.3 + c[..., 1] * 0.59 + c[..., 2] * 0.11)


def desat(c, amt):
    l = lum(c)[..., None]
    return c + (l - c) * amt


def cavity(h, sigma, scale):
    """>0 where the surface is lower than its surroundings (for grime / AO)."""
    return np.clip((blur(h, sigma) - h) * scale, 0, 1)


# ----------------------------------------------------------------------------
# board layouts (floor, deck, wainscot)
# ----------------------------------------------------------------------------
def column_boards(ncols, col_w, joints_per_col):
    """joints_per_col: list of sorted joint row positions per column (may be empty = continuous).
    Returns per-pixel board id, local x (px), local y (px from board start), board length (px)."""
    R, C = grid()
    ci = np.minimum((C // col_w).astype(int), ncols - 1)
    lx = C - ci * col_w
    bid = np.zeros((S, S), np.int32)
    ly = np.zeros((S, S), np.float32)
    blen = np.zeros((S, S), np.float32)
    rows = np.arange(S)
    nb = 0
    info = []
    for c in range(ncols):
        J = np.asarray(sorted(joints_per_col[c]), dtype=np.float32)
        m = ci[0] == c
        if len(J) == 0:
            idx = np.zeros(S, int)
            start = np.zeros(S, np.float32)
            L = np.full(S, S, np.float32)
            nbc = 1
            starts = [0.0]
            lens = [S]
        else:
            idx = np.searchsorted(J, rows + 0.5, side="right") - 1
            idx[idx < 0] = len(J) - 1
            start = J[idx]
            nxt = J[(idx + 1) % len(J)]
            L = np.mod(nxt - start, S)
            L[L == 0] = S
            nbc = len(J)
            starts = list(J)
            lens = [float(np.mod(J[(k + 1) % len(J)] - J[k], S) or S) for k in range(len(J))]
        local = np.mod(rows + 0.5 - start, S)
        cols = np.where(m)[0]
        bid[:, cols] = (nb + idx)[:, None]
        ly[:, cols] = local[:, None]
        blen[:, cols] = L[:, None]
        for k in range(nbc):
            info.append(dict(col=c, start=starts[k], length=lens[k]))
        nb += nbc
    return bid, lx, ly, blen, info


def stagger_joints(ncols, S_, choose, seed, min_sep):
    """choose(r) -> list of segment lengths (px) summing to S. Joint positions staggered
    so neighbouring columns keep min_sep apart (periodic in both directions)."""
    r = rng(seed)
    out = []
    for c in range(ncols):
        for attempt in range(500):
            segs = choose(r)
            off = r.uniform(0, S_)
            J = np.mod(off + np.concatenate([[0], np.cumsum(segs)[:-1]]), S_)
            neigh = []
            if c > 0:
                neigh += list(out[c - 1])
            if c == ncols - 1 and out:
                neigh += list(out[0])
            ok = True
            for j in J:
                for q in neigh:
                    d = abs(j - q)
                    d = min(d, S_ - d)
                    if d < min_sep:
                        ok = False
            if ok:
                break
        out.append(sorted(J.tolist()))
    return out


def per_board(bid, values):
    return np.asarray(values, dtype=np.float32)[bid]


def board_noise(field, bid, nb, seed):
    """Sample a periodic noise field with a different integer offset per board."""
    r = rng(seed)
    oy = r.integers(0, S, nb)
    ox = r.integers(0, S, nb)
    R, C = np.mgrid[0:S, 0:S]
    return field[(R + oy[bid]) % S, (C + ox[bid]) % S]


def wood_rings(xmm, ymm, bid, nb, seed, spacing=(3.0, 6.0), width_mm=130.0, dist_amp=2.5,
               periodic_len=None, tilt=(0.004, 0.03)):
    """Flat-sawn growth-ring pattern per board. Returns (ring phase fraction, ring index).
    If periodic_len is given (px of a full tile), the depth term is periodic along y."""
    r = rng(seed)
    xp = r.uniform(-0.6, 1.6, nb) * width_mm           # pith position across the board
    z0 = r.uniform(15, 140, nb)                          # depth of the face below the pith
    sl = r.uniform(*tilt, nb) * r.choice([-1, 1], nb)    # axis tilt -> cathedrals
    sp = r.uniform(*spacing, nb)
    ph = r.uniform(0, 2 * np.pi, nb)
    n1 = board_noise(fft_noise((S, S), seed + 1, lo=2, hi=200, beta=2.2, stretch=(1, 10)), bid, nb, seed + 2)
    n2 = board_noise(fft_noise((S, S), seed + 3, lo=1, hi=60, beta=2.0, stretch=(1, 6)), bid, nb, seed + 4)
    n3 = board_noise(fft_noise((S, S), seed + 5, lo=20, hi=500, beta=1.6, stretch=(1, 4)), bid, nb, seed + 6)
    if periodic_len is None:
        z = z0[bid] + sl[bid] * ymm + 6.0 * n2
    else:
        z = z0[bid] + 25.0 * np.abs(sl[bid]) / 0.03 * np.sin(2 * np.pi * ymm / periodic_len + ph[bid]) + 5.0 * n2
    x = xmm - xp[bid] + dist_amp * n1
    rad = np.sqrt(x * x + z * z) + 0.25 * n3
    t = rad / sp[bid]
    return t - np.floor(t), np.floor(t)


# ----------------------------------------------------------------------------
# 1. floor
# ----------------------------------------------------------------------------
@material
def mat_floor():
    size = 2.08
    pxmm = size * 1000 / S
    ncols, cw = 16, S // 16
    seed = 101
    ppm = S / size  # px per metre

    def choose(r):
        if r.random() < 0.3:
            return [S]
        a = r.uniform(0.9, size - 0.9) * ppm
        return [a, S - a]

    J = stagger_joints(ncols, S, choose, seed, min_sep=0.22 * ppm)
    bid, lx, ly, blen, info = column_boards(ncols, cw, J)
    nb = len(info)
    r = rng(seed + 10)
    xmm = lx * pxmm
    ymm = ly * pxmm
    R, C = grid()

    # --- board colour palette (spotted gum / jarrah, sRGB)
    pal = col([
        [0.42, 0.18, 0.10],  # dark jarrah
        [0.50, 0.23, 0.13],  # jarrah
        [0.55, 0.30, 0.17],  # red brown
        [0.55, 0.36, 0.22],  # spotted gum brown
        [0.62, 0.42, 0.25],  # honey
        [0.46, 0.27, 0.16],  # mid brown
        [0.36, 0.20, 0.12],  # chocolate
    ])
    w = np.array([1.0, 1.5, 1.4, 1.5, 1.2, 1.2, 0.6])
    pick = r.choice(len(pal), nb, p=w / w.sum())
    base = pal[pick] * r.uniform(0.9, 1.08, (nb, 1)).astype(np.float32)
    base = base * 0.85 + col([0.46, 0.29, 0.17]) * 0.15
    base *= np.where(r.random(nb) < 0.12, 0.72, 1.0)[:, None]  # a few darker-stained boards
    base = np.clip(base + r.normal(0, 0.015, (nb, 3)), 0, 1).astype(np.float32)
    bc = base[bid]

    # --- grain
    ring, ringi = wood_rings(xmm, ymm, bid, nb, seed + 20, spacing=(2.2, 4.5))
    late = smoothstep(0.55, 0.93, ring) * (1 - smoothstep(0.95, 1.0, ring))
    ringvar = board_noise(fft_noise((S, S), seed + 30, lo=3, hi=40, stretch=(1, 3)), bid, nb, seed + 31)
    streak = board_noise(fft_noise((S, S), seed + 32, lo=3, hi=120, beta=1.8, stretch=(1, 9)), bid, nb, seed + 33)
    pores = board_noise(fft_noise((S, S), seed + 34, lo=150, hi=900, beta=1.0, stretch=(1, 14)), bid, nb, seed + 35)
    poremask = smoothstep(1.2, 2.4, -pores)
    fine = board_noise(fft_noise((S, S), seed + 36, lo=200, hi=1000, beta=0.5, stretch=(1, 5)), bid, nb, seed + 37)

    shade = 1.0 - 0.16 * late * (0.6 + 0.4 * np.clip(ringvar * 0.5 + 0.5, 0, 1))
    shade *= 1.0 + 0.12 * streak
    shade *= 1.0 - 0.22 * poremask
    shade *= 1.0 + 0.025 * fine
    alb = bc * shade[..., None]
    # streaks also shift hue a bit (redder darker streaks)
    alb[..., 0] *= 1.0 + 0.04 * np.clip(-streak, 0, 2)
    alb[..., 2] *= 1.0 - 0.06 * np.clip(-streak, 0, 2)

    # fiddleback on a few boards
    fid = r.random(nb) < 0.0
    fphase = board_noise(fft_noise((S, S), seed + 38, lo=2, hi=30, stretch=(3, 1)), bid, nb, seed + 39)
    fb = np.sin(2 * np.pi * ymm / r.uniform(14, 24) + 1.5 * fphase)
    alb *= (1.0 + 0.045 * fb * fid[bid])[..., None]

    # --- gum veins and knots (vector drawn, periodic)
    vein = WrapCanvas((S, S), margin=400)
    knot = WrapCanvas((S, S), margin=200)
    for b, inf in enumerate(info):
        x0 = inf["col"] * cw
        nv = r.poisson(0.5)
        for _ in range(nv):
            L = r.uniform(40, 260) / pxmm
            y0 = inf["start"] + r.uniform(10 / pxmm, max(inf["length"] - L - 10 / pxmm, 11 / pxmm))
            xx = x0 + r.uniform(12, 118) / pxmm
            pts = []
            for k in range(24):
                t = k / 23
                pts.append((xx + 1.5 * np.sin(t * 6 + r.random() * 6), y0 + t * L))
            vein.line(pts, fill=int(r.uniform(150, 255)), width=int(r.integers(1, 3)))
        if r.random() < 0.07:
            ky = inf["start"] + r.uniform(0.1, 0.9) * inf["length"]
            kx = x0 + r.uniform(25, 105) / pxmm
            knot.ellipse(kx, ky, r.uniform(3, 6) / pxmm, r.uniform(6, 12) / pxmm, fill=255)
    vm = blur(vein.fold(), 0.7)
    km = blur(knot.fold(), 1.5)
    inboard = (lx > 2) & (lx < cw - 2)
    vm *= inboard
    km *= inboard
    alb = lerp(alb, col([0.17, 0.06, 0.035]), vm * 0.8)
    alb = lerp(alb, col([0.13, 0.06, 0.03]), km * 0.9)
    alb = lerp(alb, alb * 0.75, smoothstep(0, 0.4, blur(km, 6)) * 0.6)

    # --- nail holes: rows across each board end + face nails at joist lines (520 mm)
    nails = WrapCanvas((S, S), margin=64)
    nail_r = 1.3 / pxmm
    for b, inf in enumerate(info):
        x0 = inf["col"] * cw
        L = inf["length"]
        ends = [] if L >= S else [inf["start"] + 16 / pxmm, inf["start"] + L - 16 / pxmm]
        for ey in ends:
            for nx in (r.uniform(22, 30), r.uniform(100, 108)):
                nails.ellipse(x0 + nx / pxmm, ey + r.normal(0, 1.5), nail_r, nail_r, 255)
        for jy in np.arange(4) * (S / 4) + 37:
            dy = np.mod(jy - inf["start"], S)
            if dy < 40 / pxmm or dy > L - 40 / pxmm:
                continue
            if r.random() < 0.8:
                for nx in (r.uniform(18, 26), r.uniform(104, 112)):
                    nails.ellipse(x0 + nx / pxmm, jy + r.normal(0, 2), 1.0 / pxmm, 1.0 / pxmm, 200)
    nm = blur(nails.fold(), 0.5)
    alb = lerp(alb, col([0.12, 0.07, 0.045]), nm * 0.85)

    # --- wear / traffic
    traffic = fft_noise((S, S), seed + 50, lo=1, hi=5, beta=2.5)
    wearn = fft_noise((S, S), seed + 51, lo=4, hi=40, beta=1.8, stretch=(1, 2.0))
    wearf = fft_noise((S, S), seed + 52, lo=40, hi=300, beta=1.0)
    wear = np.clip(0.3 + 0.15 * traffic + 0.18 * wearn + 0.06 * wearf, 0, 1)
    scr = WrapCanvas((S, S), margin=128)
    for _ in range(5000):
        y, x = r.uniform(0, S, 2)
        if r.random() > 0.25 + 0.75 * wear[int(y), int(x)]:
            continue
        a = r.normal(0, 0.6) + (np.pi / 2 if r.random() < 0.5 else 0)
        L = r.uniform(4, 40) / pxmm
        scr.line([(x, y), (x + L * np.cos(a), y + L * np.sin(a))], fill=int(r.uniform(60, 255)), width=1)
    sm = scr.fold()
    heel = WrapCanvas((S, S), margin=128)
    for _ in range(26):
        y, x = r.uniform(0, S, 2)
        a0 = r.uniform(0, 2 * np.pi)
        rad = r.uniform(20, 70) / pxmm
        pts = [(x + rad * np.cos(a0 + t), y + rad * np.sin(a0 + t)) for t in np.linspace(0, r.uniform(0.3, 0.9), 12)]
        heel.line(pts, fill=int(r.uniform(80, 200)), width=int(r.integers(2, 5)))
    hm = blur(heel.fold(), 1.0)

    worn_col = desat(alb, 0.35) * 1.10 + 0.02
    alb = lerp(alb, worn_col, wear * 0.55)
    alb = lerp(alb, alb * 1.25 + 0.03, sm * 0.35)
    alb = lerp(alb, col([0.08, 0.06, 0.05]), hm * 0.35)

    # --- edges / gaps
    gap_w = 1.5 / pxmm / 2           # half gap width (px) at the long edges
    jgap = 0.8 / pxmm / 2
    dx_edge = np.minimum(lx, cw - lx)                  # px to long edge
    dy_edge = np.minimum(ly, blen - ly)                # px to butt joint
    dy_edge = np.where(blen >= S - 1, 1e6, dy_edge)
    gapm = np.maximum(1 - smoothstep(gap_w - 0.5, gap_w + 0.5, dx_edge), 1 - smoothstep(jgap - 0.5, jgap + 0.5, dy_edge))
    edge_d = np.minimum(dx_edge - gap_w, dy_edge - jgap)  # px from board edge (inside)
    dirt = 1 - smoothstep(0, 3.0 / pxmm, edge_d)
    alb = alb * (1 - 0.18 * dirt)[..., None]
    alb = lerp(alb, col([0.05, 0.035, 0.025]), gapm)

    # --- height (metres)
    hoff = per_board(bid, r.normal(0, 0.18, nb)) * 1e-3
    cup = 0.12e-3 * ((lx - cw / 2) / (cw / 2)) ** 2
    arris = -0.7e-3 * (1 - smoothstep(0, 1.6 / pxmm, edge_d)) ** 2
    h = hoff + cup + arris
    h += 0.018e-3 * late * (0.3 + wear) - 0.012e-3 * poremask + 0.004e-3 * fine
    h -= 0.03e-3 * sm + 0.6e-3 * nm
    h += 0.004e-3 * fft_noise((S, S), seed + 60, lo=40, hi=400, beta=2.0)  # varnish undulation
    h = np.where(gapm > 0.5, -3e-3, h) * 1.0
    h = lerp(h, -3e-3, gapm)

    # --- roughness
    rough = per_board(bid, r.uniform(0.33, 0.42, nb))
    rough = rough + 0.05 * poremask + 0.22 * wear + 0.10 * sm + 0.015 * fine
    rough = lerp(rough, 0.85, nm)
    rough = lerp(rough, 0.95, gapm)
    rough = np.clip(rough, 0.25, 1)

    return dict(albedo=np.clip(alb, 0, 1), height=h, rough=rough, size=(size, size), strength=1.0,
                note="Hardwood floorboards (jarrah/spotted gum), 130 mm boards along V, satin varnish worn by traffic. 16 boards per tile.")


# ----------------------------------------------------------------------------
# 2/3. brick (stretcher bond, raked joints)
# ----------------------------------------------------------------------------
def sdf_box(lx, ly, hx, hy, rr):
    qx = np.abs(lx) - (hx - rr)
    qy = np.abs(ly) - (hy - rr)
    return np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - rr


def smax(a, b, k):
    hh = np.clip(0.5 + 0.5 * (a - b) / k, 0, 1)
    return b + (a - b) * hh + k * hh * (1 - hh)


def brick_wall(dark, seed):
    W_mm, H_mm = 1200.0, 1204.0
    pxx, pxy = W_mm / S, H_mm / S
    R, C = grid()
    X = (C + 0.5) * pxx
    Y = (R + 0.5) * pxy
    ch, pw, mort = H_mm / 14, 240.0, 10.0
    r = rng(seed)
    k = np.floor(Y / ch).astype(int)
    off = (k % 2) * (pw / 2)
    xs = X - off
    j = np.mod(np.floor(xs / pw).astype(int), 5)
    bid = k * 5 + j
    nb = 70
    jx = r.normal(0, 0.8, nb)
    jy = r.normal(0, 0.6, nb)
    lx = np.mod(xs, pw) - pw / 2 + jx[bid]
    ly = np.mod(Y, ch) - ch / 2 + jy[bid]
    hx, hy = (pw - mort) / 2, (ch - mort) / 2

    n_edge = fft_noise((S, S), seed + 1, lo=20, hi=300, beta=1.5)
    n_chip = fft_noise((S, S), seed + 2, lo=40, hi=250, beta=1.2)
    d = sdf_box(lx, ly, hx, hy, 1.8) + 0.45 * n_edge
    near = 1 - smoothstep(0, 9, -d)
    corner = smoothstep(hx - 25, hx - 2, np.abs(lx)) * smoothstep(hy - 20, hy - 2, np.abs(ly))
    chip = smoothstep(0.9 - 0.9 * corner, 2.3, n_chip) * near * (5.0 + 4 * corner)
    d = d + chip

    # --- height (mm)
    face = per_board(bid, r.normal(0, 0.7, nb))
    tilt_x = per_board(bid, r.normal(0, 0.006, nb)) * lx
    tilt_y = per_board(bid, r.normal(0, 0.01, nb)) * ly
    sand = fft_noise((S, S), seed + 3, lo=200, hi=1000, beta=0.8)
    undul = fft_noise((S, S), seed + 4, lo=10, hi=120, beta=2.0)
    # pits
    npits = 9000
    pts = r.uniform(0, 1, (npits, 2)) * [S, S]
    dd, ii = worley((S, S), pts, k=1)
    prad = (r.gamma(1.6, 0.45, npits) + 0.25) / pxx  # px
    pr = prad[ii[..., 0]]
    pit = np.sqrt(np.clip(1 - (dd[..., 0] / pr) ** 2, 0, 1)) * (pr * pxx) * 0.6
    keep = r.random(npits) < 0.55
    pit *= keep[ii[..., 0]]
    hb = face + tilt_x + tilt_y + 0.10 * sand + 0.25 * undul - pit
    hb = hb - 2.2 * (1 - smoothstep(0, 3.5, -d)) ** 2
    hb = np.where(d > 0, hb - 2.2 - d * 2.5, hb)
    msand = fft_noise((S, S), seed + 5, lo=150, hi=1000, beta=0.6)
    mlump = fft_noise((S, S), seed + 6, lo=30, hi=300, beta=1.5)
    hm = -7.0 + 0.25 * msand + 0.5 * mlump
    h = smax(hb, hm, 0.8)
    is_brick = smoothstep(-0.3, 0.3, hb - hm)

    # --- albedo
    if not dark:
        pal = col([[0.56, 0.25, 0.17], [0.48, 0.19, 0.13], [0.62, 0.32, 0.21], [0.67, 0.42, 0.31],
                   [0.31, 0.15, 0.12], [0.40, 0.21, 0.17], [0.52, 0.30, 0.22]])
        wts = np.array([3.0, 2.2, 1.4, 0.3, 0.5, 0.6, 1.0])
        mort_c = col([0.66, 0.64, 0.60])
    else:
        pal = col([[0.20, 0.12, 0.11], [0.25, 0.15, 0.13], [0.29, 0.18, 0.15], [0.16, 0.10, 0.10],
                   [0.33, 0.22, 0.19], [0.22, 0.13, 0.13]])
        wts = np.array([3.0, 2.5, 1.2, 1.5, 0.6, 0.8])
        mort_c = col([0.36, 0.345, 0.33])
    pick = r.choice(len(pal), nb, p=wts / wts.sum())
    bc = pal[pick] * r.uniform(0.9, 1.1, (nb, 1)).astype(np.float32)
    alb = bc[bid].copy()
    mott = fft_noise((S, S), seed + 7, lo=6, hi=120, beta=1.8)
    mott2 = fft_noise((S, S), seed + 8, lo=60, hi=500, beta=1.0)
    gran = fft_noise((S, S), seed + 15, lo=80, hi=600, beta=0.6)
    alb *= (1 + 0.07 * mott + 0.05 * mott2 + 0.06 * gran)[..., None]
    alb *= (1 - 0.16 * (1 - smoothstep(0, 9, -d)) ** 1.5)[..., None]  # kiln-darkened arrises
    # fire flashing: darker end on some bricks
    fl = r.random(nb) < 0.35
    fdir = r.choice([-1, 1], nb)
    flash = smoothstep(0.1, 1.0, per_board(bid, fdir) * lx / hx + 0.3 * mott) * per_board(bid, fl)
    flash_c = col([0.22, 0.10, 0.09]) if not dark else col([0.10, 0.07, 0.07])
    alb = lerp(alb, flash_c, flash * 0.45)
    # speckles: iron spots + sand grains
    sp = fft_noise((S, S), seed + 9, lo=300, hi=1000, beta=0.0)
    alb = lerp(alb, alb * 0.45, smoothstep(1.9, 2.8, sp))
    sp2 = fft_noise((S, S), seed + 10, lo=300, hi=1000, beta=0.0)
    grain_c = col([0.80, 0.68, 0.55]) if not dark else col([0.55, 0.52, 0.52])
    alb = lerp(alb, grain_c, smoothstep(2.3, 3.1, sp2) * 0.6)
    # pits darker; chipped edge zones slightly fresher/lighter
    alb *= (1 - np.clip(pit / 0.8, 0, 1) * 0.35)[..., None]
    alb = lerp(alb, alb * 1.18 + 0.02, smoothstep(0.5, 2.5, chip) * 0.5)
    # mortar
    mc = mort_c * (1 + 0.10 * msand + 0.06 * mlump)[..., None]
    mspeck = smoothstep(2.0, 3.0, fft_noise((S, S), seed + 11, lo=300, hi=1000, beta=0.0))
    mc = lerp(mc, mc * 0.6, mspeck * 0.7)
    alb = lerp(mc, alb, is_brick)
    # dirt / soot and cavity AO
    dirt = fft_noise((S, S), seed + 12, lo=1, hi=12, beta=2.2)
    if dark:
        soot = smoothstep(-1.2, 2.0, 0.6 * dirt + 0.6 * fft_noise((S, S), seed + 13, lo=3, hi=60, beta=1.6, stretch=(1, 5)))
        alb *= (1 - 0.22 * soot)[..., None]
    else:
        alb *= (1 - 0.08 * smoothstep(-1, 2, dirt))[..., None]
    ao = cavity(h, 6, 0.25)
    alb *= (1 - 0.35 * ao)[..., None]

    # --- roughness
    rough = 0.86 + 0.04 * mott2 - 0.03 * flash
    rough = lerp(0.95 + 0.02 * msand, rough, is_brick)
    if dark:
        sheen = smoothstep(1.6, 2.6, fft_noise((S, S), seed + 14, lo=200, hi=900, beta=0.5)) * is_brick
        rough = rough - 0.25 * sheen - 0.06 * is_brick
        alb = lerp(alb, alb * 1.6 + 0.04, sheen * 0.5)
    rough = np.clip(rough, 0.3, 1.0)
    return np.clip(alb, 0, 1), h * 1e-3, rough, (W_mm / 1000, H_mm / 1000)


@material
def mat_brick():
    a, h, r_, size = brick_wall(False, 201)
    return dict(albedo=a, height=h, rough=r_, size=size,
                note="Federation red face brick, stretcher bond, 230x76 mm bricks, 10 mm raked light-grey mortar. 5 bricks x 14 courses.")


@material
def mat_brick_dark():
    a, h, r_, size = brick_wall(True, 301)
    return dict(albedo=a, height=h, rough=r_, size=size,
                note="Dark manganese/brown-purple brick, stretcher bond, dark sooty mortar. 5 bricks x 14 courses.")


# ----------------------------------------------------------------------------
# 4. carpet (garish pub carpet)
# ----------------------------------------------------------------------------
def paint(L, rows, cols, mask, label):
    sub = L[rows, cols]
    sub[mask] = label
    L[rows, cols] = sub


def paisley_sdf(px, py, length, curl):
    """Teardrop with curled tail; local units (tile fraction). Body at origin, tail toward +y."""
    a = 0.42 * length
    best = np.full(px.shape, 1e9, np.float32)
    Rc = 0.55 * length
    for t in np.linspace(0, 1, 28):
        ang = t * curl
        cx = Rc * (1 - np.cos(ang)) * np.sign(curl)
        cy = Rc * np.sin(abs(ang)) * 1.15 + t * 0.25 * length
        rr = a * (1 - t) ** 1.25 + 0.002
        best = np.minimum(best, np.sqrt((px - cx) ** 2 + (py - cy) ** 2) - rr)
    return best


@material
def mat_carpet():
    seed = 401
    r = rng(seed)
    PAL = col([
        [0.30, 0.045, 0.075],  # 0 maroon ground
        [0.05, 0.07, 0.22],    # 1 navy
        [0.80, 0.58, 0.17],    # 2 gold
        [0.03, 0.40, 0.40],    # 3 teal
        [0.70, 0.10, 0.10],    # 4 red
        [0.84, 0.76, 0.56],    # 5 cream
        [0.05, 0.22, 0.14],    # 6 bottle green
        [0.36, 0.09, 0.32],    # 7 plum
        [0.20, 0.025, 0.05],   # 8 dark maroon
    ])
    L = np.zeros((S, S), np.int8)
    R, C = grid()
    u, v = C / S, R / S

    # tonal lattice in the ground (small diamonds)
    du = np.mod(u * 24, 1) - 0.5
    dv = np.mod(v * 24, 1) - 0.5
    L[(np.abs(du) + np.abs(dv)) < 0.16] = 8
    du2 = np.mod(u * 24 + 0.5, 1) - 0.5
    dv2 = np.mod(v * 24 + 0.5, 1) - 0.5
    L[(np.abs(du2) + np.abs(dv2)) < 0.06] = 2

    # big navy cartouche fields with gold outline
    N2 = fft_noise((S, S), seed + 1, lo=1.5, hi=5, beta=2.5)
    N2 = warp(N2, 40 * fft_noise((S, S), seed + 2, lo=2, hi=8), 40 * fft_noise((S, S), seed + 3, lo=2, hi=8))
    g2y, g2x = np.gradient(N2)
    g2 = np.sqrt(g2x * g2x + g2y * g2y) * S + 1e-6
    L[N2 > 0.85] = 1
    L[np.abs(N2 - 0.85) / g2 < 0.0035] = 2

    # flowing scrollwork: constant-width contour lines of a warped noise field
    N = fft_noise((S, S), seed + 4, lo=2, hi=7, beta=2.5)
    N = warp(N, 60 * fft_noise((S, S), seed + 5, lo=2, hi=6), 60 * fft_noise((S, S), seed + 6, lo=2, hi=6))
    gy, gx = np.gradient(N)
    gm = np.sqrt(gx * gx + gy * gy) * S + 1e-6
    for lev, wdt, lab in [(0.0, 0.0035, 2), (0.6, 0.003, 3), (-0.6, 0.003, 3), (1.2, 0.0025, 2), (-1.2, 0.0025, 4)]:
        dist = np.abs(N - lev) / gm
        if lab == 4:
            L[(dist < wdt) & (N2 < 0.8)] = lab
        else:
            L[dist < wdt] = lab

    # small flowers (poisson-ish scatter)
    centres = [(0.25, 0.25, "A"), (0.75, 0.75, "A"), (0.75, 0.25, "B"), (0.25, 0.75, "B")]

    def far(y, x, mind):
        for cy, cx, _ in centres:
            dy = abs(y - cy); dy = min(dy, 1 - dy)
            dx = abs(x - cx); dx = min(dx, 1 - dx)
            if dy * dy + dx * dx < mind * mind:
                return False
        return True

    pais = []
    tries = 0
    while len(pais) < 12 and tries < 5000:
        tries += 1
        y, x = r.uniform(0, 1, 2)
        if far(y, x, 0.17) and all(min(abs(y - p[0]), 1 - abs(y - p[0])) ** 2 + min(abs(x - p[1]), 1 - abs(x - p[1])) ** 2 > 0.14 ** 2 for p in pais):
            pais.append((y, x))
    flowers = []
    tries = 0
    while len(flowers) < 46 and tries < 20000:
        tries += 1
        y, x = r.uniform(0, 1, 2)
        ok = far(y, x, 0.15) and all(min(abs(y - p[0]), 1 - abs(y - p[0])) ** 2 + min(abs(x - p[1]), 1 - abs(x - p[1])) ** 2 > 0.07 ** 2 for p in pais + flowers)
        if ok:
            flowers.append((y, x))

    for (y, x) in flowers:
        rad = r.uniform(0.016, 0.026)
        rows, cols, dy, dx = local_patch((S, S), y * S, x * S, rad * S * 1.3)
        dy = dy / S; dx = dx / S
        rho = np.sqrt(dx * dx + dy * dy) / rad
        th = np.arctan2(dy, dx) + r.uniform(0, 6.3)
        npet = r.choice([5, 6])
        shape = rho < (0.45 + 0.55 * np.abs(np.cos(npet / 2 * th)) ** 0.8)
        fill = r.choice([2, 3, 5, 7])
        paint(L, rows, cols, rho < (0.5 + 0.6 * np.abs(np.cos(npet / 2 * th)) ** 0.8), 2 if fill != 2 else 4)
        paint(L, rows, cols, shape, fill)
        paint(L, rows, cols, rho < 0.28, 4 if fill != 4 else 2)
        paint(L, rows, cols, rho < 0.12, 2)

    for (y, x) in pais:
        ln = r.uniform(0.07, 0.095)
        ang = r.uniform(0, 2 * np.pi)
        curl = r.choice([-1, 1]) * r.uniform(1.6, 2.4)
        rows, cols, dy, dx = local_patch((S, S), y * S, x * S, ln * S * 1.6)
        dy = dy / S; dx = dx / S
        ca, sa = np.cos(ang), np.sin(ang)
        px = ca * dx + sa * dy
        py = -sa * dx + ca * dy
        py = py + 0.25 * ln  # centre the motif
        sd = paisley_sdf(px, py, ln, curl)
        fill = r.choice([4, 3, 7, 1, 6])
        paint(L, rows, cols, sd < 0.006, 2)
        paint(L, rows, cols, sd < 0.0025, fill)
        # scalloped dots along the outline
        th = np.arctan2(py, px)
        paint(L, rows, cols, (np.abs(sd + 0.007) < 0.0025) & (np.cos(th * 18) > 0.2), 5)
        sd2 = paisley_sdf(px * 1.75, (py - 0.02 * ln) * 1.75, ln, curl) / 1.75
        paint(L, rows, cols, sd2 < -0.006, 2)
        paint(L, rows, cols, sd2 < -0.0095, 5 if fill != 1 else 3)
        sd3 = paisley_sdf(px * 3.2, (py - 0.03 * ln) * 3.2, ln, curl) / 3.2
        paint(L, rows, cols, sd3 < -0.012, 4 if fill != 4 else 1)

    for (y, x, kind) in centres:
        if kind == "A":
            Rm = 0.135
            rows, cols, dy, dx = local_patch((S, S), y * S, x * S, Rm * S * 1.1)
            dy = dy / S; dx = dx / S
            rho = np.sqrt(dx * dx + dy * dy) / Rm
            th = np.arctan2(dy, dx)
            paint(L, rows, cols, rho < 1.0 + 0.06 * np.cos(12 * th), 2)
            paint(L, rows, cols, rho < 0.95 + 0.06 * np.cos(12 * th), 1)
            # ring of teal dots
            ang = np.mod(th, 2 * np.pi / 16) - np.pi / 16
            dd = np.sqrt((rho - 0.82) ** 2 + (ang * 0.82) ** 2)
            paint(L, rows, cols, dd < 0.055, 3)
            paint(L, rows, cols, dd < 0.025, 2)
            paint(L, rows, cols, np.abs(rho - 0.71) < 0.012, 2)
            pet = 0.66 * (0.35 + 0.65 * np.abs(np.cos(4 * th)) ** 0.7)
            paint(L, rows, cols, rho < pet + 0.035, 2)
            paint(L, rows, cols, rho < pet, 4)
            pet2 = 0.45 * (0.4 + 0.6 * np.abs(np.cos(4 * th + np.pi / 4)) ** 0.9)
            paint(L, rows, cols, rho < pet2 + 0.03, 2)
            paint(L, rows, cols, rho < pet2, 5)
            paint(L, rows, cols, rho < 0.17, 2)
            paint(L, rows, cols, rho < 0.11, 3)
            paint(L, rows, cols, rho < 0.05, 2)
        else:
            Rm = 0.09
            rows, cols, dy, dx = local_patch((S, S), y * S, x * S, Rm * S * 1.15)
            dy = dy / S; dx = dx / S
            ax_ = np.abs(dx + dy) / np.sqrt(2) / Rm
            ay_ = np.abs(dx - dy) / np.sqrt(2) / Rm
            star = np.sqrt(ax_) + np.sqrt(ay_)
            rho = np.sqrt(dx * dx + dy * dy) / Rm
            paint(L, rows, cols, star < 1.06, 2)
            paint(L, rows, cols, star < 1.0, 3)
            paint(L, rows, cols, rho < 0.45, 2)
            paint(L, rows, cols, rho < 0.40, 4)
            th = np.arctan2(dy, dx)
            paint(L, rows, cols, rho < 0.28 * (0.5 + 0.5 * np.abs(np.cos(3 * th))), 5)
            paint(L, rows, cols, rho < 0.08, 1)

    # woven fuzz: jitter label lookup by a pixel or two
    jr = 1.3 * fft_noise((S, S), seed + 10, lo=300, hi=1000, beta=0.0)
    jc = 1.3 * fft_noise((S, S), seed + 11, lo=300, hi=1000, beta=0.0)
    Ri = np.mod(np.round(R + jr).astype(int), S)
    Ci = np.mod(np.round(C + jc).astype(int), S)
    L = L[Ri, Ci]
    alb = PAL[L.astype(int)].copy()

    # pile: tufts (periodic Voronoi) + fibre noise
    sp_mm = 3.2
    ntu = int((1500 / sp_mm) ** 2)
    pts = r.uniform(0, 1, (ntu, 2)) * [S, S]
    dd, ii = worley((S, S), pts, k=2)
    tuft = np.clip((dd[..., 1] - dd[..., 0]) / (sp_mm / (1500 / S) * 0.5), 0, 1)
    tuft = np.sqrt(tuft)
    tshade = rng(seed + 20).uniform(-1, 1, ntu).astype(np.float32)[ii[..., 0]]
    fib = fft_noise((S, S), seed + 12, lo=400, hi=1024, beta=0.0)
    fib2 = fft_noise((S, S), seed + 13, lo=60, hi=400, beta=0.5)
    shade = 0.80 + 0.22 * tuft + 0.06 * tshade + 0.05 * fib + 0.04 * fib2
    alb *= shade[..., None]

    # wear, dirt, stains, burns
    traffic = fft_noise((S, S), seed + 14, lo=1, hi=5, beta=2.5)
    wear = smoothstep(-0.2, 1.6, traffic + 0.3 * fft_noise((S, S), seed + 15, lo=6, hi=40))
    alb = lerp(alb, desat(alb, 0.4) * 1.05 + 0.02, wear * 0.45)
    dirt = smoothstep(-0.5, 2.0, fft_noise((S, S), seed + 16, lo=3, hi=30, beta=1.5))
    alb = lerp(alb, alb * 0.7 + col([0.03, 0.025, 0.02]), dirt * 0.4)
    stains = WrapCanvas((S, S), margin=200)
    for _ in range(7):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(25, 90)
        for k in range(5):
            stains.ellipse(x + r.normal(0, rad * 0.4), y + r.normal(0, rad * 0.4), rad * r.uniform(0.4, 0.9), rad * r.uniform(0.4, 0.9), int(r.uniform(90, 200)))
    sm = blur(stains.fold(), 6)
    alb = lerp(alb, alb * 0.62, sm * 0.7)
    burns = WrapCanvas((S, S), margin=32)
    for _ in range(6):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(3, 6)
        burns.ellipse(x, y, rad * r.uniform(0.7, 1.3), rad, 255)
    bm = blur(burns.fold(), 1.2)
    alb = lerp(alb, col([0.05, 0.03, 0.02]), bm * 0.85)

    pile = 0.0006 * tuft + 0.00015 * fib + 0.0002 * fib2
    h = pile * (1 - 0.5 * wear) - 0.0004 * bm
    rough = 0.94 + 0.03 * fib - 0.06 * wear * (1 - tuft) - 0.05 * sm
    rough = np.clip(rough, 0.82, 1.0)
    return dict(albedo=np.clip(alb, 0, 1), height=h, rough=rough, size=(1.5, 1.5), strength=1.0,
                note="Garish 80s/90s pub carpet: maroon ground, navy cartouches, gold/teal scrollwork, paisleys and medallions; cut pile.")


# ----------------------------------------------------------------------------
# 5. pressed metal ceiling
# ----------------------------------------------------------------------------
def bump(t):
    t = np.clip(np.abs(t), 0, 1)
    return (1 - t * t) ** 2


def dome(d, rad):
    return np.sqrt(np.clip(1 - (d / rad) ** 2, 0, 1))


def pressed_panel(n):
    """Height field (mm) of one Wunderlich-style panel, n x n px covering 450 mm."""
    px = 450.0 / n
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5) * px - 225
    y = (yy + 0.5) * px - 225
    ax, ay = np.abs(x), np.abs(y)
    a = np.maximum(ax, ay)
    b = np.where(ax >= ay, y, x)
    rho = np.sqrt(x * x + y * y)
    th = np.arctan2(y, x)
    H = np.zeros((n, n), np.float32)
    # outer bead row
    sp = 410.0 / 31
    bb = np.mod(b + 205, sp) - sp / 2
    H = np.maximum(H, 2.4 * dome(np.sqrt((a - 204) ** 2 + bb ** 2), 4.6))
    # step down into the panel + square frame mouldings
    H = np.maximum(H, 4.2 * bump((a - 184) / 9.5))
    H = np.maximum(H, 1.8 * bump((a - 170.5) / 2.8))
    H = np.maximum(H, 1.2 * bump((a - 196) / 2.2))
    # small rope twist on the main frame crest
    rope = 0.35 * np.cos(2 * np.pi * (b / 6.0) + (a - 184) * 0.6) * bump((a - 184) / 4.0)
    H = H + rope * (a > 178) * (a < 190)
    # corner fans
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 166.0, sy * 166.0
            dx, dy = (x - cx) * -sx, (y - cy) * -sy  # inward-pointing local frame
            rr = np.sqrt(dx * dx + dy * dy)
            ph = np.arctan2(dy, dx)
            inside = (dx > 0) & (dy > 0)
            flutes = 0.5 + 0.5 * np.cos(ph * 2 * 9)
            fan = 2.6 * flutes * (1 - (rr / 58.0) ** 2) * (rr < 58) * inside + 0.8 * (rr < 58) * inside
            fan = np.maximum(fan, 2.2 * bump((rr - 60) / 3.0) * inside)
            fan = np.maximum(fan, 2.8 * dome(rr, 9.0))
            H = np.maximum(H, fan)
    # beaded rings around the medallion
    H = np.maximum(H, 2.2 * bump((rho - 159) / 3.2))
    H = np.maximum(H, 1.6 * bump((rho - 140) / 2.6))
    nbd = 56
    ang = np.mod(th, 2 * np.pi / nbd) - np.pi / nbd
    H = np.maximum(H, 2.6 * dome(np.sqrt((rho - 149.5) ** 2 + (ang * 149.5) ** 2), 3.8))
    # medallion: low dish + 8 big petals + 8 small petals + bead ring + boss
    H = np.maximum(H, 0.9 * (rho < 132) * (1 - (rho / 132) ** 2))
    pet = 122 * (0.42 + 0.58 * np.abs(np.cos(4 * th)) ** 0.65)
    F = rho / pet
    petal = 4.2 * np.sqrt(np.clip(1 - F ** 2, 0, 1)) * (0.55 + 0.45 * (1 - rho / 130))
    vein = np.exp(-((np.abs(np.mod(th + np.pi / 8, np.pi / 4) - np.pi / 8)) * rho / 1.4) ** 2)
    petal -= 0.9 * vein * (F < 0.95) * (rho > 30)
    H = np.maximum(H, petal)
    pet2 = 82 * (0.45 + 0.55 * np.abs(np.cos(4 * th + np.pi / 4)) ** 0.8)
    F2 = rho / pet2
    H = np.maximum(H, 5.0 * np.sqrt(np.clip(1 - F2 ** 2, 0, 1)) * (0.6 + 0.4 * (1 - rho / 85)))
    nbd2 = 20
    ang2 = np.mod(th, 2 * np.pi / nbd2) - np.pi / nbd2
    plate = 5.6 * (1 - smoothstep(35.5, 39.5, rho))
    H = np.maximum(H, plate + 1.6 * dome(np.sqrt((rho - 33) ** 2 + (ang2 * 33) ** 2), 3.4))
    H = np.maximum(H, 6.4 * bump((rho - 25) / 2.2))
    H = np.maximum(H, 5.0 + 4.0 * dome(rho, 21) - 5.0 * (1 - smoothstep(19, 21, rho)) * 0 - 5.0 * (rho > 22))
    # nail heads on the flange
    nsp = 450.0 / 6
    nb_ = np.mod(b + 225 - nsp / 2, nsp) - nsp / 2
    H = np.maximum(H, 0.9 * dome(np.sqrt((a - 219) ** 2 + nb_ ** 2), 2.4))
    return H


@material
def mat_pressed():
    seed = 501
    r = rng(seed)
    n = S // 2
    P = pressed_panel(n)
    h = np.tile(P, (2, 2))
    h = blur(h, 1.3)
    # sheet overlap line at panel edges
    R, C = grid()
    edge = np.minimum(np.minimum(np.mod(R, n), n - np.mod(R, n)), np.minimum(np.mod(C, n), n - np.mod(C, n)))
    seam = 1 - smoothstep(0.5, 2.0, edge)
    h = h - 0.6 * seam
    # paint: brush/orange-peel + slight dents
    h = h + 0.012 * fft_noise((S, S), seed + 1, lo=150, hi=900, beta=1.0)
    h = h + 0.15 * fft_noise((S, S), seed + 2, lo=3, hi=20, beta=2.5)

    cav = cavity(h, 6, 0.6)
    cav2 = cavity(h, 18, 0.25)
    base = col([0.89, 0.85, 0.73])
    yel = col([0.82, 0.74, 0.55])
    nic = smoothstep(-1.5, 2.5, fft_noise((S, S), seed + 3, lo=1, hi=6, beta=2.8))
    alb = lerp(np.broadcast_to(base, (S, S, 3)).copy(), yel, nic * 0.45)
    alb *= (1 + 0.015 * fft_noise((S, S), seed + 4, lo=30, hi=300, beta=1.0))[..., None]
    grime = np.clip(cav * 0.8 + cav2 * 0.5, 0, 1)
    grime_c = col([0.50, 0.43, 0.32])
    alb = lerp(alb, grime_c, grime * (0.45 + 0.3 * nic))
    alb = lerp(alb, col([0.35, 0.30, 0.24]), seam * 0.7)
    # a few paint chips showing grey metal
    chips = WrapCanvas((S, S), margin=40)
    for _ in range(4):
        y, x = r.uniform(0, S, 2)
        for k in range(3):
            chips.ellipse(x + r.normal(0, 2), y + r.normal(0, 2), r.uniform(1.0, 3), r.uniform(1.0, 2.5), 255)
    cm = blur(chips.fold(), 0.8)
    alb = lerp(alb, col([0.55, 0.52, 0.47]), cm * 0.6)
    h = h - 0.08 * cm

    rough = 0.28 + 0.06 * nic + 0.25 * grime + 0.02 * fft_noise((S, S), seed + 5, lo=20, hi=200)
    rough = lerp(rough, 0.55, cm)
    rough = np.clip(rough, 0.2, 0.8)
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=rough, size=(0.9, 0.9), strength=1.0,
                note="Pressed-metal (Wunderlich-style) ceiling, 2x2 450 mm panels, cream gloss enamel with nicotine yellowing and grime in recesses.")


# ----------------------------------------------------------------------------
# 6. wainscot (dark-stained V-groove lining boards)
# ----------------------------------------------------------------------------
@material
def mat_wainscot():
    seed = 601
    size = 1.08
    pxmm = size * 1000 / S
    nbd = 12
    cw = S / nbd
    bid, lx, ly, blen, info = column_boards(nbd, cw, [[] for _ in range(nbd)])
    nb = len(info)
    r = rng(seed)
    xmm = lx * pxmm
    ymm = ly * pxmm
    ring, _ = wood_rings(xmm, ymm, bid, nb, seed + 1, spacing=(2.0, 4.0), width_mm=90.0, periodic_len=size * 1000,
                         tilt=(0.01, 0.03))
    late = smoothstep(0.55, 0.92, ring) * (1 - smoothstep(0.95, 1.0, ring))
    streak = board_noise(fft_noise((S, S), seed + 2, lo=3, hi=120, beta=1.8, stretch=(1, 9)), bid, nb, seed + 3)
    pores = board_noise(fft_noise((S, S), seed + 4, lo=150, hi=900, beta=1.0, stretch=(1, 14)), bid, nb, seed + 5)
    poremask = smoothstep(1.1, 2.3, -pores)
    base = col([0.29, 0.155, 0.08]) * r.uniform(0.85, 1.12, (nb, 1)).astype(np.float32)
    base[:, 0] *= r.uniform(0.95, 1.06, nb)
    alb = base[bid] * (1 - 0.32 * late - 0.25 * poremask + 0.10 * streak)[..., None]
    # V-groove: 3.5 mm chamfers each side
    ch = 3.5 / pxmm
    dxe = np.minimum(lx, cw - lx)  # px to joint
    chamfer = 1 - smoothstep(0, ch, dxe)
    gap = 1 - smoothstep(0.3, 1.0, dxe)
    alb *= (1 - 0.25 * chamfer)[..., None]
    alb = lerp(alb, col([0.03, 0.018, 0.01]), gap)
    # varnish ageing / dust
    dust = fft_noise((S, S), seed + 6, lo=2, hi=20, beta=2.0)
    alb *= (1 + 0.05 * dust)[..., None]
    h = -np.clip(ch - dxe, 0, None) * pxmm * 0.9  # 45-ish degree chamfer
    h += per_board(bid, r.normal(0, 0.15, nb)) + 0.012 * late - 0.01 * poremask
    h += 0.01 * fft_noise((S, S), seed + 7, lo=20, hi=300, beta=2.0)
    h = lerp(h, -4.0, gap)
    rough = 0.30 + 0.04 * dust + 0.05 * poremask + per_board(bid, r.uniform(-0.03, 0.03, nb))
    rough = lerp(rough, 0.55, chamfer * 0.5)
    rough = lerp(rough, 0.9, gap)
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.2, 1), size=(size, size),
                note="Dark-stained varnished tongue-and-groove lining boards, 90 mm wide with V-groove joints, vertical (V). 12 boards per tile.")


# ----------------------------------------------------------------------------
# 16. timber_dark (french-polished mahogany slab)
# ----------------------------------------------------------------------------
@material
def mat_timber_dark():
    seed = 1601
    r = rng(seed)
    R, C = grid()
    u = (C + 0.5) / S
    wv = fft_noise((S, S), seed + 1, lo=1, hi=20, beta=2.8, stretch=(1, 8))
    wv2 = fft_noise((S, S), seed + 2, lo=4, hi=80, beta=2.0, stretch=(1, 6))
    nlines = 230
    phase = nlines * u + 1.6 * wv + 0.2 * wv2
    ring = phase - np.floor(phase)
    late = smoothstep(0.6, 0.93, ring) * (1 - smoothstep(0.95, 1.0, ring))
    ribbon = fft_noise((S, S), seed + 3, lo=6, hi=70, beta=1.6, stretch=(1, 10))
    ribbon = warp(ribbon, np.zeros((S, S), np.float32), 8 * wv)
    pores = fft_noise((S, S), seed + 4, lo=200, hi=1000, beta=0.6, stretch=(1, 16))
    poremask = smoothstep(1.3, 2.5, -pores)
    figure = fft_noise((S, S), seed + 5, lo=2, hi=12, beta=2.0, stretch=(1, 3))
    base = col([0.30, 0.115, 0.06])
    alb = base * (1 - 0.18 * late + 0.12 * ribbon + 0.06 * figure - 0.30 * poremask)[..., None]
    alb[..., 0] *= 1 + 0.04 * ribbon
    # polish: wipe marks and hairline scratches mostly affect roughness
    scr = WrapCanvas((S, S), margin=200)
    for _ in range(900):
        y, x = r.uniform(0, S, 2)
        a = r.uniform(0, np.pi)
        L = r.uniform(10, 120)
        scr.line([(x, y), (x + L * np.cos(a), y + L * np.sin(a))], fill=int(r.uniform(40, 200)), width=1)
    sm = scr.fold()
    wipe = fft_noise((S, S), seed + 6, lo=3, hi=30, beta=1.8, angle=0.6, stretch=(1, 3))
    alb = lerp(alb, alb * 1.15 + 0.01, sm * 0.25)
    h = 0.006 * late - 0.006 * poremask - 0.004 * sm + 0.02 * fft_noise((S, S), seed + 7, lo=3, hi=40, beta=2.5)
    rough = 0.15 + 0.035 * wipe + 0.05 * poremask + 0.12 * sm
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.08, 0.5), size=(1.2, 1.2),
                note="Dark French-polished mahogany-like slab, long grain along V, ribbon figure, fine polish scratches (roughness only).")


# ----------------------------------------------------------------------------
# 11. deck (weathered merbau decking)
# ----------------------------------------------------------------------------
@material
def mat_deck():
    seed = 1101
    size = 2.16
    pxmm = size * 1000 / S
    nbd = 15
    cw = S / nbd
    njo = 5
    js = S / njo
    r = rng(seed)
    joints = []
    prev = None
    first = None
    for c in range(nbd):
        for _ in range(100):
            spans = [[5], [2, 3], [3, 2], [1, 4], [4, 1], [2, 1, 2]][r.integers(0, 6)]
            k0 = r.integers(0, njo)
            J = sorted(set((k0 + int(sum(spans[:i]))) % njo for i in range(len(spans))))
            ok = prev is None or not (set(J) & set(prev))
            if c == nbd - 1 and first is not None:
                ok = ok and not (set(J) & set(first))
            if ok:
                break
        prev = J
        if first is None:
            first = J
        joints.append([j * js + js / 2 for j in J])
    bid, lx, ly, blen, info = column_boards(nbd, cw, joints)
    nb = len(info)
    xmm = lx * pxmm
    ymm = ly * pxmm
    ring, _ = wood_rings(xmm, ymm, bid, nb, seed + 1, spacing=(3.0, 6.0), width_mm=140.0)
    late = smoothstep(0.55, 0.92, ring) * (1 - smoothstep(0.95, 1.0, ring))
    streak = board_noise(fft_noise((S, S), seed + 2, lo=3, hi=120, beta=1.8, stretch=(1, 9)), bid, nb, seed + 3)
    fibre = board_noise(fft_noise((S, S), seed + 4, lo=100, hi=900, beta=0.8, stretch=(1, 18)), bid, nb, seed + 5)
    grey = col([0.47, 0.43, 0.38])
    warm = col([0.50, 0.32, 0.21])
    wb = r.uniform(0.35, 0.9, nb).astype(np.float32)
    wn = fft_noise((S, S), seed + 6, lo=2, hi=30, beta=2.0, stretch=(1, 2))
    weather = np.clip(per_board(bid, wb) + 0.25 * wn, 0, 1)
    alb = lerp(warm, grey, weather) * per_board(bid, r.uniform(0.85, 1.1, nb))[..., None]
    alb *= (1 - 0.22 * late * (0.5 + weather) + 0.08 * streak + 0.07 * fibre)[..., None]
    # checks (short splits along the grain)
    chk = WrapCanvas((S, S), margin=300)
    for inf in info:
        for _ in range(r.poisson(1.5)):
            x = inf["col"] * cw + r.uniform(15, 125) / pxmm
            L = r.uniform(40, 220) / pxmm
            y = inf["start"] + r.uniform(0, max(inf["length"] - L, 1))
            pts = [(x + 0.8 * np.sin(t * 5), y + t * L) for t in np.linspace(0, 1, 10)]
            chk.line(pts, fill=255, width=1)
    cm = chk.fold() * ((lx > 4) & (lx < cw - 4))
    # screws: pairs at every joist line on every board
    scw = WrapCanvas((S, S), margin=64)
    halo = WrapCanvas((S, S), margin=64)
    for inf in info:
        x0 = inf["col"] * cw
        for j in range(njo):
            y = j * js + js / 2
            dy = np.mod(y - inf["start"], S)
            if inf["length"] < S and (dy < 1 or dy > inf["length"] - 1):
                ofs = [-22 / pxmm, 22 / pxmm]  # board end: screws either side of the butt joint
            else:
                ofs = [0.0]
            for o in ofs:
                for sx in (24, 115):
                    cx, cy = x0 + sx / pxmm + r.normal(0, 1), y + o + r.normal(0, 1)
                    scw.ellipse(cx, cy, 2.3 / pxmm, 2.3 / pxmm, 255)
                    halo.ellipse(cx, cy + r.normal(0, 2), 5 / pxmm, 7 / pxmm, int(r.uniform(120, 255)))
    sm = blur(scw.fold(), 0.6)
    hm = blur(halo.fold(), 4)
    alb = lerp(alb, alb * 0.55, hm * 0.6)
    alb = lerp(alb, col([0.10, 0.09, 0.085]), sm)
    alb = lerp(alb, col([0.06, 0.045, 0.035]), cm * 0.9)
    # gaps / arris
    gw = 5.0 / pxmm / 2
    jg = 1.5 / pxmm / 2
    dxe = np.minimum(lx, cw - lx)
    dye = np.where(blen >= S - 1, 1e6, np.minimum(ly, blen - ly))
    gapm = np.maximum(1 - smoothstep(gw - 0.5, gw + 0.5, dxe), 1 - smoothstep(jg - 0.5, jg + 0.5, dye))
    ed = np.minimum(dxe - gw, dye - jg)
    alb *= (1 - 0.2 * (1 - smoothstep(0, 4 / pxmm, ed)))[..., None]
    alb = lerp(alb, col([0.03, 0.025, 0.02]), gapm)
    h = per_board(bid, r.normal(0, 0.4, nb)) + 0.3 * ((lx - cw / 2) / (cw / 2)) ** 2
    h -= 2.5 * (1 - smoothstep(0, 3 / pxmm, ed)) ** 2
    h += 0.12 * late * weather + 0.05 * fibre - 0.6 * cm - 1.0 * sm
    h = lerp(h, -20.0, gapm)
    rough = 0.82 + 0.06 * weather + 0.03 * fibre - 0.05 * hm
    rough = lerp(rough, 0.95, gapm)
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.6, 1), size=(size, size),
                note="Weathered merbau decking, 15 boards (139 mm + 5 mm gap) along V, screw pairs at 5 joist lines (432 mm).")


# ----------------------------------------------------------------------------
# 7/8. glazed wall tiles
# ----------------------------------------------------------------------------
def glazed_tiles(seed, green):
    size_mm = 912.0
    px = size_mm / S
    R, C = grid()
    X = (C + 0.5) * px
    Y = (R + 0.5) * px
    pitch = 152.0
    r = rng(seed)
    ti = np.floor(X / pitch).astype(int) % 6
    tj = np.floor(Y / pitch).astype(int) % 6
    tid = tj * 6 + ti
    nt = 36
    lx = np.mod(X, pitch) - pitch / 2 + per_board(tid, r.normal(0, 0.25, nt))
    ly = np.mod(Y, pitch) - pitch / 2 + per_board(tid, r.normal(0, 0.25, nt))
    d = sdf_box(lx, ly, 74.5, 74.5, 1.6) + 0.08 * fft_noise((S, S), seed + 1, lo=40, hi=400)
    inner = -d
    pillow = 1.6 - 1.6 * (1 - smoothstep(0, 6.0, inner)) ** 2
    tilt = per_board(tid, r.normal(0, 0.0025, nt)) * lx + per_board(tid, r.normal(0, 0.0025, nt)) * ly
    bow = per_board(tid, r.uniform(0.0, 0.15, nt)) * (1 - (lx ** 2 + ly ** 2) / (2 * 75 ** 2))
    peel = fft_noise((S, S), seed + 2, lo=60, hi=500, beta=1.6)
    ht = pillow + tilt + bow + 0.01 * peel
    ht = np.where(d > 0, -0.3 - d * 1.5, ht)
    gsand = fft_noise((S, S), seed + 3, lo=300, hi=1000, beta=0.5)
    hg = -0.6 + 0.04 * gsand
    h = smax(ht, hg, 0.15)
    is_t = smoothstep(-0.05, 0.05, ht - hg)

    thick = fft_noise((S, S), seed + 4, lo=4, hi=40, beta=2.2)
    edge = 1 - smoothstep(0, 2.2, inner)
    pool = smoothstep(1.5, 3.5, inner) * (1 - smoothstep(4, 9, inner))
    if green:
        base = col([0.065, 0.24, 0.145])
        tv = r.uniform(0.88, 1.12, (nt, 1)).astype(np.float32)
        hue = r.normal(0, 0.008, (nt, 3)).astype(np.float32)
        tc = np.clip(base * tv + hue, 0, 1)
        alb = tc[tid] * (1 + 0.06 * thick)[..., None]
        alb = lerp(alb, col([0.22, 0.42, 0.30]), edge * 0.55)
        alb *= (1 - 0.12 * pool)[..., None]
        grout_c = col([0.76, 0.72, 0.62])
    else:
        base = col([0.86, 0.81, 0.67])
        tv = r.uniform(0.95, 1.04, (nt, 1)).astype(np.float32)
        hue = r.normal(0, 0.004, (nt, 3)).astype(np.float32)
        tc = np.clip(base * tv + hue, 0, 1)
        alb = tc[tid] * (1 + 0.012 * thick)[..., None]
        alb = lerp(alb, col([0.92, 0.88, 0.76]), edge * 0.4)
        alb *= (1 - 0.04 * pool)[..., None]
        grout_c = col([0.64, 0.61, 0.55])
    # pinholes / specks in the glaze
    spk = smoothstep(3.0, 3.8, fft_noise((S, S), seed + 5, lo=300, hi=1000, beta=0.0))
    alb = lerp(alb, alb * 0.6, spk * 0.6)
    craze = np.zeros((S, S), np.float32)
    if not green:
        npts = int((912 / 9.0) ** 2)
        dd, _ = worley((S, S), r.uniform(0, 1, (npts, 2)) * [S, S], k=2)
        craze = 1 - smoothstep(0.0, 1.2, dd[..., 1] - dd[..., 0])
        craze *= smoothstep(-0.6, 0.8, fft_noise((S, S), seed + 6, lo=3, hi=30))
        alb *= (1 - 0.10 * craze)[..., None]
    gdirt = fft_noise((S, S), seed + 7, lo=4, hi=60, beta=1.5)
    gc = grout_c * (1 + 0.06 * gsand + 0.06 * gdirt)[..., None]
    alb = lerp(gc, alb, is_t)
    alb *= (1 - 0.25 * cavity(h, 3, 1.0))[..., None]
    rough = 0.09 + 0.02 * thick * 0.5 + 0.06 * craze + 0.1 * spk
    rough = lerp(0.85 + 0.04 * gsand, rough, is_t)
    return np.clip(alb, 0, 1), h * 1e-3, np.clip(rough, 0.05, 1), (size_mm / 1000, size_mm / 1000)


@material
def mat_tile_green():
    a, h, r_, size = glazed_tiles(701, True)
    return dict(albedo=a, height=h, rough=r_, size=size,
                note="Federation bottle-green glazed wall tiles, 152 mm pitch, 3 mm cream grout, pillowed edges, glossy. 6x6 tiles.")


@material
def mat_tile_cream():
    a, h, r_, size = glazed_tiles(801, False)
    return dict(albedo=a, height=h, rough=r_, size=size,
                note="Cream/ivory glazed wall tiles with faint crazing, 152 mm pitch, 3 mm grout, pillowed edges, glossy. 6x6 tiles.")


# ----------------------------------------------------------------------------
# 9. concrete footpath
# ----------------------------------------------------------------------------
@material
def mat_concrete():
    seed = 901
    size = 3.0
    pxmm = size * 1000 / S
    r = rng(seed)
    R, C = grid()
    m1 = fft_noise((S, S), seed + 1, lo=1, hi=20, beta=2.2)
    m2 = fft_noise((S, S), seed + 2, lo=20, hi=250, beta=1.4)
    m3 = fft_noise((S, S), seed + 3, lo=250, hi=1024, beta=0.3)
    # broom finish: striations along U, slightly wavy
    broom = fft_noise((S, S), seed + 4, lo=120, hi=800, beta=1.0, stretch=(12, 1))
    broom = warp(broom, 6 * fft_noise((S, S), seed + 5, lo=1, hi=6), np.zeros((S, S), np.float32))
    # tooled expansion joint across the middle with smooth margins
    dj = np.abs(R + 0.5 - S / 2) * pxmm  # mm from joint centre line
    groove = 1 - smoothstep(2.5, 5.0, dj)
    margin = 1 - smoothstep(35, 45, dj)
    broom_amp = 1 - 0.85 * margin
    # aggregate
    npts = 30000
    pts = r.uniform(0, 1, (npts, 2)) * [S, S]
    dd, ii = worley((S, S), pts, k=1)
    arad = (r.uniform(0.6, 2.4, npts) / pxmm)[ii[..., 0]]
    agg = np.clip(1 - dd[..., 0] / arad, 0, 1)
    agg = agg * (r.random(npts) < 0.5)[ii[..., 0]]
    atone = r.uniform(-1, 1, npts).astype(np.float32)[ii[..., 0]]
    base = col([0.60, 0.585, 0.55])
    alb = base * (1 + 0.035 * m1 + 0.03 * m2 + 0.03 * m3 + 0.03 * broom * broom_amp)[..., None]
    alb = lerp(alb, alb * (1 + 0.35 * atone)[..., None], smoothstep(0, 0.3, agg) * 0.5)
    alb *= (1 - 0.05 * margin)[..., None]
    # stains: oil (dark), drink (brownish rings)
    st = WrapCanvas((S, S), margin=300)
    for _ in range(10):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(40, 220) / pxmm
        for k in range(6):
            st.ellipse(x + r.normal(0, rad * 0.5), y + r.normal(0, rad * 0.5), rad * r.uniform(0.3, 0.8), rad * r.uniform(0.3, 0.8), int(r.uniform(80, 220)))
    oil = blur(st.fold(), 22) * (0.6 + 0.4 * smoothstep(-1, 1, fft_noise((S, S), seed + 6, lo=6, hi=60)))
    dr = WrapCanvas((S, S), margin=200)
    for _ in range(8):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(30, 90) / pxmm
        dr.ellipse(x, y, rad, rad * r.uniform(0.7, 1.0), 255)
        dr.ellipse(x + r.normal(0, 4), y + r.normal(0, 4), rad * 0.85, rad * 0.8, 0)
    drink = blur(dr.fold(), 2.5)
    alb = lerp(alb, alb * 0.6, oil * 0.5)
    alb = lerp(alb, alb * col([0.82, 0.72, 0.58]), drink * 0.5)
    # chewing gum
    gm = WrapCanvas((S, S), margin=32)
    gtone = WrapCanvas((S, S), margin=32)
    for _ in range(45):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(5, 13) / pxmm
        t = int(r.uniform(0, 255))
        for k in range(3):
            ox, oy = r.normal(0, rad * 0.25, 2)
            rx, ry = rad * r.uniform(0.6, 1.0), rad * r.uniform(0.6, 1.0)
            gm.ellipse(x + ox, y + oy, rx, ry, 255)
            gtone.ellipse(x + ox, y + oy, rx, ry, max(t, 1))
    gum = blur(gm.fold(), 0.7)
    gt = gtone.fold()
    gum_c = lerp(col([0.16, 0.155, 0.15]), col([0.50, 0.49, 0.47]), gt)
    alb = lerp(alb, gum_c * (1 + 0.1 * m3)[..., None], gum * 0.9)
    alb = lerp(alb, alb * 0.55, groove)
    h = 0.25 * broom * broom_amp + 0.15 * agg + 0.6 * m1 * 0.3 + 0.05 * m3
    h += 0.5 * gum - 6.0 * groove + 0.6 * (1 - smoothstep(4.0, 9.0, dj)) * (1 - groove)
    rough = 0.88 + 0.03 * m3 + 0.02 * broom - 0.12 * oil - 0.12 * margin - 0.08 * gum
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.6, 1), size=(size, size),
                note="Weathered footpath concrete: broom finish along U, tooled expansion joint across the middle (V=0.5), gum spots, oil/drink stains.")


# ----------------------------------------------------------------------------
# 10. asphalt
# ----------------------------------------------------------------------------
@material
def mat_asphalt():
    seed = 1001
    size = 2.0
    pxmm = size * 1000 / S
    r = rng(seed)
    R, C = grid()
    npts = int((2000 / 8.0) ** 2)
    pts = r.uniform(0, 1, (npts, 2)) * [S, S]
    dd, ii = worley((S, S), pts, k=2)
    cell = ii[..., 0]
    e = (dd[..., 1] - dd[..., 0])
    exposed = (r.random(npts) < 0.62)[cell]
    srad = r.uniform(1.2, 3.0, npts).astype(np.float32)[cell]
    stone = smoothstep(0.6, 0.6 + srad, e) * exposed
    stone_h = np.sqrt(np.clip(e / (srad * 2.5), 0, 1)) * exposed
    tone = r.uniform(0.30, 0.52, npts).astype(np.float32)
    tint = col([[1.0, 1.0, 1.0], [1.05, 1.0, 0.92], [0.95, 0.98, 1.05], [1.08, 0.98, 0.9]])[r.integers(0, 4, npts)]
    sc = (tone[:, None] * tint)[cell]
    sn = fft_noise((S, S), seed + 1, lo=300, hi=1024, beta=0.3)
    sc *= (1 + 0.08 * sn)[..., None]
    m1 = fft_noise((S, S), seed + 2, lo=1, hi=12, beta=2.2)
    binder = col([0.215, 0.215, 0.22]) * (1 + 0.12 * m1 + 0.12 * fft_noise((S, S), seed + 3, lo=200, hi=1024, beta=0.3))[..., None]
    alb = lerp(binder, sc, stone)
    # patch (fresher, darker asphalt with sealed edge)
    pc = WrapCanvas((S, S), margin=400)
    cy, cx = r.uniform(0, S, 2)
    w, hh = 520 / pxmm, 360 / pxmm
    a = r.uniform(-0.1, 0.1)
    corners = [(-w / 2, -hh / 2), (w / 2, -hh / 2), (w / 2, hh / 2), (-w / 2, hh / 2)]
    poly = [(cx + x * np.cos(a) - y * np.sin(a), cy + x * np.sin(a) + y * np.cos(a)) for x, y in corners]
    pc.polygon(poly, 255)
    patch = blur(pc.fold(), 1.0)
    pe = WrapCanvas((S, S), margin=400)
    pe.line(poly + [poly[0]], fill=255, width=int(14 / pxmm))
    seal = blur(pe.fold(), 2.0)
    alb = lerp(alb, lerp(col([0.15, 0.15, 0.155]), sc * 0.8, stone * 0.6), patch * 0.85)
    alb = lerp(alb, col([0.09, 0.09, 0.095]), seal * 0.6)
    # cracks: edges of a coarse warped Voronoi, partially masked
    cp = r.uniform(0, 1, (14, 2)) * [S, S]
    wr = 22 * fft_noise((S, S), seed + 4, lo=3, hi=20, beta=2.0) + 2.5 * fft_noise((S, S), seed + 8, lo=60, hi=300, beta=1.0)
    wc = 22 * fft_noise((S, S), seed + 5, lo=3, hi=20, beta=2.0) + 2.5 * fft_noise((S, S), seed + 9, lo=60, hi=300, beta=1.0)
    cd, _ = worley((S, S), cp, k=2)
    ce = warp(cd[..., 1] - cd[..., 0], wr, wc)
    crack = (1 - smoothstep(0.8, 3.0, ce)) * smoothstep(0.2, 0.8, fft_noise((S, S), seed + 6, lo=2, hi=10, beta=2.0))
    crack = np.maximum(crack, (1 - smoothstep(0.3, 1.5, ce)) * 0)
    crack *= (1 - patch)
    alb = lerp(alb, col([0.05, 0.05, 0.05]), crack)
    alb = lerp(alb, alb * 0.8, blur(crack, 4) * 0.6)
    # tyre polish / oil darkening bands
    oil = smoothstep(0.0, 2.0, fft_noise((S, S), seed + 7, lo=1, hi=6, beta=2.0, stretch=(1, 4)))
    alb *= (1 - 0.15 * oil)[..., None]
    h = 1.6 * stone_h + 0.12 * sn - 3.0 * crack + 0.2 * m1 + 0.8 * seal - 0.3 * patch * (1 - stone)
    rough = 0.92 - 0.12 * stone * (1 - patch) + 0.03 * sn - 0.3 * seal - 0.08 * oil
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.5, 1), size=(size, size),
                note="Worn road asphalt with exposed angular aggregate, a few cracks and a sealed patch.")


# ----------------------------------------------------------------------------
# 12. felt (pool-table baize)
# ----------------------------------------------------------------------------
@material
def mat_felt():
    seed = 1201
    r = rng(seed)
    f1 = fft_noise((S, S), seed + 1, lo=300, hi=1024, beta=0.0, stretch=(1, 2.5))
    f2 = fft_noise((S, S), seed + 2, lo=80, hi=500, beta=0.8, stretch=(1, 1.8))
    f3 = fft_noise((S, S), seed + 3, lo=2, hi=30, beta=2.0)
    nap = fft_noise((S, S), seed + 4, lo=1, hi=6, beta=2.5, stretch=(1, 3))
    base = col([0.055, 0.33, 0.15])
    alb = base * (1 + 0.07 * f1 + 0.05 * f2 + 0.035 * f3 + 0.03 * nap)[..., None]
    ch = WrapCanvas((S, S), margin=200)
    for _ in range(9):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(8, 26)
        for k in range(4):
            ch.ellipse(x + r.normal(0, rad * 0.6), y + r.normal(0, rad * 0.6), rad * r.uniform(0.3, 1.0), rad * r.uniform(0.2, 0.6), int(r.uniform(60, 200)))
    for _ in range(3):  # faint skid streaks
        y, x = r.uniform(0, S, 2)
        a = r.uniform(0, np.pi)
        L = r.uniform(60, 200)
        ch.line([(x, y), (x + L * np.cos(a), y + L * np.sin(a))], fill=int(r.uniform(40, 100)), width=int(r.integers(3, 8)))
    chalk = blur(ch.fold(), 5) * (0.6 + 0.4 * np.clip(f2 * 0.5 + 0.5, 0, 1))
    alb = lerp(alb, col([0.30, 0.52, 0.62]), chalk * 0.35)
    h = 0.03 * f1 + 0.02 * f2
    rough = 0.95 + 0.03 * f1 - 0.04 * nap * 0.5
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.85, 1), size=(0.5, 0.5),
                note="Pool-table green baize, fine fibre, subtle nap along V, faint blue chalk marks.")


# ----------------------------------------------------------------------------
# 15. plaster
# ----------------------------------------------------------------------------
@material
def mat_plaster():
    seed = 1501
    size = 2.0
    pxmm = size * 1000 / S
    r = rng(seed)
    st = fft_noise((S, S), seed + 1, lo=250, hi=900, beta=1.0)
    stip = smoothstep(-0.3, 1.6, st)
    st2 = fft_noise((S, S), seed + 2, lo=80, hi=300, beta=1.5)
    trow = fft_noise((S, S), seed + 3, lo=1, hi=12, beta=2.5)
    trow2 = fft_noise((S, S), seed + 4, lo=6, hi=40, beta=2.0, angle=0.5, stretch=(1, 3))
    cp = r.uniform(0, 1, (10, 2)) * [S, S]
    cd, _ = worley((S, S), cp, k=2)
    ce = warp(cd[..., 1] - cd[..., 0], 40 * fft_noise((S, S), seed + 5, lo=3, hi=40), 40 * fft_noise((S, S), seed + 6, lo=3, hi=40))
    ce = warp(ce, 4 * fft_noise((S, S), seed + 7, lo=40, hi=200), 4 * fft_noise((S, S), seed + 8, lo=40, hi=200))
    crack = (1 - smoothstep(0.4, 1.6, ce)) * smoothstep(0.3, 1.0, fft_noise((S, S), seed + 9, lo=2, hi=10, beta=2.2))
    alb = col([0.90, 0.895, 0.88]) * (1 + 0.012 * trow + 0.01 * st2 + 0.012 * stip - 0.006)[..., None]
    alb = lerp(alb, alb * 0.82, crack * 0.8)
    alb *= (1 - 0.05 * cavity(0.12 * stip, 2, 6))[..., None]
    h = 0.12 * stip + 0.05 * st2 + 0.8 * trow + 0.25 * trow2 - 0.15 * crack
    rough = 0.88 - 0.05 * stip + 0.02 * st2
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.7, 1), size=(size, size),
                note="Painted plaster, near-white for runtime tinting: roller stipple, trowel undulation, a few hairline cracks.")


# ----------------------------------------------------------------------------
# 14. vinyl upholstery
# ----------------------------------------------------------------------------
@material
def mat_vinyl():
    seed = 1401
    size = 0.3
    pxmm = size * 1000 / S
    r = rng(seed)
    cell_mm = 1.1
    npts = int((300 / cell_mm) ** 2)
    pts = r.uniform(0, 1, (npts, 2)) * [S, S]
    dd, ii = worley((S, S), pts, k=2)
    e = dd[..., 1] - dd[..., 0]
    cpx = cell_mm / pxmm
    ch = r.uniform(0.6, 1.0, npts).astype(np.float32)[ii[..., 0]]
    pebble = np.sqrt(np.clip(e / (cpx * 0.45), 0, 1)) * ch
    big = fft_noise((S, S), seed + 1, lo=40, hi=200, beta=1.5)
    crease = fft_noise((S, S), seed + 2, lo=3, hi=30, beta=2.0, stretch=(1, 2))
    cl = 1 - smoothstep(0.0, 0.06, np.abs(crease))
    groove = 1 - smoothstep(0.0, 0.5, pebble)
    base = col([0.50, 0.055, 0.055])
    alb = base * (1 + 0.10 * (pebble - 0.6) + 0.04 * big)[..., None]
    alb = lerp(alb, alb * 0.5, groove * 0.7)
    wear = smoothstep(0.5, 2.5, fft_noise((S, S), seed + 3, lo=1, hi=5, beta=2.8))
    alb = lerp(alb, alb * 1.15 + col([0.02, 0.015, 0.015]), wear * 0.3)
    alb *= (1 - 0.15 * cl)[..., None]
    h = 0.08 * pebble + 0.02 * big - 0.06 * cl
    rough = 0.34 - 0.06 * pebble + 0.18 * groove + 0.06 * wear * pebble
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.2, 0.7), size=(size, size),
                note="Red upholstery vinyl with pebbled leather-like grain, slightly glossy, faint creases.")


# ----------------------------------------------------------------------------
# 13. wallpaper (low-contrast damask)
# ----------------------------------------------------------------------------
def ell(x, y, cx, cy, a, b, ang, notch=0.0, nn=5):
    ca, sa = np.cos(ang), np.sin(ang)
    u = (x - cx) * ca + (y - cy) * sa
    v = -(x - cx) * sa + (y - cy) * ca
    q = (u / a) ** 2 + (v / b) ** 2
    lim = 1 + notch * np.sin(np.clip(u / a, -1, 1) * np.pi * nn) ** 2 * -1
    return q < lim, u, v


def spiral(x, y, cx, cy, a0, b, th_max, w, flip=1.0):
    dx, dy = (x - cx) * flip, y - cy
    rho = np.sqrt(dx * dx + dy * dy)
    phi = np.mod(np.arctan2(dy, dx), 2 * np.pi)
    m = np.zeros(x.shape, bool)
    for k in range(3):
        th = phi + 2 * np.pi * k
        rs = a0 - b * th
        m |= (np.abs(rho - rs) < w * np.sqrt(np.maximum(rs, 0) / a0) + 0.002) & (th < th_max) & (rs > 0)
    return m


def damask_motif(x, y):
    """x,y in cell units (-0.5..0.5), y up. Mirror-symmetric ornament mask."""
    ax = np.abs(x)
    m = np.zeros(x.shape, bool)
    yy = (y - 0.0) / 0.30
    spindle = (np.abs(yy) < 1) & (ax < 0.05 * np.clip(1 - yy ** 2, 0, 1) ** 0.7)
    m |= spindle
    m &= ~((ax < 0.006) & (np.abs(yy) < 0.75))
    lf, u, v = ell(ax, y, 0.15, 0.10, 0.17, 0.055, 0.65, notch=0.25, nn=4)
    vein = (np.abs(v) < 0.005) & (np.abs(u) < 0.13)
    m |= lf & ~vein
    lf2, u2, v2 = ell(ax, y, 0.13, -0.17, 0.13, 0.045, -0.55, notch=0.25, nn=3)
    m |= lf2 & ~((np.abs(v2) < 0.004) & (np.abs(u2) < 0.1))
    m |= spiral(ax, y, 0.30, 0.28, 0.075, 0.009, 5.5, 0.010)
    m |= spiral(ax, y, 0.27, -0.33, 0.06, 0.007, 5.0, 0.009)
    # crown fan
    for cx, cy, a, b, ang in [(0.0, 0.40, 0.07, 0.022, np.pi / 2), (0.045, 0.37, 0.06, 0.018, 1.0), (0.085, 0.33, 0.045, 0.014, 0.6)]:
        e_, _, _ = ell(ax, y, cx, cy, a, b, ang)
        m |= e_
    # base drop
    m |= (np.sqrt(ax ** 2 + (y + 0.38) ** 2) < 0.04)
    m |= (ax < 0.03 * np.clip((y + 0.30) / 0.08, 0, 1)) & (y > -0.38) & (y < -0.30)
    # dots
    for cx, cy, rr in [(0.33, 0.06, 0.013), (0.31, -0.10, 0.011), (0.09, 0.30, 0.012), (0.21, -0.02, 0.009)]:
        m |= (np.sqrt((ax - cx) ** 2 + (y - cy) ** 2) < rr)
    # connecting stems
    stem = spiral(ax, y, 0.18, 0.02, 0.15, 0.0, 1.2, 0.006)
    m |= stem & (y > -0.14) & (y < 0.18) & (ax > 0.03)
    return m


def ornament(x, y, noise, ox, oy, scale, hx, hy, thr=0.15):
    """Mirror-symmetric damask-style ornament: a smooth noise field sampled at (|x|, y),
    banded and thresholded inside an ogee/lozenge envelope. x,y in cell units."""
    ax = np.abs(x)
    nn = noise.shape[0]
    v = sample_wrap(noise, oy + y * scale * nn, ox + ax * scale * nn)
    e = (ax / hx) ** 1.3 + (np.abs(y) / hy) ** 1.6
    env = 1 - smoothstep(0.75, 1.0, e)
    solid = (v > thr + 1.4 * (1 - env)) & (e < 1)
    lines = (np.abs(v + 0.55) < 0.07) & (e < 0.92)
    rim = np.abs(e - 1.0) < 0.014 * (1 + 0.6 * np.cos(np.arctan2(y, ax) * 22))
    out = solid | lines | rim
    out &= ~((np.abs(v - thr - 0.55) < 0.05) & solid)  # engraved veins inside solid parts
    return out


@material
def mat_wallpaper():
    seed = 1301
    r = rng(seed)
    size = 1.06
    pxmm = size * 1000 / S
    cellpx = S // 2
    mask = np.zeros((S, S), np.float32)
    on = fft_noise((S, S), seed + 10, lo=6, hi=60, beta=3.0, stretch=(1, 1.8))
    on = warp(on, 25 * fft_noise((S, S), seed + 11, lo=4, hi=16), 25 * fft_noise((S, S), seed + 12, lo=4, hi=16))
    on = on / on.std()
    centres = [(0.25, 0.25), (0.75, 0.25), (0.0, 0.75), (0.5, 0.75)]  # (v,u) half-drop
    for v0, u0 in centres:
        rows, cols, dy, dx = local_patch((S, S), v0 * S, u0 * S, cellpx / 2)
        x, y = np.broadcast_arrays(dx / cellpx, -dy / cellpx)
        mm = ornament(x, y, on, 300.0, 500.0, 0.75, 0.40, 0.47).astype(np.float32)
        ee = (np.abs(x) / 0.40) ** 1.3 + (np.abs(y) / 0.47) ** 1.6
        mm = np.maximum(mm, ((np.abs(x) < 0.005) & (ee < 0.9)).astype(np.float32))
        sub = mask[rows, cols]
        mask[rows, cols] = np.maximum(sub, mm)
    # small sprigs in the gaps between motif columns
    for u0 in (0.0, 0.5):
        for v0 in (0.125, 0.375, 0.625, 0.875):
            rows, cols, dy, dx = local_patch((S, S), v0 * S, u0 * S, cellpx * 0.2)
            x, y = np.broadcast_arrays(dx / cellpx, -dy / cellpx)
            mm = ornament(x, y, on, 900.0, 1500.0, 0.9, 0.10, 0.16, thr=0.3).astype(np.float32)
            sub = mask[rows, cols]
            mask[rows, cols] = np.maximum(sub, mm)
    mask = blur(mask, 1.0)
    paper = fft_noise((S, S), seed + 1, lo=300, hi=1024, beta=0.3)
    paper2 = fft_noise((S, S), seed + 2, lo=40, hi=300, beta=1.2)
    flock = fft_noise((S, S), seed + 3, lo=400, hi=1024, beta=0.0)
    ground = col([0.865, 0.82, 0.695])
    motif_c = col([0.815, 0.76, 0.625])
    alb = lerp(np.broadcast_to(ground, (S, S, 3)).copy(), motif_c, mask * (0.9 + 0.1 * flock))
    alb *= (1 + 0.012 * paper + 0.01 * paper2)[..., None]
    age = smoothstep(-1.0, 2.5, fft_noise((S, S), seed + 4, lo=1, hi=5, beta=2.8))
    alb = lerp(alb, alb * col([0.95, 0.91, 0.82]), age * 0.5)
    # vertical paper seams every 0.53 m (strip tone difference + hairline)
    R, C = grid()
    xs = np.mod(C + 0.5, cellpx)
    dseam = np.minimum(xs, cellpx - xs)
    hair = 1 - smoothstep(0.3, 1.4, dseam)
    strip = np.where(C < cellpx, 1.0, 0.985)
    alb *= (strip * (1 - 0.06 * hair))[..., None]
    alb = lerp(alb, alb * 0.9, (1 - smoothstep(0, 25, dseam)) * age * 0.3)
    fox = WrapCanvas((S, S), margin=20)
    for _ in range(25):
        y, x = r.uniform(0, S, 2)
        rr = r.uniform(0.8, 2.5)
        fox.ellipse(x, y, rr, rr, int(r.uniform(80, 200)))
    fx = blur(fox.fold(), 1.0)
    alb = lerp(alb, col([0.62, 0.48, 0.32]), fx * 0.5)
    h = 0.006 * paper + 0.004 * paper2 + mask * (0.03 + 0.008 * flock) + 0.02 * (1 - smoothstep(0, 2.5, dseam))
    rough = 0.86 + 0.02 * paper - 0.14 * mask
    return dict(albedo=np.clip(alb, 0, 1), height=h * 1e-3, rough=np.clip(rough, 0.6, 1), size=(size, size),
                note="Low-contrast Victorian damask wallpaper, cream on cream, half-drop 0.53 m repeat, faint vertical seams at U=0 and U=0.5.")


# ----------------------------------------------------------------------------
def float_seams(d):
    """Seam check on the float maps before JPEG: for albedo / height / roughness and both axes,
    ratio of the wrap-around boundary difference to the mean and to the max interior boundary."""
    out = []
    for k in ("albedo", "height", "rough"):
        a = d[k] if d[k].ndim == 3 else d[k][..., None]
        for ax in (1, 0):
            b = np.abs(a - np.roll(a, -1, ax)).mean((0, 2) if ax == 1 else (1, 2))
            out.append((k[0] + "UV"[1 - ax], float(b[-1] / b[:-1].mean()), float(b[-1] / b[:-1].max())))
    return out


def run(names):
    for n in names:
        t = time.time()
        d = MATERIALS[n]()
        fs = float_seams(d)
        e = save_set(n, d["albedo"], d["height"], d["rough"], d["size"], d["note"], d.get("strength", 1.0))
        seams = [seam_report(f"{OUT_DIR}/{n}_{k}.jpg") for k in "cnr"]
        jbad = any(mx > 1.1 for s in seams for rk, md, mx in s)
        fbad = any(mx > 1.0 + 1e-6 for _, md, mx in fs)
        print(f"{n:12s} {time.time() - t:5.1f}s q/bytes {e['_q']} rough {e['roughRange']}", flush=True)
        print("    float seams (wrap/mean, wrap/max): " + " ".join(f"{k}:{md:.2f}/{mx:.2f}" for k, md, mx in fs)
              + ("  <-- wrap boundary exceeds every interior boundary" if fbad else ""))
        print("    jpeg seams c,n,r (rank vs MCU-aligned boundaries, wrap/mean, wrap/max): "
              + " ".join("|".join(f"p{rk:.0f} {md:.2f}/{mx:.2f}" for rk, md, mx in s) for s in seams)
              + ("  <-- CHECK" if jbad else ""), flush=True)


if __name__ == "__main__":
    names = sys.argv[1:] or list(MATERIALS)
    run(names)
