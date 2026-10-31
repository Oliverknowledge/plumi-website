"""Write the AQA A-Level Religious Studies bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_rs/build_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-rs

build_philosophy.py for Religious Studies, in the same shapes
(src/content/questionBank/aqa-a-level-religious-studies.json and
public/question-bank/aqa-a-level-religious-studies/{parts,text,reports}.json). What differs:
  - The topic tree is spec_rs.py's: Paper 1's two sections, then one per religion.
  - Paper 2 is set once per religion (70622A Buddhism ... 70622E Judaism): each carries its
    `option`, as do its religion's sections, and the bank its `options`, so the page offers
    the Religion filter Eduqas Religious Studies has, keeping a student's own religion and
    Paper 1, which everyone sits.
  - Every question has parts ("01.1"), and each part has its own examiner's comment: reports
    are keyed by part id (reportsBy "question").
  - Each paper's marks must add up to its 100; Paper 2 counts one essay of each either/or pair.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-rs")
SLUG = "aqa-a-level-religious-studies"
# Paper 2's sections B and C each offer a choice of two essays (03 or 04, 05 or 06): one of each counts.
SECOND_CHOICE = {"04", "06"}


def paper_for(comp, names):
    """'70621' -> Paper 1, everyone's; '70622B' -> {name: 'Paper 2B', title: 'Christianity', option: 'B'}."""
    if comp == "70621":
        return {"id": comp, "name": "Paper 1", "title": "Philosophy of religion and ethics", "as": False}
    return {"id": comp, "name": f"Paper 2{comp[-1]}", "title": names[comp[-1]], "as": False, "option": comp[-1]}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7062"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    names = {s["code"]: s["title"] for s in tree["sections"]}

    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", re.sub(r"\[\d+ marks?\]", "", own)).strip()[:160]}
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], r["l"]))
    totals = {}
    for r in rows:
        if not (r["p"] != "70621" and r["l"][:2] in SECOND_CHOICE):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != 100}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = []
    for t in tree["topics"]:
        # Every religion has a "Sources of wisdom and authority": its address names the religion.
        religion = names[t["section"]] if t["section"] in names and len(t["section"]) == 1 else ""
        s = slug(t["title"] if religion.lower() in t["title"].lower() else f"{religion} {t['title']}")
        topics.append({"code": t["code"], "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": t["year"]})
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Religious Studies", "specs": ["7062"],
        "sections": tree["sections"], "topics": topics,
        "papers": [paper_for(c, names) for c in comps],
        "options": {"label": "Religion", "list": [{"id": s["code"], "name": s["title"]} for s in tree["sections"] if s.get("option")]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
        "noCalc": True, "reportsBy": "question",
        "note": "AQA no longer publishes the June 2017 to June 2019 papers, so they aren’t here.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"papers {comps}, {len(totals)} sittings" + (f"; marks off: {off}" if off else "; every paper's marks add up to 100")
          + f"; topics with no questions: {[t['code'] for t in topics if not t['count']]}", file=sys.stderr)


if __name__ == "__main__":
    main()
