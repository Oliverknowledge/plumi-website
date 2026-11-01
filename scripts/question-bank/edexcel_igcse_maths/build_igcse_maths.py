"""Write the International GCSE Mathematics A (4MA1) bank's data files, both tiers, from the cut questions and their tags.

    python3 scripts/question-bank/edexcel_igcse_maths/build_igcse_maths.py
    # reads scripts/question-bank/.work/edexcel-igcse-maths/{parts,tags,manifest,spec}.json

build_gcse_maths.py for 4MA1: the same rows and files (src/content/questionBank/edexcel-igcse-maths.json and
public/question-bank/edexcel-igcse-maths/{parts,text,reports}.json), each row a whole question with its report
keyed by the question. What differs: the level is "IGCSE"; the topics are the specification's own (1.1
Integers to 6.3 Probability, spec_igcse_maths.py); both papers allow a calculator, so there's no calculator
filter (`noCalc`); and a series' "R" papers (1HR, 2FR, sat in another time zone) are a series of their own,
"JUN24R", "June 2024 (R)". Each paper is named with its tier ("Paper 1 Higher", "Paper 1 Foundation"),
as the GCSE banks are, for the tier links and tiers.py.

The whole papers are the past paper library's copies already in the bucket (manifest `r2`); the ones the
library hasn't got (or files under another series) go up under edexcel/ with their work names
(upload_r2.py --pdf-prefix=edexcel/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "edexcel-igcse-maths")
SLUG = "edexcel-igcse-maths"
MONTH_RANK = {"JAN": 1, "JUN": 6, "NOV": 11}
MONTH = {"JAN": "January", "JUN": "June", "NOV": "November"}
# Pearson's furniture: the answer lines, "(Total for Question 3 is 4 marks)", the margin notes.
FURNITURE = re.compile(rf"{BOILERPLATE.pattern}|\(Total for Question \d+ is \d+ marks?\)|DO NOT WRITE IN THIS AREA|\.{{4,}}|_{{4,}}|\(\d+\)", re.I)
NOTE = ("Most January and June series also have a second set of papers, sat in another time zone: Pearson's R papers "
        "(1HR, 2FR and so on). Each is listed as a series of its own, such as June 2024 (R).")


def tier(comp):
    return "Higher" if comp.endswith("h") else "Foundation"


def series_rank(s):
    return int("20" + s[3:5]) * 100 + MONTH_RANK[s[:3]] + (0.5 if s.endswith("R") else 0)


def label(s):
    return f"{MONTH[s[:3]]} 20{s[3:5]}" + (" (R)" if s.endswith("R") else "")


def own_text(p):
    """The question's words, after its number."""
    return re.sub(r"\s+", " ", FURNITURE.sub(" ", re.sub(rf"^.*?\b{int(p['question'])}\s+", "", p["text"], count=1))).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
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
    # Each Higher paper, then the Foundation paper it shares questions with: 1H, 1F, 2H, 2F.
    comps = sorted({r["p"] for r in rows}, key=lambda c: (c[4], tier(c) != "Higher"))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:5]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "IGCSE", "subject": "Maths", "fullName": "Mathematics A (4MA1)", "specs": ["4MA1"],
        "cropVersion": 1,  # cut_pearson.py's, as the Edexcel GCSE Maths bank
        "sections": spec["sections"], "topics": topics,
        "papers": [{"id": c, "name": f"Paper {c[4]} {tier(c)}", "title": "", "as": False} for c in comps],
        "series": [{"id": s, "label": label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "noCalc": True, "reportsBy": "question", "note": NOTE,
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
