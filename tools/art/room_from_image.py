#!/usr/bin/env python3
"""
Turns ONE picture of a room (ChatGPT, a painter, a screenshot: any top-down room) into the assets the web app's room
engine (src/components/landing/cafeScene.ts, library mode) draws and walks: the same four files and the same
layout.json the Grand Library uses (scripts/cafe-hero/export_library.py makes those from the co-founder's kit; this makes
them from a picture and a config written by hand).

    python3 tools/art/room_from_image.py tools/art/rooms/cafe.json            # write the assets and run the checks
    python3 tools/art/room_from_image.py tools/art/rooms/cafe.json --check    # the checks only (no files written)
    python3 tools/art/room_from_image.py tools/art/rooms/cafe.json --preview docs/study/art/cafe/preview.png
    python3 tools/art/room_from_image.py tools/art/rooms/cafe.json --seated docs/study/art/cafe/seated.png [--zoom 3]
    python3 tools/art/room_from_image.py tools/art/rooms/cafe.json --grid 0,0,220,150 --zoom 5 --out g.png   # a labelled crop

WHAT IT MAKES (into `out`, default public/rooms/<id>/)
  bg.png       the room at the engine's scale: the source resampled by `scale` source pixels per art pixel (Lanczos, a little
               sharpening), `patches` applied (a doorway cloned in, a wall opened), nobody in it and no lamplight
  pieces.png   an atlas of the PIECES: the things that must draw OVER a person who stands behind them (a counter front, a
               plant, a table in front of a seated lap, a pillar). Each is cut from bg.png by a hand-drawn shape and has the
               `z` (the y it stands on) the engine sorts people against: a person whose feet are above `z` is behind it
  anims.png    what moves (1 x 1 and empty here: the room's fires are static art, the engine flickers their light)
  layout.json  the engine's file: w h tile cols rows door walk[] spots[] pieces[] anims[] lights[] people{}

THE CONFIG (every coordinate is in FINAL ART PIXELS: the bg.png you get, 16 px to a tile, the people are 16 x 32)
  scale, size     source px per art px, and the final size (a multiple of 16)
  patches         [{"op": "clone", "from": [x, y, w, h], "to": [x, y]}, {"op": "fill", "rect": [...], "rgb": [r, g, b]}]
  floor           shapes where feet may stand (the union)
  blocked         shapes where feet may not (footprints of what stands on the floor: a table's base, not its whole picture)
  walls           (not needed: `floor` is positive; anything outside it is wall)
  probe           [hw, hh]: a tile is open when a box this big (half width, half height) round its centre (16 tx + 8,
                  16 ty + 12) is all floor
  door            {"x", "y", "tile": [tx, ty]}: where people appear and leave (feet), and the open tile they walk in to
  pieces          [{"name", "shape", "z"?, "exclude"?: [shapes], "trim"?: true}] ("z" omitted = the lowest y of the shape;
                  "trim" removes floor-coloured pixels that touch the shape's edge, so a plant is its leaves and not its box)
  floorRgb        [[r, g, b], ...] floor colours `trim` removes (and tolerance `trimTol`)
  seats           a registry file (append only: ids never change, a seat is retired with "retired": true, never deleted)
  staff           [{"staff": "butler", "x", "y", "face"}] (people.png's two staff, standing where they work)
  lights          [{"x", "y", "r", "k", "rgb", "sq", "fire"}] (as the engine's lightLayer reads them)
  people          "library": the people block is copied from public/library/layout.json (the room shares people.png)

A SHAPE is [x0, y0, x1, y1] (a rectangle, x1 and y1 not included), {"poly": [[x, y], ...]} or {"ellipse": [cx, cy, rx, ry]}.

THE CHECKS (exit 1 on a failure, so a bad edit cannot ship): the door is on the floor, every open tile can be reached from
the door (no sealed pocket), every seat's standing tile is open and reachable and near the chair, seat ids are unique,
no two seats share a place, pieces have a `z`, the sprite boxes are inside the room.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
TILE = 16
FEET_X, FEET_Y = 8, 31                 # a sprite's top left to its feet
RING = (8, 20)                         # the engine centres a chair's ring there from the sprite's top left


def rel(p: str) -> Path:
    q = Path(p)
    return q if q.is_absolute() else ROOT / q


# ---------------------------------------------------------------------------------------------------------------- shapes
def shape_mask(shape, w: int, h: int) -> np.ndarray:
    """A boolean (h, w) mask of a shape. Rectangles are half open; polygons and ellipses follow PIL's pixel rule."""
    if isinstance(shape, dict) and "union" in shape:
        m = np.zeros((h, w), bool)
        for s in shape["union"]:
            m |= shape_mask(s, w, h)
        return m
    m = np.zeros((h, w), bool)
    if isinstance(shape, (list, tuple)) and len(shape) == 4 and all(isinstance(v, (int, float)) for v in shape):
        x0, y0, x1, y1 = (int(round(v)) for v in shape)
        m[max(0, y0):max(0, min(h, y1)), max(0, x0):max(0, min(w, x1))] = True
        return m
    im = Image.new("1", (w, h), 0)
    d = ImageDraw.Draw(im)
    if isinstance(shape, dict) and "poly" in shape:
        d.polygon([tuple(p) for p in shape["poly"]], fill=1)
    elif isinstance(shape, dict) and "ellipse" in shape:
        cx, cy, rx, ry = shape["ellipse"]
        d.ellipse([cx - rx, cy - ry, cx + rx - 1, cy + ry - 1], fill=1)
    else:
        raise ValueError(f"unknown shape {shape!r}")
    return np.asarray(im, bool)


def shape_bbox(shape):
    if isinstance(shape, dict) and "union" in shape:
        bs = [shape_bbox(s) for s in shape["union"]]
        return min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)
    if isinstance(shape, (list, tuple)):
        return tuple(shape)
    if "poly" in shape:
        xs = [p[0] for p in shape["poly"]]
        ys = [p[1] for p in shape["poly"]]
        return min(xs), min(ys), max(xs) + 1, max(ys) + 1
    cx, cy, rx, ry = shape["ellipse"]
    return cx - rx, cy - ry, cx + rx, cy + ry


# ------------------------------------------------------------------------------------------------------------------- bg
def make_bg(cfg: dict) -> np.ndarray:
    src = Image.open(rel(cfg["source"])).convert("RGB")
    w, h = cfg["size"]
    s = float(cfg["scale"])
    a = np.asarray(src)
    void = tuple(cfg["void"]) if cfg.get("void") else tuple(int(v) for v in a[5:20, src.width - 36:src.width - 6].reshape(-1, 3).mean(0))
    pad = Image.new("RGB", (round(w * s), round(h * s)), void)       # the room may be a few rows taller than the picture
    pad.paste(src, (0, 0))
    sm = pad.resize((w, h), Image.LANCZOS)
    sh = cfg.get("sharpen", {"radius": 0.8, "percent": 60, "threshold": 2})
    if sh:
        sm = sm.filter(ImageFilter.UnsharpMask(radius=sh["radius"], percent=sh["percent"], threshold=sh["threshold"]))
    bg = np.asarray(sm).copy()
    for p in cfg.get("patches", []):
        if p["op"] == "clone":
            fx, fy, fw, fh = p["from"]
            tx, ty = p["to"]
            bg[ty:ty + fh, tx:tx + fw] = bg[fy:fy + fh, fx:fx + fw].copy()
        elif p["op"] == "fill":
            m = shape_mask(p["rect"], w, h)
            bg[m] = p["rgb"]
        else:
            raise ValueError(f"unknown patch {p['op']}")
    return bg


# ------------------------------------------------------------------------------------------------------------ the floor
def cell_of(x: float, y: float) -> tuple[int, int]:
    return int(math.floor(x / TILE)), int(math.floor((y - 4) / TILE))


def feet_of_tile(tx: int, ty: int) -> tuple[int, int]:
    return tx * TILE + 8, ty * TILE + 12


def neighbours(free: np.ndarray, tx: int, ty: int):
    """walk.ts `around`: eight ways, a diagonal only when both tiles beside it are open."""
    rows, cols = free.shape
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        nx, ny = tx + dx, ty + dy
        if not (0 <= nx < cols and 0 <= ny < rows and free[ny, nx]):
            continue
        if dx and dy and not (free[ty, tx + dx] and free[ty + dy, tx]):
            continue
        yield nx, ny


def flood(free: np.ndarray, start: tuple[int, int]) -> np.ndarray:
    seen = np.zeros_like(free)
    if not free[start[1], start[0]]:
        return seen
    seen[start[1], start[0]] = True
    q = deque([start])
    while q:
        x, y = q.popleft()
        for nx, ny in neighbours(free, x, y):
            if not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    return seen


def make_floor(cfg: dict):
    w, h = cfg["size"]
    floor = np.zeros((h, w), bool)
    for s in cfg["floor"]:
        floor |= shape_mask(s["shape"] if isinstance(s, dict) and "shape" in s else s, w, h)
    blocked = np.zeros((h, w), bool)
    for b in cfg.get("blocked", []):
        blocked |= shape_mask(b["shape"], w, h)
    ok = floor & ~blocked
    hw, hh = cfg.get("probe", [5, 4])
    cols, rows = w // TILE, h // TILE
    free = np.zeros((rows, cols), bool)
    for ty in range(rows):
        for tx in range(cols):
            cx, cy = feet_of_tile(tx, ty)
            x0, x1, y0, y1 = cx - hw, cx + hw, cy - hh, cy + hh
            if x0 < 0 or y0 < 0 or x1 > w or y1 > h:
                continue
            free[ty, tx] = bool(ok[y0:y1, x0:x1].all())
    return ok, free


# ----------------------------------------------------------------------------------------------------------------- seats
def load_seats(cfg: dict) -> dict:
    return json.loads(rel(cfg["seats"]).read_text())


def seat_xy(s: dict) -> tuple[int, int]:
    """Sprite top left. Authored by the chair's centre (`at`), which is where the engine draws the ring."""
    if "at" in s:
        return int(round(s["at"][0] - RING[0])), int(round(s["at"][1] - RING[1] + s.get("dy", 0)))
    return int(s["x"]), int(s["y"])


def approach_dir(s: dict) -> tuple[float, float]:
    """Which way a person comes from: away from the table (a chair on a table north side is walked to from the north)."""
    side = s.get("side")
    return {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}.get(side, {"right": (-1, 0), "left": (1, 0), "front": (0, 1), "back": (0, -1)}[s["face"]])


def stand_tile(free: np.ndarray, reach: np.ndarray, s: dict, fx: float, fy: float):
    """The reachable open tile a person walks to first: nearest to a point a little outside the chair on the approach side."""
    if s.get("stand"):
        return tuple(s["stand"])
    dx, dy = approach_dir(s)
    px, py = fx + dx * s.get("reach", 16), fy + dy * s.get("reach", 16)
    best = None
    rows, cols = free.shape
    for ty in range(rows):
        for tx in range(cols):
            if not reach[ty, tx]:
                continue
            cx, cy = feet_of_tile(tx, ty)
            d = (cx - px) ** 2 + (cy - py) ** 2
            if best is None or d < best[0]:
                best = (d, tx, ty)
    return (best[1], best[2]) if best else None


# --------------------------------------------------------------------------------------------------------------- pieces
def pack(boxes, width=512):
    width = max([width] + [w for _, w, _ in boxes])
    x, y, row, out = 0, 0, 0, {}
    for name, w, h in sorted(boxes, key=lambda b: (-b[2], -b[1], b[0])):
        if x + w > width:
            x, y, row = 0, y + row, 0
        out[name] = (x, y)
        x += w + 1
        row = max(row, h + 1)
    return out, y + row, width


def png_bytes(a: np.ndarray) -> bytes:
    if a.shape[2] == 4:
        a = a.copy()
        a[a[..., 3] == 0] = 0
    flat = a.reshape(-1, a.shape[2])
    cols, idx = np.unique(flat, axis=0, return_inverse=True)
    b = io.BytesIO()
    if len(cols) <= 256:
        im = Image.fromarray(idx.reshape(a.shape[:2]).astype(np.uint8), "P")
        im.putpalette(cols[:, :3].flatten().tolist())
        im.save(b, "PNG", optimize=True, **({"transparency": bytes(int(v) for v in cols[:, 3])} if a.shape[2] == 4 else {}))
    else:
        Image.fromarray(a, "RGBA" if a.shape[2] == 4 else "RGB").save(b, "PNG", optimize=True)
    return b.getvalue()


def trim_floor(bg: np.ndarray, mask: np.ndarray, floor_rgb, tol: float) -> np.ndarray:
    """Remove from `mask` the floor-coloured pixels connected to its outside: flood in from the mask's border through them."""
    if not len(floor_rgb):
        return mask
    ref = np.array(floor_rgb, float)
    d = np.sqrt(((bg[..., None, :].astype(float) - ref[None, None]) ** 2).sum(-1)).min(-1)
    like = mask & (d < tol)
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = mask[y0:y1, x0:x1]
    lk = like[y0:y1, x0:x1]
    gone = np.zeros_like(sub)
    q = deque()
    hh, ww = sub.shape
    pad_sub = np.pad(sub, 1)
    for y in range(hh):
        for x in range(ww):
            if lk[y, x]:
                # on the edge of the mask: a neighbour (8 ways) outside it
                if not pad_sub[y:y + 3, x:x + 3].all():
                    gone[y, x] = True
                    q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < hh and 0 <= nx < ww and lk[ny, nx] and not gone[ny, nx]:
                    gone[ny, nx] = True
                    q.append((ny, nx))
    out = mask.copy()
    out[y0:y1, x0:x1] &= ~gone
    return out


def make_pieces(cfg: dict, bg: np.ndarray):
    w, h = cfg["size"]
    rows, sprites, boxes = [], {}, []
    for p in cfg.get("pieces", []):
        m = shape_mask(p["shape"], w, h)
        for e in p.get("exclude", []):
            m &= ~shape_mask(e, w, h)
        if p.get("trim"):
            m = trim_floor(bg, m, cfg.get("floorRgb", []), cfg.get("trimTol", 22))
        ys, xs = np.nonzero(m)
        if not len(ys):
            raise SystemExit(f"piece {p['name']} is empty")
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        z = p.get("z")
        if z is None:
            z = float(y1)
        rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        rgba[..., :3] = bg[y0:y1, x0:x1]
        rgba[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
        sprites[p["name"]] = rgba
        boxes.append((p["name"], x1 - x0, y1 - y0))
        rows.append({"name": p["name"], "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "z": round(float(z), 2)})
    at, height, aw = pack(boxes)
    atlas = np.zeros((max(1, height), aw, 4), np.uint8)
    for name, a in sprites.items():
        x, y = at[name]
        atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
    for r in rows:
        r["ax"], r["ay"] = map(int, at[r["name"]])
    return rows, atlas


# ------------------------------------------------------------------------------------------------------------ the build
class Room:
    def __init__(self, cfg_path: Path):
        self.cfg_path = cfg_path
        self.cfg = json.loads(cfg_path.read_text())
        c = self.cfg
        self.w, self.h = c["size"]
        assert self.w % TILE == 0 and self.h % TILE == 0, "size must be a multiple of the 16 px tile"
        self.cols, self.rows = self.w // TILE, self.h // TILE
        self.bg = make_bg(c)
        self.ok, self.free = make_floor(c)
        door = c["door"]
        self.door_tile = tuple(door["tile"])
        self.errors: list[str] = []
        self.notes: list[str] = []

    # -- walk
    def reach(self) -> np.ndarray:
        return flood(self.free, self.door_tile)

    def pockets(self, reach: np.ndarray):
        return [(tx, ty) for ty in range(self.rows) for tx in range(self.cols) if self.free[ty, tx] and not reach[ty, tx]]

    # -- build
    def build(self):
        c = self.cfg
        err = self.errors
        reach = self.reach()
        if not self.free[self.door_tile[1], self.door_tile[0]]:
            err.append(f"the door's tile {self.door_tile} is not open floor")
        pockets = self.pockets(reach)
        if pockets:
            err.append(f"{len(pockets)} open tiles cannot be reached from the door (sealed pockets): " + ", ".join(f"({x},{y})" for x, y in pockets[:40]))
        pieces, atlas = make_pieces(c, self.bg)
        by_name = {p["name"]: p for p in pieces}
        reg = load_seats(c) if c.get("seats") else {"seats": []}
        spots, seen_ids, seen_at = [], set(), {}
        tiles = {}
        for i, s in enumerate(reg["seats"]):
            if s["id"] in seen_ids:
                err.append(f"seat id {s['id']} is used twice")
            seen_ids.add(s["id"])
            if s.get("retired"):
                spots.append({"role": "retired", "pose": "idle", "face": "front", "x": 0, "y": 0, "sort": 0, "tile": list(self.door_tile), "id": s["id"], "retired": True})
                continue
            x, y = seat_xy(s)
            fx, fy = x + FEET_X, y + FEET_Y
            if not (0 <= x and x + 16 <= self.w and 0 <= y and y + 32 <= self.h):
                err.append(f"seat {s['id']}: its sprite box is outside the room")
            if (x, y) in seen_at:
                err.append(f"seat {s['id']} is where {seen_at[(x, y)]} is")
            seen_at[(x, y)] = s["id"]
            t = stand_tile(self.free, reach, s, fx, fy)
            if t is None or not reach[t[1], t[0]]:
                err.append(f"seat {s['id']}: no reachable tile to stand on")
                t = self.door_tile
            else:
                cx, cy = feet_of_tile(*t)
                d = math.hypot(cx - fx, cy - fy)
                if d > s.get("maxStand", 34):
                    err.append(f"seat {s['id']}: the nearest reachable standing tile {t} is {d:.0f} px from the chair (limit {s.get('maxStand', 34)})")
            tiles[s["id"]] = t
            z = s.get("sort")
            if z is None:
                tab = s.get("table")
                if tab:
                    if tab not in by_name:
                        err.append(f"seat {s['id']}: no piece named {tab}")
                        z = fy
                    else:
                        z = by_name[tab]["z"] + (0.5 if s.get("side") == "s" else -0.5)
                else:
                    z = fy + 0.25
            spots.append({"role": "seat", "pose": s["pose"], "face": s["face"], "x": x, "y": y, "sort": round(float(z), 2), "tile": list(t), "id": s["id"]})
        for st in c.get("staff", []):
            x, y = int(st["x"]) - 8, int(st["y"]) - 31
            spots.append({"role": "barista", "pose": "idle", "face": st.get("face", "front"), "x": x, "y": y, "sort": st.get("sort", float(st["y"]) + .25), "tile": list(self.door_tile), "staff": st["staff"]})
        if not pieces:
            err.append("no pieces")
        lib = json.loads(rel("public/library/layout.json").read_text())
        dx, dy = c["door"]["x"], c["door"]["y"]
        grid = ["".join("." if reach[y, x] else "#" for x in range(self.cols)) for y in range(self.rows)]
        layout = {
            "about": f"{c['id']}: made from one picture by tools/art/room_from_image.py ({c['config_note'] if 'config_note' in c else 'config ' + str(self.cfg_path.relative_to(ROOT))}); do not edit.",
            "room": c["id"], "w": self.w, "h": self.h, "tile": TILE, "cols": self.cols, "rows": self.rows, "wallH": 0, "fps": 10, "loop": 120,
            "door": {"x": dx, "y": dy, "tile": list(self.door_tile)},
            "walk": grid, "spots": spots, "pieces": [{k: v for k, v in p.items() if k != "name"} for p in pieces], "pieceNames": [p["name"] for p in pieces],
            "anims": [], "lights": c.get("lights", []), "people": lib["people"],
        }
        self.layout, self.atlas, self.pieces, self.reach_grid = layout, atlas, pieces, reach
        return layout

    def write(self, out: Path):
        out.mkdir(parents=True, exist_ok=True)
        (out / "bg.png").write_bytes(png_bytes(self.bg))
        (out / "pieces.png").write_bytes(png_bytes(self.atlas))
        (out / "anims.png").write_bytes(png_bytes(np.zeros((1, 1, 4), np.uint8)))
        (out / "layout.json").write_text(json.dumps(self.layout, separators=(",", ":"), ensure_ascii=False) + "\n")
        total = 0
        for n in ("bg.png", "pieces.png", "anims.png", "layout.json"):
            sz = (out / n).stat().st_size
            total += sz
            print(f"  {n:12} {sz:8d} bytes")
        spots = self.layout["spots"]
        print(f"  {'total':12} {total:8d} bytes; {len(self.pieces)} pieces, {sum(s['role'] == 'seat' for s in spots)} seats, "
              f"{int(self.reach_grid.sum())} open tiles of {self.cols * self.rows}")


# ------------------------------------------------------------------------------------------------------------- pictures
def overlay(room: Room, zoom=2) -> Image.Image:
    base = Image.fromarray(room.bg).convert("RGBA")
    img = base.resize((room.w * zoom, room.h * zoom), Image.NEAREST)
    d = ImageDraw.Draw(img, "RGBA")
    reach = room.reach_grid
    for ty in range(room.rows):
        for tx in range(room.cols):
            x0, y0 = tx * TILE * zoom, (ty * TILE + 4) * zoom
            if room.free[ty, tx] and reach[ty, tx]:
                d.rectangle([x0, y0, x0 + TILE * zoom - 1, y0 + TILE * zoom - 1], fill=(40, 220, 90, 70), outline=(40, 220, 90, 120))
            elif room.free[ty, tx]:
                d.rectangle([x0, y0, x0 + TILE * zoom - 1, y0 + TILE * zoom - 1], fill=(255, 40, 220, 120))
    for p in room.pieces:
        d.rectangle([p["x"] * zoom, p["y"] * zoom, (p["x"] + p["w"]) * zoom, (p["y"] + p["h"]) * zoom], outline=(60, 160, 255, 200))
        d.line([p["x"] * zoom, p["z"] * zoom, (p["x"] + p["w"]) * zoom, p["z"] * zoom], fill=(255, 255, 0, 220))
    for s in room.layout["spots"]:
        if s["role"] != "seat":
            continue
        x, y = s["x"] * zoom, s["y"] * zoom
        d.rectangle([x, y, x + 16 * zoom, y + 32 * zoom], outline=(255, 120, 40, 220))
        fx, fy = (s["x"] + FEET_X) * zoom, (s["y"] + FEET_Y) * zoom
        d.ellipse([fx - 2, fy - 2, fx + 2, fy + 2], fill=(255, 255, 255, 255))
        cx, cy = feet_of_tile(*s["tile"])
        d.line([fx, fy, cx * zoom, cy * zoom], fill=(255, 255, 255, 200), width=1)
        d.ellipse([cx * zoom - 3, cy * zoom - 3, cx * zoom + 3, cy * zoom + 3], outline=(255, 255, 255, 255))
        d.text((x + 2, y + 2), s["id"].split("-")[-1], fill=(255, 255, 255, 255))
    dx, dy = room.layout["door"]["x"], room.layout["door"]["y"]
    d.ellipse([dx * zoom - 5, dy * zoom - 5, dx * zoom + 5, dy * zoom + 5], outline=(255, 0, 0, 255), width=2)
    for lt in room.layout["lights"]:
        d.ellipse([lt["x"] * zoom - 3, lt["y"] * zoom - 3, lt["x"] * zoom + 3, lt["y"] * zoom + 3], outline=(255, 255, 0, 255))
    return img.convert("RGB")


def seated_picture(room: Room, zoom=3, extra_walkers=True, look_of=None) -> Image.Image:
    """The engine's draw order, in Python: bg, then pieces and people sorted by depth. Every seat holds a person of people.png; a few
    walkers stand on standing tiles. For judging occlusion and where a person sits, before the browser."""
    people = Image.open(rel("public/library/layout.json").parent / "people.png").convert("RGBA")
    lay = room.layout
    R = lay["people"]["rows"]
    items = []
    for p in lay["pieces"]:
        items.append((p["z"], 0, ("piece", p)))
    n = 0
    for s in lay["spots"]:
        if s["role"] not in ("seat", "barista"):
            continue
        look = (n * 5 + 2) % 12 if s["role"] == "seat" else lay["people"]["staff"][s.get("staff", "butler")]
        n += 1
        if s["pose"] == "sit":
            f = R["sit"] + (0 if s["face"] == "right" else 6)
        elif s["pose"] == "read":
            f = R["read"]
        elif s["pose"] in ("stool", "chairback"):
            f = R["stool"]
        else:
            f = R["idle"] + ["right", "back", "left", "front"].index(s["face"]) * 6
        fr = people.crop((f * 16, look * 32, f * 16 + 16, look * 32 + 32))
        items.append((s["sort"] + .01, 1, ("person", s["x"], s["y"], fr)))
    img = Image.fromarray(room.bg).convert("RGBA")
    atlas = Image.fromarray(room.atlas)
    for z, _, it in sorted(items, key=lambda t: (t[0], t[1])):
        if it[0] == "piece":
            p = it[1]
            img.alpha_composite(atlas.crop((p["ax"], p["ay"], p["ax"] + p["w"], p["ay"] + p["h"])), (p["x"], p["y"]))
        else:
            img.alpha_composite(it[3], (it[1], it[2]))
    return img.convert("RGB").resize((room.w * zoom, room.h * zoom), Image.NEAREST)


def grid_crop(img: Image.Image, x0, y0, x1, y1, zoom=5, step=16, out="g.png"):
    c = img.crop((x0, y0, x1, y1)).convert("RGB").resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST)
    d = ImageDraw.Draw(c, "RGBA")
    for gx in range(x0 - x0 % 8, x1 + 1, 8):
        if gx < x0:
            continue
        X = (gx - x0) * zoom
        major = gx % step == 0
        d.line([(X, 0), (X, c.size[1])], fill=(255, 255, 255, 110 if major else 40))
        if major:
            d.text((X + 2, 2), str(gx), fill=(255, 255, 0, 255))
    for gy in range(y0 - y0 % 8, y1 + 1, 8):
        if gy < y0:
            continue
        Y = (gy - y0) * zoom
        major = gy % step == 0
        d.line([(0, Y), (c.size[0], Y)], fill=(255, 255, 255, 110 if major else 40))
        if major:
            d.text((2, Y + 2), str(gy), fill=(0, 255, 255, 255))
    c.save(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("config")
    ap.add_argument("--check", action="store_true", help="run the checks, write nothing")
    ap.add_argument("--out", help="output directory (default: the config's `out`) or the file for --grid")
    ap.add_argument("--preview", help="write the overlay (walkable tiles, pieces, seats) here")
    ap.add_argument("--seated", help="write the room with a person in every seat, in the engine's draw order, here")
    ap.add_argument("--grid", help="x0,y0,x1,y1: write a labelled crop of the final bg (use --zoom, --out) and stop")
    ap.add_argument("--zoom", type=int, default=0)
    a = ap.parse_args(argv)
    room = Room(rel(a.config))
    if a.grid:
        x0, y0, x1, y1 = (int(v) for v in a.grid.split(","))
        grid_crop(Image.fromarray(room.bg), x0, y0, x1, y1, a.zoom or 5, out=a.out or "grid.png")
        return 0
    room.build()
    if a.preview:
        Path(a.preview).parent.mkdir(parents=True, exist_ok=True)
        overlay(room, a.zoom or 2).save(a.preview)
    if a.seated:
        Path(a.seated).parent.mkdir(parents=True, exist_ok=True)
        seated_picture(room, a.zoom or 3).save(a.seated)
    if room.errors:
        print("THE ROOM HAS PROBLEMS:", file=sys.stderr)
        for e in room.errors:
            print("  - " + e, file=sys.stderr)
    if not a.check:
        out = rel(a.out) if a.out and not a.grid else rel(room.cfg["out"])
        print(f"{room.cfg['id']} -> {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
        room.write(out)
    else:
        print(f"{room.cfg['id']}: {int(room.reach_grid.sum())} open tiles, {sum(s['role'] == 'seat' for s in room.layout['spots'])} seats, {len(room.pieces)} pieces")
    return 1 if room.errors else 0


if __name__ == "__main__":
    sys.exit(main())
