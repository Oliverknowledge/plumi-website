"""Write the AQA GCSE Religious Studies bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_gcse_rs/build_gcse_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-rs

Reads <work-dir>/parts.json (cut_gcse_rs.py), spec.json (spec_gcse_rs.py), manifest.json
(fetch_gcse_rs.py) and tags.json (tag_gcse_rs.py merge); writes
src/content/questionBank/aqa-gcse-religious-studies.json and
public/question-bank/aqa-gcse-religious-studies/{parts,text,reports}.json, in the shapes of the
AQA GCSE Geography and Eduqas GCSE Religious Studies banks:
  - Each religion's Component 1 paper carries its religion as an `option`, and so do its two
    sections, so the bank's "Religion" filter keeps a student's paper and topics with Component 2's.
  - Paper 2B is its St Mark's Gospel questions (07, 08); its themes A-F are 2A's, shown once there.
  - A multiple-choice part carries its letter ("k") as well as its scheme crop.
  - Essays and short answers: no calculations (noCalc). Reports are by question.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-rs")
SLUG = "aqa-gcse-religious-studies"
OPTION = {"806211": "bu", "806212": "ca", "806213": "ch", "806214": "hi", "806215": "is", "806216": "ju", "806217": "si"}
PAPERS = {"80622A": ("Paper 2A", "Thematic studies"), "80622B": ("Paper 2B", "Textual studies: St Mark's Gospel")}
NOTE = ("Every religion's Component 1 paper, Paper 2A's themes A to F and Paper 2B's St Mark's Gospel themes. "
        "Pick your religion to keep its paper with Component 2. Paper 2B's themes A to F are 2A's questions, so they are shown once, under 2A.")


def own(p):
    """The part's own words, from its label ("0 1 . 3") to its marks."""
    m = re.search(r"0\s*\d\s*\.\s*\d\s+(.*)", p["text"])
    words = m.group(1) if m else p["text"]
    marks = re.search(r"\[\d+ marks?\]", words)
    return re.sub(r"\s+", " ", words[:marks.start()] if marks else words).strip()


def paper_rank(comp):
    return list(OPTION).index(comp) if comp in OPTION else len(OPTION) + list(PAPERS).index(comp)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8062"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    names = {o["id"]: o["name"] for o in tree["options"]}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        words = own(p)
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("ms"):
            row["ms"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", p["text"] + " " + p.get("msText", "")).lower()
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_rank(r["p"]), [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    sections = {s["code"]: s for s in tree["sections"]}
    seen = {}
    for t in tree["topics"]:
        seen[t["title"].lower()] = seen.get(t["title"].lower(), 0) + 1
    topics = []
    for t in tree["topics"]:
        option = sections[t["section"]].get("option")
        title = t["title"] if seen[t["title"].lower()] == 1 else f"{t['title']} ({names.get(option) or sections[t['section']]['title']})"
        topics.append({"code": t["code"], "ref": "", "title": title, "section": t["section"], "slug": slug(title),
                       "count": counts.get(t["code"], 0), "year": 0})
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    assert all(len(t["slug"]) < 70 for t in topics), [t["slug"] for t in topics if len(t["slug"]) >= 70]
    comps = sorted({r["p"] for r in rows}, key=paper_rank)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    papers = [{"id": c, "name": "Paper 1", "title": names[OPTION[c]], "as": False, "option": OPTION[c]} if c in OPTION
              else {"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "Religious Studies", "specs": ["8062"],
        "sections": [{"code": s["code"], "title": s["title"], **({"option": s["option"]} if s.get("option") else {})} for s in tree["sections"]],
        "topics": topics, "papers": papers,
        "options": {"label": "Religion", "list": tree["options"]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
        "noCalc": True, "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('k'))} multiple-choice keys, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{len(papers)} papers, {len(topics)} topics ({sum(1 for t in topics if not t['count'])} empty), series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
