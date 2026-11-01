"""Write the OCR A-Level History A bank's data files from the cut questions and their topic tags.

    python3 scripts/question-bank/ocr_history/build_ocr_history.py

ocr_law/build_ocr_law.py's sibling, in the same shapes. Reads, in .work/ocr-history: parts.json
(cut_ocr_history.py), spec.json (spec_ocr_history.py), manifest.json (fetch_ocr_history.py) and
tags.json (tag_ocr_history.py merge). Writes:
  src/content/questionBank/ocr-a-level-history-a.json      topics, papers, series, the newest 20 questions
  public/question-bank/ocr-a-level-history-a/parts.json    the whole list, fetched by the browser
  public/question-bank/ocr-a-level-history-a/text.json     search text, fetched when someone types
  public/question-bank/ocr-a-level-history-a/reports.json  examiner's reports, by question
and .work/ocr-history/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-Y101-01-QP-JUN24.pdf, the library's naming), for upload_r2.py --pdf-prefix=ocr/.

Each unit is a paper ("Y106 · England 1485–1558: the Early Tudors") and a topic area of its key
topics. A student sits one unit from each of three groups, so the bank's `options` are the groups,
"Unit group" (as Eduqas GCSE History's "Study"): picking one keeps its units' papers and topics, and
the paper filter then picks the student's own units, several at once. A unit with no papers (Y211)
is left out. History has no calculations: the filter is left out (noCalc).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "ocr-history")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-a-level-history-a"
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}|Y\d{3}/01 (Jun|Nov)\d\d", re.I)
# The examiners' reports' running header: "A Level History A - Y101/01 - Summer 2024 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,120}?Examiners[’']? report|© OCR \d{4}")
GROUPS = [{"id": "1", "name": "Unit 1: British period study and enquiry"}, {"id": "2", "name": "Unit 2: Non-British period study"},
          {"id": "3", "name": "Unit 3: Thematic study and historical interpretations"}]
NOTE = ("OCR publishes these papers from November 2021 on. Each unit is a paper: pick your unit group, then your own units "
        "under Paper. Source and interpretation questions show their sources or passages with the question; where OCR's "
        "published paper leaves a source out for copyright, so does this one. The topic-based essay (coursework) has no paper.")


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H505"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
            shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(f["r2"])))
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or p["h"] <= 0:
            continue
        own = own_text(OCR_BOILER.sub(" ", p["text"]), p["label"])
        own = re.sub(r"\s*\[\d{1,2}\]\s*", " ", re.sub(r"^\s*(\d{1,2})?\*?\s*(\([a-z]\)\*?)?\s*", "", own))  # its marks, "[20]", and an essay's "2*"
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports[f"{p['set']}-{p['question']}"] = clean_report(REPORT_HEADER.sub("", p["er"]))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two questions share an id"
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    comps = sorted({r["p"] for r in rows})
    units = {c[:4].upper() for c in comps}
    sections = [s for s in tree["sections"] if s["code"] in units]
    titles = [t["title"] for t in tree["topics"] if t["section"] in units]
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"],
               # a key topic two units share ("Religious changes", Y106 and Y107) takes its unit in its address
               "slug": slug(t["title"]) + (f"-{t['section'].lower()}" if titles.count(t["title"]) > 1 else ""),
               "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"] if t["section"] in units]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    title_of = {s["code"]: s["title"] for s in tree["sections"]}
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "A-Level", "subject": "History", "fullName": "History A", "specs": ["H505"], "noCalc": True,
        "note": NOTE,
        "options": {"label": "Unit group", "list": GROUPS},
        "sections": [{"code": s["code"], "title": f"{s['code']} {s['title']}", "option": s["code"][1]} for s in sections], "topics": topics,
        "papers": [{"id": c, "name": c[:4].upper(), "title": title_of[c[:4].upper()], "as": False, "option": c[1]} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{len(reports)} reports, {len(comps)} units, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
