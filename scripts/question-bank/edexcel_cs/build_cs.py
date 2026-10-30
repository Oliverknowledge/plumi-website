"""Write the Edexcel GCSE Computer Science (1CP2) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_cs/build_cs.py [work-dir]   # default scripts/question-bank/.work/edexcel-cs

edexcel_gcse/build_gcse.py for Computer Science, writing the same shapes to
src/content/questionBank/edexcel-gcse-computer-science.json and
public/question-bank/edexcel-gcse-computer-science/{parts,text,reports}.json. Reads, in the
work dir: parts.json (cut_cs.py), spec.json (spec_cs.py), manifest.json (fetch_cs.py) and
tags.json (tag_cs.py merge). No tiers; the specimen papers are a series of their own ("SPEC"),
listed last. Whole papers, and Paper 2's code files (wholes' "code"), link the past paper
library's copies under edexcel/ on R2 (scripts/past-papers/boards/edexcel_cs.py names them;
scripts/past-papers/upload.py edexcel-cs uploads them).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-cs")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, MONTH, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "edexcel-gcse-computer-science"
RUNNING = re.compile(r"\s*GCSE Computer Science 1CP2 0[12]\b")  # the reports' running header
PAPERS = {"1cp21": ("Paper 1", "Principles of Computer Science"), "1cp22": ("Paper 2", "Application of Computational Thinking")}
NOTE = ("Paper 2 is sat on screen, in Python: each of its questions opens one of Pearson’s code files, "
        "linked beside it. Pearson keeps June 2025’s code files for teachers only.")


def series_label(s):
    return "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + 6


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1CP2"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    wholes = {}
    for f in manifest:
        n = f["component"][-1]
        name = f"edexcel/EDX-1CP2-0{n}-{f['kind'].upper()}-{f['series']}{os.path.splitext(f['file'])[1]}"
        wholes.setdefault(f"1cp2{n}-{f['series']}", {})["code" if f["kind"] == "data" else f["kind"]] = name
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(RUNNING.sub("", p["er"])))
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "Computer Science", "specs": ["1CP2"], "note": NOTE,
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
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
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('k'))} keys, {len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
