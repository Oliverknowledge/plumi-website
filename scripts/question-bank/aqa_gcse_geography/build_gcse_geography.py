"""Write the AQA GCSE Geography bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_gcse_geography/build_gcse_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-geography

build_geography.py for the GCSE: the same rows and files (src/content/questionBank/aqa-gcse-geography.json
and public/question-bank/aqa-gcse-geography/{parts,text,reports}.json). What differs:
  - Paper 3's issue evaluation questions have the pre-release resources booklet as their stem
    ("80353-jun24-01-stem.webp"), and the booklet is the paper's insert ("ins") in `wholes`.
    Papers 1 and 2 keep their OS map keys in the library only: their figures are in the paper.
  - A multiple-choice part carries its letter ("k") as well as its scheme crop.
  - A question with no parts is one row labelled "03" (id "80353-jun24-03-q").
  - Topics aren't split by year (GCSE), and no part is marked "or": the options are whole
    questions, tagged to their own topics (tag_gcse_geography.py).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")
SLUG = "aqa-gcse-geography"
PAPERS = {"80351": "Living with the physical environment", "80352": "Challenges in the human environment", "80353": "Geographical applications"}


def own_text(p):
    """The part's own words, from its label ("0 1 . 1 0", "0 3") to its marks."""
    label = r"0\s*" + p["question"][1] + (r"\s*\.\s*" + r"\s*".join(p["part"]) if p["part"] else "")
    m = re.search(label + r"\s+(.*)", p["text"])
    own = BOILERPLATE.sub(" ", m.group(1) if m else p["text"])
    marks = re.search(r"\[\d+ marks?\]", own)
    return re.sub(r"\s+", " ", own[:marks.end()] if marks else own).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8035"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["series"] in series_cut and (f["kind"] in ("qp", "ms", "er") or f["kind"] == "pm"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})["ins" if f["kind"] == "pm" else f["kind"]] = f"aqa/{f['file']}"
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
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], **({"ref": t["ref"]} if "ref" in t else {}), "title": t["title"], "section": t["section"],
               "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "Geography", "specs": ["8035"],
        "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
        "papers": [{"id": c, "name": f"Paper {c[4]}", "title": PAPERS[c], "as": False} for c in comps],
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
          f"{sum(1 for r in rows if r.get('k'))} multiple-choice keys, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('calc'))} calculations, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
