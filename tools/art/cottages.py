#!/usr/bin/env python3
"""
Cuts the founder's first houses (docs/study/art/source/cottages-a-01.png, two cottages on magenta) into game-ready sprites, the way
tools/art/world_objects.py cuts the cafe and the trees (it calls that file's `cut_sheet` / `cut_one`): magenta test, connected components
(exactly 2), ONE palette for the sheet, grid phase chosen for the fewest half covered cells, the 1 px outline drawn.

    python3 tools/art/cottages.py        # writes docs/study/art/town/town-cottages{,-door}.png + .json and cottages-contact{,-door}.png

THE NATIVE PIXEL of this sheet, measured as for the others (run lengths of colour between edges, along rows and columns, over the
walls and the roof): the commonest runs are 4, 5 and 6 source px and the long runs are 10 and 20/21 (2 x 5 and 4 x 5): about 5.0. So the
S2 cut (5.0) IS the native cut here; there is no separate -native file.

TWO DENSITIES.
    5.0   the town's S2 scale and this sheet's own pixel: the cottage is 143 x 143 art px, its door panel 29 rows (1.16 persons).
    5.8   `-door`: the scale at which the door panel is 25 rows, one person, as the cafe's: the cottage is 123 art px (4.9 persons) wide.
The town uses the 5.8 cut (`COTTAGE_SET` in tools/town/build.ts); 5.0 is kept so the choice can be reversed. Report in docs/study/town.md.

PER SPRITE (art px from the sprite's top left; the sprite includes the stone step in front of the door):
    anchorX, anchorY   the bottom centre of the FRONT WALL AT GROUND LEVEL (the lowest row of the corner posts), NOT the sprite's bottom edge:
                       the step is below it. Sort the sprite by the y of this point: a character on the step is drawn over the house.
    footprint          the wall base: the walls' full width (not the roof overhang) by 12 rows, ending at anchorY.
    blockRect          the house's ground area for collision: the walls' width, from 78 rows above the base to the base. Characters walk
                       behind the house above this line, where the roof hides all but their head, and never inside the house.
    roofRect           the roof (chimney included), down to the eaves: drawn over a character standing behind (the whole sprite is).
    doorRect, step, entry   the door panel, the stone slab, and the ground point just below the sprite in the door's column.
    doorTrigger        the ground rectangle in front of the door (the step and the row below it) where the knock prompt shows.
Variants (`derived: true`): the same sprite with the roof hue turned (moss green, plum). WALL re-tints (mustard, sage) were tried and dropped: the cream has six shades and a tint that catches some of them leaves blotches; each palette colour is mapped to one colour,
so the palette stays a palette (see `recolour`).
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props_sheet as P  # noqa: E402
import world_objects as W  # noqa: E402

ROOT = W.ROOT
OUT = W.OUT
SRC = ROOT / "docs/study/art/source/cottages-a-01.png"
NAMES = ("cottage_terracotta", "cottage_slate")
DENSITIES = ((5.0, ""), (5.8, "-door"))

# Features of each cottage on the SOURCE, in source px from the cottage's own box top left (both houses are drawn to one layout).
DOOR_PANEL = (312, 524, 406, 669)       # x0, y0, x1, y1: the wooden door
STEP = (302, 669, 418, 711)             # the stone slab in front of it
EAVES_Y = 470                            # the roof's lower edge at the sides
WALL_INSET = (56, 48)                    # the walls start this far inside the box (the roof overhangs)
BASE_COLS = (70, 120)                    # columns (from the box's left) where the left corner post stands: its lowest row is the wall base


def to_art(box, scale, h, x, y):
    """A point of the source, relative to the cottage's box, as art px in the cut (the grid is cut from the bottom edge up, as the cafe's)."""
    sx0, sy0, sx1, sy1 = box
    return x / scale, (y + (sy1 - sy0 - h * scale)) / scale


def hsv(c):
    h, s, v = colorsys.rgb_to_hsv(*(np.asarray(c, float) / 255.0))
    return h * 360, s, v


def hue_to(c, dh=0.0, ds=1.0, dv=1.0):
    h, s, v = colorsys.rgb_to_hsv(*(np.asarray(c, float) / 255.0))
    r, g, b = colorsys.hsv_to_rgb((h + dh / 360) % 1.0, min(1, s * ds), min(1, v * dv))
    return np.array([round(r * 255), round(g * 255), round(b * 255)], np.uint8)


def cut(scale: float):
    P.SCALE = scale
    rgb, fg, labels, labs, boxes, pal, idx, pure = W.cut_sheet(SRC, 2, 2, 1, 40, merge=3)
    out = []
    for name, lab in zip(NAMES, labs):
        art, box = W.cut_one(labels, lab, idx, pure, pal)
        h, w = art.shape[:2]
        on = art[..., 3] > 0
        sx0, sy0, sx1, sy1 = box
        rec: dict = {"name": name, "w": w, "h": h, "sourceBox": list(box), "derived": False}
        # the wall base: the lowest row of the corner post, on the SOURCE
        cols = slice(sx0 + BASE_COLS[0], sx0 + BASE_COLS[1])
        low = np.where(fg[:, cols].any(1))[0].max()
        _, by = to_art(box, scale, h, 0, low + 1 - sy0)
        base = int(min(h - 1, round(by) - 1))
        left = int(round((WALL_INSET[0]) / scale))
        right = int(round((sx1 - sx0 - WALL_INSET[1]) / scale))
        rec["anchorX"] = (left + right) // 2
        rec["anchorY"] = base
        rec["sortY"] = base
        rec["footprint"] = {"x": left, "y": base - 11, "w": right - left, "h": 12}
        rec["blockRect"] = {"x": left, "y": base - 78, "w": right - left, "h": 79}
        eaves = int(round(to_art(box, scale, h, 0, EAVES_Y)[1]))
        top = int(np.where(on.any(1))[0].min())
        rec["roofRect"] = {"x": 0, "y": top, "w": w, "h": eaves - top}
        x0, y0 = to_art(box, scale, h, DOOR_PANEL[0], DOOR_PANEL[1])
        x1, y1 = to_art(box, scale, h, DOOR_PANEL[2], DOOR_PANEL[3])
        rec["doorRect"] = {"x": int(round(x0)), "y": int(round(y0)), "w": int(round(x1 - x0)), "h": int(round(y1 - y0))}
        sx0_, sy0_ = to_art(box, scale, h, STEP[0], STEP[1])
        sx1_, sy1_ = to_art(box, scale, h, STEP[2], STEP[3])
        rec["step"] = {"x": int(round(sx0_)), "y": int(round(sy0_)), "w": int(round(sx1_ - sx0_)), "h": h - int(round(sy0_))}
        dcx = rec["doorRect"]["x"] + rec["doorRect"]["w"] / 2
        rec["doorCentreX"] = round(dcx, 1)
        rec["entry"] = {"x": int(round(dcx)), "y": h}
        rec["entryOffsetFromAnchor"] = [int(round(dcx)) - rec["anchorX"], h - base]
        rec["doorTrigger"] = {"x": int(round(dcx)) - 10, "y": base, "w": 20, "h": h - base + 8}
        out.append((rec, art))
    return out, pal


def recolour(art: np.ndarray, rec: dict, roof_dh: float, wall_tint, name: str, roof_sv=(1.0, 1.0)):
    """A derived variant: the ROOF hue turned by `roof_dh` degrees (saturation and value scaled by `roof_sv`), the WALLS re-tinted
    `wall_tint = (dh, ds, dv)`. The roof is found per column: from the top down to the first cream or honey pixel of the gable or the
    wall (the chimney's cream bricks, high on the sprite, are skipped), leaving off the last three rows (the timber under the eaves) and
    anything dark (the outline). Wall pixels are the cream or honey ones below the roof's top fifth and outside the windows (the panes
    are left alone). Each distinct colour maps to one colour, so the sprite keeps a palette."""
    h, w = art.shape[:2]
    out = art.copy()
    cache: dict[tuple, np.ndarray] = {}

    def cream(c):
        hh, s, v = hsv(c)
        return 36 <= hh <= 62 and 0.10 <= s <= 0.66 and v >= 0.78

    for i in range(w):
        stop = h
        for j in range(h):
            if art[j, i, 3] and cream(art[j, i, :3]) and j >= 0.35 * h:
                stop = j
                break
        for j in range(0, max(0, stop - 3)):
            if not art[j, i, 3]:
                continue
            c = tuple(int(v) for v in art[j, i, :3])
            hh, s, v = hsv(c)
            orange = (hh <= 16 and s >= 0.70 and v >= 0.50) or (16 < hh <= 30 and s >= 0.60 and v >= 0.78) or (24 <= hh <= 36 and s >= 0.35 and v >= 0.68)      # the peach highlights; not the timber (hue 14 to 23, value under 0.7)
            slate = 195 <= hh <= 250 and s >= 0.12 and v >= 0.30
            if (orange or slate) and not cream(c):
                key = ("r", c)
                if key not in cache:
                    cache[key] = hue_to(c, roof_dh, roof_sv[0], roof_sv[1])
                out[j, i, :3] = cache[key]
    if wall_tint:
        for j in range(int(0.30 * h), h):
            for i in range(w):
                if not art[j, i, 3] or in_window(rec, i, j):
                    continue
                c = tuple(int(v) for v in art[j, i, :3])
                hh, s, v = hsv(c)
                if 36 <= hh <= 62 and 0.12 <= s <= 0.62 and 0.55 <= v <= 1.0:
                    key = ("w", c)
                    if key not in cache:
                        cache[key] = hue_to(c, *wall_tint)
                    out[j, i, :3] = cache[key]
    return out


def in_window(rec: dict, i: int, j: int) -> bool:
    """The windows' glass: the panes are drawn in the warmest bright yellows; a pixel inside the boxes of the three windows is left alone."""
    for r in rec.get("windows", []):
        if r["x"] <= i < r["x"] + r["w"] and r["y"] <= j < r["y"] + r["h"]:
            return True
    return False


# (name suffix, base index, roof hue turn, wall tint, roof (saturation, value) scale, description)
VARIANTS = (
    ("moss", 0, 80, None, (0.62, 0.78), "terracotta roof turned moss green, walls as drawn"),
    ("plum", 1, 70, None, (0.7, 0.95), "slate roof turned plum, honey walls"),
)


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


def to_png_multi(a: np.ndarray, path: Path) -> int:
    """RGBA with binary alpha -> an indexed PNG (every colour of the atlas gets an entry; entry 0 is transparent)."""
    rgb = a[..., :3].reshape(-1, 3)
    on = a[..., 3].reshape(-1) > 0
    uniq = {}
    idx = np.zeros(len(rgb), np.uint8)
    for k, (c, o) in enumerate(zip(map(tuple, rgb), on)):
        if not o:
            continue
        if c not in uniq:
            uniq[c] = len(uniq) + 1
        idx[k] = uniq[c]
    assert len(uniq) < 256, len(uniq)
    im = Image.fromarray(idx.reshape(a.shape[:2]), "P")
    im.putpalette([0, 0, 0] + [int(v) for c in uniq for v in c])
    im.info["transparency"] = 0
    im.save(path, optimize=True, transparency=0)
    return len(uniq)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for scale, suffix in DENSITIES:
        base, pal = cut(scale)
        sprites = []
        recs = []
        for rec, art in base:
            sprites.append((rec["name"], art))
            recs.append(rec)
        # window boxes for the recolour guard (source px from the cottage's box: the two shuttered windows, the gable window)
        for rec in recs:
            h, box = rec["h"], rec["sourceBox"]
            wins = []
            for (x0, y0, x1, y1) in ((100, 504, 270, 646), (452, 504, 620, 646), (302, 337, 411, 441)):
                ax0, ay0 = to_art(box, scale, h, x0, y0)
                ax1, ay1 = to_art(box, scale, h, x1, y1)
                wins.append({"x": int(ax0), "y": int(ay0), "w": int(ax1 - ax0) + 1, "h": int(ay1 - ay0) + 1})
            rec["windows"] = wins
        for vname, bi, dh, tint, rsv, why in VARIANTS:
            rec0, art0 = base[bi]
            art = recolour(art0, rec0, dh, tint, vname, rsv)
            nrec = {k: v for k, v in rec0.items() if k != "windows"}
            nrec["name"] = f"{rec0['name']}_{vname}"
            nrec["derived"] = True
            nrec["derivedFrom"] = rec0["name"]
            nrec["derivedHow"] = why
            sprites.append((nrec["name"], art))
            recs.append(nrec)
        for r in recs:
            r.pop("windows", None)
        place, hh = pack(sprites)
        atlas = np.zeros((hh, 512, 4), np.uint8)
        for rec, (name, a) in zip(recs, sprites):
            x, y = place[name]
            atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
            rec["x"], rec["y"] = x, y
        ncol = to_png_multi(atlas, OUT / f"town-cottages{suffix}.png")
        doc = {"image": f"town-cottages{suffix}.png", "size": [atlas.shape[1], atlas.shape[0]], "scale": scale, "tile": 32, "colours": ncol,
               "source": "docs/study/art/source/cottages-a-01.png", "tool": "tools/art/cottages.py", "buildings": recs}
        (OUT / f"town-cottages{suffix}.json").write_text(json.dumps(doc, indent=1) + "\n")
        contact(recs, atlas, scale, OUT / f"cottages-contact{suffix}.png")
        b = recs[0]
        print(f"scale {scale}: cottage {b['w']} x {b['h']} art px ({b['w'] / 25:.1f} x {b['h'] / 25:.1f} persons), door {b['doorRect']['w']} x {b['doorRect']['h']}, "
              f"anchor ({b['anchorX']}, {b['anchorY']}), footprint {b['footprint']}, roofRect {b['roofRect']}, entry {b['entry']}, colours {ncol}")
    return 0


def contact(recs, atlas, scale, path: Path) -> None:
    z = 3
    n = len(recs)
    cw = max(r["w"] for r in recs) * z + 20
    chh = max(r["h"] for r in recs) * z + 40
    img = Image.new("RGB", (cw * 3, chh * 2 + 8), (150, 190, 100))
    d = ImageDraw.Draw(img)
    for k, r in enumerate(recs):
        a = atlas[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"]]
        im = Image.fromarray(a, "RGBA").resize((r["w"] * z, r["h"] * z), Image.NEAREST)
        ox, oy = (k % 3) * cw + 10, (k // 3) * chh + 10
        img.paste(im, (ox, oy), im)
        f = r["footprint"]
        d.rectangle([ox + f["x"] * z, oy + f["y"] * z, ox + (f["x"] + f["w"]) * z, oy + (f["y"] + f["h"]) * z], outline=(40, 120, 255), width=2)
        k_ = r["roofRect"]
        d.rectangle([ox + k_["x"] * z, oy + k_["y"] * z, ox + (k_["x"] + k_["w"]) * z, oy + (k_["y"] + k_["h"]) * z], outline=(255, 255, 255), width=1)
        dr = r["doorRect"]
        d.rectangle([ox + dr["x"] * z, oy + dr["y"] * z, ox + (dr["x"] + dr["w"]) * z, oy + (dr["y"] + dr["h"]) * z], outline=(255, 0, 80), width=2)
        ax, ay = ox + r["anchorX"] * z, oy + r["anchorY"] * z
        d.ellipse([ax - 4, ay - 4, ax + 4, ay + 4], fill=(255, 0, 80))
        ex, ey = ox + r["entry"]["x"] * z, oy + r["entry"]["y"] * z
        d.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], fill=(255, 255, 0))
        d.text((ox, oy + r["h"] * z + 6), r["name"] + (" (derived)" if r["derived"] else ""), fill=(30, 20, 20))
    img.save(path, optimize=True)


if __name__ == "__main__":
    sys.exit(main())
