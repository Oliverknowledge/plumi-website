"""Write the OCR Cambridge National in Engineering Manufacture (J823) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_cn_engineering/build_ocr_cn_engineering.py [work-dir]   # default scripts/question-bank/.work/ocr-cn-engineering

ocr_gcse_cs/build_ocr_gcse_cs.py for J823's exam unit, R014, writing the same shapes to
src/content/questionBank/ocr-cn-engineering-manufacture.json and
public/question-bank/ocr-cn-engineering-manufacture/{parts,text,reports}.json. Reads, in the work dir:
parts.json (cut_ocr_cn_engineering.py), spec.json (spec_ocr_cn_engineering.py), manifest.json
(fetch_ocr_cn_engineering.py) and tags.json (tag_ocr_cn_engineering.py merge). One paper; January and June
series; the sample paper is a series of its own ("SPEC"), listed last. A multiple-choice question (Section A)
carries its letter ("k") as well as its scheme crop. Writes <work-dir>/r2/pdf/: the whole papers it links to,
under the names they're uploaded as (ocr/OCR-R014-01-QP-JUN24.pdf, the library's naming), for upload_r2.py --pdf-prefix=ocr/.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-cn-engineering")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-cn-engineering-manufacture"
MONTH = {"JAN": "January", "JUN": "June"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The reports' running header: "OCR Level 1/Level 2 Cambridge National in Engineering Manufacture - R014 - Summer 2025 Examiners’ report"
# (January 2024 without "OCR ").
REPORT_HEADER = re.compile(r"(?:OCR )?Level 1/Level 2 Cambridge National in Engineering Manufacture - R014 - (?:January|Summer) \d{4}\s*Examiners[’']? report|© OCR \d{4}")
PAPERS = {"r01401": ("R014", "Principles of engineering manufacture")}


def series_label(s):
    return "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + (6 if s.startswith("JUN") else 1)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["R014"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}

    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
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
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(REPORT_HEADER.sub("", p["er"])))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
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
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "Level 1/2", "subject": "Engineering Manufacture",
        "fullName": "Cambridge National in Engineering Manufacture", "specs": ["J823", "R014"],
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "noCalc": True,
        "note": "These are the exam unit R014's questions; R015 and R016 are assessed by coursework, with no papers. "
                "OCR keeps its 2023 papers for schools on Teach Cambridge.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('k'))} keys, {len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
