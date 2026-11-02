"""Check the cut 4IS1 parts: marks, schemes, passages and crop edges.

    python3 scripts/question-bank/edexcel_igcse_islamic/check_igcse_islamic.py [work-dir]

For each paper: 24 parts, Questions 1 to 6 each (a) to (d); the parts of one question from each section (1, 3,
5 and 6: a candidate answers 1 or 2, 3 or 4, then 5 and 6) add up to "The total mark for this paper is 90." on its
cover, and the two choices in a section to the same; every part has its question and its scheme. Question 1's
crop starts at its own label, with nothing of the cover or the section's instructions. Every (d) carries its
passage's English above its label and runs to its "(12)"; no other part carries a cited passage. For each scheme
row, read again with cut_igcse_islamic.py's ms_tables:
a 6- or 12-mark part's crop takes in its indicative content and one whole levels grid, Level 1 to Level 3 with the
top band its marks ("5–6", "9–12"); a short answer's takes in none; and no crop ends on the next row's header.
Each question crop's first and last rows of pixels are white: no line of the paper is cut through.
"""
import json, os, re, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse-islamic")
sys.argv[1:] = [WORK]
sys.path.insert(0, HERE)
import cut_igcse_islamic  # noqa: E402  (patches cut_pearson)

cp = cut_igcse_islamic.cp


def edge_ink(path):
    """Dark pixels in the image's first and last two rows."""
    img = Image.open(path).convert("L")
    rows = [img.crop((0, y, img.width, y + 1)) for y in (0, 1, img.height - 2, img.height - 1)]
    return [sum(1 for v in r.get_flattened_data() if v < 140) for r in rows]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    files = {(f["series"].lower(), f["kind"]): f["file"] for f in manifest}
    bad = 0
    for series in sorted({s for s, _ in files}):
        set_id = f"4is101-{series}"
        mine = [p for p in parts if p["set"] == set_id]
        wrong = []
        qp = cp.Doc(os.path.join(WORK, "pdf", files[(series, "qp")]))
        printed = int(re.search(r"total mark for this paper is\s+(\d+)", qp[0].get_text()).group(1))
        by_q = {}
        for p in mine:
            by_q[int(p["question"])] = by_q.get(int(p["question"]), 0) + (p["marks"] or 0)
        if sorted(p["label"] for p in mine) != sorted(f"{q}({x})" for q in range(1, 7) for x in "abcd"):
            wrong.append("parts: " + " ".join(p["label"] for p in mine))
        if by_q.get(1) != by_q.get(2) or by_q.get(3) != by_q.get(4) or sum(by_q.get(q, 0) for q in (1, 3, 5, 6)) != printed:
            wrong.append(f"marks by question {by_q}, printed {printed}")
        wrong += [f"{p['label']}: no {k}" for p in mine for k in ("qp", "ms") if not p[k]]
        first = next(p for p in mine if p["label"] == "1(a)")
        if not re.match(r"1 \(a\) ", first["text"]):
            wrong.append(f"1(a) starts: {first['text'][:60]}")
        for p in mine:
            if p["part"] == "d" and not re.search(r"\w{3,}.{60,}\(d\) .*\(12\)$", p["text"]):
                wrong.append(f"{p['label']}: no passage, or not its whole question")
            if p["part"] != "d" and re.search(r"\[(Qur.an|Hadith)", p["text"], re.I):
                wrong.append(f"{p['label']}: a passage")
            ink = edge_ink(os.path.join(WORK, "img", p["qp"]))
            if any(ink):
                wrong.append(f"{p['label']}: ink at the crop's edge {ink}")
        doc = cp.Doc(os.path.join(WORK, "pdf", files[(series, "ms")]))
        ms = cp.ms_tables(doc)
        for p in mine:
            pieces, text, _ = ms.get((int(p["question"]), p["part"], None), ([], "", None))
            if not re.search(rf"\b{p['question'].lstrip('0')}\s*\({p['part']}\)", text):
                wrong.append(f"{p['label']}: its label is not in its scheme rows")
            if re.search(r"Question\s+(Answer|Indicative content)?\s*(Mark\s+)?number\s+(AO\d.{0,20})?\d\s*\([a-d]\)", text[40:]):
                wrong.append(f"{p['label']}: a second row in its scheme")
            grids = len(re.findall(r"Level 1\b", text))
            if (p["marks"] or 0) >= 6:
                top = {6: "5–6", 12: "9–12"}.get(p["marks"])
                if grids != 1 or "Level 3" not in text or top not in text or "No rewardable" not in text:
                    wrong.append(f"{p['label']} ({p['marks']}): levels grid {grids}, top band {top in text}")
                if not re.search(r"Indicative content", text) or len(text) < 900:
                    wrong.append(f"{p['label']} ({p['marks']}): indicative content {len(text)} chars")
            elif grids:
                wrong.append(f"{p['label']} ({p['marks']}): a levels grid")
            pg, r = pieces[-1] if pieces else (None, None)
            tail = [l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > max(r.y1 - 40, r.y0 + 30)] if pieces else []
            if any(re.match(r"Questio", l["text"]) for l in tail):
                wrong.append(f"{p['label']}: ends on a table header")
        print(f"{set_id}: {len(mine)} parts, {sum(by_q.get(q, 0) for q in (1, 3, 5, 6))} marks" + ("" if not wrong else ": " + "; ".join(wrong)), file=sys.stderr)
        bad += len(wrong)
    print(f"{bad} problems", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
