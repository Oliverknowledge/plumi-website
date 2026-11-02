#!/usr/bin/env python3
"""
The world-scale comparison: the SAME scene drawn three ways at the same on-screen zoom, so the choice can be made by looking.

    python3 tools/art/scale_compare.py     # writes docs/study/art/town/{scale-compare.png,scale-compare-detail.png,scale-compare.json}
                                           # and public-free, self contained: docs/study/art/town/scale-compare.html (the three PNGs, zoomable)

The scene (positions in `U` units: art px of the 5.0 cut; every scale places the same things at the same fraction of the cafe):
ground (grass field, a plaza in front of the cafe door, a dirt path), the cafe, two large trees, a medium tree, a bush, a log, a lamp
post, the apple cart and the well (there is NO bench or picnic table on the props sheet: the cart stands in for the bench, the well for the
table), three animals (fox, raccoon, red panda) and one LimeZu person (the iPad avatar's sheet row 5), all standing, drawn from their idle
front frames. Everything is y-sorted by its base; a soft ellipse under each is drawn the same way in all three.

  S1  CHARACTER SCALE: the town art cut at 8.1 source px per art px (the characters' own: a fox is 24 rows). Ground: town-ground.png
      (16 x 16 tiles, 2 x 2 reduced). Characters 1:1.
  S2  TOWN-NATIVE: cut at 5.0 (the scale the props looked right at; the sheets' own pixel is 6.1 for the trees and 4.0 for the ground).
      Ground: town-ground-32.png (32 x 32 native tiles, one native pixel = one art pixel). Characters 1:1: they are the same 24 rows.
  S3  MIDDLE: the S2 town with characters nearest-neighbour scaled by 2 (the integer closest to 8.1 / 5.0 = 1.62). Every character pixel is
      then 2 x 2 world pixels: crisp, but twice as coarse as the ground and the objects, and 23% taller than they would be at 1.62.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
TOWN = ROOT / "docs/study/art/town"
CHARS = ROOT / "public/library/characters"
PEOPLE = ROOT / "public/library/people.png"
Z = 2                         # on-screen px per art px, the same in every panel
W_U, H_U = 440, 300           # the scene in U units


def rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def crop_bbox(a: np.ndarray) -> np.ndarray:
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


class Sprite:
    def __init__(self, a: np.ndarray, ax: int, ay: int, shadow: tuple[int, int] | None = None):
        self.a, self.ax, self.ay, self.shadow = a, ax, ay, shadow


def fix_cell(path: Path, doc_key: str, name: str) -> Sprite:
    d = json.loads(path.read_text())
    atlas = rgba(path.with_name(d["image"]))
    rec = next(o for o in d[doc_key] if o["name"] == name)
    a = atlas[rec["y"]:rec["y"] + rec["h"], rec["x"]:rec["x"] + rec["w"]].copy()
    return Sprite(a, rec["anchorX"], rec["anchorY"])


def load_world(scale_key: str) -> dict[str, Sprite]:
    """scale_key: '' (5.0), '-char' (8.1). The props atlases are named town-atlas.png (8.1) and town-atlas-fine.png (5.0)."""
    prop_json = TOWN / ("town-atlas.json" if scale_key == "-char" else "town-atlas-fine.json")
    out: dict[str, Sprite] = {}
    for n in ("lamp-post-ornate", "cart-apples", "well"):
        out[n] = fix_cell(prop_json, "props", n)
    for n in ("tree_l_gold_round", "tree_l_red", "tree_m_orange_wide", "bush_orange_round", "log"):
        s = fix_cell(TOWN / f"town-nature{scale_key}.json", "objects", n)
        d = json.loads((TOWN / f"town-nature{scale_key}.json").read_text())
        rec = next(o for o in d["objects"] if o["name"] == n)
        s.canopy = rec.get("canopyRect")
        out[n] = s
    cd = json.loads((TOWN / f"town-cafe{scale_key}.json").read_text())
    b = cd["building"]
    ca = rgba(TOWN / cd["image"])
    out["cafe"] = Sprite(ca, b["anchorX"], b["anchorY"])
    out["cafe"].door = b
    return out


def load_chars() -> dict[str, Sprite]:
    out = {}
    for an in ("fox", "raccoon", "redpanda"):
        a = rgba(CHARS / f"{an}.png")[:, 18 * 34:19 * 34]
        a = crop_bbox(a)
        out[an] = Sprite(a, a.shape[1] // 2, a.shape[0] - 1)
    p = rgba(PEOPLE)[5 * 32:6 * 32, 18 * 16:19 * 16]
    p = crop_bbox(p)
    out["person"] = Sprite(p, p.shape[1] // 2, p.shape[0] - 1)
    return out


def scale_nearest(a: np.ndarray, f: float) -> np.ndarray:
    h, w = a.shape[:2]
    nh, nw = int(round(h * f)), int(round(w * f))
    ys = np.minimum((np.arange(nh) / f).astype(int), h - 1)
    xs = np.minimum((np.arange(nw) / f).astype(int), w - 1)
    return a[ys][:, xs]


# ---------------------------------------------------------------- ground


class Ground:
    def __init__(self, tile: int):
        self.tile = tile
        d = json.loads((TOWN / "town-ground.json").read_text())
        self.doc = d
        atlas = np.array(Image.open(TOWN / (d["image"] if tile == 16 else d["image32"])).convert("RGB"))
        self.pos = {t["id"]: (t["col"], t["row"]) for t in d["tiles"]}
        self.atlas = atlas
        self.fam = d["fillFamilies"]
        self.sets = d["edgeSets"]

    def get(self, i: str) -> np.ndarray:
        c, r = self.pos[i]
        T = self.tile
        return self.atlas[r * T:(r + 1) * T, c * T:(c + 1) * T]

    def edge(self, material: str, name: str, above: np.ndarray | None, left: np.ndarray | None) -> np.ndarray:
        e = self.sets[material][name]
        ids = [e["id"]] + e["alternates"]
        best = None
        for i in ids:
            t = self.get(i).astype(int)
            cost = 0.0
            if above is not None:
                cost += np.abs(above[-1].astype(int) - t[0]).mean()
            if left is not None:
                cost += np.abs(left[:, -1].astype(int) - t[:, 0]).mean()
            if best is None or cost < best[0]:
                best = (cost, i)
        return self.get(best[1])

    def paint(self, k: float, wpx: int, hpx: int, seed: int = 5) -> np.ndarray:
        """k = art px per U. A grass field, a plaza in front of the cafe door, a dirt path going down: all placed from U boxes."""
        T = self.tile
        cols, rows = -(-wpx // T), -(-hpx // T)
        rng = np.random.default_rng(seed)
        grass = [i for kk in ("grass_a", "grass_flower", "grass_leaves") for i in self.fam[kk]]
        wts = np.array([0.6 if i.startswith("grass_a") else 0.2 for i in grass])
        wts /= wts.sum()
        grid = [[None] * cols for _ in range(rows)]
        last = {}
        for r in range(rows):
            for c in range(cols):
                while True:
                    g = str(rng.choice(grass, p=wts))
                    if g != (grid[r][c - 1] if c else None) and g != (grid[r - 1][c] if r else None):
                        break
                grid[r][c] = g
        # the plaza interior in U: x 235 to 405, y 160 to 215 -> tiles whose centre falls inside
        def tiles_in(x0, y0, x1, y1):
            cs = [c for c in range(cols) if x0 * k <= (c + .5) * T <= x1 * k]
            rs = [r for r in range(rows) if y0 * k <= (r + .5) * T <= y1 * k]
            return rs, cs
        rs, cs = tiles_in(235, 165, 405, 200)
        r0, r1, c0, c1 = rs[0], rs[-1], cs[0], cs[-1]
        plain = self.fam["plaza"]
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                grid[r][c] = str(rng.choice(plain))
        # the path: two columns of edge pieces, from the plaza's south ring to the bottom, at U x 300
        pcol = int(300 * k // T)
        ring = {}
        for c in range(c0, c1 + 1):
            ring[(r0 - 1, c)] = ("plaza", "edge_S")
            ring[(r1 + 1, c)] = ("plaza", "edge_N")
        for r in range(r0, r1 + 1):
            ring[(r, c0 - 1)] = ("plaza", "edge_E")
            ring[(r, c1 + 1)] = ("plaza", "edge_W")
        ring[(r0 - 1, c0 - 1)] = ("plaza", "outer_SE")
        ring[(r0 - 1, c1 + 1)] = ("plaza", "outer_SW")
        ring[(r1 + 1, c0 - 1)] = ("plaza", "outer_NE")
        ring[(r1 + 1, c1 + 1)] = ("plaza", "outer_NW")
        # the plaza's south ring is open where the path leaves it
        for r in range(r1 + 1, rows):
            ring[(r, pcol)] = ("dirt", "edge_E")
            ring[(r, pcol + 1)] = ("dirt", "edge_W")
        out = np.zeros((rows * T, cols * T, 3), np.uint8)
        done: dict[tuple[int, int], np.ndarray] = {}
        for r in range(rows):
            for c in range(cols):
                if (r, c) in ring:
                    m, n = ring[(r, c)]
                    t = self.edge(m, n, done.get((r - 1, c)), done.get((r, c - 1)))
                else:
                    t = self.get(grid[r][c])
                done[(r, c)] = t
                out[r * T:(r + 1) * T, c * T:(c + 1) * T] = t
        return out[:hpx, :wpx]


# ---------------------------------------------------------------- scene


def shadow_layer(w: int, h: int, items) -> Image.Image:
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for cx, cy, rw, rh in items:
        d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(70, 50, 80, 70))
    return lay


def compose(name: str, k: float, world: dict[str, Sprite], chars: dict[str, Sprite], cscale: float, ground: Ground) -> tuple[Image.Image, dict]:
    """k: art px per U for the scene's positions; cscale: characters' scale factor (1 or 2)."""
    wpx, hpx = int(W_U * k), int(H_U * k)
    base = Image.fromarray(ground.paint(k, wpx, hpx)).convert("RGBA")
    # placements: (sprite, U x, U y) of the base point
    P = []
    P.append(("cafe", world["cafe"], 235, 160, 1))
    P.append(("tree_l_gold_round", world["tree_l_gold_round"], 50, 150, 1))
    P.append(("tree_l_red", world["tree_l_red"], 418, 290, 1))
    P.append(("tree_m_orange_wide", world["tree_m_orange_wide"], 40, 262, 1))
    P.append(("bush", world["bush_orange_round"], 150, 240, 1))
    P.append(("log", world["log"], 120, 288, 1))
    P.append(("lamp", world["lamp-post-ornate"], 236, 236, 1))
    P.append(("cart (bench stand-in)", world["cart-apples"], 380, 236, 1))
    P.append(("well (table stand-in)", world["well"], 190, 205, 1))
    door = world["cafe"].door
    door_dx = door["doorCentreX"] - world["cafe"].ax          # art px of the cafe cut
    door_ux = 235 + door_dx / k                                # the door's U x
    P.append(("person", chars["person"], door_ux + 3, 182, cscale))
    P.append(("fox", chars["fox"], door_ux - 40, 196, cscale))
    P.append(("raccoon", chars["raccoon"], 345, 210, cscale))
    P.append(("redpanda", chars["redpanda"], 262, 232, cscale))
    sh = []
    items = []
    for label, sp, ux, uy, cs in P:
        a = sp.a if cs == 1 else scale_nearest(sp.a, cs)
        ax, ay = int(round(sp.ax * cs)), int(round(sp.ay * cs))
        bx, by = int(round(ux * k)), int(round(uy * k))
        w_, h_ = a.shape[1], a.shape[0]
        if label in ("person", "fox", "raccoon", "redpanda"):
            sh.append((bx, by, int(7 * cs), max(2, int(2.2 * cs))))
        elif label.startswith("tree"):
            sh.append((bx, by - 1, int(0.34 * w_), max(3, int(0.07 * w_))))
        elif label in ("cafe",):
            sh.append((bx, by - 2, int(0.48 * w_), max(3, int(0.03 * w_))))
        else:
            sh.append((bx, by - 1, int(0.4 * w_), max(2, int(0.1 * w_))))
        items.append((by, label, a, bx - ax, by - ay))
    base.alpha_composite(shadow_layer(wpx, hpx, sh))
    for by, label, a, x, y in sorted(items, key=lambda t: t[0]):
        base.alpha_composite(Image.fromarray(a, "RGBA"), (x, y))
    meta = {"canvasArtPx": [wpx, hpx]}
    return base.convert("RGB"), meta


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def main() -> int:
    world_c = load_world("-char")
    world_n = load_world("")
    chars = load_chars()
    g16, g32 = Ground(16), Ground(32)
    k1, k2 = 5.0 / 8.1, 1.0
    s1, m1 = compose("S1", k1, world_c, chars, 1, g16)
    s2, m2 = compose("S2", k2, world_n, chars, 1, g32)
    s3, m3 = compose("S3", k2, world_n, chars, 2, g32)
    panels = [("S1  everything at the CHARACTER scale", "town cut at 8.1 source px / art px", s1, 16),
              ("S2  everything at the TOWN-NATIVE scale", "town cut at 5.0, characters as they are", s2, 32),
              ("S3  town at 5.0, characters x2 (nearest)", "character pixels are 2 x 2 world pixels", s3, 32)]
    pad, head = 18, 74
    ims = [p[2].resize((p[2].width * Z, p[2].height * Z), Image.NEAREST) for p in panels]
    W = sum(i.width for i in ims) + pad * (len(ims) + 1)
    H = max(i.height for i in ims) + head + pad * 2
    img = Image.new("RGB", (W, H), (38, 32, 38))
    d = ImageDraw.Draw(img)
    f1, f2 = font(20), font(15)
    x = pad
    for (t, sub, _, tile), im in zip(panels, ims):
        d.text((x, 12), t, fill=(255, 244, 220), font=f1)
        d.text((x, 38), f"{sub}.  Ground tile = {tile * Z} screen px ({tile} art px).  Zoom x{Z}.", fill=(210, 200, 190), font=f2)
        img.paste(im, (x, head))
        x += im.width + pad
    img.save(TOWN / "scale-compare.png", optimize=True)
    # detail: the cafe door with the person and the fox, each scale at x4
    zz = 4
    crops = []
    for s, k, tile in ((s1, k1, 16), (s2, k2, 32), (s3, k2, 32)):
        x0 = int((235 + 88) * k)
        box = (x0 - int(30 * k), int(95 * k), x0 + int(120 * k), int(215 * k))
        crops.append(s.crop(box).resize(((box[2] - box[0]) * zz, (box[3] - box[1]) * zz), Image.NEAREST))
    DW = sum(c.width for c in crops) + pad * 4
    DH = max(c.height for c in crops) + head
    det = Image.new("RGB", (DW, DH), (38, 32, 38))
    dd = ImageDraw.Draw(det)
    x = pad
    for (t, *_), c in zip(panels, crops):
        dd.text((x, 12), t.split("  ")[0] + "  the door, a person and a fox, x4", fill=(255, 244, 220), font=f2)
        det.paste(c, (x, 40))
        x += c.width + pad
    det.save(TOWN / "scale-compare-detail.png", optimize=True)
    # the crispness strip: the same fox at x1, x1.5, x1.62 and x2 (nearest) beside the person
    fox, person = chars["fox"].a, chars["person"].a
    factors = [1, 1.5, 1.62, 2]
    tiles = []
    for f in factors:
        tiles.append((scale_nearest(fox, f), scale_nearest(person, f), f))
    zz = 6
    sw = sum(t[0].shape[1] + t[1].shape[1] + 14 for t in tiles) * zz + 40
    sh_ = max(t[0].shape[0] for t in tiles) * zz + 70
    st = Image.new("RGB", (sw, sh_), (150, 190, 100))
    sd = ImageDraw.Draw(st)
    x = 14
    for a, b, f in tiles:
        for arr in (a, b):
            im = Image.fromarray(arr, "RGBA").resize((arr.shape[1] * zz, arr.shape[0] * zz), Image.NEAREST)
            st.paste(im, (x, sh_ - 30 - im.height), im)
            x += im.width + 4 * zz
        sd.text((x - (a.shape[1] + b.shape[1] + 8) * zz, sh_ - 22), f"x{f}: {a.shape[0]} rows", fill=(30, 20, 20), font=f2)
        x += 4 * zz
    st.save(TOWN / "scale-compare-crisp.png", optimize=True)
    # numbers
    nums = measure()
    (TOWN / "scale-compare.json").write_text(json.dumps(nums, indent=1) + "\n")
    print(json.dumps(nums, indent=1))
    return 0


def measure() -> dict:
    """What ChatGPT drew, in source px (from the cut boxes), and what that is in art px and in persons."""
    src = {}
    tn = json.loads((TOWN / "town-nature.json").read_text())
    large = [o for o in tn["objects"] if o["name"].startswith("tree_l")]
    med = [o for o in tn["objects"] if o["name"].startswith("tree_m")]
    bush = [o for o in tn["objects"] if o["name"].startswith("bush")]
    cafe = json.loads((TOWN / "town-cafe.json").read_text())["building"]
    def span(o):
        b = o["sourceBox"]
        return b[2] - b[0], b[3] - b[1]
    src["largeTree"] = [float(np.mean([span(o)[1] for o in large])), float(np.mean([span(o)[0] for o in large]))]   # h, w
    src["mediumTree"] = [float(np.mean([span(o)[1] for o in med])), float(np.mean([span(o)[0] for o in med]))]
    src["bush"] = [float(np.mean([span(o)[1] for o in bush])), float(np.mean([span(o)[0] for o in bush]))]
    cb = cafe["sourceBox"]
    src["cafe"] = [cb[3] - cb[1], cb[2] - cb[0]]
    src["door"] = [cafe["door"]["h"] * 5.0, cafe["door"]["w"] * 5.0]            # from the 5.0 cut (door panel only)
    person_rows = 25
    out = {"sourcePx": {k: {"h": round(v[0]), "w": round(v[1])} for k, v in src.items()}, "personRows": person_rows}
    for s in (5.0, 6.1, 8.1):
        row = {}
        for k, v in src.items():
            row[k] = {"h": round(v[0] / s, 1), "w": round(v[1] / s, 1), "hInPersons": round(v[0] / s / person_rows, 2), "wInPersons": round(v[1] / s / person_rows, 2)}
        out[f"at{s}"] = row
    return out


if __name__ == "__main__":
    sys.exit(main())
