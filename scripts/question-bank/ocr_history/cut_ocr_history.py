"""Cut OCR's A-Level History A papers into questions, each paired with its mark scheme.

    python3 scripts/question-bank/ocr_history/cut_ocr_history.py [work-dir] [--only=y10101-jun24]
    # work-dir: .work/ocr-history (fetch_ocr_history.py); needs: pip install pymupdf pillow

OCR's History papers are typeset like its other papers, so edexcel_sciences/cut_pearson.py does the
work, used here as a library, unchanged, with ocr_law/cut_ocr_law.py's page frame (below the page
number OCR centres at the top), question regions (which also end at "Section B" and at "Answer
Question 2 or Question 3."), scheme page box and examiners' report reader ("Question 2*", here with
Unit 2's "Question 1 (a) (i) and (ii)" and "Question 1 (b)*" read as "Question 1 (a)", "(b)"). What
differs is set here, for this run only:
  - the questions. Unit 1 (Y101-Y113) is a source question, "1 … Use the four sources … [30]", with
    its four sources printed under it, then a choice of two essays (2*, 3*). Unit 2 (Y201-Y224) is a
    choice of Question 1 or 2, each a 10-mark "(a) Which of the following … (i) … (ii) …" and a
    20-mark essay "(b)*". Unit 3 (Y301-Y321) is an interpretations question, "1 Evaluate the
    interpretations in both of the two passages … [30]", with its passages under it, then any two of
    three 25-mark essays. A question's crop runs from its number to the next, or to "SECTION B", so
    the sources and passages come with their question and students see them. The "(i)" and "(ii)"
    of a Unit 2 "(a)" are the two things to weigh, not sub-parts: they are read as part of (a).
  - the mark schemes: OCR's ruled table ("Question | Answer | Mark | Guidance"), each question's
    indicative content over a page or more, which cut_pearson reads, (a)'s "(i)"/"(ii)" again folded
    into (a). Each scheme stops at "APPENDIX 1", where OCR prints the generic levels grids once for
    the paper ("Generic mark scheme for Section A, Question 1: … [30]", "… Question 1(b) and
    Question 2(b): Essay [20]"); the grid for a question's marks is set under its indicative content,
    so every scheme crop carries its levels.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <work-dir>/parts.json in cut_pearson.py's shape.
Ids are <component>-<series>-<question>[-<part>]: "y10101-jun24-01", "y22101-jun24-02-b".
"""
import os, re, sys, types

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-history"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_law"))
import cut_pearson as cp  # noqa: E402  (reads the work dir and --only from the command line)

# Law's module patches cut_pearson for Law's papers as it loads: keep its helpers, put the rest back.
_base = {k: getattr(cp, k) for k in ("frame", "region", "ms_tables", "examiner_report", "cut_set")}
import cut_ocr_law as law  # noqa: E402
for k, v in _base.items():
    setattr(cp, k, v)

APPENDIX = re.compile(r"^APPENDIX\b")
GRID = re.compile(r"^Generic mark scheme for\b")
AO = re.compile(r"^AO\d:")
# OCR's back page in its older schemes: its address and contact centre, after the grids.
BACK = re.compile(r"^\s*OCR \(Oxford Cambridge and RSA Examinations\)\s*$|OCR Customer Contact Centre", re.M)

_qp_labels = cp.qp_labels


def qp_labels(doc):
    """No sub-parts: a Unit 2 "(a)"'s "(i)" and "(ii)" are its two factors. And an essay whose number runs
    straight into a quotation with a straight quote ("3*  'The main reason…", Y104 November 2021), which
    cut_pearson doesn't take for a question's start, is one."""
    labels, end_page = _qp_labels(doc)
    labels = [x for x in labels if x[4] is None]
    for i in range(1, end_page + 1):
        f = doc.frame(i)
        for l in doc.lines(i):
            m = re.match(r"^\*?(\d{1,2})\*?\s+['\"‘“]", l["text"])
            if not m or l["x0"] > f.x0 + 16 or any((pg, round(y)) == (i, round(l["y0"])) for pg, y, *_ in labels):
                continue
            before = [x for x in labels if (x[0], x[1]) < (i, l["y0"])]
            if before and before[-1][2] + 1 == int(m.group(1)) and not any(x[2] == int(m.group(1)) for x in labels):
                labels.insert(len(before), (i, l["y0"], int(m.group(1)), None, None))
    return labels, end_page


def appendix_at(doc):
    for i in range(len(doc)):
        for l in doc.lines(i):
            if APPENDIX.match(l["text"].strip()):
                return i, l["y0"]
    return None


def ms_tables(doc):
    """cut_pearson's reader, with (a)(i) and (a)(ii) folded into (a), each scheme stopping at the appendix."""
    found = _base["ms_tables"](doc)
    out = {}
    for k in sorted(found, key=lambda k: (found[k][0][0][0], found[k][0][0][1].y0) if found[k][0] else (0, 0)):
        pieces, text, ans = found[k]
        key = (k[0], k[1], None)
        got = out.get(key, ([], "", None))
        out[key] = (got[0] + [p for p in pieces if p not in got[0]], (got[1] + " " + text).strip(), got[2] or ans)
    # Some schemes print their first table page without its header row (Unit 2, June 2024), so cut_pearson
    # starts at the next: a question's row ("1", "(a)" at the left) after the annotations and before the
    # first row read runs to that row.
    starts = sorted((found[k][0][0] for k in found if found[k][0]), key=lambda x: (x[0], x[1].y0))
    if starts:
        pg0, y0 = starts[0][0], starts[0][1].y0
        notes = max((i for i in range(pg0) if re.search(r"^\s*(\d+\.\s*)?Annotations?\s*$", doc[i].get_text(), re.M)), default=None)
        for i in range(notes + 1 if notes is not None else pg0, pg0 + 1):
            lines = doc.lines(i)
            for l in lines:
                m = re.fullmatch(r"\*?(\d{1,2})\*?", l["text"].strip())
                bare = re.fullmatch(r"\(([a-h])\)\*?", l["text"].strip())  # the row's "(a)" with no number (Y217 June 2024): Question 1's
                if not (m and l["x0"] <= 90 or bare and l["x0"] < 200) or (i, l["y0"]) >= (pg0, y0 - 2):
                    continue
                letter = bare.group(1) if bare else next((re.fullmatch(r"\(([a-z])\)\*?", o["text"].strip()).group(1) for o in lines
                               if abs(o["y0"] - l["y0"]) < 4 and l["x1"] < o["x0"] < 200 and re.fullmatch(r"\(([a-z])\)\*?", o["text"].strip())), None)
                key = (int(m.group(1)) if m else 1, letter, None)
                if key in out:
                    continue
                pieces = []
                for j in range(i, pg0 + 1):
                    box = law.page_box(doc, j)
                    top, bottom = (l["y0"] - 4 if j == i else box.y0), (y0 - 4 if j == pg0 else box.y1)
                    if bottom > top + 8:
                        pieces.append((j, pymupdf.Rect(box.x0, top, box.x1, bottom)))
                out[key] = (pieces, " ".join(doc.text(j, r) for j, r in pieces), None)
                break
            else:
                continue
            break
    stop = appendix_at(doc)
    if stop:
        for key, (pieces, text, ans) in out.items():
            kept = []
            for pg, r in pieces:
                if (pg, r.y0) >= stop:
                    break
                if pg == stop[0] and r.y1 > stop[1]:
                    # (a row's last line can overlap the heading in OCR's own PDF, Y104 November 2021: keep it whole)
                    over = max((l["y1"] for l in doc.lines(pg) if r.y0 < l["y0"] < stop[1] - 2 and l["y1"] > stop[1] - 4), default=stop[1] - 4)
                    r = pymupdf.Rect(r.x0, r.y0, r.x1, over + 1)
                kept.append((pg, r))
            out[key] = (kept, " ".join(doc.text(pg, r) for pg, r in kept) if kept != pieces else text, ans)
    return out


def grids(doc):
    """{marks: [(page, rect)]}: each generic levels grid in the appendix, from the assessment objective set
    over it to the next grid or the page's end (and on over the next page where it runs on)."""
    stop = appendix_at(doc)
    if not stop:
        return {}
    heads = []
    for i in range(stop[0], len(doc)):
        if cp.BACK_PAGE.search(doc[i].get_text()) or BACK.search(doc[i].get_text()):
            break
        lines = doc.lines(i)
        for k, l in enumerate(lines):
            m = GRID.match(l["text"].strip()) and re.search(r"\[(\d{1,2})\]", " ".join(o["text"] for o in lines[k:k + 3]))
            if m:
                ao = [o["y0"] for o in lines[max(0, k - 6):k] if AO.match(o["text"].strip()) and l["y0"] - o["y0"] < 70]
                heads.append((i, min(ao) if ao else l["y0"], int(m.group(1))))
        last = i
    out = {}
    for n, (pg, y, marks) in enumerate(heads):
        nxt = heads[n + 1] if n + 1 < len(heads) else None
        pieces = []
        for i in range(pg, (nxt[0] if nxt else last) + 1):
            box = law.page_box(doc, i)
            top = y - 4 if i == pg else box.y0
            bottom = nxt[1] - 6 if nxt and nxt[0] == i else box.y1
            if bottom > top + 8 and cp.has_content(doc, i, pymupdf.Rect(box.x0, top, box.x1, bottom)):
                pieces.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
        out.setdefault(marks, pieces)
    return out


def examiner_report(path, section=None):
    """Law's reader, on the report with Unit 2's part headings read plainly: "Question 1 (a) (i) and (ii)"
    and "Question 1 (b)*" as "Question 1 (a)" and "Question 1 (b)"."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2}\s*(?:\([a-z]\))?)\s*\*?[ \t]*(?:\(i\)\s*(?:and|&)\s*\(ii\))?[ \t]*\*?[ \t]*(?=\n)", r"\n\1", text)
    real = law.pymupdf
    law.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        return law.examiner_report(path, section)
    finally:
        law.pymupdf = real


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _base["cut_set"](qp_path, ms_path, er_path, set_id, meta)
    ms = cp.Doc(ms_path) if ms_path and os.path.exists(ms_path) else None
    levels = grids(ms) if ms else {}
    for p in parts:
        grid = levels.get(p["marks"])
        if p["ms"] and grid:
            from PIL import Image  # noqa: PLC0415
            own = Image.open(os.path.join(cp.IMG, p["ms"])).convert("RGB")
            img = cp.stack([own] + [cp.trim(ms.crop(pg, r), 10, sides=True) for pg, r in grid])
            cp.save(img, p["ms"])
            p["grid"] = True
    return parts


cp.frame, cp.region, cp.qp_labels, cp.ms_tables, cp.examiner_report, cp.cut_set = law.frame, law.region, qp_labels, ms_tables, examiner_report, cut_set

if __name__ == "__main__":
    cp.main()
