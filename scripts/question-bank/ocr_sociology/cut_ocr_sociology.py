"""Cut OCR's A-Level Sociology (H580) papers into questions, each with its mark scheme; also Psychology's.

    python3 scripts/question-bank/ocr_sociology/cut_ocr_sociology.py [work-dir] [--only=h58002-jun24]
    # work-dir: .work/ocr-sociology (fetch_ocr_sociology.py); needs: pip install pymupdf pillow

OCR's Sociology papers are set like its Economics: whole questions, some on source material printed
before them ("Read the source material.", Paper 2's Section A), level-marked schemes in OCR's ruled
table. So ocr_economics/cut_ocr_economics.py does the work, used here as a library, unchanged: its case
blocks are the sources, and the questions set on them are named for their block, "h58002-jun24-e1-03",
sharing its stem, "h58002-jun24-e1-stem.webp". ocr_psychology/cut_ocr_psychology.py runs this file on
Psychology's papers, which need the same three things on top:
  - the options. Paper 1's Section B (Sociology) and Paper 3's (both) are "OPTION 1" / "Families and
    relationships" headings, each over its questions: every question under one carries its `option`,
    the first word of the heading ("families"), for build's option papers and filter;
  - the sources OCR leaves out of the published paper for copyright. It prints a black box with a
    line in red ("Item removed due to third party copyright restrictions", "From first line … to last
    line"). The box is left out of the page's drawings, so a page it fills isn't read as an answer frame
    with nothing in it (Paper 2 June 2024's Source B), and in a crop it is painted out and closed up to one
    line saying the source isn't in OCR's published paper, under the source's own heading;
  - Psychology Paper 1's contingency tables label their cells "(a)" to "(d)", two to a row: not parts;
    an essay's scheme headed "Question 22" is labelled 22; a row whose label is set below its top starts at
    the rule above it; and no scheme crop takes in a page's running header, page number or the next
    option's heading; and a part's scheme row printed without its
    question's number ("(a)" alone) runs to the next part's row;
  - Psychology Paper 1's older section headings, "SECTION B: Research design and response", start a block
    as "Section B" does;
  - multiple-choice parts: a part's one-line row in the key ("18(b)  A") gives its letter, as a question's does;
  - the appendices. Most long-answer schemes give their indicative content and say "PLEASE REFER TO
    APPENDIX 3": the levels grid is at the back, one for each kind of question. A scheme takes the
    appendix it names (up to OCR's back cover, its address, "CB2 8EA"), and no scheme runs on into them; the grids' level numbers aren't read as labels;
  - November 2021 Paper 2's scheme heads its first tables "Question Answer" on one line, and Psychology
    Paper 1's multiple-choice key heads its column "Ques": both are headers too, so the questions before
    the scheme's first plain "Question" aren't skipped.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in cut_pearson.py's
shape, with `option` where a question is an option's.
"""
import os, re, sys

import pymupdf
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-sociology"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_economics"))
import cut_ocr_economics as ce  # noqa: E402  (patches cut_pearson, and reads the work dir and --only)

cp = ce.cp
# Psychology Paper 1 before 2023 heads its sections "SECTION B: Research design and response", on one line.
ce.SECTION = re.compile(r"^(SECTION|Section) [A-C](:\s.*)?$")
OPTION = re.compile(r"^OPTION\s+(\d)$", re.I)
END = re.compile(r"^END OF QUESTION PAPER")
REMOVED = re.compile(r"removed due to third party copyright|From first line|Link to material", re.I)
NOTE = "This source is not in OCR's published paper: it was removed for copyright reasons."
FONT = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"


_drawings = cp.drawings
_redactions = {}


def redactions(page):
    """OCR's copyright boxes: large rectangles filled black."""
    key = (page.parent.name, page.number)
    if key not in _redactions:
        _redactions[key] = [d["rect"] * page.rotation_matrix for d in _drawings(page)
                            if d.get("fill") and max(d["fill"]) < 0.1 and d["rect"].width > 150 and d["rect"].height > 60]
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
_is_head = cp.is_head


def is_head(l, lines):
    return _is_head(l, lines) or l["text"].strip() in ("Question Answer", "Ques", "Ques Answer")


cp.is_head = is_head
_lines = cp.Doc.lines


def lines(self, i):
    """A scheme's essay heading "Question 22" (Psychology Paper 1, June 2022) is its label, "22"."""
    got = _lines(self, i)
    if "-ms-" in os.path.basename(self.doc.name):
        for k, l in enumerate(got):
            m = re.fullmatch(r"Question\s+(\d{1,2})\*?", l["text"].strip())
            if m and l["x0"] < 110:
                w = (l["x1"] - l["x0"]) / max(len(l["text"]), 1)
                got[k] = {**l, "text": m.group(1), "x0": l["x1"] - w * len(m.group(1)), "spans": [{**l["spans"][0], "text": m.group(1)}]}
    return got


cp.Doc.lines = lines
_qp_labels = cp.qp_labels


def qp_labels(doc):
    """Not a data table's cells, "(a) (b)" set side by side (Psychology Paper 1's contingency tables): a
    question's parts are never two to a row."""
    labels, end_page = _qp_labels(doc)
    rows = {}
    for pg, y, q, letter, roman in labels:
        if letter and not roman:
            rows.setdefault((pg, round(y / 4)), []).append(letter)
    side = {k for k, v in rows.items() if len(v) > 1}
    return [x for x in labels if not (x[3] and not x[4] and ((x[0], round(x[1] / 4)) in side))], end_page


cp.qp_labels = qp_labels
APPENDIX = re.compile(r"^APPENDIX\s+(\d)$", re.I)
REFER = re.compile(r"REFER\s+TO\s+APPENDIX\s+(\d)", re.I)
_ms_tables = cp.ms_tables


def rules_across(page):
    """{y: how far the page's horizontal rules at that height run in all}: a row's border drawn cell by cell
    adds up to the table's width."""
    ys = {}
    for d in cp.drawings(page):
        r = d["rect"] * page.rotation_matrix
        if r.height < 2.5 and r.width > 3:
            ys[round(r.y0, 1)] = ys.get(round(r.y0, 1), 0) + r.width
    return ys


def ms_tables(doc):
    """Each question's scheme stops before the appendices, and takes the one it refers to ("PLEASE REFER TO
    APPENDIX 3"): the levels grid it is marked by, set at the back once for every question of its kind."""
    ms = _ms_tables(doc)
    # A multiple-choice part's row ("18(b)  A  5", Psychology Paper 1) is a key too.
    for key, (pieces, text, ans) in list(ms.items()):
        if key[1] and not ans and len(pieces) <= 2 and len(re.sub(r"\s+", " ", text)) < 80 and re.search(r"(?<!\w)[A-D](?!\w)", text):
            ms[key] = (pieces, text, ce.answer(doc, pieces[:1]))
    # A row starts at the table's rule above its label, where the label is set lower than the row's top (Psychology
    # Paper 3, November 2021, centres its labels in tall rows): the row before ends there too. (Only rules across the table:
    # a heading's underline isn't a row.)
    moved = {}
    for key, (pieces, text, ans) in ms.items():
        if not pieces:
            continue
        pg, r = pieces[0]
        rules = [y for y, w in rules_across(doc[pg]).items() if w > (r.x1 - r.x0) * 0.6 and y <= r.y0 + 2]
        if rules and max(rules) < r.y0 - 4:
            moved[(pg, round(r.y0))] = max(rules)
    if moved:
        for key, (pieces, text, ans) in list(ms.items()):
            new = []
            for pg, r in pieces:
                top = moved.get((pg, round(r.y0)), r.y0)
                bottom = next((y for (p_, y0), y in moved.items() if p_ == pg and abs(y0 - r.y1) <= 3), r.y1)
                new.append((pg, pymupdf.Rect(r.x0, top, r.x1, bottom)))
            ms[key] = ([x for x in new if x[1].y1 > x[1].y0 + 6], text, ans)
    # A part's row with no number beside its "(a)" (Psychology Paper 3, June 2025, 5(a)) reads as a label with
    # no rows: it runs from that "(a)" to the next part's row.
    for key, (pieces, text, ans) in list(ms.items()):
        if not key[1] and not pieces and (key[0], "b", None) in ms and (key[0], "a", None) not in ms:
            key = (key[0], "a", None)  # (read as the question's own row, "5", with nothing in it)
        nxt = ms.get((key[0], chr(ord(key[1]) + 1), None)) if key[1] and not key[2] and not pieces else None
        if not nxt or not nxt[0]:
            continue
        end = (nxt[0][0][0], nxt[0][0][1].y0)
        at = [(i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i)
              if l["x0"] < 90 and re.fullmatch(rf"\({key[1]}\)\s*\*?", l["text"].strip()) and (i, l["y0"]) < end]
        if at:
            (pg, y), new = at[-1], []
            for i in range(pg, end[0] + 1):
                box = cp.ms_page_box(doc, i)
                top, bottom = (y - 4 if i == pg else box.y0), (end[1] if i == end[0] else box.y1)
                if bottom > top + 8:
                    new.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
            ms[key] = (new, " ".join(doc.text(i, r) for i, r in new), ans)
    heads = sorted((i, l["y0"], int(m.group(1))) for i in range(len(doc)) for l in doc.lines(i)
                   if (m := APPENDIX.match(l["text"].strip())) and l["x0"] < 80 and l["y0"] < 100)
    if not heads:
        return tidy(doc, ms)
    last = next((i for i in range(heads[0][0], len(doc)) if (cp.BACK_PAGE.search(doc[i].get_text()) or "CB2 8EA" in doc[i].get_text()) and i > heads[-1][0]), len(doc))
    appendix = {}
    for k, (pg, y, n) in enumerate(heads):
        end = heads[k + 1][:2] if k + 1 < len(heads) else (last, 0)
        pieces = []
        for i in range(pg, min(end[0], len(doc) - 1) + 1):
            if i >= last:
                break
            box = cp.ms_page_box(doc, i)
            top = y - 1 if i == pg else box.y0  # (the running header ends just above the heading)
            bottom = end[1] - 4 if i == end[0] else box.y1
            if bottom > top + 8:
                pieces.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
        appendix.setdefault(n, pieces)
    first = heads[0][:2]
    # (the appendices' grids number their levels "1", "2": rows there are no question's)
    for key in [k for k, (pieces, *_) in ms.items() if pieces and (pieces[0][0], pieces[0][1].y0) >= (first[0], first[1] - 4)]:
        del ms[key]
    for q in {k[0] for k in ms}:
        if (q, None, None) not in ms:  # a whole question the scheme labels "1 (a)"
            rows = sorted((k for k in ms if k[0] == q and k[1] and not k[2]), key=lambda k: k[1])
            if len(rows) == 1:
                ms[(q, None, None)] = ms[rows[0]]
        elif (q, "a", None) not in ms and (q, "b", None) in ms:  # a first part the scheme labels "5"
            ms[(q, "a", None)] = ms[(q, None, None)]
    for key, (pieces, text, ans) in list(ms.items()):
        own = ce.cut(pieces, None, (first[0], first[1] - 4))
        refs = sorted({int(n) for n in REFER.findall(re.sub(r"\s+", " ", text))})
        extra = [x for n in refs for x in appendix.get(n, [])]
        ms[key] = (own + extra, text, ans)
    return tidy(doc, ms)


RUNNING = re.compile(r"[A-Z]\d{3}/\d\d|Mark Scheme|(January|June|October|November) \d{4}|\d{1,3}")


def tidy(doc, ms):
    """Each piece inside its page's running header ("H580/01  Mark Scheme  June 2025") and page number, and
    stopped above an option's heading ("OPTION 2 – Youth Subcultures"), which is the next question's."""
    for key, (pieces, text, ans) in list(ms.items()):
        out = []
        for pg, r in pieces:
            h = doc[pg].rect.height
            lines = doc.lines(pg)
            head = [l["y1"] for l in lines if l["y0"] < 60 and RUNNING.fullmatch(l["text"].strip())]
            foot = [l["y0"] for l in lines if l["y0"] > h - 70 and RUNNING.fullmatch(l["text"].strip())]
            top = max(r.y0, max(head) + 2) if head else r.y0
            bottom = min(r.y1, min(foot) - 2) if foot else r.y1
            stop = [l["y0"] for l in lines if top + 4 < l["y0"] < bottom and re.match(r"OPTION\s+\d\b", l["text"].strip())]
            if stop:
                bottom = min(stop) - 4
            if bottom > top + 12:
                out.append((pg, pymupdf.Rect(r.x0, top, r.x1, bottom)))
        ms[key] = (out, text, ans)
    return ms


cp.ms_tables = ms_tables
_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    # Which option heading, if any, each question sits under.
    events = []
    for i in range(1, len(qp)):
        lines = qp.lines(i)
        for k, l in enumerate(lines):
            t = l["text"].strip()
            if OPTION.match(t) and k + 1 < len(lines):
                events.append((i, l["y0"], re.match(r"\w+", lines[k + 1]["text"].strip().lower()).group(0)))
            elif END.match(t) or re.match(r"^Section [A-C]$", t):
                events.append((i, l["y0"], None))
    events.sort()
    option_of = {}
    for pg, y, q, letter, _ in labels:
        if letter is None:
            now = [o for p_, y_, o in events if (p_, y_) < (pg, y)]
            if now and now[-1]:
                option_of[q] = now[-1]
    for p in parts:
        o = option_of.get(int(p["question"]))
        if o:
            p["option"] = o
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
