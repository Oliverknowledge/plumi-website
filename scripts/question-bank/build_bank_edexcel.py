"""Write the Edexcel Maths and Further Maths banks' data files.

    python3 scripts/question-bank/build_bank_edexcel.py [work-dir]   # default .work-edexcel

Same outputs as build_bank.py, for two subjects:
  edexcel-a-level-maths          9MA0 and 8MA0 (AS)
  edexcel-a-level-further-maths  9FM0 and 8FM0 (AS)
Current specifications only; the legacy modules' names are kept in PAPERS in case they return.
Topics come from edexcel_topics.json; tags from <work-dir>/tags.json (tag.md).
Whole papers are served from R2 under edexcel/ (upload_r2.py --pdf-prefix=edexcel/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work-edexcel")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
from build_bank import BOILERPLATE, series_label, slug  # noqa: E402

PAPERS = {
    "9MA0-01": "Pure 1", "9MA0-02": "Pure 2", "9MA0-03": "Statistics and Mechanics", "9MA0-31": "Statistics", "9MA0-32": "Mechanics",
    "8MA0-01": "AS Pure", "8MA0-02": "AS Statistics and Mechanics", "8MA0-21": "AS Statistics", "8MA0-22": "AS Mechanics",
    "9FM0-01": "Core Pure 1", "9FM0-02": "Core Pure 2", "9FM0-3A": "Further Pure 1", "9FM0-3B": "Further Statistics 1",
    "9FM0-3C": "Further Mechanics 1", "9FM0-3D": "Decision 1", "9FM0-4A": "Further Pure 2", "9FM0-4B": "Further Statistics 2",
    "9FM0-4C": "Further Mechanics 2", "9FM0-4D": "Decision 2",
    "8FM0-01": "AS Core Pure", "8FM0-21": "AS Further Pure 1", "8FM0-22": "AS Further Pure 2", "8FM0-23": "AS Further Statistics 1",
    "8FM0-24": "AS Further Statistics 2", "8FM0-25": "AS Further Mechanics 1", "8FM0-26": "AS Further Mechanics 2",
    "8FM0-27": "AS Decision 1", "8FM0-28": "AS Decision 2",
    "6663": "C1", "6664": "C2", "6665": "C3", "6666": "C4", "6683": "S1", "6677": "M1",
    "6667": "FP1", "6668": "FP2", "6669": "FP3", "6678": "M2", "6679": "M3", "6680": "M4", "6681": "M5",
    "6684": "S2", "6691": "S3", "6686": "S4", "6689": "D1", "6690": "D2",
}
SUBJECTS = [
    ("edexcel-a-level-maths", "Maths", "maths", {"9MA0", "8MA0"}),
    ("edexcel-a-level-further-maths", "Further Maths", "further", {"9FM0", "8FM0"}),
]
LEGACY_TITLE = {"C": "Core Mathematics", "S": "Statistics", "M": "Mechanics", "FP": "Further Pure Mathematics", "D": "Decision Mathematics"}


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def paper_for(comp):
    name = PAPERS.get(comp, comp)
    spec = comp.split("-")[0]
    legacy = "-" not in comp
    title = f"{LEGACY_TITLE[re.match(r'[A-Z]+', name).group(0)]} {name[-1]} ({comp}), legacy" if legacy else f"{spec}/{comp.split('-')[1]}"
    return {"id": comp, "name": name, "title": title, "as": spec in ("8MA0", "8FM0")}


def paper_order(comp):
    spec = comp.split("-")[0]
    return (2 if "-" not in comp else 1 if spec.startswith("8") else 0, comp)


def own_text(text, label):
    m = re.search(r"^\s*" + label + r"\.\s*(.*)", text, re.S)
    return BOILERPLATE.sub(" ", m.group(1) if m else text).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    topics_all = json.load(open(os.path.join(HERE, "edexcel_topics.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1

    files_out = []
    for subj_slug, name, key, specs in SUBJECTS:
        mine = [p for p in parts if p["spec"] in specs and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        nodes = topics_all[key]
        valid = {n["code"] for n in nodes if n["level"] == 2}
        rows, text, reports = [], {}, {}
        for p in mine:
            own = own_text(p["text"], p["label"])
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("ms"):
                row["ms"] = 1
            elif f"{p['component']}-{p['series']}" in wholes and "ms" in wholes[f"{p['component']}-{p['series']}"]:
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
        sections = [{"code": n["code"], "title": n["title"]} for n in nodes if n["level"] == 1]
        used, topics = set(), []
        for n in nodes:
            if n["level"] != 2:
                continue
            s = slug(n["title"])
            if s in used:
                s = slug(n["code"] + " " + n["title"])
            used.add(s)
            topics.append({"code": n["code"], "title": n["title"], "section": n["code"].split(".")[0], "slug": s, "count": counts.get(n["code"], 0), "year": 0})
        comps = sorted({r["p"] for r in rows}, key=paper_order)
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": subj_slug, "board": "Edexcel", "level": "A-Level", "subject": name,
            "cropVersion": 1,  # 1: a question's crop starts above its label when a taller line (a column vector, a fraction) sits on it (28 October 2026)
            "specs": sorted({c.split("-")[0] for c in comps}), "sections": sections, "topics": topics,
            "papers": [paper_for(c) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.rsplit("-", 1)[0] in comps},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years), "noCalc": True,
            "reportsBy": "question",
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{subj_slug}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, {len(comps)} papers", file=sys.stderr)
        files_out += [{"component": f["component"], "series": f["series"], "kind": f["kind"], "file": f"edexcel/{f['file']}", "title": f.get("title", "")}
                      for f in manifest if f["spec"] in specs]
    json.dump(files_out, open(os.path.join(ROOT, "src", "content", "questionBank", "files-edexcel.json"), "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
