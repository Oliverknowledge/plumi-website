"""Cut OCR's A-Level Religious Studies papers into questions, each paired with its mark scheme.

    python3 scripts/question-bank/ocr_rs/cut_ocr_rs.py [work-dir] [--only=h57301-jun24]
    # work-dir: .work/ocr-rs (fetch_ocr_rs.py); needs: pip install pymupdf pillow

Each H573 paper is four 40-mark essays ("1* 'Examples of mystical experiences…' Discuss. [40]"), any
three answered, set and marked like OCR Law's essays. So ocr_law/cut_ocr_law.py does the work, used
here as a library, unchanged (it in turn runs edexcel_sciences/cut_pearson.py): it finds each
question's scheme by its number and opening words, and reads the examiners' reports' "Question 1*".
What differs is set here, for this run only:
  - where a scheme stops. The indicative content ("1. 'Examples of…' Discuss. [40]  AO1 Candidates
    may demonstrate…") runs on to the next question's, but the last question's also stops at the
    levels grids ("Level (Mark)", "Levels of Response for A Level Religious Studies: Assessment
    Objective 1"), the marking instructions ("MARKING INSTRUCTIONS – FOR MARKING ON-SCREEN"), OCR's back page and
    the notes for examiners ("Information and instructions for examiners"), which OCR sets after the
    content in some years and before it in others;
  - the levels grids. Every question is marked on the same two grids, AO1 out of 16 and AO2 out of
    24, a page or two each, so both are added under each question's indicative content: the pages
    from the AO1 grid's first band "(14–16)" to the AO2 grid's last "(1–4)".
Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <work-dir>/parts.json in cut_pearson.py's shape.
Ids are <component>-<series>-<question>: "h57301-jun24-01".
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-rs"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_law"))
import cut_ocr_law as law  # noqa: E402  (patches cut_pearson, which reads the work dir and --only)

cp = law.cp
law.MS_END = re.compile(law.MS_END.pattern[:-5] + r"|Level|Levels of Response for A Level.*|MARKING INSTRUCTIONS.*"
                        r"|Information and instructions for examiners)\s*$")
# Pages a scheme stops at: the marking instructions, and OCR's back page (November 2021's is its address, "OCR Customer
# Contact Centre", which cut_pearson's BACK_PAGE doesn't know).
INSTRUCTIONS = re.compile(r"MARKING INSTRUCTIONS|Information and instructions for examiners|OCR Customer Contact Centre|Need to get in touch\?")
BAND = re.compile(r"\((\d{1,2})\s*[–-]\s*(\d{1,2})\)")


def bands(doc, i):
    return {(int(a), int(b)) for a, b in BAND.findall(doc[i].get_text())}


def grids(doc):
    """[(page, rect)]: the AO1 and AO2 levels grids, from the AO1 grid's top band to the AO2 grid's last."""
    first = next((i for i in range(len(doc)) if (14, 16) in bands(doc, i)), None)
    if first is None:
        return []
    ao2 = next((i for i in range(first, len(doc)) if (21, 24) in bands(doc, i)), None)
    last = next((i for i in range(ao2, len(doc)) if (1, 4) in bands(doc, i)), None) if ao2 is not None else None
    if last is None:
        return []
    out = []
    for i in range(first, last + 1):
        box = law.page_box(doc, i)
        # The grid can end part way down its last page, with the marking instructions under it.
        stop = next((l["y0"] for l in doc.lines(i) if l["y0"] > box.y0 + 20 and re.match(r"MARKING INSTRUCTIONS|Information and instructions", l["text"].strip())), None)
        out.append((i, pymupdf.Rect(box.x0, box.y0, box.x1, stop - 4 if stop else box.y1)))
    return out


_says = law.says


def says(lines, k, want):
    """The Law reader's test, or the same with each word read by its first four letters: the November 2021
    Buddhism scheme heads Question 2 "Asses the claim…"."""
    if _says(lines, k, want):
        return True
    got = law.words(re.sub(r"^\s*(Question\s*|Q)?\d{1,2}\*?\.?", "", lines[k]["text"]))
    for l in lines[k + 1:k + 8]:
        got += law.words(l["text"])
    head, got = [w[:4] for w in want[:6]], [w[:4] for w in got[:40]]
    return bool(head) and head[0] in got[:3] and sum(w in got for w in head) >= min(4, len(head))


law.says = says


class Hidden:
    """A scheme with some pages' lines hidden from the Law reader's search for question headings: the
    levels grids number their levels at the left ("2", "1"), and the marking instructions their points ("1.")."""

    def __init__(self, doc, hide):
        self.doc, self.hide = doc, hide

    def __getattr__(self, name):
        return getattr(self.doc, name)

    def __getitem__(self, i):
        return self.doc[i]

    def __len__(self):
        return len(self.doc)

    def lines(self, i):
        return [] if i in self.hide else self.doc.lines(i)


_ms_tables = law.ms_tables


def ms_tables(doc):
    """The Law reader's schemes, each with the levels grids under it."""
    grid = grids(doc)
    if not grid:
        print("  no levels grids found", file=sys.stderr)
    after = {i for i, _ in grid} | {i for i in range(len(doc)) if INSTRUCTIONS.search(doc[i].get_text())}
    out = _ms_tables(Hidden(doc, after))
    # A scheme also stops at a page the grids or instructions start at the very top of, where the Law reader doesn't look.
    for k, (pieces, text, ans) in out.items():
        own = []
        for i, r in pieces:
            if i in after and (own or i != pieces[0][0]):
                break
            own.append((i, r))
        out[k] = (own + grid, " ".join(doc.text(i, r) for i, r in own) if len(own) < len(pieces) else text, ans)
    return out


cp.ms_tables = ms_tables

if __name__ == "__main__":
    cp.main()
