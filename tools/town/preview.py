#!/usr/bin/env python3
"""A flat picture of the compiled map for editing the blueprint:  python3 tools/town/preview.py out.png [scale=0.25]
Path/plaza material, building boxes, trees (dots), furniture, spots. Reads the json named by src/lib/town/assets.generated.ts."""
import json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
url = re.search(r'"(/town/v1/town\.[0-9a-f]+\.json)"', (ROOT / "src/lib/town/assets.generated.ts").read_text()).group(1)
d = json.loads((ROOT / "public" / url.lstrip("/")).read_text())
out = sys.argv[1] if len(sys.argv) > 1 else "town-preview.png"
S = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
W, H = d["cols"] * 32, d["rows"] * 32
img = Image.new("RGB", (int(W * S), int(H * S)), (176, 200, 108))
px = img.load()
mc, mr = d["mat"]["cols"], d["mat"]["rows"]
flat = []
for i in range(0, len(d["mat"]["rle"]), 2):
    flat.extend([d["mat"]["rle"][i]] * d["mat"]["rle"][i + 1])
cs = 8 * S
dr = ImageDraw.Draw(img)
for y in range(mr):
    for x in range(mc):
        v = flat[y * mc + x]
        if v:
            dr.rectangle([x * cs, y * cs, (x + 1) * cs, (y + 1) * cs], fill=(228, 200, 140) if v == 1 else (240, 228, 196))
objs = list(d["objects"])
sc = d["scatter"]
for i in range(0, len(sc["v"]), 4):
    n = sc["names"][sc["v"][i]]; sp = d["sprites"][n]; x, y = sc["v"][i + 1], sc["v"][i + 2]
    f = sp["foot"]; sx, sy = x - sp["anchorX"], y - 1 - sp["anchorY"]
    objs.append({"kind": "tree" if n.startswith("tree_") else "bush", "x": x, "y": y, "zone": ["wood", "treeline", "hedge", "dress"][sc["v"][i + 3]], "block": {"x": sx + f["x"], "y": sy + f["y"], "w": f["w"], "h": f["h"]}})
for o in objs:
    b = o["block"]; r = [b["x"] * S, b["y"] * S, (b["x"] + b["w"]) * S, (b["y"] + b["h"]) * S]
    k = o["kind"]
    if o.get("zone") == "treeline":
        continue
    if o.get("zone") == "hedge":
        dr.rectangle([r[0], r[1] - 1, r[2], r[3] + 1], fill=(40, 90, 40)); continue
    if o.get("zone") == "dress":
        dr.rectangle([r[0], r[1], r[2] + 1, r[3] + 1], fill=(40, 40, 160)); continue
    if k == "building":
        sp = d["sprites"][o["sprite"]]
        dr.rectangle([o["sx"] * S, o["sy"] * S, (o["sx"] + sp["w"]) * S, (o["sy"] + sp["h"]) * S], outline=(120, 40, 40))
        dr.rectangle(r, fill=(150, 70, 60))
    elif k == "placeholder":
        dr.rectangle(r, fill=(154, 134, 196), outline=(60, 40, 100)); dr.text((r[0] + 2, r[1] + 2), o["ph"]["label"], fill=(255, 255, 255))
    elif k == "tree":
        c = (o["x"] * S, (o["y"] - 20) * S); dr.ellipse([c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4], fill=(200, 130, 30))
    elif k in ("bush", "log"):
        dr.ellipse([r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1], fill=(120, 140, 40))
    elif k == "furniture":
        dr.rectangle(r, fill=(120, 70, 30))
    else:
        dr.rectangle(r, fill=(60, 60, 60))
for s in d["spots"]:
    dr.ellipse([s["at"]["x"] * S - 1.5, s["at"]["y"] * S - 1.5, s["at"]["x"] * S + 1.5, s["at"]["y"] * S + 1.5], fill=(255, 0, 80))
dr.rectangle([d["bounds"]["x"] * S, d["bounds"]["y"] * S, (d["bounds"]["x"] + d["bounds"]["w"]) * S, (d["bounds"]["y"] + d["bounds"]["h"]) * S], outline=(255, 255, 255))
for h in d["hubs"]:
    dr.ellipse([h["x"] * S - 4, h["y"] * S - 4, h["x"] * S + 4, h["y"] * S + 4], outline=(0, 0, 255)); dr.text((h["x"] * S + 6, h["y"] * S), h["label"], fill=(0, 0, 160))
img.save(out)
print(out, img.size)
