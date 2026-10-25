"""Write the OCR science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr/build_ocr.py [work-dir]

build_pearson.py's sibling, in the same shapes. Reads <work-dir>/parts.json (cut by
edexcel_sciences/cut_pearson.py, which reads OCR's layout too), spec.json
(spec_ocr.py), manifest.json (fetch_ocr.py) and tags.json (tag_ocr.py merge).
Writes, per subject:
  src/content/questionBank/<slug>.json      topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports, by question
The whole papers it links to are the past paper library's own copies (manifest `r2`).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-sciences")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402

SUBJECTS = [("ocr-a-level-biology-a", "Biology A", ("H020", "H420")),
            ("ocr-a-level-chemistry-a", "Chemistry A", ("H032", "H432")),
            ("ocr-a-level-physics-a", "Physics A", ("H156", "H556"))]
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The examiners' reports' running header: "A Level Chemistry A - H432/01 - Summer 2025 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,90}?Examiners[’']? report|© OCR \d{4}")


def ocr_report(text):
    return clean_report(REPORT_HEADER.sub("", text))


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def paper_for(comp, titles):
    """'h432-01' -> {id: 'h43201', name: 'Paper 1', title: 'Periodic Table, Elements and Physical Chemistry', as: False}."""
    spec, num = comp[:4].upper(), int(comp[5:])
    as_level = spec in ("H020", "H032", "H156")
    title = titles.get(comp, "").split(":", 1)[-1].strip()
    return {"id": comp.replace("-", ""), "name": f"{'AS ' if as_level else ''}Paper {num}", "title": title, "as": as_level}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    titles = {f["component"]: f["title"] for f in manifest if f["kind"] == "qp"}
    wholes, whole_ms = {}, {}
    for f in manifest:
        comp = f["component"].replace("-", "")
        wholes.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = f["r2"]
        if f["kind"] == "ms":
            whole_ms[(comp, f["series"])] = f["r2"]
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for subj_slug, name, specs in SUBJECTS:
        mine = [p for p in parts if p["spec"] in specs and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[specs[1]]
        valid = {t["code"] for t in tree["topics"]}
        rows, text, reports = [], {}, {}
        for p in mine:
            words = OCR_BOILER.sub(" ", p["text"])
            own = own_text(words, p["label"])
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]
            if p.get("key"):
                row["k"] = p["key"]
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", ocr_report(p["er"]))
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"][1:4] in ("020", "032", "156"), r["p"], label_order(r["l"])))
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
            topics.append({"code": t["code"], "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": t["year"]})
        comps = sorted({p["component"] for p in mine}, key=lambda c: (c[1:4] in ("020", "032", "156"), c))
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        manifest_comp = {f["component"].replace("-", ""): f["component"] for f in manifest}
        meta = {
            "slug": subj_slug, "board": "OCR", "level": "A-Level", "subject": name, "specs": list(specs),
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
            "papers": [paper_for(manifest_comp[c], titles) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
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
