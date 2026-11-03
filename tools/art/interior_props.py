#!/usr/bin/env python3
"""
Cuts the founder's INTERIOR PROP KIT (six ChatGPT sheets, 8 props each, magenta background, 1536 x 1024) into game-ready sprites with
per-object scale, anchors, footprints, top surfaces, seats, depth cuts, lights and animation hints, the way tools/art/cottages.py cuts
the houses (it calls world_objects.py's `cut_sheet` / `cut_one`: magenta key, connected components (exactly 8 a sheet), ONE palette a
sheet, a grid phase per sprite, the 1 px outline drawn).

    python3 tools/art/interior_props.py       # writes docs/study/art/interior/{interior-atlas,interior-atlas-unscaled}.{png,json},
                                              #   props/<id>.png, interior-contact{,-unscaled}.png

SOURCES (lossless): docs/study/art/source/interior-<sheet>.webp, copied from the founder's zip (`interior-components/sheets/*.png`; the
zip's `sprites/` are naive 384 x 512 grid cuts and are NOT used; six of them are the uncut sheets). The sheet called `cottages.png` in
the zip is the KITCHEN sheet (same eight props as the earlier chat image 44), not new houses: it is stored as `interior-kitchen`.

IDS are the founder's sprite names (zip `sprites/`), the first-pass names are kept as `alias`.

SCALE. `c` (JSON `scale`) is SOURCE px per ART px, the unit `landmarks.py` uses; `scaleVsS2 = 5.0 / c` is the factor against the unscaled
atlas (the S2 cut at 5.0). Each prop is cut straight from the source at its own `c` (a palette vote per cell, as every other atlas here), not
resampled from the 5.0 cut. `c` is chosen from ONE reference length per prop (`ref`) so that the town's person (25 rows) fits:
chair seat 0.5 person high, counter and table tops 0.65 to 0.7, fridge 1.5, tall bookcase 1.85, sofa about 2.1 persons wide (the 3 persons
asked for would put the sofa seat at 0.78 person, higher than the table), door 1. `nativePx` is the sheet's own pixel measured per prop (edge
energy folded on a period, both axes); `pixelRatio = nativePx / c`: 1.0 means one drawn pixel is one art pixel; under 0.75 the prop was
shrunk and loses detail (spines, crumbs); over 1.3 it was enlarged and is blocky.

GEOMETRY (all art px from the sprite's top left, in the sprite's own scale):
    anchorX, anchorY   bottom centre of the base on the floor (lowest three rows). Sort by the y of the anchor.
    footprint          the floor area it blocks: the base span by `depth` rows, ending at anchorY. The pictures are front elevations (the
                       tables a 3/4 view from above), so depth is not drawn; it is set in persons (`depthPx`, scaled atlas px).
    flat               rugs and mats: drawn under everything, no footprint.
    wall, mountHeight  wall mounted: no footprint; `mountHeight` = art px from the floor to the sprite's bottom edge.
    topRect, topY      where small things may stand on top: the band of rows the item's anchor may take (a counter's top is 3 to 5 rows
                       in elevation, a table's whole top plane in 3/4); topY = height of the surface above the floor in art px.
    seats              {at:{x,y}, face, pose, depth, stand} per seat; `at` = x of the seated frame's anchor column (17 of 34) and the row its
                       lowest opaque row rests on (the cushion's top surface), `face` the way the sitter looks.
    frontCut / backCut sprite rows drawn OVER a seated character: rows >= frontCut (the seat front covers the lap), rows < backCut (a chair
                       seen from behind: the backrest is between camera and sitter). null: none.
    animated, light    overlay hints only; no art is invented.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animal_sheet as A  # noqa: E402
import props_sheet as P  # noqa: E402
import world_objects as W  # noqa: E402

ROOT = W.ROOT
SRC = ROOT / "docs/study/art/source"
OUT = ROOT / "docs/study/art/interior"
S2 = 5.0
PERSON = 25            # rows of a town character (the fox's idle frame)

# ---------------------------------------------------------------------------------------------------------------------------------------
# THE KIT. Per sheet, in reading order (row major, 4 x 2). Fields:
#   id, alias, kind, view ('front' elevation | '3q' seen from above)
#   c       source px per art px chosen  |  ref: what c was set from  |  note
#   depth   floor depth in persons x 25 (art px)  |  span: 'base' (lowest rows) or 'full'
#   top     (x0, y0, x1, y1) fractions of the sprite: the surface things stand on
#   seat    {x: fraction of width, y: seat top as fraction of height, face, ...}
#   cut     (frontCut fraction | None, backCut fraction | None)
# ---------------------------------------------------------------------------------------------------------------------------------------
SHEETS = [
    ("library", "bookshop-library", [
        dict(id="single-bookcase", alias="bookcase_tall", kind="bookcase", view="front", c=7.5, ref="whole height 1.87 persons", depth=7, span="full"),
        dict(id="double-bookcase", alias="bookcase_wide", kind="bookcase", view="front", c=7.5, ref="same c as the single (one drawn height): 1.87 persons", depth=8, span="full"),
        dict(id="low-bookcase", alias="bookcase_low", kind="bookcase", view="front", c=7.5, ref="same c as the other cases", depth=6, span="full", top=(0.0, 0.01, 1.0, 0.16)),
        dict(id="book-display", alias="book_rack", kind="rack", view="front", c=8.5, ref="1.2 persons high (chest high)", depth=6, span="full"),
        dict(id="circulation-counter", alias="desk_lamp", kind="counter", view="front", c=8.2, ref="counter top 0.65 persons", ref_frac=0.568, depth=9, span="full",
             top=(0.03, 0.36, 0.97, 0.47), light=[dict(x=0.17, y=0.2, r=30, colour="#ffe2a0", note="the desk lamp")]),
        dict(id="arched-window", alias="window_arched", kind="wall", view="front", c=7.5, ref="1.64 persons high, sill at 0.9", mount=22,
             light=[dict(type="window", colour="#fff3d0", r=0, note="daylight patch on the floor below")]),
        dict(id="wall-clock", alias="wall_clock", kind="wall", view="front", c=8.5, ref="1.26 persons high", mount=32,
             animated=[dict(what="pendulum", frames=2, rect=(0.38, 0.62, 0.60, 0.84), how="swing the bob one pixel left and right every 0.5 s: code-drawn overlay in the sprite's gold")]),
        dict(id="book-stack", alias="book_stack", kind="small", view="front", c=16.0, ref="on a table: 0.35 persons high; as a floor stack use c 8.0 (0.7 persons)", alt_c=8.0, depth=3, span="full"),
    ]),
    ("cafe", "cafe-bakery", [
        dict(id="espresso-machine", alias="espresso_machine", kind="tabletop", view="front", c=13.0, ref="stands on a counter: 0.8 persons high, 0.5 wide", depth=4, span="full",
             animated=[dict(what="steam", frames=3, rect=(0.88, 0.40, 0.99, 0.62), how="three frame wisp rising from the wand, drawn above the sprite in the cream of its cups")]),
        dict(id="coffee-grinder", alias="grinder", kind="tabletop", view="front", c=15.0, ref="0.75 persons high", depth=3, span="full"),
        dict(id="service-counter", alias="counter_service", kind="counter", view="front", c=8.5, ref="counter top 0.65 persons", ref_frac=0.588, depth=9, span="full",
             top=(0.02, 0.34, 0.98, 0.47)),
        dict(id="corner-counter", alias="counter_corner", kind="counter", view="front", c=8.5, ref="counter top 0.65 persons", ref_frac=0.56, depth=12, span="full",
             top=(0.03, 0.28, 0.97, 0.58)),
        dict(id="pastry-case", alias="display_case", kind="counter", view="front", c=11.0, ref="1.0 persons high, glass top at 0.9", depth=9, span="full"),
        dict(id="baguette-basket", alias="baguette_basket", kind="floorsmall", view="front", c=13.0, ref="0.9 persons high", depth=5, span="full"),
        dict(id="bread-rack", alias="bread_rack", kind="rack", view="front", c=10.5, ref="1.2 persons high", depth=6, span="full"),
        dict(id="bakery-oven", alias="brick_oven", kind="large", view="front", c=9.0, ref="1.52 persons high", depth=8, span="full",
             animated=[dict(what="fire", frames=3, rect=(0.31, 0.43, 0.58, 0.60), how="three frame flame in the mouth: orange/yellow from the sprite's palette, code drawn")],
             light=[dict(x=0.45, y=0.52, r=52, colour="#ff9a3c", flicker=True, note="the oven mouth")]),
    ]),
    ("kitchen", "cottages", [
        dict(id="sink-cabinet", alias="kitchen_sink", kind="counter", view="front", c=12.5, ref="worktop 0.65 persons (cabinet body 205 source px)", ref_frac=0.681, depth=9, span="full",
             top=(0.06, 0.22, 0.94, 0.38)),
        dict(id="prep-cabinet", alias="kitchen_worktop", kind="counter", view="front", c=12.5, ref="worktop 0.65 persons", ref_frac=0.615, depth=9, span="full",
             top=(0.05, 0.31, 0.95, 0.46)),
        dict(id="stove", alias="stove", kind="appliance", view="front", c=12.5, ref="hob 0.65 persons", ref_frac=0.71, depth=9, span="full"),
        dict(id="refrigerator", alias="fridge", kind="appliance", view="front", c=10.5, ref="fridge 1.5 persons", depth=9, span="full"),
        dict(id="chimney-hood", alias="hood_pans", kind="wall", view="front", c=12.5, ref="same c as the stove below it (hood as wide as the stove)", mount=25),
        dict(id="fireplace", alias="fireplace", kind="large", view="front", c=9.7, ref="1.28 persons high", depth=6, span="full", top=(0.12, 0.21, 0.95, 0.36),
             animated=[dict(what="fire", frames=3, rect=(0.375, 0.56, 0.60, 0.80), how="three frame flame (the sprite's oranges and yellows), code drawn; candle flames 2 frames on the mantel at (0.5..0.62, 0.0..0.1)")],
             light=[dict(x=0.5, y=0.7, r=64, colour="#ff9a3c", flicker=True, note="the hearth")]),
        dict(id="sideboard", alias="sideboard", kind="counter", view="front", c=12.5, ref="top 0.65 persons", ref_frac=0.62, depth=8, span="full", top=(0.03, 0.35, 0.97, 0.46)),
        dict(id="hanging-shelf", alias="wall_shelf_mugs", kind="wall", view="front", c=12.5, ref="same c as the kitchen run", mount=30, top=(0.04, 0.36, 0.98, 0.48)),
    ]),
    ("decor", "room-details", [
        dict(id="tall-plant", alias="plant_large", kind="plant", view="front", c=9.5, ref="1.4 persons high", depth=5, span="base"),
        dict(id="small-plant", alias="plant_small", kind="small", view="front", c=14.0, ref="on a table: 0.38 persons high (floor use c 9.0)", alt_c=9.0, depth=3, span="base"),
        dict(id="floor-lamp", alias="floor_lamp", kind="lamp", view="front", c=7.0, ref="1.7 persons high", depth=4, span="base",
             light=[dict(x=0.5, y=0.17, r=56, colour="#ffd88a", note="the shade")]),
        dict(id="wall-sconce", alias="wall_sconce", kind="wall", view="front", c=13.0, ref="0.45 persons high", mount=40,
             light=[dict(x=0.72, y=0.30, r=36, colour="#ffd88a", note="the shade")]),
        dict(id="framed-picture", alias="picture_frame", kind="wall", view="front", c=10.0, ref="0.8 persons high", mount=34),
        dict(id="cottage-window", alias="window_curtains", kind="wall", view="front", c=7.3, ref="1.2 persons high, sill at 0.85", mount=21,
             light=[dict(type="window", colour="#fff3d0", r=0, note="daylight patch on the floor below")]),
        dict(id="terracotta-rug", alias="rug_red", kind="flat", view="top", c=5.0, ref="2.0 x 1.26 persons (the native cut)"),
        dict(id="sage-mat", alias="doormat_green", kind="flat", view="top", c=9.0, ref="0.9 persons wide"),
    ]),
    ("seating", "seating", [
        dict(id="chair-down", alias="chair_front", kind="seat", view="front", c=12.0, ref="seat top 0.5 persons", ref_frac=0.58, depth=7, span="base",
             seat=dict(x=0.5, y=0.425, face="front", pose="read", depth="behind"), cut=(None, None)),
        dict(id="chair-up", alias="chair_back", kind="seat", view="front", c=12.0, ref="seat top 0.5 persons", ref_frac=0.54, depth=7, span="base",
             seat=dict(x=0.5, y=0.46, face="back", pose="stool", depth="front"), cut=(None, 1.0)),
        dict(id="chair-right", alias="chair_left", kind="seat", view="front", c=12.0, ref="seat top 0.5 persons; the sitter faces RIGHT (backrest at the left)", ref_frac=0.58, depth=7, span="base",
             seat=dict(x=0.58, y=0.425, face="right", pose="sit", depth="between"), cut=(0.425, None)),
        dict(id="chair-left", alias="chair_right", kind="seat", view="front", c=12.0, ref="seat top 0.5 persons; the sitter faces LEFT (backrest at the right)", ref_frac=0.58, depth=7, span="base",
             seat=dict(x=0.43, y=0.425, face="left", pose="sit", depth="between"), cut=(0.425, None)),
        dict(id="cafe-stool", alias="stool_round", kind="seat", view="front", c=13.0, ref="seat top 0.5 persons", ref_frac=0.93, depth=7, span="base",
             seat=dict(x=0.5, y=0.12, face="front", pose="read", depth="behind"), cut=(None, None)),
        dict(id="terracotta-sofa", alias="sofa_red", kind="seat", view="front", c=6.2, ref="2.1 persons wide, seat 0.54 (3 persons wide would put the seat at 0.78)", ref_frac=0.41, depth=10, span="full",
             seats=[dict(x=0.34, y=0.60, face="front", pose="read", depth="between"), dict(x=0.66, y=0.60, face="front", pose="read", depth="between")], cut=(0.62, None)),
        dict(id="moss-sofa", alias="sofa_green", kind="seat", view="front", c=6.2, ref="same as the red sofa", ref_frac=0.41, depth=10, span="full",
             seats=[dict(x=0.34, y=0.60, face="front", pose="read", depth="between"), dict(x=0.66, y=0.60, face="front", pose="read", depth="between")], cut=(0.62, None)),
        dict(id="reading-armchair", alias="armchair_green", kind="seat", view="front", c=6.4, ref="seat top 0.53 persons", ref_frac=0.355, depth=9, span="full",
             seat=dict(x=0.5, y=0.655, face="front", pose="read", depth="between"), cut=(0.67, None)),
    ]),
    ("tables", "tables", [
        # 3/4 view from above: the top plane is drawn deep. ref = the front edge of the top to the floor (legs), set to 0.65 persons.
        dict(id="square-table", alias="table_square", kind="table", view="3q", c=6.5, ref="top's front edge 0.65 persons above the floor", depth_from_top=True, span="full",
             top=(0.04, 0.02, 0.96, 0.63), seats_around=dict(back=1, front=1, left=1, right=1)),
        dict(id="round-table", alias="table_round", kind="table", view="3q", c=9.0, ref="diameter 1.3 persons, pedestal 0.76", depth_from_top=True, span="full",
             top=(0.08, 0.02, 0.92, 0.48), seats_around=dict(back=1, front=1, left=1, right=1)),
        dict(id="communal-table-horizontal", alias="table_wide", kind="table", view="3q", c=6.5, ref="top's front edge 0.62 persons", depth_from_top=True, span="full",
             top=(0.04, 0.02, 0.96, 0.60), seats_around=dict(back=3, front=3, left=0, right=0)),
        dict(id="communal-table-vertical", alias="table_long", kind="table", view="3q", c=6.0, ref="top's front edge 0.57 persons", depth_from_top=True, span="full",
             top=(0.03, 0.01, 0.97, 0.77), seats_around=dict(back=1, front=1, left=3, right=3)),
        dict(id="coffee-table", alias="table_low", kind="table", view="3q", c=7.5, ref="top's front edge 0.33 persons (low table)", depth_from_top=True, span="full",
             top=(0.04, 0.03, 0.96, 0.65), seats_around=dict(back=0, front=0, left=0, right=0)),
        dict(id="reading-desk", alias="desk_kneehole", kind="table", view="3q", c=8.2, ref="top's front edge 0.7 persons", depth_from_top=True, span="full",
             top=(0.03, 0.01, 0.97, 0.43), seats_around=dict(back=1, front=0, left=0, right=0)),
        dict(id="side-table", alias="table_side", kind="table", view="3q", c=9.0, ref="top's front edge 0.64 persons", depth_from_top=True, span="full",
             top=(0.04, 0.02, 0.96, 0.45), seats_around=dict(back=0, front=0, left=0, right=0)),
        dict(id="display-island", alias="console_shelf", kind="table", view="3q", c=8.5, ref="top's front edge 0.7 persons", depth_from_top=True, span="full",
             top=(0.03, 0.02, 0.97, 0.39), seats_around=dict(back=0, front=0, left=0, right=0)),
    ]),
]

# Table height above the floor targeted by the `ref` line, in persons, to report; c itself is set in SHEETS.
TILES = 32


def native_px(gray: np.ndarray, mask: np.ndarray) -> float:
    """The sheet's own pixel on this prop, in source px: edge energy of each axis folded on a period u (3.5 to 10), the strongest u wins,
    both axes averaged (edges of a drawn pixel grid fall on multiples of its size; harmonics below 3.5 are not searched)."""
    res = []
    for axis in (1, 0):
        d = np.abs(np.diff(gray, axis=axis))
        m = (mask[:, 1:] & mask[:, :-1]) if axis == 1 else (mask[1:, :] & mask[:-1, :])
        e = (d * m).sum(axis=0 if axis == 1 else 1).astype(float)
        x = np.arange(len(e))
        best = max(((abs((e * np.exp(2j * np.pi * x / u)).sum()) / max(e.sum(), 1e-9), u) for u in np.arange(3.5, 10.01, 0.05)))
        res.append(best[1])
    return float(np.mean(res))


def anchor_and_base(a: np.ndarray):
    """Bottom centre of the base (the lowest three rows' span) and that span."""
    on = a[..., 3] > 0
    rows = np.where(on.any(1))[0]
    bottom = int(rows.max())
    lo = on[max(0, bottom - 2): bottom + 1]
    cols = np.where(lo.any(0))[0]
    return int((cols.min() + cols.max()) // 2), bottom, int(cols.min()), int(cols.max() - cols.min() + 1)


def rect(x, y, w, h):
    return {"x": int(round(x)), "y": int(round(y)), "w": max(1, int(round(w))), "h": max(1, int(round(h)))}


def geometry(p: dict, art: np.ndarray, k: float) -> dict:
    """Everything derived from the cut sprite and the config fractions. `k` converts design px (the scaled atlas's art px, where the depths
    and mount heights are written) to this atlas's px: 1.0 for the scaled atlas, c / 5.0 for the unscaled one."""
    h, w = art.shape[:2]
    ax, ay, bx, bw = anchor_and_base(art)
    g: dict = {"anchorX": ax, "anchorY": ay, "sortY": ay}
    kind = p["kind"]
    if kind == "wall":
        g["wall"] = True
        g["mountHeight"] = int(round(p["mount"] * k))
        g["footprint"] = None
    elif kind == "flat":
        g["flat"] = True
        g["footprint"] = None
    else:
        top = p.get("top")
        if p.get("depth_from_top"):
            depth = max(4, int(round((top[3] - top[1]) * h * 0.85)))
        else:
            depth = max(2, int(round(p["depth"] * k)))
        fx, fw = (0, w) if p.get("span") == "full" else (bx, bw)
        if p.get("span") == "full" and kind in ("table",):
            fx, fw = int(round(w * 0.03)), int(round(w * 0.94))
        g["footprint"] = rect(fx, ay - depth + 1, fw, depth)
    top = p.get("top")
    if top:
        g["topRect"] = rect(top[0] * w, top[1] * h, (top[2] - top[0]) * w, (top[3] - top[1]) * h)
        g["topY"] = int(ay - (g["topRect"]["y"] + g["topRect"]["h"] // 2))
        g["topHeight"] = int(ay - (g["topRect"]["y"] + g["topRect"]["h"]))        # the front edge of the surface above the floor
    seats = []
    if "seat" in p or "seats" in p:
        for s in ([p["seat"]] if "seat" in p else p["seats"]):
            sx, sy = int(round(s["x"] * w)), int(round(s["y"] * h))
            seats.append({"at": {"x": sx, "y": sy}, "face": s["face"], "pose": s["pose"], "depth": s["depth"],
                          "stand": {"x": sx, "y": ay + int(round(8 * k))}, "seatHeight": ay - sy})
        g["seats"] = seats
        fc, bc = p["cut"]
        g["frontCut"] = None if fc is None else int(round(fc * h))
        g["backCut"] = None if bc is None else int(round(bc * h))
    if p.get("seats_around"):
        # seat slots: where a CHAIR's anchor goes (relative to this table's anchor), which chair sprite, and how the sitter is sorted:
        # the far side sits BEHIND the table (the chair and sitter sort before it), the near side in FRONT (the chair over the sitter, both after it),
        # the ends BESIDE it (sorted by their own feet). A character on a slot is `between` the table's back and front by the sort alone.
        fp = g["footprint"]
        fx0, fx1, dep = fp["x"] - ax, fp["x"] + fp["w"] - ax, fp["h"]
        slots = []
        for side, n in p["seats_around"].items():
            for i in range(n):
                t = (i + 0.5) / n
                if side == "back":
                    slots.append({"side": side, "face": "front", "chair": "chair-down", "dx": int(round(fx0 + t * (fx1 - fx0))), "dy": -dep - int(round(6 * k)), "sitter": "behind"})
                elif side == "front":
                    slots.append({"side": side, "face": "back", "chair": "chair-up", "dx": int(round(fx0 + t * (fx1 - fx0))), "dy": int(round(6 * k)), "sitter": "front"})
                elif side == "left":
                    slots.append({"side": side, "face": "right", "chair": "chair-right", "dx": fx0 - int(round(8 * k)), "dy": -dep + int(round(t * dep)), "sitter": "beside"})
                else:
                    slots.append({"side": side, "face": "left", "chair": "chair-left", "dx": fx1 + int(round(8 * k)), "dy": -dep + int(round(t * dep)), "sitter": "beside"})
        g["seatSlots"] = slots
    if "ref_frac" in p:
        g["refHeightPersons"] = round(p["ref_frac"] * h / PERSON, 2)       # the reference length (counter top, seat top) at this atlas's scale
    if p.get("animated"):
        g["animated"] = [{"what": a["what"], "frames": a["frames"], "rect": rect(a["rect"][0] * w, a["rect"][1] * h, (a["rect"][2] - a["rect"][0]) * w, (a["rect"][3] - a["rect"][1]) * h),
                          "how": a["how"]} for a in p["animated"]]
    if p.get("light"):
        lights = []
        for l in p["light"]:
            d = {"colour": l["colour"], "note": l.get("note", "")}
            if l.get("type") == "window":
                d["type"] = "window"
            else:
                d.update({"type": "point", "x": int(round(l["x"] * w)), "y": int(round(l["y"] * h)), "radius": int(round(l["r"] * k)), "flicker": bool(l.get("flicker"))})
            lights.append(d)
        g["light"] = lights
    return g


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


def to_png(a: np.ndarray, path: Path) -> int:
    """RGBA with binary alpha -> an indexed PNG (entry 0 transparent) when the sprites use under 256 colours, else RGBA."""
    rgb = a[..., :3].reshape(-1, 3)
    on = a[..., 3].reshape(-1) > 0
    uniq: dict = {}
    idx = np.zeros(len(rgb), np.uint16)
    for k, (cc, o) in enumerate(zip(map(tuple, rgb), on)):
        if o:
            idx[k] = uniq.setdefault(cc, len(uniq) + 1)
    if len(uniq) < 256:
        im = Image.fromarray(idx.astype(np.uint8).reshape(a.shape[:2]), "P")
        im.putpalette([0, 0, 0] + [int(v) for cc in uniq for v in cc])
        im.info["transparency"] = 0
        im.save(path, optimize=True, transparency=0)
    else:
        Image.fromarray(a, "RGBA").save(path, optimize=True)
    return len(uniq)


def cut_sheet_props(sheet: str, specs: list):
    """Cut one sheet twice (the keying and the palette are the slow part, so once): at each prop's recommended `c` and at the S2 5.0.
    Returns {id: {"scaled": art, "unscaled": art, "box": box, "native": px}}."""
    path = SRC / f"interior-{sheet}.webp"
    rgb, fg, labels, labs, boxes, pal, idx, pure = W.cut_sheet(path, 8, 4, 2, 40, merge=3)
    gray = np.array(Image.fromarray(rgb).convert("L")).astype(float)
    out = {}
    for spec, lab, box in zip(specs, labs, boxes):
        rec = {"box": box}
        for key, c in (("scaled", spec["c"]), ("unscaled", S2)):
            P.SCALE = c
            rec[key], _ = W.cut_one(labels, lab, idx, pure, pal)
        x0, y0, x1, y1 = box
        rec["native"] = native_px(gray[y0:y1, x0:x1], (labels[y0:y1, x0:x1] == lab))
        out[spec["id"]] = rec
    return out


def build_all():
    """Both atlases' sprites and records, cutting each sheet once."""
    res = {True: ([], []), False: ([], [])}
    for sheet, label, specs in SHEETS:
        cuts = cut_sheet_props(sheet, specs)
        for spec in specs:
            cut = cuts[spec["id"]]
            for scaled in (True, False):
                art = cut["scaled" if scaled else "unscaled"]
                c = spec["c"] if scaled else S2
                h, w = art.shape[:2]
                g = geometry(spec, art, 1.0 if scaled else spec["c"] / S2)
                box, nat = cut["box"], cut["native"]
                rec = {"name": spec["id"], "alias": spec["alias"], "sheet": sheet, "sheetFile": f"interior-{sheet}.webp", "kind": spec["kind"], "view": spec["view"],
                       "w": w, "h": h, "sourceBox": list(box), "sourceSize": [box[2] - box[0], box[3] - box[1]],
                       "scale": c, "recommendedScale": spec["c"], "scaleVsS2": round(S2 / spec["c"], 3), "nativePx": round(nat, 2),
                       "pixelRatio": round(nat / spec["c"], 2),
                       "sizePersons": {"w": round(w / PERSON, 2), "h": round(h / PERSON, 2)},
                       "scaleReason": spec["ref"]}
                if "alt_c" in spec:
                    rec["altScale"] = spec["alt_c"]
                rec.update(g)
                res[scaled][0].append((spec["id"], art))
                res[scaled][1].append(rec)
    return res


def write_atlas(sprites, recs, stem: str, scaled: bool):
    place, hh = pack(sprites)
    atlas = np.zeros((hh, 512, 4), np.uint8)
    for rec, (name, a) in zip(recs, sprites):
        x, y = place[name]
        atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
        rec["x"], rec["y"] = x, y
    ncol = to_png(atlas, OUT / f"{stem}.png")
    doc = {"image": f"{stem}.png", "size": [atlas.shape[1], atlas.shape[0]], "scale": "per-object" if scaled else S2, "tile": TILES, "person": PERSON,
           "colours": ncol, "units": "art px; rects from the sprite's top left; anchor = bottom centre of the base",
           "sources": {s: f"docs/study/art/source/interior-{s}.webp" for s, _, _ in SHEETS}, "tool": "tools/art/interior_props.py",
           "scaled": scaled, "objects": recs}
    (OUT / f"{stem}.json").write_text(json.dumps(doc, indent=1) + "\n")
    return atlas, ncol


def contact(recs, atlas, path: Path, z=3):
    sheets = [s for s, _, _ in SHEETS]
    cellw = max(r["w"] for r in recs) * z + 24
    rows_h = []
    for s in sheets:
        rows_h.append(max(r["h"] for r in recs if r["sheet"] == s) * z + 44)
    img = Image.new("RGB", (cellw * 8, sum(rows_h)), (96, 124, 92))
    d = ImageDraw.Draw(img)
    y0 = 0
    for si, s in enumerate(sheets):
        for ci, r in enumerate([r for r in recs if r["sheet"] == s]):
            a = atlas[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"]]
            im = Image.fromarray(a, "RGBA").resize((r["w"] * z, r["h"] * z), Image.NEAREST)
            ox = ci * cellw + (cellw - im.width) // 2
            oy = y0 + rows_h[si] - 30 - im.height
            img.paste(im, (ox, oy), im)
            f = r.get("footprint")
            if f:
                d.rectangle([ox + f["x"] * z, oy + f["y"] * z, ox + (f["x"] + f["w"]) * z, oy + (f["y"] + f["h"]) * z], outline=(60, 140, 255))
            t = r.get("topRect")
            if t:
                d.rectangle([ox + t["x"] * z, oy + t["y"] * z, ox + (t["x"] + t["w"]) * z, oy + (t["y"] + t["h"]) * z], outline=(80, 240, 120))
            for st in r.get("seats", []):
                d.ellipse([ox + st["at"]["x"] * z - 4, oy + st["at"]["y"] * z - 4, ox + st["at"]["x"] * z + 4, oy + st["at"]["y"] * z + 4], fill=(255, 235, 60))
            for key in ("frontCut", "backCut"):
                if r.get(key) is not None:
                    yy = oy + r[key] * z
                    d.line([ox - 6, yy, ox + im.width + 6, yy], fill=(255, 80, 220) if key == "frontCut" else (80, 240, 255), width=1)
            for l in r.get("light", []):
                if l["type"] == "point":
                    rr = min(l["radius"] * z, 60)
                    d.ellipse([ox + l["x"] * z - 5, oy + l["y"] * z - 5, ox + l["x"] * z + 5, oy + l["y"] * z + 5], outline=(255, 150, 40), width=2)
            for an in r.get("animated", []):
                q = an["rect"]
                d.rectangle([ox + q["x"] * z, oy + q["y"] * z, ox + (q["x"] + q["w"]) * z, oy + (q["y"] + q["h"]) * z], outline=(255, 255, 255))
            ax, ay = ox + r["anchorX"] * z + z // 2, oy + r["anchorY"] * z + z
            d.rectangle([ax - 3, ay - 2, ax + 3, ay + 2], fill=(255, 0, 80))
            d.text((ci * cellw + 4, y0 + rows_h[si] - 26), r["name"], fill=(255, 255, 255))
            d.text((ci * cellw + 4, y0 + rows_h[si] - 14), f"{r['w']}x{r['h']}  c{r['scale']:g}  px{r['pixelRatio']:g}", fill=(255, 245, 190))
        y0 += rows_h[si]
    img.save(path, optimize=True)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "props").mkdir(exist_ok=True)
    both = build_all()
    for scaled, stem, cname in ((True, "interior-atlas", "interior-contact.png"), (False, "interior-atlas-unscaled", "interior-contact-unscaled.png")):
        sprites, recs = both[scaled]
        atlas, ncol = write_atlas(sprites, recs, stem, scaled)
        contact(recs, atlas, OUT / cname)
        if scaled:
            for rec, (name, a) in zip(recs, sprites):
                Image.fromarray(a, "RGBA").save(OUT / "props" / f"{name}.png", optimize=True)
        print(f"{stem}: {len(recs)} props, atlas {atlas.shape[1]} x {atlas.shape[0]}, {ncol} colours")
        if scaled:
            print(f"{'id':28s} {'native':>6s} {'c':>5s} {'xS2':>5s} {'w':>3s} {'h':>3s} {'p_w':>5s} {'p_h':>5s} {'pxratio':>7s}")
            for r in recs:
                print(f"{r['name']:28s} {r['nativePx']:6.2f} {r['scale']:5.1f} {r['scaleVsS2']:5.2f} {r['w']:3d} {r['h']:3d} {r['sizePersons']['w']:5.2f} {r['sizePersons']['h']:5.2f} {r['pixelRatio']:7.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
