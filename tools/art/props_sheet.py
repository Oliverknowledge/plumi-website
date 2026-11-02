#!/usr/bin/env python3
"""
Turns the ChatGPT town props sheet (docs/study/art/source/town-props-sheet.png, 1536 x 1024, magenta background, 6 x 4 objects) into
game-ready props: one tightly cropped PNG each, an anchor, and one packed atlas with its json.

    python3 tools/art/props_sheet.py [--fine]   # writes docs/study/art/town/{town-atlas.png,town-atlas.json,props/*.png,town-contact.png}

Same method as the animals (tools/art/animal_sheet.py, whose key, segmentation and palette code this reuses): the magenta test, the
connected components (exactly 24), ONE palette (24 colours) for the whole sheet, and a downsample at the SAME scale as the characters
(SCALE source pixels per art pixel, 8.1: the fox's), so a prop and a person share one pixel size. Each prop's grid is shifted so the
most cells are cleanly in or out (fewest half covered cells), and the 1 px outline is the silhouette's edge ring in the darkest colour.

THE ANCHOR is the bottom centre of the base: `anchorX` is the middle of the lowest rows' span and `anchorY` the last row, in art pixels
from the prop's top left: put that point on the ground spot the prop stands on. `footprintTiles` is a GUESS ([columns, rows] of the
room's 16 art pixel tile, `LIBRARY_TILE` 32 points = 16 art pixels, that the base covers): the engine decides what it blocks.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animal_sheet as A  # noqa: E402

ROOT = A.ROOT
SRC = ROOT / "docs/study/art/source/town-props-sheet.png"
OUT = ROOT / "docs/study/art/town"
SCALE = 8.1                 # the characters' scale (`--fine` is 5.0, about the sheet's own apparent pixel: more detail, a finer pixel than the room's)
SUFFIX = ""
COVER = 0.4                 # thinner than the characters' 0.5: the string lights' wire is a pixel wide
TILE = 16                   # art pixels in one tile of the room (at SCALE 8.1; the fine variant counts the same screen size, so TILE is scaled by 8.1 / SCALE)
COLOURS = 24
NAMES = [
    "lamp-post-small", "lamp-post-ornate", "lamp-post-double", "fence-straight", "fence-post", "fence-corner",
    "fence-end", "gate", "signpost-single", "signpost-double", "noticeboard", "mailbox",
    "well", "bin", "planter-flowers", "planter-pumpkins", "bike-rack", "cart-apples",
    "barrel", "crates", "string-lights", "flag", "stone-wall", "stone-arch",
]


def order(boxes):
    cy = np.array([(b[1] + b[3]) / 2 for b in boxes])
    cx = np.array([(b[0] + b[2]) / 2 for b in boxes])
    idx = list(np.argsort(cy))
    rows = [idx[i * 6:(i + 1) * 6] for i in range(4)]
    for r in rows:
        if max(cy[r]) - min(cy[r]) > 160:
            raise SystemExit("the props do not fall in 4 rows of 6")
    return [int(i) for r in rows for i in sorted(r, key=lambda j: cx[j])]


def grid(mask: np.ndarray, phase: tuple[float, float]):
    """Cells of SCALE source pixels from the mask's bottom edge up and from `phase` across; returns (cover array, x0, y0)."""
    ys, xs = np.where(mask)
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    nh = int(np.ceil((bottom - top) / SCALE + phase[1]))
    nw = int(np.ceil((right - left) / SCALE + phase[0]))
    y0 = bottom - nh * SCALE + 0.0
    x0 = left - phase[0] * SCALE
    cover = np.zeros((nh, nw))
    ye = [int(round(y0 + j * SCALE)) for j in range(nh + 1)]
    xe = [int(round(x0 + i * SCALE)) for i in range(nw + 1)]
    for j in range(nh):
        for i in range(nw):
            blk = mask[max(ye[j], 0):max(ye[j + 1], 0), max(xe[i], 0):max(xe[i + 1], 0)]
            cover[j, i] = blk.mean() if blk.size else 0
    return cover, xe, ye


def one(mask: np.ndarray, idx: np.ndarray, pure: np.ndarray, pal: np.ndarray) -> np.ndarray:
    best = None
    for px in (0, .25, .5, .75):
        for py in (0, .25, .5, .75):
            cover, xe, ye = grid(mask, (px, py))
            amb = int(((cover > .2) & (cover < .7)).sum())
            if best is None or amb < best[0]:
                best = (amb, cover, xe, ye)
    _, cover, xe, ye = best
    solid = cover >= COVER
    p = np.pad(solid, 1)
    ring = solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    h, w = solid.shape
    out = np.zeros((h, w, 4), np.uint8)
    k = len(pal)
    for j in range(h):
        for i in range(w):
            if not solid[j, i]:
                continue
            if ring[j, i]:
                out[j, i] = (*pal[0], 255)
                continue
            sy, sx = slice(max(ye[j], 0), max(ye[j + 1], 0)), slice(max(xe[i], 0), max(xe[i + 1], 0))
            ids = idx[sy, sx][pure[sy, sx] & mask[sy, sx]]
            if ids.size == 0:
                ids = idx[sy, sx][mask[sy, sx]]
            c = np.bincount(ids, minlength=k) if ids.size else np.zeros(k)
            c[0] = 0                                     # the outline colour is drawn on the ring only
            out[j, i] = (*pal[int(c.argmax()) if c.sum() else 0], 255)
    ys, xs = np.where(out[..., 3] > 0)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def despeck(a: np.ndarray) -> np.ndarray:
    on = a[..., 3] > 0
    p = np.pad(on, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    a[on & (nb == 0)] = 0
    return a


def main() -> int:
    global SCALE, SUFFIX
    if "--fine" in sys.argv:
        SCALE, SUFFIX = 5.0, "-fine"
    rgb = np.array(Image.open(SRC).convert("RGB"))
    fg, labels, labs, boxes = A.sprites_of(rgb, 0, A.MAG, 255)
    assert len(NAMES) == len(labs) == 24
    dep = A.depth(fg)
    pal = A.build_palette(rgb[fg & (dep >= A.PURE_DEPTH)], COLOURS)
    idx, dist = A.nearest(A.srgb_to_lab(pal), A.srgb_to_lab(rgb))
    pure = fg & ((dep >= A.PURE_DEPTH) | (dist < 9)) & ~((A.srgb_to_lab(pal)[:, 0][idx] < 32) & (dep <= A.OUTLINE_DEPTH))
    props = []
    for name, lab in zip(NAMES, labs):
        mask = labels == lab
        ys, xs = np.where(mask)
        sl = (slice(max(ys.min() - 8, 0), ys.max() + 9), slice(max(xs.min() - 8, 0), xs.max() + 9))
        art = despeck(one(mask[sl], idx[sl], pure[sl], pal))
        props.append((name, art))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"props{SUFFIX}").mkdir(exist_ok=True)
    # pack: shelves, tallest first, 2 px apart
    items = sorted(props, key=lambda t: -t[1].shape[0])
    width = 256
    x = y = shelf = 0
    place = {}
    for name, a in items:
        h, w = a.shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + 2, 0
        place[name] = (x, y)
        x += w + 2
        shelf = max(shelf, h)
    atlas = np.zeros((y + shelf, width, 4), np.uint8)
    meta = []
    for name, a in props:
        h, w = a.shape[:2]
        px, py = place[name]
        atlas[py:py + h, px:px + w] = a
        Image.fromarray(a, "RGBA").save(OUT / f"props{SUFFIX}" / f"{name}.png", optimize=True)
        on = a[..., 3] > 0
        low = np.where(on[int(h * .7):])[1]
        ax = int(round((low.min() + low.max()) / 2))
        base = np.where(on[int(h * .8):])[1]
        bw = int(base.max() - base.min() + 1)
        meta.append({"name": name, "x": px, "y": py, "w": w, "h": h, "anchorX": ax, "anchorY": h - 1,
                     "footprintTiles": [max(1, round(bw / (TILE * 8.1 / SCALE))), 1]})
    Image.fromarray(atlas, "RGBA").save(OUT / f"town-atlas{SUFFIX}.png", optimize=True)
    (OUT / f"town-atlas{SUFFIX}.json").write_text(json.dumps({
        "image": f"town-atlas{SUFFIX}.png", "size": [atlas.shape[1], atlas.shape[0]], "scale": SCALE, "tile": TILE,
        "palette": ["#%02x%02x%02x" % tuple(c) for c in pal], "source": "docs/study/art/source/town-props-sheet.png",
        "tool": "tools/art/props_sheet.py", "props": meta}, indent=1) + "\n")
    # the contact sheet: every prop at 4x on grass, in the sheet's order, with its anchor marked and its name
    z, cw, ch = 4, 52, 62
    sheet = Image.new("RGB", (6 * cw * z // 2 * 2, 4 * (ch * z // 2 * 2)), (92, 143, 62))
    sheet = Image.new("RGB", (6 * 56 * 2 + 16, 4 * 76 * 2 + 16), (92, 143, 62))
    d = ImageDraw.Draw(sheet)
    for n, (name, a) in enumerate(props):
        r, c = divmod(n, 6)
        im = Image.fromarray(a, "RGBA")
        zoom = 2 if max(a.shape[:2]) > 48 else 3
        if SCALE < 6:
            zoom = 1 if max(a.shape[:2]) > 70 else 2
        im = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
        ox, oy = 8 + c * 112 + (112 - im.width) // 2, 8 + r * 152 + 124 - im.height
        sheet.paste(im, (ox, oy), im)
        m = meta[n]
        ax, ay = ox + m["anchorX"] * zoom + zoom // 2, oy + m["anchorY"] * zoom + zoom
        d.rectangle([ax - 2, ay - 1, ax + 2, ay + 1], fill=(255, 0, 80))
        d.text((8 + c * 112 + 2, 8 + r * 152 + 134), name, fill=(255, 255, 255))
    sheet.save(OUT / f"town-contact{SUFFIX}.png", optimize=True)
    print(f"{len(props)} props, atlas {atlas.shape[1]} x {atlas.shape[0]}, scale {SCALE}")
    for m in meta:
        print(f"  {m['name']:18} {m['w']:3} x {m['h']:3}  anchor {m['anchorX']},{m['anchorY']}  footprint {m['footprintTiles']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
