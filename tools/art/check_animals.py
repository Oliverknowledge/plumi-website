#!/usr/bin/env python3
"""
Asserts the invariants of every animal strip in public/library/characters/ (written by tools/art/animal_sheet.py).

    python3 tools/art/check_animals.py        # exits 0 and says "ok", or prints every violation and exits 1

For each animal listed in src/lib/studyapp/library/people/animals.json:
  * the strip is RGBA, 24 frames of the size its json says, all the same size (a frame is never cropped differently from another);
  * alpha is 0 or 255 only (hard edges: no half transparent halo), and every drawn pixel whose 4-neighbour is clear is the outline colour;
  * no more than the palette's colours, the palette no more than 24, and none of them magenta or a pink/purple fringe of it;
  * the feet are on the one baseline row in every frame (they never move vertically), and the feet's middle never moves more than FEET_X
    columns between the frames of a direction (no jitter in a walk);
  * the torso (the jumper's colours) never moves more than TORSO_X columns between the frames of a direction, and its middle is near the
    frame's middle;
  * every frame is ONE piece (8-connected): no stray specks, no sprite split in two;
  * the animal fits the frame (never touches both side columns of a 24 wide frame unless it is exactly as wide), and is between 20 and 30 rows tall;
  * the strip file is small, and the whole bundle is under 200 KB.

Also run by `npm run library:test` (src/lib/studyapp/library/people/animal.test.ts calls it).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/library/characters"
REGISTRY = ROOT / "src/lib/studyapp/library/people/animals.json"
FEET_X = 4.0            # the feet's middle (bottom three rows) between the frames of one direction: a stride moves it a little, a jitter would move it more
TORSO_X = 3.0           # the jumper's centre between the frames of one direction
TORSO_FROM_MIDDLE = 4.0  # ... and from the frame's middle (a tail or wings that fill the 24 columns push the body off it)
MAX_COLOURS = 24
BUNDLE_LIMIT = 200_000


def is_magenta(c: tuple[int, int, int]) -> bool:
    r, g, b = c
    return min(r, b) > 170 and g < 0.5 * min(r, b) and abs(r - b) < 45


def pieces(on: np.ndarray) -> int:
    """The number of 8-connected pieces of a mask (a flood fill: frames are tiny)."""
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


def check(animal: dict) -> tuple[list[str], str]:
    aid = animal["id"]
    errs: list[str] = []
    meta = json.loads((DIR / f"{aid}.json").read_text())
    im = Image.open(DIR / f"{aid}.png")
    if im.mode != "RGBA":
        errs.append(f"{aid}: mode {im.mode}, not RGBA")
    a = np.array(im.convert("RGBA"))
    fw, fh = meta["frame"]
    n = meta["frames"]
    if meta.get("id") != aid:
        errs.append(f"{aid}: its json says {meta.get('id')}")
    if n != 24:
        errs.append(f"{aid}: frames {n}, not 24")
    if a.shape[0] != fh or a.shape[1] != fw * n:
        errs.append(f"{aid}: strip is {a.shape[1]} x {a.shape[0]}, expected {fw * n} x {fh} (24 frames, all one size)")
        return errs, aid
    if meta["jumper"] != animal["jumper"]:
        errs.append(f"{aid}: animals.json and {aid}.json disagree on the jumper")
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
    feet_row = meta["anchor"]["feetRow"]
    out = tuple(int(meta["outline"][i:i + 2], 16) for i in (1, 3, 5))
    feet_mid: list[list[float]] = [[] for _ in range(4)]
    torso_mid: list[list[float]] = [[] for _ in range(4)]
    for f in range(n):
        d = f // 6
        fr = a[:, f * fw:(f + 1) * fw]
        on = fr[..., 3] > 0
        if not on.any():
            errs.append(f"{aid}: frame {f} is empty")
            continue
        ys, xs = np.where(on)
        if ys.max() != feet_row:
            errs.append(f"{aid}: frame {f}: feet on row {ys.max()}, not {feet_row}")
        h = ys.max() - ys.min() + 1
        if not 20 <= h <= 30:
            errs.append(f"{aid}: frame {f} is {h} rows tall (20 to 30)")
        if xs.max() - xs.min() + 1 > fw:
            errs.append(f"{aid}: frame {f}: does not fit")
        low = on[feet_row - 2:feet_row + 1]
        fx = np.where(low)[1]
        feet_mid[d].append(float(fx.mean()))
        jm = np.zeros(on.shape, bool)
        for c in jumper:
            jm |= (fr[..., :3] == np.array(c)).all(-1) & on
        if jm.sum() >= 6:
            torso_mid[d].append(float(np.where(jm)[1].mean()))
        np_ = pieces(on)
        if np_ != 1:
            errs.append(f"{aid}: frame {f} is {np_} separate pieces (a stray speck or a split sprite)")
        # a 1 px outline: every opaque pixel with a transparent 4-neighbour is the outline colour
        p = np.pad(on, 1)
        edge = on & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        bad = [(int(y), int(x)) for y, x in zip(*np.where(edge)) if tuple(int(v) for v in fr[y, x, :3]) != out]
        if bad:
            errs.append(f"{aid}: frame {f}: {len(bad)} edge pixels are not the outline colour, e.g. {bad[:3]}")
    names = ("down", "left", "up", "right")
    worst_feet = worst_torso = 0.0
    for d in range(4):
        if feet_mid[d]:
            sp = max(feet_mid[d]) - min(feet_mid[d])
            worst_feet = max(worst_feet, sp)
            if sp > FEET_X:
                errs.append(f"{aid}: {names[d]}: the feet's middle moves {sp:.1f} columns between frames (more than {FEET_X})")
        if len(torso_mid[d]) >= 4:
            sp = max(torso_mid[d]) - min(torso_mid[d])
            worst_torso = max(worst_torso, sp)
            if sp > TORSO_X:
                errs.append(f"{aid}: {names[d]}: the torso moves {sp:.1f} columns between frames (more than {TORSO_X})")
            off = max(abs(t - (fw - 1) / 2) for t in torso_mid[d])
            if off > TORSO_FROM_MIDDLE:
                errs.append(f"{aid}: {names[d]}: the torso is {off:.1f} columns from the frame's middle (more than {TORSO_FROM_MIDDLE})")
    size = (DIR / f"{aid}.png").stat().st_size
    return errs, f"{aid} {fw}x{fh} {len(colours)}c feet-jitter {worst_feet:.1f} torso-jitter {worst_torso:.1f} {size}B"


def main() -> int:
    animals = json.loads(REGISTRY.read_text())
    errs: list[str] = []
    notes: list[str] = []
    total = 0
    for an in animals:
        e, note = check(an)
        errs += e
        notes.append(note)
        total += (DIR / f"{an['id']}.png").stat().st_size
    if total > BUNDLE_LIMIT:
        errs.append(f"the strips are {total} bytes in all (limit {BUNDLE_LIMIT})")
    if errs:
        print("\n".join(errs))
        return 1
    print(f"ok: {len(animals)} animals, 24 frames each, alpha binary, one piece per frame, feet on one row, no magenta, {total} bytes")
    if "-v" in sys.argv:
        print("\n".join(notes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
