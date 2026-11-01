"""Write the Edexcel GCSE Combined Science bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/edexcel_combined/build_combined.py [work-dir]   # default scripts/question-bank/.work/edexcel-combined

edexcel_gcse/build_gcse.py for one bank of three sciences, as aqa_trilogy/build_trilogy.py is for
AQA's: src/content/questionBank/edexcel-gcse-combined-science.json and
public/question-bank/edexcel-gcse-combined-science/{parts,text,reports}.json. Papers are
"Biology Paper 1 Higher" and so on (1sc01bh), sections the specification's topics by science
(B1–B9, C1–C8, P1–P15). Whole papers are linked from edexcel/ on R2 (upload_r2.py --pdf-prefix=edexcel/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-combined")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_gcse import series_label, series_rank  # noqa: E402
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "edexcel-gcse-combined-science"
SCIENCE = {"b": "Biology", "c": "Chemistry", "p": "Physics"}
TIER = {"h": "Higher", "f": "Foundation"}


def paper_for(comp):
    """1sc02ch -> Chemistry Paper 2 Higher."""
    return {"id": comp, "name": f"{SCIENCE[comp[5]]} Paper {comp[4]} {TIER[comp[6]]}", "title": "", "as": False}


def paper_order(comp):
    return ("bcp".index(comp[5]), comp[4], comp[6] != "h")


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1SC0"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes, whole_ms = {}, {}
    for f in manifest:
        comp = f["component"].replace("-", "")
        wholes.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
        if f["kind"] == "ms":
            whole_ms[(comp, f["series"])] = f"edexcel/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    # A label read twice on one page gives two parts one id (and one image): leave both out.
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {n["code"] for n in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif (p["component"], p["series"]) in whole_ms:
            row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"]), label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": n["code"], "ref": "", "points": n["points"], "title": n["title"], "section": n["section"], "slug": slug(n["title"]),
               "count": counts.get(n["code"], 0), "year": 0} for n in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=paper_order)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "Combined Science", "specs": ["1SC0"],
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
    print(f"{SLUG}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {len(comps)} papers, series {series}, "
          f"{sum(1 for r in rows if not r.get('ms'))} without a scheme crop", file=sys.stderr)
    for t in topics:
        if not t["count"]:
            print("  no questions:", t["code"], t["title"], file=sys.stderr)


if __name__ == "__main__":
    main()
