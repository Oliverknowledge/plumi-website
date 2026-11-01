"""Write the Edexcel International GCSE science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_igcse/build_igcse.py [work-dir]   # default scripts/question-bank/.work/edexcel-igcse

edexcel_gcse/build_gcse.py for the International GCSE specifications, writing the same shapes to
src/content/questionBank/edexcel-igcse-<subject>.json and public/question-bank/edexcel-igcse-<subject>/
{parts,text,reports}.json. What differs: there are no tiers, so the papers are Paper 1 (sat for the
subject and for Science Double Award) and Paper 2 (the subject only); there are January series; and
each June and January paper has an "R" version, its own series ("JUN24R", "June 2024 (R)"). Whole
papers are linked from edexcel-igcse/ on R2 (upload_r2.py --pdf-prefix=edexcel-igcse/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402

SUBJECTS = [("edexcel-igcse-biology", "Biology", "4BI1"), ("edexcel-igcse-chemistry", "Chemistry", "4CH1"), ("edexcel-igcse-physics", "Physics", "4PH1")]
MONTH = {"JAN": "January", "JUN": "June", "NOV": "November"}
NOTE = "A sitting marked (R) is Pearson’s second paper for it, sat in other time zones. Pearson keeps its newest papers for schools and didn’t publish November 2022’s."


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:5]}" + (" (R)" if s.endswith("R") else "")


def series_rank(s):
    return int("20" + s[3:5]) * 100 + {"JAN": 1, "JUN": 6, "NOV": 11}[s[:3]] - (0.5 if s.endswith("R") else 0)


def paper_for(comp, name):
    """4bi11b -> Paper 1, for Biology and Science Double Award; 4bi12b -> Paper 2, Biology only."""
    return {"id": comp, "name": f"Paper {comp[4]}", "title": f"{name} and Double Award" if comp[4] == "1" else f"{name} only", "as": False}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes, whole_ms = {}, {}
    for f in manifest:
        comp = f["component"].replace("-", "")
        wholes.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = f"edexcel-igcse/{f['file']}"
        if f["kind"] == "ms":
            whole_ms[(comp, f["series"])] = f"edexcel-igcse/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for subj_slug, name, code in SUBJECTS:
        # A label read twice on one page gives two parts one id (and one image): leave both out.
        mine = [p for p in parts if p["spec"] == code and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[code]
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
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        topics = [{"code": n["code"], "ref": "", "points": n["points"], "title": n["title"], "section": n["section"], "slug": slug(n["title"]),
                   "count": counts.get(n["code"], 0), "year": 0} for n in tree["topics"]]
        assert len({t["slug"] for t in topics}) == len(topics), f"{subj_slug}: two topics share an address"
        comps = sorted({r["p"] for r in rows})
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:5]) for s in series]
        meta = {
            "slug": subj_slug, "board": "Edexcel", "level": "IGCSE", "subject": name, "specs": [code],
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
            "papers": [paper_for(c, name) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
            "note": NOTE,
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tagged = sum(1 for r in rows if r["t"])
        print(f"{subj_slug}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {len(series)} series, "
              f"{sum(1 for r in rows if not r.get('ms'))} without a scheme crop", file=sys.stderr)


if __name__ == "__main__":
    main()
