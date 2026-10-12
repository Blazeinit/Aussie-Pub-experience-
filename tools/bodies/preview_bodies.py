#!/usr/bin/env python3
"""Blender (bpy module, headless) preview of assets/char/bodies.json.

Rebuilds an armature from the exported rest positions, binds the mesh with the exported
skin weights and renders posed views (Workbench) into an output dir.
Data stays Y-up inside Blender (bones point +Y with zero roll => bone axes == world axes,
so pose Euler rotations here match the game's local Euler rotations).

usage: python preview_bodies.py <out_dir> [pose ...]
"""
import bpy, json, base64, math, os, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'char', 'bodies.json')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/body_previews'
os.makedirs(OUT, exist_ok=True)

PARENT = {'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck',
          'lUA': 'chest', 'lEL': 'lUA', 'lH': 'lEL', 'rUA': 'chest', 'rEL': 'rUA', 'rH': 'rEL',
          'lTH': 'hips', 'lKN': 'lTH', 'lFT': 'lKN', 'rTH': 'hips', 'rKN': 'rTH', 'rFT': 'rKN'}

POSES = {
    'rest': {},
    'close': {},
    'sit': {'lTH': (-1.5, 0, 0), 'rTH': (-1.5, 0, 0), 'lKN': (1.45, 0, 0), 'rKN': (1.45, 0, 0), 'spine': (0.1, 0, 0),
            'lFT': (0.1, 0, 0), 'rFT': (0.1, 0, 0), 'lUA': (-0.35, 0, 0.1), 'rUA': (-0.35, 0, -0.1), 'lEL': (-1.0, 0, 0), 'rEL': (-1.0, 0, 0)},
    'drink': {'lUA': (-0.9, 0, 0.2), 'lEL': (-1.4, 0, 0), 'rUA': (0.05, 0, -0.12), 'rEL': (-0.15, 0, 0)},
    'cheer': {'lUA': (-2.8, 0, 0.3), 'rUA': (-2.8, 0, -0.3), 'lEL': (-0.3, 0, 0), 'rEL': (-0.3, 0, 0), 'head': (-0.3, 0, 0)},
    'lean': {'spine': (0.65, 0, 0), 'chest': (0.25, 0, 0), 'rUA': (0.3, 0, 0), 'rEL': (-1.4, 0, 0), 'lUA': (-1.2, 0, 0),
             'lEL': (-0.2, 0, 0), 'lTH': (-0.3, 0, 0), 'lKN': (0.3, 0, 0), 'rTH': (0.25, 0, 0)},
    'walk': {'lTH': (-0.45, 0, 0), 'lKN': (0.5, 0, 0), 'rTH': (0.35, 0, 0), 'rKN': (0.2, 0, 0), 'lUA': (0.38, 0, 0.12), 'rUA': (-0.38, 0, -0.12),
             'lEL': (-0.3, 0, 0), 'rEL': (-0.3, 0, 0)},
}

def dec(s, dt, w):
    a = np.frombuffer(base64.b64decode(s), dtype=dt)
    return a.reshape(-1, w) if w > 1 else a

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)

def build(D, bones, k, mode):
    pos = dec(D['position'], '<f4', 3) + k * dec(D['heavy'], '<f4', 3)
    nrm = dec(D['normal'], '<f4', 3) * (1 - k) + k * dec(D['heavyNormal'], '<f4', 3)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    idx = dec(D['index'], '<u2', 3)
    si = dec(D['skinIndex'], 'u1', 4); sw = dec(D['skinWeight'], '<f4', 4)
    uv = dec(D['uv'], '<f4', 2); seg = dec(D['seg'], 'u1', 1)
    me = bpy.data.meshes.new('body')
    me.from_pydata(pos.tolist(), [], idx.tolist())
    me.update()
    for p in me.polygons: p.use_smooth = True
    me.normals_split_custom_set_from_vertices(nrm.tolist())
    uvl = me.uv_layers.new(name='UVMap')
    li = np.zeros(len(me.loops), dtype=np.int32); me.loops.foreach_get('vertex_index', li)
    uvl.data.foreach_set('uv', uv[li].reshape(-1))
    if mode == 'seg':
        pal = np.array([[.35, .35, .8], [.85, .3, .3], [.95, .85, .3], [.3, .75, .35], [.3, .7, .8],
                        [.95, .6, .45], [.6, .35, .8], [.5, .8, .5], [.25, .25, .25]])
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        c = np.concatenate([pal[seg], np.ones((len(seg), 1))], 1)
        col.data.foreach_set('color', c.reshape(-1).astype(np.float32))
    ob = bpy.data.objects.new('body', me); bpy.context.scene.collection.objects.link(ob)
    ad = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for b in bones:
        e = ad.edit_bones.new(b); h = D['rest'][b]
        e.head = h; e.tail = (h[0], h[1] + 0.05, h[2]); e.roll = 0; eb[b] = e
    for b, p in PARENT.items(): eb[b].parent = eb[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    groups = [ob.vertex_groups.new(name=b) for b in bones]
    for v in range(len(pos)):
        for j in range(4):
            if sw[v, j] > 0: groups[si[v, j]].add([v], float(sw[v, j]), 'REPLACE')
    md = ob.modifiers.new('arm', 'ARMATURE'); md.object = arm
    # head stand-in
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1)
    hd = bpy.context.active_object; hd.name = 'head'
    hd.data.transform(__import__('mathutils').Matrix.Diagonal((0.093, 0.115, 0.104, 1)))
    hd.data.transform(__import__('mathutils').Matrix.Translation((0, 1.605, 0)))
    for p in hd.data.polygons: p.use_smooth = True
    hg = hd.vertex_groups.new(name='head'); hg.add(list(range(len(hd.data.vertices))), 1.0, 'REPLACE')
    m2 = hd.modifiers.new('arm', 'ARMATURE'); m2.object = arm
    return ob, arm, hd

def pose(arm, P):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = P.get(pb.name, (0, 0, 0))
    bpy.context.view_layer.update()

def setup_scene(mode):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'          # CPU path tracer: works headless without EGL/GPU
    sc.cycles.device = 'CPU'; sc.cycles.samples = 12; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2
    sc.render.resolution_x, sc.render.resolution_y = 360, 560
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.78, 0.82, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.2; sun.angle = 0.3
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(-35), math.radians(25), 0)   # from front-up-right (Y-up data)
    sc.view_settings.view_transform = 'Standard'

def plain_material(ob, mode, rgb=(0.45, 0.43, 0.41)):
    mat = bpy.data.materials.new('m'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.8
    if mode == 'seg':
        at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'Col'
        nt.links.new(at.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    ob.data.materials.append(mat)

def uv_material(ob):
    W = H = 256
    u = (np.arange(W) + 0.5) / W
    U, V = np.meshgrid(u, u)
    img = np.ones((H, W, 4))
    stripe = ((np.floor(U * 16) + np.floor(V * 8)) % 2)[..., None]
    img[..., :3] = 0.35 + 0.5 * stripe * np.array([1.0, 0.8, 0.5]) + 0.15 * (1 - stripe) * np.array([0.2, 0.4, 1.0])
    img[:4, :, :3] = [0.9, 0.1, 0.1]  # v = 0 marker
    im = bpy.data.images.new('chk', W, H); im.pixels.foreach_set(img.astype(np.float32).reshape(-1))
    mat = bpy.data.materials.new('chk'); mat.use_nodes = True
    nt = mat.node_tree; tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = im
    tex.interpolation = 'Closest'
    # scale: 8 repeats around (u), 1 checker per 6.25 cm vertically (v in metres)
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 2.0, 1.0)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    bsdf = nt.nodes.get('Principled BSDF'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    ob.data.materials.append(mat)

def camera(name, yaw, cy=0.9, scale=2.0):
    cam = bpy.data.cameras.new(name); cam.type = 'ORTHO'; cam.ortho_scale = scale
    co = bpy.data.objects.new(name, cam); bpy.context.scene.collection.objects.link(co)
    a = math.radians(yaw)
    co.location = (4 * math.sin(a), cy, 4 * math.cos(a)); co.rotation_euler = (0, a, 0)
    return co

def render_views(views, path):
    sc = bpy.context.scene; tiles = []
    for (yaw, cy, scale) in views:
        co = camera('cam', yaw, cy, scale); sc.camera = co
        tmp = os.path.join(OUT, '_tmp.png'); sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp)
        a = np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)
        tiles.append(a); bpy.data.images.remove(im)
        bpy.data.objects.remove(co, do_unlink=True)
    return tiles

def save_grid(rows, path):
    rws = [np.concatenate(r, 1) for r in rows]
    g = np.concatenate(rws[::-1], 0)  # blender pixel rows go bottom-up
    im = bpy.data.images.new('grid', g.shape[1], g.shape[0])
    im.pixels.foreach_set(g.astype(np.float32).reshape(-1))
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

def main():
    data = json.load(open(SRC))
    bones = data['bones']
    which = sys.argv[2:] or ['rest', 'sit', 'drink', 'cheer', 'lean', 'seg', 'uv']
    for var in ('male', 'female'):
        D = data[var]
        for pn in which:
            mode = pn if pn in ('seg', 'uv') else 'plain'
            P = POSES.get(pn, {})
            rows = []
            for k in ((0.0,) if mode != 'plain' else (0.0, 1.0)):
                clear(); setup_scene(mode)
                ob, arm, hd = build(D, bones, k, mode)
                if mode == 'uv': uv_material(ob)
                else: plain_material(ob, mode)
                plain_material(hd, 'plain', (0.8, 0.7, 0.6))
                pose(arm, P)
                if pn == 'sit':
                    views = [(0, 0.75, 1.7), (90, 0.75, 1.7), (35, 0.75, 1.7), (215, 0.75, 1.7)]
                elif pn == 'close':
                    views = [(0, 1.2, 0.85), (90, 1.2, 0.85), (35, 1.2, 0.85), (200, 1.2, 0.85)]
                elif pn == 'cheer':
                    views = [(0, 1.05, 2.25), (90, 1.05, 2.25), (35, 1.05, 2.25), (215, 1.05, 2.25)]
                else:
                    views = [(0, 0.88, 1.95), (90, 0.88, 1.95), (35, 0.88, 1.95), (200, 0.88, 1.95)]
                rows.append(render_views(views, None))
            path = os.path.join(OUT, '%s_%s.png' % (var, pn))
            save_grid(rows, path); print('wrote', path)

main()
