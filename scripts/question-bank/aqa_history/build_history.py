"""Write the AQA A-Level History bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_history/build_history.py [work-dir]   # default scripts/question-bank/.work/aqa-history

build_rs.py for History, in the same shapes (src/content/questionBank/aqa-a-level-history.json
and public/question-bank/aqa-a-level-history/{parts,text,reports}.json). What differs:
  - The topic tree is spec_history.py's: one section per option, its periods as topics.
  - Every paper is one option's (70421H is Component 1H, Tsarist and Communist Russia), and
    carries its `option`, as does its section, so the Option filter keeps a student's own
    papers and periods. No paper is sat by everyone.
  - Question 01's extracts or sources are its stem (`st`), shown above it, and searched with it.
  - Each paper's marks: Question 01 is worth 30 and each of the other three 25, of which a
    student answers two, for the paper's 80.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-history")
SLUG = "aqa-a-level-history"


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7042"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    names = {s["code"]: s["title"] for s in tree["sections"]}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports, off = [], {}, {}, []
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", re.sub(r"\[\d+ marks?\]", "", own)).strip()[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        if p["marks"] != (30 if p["question"] == "01" else 25):
            off.append((p["id"], p["marks"]))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", " ".join([p.get("stemText", ""), p["text"], p.get("msText", "")])).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], r["l"]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": 0}
              for t in tree["topics"]]
    # Two options can have a period of the same name ("The coming of war"): its address names the option.
    for t in topics:
        if sum(1 for u in topics if u["slug"] == t["slug"]) > 1:
            t["slug"] = slug(f"{t['section']} {t['title']}")
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "History", "specs": ["7042"],
        "sections": [s for s in tree["sections"] if any(c[4:] == s["code"] for c in comps)],
        "topics": [t for t in topics if any(c[4:] == t["section"] for c in comps)],
        "papers": [{"id": c, "name": f"Component {c[4:]}", "title": names[c[4:]], "as": False, "option": c[4:]} for c in comps],
        "options": {"label": "Option", "list": [{"id": s["code"], "name": f"{s['code']} {s['title']}"} for s in tree["sections"] if any(c[4:] == s["code"] for c in comps)]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
        "noCalc": True, "reportsBy": "question",
        "note": "Every Component 1 and 2 option (Component 3 is a non-exam assessment). Pick your option to see its questions and periods; "
                "Question 01’s extracts or sources are shown above it. Where AQA’s copy of a paper leaves an extract or source out for copyright, its note says where it came from.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {sum(1 for r in rows if r.get('st'))} with sources, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {len(comps)} papers, {len({(r['p'], r['s']) for r in rows})} sittings"
          + (f"; marks off: {off}" if off else "; every question's marks as the paper sets them")
          + f"; topics with no questions: {[t['code'] for t in meta['topics'] if not t['count']]}", file=sys.stderr)


if __name__ == "__main__":
    main()
