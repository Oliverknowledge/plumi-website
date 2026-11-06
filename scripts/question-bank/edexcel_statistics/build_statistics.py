"""Write the Edexcel Statistics bank's data files.

    python3 scripts/question-bank/edexcel_statistics/build_statistics.py <work-dir>

Same outputs as build_bank_edexcel.py, for one subject:
  edexcel-a-level-statistics   9ST0 (A level Statistics) and 8ST0 (AS Statistics)
Topics come from statistics_topics.json (the specification's 21 numbered content areas); tags from
<work-dir>/tags.json (tag.md, tag/edexcel-statistics.md). Whole papers are served from R2 under edexcel/
(upload_r2.py --pdf-prefix=edexcel/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
WORK = os.path.abspath(sys.argv[1])
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
from build_bank import BOILERPLATE, series_label, slug  # noqa: E402

SLUG = "edexcel-a-level-statistics"
PAPERS = {"9ST0-01": "Data and Probability", "9ST0-02": "Statistical Inference", "9ST0-03": "Statistics in Practice",
          "8ST0-01": "AS Paper 1", "8ST0-02": "AS Paper 2"}


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def paper_order(comp):
    return (1 if comp.startswith("8") else 0, comp)


def own_text(text, label):
    m = re.search(r"^\s*" + label + r"\.\s*(.*)", text, re.S)
    return BOILERPLATE.sub(" ", m.group(1) if m else text).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    nodes = json.load(open(os.path.join(HERE, "statistics_topics.json")))["statistics"]
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {n["code"] for n in nodes if n["level"] == 2}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("ms"):
            row["ms"] = 1
        elif "ms" in wholes.get(f"{p['component']}-{p['series']}", {}):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(p["id"], p["er"])
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"]), int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    used, topics = set(), []
    for n in nodes:
        if n["level"] != 2:
            continue
        s = slug(n["title"])
        if s in used:
            s = slug(n["code"] + " " + n["title"])
        used.add(s)
        topics.append({"code": n["code"], "title": n["title"], "section": n["section"], "slug": s, "count": counts.get(n["code"], 0), "year": 0})
    comps = sorted({r["p"] for r in rows}, key=paper_order)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "A-Level", "subject": "Statistics",
        "cropVersion": 1,
        "specs": sorted({c.split("-")[0] for c in comps}),
        "sections": [{"code": n["code"], "title": n["title"]} for n in nodes if n["level"] == 1],
        "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c], "title": f"{c.split('-')[0]}/{c.split('-')[1]}", "as": c.startswith("8")} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.rsplit("-", 1)[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "noCalc": True, "reportsBy": "question",
        "note": "Pearson's own A level Statistics (9ST0) and its AS (8ST0, last sat in October 2020), not the statistics papers inside Maths or Further Maths. Calculators are allowed in every paper.",
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, {len(comps)} papers", file=sys.stderr)


if __name__ == "__main__":
    main()
