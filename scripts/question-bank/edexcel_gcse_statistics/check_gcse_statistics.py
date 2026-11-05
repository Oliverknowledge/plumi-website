"""Check the cut GCSE Statistics questions: marks against the paper's printed total, and every scheme page read.

    python3 scripts/question-bank/edexcel_gcse_statistics/check_gcse_statistics.py [work-dir]

For each paper: the questions' marks add up to "The total mark for this paper is 80." on its cover, the questions are
numbered 1 to N with none missing, and every question has its paper crop, its scheme crop and its examiner's report.
For each scheme, read again with ms_tables: every page that carries a "Question number" table is in some question's
scheme crop (a page whose header the reader missed left its questions with no scheme or half of one), every
question's rows start on a page of the scheme in order, and no crop ends on the next question's table header.
Questions whose scheme runs over a page are listed, to look at.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics")
sys.argv[1:] = []
sys.path.insert(0, HERE)
import cut_gcse_statistics  # noqa: E402,F401  (patches cut_pearson)
cp = cut_gcse_statistics.cut_pearson
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
        mine = sorted((p for p in parts if p["set"] == set_id), key=lambda p: int(p["question"]))
        wrong = []
        cover = pymupdf.open(os.path.join(WORK, "pdf", name))[0].get_text()
        printed = int(re.search(r"total mark for this paper is\s+(\d+)", re.sub(r"\s+", " ", cover)).group(1))
        if sum(p["marks"] or 0 for p in mine) != printed:
            wrong.append(f"cut {sum(p['marks'] or 0 for p in mine)} of {printed}")
        if [int(p["question"]) for p in mine] != list(range(1, len(mine) + 1)):
            wrong.append(f"questions {[int(p['question']) for p in mine]}")
        wrong += [f"Q{p['question']}: no {k}" for p in mine for k in ("qp", "ms", "er") if not p[k]]
        doc = cp.Doc(os.path.join(WORK, "pdf", files[(comp, series, "ms")]))
        ms = cp.ms_tables(doc)
        covered = {pg for pieces, _, _ in ms.values() for pg, _ in pieces}
        tables = [i for i in range(len(doc)) if any(re.fullmatch(r"Question [Nn]umber", l["text"]) for l in doc.lines(i))]
        wrong += [f"scheme page {i + 1} has a table no question's scheme takes in" for i in tables if i not in covered]
        # (a page that carries on a row has no header of its own: every page from the first table to the last row's is some row's)
        if covered:
            wrong += [f"scheme page {i + 1} is in no question's scheme" for i in range(min(covered), max(covered)) if i not in covered and not doc.blank(i) and doc.lines(i)]
        # (questions in order: a question's rows start on or after the page the one before's did)
        starts = [min(pg for pieces, _, _ in [ms[k]] for pg, _ in pieces) for k in sorted((k for k in ms if k[1] in (None, "a") and k[2] in (None, "i")), key=lambda k: k[0])]
        if starts != sorted(starts):
            wrong.append(f"questions' schemes out of order on the pages: {starts}")
        joined = []
        for p in mine:
            keys = [k for k in ms if k[0] == int(p["question"])]
            pieces = [x for k in sorted(keys, key=lambda k: (k[1] or "", k[2] or "")) for x in ms[k][0]]
            pages = sorted({pg for pg, _ in pieces})
            if not pages:
                wrong.append(f"Q{p['question']}: no scheme rows")
                continue
            if len(pages) > 1:
                joined.append(f"Q{p['question']} pp{pages[0] + 1}-{pages[-1] + 1}")
            pg, r = max(pieces, key=lambda x: (x[0], x[1].y1))
            tail = [l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > max(r.y1 - 40, r.y0 + 30)]
            if any(re.match(r"Question [Nn]umber", l["text"]) for l in tail):
                wrong.append(f"Q{p['question']}: ends on a table header")
        bad += bool(wrong)
        print(f"{set_id}: {len(mine)} questions" + (" — " + "; ".join(wrong) if wrong else " ok") + f"  [over pages: {', '.join(joined)}]", file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
