"""Write the AQA A-Level Law bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_law/build_law.py [work-dir]   # default scripts/question-bank/.work/aqa-law

build_sociology.py for Law: the same rows and files
(src/content/questionBank/aqa-a-level-law.json and
public/question-bank/aqa-a-level-law/{parts,text,reports}.json). What differs:
  - The topic tree is spec_law.py's: the nature of law, law making, the legal system,
    criminal law, tort, contract and human rights as sections.
  - Paper 3 is two papers, 3A (Contract) and 3B (Human rights), and a student sits one:
    the bank's `options` ("Option": Contract, Human rights) carry them, and each option's
    paper and section carry its id, so the page filters to the one a student studies.
  - Questions 01-05 are multiple choice: each carries its answer letter ("k") in place
    of a scheme crop.
Every question is answered, so each paper's marks add up to 100.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-law")
SLUG = "aqa-a-level-law"
PAPERS = {"71621": ("Paper 1", "Criminal law and the legal system", None), "71622": ("Paper 2", "Tort and law and society", None),
          "71623A": ("Paper 3A", "Contract and the nature of law", "contract"), "71623B": ("Paper 3B", "Human rights and the nature of law", "human-rights")}
OPTIONS = [{"id": "contract", "name": "Contract"}, {"id": "human-rights", "name": "Human rights"}]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7162"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    sittings = {(p["component"], p["series"]) for p in parts}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er") and (f["component"], f["series"]) in sittings:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("ms"):
            row["ms"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], int(r["l"])))
    totals = {}
    for r in rows:
        totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != 100}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Law", "specs": ["7162"],
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False, **({"option": PAPERS[c][2]} if PAPERS[c][2] else {})} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items())},
        "options": {"label": "Option", "list": OPTIONS},
        "reportsBy": "question", "noCalc": True,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('k'))} multiple choice, "
          f"papers {comps}" + (f"; marks off: {off}" if off else "; every paper's marks add up"), file=sys.stderr)


if __name__ == "__main__":
    main()
