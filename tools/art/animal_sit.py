#!/usr/bin/env python3
"""
SEATED art for the animals, from a ChatGPT sheet drawn for it (animals leaning over a table, writing, one static pose per facing).

    python3 tools/art/animal_sit.py --ingest 40.webp                     # a raw sheet -> docs/study/art/source/animal-sit-sheet-01.png (lossless)
    python3 tools/art/animal_sit.py [--id fox ...] [--sheet N]           # splices the seated frames into the animals' strips (idempotent)
    python3 tools/art/animal_sit.py --measure                            # the head widths and the scale they imply (to set `scale` in animal_sit.json)
    python3 tools/art/animal_sit.py --detail DIR                         # a 2x-detail preview (not used by the engine)
    python3 tools/art/animal_sit.py --dry DIR                            # only previews of the 30 seated frames per animal (the strips are not changed)
    (the invariants of the seated frames are asserted by tools/art/check_animals.py)

THE SHEET (animal_sit.json `sheets`): rows are animals (top to bottom), columns are the four facings: left (profile), right (profile), front (head
tipped down, seen from above) and back (away). The legs and lap are not drawn (the table hides them). The pictures are drawn at 3 to 4 source px per
art pixel; the standing sprites (animal_sheet.py) at 8 to 9. The seated art is brought to the ENGINE'S scale, `scale` source px per art pixel per
animal, so that the head is as wide as the standing animal's (`--measure` prints both), and nothing is drawn by hand.

WHAT THIS DOES, per animal:
  1. keys out the magenta (a strict test, so the lilac hoodie and the pink gills stay), finds the 16 sprites by connected components (the grid may
     drift) and cuts each one out;
  2. takes the animal's own palette (the strip's json) and adds the few colours the new art has that it does not (the pen, a paw, a new shade), at most 24;
  3. brings each sprite to the engine's scale: a grid of art pixels laid on the sprite (its bottom on the grid's bottom, centred), a cell is animal when half
     of it is, the outline is DRAWN (a 1 px ring in the outline colour), an inside cell takes the vote of the source pixels in it with the small dark
     features (eye, nose, glasses) and the rare colours (the pen, a gill tip, an ear's blue) pulling harder than their area; binary alpha, one piece;
  4. places each in the 34 x 32 frame: the bottom of the figure on the pose's baseline, the middle of the figure on the same column for the left/right pair
     (mirror images of each other about the frame's middle);
  5. makes the 6 frame loop from the one drawn pose, the same way for every animal and at the cadence the people have (one frame per 8 ticks): a breath
     (the body one row up for two frames), a nod (the head one row down on one beat) and a stroke of the pen (the pen paw one column over on two beats).
  The frames replaced in public/library/characters/<id>.png are 48-59 (sit right, sit left), 60-65 (phone) and 66-71 (read), both from the FRONT sprite, and
  72-77 (stool, the chair seen from behind) from the BACK sprite. Idle and walk (frames 0-47) are not touched (the tool asserts they are byte-identical).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animal_sheet as sheet  # noqa: E402
from animal_sheet import components, depth, grow, order_sprites, srgb_to_lab  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CONFIG = Path(__file__).with_suffix(".json")
OUT_DIR = ROOT / "public/library/characters"
PREVIEW_DIR = ROOT / "docs/study/art/animals"
FW, FH, PAD = 34, 32, 5
POSE_AT = {"sit right": 48, "sit left": 54, "phone": 60, "read": 66, "stool": 72}
MAX_COLOURS = 24
JUMPER_DE = 20.0
MERGE_DE_HI = 11.0           # finer pixels keep more of the shading
MERGE_DE = 16.0              # palette entries this close (Lab) are one colour in a seated frame
MAG_SCORE = 100              # min(r, b) - g above this, with r and b alike, is the background (#FF00FF through lossy compression)
OUTLINE_BAND = 6             # source px from the edge that are the drawn outline (not sampled for colour: the ring is redrawn)
PURE_DEPTH = 3
COVER = 0.5
NEW_COLOUR = 9.0             # a colour this far (Lab) from the palette is added to it
NEW_SHARE = 0.002            # ... if at least this share of the sprites' inside pixels is that far
FUR_SHARE = 0.45
DARK_L = 30.0                # a palette colour darker than this (Lab L) is an eye, a nose or ink
FEATURE_DE = 26.0            # a colour this far (Lab) from a cell's median colour is a feature (eye, pen, paw, rim) ...
FEATURE_SHARE = 0.24         # ... when it holds this share of the cell (half of that for a dark one in the face's fur)
# the loop: frame k of 6, played one per 8 ticks (people.png's sit cadence)
BREATH = (0, 0, 1, 1, 0, 0)
NOD = (0, 0, 0, 0, 0, 1)
STROKE = (0, 1, 0, 1, 0, 0)
S = 1                        # the resolution (1: the engine's art pixel; 2: strips of 68 x 64 frames written as <id>@2x.png)
SUFFIX = ""
_LOOP = (BREATH, NOD, STROKE)


def set_scale(n: int) -> None:
    """Works at n times the resolution: the frame, the poses' rows and columns and the loop's steps scale by n; the source px per art pixel is divided by n."""
    global S, SUFFIX, FW, FH, PAD, BREATH, NOD, STROKE
    S, SUFFIX = n, ("" if n == 1 else f"@{n}x")
    FW, FH, PAD = 34 * n, 32 * n, 5 * n
    BREATH, NOD, STROKE = (tuple(x * n for x in t) for t in _LOOP)
    sheet.FRAME_H, sheet.SUFFIX, sheet.HI = 32 * n, SUFFIX, n          # animal_sheet may be this process's other copy of the module (run as a script): its preview reads these
    sheet.rig.set_scale(n)


def pose_cfg(c: dict) -> dict:
    """The config's pose numbers (written for 1x) at the current resolution."""
    return {k: {kk: (vv * S if isinstance(vv, (int, float)) and kk in ("base", "torso", "neck", "cx", "cut") else vv) for kk, vv in v.items()} for k, v in c["pose"].items() if k != "_doc"}
Frame = np.ndarray


def cfg() -> dict:
    return json.loads(CONFIG.read_text())


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def to_hex(c) -> str:
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


# ---------------------------------------------------------------- the sheet


def ingest(path: Path, n: int = 1) -> Path:
    img = Image.open(path).convert("RGB")
    dst = ROOT / f"docs/study/art/source/animal-sit-sheet-{n:02d}.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, optimize=True)
    print(f"{img.size[0]} x {img.size[1]} -> {dst.relative_to(ROOT)}")
    return dst


def key_out(rgb: np.ndarray) -> np.ndarray:
    """True on the background. Strict: only what is magenta (or a blend of it with the outline: halo), so the lilac hoodie and the pink gills stay."""
    a = rgb.astype(np.int32)
    return (np.minimum(a[..., 0], a[..., 2]) - a[..., 1] > MAG_SCORE) & (np.abs(a[..., 0] - a[..., 2]) < 70)


def cut_sheet(rgb: np.ndarray, rows: int, cols: int) -> tuple[np.ndarray, np.ndarray, list[int], list[tuple[int, int, int, int]]]:
    """The mask, its sprite labels (the mask grown 2 px to find them, so a gill tip a pixel away still belongs), the labels in reading order, their boxes."""
    fg = ~key_out(rgb)
    labels, n = components(grow(fg, 2))
    labels = np.where(fg, labels, 0)
    sizes = np.bincount(labels.ravel(), minlength=n + 1)[1:]
    keep = [i + 1 for i, s in enumerate(sizes) if s > 3000]
    if len(keep) != rows * cols:
        raise SystemExit(f"expected {rows * cols} sprites, found {len(keep)} (sizes {sorted(int(s) for s in sizes if s > 200)})")
    boxes = []
    for lab in keep:
        ys, xs = np.where(labels == lab)
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    order = order_sprites(boxes, cols, rows)
    return fg, labels, [keep[o] for o in order], [boxes[o] for o in order]


# ---------------------------------------------------------------- palette


def extend_palette(pal: np.ndarray, samples_lab: np.ndarray) -> np.ndarray:
    """The animal's palette (darkest first, [0] the outline) plus the colours of the new art it lacks: the commonest 6 Lab-unit bin of what is far from
    every colour it has, until nothing common is left or there are MAX_COLOURS."""
    pal = pal.copy()
    while len(pal) < MAX_COLOURS:
        lp = srgb_to_lab(pal)
        d = np.sqrt(((samples_lab[:, None, :] - lp[None]) ** 2).sum(-1)).min(1)
        far = d > NEW_COLOUR
        if far.sum() < NEW_SHARE * len(samples_lab):
            break
        q = np.floor(samples_lab[far] / 6).astype(int)
        key = q[:, 0] * 1_000_000 + (q[:, 1] + 60) * 1000 + (q[:, 2] + 60)
        vals, counts = np.unique(key, return_counts=True)
        best = vals[counts.argmax()]
        c = samples_lab[far][key == best].mean(0)
        # the sRGB of this Lab mean: the nearest sample pixel is used instead of converting back
        i = ((samples_lab[far][key == best] - c) ** 2).sum(1).argmin()
        pal = np.vstack([pal, SAMPLES_RGB[far][key == best][i]])
    return pal


SAMPLES_RGB = np.zeros((0, 3), np.uint8)


# ---------------------------------------------------------------- one sprite to the engine's scale


class Sprite:
    """One cut-out: its RGB, its mask, how deep each pixel is, and which palette entry each pixel is nearest."""

    def __init__(self, rgb: np.ndarray, mask: np.ndarray):
        ys, xs = np.where(mask)
        self.box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        x0, y0, x1, y1 = self.box
        self.rgb = rgb[y0:y1, x0:x1]
        self.mask = mask[y0:y1, x0:x1]
        self.depth = depth(self.mask, OUTLINE_BAND + 2)
        self.lab = srgb_to_lab(self.rgb)
        self.h, self.w = self.mask.shape


def reps_of(pal: np.ndarray, count: np.ndarray, de: float) -> np.ndarray:
    """Which palette entry stands for each: walking down by use, an entry within `de` (Lab) of one already chosen is that one (the shades of a cream are one cream); the
    darkest entry (the outline) takes every ink within `de`."""
    lp = srgb_to_lab(pal)
    rep = np.arange(len(pal))
    chosen: list[int] = [0]
    for i in np.argsort(-count):
        if i == 0:
            continue
        d = [np.sqrt(((lp[i] - lp[c]) ** 2).sum()) for c in chosen]
        j = int(np.argmin(d))
        if d[j] < de:
            rep[i] = chosen[j]
        else:
            chosen.append(int(i))
    return rep


def to_grid(sp: Sprite, pal: np.ndarray, scale: float, dark: float, jumper: list[int], face_fur: set[int], rep: np.ndarray, feature: float = FEATURE_SHARE) -> np.ndarray:
    """The sprite on a grid of `scale` source px: an int array of palette indices, -1 clear (rows m, columns n). The bottom row of the grid is on the sprite's
    bottom, the columns are centred on it."""
    lp = srgb_to_lab(pal)
    d2 = ((sp.lab[..., None, :] - lp) ** 2).sum(-1)
    idx, dist = rep[d2.argmin(-1)], np.sqrt(d2.min(-1))
    lpr = np.where(np.isin(np.arange(len(pal)), np.unique(rep))[:, None], lp, 1e6)     # only the entries that stand for a group can be a cell's colour
    n = max(int(round(sp.w / scale)), 1)
    m = max(int(round(sp.h / scale)), 1)
    x0 = -(n * scale - sp.w) / 2
    y0 = sp.h - m * scale
    xs = [int(round(x0 + i * scale)) for i in range(n + 1)]
    ys = [int(round(y0 + j * scale)) for j in range(m + 1)]
    band = (lp[:, 0] < 32)[idx] & (sp.depth <= OUTLINE_BAND)
    pure = sp.mask & ((sp.depth >= PURE_DEPTH) | (dist < 9)) & ~band
    inside = pure & (sp.depth > 2)
    pair = np.sqrt(((lp[:, None, :] - lp[None]) ** 2).sum(-1))       # how far apart two palette colours look
    darkc = lp[:, 0] < DARK_L                              # the eye, the nose, the ink (the outline colour, entry 0, is drawn, not voted)
    darkc[0] = False
    fur = np.array(sorted(face_fur), int)
    solid = np.zeros((m, n), bool)
    for j in range(m):
        for i in range(n):
            blk = sp.mask[max(ys[j], 0):max(ys[j + 1], 0), max(xs[i], 0):max(xs[i + 1], 0)]
            solid[j, i] = blk.size > 0 and blk.mean() >= COVER
    solid = clean(solid)
    p = np.pad(solid, 1)
    ring = solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    out = np.full((m, n), -1, np.int16)
    for j in range(m):
        for i in range(n):
            if not solid[j, i]:
                continue
            if ring[j, i]:
                out[j, i] = 0
                continue
            sy, sx = slice(max(ys[j], 0), max(ys[j + 1], 0)), slice(max(xs[i], 0), max(xs[i + 1], 0))
            sel = pure[sy, sx]
            blk = sp.mask[sy, sx]
            if sel.sum() < 3:
                sel = blk & (idx[sy, sx] > 0)                  # a sliver by the edge: whatever is there that is not ink
                if sel.sum() == 0:
                    out[j, i] = 0
                    continue
            ids = idx[sy, sx][sel]
            # the cell's colour: the palette entry nearest the MEDIAN of its pixels (smooth shading stays one colour) ...
            med = np.median(sp.lab[sy, sx][sel], axis=0)
            base = int(((lpr - med) ** 2).sum(1).argmin())
            # ... unless a colour that stands out from it holds enough of the cell (an eye, a pen, a paw, a glass rim): then that one
            share = np.bincount(ids, minlength=len(pal)) / len(ids)
            far = (pair[base] >= FEATURE_DE) & (share >= feature * 0.5)
            far[0] = False
            if far.any():
                gate = np.where(darkc, feature * (0.5 if (fur.size and share[fur].sum() >= FUR_SHARE) else 1.0), feature)
                ok = far & (share >= gate)
                if ok.any():
                    base = int(np.where(ok, share, 0).argmax())
            out[j, i] = base
    return despeckle(out)


def despeckle(g: np.ndarray, common: float = 0.04) -> np.ndarray:
    """A common colour's cell with no 4-neighbour of its own colour takes its neighbours' majority (the fur's shading is not noise to keep); the rare colours (eye, pen, blush) stay."""
    ins = g[g >= 0]
    share = np.bincount(ins, minlength=int(ins.max()) + 1) / max(len(ins), 1)
    out = g.copy()
    h, w = g.shape
    for y in range(h):
        for x in range(w):
            c = g[y, x]
            if c <= 0 or share[c] < common:
                continue
            nb = [g[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= y + dy < h and 0 <= x + dx < w]
            if any(n == c for n in nb) or any(n < 0 for n in nb) or len(nb) < 4:
                continue
            vals, counts = np.unique(nb, return_counts=True)
            if counts.max() >= 2 and vals[counts.argmax()] > 0:
                out[y, x] = vals[counts.argmax()]
    return out


def clean(solid: np.ndarray) -> np.ndarray:
    p = np.pad(solid, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    solid = solid & (nb > 0)
    p = np.pad(solid, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    return solid | (~solid & (nb >= 4))


# ---------------------------------------------------------------- frames


def on(f: Frame) -> np.ndarray:
    return f[..., 3] > 0


def rgba(grid: np.ndarray, pal: np.ndarray) -> Frame:
    out = np.zeros(grid.shape + (4,), np.uint8)
    m = grid >= 0
    out[m, :3] = pal[grid[m]]
    out[m, 3] = 255
    return out


def torso_col(fig: Frame, jumper: set[tuple[int, int, int]]) -> float:
    """The mean column of the jumper in a figure (its torso: the middle of the body without the head, the tail or the paws)."""
    ys, xs = np.where(jumper_mask(fig, jumper))
    return float(xs.mean()) if len(xs) else (fig.shape[1] - 1) / 2


def place(fig: Frame, base: int, x0: int) -> Frame:
    """The figure in a FW x FH frame: its bottom row on `base`, its left column on `x0`."""
    h = fig.shape[0]
    out = np.zeros((FH, FW, 4), np.uint8)
    y0 = base - h + 1
    for y, x in zip(*np.where(on(fig))):
        ty, tx = y + y0, x + x0
        if 0 <= ty < FH and 0 <= tx < FW:
            out[ty, tx] = fig[y, x]
    return out


def left_for(fig: Frame, jumper: set[tuple[int, int, int]], at: float | None, centre: float) -> int:
    """The frame column of the figure's left edge: its torso on column `at` (the side views), or the middle of the figure on `centre`."""
    if at is not None:
        return int(round(at - torso_col(fig, jumper)))
    return int(round(centre - (fig.shape[1] - 1) / 2))


def reoutline(f: Frame, ol: tuple[int, int, int]) -> Frame:
    """Every drawn pixel with a clear 4-neighbour (or at the frame's edge) is the outline colour; one pixel holes are filled first (animal_rig.reoutline, any width)."""
    a = on(f)
    p = np.pad(a, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    hole = ~a & (nb >= 3)
    for y, x in zip(*np.where(hole)):
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < f.shape[0] and 0 <= xx < f.shape[1] and a[yy, xx]:
                f[y, x] = f[yy, xx]
                break
    a = on(f)
    p = np.pad(a, 1)
    edge = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    f[edge, 0], f[edge, 1], f[edge, 2] = ol
    return f


def one_piece(f: Frame) -> Frame:
    """Only the biggest 8-connected piece stays."""
    a = on(f)
    lab = np.zeros(a.shape, int)
    n = 0
    for y0, x0 in zip(*np.where(a)):
        if lab[y0, x0]:
            continue
        n += 1
        st = [(y0, x0)]
        lab[y0, x0] = n
        while st:
            y, x = st.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and a[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        st.append((yy, xx))
    if n > 1:
        f[(lab != np.bincount(lab.ravel())[1:].argmax() + 1) & (lab > 0)] = 0
    return f


def lift(f: Frame, seam: int, up: int) -> Frame:
    """Everything above row `seam` one row up (a breath); the seam row stays, so the bottom of the figure is where it was."""
    if not up:
        return f.copy()
    out = f.copy()
    out[: seam - up] = f[up: seam]
    out[seam - up: seam] = f[seam - 1]
    return out


def nod(f: Frame, neck: int) -> Frame:
    """The head (every row above `neck`) one row lower; the neck row repeats."""
    out = f.copy()
    out[S:neck] = f[: neck - S]
    out[:S] = 0
    return out


def jumper_mask(f: Frame, jumper: set[tuple[int, int, int]]) -> np.ndarray:
    """The jumper's pixels: a colour within JUMPER_DE (Lab) of the jumper's, in the frame (a shade merged into another colour is still the jumper)."""
    jl = srgb_to_lab(np.array(sorted(jumper), np.uint8))
    d = np.sqrt(((srgb_to_lab(f[..., :3])[..., None, :] - jl) ** 2).sum(-1)).min(-1)
    return (d < JUMPER_DE) & on(f)


def neck_row(f: Frame, jumper: set[tuple[int, int, int]]) -> int:
    """The first row (from the top) where the jumper is a fifth of the figure's width and stays so for 3 rows: where the head ends."""
    jm = jumper_mask(f, jumper)
    ys = np.where(on(f).any(1))[0]
    w = int(on(f).any(0).sum())
    for y in range(ys.min(), ys.max() - 2):
        if all(jm[y + k].sum() >= max(3, 0.2 * on(f)[y + k].sum()) for k in range(3)):
            return y
    return int((ys.min() + ys.max()) // 2)


def pen_box(f: Frame, face: str) -> tuple[slice, slice]:
    """Where the pen paw is: the lower third of the figure, on the pen side (the facing side for a profile, the viewer's left for the front view)."""
    ys, xs = np.where(on(f))
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    h, w = y1 - y0, x1 - x0
    rows = slice(int(y1 - 0.34 * h), y1)
    if face == "left":
        return rows, slice(x0, int(x0 + 0.30 * w))
    if face == "right":
        return rows, slice(int(x1 - 0.30 * w), x1)
    return rows, slice(x0, int(x0 + 0.36 * w))               # front: the pen is in the viewer's left paw


def stroke(f: Frame, face: str, dx: int) -> Frame:
    """The pen paw one column over (toward the body): the writing hand. Everything in the box moves; what it uncovers is re-filled from the figure."""
    if not dx:
        return f.copy()
    ry, rx = pen_box(f, face)
    out = f.copy()
    sub = f[ry, rx].copy()
    out[ry, rx] = 0
    inward = 1 if face in ("left", "front") else -1
    m = on(sub)
    ys, xs = np.where(m)
    for y, x in zip(ys, xs):
        tx = x + inward * dx
        if 0 <= tx < sub.shape[1]:
            out[ry][y, rx.start + tx] = sub[y, x]
        else:
            out[ry][y, rx.start + tx - sub.shape[1] + sub.shape[1]] = sub[y, x] if 0 <= rx.start + tx < f.shape[1] else 0
    # the body beside the box keeps what it had where the box now shows nothing and the old frame had the body
    keep = on(f) & ~on(out)
    keep[ry, rx] = False
    out[keep] = f[keep]
    return out


def loop(fig: Frame, face: str, base: int, x0: int, ol, jumper, paw: bool) -> list[Frame]:
    """The 6 frames of the working loop from the one drawn pose."""
    frames = []
    f0 = place(fig, base, x0)
    neck = neck_row(f0, jumper)
    for k in range(6):
        f = stroke(f0, face, STROKE[k]) if paw else f0.copy()
        f = lift(f, base - 3 * S, BREATH[k])
        if NOD[k]:
            f = nod(f, neck)
        frames.append(one_piece(reoutline(f, ol)))
    return frames


# ---------------------------------------------------------------- one animal


def sprites_for(sh: dict) -> dict[str, dict[str, tuple[Sprite, np.ndarray]]]:
    rgb = np.array(Image.open(ROOT / sh["source"]).convert("RGB"))
    fg, labels, order, boxes = cut_sheet(rgb, len(sh["rows"]), len(sh["cols"]))
    out: dict[str, dict[str, Sprite]] = {}
    for r, an in enumerate(sh["rows"]):
        out[an] = {}
        for c, face in enumerate(sh["cols"]):
            lab = order[r * len(sh["cols"]) + c]
            out[an][face] = Sprite(rgb, labels == lab)
    return out


def build_animal(an_id: str, sprites: dict[str, Sprite], c: dict) -> dict:
    """The 30 seated frames of an animal (sit right 6, sit left 6, phone 6, read 6, stool 6) and the palette they use."""
    global SAMPLES_RGB
    meta = json.loads((OUT_DIR / f"{an_id}{SUFFIX}.json").read_text())
    base_pal = np.array([hex_rgb(h) for h in meta["palette"][: meta.get("basePalette", len(meta["palette"]))]], np.uint8)
    reg = {a["id"]: a for a in json.loads(sheet.REGISTRY.read_text())}[an_id]
    jumper = {hex_rgb(h) for h in reg["jumper"]}
    ac = c["animals"][an_id]
    # the colours of the new art: the inside pixels of the four sprites
    inside = np.concatenate([sp.rgb[sp.mask & (sp.depth > OUTLINE_BAND)].reshape(-1, 3) for sp in sprites.values()])
    SAMPLES_RGB = inside[:: max(1, len(inside) // 60000)]
    pal = extend_palette(base_pal, srgb_to_lab(SAMPLES_RGB))
    jidx = [i for i, p in enumerate(pal) if tuple(int(v) for v in p) in jumper]
    an = sheet.BY_ID[an_id]
    lp = srgb_to_lab(pal)
    fur = set(sheet.named(lp, an.fur)) if an.fur else {i for i in range(1, len(pal)) if lp[i, 0] > 80 and i not in jidx}     # the face's fur: as the config names it, or the creams
    lpa = srgb_to_lab(pal)
    use = np.zeros(len(pal))
    for sp in sprites.values():
        use += np.bincount(((sp.lab[sp.mask & (sp.depth > 2)][:, None, :] - lpa) ** 2).sum(-1).argmin(-1), minlength=len(pal))
    rep = reps_of(pal, use, ac.get("merge", MERGE_DE if S == 1 else MERGE_DE_HI))
    grids = {face: to_grid(sp, pal, ac["scale"] / S, ac.get("dark", 1.8), jidx, fur, rep, ac.get("feature", FEATURE_SHARE)) for face, sp in sprites.items()}
    ol = tuple(int(v) for v in pal[0])
    P = pose_cfg(c)
    fig = {face: rgba(g, pal) for face, g in grids.items()}
    sh, fr, bk = P["side"], P["front"], P["back"]
    # the side views: the torso on the same column for the pair, mirrored about the frame's middle (the left view is the right's reflection in placing, not in art)
    lf, rg = fig["left"], fig["right"]
    left = loop(lf, "left", sh["base"], left_for(lf, jumper, FW - 1 - sh["torso"], 0), ol, jumper, True)
    right = loop(rg, "right", sh["base"], left_for(rg, jumper, sh["torso"], 0), ol, jumper, True)
    ft = fig["front"]
    nk = neck_row(ft, jumper) - int(np.where(on(ft).any(1))[0].min())               # rows from the top of the figure to its neck
    front = loop(ft, "front", fr["neck"] + (ft.shape[0] - nk) - 1, left_for(ft, jumper, None, fr["cx"]), ol, jumper, True)
    bg = fig["back"][: fig["back"].shape[0] - bk.get("cut", 0)] if bk.get("cut", 0) else fig["back"]
    back = loop(bg, "back", bk["base"], left_for(bg, jumper, None, bk["cx"]), ol, jumper, False)
    return {"pal": pal, "frames": right + left + front + front + back, "base_n": len(base_pal), "fig": fig}


def splice(an_id: str, built: dict, sh: dict) -> None:
    png = OUT_DIR / f"{an_id}{SUFFIX}.png"
    strip = np.array(Image.open(png).convert("RGBA"))
    old = strip.copy()
    for i, f in enumerate(built["frames"]):
        strip[:, (48 + i) * FW:(49 + i) * FW] = f
    assert (strip[:, : 48 * FW] == old[:, : 48 * FW]).all(), "idle and walk must not change"
    Image.fromarray(strip, "RGBA").save(png, optimize=True)
    meta = json.loads((OUT_DIR / f"{an_id}{SUFFIX}.json").read_text())
    base_n = meta.get("basePalette", len(meta["palette"]))
    meta["basePalette"] = base_n
    meta["palette"] = meta["palette"][:base_n] + [to_hex(c) for c in built["pal"][base_n:]]
    meta["sit"] = {"kind": "drawn", "source": sh["source"], "scale": json.loads(CONFIG.read_text())["animals"][an_id]["scale"] / S,
                   "poses": {"sit right": "right", "sit left": "left", "phone": "front", "read": "front", "stool": "back"},
                   "loop": "breath, nod and pen stroke synthesised from the one drawn pose (animal_sit.py)", "tool": "tools/art/animal_sit.py"}
    (OUT_DIR / f"{an_id}{SUFFIX}.json").write_text(json.dumps(meta, indent=2) + "\n")
    sheet.preview(strip, PREVIEW_DIR / (f"{an_id}-8x.png" if S == 1 else f"{an_id}{SUFFIX}-4x.png"), zoom=6 if S == 1 else 4)


def head_width(f: Frame, jumper: set[tuple[int, int, int]]) -> int:
    """The width of the head: the columns drawn above the neck row."""
    neck = neck_row(f, jumper)
    ys = np.where(on(f).any(1))[0]
    xs = np.where(on(f)[ys.min():neck].any(0))[0]
    return int(xs.max() - xs.min() + 1) if len(xs) else 0


FACE_OF = {"sit right": ("right", 0), "sit left": ("left", 12), "front": ("front", 18), "back": ("back", 6)}   # seated facing -> the standing idle frame of the same facing


def standing_heads(an_id: str, jumper) -> dict[str, int]:
    strip = np.array(Image.open(OUT_DIR / f"{an_id}{SUFFIX}.png").convert("RGBA"))
    return {k: head_width(strip[:, i * FW:(i + 1) * FW], jumper) for k, (_, i) in FACE_OF.items()}


def seated_heads(an_id: str, jumper) -> dict[str, int]:
    strip = np.array(Image.open(OUT_DIR / f"{an_id}{SUFFIX}.png").convert("RGBA"))
    first = {"sit right": 48, "sit left": 54, "front": 66, "back": 72}
    return {k: head_width(strip[:, i * FW:(i + 1) * FW], jumper) for k, i in first.items()}


def measure(c: dict, sh: dict, sp) -> None:
    """For each animal: the head widths of the standing idle frames and the seated frames at the config's scale and at others (to set `scale`)."""
    reg = {a["id"]: a for a in json.loads(sheet.REGISTRY.read_text())}
    global SAMPLES_RGB
    for an_id in sh["rows"]:
        jumper = {hex_rgb(h) for h in reg[an_id]["jumper"]}
        meta = json.loads((OUT_DIR / f"{an_id}.json").read_text())
        base_pal = np.array([hex_rgb(h) for h in meta["palette"][: meta.get("basePalette", len(meta["palette"]))]], np.uint8)
        st = standing_heads(an_id, jumper)
        print(f"{an_id}: standing head widths {st}")
        best = None
        for scale in (7.6, 7.9, 8.2, 8.5, 8.8, 9.1, 9.4, 9.7):
            cc = json.loads(json.dumps(c))
            cc["animals"][an_id]["scale"] = scale
            b = build_animal(an_id, sp[an_id], cc)
            fr = {"sit right": b["frames"][0], "sit left": b["frames"][6], "front": b["frames"][18], "back": b["frames"][24]}
            hs = {k: head_width(f, jumper) for k, f in fr.items()}
            err = np.mean([abs(hs[k] - st[k]) for k in st])
            print(f"   scale {scale}: seated heads {hs}  mean error {err:.2f}")
            if best is None or err < best[0]:
                best = (err, scale)
        print(f"   best {best[1]} (error {best[0]:.2f}), config {c['animals'][an_id]['scale']}")


def detail(out: Path, sheet_no: int = 1) -> None:
    """A comparison picture (not used by the engine): each animal's four seated poses at the engine's scale and at 2x detail (half the source px per art px),
    both at the same physical size, on the room's floor colour. The 2x version is 2x2 as many pixels: 40 to 48 columns, which the 34 wide frame cannot hold."""
    c = cfg()
    sh = c["sheets"][sheet_no - 1]
    sp = sprites_for(sh)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for an_id in sh["rows"]:
        pair = []
        for k in (1, 2):
            cc = json.loads(json.dumps(c))
            cc["animals"][an_id]["scale"] = c["animals"][an_id]["scale"] / k
            fig = build_animal(an_id, sp[an_id], cc)["fig"]
            tiles = []
            for face in sh["cols"]:
                f = fig[face]
                t = np.zeros((56 * k, 56 * k, 4), np.uint8)
                t[:] = (120, 92, 70, 255)
                h, w = f.shape[:2]
                y0, x0 = 56 * k - h - 2 * k, (56 * k - w) // 2
                m = f[..., 3] > 0
                t[y0:y0 + h, x0:x0 + w][m] = f[m]
                tiles.append(np.kron(t, np.ones((8 // k, 8 // k, 1), np.uint8)))
            pair.append(np.concatenate(tiles, axis=1))
        rows.append(np.concatenate(pair, axis=0))
    Image.fromarray(np.concatenate(rows, axis=0)[..., :3]).save(out / "seated-engine-vs-2x.png")
    print(f"wrote {out / 'seated-engine-vs-2x.png'} (per animal: the engine's scale above, 2x detail below)")


def apply(ids: list[str] | None = None, sheet_no: int = 1, dry: str | None = None, hires: int = 1) -> list[str]:
    """Splices the seated frames of every animal of the sheet (or of `ids`) into its strip; returns the ids done. animal_sheet.py calls this after it has
    rebuilt a strip, so a rebuilt animal keeps its drawn seated frames."""
    c = cfg()
    sh = c["sheets"][sheet_no - 1]
    todo = [i for i in sh["rows"] if not ids or i in ids]
    if not todo:
        return []
    set_scale(hires)
    sp = sprites_for(sh)
    for an_id in todo:
        built = build_animal(an_id, sp[an_id], c)
        if dry:
            preview_dry(an_id, built, Path(dry))
        else:
            splice(an_id, built, sh)
        print(f"{an_id}: seated frames drawn, palette {len(built['pal'])} (was {built['base_n']})")
    return todo


def preview_dry(an_id: str, built: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    sheet_img = np.concatenate([np.concatenate(built["frames"][r * 6:(r + 1) * 6], axis=1) for r in range(5)], axis=0)
    bg = np.zeros(sheet_img.shape[:2] + (3,), np.uint8)
    bg[:] = (120, 92, 70)
    im = np.where(sheet_img[..., 3:4] > 0, sheet_img[..., :3], bg).astype(np.uint8)
    Image.fromarray(im).resize((im.shape[1] * 6, im.shape[0] * 6), Image.NEAREST).save(out / f"{an_id}-sit.png")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ingest", metavar="FILE")
    ap.add_argument("--id", action="append")
    ap.add_argument("--sheet", type=int, default=1)
    ap.add_argument("--measure", action="store_true", help="print the head widths of the standing and the seated frames at several scales")
    ap.add_argument("--hires", type=int, default=1, help="write the seated frames of the <id>@Nx.png strips (animal_sheet.py --hires N builds them first)")
    ap.add_argument("--detail", metavar="DIR", help="write a comparison of the seated poses at the engine scale and at 2x detail into DIR (not used by the engine)")
    ap.add_argument("--dry", metavar="DIR", help="write only previews of the 30 seated frames per animal into DIR (the strips are not changed)")
    a = ap.parse_args(argv)
    if a.ingest:
        ingest(Path(a.ingest), a.sheet)
        return 0
    if a.detail:
        detail(Path(a.detail), a.sheet)
        return 0
    if a.measure:
        c = cfg()
        sh = c["sheets"][a.sheet - 1]
        measure(c, sh, sprites_for(sh))
        return 0
    apply(a.id, a.sheet, a.dry, a.hires)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
