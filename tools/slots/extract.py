#!/usr/bin/env python3
"""Cut the supplied machine screenshots (tools/slots/src) into the game's skin assets (assets/slots).
Everything here is a straight crop of the supplied artwork: nothing is redrawn, apart from blanking the
baked-in numbers on coins / HUD / jackpot panels so the game can draw live values there.
Run from the repo root:  python3 tools/slots/extract.py
"""
import json, os
import numpy as np, cv2
from PIL import Image, ImageFilter

SRC, OUT = 'tools/slots/src/', 'assets/slots/'
os.makedirs(OUT, exist_ok=True)
CW, CH = 156, 148     # sprite cell size in the atlases


def load(name):
    im = Image.open(SRC + name)
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, (0, 0, 0)); bg.paste(im, mask=im.split()[3]); im = bg
    return im.convert('RGB')


def save_jpg(im, name, q=80):
    im.convert('RGB').save(OUT + name, quality=q, optimize=True)


def upscale(im, k):
    im = im.resize((im.width * k, im.height * k), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))


def blank_text(cell, rad=0.62):
    """remove dark digits from the middle of a coin cell (cv2 inpaint)"""
    a = np.array(cell.convert('RGB'))
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    inside = ((xx - w / 2) ** 2 + (yy - h / 2) ** 2) < (min(w, h) * rad / 2) ** 2 * 1.2
    lum = a.mean(axis=2)
    mask = ((lum < 95) & inside).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    out = cv2.inpaint(a, mask, 6, cv2.INPAINT_TELEA)
    return Image.fromarray(out)


class Atlas:
    def __init__(self, cols=6):
        self.cells, self.cols = [], cols

    def add(self, key, im, fit='stretch'):
        im = im.convert('RGB')
        if fit == 'cover':
            s = max(CW / im.width, CH / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            l, t = (im.width - CW) // 2, (im.height - CH) // 2; im = im.crop((l, t, l + CW, t + CH))
        else:
            im = im.resize((CW, CH), Image.LANCZOS)
        self.cells.append((key, im))

    def save(self, name):
        rows = (len(self.cells) + self.cols - 1) // self.cols
        sheet = Image.new('RGB', (self.cols * CW, rows * CH), (0, 0, 0)); m = {}
        for i, (k, im) in enumerate(self.cells):
            x, y = (i % self.cols) * CW, (i // self.cols) * CH; sheet.paste(im, (x, y)); m[k] = [x, y, CW, CH]
        sheet.save(OUT + name, quality=84, optimize=True)
        return {'img': 'slots/' + name, 'map': m}


def cell(im, x0, y0, c, r, px, py, w=CW - 1, h=CH, ox=0, oy=0):
    """crop reel cell (c, r) given first-cell origin and pitch"""
    x, y = x0 + c * px + ox, y0 + r * py + oy
    return im.crop((round(x), round(y), round(x + w), round(y + h)))


SKINS = {}
DL = {}   # shared geometry for the Dragon Link family

# ------------------------------------------------------------------ Dragon Link family (Aristocrat, from the supplied screenshots)
def dragon_link(gid, name, srcfile, top_box, main_box, reel_origin, pitch, hud, jp, sprites, art_sprites=None, extra=None):
    im = load(srcfile)
    top = im.crop(top_box); main = im.crop(main_box)
    save_jpg(top, f'{gid}_top.jpg'); save_jpg(main, f'{gid}_main.jpg')
    tx, ty = top_box[0], top_box[1]; mx, my = main_box[0], main_box[1]
    A = Atlas()
    for key, (c, r) in sprites.items():
        cl = cell(im, reel_origin[0], reel_origin[1], c, r, pitch[0], pitch[1])
        if key.startswith('COIN'): cl = blank_text(cl)
        A.add(key, cl)
    for key, (box, fit) in (art_sprites or {}).items():
        A.add(key, im.crop(box), fit)
    atlas = A.save(f'{gid}_sprites.jpg')
    sk = {
        'name': name, 'main': f'slots/{gid}_main.jpg', 'mw': main.width, 'mh': main.height, 'top': f'slots/{gid}_top.jpg', 'tw': top.width, 'th': top.height,
        'win': [reel_origin[0] - mx, reel_origin[1] - my, pitch[0] * 5 - 12, pitch[1] * 3],
        'cellw': pitch[0], 'cellh': pitch[1],
        'hud': {k: [v[0] - mx, v[1] - my, v[2], v[3]] for k, v in hud.items()},
        'jp': {k: [v[0] - tx, v[1] - ty, v[2], v[3]] for k, v in jp.items()},
        'sprites': atlas,
    }
    if extra: sk.update(extra)
    SKINS[gid] = sk
    return im

JP_AM = dict(GRAND=(222, 448, 480, 92), MAJOR=(306, 592, 306, 64), MINOR=(222, 718, 178, 44), MINI=(526, 718, 176, 44))
HUD_AM = dict(credit=(282, 1803, 88, 36), bet=(466, 1803, 46, 36), win=(690, 1803, 40, 36))

# Autumn Moon: base game screen, all royals / pipa / mooncake / rabbit / lady / moon / coin cut from the reel window
dragon_link('am', 'AUTUMN MOON', 'dl_autumn_moon.jpg', (24, 292, 900, 806), (24, 806, 900, 1846), (50, 1284), (167.5, 149), HUD_AM, JP_AM,
            {'Q': (0, 0), 'K': (1, 0), 'PIPA': (2, 0), 'LADY': (3, 0), '10': (4, 0), 'WILD': (0, 1), 'COIN': (1, 1), '9': (2, 1), 'MOONCAKE': (4, 1), 'RABBIT': (2, 2), 'J': (3, 2)})

# Panda Magic: red-backed royals, lotus, junk, lantern, fireball coins, the panda from the art
JP_PM = dict(GRAND=(222, 468, 480, 92), MAJOR=(306, 612, 306, 64), MINOR=(222, 738, 178, 44), MINI=(526, 738, 176, 44))
HUD_PM = dict(credit=(282, 1823, 88, 36), bet=(466, 1823, 46, 36), win=(690, 1823, 40, 36))
dragon_link('pm', 'PANDA MAGIC', 'dl_panda_magic.jpg', (24, 308, 900, 822), (24, 822, 900, 1866), (52, 1298), (167, 148), HUD_PM, JP_PM,
            {'10': (0, 0), 'COIN': (1, 0), 'JUNK': (4, 0), 'LOTUS': (2, 1), '9': (4, 1), 'K': (1, 2), 'J': (2, 2), 'LANTERN': (4, 2)},
            {'PANDA': ((318, 850, 618, 1130), 'cover')})


def stack(parts, w=876):
    parts = [p.resize((w, round(p.height * w / p.width)), Image.LANCZOS) if p.width != w else p for p in parts]
    out = Image.new('RGB', (w, sum(p.height for p in parts)))
    y = 0
    for p in parts: out.paste(p, (0, y)); y += p.height
    return out

im_pm = load('dl_panda_magic.jpg'); im_gc = load('dl_golden_century.jpg'); im_hp = load('dl_happy_prosperous.jpg'); im_am = load('dl_autumn_moon.jpg')

# ------------------------------------------------------------------ Golden Century: title screen only was supplied.
# main = the supplied art (title included, "touch screen" panel left off) + the Panda Magic reel window and HUD strip as the reel stage
GC_TOP = (24, 266, 900, 782)
top = im_gc.crop(GC_TOP); save_jpg(top, 'gc_top.jpg')
art = im_gc.crop((24, 782, 900, 1548)); stage = im_pm.crop((24, 1286, 900, 1746)); bar = im_pm.crop((24, 1808, 900, 1868))
main = stack([art, stage, bar]); save_jpg(main, 'gc_main.jpg')
A = Atlas()
for key, (c, r) in {'10': (0, 0), 'JUNK': (4, 0), 'COIN': (1, 0), '9': (4, 1), 'K': (1, 2), 'J': (2, 2)}.items():
    cl = cell(im_pm, 52, 1298, c, r, 167, 148)
    if key == 'COIN': cl = blank_text(cl)
    A.add(key, cl)
A.add('WILD', im_gc.crop((360, 980, 620, 1250)), 'cover'); A.add('EMPEROR', im_gc.crop((380, 900, 640, 1130)), 'cover')
A.add('WALL', im_gc.crop((600, 960, 900, 1240)), 'cover'); A.add('SUN', im_gc.crop((640, 800, 900, 960)), 'cover'); A.add('CROWN', im_gc.crop((250, 880, 620, 1010)), 'cover'); A.add('Q', cell(im_pm, 52, 1298, 4, 0, 167, 148))
atlas = A.save('gc_sprites.jpg')
SKINS['gc'] = {'name': 'GOLDEN CENTURY', 'main': 'slots/gc_main.jpg', 'mw': main.width, 'mh': main.height, 'top': 'slots/gc_top.jpg', 'tw': top.width, 'th': top.height,
               'win': [28, art.height + 12, 167 * 5 - 12, 148 * 3], 'cellw': 167, 'cellh': 148,
               'hud': {'credit': [258, art.height + 460 + 12, 88, 36], 'bet': [442, art.height + 460 + 12, 46, 36], 'win': [666, art.height + 460 + 12, 40, 36]},
               'jp': {'GRAND': [222, 152, 480, 92], 'MAJOR': [306, 296, 306, 66], 'MINOR': [150, 426, 240, 50], 'MINI': [562, 426, 184, 50]}, 'sprites': atlas}

# ------------------------------------------------------------------ Happy & Prosperous: the hold & spin screen supplied.
HP_TOP = (24, 312, 900, 812); HP_MAIN = (24, 812, 900, 1862)
top = im_hp.crop(HP_TOP); save_jpg(top, 'hp_top.jpg')
main = im_hp.crop(HP_MAIN)
# blank the medal text so the game can write the live "N COLLECTED": repaint the disc with a clean radial gold gradient
cx, cy, R = 431, 236, 226
yy, xx = np.mgrid[0:main.height, 0:main.width]
d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 1.0) ** 2) / R
inner = np.array([255, 226, 80.]); mid = np.array([252, 196, 40.]); outer = np.array([236, 150, 12.])
t = np.clip(d, 0, 1)[..., None]
col = np.where(t < 0.6, inner + (mid - inner) * (t / 0.6), mid + (outer - mid) * ((t - 0.6) / 0.4))
hl = np.exp(-(((xx - (cx - 70)) ** 2 + (yy - (cy - 90)) ** 2) / (2 * 90 ** 2)))[..., None] * 28
col = np.clip(col + hl, 0, 255)
arr = np.array(main).astype(float); disc = (d < 0.985)[..., None]
feather = np.clip((0.985 - d) / 0.03, 0, 1)[..., None]
arr = arr * (1 - feather) + col * feather
medal = Image.fromarray(arr.astype(np.uint8)); medal.save(OUT + 'hs_bg.jpg', quality=80)
save_jpg(medal, 'hp_main.jpg')   # the medal is blank here; the game writes the title / live count on it
A = Atlas()
for key, (c, r) in {'10': (0, 0), 'JUNK': (4, 0), '9': (4, 1), 'K': (1, 2), 'J': (2, 2), 'LANTERN': (4, 2), 'LOTUS': (2, 1), 'WILD': (1, 0)}.items():
    cl = cell(im_pm, 52, 1298, c, r, 167, 148); A.add(key, cl)
A.add('COIN', blank_text(cell(im_hp, 52, 1300, 0, 0, 167, 146, h=146)))
A.add('Q', cell(im_pm, 52, 1298, 4, 0, 167, 148)); A.add('COINJP', cell(im_hp, 52, 1300, 4, 0, 167, 146, h=146)); A.add('INGOT', im_hp.crop((560, 1520, 740, 1680)), 'cover')
atlas = A.save('hp_sprites.jpg')
SKINS['hp'] = {'name': 'HAPPY & PROSPEROUS', 'main': 'slots/hp_main.jpg', 'mw': main.width, 'mh': main.height, 'top': 'slots/hp_top.jpg', 'tw': top.width, 'th': top.height,
               'win': [28, 1300 - 812, 167 * 5 - 12, 146 * 3], 'cellw': 167, 'cellh': 146,
               'hud': {'credit': [258, 1816 - 812 + 4, 88, 36], 'bet': [442, 1816 - 812 + 4, 46, 36], 'win': [666, 1816 - 812 + 4, 40, 36]},
               'jp': {'GRAND': [222, 158, 480, 92], 'MAJOR': [306, 302, 306, 66], 'MINOR': [222, 428, 178, 46], 'MINI': [526, 428, 176, 46]}, 'sprites': atlas, 'medal': [210 - 24, 810 - 812, 490, 480]}

# ------------------------------------------------------------------ Konami Fire Mountain (supplied render of the Synkros cabinet)
fm = load('konami_fire_mountain.webp')
FM_MAIN = (66, 150, 716, 1302)
main = fm.crop(FM_MAIN); save_jpg(main, 'fm_main.jpg')
cab = fm.crop((20, 1640, 761, 1995)); save_jpg(cab, 'fm_front.jpg')
mx, my = FM_MAIN[0], FM_MAIN[1]
ox, oy, px, py = 100, 957, 118.4, 95.0
A = Atlas()
cells = {'CHEST': (0, 0), 'MALLET': (1, 0), 'GOURD': (2, 0), 'BULL': (3, 0), 'A': (0, 1), 'FAN': (3, 2), 'J': (0, 2), 'K': (1, 2), 'INGOT': (2, 2), 'Q': (4, 2)}
for key, (c, r) in cells.items():
    A.add(key, fm.crop((round(ox + c * px), round(oy + r * py), round(ox + (c + 1) * px - 2), round(oy + (r + 1) * py - 1))))
A.add('WILD', fm.crop((568, 955, 694, 1150)), 'cover'); A.add('COIN', fm.crop((205, 1040, 330, 1170)), 'cover')
atlas = A.save('fm_sprites.jpg')
SKINS['fm'] = {'name': 'FIRE MOUNTAIN', 'main': 'slots/fm_main.jpg', 'mw': main.width, 'mh': main.height, 'front': 'slots/fm_front.jpg',
               'win': [ox - mx, oy - my, round(px * 5) - 2, round(py * 3)], 'cellw': round(px), 'cellh': round(py),
               'hud': {'credit': [150, 1262 - my, 100, 28], 'bet': [327, 1262 - my, 50, 28], 'win': [430, 1262 - my, 120, 28]},
               'jpm': {'GRAND': [84 - mx + 4, 556 - my, 262, 62], 'MEGA': [415 - mx, 556 - my, 240, 62], 'MAXI': [146 - mx, 842 - my, 150, 34], 'MAJOR': [318 - mx, 842 - my, 152, 34], 'MINI': [488 - mx, 842 - my, 150, 34]}, 'sprites': atlas}


def shared_royals(A):
    for key, (c, r) in {'Q': (0, 0), 'K': (1, 0), '10': (4, 0), '9': (2, 1), 'J': (3, 2)}.items(): A.add(key, cell(im_am, 50, 1284, c, r, 167.5, 149))
    A.add('COIN', blank_text(cell(im_am, 50, 1284, 1, 1, 167.5, 149)))

def themed_sprites(A, raw):
    W, H = raw.size
    fr = lambda a, b, c, d: raw.crop((round(W * a), round(H * b), round(W * c), round(H * d)))
    A.add('S1', fr(0.18, 0.40, 0.82, 0.80), 'cover'); A.add('S2', fr(0.0, 0.38, 0.5, 0.78), 'cover'); A.add('S3', fr(0.5, 0.38, 1.0, 0.78), 'cover')
    A.add('S4', fr(0.05, 0.70, 0.95, 0.88), 'cover'); A.add('WILD', fr(0.05, 0.70, 0.95, 0.88), 'cover'); A.add('LOGO', fr(0.04, 0.03, 0.96, 0.17), 'cover')

# ------------------------------------------------------------------ Lightning Dollar Link bank (supplied 4-machine render)
ldl = load('ldl_bank.webp')
save_jpg(ldl.crop((70, 112, 930, 238)), 'ldl_banner.jpg')
names = [('ldl1', 'CHECKERED FLAG', 150), ('ldl2', 'CHICA BONITA', 328), ('ldl3', 'CORRIDA DE TOROS', 505), ('ldl4', 'KUNG FU MASTER', 683)]
for gid, nm, ox_ in names:
    mainc = ldl.crop((ox_ + 11, 388, ox_ + 150, 628)); topc = ldl.crop((ox_ + 7, 262, ox_ + 161, 351))
    mainu, topu = upscale(mainc, 4), upscale(topc, 4)
    save_jpg(mainu, f'{gid}_main.jpg', 74); save_jpg(topu, f'{gid}_top.jpg', 74)
    A = Atlas(); shared_royals(A); themed_sprites(A, mainu); atlas = A.save(f'{gid}_sprites.jpg')
    k = 4
    SKINS[gid] = {'name': nm, 'main': f'slots/{gid}_main.jpg', 'mw': mainu.width, 'mh': mainu.height, 'top': f'slots/{gid}_top.jpg', 'tw': topu.width, 'th': topu.height,
                  'win': [8 * k, 150 * k // 1 - 4 * k, 123 * k, 66 * k], 'cellw': 25 * k, 'cellh': 22 * k,
                  'hud': {}, 'jp': {'GRAND': [14 * k, 50 * k, 126 * k, 28 * k]}, 'sprites': atlas}

# ------------------------------------------------------------------ Thunder Empire pair (supplied photo)
te = load('thunder_empire.png')
for gid, nm, mb, tb in [('te1', 'INCA DIAMONDS', (36, 280, 196, 580), (36, 176, 197, 254)), ('te2', 'MAGIC EMPEROR', (232, 280, 392, 580), (226, 178, 388, 256))]:
    mainu, topu = upscale(te.crop(mb), 4), upscale(te.crop(tb), 4)
    save_jpg(mainu, f'{gid}_main.jpg', 74); save_jpg(topu, f'{gid}_top.jpg', 74)
    A = Atlas(); shared_royals(A); themed_sprites(A, mainu); atlas = A.save(f'{gid}_sprites.jpg')
    k = 4
    SKINS[gid] = {'name': nm, 'main': f'slots/{gid}_main.jpg', 'mw': mainu.width, 'mh': mainu.height, 'top': f'slots/{gid}_top.jpg', 'tw': topu.width, 'th': topu.height,
                  'win': [6 * k, 190 * k - 4 * k, 148 * k, 82 * k], 'cellw': 30 * k, 'cellh': 27 * k, 'hud': {}, 'jp': {'GRAND': [20 * k, 38 * k, 110 * k, 16 * k]} if gid == 'te1' else {}, 'sprites': atlas}

json.dump(SKINS, open(OUT + 'skins.json', 'w'), indent=1)
print('done', list(SKINS))
