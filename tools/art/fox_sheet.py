#!/usr/bin/env python3
"""
Turns the ChatGPT fox sheet (docs/study/art/source/fox-sheet-01.png) into game frames.

    python3 tools/art/fox_sheet.py            # writes public/library/characters/fox.png + fox.json and the previews
    python3 tools/art/check_fox.py            # asserts the invariants of what it wrote

THE SOURCE is not clean pixel art: 1536 x 1024, a magenta background that is not flat (a lossy source), anti-aliased
edges, sprites that drift across their nominal 256 x 256 cells, and "pixels" that are 2 to 6 source pixels, not a grid.
So nothing here trusts the cells or the grid:

  1. KEY. Background = any pixel whose green is far below both red and blue (a magenta test, not a colour match, so
     every grade of the lossy background and every blend of it with the outline is caught). The fox's own colours
     never pass it (the test is asserted on the fox's interior, below).
  2. SEGMENT. The 24 sprites are the 24 connected components (8-connectivity). Rows are directions (down, left, up,
     right, as the sheet is drawn), columns are walk frames; ordered by the component's centre. Exactly 24 or it stops.
  3. PALETTE. One palette for all 24 frames: k-means (Lab, fixed seed) over the fox's interior pixels (those 3 or more
     source pixels from the background, so no blend with magenta takes part), at most 16 colours, then snapped to
     a clean outline colour. One palette means no flicker between frames.
  4. DOWNSAMPLE. The same scale for every frame (SCALE source pixels per art pixel: never per frame). Each frame gets
     its own grid PHASE so its feet bottom lands on the frame's baseline row and its centre of mass on the frame's
     centre column (this is the drift correction: the grid follows the sprite, not the other way round). A cell is
     opaque when at least half of its source pixels are fox. The 1 px outline is then drawn, not sampled: the cell
     ring of the silhouette is the outline colour (the source outline is about half an art pixel thick, so sampling it
     would give a broken line). Interior cells take a weighted vote of the palette indices of their source pixels
     (rare colours are boosted so the eyes, nose and blush are not voted away; blends with the outline or the
     background do not vote). `--method area` is the comparison (plain averaging, then the nearest palette colour).
  5. CLEAN. Specks and one-cell holes are removed; alpha is 0 or 255 everywhere.
  6. WRITE. One strip, FRAME_W x FRAME_H per frame, 24 frames; fox.json documents order, palette and anchors.

The art is one fox in a plum sweater; the people in the room are 16 x 32 frames with the person 24 rows tall, so the
fox frame is 24 x 32 (wider, the same height) with the feet on the bottom row.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/study/art/source/fox-sheet-01.png"
OUT_DIR = ROOT / "public/library/characters"
PREVIEW_DIR = ROOT / "docs/study/art"

FRAME_W, FRAME_H = 24, 32
DIRS = ("down", "left", "up", "right")     # the sheet's rows
COLS = 6                                    # walk frames per direction
FRAMES = len(DIRS) * COLS
SCALE = 8.1                                 # source pixels per art pixel, one value for every frame
BASELINE = FRAME_H                          # the feet's bottom edge, in art rows: the last row of the frame holds the feet
MAX_COLOURS = 16
COVER = 0.5                                 # a cell is fox when at least this much of it is
MAG = 50                                    # min(r, b) - g above this is background (the fox's interior never exceeds ~30)
OUTLINE_DEPTH = 6                          # source pixels from the edge that are the drawn outline (and so are not sampled: the ring is drawn)
PURE_DEPTH = 3                              # source pixels from the background before a colour is trusted
SEED = 7
DETAIL_DARK = 2.4
DETAIL_BLUSH = 2.0

# ---------------------------------------------------------------- colour


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = (c @ m.T) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def magenta_score(rgb: np.ndarray) -> np.ndarray:
    a = rgb.astype(np.int32)
    return np.minimum(a[..., 0], a[..., 2]) - a[..., 1]


# ---------------------------------------------------------------- key and segment


def key_out(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel is background."""
    return magenta_score(rgb) > MAG


def depth(fg: np.ndarray, limit: int = 8) -> np.ndarray:
    """How many source pixels deep each fox pixel is (Chebyshev), 0 for background, capped at limit."""
    d = np.zeros(fg.shape, np.int16)
    cur = fg.copy()
    for k in range(1, limit + 1):
        p = np.pad(cur, 1, constant_values=False)
        er = cur.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                er &= p[1 + dy: p.shape[0] - 1 + dy, 1 + dx: p.shape[1] - 1 + dx]
        d[cur] = k
        cur = er
        if not cur.any():
            break
    return d


def components(fg: np.ndarray) -> tuple[np.ndarray, int]:
    """8-connected components by run-length union-find. Returns the label image (0 = none) and the count."""
    h, w = fg.shape
    parent: list[int] = [0]

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    runs_prev: list[tuple[int, int, int]] = []
    runs_all: list[tuple[int, int, int, int]] = []
    for y in range(h):
        row = fg[y]
        edges = np.diff(np.concatenate([[0], row.view(np.int8), [0]]))
        starts, ends = np.where(edges == 1)[0], np.where(edges == -1)[0]
        cur: list[tuple[int, int, int]] = []
        for s, e in zip(starts, ends):
            parent.append(len(parent))
            lab = len(parent) - 1
            cur.append((int(s), int(e), lab))
            runs_all.append((y, int(s), int(e), lab))
            for ps, pe, pl in runs_prev:
                if ps <= e and s <= pe:           # touch, diagonals included (the half-open ends are inclusive of the neighbour)
                    a, b = find(lab), find(pl)
                    if a != b:
                        parent[a] = b
        runs_prev = cur
    roots: dict[int, int] = {}
    out = np.zeros((h, w), np.int32)
    for y, s, e, lab in runs_all:
        r = find(lab)
        out[y, s:e] = roots.setdefault(r, len(roots) + 1)
    return out, len(roots)


def order_sprites(boxes: list[tuple[int, int, int, int]]) -> list[int]:
    """Indices in reading order: the rows are found by clustering centres on y, then each row by x."""
    cy = np.array([(b[1] + b[3]) / 2 for b in boxes])
    cx = np.array([(b[0] + b[2]) / 2 for b in boxes])
    idx = list(np.argsort(cy))
    rows = [idx[i * COLS:(i + 1) * COLS] for i in range(len(DIRS))]
    for r in rows:
        if max(cy[r]) - min(cy[r]) > 120:
            raise SystemExit("the sprites do not fall in 4 rows of 6")
    return [int(i) for r in rows for i in sorted(r, key=lambda j: cx[j])]


# ---------------------------------------------------------------- palette


def kmeans(samples: np.ndarray, k: int, seed: int, iters: int = 60) -> np.ndarray:
    rng = np.random.default_rng(seed)
    c = [samples[rng.integers(len(samples))]]
    for _ in range(k - 1):
        d = np.min(((samples[:, None, :] - np.array(c)[None]) ** 2).sum(2), 1)
        c.append(samples[rng.choice(len(samples), p=d / d.sum())])
    c = np.array(c)
    for _ in range(iters):
        d = ((samples[:, None, :] - c[None]) ** 2).sum(2)
        lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = samples[m].mean(0)
    return c


def build_palette(interior_rgb: np.ndarray, k: int) -> np.ndarray:
    """k colours (uint8 RGB), darkest first. The clusters are of Lab; each colour is the mean sRGB of its members."""
    rng = np.random.default_rng(SEED)
    take = rng.choice(len(interior_rgb), min(60000, len(interior_rgb)), replace=False)
    rgb = interior_rgb[take]
    lab = srgb_to_lab(rgb)
    c = kmeans(lab, k, SEED)
    near = ((lab[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
    pal = np.array([rgb[near == j].mean(0) if (near == j).any() else (0, 0, 0) for j in range(k)])
    pal = np.rint(pal).astype(np.uint8)
    order = np.argsort(srgb_to_lab(pal)[:, 0])
    return pal[order]


def detail_weights(pal: np.ndarray, lab_pal: np.ndarray) -> np.ndarray:
    """How hard each colour pulls in a cell's vote. The face's small features (eyes, nose, the cheek blush) cover well
    under half of their cell at this scale, so a plain majority erases them; the very dark browns and the blush pink
    count DETAIL_DARK and DETAIL_BLUSH times. Everything else counts once."""
    w = np.ones(len(pal))
    for i, (L, a, b) in enumerate(lab_pal):
        if L < 32:
            w[i] = DETAIL_DARK                   # eyes and nose (the outline band is not sampled, so a dark pixel left here is a feature)
        elif a > 22 and L > 65:
            w[i] = DETAIL_BLUSH                  # the cheek blush: a pink lighter than the sweater
    return w


def nearest(lab_pal: np.ndarray, lab: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    d = ((lab[..., None, :] - lab_pal) ** 2).sum(-1)
    return d.argmin(-1), np.sqrt(d.min(-1))


# ---------------------------------------------------------------- one sprite


def sprite_stats(mask: np.ndarray) -> dict:
    ys, xs = np.where(mask)
    return {"bottom": int(ys.max()) + 1, "cx": float(xs.mean()), "cy": float(ys.mean()),
            "left": int(xs.min()), "right": int(xs.max()) + 1, "top": int(ys.min())}


def cells(mask: np.ndarray, x0: float, y0: float, scale: float, w: int, h: int) -> list[list[tuple[slice, slice]]]:
    """The source rectangle of each art cell (x0, y0 is the source position of the frame's top left)."""
    xs = [int(round(x0 + i * scale)) for i in range(w + 1)]
    ys = [int(round(y0 + j * scale)) for j in range(h + 1)]
    return [[(slice(max(ys[j], 0), max(ys[j + 1], 0)), slice(max(xs[i], 0), max(xs[i + 1], 0))) for i in range(w)] for j in range(h)]


FUR: tuple[int, ...] = ()


def downsample(fg: np.ndarray, idx: np.ndarray, pure: np.ndarray, weights: np.ndarray, st: dict, method: str,
               lab_img: np.ndarray, lab_pal: np.ndarray, outline_idx: int) -> np.ndarray:
    """One frame: an (FRAME_H, FRAME_W) int array of palette indices, -1 transparent."""
    # the frame's left edge: centre of mass on the centre column, but never so far that the sprite is cut by the frame
    x0 = st["cx"] - FRAME_W / 2 * SCALE
    x0 = min(max(x0, st["right"] - FRAME_W * SCALE), st["left"])
    y0 = st["bottom"] - BASELINE * SCALE
    grid = cells(fg, x0, y0, SCALE, FRAME_W, FRAME_H)
    out = np.full((FRAME_H, FRAME_W), -1, np.int16)
    solid = np.zeros((FRAME_H, FRAME_W), bool)
    for j in range(FRAME_H):
        for i in range(FRAME_W):
            sy, sx = grid[j][i]
            n = fg[sy, sx].size
            if n and fg[sy, sx].mean() >= COVER:
                solid[j, i] = True
    # drop specks (a solid cell with no solid 4-neighbour) and fill one-cell holes
    p = np.pad(solid, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    solid &= nb > 0
    p = np.pad(solid, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    solid |= (~solid) & (nb >= 4)
    p = np.pad(solid, 1)
    ring = solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    k = len(lab_pal)
    for j in range(FRAME_H):
        for i in range(FRAME_W):
            if not solid[j, i]:
                continue
            if ring[j, i]:
                out[j, i] = outline_idx
                continue
            sy, sx = grid[j][i]
            if method == "area":
                m = fg[sy, sx]
                if not m.any():
                    out[j, i] = outline_idx
                    continue
                mean = lab_img[sy, sx][m].mean(0)
                out[j, i] = int(((mean - lab_pal) ** 2).sum(1).argmin())
                continue
            votes = np.zeros(k)
            sel = pure[sy, sx]
            ids = idx[sy, sx][sel]
            if ids.size:
                np.add.at(votes, ids, 1)
            # the face's small features only: boost the details where the cell is mostly fur, never in the sweater's ribbing
            fur = votes[list(FUR)].sum() / max(votes.sum(), 1)
            votes *= weights if fur >= 0.45 else 1.0
            if votes.sum() == 0:
                # nothing pure here (a sliver): the nearest solid neighbour's colour
                votes[:] = 0
                m = fg[sy, sx]
                votes[idx[sy, sx][m]] += 1 if m.any() else 0
                votes[outline_idx] = 0
                if votes.sum() == 0:
                    votes[outline_idx] = 1
            out[j, i] = int(votes.argmax())
    return out


# ---------------------------------------------------------------- the run


def run(method: str, k: int, write: bool, scale: float | None = None) -> dict:
    global SCALE
    if scale:
        SCALE = scale
    img = Image.open(SRC).convert("RGB")
    rgb = np.array(img)
    bg = key_out(rgb)
    fg = ~bg
    labels, n = components(fg)
    sizes = np.bincount(labels.ravel(), minlength=n + 1)[1:]
    keep = [i + 1 for i, s in enumerate(sizes) if s > 2000]      # specks of lossy noise are not sprites
    if len(keep) != FRAMES:
        raise SystemExit(f"expected {FRAMES} sprites, found {len(keep)}")
    boxes = []
    for lab in keep:
        ys, xs = np.where(labels == lab)
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    order = order_sprites(boxes)
    dep = depth(fg)
    interior = fg & (dep >= PURE_DEPTH)
    worst = int(magenta_score(rgb)[interior].max())
    assert worst < MAG, f"the fox's interior reaches the magenta test ({worst})"
    pal = build_palette(rgb[interior], k)
    lab_pal = srgb_to_lab(pal)
    lab_img = srgb_to_lab(rgb)
    idx, dist = nearest(lab_pal, lab_img)
    dark = lab_pal[:, 0] < 32
    band = dark[idx] & (dep <= OUTLINE_DEPTH)
    pure = fg & ((dep >= PURE_DEPTH) | (dist < 9)) & ~band
    weights = detail_weights(pal, lab_pal)
    global FUR
    FUR = tuple(i for i, (L, a, b) in enumerate(lab_pal) if L > 72 and b > 8 and a < 22)      # the creams
    outline_idx = 0                                              # the darkest palette entry
    frames, stats = [], []
    for o in order:
        lab = keep[o]
        mask = labels == lab
        st = sprite_stats(mask)
        stats.append(st)
        if st["right"] - st["left"] > FRAME_W * SCALE or st["bottom"] - st["top"] > FRAME_H * SCALE:
            raise SystemExit(f"a sprite does not fit the {FRAME_W} x {FRAME_H} frame at scale {SCALE}: {st}")
        y0, y1 = max(st["top"] - 40, 0), min(st["bottom"] + 40, mask.shape[0])
        x0, x1 = max(st["left"] - 40, 0), min(st["right"] + 40, mask.shape[1])
        # work in the sprite's own window; positions are shifted into it
        win = (slice(y0, y1), slice(x0, x1))
        sub = {"cx": st["cx"] - x0, "bottom": st["bottom"] - y0, "left": st["left"] - x0, "right": st["right"] - x0}
        f = downsample(mask[win], idx[win], pure[win] & mask[win], weights, sub, method, lab_img[win], lab_pal, outline_idx)
        frames.append(f)
    result = {"palette": pal, "frames": frames, "stats": stats, "method": method, "scale": SCALE}
    if write:
        emit(result)
    return result


def to_rgba(frame: np.ndarray, pal: np.ndarray) -> np.ndarray:
    out = np.zeros(frame.shape + (4,), np.uint8)
    on = frame >= 0
    out[on, :3] = pal[frame[on]]
    out[on, 3] = 255
    return out


def strip_of(result: dict) -> np.ndarray:
    return np.concatenate([to_rgba(f, result["palette"]) for f in result["frames"]], axis=1)


def preview(strip: np.ndarray, path: Path, zoom: int = 8, bg=(120, 92, 70)) -> None:
    """The 24 frames in the sheet's 6 x 4 layout, each at `zoom`, on a floor-like colour, with a faint frame grid."""
    h, w = FRAME_H, FRAME_W
    sheet = np.zeros((h * len(DIRS), w * COLS, 4), np.uint8)
    for d in range(len(DIRS)):
        for c in range(COLS):
            sheet[d * h:(d + 1) * h, c * w:(c + 1) * w] = strip[:, (d * COLS + c) * w:(d * COLS + c + 1) * w]
    base = np.zeros(sheet.shape[:2] + (3,), np.uint8)
    base[:] = bg
    for d in range(len(DIRS)):
        for c in range(COLS):
            base[d * h:(d + 1) * h, c * w:(c + 1) * w] = np.array(bg) + (8 if (c + d) % 2 else 0)
    a = sheet[..., 3:4] > 0
    base = np.where(a, sheet[..., :3], base).astype(np.uint8)
    im = Image.fromarray(base).resize((base.shape[1] * zoom, base.shape[0] * zoom), Image.NEAREST)
    im.save(path)


def emit(result: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    strip = strip_of(result)
    Image.fromarray(strip, "RGBA").save(OUT_DIR / "fox.png", optimize=True)
    pal = result["palette"]
    # the anchor: the frame column the centre of mass sits on, and the row of the feet
    meta = {
        "frame": [FRAME_W, FRAME_H],
        "frames": FRAMES,
        "order": [f"{d}:{c}" for d in DIRS for c in range(COLS)],
        "directions": list(DIRS),
        "perDirection": COLS,
        "anchor": {"x": FRAME_W // 2, "feetRow": FRAME_H - 1, "note": "the feet's bottom row; the centre of mass of each frame is on column x"},
        "palette": ["#%02x%02x%02x" % tuple(c) for c in pal],
        "outline": "#%02x%02x%02x" % tuple(pal[0]),
        "sourceScale": result["scale"],
        "method": result["method"],
        "source": "docs/study/art/source/fox-sheet-01.png",
        "tool": "tools/art/fox_sheet.py",
    }
    (OUT_DIR / "fox.json").write_text(json.dumps(meta, indent=2) + "\n")
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview(strip, PREVIEW_DIR / "fox-processed-8x.png")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--method", choices=["vote", "area"], default="vote")
    ap.add_argument("--colours", type=int, default=MAX_COLOURS)
    ap.add_argument("--scale", type=float, default=None)
    ap.add_argument("--preview-only", metavar="PATH", help="write only an 8x preview to PATH (for comparing methods) and do not touch the game files")
    a = ap.parse_args(argv)
    res = run(a.method, a.colours, write=a.preview_only is None, scale=a.scale)
    if a.preview_only:
        preview(strip_of(res), Path(a.preview_only))
    ws = [int((f >= 0).any(0).sum()) for f in res["frames"]]
    hs = [int((f >= 0).any(1).sum()) for f in res["frames"]]
    print(f"{FRAMES} frames, {a.method}, scale {res['scale']}, widths {min(ws)}-{max(ws)}, heights {min(hs)}-{max(hs)}, palette {len(res['palette'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
