"""Write the AQA GCSE Computer Science (8525) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/aqa_gcse_cs/build_gcse_cs.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-cs

edexcel_cs/build_cs.py for AQA, writing the same shapes to
src/content/questionBank/aqa-gcse-computer-science.json and
public/question-bank/aqa-gcse-computer-science/{parts,text,reports}.json. Reads, in the work
dir: parts.json (cut_gcse_cs.py), spec.json (spec_gcse_cs.py), manifest.json (fetch_gcse_cs.py)
and tags.json (tag_gcse_cs.py merge).

Paper 1 is three papers, one per programming language, and the bank's "Language" option
(the options Eduqas Religious Studies sorts its religions by): picking Python keeps 8525/1B
and Paper 2. The specimen papers are a series of their own ("SPEC"), listed last. Whole papers link AQA's
files as fetched, under aqa/ on R2 (upload_r2.py <work-dir>); Paper 1's languages share
one scheme and report.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-cs")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, ".."))
from build_pearson import BOILERPLATE, CALC, MONTH, slug  # noqa: E402
from build_bank import own_text  # noqa: E402

SLUG = "aqa-gcse-computer-science"
PAPERS = {
    "85251A": ("Paper 1 (C#)", "Computational thinking and programming skills", "cs"),
    "85251B": ("Paper 1 (Python)", "Computational thinking and programming skills", "py"),
    "85251C": ("Paper 1 (VB.NET)", "Computational thinking and programming skills", "vb"),
    "85252": ("Paper 2", "Computing concepts", None),
}
OPTIONS = {"label": "Language", "list": [{"id": "cs", "name": "C#"}, {"id": "py", "name": "Python"}, {"id": "vb", "name": "VB.NET"}]}
NOTE = ("Paper 1 is set in C#, Python or VB.NET: pick your language to see its paper, with mark schemes showing "
        "that language’s answers. Questions in AQA’s pseudo-code are the same in all three.")
NOISE = re.compile(r"\*\d{2}\*|IB/[A-Z]/[^\s]+|Turn over ►?")


def series_label(s):
    return "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + 6


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8525"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in mine:
        words = NOISE.sub(" ", p["text"])
        own = own_text(words, p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(p["id"].rsplit("-", 1)[0] if p["part"] else p["id"], p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", words + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
               "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = [c for c in PAPERS if any(r["p"] == c for r in rows)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "Computer Science", "specs": ["8525"], "note": NOTE,
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False, **({"option": PAPERS[c][2]} if PAPERS[c][2] else {})}
                   for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "options": OPTIONS,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)
    for c in comps:
        print(f"  {c}: " + ", ".join(f"{s} {sum(1 for r in rows if r['p'] == c and r['s'] == s)}" for s in series), file=sys.stderr)


if __name__ == "__main__":
    main()
