"""Write the Eduqas science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/eduqas/build_eduqas.py [work-dir] [--only=physics]

build_ocr.py's sibling, in the same shapes. Reads <work-dir>/parts.json (cut_eduqas.py),
spec.json (spec_eduqas.py), manifest.json (fetch_eduqas.py) and tags.json (tag_eduqas.py
merge). Writes, per subject:
  src/content/questionBank/<slug>.json        topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json      the whole list, fetched by the browser
  public/question-bank/<slug>/text.json       search text, fetched when someone types
  public/question-bank/<slug>/reports.json    examiner's reports, by question
practicals.json, for the Practicals filter, is practicals.py's, as for every bank: split it with
--only=<slug> --parts=<work-dir>/parts.json and eduqas/practical_candidates.py, judge, merge.
The whole papers it links to are uploaded beside the crops under eduqas/ (upload_r2.py
--pdf-prefix=eduqas/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-sciences")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402

SUBJECTS = [("eduqas-a-level-physics", "physics", "Physics"), ("eduqas-a-level-chemistry", "chemistry", "Chemistry"),
            ("eduqas-a-level-biology", "biology", "Biology")]
R2_PREFIX = "eduqas/"
MONTH = {"JUN": "June", "OCT": "Autumn"}  # Eduqas calls its October–November 2020 and 2021 sittings "Autumn"
EDUQAS_BOILER = re.compile(r"©\s*WJEC CBAC Ltd\.?|Turn over\.?|Examiner\s+only|\([AB]\d{3}U\d0-\d(?:-R\d)?\)|\.{6,}", re.I)


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (10 if s.startswith("OCT") else 6)


def paper_for(comp, title):
    """'a420u10' -> {id, name: 'Component 1', title: 'Newtonian Physics', as: False}; 'b420u20' is AS."""
    as_level = comp.startswith("b")
    title = title.replace("The Lang of Chem,", "The Language of Chemistry,")  # the listing's abbreviation
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Component {comp[-2]}", "title": title, "as": as_level}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    titles = {f["component"]: f["title"] for f in manifest if f["kind"] == "qp"}
    wholes, whole_ms = {}, {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = R2_PREFIX + f["file"]
        if f["kind"] == "ms":
            whole_ms[(f["component"], f["series"])] = R2_PREFIX + f["file"]
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for subj_slug, subject, name in SUBJECTS:
        if ONLY and subject not in ONLY:
            continue
        mine = [p for p in parts if p["subject"] == subject and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[subject]
        valid = {t["code"] for t in tree["topics"]}
        rows, text, reports = [], {}, {}
        for p in mine:
            words = EDUQAS_BOILER.sub(" ", p["text"])
            own = own_text(re.sub(r"(?<=\d)\.(?=\s)", "", words, count=1), p["label"])  # "3. (a)" reads as "3 (a)"
            if len(own) < 20:
                own = re.sub(r"\s+", " ", words).strip()[-160:]  # its label read in the middle of a line: the part's words as cut
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", EDUQAS_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("b"), r["p"], label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        used, topics = set(), []
        for t in tree["topics"]:
            s = slug(t["title"])
            if s in used:
                s = slug(t["code"] + " " + t["title"])
            used.add(s)
            topics.append({"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": s,
                           "count": counts.get(t["code"], 0), "year": t["year"]})
        comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("b"), c))
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": subj_slug, "board": "Eduqas", "level": "A-Level", "subject": name, "specs": sorted({c[:4].upper() for c in comps}),
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
            "papers": [paper_for(c, titles.get(c, "")) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{subj_slug}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
