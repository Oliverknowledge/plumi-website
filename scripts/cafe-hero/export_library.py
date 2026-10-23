"""The homepage's Grand Library: the co-founder's launch room (make_grand_library.py) with its crowd taken out, cut
into the few derived images the website's canvas needs, plus a cast of people as composed frame strips.

    python3 scripts/cafe-hero/export_library.py KIT_DIR [OUT_DIR] [--preview grid.png]

KIT_DIR is the co-founder's study_room folder (its scripts plus vendor/modern_interiors_full), for instance
`3 Content Creation/Engines/lofi/mockups/study_room`. OUT_DIR defaults to public/library. Needs numpy and pillow.

LICENCE. The art is LimeZu's Modern Interiors (full licence: commercial and marketing use with credit, never
redistribution of the asset files). So nothing from the pack is copied: the room is shipped as a rendered picture,
the things people can be behind are cut from that picture, the animation is baked into the pixels that change,
and the people are pre-composed, restyled frame strips for a fixed set of looks. No pack sheet, layer or animated
object strip ever leaves the kit. Never commit the kit or its vendor/ folder. Credit: limezu.itch.io.

What it writes (art pixels; the browser scales them up with nearest-neighbour):
  bg.png       the room with nobody in it, graded, at tick 0, without its lamplight (the page adds the light over
               everything, people included, the way the kit lights its renders)
  pieces.png   an atlas of the pieces people can be behind (tables, chairs, shelves, counters, the railing), each
               cut from bg.png, with the y it stands on
  anims.png    everything that moves (fire, cats, candles, steam, rain, doors, the butler's bubble, fairy lights)
               as the pixels that change, each distinct frame stored once
  people.png   the cast's looks x 78 frames of 16 x 32 (idle, walk, sit, phone, read, and sat on a stool from behind)
  layout.json  the walkable 16 px grid (both floors, joined by the stairs), seats and standing spots, pieces,
               animations, lamps and the entrance

How it works: the kit's own make_grand_library.frame() draws the room exactly as it does for grand_library.png, with
hooks that record every blit, skip every person (so the seats come from where the crowd sat, the walkers are left
out) and skip the lamps (the page draws those). It replaced export_cafe.py (in git history), which did the same for the
café the hero showed before 23 October 2026.
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
OUT = Path(args[1]) if len(args) > 1 else Path(__file__).resolve().parents[2] / "public" / "library"
sys.path.insert(0, str(KIT))

import cafe_kit as ck  # noqa: E402
import full_kit as K  # noqa: E402
import make_library_full as LF  # noqa: E402
import make_grand_library as M  # noqa: E402

W, H, TILE = M.W, M.H, 16
COLS, ROWS = W // TILE, H // TILE
WALL_H = M.WALL_H
ENTRANCE = (456, 504)                  # the gap in the front wall (walls() in make_grand_library)

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
orig_vary, orig_books, orig_lengthen, orig_rug = ck.vary, ck.books, K.lengthen, K.rug9
orig_wall_column, orig_tint, orig_stairs = M.wall_column, M.tint, M.long_stairs

M.piece = lambda name: tag(orig_piece(name), ("piece", name))
LF.piece = M.piece
M.tile = lambda *a: tag(orig_tile(*a), ("flat", "tile"))
M.anim = lambda name, tick, every=2: tag(orig_anim(name, tick, every), ("anim", name))
M.wall_column = lambda *a, **k: tag(orig_wall_column(*a, **k), ("flat", "wall"))
M.tint = lambda a, *x, **k: tag(orig_tint(a, *x, **k), tag_of(a) or ("flat", "wall"))
M.long_stairs = lambda: tag(orig_stairs(), ("flat", "stairs"))
K.rug9 = lambda *a, **k: tag(orig_rug(*a, **k), ("flat", "rug"))
ck.vary = lambda a, **kw: tag(orig_vary(a, **kw), tag_of(a) or ("piece", "?"))
ck.books = lambda a, seed: tag(orig_books(a, seed), tag_of(a) or ("piece", "books"))
K.Player.frame = lambda self, kind, view, tick, every=6: tag(orig_frame(self, kind, view, tick, every),
                                                              ("player", kind, view, self))


def lengthen_hook(f):
    """The carrels, pods and the bar seat people on stools, backs to us: K.lengthen(frame)[4:24]."""
    out = orig_lengthen(f).copy()                             # its own array, so the [4:24] crop still finds the tag
    t = tag_of(f)
    return tag(out, ("player", "stool", "back", t[3])) if t and t[0] == "player" else out


K.lengthen = lengthen_hook

REC = {"on": False, "blits": [], "players": [], "lights": []}
orig_blit = K.Canvas.blit


def blit_hook(self, s, x, y):
    t = tag_of(s)
    if t and t[0] == "player":
        if REC["on"]:
            REC["players"].append({"seq": len(REC["blits"]) - .5, "x": x, "y": y, "h": s.shape[0], "tag": t})
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
SOFA = {38, 39, 116, 117}                                    # nooks() and reading_room()
BROWSE = {34, 35, 65, 66, 120, 121}                          # the stacks, the railside shelves, the front shelves
LIBRARIAN = 64
spots = []
for p in players:
    _, kind, view, who = p["tag"]
    if kind == "walk":
        continue
    x, y, seq = p["x"], p["y"], p["seq"]
    rect = (x, y, 16, p["h"])
    lo = [q for q in pieces if q["blit"]["seq"] < seq and overlaps(q["blit"], rect)]
    hi = [q for q in pieces if q["blit"]["seq"] > seq and overlaps(q["blit"], rect)]
    bottom = y + p["h"] - 1
    lo_key = max((q["key"] for q in lo), default=bottom - 40)
    hi_key = min((q["key"] for q in hi), default=None)
    if hi_key is None:
        sort = max(lo_key + .5, bottom)
    elif lo_key < hi_key:
        sort = (lo_key + hi_key) / 2
    else:
        sort = hi_key - .25
        for q in lo:
            if q["key"] >= sort:
                q["key"] = sort - .25
    idx = who.seed
    if who is M.BUTLER:
        role, staff = "barista", "butler"
    elif idx == LIBRARIAN and kind == "idle":
        role, staff = "barista", "librarian"
    elif idx in SOFA:
        role, staff = "sofa", None
    elif idx in BROWSE:
        role, staff = "browse", None
    else:
        role, staff = "seat", None
    pose = {"sit2": "sit"}.get(kind, kind)
    s = {"role": role, "pose": pose, "face": view, "x": int(x), "y": int(y), "sort": round(float(sort), 2),
         "up": bool(y + p["h"] < M.MEZZ[1])}
    if staff:
        s["staff"] = staff
    spots.append(s)

# --- the floor: walls, the drop between the floors, and the footprints of what stands on it ---------------------
blocked = np.zeros((H, W), bool)
blocked[:WALL_H] = True                                       # the upstairs back wall
blocked[:, :M.SIDE] = True
blocked[:, W - M.SIDE:] = True
blocked[H - 10:] = True                                       # the front wall, open at the entrance
blocked[H - 10:, ENTRANCE[0]:ENTRANCE[1]] = False
blocked[M.MEZZ[1] - 6:M.GROUND + 4] = True                    # the mezzanine's lip and face, but for the stairs
for sx in M.STAIRS:
    blocked[M.MEZZ[1] - 12:M.GROUND + 40, sx + 2:sx + 30] = False
for x in (528, 612, 696, 780):                                # the glass pods: their sitters stay inside
    blocked[WALL_H + 30:WALL_H + 30 + 84, x:x + 72] = True
bx0, by0, bx1, by1 = M.BAR                                    # the Butler's Bar: its brick back wall and side wall
blocked[by0:by0 + M.BAR_WALL + 8, bx0:bx1] = True
blocked[by0:by1, bx1 - 10:bx1] = True
blocked[M.BAR_DOOR + 4:M.BAR_DOOR + 44, bx1 - 10:bx1] = False
foot = []
for q in pieces:
    b = q["blit"]
    if "on" in b or b["w"] * b["h"] < 100 or b["y"] + b["h"] <= WALL_H + 4:
        continue
    if b["tag"] and b["tag"][1] in ("mezz_lip", "rail_wood"):
        continue                                              # the drop is blocked above; the stairs' tops stay open
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
door_x = sum(ENTRANCE) // 2
door_tile = min(((abs(feet(x, y)[0] - door_x) + abs(feet(x, y)[1] - (H - 4)), x, y)
                 for y in range(ROWS) for x in range(COLS) if free[y, x]))[1:]
# keep only what can be reached from the entrance
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
    """The floor tile a person walks to for a seat or spot: the nearest reachable one to where their feet are, on
    the same floor, on the side the chair faces away from (a sitter facing right came in from the left)."""
    px, py = s["x"] + 8, s["y"] + 31
    best = None
    for ty in range(ROWS):
        for tx in range(COLS):
            if not grid[ty, tx]:
                continue
            fx, fy = feet(tx, ty)
            if (fy < M.MEZZ[1]) != s["up"]:
                continue
            d = (fx - px) ** 2 + (fy - py) ** 2
            if s["pose"] == "sit":
                d += 400 if (s["face"] == "right" and fx > px + 4) or (s["face"] == "left" and fx < px - 4) else 0
            if best is None or d < best[0]:
                best = (d, tx, ty)
    return [best[1], best[2]]


for s in spots:
    s["tile"] = approach(s)
    del s["up"]


# --- packing ---------------------------------------------------------------------------------------------------
def pack(boxes, width=512):
    width = max([width] + [w for _, w, _ in boxes])
    x, y, row, out = 0, 0, 0, {}
    for name, w, h in sorted(boxes, key=lambda b: (-b[2], -b[1])):
        if x + w > width:
            x, y, row = 0, y + row, 0
        out[name] = (x, y)
        x += w + 1
        row = max(row, h + 1)
    return out, y + row, width


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
at, height, aw = pack(boxes)
atlas = np.zeros((height, aw, 4), np.uint8)
for name, a in sprites.items():
    x, y = at[name]
    atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
for r in piece_rows:
    r["ax"], r["ay"] = map(int, at.pop(r.pop("id")))

# --- what moves: the pixels that change, split by the depth of whatever they belong to --------------------------
LOOP = M.LOOP
print(f"rendering {LOOP} frames…", flush=True)
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
a_at, a_height, a_w = pack(a_boxes)
a_atlas = np.zeros((max(1, a_height), a_w, 4), np.uint8)
for name, a in a_sprites.items():
    x, y = a_at[name]
    a_atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
for a in anims:
    a["frames"] = [list(map(int, a_at[f])) for f in a["frames"]]

# --- the people: a cast of looks from the co-founder's crowd, as composed frame strips -----------------------------
# The first twelve are the visitor's to choose from; the rest fill the room; the last two are the staff.
CAST = [2, 5, 6, 9, 10, 12, 18, 19, 20, 24, 25, 26,
        3, 4, 7, 8, 11, 13, 14, 15, 16, 17, 21, 22, 23, 27, 28, 29, 30, 31, 33, 36, 40, 52, 56, 57]
STAFF = [M.P[LIBRARIAN], M.BUTLER]
BOOKS = [1, 2, 3, 4, 5, 6]
STRIP = [("idle", v, i) for v in ("right", "back", "left", "front") for i in range(6)] + \
        [("walk", v, i) for v in ("right", "back", "left", "front") for i in range(6)] + \
        [("sit", v, i) for v in ("right", "left") for i in range(6)] + \
        [("phone", "front", i) for i in range(6)] + [("read", "front", i) for i in range(6)] + \
        [("stool", "back", i) for i in range(6)]
cast = [M.P[i] for i in CAST] + STAFF
people = np.zeros((32 * len(cast), 16 * len(STRIP), 4), np.uint8)
for r, p in enumerate(cast):
    plain = K.Player(*p.layers[:5], phones=p.phones, seed=0)
    reading = K.Player(*p.layers[:5], book=BOOKS[r % len(BOOKS)], phones=p.phones, seed=0)
    for c, (kind, view, f) in enumerate(STRIP):
        if kind == "stool":
            a = np.zeros((32, 16, 4), np.uint8)
            crop = orig_lengthen(orig_frame(plain, "idle", "back", f, 1))[4:24]
            a[:crop.shape[0]] = crop
            a = a.astype(float)
        else:
            a = orig_frame(reading if kind == "read" else plain, kind, view, f, 1).astype(float)
        a[..., :3] = M.grade(a[..., :3])
        people[r * 32:(r + 1) * 32, c * 16:(c + 1) * 16] = a.clip(0, 255).astype(np.uint8)

# --- write ---------------------------------------------------------------------------------------------------------
fire = [lt for lt in lights if lt[4] == (255, 176, 104)]
layout = {
    "about": "The homepage's Grand Library: the co-founder's launch room without its crowd. Art: LimeZu, Modern "
             "Interiors (limezu.itch.io), derived renders only. Made by scripts/cafe-hero/export_library.py; do not edit.",
    "w": W, "h": H, "tile": TILE, "cols": COLS, "rows": ROWS, "wallH": WALL_H, "fps": 10, "loop": LOOP,
    "door": {"x": door_x, "y": H - 2, "tile": list(door_tile)},
    "walk": ["".join("." if grid[y, x] else "#" for x in range(COLS)) for y in range(ROWS)],
    "spots": spots, "pieces": piece_rows, "anims": anims,
    "lights": [{"x": cx, "y": cy, "r": r, "k": k, "rgb": list(col), "sq": sq, "fire": lt in fire}
               for lt in lights for (cx, cy, r, k, col, sq) in [lt]],
    "people": {"looks": len(cast), "choose": 12, "staff": {"librarian": len(cast) - 2, "butler": len(cast) - 1},
               "frames": len(STRIP),
               "rows": {"idle": 0, "walk": 24, "sit": 48, "phone": 60, "read": 66, "stool": 72},
               "phones": [p.phones is not None for p in cast]},
}
OUT.mkdir(parents=True, exist_ok=True)
files = {"bg.png": png_bytes(static), "pieces.png": png_bytes(atlas), "anims.png": png_bytes(a_atlas),
         "people.png": png_bytes(people)}
for name, data in files.items():
    (OUT / name).write_bytes(data)
(OUT / "layout.json").write_text(json.dumps(layout, separators=(",", ":"), ensure_ascii=False) + "\n")
total = 0
for name in list(files) + ["layout.json"]:
    size = (OUT / name).stat().st_size
    total += size
    print(f"{name:12} {size:8d} bytes")
print(f"{'total':12} {total:8d} bytes; {len(piece_rows)} pieces, {len(anims)} moving things, {len(spots)} spots "
      f"({sum(s['role'] in ('seat', 'sofa') for s in spots)} seats), loop {LOOP} ticks")

if PREVIEW:
    p = static.astype(float).copy()
    for y in range(ROWS):
        for x in range(COLS):
            px, py = feet(x, y)
            p[py - 1:py + 1, px - 1:px + 1] = (80, 220, 120) if grid[y, x] else (230, 60, 60)
    for s in spots:
        col = {"seat": (80, 160, 255), "sofa": (80, 160, 255), "barista": (255, 255, 255)}.get(s["role"], (255, 120, 220))
        p[s["y"] + 18:s["y"] + 20, s["x"] + 4:s["x"] + 12] = col
        fx, fy = feet(*s["tile"])
        p[fy - 2:fy + 2, fx - 2:fx + 2] = col
    Image.fromarray(p.clip(0, 255).astype(np.uint8)).resize((W * 2, H * 2), Image.NEAREST).save(PREVIEW)
