"""Cut OCR's GCSE Economics (J205) papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/ocr_gcse_economics/cut_ocr_gcse_economics.py [work-dir] [--only=j20501-jun24]
    # work-dir: .work/ocr-gcse-economics (fetch_ocr_gcse_economics.py); needs: pip install pymupdf pillow

The GCSE papers are set like OCR's A-Level Economics, so ocr_economics/cut_ocr_economics.py (and
through it edexcel_sciences/cut_pearson.py) does the work, used here as a library, unchanged.
Section A is twenty multiple-choice questions, whose scheme is a key table ("Question | Key | AO"):
each part's key is read from it. Section B is three questions, each opening with its extract
("21  Extract 1  The oil market", a table or graph, then (a) to (d)(iii)): the question's own
region, from its number to (a), is the stem every part of it shows. What differs from the A-Level
is set here, for this run only:
  - an "Extract 1" heading is never case material of its own, as the A-Level's Paper 3 extracts are:
    on the GCSE it always follows its question's number, sometimes on a line of its own (J205/02
    June 2024), where the A-Level reader took it for a block before the next question, so Question 21
    lost its extract to Question 22. Only a section heading ends a question's region;
  - a part ends at its marks: "Answer = £ ........ [2]" is the part's last line, not the working
    space and "Question continues on the next page" below it.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <component>-<series>-<question>[-<part>]: "j20501-jun24-21-di".
"""
import os, re, sys

import pymupdf
from PIL import ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-gcse-economics"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_economics"))
import cut_ocr_economics as econ  # noqa: E402

cp = econ.cp
_markers, _shown = econ.markers, econ.shown


def markers(doc, end_page):
    return [m for m in _markers(doc, end_page) if m[2] == "section"]


def shown(doc, pieces):
    """The A-Level's reading (down to the first answer line), then nothing below the line the marks are on."""
    out = _shown(doc, pieces)
    seq = [(n, l) for n, (pg, r) in enumerate(out) for l in doc.lines(pg) if cp.inside(l, r)]
    last = max(((n, l) for n, l in seq if econ.MARK_LINE.search(l["text"]) and l["x1"] > out[n][1].x1 - 60),
               key=lambda e: (e[0], e[1]["y1"]), default=None)
    if not last:
        return out
    n, l = last
    pg, r = out[n]
    # down to the foot of the answer box beside "Your answer", which can sit lower than the line's text and past the
    # frame's foot; and above the next thing printed: the page's footer too, unless a box runs down beside it (the
    # footer is painted out of the page: crop, below)
    boxes = [d["rect"].y1 for d in cp.drawings(doc.doc[pg]) if d["rect"].height < 40 and d["rect"].y0 < l["y1"] and d["rect"].y1 > l["y0"]]
    bottom = max([l["y1"] + 4] + [y + 2 for y in boxes]) if boxes else min(l["y1"] + 4, r.y1)
    below = [s["bbox"][1] for b in doc.doc[pg].get_text("dict")["blocks"] for k in b.get("lines", []) for s in k["spans"]
             if s["text"].strip() and not (boxes and FOOTER.search(s["text"])) and s["bbox"][1] > l["y1"] - 2
             and s["bbox"][0] < r.x1 and s["bbox"][2] > r.x0]
    return out[:n] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(bottom, min(below, default=bottom + 1) - 1)))]


_crop = cp.Doc.crop
FOOTER = re.compile(r"© OCR \d{4}|Turn over")


def crop(self, i, rect):
    """A question paper's page with its footer painted out: "Turn over" can sit level with the last answer line
    (J205/01 June 2023 21(c) and 22(c)), its letters a point below the dots and the [6], too close to cut between."""
    if i not in self._img and "-qp-" in os.path.basename(self.doc.name):
        _crop(self, i, rect)
        page, draw = self.doc[i], ImageDraw.Draw(self._img[i])
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if FOOTER.search(s["text"]) and s["bbox"][1] > page.rect.height - 80:
                        x0, y0, x1, y1 = s["bbox"]
                        draw.rectangle([round(v * cp.SCALE) for v in (x0, y0 + 0.3 * s["size"], x1, y1)], fill=(255, 255, 255))
    return _crop(self, i, rect)


_lines = cp.Doc.lines
LETTER, ROMAN = re.compile(r"\([a-h]\)"), re.compile(r"\([ivx]{1,4}\)")
SIDE_ROMAN = re.compile(r"(\([ivx]{1,4}\))\*?(?=\s|$)")
GRID = re.compile(r"ASSESS?MENT OBJECTIVES? (\(AO\) )?GRID", re.I)


GRID_END = re.compile(r"^(Total:|Paper Total|PAPER TOTAL|Section [AB] total:)", re.I)


def grid(doc):
    """(page, [(y0, y1)…]): the scheme's assessment-objective grid, its first page and the bands it covers there
    (the table, from its first "AO1a … AO3b  Total" header to its last total, and the heading "J205/01 Assessment
    Objective (AO) grid"). Every page after is the grid's too. Not always below the last answer: J205/01 June 2022
    sets the grid at the top of the page and question 23(d)(iii)'s last row under it, with the heading at the foot."""
    if not hasattr(doc, "_grid"):
        doc._grid = None
        for i in range(len(doc.doc)):
            got = [(l["bbox"], "".join(s["text"] for s in l["spans"]).strip())
                   for b in doc.doc[i].get_text("dict")["blocks"] for l in b.get("lines", [])]
            heads = [r for r, t in got if GRID.search(t)]
            tops = [r[1] for r, t in got if t == "AO3b" and any(u == "Total" and abs(q[1] - r[1]) < 8 for q, u in got)]
            if not heads and not tops:
                continue
            bands = [(r[1] - 2, r[3] + 2) for r in heads]
            if tops:
                ends = [r[3] for r, t in got if GRID_END.match(t) and r[1] > min(tops)]
                bands.append((min(tops) - 10, max(ends) + 4 if ends else doc.doc[i].rect.height))
            doc._grid = (i, bands)
            break
    return doc._grid


def off_grid(doc, pieces):
    """A scheme row's pieces less the grid."""
    g = grid(doc)
    if not g:
        return pieces
    out = []
    for pg, r in pieces:
        if pg > g[0]:
            continue
        rest = [r]
        if pg == g[0]:
            for y0, y1 in g[1]:
                rest = [s for q in rest for s in (pymupdf.Rect(q.x0, q.y0, q.x1, min(q.y1, y0)), pymupdf.Rect(q.x0, max(q.y0, y1), q.x1, q.y1))
                        if s.y1 > s.y0 + 6]
        out += [(pg, s) for s in rest]
    return out


_ms_tables = cp.ms_tables


COLUMN_HEAD = {"Question", "Answer", "Mark", "Marks", "Guidance", "Indicative content"}
ROW_LABEL = re.compile(r"\d{1,2}\*?|\([a-h]\)( \([ivx]{1,4}\))?\*?|\([ivx]{1,4}\)\*?")


def carried_over(doc, ms):
    """A row's last cell carried over the page, above the next row ("N.B. Any other relevant points…" at the top of
    J205/01 November 2021's page 20, over 23(d)(i)), goes back to its own row: the cutter starts a row at the header
    over it, and gave that cell to the row below."""
    order = sorted((k for k in ms if ms[k][0]), key=lambda k: (ms[k][0][0][0], ms[k][0][0][1].y0))
    for prev, k in zip(order, order[1:]):
        pieces, text, ans = ms[k]
        pg, r = pieces[0]
        if ms[prev][0][-1][0] != pg - 1:
            continue
        inside = sorted((l for l in doc.lines(pg) if cp.inside(l, r)), key=lambda l: (l["y0"], l["x0"]))
        label = next((l for l in inside if l["x0"] < 150 and ROW_LABEL.fullmatch(l["text"].strip())), None)
        if not label:
            continue
        head = max((l["y1"] for l in inside if l["text"].strip() in COLUMN_HEAD and l["y0"] < label["y0"]), default=r.y0)
        above = [l for l in inside if l["y0"] > head and l["y1"] < label["y0"] - 1]
        if not above:
            continue
        rules = [y for y in cp.table_rules(doc[pg]) if max(l["y1"] for l in above) - 1 < y <= label["y0"] + 1]
        top = max(rules, default=label["y0"] - 4)
        moved, kept = (pg, pymupdf.Rect(r.x0, r.y0, r.x1, top)), (pg, pymupdf.Rect(r.x0, top, r.x1, r.y1))
        p_pieces = ms[prev][0] + [moved]
        ms[prev] = (p_pieces, re.sub(r"\s+", " ", " ".join(doc.text(*x) for x in p_pieces)), ms[prev][2])
        ms[k] = ([kept] + pieces[1:], re.sub(r"\s+", " ", " ".join(doc.text(*x) for x in [kept] + pieces[1:])), ans)
    return ms


def ms_tables(doc):
    return carried_over(doc, {k: (off_grid(doc, pieces), text, ans) for k, (pieces, text, ans) in _ms_tables(doc).items()})


def lines(self, i):
    """A scheme page as the cutter should read it:
      - nothing from the assessment-objective grid on, whose "(d) (i)  2  2" rows aren't answers (J205/02 June
        2025's 23(d)(i) and (ii) were cut from it);
      - a "(d)" with its "(i)" on the line below (J205/02 June 2022 and November 2021) reads as one label,
        "(d) (i)": apart, the cutter took "(d)" for a row of its own, and (d)(i)'s crop was its question with no answers;
      - so does a "(d)" with its "(i)" in a column of its own to the right (J205/02 June 2025), past the label
        column the cutter reads under "Question", where (d)(ii) and (d)(iii) went unread and took (d)'s row.
        "(iii)* Evaluate the benefits…" set as one line gives up its label and keeps the rest as answer text."""
    fresh = i not in self._lines
    out = _lines(self, i)
    if not fresh or "-ms-" not in os.path.basename(self.doc.name):
        return out
    g = grid(self)
    if g and i >= g[0]:
        out = [l for l in out if i == g[0] and not any(y0 <= (l["y0"] + l["y1"]) / 2 <= y1 for y0, y1 in g[1])]
    for a in [l for l in out if LETTER.fullmatch(l["text"].strip()) and l["x0"] < 150]:
        b = next((l for l in out if ROMAN.fullmatch(l["text"].strip()) and abs(l["x0"] - a["x0"]) < 4 and -6 <= l["y0"] - a["y1"] < 4), None)
        beside = next((l for l in out if abs(l["y0"] - a["y0"]) < 3 and 0 < l["x0"] - a["x1"] < 70
                       and SIDE_ROMAN.match(l["text"].strip())), None) if not b else None
        rest = None
        if beside:
            m = SIDE_ROMAN.match(beside["text"].strip())
            b, tail = beside, beside["text"].strip()[m.end():].strip()
            if tail:
                w = (beside["x1"] - beside["x0"]) / max(len(beside["text"].strip()), 1)
                rest = {**beside, "text": tail, "x0": beside["x0"] + w * m.end(), "spans": [{**beside["spans"][0], "text": tail}]}
            b = {**b, "text": m.group(1)}
        if b:
            out[out.index(a)] = {**a, "text": f"{a['text'].strip()} {b['text'].strip()}", "x1": max(a["x1"], b["x1"]),
                                 "spans": [{**a["spans"][0], "text": f"{a['text'].strip()} {b['text'].strip()}"}]}
            out = [l for l in out if l is not (beside or b)] + ([rest] if rest else [])
    out = self._lines[i] = sorted(out, key=lambda l: (round(l["y0"]), l["x0"]))
    return out


econ.markers, econ.shown, cp.Doc.lines, cp.Doc.crop, cp.ms_tables = markers, shown, lines, crop, ms_tables

if __name__ == "__main__":
    cp.main()
