"""Write the CAIE banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/caie/build_caie.py [work-dir]
    # work-dir: .work/caie-sciences (default) or .work/caie-maths

build_ocr.py's sibling, in the same shapes, for both work folders: the sciences are
cut part by part, maths a whole question at a time (its reports are by question).
Reads <work-dir>/parts.json (edexcel_sciences/cut_pearson.py), spec.json
(spec_caie.py), manifest.json (fetch_caie.py) and tags.json (tag_caie.py merge).
Writes, per bank:
  src/content/questionBank/<slug>.json      topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports
The whole papers it links to are the past paper library's own copies (manifest `r2`).

A paper is its syllabus and number, the same for the June 2024 sitting (9709/31)
and the specimen (9709/03): "97093". Cambridge publishes only that one series and the
specimens, which `scope` says wherever the other banks give a range of years.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "caie-sciences")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402
sys.path.insert(0, HERE)
from tag_caie import BOILER, paper_of  # noqa: E402

BANKS = {  # slug: (syllabus, subject, the syllabus's own name)
    "caie-a-level-biology": ("9700", "Biology", "Biology (9700)"),
    "caie-a-level-chemistry": ("9701", "Chemistry", "Chemistry (9701)"),
    "caie-a-level-physics": ("9702", "Physics", "Physics (9702)"),
    "caie-a-level-maths": ("9709", "Maths", "Mathematics (9709)"),
    "caie-a-level-further-maths": ("9231", "Further Maths", "Further Mathematics (9231)"),
}
MATHS = ("9709", "9231")
SERIES = {"JUN24": "June 2024", "SPEC": "Specimen"}
SCOPE = "June 2024 and the specimen papers"


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    paper_id = lambda comp: comp[:4] + paper_of(comp)  # noqa: E731  '970931' -> '97093'
    qps = {f["component"].replace("-", ""): f for f in manifest if f["kind"] == "qp"}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{paper_id(f['component'].replace('-', ''))}-{f['series']}", {})[f["kind"]] = f["r2"]
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for bank, (code, subject, full) in BANKS.items():
        if code not in spec:
            continue
        maths = code in MATHS
        tree = spec[code]
        valid = {t["code"] for t in tree["topics"]}
        mine = [p for p in parts if p["spec"] == code and p.get("qp") and p["h"] > 0]
        rows, text, reports = [], {}, {}
        for p in mine:
            words = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", BOILER.sub(" ", p["text"].replace("\b", " ")))).strip()
            own = re.sub(r"^\d{1,2}\s+", "", words) if maths else own_text(words, p["label"])
            pid = paper_id(p["component"])
            row = {"id": p["id"], "p": pid, "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif wholes.get(f"{pid}-{p['series']}", {}).get("ms"):
                row["msf"] = wholes[f"{pid}-{p['series']}"]["ms"]
            if p.get("key"):
                row["k"] = p["key"]
            if p.get("er"):
                row["er"] = 1
                if maths:
                    reports[p["id"]] = clean_report(p["er"])
                else:
                    reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
            if not maths and (CALC.search(own) or CALC.search(p.get("msText", "")[:300])):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = (words + " " + re.sub(r"\s+", " ", p.get("msText", ""))).lower()
        is_as = lambda pid: qps[next(c for c in qps if paper_id(c) == pid)]["as"]  # noqa: E731
        rows.sort(key=lambda r: (r["s"] != "JUN24", is_as(r["p"]), r["p"], int(r["l"]) if maths else label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        used, topics = set(), []
        for t in tree["topics"]:
            s = slug(t["title"])
            if s in used:  # Chemistry's A Level topics repeat AS names; Maths Papers 2 and 3 share theirs
                s = slug(t["code"] + " " + t["title"])
            used.add(s)
            topics.append({"code": t["code"], "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": t["year"]})
        papers = []
        for pid in sorted({r["p"] for r in rows}, key=lambda c: (is_as(c), c)):
            title = qps[next(c for c in qps if paper_id(c) == pid)]["title"]
            name, _, rest = title.partition(":")
            papers.append({"id": pid, "name": name.strip(), "title": rest.strip(), "as": is_as(pid)})
        series = [s for s in SERIES if any(r["s"] == s for r in rows)]
        meta = {
            "slug": bank, "board": "CAIE", "level": "A-Level", "subject": subject, "fullName": full, "specs": [code],
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics, "papers": papers,
            "series": [{"id": s, "label": SERIES[s]} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in {p["id"] for p in papers}},
            **({"noCalc": True, "reportsBy": "question"} if maths else {}),
            "scope": SCOPE, "count": len(rows), "firstYear": 2024, "lastYear": 2024, "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{bank}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", bank)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{bank}: {len(rows)} {'questions' if maths else 'parts'}, {sum(1 for r in rows if r['t'])} tagged, "
              f"{len(reports)} reports, papers {[p['id'] for p in papers]}", file=sys.stderr)


if __name__ == "__main__":
    main()
