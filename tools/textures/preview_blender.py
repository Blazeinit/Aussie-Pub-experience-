"""Lit Cycles preview of the generated PBR sets (needs the Blender-as-module venv).
usage: python preview_blender.py OUT_DIR name [name ...]
Renders a plane covering 2x2 tiles at a grazing camera angle under a warm point light and
writes OUT_DIR/<name>_lit.png plus OUT_DIR/preview_sheet.png.
"""
import json
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "tex"))


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 640
    sc.render.resolution_y = 420
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.045, 0.04, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = world
    return sc


def build(name, entry):
    sc = setup_scene()
    w, h = entry["size"]
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.object
    pl.scale = (2 * w, 2 * h, 1)
    for loop in pl.data.uv_layers.active.data:
        loop.uv = (loop.uv[0] * 2, loop.uv[1] * 2)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    def img(fn, noncolor):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(TEX, fn))
        if noncolor:
            n.image.colorspace_settings.name = "Non-Color"
        return n

    c = img(entry["c"], False)
    r = img(entry["r"], True)
    n = img(entry["n"], True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(c.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    pl.data.materials.append(mat)
    D = max(w, h)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 35
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (0, -1.25 * D, 0.75 * D)
    cam.rotation_euler = (np.radians(57), 0, 0)
    sc.camera = cam
    ld = bpy.data.lights.new("pt", "POINT")
    ld.color = (1.0, 0.78, 0.52)
    ld.energy = 35 * D * D
    ld.shadow_soft_size = 0.05 * D
    lo = bpy.data.objects.new("pt", ld)
    lo.location = (-0.5 * D, 0.4 * D, 0.35 * D)
    sc.collection.objects.link(lo)
    l2 = bpy.data.lights.new("fill", "AREA")
    l2.energy = 6 * D * D
    l2.size = D
    l2.color = (0.75, 0.82, 1.0)
    o2 = bpy.data.objects.new("fill", l2)
    o2.location = (0.6 * D, -1.0 * D, 1.2 * D)
    o2.rotation_euler = (np.radians(40), np.radians(20), 0)
    sc.collection.objects.link(o2)
    return sc


def main():
    out = sys.argv[1]
    names = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    man = json.load(open(os.path.join(TEX, "manifest.json")))
    names = names or list(man)
    paths = []
    for nme in names:
        sc = build(nme, man[nme])
        p = os.path.join(out, f"{nme}_lit.png")
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        paths.append((nme, p))
        print("rendered", p, flush=True)
    from PIL import Image, ImageDraw
    ims = [(n, Image.open(p).convert("RGB")) for n, p in paths]
    cols = 3
    W, H = ims[0][1].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * W, rows * (H + 20)), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(ims):
        x, y = (i % cols) * W, (i // cols) * (H + 20)
        sheet.paste(im, (x, y + 20))
        d.text((x + 6, y + 4), n, fill=(255, 255, 255))
    sheet.save(os.path.join(out, "preview_sheet.png"))


if __name__ == "__main__":
    main()
