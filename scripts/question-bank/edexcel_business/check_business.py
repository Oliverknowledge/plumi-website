"""Check the cut Business parts: marks against the paper's printed total, and every scheme crop whole.

    python3 scripts/question-bank/edexcel_business/check_business.py [work-dir]

For each paper: the parts' marks add up to "The total mark for this paper is 100." on its cover, and every
part has its question, its scheme and its extracts (stem). For each scheme row, read again with
cut_business.py's ms_tables (carried() included): a long answer's crop (8 marks and over) takes in one levels
grid, Level 1 to its top level (Level 4; Paper 3's 8-mark "assess two" answers stop at Level 3), a short answer's
none, and no crop ends on the next question's header. Rows that carried() joined over a page are listed, to look at.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-business")
sys.argv[1:] = [WORK]
sys.path.insert(0, HERE)
import cut_business  # noqa: E402,F401  (patches cut_pearson)
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402

TOP = {8: "Level 3", 10: "Level 4", 12: "Level 4", 16: "Level 4", 20: "Level 4"}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    files = {(f["component"].replace("-", ""), f["series"].lower(), f["kind"]): f["file"] for f in manifest}
    bad = 0
    for (comp, series, kind), name in sorted(files.items()):
        if kind != "qp":
            continue
        set_id = f"{comp}-{series}"
        mine = [p for p in parts if p["set"] == set_id]
        wrong = []
        cover = pymupdf.open(os.path.join(WORK, "pdf", name))[0].get_text()
        printed = int(re.search(r"total mark for this paper is (\d+)", cover).group(1))
        if sum(p["marks"] or 0 for p in mine) != printed:
            wrong.append(f"cut {sum(p['marks'] or 0 for p in mine)} of {printed}")
        wrong += [f"{p['label']}: no {k}" for p in mine for k in ("qp", "ms", "stem", "er") if not p[k]]
        doc = cp.Doc(os.path.join(WORK, "pdf", files[(comp, series, "ms")]))
        ms = cp.ms_tables(doc)
        joined = []
        for p in mine:
            key = (int(p["question"]), p["part"][0] if p["part"] else None, None)
            pieces, text, _ = ms.get(key, ([], "", None))
            level = TOP.get(p["marks"])
            if level and level not in text:
                wrong.append(f"{p['label']} ({p['marks']}): no {level} in its scheme")
            grids = len(re.findall(r"Level 1\b", text))
            if grids != (1 if level else 0):
                wrong.append(f"{p['label']} ({p['marks']}): {grids} levels grids")
            pg, r = pieces[-1] if pieces else (None, None)
            tail = [l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > r.y1 - 140] if pieces else []
            if any(re.match(r"Questio", l["text"]) for l in tail) and not any(re.match(r"Level|\d", l["text"]) for l in tail[-3:]):
                wrong.append(f"{p['label']}: ends on a table header")
            pages = sorted({pg for pg, _ in pieces})
            if len(pages) > 1:
                joined.append(f"{p['label']} pp{pages[0] + 1}-{pages[-1] + 1}")
        bad += bool(wrong)
        print(f"{set_id}: {len(mine)} parts" + (" — " + "; ".join(wrong) if wrong else " ok") + f"  [over pages: {', '.join(joined)}]", file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
