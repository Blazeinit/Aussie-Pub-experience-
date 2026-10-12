"""Contact sheet: per material row = albedo tiled 2x2 | quick-lit (numpy) | normal | roughness.
usage: python contact_sheet.py out.png [names...] [--zoom]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
TEX = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "tex"))


def load(p, size=None):
    im = Image.open(p)
    if size:
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def lit(c, n, r, ldir=(-0.5, 0.6, 0.55)):
    l = np.asarray(ldir, np.float32)
    l /= np.linalg.norm(l)
    N = n * 2 - 1
    N /= np.linalg.norm(N, axis=-1, keepdims=True)
    N[..., 1] *= -1  # image rows go down; flip so light from top-left looks right
    N[..., 1] *= -1
    ndl = np.clip((N * l).sum(-1), 0, 1)
    v = np.array([0, 0, 1], np.float32)
    hv = (l + v) / np.linalg.norm(l + v)
    ndh = np.clip((N * hv).sum(-1), 0, 1)
    a = np.maximum(r, 0.05) ** 2
    spec = (a * a) / (np.pi * ((ndh * ndh) * (a * a - 1) + 1) ** 2) * 0.04 * ndl
    lin = c ** 2.2
    out = lin * (0.15 + 0.85 * ndl)[..., None] + spec[..., None] * 0.6
    return np.clip(out, 0, 1) ** (1 / 2.2)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    zoom = "--zoom" in sys.argv
    out = args[0]
    man = json.load(open(os.path.join(TEX, "manifest.json")))
    names = args[1:] or list(man)
    T = 400
    rows = []
    for nme in names:
        c = load(os.path.join(TEX, f"{nme}_c.jpg"))
        n = load(os.path.join(TEX, f"{nme}_n.jpg"))
        r = load(os.path.join(TEX, f"{nme}_r.jpg"), 1024)
        if zoom:
            cs = c[:512, :512]
            panel = [cs, lit(c, n, r)[:512, :512], n[:512, :512], np.repeat(r[:512, :512, None], 3, -1)]
            panel = [np.asarray(Image.fromarray((p * 255).astype(np.uint8)).resize((T, T), Image.LANCZOS)) / 255.0 for p in panel]
            row = np.concatenate(panel, 1)
        else:
            c2 = np.tile(c, (2, 2, 1))
            c2 = np.asarray(Image.fromarray((c2 * 255).astype(np.uint8)).resize((2 * T, 2 * T), Image.LANCZOS)) / 255.0
            L = lit(c, n, r)
            L2 = np.tile(L, (2, 2, 1))
            L2 = np.asarray(Image.fromarray((L2 * 255).astype(np.uint8)).resize((2 * T, 2 * T), Image.LANCZOS)) / 255.0
            ns = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((T, T), Image.LANCZOS)) / 255.0
            rs = np.asarray(Image.fromarray((r * 255).astype(np.uint8)).resize((T, T), Image.LANCZOS)) / 255.0
            rs = np.repeat(rs[..., None], 3, -1)
            right = np.concatenate([ns, rs], 0)
            row = np.concatenate([c2, L2, right], 1)
        rows.append((nme, row))
    W = max(r.shape[1] for _, r in rows)
    sheet = np.concatenate([np.pad(r, ((22, 0), (0, W - r.shape[1]), (0, 0)), constant_values=0.15) for _, r in rows], 0)
    im = Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    y = 0
    for nme, r in rows:
        d.text((6, y + 5), nme, fill=(255, 255, 255))
        y += r.shape[0] + 22
    im.save(out)
    print(out, im.size)


if __name__ == "__main__":
    main()
