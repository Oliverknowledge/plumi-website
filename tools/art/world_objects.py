#!/usr/bin/env python3
"""
Cuts the ChatGPT town sheets of trees, bushes and logs (docs/study/art/source/trees-sheet-01.png, 6 x 4 objects on magenta) and the
cafe (docs/study/art/source/cafe-01.png, one building on magenta) into game-ready sprites with anchors, footprints and occlusion rects.

    python3 tools/art/world_objects.py        # writes docs/study/art/town/{town-nature*.png,json, town-cafe*.png,json, *-contact*.png}

One run writes three densities, because the world scale is still open (see docs/study/art/town/README.md):
    5.0   source px per art px: the scale the props looked right at          -> town-nature.png / town-cafe.png
    6.1   the sheet's MEASURED native pixel (trees 6.1, IQR 6.0 to 6.15)     -> town-nature-native.png / town-cafe-native.png
    8.1   the characters' scale (the fox is 24 rows at 8.1)                  -> town-nature-char.png / town-cafe-char.png

Same method as the props (tools/art/props_sheet.py, whose `one()` it calls): magenta test, connected components (exactly 24; exactly 1),
ONE palette for the sheet, a grid phase per sprite chosen for the fewest half covered cells, a cell is solid when 40% of it is, a vote of
the palette indices inside it, and the 1 px outline drawn as the silhouette's edge ring in the darkest colour.

THE ANCHOR is the bottom centre of the base (`anchorX` the middle of the lowest rows' span, `anchorY` the last row), in art px from the
sprite's top left: put that point on the ground spot the object stands on, and sort the sprite by the y of that point.

TREES, `canopyRect` and `trunkRect`. Wood is told from foliage by colour (the wood browns are hue 8 to 24 degrees, saturation 0.4 to 0.66,
value up to 0.75; every foliage colour on the sheet is more saturated or lighter, the red tree's dark outline excepted and kept as
outline). `trunkRect` is the box of the wood pixels connected to the base; `canopyRect` the box of the rest. A character whose feet are BEHIND the anchor (y above
it) is hidden by the whole sprite where it is opaque; the canopy rect is what the engine may fade to see through (a character walking
behind a tree), and what does not block walking (only `footprint` does). `footprint` is the trunk's base: the width of the wood on the
sprite's lowest rows by a depth of a third of that width (2 rows at least), a GUESS the engine may tighten.

THE CAFE. `door` is the green door panel, found by colour inside the region where it was seen on the source (the door is a flat panel on
the front wall: the building is drawn almost front on, with the roof from above); `doorStep` the cream slab under it; `entry` the ground
point just below the step (`entryTile` is its tile, relative to the tile of the anchor, tiles of `tile` art px); `footprint` is the wall base
(the whole width, the lowest rows) and `roofRect` the roof's box above the main eaves (everything in it is drawn over characters; the
left bay's roof comes down to its own eaves lower and is inside the sprite but not in the rect).
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animal_sheet as A  # noqa: E402
import props_sheet as P  # noqa: E402

ROOT = A.ROOT
OUT = ROOT / "docs/study/art/town"
TREES = ROOT / "docs/study/art/source/trees-sheet-01.png"
CAFE = ROOT / "docs/study/art/source/cafe-01.png"
SCALES = ((5.0, ""), (6.1, "-native"), (8.1, "-char"))
TILE_FOR = {5.0: 32, 6.1: 32, 8.1: 16}       # the ground tile (art px) that goes with that density: town-ground-32.png at 1 native px per art px, town-ground.png at 16
NAMES = (
    ["tree_l_gold_round", "tree_l_orange_wide", "tree_l_amber_tall", "tree_l_red", "tree_l_gold_twin", "tree_l_mixed"]
    + ["tree_m_gold_round", "tree_m_orange_wide", "tree_m_amber_tall", "tree_m_red", "tree_m_gold_twin", "tree_m_mixed"]
    + ["bush_gold_round", "bush_orange_round", "bush_red_long", "bush_gold_hedge", "bush_orange_twin", "bush_mixed"]
    + ["stump_small", "stump_big", "log", "branch_fallen", "branch_forked", "log_hollow"]
)
TREE_NAMES = [n for n in NAMES if n.startswith("tree_")]


def hsv(c) -> tuple[float, float, float]:
    h, s, v = colorsys.rgb_to_hsv(*(np.asarray(c) / 255.0))
    return h * 360, s, v


def is_wood(c) -> bool:
    h, s, v = hsv(c)
    return 8 <= h <= 24 and 0.4 <= s <= 0.66 and v <= 0.75


def bbox(mask: np.ndarray):
    ys, xs = np.where(mask)
    if not len(ys):
        return None
    return {"x": int(xs.min()), "y": int(ys.min()), "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1)}


def pack(items, width=512):
    items = sorted(items, key=lambda t: -t[1].shape[0])
    x = y = shelf = 0
    place = {}
    for name, a in items:
        h, w = a.shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + 2, 0
        place[name] = (x, y)
        x += w + 2
        shelf = max(shelf, h)
    return place, y + shelf


def to_png(a: np.ndarray, path: Path, pal: np.ndarray) -> None:
    """RGBA with binary alpha -> an indexed PNG with one transparent entry (lossless: every colour is a palette colour already)."""
    rgb = a[..., :3].reshape(-1, 3)
    cols = {tuple(c): i + 1 for i, c in enumerate(map(tuple, pal))}
    idx = np.zeros(len(rgb), np.uint8)
    for i, c in enumerate(map(tuple, rgb)):
        idx[i] = cols.get(c, 0) if a[..., 3].reshape(-1)[i] else 0
    im = Image.fromarray(idx.reshape(a.shape[:2]), "P")
    im.putpalette([0, 0, 0] + [int(v) for c in pal for v in c])
    im.info["transparency"] = 0
    im.save(path, optimize=True, transparency=0)


def cut_sheet(path: Path, count: int, cols: int, nrows: int, colours: int, merge: int = 0):
    rgb = np.array(Image.open(path).convert("RGB"))
    fg, labels, labs, boxes = A.sprites_of(rgb, merge, A.MAG, 255, cols, nrows)
    assert len(labs) == count, len(labs)
    dep = A.depth(fg)
    pal = A.build_palette(rgb[fg & (dep >= A.PURE_DEPTH)], colours)
    lab_pal = A.srgb_to_lab(pal)
    idx, dist = A.nearest(lab_pal, A.srgb_to_lab(rgb))
    pure = fg & ((dep >= A.PURE_DEPTH) | (dist < 9)) & ~((lab_pal[:, 0][idx] < 32) & (dep <= A.OUTLINE_DEPTH))
    return rgb, fg, labels, labs, boxes, pal, idx, pure


def cut_one(labels, lab, idx, pure, pal):
    mask = labels == lab
    ys, xs = np.where(mask)
    sl = (slice(max(ys.min() - 8, 0), ys.max() + 9), slice(max(xs.min() - 8, 0), xs.max() + 9))
    return P.despeck(P.one(mask[sl], idx[sl], pure[sl], pal)), (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def anchor_of(a: np.ndarray) -> tuple[int, int, int]:
    h = a.shape[0]
    on = a[..., 3] > 0
    low = np.where(on[int(h * 0.7):])[1]
    base = np.where(on[int(h * 0.8):])[1]
    return int(round((low.min() + low.max()) / 2)), h - 1, int(base.max() - base.min() + 1)


def nature(scale: float, suffix: str) -> dict:
    P.SCALE = scale
    rgb, fg, labels, labs, boxes, pal, idx, pure = cut_sheet(TREES, 24, 6, 4, 28)
    props, meta = [], []
    for name, lab in zip(NAMES, labs):
        art, box = cut_one(labels, lab, idx, pure, pal)
        props.append((name, art))
    place, hh = pack(props)
    atlas = np.zeros((hh, 512, 4), np.uint8)
    for (name, a), lab, box in zip(props, labs, boxes):
        h, w = a.shape[:2]
        x, y = place[name]
        atlas[y:y + h, x:x + w] = a
        ax, ay, bw = anchor_of(a)
        wood = np.zeros((h, w), bool)
        for j in range(h):
            for i in range(w):
                if a[j, i, 3] and is_wood(a[j, i, :3]):
                    wood[j, i] = True
        on = a[..., 3] > 0
        rec = {"name": name, "x": x, "y": y, "w": w, "h": h, "anchorX": ax, "anchorY": ay, "sourceBox": list(box)}
        depth = max(2, round(bw / 3))
        rec["footprint"] = {"x": ax - bw // 2, "y": h - depth, "w": bw, "h": depth}
        rec["footprintTiles"] = [max(1, round(bw / TILE_FOR[scale])), 1]
        if name.startswith("tree_"):
            # the trunk: the wood pixels 4-connected to the wood on the lowest row (the canopy's brown shadows are not connected to it)
            lower = np.zeros_like(wood)
            stack = [(h - 1 - dj, i) for dj in range(3) for i in range(w) if wood[h - 1 - dj, i]]
            while stack:
                j, i = stack.pop()
                if lower[j, i] or not wood[j, i]:
                    continue
                lower[j, i] = True
                for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    jj, ii = j + dj, i + di
                    if 0 <= jj < h and 0 <= ii < w and wood[jj, ii] and not lower[jj, ii]:
                        stack.append((jj, ii))
            trunk = bbox(lower)
            canopy = bbox(on & ~lower)
            rec["trunkRect"] = trunk
            rec["canopyRect"] = canopy
            rec["trunkTopY"] = trunk["y"]
            # the base is the trunk's own foot, not the shadow ring of the canopy
            tb = lower[trunk["y"] + trunk["h"] - 3 : trunk["y"] + trunk["h"]]
            cols_ = np.where(tb.any(0))[0]
            bw2 = int(cols_.max() - cols_.min() + 1)
            axx = int(round((cols_.max() + cols_.min()) / 2))
            rec["anchorX"] = axx
            depth = max(2, round(bw2 / 3))
            rec["footprint"] = {"x": int(cols_.min()), "y": h - depth, "w": bw2, "h": depth}
            rec["footprintTiles"] = [max(1, round(bw2 / TILE_FOR[scale])), 1]
        else:
            rec["canopyRect"] = None
        rec["sortY"] = rec["anchorY"]
        meta.append(rec)
    base = f"town-nature{suffix}"
    to_png(atlas, OUT / f"{base}.png", pal)
    doc = {"image": f"{base}.png", "size": [atlas.shape[1], atlas.shape[0]], "scale": scale, "tile": TILE_FOR[scale],
           "palette": ["#%02x%02x%02x" % tuple(c) for c in pal], "source": "docs/study/art/source/trees-sheet-01.png",
           "tool": "tools/art/world_objects.py", "objects": meta}
    (OUT / f"{base}.json").write_text(json.dumps(doc, indent=1) + "\n")
    contact(props, meta, scale, OUT / f"nature-contact{suffix}.png")
    return {"props": dict(props), "meta": meta, "pal": pal}


def contact(props, meta, scale, path: Path) -> None:
    z = 3 if scale > 7 else 2
    cw, ch = 6, 4
    cell_w = max(a.shape[1] for _, a in props) * z + 16
    row_h = [max(a.shape[0] for n, a in props[r * 6:(r + 1) * 6]) * z + 24 for r in range(4)]
    img = Image.new("RGB", (cw * cell_w, sum(row_h)), (150, 190, 100))
    d = ImageDraw.Draw(img)
    y0 = 0
    for r in range(4):
        for c in range(6):
            n = r * 6 + c
            name, a = props[n]
            m = meta[n]
            im = Image.fromarray(a, "RGBA").resize((a.shape[1] * z, a.shape[0] * z), Image.NEAREST)
            ox, oy = c * cell_w + (cell_w - im.width) // 2, y0 + row_h[r] - 16 - im.height
            img.paste(im, (ox, oy), im)
            ax, ay = ox + m["anchorX"] * z + z // 2, oy + m["anchorY"] * z + z
            d.rectangle([ax - 3, ay - 2, ax + 3, ay + 2], fill=(255, 0, 80))
            f = m["footprint"]
            d.rectangle([ox + f["x"] * z, oy + f["y"] * z, ox + (f["x"] + f["w"]) * z, oy + (f["y"] + f["h"]) * z], outline=(40, 120, 255))
            if m.get("canopyRect"):
                k = m["canopyRect"]
                d.rectangle([ox + k["x"] * z, oy + k["y"] * z, ox + (k["x"] + k["w"]) * z, oy + (k["y"] + k["h"]) * z], outline=(255, 255, 255))
            d.text((c * cell_w + 3, y0 + row_h[r] - 12), name, fill=(30, 20, 20))
        y0 += row_h[r]
    img.save(path, optimize=True)


def cafe(scale: float, suffix: str) -> dict:
    P.SCALE = scale
    rgb, fg, labels, labs, boxes, pal, idx, pure = cut_sheet(CAFE, 1, 1, 1, 40, merge=3)
    art, box = cut_one(labels, labs[0], idx, pure, pal)
    h, w = art.shape[:2]
    on = art[..., 3] > 0
    # source -> art: the sprite is cut at `scale` source px per art px from its box; the grid phase moves it by under one art px
    sx0, sy0, sx1, sy1 = box
    fx, fy = (w * scale) / (sx1 - sx0), (h * scale) / (sy1 - sy0)

    def to_art(x, y):
        return (x - sx0) / scale, (y - sy0 + (sy1 - sy0 - h * scale)) / scale   # the grid is cut from the bottom edge up

    # the door: green panel found on the ART, in the region the source puts it (x 1140 to 1260, y 790 to 945)
    def is_green(c):
        r, g, b = (int(v) for v in c)
        return g > r + 15 and g > b + 20 and r < 135

    ax0, ay0 = to_art(1140, 790)
    ax1, ay1 = to_art(1260, 945)
    ax0, ay0, ax1, ay1 = int(ax0) - 2, int(ay0) - 2, int(ax1) + 2, int(ay1) + 2
    green = np.zeros((h, w), bool)
    for j in range(max(ay0, 0), min(ay1, h)):
        for i in range(max(ax0, 0), min(ax1, w)):
            if on[j, i] and is_green(art[j, i, :3]):
                green[j, i] = True
    door = bbox(green)
    # the step: the cream slab right under the door, found as the lowest rows of the sprite in the door's columns
    step_rows = np.where(on[:, door["x"]: door["x"] + door["w"]].any(1))[0]
    door_bottom = door["y"] + door["h"] - 1
    cx = door["x"] + door["w"] / 2
    base_rows = np.where(on.any(1))[0]
    # wall base: the cream wall stops at the row where the main building meets the ground (left of the door); the lowest row is the bay's corner stone
    ax, ay, bw = anchor_of(art)
    tile = TILE_FOR[scale]
    # roof: rows (centre third) where orange roof dominates
    third = slice(w // 3, (w * 7) // 10)
    def is_roof(c):
        hh, ss, vv = hsv(c)
        return 12 <= hh <= 34 and ss >= 0.7 and vv >= 0.65
    roof_frac = np.array([np.mean([is_roof(art[j, i, :3]) for i in range(third.start, third.stop) if on[j, i]] or [0]) for j in range(h)])
    roof_rows = np.where(roof_frac > 0.5)[0]
    roof_bottom = int(roof_rows.max()) + 1
    rec = {"name": "cafe", "x": 0, "y": 0, "w": w, "h": h, "anchorX": w // 2, "anchorY": h - 1, "sourceBox": list(box),
           "door": door, "doorCentreX": round(cx, 1), "doorBottomY": door_bottom,
           "entry": {"x": round(cx), "y": h},                                   # the ground point just below the sprite's bottom edge, in the door's column
           "entryOffsetFromAnchor": [round(cx) - w // 2, 1],
           "entryTileOffset": [int(np.floor((round(cx) - w // 2) / tile)), 0],
           "footprint": {"x": 0, "y": h - 12 if scale < 7 else h - 8, "w": w, "h": 12 if scale < 7 else 8},
           "roofRect": {"x": 0, "y": int(np.where(on.any(1))[0].min()), "w": w, "h": roof_bottom - int(np.where(on.any(1))[0].min())},
           "textOnSprite": "CAFE (kept: the sign is part of the drawing)"}
    base = f"town-cafe{suffix}"
    to_png(art, OUT / f"{base}.png", pal)
    doc = {"image": f"{base}.png", "size": [w, h], "scale": scale, "tile": tile, "palette": ["#%02x%02x%02x" % tuple(c) for c in pal],
           "source": "docs/study/art/source/cafe-01.png", "tool": "tools/art/world_objects.py", "building": rec}
    (OUT / f"{base}.json").write_text(json.dumps(doc, indent=1) + "\n")
    # contact: sprite on grass with the rects
    z = 3 if scale > 7 else 2 if scale > 5.5 else 2
    img = Image.new("RGB", (w * z + 40, h * z + 60), (150, 190, 100))
    im = Image.fromarray(art, "RGBA").resize((w * z, h * z), Image.NEAREST)
    img.paste(im, (20, 20), im)
    d = ImageDraw.Draw(img)
    f = rec["footprint"]
    d.rectangle([20 + f["x"] * z, 20 + f["y"] * z, 20 + (f["x"] + f["w"]) * z, 20 + (f["y"] + f["h"]) * z], outline=(40, 120, 255), width=2)
    k = rec["roofRect"]
    d.rectangle([20 + k["x"] * z, 20 + k["y"] * z, 20 + (k["x"] + k["w"]) * z, 20 + (k["y"] + k["h"]) * z], outline=(255, 255, 255), width=2)
    dr = rec["door"]
    d.rectangle([20 + dr["x"] * z, 20 + dr["y"] * z, 20 + (dr["x"] + dr["w"]) * z, 20 + (dr["y"] + dr["h"]) * z], outline=(255, 0, 80), width=2)
    ex, ey = 20 + rec["entry"]["x"] * z, 20 + rec["entry"]["y"] * z
    d.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=(255, 0, 80))
    d.text((24, h * z + 30), f"cafe at {scale} px/art px: {w} x {h} art px; door {dr['w']} x {dr['h']}; blue = footprint, white = roofRect, red = door and entry", fill=(30, 20, 20))
    img.save(OUT / f"cafe-contact{suffix}.png", optimize=True)
    return {"art": art, "rec": rec, "pal": pal}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for scale, suffix in SCALES:
        n = nature(scale, suffix)
        c = cafe(scale, suffix)
        trees = [m for m in n["meta"] if m["name"].startswith("tree_l")]
        print(f"scale {scale}: large trees h {[m['h'] for m in trees]}, medium {[m['h'] for m in n['meta'] if m['name'].startswith('tree_m')]}, "
              f"bushes {[m['h'] for m in n['meta'] if m['name'].startswith('bush')]}; cafe {c['rec']['w']} x {c['rec']['h']}, door {c['rec']['door']}, roofRect {c['rec']['roofRect']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
