"""Write the Edexcel International GCSE Islamic Studies bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_igcse_islamic/build_igcse_islamic.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-igcse-islamic

edexcel_igcse/build_igcse.py for 4IS1, writing the same shapes to src/content/questionBank/edexcel-igcse-islamic-studies.json
and public/question-bank/edexcel-igcse-islamic-studies/{parts,text,reports}.json. 4IS1 is one paper, sat in June
(and in November 2020, for the May 2020 sitting); June 2021 is Pearson's assessment materials for the year exams were
cancelled. The topic tags are tags_igcse_islamic.json beside this script, read off each part's question (../tag.md,
"Edexcel International GCSE Islamic Studies"). Whole papers are linked from edexcel-igcse/ on R2
(upload_r2.py --pdf-prefix=edexcel-igcse/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse-islamic")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "edexcel-igcse-islamic-studies"
MONTH = {"JUN": "June", "NOV": "November"}
NOTE = ("One paper, sat each June (and in November 2020): answer Question 1 or 2, Question 3 or 4, then Questions 5 and 6. June 2021 is the paper Pearson "
        "set for schools to use the year exams were cancelled. Pearson keeps its newest papers for schools, so June 2026 is not here yet.")


def series_rank(s):
    return int("20" + s[3:5]) * 100 + {"JUN": 6, "NOV": 11}[s[:3]]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["4IS1"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(HERE, "tags_igcse_islamic.json")))

    wholes = {}
    for f in manifest:
        wholes.setdefault(f"4is101-{f['series']}", {})[f["kind"]] = f"edexcel-igcse/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        assert p.get("qp") and p.get("ms") and p["h"] > 0, p["id"]
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "ms": 1,
               "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        rows.append(row)
        # (the passages' Arabic was left out of p["text"] by the cutter: its text layer doesn't read; the English does)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower()).strip()
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": 0}
              for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:5]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "IGCSE", "subject": "Islamic Studies", "specs": ["4IS1"],
        "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
        "papers": [{"id": "4is101", "name": "Paper 1", "title": "Islamic Studies", "as": False}],
        "series": [{"id": s, "label": f"{MONTH[s[:3]]} 20{s[3:5]}"} for s in series],
        "wholes": dict(sorted(wholes.items())),
        "noCalc": True,
        "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, {len(series)} series, "
          f"{sum(1 for r in rows if not r.get('ms'))} without a scheme crop", file=sys.stderr)


if __name__ == "__main__":
    main()
