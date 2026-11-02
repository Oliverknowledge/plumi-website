"""Cut Pearson Edexcel's International GCSE Islamic Studies (4IS1) paper into question parts, each with its scheme rows.

    python3 scripts/question-bank/edexcel_igcse_islamic/cut_igcse_islamic.py [work-dir] [--only=4is101-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-igcse-islamic

edexcel_sciences/cut_pearson.py --extracts does the work (a long answer is cut to its marks, not its pages of
answer lines). What 4IS1 adds, patched in here so no other bank's crops move:
  - The paper's text layer sets a control character (BEL, \\x07) between a label and its words, "1 \\x07(a) \\x07Identify",
    and its marks come out mirrored, ")12(", from the right-to-left setting the Arabic passages need. Both are
    read as typeset: "1 (a) Identify", "(12)".
  - Each question's 12-mark part is set on a passage from the Qur'an or the Hadith, printed above its label,
    in Arabic with the English under it ("[Qur'an 97:1-5]", "[Hadith]"). The part starts at the passage: from the
    first line under the part before's answer lines (or the page's top), on the label's page or the page before.
    The passage's Arabic stays in the crop but leaves the search text, which its text layer can't give.
  - Schemes: a row carried over a page runs to its column rules' foot; a levels grid's "0 | No rewardable
    material" is not a label; the company notice under the last table is left out.
  - The 2024 and 2025 examiner's reports set "ti", "tt", "ft" as glyphs of their own ("QuesƟon"): spelt out.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-igcse-islamic"),
                *[a for a in sys.argv[1:] if a.startswith("--")], "--extracts"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

ARABIC = re.compile(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")
CITED = re.compile(r"\[(Qur.an|Hadith|Surah)[^\]]*\]\s*$", re.I)
_lines, _qp_labels = cp.Doc.lines, cp.qp_labels


def lines(self, i):
    if i not in self._lines:
        out = []
        for l in _lines(self, i):
            text = re.sub(r"\s+", " ", l["text"].replace("\x07", " ")).strip()
            text = re.sub(r"^\)(\d{1,2})\($", r"(\1)", text)
            out.append({**l, "text": text, "spans": [{**s, "text": s["text"].replace("\x07", " ")} for s in l["spans"]]})
        # A levels grid's "0 | No rewardable material" row, its "0" set close enough to the Question column to read
        # as a label (which ended the row there, the grid lost): read as "· 0".
        for k, l in enumerate(out):
            if l["text"] == "0" and any(abs(o["y0"] - l["y0"]) < 4 and o["text"].startswith("No rewardable") for o in out):
                out[k] = {**l, "text": "· 0"}
        self._lines[i] = out
    return self._lines[i]


def answer_line(l):
    return re.fullmatch(r"[.…\s]{6,}", l["text"]) is not None


def passage(doc, pg, y):
    """Where the passage over a part's label starts, (page, y), or None: the run of lines above the label, back to
    the part before's answer lines, its marks or the page's top, when it cites the Qur'an or the Hadith."""
    f = doc.frame(pg)
    above = [l for l in doc.lines(pg) if f.y0 - 4 <= l["y0"] < y - 2 and cp.inside(l, f)]
    run = []
    for l in reversed(above):
        if answer_line(l) or re.fullmatch(r"\(\d{1,2}\)", l["text"]) or cp.STOP.match(l["text"]):
            break
        run.insert(0, l)
    at = (pg, run[0]["y0"]) if run else None
    if not run or len(run) == len(above):
        # The passage can start at the foot of the page before, the label's page opening part-way through it.
        g = doc.frame(pg - 1)
        prev = [l for l in doc.lines(pg - 1) if cp.inside(l, g)]
        tail = []
        for l in reversed(prev):
            if answer_line(l) or re.fullmatch(r"\(\d{1,2}\)", l["text"]) or cp.STOP.match(l["text"]):
                break
            tail.insert(0, l)
        if tail and len(tail) < len(prev):
            run, at = tail + run, (pg - 1, tail[0]["y0"])
    said = " ".join(l["text"] for l in run)
    return at if run and (CITED.search(said) or ARABIC.search(said)) else None


PASSAGES = {}  # id(doc): {(page, label y): (page, passage y)}


def qp_labels(doc):
    """The labels stay where they are printed (with --extracts, a part's label line away from its label reads as the part
    printed again, which ends it); region() starts a part at its passage, and ends the part before there."""
    labels, end_page = _qp_labels(doc)
    found = {}
    for pg, y, q, letter, roman in labels:
        at = passage(doc, pg, y) if letter else None
        if at:
            found[(pg, y)] = (at[0], at[1] - 2)
    PASSAGES[id(doc)] = found
    return labels, end_page


def region(doc, start, end, end_page):
    found = PASSAGES.get(id(doc), {})
    return _region(doc, found.get(start, start), found.get(end, end) if end else end, end_page)


def ms_page_box(doc, p):
    """cut_pearson's box, run down to the foot of the table's column rules: a row that carries over a page has no
    rule under it, only its columns' sides (June 2023's 2(b) lost all but its header and label without this). And
    never into the company notice under the last table ("Pearson Education Limited. Registered company number…")."""
    box = _ms_page_box(doc, p)
    page = doc[p]
    sides = [r.y1 for r in (d["rect"] * page.rotation_matrix for d in cp.drawings(page)) if r.width < 3 and r.height > 30 and r.y0 < box.y1]
    y1 = min(page.rect.height - 4, max([box.y1] + [y + 2 for y in sides]))
    notice = [l["y0"] for l in doc.lines(p) if box.y0 < l["y0"] < y1 and re.match(r"Pearson Education Limited", l["text"])]
    return cp.pymupdf.Rect(box.x0, box.y0, box.x1, min([y1] + [y - 6 for y in notice]))


def has_content(doc, pg, rect):
    """A piece holding only a passage's Arabic lines (one that starts at the foot of a page) is content too."""
    return _has_content(doc, pg, rect) or bool(ARABIC.search(doc.text(pg, rect)))


# The 2024 and 2025 reports' font sets letter pairs as single glyphs, "QuesƟon 1", "oŌen", "maƩer", "geƫng":
# read as letters, or no "Question" heading is found and the report is lost.
LIGATURES = str.maketrans({"Ɵ": "ti", "Ʃ": "tt", "ƫ": "tti", "Ō": "ft", "ﬁ": "fi", "ﬀ": "ff", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl"})


class _Reports:
    """pymupdf for examiner_report(): pages whose text has its ligatures spelt out."""

    def open(self, path):
        return [type("Page", (), {"get_text": lambda self, t=p.get_text(): t.translate(LIGATURES)})() for p in _pymupdf.open(path)]


def examiner_report(path, section=None):
    cp.pymupdf = _Reports()
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = _pymupdf


_ms_page_box, _has_content, _region, _examiner_report, _pymupdf = cp.ms_page_box, cp.has_content, cp.region, cp.examiner_report, cp.pymupdf
cp.Doc.lines, cp.qp_labels, cp.region, cp.ms_page_box, cp.has_content = lines, qp_labels, region, ms_page_box, has_content
cp.examiner_report = examiner_report
# The passages' Arabic leaves the search text: its text layer reads in the wrong order, its letters in presentation
# forms ("إمنا األعمال" for "إنما الأعمال"), so a part is searched by the English under it.
cp.BOILER = re.compile(cp.BOILER.pattern + r"|[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿ً-ٟ]+", cp.BOILER.flags)

if __name__ == "__main__":
    cp.main()
