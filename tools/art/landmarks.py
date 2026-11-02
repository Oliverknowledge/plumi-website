#!/usr/bin/env python3
"""
Cuts the founder's three landmark buildings (ChatGPT, magenta backgrounds, 2 November) into game-ready sprites, the way
tools/art/cottages.py cuts the houses (it calls world_objects.py's `cut_sheet` / `cut_one`: magenta test, connected components, ONE palette
a sheet, a grid phase per sprite, the 1 px outline drawn):

    docs/study/art/source/grand-library-01.webp   THE GRAND LIBRARY (brick and slate, clock tower, arched double door, banners)
    docs/study/art/source/bookshop-01.webp        THE BOOKSHOP (slate roof, brick bay window, open-book sign, double door at the right)
    docs/study/art/source/bakery-01.webp          THE BAKERY (terracotta roof, striped awning, bread sign, door at the left, chimney)

    python3 tools/art/landmarks.py       # writes docs/study/art/town/town-landmarks.png + .json and landmarks-contact.png

NATIVE PIXEL (colour run lengths between strong edges along rows and columns, over roofs and walls; the webp is lossy so the long runs
are noisy): library 5 source px (runs 5, 4, 6 commonest), bookshop and bakery 4 source px (runs 3, 4, 8, 12). The sheets are therefore NOT
at one pixel size, and the S2 scale (5.0) is a cut size, not the native one (the cafe is the same: native 6.5, cut at 5.0).

PER-OBJECT SCALE (`scale`, source px per art px). One S2 for everything would make the three about 260 to 270 art px wide, all as wide as
the cafe (283), and the library would not be the landmark. The rule used: the DOOR is about one person (25 rows) tall, bounded so the
library is the largest, the bookshop and bakery mid-size and below the cafe:
    library   4.2   312 x 235 art px   12.5 x 9.4 persons, arched door 26 rows
    bookshop  5.8   232 x 163          9.3 x 6.5 persons, door 27 rows
    bakery    6.6   199 x 150          8.0 x 6.0 persons, door 29 rows (the drawn door is tall for the shop; a one person door would make it 169 wide)
(the cafe: 283 x 144, 11.3 persons wide, door 25).

PER SPRITE (art px from the sprite's top left; the sprite includes the steps and planters in front of the door):
    anchorX, anchorY   the bottom centre of the FRONT WALL AT GROUND LEVEL; the steps and planters are below it in the sprite.
    footprint          the wall base: the walls' full width (not the roof overhang) by 12 rows, ending at anchorY.
    blockRect          the building's body for collision: the walls' width, from 40 rows below the sprite's top to the base (as the cafe's): nothing can stand behind it.
    roofRect           the roof down to the eaves (everything in it is drawn over a character standing behind).
    doorRect, step, entry, doorTrigger   as the cottages'.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props_sheet as P  # noqa: E402
import world_objects as W  # noqa: E402
import cottages as C  # noqa: E402

ROOT = W.ROOT
OUT = W.OUT
SRC = ROOT / "docs/study/art/source"

# name, file, scale, door box (source abs px x0,y0,x1,y1), step box, wall base y (source abs), wall x range, eaves y, block depth (art rows)
SPECS = (
    dict(name="grand_library", file="grand-library-01.webp", scale=4.2, native=5.0, door=(692, 782, 802, 908), step=(600, 908, 900, 992),
         base=922, wall=(112, 1388), eaves=720, depth=70, label="The Grand Library"),
    dict(name="bookshop", file="bookshop-01.webp", scale=5.8, native=4.0, door=(1088, 788, 1196, 942), step=(1086, 942, 1198, 972),
         base=972, wall=(150, 1298), eaves=706, depth=64, label="The Bookshop"),
    dict(name="bakery", file="bakery-01.webp", scale=6.6, native=4.0, door=(305, 758, 412, 937), step=(290, 937, 425, 1040),
         base=990, wall=(205, 1302), eaves=700, depth=62, label="The Bakery"),
)


def cut(spec: dict):
    P.SCALE = spec["scale"]
    scale = spec["scale"]
    rgb, fg, labels, labs, boxes, pal, idx, pure = W.cut_sheet(SRC / spec["file"], 1, 1, 1, 40, merge=3)
    art, box = W.cut_one(labels, labs[0], idx, pure, pal)
    h, w = art.shape[:2]
    on = art[..., 3] > 0
    sx0, sy0, sx1, sy1 = box

    def a(x, y):        # source abs -> art in the cut (grid cut from the bottom edge up, as cottages.py)
        return C.to_art((sx0, sy0, sx1, sy1), scale, h, x - sx0, y - sy0)

    ax0, ay0 = a(spec["door"][0], spec["door"][1])
    ax1, ay1 = a(spec["door"][2], spec["door"][3])
    door = {"x": int(round(ax0)), "y": int(round(ay0)), "w": int(round(ax1 - ax0)), "h": int(round(ay1 - ay0))}
    st0 = a(spec["step"][0], spec["step"][1])
    st1 = a(spec["step"][2], spec["step"][3])
    step = {"x": int(round(st0[0])), "y": int(round(st0[1])), "w": int(round(st1[0] - st0[0])), "h": h - int(round(st0[1]))}
    base = int(min(h - 1, round(a(0, spec["base"])[1]) - 1))
    left = int(round(a(spec["wall"][0], 0)[0]))
    right = int(round(a(spec["wall"][1], 0)[0]))
    top = int(np.where(on.any(1))[0].min())
    eaves = int(round(a(0, spec["eaves"])[1]))
    dcx = door["x"] + door["w"] / 2
    rec = {
        "name": spec["name"], "label": spec["label"], "w": w, "h": h, "scale": scale, "nativeScale": spec["native"], "sourceBox": list(box), "derived": False,
        "anchorX": (left + right) // 2, "anchorY": base, "sortY": base,
        "footprint": {"x": left, "y": base - 11, "w": right - left, "h": 12},
        "blockRect": {"x": left, "y": 40, "w": right - left, "h": base - 39},       # solid from 40 rows under the sprite's top, as the cafe: nobody gets lost behind a building
        "roofRect": {"x": 0, "y": top, "w": w, "h": eaves - top},
        "doorRect": door, "doorCentreX": round(dcx, 1), "step": step,
        "entry": {"x": int(round(dcx)), "y": h},
        "entryOffsetFromAnchor": [int(round(dcx)) - (left + right) // 2, h - base],
        "doorTrigger": {"x": int(round(dcx)) - max(10, door["w"] // 2), "y": base, "w": max(20, door["w"]), "h": h - base + 8},
        "persons": {"w": round(w / 25, 1), "h": round(h / 25, 1), "door": round(door["h"] / 25, 2)},
    }
    return rec, art, pal


def pack(sprites, width=512):
    items = sorted(sprites, key=lambda t: -t[1].shape[0])
    x = y = shelf = 0
    place = {}
    for name, a in items:
        hh, ww = a.shape[:2]
        if x + ww > width:
            x, y, shelf = 0, y + shelf + 2, 0
        place[name] = (x, y)
        x += ww + 2
        shelf = max(shelf, hh)
    return place, y + shelf


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    recs, sprites = [], []
    for spec in SPECS:
        rec, art, _ = cut(spec)
        recs.append(rec)
        sprites.append((rec["name"], art))
    place, hh = pack(sprites)
    atlas = np.zeros((hh, 512, 4), np.uint8)
    for rec, (name, a) in zip(recs, sprites):
        x, y = place[name]
        atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
        rec["x"], rec["y"] = x, y
    ncol = C.to_png_multi(atlas, OUT / "town-landmarks.png")
    doc = {"image": "town-landmarks.png", "size": [atlas.shape[1], atlas.shape[0]], "colours": ncol, "tool": "tools/art/landmarks.py", "buildings": recs}
    (OUT / "town-landmarks.json").write_text(json.dumps(doc, indent=1) + "\n")
    C.contact(recs, atlas, 0, OUT / "landmarks-contact.png")
    for r in recs:
        print(f"{r['name']}: {r['w']} x {r['h']} art px ({r['persons']['w']} x {r['persons']['h']} persons), door {r['doorRect']['w']} x {r['doorRect']['h']} "
              f"({r['persons']['door']} persons), anchor ({r['anchorX']}, {r['anchorY']}), footprint {r['footprint']}, entry {r['entry']}")
    print("colours", ncol, "atlas", atlas.shape[1], "x", atlas.shape[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
