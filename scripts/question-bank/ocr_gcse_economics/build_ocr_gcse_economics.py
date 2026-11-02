"""Write the OCR GCSE Economics (J205) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_gcse_economics/build_ocr_gcse_economics.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-economics

ocr_gcse_geography/build_ocr_gcse_geography.py for Economics, writing the same shapes to
src/content/questionBank/ocr-gcse-economics.json and public/question-bank/ocr-gcse-economics/{parts,text,reports}.json.
Reads, in the work dir: parts.json (cut_ocr_gcse_economics.py), spec.json (spec_ocr_gcse_economics.py),
manifest.json (fetch_ocr_gcse_economics.py) and tags.json (tag_ocr_gcse_economics.py merge).
  - Section A's multiple-choice parts carry their letter ("k") as well as their row of the key table;
  - Section B's parts carry their question's extract as their stem ("st");
  - reports are keyed by question ("j20501-jun24-21"), each part showing its own paragraphs of it.
Writes <work-dir>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-J205-01-QP-JUN24.pdf), for upload_r2.py --pdf-prefix=ocr/.
June 2022 Paper 1's question 17 is left out: OCR's post-exam correction withdraws it ("Cross out all of
question 17 and do not attempt to answer it"), its scheme gives the mark whatever the answer, and the report
says every candidate had it "due to the potential of a misleading answer".
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-economics")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, MONTH, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-gcse-economics"
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}|Your answer", re.I)
# The reports' running header: "GCSE (9-1) Economics - J205/01 - Summer 2024 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level 1/Level 2 )?GCSE \(9-1\)(?: in)? Economics - J205/0\d - (?:Summer|Autumn) \d{4}\s*Examiners[’']? report|© OCR \d{4}")
WITHDRAWN = {"j20501-jun22-17"}
PAPERS = {"j20501": ("Paper 1", "Introduction to economics"), "j20502": ("Paper 2", "National and international economics")}


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J205"]
    manifest = [f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["kind"] in ("qp", "ms", "er")]
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
        shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(f["r2"])))
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or p["h"] <= 0 or p["id"] in WITHDRAWN:
            continue
        own = own_text(OCR_BOILER.sub(" ", p.get("own") or p["text"]), p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(REPORT_HEADER.sub("", p["er"])))
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two parts share an id"
    assert all(r.get("ms") or r.get("k") or r.get("msf") for r in rows), "a part without a scheme"
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "GCSE", "subject": "Economics", "specs": ["J205"],
        "sections": tree["sections"], "topics": topics,
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
          f"{sum(1 for r in rows if r.get('st'))} with a stem, {sum(1 for r in rows if r.get('k'))} keys, {len(reports)} reports, "
          f"papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
