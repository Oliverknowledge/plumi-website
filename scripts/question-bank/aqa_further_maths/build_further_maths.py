"""Write the AQA A-Level Further Maths bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_further_maths/build_further_maths.py [work-dir]   # default scripts/question-bank/.work/aqa-further-maths

build_maths.py for Further Maths: the same rows and files (src/content/questionBank/aqa-a-level-further-maths.json
and public/question-bank/aqa-a-level-further-maths/{parts,text,reports}.json). What differs: the topics are
spec_further_maths.py's (the specification's lettered sections, A Proof to J Numerical methods, then MA-ME,
SA-SH and DA-DG), the AS papers (7366) sit beside the A-Level's marked `as`, as in the other Further Maths
banks, and a student takes two of the three options (Mechanics, Statistics, Discrete) on Paper 3 and AS
Paper 2: each option's papers and topics carry it, and the bank's `options` are the three pairs, for the
option filter.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-further-maths")
SLUG = "aqa-a-level-further-maths"
OPTION = {"M": "Mechanics", "S": "Statistics", "D": "Discrete"}
# In the order the filter lists them: the A-Level's, then the AS's. Titles are AQA's component codes.
PAPERS = [("73671", "Paper 1", "7367/1", False), ("73672", "Paper 2", "7367/2", False),
          *[(f"73673{o}", f"Paper 3 {n}", f"7367/3{o}", False) for o, n in OPTION.items()],
          ("73661", "AS Paper 1", "7366/1", True),
          *[(f"73662{o}", f"AS Paper 2 {n}", f"7366/2{o}", True) for o, n in OPTION.items()]]
OPTIONS = {"label": "Options", "list": [{"id": a + b, "name": f"{OPTION[a]} and {OPTION[b]}", "takes": [a, b]} for a, b in ("MS", "MD", "SD")]}


def own_text(p):
    """The question's words, after its number."""
    return re.sub(r"\s+", " ", BOILERPLATE.sub(" ", re.sub(rf"^{int(p['question'])}\s+", "", p["text"]))).strip()


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
    order = [c for c, *_ in PAPERS]
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own_text(p)[:160]}
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    # `ref` is the code AQA prints ("C Matrices", "MB Momentum and collisions"); codes are the same.
    topics = [{"code": t["code"], "ref": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in spec["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = {r["p"] for r in rows}
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    papers = [{"id": c, "name": name, "title": title, "as": as_, **({"option": c[-1]} if c[-1] in OPTION else {})}
              for c, name, title, as_ in PAPERS if c in comps]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Further Maths", "specs": ["7367", "7366"],
        "sections": spec["sections"], "topics": topics, "papers": papers,
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "options": OPTIONS, "note": "The AS papers (7366) are here too, marked AS. Pick the two options you take to see only their papers and topics.",
        "noCalc": True, "reportsBy": "question",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, papers {sorted(comps)}", file=sys.stderr)


if __name__ == "__main__":
    main()
