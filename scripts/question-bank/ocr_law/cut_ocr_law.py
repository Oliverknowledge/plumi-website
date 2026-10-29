"""Cut OCR's A-Level and AS Law papers into questions, each paired with its mark scheme.

    python3 scripts/question-bank/ocr_law/cut_ocr_law.py [work-dir] [--only=h41801-jun24]
    # work-dir: .work/ocr-law (fetch_ocr_law.py); needs: pip install pymupdf pillow

OCR's Law papers are typeset like its other papers, so edexcel_sciences/cut_pearson.py does the
work, used here as a library, unchanged. What differs is set here, for this run only:
  - the questions are whole: no parts, and no answer lines (candidates write in an answer booklet);
  - the scenarios. Each A-Level Section B is "Choose Part 1 or Part 2", and each Part opens with two
    unrelated scenarios, then three questions: two "Advise…" questions on the scenarios and an
    essay. The AS Section B opens with one scenario ("Read the scenario.") and asks four questions,
    two of them "Advise…". The block, from its heading ("Part 1", "Read the scenario.") to its first
    question, is the stem of each "Advise…" question in it; the "Explain…" and essay questions, which
    the paper says aren't about it, have none. A question's crop stops at the next block, rubric
    ("Answer Question 3 or Question 4.") or section, so Question 7 doesn't run on into Part 2, and
    then at the line its marks end ("…accurate.  [20]"), not the next Part's heading or the copyright page. The
    scenario questions are named for their block, "h41801-jun24-p1-05", so they share its stem,
    "h41801-jun24-p1-stem.webp" (questionBank.ts partImage); the AS's one block is "sc";
  - the mark schemes. Section A is a table with a row per question, but Section B's schemes are
    pages of indicative content and level grids under a heading ("5. Advise whether Kobe…", "5",
    "7* and 10*"), numbered lists of points among them. So a question's scheme is found by its own
    words: the first line from where the last question's scheme began that carries its number at the
    page's left and, there or on the lines under it, the question's opening words (else, failing
    that, its bare number). It runs to the next question's, the "Section B" heading, the
    assessment-objectives grid or OCR's back page. A scheme that says only "see Question 7 above"
    (the second Part's essay, which is the first Part's again) is Question 7's;
  - "Answer Question 1 or Question 2" (and CHOICE's other wordings): the second of a choice is marked `or`;
  - the examiners' reports' headings "Question 7*" read as "Question 7", and "Question 7* and
    Question 10*" as a report on both; OCR's back pages ("Supporting you") are left out. The second
    Part's essay takes the first's report where OCR reports on it only once.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <component>-<series>-[<block>-]<question>: "h41801-jun24-02".
"""
import os, re, sys, types

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-law"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402  (reads the work dir and --only from the command line)

SECTION = re.compile(r"^(SECTION|Section) [A-C]\b")
BLOCK = re.compile(r"^(Part [12]|Read the scenarios?( and answer all the questions)?\.?)$")
RUBRIC = re.compile(r"^Answer (Question \d{1,2} or Question \d{1,2}|one question from questions \d)")
# "Answer Question 1 or Question 2." (2023 on), "Answer one question from questions 1–2." (June 2022), and the
# nature of law's "Answer one question using examples from your full course of study." over Questions 1 and 2.
CHOICE = re.compile(r"Answer Question (\d{1,2}) or Question (\d{1,2})|Answer one question from questions (\d{1,2})\s*[–-]\s*(\d{1,2})|Answer (one) question (using) examples")
ADVISE = re.compile(r"^\*?\d{1,2}\*?\s*(\[\d{1,2}\]\s*)?Advise\b")
# "As per question 7", "see Question 7 above", "SEE ABOVE FOR Q5*", "SAME QUESTION AND MARK SCHEME AS QUESTION 7"
SEE = re.compile(r"(?:see|as per|as)\s+(?:above\s+for\s+)?(?:Question|Q)\s*(\d{1,2})", re.I)
# Where a scheme stops: the next section, the assessment-objectives grid, OCR's back page.
MS_END = re.compile(r"^(Section [AB]|SECTION [AB]|Assessment Objectives? Grid|Need to get in touch\?|BLANK PAGE)\s*$")


_frame = cp.frame


def frame(page):
    """Below the page number OCR centres at the top, as ocr_economics/cut_ocr_economics.py."""
    f = _frame(page)
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    number = [s for s in spans if re.fullmatch(r"\d{1,2}", s["text"].strip()) and s["bbox"][1] < 50
              and abs((s["bbox"][0] + s["bbox"][2]) / 2 - page.rect.width / 2) < 30]
    if f.y0 < 58 and number:
        first = min((s["bbox"][1] for s in spans if s not in number and s["bbox"][1] > number[0]["bbox"][1] - 2), default=59)
        f = pymupdf.Rect(f.x0, min(59, first - 1), f.x1, f.y1)
    return f


def markers(doc, end_page):
    """[(page, y, kind, below)]: where a question's crop stops ("section", "block", "rubric"), in reading
    order; `below`, where a block starting there begins."""
    if not hasattr(doc, "_law_markers"):
        out = []
        for i in range(1, end_page + 1):
            for l in doc.lines(i):
                t = l["text"].strip()
                if SECTION.match(t):
                    out.append((i, l["y0"], "section", l["y1"] + 7))
                elif BLOCK.match(t):
                    out.append((i, l["y0"], "block", l["y0"] - 2))
                elif RUBRIC.match(t):
                    out.append((i, l["y0"], "rubric", l["y0"] - 2))
        doc._law_markers = out
    return doc._law_markers


_region = cp.region


def region(doc, start, end, end_page):
    """A question's region also ends where a block, rubric or section starts."""
    nxt = next(((pg, y) for pg, y, *_ in markers(doc, end_page) if (pg, y) > (start[0], start[1] + 1)), None)
    if nxt and (end is None or nxt < tuple(end)):
        end = nxt
    return _region(doc, start, end, end_page)


# ---------- mark schemes ----------

QWORDS = {}  # question -> its opening words, set by cut_set for the paper being cut


def words(s):
    return re.findall(r"[a-z]+", s.lower().replace("’", "'"))


def says(lines, k, want):
    """Do the line at k and the few under it open with the question's words (most of its first six)?"""
    got = words(re.sub(r"^\s*(Question\s*|Q)?\d{1,2}\*?\.?\s*((and|&|or|/)\s*\d{1,2}\*?)?", "", lines[k]["text"]))
    for l in lines[k + 1:k + 8]:
        got += words(l["text"])
        if len(got) > 40:
            break
    head = want[:6]
    return bool(head) and head[0] in got[:3] and sum(w in got[:40] for w in head) >= min(4, len(head))


def page_box(doc, i):
    """A scheme page inside its running header ("H418/01  Mark Scheme  June 2024") and its page number.
    (cut_pearson's ms_page_box keeps to a page's ruled table, and Section B's headings sit above theirs.)"""
    w, h = doc[i].rect.width, doc[i].rect.height
    lines = doc.lines(i)
    running = re.compile(r"[A-Z]\d{3}/\d\d|Mark Scheme|(June|November) \d{4}|\d{1,3}")
    head = [l["y1"] for l in lines if l["y0"] < 60 and running.fullmatch(l["text"].strip())]
    foot = [l["y0"] for l in lines if l["y0"] > h - 70 and running.fullmatch(l["text"].strip())]
    return pymupdf.Rect(20, max(head) - 2 if head else 30, w - 20, min(foot) - 4 if foot else h - 40)


def ms_tables(doc):
    """{(q, None, None): (pieces, text, None)}: each question's scheme, from its heading to the next one's."""
    lines = {i: doc.lines(i) for i in range(len(doc))}
    starts, at = {}, (0, -1)
    for q in sorted(QWORDS):
        label = re.compile(rf"^(Question\s*|Q)?{q}\*?(\s*[.:&/]|\s+|$)")
        found = bare = None
        for i in range(at[0], len(doc)):
            box = page_box(doc, i)
            for k, l in enumerate(lines[i]):
                if (i, l["y0"]) <= at or l["x0"] > 110 or not label.match(l["text"].strip()) or not box.y0 - 3 <= l["y0"] <= box.y1:
                    continue
                if says(lines[i], k, QWORDS[q]):
                    found = (i, l["y0"])
                    break
                if bare is None and re.fullmatch(rf"(Question\s*|Q)?{q}\*?(\s*(and|&|/)\s*\d{{1,2}}\*?)?\.?(\s*-?\s*(see|as per) Question \d{{1,2}}.*)?", l["text"].strip()):
                    bare = (i, l["y0"])
            if found:
                break
        start = found or bare
        if start:
            starts[q] = start
            at = start
    for q, (pg, y) in starts.items():
        # the table's header row ("Question  Answer  Marks  Guidance") just above a Section A row comes with it
        head = [l["y0"] for l in lines[pg] if y - 34 < l["y0"] < y - 2 and re.fullmatch(r"(Question|Answer|Marks|Guidance|Marks Guidance)", l["text"].strip())]
        starts[q] = (pg, max(min(head + [y]) - 4, page_box(doc, pg).y0))
    out, order = {}, sorted(starts.items(), key=lambda kv: kv[1])
    for n, (q, (pg, y)) in enumerate(order):
        end = order[n + 1][1] if n + 1 < len(order) else None
        pieces = []
        for i in range(pg, (end[0] if end else len(doc) - 1) + 1):
            if cp.BACK_PAGE.search(doc[i].get_text()) and i != pg:
                break
            box = page_box(doc, i)
            top = y if i == pg else box.y0
            bottom = end[1] if end and i == end[0] else box.y1
            stop = next((l["y0"] for l in lines[i] if top + 2 < l["y0"] < bottom and MS_END.match(l["text"].strip())), None)
            if stop:
                bottom = stop - 4
            if bottom > top + 8:
                pieces.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
            if stop or end and i == end[0]:
                break
        text = " ".join(doc.text(i, r) for i, r in pieces)
        out[(q, None, None)] = (pieces, text, None)
    for k, (pieces, text, _) in list(out.items()):
        m = SEE.search(text[:200])
        if m and len(text) < 400 and (int(m.group(1)), None, None) in out:
            out[k] = out[(int(m.group(1)), None, None)]
    return out


# ---------- examiners' reports ----------

_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    """cut_pearson's reader, on the report's text without OCR's back pages, its "Question 7*" read as
    "Question 7", and a report on two questions ("Question 7* and Question 10*") given to both, unless the
    second has its own (H418/01 June 2022's "Questions 8/9" is on Question 8, and "Question 9" follows)."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.split(r"\n[ \t]*Supporting you[ \t]*\n", text)[0]
    pairs = []

    def both(m):
        pairs.append((int(m.group(1)), int(m.group(2))))
        return f"\nQuestion {m.group(1)}\n"
    text = re.sub(r"\n[ \t]*Questions? (\d{1,2})\*?[ \t]*(?:and|&|/)[ \t]*(?:Question[ \t]*)?(\d{1,2})\*?[ \t]*(?=\n)", both, text)
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2})[ \t]*\*[ \t]*(?=\n)", r"\n\1", text)
    real = cp.pymupdf
    cp.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        out = _examiner_report(path, section)
    finally:
        cp.pymupdf = real
    for a, b in pairs:
        if f"{a:02d}" in out and f"{b:02d}" not in out:
            out[f"{b:02d}"] = out[f"{a:02d}"]
    return out


cp.frame, cp.region, cp.ms_tables, cp.examiner_report = frame, region, ms_tables, examiner_report
_cut_set = cp.cut_set


def shown(doc, pieces):
    """A question down to the line its marks end ("… accurate.  [20]"): not the next Part's heading
    ("Essay question on human rights law") or, after the last question, OCR's copyright page."""
    for n, (pg, r) in enumerate(pieces):
        mark = next((l for l in doc.lines(pg) if cp.inside(l, r) and re.search(r"\[\d{1,2}\]$", l["text"]) and l["x1"] > r.x1 - 60), None)
        if mark:
            return [x for x in pieces[:n] if cp.has_content(doc, *x)] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, mark["y1"] + 6))]
    return pieces


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    by_q = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        by_q[q] = shown(qp, region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page))
    QWORDS.clear()
    for q, pieces in by_q.items():
        own = re.sub(r"^\s*\*?\d{1,2}\*?\s*", "", " ".join(qp.text(*p) for p in pieces))
        QWORDS[q] = [w for w in words(own) if len(w) > 1][:8]
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    # The scenario blocks, and which questions are set on them.
    events = sorted([(pg, y, "label", q) for pg, y, q, *_ in labels] + list(markers(qp, end_page)), key=lambda e: (e[0], e[1]))
    blocks, block_of, current, start = [], {}, None, None
    for pg, y, kind, last in events:
        if kind == "block":
            start, current = (pg, last), None
        elif kind == "section":
            start, current = None, None
        elif kind == "label":
            if start:
                blocks.append([p for p in _region(qp, start, (pg, y), end_page) if cp.has_content(qp, *p)])
                current, start = len(blocks), None
            if current:
                block_of[last] = current
    choices = {int(m.group(2) or m.group(4) or 2) for i in range(1, end_page + 1) for m in CHOICE.finditer(re.sub(r"\s+", " ", qp.text(i)))}
    a_level = not set_id.startswith("h018")
    for p in parts:
        q = int(p["question"])
        b = block_of.get(q)
        own = " ".join(qp.text(*x) for x in by_q.get(q, []))
        img = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in by_q.get(q, [])])
        if img is not None:
            cp.save(img, p["qp"])
            p["w"], p["h"] = img.width, img.height
        if b and ADVISE.match(re.sub(r"\s+", " ", own).strip()):
            name = f"p{b}" if a_level else "sc"
            new = f"{set_id}-{name}-{q:02d}"
            for kind in ("qp", "ms"):
                if p[kind]:
                    os.replace(os.path.join(cp.IMG, p[kind]), os.path.join(cp.IMG, f"{new}-{kind}.webp"))
                    p[kind] = f"{new}-{kind}.webp"
            p["id"] = new
            pieces = blocks[b - 1]
            p["stem"] = cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in pieces]), f"{set_id}-{name}-stem.webp")
            stem_text = " ".join(qp.text(*x) for x in pieces)
        else:
            stem_text = ""
        p["own"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", own)).strip()[:1500]  # the question's own words, for tagging
        p["text"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", own + " " + stem_text)).strip()[:3000]
        if q in choices:
            p["or"] = True
    # The second Part's essay is the first's again: where the report speaks of it only once, it is on both.
    same = lambda p: re.sub(r"^\*?\d{1,2}\*?\s*(\[\d{1,2}\]\s*)?", "", p["own"])  # noqa: E731
    for p in parts:
        if not p["er"]:
            p["er"] = next((o["er"] for o in parts if o is not p and o["er"] and same(o) == same(p)), None)
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
