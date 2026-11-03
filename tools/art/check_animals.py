#!/usr/bin/env python3
"""
Asserts the invariants of every animal strip in public/library/characters/ (written by tools/art/animal_sheet.py + animal_rig.py).

    python3 tools/art/check_animals.py [-v]   # exits 0 and says "ok", or prints every violation and exits 1

For each animal listed in src/lib/studyapp/library/people/animals.json the strip is the engine's 78 frames of 34 x 32 (idle 0-23, walk
24-47, sit 48-59, phone 60-65, read 66-71, stool 72-77: people/sheet.ts POSE), and in it:

  EVERY FRAME     RGBA, alpha 0 or 255 only (hard edges), every drawn pixel beside a clear one is the outline colour, ONE piece (no specks,
                  no split sprite), colours from the palette, none of them magenta, the art inside its 24 columns (the 5 either side
                  are empty but for a seated animal moved away from its desk).
  BASELINE        the feet are on row 31 in every idle and walk frame, and the lowest row of the 6 frames of a seated pose is one row.
  WALK            (per direction, 6 frames, at the engine's 5 a second and 14 art px of travel per frame) the body bobs by BOB rows (the head
                  top moves 1 or 2 rows between the frames of a cycle), the torso does not slide more than TORSO_X columns, and the feet
                  MOVE like feet: in the side views the feet's extent (the bottom two rows) changes by at least FOOT_MIN and at most
                  FOOT_MAX columns a frame on average, never more than FOOT_JUMP in one. The FOOT SKATE is reported: travel (14) minus the
                  mean foot speed, which no 24 px sprite can bring to 0 at this cadence (a person's is reported beside it).
  SIT             nothing hangs below the lap line (the hip row + SIT_LAP), and a tail it has is tucked: no drawn pixel on the far side
                  of the torso, below the shoulders, beyond the tail's own start.
  DRAWN SEATED    (animals whose json says `sit.kind` is "drawn": tools/art/animal_sit.py, a sheet drawn for sitting; the others keep the stand-in
                  rules above) in frames 48-77: the figure is 18 to 27 rows and at most 28 columns, the side views' lowest row is the pose's
                  baseline (animal_sit.json) in all six frames and the back view's is its own, the right and left views are mirror placed
                  (the centres of their boxes add up to the frame's width, give or take 2), the loop moves the head at most 2 rows and the centre of mass
                  at most 1 px between frames (a breath, a nod, a stroke of the pen: calm), the loop is not a still picture,
                  and the head is as wide as the standing animal's (the mean over the four facings within 2 columns, each within 4).
  SIZE            the strips are small: the bundle under 400 KB.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script's folder
import animal_sit  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/library/characters"
REGISTRY = ROOT / "src/lib/studyapp/library/people/animals.json"
PEOPLE = ROOT / "public/library/people.png"
FW, FH, PAD, ART = 34, 32, 5, 24
S = 1                   # 2 for the @2x strips (frames of 68 x 64): every count of rows and columns below is the 1x number times S
SUFFIX = ""
FRAMES = 78
TRAVEL = 14.0           # art px the engine moves a walker between two walk frames: 70 px a second (LIVE_SPEED), 5 frames a second
TORSO_X = 3.0
FOOT_MIN, FOOT_MAX, FOOT_JUMP = 0.3, 6.0, 12.0   # a foot lifted off the bottom two rows jumps the extent (a person's does too: 6)
SIT_LAP = 5
MAX_COLOURS = 24
BUNDLE_LIMIT = 400_000
SIT_FIG_ROWS = (18, 27)
SIT_FIG_COLS = 28
SIT_PAIR_SLACK = 2
SIT_MAX_STEP = 1.0           # px the centre of mass of a seated figure may move between two frames of its loop
SIT_HEAD_MEAN, SIT_HEAD_EACH = 2.0, 4
WALK = {"right": 24, "back": 30, "left": 36, "front": 42}
IDLE = {"right": 0, "back": 6, "left": 12, "front": 18}


def setup(n: int) -> None:
    global S, SUFFIX, FW, FH, PAD, ART, TRAVEL, TORSO_X, FOOT_MIN, FOOT_MAX, FOOT_JUMP, SIT_LAP, SIT_FIG_ROWS, SIT_FIG_COLS, SIT_MAX_STEP, SIT_HEAD_MEAN, SIT_HEAD_EACH, SIT_PAIR_SLACK
    S, SUFFIX = n, ("" if n == 1 else f"@{n}x")
    FW, FH, PAD, ART = 34 * n, 32 * n, 5 * n, 24 * n
    TRAVEL, TORSO_X = 14.0 * n, 3.0 * n
    FOOT_MIN, FOOT_MAX, FOOT_JUMP = 0.3 * n, 6.0 * n, 12.0 * n
    SIT_LAP, SIT_FIG_ROWS, SIT_FIG_COLS, SIT_MAX_STEP = 5 * n, (18 * n, 27 * n), 28 * n, 1.0 * n
    SIT_HEAD_MEAN, SIT_HEAD_EACH, SIT_PAIR_SLACK = 2.0 * n, 4 * n, 2 * n
    animal_sit.set_scale(n)


def is_magenta(c):
    r, g, b = c
    return min(r, b) > 170 and g < 0.5 * min(r, b) and abs(r - b) < 45


def pieces(on: np.ndarray) -> int:
    seen = np.zeros_like(on)
    n = 0
    h, w = on.shape
    for y0, x0 in zip(*np.where(on)):
        if seen[y0, x0]:
            continue
        n += 1
        stack = [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and on[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
    return n


def foot_extent(on: np.ndarray, cx: float, side: bool, reach: int | None = None):
    """The columns the feet cover on the bottom two rows, among the leg columns (a tail beside them is not a foot)."""
    reach = 6 * S if reach is None else reach
    sub = on[FH - 2 * S:, max(int(cx) - reach, 0):int(cx) + reach + 1]
    low = np.where(sub)[1]
    return (float(low.min()), float(low.max())) if len(low) else (cx, cx)


def foot_speeds(frames: list[np.ndarray], cxs: list[float]) -> list[float]:
    """The feet's motion between consecutive frames of a cycle (wrapping): the change of the leading and trailing foot's column on the bottom two rows."""
    ext = [foot_extent(f[..., 3] > 0, c, True) for f, c in zip(frames, cxs)]
    out = []
    for i in range(len(ext)):
        a, b = ext[i], ext[(i + 1) % len(ext)]
        out.append(max(abs(b[0] - a[0]), abs(b[1] - a[1])))
    return out


def people_skate() -> str:
    """A person's own foot speed in the same measure (looks 0 to 11 averaged), for the report."""
    if not PEOPLE.exists():
        return "n/a"
    im = np.array(Image.open(PEOPLE).convert("RGBA"))
    vals = []
    for look in range(min(11, im.shape[0] // 32)):
        r = im[look * 32:(look + 1) * 32]
        for off in (24, 36):
            fr = [r[:, (off + k) * 16:(off + k + 1) * 16] for k in range(6)]
            ext = [foot_extent(f[..., 3] > 0, 8, True, 8) for f in fr]
            vals += [max(abs(ext[(i + 1) % 6][0] - ext[i][0]), abs(ext[(i + 1) % 6][1] - ext[i][1])) for i in range(6)]
    return f"{float(np.mean(vals)):.2f}"


def check(animal: dict) -> tuple[list[str], str]:
    aid = animal["id"]
    errs: list[str] = []
    meta = json.loads((DIR / f"{aid}{SUFFIX}.json").read_text())
    im = Image.open(DIR / f"{aid}{SUFFIX}.png")
    if im.mode != "RGBA":
        errs.append(f"{aid}: mode {im.mode}, not RGBA")
    a = np.array(im.convert("RGBA"))
    if meta.get("id") != aid:
        errs.append(f"{aid}: its json says {meta.get('id')}")
    if a.shape != (FH, FW * FRAMES, 4) or meta["frame"] != [FW, FH] or meta["frames"] != FRAMES:
        errs.append(f"{aid}: strip is {a.shape[1]} x {a.shape[0]}, expected {FW * FRAMES} x {FH} (78 frames of {FW} x {FH})")
        return errs, aid
    if meta["jumper"] != animal["jumper"]:
        errs.append(f"{aid}: animals.json and {aid}.json disagree on the jumper")
    rig = meta["rig"]
    alpha = a[..., 3]
    if not np.isin(alpha, (0, 255)).all():
        errs.append(f"{aid}: alpha is not binary (soft edges)")
    opaque = a[alpha == 255][:, :3]
    colours = {tuple(int(v) for v in c) for c in opaque}
    pal = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in meta["palette"]}
    if len(pal) > MAX_COLOURS:
        errs.append(f"{aid}: the palette has {len(pal)} colours, more than {MAX_COLOURS}")
    if not colours <= pal:
        errs.append(f"{aid}: a pixel is not in the palette")
    for c in pal | colours:
        if is_magenta(c):
            errs.append(f"{aid}: magenta-ish colour {c}")
    for h in animal["jumper"]:
        if h not in meta["palette"]:
            errs.append(f"{aid}: the jumper colour {h} is not in the palette")
    jumper = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in animal["jumper"]}
    out = tuple(int(meta["outline"][i:i + 2], 16) for i in (1, 3, 5))
    frames = [a[:, f * FW:(f + 1) * FW] for f in range(FRAMES)]

    def torso(f):
        m = np.zeros(f.shape[:2], bool)
        for c in jumper:
            m |= (f[..., :3] == np.array(c)).all(-1) & (f[..., 3] > 0)
        return float(np.where(m)[1].mean()) if m.sum() >= 6 * S * S else None

    for i, fr in enumerate(frames):
        on = fr[..., 3] > 0
        if not on.any():
            errs.append(f"{aid}: frame {i} is empty")
            continue
        ys, xs = np.where(on)
        np_ = pieces(on)
        if np_ != 1:
            errs.append(f"{aid}: frame {i} is {np_} separate pieces (a stray speck or a split sprite)")
        if xs.min() < 0 or xs.max() >= FW:
            errs.append(f"{aid}: frame {i} does not fit")
        if i < 48 and not (xs.min() >= PAD - 1 and xs.max() <= FW - PAD):
            errs.append(f"{aid}: frame {i}: the art leaves its 24 columns ({xs.min()}..{xs.max()})")
        p = np.pad(on, 1)
        edge = on & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        bad = [(int(y), int(x)) for y, x in zip(*np.where(edge)) if tuple(int(v) for v in fr[y, x, :3]) != out]
        if bad:
            errs.append(f"{aid}: frame {i}: {len(bad)} edge pixels are not the outline colour, e.g. {bad[:3]}")
        if i < 48 and ys.max() != FH - 1:
            errs.append(f"{aid}: frame {i}: feet on row {ys.max()}, not {FH - 1}")
    # walk
    worst_torso = 0.0
    speeds: list[float] = []
    bobs = []
    for name, o in WALK.items():
        six = frames[o:o + 6]
        tops = [int(np.where(f[..., 3] > 0)[0].min()) for f in six]
        bob = max(tops) - min(tops)
        bobs.append(bob)
        if not 1 * S <= bob <= 2 * S:
            errs.append(f"{aid}: walk {name}: the head bobs {bob} rows over a cycle ({S} to {2 * S})")
        t = [torso(f) for f in six]
        t = [x for x in t if x is not None]
        if len(t) >= 4:
            sp = max(t) - min(t)
            worst_torso = max(worst_torso, sp)
            if sp > TORSO_X:
                errs.append(f"{aid}: walk {name}: the torso moves {sp:.1f} columns between frames (more than {TORSO_X})")
        if name in ("right", "left"):
            v = foot_speeds(six, [(torso(f) if torso(f) is not None else 17.0) for f in six])
            speeds += v
            if max(v) > FOOT_JUMP:
                errs.append(f"{aid}: walk {name}: a foot jumps {max(v):.0f} columns in one frame (more than {FOOT_JUMP})")
            if not FOOT_MIN <= float(np.mean(v)) <= FOOT_MAX:
                errs.append(f"{aid}: walk {name}: the feet move {np.mean(v):.2f} columns a frame on average, not {FOOT_MIN} to {FOOT_MAX} (sliding, or running on the spot)")
        elif name == "front":                               # from behind the legs are often hidden by the body or the tail
            tc = [(torso(f) if torso(f) is not None else 17.0) for f in six]
            low = [int((f[FH - 3 * S:, max(int(c) - 6 * S, 0):int(c) + 6 * S + 1, 3] > 0).sum()) for f, c in zip(six, tc)]
            if len(set(low)) < 2:
                errs.append(f"{aid}: walk {name}: the feet never change")
    # sit
    hip = rig["hip"]
    tail = rig["tail"]
    drawn = meta.get("sit", {}).get("kind") == "drawn"
    if drawn:
        errs += check_drawn_sit(aid, frames, meta, animal)
    for name, o, face in (("sit right", 48, "right"), ("sit left", 54, "left"), ("phone", 60, "down"), ("read", 66, "down"), ("stool", 72, "up")):
        six = frames[o:o + 6]
        lows = {int(np.where(f[..., 3] > 0)[0].max()) for f in six}
        if len(lows) != 1:
            errs.append(f"{aid}: {name}: the lowest row changes between its frames {sorted(lows)}")
        if name != "stool" and max(lows) > hip + SIT_LAP:
            errs.append(f"{aid}: {name}: something hangs below the lap line (row {max(lows)}, the line is {hip + SIT_LAP})")
        at = tail.get(face)
        if at is not None and name in ("sit right", "sit left") and not drawn:    # a drawn seated animal keeps the tail it was drawn with
            for f in six:
                jc = torso(f)
                if jc is None:
                    continue
                on = f[..., 3] > 0
                far = on[rig["shoulder"] + 1:hip, :int(jc - at - 2) + 1] if face == "right" else on[rig["shoulder"] + 1:hip, int(jc + at + 2):]
                if far.sum() > (S - 1) * 4:                      # a few pixels of a tail tip at 2x are a rounding of the cut, not a tail
                    errs.append(f"{aid}: {name}: the tail is not tucked ({int(far.sum())} pixels beyond the torso at the back)")
                    break
    size = (DIR / f"{aid}{SUFFIX}.png").stat().st_size
    foot = float(np.mean(speeds)) if speeds else 0.0
    return errs, f"{aid} {len(colours)}c bob {bobs} torso-slide {worst_torso:.1f} foot-speed {foot:.2f} px/frame skate {TRAVEL - foot:.1f}/{TRAVEL:.0f} {size}B"


def check_drawn_sit(aid: str, frames: list[np.ndarray], meta: dict, animal: dict) -> list[str]:
    errs: list[str] = []
    pose = animal_sit.pose_cfg(json.loads((Path(animal_sit.CONFIG)).read_text()))
    boxes = {}
    for name, o in (("sit right", 48), ("sit left", 54), ("phone", 60), ("read", 66), ("stool", 72)):
        six = frames[o:o + 6]
        bb = []
        for f in six:
            ys, xs = np.where(f[..., 3] > 0)
            bb.append((int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())))
        boxes[name] = bb
        h = bb[0][1] - bb[0][0] + 1
        w = max(b[3] - b[2] + 1 for b in bb)
        if not SIT_FIG_ROWS[0] <= h <= SIT_FIG_ROWS[1] + 3 * S or w > SIT_FIG_COLS:
            errs.append(f"{aid}: {name}: the figure is {h} rows x {w} columns (rows {SIT_FIG_ROWS[0]} to {SIT_FIG_ROWS[1]}, at most {SIT_FIG_COLS} columns)")
        base = {"sit right": pose["side"]["base"], "sit left": pose["side"]["base"], "stool": pose["back"]["base"]}.get(name)
        if base is not None and {b[1] for b in bb} != {base}:
            errs.append(f"{aid}: {name}: the bottom of the figure is on rows {sorted({b[1] for b in bb})}, the baseline is {base}")
        tops = [b[0] for b in bb]
        if max(tops) - min(tops) > 2 * S:
            errs.append(f"{aid}: {name}: the head moves {max(tops) - min(tops)} rows over the loop (at most {2 * S}: a breath and a nod)")
        cm = [np.array(np.where(f[..., 3] > 0)).mean(1) for f in six]
        step = max(float(np.abs(cm[i] - cm[(i + 1) % 6]).max()) for i in range(6))
        if step > SIT_MAX_STEP:
            errs.append(f"{aid}: {name}: the figure's centre of mass moves {step:.2f} px between two frames of the loop (more than {SIT_MAX_STEP}: it would jitter)")
        if len({f.tobytes() for f in six}) < 3:
            errs.append(f"{aid}: {name}: the loop is a still picture")
    cr = (boxes["sit right"][0][2] + boxes["sit right"][0][3]) / 2
    cl = (boxes["sit left"][0][2] + boxes["sit left"][0][3]) / 2
    if abs(cr + cl - (FW - 1)) > SIT_PAIR_SLACK + 1:
        errs.append(f"{aid}: the right and left seated views are not mirror placed (centres {cr} and {cl} in a frame {FW} wide)")
    jumper = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in animal["jumper"]}
    if S == 1:
        st, sd = animal_sit.standing_heads(aid, jumper), animal_sit.seated_heads(aid, jumper)
    else:                                              # the @2x seated head against the 1x standing head (measured on 2x pixels, the standing head's width is noisier than the pixel): in 1x units
        sd = {k: v / S for k, v in animal_sit.seated_heads(aid, jumper).items()}
        animal_sit.set_scale(1)
        st = animal_sit.standing_heads(aid, jumper)
        animal_sit.set_scale(S)
    diffs = {k: abs(st[k] - sd[k]) for k in st}
    mean_lim, each_lim = (SIT_HEAD_MEAN, SIT_HEAD_EACH) if S == 1 else (3.5, 5.0)  # 1x units; at 2x the axolotl's profile head (its gills) is measured 3 to 4 columns narrower than the standing one
    if float(np.mean(list(diffs.values()))) > mean_lim or max(diffs.values()) > each_lim:
        errs.append(f"{aid}: the seated head is not the standing head's size: standing {st}, seated {sd}")
    return errs


BUNDLE_LIMIT_HI = 1_500_000


def main() -> int:
    animals = json.loads(REGISTRY.read_text())
    errs: list[str] = []
    notes: list[str] = []
    totals = {}
    for n in (1, 2):                                    # the 1x strips, then the @2x strips (the same rules in finer pixels)
        setup(n)
        total = 0
        for an in animals:
            if n == 2 and not (DIR / f"{an['id']}@2x.png").exists():
                errs.append(f"{an['id']}: no @2x strip")
                continue
            e, note = check(an)
            errs += [f"[{n}x] {x}" if n == 2 else x for x in e]
            notes.append(f"[{n}x] {note}")
            total += (DIR / f"{an['id']}{SUFFIX}.png").stat().st_size
        totals[n] = total
    if totals[1] > BUNDLE_LIMIT:
        errs.append(f"the strips are {totals[1]} bytes in all (limit {BUNDLE_LIMIT})")
    if totals[2] > BUNDLE_LIMIT_HI:
        errs.append(f"the @2x strips are {totals[2]} bytes in all (limit {BUNDLE_LIMIT_HI})")
    if errs:
        print("\n".join(errs))
        return 1
    print(f"ok: {len(animals)} animals, 78 frames each, alpha binary, one piece per frame, feet on one row, walk bobs and strides, seated tucked (stand-in) or drawn (checked against the standing size), no magenta, {totals[1]} bytes; and the same at 2x (frames of 68 x 64): {totals[2]} bytes")
    if "-v" in sys.argv:
        print("\n".join(notes))
        setup(1)
        print(f"a person's feet move {people_skate()} px/frame in the same measure (side walks, looks 0 to 10)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
