"""Cut OCR's A-Level Physical Education (H555) written papers into question parts, each with its mark scheme.

    python3 scripts/question-bank/ocr_pe/cut_ocr_pe.py [work-dir] [--only=h55501-jun24]
    # work-dir: .work/ocr-pe (fetch_ocr_pe.py); needs: pip install pymupdf pillow

OCR's Physical Education papers are typeset like its sciences and Economics (questions with parts
"(a)", "(b)(i)", answer lines, a ruled mark scheme table, levels-marked 20 and 10 mark essays "9*"
and "8*"), so ocr_economics/cut_ocr_economics.py does the work, used here as a library, unchanged.
Nothing in Physical Education is set on case material, so no part has a stem: the images, graphs and
tables a question prints are part of its own crop. What this adds, for this run only, is the
mark scheme and report slips of a few series:
  - a scheme's part label printed in its own column apart from the question's number: "a" in bold
    at the column's far side (Paper 2 June 2025), "a)" and "b)" there (Paper 3 June 2025), "[c] ii"
    for "(c)(ii)" (Paper 3 November 2021) are read as "(a)", "(b)", "(c)(ii)";
  - a sub-part's "(i)", "(ii)" set in a column of its own just past the span of the "Question" header
    (Paper 1 June 2022 and 2023, Paper 2 June 2022, 2024 and 2025): read as in the column, so each sub-part has
    its own row, not its part's whole table;
  - an essay's levels grid headed "9." (Paper 1 June 2023) is the essay's: the part before it no longer runs on into it;
  - Paper 2 November 2021 question 5's "a" and "b" sit beside its two tables, in a row of "Two marks from:": they aren't
    read as rows of their own, and labels/h55502-nov21.json shows the row for both parts;
  - an essay's levels, each row labelled "8*" (Paper 3 June 2024 and 2025), are one row for the essay: its levels and its
    indicative content;
  - an essay's scheme headed "Indicative Content:" then "9*    Section C    20 Marks" on one line
    (Paper 1 June 2023): "9*" is its label;
  - a part's row that holds two parts ("6 (a) i" over both Three marks from tables, Paper 3 June 2023)
    is shown for both: labels/h55503-jun23.json says so, as cut_pearson.py's hand labels do;
  - OCR's copyright boxes (Paper 3 June 2024 and November 2021) are painted out and closed up to a line saying
    the item isn't in OCR's published paper, as ocr_sociology/cut_ocr_sociology.py does for its sources;
  - the top of the "Turn over" line, or the "© OCR" footer, no longer shows under a part's last answer line;
  - reports that head two parts as one: "Question 4 (a) and (b)" is read as Question 4, so both
    parts have it, and it no longer runs into the question before it.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <work-dir>/parts.json in cut_pearson.py's shape.
Ids are <component>-<series>-<question>[-<part>]: "h55501-jun24-07-bi".
"""
import os, re, sys, types

import pymupdf
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-pe"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_economics"))
import cut_ocr_economics as ce  # noqa: E402  (patches cut_pearson, and reads the work dir and --only)

cp = ce.cp
# A part label printed away from the question's number, with brackets of its own or none.
SIDE = re.compile(r"^(?:\(([a-h])\)|\[([a-h])\]|([a-h])\))(?:\s*(i{1,3}|iv|v))?$|^([a-h])$")
SIDE_X = (90, 160)  # (the label column of a scheme whose answers start at 150 or so; a bare "a" must be bold)
ROMAN_SIDE = re.compile(r"^\((i{1,3}|iv|v)\)(?:\s|$)")  # a sub-part's "(ii)" in a column of its own, just past the header's span
ESSAY_HEAD = re.compile(r"^(\d{1,2}\*)\s+(Section [A-C]\b.*)$")
SQUARE = re.compile(r"^\[([a-h])\]\s*(i{1,3}|iv|v)?$")

REMOVED = re.compile(r"removed due to third party copyright|From first line|Link to material", re.I)
NOTE = "This item is not in OCR's published paper: it was removed for copyright reasons."
FONT = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"

# Copyright boxes. OCR leaves a black box and a red line ("Item removed due to third party copyright
# restrictions", Paper 3 June 2024 and November 2021): the box is left out of the page's
# drawings, and in a crop it is painted out and closed up to a line saying the item isn't in OCR's paper.
# (ocr_sociology/cut_ocr_sociology.py's, which does this for its sources.)
_drawings = cp.drawings
_redactions = {}


def redactions(page):
    """OCR's copyright boxes: large rectangles filled black."""
    key = (page.parent.name, page.number)
    if key not in _redactions:
        _redactions[key] = [d["rect"] * page.rotation_matrix for d in _drawings(page)
                            if d.get("fill") and max(d["fill"]) < 0.6 and d["rect"].width > 150 and d["rect"].height > 60]
    return _redactions[key]


def drawings(page):
    """A page's drawings without OCR's copyright boxes, which are neither frames nor figures."""
    reds = redactions(page)
    return [d for d in _drawings(page) if not any(abs((d["rect"] * page.rotation_matrix) - r) < 1 for r in reds)] if reds else _drawings(page)


cp.drawings = drawings
_crop = cp.Doc.crop


def notices(page):
    """The red lines over a copyright box that say what was removed."""
    return [pymupdf.Rect(l["bbox"]) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
            if REMOVED.search("".join(s["text"] for s in l["spans"]))]


def crop(self, i, rect):
    """cut_pearson's crop, with a copyright box painted out and closed up to a line saying so. A crop to the
    page's plain 40pt margin (OCR draws no frame) takes in a little more of it: Paper 2 June 2024's graph
    sets its axis title there."""
    page = self.doc[i]
    if abs(rect.x0 - 40) < 0.5 and abs(rect.x1 - (page.rect.width - 40)) < 0.5:
        rect = pymupdf.Rect(28, rect.y0, page.rect.width - 28, rect.y1)
    reds = redactions(page)
    if not reds:
        return _crop(self, i, rect)
    if i not in self._img:
        _crop(self, i, pymupdf.Rect(0, 0, 10, 10))  # (renders the page)
        img = self._img[i]
        draw = ImageDraw.Draw(img)
        for r in reds + notices(page):
            draw.rectangle([round(v * cp.SCALE) for v in (r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1)], fill="white")
        font = ImageFont.truetype(FONT, round(10.5 * cp.SCALE))
        for r in reds:
            draw.text((round((r.x0 + 12) * cp.SCALE), round((r.y0 + 6) * cp.SCALE)), NOTE, fill=(90, 90, 90), font=font)
    img = _crop(self, i, rect)
    if img is None:
        return None
    # Close up each box below its note.
    cuts = sorted((max(0, round((r.y0 + 26 - rect.y0) * cp.SCALE)), min(img.height, round((r.y1 - rect.y0) * cp.SCALE)))
                  for r in reds if r.y1 > rect.y0 and r.y0 < rect.y1)
    keep, at = [], 0
    for a, b in cuts:
        if b > a and a >= at:
            keep.append((at, a))
            at = b
    if not keep:
        return img
    keep.append((at, img.height))
    pieces = [img.crop((0, a, img.width, b)) for a, b in keep if b > a]
    out = Image.new("RGB", (img.width, sum(p.height for p in pieces)), "white")
    y = 0
    for p in pieces:
        out.paste(p, (0, y))
        y += p.height
    return out


cp.Doc.crop = crop

_shown = ce.shown


def shown(doc, pieces):
    """cut_ocr_economics' crop to the first answer line and its marks, without the top of the "Turn over" or
    "© OCR" line under it."""
    out = []
    for pg, r in _shown(doc, pieces):
        foot = [l["y0"] for l in doc.lines(pg) if re.match(r"(Turn over|© OCR \d{4})", l["text"].strip()) and r.y0 < l["y0"] < r.y1 - 1]
        out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, min([r.y1] + [y + 2 for y in foot]))) if foot else (pg, r))
    return out


ce.shown = shown

_lines = cp.Doc.lines


def ref_head(self):
    """The scheme's "Question" header, as it sits on the pages that have one: where a page's table has none, the
    columns are the same."""
    if not hasattr(self, "_pe_head"):
        found = sorted((r.x0, r.x1) for page in self.doc for r in page.search_for("Question") if 60 < r.y0 < 140 and r.x0 < 200)
        mid = found[len(found) // 2] if found else None
        self._pe_head = [{"x0": mid[0], "x1": mid[1], "y0": -1, "text": "Question"}] if mid else []
    return self._pe_head


def after_first_table(self, i):
    """Whether page i is at or after the scheme's first "Question" header (before it are the marking instructions, whose
    numbered paragraphs, "6.", aren't questions)."""
    first = next((j for j in range(len(self.doc)) if self.doc[j].search_for("Question") and any(r.y0 < 140 and r.x0 < 200 for r in self.doc[j].search_for("Question"))
                  and "Mark Scheme" in self.doc[j].get_text()[:80]), None) if not hasattr(self, "_pe_first") else self._pe_first
    self._pe_first = first
    return first is not None and i >= first


cp.Doc.cut_pe_tables = after_first_table


def lines(self, i):
    """cut_ocr_economics' reading of a page, with the slips above put right on a scheme's page."""
    fresh = i not in self._lines
    got = _lines(self, i)
    if not fresh or "-ms-" not in os.path.basename(self.doc.name):
        return got
    if os.path.basename(self.doc.name) == "h555-02-ms-nov21.pdf" and any("Internal, stable" in l["text"] for l in got):
        got = [l for l in got if l["text"].strip() not in ("a", "b")]  # (question 5's "a" and "b" sit beside its two tables, in the one row of "Two marks from:")
    out = []
    heads = [h for h in got if h["text"].strip() == "Question"] or ref_head(self)  # (a page the table runs on to has no header of its own)
    for l in got:
        t = l["text"].strip()
        above = [h for h in heads if h["y0"] <= l["y0"]]
        beyond = bool(above) and l["x0"] > above[-1]["x1"] + 5  # (past the column the cutter reads labels in)
        m = ESSAY_HEAD.match(l["text"].strip()) if l["x0"] < 60 else None
        if m:
            w = (l["x1"] - l["x0"]) / max(len(l["text"]), 1)
            out.append({**l, "text": m.group(1), "x1": l["x0"] + w * len(m.group(1)), "spans": [{**l["spans"][0], "text": m.group(1)}]})
            out.append({**l, "text": m.group(2), "x0": l["x0"] + w * (len(l["text"]) - len(m.group(2)))})
            continue
        sq = SQUARE.match(t) if l["x0"] < 200 else None
        if sq:
            label = f"({sq.group(1)})" + (sq.group(2) or "")
            out.append({**l, "text": label, "x1": l["x0"] + (l["x1"] - l["x0"]) * len(label) / max(len(t), 1), "spans": [{**l["spans"][0], "text": label}]})
            continue
        if above and ROMAN_SIDE.match(t) and above[-1]["x1"] + 5 < l["x0"] <= above[-1]["x1"] + 30 and cp.bold(l["spans"][0]):
            mates = [o["x1"] for o in got if abs(o["y0"] - l["y0"]) < 3 and o["x0"] < l["x0"] and re.fullmatch(r"\(?[a-h]\)?", o["text"].strip())]
            dx = l["x0"] - (max(mates) + 3 if mates else above[-1]["x0"] + 8)  # (to the right of its letter, where it has one beside it)
            out.append({**l, "x0": l["x0"] - dx, "x1": l["x1"] - dx})
            continue
        if re.fullmatch(r"\d{1,2}\*?\.", t) and l["x0"] < 70 and cp.bold(l["spans"][0]) and self.cut_pe_tables(i):
            out.append({**l, "text": t.rstrip("."), "spans": [{**l["spans"][0], "text": t.rstrip(".")}]})  # an essay's levels grid, headed "9."
            continue
        s = SIDE.match(t) if beyond and SIDE_X[0] <= l["x0"] <= SIDE_X[1] else None
        if s and (s.group(5) is None or cp.bold(l["spans"][0])):
            letter = next(g for g in s.groups()[:3] + (s.group(5),) if g)
            label = f"({letter})" + (s.group(4) or "")
            out.append({**l, "text": label, "x0": 70, "x1": 70 + (l["x1"] - l["x0"]) * len(label) / max(len(t), 1),
                        "spans": [{**l["spans"][0], "text": label}]})
            continue
        out.append(l)
    # An essay's levels, each row labelled "8*" (Paper 3 June 2024 and 2025): the label is read once, so its row
    # runs over the levels and on to the indicative content.
    seen, kept = set(), []
    for l in out:
        t = l["text"].strip()
        if re.fullmatch(r"\d{1,2}\*", t) and l["x0"] < 70:
            if t in seen:
                continue
            seen.add(t)
        kept.append(l)
    self._lines[i] = kept
    return kept


cp.Doc.lines = lines

_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    """cut_ocr_economics' reader on a report whose "Question 4 (a) and (b)" is read as "Question 4"."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in ce.pymupdf.open(path))
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2})\s*\*?\s*\([a-z]\)\s*(?:and|&|,)\s*\([a-z]\)[ \t]*(?=\n)", r"\n\1", text)
    real = ce.pymupdf
    ce.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        return _examiner_report(path, section)
    finally:
        ce.pymupdf = real


cp.examiner_report = examiner_report
if __name__ == "__main__":
    cp.main()
