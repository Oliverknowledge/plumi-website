"""Check the cut GCSE Business parts: marks against the paper's printed total, and every scheme crop whole.

    python3 scripts/question-bank/edexcel_gcse_business/check_gcse_business.py [work-dir]

For each paper: the parts' marks add up to "The total mark for this paper is 90." on its cover, every part has
its question and its scheme, and every part of Questions 4 to 7 (Sections B and C) has its case study in its stem.
For each scheme row, read again with cut_gcse_business.py's ms_tables (carried() included): a long answer's crop
(6, 9 and 12 marks) takes in one levels grid, Level 1 to Level 3, the indicative content above it included; a short
answer's none; and no crop ends on the next question's header. Rows that carried() joined over a page are listed, to look at.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-business")
sys.argv[1:] = [WORK]
sys.path.insert(0, HERE)
import cut_gcse_business  # noqa: E402,F401  (patches cut_pearson)
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402


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
        # (the cover: June 2025 Paper 2 opens with Pearson's clarification notice)
        cover = next(t for t in (pg.get_text() for pg in pymupdf.open(os.path.join(WORK, "pdf", name))) if "total mark for this paper" in t)
        printed = int(re.search(r"total mark for this paper is\s+(\d+)", cover).group(1))
        printed -= sum(m for pid, m in cut_gcse_business.MISPRINTED.items() if pid.startswith(set_id + "-"))  # left out
        if sum(p["marks"] or 0 for p in mine) != printed:
            wrong.append(f"cut {sum(p['marks'] or 0 for p in mine)} of {printed}")
        wrong += [f"{p['label']}: no {k}" for p in mine for k in ("qp", "ms") if not p[k]]
        wrong += [f"{p['label']}: no case study" for p in mine if int(p["question"]) >= 4 and not p["stem"]]
        doc = cp.Doc(os.path.join(WORK, "pdf", files[(comp, series, "ms")]))
        ms = cp.ms_tables(doc)
        joined = []
        for p in mine:
            key = (int(p["question"]), p["part"][0] if p["part"] else None, None)
            pieces, text, _ = ms.get(key, ([], "", None))
            long = (p["marks"] or 0) >= 6
            if long and not ("Level 3" in text and re.search(r"Indicative content|AO\d", text)):
                wrong.append(f"{p['label']} ({p['marks']}): no Level 3 or no indicative content in its scheme")
            grids = len(re.findall(r"Level 1\b", text))
            if grids != (1 if long else 0):
                wrong.append(f"{p['label']} ({p['marks']}): {grids} levels grids")
            pg, r = pieces[-1] if pieces else (None, None)
            # (the next row's "Question number" header in the crop's last 40pt; a short row's own header is higher up)
            tail = [l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > max(r.y1 - 40, r.y0 + 30)] if pieces else []
            if any(re.match(r"Questio", l["text"]) for l in tail):
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
