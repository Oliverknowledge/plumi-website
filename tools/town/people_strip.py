#!/usr/bin/env python3
"""The premade people the town needs before anyone is built from layers: rows of public/library/people.png (38 rows of 78 frames), cut to a strip.
    python3 tools/town/people_strip.py OUT.png ROW ROW ...
Row 0 of the strip is the first row asked for (the player's look until the layers are built), the rest are the bots'. 229 KB -> about 30 KB."""
import sys
from pathlib import Path
from PIL import Image
src = Image.open(Path(__file__).resolve().parents[2] / "public/library/people.png").convert("RGBA")
rows = [int(a) for a in sys.argv[2:]]
out = Image.new("RGBA", (src.width, 32 * len(rows)))
for i, r in enumerate(rows):
    out.paste(src.crop((0, r * 32, src.width, r * 32 + 32)), (0, i * 32))
# the art is palette art: keep it indexed, binary alpha
a = out.getchannel("A").point(lambda v: 255 if v > 127 else 0)
q = out.quantize(colors=127, method=Image.FASTOCTREE)
pal = q.getpalette()[: 127 * 3]
idx = list(q.tobytes()); mask = list(a.tobytes())
res = Image.new("P", out.size)
res.putpalette([0, 0, 0] + pal)
res.putdata([0 if m == 0 else i + 1 for i, m in zip(idx, mask)])
res.info["transparency"] = 0
res.save(sys.argv[1], optimize=True, transparency=0)
print(sys.argv[1], res.size)
