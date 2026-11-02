#!/usr/bin/env python3
"""
Turns the ChatGPT ground swatches (docs/study/art/source/ground-swatches.png, 1536 x 1024, 12 x 8 cells of 128 x 128) into a measured,
seam-checked ground tile set.

    python3 tools/art/ground_tiles.py      # writes docs/study/art/town/{town-ground.png,town-ground-32.png,town-ground.json,
                                           #   ground-contact.png,ground-contact-32.png,ground-seams.png}

WHAT THE SOURCE IS (measured, not assumed). The request was 16 x 16 art pixels at 8 canvas pixels each. What was drawn is 32 x 32
NATIVE pixels per cell at exactly 4.0 canvas pixels each (the edge energy of every cell folds on a period of 4.0, phase 0, in both axes:
`native_pixel()` re-measures it), so the swatches are twice as fine as asked. A 2 canvas pixel soft grid line is drawn on every cell
boundary (x = 128 k +- 1) and the cell's own outermost pixels are a little darker than the rest of the cell (a vignette): both are in
the picture and neither belongs in a tile.

METHOD.
  1. SNAP. A cell is 32 x 32 native pixels. Each native pixel is the mean of the inner 2 x 2 canvas pixels of its 4 x 4 block (the
     outer ring of the block holds the anti-aliasing, the grid line and the vignette). One palette (k-means, Lab, 40 colours, fixed seed)
     is built over all 98 304 native pixels and colours closer than 3.2 dE are merged (k-means splits the flat grass into shades that differ
     from tile to tile: a faint square on every tile); every pixel is the nearest colour, so the vignette and the JPEG-like noise snap to the
     palette.
  2. MEASURE. Tile it 3 x 3 (`ground-seams.png`) and compare the WRAPPED seam (column 31 next to column 0, row 31 next to row 0) with
     the 31 + 31 neighbouring lines inside the tile: for each line, the mean CIE76 dE of its 32 pixel pairs and the fraction of pairs with
     dE above 12 ("hard"). One line is a small sample (a line through a flower is busier than the tile's mean), so the wrapped line is
     judged against the BUSIEST inside line, not their mean; it must be no busier in either number (small slack), on both axes. That is
     SEAMLESS. A real break is far outside that (a brick wall cut across: wrapped 14.7 dE and 67% hard pairs against a busiest inside line
     of about 11 dE and 45%), while a perfect tile still has a one in thirty chance that its wrapped line is the busiest.
  3. REPAIR (fills only, rows 1 to 6, deterministic). A tile that passes as drawn (the content keeps off its border: all grass, most
     leaves and flowers) only has its outer ring replaced by the pixels next to it (`method: "ring"`), if it still passes. Any other tile is
     HEALED (`method: "heal"`): it is rolled by (16, 16) so the seam lies in the middle; then on each
     axis a band of 6 columns is rebuilt from the mirror of the pixels on the near side (continuous with them by construction) and joined
     to the original far side along a minimum cost cut (dynamic programming: the cut moves at most one column a row and sits where the
     two candidates agree best). Only whole palette pixels are copied, so nothing is blurred. The edge pieces (rows 7 and 8) are NOT
     repaired: their borders are designed to meet a neighbour and are only measured (see below).
  4. REDUCE. `town-ground.png` is the 16 x 16 art pixel tile the brief asked for: every 2 x 2 native block is reduced to its most
     frequent palette colour (ties go to the rarer colour, so a flower or a tuft pixel is not voted away). `town-ground-32.png` is the
     native 32 x 32 tile. Both come from the same repaired native tile.
  5. CLASSIFY the 24 edge pieces by script (they are drawn in an arbitrary order): each native pixel is grass or "other" (plaza brick or
     dirt) by hue (green dominant), cleaned by a 3 x 3 majority vote so the moss and the tufts do not count; each of the four sides
     (outer 3 pixels) is pure grass (< 8% other), pure other (> 92%) or mixed; the four quadrants give the corner. See `classify()`.
  6. JOIN SCORE. For each side of each edge piece, the best (lowest mean dE) match against the facing side of every tile in the set
     (fills, other edge pieces, with rotations of the piece NOT allowed, so it reports what the sheet draws): a piece whose pure
     sides cannot meet any fill is not usable as a border.
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
SRC = ROOT / "docs/study/art/source/ground-swatches.png"
OUT = ROOT / "docs/study/art/town"
CELL, N, BLK = 128, 32, 4
KINDS = ["grass_a", "grass_flower", "grass_leaves", "plaza", "plaza_mossy", "dirt", "plaza_edge", "dirt_edge"]
FILL_ROWS = 6
COLOURS = 40
BAND = 6                       # the repair band, in native pixels
MEAN_SLACK = 0.5               # dE above the 90th percentile inside line
HARD_SLACK = 0.04
HARD_DE = 12.0
MERGE_DE = 3.2
PURE = 0.08


# ---------------------------------------------------------------- snap


def native_pixel(rgb: np.ndarray) -> tuple[float, float]:
    """The pixel size of the picture along x and y, re-measured: the period (3.6 to 4.5) on which the edge energy of a clean cell folds."""
    out = []
    for axis in (1, 0):
        d = np.abs(np.diff(rgb[8:120, 8:120].astype(float), axis=axis)).sum(2).sum(1 - axis)
        pos = np.arange(len(d))
        best = max((abs((d * np.exp(2j * np.pi * pos / p)).sum()), p) for p in np.arange(3.6, 4.5, 0.02))
        out.append(round(float(best[1]), 2))
    return out[0], out[1]


def cells(rgb: np.ndarray) -> np.ndarray:
    """(8, 12, 32, 32, 3) float native pixels: the mean of the inner 2 x 2 of each 4 x 4 block."""
    out = np.zeros((8, 12, N, N, 3))
    for r in range(8):
        for c in range(12):
            cell = rgb[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL].astype(float)
            out[r, c] = cell.reshape(N, BLK, N, BLK, 3)[:, 1:3, :, 1:3, :].mean((1, 3))
    return out


# ---------------------------------------------------------------- measure


def de_table(pal: np.ndarray) -> np.ndarray:
    lab = A.srgb_to_lab(pal)
    return np.sqrt(((lab[:, None, :] - lab[None]) ** 2).sum(-1))


def seam(t: np.ndarray, de: np.ndarray) -> dict:
    """The wrapped seam (column 31 next to column 0, row 31 next to row 0) against the other 31 + 31 neighbouring lines of the same tile.
    One line is only 32 pixel pairs and a line through a flower is naturally busier than the tile's mean, so the wrapped line is judged
    against the distribution of the inside lines, not their mean: it must be no busier than the 90th percentile of them, both in mean dE
    and in the fraction of hard pairs (dE > 12), each with a small slack. Both axes must pass."""
    out = {}
    ok = True
    for name, a, b in (("x", t[:, :-1], t[:, 1:]), ("y", t[:-1], t[1:])):
        axis_wrap = (t[:, -1], t[:, 0]) if name == "x" else (t[-1], t[0])
        d_in = de[a, b]                                        # (32, 31) for x ; (31, 32) for y
        lines = d_in.mean(0 if name == "x" else 1) if False else (d_in.mean(0) if name == "x" else d_in.mean(1))
        hard_lines = (d_in > HARD_DE).mean(0 if name == "x" else 1)
        w = de[axis_wrap[0], axis_wrap[1]]
        wm, wh = float(w.mean()), float((w > HARD_DE).mean())
        qm, qh = float(lines.max()), float(hard_lines.max())
        out[name] = {"wrapDE": round(wm, 2), "insideMeanDE": round(float(d_in.mean()), 2), "insideMaxDE": round(qm, 2),
                     "wrapHard": round(wh, 3), "insideMaxHard": round(qh, 3)}
        ok &= bool(wm <= qm + MEAN_SLACK and wh <= qh + HARD_SLACK)
    out["excess"] = round((out["x"]["wrapDE"] + out["y"]["wrapDE"]) / 2 - (out["x"]["insideMeanDE"] + out["y"]["insideMeanDE"]) / 2, 2)
    out["insideDE"] = round((out["x"]["insideMeanDE"] + out["y"]["insideMeanDE"]) / 2, 2)
    out["seamless"] = ok
    return out


# ---------------------------------------------------------------- repair


def heal_axis(t: np.ndarray, de: np.ndarray, k: int = BAND) -> np.ndarray:
    """t is rolled so the cell's outer ring (columns 31 and 0 of the drawn cell: the grid line and the vignette) lies in columns 15 and 16.
    Rebuild columns 15 .. 15 + k - 1 from the mirror of the clean left side (column 14 outwards) and join them to the original right side
    (clean from column 17) along a minimum cost cut. The cut may not fall before column 17, so the ring never survives."""
    h = t.shape[0]
    mir = t[:, 14::-1][:, :k]                      # mirror[:, m] = t[:, 14 - m], placed at column 15 + m
    orig = t[:, 15:15 + k]
    after = t[:, 15 + k]                           # the first untouched column
    cost = np.full((h, k + 1), 1e6)                # cut at c: columns 15 .. 15 + c - 1 are mirror, the rest original
    for c in range(2, k + 1):
        cost[:, c] = de[mir[:, c - 1], orig[:, c] if c < k else after]
    acc = cost.copy()
    back = np.zeros((h, k + 1), int)
    for r in range(1, h):
        for c in range(k + 1):
            lo, hi = max(c - 1, 0), min(c + 1, k)
            j = lo + int(np.argmin(acc[r - 1, lo:hi + 1]))
            acc[r, c] = cost[r, c] + acc[r - 1, j]
            back[r, c] = j
    c = int(np.argmin(acc[-1]))
    cuts = np.zeros(h, int)
    for r in range(h - 1, -1, -1):
        cuts[r] = c
        c = back[r, c]
    out = t.copy()
    for r in range(h):
        for m in range(k):
            out[r, 15 + m] = mir[r, m] if m < cuts[r] else orig[r, m]
    return out


def ring_extend(t: np.ndarray) -> np.ndarray:
    """An edge piece's outer ring is the grid line and vignette too, and its borders must meet neighbours: copy the clean pixel next to it."""
    t = t.copy()
    t[:, 0], t[:, -1] = t[:, 1], t[:, -2]
    t[0], t[-1] = t[1], t[-2]
    return t


def repair(t: np.ndarray, de: np.ndarray) -> np.ndarray:
    t = np.roll(t, (16, 16), (0, 1))
    t = heal_axis(t, de)
    t = heal_axis(t.T, de).T
    return t


# ---------------------------------------------------------------- reduce


def reduce16(t: np.ndarray, rarity: np.ndarray) -> np.ndarray:
    out = np.zeros((16, 16), t.dtype)
    for y in range(16):
        for x in range(16):
            blk = t[2 * y:2 * y + 2, 2 * x:2 * x + 2].ravel()
            cnt = np.bincount(blk, minlength=len(rarity))
            top = cnt.max()
            cand = np.where(cnt == top)[0]
            out[y, x] = cand[np.argmin(rarity[cand])]
    return out


# ---------------------------------------------------------------- classify the edge pieces


def other_mask(t: np.ndarray, pal: np.ndarray) -> np.ndarray:
    p = pal[t].astype(int)
    grass = p[..., 1] >= p[..., 0] - 3                        # green dominant (grass); brick and dirt are red or orange dominant
    pad = np.pad(grass, 1, mode="edge")
    votes = sum(pad[1 + dy:1 + dy + N, 1 + dx:1 + dx + N].astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    return ~(votes >= 5)


def classify(t: np.ndarray, pal: np.ndarray) -> dict:
    o = other_mask(t, pal)
    sides = {"N": o[:3].mean(), "S": o[-3:].mean(), "W": o[:, :3].mean(), "E": o[:, -3:].mean()}
    state = {k: ("other" if v > 1 - PURE else "grass" if v < PURE else "mixed") for k, v in sides.items()}
    quad = {"NW": o[:16, :16].mean(), "NE": o[:16, 16:].mean(), "SW": o[16:, :16].mean(), "SE": o[16:, 16:].mean()}
    frac = float(o.mean())
    pure_o = [k for k, v in state.items() if v == "other"]
    pure_g = [k for k, v in state.items() if v == "grass"]
    opp = {"N": "S", "S": "N", "E": "W", "W": "E"}
    kind = name = None
    if len(pure_o) == 1 and opp[pure_o[0]] in pure_g:
        kind, name = "edge", f"edge_{pure_o[0]}"               # the other material lies on this side
    elif len(pure_g) == 2 and set(pure_g) in ({"N", "W"}, {"N", "E"}, {"S", "W"}, {"S", "E"}):
        corner = ("S" if "N" in pure_g else "N") + ("E" if "W" in pure_g else "W")
        kind, name = "outer", f"outer_{corner}"                # the other material is a minor piece in this corner
    elif len(pure_o) == 2 and set(pure_o) in ({"N", "W"}, {"N", "E"}, {"S", "W"}, {"S", "E"}):
        corner = ("S" if "N" in pure_o else "N") + ("E" if "W" in pure_o else "W")
        kind, name = "inner", f"inner_{corner}"                # grass is a minor piece in this corner
    return {"shape": kind, "name": name, "sides": {k: round(float(v), 2) for k, v in sides.items()}, "state": state,
            "quadrants": {k: round(float(v), 2) for k, v in quad.items()}, "otherFraction": round(frac, 2)}


EXPECTED = [f"edge_{s}" for s in "NESW"] + [f"outer_{c}" for c in ("NE", "SE", "SW", "NW")] + [f"inner_{c}" for c in ("NE", "SE", "SW", "NW")]


def side_strip(t: np.ndarray, side: str) -> np.ndarray:
    return {"N": t[0], "S": t[-1], "W": t[:, 0], "E": t[:, -1]}[side]


def facing(t: np.ndarray, side: str) -> np.ndarray:
    return side_strip(t, {"N": "S", "S": "N", "W": "E", "E": "W"}[side])


def join_scores(tiles: dict[str, np.ndarray], de: np.ndarray, who: str, sides: list[str]) -> dict:
    """For each given side of tile `who`: the best neighbour (mean dE of the facing pixel row) among all other tiles (and itself for
    the sides that run along the edge). Returns {side: (best dE, neighbour)}."""
    res = {}
    t = tiles[who]
    for s in sides:
        a = side_strip(t, s)
        best = (1e9, None)
        for k, u in tiles.items():
            d = float(de[a, facing(u, s)].mean())
            if d < best[0]:
                best = (d, k)
        res[s] = (round(best[0], 2), best[1])
    return res


# ---------------------------------------------------------------- build


def merge_close(pal: np.ndarray, idx: np.ndarray, limit: float = MERGE_DE) -> tuple[np.ndarray, np.ndarray]:
    """k-means splits a flat grass into shades 2 to 3 dE apart that differ from tile to tile (a faint square on every tile of the field).
    Merge palette colours closer than `limit` dE, the rarer into the commoner, until none are."""
    pal = pal.copy()
    cnt = np.bincount(idx.ravel(), minlength=len(pal)).astype(float)
    alive = np.ones(len(pal), bool)
    remap = np.arange(len(pal))
    while True:
        d = de_table(pal)
        d[~alive] = 1e9
        d[:, ~alive] = 1e9
        np.fill_diagonal(d, 1e9)
        i, j = np.unravel_index(np.argmin(d), d.shape)
        if d[i, j] >= limit:
            break
        keep, drop = (i, j) if cnt[i] >= cnt[j] else (j, i)
        cnt[keep] += cnt[drop]
        alive[drop] = False
        remap[remap == drop] = keep
    new_id = np.cumsum(alive) - 1
    return pal[alive], new_id[remap][idx]


def build():
    rgb = np.array(Image.open(SRC).convert("RGB"))
    px = native_pixel(rgb[:128, :128])
    nat = cells(rgb)
    pal = A.build_palette(nat.reshape(-1, 3).astype(np.uint8), COLOURS)
    idx, _ = A.nearest(A.srgb_to_lab(pal), A.srgb_to_lab(nat.reshape(-1, 3)))
    idx = idx.reshape(8, 12, N, N)
    pal, idx = merge_close(pal, idx)
    de = de_table(pal)
    rarity = np.bincount(idx.ravel(), minlength=len(pal)).astype(float)
    t32: dict[str, np.ndarray] = {}
    recs: list[dict] = []
    for r in range(8):
        for c in range(12):
            name = f"{KINDS[r]}_{c + 1:02d}"
            t = idx[r, c]
            rec = {"id": name, "row": r, "col": c, "kind": KINDS[r], "fill": r < FILL_ROWS, "derived": False}
            rec["seamAsDrawn"] = seam(t, de)
            if r < FILL_ROWS:
                rec["method"] = "heal"
                if rec["seamAsDrawn"]["seamless"]:                 # content stays off the border: only the ring is wrong
                    ext = ring_extend(t)
                    if seam(ext, de)["seamless"]:
                        t, rec["method"] = ext, "ring"
                if rec["method"] == "heal":
                    t = repair(t, de)
                rec["seam"] = seam(t, de)
                rec["usable"] = rec["seam"]["seamless"]
            else:
                t = ring_extend(t)
            t32[name] = t
            recs.append(rec)
    fills = {x["id"]: t32[x["id"]] for x in recs if x["fill"] and x["usable"]}
    inside = {}
    for fam in ("grass", "plaza", "dirt"):
        v = [x["seam"]["insideDE"] for x in recs if x["fill"] and x["id"].startswith(fam)]
        inside[fam] = float(np.mean(v))
    for rec in recs:
        if not rec["fill"]:
            rec["material"] = "plaza" if rec["kind"] == "plaza_edge" else "dirt"
    for rec in recs:
        if rec["fill"]:
            continue
        t = t32[rec["id"]]
        rec.update(classify(t, pal))
        fam = "plaza" if rec["kind"] == "plaza_edge" else "dirt"
        rec["material"] = fam
        joins = {}
        for s_ in "NESW":
            st = rec["state"][s_]
            if st == "mixed":
                joins[s_] = {"state": st}
                continue
            pool = {k: v for k, v in fills.items() if k.startswith("grass" if st == "grass" else fam)}
            a = side_strip(t, s_)
            d = min(float(de[a, facing(v, s_)].mean()) for v in pool.values())
            lim = inside["grass" if st == "grass" else fam] + JOIN_SLACK
            joins[s_] = {"state": st, "fillDE": round(d, 2), "limit": round(lim, 2), "ok": bool(d <= lim)}
        mates = {x["id"]: t32[x["id"]] for x in recs if not x["fill"] and x.get("material") == fam}
        mates[rec["id"]] = t
        for s_, j in joins.items():
            if j["state"] == "mixed":
                a = side_strip(t, s_)
                ds = {k: float(de[a, facing(v, s_)].mean()) for k, v in mates.items()}
                k = min(ds, key=ds.get)
                j["mate"], j["mateDE"], j["mateLimit"] = k, round(ds[k], 2), round(inside[fam] + JOIN_SLACK, 2)
        rec["joins"] = joins
        rec["joinsOK"] = all(j.get("ok", True) for j in joins.values())
    # derived rotations for the classes the sheet did not draw
    have = {}
    for rec in recs:
        if not rec["fill"] and rec["name"]:
            have.setdefault((rec["material"], rec["name"]), []).append(rec)
    return rgb, px, pal, de, rarity, idx, t32, recs, fills, inside, have


JOIN_SLACK = 3.0
ROT180 = {"N": "S", "S": "N", "E": "W", "W": "E", "NE": "SW", "SW": "NE", "NW": "SE", "SE": "NW"}


def best_of(have, material, name):
    rs = have.get((material, name), [])
    rs = sorted(rs, key=lambda r: (not r["joinsOK"], sum(j.get("fillDE", 0) for j in r["joins"].values())))
    return rs


def derive(t32, recs, have, de, rarity, pal):
    """The classes the sheet drew no piece for are the 180 degree rotation of the opposite piece (grass and brick are flat, so lit from
    any side). They are appended as `<kind>_d<NN>` and flagged `derived`."""
    extra = []
    for material, kind in (("plaza", "plaza_edge"), ("dirt", "dirt_edge")):
        for name in EXPECTED:
            if have.get((material, name)):
                continue
            kindname, suffix = name.split("_")
            src_name = f"{kindname}_{ROT180[suffix]}"
            srcs = best_of(have, material, src_name)
            if not srcs:
                continue
            s0 = srcs[0]
            t = np.rot90(t32[s0["id"]], 2).copy()
            rid = f"{kind}_d{len(extra) // 1 + 1:02d}"
            rec = {"id": rid, "row": 8, "col": len(extra), "kind": kind, "fill": False, "derived": True, "from": s0["id"], "transform": "rot180"}
            rec.update(classify(t, pal))
            rec["material"] = material
            rec["joins"] = {}
            for k_, v in s0["joins"].items():
                rec["joins"][ROT180[k_]] = v
            rec["joinsOK"] = s0["joinsOK"]
            t32[rid] = t
            recs.append(rec)
            have.setdefault((material, rec["name"]), []).append(rec)
            extra.append(rid)
    return extra


# ---------------------------------------------------------------- pictures


def render(t: np.ndarray, pal: np.ndarray) -> np.ndarray:
    return pal[t]


def seams_picture(t32, recs, pal, idx, de) -> Image.Image:
    """For one tile of each fill kind: as drawn 3 x 3, repaired 3 x 3, with the numbers."""
    z = 3
    names = [f"{k}_01" for k in KINDS[:FILL_ROWS]]
    w = 96 * z
    img = Image.new("RGB", (2 * w + 30, len(names) * (w + 14) + 4), (40, 34, 38))
    d = ImageDraw.Draw(img)
    for n, name in enumerate(names):
        rec = next(r for r in recs if r["id"] == name)
        before = np.tile(idx[rec["row"], rec["col"]], (3, 3))
        after = np.tile(t32[name], (3, 3))
        for j, tile in enumerate((before, after)):
            im = Image.fromarray(render(tile, pal)).resize((w, w), Image.NEAREST)
            img.paste(im, (10 + j * (w + 10), 2 + n * (w + 14)))
        d.text((12, n * (w + 14) + w + 2), f"{name} as drawn: wrap dE {rec['seamAsDrawn']['x']['wrapDE']}/{rec['seamAsDrawn']['y']['wrapDE']} vs inside {rec['seamAsDrawn']['insideDE']}", fill=(255, 255, 255))
        d.text((22 + w, n * (w + 14) + w + 2), f"repaired: wrap dE {rec['seam']['x']['wrapDE']}/{rec['seam']['y']['wrapDE']} vs inside {rec['seam']['insideDE']}", fill=(255, 255, 255))
    return img


class Patch:
    def __init__(self, recs, t32, t16, pal, have, seed=3):
        self.t32, self.t16, self.pal = t32, t16, pal
        self.rng = np.random.default_rng(seed)
        self.recs = recs
        self.have = have
        self.grass = {k: [r["id"] for r in recs if r["fill"] and r["usable"] and r["kind"] == k] for k in KINDS[:3]}
        self.fill = {k: [r["id"] for r in recs if r["fill"] and r["usable"] and r["kind"] == k] for k in KINDS}

    def edge(self, material, name):
        rs = best_of(self.have, material, name)
        return [r["id"] for r in rs]

    def cost(self, a, b, d, de):
        """dE between tile a's side d and the facing side of b."""
        return float(de[side_strip(self.t32[a], d), facing(self.t32[b], d)].mean())

    def grass_tile(self, last):
        while True:
            kind = self.rng.choice(KINDS[:3], p=[0.62, 0.2, 0.18])
            i = self.rng.choice(self.grass[kind])
            if i not in last:
                return i

    def compose(self, tiles: dict[str, np.ndarray], z: int, de, cols=12, rows=8) -> Image.Image:
        size = next(iter(tiles.values())).shape[0]
        grid = [[None] * cols for _ in range(rows)]
        # plaza: interior (cols 3..6, rows 1..2) with its ring; path: three rows 5..7 (edge, fill, edge) across the patch
        pr0, pr1, pc0, pc1 = 1, 2, 3, 6
        for r in range(rows):
            for c in range(cols):
                last = {grid[r][c - 1] if c else None, grid[r - 1][c] if r else None}
                grid[r][c] = self.grass_tile(last)
        plain = self.fill["plaza"] + self.fill["plaza_mossy"][:2]
        for r in range(pr0, pr1 + 1):
            for c in range(pc0, pc1 + 1):
                grid[r][c] = str(self.rng.choice(plain))
        ring = {}
        for c in range(pc0, pc1 + 1):
            ring[(pr0 - 1, c)] = ("plaza", "edge_S")
            ring[(pr1 + 1, c)] = ("plaza", "edge_N")
        for r in range(pr0, pr1 + 1):
            ring[(r, pc0 - 1)] = ("plaza", "edge_E")
            ring[(r, pc1 + 1)] = ("plaza", "edge_W")
        ring[(pr0 - 1, pc0 - 1)] = ("plaza", "outer_SE")
        ring[(pr0 - 1, pc1 + 1)] = ("plaza", "outer_SW")
        ring[(pr1 + 1, pc0 - 1)] = ("plaza", "outer_NE")
        ring[(pr1 + 1, pc1 + 1)] = ("plaza", "outer_NW")
        for c in range(cols):
            ring[(5, c)] = ("dirt", "edge_S")
            ring[(7, c)] = ("dirt", "edge_N")
            grid[6][c] = str(self.rng.choice(self.fill["dirt"]))
        for (r, c) in sorted(ring):                              # reading order: each piece is the candidate that best meets its placed neighbours
            cands = self.edge(*ring[(r, c)])
            best = None
            for cand in cands:
                tot = 0.0
                if c and grid[r][c - 1]:
                    tot += self.cost(grid[r][c - 1], cand, "E", de)
                if r and grid[r - 1][c]:
                    tot += self.cost(grid[r - 1][c], cand, "S", de)
                if best is None or tot < best[0]:
                    best = (tot, cand)
            grid[r][c] = best[1]
        out = Image.new("RGB", (cols * size * z, rows * size * z))
        for r in range(rows):
            for c in range(cols):
                out.paste(Image.fromarray(render(tiles[grid[r][c]], self.pal)).resize((size * z, size * z), Image.NEAREST), (c * size * z, r * size * z))
        return out


def main() -> int:
    rgb, px, pal, de, rarity, idx, t32, recs, fills, inside, have = build()
    extra = derive(t32, recs, have, de, rarity, pal)
    t16 = {k: reduce16(v, rarity) for k, v in t32.items()}
    for rec in recs:
        if rec["fill"]:
            rec["seam16"] = seam(t16[rec["id"]], de)
    OUT.mkdir(parents=True, exist_ok=True)
    # atlases: the sheet's own 12 x 8 positions, plus row 8 for the derived pieces
    rows = 9 if extra else 8
    for size, tiles, name in ((16, t16, "town-ground.png"), (32, t32, "town-ground-32.png")):
        atlas = np.zeros((rows * size, 12 * size), np.uint8)
        for rec in recs:
            r, c = rec["row"], rec["col"]
            atlas[r * size:(r + 1) * size, c * size:(c + 1) * size] = tiles[rec["id"]]
        im = Image.fromarray(atlas, "P")
        im.putpalette([int(v) for c in pal for v in c])
        im.save(OUT / name, optimize=True)
    # json
    classes = {}
    for (material, name), rs in sorted(have.items()):
        rs = best_of(have, material, name)
        classes.setdefault(material, {})[name] = {"id": rs[0]["id"], "derived": rs[0]["derived"], "joinsOK": rs[0]["joinsOK"],
                                                  "alternates": [r["id"] for r in rs[1:]]}
    for material in ("plaza", "dirt"):
        for n in EXPECTED:
            classes.setdefault(material, {}).setdefault(n, None)
    out = {
        "image": "town-ground.png", "image32": "town-ground-32.png", "tile": 16, "tile32": 32, "cols": 12, "rows": rows,
        "nativePixelCanvasPx": list(px), "source": "docs/study/art/source/ground-swatches.png", "tool": "tools/art/ground_tiles.py",
        "palette": ["#%02x%02x%02x" % tuple(c) for c in pal],
        "criteria": {"seamless": f"the wrapped line is no busier than the busiest inside line (+{MEAN_SLACK} dE, +{HARD_SLACK} hard fraction, hard = dE > {HARD_DE}) on both axes", "joinSlackDE": JOIN_SLACK},
        "fillFamilies": {k: [r["id"] for r in recs if r["fill"] and r["kind"] == k and r["usable"]] for k in KINDS[:FILL_ROWS]},
        "edgeSets": classes,
        "tiles": [],
    }
    for rec in recs:
        e = {k: v for k, v in rec.items()}
        e["x"], e["y"] = rec["col"], rec["row"]          # in tiles; multiply by `tile` (16) or `tile32` (32)
        out["tiles"].append(e)
    (OUT / "town-ground.json").write_text(json.dumps(out, indent=1) + "\n")
    seams_picture(t32, recs, pal, idx, de).save(OUT / "ground-seams.png", optimize=True)
    patch = Patch(recs, t32, t16, pal, have)
    patch.compose(t16, 5, de).save(OUT / "ground-contact.png", optimize=True)
    patch = Patch(recs, t32, t16, pal, have)
    patch.compose(t32, 2, de).save(OUT / "ground-contact-32.png", optimize=True)
    # report
    print(f"native pixel (canvas px): x {px[0]}, y {px[1]}; palette {len(pal)}; inside dE {inside}")
    for r in range(FILL_ROWS):
        rs = [x for x in recs if x["row"] == r]
        print(f"  {KINDS[r]:13} as drawn {sum(x['seamAsDrawn']['seamless'] for x in rs):2}/12 seamless; after repair {sum(x['usable'] for x in rs):2}/12; at 16 px {sum(x['seam16']['seamless'] for x in rs):2}/12")
    for x in recs:
        if not x["fill"]:
            print(f"  {x['id']:14} {str(x['name']):12} {'derived from ' + x['from'] if x['derived'] else '':22} joinsOK={x['joinsOK']}",
                  {k: (v.get('fillDE'), v.get('limit')) for k, v in x["joins"].items() if v.get("fillDE") is not None})
    print("unusable fills:", [x["id"] for x in recs if x["fill"] and not x["usable"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
