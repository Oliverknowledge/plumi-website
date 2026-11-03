#!/usr/bin/env python3
"""
The animation of an animal, built from ONE standing frame per direction (the canonical frame) instead of the sheet's six walk frames.

WHY. ChatGPT redraws the whole figure in every walk frame: the eye, the cheek, the ribs of the jumper and the outline wander from
frame to frame (shimmer), the legs of some sheets barely move (capybara, hedgehog) and none of them has a consistent bob or stride.
So the sheet is used for what it is good at (one clean pose per direction: the head, torso, arms, tail and feet as drawn) and the
motion is made here, the same way for every animal, at the frame rate and in the pattern the people have:

  WALK (6 frames, played at the engine's 5 a second, two steps a cycle, like a person's `walk`):   k   0   1   2   3   4   5
      stride (the legs' spread, art px)                                                               2   1   0   2   1   0
      body bob (rows above the hip rise 1)                                                            0   0   1   0   0   1
      swing foot (lifted 1 row)                                                                       .   .   F   .   .   B
    side views: the legs are cut at the hip into the near half (the side the animal faces) and the far half and sheared apart into
    an inverted V (the feet at the bottom move, the hip does not); front and back views lift one foot at a time.
    The tail swings (a row up or down, as the idle's swish) against the bob.
  IDLE (6 frames at the engine's 1 per 6 ticks): a 1 px breath (rows above the seam rise) and the tail's swish, and in the front
    view a blink on one frame.
  SIT (right, left; 6 frames at 1 per 8 ticks): the head and torso as drawn, the tail tucked away (it would hang through the chair
    back), the far leg gone and the near leg folded forward under the table; a slow breath and a nod of the head.

Every frame is then given back its 1 px outline (any drawn pixel beside a clear one is the outline colour), which is what
`check_animals.py` asserts.
"""
from __future__ import annotations

import numpy as np

W, H = 24, 32
S = 1                                                 # the resolution: 1 is the engine's art pixel, 2 a frame of 48 x 64 (set_scale); every length below is in art pixels x S
DIR_DOWN, DIR_LEFT, DIR_UP, DIR_RIGHT = 0, 1, 2, 3
# the walk's pattern per frame
STRIDE = (2, 1, 0, 2, 1, 0)
BOB = (0, 0, 1, 0, 0, 1)
LIFT_A = (1, 2, 2, 0, 0, 0)                           # rows leg "a" is raised: toe off at the contact, swinging through the passing frame, down at the next contact
LIFT_B = (0, 0, 0, 1, 2, 2)
SWISH = (0, 1, 1, 0, -1, -1)                          # the tail's row offset (idle and walk)
BREATH = (0, 0, 1, 1, 0, 0)
SIT_BREATH = (0, 0, 0, 1, 1, 0)
SIT_NOD = (0, 0, 0, 0, 1, 0)
SIT_DROP = 1
SIT_BACK = 5
FORWARD = 3                                           # how far the folded near leg reaches towards the desk
STOOL_CUT = (4, 24)                                   # the rows a person's stool frames keep (rows 4 to 23)

Frame = np.ndarray
_BASE = {k: globals()[k] for k in ("BOB", "LIFT_A", "LIFT_B", "SWISH", "BREATH", "SIT_BREATH", "SIT_NOD")}
_BASE_INT = {"SIT_DROP": SIT_DROP, "SIT_BACK": SIT_BACK, "FORWARD": FORWARD, "PAD": 5}
_BASE_CUT = STOOL_CUT


def set_scale(n: int) -> None:
    """Works at `n` times the engine's resolution (a 2x strip: frames of 68 x 64, the art 48 x 64): the frame, every row and column count of the motion and the poses scale by n,
    the pattern of the frames does not (the same bob, stride and breath, in finer pixels)."""
    global W, H, S, PAD, FRAME_W, SIT_DROP, SIT_BACK, FORWARD, STOOL_CUT
    S = n
    W, H = 24 * n, 32 * n
    for k, v in _BASE.items():
        globals()[k] = tuple(x * n for x in v)
    SIT_DROP, SIT_BACK, FORWARD = (_BASE_INT[k] * n for k in ("SIT_DROP", "SIT_BACK", "FORWARD"))
    PAD = _BASE_INT["PAD"] * n
    FRAME_W = W + 2 * PAD
    STOOL_CUT = (_BASE_CUT[0] * n, _BASE_CUT[1] * n)


def on(f: Frame) -> np.ndarray:
    return f[..., 3] > 0


def blank() -> Frame:
    return np.zeros((H, W, 4), np.uint8)


def paste(dst: Frame, src: Frame, dx: int = 0, dy: int = 0, mask: np.ndarray | None = None) -> None:
    """Draws the opaque pixels of src (where mask, if given) over dst, moved by (dx, dy); what falls outside the frame is dropped."""
    m = on(src) if mask is None else (on(src) & mask)
    ys, xs = np.where(m)
    ty, tx = ys + dy, xs + dx
    ok = (ty >= 0) & (ty < H) & (tx >= 0) & (tx < W)
    dst[ty[ok], tx[ok]] = src[ys[ok], xs[ok]]


def reoutline(f: Frame, ol: tuple[int, int, int]) -> Frame:
    """Every drawn pixel with a clear 4-neighbour (or at the frame's edge) is the outline colour; one pixel holes are filled first."""
    a = on(f)
    p = np.pad(a, 1)
    nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    hole = ~a & (nb >= 3)
    if hole.any():
        ys, xs = np.where(hole)
        for y, x in zip(ys, xs):
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and a[yy, xx]:
                    f[y, x] = f[yy, xx]
                    break
        a = on(f)
        p = np.pad(a, 1)
    edge = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    f[edge, 0], f[edge, 1], f[edge, 2] = ol
    return f


def drop_specks(f: Frame) -> Frame:
    """Removes every piece but the biggest (a frame is one piece)."""
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
                    if 0 <= yy < H and 0 <= xx < W and a[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        st.append((yy, xx))
    if n > 1:
        big = np.bincount(lab.ravel())[1:].argmax() + 1
        f[(lab != big) & (lab > 0)] = 0
    return f


def join_pieces(f: Frame, min_px: int = 1) -> Frame:
    """Finer pixels leave a leg of a sheared walk frame a pixel off the body: every piece of at least `min_px` pixels is joined to the biggest by the shortest straight run of
    its own colour between them (a speck is still dropped)."""
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
                    if 0 <= yy < H and 0 <= xx < W and a[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        st.append((yy, xx))
    if n <= 1:
        return f
    sizes = np.bincount(lab.ravel())[1:]
    big = int(sizes.argmax()) + 1
    mp = np.array(np.where(lab == big)).T
    for k in range(1, n + 1):
        if k == big:
            continue
        if sizes[k - 1] < min_px:
            f[lab == k] = 0
            continue
        pp = np.array(np.where(lab == k)).T
        d = ((pp[:, None, :] - mp[None]) ** 2).sum(-1)
        i, j = np.unravel_index(d.argmin(), d.shape)
        (y0, x0), (y1, x1) = pp[i], mp[j]
        steps = max(abs(y1 - y0), abs(x1 - x0))
        for t in range(1, steps):
            yy, xx = int(round(y0 + (y1 - y0) * t / steps)), int(round(x0 + (x1 - x0) * t / steps))
            if not on(f)[yy, xx]:
                f[yy, xx] = f[y0, x0]
    return f


def breathe(f: Frame, seam: int, up: int) -> Frame:
    if not up:
        return f.copy()
    out = f.copy()
    out[: seam - up] = f[up: seam]
    out[seam - up: seam] = f[seam - 1]          # the last body row stays, the gap closes
    return out


def shift_cols(f: Frame, x0: int, x1: int, dy: int, r0: int = 0, r1: int = H) -> Frame:
    """The columns x0..x1 (inclusive), rows r0..r1-1, moved by dy rows; what is uncovered is clear."""
    if not dy:
        return f.copy()
    out = f.copy()
    x0, x1 = max(x0, 0), min(x1, W - 1)
    if x0 > x1:
        return out
    out[r0:r1, x0:x1 + 1] = 0
    seg = f[r0:r1, x0:x1 + 1]
    for y in range(r0, r1):
        t = y + dy
        if r0 <= t < r1:
            keep = on(seg[y - r0: y - r0 + 1])[0]
            row = out[t, x0:x1 + 1]
            row[keep] = seg[y - r0][keep]
    return out


def torso_x(f: Frame, jumper: set[tuple[int, int, int]]) -> float:
    ys, xs = np.where(on(f) & np.isin(f[..., 0].astype(int) * 65536 + f[..., 1].astype(int) * 256 + f[..., 2], [r * 65536 + g * 256 + b for r, g, b in jumper]))
    return float(xs.mean()) if len(xs) else W / 2


def neck_row(f: Frame, jumper: set[tuple[int, int, int]]) -> int:
    key = [r * 65536 + g * 256 + b for r, g, b in jumper]
    m = on(f) & np.isin(f[..., 0].astype(int) * 65536 + f[..., 1].astype(int) * 256 + f[..., 2], key)
    ys = np.where(m.any(1))[0]
    return int(ys.min()) if len(ys) else 16 * S


def swish(f: Frame, d: int, cx: int, tail: dict, k: int) -> Frame:
    """The tail's row offset for frame k: every column beyond the torso on the side away from the face (none from behind or with no tail)."""
    at = tail.get(("down", "left", "up", "right")[d])
    dy = SWISH[k]
    if at is None or not dy:
        return f
    if d in (DIR_DOWN, DIR_LEFT):
        return shift_cols(f, cx + at, W - 1, dy)
    if d == DIR_RIGHT:
        return shift_cols(f, 0, cx - at, dy)
    return f


def legs_of(f: Frame, hip: int, cx: int, legw: int) -> tuple[Frame, slice]:
    cols = slice(max(cx - legw, 0), min(cx + legw + 1, W))
    legs = blank()
    legs[hip:, cols] = f[hip:, cols]
    return legs, cols


def walk_frame(canon: Frame, d: int, k: int, cx: int, an, ol) -> Frame:
    hip, legw = an.hip, an.legw
    base = canon.copy()
    legs, cols = legs_of(base, hip, cx, legw)
    base[hip:, cols] = 0                                       # the legs come out, whatever else is down there (a tail) stays
    ys, xs = np.where(on(legs))
    m = int(round(float(xs.mean()))) if len(xs) else cx          # the legs are split where they are, not where the torso is
    out = swish(breathe(base, hip, BOB[k]), d, cx, an.tail, k)      # the body rises at the passing frames and the tail swings against it
    n = H - hip
    s = int(round(STRIDE[k] * an.stride / 2))
    lifts = {"a": LIFT_A[k], "b": LIFT_B[k]}
    if d in (DIR_DOWN, DIR_UP):
        left = legs.copy(); left[:, m:] = 0
        right = legs.copy(); right[:, :m] = 0
        halves = (("a", left, 0), ("b", right, 0))
        shears = False
    else:
        sgn = 1 if d == DIR_RIGHT else -1                      # which way it faces
        near = legs.copy(); far = legs.copy()
        if d == DIR_RIGHT:
            near[:, :m] = 0; far[:, m:] = 0
        else:
            near[:, m:] = 0; far[:, :m] = 0
        halves = (("b", far, -sgn), ("a", near, sgn))
        shears = True
    # each leg is grounded (its lowest row on the baseline), and the swing leg is lifted a row off it
    grounded = []
    for who, half, dirn in halves:
        ys = np.where(on(half).any(1))[0]
        if len(ys) and ys.max() < H - 1:
            gap = H - 1 - int(ys.max())                       # a leg that stops short is lengthened (its top row repeated), not floated
            g = blank()
            paste(g, half, 0, gap)
            for r in range(hip, hip + gap):
                g[r] = np.where(on(g[r:r + 1])[0][:, None], g[r], half[ys.min()])
            half = g
        grounded.append((who, half, dirn))
    for who, half, dirn in grounded:
        up = -lifts[who]
        if not shears:
            paste(out, half, 0, up)
            continue
        for r in range(n):
            off = int(round(s * (r + 1) / n)) * dirn
            row = blank()
            row[hip + r] = half[hip + r]
            paste(out, row, off, up)
    low = np.where(on(out).any(1))[0]
    if len(low) and low.max() < H - 1 and H - 1 - low.max() <= S:       # a frame whose grounded leg came out a row short (finer pixels): the feet go down to the baseline
        out = shift_rows_down(out, H - 1 - int(low.max()))
    return reoutline(join_pieces(out) if S > 1 else drop_specks(out), ol)


def idle_frame(canon: Frame, d: int, k: int, cx: int, an, ol, neck: int) -> Frame:
    f = breathe(canon, an.hip, BREATH[k])
    f = swish(f, d, cx, an.tail, k)
    if d == DIR_DOWN and k == 5:
        f = blink(f, neck)
    return reoutline(drop_specks(f), ol)


def blink(f: Frame, neck: int) -> Frame:
    """The eyes close: each dark blob inside the face of two or more rows loses its top row (a squint); a single row stays."""
    out = f.copy()
    a = on(f)
    lum = f[..., :3].astype(int).sum(-1)
    p = np.pad(a, 1)
    inside = a & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    dark = inside & (lum < 150)
    dark[neck:] = False
    dark[:5 * S] = False
    for y in range(H - 1):
        for x in range(W):
            if dark[y, x] and dark[y + 1, x] and not (y > 0 and dark[y - 1, x]):
                # the top row of a blob of at least two rows takes the colour of the pixel above it
                if y > 0 and a[y - 1, x]:
                    out[y, x] = f[y - 1, x]
    return out


def sit_frame(canon: Frame, d: int, k: int, cx: int, an, ol, neck: int) -> Frame:
    """Seated, facing the desk (d is DIR_RIGHT or DIR_LEFT): lowered, tail tucked, far leg gone, near leg folded forward."""
    hip = an.hip
    sgn = 1 if d == DIR_RIGHT else -1
    body = canon.copy()
    legs, cols = legs_of(body, hip, cx, an.legw)
    body[hip:] = 0                                              # nothing below the hip is kept: the tail, the legs
    # tuck the tail: whatever of the body lies beyond the torso on the side away from the face, below the shoulders, is the tail
    at = an.tail.get(("down", "left", "up", "right")[d])
    if at is not None:
        rear = (slice(None), slice(0, cx - at + 1)) if d == DIR_RIGHT else (slice(None), slice(cx + at, W))
        body[an.shoulder:hip][:, rear[1]] = 0
    near = legs.copy()
    if d == DIR_RIGHT:
        near[:, :cx] = 0
    else:
        near[:, cx:] = 0
    f = body
    # the near leg, folded: its feet's rows moved up to sit under the hip and forward
    paste(f, near, sgn * FORWARD, -((H - hip) // 2))
    f = shift_rows_down(f, SIT_DROP)
    f = breathe(f, hip + SIT_DROP, SIT_BREATH[k])
    if SIT_NOD[k]:
        f = nod(f, neck + SIT_DROP)
    return reoutline(drop_specks(f), ol)


def shift_rows_down(f: Frame, n: int) -> Frame:
    out = blank()
    out[n:] = f[: H - n]
    return out


def nod(f: Frame, neck: int) -> Frame:
    """The head (every row above the neck) one row lower, the neck row repeated."""
    out = f.copy()
    out[S:neck] = f[: neck - S]
    out[:S] = 0
    return out


def stool_frame(canon_up: Frame, k: int, an, ol, neck: int) -> Frame:
    """The view from behind, lowered and cut to the rows a person's stool frames keep (4 to 23), breathing."""
    f = shift_rows_down(canon_up, SIT_DROP)
    f = breathe(f, an.hip + SIT_DROP, SIT_BREATH[k])
    if SIT_NOD[k]:
        f = nod(f, neck + SIT_DROP)
    out = blank()
    seg = f[STOOL_CUT[0]:STOOL_CUT[1]]
    out[: len(seg)] = seg
    return reoutline(drop_specks(out), ol)


def front_sit(canon_down: Frame, k: int, cx: int, an, ol, neck: int) -> Frame:
    """Facing the camera, seated (phone and read): the body to the hip, the tail tucked."""
    f = canon_down.copy()
    f[an.hip:] = 0
    at = an.tail.get("down")
    if at is not None:
        f[an.shoulder:, cx + at:] = 0
    f = shift_rows_down(f, SIT_DROP)
    f = breathe(f, an.hip + SIT_DROP, SIT_BREATH[k])
    if SIT_NOD[k]:
        f = nod(f, neck + SIT_DROP)
    return reoutline(drop_specks(f), ol)


def standing(frames6: list[Frame]) -> int:
    """The frame of a direction whose feet are together: the narrowest bottom eight rows. The first wins a tie."""
    best, bw = 0, 1 << 30
    for i, f in enumerate(frames6):
        xs = np.where(on(f[H - 8 * S:]).any(0))[0]
        w = int(xs.max() - xs.min()) if len(xs) else 1 << 29
        if w < bw:
            best, bw = i, w
    return best


PAD = 5                                               # empty columns either side of the art in an engine frame: a seated animal sits back from the desk without losing its tail
FRAME_W = W + 2 * PAD


def engine_frame(f: Frame, dx: int = 0) -> Frame:
    """The art in the middle of a FRAME_W wide frame, moved `dx` columns."""
    out = np.zeros((H, FRAME_W, 4), np.uint8)
    for y, x in zip(*np.where(on(f))):
        if 0 <= x + PAD + dx < FRAME_W:
            out[y, x + PAD + dx] = f[y, x]
    return out


SIT_BEATS = (0, 1, 0, 2, 0, 3)                       # the drawn seated frames (still, page turn, head nod, writing) as the six frames played at one per 0.8 s


def drawn_sit(art: list[Frame], ol: tuple[int, int, int], mirror: bool = False, dx: int = 0) -> list[Frame]:
    """The six seated frames from four drawn ones (a sheet made for sitting: chatgpt-animal-sit-prompts.md); mirrored for the other side."""
    out = []
    for b in SIT_BEATS:
        f = art[b][:, ::-1].copy() if mirror else art[b].copy()
        out.append(engine_frame(reoutline(drop_specks(f), ol), dx))
    return out


def build(sheet: list[Frame], an, jumper: set[tuple[int, int, int]], ol: tuple[int, int, int], sit: dict | None = None) -> list[Frame]:
    """The engine's 78 frames (idle 0-23, walk 24-47, sit 48-59, phone 60-65, read 66-71, stool 72-77), each FRAME_W x H, in the engine's
    order right, back, left, front. A seated animal is moved SIT_BACK away from the desk it faces (the room's desks cover the face of
    anything that sits against them)."""
    canon, cxs, necks = {}, {}, {}
    for d in range(4):
        six = sheet[d * 6:(d + 1) * 6]
        c = six[standing(six)].copy()
        canon[d] = c
        cxs[d] = int(round(torso_x(c, jumper)))
        necks[d] = neck_row(c, jumper)
    engine = (DIR_RIGHT, DIR_UP, DIR_LEFT, DIR_DOWN)
    out: list[Frame] = []
    for d in engine:
        out += [engine_frame(idle_frame(canon[d], d, k, cxs[d], an, ol, necks[d])) for k in range(6)]
    for d in engine:
        out += [engine_frame(walk_frame(canon[d], d, k, cxs[d], an, ol)) for k in range(6)]
    if sit:                                             # a sheet drawn for sitting is used as drawn
        out += drawn_sit(sit["side"], ol, False, -SIT_BACK) + drawn_sit(sit["side"], ol, True, SIT_BACK)
        out += drawn_sit(sit["front"], ol) * 2
    else:
        for d in (DIR_RIGHT, DIR_LEFT):
            out += [engine_frame(sit_frame(canon[d], d, k, cxs[d], an, ol, necks[d]), -SIT_BACK if d == DIR_RIGHT else SIT_BACK) for k in range(6)]
        for _ in range(2):
            out += [engine_frame(front_sit(canon[DIR_DOWN], k, cxs[DIR_DOWN], an, ol, necks[DIR_DOWN])) for k in range(6)]
    out += [engine_frame(stool_frame(canon[DIR_UP], k, an, ol, necks[DIR_UP])) for k in range(6)]
    assert len(out) == 78
    return out
