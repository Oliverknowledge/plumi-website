"""Write the Edexcel GCSE Spanish bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/edexcel_gcse_spanish/build_gcse_spanish.py [work-dir]

Reads <work-dir>/parts.json (cut_gcse_spanish.py), manifest.json (fetch_gcse_spanish.py) and tags.json (tag_gcse_spanish.py merge). Writes
src/content/questionBank/edexcel-gcse-spanish.json and public/question-bank/edexcel-gcse-spanish/{parts,text,reports}.json, in the AQA GCSE languages
banks' shapes:
  - Papers come in two tiers, named so ("Paper 3 Reading Higher"), for the tier links and tiers.py. 1SP0's Listening is Paper 1 and 1SP1's Paper 2, as Pearson numbers them.
  - Two specifications: the 2018 to 2025 papers (1SP0) and the sample papers for the new one (1SP1), told apart by each paper's title, the series
    "2026 specimen" and the bank's "Specification" filter.
  - A Listening part carries its own question's recording ("au", edexcel/audio/<file>.mp3 on R2).
  - A choice of writing tasks marks its alternatives "or"; each paper's parts, a choice counted once, must add up to its marks.
  - A report Pearson didn't write (its one-paragraph "insufficient entries" notice) isn't linked.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-spanish")
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import clean_report, series_label, series_rank, slug  # noqa: E402
from spec_gcse_spanish import tree as spec_tree  # noqa: E402

SLUG = "edexcel-gcse-spanish"
OLD, NEW = "1sp0", "1sp1"
SKILL = {"1": "Listening", "2": "Listening", "3": "Reading", "4": "Writing"}
TIER = {"h": "Higher", "f": "Foundation"}
NOTE = ("Pearson changed GCSE Spanish for exams from summer 2026: the new specification (1SP1) has new themes, set vocabulary lists, a read-aloud, a dictation in the Listening paper "
        "and new writing tasks. Most questions here are from the 2018 to 2025 papers (1SP0), still good practice for reading, listening and writing; the new format is in Pearson's sample papers, "
        "marked \"2026 specimen\" (pick it with the Specification filter). Pearson keeps the June 2026 papers for teachers only. Listening questions play Pearson's own recording. "
        "The Speaking paper is left out, as its role-plays and photo cards are marked by a teacher.")
BOILERPLATE = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\(Total for Question \d+ = \d+ marks?\)|\.{3,}|…{2,}")


def paper_for(comp):
    n, tier = comp[4], comp[5]
    return {"id": comp, "name": f"Paper {n} {SKILL[n]} {TIER[tier]}", "title": "2026 format" if comp[:4] == NEW else "2018 to 2025 format", "as": False, "option": comp[:4]}


def paper_order(comp):
    """Old specification first, then Listening, Reading, Writing, Higher before Foundation."""
    return (comp[:4] == NEW, "LRW".index(SKILL[comp[4]][0]), comp[5] != "h")


def own_words(p):
    """A part's own words for its row: no title, number or label, no answer lines."""
    t = BOILERPLATE.sub(" ", p["own"])
    if p["title"] and t.startswith(p["title"]):
        t = t[len(p["title"]):]
    t = re.sub(r"^\s*\d{1,2}\b\s*", "", t)
    t = re.sub(r"^\s*(\([a-z]{1,4}\)\s*)+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def rank(s):
    return 0 if s == "SPEC" else series_rank(s)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json")))
    tree = spec_tree()
    valid = {t["code"] for t in tree["topics"]}
    mine = [p for p in parts if p.get("qp") and p["h"]]
    series_cut = {(p["component"], p["series"]) for p in mine}
    wholes = {}
    for f in manifest:
        comp = f["component"].replace("-", "")
        if f.get("file") and f["kind"] in ("qp", "ms", "er", "tr") and (comp, f["series"]) in series_cut:
            if f["kind"] == "er" and not any(p.get("er") for p in mine if p["component"] == comp and p["series"] == f["series"]):
                continue  # "insufficient entries": no report
            wholes.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    rows, text, reports = [], {}, {}
    for p in mine:
        t = [c for c in tags.get(p["id"], []) if c in valid]
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": t, "w": p["w"], "h": p["h"], "x": own_words(p)[:160]}
        if p.get("or"):
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("msq"):
            row["msq"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        if p.get("audio"):
            row["au"] = f"edexcel/audio/{p['audio']}"
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower()).strip()
    order = lambda l: [(int(a) if a.isdigit() else a) for a in re.findall(r"\d+|[a-z]+", l)]  # noqa: E731
    rows.sort(key=lambda r: (-rank(r["s"]), paper_order(r["p"]), [(0, x, "") if isinstance(x, int) else (1, 0, x) for x in order(r["l"])]))
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
               "slug": slug(t.get("short") or t["title"]), "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=paper_order)
    series = sorted({r["s"] for r in rows}, key=rank, reverse=True)
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "Spanish", "specs": [OLD.upper(), NEW.upper()],
        "sections": tree["sections"], "topics": topics,
        "papers": [paper_for(c) for c in comps],
        "series": [{"id": s, "label": "2026 specimen" if s == "SPEC" else series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items())},
        "options": {"label": "Specification", "list": [{"id": NEW, "name": "From 2026 (1SP1)"}, {"id": OLD, "name": "2018 to 2025 (1SP0)"}]},
        "noCalc": True,
        "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    path = os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    if os.path.exists(path):  # keep what upload_data.py wrote until it runs again
        old = json.load(open(path))
        if old.get("data"):
            meta["data"] = old["data"]
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for name, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{name}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    off = {k: v for k, v in totals.items() if v != {"L": 50, "R": 50, "W": 60 if k[0][:4] == OLD else 50}[SKILL[k[0][4]][0]]}
    print(f"{SLUG}: {len(rows)} parts in {len(totals)} papers, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('ms'))} scheme crops "
          f"({sum(1 for r in rows if r.get('msq'))} whole-question), {sum(1 for r in rows if r.get('k'))} keys, {sum(1 for r in rows if r.get('au'))} with audio, "
          f"{sum(1 for r in rows if not r.get('ms') and not r.get('k'))} without a scheme" + (f"; marks off: {off}" if off else "; every paper's marks add up"), file=sys.stderr)
    empty = [t["code"] for t in topics if not t["count"]]
    print(f"topics with no parts: {empty}", file=sys.stderr)


if __name__ == "__main__":
    main()
