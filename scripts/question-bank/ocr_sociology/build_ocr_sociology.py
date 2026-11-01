"""Write the OCR A-Level Sociology bank's data files (or, with --psychology, Psychology's) from the cut
questions and their topic tags.

    python3 scripts/question-bank/ocr_sociology/build_ocr_sociology.py [--psychology]

ocr_law/build_ocr_law.py's sibling, in the same shapes. Reads, in .work/ocr-sociology (or ocr-psychology):
parts.json (cut_ocr_sociology.py / cut_ocr_psychology.py), spec.json (spec_ocr_*.py), manifest.json
(fetch_ocr_*.py) and tags.json (tag_ocr_sociology.py merge). Writes:
  src/content/questionBank/<slug>.json      topics, papers, options, series, the newest 20 questions
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports, by question id
and .work/<subject>/r2/pdf/: the whole papers it links to, under the names they're uploaded as
(ocr/OCR-H580-01-QP-JUN24.pdf, the library's naming), for upload_r2.py --pdf-prefix=ocr/.

The options: a student answers one of Sociology Paper 1's and one of Paper 3's three, and two of
Psychology Paper 3's four. Each option's questions are a paper of their own, "Paper 3 (Child
psychology)", h56703chi (the paper's code and the option's first letters), carrying its `option`, so
the Option filter and the multi-paper filter both pick a student's; the sections everyone answers keep
the paper's own code. Each option paper links the whole paper. The source questions are named for the
block they share ("h58002-jun24-e1-03"), so reports are keyed by question (reportsBy "question").
Neither subject has calculations to filter (noCalc), Psychology's statistics aside.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PSY = "--psychology" in sys.argv
NAME, SPEC = ("psychology", "H567") if PSY else ("sociology", "H580")
WORK = os.path.join(HERE, "..", ".work", f"ocr-{NAME}")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = f"ocr-a-level-{NAME}"
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}|Your answer", re.I)
REPORT_HEADER = re.compile(r"(?:OCR Level \d Advanced (?:Subsidiary )?GCE in |A Level |AS Level )[^\n]{0,90}?Examiners[’']? report|© OCR \d{4}")
PAPERS = {
    "h56701": ("Paper 1", "Research methods"), "h56702": ("Paper 2", "Psychological themes through core studies"),
    "h56703": ("Paper 3", "Applied psychology: Issues in mental health"),
    "h58001": ("Paper 1", "Socialisation, culture and identity: Section A"), "h58002": ("Paper 2", "Researching and understanding social inequalities"),
    "h58003": ("Paper 3", "Debates in contemporary society: Globalisation and the digital social world"),
}
NOTE = {
    "psychology": "OCR publishes these papers from November 2021; earlier series are for teachers only. In Paper 3 you answer "
                  "two of the four options: pick yours with the Option filter or the paper filter. Where OCR left a source out of "
                  "its published paper for copyright (Paper 2's article in June 2024 and June 2025), the question says so.",
    "sociology": "OCR publishes these papers from November 2021; earlier series are for teachers only. You answer one option "
                 "in Paper 1 and one in Paper 3: pick yours with the Option filter or the paper filter. Where OCR left a source "
                 "out of its published paper for copyright, the source questions say so.",
}[NAME]


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tree, option_names = spec[SPEC], {o["id"]: o["name"] for o in spec["options"]}
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    r2_dir = os.path.join(WORK, "r2", "pdf")
    shutil.rmtree(r2_dir, ignore_errors=True)
    os.makedirs(r2_dir)
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
        shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(r2_dir, os.path.basename(f["r2"])))
    # The option an option's first word names: "families", "child", "criminal".
    option_id = {re.match(r"\w+", n.lower()).group(0): i for i, n in option_names.items()}
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports, papers = [], {}, {}, {}
    for p in parts:
        if not p.get("qp") or p["h"] <= 0:
            continue
        comp, opt = p["component"], option_id.get(p.get("option") or "")
        paper = f"{comp}{opt[:3]}" if opt else comp
        if opt:
            papers[paper] = (f"{PAPERS[comp][0]} ({re.sub(r' [(]Paper [13][)]$', '', option_names[opt])})", re.sub(r" [(]Paper [13][)]$", "", option_names[opt]), opt)
            wholes[f"{paper}-{p['series']}"] = wholes.get(f"{comp}-{p['series']}", {})
        else:
            papers[paper] = (*PAPERS[comp], None)
        own = own_text(OCR_BOILER.sub(" ", p.get("own") or p["text"]), p["label"])
        own = re.sub(r"\s*\[\d{1,2}\]\s*", " ", re.sub(r"^\s*(\d{1,2})?\*?\s*(\([a-z]\)\*?)?\s*", "", own))  # its marks, "[8]", and an essay's "7*"
        row = {"id": p["id"], "p": paper, "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("key"):
            row["k"] = p["key"]
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{comp}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{comp}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = clean_report(REPORT_HEADER.sub("", p["er"]))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two questions share an id"
    order = sorted(papers, key=lambda c: (c[:6], c != c[:6], c))
    rank = {c: n for n, c in enumerate(order)}
    rows.sort(key=lambda r: (-series_rank(r["s"]), rank[r["p"]], label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    used = {papers[c][2] for c in order if papers[c][2]}
    meta = {
        "slug": SLUG, "board": "OCR", "level": "A-Level", "subject": NAME.capitalize(), "specs": [SPEC], "noCalc": True, "reportsBy": "question",
        "note": NOTE,
        "sections": tree["sections"], "topics": topics,
        "papers": [{"id": c, "name": papers[c][0], "title": papers[c][1], "as": False, **({"option": papers[c][2]} if papers[c][2] else {})} for c in order],
        "options": {"label": "Option", "list": [{"id": i, "name": n} for i, n in option_names.items() if i in used]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in papers},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    per = {c: sum(1 for r in rows if r["p"] == c) for c in order}
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('k'))} keys, {sum(1 for r in rows if r.get('st'))} with a stem, {len(reports)} reports, series {series}; {per}", file=sys.stderr)


if __name__ == "__main__":
    main()
