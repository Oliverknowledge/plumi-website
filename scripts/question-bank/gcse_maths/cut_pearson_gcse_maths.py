"""Cut Pearson Edexcel's (1MA1) and OCR's (J560) GCSE Maths Higher papers into questions.

    python3 scripts/question-bank/gcse_maths/cut_pearson_gcse_maths.py edexcel|ocr [--only=1ma11h-jun23]
    # work dir: scripts/question-bank/.work/gcse-maths/<board>

edexcel_sciences/cut_pearson.py --whole, as for the OCR A-Level maths banks: a whole
question at a time, with all its scheme rows. What the GCSE papers need besides:
  - Pearson totals a question "(Total for Question 1 is 3 marks)", not "= 3 marks":
    a question with no parts takes its marks from there.
  - Pearson heads every scheme page with a "Paper: 1MA1/1H" bar over the table: a
    question's rows start below it, so a question carried over the page doesn't pick
    the bar up.
  - Both boards leave room to work under each question; the long blank stretches are
    closed up (cut_pearson.py's squash), so a question reads as printed, not as a page.
Writes what cut_pearson.py writes: <work-dir>/img/<id>-qp.webp and -ms.webp, and
<work-dir>/parts.json, ids "1ma11h-jun23-05", "j56004-nov22-12".
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BOARD = os.path.basename(os.path.normpath(sys.argv[1]))  # "ocr"; in a worker process, which sees the argv set below, …/gcse-maths/ocr
WORK = os.path.join(HERE, "..", ".work", "gcse-maths", BOARD)
sys.argv = [sys.argv[0], WORK, "--whole", *[a for a in sys.argv[2:] if a.startswith("--")]]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson  # noqa: E402

import pymupdf  # noqa: E402
from PIL import Image  # noqa: E402

_marks_in, _ms_page_box, _trim = cut_pearson.marks_in, cut_pearson.ms_page_box, cut_pearson.trim


def marks_in(doc, pieces):
    got = _marks_in(doc, pieces)
    if got is None:
        m = re.search(r"Total for Question \d+ is (\d+) marks?", " ".join(doc.text(pg, r) for pg, r in pieces))
        got = int(m.group(1)) if m else None
    return got


def ms_page_box(doc, p):
    box = _ms_page_box(doc, p)
    bar = [l["y1"] for l in doc.lines(p) if l["y0"] < 120 and re.match(r"Paper:?\s*1MA1/\d[FH]", l["text"])]
    if bar:
        box.y0 = max(box.y0, bar[0] + 1)
    return box


def close_up(img, run=70, keep=36):
    """Close up stretches of white taller than `run` pixels to `keep`: the room left to work in.
    A row counts as white only with no ink at all on it, so a graph's pale grid stays whole."""
    g = img.convert("L").point(lambda v: 255 if v < 235 else 0)
    blank = [not g.crop((0, y, g.width, y + 1)).getbbox() for y in range(g.height)]
    cuts, start = [], None
    for y, b in enumerate(blank + [False]):
        if b:
            start = y if start is None else start
        elif start is not None:
            if y - start > run:
                cuts.append((start + keep // 2, y - keep // 2))
            start = None
    if not cuts:
        return img
    parts, y0 = [], 0
    for a, b in cuts:
        parts.append(img.crop((0, y0, img.width, a)))
        y0 = b
    parts.append(img.crop((0, y0, img.width, img.height)))
    out = Image.new("RGB", (img.width, sum(p.height for p in parts)), (255, 255, 255))
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    return out


def trim(img, keep=30, sides=False):
    """cut_pearson.py trims a question's pieces with its defaults (a scheme's with sides, a stem's with less
    air): a question's pieces are closed up as well."""
    out = _trim(img, keep, sides)
    return close_up(out) if out is not None and keep == 30 and not sides else out


class BoldNumbers:
    """A question paper as qp_labels reads it, without the lines that open on a number in a regular font:
    Pearson sets question numbers in bold, so "12" up a graph's axis, at the frame's left edge, isn't one."""

    def __init__(self, doc):
        self.doc = doc

    def __getattr__(self, name):
        return getattr(self.doc, name)

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def lines(self, i):
        return [l for l in self.doc.lines(i) if not (re.match(r"\*?\d{1,2}\b", l["text"]) and not cut_pearson.bold(l["spans"][0]))]


_qp_labels, _ms_tables, _frame = cut_pearson.qp_labels, cut_pearson.ms_tables, cut_pearson.Doc.frame


def qp_labels(doc):
    # (OCR sets the odd question number in regular type: November 2019 Paper 5's "7".)
    return _qp_labels(BoldNumbers(doc) if BOARD == "edexcel" else doc)


# Where a scheme's questions end: OCR's appendix (exemplars, a table of trials numbered 0 to 18) and
# Pearson's notes on its modified large print papers, a table of its own keyed by question number.
SCHEME_END = re.compile(r"^(APPENDIX|Appendix(?: \d)?|Modifications to the mark scheme for Modified Large Print.*)$")


def ms_tables(doc):
    """No question's rows run past the scheme's end matter (SCHEME_END)."""
    found = _ms_tables(doc)
    stop = next(((i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i) if SCHEME_END.match(l["text"].strip())), None)
    if stop is None:
        return found
    out = {}
    for k, (pieces, text, ans) in found.items():
        keep = [(pg, r if pg < stop[0] else pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, stop[1] - 2))) for pg, r in pieces
                if pg < stop[0] or pg == stop[0] and r.y0 < stop[1] - 8]
        if keep:
            out[k] = (keep, text, ans)
    return out


def frame(self, i):
    """OCR prints the page number centred at the top, inside cut_pearson.py's default frame: start below it.
    And OCR draws no frame, so a figure bleeding off the page can pass for one (June 2019 Paper 5's
    page 18 reads from x −22): keep to the page's margins."""
    fresh = i not in self._frame
    f = _frame(self, i)
    if fresh and BOARD == "ocr":
        w, lines = self.doc[i].rect.width, self.lines(i)
        f = self._frame[i] = pymupdf.Rect(max(f.x0, 40), f.y0, min(f.x1, w - 40), f.y1)
        top = [l["y1"] for l in lines if l["y0"] < 64 and re.fullmatch(r"\d{1,2}", l["text"].strip()) and abs((l["x0"] + l["x1"]) / 2 - w / 2) < 30
               and not any(o is not l and abs(o["y0"] - l["y0"]) < 8 for o in lines)]
        if top:
            f = self._frame[i] = pymupdf.Rect(f.x0, max(f.y0, max(top) + 2), f.x1, f.y1)
    return f


cut_pearson.qp_labels = qp_labels
cut_pearson.ms_tables = ms_tables
cut_pearson.Doc.frame = frame
cut_pearson.marks_in = marks_in
cut_pearson.ms_page_box = ms_page_box
cut_pearson.trim = trim

if __name__ == "__main__":
    cut_pearson.main()
