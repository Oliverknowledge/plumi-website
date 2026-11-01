"""Cut Pearson Edexcel's International GCSE Mathematics A (4MA1) papers, both tiers, into questions.

    python3 scripts/question-bank/edexcel_igcse_maths/cut_igcse_maths.py [--only=4ma11h-jun23]
    # work dir: scripts/question-bank/.work/edexcel-igcse-maths (fetch_igcse_maths.py)

The GCSE Maths banks' Pearson cutter (gcse_maths/cut_pearson_gcse_maths.py, on cut_pearson.py --whole)
as it is for 1MA1: a whole question at a time with all its scheme rows, totals read off "(Total for
Question 3 is 4 marks)", the room left to work closed up, question numbers only in bold. What 4MA1 needs
besides: a frame for its scanned pages (January 2019's papers carry some, June 2019's 2F and 2FR are scans
throughout), and the "Q" some schemes head their table with. Writes <work-dir>/img/<id>-qp.webp and -ms.webp and <work-dir>/parts.json, ids
"4ma11h-jun23-05", and "4ma12f-jan22r-14" for the R paper 2FR of January 2022.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "edexcel-igcse-maths"))
# cut_pearson_gcse_maths.py reads its board off argv and sets argv for cut_pearson.py (a worker process,
# re-running this module, sees that argv: its "--whole" goes, the rest stays).
sys.argv = [sys.argv[0], "edexcel", *[a for a in sys.argv[1:] if a.startswith("--") and a != "--whole"]]
sys.path.insert(0, os.path.join(HERE, "..", "gcse_maths"))
import cut_pearson_gcse_maths  # noqa: E402

cut_pearson = cut_pearson_gcse_maths.cut_pearson
pymupdf = cut_pearson.pymupdf
cut_pearson.WORK, cut_pearson.IMG = WORK, os.path.join(WORK, "img")
os.makedirs(cut_pearson.IMG, exist_ok=True)

_frame = cut_pearson.Doc.frame


def frame(self, i):
    """January 2019's papers carry some pages as scans (read by OCR), which draw no frame of their own: such a
    page takes the frame of the nearest typeset page, the same on every page, so its question number at the
    frame's edge reads as one (the default, 40pt in, made "12" at x 69 look indented)."""
    if i in self._frame or not (self.scanned or i in self.pictures):
        return _frame(self, i)
    typeset = sorted((j for j in range(1, len(self)) if j not in self.pictures and not self.blank(j)), key=lambda j: abs(j - i))
    if self.scanned:
        # A paper scanned whole (June 2019's 2F and 2FR) has no typeset page: its left edge is where its question
        # numbers are, the furthest left of the lines that open on a number and a capital.
        f = _frame(self, i)
        nums = [l["x0"] for j in range(1, len(self)) for l in self.lines(j) if re.match(r"\d{1,2} [A-Z]", l["text"])]
        self._frame[i] = pymupdf.Rect(min(nums) - 4, f.y0, f.x1, f.y1) if nums else f
    else:
        self._frame[i] = _frame(self, typeset[0]) if typeset else _frame(self, i)
    return self._frame[i]


_is_head = cut_pearson.is_head


def is_head(l, lines):
    """Some 4MA1 schemes head the table "Q | Working | Answer | Mark | Notes" (January 2021's 1FR, to Question 15):
    a bare "Q" beside "Working" is the Question column's header too."""
    return _is_head(l, lines) or l["text"] == "Q" and any(o["text"] == "Working" and abs(o["y0"] - l["y0"]) < 4 for o in lines)


NUMBER = re.compile(r"^\*?(\d{1,2})\*?(?=\s|\(|$)")
PART = re.compile(r"^\*?(?:\((?:[a-h]|i{1,3}|iv|vi{0,3}|ix)\)\s*)+|^(?:[a-h]|i{1,3}|iv|vi{0,3}|ix)$")


class SchemeLines:
    """A 4MA1 scheme as ms_tables reads it, for whole questions: its question numbers are the only labels.
    - The Q column is narrow and the Working column just right of it is full of numbers ("24 84", "16 15 14" up
      a fraction; January 2020's 1H) that the reader's column test, wide enough for every board's header, takes
      for questions, ending the real one's rows there. The Q column sits anywhere from 58pt to 98pt in, page to
      page, but its labels run in order: a line opening on a number is a label only when it is the next
      question, set in bold or left of 100pt (or the one after, set in bold in the Q column, where the text
      layer lost a label; June 2023's 2HR prints "24" as "4", read as 24). A question's number printed again (over a page it carries on to,
      or over an alternative method) is no new label either: the reader keeps a label's first rows only, and
      lost the rest of January 2022's 2F Question 12.
    - Part labels go: the reader joins "24" to the "(a) eg" beside it as one label and drops it (June 2024's
      2HR), and "22 (a) (i)" to the "(ii)" under it, three parts deep (November 2023's 2H).
    - A label set on one line with its working ("6 2358 × 0.28", November 2024's 1F) is split from it, and set
      at its column's header, where the reader looks for it.
    The rows' text is read off the scheme itself (ms_tables below), so none of the working is lost."""

    def __init__(self, doc):
        self.doc, self._lines, self.starts = doc, {}, {}
        first = next((i for i in range(len(doc)) if any(is_head(l, doc.lines(i)) for l in doc.lines(i))), 0)
        heads = sorted((l for i in range(len(doc)) for l in doc.lines(i) if is_head(l, doc.lines(i))), key=lambda h: h["x0"])
        self.typical = heads[len(heads) // 2]["x0"] if heads else 80
        found = []  # (page, line, number, bold in the Q column)
        for i in range(first, len(doc)):
            for l in doc.lines(i):
                m = NUMBER.match(l["text"])
                if m and l["x0"] < 200:
                    found.append((i, l, int(m.group(1)), cut_pearson.bold(l["spans"][0]) and l["x0"] < 100))
        q, x = 0, None
        for k, (i, l, n, strong) in enumerate(found):
            later = {f[2] for f in found[k + 1:]}
            # (lenient only where the real next label never comes, "20 ALT 1", an alternative method, is no 21; and
            # a digit short only where the labels stand, a Venn diagram's "4" on an end page is no 24)
            if strong and q + 1 >= 10 and n == (q + 1) % 10 and q + 1 not in later and x is not None and abs(l["x0"] - x) < 8:
                n = q + 1
            if n == q + 1 and (cut_pearson.bold(l["spans"][0]) or l["x0"] < 100) or n == q + 2 and strong and q + 1 not in later:
                q, x = n, l["x0"]
                self.starts[(i, id(l))] = str(n)

    def __getattr__(self, name):
        return getattr(self.doc, name)

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def lines(self, i):
        if i not in self._lines:
            out = []
            for l in self.doc.lines(i):
                m = NUMBER.match(l["text"])
                if (i, id(l)) not in self.starts and l["x0"] < 200 and re.match(r"\*?\d", l["text"]):
                    out.append({**l, "x0": 200})  # working, out of the Q column: "2x" is no Question 2 (x) (January 2019's 2H)
                    continue
                if m and l["x0"] < 200:
                    num = self.starts[(i, id(l))]
                    # (set at its column's header, where the reader looks: June 2022's 2FR prints "21" at 54pt, under
                    # no header of its own page, with the scheme's headers at 94pt)
                    above = [h for h in self.doc.lines(i) if is_head(h, self.doc.lines(i)) and h["y0"] <= l["y0"]]
                    x = above[-1]["x0"] if above else self.typical
                    out.append({**l, "x0": x, "x1": x + 6 * len(num), "spans": [{**l["spans"][0], "text": num}], "text": num})
                    rest = PART.sub("", l["text"][len(m.group(0)):].strip()).strip()
                    if rest:
                        x0 = l["spans"][1]["bbox"][0] if len(l["spans"]) > 1 and self.doc[i].rotation == 0 else l["x0"] + 24
                        out.append({**l, "x0": max(x0, 200), "spans": l["spans"][1:] or l["spans"], "text": rest})
                    continue
                if l["x0"] < 140 and PART.match(l["text"]):
                    # (what follows a part label is working, out of the Q column: "(b) 7" is no Question 7, June 2025's 1HR)
                    rest = PART.sub("", l["text"]).strip()
                    if rest:
                        out.append({**l, "x0": 200, "text": rest})
                    continue
                out.append(l)
            self._lines[i] = sorted(out, key=lambda l: (round(l["y0"]), l["x0"]))
        return self._lines[i]

    def text(self, i, rect=None):
        return "\n".join(l["text"] for l in self.lines(i) if rect is None or cut_pearson.inside(l, rect))


_ms_tables = cut_pearson.ms_tables


def ms_tables(doc):
    """Rows found on SchemeLines; each row's text read off the scheme itself, the working's numbers too."""
    found = _ms_tables(SchemeLines(doc))
    return {k: (pieces, re.sub(r"\s+", " ", " ".join(doc.text(p, r) for p, r in pieces)), ans) for k, (pieces, _, ans) in found.items()}


_marks_in = cut_pearson.marks_in


def marks_in(doc, pieces):
    """Every 4MA1 question ends "(Total for Question 13 is 6 marks)": that first, as the parts' "(2)"s can come out
    of OCR short (January 2019's 1FR, Question 13 read as 4)."""
    m = re.search(r"Total for Question \d+ is (\d+) marks?", " ".join(doc.text(pg, r) for pg, r in pieces))
    return int(m.group(1)) if m else _marks_in(doc, pieces)


cut_pearson.Doc.frame = frame
cut_pearson.is_head = is_head
cut_pearson.ms_tables = ms_tables
cut_pearson.marks_in = marks_in

if __name__ == "__main__":
    cut_pearson.main()
