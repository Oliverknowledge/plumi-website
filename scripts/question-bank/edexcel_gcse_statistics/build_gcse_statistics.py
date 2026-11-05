"""Write the Edexcel GCSE Statistics bank's data files from the cut questions and their topic tags.

    python3 scripts/question-bank/edexcel_gcse_statistics/build_gcse_statistics.py [work-dir]
    # reads <work-dir>/{parts,tags,manifest,spec}.json; default work dir: .work/edexcel-gcse-statistics

gcse_maths/build_gcse_maths.py's rows and files for one board (src/content/questionBank/edexcel-gcse-statistics.json
and public/question-bank/edexcel-gcse-statistics/{parts,text,reports}.json): each row a whole question, its report
keyed by the question (`reportsBy`). 1ST0's four papers (Paper 1 and 2, Foundation and Higher) all allow a scientific
calculator, so there is no calculator filter (`noCalc`). Each paper is named with its tier ("Paper 1 Higher"), as the
GCSE Maths banks' are, for the tier links and tiers.py. The whole papers are on R2 as edexcel/1st0-1h-qp-jun23.pdf
(upload_r2.py --pdf-prefix=edexcel/); there is no past paper library page for GCSE Statistics yet.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics")
SLUG = "edexcel-gcse-statistics"
# Pearson's furniture, on top of AQA's: the answer lines, "(Total for Question 3 is 4 marks)", the margin notes.
FURNITURE = re.compile(rf"{BOILERPLATE.pattern}|\(Total for Question \d+ is \d+ marks?\)|DO NOT WRITE IN THIS AREA|\.{{4,}}|_{{4,}}|\[\d+\]|\[\d+ marks?\]|\(\d+\)", re.I)


def paper_name(comp):
    return f"Paper {comp[4]} {'Higher' if comp[-1] in 'hH' else 'Foundation'}"


def paper_order(comp):
    """Each Higher paper, then the Foundation paper it shares questions with: 1H, 1F, 2H, 2F."""
    return (int(comp[4]), 0 if comp[-1] in "hH" else 1)


def own_text(p):
    """The question's words, after its number."""
    return re.sub(r"\s+", " ", FURNITURE.sub(" ", re.sub(rf"^.*?\b{int(p['question'])}\s+", "", p["text"], count=1))).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))["1ST0"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
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
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", FURNITURE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"]), int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in spec["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=paper_order)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "Statistics", "fullName": "Statistics (1ST0)", "specs": ["1ST0"],
        "cropVersion": 2,  # as the GCSE Maths Pearson banks: cut_pearson.py with a numerator's and a matrix's top rows kept
        "sections": spec["sections"], "topics": topics,
        "papers": [{"id": c, "name": paper_name(c), "title": "", "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "noCalc": True, "reportsBy": "question",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {len(series)} series, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
