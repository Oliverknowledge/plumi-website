"""Write the AQA A-Level Sociology bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_sociology/build_sociology.py [work-dir]   # default scripts/question-bank/.work/aqa-sociology

build_economics.py for Sociology: the same rows and files
(src/content/questionBank/aqa-a-level-sociology.json and
public/question-bank/aqa-a-level-sociology/{parts,text,reports}.json). What differs:
  - The topic tree is spec_sociology.py's: the specification's areas as sections,
    their bullet points as topics.
  - A question set on an Item carries it as its stem ("st"); its id names the Item
    ("71922-jun24-ic-05"), so reports are keyed by question id (reportsBy "question").
  - The choices are marked: in A-Level Paper 2 a candidate answers one topic of
    Section A and one of Section B, so Topics A2-A4 and B2-B4 are the alternatives to
    A1 and B1; in AS Paper 2, B2-B4 to B1. Their questions carry "or", so a paper's
    marks count one topic of each section (80 for each A-Level paper, 60 for AS).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-sociology")
SLUG = "aqa-a-level-sociology"
PAPERS = {"71921": "Education with Theory and Methods", "71922": "Topics in Sociology", "71923": "Crime and Deviance with Theory and Methods",
          "71911": "Education with Methods in Context", "71912": "Research Methods and Topics in Sociology"}
ALTERNATIVES = {"a2", "a3", "a4", "b2", "b3", "b4"}  # answered instead of Topic A1 / B1


def paper_for(comp):
    as_level = comp.startswith("7191")
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {comp[4]}", "title": PAPERS[comp], "as": as_level}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7192"]
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
        # The opening words, with the Item's own pointer to itself ("Read Item A below…") left out.
        own = re.sub(r"^Read Item [A-Z] below and answer the question that follows\.\s*", "", own_text(p["text"], p["label"]))
        marks = re.search(r"\[\d+ marks?\]", own)
        own = own[:marks.end()] if marks else own  # the Item's words follow its question's
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p["option"] in ALTERNATIVES:
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
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("7191"), r["p"], int(r["l"])))
    # Each paper's marks, counting one topic from each section, must be the paper's total.
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != (60 if k[0].startswith("7191") else 80)}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("7191"), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Sociology", "specs": ["7192", "7191"],
        "sections": [{"code": s["code"], "title": s["title"], "short": s["short"]} for s in tree["sections"]], "topics": topics,
        "papers": [paper_for(c) for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "reportsBy": "question", "noCalc": True,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('st'))} Items, "
          f"{sum(1 for r in rows if r.get('or'))} alternatives, papers {comps}" + (f"; marks off: {off}" if off else "; every paper's marks add up"), file=sys.stderr)


if __name__ == "__main__":
    main()
