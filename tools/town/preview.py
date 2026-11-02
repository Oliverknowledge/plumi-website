#!/usr/bin/env python3
"""A flat picture of the compiled map (no browser): python3 tools/town/preview.py [out.png] [scale]. For looking at the layout while editing the blueprint."""
import json, sys, glob
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
V = ROOT / "public/town/v1"
d = json.load(open(sorted(V.glob("town.*.json"))[-1]))
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/town-preview.png"
z = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
def img(name): return Image.open(ROOT / "public" / d["atlases"][name]["url"].lstrip("/")).convert("RGBA")
A = {k: img(k) for k in d["atlases"]}
W, H = d["cols"] * 32, d["rows"] * 32
im = Image.new("RGBA", (W, H), (120, 160, 90, 255))
g = A["ground"]
for i, v in enumerate(d["ground"]):
    idx = v & 127; col, row = idx % d["groundCols"], idx // d["groundCols"]
    t = g.crop((col * 32, row * 32, col * 32 + 32, row * 32 + 32))
    if v & 512: t = t.transpose(Image.TRANSPOSE)
    if v & 128: t = t.transpose(Image.FLIP_LEFT_RIGHT)
    if v & 256: t = t.transpose(Image.FLIP_TOP_BOTTOM)
    im.paste(t, ((i % d["cols"]) * 32, (i // d["cols"]) * 32))
dr = ImageDraw.Draw(im)
for o in sorted(d["objects"], key=lambda o: o["sortY"]):
    if o["sprite"]:
        s = d["sprites"][o["sprite"]]
        t = A[s["atlas"]].crop((s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]))
        im.alpha_composite(t, (o["sx"], o["sy"])) if o["sx"] >= 0 and o["sy"] >= 0 else im.paste(t, (o["sx"], o["sy"]), t)
    elif o.get("ph"):
        p = o["ph"]
        dr.rectangle([p["x"], p["y"], p["x"] + p["w"], p["y"] + p["h"]], fill=p["color"], outline=(60, 30, 10))
        dr.text((p["x"] + 2, p["y"] + 2), p["label"][:6], fill=(30, 10, 0))
if "--debug" in sys.argv:
    for o in d["objects"]:
        b = o["block"]; dr.rectangle([b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]], outline=(60, 120, 255))
    for s in d["spots"]:
        dr.ellipse([s["at"]["x"] - 3, s["at"]["y"] - 3, s["at"]["x"] + 3, s["at"]["y"] + 3], fill=(255, 0, 80))
        dr.line([s["at"]["x"], s["at"]["y"], s["stand"]["x"], s["stand"]["y"]], fill=(255, 255, 0))
    for o in d["objects"]:
        if o.get("door"):
            t = o["door"]["trigger"]; dr.rectangle([t["x"], t["y"], t["x"] + t["w"], t["y"] + t["h"]], outline=(255, 0, 255))
    dr.ellipse([d["spawn"]["x"] - 4, d["spawn"]["y"] - 4, d["spawn"]["x"] + 4, d["spawn"]["y"] + 4], fill=(0, 255, 255))
if z != 1.0: im = im.resize((int(W * z), int(H * z)), Image.NEAREST)
im.convert("RGB").save(out)
print(out, im.size)
