"""Cut OCR's GCSE Design and Technology (J310) papers into question parts, each with its Insert, its mark scheme rows and its report.

    python3 scripts/question-bank/ocr_gcse_dt/cut_ocr_gcse_dt.py [work-dir] [--only=j31001-jun24]
    # default work dir: scripts/question-bank/.work/ocr-gcse-dt

ocr_gcse/cut_ocr_gcse.py (cut_pearson.py with OCR's GCSE patches) does the cutting: J310/01 is set like OCR's other GCSE
papers, one paper of six questions: Section A (1 to 3) is core principles on context pictures printed in the paper, and
Section B works from the separate Insert. What D&T adds, patched in here so no other bank's crops move:
  - Question 4 ("Refer to page 8 of the Insert", Images A to C) has that page as its stem, under its own opening words.
  - Questions 5 and 6 are set on "your chosen product": the student ticks one of six (page 15 of the paper) and answers
    both questions about it from its page of the Insert, so a part can't be answered without it. Their stem is all six
    product pages, two to a row, under the question's own opening words, and the scheme crop shows every product's
    answers as OCR prints them.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-gcse-dt")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "ocr_gcse"))
import cut_ocr_gcse  # noqa: E402,F401  (patches cut_pearson for OCR's GCSE papers)
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

_cut_set, _lines, _region, _crop = cp.cut_set, cp.Doc.lines, cp.region, cp.Doc.crop
FOOTER = re.compile(r"© OCR \d{4}|Turn over")
SPACED = re.compile(r"^\(\s*([a-h])\s*\)(\*?)$")
CELL = 560  # a product page's width in the grid (px); the stem is two cells and a gutter wide


def page_image(doc, i, top, bottom):
    w = doc[i].rect.width
    return cp.trim(doc.crop(i, pymupdf.Rect(28, top, w - 28, bottom)), 8)


def product_pages(doc):
    """The six product pages, each from the top of its frame to above "© OCR"; empty if the Insert isn't laid out that way."""
    out = []
    for i in range(1, len(doc.doc) - 1):
        img = page_image(doc, i, 50, 791)
        if img is not None:
            out.append(img)
    return out if len(out) == 6 else []


def info_page(doc):
    """The last page's pictures (Images A to C, "Information on this page is required to answer Question 4"), above OCR's copyright notice."""
    i = len(doc.doc) - 1
    page = doc.doc[i]
    ys = [l["y0"] for l in doc.lines(i) if l["text"].startswith(("Copyright Information", "Oxford Cambridge and RSA"))]
    bottom = (min(ys) - 14) if ys else page.rect.height - 66
    # the logo's mark sits above its words: stop above the first thing printed in the notice's block
    for d in cp.drawings(page):
        r = d["rect"]
        if ys and r.y1 > min(ys) - 70 and r.y0 > min(ys) - 70 and r.height < 60 and r.width < 140:
            bottom = min(bottom, r.y0 - 6)
    return page_image(doc, i, 50, bottom)


def grid(imgs):
    cells = [im.resize((CELL, round(im.height * CELL / im.width)), Image.LANCZOS) for im in imgs]
    rows = [cells[n:n + 2] for n in range(0, len(cells), 2)]
    height = sum(max(c.height for c in r) + 10 for r in rows)
    sheet = Image.new("RGB", (2 * CELL + 14, height), "white")
    y = 0
    for r in rows:
        for k, c in enumerate(r):
            sheet.paste(c, (k * (CELL + 14), y))
        y += max(c.height for c in r) + 10
    return sheet


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    ins_path = qp_path.replace("-qp-", "-ins-")
    if not os.path.exists(ins_path):
        return parts
    ins = cp.Doc(ins_path)
    products, info = product_pages(ins), info_page(ins)
    if not products or info is None:
        print(f"  {set_id}: the Insert isn't laid out as expected", file=sys.stderr)
        return parts
    for q, extra in (("04", info), ("05", grid(products)), ("06", grid(products))):
        ps = [p for p in parts if p["question"] == q]
        if not ps:
            continue
        stem = os.path.join(cp.IMG, f"{set_id}-{q}-stem.webp")
        lead = [Image.open(stem).convert("RGB")] if os.path.exists(stem) else []
        width = max([Image.open(os.path.join(cp.IMG, p["qp"])).width for p in ps if p["qp"]] + [1000])
        extra = extra if extra.width <= width else extra.resize((width, round(extra.height * width / extra.width)), Image.LANCZOS)
        cp.save(cp.stack(lead + [extra]), os.path.basename(stem))
        for p in ps:
            p["stem"] = os.path.basename(stem)
    return parts


def lines(self, i):
    """A scheme label set with a space inside ("(b )", November 2021's 5(b)(ii)) is read as "(b)", and a table of marks by
    assessment objective (November 2021's page 4) is read as empty."""
    fresh = i not in self._lines
    out = _lines(self, i)
    if fresh and "-ms-" in os.path.basename(self.doc.name):
        # November 2021's scheme opens with a table of each question's marks by assessment objective (AO3, AO4), "1a  3 ..",
        # whose "1a", "1b", "3ai" read as the rows' labels; it holds no answers.
        texts = {l["text"].strip() for l in out}
        if {"AO3", "AO4", "Question"} <= texts:
            out = self._lines[i] = []
        for l in out:
            if l["x0"] < 160 and SPACED.match(l["text"].strip()):
                t = "(" + SPACED.match(l["text"].strip()).group(1) + ")" + SPACED.match(l["text"].strip()).group(2)
                l["text"] = t
                l["spans"] = [{**l["spans"][0], "text": t}] + l["spans"][1:]
    return out


SKIP_PAGE = ("SECTION ", "YOU NEED TO ANSWER QUESTION", "STUDY AND USE THE IMAGES AND INFORMATION")
NOTE = re.compile(r"^(Question \d{1,2} \([a-z]\) starts on [Pp]age \d+|Turn over for the next question)", re.I)


def region(doc, start, end, end_page):
    """cut_pearson's region, less
      - a piece carried over a page that opens on a section heading ("SECTION B" and its instructions sit on the frame's top
        edge, above where cp.STOP is looked for, so question 3's last part carried them in its crop) or on the page where
        the student ticks their product (page 15, between questions 4 and 5), or on question 5's own opening line when that
        sits over the question's number (November 2021);
      - the note under a long answer, "Question 5 (c) starts on Page 18", and "Turn over for the next question"."""
    out = []
    for n, (pg, r) in enumerate(_region(doc, start, end, end_page)):
        inside = sorted((l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] >= r.y0 - 1 and not re.fullmatch(r"\d{1,2}", l["text"].strip())),
                        key=lambda l: l["y0"])
        if n and inside and inside[0]["text"].strip().upper().startswith(SKIP_PAGE):
            continue
        note = next((l for l in inside if NOTE.match(l["text"].strip())), None)
        if note:
            if note["y0"] - 4 < r.y0 + 10:
                continue
            r = pymupdf.Rect(r.x0, r.y0, r.x1, note["y0"] - 4)
        # an answer box drawn to a point past the frame's foot (June 2025's 5(d), 776.4 for a frame ending at 775.2) is
        # cut short, its bottom rule lost
        foot = [d["rect"].y1 for d in cp.drawings(doc.doc[pg]) if d["rect"].height > 100 and r.y1 - 3 < d["rect"].y1 < r.y1 + 4 and d["rect"].y0 < r.y1]
        if foot:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, max(foot) + 1)
        out.append((pg, r))
    return out


def crop(self, i, rect):
    """A question paper's page with its footer painted out: "Turn over" can sit level with the last answer line (June 2025's
    3(b)), its tops showing under the dots and the [1], too close to cut between."""
    if i not in self._img and "-qp-" in os.path.basename(self.doc.name):
        _crop(self, i, rect)
        page, draw = self.doc[i], ImageDraw.Draw(self._img[i])
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for sp in l["spans"]:
                    if FOOTER.search(sp["text"]) and sp["bbox"][1] > page.rect.height - 80:
                        x0, y0, x1, y1 = sp["bbox"]
                        draw.rectangle([round(v * cp.SCALE) for v in (x0, y0 + 0.3 * sp["size"], x1, y1)], fill=(255, 255, 255))
    return _crop(self, i, rect)


cp.cut_set, cp.Doc.lines, cp.region, cp.Doc.crop = cut_set, lines, region, crop

if __name__ == "__main__":
    cp.main()
