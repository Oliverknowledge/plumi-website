"""Write the AQA A-Level Philosophy bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_philosophy/build_philosophy.py [work-dir]   # default scripts/question-bank/.work/aqa-philosophy

build_psychology.py for Philosophy: the same rows and files
(src/content/questionBank/aqa-a-level-philosophy.json and
public/question-bank/aqa-a-level-philosophy/{parts,text,reports}.json). What differs:
  - The topic tree is spec_philosophy.py's: the four areas as sections, the
    specification's headings under them as topics.
  - Every question is whole ("04"), so reports are keyed by question id (reportsBy "question").
  - No question asks for a calculation, so the filter is left out (noCalc).
  - Each paper's marks must add up to its 100.
  - The page says what AQA no longer publishes (note).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-philosophy")
SLUG = "aqa-a-level-philosophy"
# AQA publishes Philosophy from November 2020 on; June 2017-2019 and the AS (7171) are no longer on its site.
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}
PAPERS = {"71721": "Epistemology and moral philosophy", "71722": "The metaphysics of God and the metaphysics of mind"}


def paper_for(comp):
    return {"id": comp, "name": f"Paper {comp[4]}", "title": PAPERS[comp], "as": False}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7172"]
    manifest = [f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["series"] in SERIES]
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if p["series"] not in SERIES or not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], int(r["l"])))
    totals = {}
    for r in rows:
        totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != 100}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Philosophy", "specs": ["7172"],
        "sections": tree["sections"], "topics": topics,
        "papers": [paper_for(c) for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "noCalc": True, "reportsBy": "question",
        "note": "AQA no longer publishes June 2019, the A-Level’s first series, or its AS papers, so they aren’t here.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"papers {comps}, {len(totals)} sittings" + (f"; marks off: {off}" if off else "; every paper's marks add up to 100")
          + f"; topics with no questions: {[t['code'] for t in topics if not t['count']]}", file=sys.stderr)


if __name__ == "__main__":
    main()
