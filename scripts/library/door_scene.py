"""The Grand Library's middle tables, students writing, as a looping animation for the sign-in page
(public/library/library-door.webp and its still for reduced motion).

Same layers and order as the app (room, objects and people by depth, then the front layer), and the
app's sitter beat: frame k = clock/0.52 + seat, resting one beat in three (LibraryScene.sitBeat).

    python3 scripts/library/door_scene.py <art dir> <out dir>

<art dir> holds the app's lib_room, lib_objs, lib_front and lib_people (plain PNGs named .pxl in the
app, Sources/PlumiKit/Resources/Library/, saved here as .png) and lib_world.json. Needs Pillow."""
import json, sys
from PIL import Image
S, OUT = sys.argv[1], sys.argv[2]
w = json.load(open(f"{S}/lib_world.json"))
room = Image.open(f"{S}/lib_room.png").convert("RGBA"); objs = Image.open(f"{S}/lib_objs.png").convert("RGBA")
front = Image.open(f"{S}/lib_front.png").convert("RGBA"); ppl = Image.open(f"{S}/lib_people.png").convert("RGBA")
BOX = (600, 600, 1260, 1200)          # room points: the carpet's twelve tables
def sit(view, k):
    return {"right": k % 6, "left": 6 + k % 6, "back": 18}.get(view, 37 + k % 6)
table_seats = [i for i, s in enumerate(w["seats"]) if len(s["t"]) == 1]
taken = [i for n, i in enumerate(table_seats) if n % 5 in (0, 2, 3)]   # about three in five seats
rows = {i: 8 + (i * 7) % 60 for i in taken}
frames = []
for beat in range(6):
    img = room.copy()
    items = [(o[6], "o", o) for o in w["objs"]] + [(w["seats"][i]["y"] + 61, "p", i) for i in taken]
    for _, kind, v in sorted(items, key=lambda t: t[0]):
        if kind == "o":
            x, y, ww, hh, sx, sy, _d = v
            img.alpha_composite(objs.crop((sx, sy, sx + ww, sy + hh)), (x, y))
        else:
            s = w["seats"][v]; k = beat + v
            k = k - 1 if k % 3 == 0 else k
            f = sit(s["view"], k)
            spr = ppl.crop((f * 16, rows[v] * 32, f * 16 + 16, rows[v] * 32 + 32)).resize((32, 64), Image.NEAREST)
            img.alpha_composite(spr, (s["x"], s["y"]))
    img.alpha_composite(front)
    frames.append(img.crop(BOX).convert("RGB"))
frames[0].save(f"{OUT}/library-door.webp", save_all=True, append_images=frames[1:], duration=520, loop=0, lossless=True, method=6)
frames[0].save(f"{OUT}/library-door-still.webp", lossless=True, method=6)
frames[0].save(f"{OUT}/preview.png")
print([f.size for f in frames[:1]])
