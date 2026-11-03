#!/usr/bin/env python3
"""
Turns ChatGPT animal character sheets into game frames: ONE data-driven pipeline for every animal (the config is `ANIMALS`).

    python3 tools/art/animal_sheet.py                      # every animal: writes public/library/characters/<id>.png + <id>.json,
                                                           #   src/lib/studyapp/library/people/animals.json and the 8x previews
    python3 tools/art/animal_sheet.py --id raccoon         # one animal
    python3 tools/art/animal_sheet.py --ingest raccoon /path/to/28.webp    # converts a raw ChatGPT file to the lossless source PNG
    python3 tools/art/animal_sheet.py --ingest-sit dragon /path/to/sit.png # a SEATED sheet for that animal (then run it with --id dragon: the rig uses it as drawn)
    python3 tools/art/check_animals.py                     # asserts the invariants of everything it wrote

THE SOURCE is not clean pixel art: 1536 x 1024, 6 columns x 4 rows (rows: facing DOWN, LEFT, UP, RIGHT; columns: six walk
frames), a magenta background that is not flat (lossy: jpg or webp), anti-aliased edges, sprites that drift across their nominal
256 x 256 cells, and "pixels" that are 2 to 6 source pixels, not a grid. So nothing here trusts the cells or the grid:

  1. KEY. Background = any pixel whose green is far below both red and blue (a magenta test, not a colour match, so every grade
     of the lossy background and every blend of it with the outline is caught). The animal's own colours never pass it (the
     test is asserted on the animal's interior, below).
  2. SEGMENT. The sprites are the connected components (8-connectivity) of the keyed mask grown by `merge` source pixels, so a
     sprite the sheet drew in two touching pieces (the axolotl's tail under its body) is one sprite and a lossy speck is
     not. Exactly 24 or it stops. Rows are directions, columns are walk frames; ordered by the component's centre.
  3. PALETTE. One palette for all 24 frames: k-means (Lab, fixed seed) over the animal's interior pixels (those 3 or more source
     pixels from the background, so no blend with magenta takes part), at most `colours` of them, then the darkest is the
     outline colour. One palette means no flicker between frames.
  4. DOWNSAMPLE. The same scale for every frame of an animal (SCALE source pixels per art pixel: never per frame; chosen so the
     median sprite is about 26 art rows tall like the fox, and the widest fits the 24 column frame). Each frame gets its own
     grid PHASE so its feet bottom lands on the frame's baseline row and its anchor on the frame's centre column (the drift
     correction: the grid follows the sprite, not the other way round). The anchor is the centre of mass (`anchor: "mass"`) or,
     for an animal whose tail or arms swing differently from frame to frame, the centroid of its jumper (`anchor: "torso"`:
     the body does not slide). A cell is opaque when at least half of its source pixels are the animal. The 1 px outline is
     then drawn, not sampled: the cell ring of the silhouette is the outline colour (the source outline is about half an
     art pixel thick, so sampling it would give a broken line). Interior cells take a weighted vote of the palette indices of
     their source pixels (rare colours are boosted so the eyes, nose and blush are not voted away; blends with the outline
     or the background do not vote). `--method area` is the comparison (plain averaging, then the nearest palette colour).
  5. CLEAN. Specks and one-cell holes are removed; alpha is 0 or 255 everywhere.
  6. WRITE. One strip, FRAME_W x FRAME_H per frame, 24 frames per animal; <id>.json documents order, palette and anchors, and
     animals.json (what the engine's TypeScript reads) lists every animal with its jumper colours and tail hints.

Each animal wears the jumper it was drawn in (there is no wardrobe for animals). The people in the room are 16 x 32 frames
with the person 24 rows tall, so the animal frame is 24 x 32 (wider, the same height) with the feet on the bottom row.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field, replace
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animal_rig as rig  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/study/art/source"
OUT_DIR = ROOT / "public/library/characters"
PREVIEW_DIR = ROOT / "docs/study/art/animals"
REGISTRY = ROOT / "src/lib/studyapp/library/people/animals.json"

FRAME_W, FRAME_H = 24, 32
DIRS = ("down", "left", "up", "right")     # the sheet's rows
COLS = 6                                    # walk frames per direction
FRAMES = len(DIRS) * COLS
ENGINE_FRAMES = 78                          # idle 24, walk 24, sit 12, phone 6, read 6, stool 6: the engine's row (people/sheet.ts POSE)
BASELINE = FRAME_H                          # the feet's bottom edge, in art rows: the last row of the frame holds the feet
TARGET_ROWS = 26.2                          # the median sprite's height in art rows (the fox's), which sets the scale of an animal that does not name one
COVER = 0.5                                 # a cell is animal when at least this much of it is
MAG = 50                                    # min(r, b) - g above this is background (an animal's interior never exceeds ~30)
OUTLINE_DEPTH = 6                           # source pixels from the edge that are the drawn outline (and so are not sampled: the ring is drawn)
PURE_DEPTH = 3                              # source pixels from the background before a colour is trusted
SEED = 7
DETAIL_DARK = 2.4
DETAIL_BLUSH = 2.0
NEAR = 13.0                                 # Lab distance within which a palette colour is "the colour the config names"


@dataclass(frozen=True)
class Animal:
    """One character and how to read its sheet. Everything the pipeline needs to know that the pixels do not say."""
    id: str                                  # the avatar `body` value: lower case letters only, 3 to 12 (see docs/study/library.md, "Characters")
    title: str                               # what the wardrobe calls it
    source: str                              # the lossless source PNG, relative to docs/study/art/source
    jumper: tuple[str, ...]                  # the jumper (or scarf) as drawn: the torso, whose centre is where the feet are, and the neck line
    fur: tuple[str, ...] | None = ()         # the face fur: only there are the small dark features (eyes, nose) given extra weight; None is the old rule (the creams)
    blush: tuple[str, ...] | None = None     # the cheek colour; None is the old rule (a pink lighter than a jumper), () means there is none
    scale: float | None = None               # source pixels per art pixel; None is worked out from the sprites
    colours: int = 16                        # at most this many colours
    dark: float = 32.0                       # a palette colour darker than this (Lab L) is an eye or a nose where it sits in the face fur: it is given extra weight
    mag: int = MAG                           # the magenta test's threshold: raised for an animal whose own colours come close (the axolotl's lilac jumper scores up to ~130, the background 190 to 250)
    bal: int = 255                           # how far apart red and blue may be in the background (255: no test)
    merge: int = 0                           # grow the mask this many source pixels before looking for sprites (a sprite drawn in touching pieces)
    hip: int = 27                            # the row the legs start at (the rig cuts the walk's legs and the seated pose there)
    stride: int = 3                          # the legs' spread at the walk's contact frames, art px (short legs need more to read)
    legw: int = 5                            # how far either side of the torso's centre the legs reach (the tail beyond is not a leg)
    shoulder: int = 17                       # the row below which, seated, the tail's columns are tucked away
    anchor: str = "torso"                    # "mass" or "torso": what the frame's centre column is
    tail: dict = field(default_factory=dict) # the swish: columns from the torso centre to the tail, per direction (see animals.json); a missing one does not swish


# Registered in the order the wardrobe shows them. The fox is first and is kept exactly as the first experiment made it.
ANIMALS: tuple[Animal, ...] = (
    Animal("fox", "Fox", "fox-sheet-01.png", jumper=("#76273b", "#a03a55"), fur=None, scale=8.1,
           tail={"down": 6, "left": 5, "right": 5}),
    Animal("capybara", "Capybara", "animal-sheet-capybara.png", dark=20, hip=28, stride=3, jumper=("#f7dbab", "#dab787"), blush=(),
           fur=("#ca8655", "#d1864a", "#b66e3b", "#a36642", "#a25d33")),
    Animal("axolotl", "Axolotl", "animal-sheet-axolotl.png", dark=20, stride=3, jumper=("#9150c1",), blush=(), colours=20, mag=100, merge=2,
           fur=("#fbb8a8", "#f7beae", "#fbd5c7", "#f69b90", "#f88a7f"), tail={"down": 6, "left": 5, "right": 5}),
    Animal("redpanda", "Red panda", "animal-sheet-redpanda.png", dark=20, jumper=("#0a8e95", "#0e6869"), blush=(), colours=20,
           fur=("#db813d", "#dc722e", "#fbeab6", "#fbeec9", "#f2c793"), tail={"down": 6, "left": 5, "right": 5}),
    Animal("badger", "Badger", "animal-sheet-badger.png", dark=20, jumper=("#eab341", "#b27724"), blush=(), colours=20,
           fur=("#f9efda", "#faf0ce", "#dcbc9d"), tail={"down": 6, "left": 5, "right": 5}),
    Animal("hedgehog", "Hedgehog", "animal-sheet-hedgehog.png", dark=20, jumper=("#8ca16e", "#6a784d"), fur=("#fbf1cc", "#fdf4c3", "#f2d197", "#f0c7a2")),
    Animal("raccoon", "Raccoon", "animal-sheet-raccoon.png", dark=20, jumper=("#e86718", "#d46020", "#ae4815"), blush=("#f09a92",),
           fur=("#e1d9d2", "#bcb3ae", "#959291"), tail={"down": 6, "left": 5, "right": 5}),
    Animal("triceratops", "Triceratops", "animal-sheet-triceratops.png", dark=20, jumper=("#3f3789", "#282353"), blush=("#f5b592",), colours=20,
           fur=("#9ea543", "#bbc658", "#7e7f2e", "#a79769"), tail={"down": 6, "left": 5, "right": 5}),
    Animal("dragon", "Dragon", "animal-sheet-dragon.png", dark=20, jumper=("#1f203b", "#343c68"), blush=("#e77585",), colours=20,
           fur=("#ab517b", "#ba648a", "#83375a", "#fce9be", "#f8d1c3", "#fce4cd"), tail={"down": 6, "left": 5, "right": 5}),
)
BY_ID = {a.id: a for a in ANIMALS}

# ---------------------------------------------------------------- colour


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = (c @ m.T) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def magenta_score(rgb: np.ndarray) -> np.ndarray:
    a = rgb.astype(np.int32)
    return np.minimum(a[..., 0], a[..., 2]) - a[..., 1]


def named(pal_lab: np.ndarray, hexes: tuple[str, ...]) -> tuple[int, ...]:
    """The palette entries that are the colours a config names: each name's nearest entry, and any other within NEAR of it."""
    out: set[int] = set()
    for h in hexes:
        lab = srgb_to_lab(np.array([hex_rgb(h)], np.uint8))[0]
        d = np.sqrt(((pal_lab - lab) ** 2).sum(1))
        out.add(int(d.argmin()))
        out.update(int(i) for i in np.where(d < NEAR * 0.6)[0])
    return tuple(sorted(out))


# ---------------------------------------------------------------- key and segment


def balanced(rgb: np.ndarray, limit: int) -> np.ndarray:
    """True where red and blue are within `limit` of each other: the background's are (it is #FF00FF), a lilac jumper's are not."""
    a = rgb.astype(np.int32)
    return np.abs(a[..., 0] - a[..., 2]) <= limit


def key_out(rgb: np.ndarray, mag: int = MAG, bal: int = 255) -> np.ndarray:
    """True where the pixel is background."""
    return (magenta_score(rgb) > mag) & balanced(rgb, bal)


def grow(fg: np.ndarray, r: int) -> np.ndarray:
    """The mask with every pixel's (2r + 1) square set (one axis at a time, by shifting)."""
    out = fg
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r, r)
        p = np.pad(out, pad)
        n = out.shape[axis]
        acc = np.zeros_like(out)
        for k in range(2 * r + 1):
            acc |= np.take(p, np.arange(k, k + n), axis=axis)
        out = acc
    return out


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


def order_sprites(boxes: list[tuple[int, int, int, int]], cols: int = COLS, nrows: int = len(DIRS)) -> list[int]:
    """Indices in reading order: the rows are found by clustering centres on y, then each row by x."""
    cy = np.array([(b[1] + b[3]) / 2 for b in boxes])
    cx = np.array([(b[0] + b[2]) / 2 for b in boxes])
    idx = list(np.argsort(cy))
    rows = [idx[i * cols:(i + 1) * cols] for i in range(nrows)]
    for r in rows:
        if max(cy[r]) - min(cy[r]) > 120:
            raise SystemExit(f"the sprites do not fall in {nrows} rows of {cols}")
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


def detail_weights(an: Animal, pal: np.ndarray, lab_pal: np.ndarray) -> np.ndarray:
    """How hard each colour pulls in a cell's vote. The face's small features (eyes, nose, the cheek blush) cover well
    under half of their cell at this scale, so a plain majority erases them; the very dark browns and the blush pink
    count DETAIL_DARK and DETAIL_BLUSH times. Everything else counts once."""
    w = np.ones(len(pal))
    blush = None if an.blush is None else named(lab_pal, an.blush)
    for i, (L, a, b) in enumerate(lab_pal):
        if L < an.dark:
            w[i] = DETAIL_DARK                   # eyes and nose (the outline band is not sampled, so a dark pixel left here is a feature)
        elif blush is None and a > 22 and L > 65:
            w[i] = DETAIL_BLUSH                  # the cheek blush: a pink lighter than the jumper
        elif blush is not None and i in blush:
            w[i] = DETAIL_BLUSH
    return w


def nearest(lab_pal: np.ndarray, lab: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    d = ((lab[..., None, :] - lab_pal) ** 2).sum(-1)
    return d.argmin(-1), np.sqrt(d.min(-1))


# ---------------------------------------------------------------- one sprite


def sprite_stats(mask: np.ndarray) -> dict:
    ys, xs = np.where(mask)
    return {"bottom": int(ys.max()) + 1, "cx": float(xs.mean()), "cy": float(ys.mean()),
            "left": int(xs.min()), "right": int(xs.max()) + 1, "top": int(ys.min())}


def cells(x0: float, y0: float, scale: float, w: int, h: int) -> list[list[tuple[slice, slice]]]:
    """The source rectangle of each art cell (x0, y0 is the source position of the frame's top left)."""
    xs = [int(round(x0 + i * scale)) for i in range(w + 1)]
    ys = [int(round(y0 + j * scale)) for j in range(h + 1)]
    return [[(slice(max(ys[j], 0), max(ys[j + 1], 0)), slice(max(xs[i], 0), max(xs[i + 1], 0))) for i in range(w)] for j in range(h)]


def downsample(fg: np.ndarray, idx: np.ndarray, pure: np.ndarray, weights: np.ndarray, st: dict, method: str,
               lab_img: np.ndarray, lab_pal: np.ndarray, outline_idx: int, scale: float, fur: tuple[int, ...], baseline: int = BASELINE) -> np.ndarray:
    """One frame: an (FRAME_H, FRAME_W) int array of palette indices, -1 transparent."""
    # the frame's left edge: the anchor on the centre column, but never so far that the sprite is cut by the frame
    x0 = st["ax"] - FRAME_W / 2 * scale
    x0 = min(max(x0, st["right"] - FRAME_W * scale), st["left"])
    y0 = st["bottom"] - baseline * scale
    grid = cells(x0, y0, scale, FRAME_W, FRAME_H)
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
            # the face's small features only: boost the details where the cell is mostly fur, never in the jumper's ribbing
            furshare = votes[list(fur)].sum() / max(votes.sum(), 1) if fur else 0.0
            votes *= weights if furshare >= 0.45 else 1.0
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


def source_of(an: Animal) -> Path:
    return SOURCE_DIR / an.source


def sprites_of(rgb: np.ndarray, merge: int, mag: int, bal: int, cols: int = COLS, nrows: int = len(DIRS)) -> tuple[np.ndarray, list[int], list[tuple[int, int, int, int]], np.ndarray]:
    """The keyed mask, the sprite label image (labels of the mask, grown by `merge` to find them), the 24 labels in reading order, and their boxes."""
    fg = ~key_out(rgb, mag, bal)
    grown = grow(fg, merge) if merge else fg
    labels, n = components(grown)
    labels = np.where(fg, labels, 0)
    sizes = np.bincount(labels.ravel(), minlength=n + 1)[1:]
    keep = [i + 1 for i, s in enumerate(sizes) if s > 2000]      # specks of lossy noise are not sprites
    if len(keep) != cols * nrows:
        raise SystemExit(f"expected {cols * nrows} sprites, found {len(keep)}")
    boxes = []
    for lab in keep:
        ys, xs = np.where(labels == lab)
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    order = order_sprites(boxes, cols, nrows)
    return fg, labels, [keep[o] for o in order], [boxes[o] for o in order]


def choose_scale(an: Animal, boxes: list[tuple[int, int, int, int]]) -> float:
    """The scale (source pixels per art pixel): the config's, or what makes the median sprite TARGET_ROWS tall and the widest fit the frame."""
    if an.scale:
        return an.scale
    hs = sorted(b[3] - b[1] for b in boxes)
    w = max(b[2] - b[0] for b in boxes)
    return float(np.ceil(max(hs[len(hs) // 2] / TARGET_ROWS, w / (FRAME_W - 0.15)) * 100) / 100)


def run(an: Animal, method: str = "vote") -> dict:
    rgb = np.array(Image.open(source_of(an)).convert("RGB"))
    fg, labels, order, boxes = sprites_of(rgb, an.merge, an.mag, an.bal)
    scale = choose_scale(an, boxes)
    dep = depth(fg)
    interior = fg & (dep >= PURE_DEPTH)
    worst = int(magenta_score(rgb)[interior & balanced(rgb, an.bal)].max())
    assert worst <= an.mag < 150, f"{an.id}: the interior reaches the magenta test ({worst})"
    pal = build_palette(rgb[interior], an.colours)
    lab_pal = srgb_to_lab(pal)
    lab_img = srgb_to_lab(rgb)
    idx, dist = nearest(lab_pal, lab_img)
    dark = lab_pal[:, 0] < 32          # the outline's colours: the band along the edge that is drawn, not sampled
    band = dark[idx] & (dep <= OUTLINE_DEPTH)
    pure = fg & ((dep >= PURE_DEPTH) | (dist < 9)) & ~band
    weights = detail_weights(an, pal, lab_pal)
    if an.fur is None:
        fur = tuple(i for i, (L, a, b) in enumerate(lab_pal) if L > 72 and b > 8 and a < 22)      # the creams (the fox)
    else:
        fur = named(lab_pal, an.fur)
    jumper = named(lab_pal, an.jumper)
    jmask = fg & np.isin(idx, jumper) & (dep >= PURE_DEPTH)
    outline_idx = 0                                              # the darkest palette entry
    # the torso's centre column per sprite (the jumper's centroid), and how far it is from the centre of mass; a sprite whose jumper is hidden
    # or half hidden (a scarf behind wings) takes the direction's median offset from its own centre of mass instead of a noisy centroid
    sprites = []
    for lab in order:
        mask = labels == lab
        st = sprite_stats(mask)
        jm = jmask & mask
        ys, xs = np.where(jm)
        st["jumper"] = int(len(xs))
        st["tx"] = float(xs.mean()) if len(xs) >= 150 else None
        sprites.append((mask, st))
    for d in range(len(DIRS)):
        group = [st for _, st in sprites[d * COLS:(d + 1) * COLS]]
        offs = [st["tx"] - st["cx"] for st in group if st["tx"] is not None]
        med = float(np.median(offs)) if offs else 0.0
        for st in group:
            ok = st["tx"] is not None and abs(st["tx"] - st["cx"] - med) <= 2.5 * scale
            st["tx"] = st["tx"] if ok else st["cx"] + med
            st["ax"] = st["tx"] if an.anchor == "torso" else st["cx"]
    frames, stats = [], []
    for mask, st in sprites:
        stats.append(st)
        if st["right"] - st["left"] > FRAME_W * scale or st["bottom"] - st["top"] > FRAME_H * scale:
            raise SystemExit(f"{an.id}: a sprite does not fit the {FRAME_W} x {FRAME_H} frame at scale {scale}: {st}")
        y0, y1 = max(st["top"] - 40, 0), min(st["bottom"] + 40, mask.shape[0])
        x0, x1 = max(st["left"] - 40, 0), min(st["right"] + 40, mask.shape[1])
        # work in the sprite's own window; positions are shifted into it
        win = (slice(y0, y1), slice(x0, x1))
        sub = {"ax": st["ax"] - x0, "bottom": st["bottom"] - y0, "left": st["left"] - x0, "right": st["right"] - x0}
        f = downsample(mask[win], idx[win], pure[win] & mask[win], weights, sub, method, lab_img[win], lab_pal, outline_idx, scale, fur)
        frames.append(f)
    sit = None
    sit_src = SOURCE_DIR / f"animal-sit-{an.id}.png"
    if sit_src.exists():
        sit = run_sit(an, sit_src, pal, lab_pal, weights, fur, jumper, scale, method)
    return {"animal": an, "palette": pal, "frames": frames, "stats": stats, "method": method, "scale": scale, "jumper": jumper, "sit": sit}


SIT_COLS, SIT_ROWS = 4, 2      # a seated sheet: row 1 the SIDE view facing right, row 2 the FRONT view; columns still, page turn, head nod, writing


def run_sit(an: Animal, src: Path, pal: np.ndarray, lab_pal: np.ndarray, weights: np.ndarray, fur: tuple[int, ...], jumper: tuple[int, ...],
            scale: float, method: str) -> dict:
    """The seated sheet (docs/study/art/chatgpt-animal-sit-prompts.md): 8 sprites cut and snapped like the walk's, with the walk's palette
    (every pixel takes its nearest colour) and scale, the torso on column 12 and the bottom of the figure on the lap line (hip + 4)."""
    rgb = np.array(Image.open(src).convert("RGB"))
    fg, labels, order, boxes = sprites_of(rgb, an.merge, an.mag, an.bal, SIT_COLS, SIT_ROWS)
    dep = depth(fg)
    lab_img = srgb_to_lab(rgb)
    idx, dist = nearest(lab_pal, lab_img)
    band = (lab_pal[:, 0] < 32)[idx] & (dep <= OUTLINE_DEPTH)
    pure = fg & ((dep >= PURE_DEPTH) | (dist < 9)) & ~band
    jmask = fg & np.isin(idx, jumper) & (dep >= PURE_DEPTH)
    out = []
    for lab in order:
        mask = labels == lab
        st = sprite_stats(mask)
        ys, xs = np.where(jmask & mask)
        st["ax"] = float(xs.mean()) if len(xs) >= 150 else st["cx"]
        y0, y1 = max(st["top"] - 40, 0), min(st["bottom"] + 40, mask.shape[0])
        x0, x1 = max(st["left"] - 40, 0), min(st["right"] + 40, mask.shape[1])
        win = (slice(y0, y1), slice(x0, x1))
        sub = {"ax": st["ax"] - x0, "bottom": st["bottom"] - y0, "left": st["left"] - x0, "right": st["right"] - x0}
        out.append(downsample(mask[win], idx[win], pure[win] & mask[win], weights, sub, method, lab_img[win], lab_pal, 0, scale, fur, an.hip + 4))
    return {"side": out[:SIT_COLS], "front": out[SIT_COLS:]}


def to_rgba(frame: np.ndarray, pal: np.ndarray) -> np.ndarray:
    out = np.zeros(frame.shape + (4,), np.uint8)
    on = frame >= 0
    out[on, :3] = pal[frame[on]]
    out[on, 3] = 255
    return out


def sheet_strip(result: dict) -> np.ndarray:
    """The sheet's own 24 frames, side by side (what the pipeline cut out of the ChatGPT sheet)."""
    return np.concatenate([to_rgba(f, result["palette"]) for f in result["frames"]], axis=1)


def engine_frames(result: dict) -> list[np.ndarray]:
    """The 78 frames the engine reads, built from the sheet's frames by animal_rig."""
    pal = result["palette"]
    sheet = [to_rgba(f, pal) for f in result["frames"]]
    jumper = {tuple(int(v) for v in pal[i]) for i in result["jumper"]}
    sit = None if result.get("sit") is None else {k: [to_rgba(f, pal) for f in v] for k, v in result["sit"].items()}
    return rig.build(sheet, result["animal"], jumper, tuple(int(v) for v in pal[0]), sit)


def strip_of(result: dict) -> np.ndarray:
    return np.concatenate(engine_frames(result), axis=1)


LAYOUT = [("idle right", 0), ("idle back", 6), ("idle left", 12), ("idle front", 18), ("walk right", 24), ("walk back", 30), ("walk left", 36),
          ("walk front", 42), ("sit right", 48), ("sit left", 54), ("phone", 60), ("read", 66), ("stool", 72)]


def preview(strip: np.ndarray, path: Path, zoom: int = 6, bg=(120, 92, 70)) -> None:
    """The 78 engine frames, one pose per row (idle, walk, sit, phone, read, stool), each at `zoom`, on a floor-like colour."""
    h, w = FRAME_H, rig.FRAME_W
    sheet = np.zeros((h * len(LAYOUT), w * COLS, 4), np.uint8)
    for r, (_, first) in enumerate(LAYOUT):
        for c in range(COLS):
            sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = strip[:, (first + c) * w:(first + c + 1) * w]
    base = np.zeros(sheet.shape[:2] + (3,), np.uint8)
    base[:] = bg
    for r in range(len(LAYOUT)):
        for c in range(COLS):
            base[r * h:(r + 1) * h, c * w:(c + 1) * w] = np.array(bg) + (8 if (c + r) % 2 else 0)
    a = sheet[..., 3:4] > 0
    base = np.where(a, sheet[..., :3], base).astype(np.uint8)
    Image.fromarray(base).resize((base.shape[1] * zoom, base.shape[0] * zoom), Image.NEAREST).save(path)


def hexes(pal: np.ndarray, which) -> list[str]:
    return ["#%02x%02x%02x" % tuple(pal[i]) for i in which]


def emit(result: dict) -> None:
    an: Animal = result["animal"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    strip = strip_of(result)
    Image.fromarray(strip, "RGBA").save(OUT_DIR / f"{an.id}.png", optimize=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet_strip(result), "RGBA").save(PREVIEW_DIR / f"{an.id}-sheet.png", optimize=True)
    pal = result["palette"]
    # the anchor: the frame column the anchor sits on, and the row of the feet
    meta = {
        "id": an.id,
        "title": an.title,
        "frame": [rig.FRAME_W, FRAME_H],
        "artFrame": [FRAME_W, FRAME_H],
        "pad": rig.PAD,
        "frames": ENGINE_FRAMES,
        "order": [f"{name}:{c}" for name, _ in LAYOUT for c in range(COLS)],
        "layout": {name: first for name, first in LAYOUT},
        "sheetFrames": FRAMES,
        "sheetOrder": [f"{d}:{c}" for d in DIRS for c in range(COLS)],
        "anchor": {"x": rig.FRAME_W // 2, "feetRow": FRAME_H - 1, "kind": an.anchor,
                   "note": "the feet's bottom row; the anchor (the centre of mass, or the centre of the jumper) of each frame is on column x"},
        "palette": ["#%02x%02x%02x" % tuple(c) for c in pal],
        "outline": "#%02x%02x%02x" % tuple(pal[0]),
        "jumper": hexes(pal, result["jumper"]),
        "rig": {"hip": an.hip, "stride": an.stride, "legw": an.legw, "shoulder": an.shoulder, "tail": {d: an.tail.get(d) for d in DIRS}},
        "sourceScale": result["scale"],
        "method": result["method"],
        "source": f"docs/study/art/source/{an.source}",
        "sitSource": f"docs/study/art/source/animal-sit-{an.id}.png" if result.get("sit") else None,
        "tool": "tools/art/animal_sheet.py",
    }
    (OUT_DIR / f"{an.id}.json").write_text(json.dumps(meta, indent=2) + "\n")
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview(strip, PREVIEW_DIR / f"{an.id}-8x.png")


def write_registry() -> None:
    """animals.json: what the engine's TypeScript reads about every animal (its id, name, jumper colours and tail). Written from the per-animal
    files, so running one animal does not forget the others."""
    out = []
    for an in ANIMALS:
        f = OUT_DIR / f"{an.id}.json"
        if not f.exists():
            continue
        m = json.loads(f.read_text())
        entry = {"id": an.id, "title": an.title, "jumper": m["jumper"], "tail": {d: an.tail.get(d) for d in DIRS}}
        if m.get("sit", {}).get("kind") == "drawn":
            entry["seated"] = "drawn"                    # the seated frames are drawn art (tools/art/animal_sit.py); the others are the standing art made to sit
        out.append(entry)
    REGISTRY.write_text(json.dumps(out, indent=1) + "\n")


def ingest(an: Animal, path: Path) -> None:
    """A raw ChatGPT file (jpg, webp, png) as the lossless source PNG."""
    img = Image.open(path).convert("RGB")
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    img.save(source_of(an), optimize=True)
    print(f"{an.id}: {img.size[0]} x {img.size[1]} -> {source_of(an).relative_to(ROOT)}")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", action="append", help="only this animal (repeatable)")
    ap.add_argument("--method", choices=["vote", "area"], default="vote")
    ap.add_argument("--ingest", nargs=2, metavar=("ID", "FILE"), help="convert a raw sheet to the source PNG and stop")
    ap.add_argument("--ingest-sit", nargs=2, metavar=("ID", "FILE"), help="convert a raw SEATED sheet (docs/study/art/chatgpt-animal-sit-prompts.md) to docs/study/art/source/animal-sit-<id>.png and stop")
    ap.add_argument("--set", metavar="JSON", help="override fields of the chosen animals for this run only (exploring): --set '{\"dark\": 20}'")
    ap.add_argument("--out", metavar="DIR", help="write the strips and previews into DIR instead of the game's folders (for trying settings)")
    a = ap.parse_args(argv)
    if a.ingest:
        ingest(BY_ID[a.ingest[0]], Path(a.ingest[1]))
        return 0
    if a.ingest_sit:
        img = Image.open(a.ingest_sit[1]).convert("RGB")
        dst = SOURCE_DIR / f"animal-sit-{BY_ID[a.ingest_sit[0]].id}.png"
        img.save(dst, optimize=True)
        print(f"{a.ingest_sit[0]}: {img.size[0]} x {img.size[1]} -> {dst.relative_to(ROOT)}")
        return 0
    global OUT_DIR, PREVIEW_DIR
    if a.out:
        OUT_DIR = PREVIEW_DIR = Path(a.out)
    todo = [BY_ID[i] for i in a.id] if a.id else list(ANIMALS)
    if a.set:
        over = {k: tuple(v) if isinstance(v, list) else v for k, v in json.loads(a.set).items()}
        todo = [replace(an, **over) for an in todo]
    for an in todo:
        res = run(an, a.method)
        emit(res)
        ws = [int((f >= 0).any(0).sum()) for f in res["frames"]]
        hs = [int((f >= 0).any(1).sum()) for f in res["frames"]]
        print(f"{an.id}: {FRAMES} frames, {a.method}, scale {res['scale']}, widths {min(ws)}-{max(ws)}, heights {min(hs)}-{max(hs)}, palette {len(res['palette'])}")
    if not a.out:
        import animal_sit                                # a rebuilt strip has stand-in seated frames: the animals with a drawn seated sheet get theirs back
        animal_sit.apply([an.id for an in todo])
        write_registry()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))


