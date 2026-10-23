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
ARGS = [a for a in sys.argv[1:] if not a.startswith("--only=")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "edexcel-sciences")
IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)
SCALE = 2.2  # ~160 dpi, as cut.py

LETTERS = "abcdefghijklmn"
ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
LEAD = re.compile(r"^\*?\s*\(([a-z]{1,4})\)\s*")
STOP = re.compile(r"^(TOTAL FOR (SECTION|PAPER)|SECTION [A-C]\b|BLANK PAGE|END\s*$)", re.I)
BOILER = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\.{6,}|P\d{5}[A-Z]{1,2}\d*", re.I)


# ---------- reading pages in their displayed orientation ----------

def lines_of(page, clip=None):
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


def ocr_lines(doc, path):
    """For a scanned paper with no text layer: each page's lines read by Apple's Vision
    framework (ocr.swift), cached in <work-dir>/ocr/. The leading question number is
    split into its own span, as it would be in a typeset paper."""
    cache = os.path.join(WORK, "ocr", os.path.basename(path) + ".json")
    if not os.path.exists(cache):
        tmp = os.path.join(WORK, "ocr", os.path.basename(path))
        os.makedirs(tmp, exist_ok=True)
        pngs = []
        for i, page in enumerate(doc):
            png = os.path.join(tmp, f"{i:03d}.png")
            page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False).save(png)
            pngs.append(png)
        out = subprocess.run(["swift", os.path.join(HERE, "ocr.swift"), *pngs], capture_output=True, text=True, check=True).stdout
        pages = {os.path.basename(json.loads(l)["file"]): json.loads(l)["lines"] for l in out.splitlines() if l.strip()}
        json.dump({str(i): pages.get(f"{i:03d}.png", []) for i in range(len(doc))}, open(cache, "w"))
    pages = json.load(open(cache))
    result = {}
    for i, raw in pages.items():
        lines = []
        for l in raw:
            x0, y0, x1, y1 = (l[k] / SCALE for k in ("x0", "y0", "x1", "y1"))
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
        if self.scanned:
            self._lines = ocr_lines(self.doc, path)

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def frame(self, i):
        if i not in self._frame:
            self._frame[i] = frame(self.doc[i])
        return self._frame[i]

    def lines(self, i):
        if i not in self._lines:
            self._lines[i] = lines_of(self.doc[i])
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
        if r.width > w * 0.7 and r.height > h * 0.6 and (best is None or r.get_area() > best.get_area()):
            best = r
    if best is not None:
        return pymupdf.Rect(best.x0 + 3, best.y0 + 3, best.x1 - 3, best.y1 - 3)
    return pymupdf.Rect(40, 40, w - 40, h - 50)


def qp_labels(doc):
    """Every label in reading order: [(page, y, q, letter, roman)]; letter/roman None for higher levels.
    Also the page index where the paper's questions end."""
    out, q, letter, roman, letter_x = [], 0, None, None, 0
    end_page = len(doc) - 1
    for i in range(1, len(doc)):
        if doc.blank(i):
            continue
        f = doc.frame(i)
        stop = False
        for l in doc.lines(i):
            if l["y0"] > f.y1 or l["y0"] < f.y0 - 4:
                continue
            if re.match(r"TOTAL FOR PAPER", l["text"], re.I):
                stop = True
                break
            rest = l["text"]
            first = l["spans"][0]
            # A question number: at the frame's left edge, the next one expected, set apart from
            # the question (in its own span, or followed by a capital or a part label).
            m = re.match(r"^\*?(\d{1,2})\b\s*(.*)$", rest)
            lead = first["text"].strip() + (l["spans"][1]["text"].strip() if first["text"].strip() == "*" and len(l["spans"]) > 1 else "")
            # Numbered answer spaces ("1 ........", "2 ........") are not questions.
            apart = m and not re.match(r"[.…_]", m.group(2)) and (re.fullmatch(r"\*?\d{1,2}", lead) or not m.group(2) or re.match(r"[A-Z(]", m.group(2)))
            # OCR can miss a small number entirely, so a scanned paper may skip one.
            if m and apart and l["x0"] < f.x0 + 16 \
                    and (int(m.group(1)) == q + 1 or doc.scanned and int(m.group(1)) == q + 2):
                q, letter, roman = int(m.group(1)), None, None
                out.append((i, l["y0"], q, None, None))
                rest = m.group(2)
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
            if l["y0"] > top + 2 and l["y0"] < bottom and STOP.match(l["text"]):
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
            if not inside(l, rect):
                continue
            m = re.fullmatch(r"\((\d{1,2})\)", l["text"])
            if m and l["x0"] > rect.x1 - 140 and rect.y0 <= l["y0"] <= rect.y1:
                total += int(m.group(1))
                found = True
    return total if found else None


# ---------- mark schemes ----------

def bold(span):
    return "Bold" in span["font"] or bool(span["flags"] & 16)

# "3(b)(i)", "3 (b)(i)", or with the brackets left off: "1 a i".
# "3(b)(i)", "3 (b)(i)", "1 a i", "1ai", "12(ai)"; and, carrying on from the row above, "(b)i".
MS_LABEL = re.compile(r"^\*?\s*(\d{1,2})?((?:\s*\(?[a-z]{1,5}\)?)*)$")
HEAD = re.compile(r"Question( Number)?")


def ms_tables(doc):
    """{(q, letter, roman): [(page, rect)], ...} plus each one's text and any MCQ answer letter."""
    found = []  # (page, top, key, label_y)
    # Labels sit in the "Question Number" column. Not every scheme sets them in bold, and
    # the header can be centred over them or set to one side, so a label is anything
    # label-shaped under the span of its column's header.
    all_heads = [l for i in range(len(doc)) for l in doc.lines(i) if HEAD.fullmatch(l["text"])]
    typical = sorted(all_heads, key=lambda h: h["x0"])[len(all_heads) // 2] if all_heads else None
    q_now = None
    for i in range(len(doc)):
        lines = doc.lines(i)
        heads = [l for l in lines if HEAD.fullmatch(l["text"])]

        def column(l):
            above = [h for h in heads if h["y0"] <= l["y0"]]
            h = above[-1] if above else (heads[0] if heads else typical)
            return h is None and bold(l["spans"][0]) or h is not None and h["x0"] - 40 < l["x0"] < h["x1"] + 10

        cands = [l for l in lines if l["x0"] < 200 and not HEAD.fullmatch(l["text"]) and column(l)]
        for k, l in enumerate(cands):
            label = l["text"].strip()
            # A label can wrap: "1(a)" then "(ii)" on the next line of its cell.
            if k + 1 < len(cands) and re.fullmatch(r"(\([a-z]{1,4}\))+", re.sub(r"\s+", "", cands[k + 1]["text"])) \
                    and abs(cands[k + 1]["x0"] - l["x0"]) < 12 and 0 < cands[k + 1]["y0"] - l["y0"] < 16:
                label += cands[k + 1]["text"]
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
                q_now = int(m.group(1))
            elif not subs or q_now is None or "(" not in label:
                continue  # a bare word, not "(b)i"
            letter = subs[0] if subs and subs[0] in LETTERS and (subs[0] != "i" or len(subs) == 2) else None
            roman = subs[1] if len(subs) > 1 else (subs[0] if subs and subs[0] in ROMANS and not letter else None)
            above = [h for h in heads if h["y0"] < l["y0"] and l["y0"] - h["y0"] < 60]
            top = (above[-1]["y0"] if above else l["y0"]) - 6
            found.append((i, top, (q_now, letter, roman), l["y0"]))
    found.sort(key=lambda f: (f[0], f[1]))
    out = {}
    for n, (pg, top, key, _) in enumerate(found):
        nxt = found[n + 1] if n + 1 < len(found) else None
        pieces, p = [], pg
        while True:
            page = doc[p]
            w, h = page.rect.width, page.rect.height
            t = top if p == pg else 20
            b = nxt[1] - 2 if nxt and nxt[0] == p else h - 30
            if b > t + 12:
                pieces.append((p, pymupdf.Rect(20, t, w - 20, b)))
            if (nxt and nxt[0] <= p) or p + 1 >= len(doc):
                break
            p += 1
            if not doc.lines(p):
                break
        text = " ".join(doc.text(p, r) for p, r in pieces)
        if key not in out:
            ans = re.search(r"(?:only )?correct answer is\s*\(?([A-D])\b", text)
            out[key] = (pieces, re.sub(r"\s+", " ", text), ans.group(1) if ans else None)
    return out


# ---------- examiner reports ----------

DROP = re.compile(r"^(Examiner Comments?|Examiner Tips?|GCE [A-Z][\w ]+ \w{4} \w{2}|\d+|Grade boundaries.*)$", re.I)


def examiner_report(path):
    """{"03": "Question 3(b)(i)\\n\\n<paragraphs>…"} — every heading kept, so the page can lead with a part's own."""
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
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

def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = Doc(qp_path)
    labels, end_page = qp_labels(qp)
    ms = ms_tables(Doc(ms_path)) if ms_path and os.path.exists(ms_path) else {}
    ms_doc = Doc(ms_path) if ms else None
    er = examiner_report(er_path)
    regions = []
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        regions.append(((q, letter, roman), region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)))
    keys = [k for k, _ in regions]
    # A question with parts, or a part with sub-parts, isn't itself a question to show.
    has_children = lambda k: any(o[0] == k[0] and ((k[1] is None and o[1]) or (k[1] and not k[2] and o[1] == k[1] and o[2])) for o in keys)  # noqa: E731
    leaves = [k for k in keys if not has_children(k)]
    by_key = dict(regions)
    if qp.scanned and ms:
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
        # The first sub-part of a part carries the part's opening words: "(b) Chemists can test…".
        if roman == "i" and (q, letter, None) in by_key:
            pieces = [p for p in by_key[(q, letter, None)] if has_content(qp, *p)] + pieces
        keep = pieces[:1] + [p for p in pieces[1:] if has_content(qp, *p)]
        label = f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else "")
        pid = f"{set_id}-{q:02d}" + (f"-{letter or ''}{roman or ''}" if letter or roman else "")
        qimg = stack([trim(qp.crop(pg, r)) for pg, r in keep])
        stem_name = None
        if letter and (q, None, None) in by_key:
            stem_pieces = [p for p in by_key[(q, None, None)] if has_content(qp, *p)]
            if stem_pieces:
                stem_name = f"{set_id}-{q:02d}-stem.webp"
                if not os.path.exists(os.path.join(IMG, stem_name)):
                    save(stack([trim(qp.crop(pg, r), 14) for pg, r in stem_pieces]), stem_name)
        stem_text = " ".join(qp.text(pg, r) for pg, r in by_key.get((q, None, None), [])) if letter else ""
        text = " ".join(qp.text(pg, r) for pg, r in keep)
        marks = marks_in(qp, keep)
        if marks is None and not letter:  # a one-part question, e.g. multiple choice: "(Total for Question 1 = 1 mark)"
            m = re.search(r"Total for Question \d+ = (\d+) marks?", text)
            marks = int(m.group(1)) if m else None
        hit = ms.get(key) or (ms.get((q, letter, None)) if roman else None) or (ms.get((q, None, None)) if not letter else None) \
            or (ms.get((q, None, "i")) if letter == "i" and not roman else None)  # a scheme reads part "(i)" as a sub-part
        if qp.scanned and not (hit and (marks is None or marks <= 9) and len(keep) <= 2):
            continue  # read by OCR: keep only parts its mark scheme confirms, of a believable size
        msimg, ms_text, answer = None, "", None
        if hit:
            mpieces, ms_text, answer = hit
            msimg = stack([trim(ms_doc.crop(pg, r), 10, sides=True) for pg, r in mpieces])
        parts.append({
            "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": f"{letter or ''}{roman or ''}" or None, "label": label,
            "marks": marks,
            "qp": save(qimg, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", BOILER.sub(" ", stem_text + " " + text)).strip()[:1500],
            "msText": ms_text[:800],
            "er": er.get(f"{q:02d}"),
            **({"key": answer} if answer else {}),
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
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
