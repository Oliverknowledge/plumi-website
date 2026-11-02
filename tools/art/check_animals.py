#!/usr/bin/env python3
"""
Asserts the invariants of public/library/characters/fox.png (written by tools/art/fox_sheet.py).

    python3 tools/art/check_fox.py        # exits 0 and says "ok", or prints every violation and exits 1

Also run by `npm run library:test` (src/lib/studyapp/library/people/fox.test.ts calls it).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "public/library/characters"


def main() -> int:
    meta = json.loads((DIR / "fox.json").read_text())
    im = Image.open(DIR / "fox.png")
    errs: list[str] = []
    if im.mode != "RGBA":
        errs.append(f"mode {im.mode}, not RGBA")
    a = np.array(im.convert("RGBA"))
    fw, fh = meta["frame"]
    n = meta["frames"]
    if n != 24:
        errs.append(f"frames {n}, not 24")
    if a.shape[0] != fh or a.shape[1] != fw * n:
        errs.append(f"strip is {a.shape[1]} x {a.shape[0]}, expected {fw * n} x {fh}")
        print("\n".join(errs))
        return 1
    alpha = a[..., 3]
    if not np.isin(alpha, (0, 255)).all():
        errs.append("alpha is not binary")
    opaque = a[alpha == 255][:, :3]
    colours = {tuple(c) for c in opaque}
    if len(colours) > 16:
        errs.append(f"{len(colours)} colours, more than 16")
    pal = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in meta["palette"]}
    if not colours <= pal:
        errs.append("a pixel is not in the palette")
    if len(pal) > 16:
        errs.append("the palette has more than 16 colours")
    for c in pal | colours:     # no magenta, no pink or purple fringe: green far below both red and blue
        if min(c[0], c[2]) - c[1] > 40:
            errs.append(f"magenta-ish colour {c}")
    rows = meta["anchor"]["feetRow"]
    for f in range(n):
        fr = a[:, f * fw:(f + 1) * fw]
        on = fr[..., 3] > 0
        if not on.any():
            errs.append(f"frame {f} is empty")
            continue
        ys, xs = np.where(on)
        if ys.max() != rows:
            errs.append(f"frame {f}: feet on row {ys.max()}, not {rows}")
        cx = xs.mean()
        if abs(cx - fw / 2) > 2.5:
            errs.append(f"frame {f}: centre of mass at column {cx:.1f}, expected about {fw / 2}")
        if ys.max() - ys.min() + 1 > fh or xs.max() - xs.min() + 1 > fw:
            errs.append(f"frame {f}: does not fit")
        # a 1 px outline: every opaque pixel with a transparent 4-neighbour is the outline colour
        p = np.pad(on, 1)
        edge = on & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        out = tuple(int(meta["outline"][i:i + 2], 16) for i in (1, 3, 5))
        bad = [(int(y), int(x)) for y, x in zip(*np.where(edge)) if tuple(fr[y, x, :3]) != out]
        if bad:
            errs.append(f"frame {f}: {len(bad)} edge pixels are not the outline colour, e.g. {bad[:3]}")
    if errs:
        print("\n".join(errs))
        return 1
    print(f"ok: {n} frames of {fw} x {fh}, {len(colours)} colours, alpha binary, feet on row {rows}, no magenta")
    return 0


if __name__ == "__main__":
    sys.exit(main())
