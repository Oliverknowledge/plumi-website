"""Write the WJEC banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/wjec/build_wjec.py [work-dir]   # default .work/wjec

build_ocr.py's sibling, in the same shapes. Reads <work-dir>/parts.json and
parts-maths.json (cut_wjec.py), spec.json (spec_wjec.py), manifest.json (fetch_wjec.py)
and tags.json (tag_wjec.py merge). Writes, per bank:
  src/content/questionBank/<slug>.json      topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiners' reports
The whole papers it links to are our copies of WJEC's (wjec/WJEC-2420U10-1-QP-JUN23.pdf).

A paper is its unit ("2420u10": AS Unit 1); WJEC sits each unit every summer, so a
series is "JUN23", shown as WJEC names it, "Summer 2023". The sciences are cut part by
part, maths a whole question at a time (its reports are then by question).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "wjec")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402
sys.path.insert(0, HERE)
from tag_wjec import BOILER, subject, trees  # noqa: E402

BANKS = {  # slug: (spec.json's subject, the bank's subject)
    "wjec-a-level-biology": ("biology", "Biology"),
    "wjec-a-level-chemistry": ("chemistry", "Chemistry"),
    "wjec-a-level-physics": ("physics", "Physics"),
    "wjec-a-level-maths": ("maths", "Maths"),
}
SEASON = {"JUN": "Summer", "NOV": "Autumn"}


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = []
    for name in ("parts.json", "parts-maths.json"):
        parts += json.load(open(os.path.join(WORK, name)))
    spec = trees()
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    qps = {f["component"].lower(): f for f in manifest if f["kind"] == "qp"}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].lower()}-{f['series']}", {})[f["kind"]] = f["r2"]
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for bank, (key, name) in BANKS.items():
        maths = key == "maths"
        tree = spec[key]
        valid = {t["code"] for t in tree["topics"]}
        mine = [p for p in parts if subject(p) == key and p.get("qp") and p["h"] > 0]
        rows, text, reports = [], {}, {}
        for p in mine:
            words = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", BOILER.sub(" ", p["text"]))).strip()
            # (the paper prints its numbers with a full stop, "3. (a) …": the part's own words follow its label)
            own = re.sub(r"^\d{1,2}\s+", "", words) if maths else own_text(re.sub(r"(?<!\S)(\d{1,2})\.(?=\s)", r"\1", words), p["label"])
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
                row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
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
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("2"), r["p"], int(r["l"]) if maths else label_order(r["l"])))
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
            # (Unit 4's options are A2 topics in the Unit 4 group: the bank's year 3 is headed "Paper 3 options")
            topics.append({"code": t["code"], "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0),
                           "year": min(t.get("year", 0), 2)})
        comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("2"), c))
        papers = []
        for c in comps:
            u = c[5]
            title = qps[c]["title"].split(":")[-1].strip()  # "Physics Unit 1: Written:Motion, Energy and Matter"
            title = {"The Lang of Chem, Structure of Matter and Simple Reactions": "The Language of Chemistry, Structure of Matter and Simple Reactions"}.get(title, title)
            papers.append({"id": c, "name": f"{'AS ' if c.startswith('2') else ''}Unit {u}", "title": title, "as": c.startswith("2")})
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": bank, "board": "WJEC", "level": "A-Level", "subject": name, "specs": sorted({c[:4].upper() for c in comps}),
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics, "papers": papers,
            "series": [{"id": s, "label": f"{SEASON[s[:3]]} 20{s[3:]}"} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
            **({"noCalc": True, "reportsBy": "question"} if maths else {}),
            "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{bank}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", bank)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{bank}: {len(rows)} {'questions' if maths else 'parts'}, {sum(1 for r in rows if r['t'])} tagged, "
              f"{len(reports)} reports, papers {[p['id'] for p in papers]}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
