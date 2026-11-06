"""Cut Pearson Edexcel's GCSE (9-1) Statistics (1ST0) papers, both tiers, into questions.

    python3 scripts/question-bank/edexcel_gcse_statistics/cut_gcse_statistics.py [--only=1st01h-jun23]
    # work dir: scripts/question-bank/.work/edexcel-gcse-statistics (fetch_gcse_statistics.py)

1ST0's papers are laid out as 1MA1's (Pearson's GCSE house style: bold question numbers, "(Total for Question 3 is
6 marks)", answer lines, a "Paper: 1ST0/1H" bar over each scheme page), so this is the GCSE Maths Pearson cutter
(gcse_maths/cut_pearson_gcse_maths.py, on cut_pearson.py --whole): a whole question at a time with all its scheme
rows, the room left to work closed up. Statistics questions build on one another and on the tables and graphs
printed with them, as maths ones do. It writes <work-dir>/img/<id>-qp.webp and -ms.webp and <work-dir>/parts.json,
ids "1st01h-jun23-05".
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics"))
# cut_pearson_gcse_maths.py reads its board off argv and sets argv for cut_pearson.py (a worker process,
# re-running this module, sees that argv: its "--whole" goes, the rest stays).
sys.argv = [sys.argv[0], "edexcel", *[a for a in sys.argv[1:] if a.startswith("--") and a != "--whole"]]
sys.path.insert(0, os.path.join(HERE, "..", "gcse_maths"))
import cut_pearson_gcse_maths  # noqa: E402

cut_pearson = cut_pearson_gcse_maths.cut_pearson
pymupdf = cut_pearson.pymupdf
cut_pearson.WORK, cut_pearson.IMG = WORK, os.path.join(WORK, "img")
os.makedirs(cut_pearson.IMG, exist_ok=True)

_ms_page_box = cut_pearson.ms_page_box


def ms_page_box(doc, p):
    """The scheme page's table starts below its "Paper: 1ST0/1H" bar."""
    box = _ms_page_box(doc, p)
    bar = [l["y1"] for l in doc.lines(p) if l["y0"] < 120 and re.match(r"Paper:?\s*1ST0/\d[FH]", l["text"])]
    if bar:
        box.y0 = max(box.y0, bar[0] + 1)
    return box


cut_pearson.ms_page_box = ms_page_box

# A few schemes (June 2024 Paper 1H, November 2020's Papers 1H, 2F and 2H) head their tables "Question number", not
# "Question Number": without a header the reader found no label on those pages, and left the questions on them with
# no scheme crop. Patched here, cut_pearson.py is unchanged.
cut_pearson.HEAD = re.compile(r"Question( [Nn]umber| Key)?|Q|No\.( AO)?")

_ms_tables = cut_pearson.ms_tables


def ms_tables(doc):
    """A scheme's labels sit at the left edge of its table. A number set a little in from it is working: the 4 of
    "⁴C₃ × (0.6)³" (a binomial coefficient, June 2024 Paper 1H's 9(b), on a page with no header of its own) read as a
    Question 4 label, and took the rows of 9(b) with it."""
    lines = doc.lines

    def read(i):
        ls = lines(i)
        # A row run over onto the next page is headed "7 (c)" with "cont." under it (June 2019's and November 2020's
        # schemes). Read as a label it would be a second row for 7(c), and the reader keeps a label's first row only: the
        # continuation is left out. Without the label, it is the end of the row above, and runs to the next label.
        cont = [l for l in ls if re.fullmatch(r"cont\.?", l["text"].strip(), re.I) and l["x0"] < 100]
        drop = {id(c) for c in cont} | {id(l) for c in cont for l in ls if l["x0"] < 100 and 0 <= c["y0"] - l["y0"] < 20 and id(l) != id(c)
                                      and re.fullmatch(r"\d{1,2}\s*(\(?[a-z]{1,4}\)?\s*)*", l["text"].strip())}
        return [l for l in ls if id(l) not in drop and not (re.fullmatch(r"\d{1,2}", l["text"].strip()) and l["x0"] > 100)]

    doc.lines = read
    try:
        found = _ms_tables(doc)
    finally:
        del doc.lines
    # (the rows are found without those lines, but their text is read off the scheme itself: nothing is lost from it)
    return {k: (pieces, re.sub(r"\s+", " ", " ".join(doc.text(pg, r) for pg, r in pieces)), ans) for k, (pieces, _, ans) in found.items()}


cut_pearson.ms_tables = ms_tables

if __name__ == "__main__":
    cut_pearson.main()
