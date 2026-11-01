"""Write the AQA A-Level Politics bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_politics/build_politics.py [work-dir]   # default scripts/question-bank/.work/aqa-politics

build_sociology.py for Politics: the same rows and files
(src/content/questionBank/aqa-a-level-politics.json and
public/question-bank/aqa-a-level-politics/{parts,text,reports}.json). What differs:
  - The topic tree is spec_politics.py's: the specification's six sub-areas as sections,
    their numbered topics as topics.
  - Question 04 is set on extracts, its stem ("st"); its id names them ("71521-jun24-ex-04").
  - Section C is a choice of one essay: 05 or 06 (Papers 1 and 2), one of 05-09 (Paper 3).
    06 onwards carry "or", so each paper's marks count one essay (77 a paper).
  - AQA hasn't published the question paper of Paper 1, June 2025 (its scheme and report are
    out), so that sitting is left out, and the bank's note says so.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-politics")
SLUG = "aqa-a-level-politics"
PAPERS = {"71521": "Government and politics of the UK", "71522": "Government and politics of the USA and comparative politics", "71523": "Political ideas"}
NOTE = "Paper 1 from June 2025 isn't here yet: AQA hasn't published its question paper."


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7152"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    sittings = {(p["component"], p["series"]) for p in parts}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er") and (f["component"], f["series"]) in sittings:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        marks = re.search(r"\[\d+ marks?\]", own)
        own = own[:marks.end()] if marks else own  # the extracts' words follow the question's
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p["group"] == "c" and int(p["question"]) > 5:
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
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
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != 77}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
               "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Politics", "specs": ["7152"],
        "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
        "papers": [{"id": c, "name": f"Paper {c[4]}", "title": PAPERS[c], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items())},
        "reportsBy": "question", "noCalc": True, "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('st'))} extract questions, "
          f"{sum(1 for r in rows if r.get('or'))} alternatives, papers {comps}" + (f"; marks off: {off}" if off else "; every paper's marks add up"), file=sys.stderr)


if __name__ == "__main__":
    main()
