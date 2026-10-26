"""Cut Eduqas (WJEC) papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/eduqas/cut_eduqas.py [work-dir] [--only=a420u10-jun24]
    # needs: pip install pymupdf pillow

edexcel_sciences/cut_pearson.py's sibling for WJEC's layout, which Eduqas and WJEC share
(the same typesetting, the same scheme tables), so this should cut WJEC's own papers too.
It writes the same shapes. For every question paper in <work-dir>/manifest.json
(fetch_eduqas.py):

  - Question papers: each page has a drawn frame, with an "Examiner only" column outside
    it on the right. Labels sit down the left inside it: a bold question number with a
    full stop ("3."), then "(a)" and "(i)", each in its own text line. A label only counts
    when it is the next one expected (3 after 2, (b) after (a)), so a comprehension's
    paragraph numbers (no full stop) and a list inside a question stay out. A part runs
    from its label to the next, across pages, skipping blank pages; its trailing answer
    lines (dotted rules, no text) are left off, and a page of nothing but answer lines is
    dropped. "I." and "II." below a sub-part stay inside it. A question's opening words,
    up to its "(a)" (for a comprehension, the whole article), are its stem; a part's
    opening words go above its first sub-part, as cut_pearson.py does.
  - Mark schemes: a ruled table, its header ("Question | Marking details | Marks available
    AO1 AO2 AO3 Total Maths Prac") repeated on every page. Label pieces ("1", "(a)", "(i)")
    sit in the columns left of "Marking details"; a part's rows run from its row's top rule
    to the next labelled row, a "Question 3 total" row, or the end of the tables (the
    summary of marks that closes older schemes isn't a part's). A scheme row only counts
    when its label is one the question paper has, in order, which keeps numbered points
    in an answer out. The crop is the page's header with the part's rows under it. The
    Prac column says whether the part carries practical-skills marks: `prac` in parts.json.
  - Examiner's reports: one per level and series, a section per component ("COMPONENT 1
    – NEWTONIAN PHYSICS"), and in it the questions ("Q.1", "Question 1"), often only the
    ones with something to say.

Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json.
Ids are <component>-<series>-<question>[-<part>]: "a420u10-jun24-01-ai".
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-sciences")
IMG = os.path.join(WORK, "img")
SCALE = 2.2  # ~160 dpi, as the other cutters
DEBUG = "--debug" in sys.argv  # print each scheme row's label and whether it was taken

LETTERS = "abcdefghijklmn"
ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
QNUM = re.compile(r"^(\d{1,2})\.(?:\s|$)")
LEAD = re.compile(r"^\(([a-z]{1,4})\)\s*")
# The end of the questions, and pages that are no part of one.
END = re.compile(r"^(END OF PAPER|END OF QUESTION PAPER)\b", re.I)
EXTRA = re.compile(r"Additional page, if required|^Question\s*$")
BLANK = re.compile(r"BLANK PAGE|PLEASE DO NOT WRITE\s+ON THIS PAGE", re.I)
BOILER = re.compile(r"©\s*WJEC CBAC Ltd\.?|Turn over\.?|Examiner\s+only|\([AB]\d{3}U\d0-\d\)|\.{6,}", re.I)


# ---------- reading pages ----------

def lines_of(page):
    """Horizontal lines of text as displayed: [{x0, y0, x1, y1, text, spans}] top to bottom."""
    m = page.rotation_matrix
    o = pymupdf.Point(0, 0) * m
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            d = pymupdf.Point(*line["dir"]) * m - o
            if abs(d.x - 1) > 0.05:
                continue  # vertical margin text
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            r = pymupdf.Rect(line["bbox"]) * m
            text = spans[0]["text"]
            for a, b in zip(spans, spans[1:]):
                gap = b["bbox"][0] - a["bbox"][2]
                text += (" " if gap > 1.5 and not a["text"].endswith((" ", "\t")) else "") + b["text"]
            out.append({"x0": r.x0, "y0": r.y0, "x1": r.x1, "y1": r.y1, "spans": spans, "text": re.sub(r"\s+", " ", text).strip()})
    out.sort(key=lambda l: l["y0"])
    # A line's pieces read left to right when they start within 2pt of each other: "9." sits a point
    # below its "(a) A sinusoidal…".
    row, last, keyed = 0, None, []
    for l in out:
        if last is not None and l["y0"] - last > 2:
            row += 1
        last = l["y0"]
        keyed.append((row, l["x0"], l))
    return [l for _, _, l in sorted(keyed, key=lambda k: k[:2])]


def bold(span):
    return "Bold" in span["font"] or bool(span["flags"] & 16)


def drawings(page):
    try:
        return page.get_drawings()
    except Exception:  # noqa: BLE001
        return []


def inside(l, rect):
    return rect.contains(pymupdf.Point((l["x0"] + l["x1"]) / 2, (l["y0"] + l["y1"]) / 2))


class Doc:
    """A PDF with its pages' lines, drawings and renders read once."""

    def __init__(self, path):
        self.doc = pymupdf.open(path)
        self._lines, self._img, self._draw, self._area = {}, {}, {}, {}

    def __len__(self):
        return len(self.doc)

    def lines(self, i):
        if i not in self._lines:
            self._lines[i] = lines_of(self.doc[i])
        return self._lines[i]

    def draws(self, i):
        if i not in self._draw:
            page = self.doc[i]
            self._draw[i] = [{**d, "rect": d["rect"] * page.rotation_matrix} for d in drawings(page)]
        return self._draw[i]

    def text(self, i, rect=None):
        return "\n".join(l["text"] for l in self.lines(i) if rect is None or inside(l, rect))

    def crop(self, i, rect):
        if i not in self._img:
            pix = self.doc[i].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False, colorspace=pymupdf.csRGB)
            self._img[i] = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img = self._img[i]
        box = tuple(round(v * SCALE) for v in (rect.x0, rect.y0, rect.x1, rect.y1))
        box = (max(0, box[0]), max(0, box[1]), min(img.width, box[2]), min(img.height, box[3]))
        return img.crop(box) if box[2] > box[0] + 4 and box[3] > box[1] + 4 else None


def trim(img, keep=24, sides=False):
    """Trim white space below the last ink (and, for schemes, around it), keeping a little air."""
    if img is None:
        return None
    bg = Image.new("RGB", img.size, (255, 255, 255))
    box = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    if sides:
        return img.crop((max(0, box[0] - 8), max(0, box[1] - 8), min(img.width, box[2] + 8), min(img.height, box[3] + keep)))
    return img.crop((0, 0, img.width, min(img.height, box[3] + keep)))


def stack(images, gap=12):
    images = [i for i in images if i is not None]
    if not images:
        return None
    w = max(i.width for i in images)
    out = Image.new("RGB", (w, sum(i.height for i in images) + gap * (len(images) - 1)), (255, 255, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def save(img, name):
    if img is None:
        return None
    if img.height > 16000:
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    img.save(os.path.join(IMG, name), "WEBP", quality=72, method=4)
    return name


# ---------- question papers ----------

def blank(doc, i):
    t = doc.text(i)
    return bool(BLANK.search(t)) and len(BOILER.sub(" ", t).strip()) < 120


def area(doc, i):
    """Where a page's question can be: inside its frame (the largest drawn box, a stroke
    0.5pt wide), else between the running header ("2", the page number) and the footer
    ("© WJEC CBAC Ltd.", "Turn over."), left of the "Examiner only" column."""
    if i in doc._area:
        return doc._area[i]
    page = doc.doc[i]
    w, h = page.rect.width, page.rect.height
    box = None
    for d in doc.draws(i):
        r = d["rect"]
        # (margin to margin from the top: a full-page graph grid isn't the frame)
        if d.get("type") == "s" and r.width > w * 0.7 and r.height > h * 0.6 and r.x0 < 70 and r.x1 > w - 70 and r.y0 < 100 \
                and (box is None or r.get_area() > box.get_area()):
            box = r
    lines = doc.lines(i)
    foot = [l["y0"] for l in lines if l["y0"] > h - 90 and re.search(r"©\s*WJEC|Turn over|^\([AB]\d{3}U", l["text"])]
    if box is not None:
        r = pymupdf.Rect(box.x0 + 1, box.y0 + 1, box.x1 - 1, box.y1 - 1)
    else:
        head = [l["y1"] for l in lines if l["y0"] < 75 and re.fullmatch(r"\d{1,2}", l["text"])]
        right = min([l["x0"] for l in lines if l["text"].startswith("Examiner")] + [w - 52])
        r = pymupdf.Rect(46, (max(head) + 6) if head else 72, right - 2, h - 50)
    if foot:
        r.y1 = min(r.y1, min(foot) - 4)
    doc._area[i] = r
    return r


def answer_ys(doc, i):
    """The heights of the page's answer lines: dotted horizontal rules (each drawn twice,
    dotted and plain, at the same height)."""
    return {round(d["rect"].y0) for d in doc.draws(i)
            if d["rect"].height < 1 and d["rect"].width > 40 and d.get("dashes") and d["dashes"].startswith("[ 0 ")}


def content_bottom(doc, i, rect):
    """The foot of the last thing in `rect` that isn't an answer line: text, a figure, a table, a grid."""
    ys = [l["y1"] for l in doc.lines(i) if inside(l, rect) and BOILER.sub("", l["text"]).strip()]
    dots = answer_ys(doc, i)
    for d in doc.draws(i):
        r = d["rect"]
        if r.height < 1 and round(r.y0) in dots:
            continue
        if r.width > rect.width * 0.9 and r.height > rect.height * 0.6:
            continue  # the frame
        if r.intersects(rect) and rect.contains(pymupdf.Point(r.x0 + r.width / 2, min(r.y1, rect.y1 - 0.1))):
            ys.append(min(r.y1, rect.y1))
    return max(ys) if ys else None


def qp_labels(doc):
    """Every label in reading order: [(page, y, q, letter, roman)], and the page where the questions end."""
    out, q, letter, roman, letter_x = [], 0, None, None, 0
    end_page = len(doc) - 1
    for i in range(1, len(doc)):
        if blank(doc, i):
            continue
        if EXTRA.search(doc.text(i)) and q:
            end_page = i - 1
            break
        f = area(doc, i)
        stop = False
        for l in doc.lines(i):
            if l["y0"] < f.y0 - 2 or l["y0"] > f.y1:
                continue
            if END.match(l["text"]):
                stop = True
                break
            m = QNUM.match(l["text"])
            if m and bold(l["spans"][0]) and l["x0"] < f.x0 + 16 and int(m.group(1)) == q + 1:
                q, letter, roman = int(m.group(1)), None, None
                out.append((i, l["y0"], q, None, None))
                rest = l["text"][m.end():]
            elif q and (l["x0"] < f.x0 + 75 or l["x0"] < f.x0 + 250 and re.match(r"\([ivx]{1,4}\)\t", l["spans"][0]["text"])):
                rest = l["text"]  # (a sub-part's label can sit right of a figure, still set with its tab)
            else:
                continue
            for n in range(2):
                m = LEAD.match(rest)
                if not m:
                    break
                tok = m.group(1)
                # where the token itself starts: "(a)" can share its line with "10."
                x = next((sp["bbox"][0] for sp in l["spans"] if sp["text"].strip().startswith(f"({tok})")), l["x0"])
                nxt_letter = LETTERS[LETTERS.index(letter) + 1] if letter and letter != LETTERS[-1] else ("a" if not letter else None)
                nxt_roman = ROMANS[ROMANS.index(roman) + 1] if roman and roman != ROMANS[-1] else ("i" if not roman else None)
                # After (h), "(i)" is either the next part or (h)'s first sub-part: a sub-part is indented past its part.
                indented = n == 1 or x > letter_x + 12
                if tok == nxt_roman and letter and (tok != nxt_letter or roman or indented):
                    roman = tok
                    out.append((i, l["y0"], q, letter, roman))
                elif tok == nxt_roman and not letter and (roman or re.match(r"\(i\)\t", l["spans"][0]["text"])):
                    roman = tok  # a question set in "(i)", "(ii)" with no "(a)": a label, set with its tab, not a list
                    out.append((i, l["y0"], q, None, roman))
                elif tok == nxt_letter and (not letter or x < letter_x + 12):
                    letter, roman, letter_x = tok, None, x
                    out.append((i, l["y0"], q, letter, None))
                else:
                    break
                rest = rest[m.end():]
        if stop:
            end_page = i
            break
    return out, end_page


def region(doc, start, end, end_page):
    """[(page, rect)] from one label to the next, across pages, skipping blank pages."""
    (pg, y), nxt = start, end
    pieces = []
    while True:
        f = area(doc, pg)
        top = y - 5 if (pg, y) == start else f.y0
        bottom = nxt[1] - 5 if nxt and nxt[0] == pg else f.y1
        for l in doc.lines(pg):
            # (also Physics Component 3's option headings, "Option B – Medical Physics", above the option's question)
            if (top + 2 < l["y0"] or (pg, y) != start and top - 4 <= l["y0"]) and l["y0"] < bottom and (END.match(l["text"]) or re.match(r"^(SECTION [A-D]\b|Option [A-D]\s*[–-]\s*[A-Z])", l["text"])):
                bottom = l["y0"] - 4
                break
        if bottom > top + 10:
            pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        if (nxt and nxt[0] == pg) or pg >= end_page:
            break
        pg += 1
        while pg < end_page and blank(doc, pg):
            pg += 1
        if nxt and pg > nxt[0]:
            break
    return pieces


def tidy(doc, pieces, keep_first=True):
    """Leave off each piece's trailing answer lines, and drop pieces with nothing but answer lines."""
    out = []
    for n, (pg, r) in enumerate(pieces):
        bottom = content_bottom(doc, pg, r)
        if bottom is None:
            if n == 0 and keep_first:
                out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, r.y0 + 24))))
            continue
        out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, bottom + 6))))
    return out


def marks_in(doc, pieces):
    total, found = 0, False
    for pg, rect in pieces:
        for l in doc.lines(pg):
            m = re.search(r"\[(\d{1,2})(?:\s*QER)?\]$", l["text"])  # "[6 QER]": the extended response
            if m and l["x1"] > rect.x1 - 120 and rect.y0 <= (l["y0"] + l["y1"]) / 2 <= rect.y1 and rect.x0 <= l["x0"] <= rect.x1:
                total += int(m.group(1))
                found = True
    return total if found else None


# ---------- mark schemes ----------

def ms_layout(doc, i):
    """A scheme page's table: its header box, the left edge of "Marking details" (labels sit left
    of it), the table's left and right edges, the Prac and Total columns, the horizontal rules,
    and whether it's the summary of marks. None where the page has no scheme table."""
    lines = doc.lines(i)
    q = next((l for l in lines if l["text"] == "Question"), None)
    md = next((l for l in lines if l["text"].startswith("Marking details")), None)
    if not q or not md or abs(q["y0"] - md["y0"]) > 12:
        return None
    page = doc.doc[i]
    vs = sorted({round(d["rect"].x0, 1) for d in doc.draws(i) if d["rect"].height > 12 and d["rect"].width < 3})
    hs = {}
    for d in doc.draws(i):
        r = d["rect"]
        if r.width > 8 and r.height < 3:
            hs[round(r.y0, 1)] = hs.get(round(r.y0, 1), 0) + r.width  # (some schemes rule a row a cell at a time)
    left = max([v for v in vs if v < md["x0"] - 4] or [q["x0"] - 30])
    cols = [l for l in lines if abs(l["y0"] - q["y0"]) < 30 and re.fullmatch(r"(AO\d|Total|Maths|Prac|Total Maths)", l["text"])]
    # (by the middles of the header's words: their boxes can run past the rules around them)
    mid = lambda l: (l["y0"] + l["y1"]) / 2  # noqa: E731
    head_bottom_text = max([mid(l) for l in cols] + [mid(md), mid(q)])
    head_top_text = min([mid(l) for l in lines if l["text"].lower().startswith("marks available") and l["y0"] < q["y0"] + 4] + [mid(q)])
    above = [y for y in hs if y <= head_top_text - 3]
    below = [y for y in hs if y >= head_bottom_text + 3]
    x0 = (min(vs) if vs else 40) - 2
    x1 = (max(vs) if vs else page.rect.width - 40) + 2
    head = pymupdf.Rect(x0, (max(above) - 1) if above else head_top_text - 4, x1, (min(below) + 1) if below else head_bottom_text + 3)
    prac = next((l for l in cols if l["text"] == "Prac"), None)
    total = next((l for l in cols if l["text"].startswith("Total")), None)

    def column(l):
        if l is None:
            return None
        c = (l["x0"] + l["x1"]) / 2 if l["text"] != "Total Maths" else l["x0"] + 12
        a = max([v for v in vs if v < c] or [c - 20])
        b = min([v for v in vs if v > c] or [c + 20])
        return (a, b)
    return {"head": head, "head_src": (i, head), "left": left, "x0": x0, "x1": x1, "rules": dict(sorted(hs.items())), "prac": column(prac),
            "total": column(total), "summary": bool(re.search(r"SUMMARY OF MARKS", doc.text(i), re.I))}


def continued(doc, i, prev):
    """A page of the table with no header of its own (2018's schemes repeat it only now and then): the
    previous page's columns, from the table's top rule. None unless the page is ruled as a table."""
    if prev is None or prev["summary"] or re.search(r"SUMMARY OF MARKS", doc.text(i), re.I):
        return None
    hs = {}
    for d in doc.draws(i):
        r = d["rect"]
        if r.width > 8 and r.height < 3:
            hs[round(r.y0, 1)] = hs.get(round(r.y0, 1), 0) + r.width  # (some schemes rule a row a cell at a time)
    wide = [y for y, w in hs.items() if w > (prev["x1"] - prev["x0"]) * 0.5]
    if not wide:
        return None
    top = min(hs)
    return {**prev, "head": pymupdf.Rect(prev["x0"], top - 1, prev["x1"], top), "rules": dict(sorted(hs.items()))}


def table_rules(lay):
    """The heights of the rules across the table (not a fraction's bar or an underline)."""
    return sorted(y for y, w in lay["rules"].items() if w > 0.3 * (lay["x1"] - lay["x0"]))


def ms_rows(doc, expected, aliases=None):
    """{(q, letter, roman): {"pieces": [(page, rect)], "head": (page, rect), "text", "prac", "total"}}, for the
    labels the question paper has (`expected`, in order)."""
    order = {k: n for n, k in enumerate(expected)}
    aliases = aliases or {}
    found = []  # (page, top, key, label_y)
    stops = []  # (page, top): "Question 3 total", a page's summary of marks
    layouts = {}
    last = -1
    q_now = letter_now = pending = None
    for i in range(len(doc)):
        lay = ms_layout(doc, i) or continued(doc, i, layouts.get(i - 1))
        layouts[i] = lay
        if lay is None:
            continue
        if lay["summary"]:
            stops.append((i, 0))
            continue
        rules = table_rules(lay)
        body = [l for l in doc.lines(i) if (l["y0"] + l["y1"]) / 2 > lay["head"].y1]
        # A row's label pieces: what starts left of "Marking details", gathered by height ("1", "(a)", "(i)"), and a
        # "(ii)" set at the start of the row's marking details, as older schemes do ("(ii) Distance = …").
        rows = []
        for l in body:
            if re.match(r"Question \d{1,2}\s*total", l["text"], re.I) and l["x0"] < lay["left"] + 30:
                top = max([y for y in rules if y <= l["y0"] + 2] or [l["y0"] - 4])
                stops.append((i, top))
                continue
            # (a number stands alone in its cell; a bracketed label can have the row's answer run on after it)
            # "1", "1." (autumn 2020), "5 (a)" in one piece
            m = re.match(r"^\*?\s*\d{1,2}\.?\s*\*?(?:\s*\(\s*[a-z]{1,5}\s*\)){0,2}\s*$|^(?:\(\s*[a-z]{1,5}\s*\)\s*){1,2}", l["text"])
            if l["x0"] < lay["left"] - 1 and m:
                txt = m.group(0)
            elif l["x0"] < lay["left"] - 1 and re.fullmatch(r"[ivx]{1,4}", l["text"]):
                txt = f"({l['text']})"  # "iii", its brackets left off
            elif l["x0"] < lay["left"] + 14 and re.match(r"\((?:[ivx]{1,4})\)\s", l["text"]):
                txt = re.match(r"\([ivx]{1,4}\)", l["text"]).group(0)
            else:
                continue
            if rows and abs(rows[-1]["y0"] - l["y0"]) < 4:
                rows[-1]["bits"].append((l["x0"], txt))
                rows[-1]["y0"] = min(rows[-1]["y0"], l["y0"])
            else:
                rows.append({"y0": l["y0"], "bits": [(l["x0"], txt)]})
        for r in rows:
            label = " ".join(t for _, t in sorted(r["bits"])).strip()
            m = re.match(r"^\*?\s*(\d{1,2})?\.?\s*\*?((?:\s*\(\s*[a-z]{1,5}\s*\))*)", label)
            if not m or not (m.group(1) or m.group(2).strip()):
                continue
            subs = re.findall(r"\(\s*([a-z]{1,5})\s*\)", m.group(2))
            if len(subs) > 2 or any(s not in LETTERS and s not in ROMANS for s in subs):
                continue
            if m.group(1) and not subs and (int(m.group(1)), "a", None) in order and int(m.group(1)) == (q_now or 0) + 1:
                # A number alone, for a question with parts: its "(a)" is on the next row (or it's a levels table's "4").
                pending = int(m.group(1))
                continue
            if m.group(1) and not subs and (int(m.group(1)), "a", None) in order:
                continue  # a levels table's "4"
            q = int(m.group(1)) if m.group(1) else (pending if pending and (pending, subs[0] if subs else None, None) in order
                                                         and order[(pending, subs[0], None)] > last else q_now)
            pending = None
            if q is None:
                continue
            letter = roman = None
            if len(subs) == 2:
                letter, roman = subs
            elif len(subs) == 1:
                s = subs[0]
                # "(i)" is a sub-part when the question paper has one here, else part (i)
                as_roman = (q, letter_now if not m.group(1) else None, s)
                if m.group(1) and q == q_now and as_roman not in order:
                    as_roman = (q, letter_now, s)  # "6 (ii)": the question's number again, its part's letter left off
                ok = aliases.get(as_roman, as_roman)
                if s in ROMANS and ok in order and order[ok] > last:
                    letter, roman = as_roman[1], s
                else:
                    letter = s
            key = aliases.get((q, letter, roman), (q, letter, roman))
            if key not in order and roman == "i" and (q, letter, None) in order:
                key = (q, letter, None)  # the scheme says "5 (a) (i)" where the paper's (a) has no sub-parts
            if DEBUG:
                print(f"  ms p{i} y{r['y0']:.0f} {label!r} -> {key} {'ok' if key in order and order[key] > last else 'skip'}", file=sys.stderr)
            if key not in order or order[key] <= last:
                continue
            last = order[key]
            q_now = q
            letter_now = letter if letter else None if m.group(1) else letter_now
            top = max([y for y in rules if y <= r["y0"] + 2.5] or [r["y0"] - 4])
            found.append((i, top, key, r["y0"]))
    out = {}
    marks_seen = []
    for n, (pg, top, key, fy) in enumerate(found):
        # "(i) (ii)" in one cell: both labels share the row, so the next row is the next one lower down.
        nxt = next((f for f in found[n + 1:] if (f[0], f[1]) != (pg, top)), None)
        end = min([s for s in stops if s > (pg, top)] + ([(nxt[0], nxt[1])] if nxt else []) + [(len(doc), 0)])
        pieces, p = [], pg
        while p < len(doc) and (p, 0) < end:
            lay = layouts[p]
            if lay is None:
                break
            t = top if p == pg else lay["head"].y1
            # (the table's last rule, or below its last words where a page leaves the bottom border off)
            words = [l["y1"] for l in doc.lines(p) if l["x0"] > lay["x0"] and l["y0"] > lay["head"].y1 and not BOILER.fullmatch(l["text"])
                     and not re.fullmatch(r"\d{1,3}", l["text"]) and l["y0"] < doc.doc[p].rect.height - 45]
            table_end = max(table_rules(lay) + [max(words, default=0) + 3] or [doc.doc[p].rect.height - 40])
            b = end[1] if end[0] == p else table_end
            if b > t + 4 and BOILER.sub("", doc.text(p, pymupdf.Rect(lay["x0"], t, lay["x1"], b))).strip():
                pieces.append((p, pymupdf.Rect(lay["x0"], t, lay["x1"], b + 0.8)))
            if end[0] == p:
                break
            p += 1
        if not pieces:
            continue
        text = " ".join(doc.text(p, r) for p, r in pieces)
        prac = total = 0
        for p, r in pieces:
            lay = layouts[p]
            for l in doc.lines(p):
                if not inside(l, r) or not re.fullmatch(r"\d{1,2}", l["text"]):
                    continue
                c = (l["x0"] + l["x1"]) / 2
                if lay["prac"] and lay["prac"][0] < c < lay["prac"][1]:
                    prac = max(prac, int(l["text"]))
                if lay["total"] and lay["total"][0] < c < lay["total"][1]:
                    total = max(total, int(l["text"]))
        head = layouts[pg]["head_src"]
        out[key] = {"pieces": pieces, "head": head, "text": re.sub(r"\s+", " ", text), "prac": prac, "total": total}
        marks_seen.append(key)
    return out


# ---------- examiner's reports ----------

def examiner_report(path, section):
    """{"03": "Question 3(b)(i)\\n\\n<paragraphs>…"} for one component's section ("COMPONENT 1")."""
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    text = re.sub(r"\n\s*©\s*WJEC CBAC Ltd\.?\s*(?:\d{4})?\s*\n(?:\s*\d{1,3}\s*\n)?", "\n", text)
    # Sections start "COMPONENT 1 – NEWTONIAN PHYSICS", "AS COMPONENT 1" or "BIOLOGY COMPONENT 1"; the
    # contents page lists them too, followed by a page number.
    heads = [m for m in re.finditer(r"\n\s*(?:AS |A LEVEL |[A-Z]{5,10} )?(COMPONENT|Component) (\d)\b[^\n]*\n(?!\s*\d{1,3}\s*\n)", text)]
    want = section.split()[-1]
    mine = [m for m in heads if m.group(2) == want]
    if not mine:
        return {}
    start = mine[-1].end()
    nxt = [m.start() for m in heads if m.start() > start and m.group(2) != want]
    body = text[start:min(nxt) if nxt else len(text)]
    body = re.split(r"\n\s*(?:Supporting you|Summary of key points)\b", body)[0]
    # "Q.1", "Q1", "Question 1", or "11." alone, at the start of a line; its parts follow on lines of their own.
    chunks = re.split(r"\n\s*(?:(?:Q\.?\s?|Question\s+)(\d{1,2})\b\.?|(\d{1,2})\.(?=[ \t]*(?:\n|\([a-z]{1,4}\))))[ \t]*", body)
    chunks = [chunks[0]] + [x for k in range(1, len(chunks) - 2, 3) for x in (chunks[k] or chunks[k + 1], chunks[k + 2])]
    out = {}
    for k in range(1, len(chunks) - 1, 2):
        q, rest = int(chunks[k]), chunks[k + 1]
        rest = re.sub(r"\n[ \t]*(\([a-z]{1,4}\)(?:[ \t]*(?:\([ivx]{1,4}\)|&|and)[ \t]*)*(?:\([ivx]{1,4}\))?)[ \t]*\n", r"\n\n\1 ", "\n" + rest)
        rest = re.sub(r"(?<!\n)\n(?!\n)", " ", rest)
        rest = re.sub(r"[ \t]+", " ", rest)
        paras = [p.strip() for p in re.split(r"\n{2,}", rest) if len(p.strip()) > 30]
        paras = [p for p in paras if not re.match(r"^(SECTION [A-D]|Comments on individual questions)", p)]
        if not paras:
            continue
        piece = "\n\n".join([f"Question {q}"] + paras)
        key = f"{q:02d}"
        out[key] = out[key] + "\n\n" + piece if key in out else piece
    return out


# ---------- one paper ----------

def hand_aliases(set_id):
    """Scheme rows the scheme itself misnumbers, set by hand in scripts/question-bank/labels/<set>.json
    (cut_pearson.py's format): {"ms_alias": [[the part, what the scheme calls it], ...]}, parts as
    [question, letter or null, roman or null]."""
    path = os.path.join(HERE, "..", "labels", f"{set_id}.json")
    if not os.path.exists(path):
        return {}
    return {tuple(bad): tuple(good) for good, bad in json.load(open(path)).get("ms_alias", [])}


def cut_set(qp_path, ms_path, er_path, set_id, meta, er_section):
    qp = Doc(qp_path)
    labels, end_page = qp_labels(qp)
    keys = [(q, letter, roman) for _, _, q, letter, roman in labels]
    ms_doc = Doc(ms_path) if ms_path and os.path.exists(ms_path) else None
    ms = ms_rows(ms_doc, keys, hand_aliases(set_id)) if ms_doc else {}
    er = examiner_report(er_path, er_section) if er_section else {}
    regions = []
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        regions.append(((q, letter, roman), region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)))
    by_key = dict(regions)
    has_children = lambda k: any(o[0] == k[0] and ((k[1] is None and k[2] is None and (o[1] or o[2])) or (k[1] and not k[2] and o[1] == k[1] and o[2]))
                                 for o in keys)  # noqa: E731
    leaves = [k for k in keys if not has_children(k)]
    parts = []
    for key in leaves:
        q, letter, roman = key
        pieces = list(by_key[key])
        lead = []
        if roman == "i" and letter and (q, letter, None) in by_key:
            lead = tidy(qp, by_key[(q, letter, None)], keep_first=False)  # the part's opening words
        keep = lead + tidy(qp, pieces)
        label = f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else "")
        pid = f"{set_id}-{q:02d}" + (f"-{letter or ''}{roman or ''}" if letter or roman else "")
        qimg = stack([trim(qp.crop(pg, r)) for pg, r in keep])
        stem_name = None
        stem_pieces = tidy(qp, by_key.get((q, None, None), []), keep_first=False) if letter or roman else []
        if stem_pieces:
            stem_name = f"{set_id}-{q:02d}-stem.webp"
            if not os.path.exists(os.path.join(IMG, stem_name)):
                save(stack([trim(qp.crop(pg, r), 14) for pg, r in stem_pieces]), stem_name)
        stem_text = " ".join(qp.text(pg, r) for pg, r in stem_pieces)
        text = " ".join(qp.text(pg, r) for pg, r in keep)
        marks = marks_in(qp, pieces)
        hit = ms.get(key) or (ms.get((q, letter, None)) if roman else None) or (ms.get((q, None, None)) if letter or roman else None)
        msimg, ms_text, prac = None, "", 0
        if hit:
            hp, hr = hit["head"]
            head = ms_doc.crop(hp, hr)
            rows = [ms_doc.crop(pg, r) for pg, r in hit["pieces"]]
            msimg = stack([head] + rows, gap=0)
            ms_text, prac = hit["text"], hit["prac"]
            if marks is None and hit["total"] and hit is ms.get(key):
                marks = hit["total"]
        parts.append({
            "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": f"{letter or ''}{roman or ''}" or None, "label": label,
            "marks": marks,
            "qp": save(qimg, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", BOILER.sub(" ", stem_text + " " + text)).strip()[:1500],
            "msText": ms_text[:800],
            "er": er.get(f"{q:02d}"),
            "prac": prac,
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta, files.get("er", {}).get("section")), None
    except Exception:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], traceback.format_exc(limit=4)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" in files and (not ONLY or set_id.startswith(ONLY)):
            jobs.append((set_id, files, {"component": comp, "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"].get("title", ""),
                                         "subject": files["qp"]["subject"]}))
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            no_marks = sum(1 for p in parts if p["marks"] is None)
            no_er = len({p["question"] for p in parts if not p["er"]})
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {no_marks} without marks, {no_er} questions without report",
                  file=sys.stderr, flush=True)
            if not parts or no_ms:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
