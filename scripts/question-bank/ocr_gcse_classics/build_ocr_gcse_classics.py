"""Write the OCR GCSE Classical Civilisation (J199) bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_gcse_classics/build_ocr_gcse_classics.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-classics

ocr_gcse_geography/build_ocr_gcse_geography.py for Classical Civilisation, writing the same shapes to
src/content/questionBank/ocr-gcse-classical-civilisation.json and public/question-bank/ocr-gcse-classical-civilisation/
{parts,text,reports}.json. Reads, in the work dir: parts.json (cut_ocr_gcse_classics.py), spec.json
(spec_ocr_gcse_classics.py), manifest.json (fetch_ocr_gcse_classics.py) and tags.json (tag_ocr_gcse_classics.py merge).
What Classical Civilisation adds:
  - a student sits one thematic study and one literature and culture component: each is a paper and an option, with its
    topics as a section of that option, and the bank's `options` are the six pairs a student can take, each standing for
    its two (BankOption.takes);
  - a question works from its sources, printed in the paper's insert ("ins" in `wholes`), as its stem ("st");
  - a question with no parts is one row labelled "4" (id "j19921-jun24-04-q");
  - the topics are the specification's key topics, with codes of the bank's own, not shown.
Sets with no scheme (June 2025's Roman City Life and War and Warfare) have no parts, and are left out of `wholes`.
Writes <work-dir>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-J199-11-INS-JUN24.pdf), for upload_r2.py --pdf-prefix=ocr/.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-classics")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, MONTH, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "ocr-gcse-classical-civilisation"
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The reports' running header: "GCSE (9-1) Classical Civilisation - J199/11 - Summer 2023 Examiners’ report".
REPORT_HEADER = re.compile(r"(?:OCR Level 1/Level 2 )?GCSE \(9-1\)(?: in)? Classical Civilisation - J199/\d\d - Summer \d{4}\s+Examiners[’']? report(?:\s+\d{1,2}\s+© OCR \d{4})?|© OCR \d{4}")
# id: (name, title, option). The component's own name is what a student knows it by, and what a question's card shows.
PAPERS = {"j19911": ("Myth and Religion", "J199/11", "myth"), "j19912": ("Women in the Ancient World", "J199/12", "women"),
          "j19921": ("The Homeric World", "J199/21", "homeric"), "j19922": ("Roman City Life", "J199/22", "roman"),
          "j19923": ("War and Warfare", "J199/23", "war")}
THEMATIC = [("myth", "Myth and Religion"), ("women", "Women in the Ancient World")]
CULTURE = [("homeric", "The Homeric World"), ("roman", "Roman City Life"), ("war", "War and Warfare")]


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J199"]
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
        "slug": SLUG, "board": "OCR", "level": "GCSE", "subject": "Classical Civilisation",
        "specs": ["J199"], "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False, "option": PAPERS[c][2]} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "options": {"label": "Your components", "list": [{"id": f"{a}-{b}", "name": f"{an} + {bn}", "takes": [a, b]} for a, an in THEMATIC for b, bn in CULTURE]},
        "noCalc": True,
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
