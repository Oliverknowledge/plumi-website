"""Write the Pearson Edexcel A-Level English Literature bank's data files from the cut questions.

    python3 scripts/question-bank/edexcel_english_lit/build_english_lit.py

aqa_english_lit/build_english_lit.py for Pearson's papers, in the same shapes. Reads .work/edexcel-english-lit's
parts.json (cut_english_lit.py) and manifest.json (fetch_english_lit.py), and writes:
  src/content/questionBank/edexcel-a-level-english-literature.json      topics, papers, series, the newest 20 questions
  public/question-bank/edexcel-a-level-english-literature/parts.json    the whole list, fetched by the browser
  public/question-bank/edexcel-a-level-english-literature/text.json     search text
  public/question-bank/edexcel-a-level-english-literature/reports.json  examiner's reports, by question id
The topics are the set texts (texts.py), and each question's tag is the text the cutter read from its heading:
no tagging pass. The whole papers it links to are the past paper library's copies on R2 (edexcel/EDX-9ET0-01-QP-JUN24.pdf),
uploaded with it (scripts/past-papers/upload.py), so the bank's upload is its crops only (upload_r2.py --crops-only).

build() is shared with ocr_english_lit/build_english_lit.py.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import texts  # noqa: E402

MONTH = {"JUN": "June", "OCT": "October", "NOV": "November"}
BOILERPLATE = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\*P\d+\w*\*|© OCR \d{4}|\.{6,}", re.I)
PAPERS = {"9et001": ("Paper 1", "Drama"), "9et002": ("Paper 2", "Prose"), "9et003": ("Paper 3", "Poetry"),
          "8et001": ("AS Paper 1", "Poetry and drama"), "8et002": ("AS Paper 2", "Prose")}
NOTE = ("Pearson publishes these papers from the first exams (AS June 2016, A-Level June 2017) to June 2025. Each paper asks about "
        "every set text, prose theme or poetry collection, so the topics here are those: pick the ones you studied. Paper 3's "
        "Section A compares an unseen poem, printed in the source booklet, with a poem from Poems of the Decade.")


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + {"JUN": 6, "OCT": 10, "NOV": 11}[s[:3]]


def label_order(label):
    m = re.match(r"(\d+)(?:\(([a-c])\))?", label)
    return (int(m.group(1)), m.group(2) or "")


def own_words(text, label):
    """The question's own words: after its number (and part), up to its marks."""
    t = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", text)).strip()
    q, part = label_order(label)
    m = re.search(rf"(?<!\d){q}\s+(.*)", t)
    t = m.group(1) if m else t
    if part:
        m = re.search(rf"\({part}\)\s*(.*)", t)
        t = m.group(1) if m else t
    return re.split(r"\(Total for Question|\[\d+\]", t)[0].strip()


def build(slug, board, subject_name, specs, spec, papers, note, work, is_as, extra=None):
    parts = json.load(open(os.path.join(work, "parts.json")))
    manifest = json.load(open(os.path.join(work, "manifest.json")))
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er", "ins"):
            wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
    valid = {code for _, _, ts in spec for code, _, _ in ts}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or p["h"] <= 0:
            continue
        comp = p["component"].replace("-", "")
        row = {"id": p["id"], "p": comp, "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [p["text_code"]] if p["text_code"] in valid else [], "w": p["w"], "h": p["h"],
               "x": own_words(p["text"], p["label"])[:160]}
        if p["or"]:
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    assert len({r["id"] for r in rows}) == len(rows), "two questions share an id"
    order = list(papers)
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), label_order(r["l"])))
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    sections = [{"code": code, "title": title} for code, title, _ in spec]
    topics = [{"code": code, "ref": "", "title": title, "section": sec, "slug": code, "count": counts.get(code, 0), "year": 0}
              for sec, _, ts in spec for code, title, _ in ts if counts.get(code)]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = [c for c in order if any(r["p"] == c for r in rows)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": slug, "board": board, "level": "A-Level", "subject": subject_name, "specs": specs,
        "sections": [s for s in sections if any(t["section"] == s["code"] for t in topics)], "topics": topics,
        "papers": [{"id": c, "name": papers[c][0], "title": papers[c][1], "as": is_as(c)} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "noCalc": True, "reportsBy": "question",
        "note": note,
        **(extra or {}),
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    marks = sorted({(k[0], v) for k, v in totals.items()})
    print(f"{slug}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('st'))} with a stem, {len(reports)} reports, {sum(1 for r in rows if r.get('or'))} alternatives, "
          f"papers {comps}, {len(series)} series; marks answered per paper {marks}", file=sys.stderr)


def main():
    build("edexcel-a-level-english-literature", "Edexcel", "English Literature", ["9ET0", "8ET0"], texts.SPEC, PAPERS, NOTE,
          os.path.join(HERE, "..", ".work", "edexcel-english-lit"), lambda c: c.startswith("8et0"))


if __name__ == "__main__":
    main()
