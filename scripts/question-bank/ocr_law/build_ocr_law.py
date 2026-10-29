"""Write the OCR A-Level Law bank's data files from the cut questions and their topic tags.

    python3 scripts/question-bank/ocr_law/build_ocr_law.py

ocr_economics/build_ocr_economics.py's sibling, in the same shapes. Reads, in .work/ocr-law:
parts.json (cut_ocr_law.py), spec.json (spec_ocr_law.py), manifest.json (fetch_ocr_law.py) and
tags.json (tag_ocr_law.py merge). Writes:
  src/content/questionBank/ocr-a-level-law.json      topics, papers, series, the newest 20 questions
  public/question-bank/ocr-a-level-law/parts.json    the whole list, fetched by the browser
  public/question-bank/ocr-a-level-law/text.json     search text, fetched when someone types
  public/question-bank/ocr-a-level-law/reports.json  examiner's reports, by question id
and .work/ocr-law/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-H418-01-QP-JUN24.pdf, the library's naming), for upload_r2.py --pdf-prefix=ocr/.

Component 3 is two papers, one per option: H418/03 (human rights) and H418/04 (contract), named
"Paper 3 (Human rights)" and "Paper 3 (Contract)" so the paper filter picks a student's option;
their topics are the "Paper 3 options" (year 3). The scenario questions are named for the block
they share ("h41801-jun24-p1-05"), so reports are keyed by question (reportsBy "question").
Law has no calculations: the filter is left out (noCalc).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "ocr-law")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-a-level-law"
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The examiners' reports' running header: "A Level Law - H418/01 - Summer 2024 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,90}?Examiners[’']? report|© OCR \d{4}")
PAPERS = {"h41801": ("Paper 1", "The legal system and criminal law"), "h41802": ("Paper 2", "Law making and the law of tort"),
          "h41803": ("Paper 3 (Human rights)", "The nature of law and human rights"),
          "h41804": ("Paper 3 (Contract)", "The nature of law and the law of contract"),
          "h01801": ("AS Paper 1", "The legal system and criminal law"), "h01802": ("AS Paper 2", "Law making and the law of tort")}
NOTE = ("OCR publishes these papers from June 2022, the specification's first exams. Paper 3 comes in two versions, one for each "
        "option, human rights or contract law: pick yours with the paper filter or the Paper 3 options topics. Both versions "
        "share Section A, the nature of law, and each paper's Section B sets the same essay in Part 1 and Part 2, so those "
        "questions appear more than once.")


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H418"]
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
        own = own_text(OCR_BOILER.sub(" ", p.get("own") or p["text"]), p["label"])
        own = re.sub(r"\s*\[\d{1,2}\]\s*", " ", re.sub(r"^\s*(\d{1,2})?\*?\s*", "", own))  # its marks, "[8]", and an essay's "7*"
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
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
            reports[p["id"]] = clean_report(REPORT_HEADER.sub("", p["er"]))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two questions share an id"
    is_as = lambda c: c.startswith("h018")  # noqa: E731
    rows.sort(key=lambda r: (-series_rank(r["s"]), is_as(r["p"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (is_as(c), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "A-Level", "subject": "Law", "specs": ["H018", "H418"], "noCalc": True, "reportsBy": "question",
        "note": NOTE,
        "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": is_as(c)} for c in comps],
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
          f"{sum(1 for r in rows if r.get('st'))} with a scenario, {len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
