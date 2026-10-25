"""Cut Pearson Edexcel papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/edexcel_sciences/cut_pearson.py [work-dir] [--only=9ch001]
    # needs: pip install pymupdf pillow

Pearson's layout differs from AQA's, so this is cut.py's sibling rather than a
mode of it. For every question paper in <work-dir>/manifest.json (fetch_pearson.py):
  - finds the labels down the left of each page: a bold question number ("3"),
    then its parts "(a)", "(b)" and sub-parts "(i)", "(ii)". A label only counts
    when it is the next one expected (3 after 2, (b) after (a)), which is what
    keeps stray numbers in tables and diagrams out, whatever the year's margins;
  - crops each part from its label to the next, across page breaks, inside the
    paper's frame (so "DO NOT WRITE IN THIS AREA" is dropped). A part's own
    opening words, "(b) Chemists can test for…", go above its first sub-part;
  - finds the same part's table in the mark scheme ("3(b)(i)", each under its
    own "Question Number" header) and crops it, header included;
  - keeps the examiner report's commentary for each question.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json
in cut.py's shape, so build_bank.py reads both.

Ids are <component><paper>-<series>-<question>[-<part>]: "9ch001-jun23-03-bi".
Older mark schemes are stored rotated, so everything is read and cropped in the
page's displayed orientation.
"""
import json, os, re, subprocess, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
# --whole: cut a whole question at a time, with all its scheme rows (maths, where a later part builds on an earlier one).
WHOLE = "--whole" in sys.argv
# --extracts: a question set on extracts and figures printed before it ("Read the following extracts (A to D)
# before answering Question 6") carries them in its stem (economics).
EXTRACTS = "--extracts" in sys.argv
READ = re.compile(r"^Read (the following |Figures? |Figure \d)", re.I)
# Economics lists a question's parts together, then prints each again above its answer space: "6 (a) With reference…".
RELABEL = re.compile(r"^\*?(\d{1,2})?\s*\(([a-n])\)\s")
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "edexcel-sciences")
IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)
SCALE = 2.2  # ~160 dpi, as cut.py

LETTERS = "abcdefghijklmn"
ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
LEAD = re.compile(r"^\*?\s*\(([a-z]{1,4})\)\s*")
STOP = re.compile(r"^(TOTAL FOR (SECTION|PAPER)|SECTION [A-C]\b|BLANK PAGE|END\s*$|END OF QUESTION PAPER|(?-i:ADDITIONAL ANSWER SPACE)\s*$)", re.I)  # the extra pages' heading, not "Additional answer space if required" inside a question
# Cambridge's papers end on a data sheet, the periodic table or the copyright notice, not "END OF QUESTION PAPER".
CAMBRIDGE_END = re.compile(r"^(Important values, constants and standards|The Periodic Table of Elements|Permission to reproduce items)")
BOILER = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\.{6,}|P\d{5}[A-Z]{1,2}\d*", re.I)


# ---------- reading pages in their displayed orientation ----------

def lines_of(page, clip=None, visible=False):
    """Horizontal lines of text as displayed: [{x0, y0, x1, y1, text, spans}] top to bottom.
    `visible`: leave out white text (Cambridge's 2025 specimens hide a second "[2]" under an answer line)."""
    m = page.rotation_matrix
    o = pymupdf.Point(0, 0) * m
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            d = pymupdf.Point(*line["dir"]) * m - o
            if abs(d.x - 1) > 0.05:
                continue  # vertical margin text
            spans = [s for s in line["spans"] if s["text"].strip() and not (visible and s["color"] == 0xFFFFFF)]
            if not spans:
                continue
            r = pymupdf.Rect(line["bbox"]) * m
            if clip is not None and not r.intersects(clip):
                continue
            # Spans set apart on the line ("3" in its margin, then the question) read as separate words.
            text = spans[0]["text"]
            for a, b in zip(spans, spans[1:]):
                gap = b["bbox"][0] - a["bbox"][2]
                text += (" " if gap > 1.5 and not a["text"].endswith((" ", "\t")) else "") + b["text"]
            out.append({"x0": r.x0, "y0": r.y0, "x1": r.x1, "y1": r.y1, "spans": spans,
                        "text": re.sub(r"\s+", " ", text).strip()})
    out.sort(key=lambda l: (round(l["y0"]), l["x0"]))
    return out


def inside(l, rect):
    return rect.contains(pymupdf.Point((l["x0"] + l["x1"]) / 2, (l["y0"] + l["y1"]) / 2))


def ocr_lines(doc, path, scale=SCALE, pages=None):
    """For a scanned paper with no text layer: each page's lines read by Apple's Vision
    framework (ocr.swift), cached in <work-dir>/ocr/. The leading question number is
    split into its own span, as it would be in a typeset paper. `pages`: only those."""
    name = os.path.basename(path) + ("" if scale == SCALE and pages is None else f"-{scale}-{'-'.join(map(str, sorted(pages or [])))}")
    cache = os.path.join(WORK, "ocr", name + ".json")
    if not os.path.exists(cache):
        tmp = os.path.join(WORK, "ocr", name)
        os.makedirs(tmp, exist_ok=True)
        pngs = []
        for i, page in enumerate(doc):
            if pages is not None and i not in pages:
                continue
            png = os.path.join(tmp, f"{i:03d}.png")
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(png)
            pngs.append(png)
        out = subprocess.run(["swift", os.path.join(HERE, "ocr.swift"), *pngs], capture_output=True, text=True, check=True).stdout
        read = {os.path.basename(json.loads(l)["file"]): json.loads(l)["lines"] for l in out.splitlines() if l.strip()}
        json.dump({str(i): read.get(f"{i:03d}.png", []) for i in range(len(doc))}, open(cache, "w"))
    result = {}
    for i, raw in json.load(open(cache)).items():
        lines = []
        for l in raw:
            x0, y0, x1, y1 = (l[k] / scale for k in ("x0", "y0", "x1", "y1"))
            text = l["text"].strip()
            m = re.match(r"^(\*?\d{1,2})\s+(.+)$", text)
            texts = [m.group(1), m.group(2)] if m else [text]
            spans = [{"text": t, "font": "OCR-Bold", "flags": 16, "bbox": (x0, y0, x1, y1)} for t in texts]
            lines.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "spans": spans, "text": re.sub(r"\s+", " ", text)})
        lines.sort(key=lambda l: (round(l["y0"]), l["x0"]))
        result[int(i)] = lines
    return result


class Doc:
    """A PDF with its pages rendered once, as displayed. A scanned PDF is read by OCR."""

    def __init__(self, path):
        self.doc = pymupdf.open(path)
        self._img, self._lines, self._frame = {}, {}, {}
        self.scanned = sum(len(self.doc[i].get_text().strip()) for i in range(min(6, len(self.doc)))) < 200
        # (IGCSE's newer specimens say neither, only "Cambridge IGCSE™" and "© Cambridge University Press & Assessment",
        # which OCR's papers also name: the qualification is what marks them.)
        self.cambridge = bool(re.search(r"© UCLES|Cambridge International|Cambridge IGCSE", "".join(self.doc[i].get_text() for i in range(min(2, len(self.doc))))))
        # Cambridge's specimen schemes set a landscape table on a portrait page, its text running
        # upwards, without marking the page rotated: turn such a page so it reads across.
        for page in self.doc if self.cambridge else []:
            dirs = [tuple(round(v) for v in l["dir"]) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])] if page.rotation == 0 else []
            if dirs.count((0, -1)) > len(dirs) / 2:
                page.set_rotation(90)
        if self.scanned:
            self._lines = ocr_lines(self.doc, path)
        # A typeset paper can still carry the odd page as a picture with no text (OCR's November 2021
        # Biology B AS Paper 1 has six): read just those pages by OCR.
        self.pictures = set() if self.scanned or self.cambridge else \
            {i for i in range(1, len(self.doc)) if len(self.doc[i].get_text().strip()) < 20 and self.doc[i].get_images()}
        if self.pictures:
            read = ocr_lines(self.doc, path, 4, self.pictures)  # at ~290 dpi: small labels come out garbled at the usual 160
            self._lines.update({i: read[i] for i in self.pictures})

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def frame(self, i):
        if i not in self._frame:
            f = frame(self.doc[i])
            # OCR prints "© OCR 2024" at the foot of each page, inside the margin.
            foot = [l["y0"] for l in self.lines(i) if l["text"].startswith("©") and l["y0"] > f.y1 - 90]
            if foot:
                f = pymupdf.Rect(f.x0, f.y0, f.x1, min(f.y1, min(foot) - 4))
            self._frame[i] = f
        return self._frame[i]

    def lines(self, i):
        if i not in self._lines:
            self._lines[i] = lines_of(self.doc[i], visible=self.cambridge)
            if self.cambridge:
                # A question number sits a fraction lower than its "(a)" (61.5 against 61.4): read a line's
                # pieces left to right when they start within 2pt of each other, not by rounded height.
                row, last, keyed = 0, None, []
                for l in self._lines[i]:
                    if last is not None and l["y0"] - last > 2:
                        row += 1
                    last = l["y0"]
                    keyed.append((row, l["x0"], l))
                self._lines[i] = [l for _, _, l in sorted(keyed, key=lambda k: k[:2])]
        return self._lines[i]

    def text(self, i, rect=None):
        return "\n".join(l["text"] for l in self.lines(i) if rect is None or inside(l, rect))

    def blank(self, i):
        t = self.text(i)
        return "BLANK PAGE" in t and len(t.strip()) < 200

    def crop(self, i, rect):
        if i not in self._img:
            pix = self.doc[i].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False, colorspace=pymupdf.csRGB)
            self._img[i] = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img = self._img[i]
        box = tuple(round(v * SCALE) for v in (rect.x0, rect.y0, rect.x1, rect.y1))
        box = (max(0, box[0]), max(0, box[1]), min(img.width, box[2]), min(img.height, box[3]))
        return img.crop(box) if box[2] > box[0] + 4 and box[3] > box[1] + 4 else None


def trim(img, keep=30, sides=False):
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


def squash(img, run=60, keep=20):
    """Close up long stretches with nothing but a table's side rules in them: economics' answer
    rows run on over empty cells."""
    if img is None:
        return None
    g = img.convert("L").point(lambda v: 255 if v < 160 else 0)
    w = g.width
    dark = [sum(1 for v in g.crop((0, y, w, y + 1)).getdata() if v) for y in range(g.height)]
    rows, start = [], None
    for y, d in enumerate(dark + [w]):
        if d <= 12:  # only the vertical rules cross this row
            start = y if start is None else start
            continue
        if start is not None and y - start > run:
            rows.append((start + keep // 2, y - keep // 2))
        start = None
    if not rows:
        return img
    parts, y0 = [], 0
    for a, b in rows:
        parts.append(img.crop((0, y0, img.width, a)))
        y0 = b
    parts.append(img.crop((0, y0, img.width, img.height)))
    out = Image.new("RGB", (img.width, sum(p.height for p in parts)), (255, 255, 255))
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    return out


def stack(images):
    images = [i for i in images if i is not None]
    if not images:
        return None
    w = max(i.width for i in images)
    out = Image.new("RGB", (w, sum(i.height for i in images) + 12 * (len(images) - 1)), (255, 255, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + 12
    return out


def save(img, name):
    if img is None:
        return None
    if img.height > 16000:
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    img.save(os.path.join(IMG, name), "WEBP", quality=72, method=4)
    return name


# ---------- question papers ----------

def drawings(page):
    """The page's vector drawings; PyMuPDF fails on a few of Pearson's pages, which then have none."""
    try:
        return page.get_drawings()
    except Exception:  # noqa: BLE001
        return []


def frame(page):
    """Inside the paper's answer frame: the largest drawn box on the page, else a margin."""
    w, h = page.rect.width, page.rect.height
    best = None
    for d in drawings(page):
        r = d["rect"] * page.rotation_matrix
        # A frame runs margin to margin; a big figure in the middle of a page isn't one (OCR draws no frame).
        if r.width > w * 0.7 and r.height > h * 0.6 and r.x0 < 70 and r.x1 > w - 70 and r.y0 < 90 \
                and (best is None or r.get_area() > best.get_area()):
            best = r
    if best is not None:
        return pymupdf.Rect(best.x0 + 3, best.y0 + 3, best.x1 - 3, best.y1 - 3)
    return pymupdf.Rect(40, 40, w - 40, h - 50)


def qp_labels(doc):
    """Every label in reading order: [(page, y, q, letter, roman)]; letter/roman None for higher levels.
    Also the page index where the paper's questions end."""
    out, q, letter, roman, letter_x = [], 0, None, None, 0
    end_page = len(doc) - 1
    after_read = False  # past an extracts block's "Read the following…", with no question number since
    for i in range(1, len(doc)):
        if doc.blank(i):
            continue
        # OCR's maths papers open with a formulae sheet; its numbers aren't questions.
        if q == 0 and len(set(re.findall(r"Arithmetic series|Geometric series|Binomial series|Differentiation from first principles|"
                                         r"Standard deviation|Kinematics|Formulae", doc.text(i)))) >= 2:
            continue
        f = doc.frame(i)
        stop = False
        for l in doc.lines(i):
            if l["y0"] > f.y1 or l["y0"] < f.y0 - 4:
                continue
            if EXTRACTS and l["text"].strip() == str(i + 1) and l["spans"][0].get("size", 12) < 11:
                continue  # the page number, which Pearson's economics papers print bold at the left of even pages
            if re.match(r"TOTAL FOR PAPER|END OF QUESTION PAPER", l["text"], re.I) or doc.cambridge and CAMBRIDGE_END.match(l["text"]):
                stop = True
                break
            rest = l["text"]
            first = l["spans"][0]
            # A question number: at the frame's left edge, the next one expected, set apart from
            # the question (in its own span, or followed by a capital or a part label).
            m = re.match(r"^\*?(\d{1,2})\b\*?\s*(.*)$", rest)
            lead = first["text"].strip() + (l["spans"][1]["text"].strip() if first["text"].strip() == "*" and len(l["spans"]) > 1 else "")
            # Numbered answer spaces ("1 ........", "2 ........") are not questions.
            # (Cambridge sets its number in bold, sometimes in one span with algebra after it: "10 a = 5/7".)
            apart = m and not re.match(r"[.…_]", m.group(2)) and (re.fullmatch(r"\*?\d{1,2}\*?", lead) or not m.group(2) or re.match(r"[A-Z(]", m.group(2))
                                                               or doc.cambridge and bold(first))
            if EXTRACTS and after_read and m and not (re.fullmatch(r"\*?\d{1,2}\*?", lead) or m.group(2).startswith("(")):
                apart = False  # inside the extracts, a date: "6 April 2023. It is…"
            if EXTRACTS and READ.match(l["text"]):
                after_read = True
            # OCR can miss a small number entirely, so a scanned paper may skip one.
            if m and apart and l["x0"] < f.x0 + 16 \
                    and (int(m.group(1)) == q + 1 or doc.scanned and int(m.group(1)) == q + 2):
                q, letter, roman = int(m.group(1)), None, None
                out.append((i, l["y0"], q, None, None))
                rest = m.group(2)
                after_read = False
            elif EXTRACTS and after_read and letter and l["x0"] < f.x0 + 30 and re.match(r"\(a\)\s", rest):
                # The question's number is a glyph with no text (June 2017): its "(a)", straight after the extracts, starts it.
                q, letter, roman, after_read = q + 1, None, None, False
                out.append((i, l["y0"], q, None, None))
            elif q == 0:
                continue
            # Then a part and a sub-part, either of which can share the line: "(a) (i) Which…".
            for n in range(2):
                m = LEAD.match(rest)
                if not m:
                    break
                tok = m.group(1)
                nxt_letter = LETTERS[LETTERS.index(letter) + 1] if letter and letter != LETTERS[-1] else ("a" if not letter else None)
                nxt_roman = ROMANS[ROMANS.index(roman) + 1] if roman and roman != ROMANS[-1] else ("i" if not roman else None)
                # After (h), "(i)" is either the next part or (h)'s first sub-part: a sub-part is
                # indented past its part's label, or follows it on the same line.
                indented = n == 1 or l["x0"] > letter_x + 8
                if tok == nxt_roman and letter and (tok != nxt_letter or roman or indented):
                    roman = tok
                    out.append((i, l["y0"], q, letter, roman))
                elif tok == nxt_letter:
                    letter, roman, letter_x = tok, None, l["x0"]
                    out.append((i, l["y0"], q, letter, None))
                elif tok == "i" and not letter:
                    break  # "(i)" before any "(a)": a list in the question, not a label
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
        f = doc.frame(pg)
        top = y - 5 if (pg, y) == start else f.y0
        bottom = nxt[1] - 5 if nxt and nxt[0] == pg else f.y1
        for l in doc.lines(pg):
            if l["y0"] > top + 2 and l["y0"] < bottom and (STOP.match(l["text"]) or doc.cambridge and CAMBRIDGE_END.match(l["text"])):
                bottom = l["y0"] - 4
                break
        if bottom > top + 10:
            pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        if (nxt and nxt[0] == pg) or pg >= end_page:
            break
        pg += 1
        while pg < end_page and doc.blank(pg):
            pg += 1
        if nxt and pg > nxt[0]:
            break
    return pieces


def source_booklet(doc, end_page):
    """{"B": [(page, rect)], ...}: each "Sources for use with SECTION B" block of a source booklet
    bound in after the questions, to the next block or the booklet's end, blank pages left out."""
    found = [(i, l["y0"], re.match(r"Sources for use with SECTION ([A-C])", l["text"]).group(1))
             for i in range(end_page + 1, len(doc)) for l in doc.lines(i) if re.match(r"Sources for use with SECTION [A-C]", l["text"])]
    out = {}
    for n, (pg, y, sec) in enumerate(found):
        stop = found[n + 1][:2] if n + 1 < len(found) else (len(doc), 0)
        pieces = []
        for i in range(pg, min(stop[0] + 1, len(doc))):
            f = doc.frame(i)
            top = y - 4 if i == pg else f.y0
            bottom = stop[1] - 4 if i == stop[0] else f.y1
            if bottom > top + 10 and not re.search(r"BLANK PAGE", doc.text(i)) and has_content(doc, i, pymupdf.Rect(f.x0, top, f.x1, bottom)):
                pieces.append((i, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        out[sec] = pieces
    return out


def has_content(doc, pg, rect):
    words = BOILER.sub(" ", doc.text(pg, rect))
    if re.search(r"[A-Za-z]{3,}", words):
        return True
    small = [d for d in drawings(doc[pg]) if (d["rect"] * doc[pg].rotation_matrix).intersects(rect) and d["rect"].width < 400]
    return len(small) > 12  # a grid or a diagram to draw on


def marks_in(doc, pieces):
    total, found = 0, False
    for pg, rect in pieces:
        for l in doc.lines(pg):
            # A "[1]" at the very foot of a page, just above OCR's footer, can have its middle below the part's crop: its top counts.
            if not inside(l, rect) and not (rect.x0 <= l["x0"] <= rect.x1 and rect.y0 <= l["y0"] <= rect.y1 and l["y0"] > doc.frame(pg).y1 - 24
                                            and re.search(r"\[\d{1,2}\]$", l["text"])):
                continue
            m = re.fullmatch(r"\((\d{1,2})\)", l["text"])
            if m and (l["x0"] <= rect.x1 - 140 or doc.cambridge):  # Cambridge's "(n)" are only ever in tables and diagrams
                m = None
            m = m or re.search(r"\[(\d{1,2})\]$", l["text"])  # OCR: "........ [2]" at the end of the answer line
            if not m and pg in doc.pictures:
                m = re.search(r"(?:^|\s)[1l|(]?(\d)\]$", l["text"])  # read off a picture, "[2]" can come out "12]"
            # (a "[3]" beside a tall fraction's bracket starts above its line: Cambridge's are read by their middle)
            if m and (rect.y0 <= (l["y0"] + l["y1"]) / 2 if doc.cambridge else rect.y0 <= l["y0"] <= rect.y1):
                total += int(m.group(1))
                found = True
    return total if found else None


# ---------- mark schemes ----------

def bold(span):
    return "Bold" in span["font"] or bool(span["flags"] & 16)

# "3(b)(i)", "3 (b)(i)", or with the brackets left off: "1 a i".
# "3(b)(i)", "3 (b)(i)", "1 a i", "1ai", "12(ai)"; and, carrying on from the row above, "(b)i".
# Extended-response questions carry a star, before or after the number: "*5", "5*", "5(b)*".
MS_LABEL = re.compile(r"^\*?\s*(\d{1,2})?\*?((?:\s*\(?[a-z]{1,5}\)?)*)\s*\*?$")
HEAD = re.compile(r"Question( Number| Key)?|Q|No\.( AO)?")  # OCR Chemistry B's multiple-choice keys head theirs "Question Key", "Q" or "No."
def is_head(l, lines):
    """A "Question" header; a bare "Q" only beside "Key", and "No." beside "Key" or "AO", as in Chemistry B's
    multiple-choice keys. Alone, "Q" is a point Q in a maths answer; beside "Marks", MEI's ordinary header."""
    if not HEAD.fullmatch(l["text"]):
        return False
    beside = [o["text"].lower() for o in lines if o is not l and abs(o["y0"] - l["y0"]) < 4]  # "Key" or "KEY"
    return l["text"].startswith("Question") or l["text"].startswith("No.") and (l["text"] == "No. AO" or any(t in ("key", "ao") for t in beside)) \
        or l["text"] == "Q" and "key" in beside


def ms_page_box(doc, p):
    """Where a scheme page's rows can be. Cambridge's pages run a header and footer across
    every page ("9709/11 … Mark Scheme … PUBLISHED", "© Cambridge … Page 7 of 18"), and its
    specimen schemes print them down the margins: keep to the table, inside them."""
    page = doc[p]
    w, h = page.rect.width, page.rect.height
    if not doc.cambridge:
        # OCR runs "H422/01  Mark Scheme  June 2018" and the page number along the top or foot of every page.
        lines = doc.lines(p)
        running = re.compile(r"[A-Z]\d{3}/\d\d|Mark Scheme|(January|June|October|November) \d{4}")
        # The page number is centred and alone on its line: a lone "0" or "2" elsewhere is a levels grid's row or a question's label.
        page_no = lambda l: re.fullmatch(r"\d{1,3}", l["text"]) and abs((l["x0"] + l["x1"]) / 2 - w / 2) < 40 \
            and not any(o is not l and abs(o["y0"] - l["y0"]) < 6 for o in lines)  # noqa: E731
        head = [l["y1"] for l in lines if l["y1"] < 70 and (running.fullmatch(l["text"]) or page_no(l))]
        foot = [l["y0"] for l in lines if l["y0"] > h - 70 and (running.fullmatch(l["text"]) or page_no(l))]
        return pymupdf.Rect(20, max(head) + 4 if head else 20, w - 20, min(foot) - 4 if foot else h - 30)
    lines = doc.lines(p)
    head = [l["y1"] for l in lines if l["y0"] < 90 and re.search(r"Mark Scheme|PUBLISHED|SPECIMEN|^\d{4}/\d{2}|May/June|For examination|from 20\d\d", l["text"])]
    foot = [l["y0"] for l in lines if l["y0"] > h - 70 and re.match(r"©|Page \d+ of \d+", l["text"])]
    rules = [r for r in (d["rect"] * page.rotation_matrix for d in drawings(page)) if r.width > 30]  # the table's cells and rules
    x0, x1 = (min(r.x0 for r in rules) - 2, max(r.x1 for r in rules) + 2) if rules else (20, w - 20)
    return pymupdf.Rect(max(4, x0), max(head) + 4 if head else 20, min(w - 4, x1), min(foot) - 4 if foot else h - 30)


def table_rules(page):
    """The heights of a page's horizontal rules and cell edges, as displayed."""
    ys = set()
    for d in drawings(page):
        r = d["rect"] * page.rotation_matrix
        if r.width > 30:
            ys.update((r.y0, r.y1))
    return sorted(ys)


def ms_tables(doc):
    """{(q, letter, roman): [(page, rect)], ...} plus each one's text and any MCQ answer letter."""
    found = []  # (page, top, key, label_y)
    rules = {}  # page: table_rules(page), for Cambridge
    # Labels sit in the "Question Number" column. Not every scheme sets them in bold, and
    # the header can be centred over them or set to one side, so a label is anything
    # label-shaped under the span of its column's header.
    all_heads = [l for i in range(len(doc)) for l in doc.lines(i) if is_head(l, doc.lines(i))]
    typical = sorted(all_heads, key=lambda h: h["x0"])[len(all_heads) // 2] if all_heads else None
    q_now, letter_now = None, None
    for i in range(len(doc)):
        lines = doc.lines(i)
        heads = [l for l in lines if is_head(l, lines)]

        def column(l):
            above = [h for h in heads if h["y0"] <= l["y0"]]
            h = above[-1] if above else (heads[0] if heads else typical)
            # (Cambridge numbers the points of an answer, "1 oxygen is the final electron acceptor", just
            # right of its narrow Question column: keep strictly to the column there.)
            return h is None and bold(l["spans"][0]) or h is not None and h["x0"] - 40 < l["x0"] < h["x1"] + (-4 if doc.cambridge else 10)

        # (OCR Chemistry B centres its multiple-choice key, "Question | Key | AO", mid-page: a bare
        # number under a header there is a label too.)
        centred = lambda l: re.fullmatch(r"\d{1,2}", l["text"]) and any(h["x0"] >= 200 and h["y0"] < l["y0"] for h in heads)  # noqa: E731
        cands = [l for l in lines if (l["x0"] < 200 or centred(l)) and not is_head(l, lines) and column(l)
                 # Cambridge's schemes open with numbered marking instructions: a label is only ever under a header.
                 and (not doc.cambridge or any(h["y0"] < l["y0"] for h in heads))]
        # OCR splits a label across columns of one row: "16", "(a)", "(i)". Join pieces that are each label-shaped.
        label_piece = re.compile(r"\*?\s*(\d{1,2}\*?)?(\s*\(?[a-z]{1,5}\)?)*\s*")
        piece = type("P", (), {"fullmatch": staticmethod(lambda t: len(t) <= 16 and label_piece.fullmatch(t))})  # short first: a long line would backtrack
        bare = lambda t: t.strip().strip("()") in LETTERS or t.strip().strip("()") in ROMANS  # noqa: E731
        # A two-digit number can wrap in a narrow column: "1" with "8" under it.
        stacked, skip = [], set()
        for k, l in enumerate(cands):
            if k in skip:
                continue
            # (Only where a part label sits beside the first digit: a multiple-choice table's "1", "2"
            # rows are as close together, but have nothing beside them.)
            beside = any(abs(o["y0"] - l["y0"]) < 3 and o["x0"] > l["x0"] and re.match(r"\s*\([a-z]", o["text"]) for o in cands)
            below = next((j for j, o in enumerate(cands) if beside and j != k and j not in skip and re.fullmatch(r"\d", l["text"])
                          and re.fullmatch(r"\d\*?", o["text"]) and abs(o["x0"] - l["x0"]) < 5 and 0 < o["y0"] - l["y0"] < 16), None)
            if below is not None:
                skip.add(below)
                l = {**l, "text": l["text"] + cands[below]["text"]}
            stacked.append(l)
        cands = stacked
        rows = []
        for l in sorted(cands, key=lambda l: (round(l["y0"]), l["x0"])):
            if rows and abs(rows[-1]["y0"] - l["y0"]) < 3 and piece.fullmatch(rows[-1]["text"]) and piece.fullmatch(l["text"]) \
                    and (re.match(r"\s*\(", l["text"]) or bare(l["text"]) and bold(l["spans"][0])) and l["x0"] > rows[-1]["x0"]:
                rows[-1] = {**rows[-1], "text": rows[-1]["text"] + " " + l["text"], "x1": l["x1"]}
            else:
                rows.append(l)
        cands = rows
        for k, l in enumerate(cands):
            label = l["text"].strip()
            # A label can wrap: "1(a)" then "(ii)" on the next line of its cell.
            if k + 1 < len(cands) and re.fullmatch(r"(\([a-z]{1,4}\))+", re.sub(r"\s+", "", cands[k + 1]["text"])) \
                    and abs(cands[k + 1]["x0"] - l["x0"]) < 12 and 0 < cands[k + 1]["y0"] - l["y0"] < 16:
                label += cands[k + 1]["text"]
            # OCR can set a label and the start of its answer as one line: "(iii) path difference…".
            # Read label pieces off the front while they are one ("(b) (i)" stays whole); the answer
            # can start with a bracket of its own ("(iii) (cells) divide").
            if not (len(label) <= 16 and MS_LABEL.match(label)):
                num = re.match(r"\*?\s*(\d{1,2})?\*?", label)
                pos, n = num.end(), 0
                while n < 2:
                    # bracketed, or bare in its bold label column: "iii idea of comparing…"
                    t = re.match(r"\s*\(([a-z]{1,5})\)", label[pos:]) or (bold(l["spans"][0]) and re.match(r"\s*([a-z]{1,4})(?=\s)", label[pos:]))
                    if not (t and (t.group(1) in LETTERS or t.group(1) in ROMANS)):
                        break
                    pos, n = pos + t.end(), n + 1
                if n and label[pos:].strip():
                    label = label[:pos]
            if not label or len(label) > 16:
                continue  # labels are short; a long line would only make the pattern backtrack
            m = MS_LABEL.match(label)
            if not m:
                continue
            subs = re.findall(r"[a-z]{1,5}", m.group(2))
            if len(subs) == 1 and subs[0] not in LETTERS and subs[0] not in ROMANS and subs[0][0] in LETTERS and subs[0][1:] in ROMANS:
                subs = [subs[0][0], subs[0][1:]]  # "1ai": no brackets, no spaces
            if len(subs) > 2 or any(x not in LETTERS and x not in ROMANS for x in subs):
                continue
            if m.group(1):
                q_now, letter_now = int(m.group(1)), None
            elif not subs or q_now is None or ("(" not in label and not bold(l["spans"][0])):
                continue  # a bare word, not "(b)i" (or a bold "b" in its own column)
            letter = subs[0] if subs and subs[0] in LETTERS and (subs[0] != "i" or len(subs) == 2) else None
            roman = subs[1] if len(subs) > 1 else (subs[0] if subs and subs[0] in ROMANS and not letter else None)
            if letter:
                letter_now = letter
            elif roman and not m.group(1) and letter_now:
                letter = letter_now  # a row of its own for "(ii)" carries on "16 (a) (i)" above
            # A header heads only the first label under it: in a multiple-choice table one header
            # sits over fifteen rows.
            above = [h for h in heads if h["y0"] < l["y0"] and l["y0"] - h["y0"] < 60
                     and not any(fi == i and h["y0"] < fy < l["y0"] for fi, _, _, fy in found)]
            ref = above[-1]["y0"] if above else l["y0"]
            top = ref - 6
            if doc.cambridge:
                # Cambridge rules every row, and a one-line row sits only a few points under the one
                # above: start at the row's rule, so the row above keeps the foot of its last line.
                if i not in rules:
                    rules[i] = table_rules(doc[i])
                edge = [y for y in rules[i] if ref - 12 <= y <= ref + 1]
                top = edge[-1] - 0.5 if edge else top
            key = (q_now, letter, roman)
            prev = found[-1][2] if found else None
            if doc.cambridge and prev and any(f[2] == key for f in found) and prev[0] == q_now and prev[2] in ROMANS \
                    and roman == ROMANS[ROMANS.index(prev[2]) + 1]:
                key = (q_now, prev[1], roman)  # a misprint, "1(b)(ii)" for the 1(c)(ii) after 1(c)(i)
                letter_now = prev[1]
            found.append((i, top, key, l["y0"]))
    found.sort(key=lambda f: (f[0], f[1]))
    # OCR's misread labels, put right from the row above: "16 (ii)" lost its letter after 16(d)(i),
    # and "16(b)(k)" or "1(a)(x)" is a roman the font garbled, where the next one belongs.
    for n in range(1, len(found)):
        q, letter, roman = found[n][2]
        pq, pletter, proman = found[n - 1][2]
        if q != pq or not pletter or proman not in ROMANS or ROMANS.index(proman) + 1 >= len(ROMANS):
            continue
        after = ROMANS[ROMANS.index(proman) + 1]
        garbled = roman and (roman not in ROMANS or ROMANS.index(roman) > ROMANS.index(after) + 2)  # "(x)" straight after "(i)"
        if (letter is None and roman == after) or (letter == pletter and garbled):
            found[n] = (found[n][0], found[n][1], (q, pletter, after), found[n][3])
    out = {}
    # A multiple-choice key's rows can be a single line each, "7  C  1": such a row runs from its own
    # line to the next, where a taller row starts a little above its label.
    line_row = lambda a, b: a and b and a[0] == b[0] and a[2][1] is None and b[2][1] is None and 0 < b[3] - a[3] < 20  # noqa: E731
    for n, (pg, top, key, fy) in enumerate(found):
        nxt = found[n + 1] if n + 1 < len(found) else None
        if line_row(found[n - 1] if n else None, found[n]) and top > fy - 7:
            top = fy - 2
        pieces, p = [], pg
        while True:
            box = ms_page_box(doc, p)
            t = top if p == pg else box.y0
            b = (nxt[3] if line_row(found[n], nxt) else nxt[1] - (0 if doc.cambridge else 2)) if nxt and nxt[0] == p else box.y1
            if EXTRACTS and not (nxt and nxt[0] == p):
                # The next table's header can close a page, its first row overleaf: leave it to that table.
                rest = [l for l in doc.lines(p) if l["y0"] > t + 6]
                head = next((k for k, l in enumerate(rest) if re.match(r"Questio", l["text"]) and l["x0"] < 200), None)
                if head is not None and all(re.fullmatch(r"(n|Number|Answer|Indicative content|Mark|Question|Questio)", l["text"].strip()) for l in rest[head:]):
                    b = rest[head]["y0"] - 4
            # (a multiple-choice row can be a single 13pt line; Cambridge's rows start at their rule, so the
            # strip above a table carried over to the next page holds no text, only that rule)
            if b > t + 6 and not (doc.cambridge and not doc.text(p, pymupdf.Rect(box.x0, t, box.x1, b)).strip()):
                pieces.append((p, pymupdf.Rect(box.x0, t, box.x1, b)))
            if (nxt and nxt[0] <= p) or p + 1 >= len(doc):
                break
            p += 1
            # Economics' long answers run on over pages of empty table borders, then the levels grids: step over the blanks.
            while EXTRACTS and p + 1 < len(doc) and not doc.lines(p) and not (nxt and nxt[0] <= p):
                p += 1
            if not doc.lines(p) or re.match(r"Pearson Education Limited", doc.text(p).strip()):
                break
        text = " ".join(doc.text(p, r) for p, r in pieces)
        if key not in out or (pieces and not out[key][0]):  # a label read twice: the copy with a row under it
            ans = re.search(r"(?:only )?correct answer is\s*\(?([A-D])\b", text)
            if not ans and key[1] is None:  # OCR's multiple-choice rows: "7   C ✓"
                ans = re.search(rf"(?<![\d.]){key[0]}\s+([A-D])(?![\w])", text)
                if not ans and len(text) < 80:  # "4  1  C", "7  1  1.1  C": mark and AO before the letter (not "5 A suitable method…")
                    row = re.sub(r"^(?:\s*(?:Question|Q|No\.|KEY|Key|AO( element)?|Answer|Marks?)(?![\w.]))+", "", text)  # the table's header ("Q KEY AO", "AO element"), on its first row
                    ans = re.match(rf"\s*{key[0]}\s+(?:[\d.]+\s+){{0,2}}([A-D])(?![\w.])(?!\s+[a-z])", row)
            out[key] = (pieces, re.sub(r"\s+", " ", text), ans.group(1) if ans else None)
    return out


# ---------- examiner reports ----------

DROP = re.compile(r"^(Examiner Comments?|Examiner Tips?|GCE [A-Z][\w ]+ \w{4} \w{2}|\d+|Grade boundaries.*)$", re.I)


def examiner_report(path, section=None):
    """{"03": "Question 3(b)(i)\\n\\n<paragraphs>…"} — every heading kept, so the page can lead with a part's own.
    `section`: Cambridge writes one report per syllabus, a section per component ("Paper 9709/11"); read only that one."""
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    if section:
        spec = section.split("/")[0]
        m = re.search(rf"\n\s*Paper {re.escape(section)}\s*\n", text)
        if not m:
            return {}
        text = re.split(rf"\n\s*Paper {spec}/\d\d\s*\n", text[m.end():])[0]
        # The running header: "Cambridge International … 9709 Mathematics June 2024 Principal Examiner Report for Teachers © 2024".
        text = re.sub(r"\n\s*Cambridge International[^\n]*\n[^\n]*\n\s*Principal Examiner Report for Teachers\s*\n(?:\s*\n)*\s*© (?:UCLES )?\d{4}\s*\n", "\n", text)
        # Its parts are headings of their own, "(a)" on a line: each starts the paragraph under it.
        text = re.sub(r"\n[ \t]*(\([a-z]{1,4}\)(?:[ \t]*\([ivx]{1,4}\))?)[ \t]*\n(?:[ \t]*\n)*", r"\n\n\1 ", text)
        # Its maths comes out a symbol a line ("−", "1", "2", "y"): keep those pieces in their sentence,
        # where a lone number would otherwise read as a page number and break the paragraph.
        text = re.sub(r"\n[ \t]*([^\s(][^\n]{0,2}?)[ \t]*(?=\n)", r" \1", text)
    if EXTRACTS:
        # Economics reports also head a part "Question 1 (a):" or just "1a" on its own line.
        text = re.sub(r"\n(\s*Question\s+\d{1,2}\s*(?:\(\s*[a-z]{1,4}\s*\)\s*)*):[ \t]*\n", r"\n\1\n", text)
        text = re.sub(r"\n[ \t]*(\d{1,2})\(?([a-e])\)?[ \t]*\n", r"\nQuestion \1 (\2)\n", text)
        # …or open a paragraph with it, "Question 6a asked candidates…": a heading goes above, the sentence stays.
        text = re.sub(r"\n[ \t]*Question (\d{1,2})([a-e])?(?=[ \t]+[a-z])",
                      lambda m: f"\nQuestion {m.group(1)}{f' ({m.group(2)})' if m.group(2) else ''}\n\nQuestion {m.group(1)}{m.group(2) or ''}", text)
    chunks = re.split(r"\n\s*(Question\s+(\d{1,2})\s*((?:\(\s*[a-z]{1,4}(?:\s*[–-]\s*[a-z]{1,4})?\s*\)\s*)*))\s*\n", text)
    out = {}
    for k in range(1, len(chunks) - 3, 4):
        head, q, sub, body = chunks[k], int(chunks[k + 1]), chunks[k + 2], chunks[k + 3]
        body = re.split(r"\n\s*(?:Paper Summary|Grade boundaries|Summary\s*\n|Based on their performance)", body)[0]
        keep = []
        for line in body.split("\n"):
            s = line.strip()
            if DROP.match(s) or re.match(r"^(This|The) (response|candidate|answer)\b.*(marks?|scored|gained)", s, re.I):
                keep.append("")
                continue
            keep.append(s)
        body = "\n".join(keep)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body)
        body = re.sub(r"[ \t]+", " ", body)
        paras = [p.strip() for p in re.split(r"\n{2,}", body) if len(p.strip()) > 40]
        if not paras:
            continue
        label = f"{q}{re.sub(r'[ ]+', '', sub)}" if sub.strip() else ""
        piece = "\n\n".join(([f"Question {label}"] if label else []) + paras)
        key = f"{q:02d}"
        out[key] = out[key] + "\n\n" + piece if key in out else piece
    return out


# ---------- one paper ----------

def hand_labels(set_id):
    """A scanned paper whose labels OCR misreads can have them set by hand, read off the
    paper page by page, and any paper its marks where the cutter can't read them:
    scripts/question-bank/labels/<set>.json, {"end_page": 25,
    "labels": [[page, y, q, letter, roman], ...], "ms_alias": [[[19, "c", "ii"], [19, "c", "a"]]],
    "keys": {"1": "A", ...}, "marks": {"17(b)(i)": 2, ...}}: a scheme row the scheme itself
    misprints, as [the part, what the scheme calls it]; the multiple-choice answers, read off the
    scheme's table; and marks that can't be read, read off the paper or its scheme. Only
    "labels" makes a scan's parts trusted without the checks below."""
    path = os.path.join(HERE, "..", "labels", f"{set_id}.json")
    return json.load(open(path)) if os.path.exists(path) else None


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = Doc(qp_path)
    hand = hand_labels(set_id)
    labels, end_page = ([tuple(x) for x in hand["labels"]], hand["end_page"]) if hand and "labels" in hand else qp_labels(qp)
    ms = ms_tables(Doc(ms_path)) if ms_path and os.path.exists(ms_path) else {}
    for good, bad in (hand or {}).get("ms_alias", []):
        if tuple(bad) in ms:
            ms[tuple(good)] = ms.pop(tuple(bad))
    ms_doc = Doc(ms_path) if ms else None
    er = examiner_report(er_path, meta.pop("erSection", None))
    relabels = []  # (page, y, q, letter) of each part printed a second time
    if EXTRACTS:
        at = {(pg, round(y)) for pg, y, *_ in labels}
        for i in range(1, end_page + 1):
            f = qp.frame(i)
            for l in qp.lines(i):
                m = RELABEL.match(l["text"])
                if m and l["x0"] < f.x0 + 30 and f.y0 - 4 <= l["y0"] <= f.y1 and (i, round(l["y0"])) not in at:
                    q_now = next((q for pg, y, q, letter, _ in reversed(labels) if letter is None and (pg, y) < (i, l["y0"])), None)
                    if q_now:
                        relabels.append((i, l["y0"], int(m.group(1) or q_now), m.group(2)))
    regions = []
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        # A part's region also ends where the parts start being printed again.
        again = next(((rp, ry) for rp, ry, *_ in relabels if (rp, ry) > (pg, y)), None)
        end = min(x for x in [(nxt[0], nxt[1]) if nxt else None, again] if x) if nxt or again else None
        regions.append(((q, letter, roman), region(qp, (pg, y), end, end_page)))
    if WHOLE:
        starts = [(pg, y, q) for pg, y, q, letter, _ in labels if letter is None]
        regions = [((q, None, None), region(qp, (pg, y), (starts[n + 1][0], starts[n + 1][1]) if n + 1 < len(starts) else None, end_page))
                   for n, (pg, y, q) in enumerate(starts)]
        whole_ms = {}
        for k in sorted(ms, key=lambda k: (ms[k][0][0][0], ms[k][0][0][1].y0) if ms[k][0] else (0, 0)):
            pieces, text, ans = ms[k]
            got = whole_ms.setdefault((k[0], None, None), ([], "", None))
            whole_ms[(k[0], None, None)] = (got[0] + pieces, (got[1] + " " + text).strip(), got[2] or ans)
        ms = whole_ms
    keys = [k for k, _ in regions]
    extracts = {}
    if EXTRACTS:
        starts = [(pg, y, q) for pg, y, q, letter, _ in labels if letter is None]
        booklet = source_booklet(qp, end_page)
        section = None
        for i in range(1, end_page + 1):
            lines = qp.lines(i)
            for k, l in enumerate(lines):
                m = re.match(r"SECTION ([A-C])\b", l["text"])
                section = m.group(1) if m else section
                if READ.match(l["text"]):
                    nxt = next(((pg, y, q) for pg, y, q in starts if (pg, y) > (i, l["y0"])), None)
                    if nxt:
                        pieces = [p for p in region(qp, (i, l["y0"]), (nxt[0], nxt[1]), end_page) if has_content(qp, *p)]
                        # From June 2025 the extracts are in a source booklet bound in at the back.
                        said = " ".join(x["text"] for x in lines[k:k + 2])
                        if "Source Booklet" in said and section in booklet:
                            pieces += booklet[section]
                        extracts[nxt[2]] = pieces
    # A question with parts, or a part with sub-parts, isn't itself a question to show.
    has_children = lambda k: any(o[0] == k[0] and ((k[1] is None and o[1]) or (k[1] and not k[2] and o[1] == k[1] and o[2])) for o in keys)  # noqa: E731
    leaves = [k for k in keys if not has_children(k)]
    by_key = dict(regions)
    if qp.scanned and ms and not (hand and "labels" in hand):
        # OCR can miss a label; the part before it then runs on into it. The mark scheme
        # lists every part, so leave out any part whose next one was missed.
        order = sorted(ms, key=lambda k: (k[0], k[1] or "", ROMANS.index(k[2]) + 1 if k[2] in ROMANS else 0))
        found = set(keys)
        for n, k in enumerate(order[:-1]):
            nxt = order[n + 1]
            covered = any(f[0] == nxt[0] and (nxt[1] is None or f[1] == nxt[1]) and (nxt[2] is None or f[2] == nxt[2]) for f in found)
            if k in found and not covered:
                leaves = [x for x in leaves if x != k]
    parts = []
    for key in leaves:
        q, letter, roman = key
        pieces = list(by_key[key])
        lead_n = 0  # pieces of the part's opening words, set in front
        # The first sub-part of a part carries the part's opening words: "(b) Chemists can test…".
        if roman == "i" and (q, letter, None) in by_key:
            lead = [p for p in by_key[(q, letter, None)] if has_content(qp, *p)]
            pieces, lead_n = lead + pieces, len(lead)
        first = lead_n + 1 if EXTRACTS else 1  # a sub-part's own start stays, even "(i) 2015"
        keep = pieces[:first] + [p for p in pieces[first:] if has_content(qp, *p)]
        if EXTRACTS:
            # Long answers: show the question, not its pages of answer lines. End just under its marks
            # ("(8)", unless a multiple choice's options follow them) or its "(Total for Question 8 = 25 marks)",
            # or above the "OR" that brings in the other essay choice.
            for n, (pg, r) in enumerate(keep):
                if n < lead_n:
                    continue  # "(b) … calculate the index number for (2)": the marks for the sub-parts below
                inner = [l for l in qp.lines(pg) if inside(l, r) and l["y0"] > r.y0 + 2]
                end = None
                for k, l in enumerate(inner):
                    if re.fullmatch(r"\(\d{1,2}\)", l["text"]) and l["x0"] > r.x1 - 140 \
                            and not any(re.match(r"[A-D](\s|$)", o["text"].strip()) for o in inner[k + 1:]):
                        end = l["y1"] + 6
                    elif re.match(r"\(Total for Question \d+ = \d+ marks?\)", l["text"]):
                        end = l["y1"] + 6
                    elif l["text"].strip() in ("OR", "EITHER"):
                        end = l["y0"] - 4
                    if end:
                        break
                if end:
                    keep = keep[:n] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, end))]
                    break
        label = f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else "")
        pid = f"{set_id}-{q:02d}" + (f"-{letter or ''}{roman or ''}" if letter or roman else "")
        qimg = stack([trim(qp.crop(pg, r)) for pg, r in keep])
        stem_name = None
        if letter and ((q, None, None) in by_key or q in extracts):
            stem_pieces = extracts.get(q, []) + [p for p in by_key.get((q, None, None), []) if has_content(qp, *p)]
            if stem_pieces:
                stem_name = f"{set_id}-{q:02d}-stem.webp"
                if not os.path.exists(os.path.join(IMG, stem_name)):
                    save(stack([trim(qp.crop(pg, r), 14) for pg, r in stem_pieces]), stem_name)
        stem_text = " ".join(qp.text(pg, r) for pg, r in extracts.get(q, []) + by_key.get((q, None, None), [])) if letter else ""
        text = " ".join(qp.text(pg, r) for pg, r in keep)
        marks = marks_in(qp, pieces)  # all of it: a long answer's "[6]" can sit on a page of answer lines we don't show
        if marks is None and letter and not roman:
            # Listed without its marks: they're beside the part where it's printed again, above its answer space.
            for n, (rp, ry, rq, rl) in enumerate(relabels):
                if (rq, rl) == (q, letter):
                    nxt_l = next(((pg, y) for pg, y, *_ in labels if (pg, y) > (rp, ry)), None)
                    stops = [x for x in [nxt_l, (relabels[n + 1][0], relabels[n + 1][1]) if n + 1 < len(relabels) else None] if x]
                    marks = marks_in(qp, region(qp, (rp, ry), min(stops) if stops else None, end_page))
                    break
        if marks is None and not letter:  # a one-part question, e.g. multiple choice: "(Total for Question 1 = 1 mark)"
            m = re.search(r"Total for Question \d+ = (\d+) marks?", text)
            marks = int(m.group(1)) if m else None
        hit = ms.get(key) or (ms.get((q, letter, None)) if roman else None) or (ms.get((q, None, None)) if not letter else None) \
            or (ms.get((q, None, "i")) if letter == "i" and not roman else None)  # a scheme reads part "(i)" as a sub-part
        if hand and not letter and str(q) in hand.get("keys", {}):
            hit, marks = ([], "", hand["keys"][str(q)]), marks or 1  # multiple choice: its letter, not a crop of the table
        if hand:
            marks = hand.get("marks", {}).get(label, marks)
        if qp.scanned and not (hand and "labels" in hand) and not (hit and (marks is None or marks <= 9) and len(keep) <= 2):
            continue  # read by OCR: keep only parts its mark scheme confirms, of a believable size
        msimg, ms_text, answer = None, "", None
        if hit:
            mpieces, ms_text, answer = hit
            msimg = stack([trim(ms_doc.crop(pg, r), 10, sides=True) for pg, r in mpieces])
            if EXTRACTS:
                msimg = squash(msimg)
            if answer and marks is None and qp.cambridge:
                marks = 1  # Cambridge prints no mark against a multiple-choice question
        if qp.scanned and not (hand and "labels" in hand) and not (msimg and re.search(rf"(?<!\d){q}(?!\d)", ms_text[:120])):
            continue  # read by OCR: its own scheme row must be found and carry its question number
        parts.append({
            "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": f"{letter or ''}{roman or ''}" or None, "label": label,
            "marks": marks,
            "qp": save(qimg, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            # The part's own words first where its stem is pages of extracts, so they aren't cut off.
            "text": re.sub(r"\s+", " ", BOILER.sub(" ", text + " " + stem_text if EXTRACTS else stem_text + " " + text)).strip()[:3000 if EXTRACTS else 1500],
            "msText": ms_text[:800],
            "er": er.get(f"{q:02d}"),
            **({"key": answer} if answer else {}),
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        meta = {**meta, "erSection": files.get("er", {}).get("section")}
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception as e:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], traceback.format_exc(limit=3)


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp.replace('-', '')}-{series}".lower()
        if "qp" in files and (not ONLY or set_id.startswith(ONLY)):
            jobs.append((set_id, files, {"component": comp.replace("-", ""), "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"].get("title", "")}))
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
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {no_marks} without marks", file=sys.stderr, flush=True)
            if not parts or no_ms > len(parts) / 3:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
