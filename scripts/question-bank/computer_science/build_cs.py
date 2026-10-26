"""Write the OCR and AQA A-Level Computer Science banks' data files from the cut parts and their tags.

    python3 scripts/question-bank/computer_science/build_cs.py

build_ocr.py and build_psychology.py for Computer Science, in the same shapes. Reads, in
.work/ocr-cs and .work/aqa-cs: parts.json (cut_ocr_cs.py, cut_aqa_cs.py), spec.json
(spec_cs.py), manifest.json (fetch_ocr_cs.py, fetch_aqa_cs.py) and tags.json (tag_cs.py merge).
Writes, per bank:
  src/content/questionBank/<slug>.json      topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports, by question
and <work-dir>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(OCR's under ocr/ as the library names them, OCR-H446-01-QP-JUN24.pdf; AQA's under aqa/,
AQA-75171-QP-JUN24.pdf), for upload_r2.py.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, ".."))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text as own_pearson, slug  # noqa: E402
from build_bank import own_text as own_aqa  # noqa: E402

MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The examiners' reports' running header, as build_ocr.py reads it: "OCR Level 3 Advanced GCE in Computer Science - H446/01 - Summer 2025 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,90}?Examiners[’']? report|© OCR \d{4}")
PAPERS = {
    "h44601": ("Paper 1", "Computer systems"), "h44602": ("Paper 2", "Algorithms and programming"),
    "h04601": ("AS Paper 1", "Computing principles"), "h04602": ("AS Paper 2", "Algorithms and problem solving"),
    "75171": ("Paper 1", "On-screen: theory and programming task (Sections A–B)"), "75172": ("Paper 2", "Written paper"),
    "75161": ("AS Paper 1", "On-screen: theory and programming task (Section A)"), "75162": ("AS Paper 2", "Written paper"),
}
AQA_NOTE = ("Paper 1 is sat on screen around a Skeleton Program AQA gives schools before the exam: its written questions and its "
            "programming task are here; the questions on the Skeleton Program, which can’t be answered without it, are left out.")
# AQA's scheme crops were cut again under the same names, ending at their own row (26 October 2026):
# above questionBank.ts's MS_VERSION (2), so browsers fetch them anew. See partImage.
AQA_CROP_VERSION = 3
BANKS = [
    dict(work="ocr-cs", slug="ocr-a-level-computer-science", board="OCR", spec="H446", specs=["H046", "H446"], as_prefix="h046"),
    dict(work="aqa-cs", slug="aqa-a-level-computer-science", board="AQA", spec="7517", specs=["7516", "7517"], as_prefix="7516", note=AQA_NOTE, crop_version=AQA_CROP_VERSION),
]


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def wholes_for(bank, manifest, r2_dir):
    """{"h44601-JUN24": {"qp": "ocr/OCR-H446-01-QP-JUN24.pdf", ...}}, each file staged in r2_dir under its key's name."""
    out = {}
    for f in manifest:
        if f["kind"] not in ("qp", "ms", "er"):
            continue
        if bank["board"] == "OCR":
            comp, key = f["component"].replace("-", ""), f["r2"]
        else:
            comp, key = f["component"], f"aqa/{f['file']}"
        out.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = key
        shutil.copyfile(os.path.join(WORK, bank["work"], "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(key)))
    return out


def build(bank):
    d = os.path.join(WORK, bank["work"])
    parts = json.load(open(os.path.join(d, "parts.json")))
    tree = json.load(open(os.path.join(d, "spec.json")))[bank["spec"]]
    manifest = json.load(open(os.path.join(d, "manifest.json")))
    tags = json.load(open(os.path.join(d, "tags.json"))) if os.path.exists(os.path.join(d, "tags.json")) else {}
    r2_dir = os.path.join(d, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = wholes_for(bank, manifest, r2_dir)
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {t["code"] for t in tree["topics"]}
    ocr = bank["board"] == "OCR"
    rows, text, reports = [], {}, {}
    for p in mine:
        comp = p["component"]
        words = OCR_BOILER.sub(" ", p["text"]) if ocr else p["text"]
        own = own_pearson(words, p["label"]) if ocr else own_aqa(words, p["label"])
        row = {"id": p["id"], "p": comp, "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{comp}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{comp}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            if ocr:
                reports.setdefault(f"{p['set']}-{p['question']}", clean_report(REPORT_HEADER.sub("", p["er"])))
            else:
                reports.setdefault(p["id"].rsplit("-", 1)[0] if p["part"] else p["id"], p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    is_as = lambda c: c.startswith(bank["as_prefix"])  # noqa: E731
    order = (lambda l: label_order(l)) if ocr else (lambda l: [int(x) for x in l.split(".")])  # noqa: E731
    rows.sort(key=lambda r: (-series_rank(r["s"]), is_as(r["p"]), r["p"], order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
               "slug": slug(t["title"]), "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (is_as(c), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": bank["slug"], "board": bank["board"], "level": "A-Level", "subject": "Computer Science", "specs": bank["specs"],
        **({"cropVersion": bank["crop_version"]} if bank.get("crop_version") else {}),
        **({"note": bank["note"]} if bank.get("note") else {}),
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": is_as(c)} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{bank['slug']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", bank["slug"])
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{bank['slug']}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    for b in BANKS:
        build(b)
