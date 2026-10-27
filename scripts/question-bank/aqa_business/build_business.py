"""Write the AQA A-Level Business bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_business/build_business.py [work-dir]   # default scripts/question-bank/.work/aqa-business

build_economics.py for Business: the same rows and files
(src/content/questionBank/aqa-a-level-business.json and
public/question-bank/aqa-a-level-business/{parts,text,reports}.json). What differs:
  - The topic tree is spec_business.py's: the ten areas as tiles, their topics under them.
  - Ids are cut.py's ("71322-jun24-01-3", "71321-jun24-18"), so the reports are keyed by
    whole question, as in the other AQA science banks (no reportsBy).
  - The choices are marked: A-Level Paper 1's second essay in Sections C and D carries "or",
    so a paper's marks count one essay of each pair: 100 for each A-Level paper, 80 for AS.
  - Multiple-choice questions carry their answer letter ("k").
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-business")
SLUG = "aqa-a-level-business"
PAPERS = {"71321": "Multiple choice, short answers and essays", "71322": "Data response", "71323": "Case study",
          "71311": "Multiple choice, short answers and data response", "71312": "Case study"}


def paper_for(comp):
    as_level = comp.startswith("7131")
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {comp[4]}", "title": PAPERS[comp], "as": as_level}


def label_key(label):
    q, _, p = label.partition(".")
    return int(q), int(p or 0)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7132"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er") and f["series"] in series_cut:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("or"):
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault("-".join(p["id"].split("-")[:3]), p["er"])
        if CALC.search(own[:600]) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("7131"), r["p"], label_key(r["l"])))
    # Each paper's marks, counting one essay of each either/or pair, must be the paper's total.
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != (80 if k[0].startswith("7131") else 100)}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
               "slug": slug(t.get("short") or t["title"]), "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("7131"), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Business", "specs": ["7132", "7131"],
        "sections": [{"code": s["code"], "title": s["title"], "short": s["short"]} for s in tree["sections"]], "topics": topics,
        "papers": [paper_for(c) for c in comps],
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
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('k'))} keys, "
          f"{sum(1 for r in rows if r.get('st'))} with stems, {sum(1 for r in rows if r.get('or'))} alternatives, papers {comps}"
          + (f"; marks off: {off}" if off else f"; all {len(totals)} papers' marks add up"), file=sys.stderr)


if __name__ == "__main__":
    main()
