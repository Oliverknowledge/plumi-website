"""Write the OCR GCSE Design and Technology (J310) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_gcse_dt/build_ocr_gcse_dt.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-dt

ocr_gcse_classics/build_ocr_gcse_classics.py for J310, writing the same shapes to src/content/questionBank/
ocr-gcse-design-and-technology.json and public/question-bank/ocr-gcse-design-and-technology/{parts,text,reports}.json.
Reads, in the work dir: parts.json (cut_ocr_gcse_dt.py), spec.json (spec_ocr_gcse_dt.py), manifest.json
(fetch_ocr_gcse_dt.py) and tags.json (tag_ocr_gcse_dt.py merge). What J310 adds:
  - one written paper, J310/01, so one paper and no options; its Insert is in `wholes` ("ins") and is the stem ("st") of
    questions 4 to 6 (cut_ocr_gcse_dt.py);
  - a calculation is flagged ("calc"), as the AQA D&T bank does;
  - the topics are the specification's numbered enquiries ("5.2"), shown with the bank's short titles.
Writes <work-dir>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-J310-01-INS-JUN24.pdf), for upload_r2.py --pdf-prefix=ocr/.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-dt")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, MONTH, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-gcse-design-and-technology"
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The reports' running header: "GCSE (9-1) Design and Technology - J310/01 - Summer 2023 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level 1/Level 2 )?GCSE \(9-1\)(?: in)? Design and Technology - J310/01 - Summer \d{4}\s+Examiners[’']? report(?:\s+\d{1,2}\s+© OCR \d{4})?|© OCR \d{4}")
PAPERS = {"j31001": ("Principles of Design and Technology", "J310/01")}


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J310"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    have = {f"{p['component']}-{p['series']}" for p in parts}
    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    os.makedirs(os.path.join(WORK, "r2", "img"), exist_ok=True)  # (upload_r2.py reads both; the crops go up from the work dir)
    wholes = {}
    for f in manifest:
        key = f"{f['component'].replace('-', '')}-{f['series']}"
        if f["kind"] == "err" or key not in have:
            continue  # the erratum is shown with its question; a paper with no scheme is left out
        wholes.setdefault(key, {})[f["kind"]] = f["r2"]
        shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(f["r2"])))
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(OCR_BOILER.sub(" ", p["text"]), p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(REPORT_HEADER.sub("", p["er"])))
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"],
               "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "GCSE", "subject": "Design and Technology",
        "specs": ["J310"], "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('st'))} with a stem, {len(reports)} reports, {len(wholes)} papers, "
          f"papers {comps}, series {series}, marks missing on {sum(1 for r in rows if r['m'] is None)}", file=sys.stderr)


if __name__ == "__main__":
    main()
