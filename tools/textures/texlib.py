"""Shared helpers for procedural, seamlessly tiling PBR texture synthesis.

Everything here works on periodic (torus) domains so that every derived map
tiles in both directions:
  * noise comes from FFT-filtered white noise (periodic by construction)
  * blurs use mode='wrap'
  * point sets / Voronoi use cKDTree(boxsize=...) (periodic distance)
  * vector drawing goes through WrapCanvas, which folds margins back onto the tile
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree


# ----------------------------------------------------------------------------
# noise
# ----------------------------------------------------------------------------
def rng(seed):
    return np.random.default_rng(seed)


def fft_noise(shape, seed, lo=1.0, hi=None, beta=2.0, stretch=(1.0, 1.0), angle=0.0):
    """Periodic gaussian noise (zero mean, unit std).

    lo/hi   : band limits in cycles per tile (soft)
    beta    : spectral slope; amplitude ~ f^(-beta/2)
    stretch : (sx, sy) frequency multipliers. sy > 1 makes features longer in y
              (vertical / V axis); sx > 1 makes them longer in x.
    angle   : rotate the anisotropy (radians)
    """
    H, W = shape
    r = rng(seed)
    white = r.standard_normal((H, W)).astype(np.float32)
    F = np.fft.rfft2(white)
    fy = (np.fft.fftfreq(H) * H)[:, None].astype(np.float32)
    fx = (np.fft.rfftfreq(W) * W)[None, :].astype(np.float32)
    if angle:
        c, s = np.cos(angle), np.sin(angle)
        fx, fy = c * fx - s * fy, s * fx + c * fy
    f = np.sqrt((fx * stretch[0]) ** 2 + (fy * stretch[1]) ** 2)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    amp *= 1.0 / (1.0 + (lo / f) ** 8)
    if hi is not None:
        amp *= 1.0 / (1.0 + (f / hi) ** 8)
    amp[0, 0] = 0.0
    out = np.fft.irfft2(F * amp, s=(H, W)).astype(np.float32)
    out -= out.mean()
    sd = out.std()
    return out / (sd if sd > 0 else 1.0)


def fbm(shape, seed, lo=2.0, hi=None, beta=2.0, stretch=(1.0, 1.0)):
    return fft_noise(shape, seed, lo=lo, hi=hi, beta=beta, stretch=stretch)


def ridged(n):
    return 1.0 - np.abs(n)


def blur(a, sigma):
    if sigma <= 0:
        return a
    if a.ndim == 3:
        return np.stack([ndimage.gaussian_filter(a[..., i], sigma, mode="wrap") for i in range(a.shape[2])], -1)
    return ndimage.gaussian_filter(a, sigma, mode="wrap")


def sample_wrap(img, rows, cols, order=1):
    """Sample a periodic field at fractional pixel coordinates."""
    return ndimage.map_coordinates(img, [rows, cols], order=order, mode="grid-wrap").astype(np.float32)


def warp(img, dr, dc, order=1):
    H, W = img.shape
    R, C = np.mgrid[0:H, 0:W].astype(np.float32)
    return sample_wrap(img, R + dr, C + dc, order)


def norm01(a, lo_pct=0.5, hi_pct=99.5):
    lo, hi = np.percentile(a, [lo_pct, hi_pct])
    return np.clip((a - lo) / max(hi - lo, 1e-9), 0, 1).astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    if np.ndim(t) == 2 and (np.ndim(a) == 3 or np.ndim(b) == 3 or np.shape(a)[-1:] == (3,) or np.shape(b)[-1:] == (3,)):
        t = t[..., None]
    return a + (b - a) * t


def col(rgb):
    return np.asarray(rgb, dtype=np.float32)


def worley(shape, pts, k=2):
    """Periodic Voronoi. pts in pixel coords (N,2) as (row, col).
    Returns distances (H,W,k) in pixels and nearest indices (H,W,k)."""
    H, W = shape
    tree = cKDTree(np.mod(pts, [H, W]), boxsize=[H, W])
    R, C = np.mgrid[0:H, 0:W]
    q = np.stack([R.ravel() + 0.5, C.ravel() + 0.5], -1)
    q = np.mod(q, [H, W])
    d, i = tree.query(q, k=k, workers=-1)
    if k == 1:
        d = d[:, None]
        i = i[:, None]
    return d.reshape(H, W, k).astype(np.float32), i.reshape(H, W, k)


def poisson_points(shape, n, seed, min_dist=0.0, tries=30):
    """Random points in a periodic box with a soft minimum spacing (dart throwing)."""
    H, W = shape
    r = rng(seed)
    if min_dist <= 0:
        return r.uniform(0, 1, (n, 2)) * [H, W]
    pts = []
    cand = r.uniform(0, 1, (n * tries, 2)) * [H, W]
    for p in cand:
        if len(pts) >= n:
            break
        ok = True
        if pts:
            d = np.abs(np.asarray(pts) - p)
            d = np.minimum(d, [H, W] - d)
            if (d[:, 0] ** 2 + d[:, 1] ** 2).min() < min_dist ** 2:
                ok = False
        if ok:
            pts.append(p)
    return np.asarray(pts)


# ----------------------------------------------------------------------------
# periodic vector drawing
# ----------------------------------------------------------------------------
class WrapCanvas:
    """PIL canvas with a margin; fold() wraps the margins back so shapes that
    cross the tile edge reappear on the opposite side (seamless)."""

    def __init__(self, shape, margin=256, mode="L"):
        self.H, self.W = shape
        self.m = margin
        self.img = Image.new(mode, (self.W + 2 * margin, self.H + 2 * margin), 0)
        self.d = ImageDraw.Draw(self.img)

    def _xy(self, pts):
        return [(x + self.m, y + self.m) for (x, y) in pts]

    def _shifts(self, pts):
        # draw the shape at every periodic copy that may intersect the canvas
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        ox = -np.floor(min(xs) / self.W) * self.W
        oy = -np.floor(min(ys) / self.H) * self.H
        out = []
        for dx in (-self.W, 0, self.W):
            for dy in (-self.H, 0, self.H):
                out.append((ox + dx, oy + dy))
        return out

    def line(self, pts, fill=255, width=1):
        for sx, sy in self._shifts(pts):
            self.d.line(self._xy([(x + sx, y + sy) for x, y in pts]), fill=fill, width=width, joint="curve")

    def polygon(self, pts, fill=255):
        for sx, sy in self._shifts(pts):
            self.d.polygon(self._xy([(x + sx, y + sy) for x, y in pts]), fill=fill)

    def ellipse(self, cx, cy, rx, ry, fill=255):
        pts = [(cx - rx, cy - ry), (cx + rx, cy + ry)]
        for sx, sy in self._shifts(pts):
            (x0, y0), (x1, y1) = self._xy([(x + sx, y + sy) for x, y in pts])
            self.d.ellipse([x0, y0, x1, y1], fill=fill)

    def fold(self):
        a = np.asarray(self.img, dtype=np.float32) / 255.0
        m, H, W = self.m, self.H, self.W
        out = a[m:m + H, m:m + W].copy()
        full = a
        # fold every margin cell back with max()
        for oy in (-1, 0, 1):
            for ox in (-1, 0, 1):
                if ox == 0 and oy == 0:
                    continue
                ys0 = m + oy * H
                xs0 = m + ox * W
                # region of the padded canvas corresponding to this periodic copy
                y0, y1 = max(ys0, 0), min(ys0 + H, full.shape[0])
                x0, x1 = max(xs0, 0), min(xs0 + W, full.shape[1])
                if y1 <= y0 or x1 <= x0:
                    continue
                sub = full[y0:y1, x0:x1]
                ty0, tx0 = y0 - ys0, x0 - xs0
                tgt = out[ty0:ty0 + sub.shape[0], tx0:tx0 + sub.shape[1]]
                np.maximum(tgt, sub, out=tgt)
        return out


def stamp_disc(shape, cy, cx, r, soft=1.0):
    """Periodic soft disc mask at (cy,cx) radius r (pixels)."""
    H, W = shape
    R, C = np.ogrid[0:H, 0:W]
    dy = (R - cy + H / 2) % H - H / 2
    dx = (C - cx + W / 2) % W - W / 2
    d = np.sqrt(dy * dy + dx * dx)
    return np.clip((r - d) / soft + 0.5, 0, 1).astype(np.float32)


def local_patch(shape, cy, cx, half):
    """Return (rows, cols, dy, dx) index arrays of a periodic square patch around (cy,cx)."""
    H, W = shape
    iy = np.arange(int(np.floor(cy - half)), int(np.ceil(cy + half)) + 1)
    ix = np.arange(int(np.floor(cx - half)), int(np.ceil(cx + half)) + 1)
    dy = (iy - cy)[:, None].astype(np.float32)
    dx = (ix - cx)[None, :].astype(np.float32)
    return np.mod(iy, H)[:, None], np.mod(ix, W)[None, :], dy, dx


# ----------------------------------------------------------------------------
# maps / output
# ----------------------------------------------------------------------------
def height_to_normal(h, px_x, px_y, strength=1.0):
    """h in metres, px_* = metres per pixel. Returns float normal (H,W,3), OpenGL (+Y up),
    with image row 0 at the top (v increases upward)."""
    dhdx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * px_x)
    dhdrow = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * px_y)
    nx = -dhdx * strength
    ny = dhdrow * strength  # y-up = -row
    nz = np.ones_like(h)
    n = np.stack([nx, ny, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n.astype(np.float32)


def down(a, f):
    if f == 1:
        return a
    H, W = a.shape[:2]
    if a.ndim == 3:
        return a.reshape(H // f, f, W // f, f, a.shape[2]).mean((1, 3))
    return a.reshape(H // f, f, W // f, f).mean((1, 3))


def to8(a):
    return (np.clip(a, 0, 1) * 255.0 + 0.5).astype(np.uint8)


OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "tex"))


def save_jpeg(arr, path, mode, q, q_min, max_bytes, subsampling=None):
    """Save JPEG at quality q, stepping quality down until it fits max_bytes (budget control)."""
    import io
    im = Image.fromarray(arr, mode)
    kw = dict(optimize=True, progressive=True)
    if subsampling is not None:
        kw["subsampling"] = subsampling
    while True:
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, **kw)
        if buf.tell() <= max_bytes or q <= q_min:
            break
        q -= 2
    with open(path, "wb") as fh:
        fh.write(buf.getvalue())
    return q, buf.tell()


BUDGET = dict(c=270_000, n=285_000, r=65_000)  # keeps assets/tex around 6.5 MB


def save_set(name, albedo, height, rough, size_m, note, strength=1.0, out_dir=OUT_DIR,
             qc=88, qn=92, qr=88, out_res=1024, r_res=512):
    """albedo (S,S,3) sRGB 0-1, height (S,S) metres, rough (S,S) 0-1 linear."""
    os.makedirs(out_dir, exist_ok=True)
    S = albedo.shape[0]
    px_x = size_m[0] / height.shape[1]
    px_y = size_m[1] / height.shape[0]
    n = height_to_normal(height, px_x, px_y, strength)
    f = S // out_res
    nd = down(n, f)
    nd /= np.linalg.norm(nd, axis=-1, keepdims=True)
    c8 = to8(down(albedo, f))
    n8 = to8(nd * 0.5 + 0.5)
    r8 = to8(down(rough, S // r_res))
    qs = {}
    qs["c"] = save_jpeg(c8, os.path.join(out_dir, f"{name}_c.jpg"), "RGB", qc, 76, BUDGET["c"])
    qs["n"] = save_jpeg(n8, os.path.join(out_dir, f"{name}_n.jpg"), "RGB", qn, 70, BUDGET["n"], subsampling=0)
    qs["r"] = save_jpeg(r8, os.path.join(out_dir, f"{name}_r.jpg"), "L", qr, 76, BUDGET["r"])
    lo, hi = np.percentile(rough, [1, 99])
    entry = {
        "size": [round(size_m[0], 4), round(size_m[1], 4)],
        "c": f"{name}_c.jpg",
        "n": f"{name}_n.jpg",
        "r": f"{name}_r.jpg",
        "roughRange": [round(float(lo), 2), round(float(hi), 2)],
        "note": note,
    }
    mpath = os.path.join(out_dir, "manifest.json")
    man = {}
    if os.path.exists(mpath):
        with open(mpath) as fh:
            man = json.load(fh)
    man[name] = entry
    entry = dict(entry, _q=qs)
    with open(mpath, "w") as fh:
        json.dump(dict(sorted(man.items())), fh, indent=2)
    return entry


def seam_report(path):
    """Seam test. For each axis, take the mean |difference| across every pixel boundary.
    The wrap-around boundary (last->first) is compared with the interior boundaries that sit
    at the same position in the JPEG 16-px MCU grid (index 15 mod 16), so JPEG block edges
    don't bias the result. Returns per axis (percentile rank, wrap/mean, wrap/max) — a real
    seam shows up as rank 100 with wrap/max clearly > 1."""
    a = np.asarray(Image.open(path), dtype=np.float32)
    if a.ndim == 2:
        a = a[..., None]
    res = []
    for ax in (1, 0):
        b = np.abs(a - np.roll(a, -1, axis=ax))
        prof = b.mean(axis=(0, 2)) if ax == 1 else b.mean(axis=(1, 2))
        wrap = prof[-1]
        inner = prof[15:-1:16]
        rank = (inner < wrap).mean() * 100
        res.append((rank, wrap / inner.mean(), wrap / inner.max()))
    return res
