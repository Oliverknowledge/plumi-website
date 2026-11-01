"""Write the Level 2 Further Maths bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_l2_further_maths/build_l2fm.py
    # reads scripts/question-bank/.work/aqa-l2fm/{parts,tags,manifest,spec}.json

build_gcse_maths.py for 8365: the same rows and files (src/content/questionBank/<slug>.json
and public/question-bank/<slug>/{parts,text,reports}.json), each row a whole question with
its report keyed by the question (`reportsBy`), and the calculation filter sorting the
calculator paper (Paper 2) from the non-calculator one (`calcPapers`). The topics are
spec_l2fm.py's statements, 1.1 to 6.10, under the specification's six areas. The level is
"Level 2": the bank shelves with GCSE, and its pages say "AQA Level 2 Further Maths".

The whole papers are the past paper library's copies already in the bucket, under aqa/
with the same names as fetch_l2fm.py's, so only the crops go up (upload_r2.py --crops-only).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, os.path.join(HERE, "..", "gcse_maths"))
from build_bank import series_label, series_rank, slug  # noqa: E402
from build_gcse_maths import FURNITURE, own_text  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "aqa-l2fm")
SLUG = "aqa-level-2-further-maths"
PAPERS = {"83651": ("Paper 1", "Non-calculator"), "83652": ("Paper 2", "Calculator")}
CALCULATOR = {"83652"}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    assert len({p["id"] for p in parts}) == len(parts), "a question cut twice"
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
        "slug": SLUG, "board": "AQA", "level": "Level 2", "subject": "Further Maths", "fullName": "Further Mathematics (8365)", "specs": ["8365"],
        "sections": spec["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "calcPapers": True, "reportsBy": "question",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('calc'))} on the calculator paper, "
          f"{len(series)} series, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
