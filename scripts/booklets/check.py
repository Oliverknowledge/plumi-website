"""Sheets to read before a bank takes MadAsMaths questions: each question's crop beside its answers' crop.

    python3 scripts/booklets/check.py [--booklets=a,b] [--ids=x,y] [--n=8] [--seed=1]

Writes <work-dir>/questions/check-sheet-<n>.png: --ids exactly, or --n questions at random (from --booklets, or
from all). Look for answers left on the question (a row of boxes or a right-aligned line that wasn't read as the
answers), a question cut short at its heading, and a solution showing another question's working.
"""
import json, os, random, sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
Q = os.path.join(HERE, ".work", "questions")
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
COL, PER = 520, 8


def main():
    qs = {q["id"]: q for q in json.load(open(os.path.join(Q, "questions.json")))}
    if "ids" in opt:
        ids = opt["ids"].split(",")
    else:
        pool = [i for i, q in qs.items() if "booklets" not in opt or q["booklet"] in opt["booklets"].split(",")]
        random.seed(int(opt.get("seed", 1)))
        ids = random.sample(pool, min(int(opt.get("n", 8)), len(pool)))
    for s in range(0, len(ids), PER):
        rows = []
        for i in ids[s:s + PER]:
            q = qs[i]
            a, b = Image.open(os.path.join(Q, "img", f"{i}-qp.webp")), Image.open(os.path.join(Q, "img", f"{i}-ms.webp"))
            a = a.resize((COL, max(1, a.height * COL // a.width)))
            if b.width > COL:
                b = b.resize((COL, b.height * COL // b.width))
            b = b.crop((0, 0, b.width, min(b.height, 900)))
            row = Image.new("RGB", (COL * 2 + 24, max(a.height, b.height) + 26), "#ddd")
            row.paste(a, (0, 22))
            row.paste(b, (COL + 24, 22))
            ImageDraw.Draw(row).text((4, 4), f"{i}  answers: {q['answer'][:60]}  pages {q['pages']}", fill="black")
            rows.append(row)
        sheet = Image.new("RGB", (COL * 2 + 24, sum(r.height + 8 for r in rows)), "#777")
        y = 0
        for r in rows:
            sheet.paste(r, (0, y))
            y += r.height + 8
        out = os.path.join(Q, f"check-sheet-{s // PER + 1}.png")
        sheet.save(out)
        print(out, file=sys.stderr)


if __name__ == "__main__":
    main()
