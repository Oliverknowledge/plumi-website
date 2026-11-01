"""Write the Edexcel GCSE History bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_gcse_history/build_gcse_history.py [work-dir]

Reads <work-dir>/parts.json (cut_gcse_history.py), spec.json (spec_gcse_history.py), manifest.json
(fetch_gcse_history.py) and tags.json (tag_gcse_history.py merge). Writes
src/content/questionBank/edexcel-gcse-history.json and public/question-bank/edexcel-gcse-history/
{parts,text,reports}.json, in edexcel_sciences/build_pearson.py's shapes, with eduqas_gcse/
build_eduqas_gcse.py's options:
  - Every option is a paper of its own ("Option 10", "Option P4"), and the bank's `options` filter, "Study",
    keeps one kind of study: Paper 1's thematic studies, Paper 2's period studies and British depth studies,
    Paper 3's modern depth studies. Its sections (the options) carry theirs, so the topic list follows it;
    a student picks their own options under Paper.
  - The sources and interpretations a question names are its stem (`st`), shown above it.
  - June 2018's Paper 2 parts are filed under the options sat since (cut_gcse_history.py): their whole
    paper is the paired one they were set in ("1hi0-20-qp-jun18.pdf" for P1, B1 and B2).
  - A report Pearson didn't write (a one-page "will not publish" notice, for papers with few entries) isn't linked.
  - Essays: no calculations (noCalc). Reports are by question (a question's parts share one).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-history")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import clean_report, series_label, series_rank, slug  # noqa: E402

SLUG = "edexcel-gcse-history"
STUDIES = [("thematic", "Thematic study and historic environment (Paper 1)"), ("period", "Period study (Paper 2)"),
           ("british", "British depth study (Paper 2)"), ("modern", "Modern depth study (Paper 3)")]
BOILER = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\(Total for (Question \d+|spelling, punctuation[^)]*) = \d+ marks?\)|\*P\d{5}A\d+\*", re.I)
NOTE = ("Every option of Papers 1, 2 and 3. Pick a kind of study, or pick your own options under Paper; "
        "the sources and interpretations a question uses are shown above it. June 2018's Paper 2 set a period study and a "
        "British depth study in one paper: its questions are filed under each option.")


def own(text):
    """A part's own words: no label ("2 (a)"), no marks, no totals."""
    text = BOILER.sub(" ", text)
    text = re.sub(r"\(\d{1,2}\)", "", text)
    text = re.sub(r"^\d{1,2}\s*", "", text.strip())
    text = re.sub(r"^\([a-e]\)\s*(\((?:i|ii|iii)\)\s*)?", "", text)
    text = re.sub(r"^\((?:i|ii|iii)\)\s*", "", text)
    return re.sub(r"\s+", " ", text).strip()


def placeholder(path):
    import pymupdf  # noqa: PLC0415

    return bool(re.search(r"will not publish an Examiner", "".join(page.get_text() for page in pymupdf.open(path)), re.I))


def asked(p):
    """A part's own words (cut_gcse_history.py's `ask`): its `text` puts the sources it carries first."""
    return p.get("ask") or p["text"]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    sections = {s["code"]: s for s in tree["sections"]}
    order = list(sections)
    rank = lambda comp: order.index(comp[4:].upper())  # noqa: E731
    files = {}
    for f in manifest:
        if f["kind"] == "er" and placeholder(os.path.join(WORK, "pdf", f["file"])):
            continue  # "Pearson will not publish an Examiner's Report for this paper": no report to link
        files.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    wholes = {}
    for p in parts:
        key = f"{p['component']}-{p['series']}"
        wholes.setdefault(key, files.get(f"1hi0{p['paired']}-{p['series']}" if p.get("paired") else key, {}))
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        words = own(asked(p))
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("or"):
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        rows.append(row)
        scheme = re.sub(r"· (\d)", r"\1", p.get("msText", ""))  # a levels grid's level, kept from reading as a label
        text[p["id"]] = re.sub(r"\s+", " ", BOILER.sub(" ", " ".join([asked(p), p["text"], scheme]))).lower()
    rows.sort(key=lambda r: (-series_rank(r["s"]), rank(r["p"]), int(re.match(r"\d+", r["l"]).group()), r["l"]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics, used = [], set()
    for t in tree["topics"]:
        # Paper 1's periods share their dates across options ("c1500–c1700: …"): the title tells them apart
        s = slug(t["title"])
        assert s not in used and len(s) < 90, s
        used.add(s)
        topics.append({"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": s,
                       "count": counts.get(t["code"], 0), "year": 0})
    comps = sorted({r["p"] for r in rows}, key=rank)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "History", "specs": ["1HI0"],
        "sections": [{"code": s["code"], "title": s["title"], "option": s["option"]} for s in tree["sections"]],
        "topics": topics,
        "papers": [{"id": c, "name": f"Option {c[4:].upper()}", "title": sections[c[4:].upper()]["title"], "as": False,
                    "option": sections[c[4:].upper()]["option"]} for c in comps],
        "options": {"label": "Study", "list": [{"id": k, "name": v} for k, v in STUDIES]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if v and k.split("-")[1] in series},
        "noCalc": True,
        "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('st'))} with sources, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('er'))} with report comments ({len(reports)} questions), "
          f"{sum(1 for r in rows if r.get('or'))} choices, {len(comps)} papers, {len(topics)} topics, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
