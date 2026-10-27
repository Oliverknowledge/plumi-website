"""Write the AQA A-Level Geography bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_geography/build_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-geography

build_sociology.py for Geography: the same rows and files
(src/content/questionBank/aqa-a-level-geography.json and
public/question-bank/aqa-a-level-geography/{parts,text,reports}.json). What differs:
  - Rows are parts ("01.3", id "70371-jun24-01-3"), as in the AQA sciences: a question's
    parts share its examiner's report (keyed "70371-jun24-01") and, for AS Paper 2's
    fieldwork scenarios, its stem ("70362-jun24-03-stem.webp").
  - The topic tree is spec_geography.py's: each option its own area, so a student shows
    only their options; the AS content is Year 1, the rest Year 2.
  - No part is marked "or". The choices are whole questions (Paper 1: one of deserts,
    coasts, glaciers and one of hazards, ecosystems), and "or" is for a choice inside one
    question: on a whole question it would leave the card with no marks, as the Edexcel
    Geography bank found. Each option's parts are tagged to its own area instead, and
    check_geography.py checks every paper's total with the choices.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-geography")
SLUG = "aqa-a-level-geography"
PAPERS = {"70371": "Physical geography", "70372": "Human geography",
          "70361": "Physical geography and people and the environment", "70362": "Human geography and geography fieldwork investigation"}


def paper_for(comp):
    as_level = comp.startswith("7036")
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {comp[4]}", "title": PAPERS[comp], "as": as_level}


def own_text(p):
    """The part's own words, from its label ("0 1 . 3") to its marks."""
    m = re.search(r"0\s*" + p["question"][1] + r"\s*\.\s*" + p["part"] + r"\s+(.*)", p["text"])
    own = BOILERPLATE.sub(" ", m.group(1) if m else p["text"])
    marks = re.search(r"\[\d+ marks?\]", own)
    return re.sub(r"\s+", " ", own[:marks.end()] if marks else own).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7037"]
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
        own = own_text(p)
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": own[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(p["id"].rsplit("-", 1)[0], p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("7036"), r["p"], [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    # A title several areas share ("Case studies", "Systems and processes") is named for its area: "coastal-systems-and-landscapes-case-studies".
    shared = {t["title"] for t in tree["topics"] if sum(x["title"] == t["title"] for x in tree["topics"]) > 1}
    shorts = {s["code"]: s["short"] for s in tree["sections"]}
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"],
               "slug": slug(f"{shorts[t['section']]} {t['title']}" if t["title"] in shared else t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("7036"), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Geography", "specs": ["7037", "7036"],
        "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
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
    print(f"{SLUG}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('st'))} with a stem, "
          f"{sum(1 for r in rows if r.get('calc'))} calculations, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
