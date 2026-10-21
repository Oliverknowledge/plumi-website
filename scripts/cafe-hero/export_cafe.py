"""The homepage hero's café: the co-founder's Café & Library (make_cafe_full.py) with its crowd taken out, cut
into the few derived images the website's canvas needs, plus a small fixed cast of people as composed frame strips.

    python3 scripts/cafe-hero/export_cafe.py KIT_DIR [OUT_DIR] [--preview grid.png]

KIT_DIR is the team-internal `plumi_rooms` folder (its scripts plus vendor/modern_interiors_full). OUT_DIR defaults
to public/cafe. Needs numpy and pillow.

LICENCE. The art is LimeZu's Modern Interiors (full licence: commercial and marketing use with credit, never
redistribution of the asset files). So nothing from the pack is copied: the room is shipped as a rendered picture,
the things people can stand behind are cut from that picture, the animation is baked into the pixels that change,
and the people are pre-composed, restyled frame strips for a fixed set of looks. No pack sheet, layer or animated
object strip ever leaves the kit. Never commit the kit or its vendor/ folder. Credit: limezu.itch.io.

What it writes (art pixels; the browser scales them up with nearest-neighbour):
  cafe-bg.png       the room with nobody in it, graded, at tick 0, without its lamplight (the page adds the light
                    over everything, people included, the way the kit lights its renders)
  cafe-pieces.png   an atlas of the pieces people can be behind (tables, counters, chairs, the sofa's front edge),
                    each cut from cafe-bg.png, with the y it stands on
  cafe-anims.png    everything that moves (fire, cat, cups, candles, cuckoo clock, rain, fairy lights, steam) as the
                    pixels that change, each distinct frame stored once
  cafe-people.png   14 looks x 72 frames of 16 x 32 (idle, walk, sit, phone, read), graded like the room
  cafe.json         the walkable 16 px grid, seats and standing spots, pieces, animations, lamps and the door

How it works: the kit's own make_cafe_full.frame() draws the room exactly as it does for renders/cafe_full.png,
with hooks that record every blit, skip every person (so the seats come from where the crowd sat) and skip the
lamps and music notes (the page draws those).
"""
import io
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:]]
PREVIEW = None
if "--preview" in args:
    i = args.index("--preview")
    PREVIEW = args[i + 1]
    del args[i:i + 2]
if not args:
    sys.exit(__doc__)
KIT = Path(args[0]).resolve()
OUT = Path(args[1]) if len(args) > 1 else Path(__file__).resolve().parents[2] / "public" / "cafe"
sys.path.insert(0, str(KIT))

import cafe_kit as ck  # noqa: E402
import full_kit as K  # noqa: E402
import make_cafe_full as M  # noqa: E402

W, H, TILE = M.W, M.H, 16
COLS, ROWS = W // TILE, H // TILE
WALL_H = M.WALL_H
DOOR = (180, 24)                       # K.doorway(c, 180, WALL_H) in make_cafe_full.cafe(): x, width

# --- tags: what each drawn array is -------------------------------------------------------------------------
TAGS = {}


def tag(a, t):
    if isinstance(a, np.ndarray):
        TAGS[id(a)] = (t, a)
    return a


def tag_of(a):
    while isinstance(a, np.ndarray):
        e = TAGS.get(id(a))
        if e is not None and e[1] is a:
            return e[0]
        a = a.base
    return None


orig_piece, orig_tile, orig_anim, orig_frame = K.piece, K.tile, K.anim, K.Player.frame
orig_vary, orig_books = ck.vary, ck.books
orig_wall_column, orig_tint = M.wall_column, M.tint

M.piece = lambda name: tag(orig_piece(name), ("piece", name))
M.tile = lambda *a: tag(orig_tile(*a), ("flat", "tile"))
M.anim = lambda name, tick, every=2: tag(orig_anim(name, tick, every), ("anim", name))
M.wall_column = lambda *a, **k: tag(orig_wall_column(*a, **k), ("flat", "wall"))
M.tint = lambda a, *x, **k: tag(orig_tint(a, *x, **k), tag_of(a) or ("flat", "wall"))
ck.vary = lambda a, **kw: tag(orig_vary(a, **kw), tag_of(a) or ("piece", "?"))
ck.books = lambda a, seed: tag(orig_books(a, seed), tag_of(a) or ("piece", "books"))
K.Player.frame = lambda self, kind, view, tick, every=6: tag(orig_frame(self, kind, view, tick, every),
                                                              ("player", kind, view, self))
M.notes = lambda *a, **k: None                               # the crowd's music notes: the page draws its own

REC = {"on": False, "blits": [], "players": [], "lights": []}
orig_blit = K.Canvas.blit


def blit_hook(self, s, x, y):
    t = tag_of(s)
    if t and t[0] == "player":
        if REC["on"]:
            REC["players"].append({"seq": len(REC["blits"]) - .5, "x": x, "y": y, "tag": t})
        return
    orig_blit(self, s, x, y)
    if REC["on"]:
        REC["blits"].append({"seq": len(REC["blits"]), "x": x, "y": y, "h": s.shape[0], "w": s.shape[1],
                             "mask": s[..., 3] == 255, "tag": t})


def light_hook(self, cx, cy, r, k=.3, col=(255, 210, 140), squash=1.5):
    if REC["on"]:
        REC["lights"].append((cx, cy, r, k, tuple(col), squash))


K.Canvas.blit, K.Canvas.light = blit_hook, light_hook


def render(tick, record=False):
    if not record:
        TAGS.clear()
    REC.update(on=record, blits=[], players=[], lights=[])
    img = M.frame(tick)
    REC["on"] = False
    return img


# --- the room ------------------------------------------------------------------------------------------------
static = render(0, record=True)
blits, players, lights = REC["blits"], REC["players"], REC["lights"]

owner = np.full((H, W), -1, int)
pieces = []
for b in blits:
    t = b["tag"]
    flat = (t is None and (b["mask"].all() or b["h"] * b["w"] > 20000)) or \
        (t is not None and (t[0] == "flat" or "rug" in str(t[1])))
    x, y, h, w = b["x"], b["y"], b["h"], b["w"]
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0:
        continue
    m = b["mask"][y0 - y:y1 - y, x0 - x:x1 - x]
    if flat:
        owner[y0:y1, x0:x1][m] = -1
        continue
    key = float(y + h)
    cx, cy = min(max(x + w // 2, 0), W - 1), min(max(y + h - 2, 0), H - 1)
    under = owner[cy, cx]
    if under >= 0 and pieces[under]["key"] > y + h:          # a cup on a table is drawn with the table
        key = pieces[under]["key"]
        b["on"] = under
    b["pid"] = len(pieces)
    pieces.append({"blit": b, "key": key})
    owner[y0:y1, x0:x1][m] = b["pid"]


def overlaps(b, rect):
    x, y, w, h = rect
    return b["x"] < x + w and x < b["x"] + b["w"] and b["y"] < y + h and y < b["y"] + b["h"]


# --- who sat and stood where in the co-founder's render ---------------------------------------------------------
ROLE = {0: "barista", 1: "barista", 2: "queue", 3: "queue", 4: "queue", 9: "sofa", 10: "sofa",
        11: "browse", 12: "browse", 21: "browse", 22: "browse"}
spots = []
for p in players:
    _, kind, view, who = p["tag"]
    if kind == "walk":
        continue
    x, y, seq = p["x"], p["y"], p["seq"]
    rect = (x, y, 16, 32)
    lo = [q for q in pieces if q["blit"]["seq"] < seq and overlaps(q["blit"], rect)]
    hi = [q for q in pieces if q["blit"]["seq"] > seq and overlaps(q["blit"], rect)]
    lo_key = max((q["key"] for q in lo), default=y + 31 - 40)
    hi_key = min((q["key"] for q in hi), default=None)
    if hi_key is None:
        sort = max(lo_key + .5, y + 31)
    elif lo_key < hi_key:
        sort = (lo_key + hi_key) / 2
    else:
        sort = hi_key - .25
        for q in lo:
            if q["key"] >= sort:
                q["key"] = sort - .25
    role = ROLE.get(who.seed, "seat")
    spots.append({"role": role, "pose": kind, "face": view, "x": int(x), "y": int(y), "sort": round(float(sort), 2)})

# --- the floor: walls and the footprints of what stands on it ---------------------------------------------------
blocked = np.zeros((H, W), bool)
blocked[:WALL_H] = True
foot = []
for q in pieces:
    b = q["blit"]
    if "on" in b or b["w"] * b["h"] < 100 or b["y"] + b["h"] <= WALL_H + 4:
        continue
    d = b["h"] if b["h"] <= 48 else 24
    foot.append((b["x"], b["y"] + b["h"] - d, b["x"] + b["w"], b["y"] + b["h"]))


def feet(tx, ty):
    return tx * TILE + TILE // 2, ty * TILE + 12


free = np.zeros((ROWS, COLS), bool)
for ty in range(ROWS):
    for tx in range(COLS):
        px, py = feet(tx, ty)
        if blocked[py, px] or px < 4 or px > W - 4:
            continue
        if any(x0 - 2 <= px < x1 + 2 and y0 - 1 <= py < y1 + 1 for x0, y0, x1, y1 in foot):
            continue
        free[ty, tx] = True
# the post between the café and the library is a wall only down to the floor: both rooms share the floor
door_x = DOOR[0] + DOOR[1] // 2
door_tile = min(((abs(feet(x, y)[0] - door_x) + abs(feet(x, y)[1] - (WALL_H + 12)), x, y)
                 for y in range(ROWS) for x in range(COLS) if free[y, x]))[1:]
# keep only what can be reached from the door
seen = np.zeros_like(free)
seen[door_tile[1], door_tile[0]] = True
q = deque([door_tile])
while q:
    x, y = q.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < COLS and 0 <= ny < ROWS and free[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((nx, ny))
grid = seen


def approach(s):
    """The floor tile a person walks to for a seat or spot: the nearest reachable one to where their feet are,
    on the side the chair faces away from (a sitter facing right came in from the left)."""
    px, py = s["x"] + 8, s["y"] + 31
    best = None
    for ty in range(ROWS):
        for tx in range(COLS):
            if not grid[ty, tx]:
                continue
            fx, fy = feet(tx, ty)
            d = (fx - px) ** 2 + (fy - py) ** 2
            if s["pose"] == "sit":
                d += 400 if (s["face"] == "right" and fx > px + 4) or (s["face"] == "left" and fx < px - 4) else 0
            if best is None or d < best[0]:
                best = (d, tx, ty)
    return [best[1], best[2]]


for s in spots:
    s["tile"] = approach(s)


# --- packing ---------------------------------------------------------------------------------------------------
def pack(boxes, width=512):
    x, y, row, out = 0, 0, 0, {}
    for name, w, h in sorted(boxes, key=lambda b: (-b[2], -b[1])):
        if x + w > width:
            x, y, row = 0, y + row, 0
        out[name] = (x, y)
        x += w + 1
        row = max(row, h + 1)
    return out, y + row


def png_bytes(a):
    if a.shape[2] == 4:
        a = a.copy()
        a[a[..., 3] == 0] = 0
    flat = a.reshape(-1, a.shape[2])
    cols, idx = np.unique(flat, axis=0, return_inverse=True)
    b = io.BytesIO()
    if len(cols) <= 256:
        im = Image.fromarray(idx.reshape(a.shape[:2]).astype(np.uint8), "P")
        im.putpalette(cols[:, :3].flatten().tolist())
        if a.shape[2] == 4:
            im.info["transparency"] = bytes(int(v) for v in cols[:, 3])
        im.save(b, "PNG", optimize=True, **({"transparency": bytes(int(v) for v in cols[:, 3])} if a.shape[2] == 4 else {}))
    else:
        Image.fromarray(a, "RGBA" if a.shape[2] == 4 else "RGB").save(b, "PNG", optimize=True)
    return b.getvalue()


# --- cut-outs: each piece as it shows in the finished room ---------------------------------------------------------
sprites, boxes, piece_rows = {}, [], []
for pid, q in enumerate(pieces):
    ys, xs = np.nonzero(owner == pid)
    if not len(ys):
        continue
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    if y1 <= WALL_H + 2:                                     # on the wall, above anyone's head
        continue
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = static[y0:y1, x0:x1]
    rgba[..., 3] = np.where(owner[y0:y1, x0:x1] == pid, 255, 0)
    name = f"p{pid}"
    sprites[name] = rgba
    boxes.append((name, x1 - x0, y1 - y0))
    piece_rows.append({"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "z": round(float(q["key"]), 2),
                       "id": name})
at, height = pack(boxes)
atlas = np.zeros((height, 512, 4), np.uint8)
for name, a in sprites.items():
    x, y = at[name]
    atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
for r in piece_rows:
    r["ax"], r["ay"] = map(int, at.pop(r.pop("id")))


# --- what moves: the pixels that change, split by the depth of whatever they belong to --------------------------
def lcm(a, b):
    return a * b // math.gcd(a, b)


LOOP = 1
for n in (30, 6, 12, 9, 54, 20, 12, 6):                      # cuckoo, fire, cups, candles, cat, lights, steam, rain
    LOOP = lcm(LOOP, n)
frames_all = [static] + [render(t) for t in range(1, LOOP)]
moving = np.zeros((H, W), bool)
for f in frames_all[1:]:
    moving |= (f != static).any(axis=2)


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def label(m):
    lab = np.zeros(m.shape, int)
    n = 0
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        qq = deque([(y0, x0)])
        while qq:
            y, x = qq.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    qq.append((ny, nx))
    return lab, n


depth = np.where(owner >= 0, np.array([q["key"] for q in pieces] + [0.0])[owner], 0.0)
depth[:WALL_H + 2] = 0.0                                      # on the wall: behind everyone
labels, n = label(dilate(moving, 2))
anims, a_sprites, a_boxes = [], {}, []
for k in range(1, n + 1):
    region = (labels == k) & moving
    for d in sorted(set(depth[region].tolist())):
        part = region & (depth == d)
        ys, xs = np.nonzero(part)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        sub = part[y0:y1, x0:x1]
        uniq, seq = [], []
        for shot in frames_all:
            crop = shot[y0:y1, x0:x1]
            key = crop[sub].tobytes()
            for i, (kk, _) in enumerate(uniq):
                if kk == key:
                    seq.append(i)
                    break
            else:
                uniq.append((key, crop))
                seq.append(len(uniq) - 1)
        if len(uniq) < 2:
            continue
        period = next(p for p in range(1, LOOP + 1) if LOOP % p == 0 and all(seq[t] == seq[t % p] for t in range(LOOP)))
        aid = f"a{len(anims)}"
        names = []
        for i, (_, crop) in enumerate(uniq):
            rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            rgba[..., :3] = crop
            rgba[..., 3] = np.where(sub, 255, 0)
            a_sprites[f"{aid}:{i}"] = rgba
            a_boxes.append((f"{aid}:{i}", x1 - x0, y1 - y0))
            names.append(f"{aid}:{i}")
        anims.append({"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0),
                      "z": round(float(d) + (.5 if d > 0 else 0), 2), "frames": names, "seq": seq[:period]})
a_at, a_height = pack(a_boxes)
a_atlas = np.zeros((max(1, a_height), 512, 4), np.uint8)
for name, a in a_sprites.items():
    x, y = a_at[name]
    a_atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
for a in anims:
    a["frames"] = [list(map(int, a_at[f])) for f in a["frames"]]

# --- the people: a fixed cast of looks from the co-founder's crowd, as composed frame strips -----------------------
CAST = [2, 5, 6, 9, 10, 12, 18, 19, 20, 24, 25, 26, 0, 1]     # twelve to choose from, then the two baristas
BOOKS = [1, 3, 5, 2, 4, 6, 1, 3, 5, 2, 4, 6, 1, 3]
STRIP = [("idle", v, i) for v in ("right", "back", "left", "front") for i in range(6)] + \
        [("walk", v, i) for v in ("right", "back", "left", "front") for i in range(6)] + \
        [("sit", v, i) for v in ("right", "left") for i in range(6)] + \
        [("phone", "front", i) for i in range(6)] + [("read", "front", i) for i in range(6)]
people = np.zeros((32 * len(CAST), 16 * len(STRIP), 4), np.uint8)
for r, (i, book) in enumerate(zip(CAST, BOOKS)):
    p = M.P[i]
    plain = K.Player(*p.layers[:5], phones=p.phones, seed=0)
    reading = K.Player(*p.layers[:5], book=book, phones=p.phones, seed=0)
    for c, (kind, view, f) in enumerate(STRIP):
        a = orig_frame(reading if kind == "read" else plain, kind, view, f, 1).astype(float)
        a[..., :3] = M.grade(a[..., :3])
        people[r * 32:(r + 1) * 32, c * 16:(c + 1) * 16] = a.clip(0, 255).astype(np.uint8)

# --- write ---------------------------------------------------------------------------------------------------------
fire = [lt for lt in lights if lt[4] == (255, 176, 104)]
layout = {
    "about": "The homepage hero's café: the co-founder's Café & Library without its crowd. Art: LimeZu, Modern "
             "Interiors (limezu.itch.io), derived renders only. Made by scripts/cafe-hero/export_cafe.py; do not edit.",
    "w": W, "h": H, "tile": TILE, "cols": COLS, "rows": ROWS, "wallH": WALL_H, "fps": 10, "loop": LOOP,
    "door": {"x": door_x, "y": WALL_H - 3, "tile": list(door_tile)},
    "walk": ["".join("." if grid[y, x] else "#" for x in range(COLS)) for y in range(ROWS)],
    "spots": spots, "pieces": piece_rows, "anims": anims,
    "lights": [{"x": cx, "y": cy, "r": r, "k": k, "rgb": list(col), "sq": sq, "fire": lt in fire}
               for lt in lights for (cx, cy, r, k, col, sq) in [lt]],
    "people": {"looks": len(CAST), "choose": 12, "frames": len(STRIP),
               "rows": {"idle": 0, "walk": 24, "sit": 48, "phone": 60, "read": 66},
               "phones": [M.P[i].phones is not None for i in CAST]},
}
OUT.mkdir(parents=True, exist_ok=True)
files = {"cafe-bg.png": png_bytes(static), "cafe-pieces.png": png_bytes(atlas), "cafe-anims.png": png_bytes(a_atlas),
         "cafe-people.png": png_bytes(people)}
for name, data in files.items():
    (OUT / name).write_bytes(data)
(OUT / "cafe.json").write_text(json.dumps(layout, separators=(",", ":"), ensure_ascii=False) + "\n")
total = 0
for name in list(files) + ["cafe.json"]:
    size = (OUT / name).stat().st_size
    total += size
    print(f"{name:16} {size:8d} bytes")
print(f"{'total':16} {total:8d} bytes; {len(piece_rows)} pieces, {len(anims)} moving things, {len(spots)} spots, "
      f"loop {LOOP} ticks")

if PREVIEW:
    p = static.astype(float).copy()
    for y in range(ROWS):
        for x in range(COLS):
            px, py = feet(x, y)
            p[py - 1:py + 1, px - 1:px + 1] = (80, 220, 120) if grid[y, x] else (230, 60, 60)
    for s in spots:
        col = {"seat": (80, 160, 255), "sofa": (80, 160, 255), "barista": (255, 255, 255)}.get(s["role"], (255, 120, 220))
        p[s["y"] + 30:s["y"] + 32, s["x"] + 4:s["x"] + 12] = col
        fx, fy = feet(*s["tile"])
        p[fy - 2:fy + 2, fx - 2:fx + 2] = col
    Image.fromarray(p.clip(0, 255).astype(np.uint8)).resize((W * 3, H * 3), Image.NEAREST).save(PREVIEW)
