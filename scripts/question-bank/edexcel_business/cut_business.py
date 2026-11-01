"""Cut Pearson Edexcel's A-Level Business papers: cut_pearson.py --extracts, with two readings of its own.

    python3 scripts/question-bank/edexcel_business/cut_business.py [work-dir] [--only=9bs001-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-business

Business is set like Economics: each section's extracts, then a question's parts, (a) to (e) or (f).
To June 2022 the extracts are printed in the paper ("Read the following extracts (A to D) before
answering Question 1."). From June 2023 they are in a Source Booklet bound in after the paper, and the
paper says "Read the extracts (A to C) in the Source Booklet…" or "Read Extracts A to C in the Source
Booklet…", which cut_pearson.py's READ doesn't take; and the booklet heads each block "SECTION A",
not Economics' "Sources for use with SECTION A". Both are patched in here; cut_pearson.py is unchanged.
Also: a table's column of years inside an extract (June 2022 Paper 3's "0, 1, 2…" cash flows) is not read
as question numbers, a bare number in a scheme's label column is not read as a question (a levels grid's
"0 | No rewardable material" row ended the answer above at its grid's header row; a "Knowledge 2, Application 2"
wrapped onto a line of its own took its row's content from "2 (a)"), and the reports are read whatever their headings ("Question 1a") or fonts (June 2024
Paper 2's has no character map, so it is read by OCR, as edexcel_gcse_geography/cut_gcse_geography.py does).
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work", "edexcel-business"),
                *[a for a in sys.argv[1:] if a.startswith("--")], "--extracts"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import pymupdf  # noqa: E402
import cut_pearson as cp  # noqa: E402

cp.READ = re.compile(r"^Read (the following |the extracts |Extracts? \(?[A-Z]\b|Figures? |Figure \d)", re.I)


def source_booklet(doc, end_page):
    """{"A": [(page, rect)], ...}: each "SECTION A" block of the Source Booklet after the questions, to the next
    block or the booklet's end, blank pages left out."""
    cover = next((i for i in range(end_page + 1, len(doc)) if "Source Booklet" in doc.text(i)), None)
    if cover is None:
        return {}
    found = [(i, l["y0"], re.match(r"SECTION ([A-C])\b", l["text"]).group(1))
             for i in range(cover + 1, len(doc)) for l in doc.lines(i) if re.match(r"SECTION [A-C]\b", l["text"])]
    out = {}
    for n, (pg, y, sec) in enumerate(found):
        stop = found[n + 1][:2] if n + 1 < len(found) else (len(doc), 0)
        pieces = []
        for i in range(pg, min(stop[0] + 1, len(doc))):
            f = doc.frame(i)
            top = y - 4 if i == pg else f.y0
            bottom = stop[1] - 4 if i == stop[0] else f.y1
            rect = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if bottom > top + 10 and not doc.blank(i) and cp.has_content(doc, i, rect):
                pieces.append((i, rect))
        out[sec] = pieces
    return out


cp.source_booklet = source_booklet

# ---------- question numbers ----------

_qp_labels = cp.qp_labels


def qp_labels(doc):
    """Business sets a question's number on its "(a)"'s line ("1 (a) Using the information…"): a bare number
    with a figure beside it ("2 | 4 | 15") is a table's cell, in an extract, not a question."""
    lines = doc.lines
    cell = re.compile(r"\(?[£$]?[\d.,]+%?\)?|Year \d+")

    def unfigured(i):
        got = lines(i)
        return [l for l in got if not (re.fullmatch(r"\d{1,2}", l["text"])
                                       and any(o is not l and abs(o["y0"] - l["y0"]) < 3 and cell.fullmatch(o["text"]) for o in got))]
    doc.lines = unfigured
    try:
        labels, end_page = _qp_labels(doc)
    finally:
        del doc.lines
    return [lead_in(doc, label, labels) for label in labels], end_page


def prose(l):
    """A line of the question's words: not an answer line, a part's marks, the margin's warning or the page's number."""
    return len(l["text"]) > 3 and not re.match(r"^[.…_ ]+$|^\(\d{1,2}\)$|^\d{1,3}$|^\*P\d", l["text"]) and not cp.BOILER.fullmatch(l["text"].strip())


def lead_in(doc, label, labels):
    """A part set on words printed above its label, after the part before's answer lines ("Dr Kye is considering a broadly
    democratic or broadly paternalistic leadership style." over "(e) Evaluate these two options…"), starts at those words:
    else they end the part before, whose crop stops at its marks, and neither shows them. Over a page break they are at
    the foot of the page before."""
    pg, y, q, letter, roman = label
    if not letter or roman or any(o[0] == pg and abs(o[1] - y) < 2 and o[3] is None for o in labels):
        return label  # a question's first part shares its number's line

    def block(page, below):
        f = doc.frame(page)
        above = [l for l in doc.lines(page) if f.y0 - 4 <= l["y0"] < below - 2 and l["x0"] >= f.x0 - 2 and not cp.BOILER.search(l["text"])]
        words, last = [], below
        for l in reversed(above):
            if not prose(l) or last - l["y1"] > 30:
                break
            words.append(l)
            last = l["y0"]
        earlier = [l for l in above if l["y0"] < last]
        # (the part before's answer lines, or its marks, close it off: not a question's opening words or an extract)
        return words[-1]["y0"] if words and (not earlier or not prose(earlier[-1])) and not any(o[0] == page and last - 2 <= o[1] < below for o in labels if o != label) else None

    top = block(pg, y)
    if top is not None:
        print(f"  {q}({letter}): starts at the words above it, page {pg + 1}", file=sys.stderr)
        return (pg, top, q, letter, roman)
    f = doc.frame(pg)
    if not [l for l in doc.lines(pg) if f.y0 - 4 <= l["y0"] < y - 2 and prose(l) and not cp.BOILER.search(l["text"])] and pg > 1:
        top = block(pg - 1, doc.frame(pg - 1).y1 + 2)
        if top is not None:
            print(f"  {q}({letter}): starts at the words at the foot of page {pg}", file=sys.stderr)
            return (pg - 1, top, q, letter, roman)
    return label


cp.qp_labels = qp_labels
# Business prints each part once, above its answer space: no part is "printed again" (Economics' layout), and a part that
# now starts at its words above keeps its own "(e)" line.
cp.RELABEL = re.compile(r"(?!)")

# ---------- mark schemes ----------

_ms_tables = cp.ms_tables


def ms_tables(doc):
    """A scheme's labels, its bare numbers left out: Business labels every row with its question and part, on one
    line ("2 (a)"), so a number alone is a levels grid's "0", a mark wrapped from the line above, or a page's number."""
    lines = doc.lines
    doc.lines = lambda i: [l for l in lines(i) if not re.fullmatch(r"\d{1,2}", l["text"].strip())]
    try:
        return _ms_tables(doc)
    finally:
        del doc.lines


cp.ms_tables = ms_tables

# ---------- examiner's reports ----------

def report_pages(path):
    """A report's pages as text, a part's heading as cut_pearson reads it ("Question 1a" -> "Question 1 (a)").
    A report set in fonts with no character map comes out as symbols: that one is read by OCR (cut_pearson's
    ocr_lines), with the candidates' scripts (pictures) whited out first."""
    doc = pymupdf.open(path)
    texts = [page.get_text() for page in doc]
    seen = "".join(texts)
    if seen.strip() and len(re.findall(r"[A-Za-z]", seen)) < 0.5 * len(re.sub(r"\s", "", seen)):
        plain = os.path.join(cp.WORK, "unpictured", os.path.basename(path))
        if not os.path.exists(plain):
            os.makedirs(os.path.dirname(plain), exist_ok=True)
            for page in doc:
                for info in page.get_image_info():
                    page.draw_rect(pymupdf.Rect(info["bbox"]), color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
            doc.save(plain)
        doc = pymupdf.open(plain)
        read = cp.ocr_lines(doc, plain)
        texts = []
        for i in range(len(doc)):
            lines, out = read.get(i, []), []
            for a, b in zip([None] + lines, lines):
                if a is not None:
                    out.append("\n\n" if b["y0"] - a["y1"] > 0.8 * (b["y1"] - b["y0"]) else "\n")
                out.append(b["text"])
            texts.append("".join(out) + "\n")
    return [re.sub(r"(?m)^[ \t]*Question\s*(\d{1,2})\s*\(?([a-f])\)?[ \t]*:?[ \t]*$", r"Question \1 (\2)", t) for t in texts]


class _Page:
    def __init__(self, text):
        self.text = text

    def get_text(self):
        return self.text


class _Reports:
    """pymupdf, but open() hands examiner_report the pages report_pages reads."""

    def __getattr__(self, name):
        return getattr(pymupdf, name)

    def open(self, path):
        return [_Page(t) for t in report_pages(path)]


_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    if not path or not os.path.exists(path):
        return {}
    cp.pymupdf = _Reports()
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = pymupdf


cp.examiner_report = examiner_report

if __name__ == "__main__":
    cp.main()
