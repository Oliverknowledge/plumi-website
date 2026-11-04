"""Cut OCR's A-Level (H431) and AS (H031) Business papers into question parts, each paired with its mark scheme row.

    python3 scripts/question-bank/ocr_business/cut_ocr_business.py [work-dir] [--only=h43101-jun24]
    # work-dir: .work/ocr-business (fetch_ocr_business.py); needs: pip install pymupdf pillow

The papers are set like OCR's GCSE Economics, so ocr_gcse_economics/cut_ocr_gcse_economics.py (and through it
ocr_economics/cut_ocr_economics.py and edexcel_sciences/cut_pearson.py) does the work on the question papers, used
here as a library, unchanged. What differs is set here, for this run only:
  - multiple choice. H431/01 and H031/01 open with fifteen questions whose options are printed "(a)" to "(d)", each
    beside a box, so they read as parts: on those papers questions 1 to 15 have no parts. The scheme calls the answer
    "A" to "D", the letter kept as `key`; the site's buttons say the same, so (a) on the paper is A.
  - the schemes (ms_tables below). Every scheme is one table, "Question | Answer | Mark | Guidance" (Section A of
    H431/01 and H031/01, "Question | Answer | Marks | AO | Rationale"), with the label in a column of its own: "18",
    "18 a", "18 (a)", "18(a)", "19* (b)", or a lone "b" under the number. A row runs to the next label, over pages:
    a levels-of-response grid and its guidance stay with their question, and a cell carried over a page goes with
    the row above. The grid of marks at the back (H431/01 June 2022's "Appendix 1", H031/02's) is left out.
  - the case study. The questions are set on a Resource Booklet printed apart (kind `rb`). Section B of the /01 and /02
    papers and all of H431/03 are set on it. A question with no parts has the whole case study as its stem,
    "h43101-jun24-stem.webp", shown when the student asks for it; the site opens a question-with-parts' stem by itself,
    so that stem stays the question's own opening words ("h43101-jun24-18-stem.webp") and not pages of case study.
    Every question set on the booklet is marked `src` and links to the PDF.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in cut_pearson.py's shape, each part
with `case` set if it is set on the booklet. Ids: "h43101-jun24-16", "h43101-jun24-18-a".
"""
import os, re, sys

import pymupdf
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-business"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr_gcse_economics"))
import cut_ocr_gcse_economics as gcse  # noqa: E402

econ, cp = gcse.econ, gcse.cp
MC_PAPER = re.compile(r"h[04]31-?01")
MC_LAST = 15
_qp_labels = cp.qp_labels


def qp_labels(doc):
    """On a multiple-choice paper, (a) to (d) of questions 1 to 15 are options."""
    labels, end_page = _qp_labels(doc)
    if MC_PAPER.match(os.path.basename(doc.doc.name)):
        labels = [x for x in labels if not (x[2] <= MC_LAST and x[3])]
    return labels, end_page


_shown = econ.shown
PROMPT = re.compile(r"[A-Za-z]{3}|^\d\s*\.{5,}")


def shown(doc, pieces):
    """The GCSE's reading (the part down to its first answer line, and its marks), and what is printed between the answer
    lines: "Advantage ……… Disadvantage ……… [4]", "1 ……… 2 ……… [4]". Each such line shows with one answer line under it."""
    out = _shown(doc, pieces)
    seq = [(pg, r, l) for pg, r in pieces for l in sorted((l for l in doc.lines(pg) if cp.inside(l, r)), key=lambda l: l["y0"])]
    first = next((n for n, (_, _, l) in enumerate(seq) if econ.ANSWER_LINE.match(l["text"].strip())), None)
    if first is None:
        return out
    last = max((n for n, (_, r, l) in enumerate(seq) if econ.MARK_LINE.search(l["text"]) and l["x1"] > r.x1 - 60), default=len(seq) - 1)
    extra = []
    for n in range(first, last):
        pg, r, l = seq[n]
        t = l["text"].strip()
        if econ.ANSWER_LINE.match(t) or not PROMPT.search(t) or gcse.FOOTER.search(t):
            continue
        if any(a == pg and x.y0 <= l["y0"] and l["y1"] <= x.y1 + 1 for a, x in out):
            continue
        under = seq[n + 1][2] if n + 1 < len(seq) and seq[n + 1][0] == pg and econ.ANSWER_LINE.match(seq[n + 1][2]["text"].strip()) else None
        extra.append((pg, pymupdf.Rect(r.x0, l["y0"] - 3, r.x1, (under or l)["y1"] + 2)))
    return sorted(out + extra, key=lambda e: (e[0], e[1].y0))


_crop = cp.Doc.crop


def crop(self, i, rect):
    """The GCSE's page with its footer painted out from a third of the way down, to spare the answer dots "Turn over" can sit
    level with. "© OCR" sits at the far left, under a tick box's row: all of it goes, or its top shows as dots under the crop."""
    fresh = i not in self._img
    img = _crop(self, i, rect)
    if fresh and "-qp-" in os.path.basename(self.doc.name):
        page, draw = self.doc[i], ImageDraw.Draw(self._img[i])
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for sp in l["spans"]:
                    if re.search(r"© OCR \d{4}", sp["text"]) and sp["bbox"][1] > page.rect.height - 80:
                        draw.rectangle([round(v * cp.SCALE) for v in sp["bbox"]], fill=(255, 255, 255))
        img = _crop(self, i, rect)
    return img


# ---------- the schemes ----------

LABEL = re.compile(r"^(\d{1,2})?\s*\*?\s*(?:\(?([a-e])\)?(?![a-z]))?\s*\*?\s*(?:\(?(i{1,3}|iv)\)?(?![a-z]))?\s*\*?(?=\s|$)")
TICK = re.compile(r"[\uf0fc✓✔]")
COLUMN_X = 135


def header(lines):
    """The page's column headers: the line naming "Guidance" or "Rationale" level with "Answer" (often the same line)."""
    return [h for h in lines if re.search(r"\b(Guidance|Rationale)\b", h["text"]) and len(h["text"]) < 40
            and any("Answer" in o["text"] and abs(o["y0"] - h["y0"]) < 8 for o in lines)]


def back_grid(lines):
    """The grid of marks at a scheme's back: "APPENDIX 1", "Sub-Total", or a row of bare "AO1" … "AO4" headers."""
    bare = {l["text"].strip(): l["y0"] for l in lines}
    return any(re.match(r"APPENDIX \d|Sub-Total$", l["text"].strip()) for l in lines) \
        or ("AO1" in bare and "AO4" in bare and abs(bare["AO1"] - bare["AO4"]) < 8)


def row_top(doc, pg, y, head):
    """The rule over a label; the column headers too, if nothing comes between them (a cell carried over the page can)."""
    rules = cp.table_rules(doc[pg])
    near = [r for r in rules if y - 12 <= r <= y + 2]
    top = (max(near) - 0.5) if near else y - 4
    if head is not None and not any(head["y0"] + 6 < l["y0"] < top - 1 for l in doc.lines(pg)):
        return head["y0"] - 3
    return top


RUNNING = re.compile(r"H[04]31/0\d|Mark Scheme|(?:May|June|October|November) \d{4}")


def page_box(doc, p):
    """cut_pearson's box for a scheme page, out to any line of the table that runs past its first or last rule (H431/03
    November 2021 sets a row's last line across the page's foot rule, and its first overleaf across the top one)."""
    box = cp.ms_page_box(doc, p)
    h = doc[p].rect.height
    body = [l for l in doc.lines(p) if not RUNNING.fullmatch(l["text"].strip()) and not (re.fullmatch(r"\d{1,3}", l["text"].strip()) and l["y0"] > h - 70)
            and not cp.BACK_BLOCK.match(l["text"]) and l["y0"] < h - 40]
    if not body:
        return box
    return pymupdf.Rect(box.x0, min(box.y0, min(l["y0"] for l in body) - 1), box.x1, max(box.y1, max(l["y1"] for l in body) + 1))


def scheme_rows(doc, leaves):
    """[(page, top, key, y)] in reading order, and the last page of the table. A label is taken only where the question
    paper has that part, so "a Gantt chart…" wrapping in a narrow column never reads as (a)."""
    pages = [i for i in range(len(doc)) if not doc.blank(i)]
    first = next((i for i in pages if i >= 3 and header(doc.lines(i))), None)
    rows, q, letter, roman, last_page = [], 0, None, None, len(doc) - 1
    if first is None:
        return rows, last_page
    parts = {k[0] for k in leaves if k[1]}
    for i in range(first, len(doc)):
        text, lines = doc.text(i), doc.lines(i)
        if cp.BACK_PAGE.search(text) or re.search(r"^OCR \(Oxford Cambridge and RSA Examinations\)", text, re.M) or back_grid(lines):
            last_page = i - 1
            break
        heads = header(lines)
        h_y = min((h["y0"] for h in heads), default=0)  # (a header's box can run down past the first label's top)
        column = [l for l in lines if l["x0"] < COLUMN_X and l["y0"] > h_y + 6 and l["y0"] < doc[i].rect.height - 40]
        groups = []
        for l in sorted(column, key=lambda l: (round(l["y0"]), l["x0"])):
            if groups and abs(groups[-1][0]["y0"] - l["y0"]) < 5:
                groups[-1].append(l)
            else:
                groups.append([l])
        for group in groups:
            group.sort(key=lambda l: l["x0"])
            said = " ".join(l["text"].strip() for l in group)
            m = LABEL.match(said)
            if not m or not any(m.groups()) or group[0]["x0"] > 112:
                continue
            # (the number column is the first: "2 marks for a clear definition", in a narrow Answer column, is no label)
            if m.group(1) and (group[0]["x0"] > 80 or re.match(r"\s*[a-z]", said[m.end():])):
                continue
            nq = int(m.group(1)) if m.group(1) else q
            nl, nr = m.group(2), m.group(3)
            if not m.group(1) and not nl and not nr or nq not in (q, q + 1) or nq == 0:
                continue
            if nr and not nl and nq == q:
                nl = letter
            if nq in parts and not nl:
                continue  # (a number with no part, on a question printed in parts: a carried-over row's repeat)
            if nq in parts and not nr and (nq, nl, "i") in leaves:
                # "8 (b)", "8 (b)": one row per sub-part, the sub-part's number set in the next cell
                nr = "ii" if (nq, nl) == (q, letter) and roman == "i" else "i" if (nq, nl) != (q, letter) else roman
            key = (nq, nl, nr)
            if key not in leaves or key == (q, letter, roman):
                continue
            q, letter, roman = key
            head = next((h for h in reversed(heads) if h["y0"] < group[0]["y0"]), None)
            rows.append((i, row_top(doc, i, group[0]["y0"], head), key, group[0]["y0"]))
    return rows, last_page


def ms_tables(doc):
    """{(q, letter, roman): ([(page, rect)], text, key)}."""
    qp = cp.Doc(doc.doc.name.replace("-ms-", "-qp-"))
    labels, _ = cp.qp_labels(qp)
    keys = [(q, letter, roman) for _, _, q, letter, roman in labels]
    leaves = {k for k in keys if not any(o[0] == k[0] and (k[1] is None and o[1] or k[1] and not k[2] and o[1] == k[1] and o[2]) for o in keys)}
    rows, last_page = scheme_rows(doc, leaves)
    out = {}
    for n, (pg, top, row_key, y) in enumerate(rows):
        qq, ll = row_key[:2]
        nxt = rows[n + 1] if n + 1 < len(rows) else None
        pieces, p = [], pg
        while p <= last_page:
            box = page_box(doc, p)
            t = top if p == pg else box.y0
            b = nxt[1] if nxt and nxt[0] == p else box.y1
            # A "Section B" banner ends a row; "SECTION A" repeated at the top of the page a row is carried on to doesn't.
            banners = [l for l in doc.lines(p) if t - 1 < l["y0"] < b and re.fullmatch(r"(SECTION|Section) [A-C]", l["text"].strip())]
            if p != pg and banners and not any(t < l["y0"] < banners[0]["y0"] - 2 for l in doc.lines(p)):
                t, banners = banners[0]["y1"] + 1, banners[1:]
            stops = [l["y0"] for l in banners] + [l["y0"] for l in doc.lines(p) if t < l["y0"] < b and cp.BACK_BLOCK.match(l["text"])]
            if stops:
                b = min(stops) - 3
            body = " ".join(l["text"] for l in doc.lines(p) if cp.inside(l, pymupdf.Rect(box.x0, t, box.x1, b))
                            and l["text"].strip() not in ("Question", "Answer", "Mark", "Marks", "Guidance", "AO", "Rationale"))
            if b > t + 6 and body.strip():
                pieces.append((p, pymupdf.Rect(box.x0, t, box.x1, b)))
            if nxt and nxt[0] <= p:
                break
            p += 1
        text = re.sub(r"\s+", " ", " ".join(doc.text(p, r) for p, r in pieces))
        key = None
        if MC_PAPER.match(os.path.basename(doc.doc.name)) and qq <= MC_LAST and not ll and pieces:
            key = mc_key(doc, pieces[0])
        out.setdefault(row_key, (pieces, text, key))
    return out


def mc_key(doc, piece):
    """The letter in a Section A row's "Answer" column."""
    pg, r = piece
    lines = doc.lines(pg)
    head = next((l for l in lines if l["text"].strip() == "Answer"), None)
    cells = [l for l in lines if cp.inside(l, r) and re.fullmatch(r"[A-Da-d]", TICK.sub("", l["text"]).strip())]
    if head:
        cells = [l for l in cells if head["x0"] - 25 < (l["x0"] + l["x1"]) / 2 < head["x1"] + 25] or cells
    return TICK.sub("", cells[0]["text"]).strip().upper() if cells else None


# ---------- the case study ----------

COPYRIGHT = re.compile(r"^(Copyright Information|Oxford Cambridge and RSA)")


def booklet(path):
    """(image, text): the Resource Booklet's case study, its cover and back pages left out."""
    doc = cp.Doc(path)
    images, words = [], []
    for i in range(1, len(doc)):
        if doc.blank(i):
            continue
        f = doc.frame(i)
        # (the booklets print "Turn over" level with their last line's source, and their code in the footer)
        foot = [l["y0"] for l in doc.lines(i) if re.match(r"(© OCR|H[04]31/0\d|Turn over)", l["text"].strip()) and l["y0"] > doc[i].rect.height - 90]
        # (out to the line numbers on the right, and to the ends of OCR's long copyright notices)
        # (a booklet's last page can hold the end of the case study over OCR's copyright notice)
        # (and over the rule and logo that head that notice)
        notice = [l["y0"] for l in doc.lines(i) if COPYRIGHT.match(l["text"].strip())]
        rules = [y for y, wide in cp.table_rules(doc[i]).items() if wide > 300 and notice and min(notice) - 70 < y < min(notice)]
        foot += notice + rules
        rect = pymupdf.Rect(20, f.y0, doc[i].rect.width - 5, min(foot) - 3 if foot else f.y1)
        said = doc.text(i, rect)
        if not re.search(r"[A-Za-z]{4}", said):
            continue
        images.append(cp.trim(doc.crop(i, rect), 14))
        words.append(said)
    # (where OCR has removed an extract for copyright, it leaves its space blank)
    return cp.squash(cp.stack(images), run=150, keep=40), " ".join(words)


def on_case(qp, q, labels):
    """Whether question q is set on the booklet: all of H431/03, Section B elsewhere."""
    if "h431-03" in os.path.basename(qp.doc.name):
        return True
    sec = [(pg, y) for pg, y, kind, _ in gcse.markers(qp, len(qp) - 1) if kind == "section" and re.fullmatch(r"(SECTION|Section) B", next(
        (l["text"].strip() for l in qp.lines(pg) if abs(l["y0"] - y) < 1), ""))]
    at = next(((pg, y) for pg, y, n, letter, _ in labels if n == q and not letter), None)
    return bool(sec and at and at > sec[0])


_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = cp.Doc(qp_path)
    labels, _ = cp.qp_labels(qp)
    rb = qp_path.replace("-qp-", "-rb-")
    image, words = booklet(rb) if os.path.exists(rb) else (None, "")
    wrote = False
    for p in parts:
        q = int(p["question"])
        if p["ms"]:  # a cell run on over empty rows closes up, as cut_pearson's --extracts does
            path = os.path.join(cp.IMG, p["ms"])
            cp.save(cp.squash(Image.open(path).convert("RGB")), p["ms"])
        if not on_case(qp, q, labels):
            continue
        p["case"] = True
        p["text"] = re.sub(r"\s+", " ", (p["text"] + " " + words)).strip()[:3000]
        if not p["part"]:
            p["stem"] = f"{set_id}-stem.webp"
            if not wrote and image:
                cp.save(image, p["stem"])
                wrote = True
    return parts


cp.qp_labels, cp.ms_tables, cp.cut_set, cp.Doc.crop, econ.shown = qp_labels, ms_tables, cut_set, crop, shown

if __name__ == "__main__":
    cp.main()
