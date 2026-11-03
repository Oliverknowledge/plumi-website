#!/usr/bin/env python3
"""
The SCALE CHECK: a plain code drawn room (warm wood floor, cream wall with trim, palette taken from the props) furnished ONLY from
docs/study/art/interior/interior-atlas.{png,json} at the recommended per-prop scales, with the town's animals at 1:1 (they are 24 to 25
rows: the yardstick, one 'person'), drawn at the engine's zoom (k = 4) and depth sorted by the y of each anchor.

    python3 tools/art/interior_scale_check.py [--k 4] [--unscaled]     # writes docs/study/art/interior/interior-scale-check.png

Left: a cafe corner (door with a doormat, service counter with the espresso machine and the grinder, pastry case, brick oven, a window, a
sconce, a clock, a round table with a stool, a square table with two chairs and a book stack, two seated animals). Right: a study corner
(bookcases, a long table with a chair at each end and a chair behind, a sofa, an armchair, a plant, a floor lamp, a rug). Rulers: the
bar at the left edge is one person (25 rows); the door is one person.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/study/art/interior"
CHARS = ROOT / "public/library/characters"
F = 34                  # a character frame: 34 x 32, anchor column 17
FRAME = dict(idle_front=18, idle_right=0, idle_left=12, idle_back=6, sit_right=48, sit_left=54, phone=60, read=66, stool=72)


class Kit:
    def __init__(self, stem: str):
        self.doc = json.loads((OUT / f"{stem}.json").read_text())
        self.img = np.array(Image.open(OUT / f"{stem}.png").convert("RGBA"))
        self.by = {o["name"]: o for o in self.doc["objects"]}

    def sprite(self, name: str) -> np.ndarray:
        o = self.by[name]
        return self.img[o["y"]:o["y"] + o["h"], o["x"]:o["x"] + o["w"]]

    def palette_near(self, rgb) -> tuple[int, int, int]:
        px = self.img.reshape(-1, 4)
        px = px[px[:, 3] > 0][:, :3]
        d = ((px.astype(int) - np.array(rgb)) ** 2).sum(1)
        return tuple(int(v) for v in px[d.argmin()])


class Char:
    def __init__(self, animal: str):
        self.strip = np.array(Image.open(CHARS / f"{animal}.png").convert("RGBA"))

    def frame(self, key: str) -> np.ndarray:
        i = FRAME[key]
        return self.strip[:, i * F:(i + 1) * F]


class Scene:
    def __init__(self, w: int, h: int, wall_h: int, kit: Kit):
        self.w, self.h, self.wall_h, self.kit = w, h, wall_h, kit
        self.items: list[tuple[float, int, np.ndarray, int, int]] = []     # (sort y, order, rgba, x, y)
        self.n = 0
        self.canvas = np.zeros((h, w, 4), np.uint8)
        self.base = np.zeros((h, w, 3), np.uint8)

    def add(self, sort_y, arr, x, y):
        self.items.append((sort_y, self.n, arr, int(x), int(y)))
        self.n += 1

    def prop(self, name: str, ax: int, ay: int, sort_add: float = 0.0, flip: bool = False):
        """Put `name` with its anchor at the world point (ax, ay). Returns the (x, y) of its top left."""
        o, a = self.kit.by[name], self.kit.sprite(name)
        if flip:
            a = a[:, ::-1]
        x, y = ax - o["anchorX"], ay - o["anchorY"]
        self.add(ay + sort_add, a, x, y)
        return x, y

    def wall_prop(self, name: str, cx: int):
        o, a = self.kit.by[name], self.kit.sprite(name)
        y = self.wall_h - o["mountHeight"] - o["h"]
        self.add(-1000 + self.n, a, cx - o["w"] // 2, y)

    def flat(self, name: str, cx: int, cy: int):
        o, a = self.kit.by[name], self.kit.sprite(name)
        self.add(-500 + self.n, a, cx - o["w"] // 2, cy - o["h"] // 2)

    def on_top(self, name: str, host: str, hx: int, hy: int, fx: float, fy: float | None = None):
        """Stand `name` on the top of `host` (anchor at hx, hy): at fraction fx across its topRect, on the surface's front edge (or fy down it)."""
        ho = self.kit.by[host]
        t = ho["topRect"]
        px = hx - ho["anchorX"] + t["x"] + fx * t["w"]
        py = hy - ho["anchorY"] + t["y"] + (t["h"] if fy is None else fy * t["h"])
        o = self.kit.by[name]
        self.add(hy + 0.5, self.kit.sprite(name), px - o["anchorX"], py - o["anchorY"])

    def char(self, ch: Char, key: str, fx: int, fy: int, sort_add=0.0):
        """A standing or seated character with its FEET (anchor column 17, lowest opaque row) at (fx, fy)."""
        fr = ch.frame(key)
        rows = np.where((fr[..., 3] > 0).any(1))[0]
        self.add(fy + sort_add, fr, fx - 17, fy - int(rows.max()))

    def seated(self, ch: Char, key: str, chair: str, cx: int, cy: int, extra_sink=1, over=True):
        """A sitter on the chair whose anchor is at (cx, cy): the chair, the sitter, then the chair's front rows (frontCut) or all of it (backCut)."""
        o = self.kit.by[chair]
        x, y = self.prop(chair, cx, cy)
        a = self.kit.sprite(chair)
        seat = o["seats"][0]
        fr = ch.frame(key)
        rows = np.where((fr[..., 3] > 0).any(1))[0]
        sx, sy = x + seat["at"]["x"], y + seat["at"]["y"]
        self.add(cy + 0.2, fr, sx - 17, sy - int(rows.max()) + extra_sink)
        if o.get("frontCut") is not None:
            self.add(cy + 0.4, a[o["frontCut"]:], x, y + o["frontCut"])
        if o.get("backCut") is not None:
            self.add(cy + 0.4, a[:o["backCut"]], x, y)

    def render(self):
        img = Image.fromarray(self.base, "RGB").convert("RGBA")
        for sy, _, arr, x, y in sorted(self.items, key=lambda t: (t[0], t[1])):
            im = Image.fromarray(np.ascontiguousarray(arr), "RGBA")
            img.alpha_composite(im, (x, y)) if (x >= 0 and y >= 0 and x + im.width <= self.w and y + im.height <= self.h) else img.paste(im, (x, y), im)
        return img


def draw_room(scene: Scene, kit: Kit):
    w, h, wh = scene.w, scene.h, scene.wall_h
    wall = kit.palette_near((240, 222, 178))
    wall2 = kit.palette_near((228, 205, 158))
    trim = kit.palette_near((168, 104, 40))
    trim_d = kit.palette_near((110, 62, 22))
    floors = [kit.palette_near(c) for c in ((196, 128, 52), (182, 116, 44), (206, 140, 62))]
    seam = kit.palette_near((130, 76, 28))
    b = scene.base
    b[:wh] = wall
    for y in range(0, wh, 2):                          # a faint plaster stripe
        if (y // 2) % 6 == 0:
            b[y] = wall2
    b[wh - 6:wh] = trim                                # skirting
    b[wh - 6] = kit.palette_near((200, 140, 62))
    b[wh - 1] = trim_d
    b[wh * 3 // 5 - 1: wh * 3 // 5 + 1] = trim         # a chair rail
    b[wh * 3 // 5 + 1] = trim_d
    plank = 9
    for y in range(wh, h):
        row = (y - wh) // plank
        b[y] = floors[row % 3]
        if (y - wh) % plank == 0:
            b[y] = seam
        # plank ends, staggered
        off = (row * 37) % 61
        for x in range(off % 61, w, 61):
            if (y - wh) % plank != 0:
                b[y, x] = seam
    # the room's shadow under the wall
    for i in range(3):
        b[wh + i] = (b[wh + i].astype(int) * (0.78 + 0.07 * i)).astype(np.uint8)


def build(k: int, stem: str, out: Path):
    kit = Kit(stem)
    W_, H_, WH = 340, 178, 82
    sc = Scene(W_, H_, WH, kit)
    draw_room(sc, kit)
    fox, panda, rac, badger, capy, hedge = (Char(a) for a in ("fox", "redpanda", "raccoon", "badger", "capybara", "hedgehog"))
    floor_y = WH
    # ---- the door: one person tall (25 rows), code drawn from the props' wood, with the green mat in front
    door_x, door_w, door_h = 10, 16, 25
    doorc = kit.palette_near((150, 92, 34))
    sc.add(-2000, np.dstack([np.full((door_h + 3, door_w + 4, 3), kit.palette_near((110, 62, 22)), np.uint8), np.full((door_h + 3, door_w + 4), 255, np.uint8)]),
           door_x - 2, floor_y - door_h - 3)
    sc.add(-1999, np.dstack([np.full((door_h, door_w, 3), doorc, np.uint8), np.full((door_h, door_w), 255, np.uint8)]), door_x, floor_y - door_h)
    knob = np.dstack([np.full((2, 2, 3), kit.palette_near((240, 190, 60)), np.uint8), np.full((2, 2), 255, np.uint8)])
    sc.add(-1998, knob, door_x + door_w - 4, floor_y - 12)
    sc.flat("sage-mat", door_x + door_w // 2, floor_y + 9)
    # ---- the back wall: cafe run
    sc.wall_prop("wall-clock", 44)
    sc.wall_prop("arched-window", 124)
    sc.wall_prop("wall-sconce", 150)
    sc.wall_prop("cottage-window", 196)
    cx = 74
    sc.prop("service-counter", cx, floor_y + 10)
    sc.on_top("espresso-machine", "service-counter", cx, floor_y + 10, 0.20)
    sc.on_top("coffee-grinder", "service-counter", cx, floor_y + 10, 0.52)
    sc.on_top("small-plant", "service-counter", cx, floor_y + 10, 0.86)
    sc.prop("pastry-case", 124, floor_y + 11)
    sc.prop("bakery-oven", 164, floor_y + 9)
    # ---- the middle: a square table, two chairs, a book stack; a round table with a stool
    tx, ty = 78, 152
    sc.prop("square-table", tx, ty)
    t = kit.by["square-table"]
    sc.on_top("book-stack", "square-table", tx, ty, 0.30, 0.55)
    sc.on_top("small-plant", "square-table", tx, ty, 0.72, 0.45)
    chL = kit.by["chair-right"]
    sc.seated(fox, "sit_right", "chair-right", tx - t["anchorX"] + t["footprint"]["x"] - 6, ty - 8)
    sc.seated(badger, "sit_left", "chair-left", tx - t["anchorX"] + t["footprint"]["x"] + t["footprint"]["w"] + 6, ty - 8)
    sc.prop("round-table", 150, 158)
    sc.seated(hedge, "read", "cafe-stool", 181, 160)
    # ---- standing animals: fox at the counter (does the counter top reach the chest?), raccoon at the oven, red panda at the door
    sc.char(panda, "idle_front", door_x + door_w + 14, floor_y + 6)
    sc.char(rac, "idle_front", 100, floor_y + 20)
    sc.char(capy, "idle_front", 192, floor_y + 33)
    # ---- the study corner
    sc.prop("single-bookcase", 232, floor_y + 7)
    sc.prop("double-bookcase", 276, floor_y + 8)
    sc.prop("low-bookcase", 316, floor_y + 6)
    sc.on_top("small-plant", "low-bookcase", 316, floor_y + 6, 0.5)
    sc.flat("terracotta-rug", 268, 148)
    t2 = kit.by["communal-table-horizontal"]
    t2x, t2y = 268, 143
    sc.prop("communal-table-horizontal", t2x, t2y)
    sc.on_top("book-stack", "communal-table-horizontal", t2x, t2y, 0.25, 0.55)
    sc.on_top("book-stack", "communal-table-horizontal", t2x, t2y, 0.70, 0.40)
    sc.seated(panda, "read", "chair-down", t2x - 8, t2y - t2["footprint"]["h"] - 4)
    sc.seated(rac, "stool", "chair-up", t2x + 10, t2y + 8, extra_sink=0)
    sc.prop("terracotta-sofa", 222, 172)
    sc.seated  # (sofa seats shown by hand below)
    so = kit.by["terracotta-sofa"]
    sx, sy = 222 - so["anchorX"], 172 - so["anchorY"]
    fr = fox.frame("read")
    rows = np.where((fr[..., 3] > 0).any(1))[0]
    s0 = so["seats"][0]["at"]
    sc.add(172 + 0.2, fr, sx + s0["x"] - 17, sy + s0["y"] - int(rows.max()) + 1)
    sc.add(172 + 0.4, kit.sprite("terracotta-sofa")[so["frontCut"]:], sx, sy + so["frontCut"])
    sc.prop("tall-plant", 306, 166)
    sc.prop("floor-lamp", 202, floor_y + 22)
    sc.prop("reading-armchair", 316, 170)
    sc.char(fox, "idle_front", 256, 172, 0)
    # ---- rulers: a person bar at the very left (25 rows) and the 1 person door above
    bar = np.zeros((25, 3, 4), np.uint8)
    bar[...] = (255, 255, 255, 255)
    for r in range(0, 25, 5):
        bar[r, :] = (255, 0, 80, 255)
    sc.add(5000, bar, 2, floor_y + 22 - 25)
    img = sc.render().convert("RGB")
    big = img.resize((W_ * k, H_ * k), Image.NEAREST)
    d = ImageDraw.Draw(big)
    d.text((6, 6), f"scale check, k={k}: {stem}", fill=(40, 20, 10))
    big.save(out, optimize=True)
    return big


def main(argv) -> int:
    k = 4
    stem = "interior-atlas"
    name = "interior-scale-check.png"
    if "--k" in argv:
        k = int(argv[argv.index("--k") + 1])
    if "--unscaled" in argv:
        stem, name = "interior-atlas-unscaled", "interior-scale-check-unscaled.png"
    if "--out" in argv:
        name = argv[argv.index("--out") + 1]
    build(k, stem, OUT / name if "/" not in name else Path(name))
    print("wrote", name)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
