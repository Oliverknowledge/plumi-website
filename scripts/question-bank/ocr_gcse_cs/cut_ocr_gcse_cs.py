"""Cut OCR's GCSE Computer Science (J277) papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/ocr_gcse_cs/cut_ocr_gcse_cs.py [work-dir] [--only=j27702-jun25]
    # work-dir: .work/ocr-gcse-cs (fetch_ocr_gcse_cs.py); needs: pip install pymupdf pillow

J277 is set like OCR's A-Level Computer Science, so computer_science/cut_ocr_cs.py (and through it
edexcel_sciences/cut_pearson.py and its scheme reader) does the work, used here as a library,
unchanged. What differs is set here, for this run only:
  - a part's mark can sit a line above the next part's label, its foot just past the label's top
    ("[2]" at 346 to 361, "(d)" at 359): the cutter read it as a tall line the label sits beside
    (a column vector's), so the next part's crop started above it, taking the mark with it. A mark
    alone at the right margin never moves a label's top;
  - a scheme can set a sub-part's label and its answer as one line, "(iii) difference = …": the
    label is read on its own, as the scheme reader expects;
  - the examiners' reports head an extended response "Question 6*" and two parts reported
    together "Question 7 (a) and (b)": both are read as headings;
  - a part's text is cut at 1,500 characters: after a long stem its own words keep their place;
  - the sample papers (2019) set their pages 30pt further in, and the extended response's
    number "11 *" with a space: their frame starts at their text, and the number is read as "11*";
    their schemes set each label at its row's top, never centred.
Scheme rows the scheme misnumbers are set in scripts/question-bank/labels/<set>.json (ms_alias).
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <component>-<series>-<question>[-<part>]: "j27702-jun25-03-a".
"""
import os, re, sys, types

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-gcse-cs"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
import cut_pearson as cp  # noqa: E402  (reads the work dir and --only from the command line)

MARK_ALONE = re.compile(r"^\[\d{1,2}\]$")
SUB_LABEL = re.compile(r"^\(([a-n]|[ivx]{1,4})\)\s*$")
_raw_lines = cp.Doc.lines


STARRED = re.compile(r"^(\d{1,2}) \*\s*$")


def raw_lines(self, i):
    """A scheme's "(iii) difference = …" read as the label "(iii)" and its answer beside it, and the
    sample paper's extended response "11 * People often…" as "11* People often…", as the live papers set it."""
    fresh = i not in self._lines
    got = _raw_lines(self, i)
    if fresh and "-qp-" in os.path.basename(self.doc.name):
        for n, l in enumerate(got):
            m = STARRED.match(l["spans"][0]["text"])
            if m:
                got[n] = {**l, "spans": [{**l["spans"][0], "text": m.group(1) + "*"}] + l["spans"][1:],
                          "text": re.sub(r"^(\d{1,2}) \*", r"\1*", l["text"])}
    if not fresh or "-ms-" not in os.path.basename(self.doc.name):
        return got
    if os.path.basename(self.doc.name).endswith("-ms-spec.pdf"):
        # The sample schemes set every label at its row's top: cut_ocr_cs's reading of a label
        # centred down a tall row (where its rules aren't found) moved "6" up into 5(c)'s row.
        self._cs_centred = False
    out = []
    for l in got:
        s = l["spans"]
        if len(s) > 1 and l["x0"] < 170 and SUB_LABEL.match(s[0]["text"]) and s[1]["bbox"][0] - s[0]["bbox"][2] > 4:
            out.append({**l, "x1": s[0]["bbox"][2], "spans": s[:1], "text": s[0]["text"].strip()})
            rest = " ".join(x["text"] for x in s[1:])
            out.append({**l, "x0": s[1]["bbox"][0], "spans": s[1:], "text": re.sub(r"\s+", " ", rest).strip()})
        else:
            out.append(l)
    self._lines[i] = out
    return out


cp.Doc.lines = raw_lines  # before cut_ocr_cs wraps it
import cut_ocr_cs  # noqa: E402,F401  (its patches to cp)

_frame = cp.frame  # cut_ocr_cs's


def frame(page):
    """The sample paper (2019) sets its whole page 30pt further in than the live papers, its question
    numbers at 70 where the frame (the page's drawn margin) starts at 40: the cutter looks for them
    within 16pt of the frame. Its frame starts at its text. (Only its: a live paper's page can have
    nothing at its margin, and its crops keep the frame's width.)"""
    f = _frame(page)
    if not os.path.basename(page.parent.name).endswith("-qp-spec.pdf"):
        return f
    xs = [s["bbox"][0] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
          if s["text"].strip() and f.y0 <= s["bbox"][1] <= f.y1]
    if xs and min(xs) > f.x0 + 16:
        f = pymupdf.Rect(min(xs) - 6, f.y0, f.x1, f.y1)
    return f


cp.frame = frame
_label_top = cp.label_top


def label_top(doc, pg, y):
    marks = [l for l in doc.lines(pg) if MARK_ALONE.match(l["text"]) and l["x1"] > doc.frame(pg).x1 - 45]
    if not marks:
        return _label_top(doc, pg, y)
    lines = doc.lines(pg)
    doc._lines[pg] = [l for l in lines if l not in marks]
    try:
        top = _label_top(doc, pg, y)
    finally:
        doc._lines[pg] = lines
    # (and the cut falls in the 3pt of white between the mark's ink and the label's: the mark's
    # ink ends 1.5-2.5pt above its box's foot, the label's starts 3pt below its box's top)
    for m in marks:
        if m["y0"] < top < m["y1"]:
            top = (m["y1"] + y) / 2 + 0.75
    return top


cp.label_top = label_top
_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    """cut_pearson's reader, on the report's text without OCR's back pages ("Supporting you"), with the
    headings J277's reports write their own way put as it reads them: an extended response's
    "Question 6*" as "Question 6", and two parts reported together, "Question 7 (a) and (b)", as
    "Question 7 (a–b)" (ocr_economics/cut_ocr_economics.py does the same for its reports)."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.split(r"\n[ \t]*Supporting you[ \t]*\n", text)[0]
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2}(?:\s*\(\s*[a-z]{1,4}\s*\))*)[ \t]*\*[ \t]*(?=\n)", r"\n\1", text)
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2})\s*\(([a-z]{1,4})\)\s*and\s*\(([a-z]{1,4})\)[ \t]*(?=\n)", r"\n\1 (\2–\3)", text)
    real = cp.pymupdf
    cp.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = real


cp.examiner_report = examiner_report
_cut_set = cp.cut_set  # cut_ocr_cs's
LABEL = re.compile(r"^(\d{1,2})(?:\(([a-z])\))?(?:\(([ivx]{1,4})\))?$")
TEXT_CAP = 1500  # cut_pearson's and cut_ocr_cs's


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """A part's text (search, tagging, its one-line summary) is its stem, its lead and then its own words,
    cut at 1,500 characters: after a long stem (June 2023 Paper 2's question 6, a page of tables and code)
    the cut took the part's own words. Those keep their place at the end; the stem gives way."""
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    long = [p for p in parts if len(p["text"]) >= TEXT_CAP]
    if not long:
        return parts
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    regions = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        regions[(q, letter, roman)] = cp.region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)
    for p in long:
        m = LABEL.match(p["label"])
        own = " ".join(qp.text(pg, r) for pg, r in regions.get((int(m.group(1)), m.group(2), m.group(3)), []))
        own = re.sub(r"\s+", " ", cp.BOILER.sub(" ", own)).strip()
        if own and own[:60] not in p["text"]:
            p["text"] = (p["text"][:max(0, TEXT_CAP - len(own) - 1)] + " " + own).strip()
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
