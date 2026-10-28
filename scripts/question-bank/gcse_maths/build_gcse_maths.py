"""Write the GCSE Maths Higher banks' data files from the cut questions and their tags.

    python3 scripts/question-bank/gcse_maths/build_gcse_maths.py [aqa edexcel ocr]
    # reads scripts/question-bank/.work/gcse-maths/<board>/{parts,tags,manifest}.json and .work/gcse-maths/spec.json

build_maths.py for GCSE: the same rows and files (src/content/questionBank/<slug>.json and
public/question-bank/<slug>/{parts,text,reports}.json), each row a whole question with its
report keyed by the question (`reportsBy`). What differs: the topics are spec_gcse_maths.py's
DfE statements (N1 to S6) under the six areas, shared by the three banks; and, where the
other maths banks leave the calculation filter out (every question is one), here it sorts
calculator from non-calculator papers (`calcPapers`): a question's `calc` says its paper
allows a calculator (AQA and Pearson Papers 2 and 3, OCR Papers 4 and 6).

The whole papers are the past paper library's copies already in the bucket (manifest `r2`);
the few the library hasn't got (Pearson's 2017 and 2018 series, from its zips) go up under
edexcel/ with their work names (upload_r2.py --pdf-prefix=edexcel/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "gcse-maths")
BANKS = {  # board: (slug, board name, specification)
    "aqa": ("aqa-gcse-maths", "AQA", "8300"),
    "edexcel": ("edexcel-gcse-maths", "Edexcel", "1MA1"),
    "ocr": ("ocr-gcse-maths", "OCR", "J560"),
}
CALCULATOR = {"83002H", "83003H", "1ma12h", "1ma13h", "j56004", "j56006"}
FULL_NAME = {"aqa": "Mathematics (8300), Higher tier", "edexcel": "Mathematics (1MA1), Higher tier", "ocr": "Mathematics (J560), Higher tier"}
# Pearson's furniture, on top of AQA's: the answer lines, "(Total for Question 3 is 4 marks)", the margin notes.
FURNITURE = re.compile(rf"{BOILERPLATE.pattern}|\(Total for Question \d+ is \d+ marks?\)|DO NOT WRITE IN THIS AREA|\.{{4,}}|_{{4,}}|\[\d+\]|\[\d+ marks?\]|\(\d+\)", re.I)


def paper_name(board, comp):
    return f"Paper {comp[4]}H" if board != "ocr" else f"Paper {comp[-1]}"


def own_text(p):
    """The question's words, after its number."""
    return re.sub(r"\s+", " ", FURNITURE.sub(" ", re.sub(rf"^.*?\b{int(p['question'])}\s+", "", p["text"], count=1))).strip()


def build(board):
    slug_, board_name, spec_code = BANKS[board]
    work = os.path.join(WORK, board)
    parts = json.load(open(os.path.join(work, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(work, "manifest.json")))
    tags_path = os.path.join(work, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f.get("r2") or f"edexcel/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    assert all(n == 1 for n in seen.values()), [k for k, n in seen.items() if n > 1]
    valid = {t["code"] for t in spec["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": str(int(p["question"])), "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own_text(p)[:160]}
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        if p["component"] in CALCULATOR:
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", FURNITURE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in spec["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta = {
        "slug": slug_, "board": board_name, "level": "GCSE", "subject": "Maths", "fullName": FULL_NAME[board], "specs": [spec_code],
        **({"cropVersion": 1} if board in ("edexcel", "ocr") else {}),  # 1 (cut_pearson.py): a question's crop starts above its label when a taller line (a column vector, a fraction) sits on it (28 October 2026)
        "sections": spec["sections"], "topics": topics,
        "papers": [{"id": c, "name": paper_name(board, c), "title": "Calculator" if c in CALCULATOR else "Non-calculator", "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "calcPapers": True, "reportsBy": "question",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug_}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", slug_)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{slug_}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('calc'))} on calculator papers, "
          f"{len(series)} series, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    for b in sys.argv[1:] or list(BANKS):
        build(b)
