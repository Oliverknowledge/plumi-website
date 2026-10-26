"""Write the AQA A-Level Maths bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_maths/build_maths.py [work-dir]   # default scripts/question-bank/.work/aqa-maths

build_bank.py for Maths: the same rows and files (src/content/questionBank/aqa-a-level-maths.json
and public/question-bank/aqa-a-level-maths/{parts,text,reports}.json). What differs: the
topics are spec_maths.py's (the specification's lettered sections, A Proof to S Moments,
under Pure, Statistics and Mechanics), labels are printed "9(a)(ii)", and, as in the
other maths banks, every part is a calculation (`noCalc`).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-maths")
SLUG = "aqa-a-level-maths"
PAPERS = {"73571": "Pure mathematics", "73572": "Pure mathematics and mechanics", "73573": "Pure mathematics and statistics"}
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6}


def label_order(label):
    """'9(a)(ii)' -> (9, 'a', 2), so 10 follows 9 and (ii) follows (i)."""
    q, a, r = re.fullmatch(r"(\d+)(?:\(([a-h])\))?(?:\(([ivx]+)\))?", label).groups()
    return int(q), a or "", ROMAN.get(r or "", 0)


def own_text(p):
    """The part's own words: after its label ("9 (a) (ii)"), past any opening carried above it."""
    text = p["text"]
    q, a, r = label_order(p["label"])
    pat = rf"\b{q}\s*" + (rf"\(\s*{a}\s*\)\s*" if a else "") + (rf"\(\s*{p['label'].rsplit('(', 1)[1].rstrip(')')}\s*\)\s*" if r else "")
    hits = list(re.finditer(pat, text)) if a else []
    words = text[hits[-1].end():] if hits else re.sub(rf"^{q}\s+", "", text)
    return re.sub(r"\s+", " ", BOILERPLATE.sub(" ", words)).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    assert all(n == 1 for n in seen.values()), [k for k, n in seen.items() if n > 1]
    valid = {t["code"] for t in spec["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own_text(p)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    # `ref` is the letter AQA prints ("B Algebra and functions"); codes are the same letters.
    topics = [{"code": t["code"], "ref": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in spec["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Maths", "specs": ["7357"],
        "sections": spec["sections"], "topics": topics,
        "papers": [{"id": c, "name": f"Paper {c[-1]}", "title": PAPERS[c], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "noCalc": True,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('st'))} with a stem, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
