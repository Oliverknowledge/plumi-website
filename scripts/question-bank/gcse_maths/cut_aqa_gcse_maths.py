"""Cut AQA's GCSE Maths (8300) Higher papers into questions, each with its mark scheme rows.

    python3 scripts/question-bank/gcse_maths/cut_aqa_gcse_maths.py [work-dir] [--only=83001h-jun23]
    # default work dir: scripts/question-bank/.work/gcse-maths/aqa

aqa_maths/cut_maths.py run over the GCSE papers, which AQA sets the same way (bold
labels in the margin, "9", "9 (a)"; a question is its labels' words stacked, with the
space to write in left out). What differs is read off the GCSE layout:
  - The space to write in is drawn rather than typed: grey working lines across the
    question column, then "Answer" and its line, and a figure to work on (a grid) can
    come after the lines. So rather than end a label's words at its first answer line,
    each piece is squeezed to its runs of ink: the lines and the space round them go.
  - The scheme's table is "Q | Answer | Mark | Comments", the headings printed again
    over most parts, and each label is centred in a cell that runs the whole height of
    its rows: a part's rows start at the rule above that cell, however far up it is.
Writes what cut_maths.py writes: <work-dir>/img/<id>-qp.webp and -ms.webp, and
<work-dir>/parts.json, one entry per question, id "83001h-jun23-09".
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "gcse-maths", "aqa")
sys.argv = [sys.argv[0], WORK, *[a for a in sys.argv[1:] if a.startswith("--")]]
sys.path.insert(0, os.path.join(HERE, "..", "aqa_maths"))
import cut_maths  # noqa: E402

cut_maths.HEADINGS = re.compile(r"Comments?")  # "Comment" in some years


def grey_rule(d):
    """A working line: a thin grey bar across the question column (x 98 to 533), or an answer line (x 220-265, 228 wide)."""
    r, fill = d["rect"], d.get("fill")
    return r.height < 2 and fill is not None and abs(fill[0] - fill[2]) < 0.02 and 0.4 < fill[0] < 0.9 \
        and (90 < r.x0 < 110 and 420 < r.width < 445 or 200 < r.x0 < 270 and 200 < r.width < 240)


# Page furniture inside the question column, which isn't the question's.
FURNITURE = re.compile(r"^(Do not write|outside the|box$|Turn over|Question \d+ continues|END\s+OF\s+QUESTIONS|There are no questions)", re.I)


def bands(page, rect, gap=28, pad=6):
    """rect cut down to its runs of ink: words, pictures and figures, but not the working lines, the
    blank space between them or the page's furniture. Runs closer than `gap` stay together."""
    ys = []
    for b in page.get_text("dict", clip=rect)["blocks"]:
        if b.get("type") == 1:
            ys.append((b["bbox"][1], b["bbox"][3]))
            continue
        for line in b.get("lines", []):
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t and not FURNITURE.match(t):
                ys.append((line["bbox"][1], line["bbox"][3]))
    for d in page.get_drawings():
        r = d["rect"]
        if rect.intersects(r) and not grey_rule(d) and r.width < 480 and r.height < 600:
            ys.append((r.y0, r.y1))
    runs = []
    for y0, y1 in sorted((max(a, rect.y0), min(b, rect.y1)) for a, b in ys):
        if y1 < y0:
            continue
        if runs and y0 - runs[-1][1] < gap:
            runs[-1][1] = max(runs[-1][1], y1)
        else:
            runs.append([y0, y1])
    return [cut_maths.pymupdf.Rect(rect.x0, max(rect.y0, y0 - pad), rect.x1, min(rect.y1, y1 + pad)) for y0, y1 in runs]


_qp_regions = cut_maths.qp_regions


def qp_regions(doc):
    """cut_maths.py's regions, each piece squeezed to its runs of ink: the space to write in left out."""
    out = []
    for key, groups, pieces, full in _qp_regions(doc):
        out.append([key, groups, [(pg, r) for pg, rect in pieces for r in bands(doc[pg], rect)], full])
    return out


def row_top(page, y):
    """The rule over the label's cell in the Q column, or the headings sitting right over it."""
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].x0 < 70 and d["rect"].x1 > 90})
    above = [r for r in rules if r <= y + 2]
    top = above[-1] - 1 if above else y - 6
    for ht, hb in cut_maths.headers(page):
        if -16 <= top - hb < 14:
            over = [r for r in rules if r <= ht + 2 and ht - r < 12]
            return (over[-1] if over else ht - 4) - 1
    return top


_qp_labels = cut_maths.qp_labels


def qp_labels(doc):
    """The question's own words start at x 92-99, inside cut_maths.py's margin (x < 100): a bold letter
    there opening the question ("a is a number…") isn't part of the label beside it."""
    spans = cut_maths.spans
    cut_maths.spans = lambda page: (s for s in spans(page) if not 88 <= s["bbox"][0] < 100)
    try:
        return _qp_labels(doc)
    finally:
        cut_maths.spans = spans


_ms_labels = cut_maths.ms_labels


def ms_labels(doc):
    """A part whose rows run on to the next page has its label again there: one part, not two.
    Question numbers only go up: a bold "2" lower down is a fraction in the answer."""
    start, labels = _ms_labels(doc)
    out = []
    for lab in labels:
        if out and (out[-1][2:] == lab[2:] or int(lab[2]) < int(out[-1][2])):
            continue
        out.append(lab)
    return start, out


def examiner_report(path):
    """{question: its comments}, as cut_maths.py reads them, but GCSE reports head each part ("Question 9(a)",
    "Question 9(b)"): every part is kept, under its heading, where cut_maths.py keeps the last."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in cut_maths.pymupdf.open(path))
    page_break = r"[ \t]*(?:report on the examination\b.*|(?:copyright\s*)?©\s*\d{4} AQA\b.*|\d+ of \d+)[ \t]*"
    text = re.sub(rf"(?:\n[ \t]*)*\n{page_break}(?:\n(?:{page_break}|[ \t]*))*(?=\n)", "", text, flags=re.I)
    parts = re.split(r"\n\s*Questions? (\d{1,2})\s*((?:\([a-z]{1,4}\)\s*)*)\s*\n", text)
    out = {}
    for k in range(1, len(parts) - 2, 3):
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Concluding remarks)", parts[k + 2])[0]
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", body)
        if not body:
            continue
        q, sub = f"{int(parts[k]):02d}", re.sub(r"\s+", "", parts[k + 1])
        piece = f"Question {int(parts[k])}{sub}\n\n{body}" if sub else body
        out[q] = out[q] + "\n\n" + piece if q in out else piece
    return out


cut_maths.examiner_report = examiner_report
cut_maths.qp_regions = qp_regions
cut_maths.row_top = row_top
cut_maths.ms_labels = ms_labels
cut_maths.qp_labels = qp_labels

if __name__ == "__main__":
    cut_maths.main()
