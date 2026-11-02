"""Cut OCR's Cambridge National in Engineering Manufacture (J823) exam papers, unit R014, into question parts,
each paired with its mark scheme rows.

    python3 scripts/question-bank/ocr_cn_engineering/cut_ocr_cn_engineering.py [work-dir] [--only=r01401-jun25]
    # work-dir: .work/ocr-cn-engineering (fetch_ocr_cn_engineering.py); needs: pip install pymupdf pillow

R014 is set like OCR's GCSE Computer Science, so ocr_gcse_cs/cut_ocr_gcse_cs.py (and through it
computer_science/cut_ocr_cs.py and edexcel_sciences/cut_pearson.py) does the work, used here as a library,
unchanged. What differs is set here, for this run only:
  - Section A is ten multiple-choice questions whose options are lettered "(a) Forming" … "(d) Wasting":
    the cutter read each option as a part. Above the "Section B" heading no part labels are read, so each is
    one question, and it carries the scheme's letter ("(c) Shaping") as its key, upper case as the site's
    answer buttons are;
  - some schemes (January and June 2024) set a sub-part's "(ii)" 12pt right of their "Question" header's
    span, where the scheme reader didn't look for labels: the header's span is taken to run over them;
  - a table can give each cell its own mark (marks_in); a mark at the page's very foot, level with "Turn
    over", is kept whole (doc_frame); a first sub-part keeps its own start, however few its words (cut_set).
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in cut_pearson.py's shape.
Ids are <component>-<series>-<question>[-<part>]: "r01401-jun25-11-ai".
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-cn-engineering"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_gcse_cs"))
import cut_ocr_gcse_cs  # noqa: E402  (its patches to cut_pearson, and cut_ocr_cs's)

cp = cut_ocr_gcse_cs.cp
SECTION_B = re.compile(r"^Section B\b")
KEY = re.compile(r"(?<!\S)\(([a-d])\)\s")
SUB = re.compile(r"\(([a-h]|[ivx]{1,4})\)")
_qp_labels = cp.qp_labels


def qp_labels(doc):
    labels, end_page = _qp_labels(doc)
    at = next(((i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i) if SECTION_B.match(l["text"])), None)
    if not at:
        return labels, end_page
    return [lab for lab in labels if lab[3] is None or lab[:2] > at], end_page


cp.qp_labels = qp_labels
_doc_init, _doc_frame = cp.Doc.__init__, cp.Doc.frame


def doc_init(self, path):
    """A question paper's "Turn over" is painted out (its text stays), as it can sit level with a mark (below)."""
    _doc_init(self, path)
    if "-qp-" in os.path.basename(path):
        for page in self.doc:
            for r in page.search_for("Turn over"):
                if r.y0 > page.rect.height - 90:
                    page.draw_rect(r + (-1, -1, 1, 1), color=None, fill=(1, 1, 1), overlay=True)


def doc_frame(self, i):
    """A question's mark can sit at the page's very foot, its box ("[1]", 765.6 to 780.8) running past the
    frame (775.2, 4pt above the "© OCR" footer at 779.2), level with "Turn over": the crop cut the mark in
    half. The frame runs on to just short of the "©" line's ink (its box's top plus 0.8pt; the ink starts at 1.6), where a line starting inside it runs past it."""
    fresh = i not in self._frame
    f = _doc_frame(self, i)
    if not fresh or "-qp-" not in os.path.basename(self.doc.name):
        return f
    footer = lambda l: l["text"].startswith("©") or l["text"].strip() == "Turn over"  # noqa: E731
    foot = min((l["y0"] for l in self.lines(i) if l["text"].startswith("©") and l["y0"] > f.y1 - 4), default=None)
    if foot and any(l["y0"] < f.y1 < l["y1"] and not footer(l) for l in self.lines(i)):
        self._frame[i] = f = pymupdf.Rect(f.x0, f.y0, f.x1, foot + 0.8)
    return f


cp.Doc.__init__, cp.Doc.frame = doc_init, doc_frame
_lines = cp.Doc.lines


def lines(self, i):
    got = _lines(self, i)
    if "-ms-" not in os.path.basename(self.doc.name):
        return got
    for n, l in enumerate(got):
        if l["text"].strip() == "Question" and cp.bold(l["spans"][0]) and l["x1"] - l["x0"] < 70:
            # (only on a page with such a label: widened over a multiple-choice key, the column took "(c) Shaping" for one)
            out = [o["x1"] for o in got if SUB.fullmatch(o["text"].strip()) and l["x1"] + 10 <= o["x0"] < l["x1"] + 40]
            if out:
                got[n] = {**l, "x1": max(out)}
    return got


cp.Doc.lines = lines
MARKS = re.compile(r"\[(\d{1,2})\]")


def marks_in(doc, pieces):
    """cut_ocr_cs's count, with a table's other cells: a table can give each cell its own mark, set level with
    the one at the margin (January 2025's 13(a), 6 marks, read as 3)."""
    total, found = 0, False
    for pg, rect in pieces:
        inside = [l for l in doc.lines(pg) if rect.x0 <= l["x0"] and rect.y0 <= l["y0"] <= rect.y1]
        margin = [l for l in inside if MARKS.search(l["text"]) and l["x1"] > rect.x1 - 45]
        for l in inside:
            if l in margin:
                total += int(MARKS.search(l["text"]).group(1))
            elif MARKS.fullmatch(l["text"].strip()) and any(abs(o["y0"] - l["y0"]) < 2 for o in margin):
                total += int(l["text"].strip()[1:-1])
            else:
                continue
            found = True
    return total if found else None


cp.marks_in = marks_in
_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """A first sub-part keeps its own start, as cut_ocr_cs keeps a later one's: "(i) AF ……" (no word of three
    letters) or "(i)" over a drawn line (January 2025's 16(a)(i) and (b)(i)) read as empty, so its crop was its
    part's opening words alone. And each multiple-choice question carries its letter."""
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    by_key = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        by_key[(q, letter, roman)] = cp.region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)
    for p in parts:
        m = cut_ocr_gcse_cs.LABEL.match(p["label"])
        q, letter, roman = int(m.group(1)), m.group(2), m.group(3)
        own = by_key.get((q, letter, roman), [])
        if roman == "i" and own and not cp.has_content(qp, *own[0]):
            lead = [x for x in by_key.get((q, letter, None), []) if cp.has_content(qp, *x)]
            keep = lead + own[:1] + [x for x in own[1:] if cp.has_content(qp, *x)]
            img = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in keep])
            cp.save(img, p["qp"])
            p["w"], p["h"] = img.width, img.height
            words = " ".join(qp.text(pg, r) for pg, r in own)
            p["text"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", p["text"] + " " + words)).strip()[:1500]
        if p["part"] is None and p["marks"] == 1 and q <= 10:
            k = KEY.search(p.get("msText", "")[:160])
            if k:
                p["key"] = k.group(1).upper()
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
