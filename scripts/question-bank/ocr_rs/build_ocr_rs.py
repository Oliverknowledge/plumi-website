"""Write the OCR A-Level Religious Studies bank's data files from the cut questions and their topic tags.

    python3 scripts/question-bank/ocr_rs/build_ocr_rs.py

ocr_law/build_ocr_law.py's sibling, in the same shapes. Reads, in .work/ocr-rs: parts.json
(cut_ocr_rs.py), spec.json (spec_ocr_rs.py), manifest.json (fetch_ocr_rs.py) and tags.json
(tag_ocr_rs.py merge). Writes:
  src/content/questionBank/ocr-a-level-religious-studies.json      topics, papers, series, the newest 20 questions
  public/question-bank/ocr-a-level-religious-studies/parts.json    the whole list, fetched by the browser
  public/question-bank/ocr-a-level-religious-studies/text.json     search text, fetched when someone types
  public/question-bank/ocr-a-level-religious-studies/reports.json  examiners' reports, by question id
and .work/ocr-rs/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-H573-01-QP-JUN24.pdf, the library's naming), for upload_r2.py --pdf-prefix=ocr/.

Component 3 is five papers, one per religion, H573/03 (Christianity) to H573/07 (Hinduism), named
"Paper 3 (Christianity)" and so on. As in eduqas_rs/build_eduqas_rs.py, each carries its `option`,
and so does its religion's section of the topics, so the page's Religion filter keeps a student's
own religion and the two papers everyone sits. Essays: no calculations (noCalc). Each question has
its own report (reportsBy "question").
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "ocr-rs")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, slug  # noqa: E402

SLUG = "ocr-a-level-religious-studies"
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)
# The examiners' reports' running header: "A Level Religious Studies - H573/01 - Summer 2024 Examiners’ report".
# A page's header can also come out without its second line, at a paragraph's end: "A Level Religious Studies - H573/06 - Summer2024".
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,90}?Examiners[’']? report|© OCR \d{4}"
                           r"|A Level Religious Studies - H573/0\d - (?:Summer|Autumn|November|October) ?\d{4}")
OPTIONS = {"h57303": "C", "h57304": "I", "h57305": "J", "h57306": "B", "h57307": "H"}
PAPERS = {"h57301": ("Paper 1", "Philosophy of religion"), "h57302": ("Paper 2", "Religion and ethics"),
          "h57303": ("Paper 3 (Christianity)", "Developments in Christian thought"),
          "h57304": ("Paper 3 (Islam)", "Developments in Islamic thought"),
          "h57305": ("Paper 3 (Judaism)", "Developments in Jewish thought"),
          "h57306": ("Paper 3 (Buddhism)", "Developments in Buddhist thought"),
          "h57307": ("Paper 3 (Hinduism)", "Developments in Hindu thought")}
NOTE = ("OCR publishes these papers from November 2021 on; the earlier series, from the first exams in June 2018, are for "
        "teachers only. Everyone sits Papers 1 and 2, and one Paper 3, set for the religion studied: pick yours with the "
        "Religion filter. Each paper sets four essays and asks for any three.")


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def own_words(p):
    """The question's own words: no number ("1*") and no marks ("[40]")."""
    t = OCR_BOILER.sub(" ", p.get("own") or p["text"])
    return re.sub(r"\s+", " ", re.sub(r"\s*\[\d{1,2}\]\s*", " ", re.sub(r"^\s*\d{1,2}\*?\s*", "", t))).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H573"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
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
        if not p.get("qp") or p["h"] <= 0:
            continue
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own_words(p)[:160]}
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
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    names = {s["code"]: s["title"] for s in tree["sections"]}
    used, topics = set(), []
    for t in tree["topics"]:
        s = slug(t["title"])
        if s in used:
            s = slug(f"{names[t['section']]} {t['title']}")
        used.add(s)
        topics.append({"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": s,
                       "count": counts.get(t["code"], 0), "year": t["year"]})
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    religions = [s for s in tree["sections"] if s["code"] in OPTIONS.values()]
    meta = {
        "slug": SLUG, "board": "OCR", "level": "A-Level", "subject": "Religious Studies", "specs": ["H573"], "noCalc": True, "reportsBy": "question",
        "note": NOTE,
        "sections": [{"code": s["code"], "title": s["title"], **({"option": s["code"]} if s in religions else {})} for s in tree["sections"]],
        "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False, **({"option": OPTIONS[c]} if c in OPTIONS else {})} for c in comps],
        "options": {"label": "Religion", "list": [{"id": s["code"], "name": s["title"]} for s in religions]},
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
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{len(reports)} reports, papers {comps}, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
