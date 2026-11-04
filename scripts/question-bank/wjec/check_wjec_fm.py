"""Check the Further Maths crops cut_wjec.py --whole made, before they are uploaded.

    python3 scripts/question-bank/wjec/check_wjec_fm.py [work-dir] --whole   # default .work/wjec-fm

For every question it works out the regions again, as cut_wjec.py does, and reports:
  - a scheme crop holding another question's number in the label column (bleed: one
    question's scheme running into the next), or not holding its own (a carried page alone);
  - a paper with more or fewer schemes than questions;
  - a scheme whose printed total isn't the question's marks on the paper (a scheme cut short);
  - a line on a scheme's pages not wholly in a question's crop (a row dropped, or clipped at the side);
  - a question crop holding the next question's number;
  - ink cut through by a crop's top or bottom edge (cut_ink);
  - a paper whose questions' marks don't add up to its printed total.
Prints one line per problem; none means every crop looked right to it. The crops still
want a look by eye (contact_wjec_fm.py), as a picture can be cut without any text being.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cut_wjec as cw  # noqa: E402  (reads the work dir and --whole from the command line)

cp = cw.cp
TOTALS = {"2305u10": 70, "2305u20": 70, "2305u30": 70, "1305u40": 120, "1305u50": 80, "1305u60": 80}


def cut_ink(doc, pg, rect):
    """Where ink runs across a crop's top or bottom edge: a letter or a bracket cut in two. (Text lines' boxes
    can't say: the maths font gives a line a box several lines tall.) Rendered at 150 dpi, a pixel column inked
    1.5pt above the edge and 1.5pt below it is crossed; the table's own vertical rules cross every edge, so
    their columns are left out."""
    page, out = doc[pg], []
    rules = [d["rect"] for d in page.get_drawings() if d["rect"].width < 2.5 and d["rect"].height > 8]
    for name, edge in (("top", rect.y0), ("bottom", rect.y1)):
        if edge <= 2 or edge >= page.rect.height - 2:
            continue
        band = pymupdf.Rect(rect.x0, edge - 1.5, rect.x1, edge + 1.5)
        pix = page.get_pixmap(clip=band, dpi=150, colorspace=pymupdf.csGRAY)
        w, h, px = pix.width, pix.height, pix.samples
        scale = (rect.x1 - rect.x0) / w
        crossed = 0
        for x in range(w):
            at = rect.x0 + x * scale
            if any(r.x0 - 1.5 <= at <= r.x1 + 1.5 for r in rules if r.y0 - 3 < edge < r.y1 + 3):
                continue
            if px[x] < 128 and px[(h - 1) * w + x] < 128:
                crossed += 1
        if crossed >= 3:
            out.append(f"{name} edge cuts ink ({crossed} px)")
    return out


def main():
    parts = json.load(open(os.path.join(cw.WORK, "parts-maths.json")))
    manifest = json.load(open(os.path.join(cw.WORK, "manifest.json")))
    files = {}
    for f in manifest:
        files.setdefault(f"{f['component']}-{f['series']}".lower(), {})[f["kind"]] = os.path.join(cw.WORK, "pdf", f["file"])
    problems = []
    for set_id in sorted({p["set"] for p in parts}):
        mine = [p for p in parts if p["set"] == set_id]
        total = sum(p["marks"] or 0 for p in mine)
        if total != TOTALS[set_id[:7]]:
            problems.append(f"{set_id}: marks add up to {total}, not {TOTALS[set_id[:7]]}")
        qp = cp.Doc(files[set_id]["qp"])
        labels, end_page = cw.wjec_labels(qp)  # (first: label_starts checks the scheme against the paper's count)
        ms = cp.Doc(files[set_id]["ms"])
        tables = cw.wjec_ms_tables(ms)
        numbered = any(cw.question_label(ms, i, l) for i in range(len(ms)) for l in ms.lines(i))
        for (q, _, _), (pieces, _, _) in sorted(tables.items()):
            own = False
            for pg, r in pieces:
                for l in ms.lines(pg):
                    n = cw.question_label(ms, pg, l) if cp.inside(l, r) else None
                    if n and n != q:
                        problems.append(f"{set_id}-{q:02d} ms: holds \"{l['text'][:20]}\" (page {pg + 1})")
                    own = own or n == q
                for t in cut_ink(ms, pg, r):
                    problems.append(f"{set_id}-{q:02d} ms: {t} (page {pg + 1})")
            if numbered and not own:
                problems.append(f"{set_id}-{q:02d} ms: its own number isn't in it")
        # A scheme's last printed total ("Total [13]", "Total for Question 1 9", "[5]" under the last part) against the paper's marks.
        marks = {int(p["question"]): p["marks"] for p in mine}
        for (q, _, _), (_, text, _) in tables.items():
            said = re.findall(r"Total\s*\[?\(?(\d{1,3})\)?\]?|Total for [Qq]uestion \d{1,2}\s+(\d{1,3})\b", text)
            said = [a or b for a, b in said]
            printed = int(said[-1]) if said else None
            if printed is not None and printed != marks.get(q):
                problems.append(f"{set_id}-{q:02d} ms: prints total {printed}, the paper gives {marks.get(q)}")
        # Every line on the scheme's pages is in some question's crop, from the first question on: no row is dropped.
        pieces = [(pg, r) for v in tables.values() for pg, r in v[0]]
        first = min(((pg, r.y0) for pg, r in pieces), default=(0, 0))
        for i in range(first[0], len(ms)):
            h = ms[i].rect.height
            if cw.SUMMARY.search(ms.text(i)):
                break
            for l in ms.lines(i):
                if (i, l["y1"]) < first or cw.SCHEME_FOOT.match(l["text"]) or l["y0"] > h - 62 or re.fullmatch(r"\d{1,3}", l["text"]) and abs(l["x0"] - ms[i].rect.width / 2) < 40:
                    continue
                mid = (l["y0"] + l["y1"]) / 2
                if not any(pg == i and r.y0 - 3 <= mid <= r.y1 + 3 and r.x0 - 3 <= l["x0"] and l["x1"] <= r.x1 + 3 for pg, r in pieces):
                    problems.append(f"{set_id} ms: not in any crop: \"{l['text'][:40]}\" (page {i + 1})")
        if len(tables) != len(mine):
            problems.append(f"{set_id}: {len(tables)} schemes for {len(mine)} questions")
        starts = [(pg, y, q) for pg, y, q, letter, _ in labels if letter is None]
        for n, (pg, y, q) in enumerate(starts):
            nxt = starts[n + 1] if n + 1 < len(starts) else None
            for p, r in cp.region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page):
                if nxt and p == nxt[0] and r.y0 - 2 <= nxt[1] < r.y1 - 4:
                    problems.append(f"{set_id}-{q:02d} qp: holds question {nxt[2]}'s start (page {p + 1})")
                for t in cut_ink(qp, p, r):
                    problems.append(f"{set_id}-{q:02d} qp: {t} (page {p + 1})")
    print("\n".join(problems) or "no problems")
    print(f"{len(problems)} problems in {len(parts)} questions", file=sys.stderr)


if __name__ == "__main__":
    main()
