"""Write the AQA GCSE Food Preparation and Nutrition bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_gcse_food/build_food.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-food

build_pe.py for Food: the same rows and files (src/content/questionBank/aqa-gcse-food-preparation-and-nutrition.json
and public/question-bank/aqa-gcse-food-preparation-and-nutrition/{parts,text,reports}.json). What differs:
  - The topic tree is spec_food.py's: the five areas as tiles, their numbered topics under them, each topic
    with its short name where it has one ("Proteins in cooking"), as in the GCSE Psychology bank.
  - There is one written paper, 8585/W, out of 100 marks; its Section A is twenty multiple-choice
    parts (01.1-01.20), each keyed ("k": "C") with no scheme crop.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-food")
SLUG = "aqa-gcse-food-preparation-and-nutrition"
PAPERS = {"8585W": "Food preparation and nutrition"}
TOTAL = 100


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8585"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["series"] in series_cut and f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    ids = [p["id"] for p in parts]
    assert len(ids) == len(set(ids)), "a question id read twice"
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = re.sub(r"\s+", " ", own_text(p["text"], p["label"]))
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": own[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        assert row.get("ms") or row.get("k"), f"{p['id']}: no scheme"
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], [int(x) for x in r["l"].split(".")]))
    totals = {}
    for r in rows:
        totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != TOTAL}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"], "slug": slug(t.get("short") or t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "Food Preparation and Nutrition", "specs": ["8585"],
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": "Written paper", "title": PAPERS[c], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('st'))} with a stem, "
          f"{sum(1 for r in rows if r.get('k'))} multiple-choice keys, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('calc'))} calculations, papers {comps}, series {series}"
          + (f"; marks off: {off}" if off else f"; all {len(totals)} papers' marks add up to {TOTAL}"), file=sys.stderr)


if __name__ == "__main__":
    main()
