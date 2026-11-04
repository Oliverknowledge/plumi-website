"""Write the OCR A-Level Business (H431, H031) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_business/build_ocr_business.py [work-dir]   # default scripts/question-bank/.work/ocr-business

ocr_gcse_economics/build_ocr_gcse_economics.py for Business, writing the same shapes to
src/content/questionBank/ocr-a-level-business.json and public/question-bank/ocr-a-level-business/{parts,text,reports}.json.
Reads, in the work dir: parts.json (cut_ocr_business.py), spec.json (spec_ocr_business.py), manifest.json
(fetch_ocr_business.py) and tags.json (tag_ocr_business.py merge).
  - Section A's multiple-choice parts carry their letter ("k") as well as their row of the scheme, which gives the reasoning;
  - a part set on the Resource Booklet is marked "src", and its paper's whole booklet is `ins` in `wholes`, so the part links to it;
  - a question with no parts has the case study as its stem ("st", h43101-jun24-stem.webp); one with parts its own opening words;
  - reports are keyed by question ("h43101-jun24-18"), each part showing its own paragraphs of it.
Writes <work-dir>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-H431-01-QP-JUN24.pdf), for upload_r2.py --pdf-prefix=ocr/.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-business")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, MONTH, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-a-level-business"
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}|Your answer", re.I)
# The reports' running header: "A Level Business - H431/01 - Summer 2024 Examiners’ report" or "OCR Level 3 Advanced GCE in
# Business - …", its page number and "© OCR 2024". And what points at a candidate's script we can't show: "(see Exemplar 1,
# below)", "Exemplar 2 demonstrates…", and the "OCR support" label over a tip that stands without it.
REPORT_HEADER = re.compile(r"(?:OCR Level 3 Advanced GCE in Business|(?:AS |A )Level Business)\s*[-–]\s*H[04]31/0\d\s*[-–]\s*(?:Summer|Autumn) \d{4}\s*Examiners[’']? report(?:\s*\d{1,2})?|© OCR \d{4}|\bOCR support\b")
EXEMPLAR_NOTE = re.compile(r"\s*\(see Exemplar \d[^)]*\)|(?:(?<=[.:!?•])|^)[^.:!?•\n]*\bExemplars? \d[^.\n]*\.?", re.M)
PAPERS = {"h43101": ("Paper 1", "Operating in a local business environment", False), "h43102": ("Paper 2", "The UK business environment", False),
          "h43103": ("Paper 3", "The global business environment", False), "h03101": ("AS Paper 1", "The local business environment", True),
          "h03102": ("AS Paper 2", "The wider business environment", True)}
KINDS = {"qp": "qp", "ms": "ms", "er": "er", "rb": "ins"}


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H431"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[KINDS[f["kind"]]] = f["r2"]
        shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(f["r2"])))
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or p["h"] <= 0:
            continue
        own = own_text(OCR_BOILER.sub(" ", p.get("own") or p["text"]), p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("case"):
            row["src"] = 1
        # (June 2025's H431/01 report heads some multiple-choice questions over nothing but a chart: no comment, no report)
        report = clean_report(EXEMPLAR_NOTE.sub("", REPORT_HEADER.sub("", p.get("er") or ""))).strip()
        if re.sub(r"Question \d{1,2}\S*\s*", "", report).strip():
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", report)
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two parts share an id"
    assert all(r.get("ms") or r.get("k") for r in rows), "a part without a scheme"
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": "", "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = [c for c in PAPERS if any(r["p"] == c for r in rows)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "A-Level", "subject": "Business", "specs": ["H431", "H031"],
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": PAPERS[c][2]} for c in comps],
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
          f"{sum(1 for r in rows if r.get('st'))} with a stem, {sum(1 for r in rows if r.get('k'))} keys, {sum(1 for r in rows if r.get('src'))} on the booklet, "
          f"{len(reports)} reports, {sum(1 for r in rows if r.get('er'))} parts with a report, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
