"""Cut OCR's GCSE Gateway science papers into question parts, each with its mark scheme rows.

    python3 scripts/question-bank/ocr_gcse/cut_ocr_gcse.py [work-dir] [--only=j2471h-jun24]
    # default work dir: scripts/question-bank/.work/ocr-gcse

edexcel_sciences/cut_pearson.py does the work, as for OCR's A-Level sciences: the GCSE papers and
schemes are set the same way, and its scheme reader keeps a row that runs on over a page whole,
guidance column and all. Two differences are handled here, so no other bank's crops move:
  - the GCSE papers print the page number centred at the top of each page, inside the margin the
    cutter assumes for OCR (which draws no frame), so a part carried over a page showed it mid-crop:
    each page's frame starts below it;
  - a few scheme rows set their part letters in plain type, not bold (lines, below);
  - a scheme's last page can be an empty ruled table, which the last row's crop left out (tables, below);
  - five November 2020 Combined Science A papers are scans, whose margin numbers Vision misses
    (margin_numbers, below), and whose parts the cutter keeps only where the scheme row's text carries
    the question's number, which OCR prints on a question's first row only (cut_set, below).
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-gcse")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image, ImageOps  # noqa: E402

_init, _frame, _lines, _ms_tables, _cut_set = cp.Doc.__init__, cp.Doc.frame, cp.Doc.lines, cp.ms_tables, cp.cut_set
PIECE = re.compile(r"\(?(?:[a-h]|i{1,3}|iv|vi{0,3}|ix|x)\)?")


def init(self, path):
    self.scheme = "-ms-" in os.path.basename(path)
    _init(self, path)
    if self.scanned and not self.scheme:
        self.pictures = set(range(len(self.doc)))  # every page read by OCR: marks_in reads "12]" as the "[2]" it is
        for i, y, n in margin_numbers(self.doc, path):
            # The number in the margin, as a typeset paper's own span; a misread one Vision set at the start of its line goes.
            kept = []
            for l in self._lines.get(i, []):
                m = re.match(r"^\d{1,2}\*?\s+(.+)$", l["text"]) if l["x0"] < 70 and abs(l["y0"] - y) < 6 else None
                kept.append({**l, "text": m.group(1), "spans": l["spans"][1:] or l["spans"]} if m else l)
            kept = [l for l in kept if not (l["x0"] < 70 and abs(l["y0"] - y) < 6 and re.fullmatch(r"\d{1,2}\*?", l["text"]))]
            kept.append({"x0": 50, "y0": y, "x1": 60, "y1": y + 10, "text": str(n),
                         "spans": [{"text": str(n), "font": "OCR-Bold", "flags": 16, "bbox": (50, y, 60, y + 10)}]})
            self._lines[i] = sorted(kept, key=lambda l: (round(l["y0"]), l["x0"]))


def margin_numbers(doc, path):
    """[(page, y, question number)] for a scanned paper: Vision reads its text but not, on its own, a bold number alone
    in the margin (Combined Science A's November 2020 scans: most of their questions went missing). So each glyph in
    the number column is found from the page's pixels, a page's glyphs are read by Vision set side by side in a row,
    where it reads them, and every glyph that reads as a number, or as nothing, is the next question, in order; one
    that reads as anything else (the footer's "©") is not. Stops at the lined pages after the questions. Cached in
    <work-dir>/ocr/<file>-margin.json."""
    cache = os.path.join(cp.WORK, "ocr", os.path.basename(path) + "-margin.json")
    if not os.path.exists(cache):
        tmp = os.path.join(cp.WORK, "ocr", os.path.basename(path) + "-margin")
        os.makedirs(tmp, exist_ok=True)
        scale, found, pngs = 4, {}, []
        for i in range(1, len(doc)):
            pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=pymupdf.Rect(40, 60, 72, doc[i].rect.height - 72), colorspace=pymupdf.csGRAY)
            im = Image.frombytes("L", (pix.width, pix.height), pix.samples)
            runs = []
            for y in range(im.height):
                if min(im.crop((0, y, im.width, y + 1)).get_flattened_data()) < 128:
                    if runs and y - runs[-1][1] <= 6:
                        runs[-1][1] = y
                    else:
                        runs.append([y, y])
            glyphs = []
            for a, b in runs:
                g = im.crop((0, max(0, a - 4), im.width, b + 5))
                box = ImageOps.invert(g).getbbox()
                if box and 5 <= (box[3] - box[1]) / scale <= 12 and (box[2] - box[0]) / scale <= 18:
                    glyphs.append((round(60 + (a - 4 + box[1]) / scale, 1), g.crop(box)))
            if len(runs) > 8:
                break  # the answer pages' ruled lines
            if not glyphs:
                continue
            row = Image.new("L", (sum(g.width + 90 for _, g in glyphs) + 60, max(g.height for _, g in glyphs) + 60), 255)
            x, spans = 60, []
            for y, g in glyphs:
                row.paste(g, (x, 30))
                spans.append((x - 45, x + g.width + 45, y))
                x += g.width + 90
            png = os.path.join(tmp, f"{i:03d}.png")
            row.save(png)
            pngs.append(png)
            found[i] = spans
        read = {}
        if pngs:
            out = subprocess.run(["swift", os.path.join(HERE, "..", "edexcel_sciences", "ocr.swift"), *pngs], capture_output=True, text=True, check=True).stdout
            read = {int(os.path.basename(json.loads(l)["file"])[:3]): json.loads(l)["lines"] for l in out.splitlines() if l.strip()}
        glyphs = []
        for i, spans in sorted(found.items()):
            for x0, x1, y in spans:
                said = " ".join(l["text"] for l in read.get(i, []) if x0 <= (l["x0"] + l["x1"]) / 2 <= x1).strip()
                glyphs.append((i, y, said))
        json.dump(glyphs, open(cache, "w"))
    out, n = [], 0
    for i, y, said in json.load(open(cache)):
        if said and not re.fullmatch(r"\d{1,2}\*?", said):
            continue
        n += 1
        out.append((i, y, n))
    return out


def lines(self, i):
    """A scheme's label pieces, "a" and "i" in the Question column's own cells, read as the cutter expects them:
    bold. OCR sets them bold but for a few rows (Physics A Paper 2, June 2018: questions 16 and 23), which
    the cutter then took for a word in the answer, and those parts lost their scheme rows."""
    if i not in self._lines:
        out = _lines(self, i)
        if self.scheme:
            out = [{**l, "spans": [{**s, "font": s["font"] + ",Bold"} for s in l["spans"]]}
                   if l["x0"] < 120 and len(l["spans"]) == 1 and PIECE.fullmatch(l["text"].strip()) and not cp.bold(l["spans"][0]) else l
                   for l in out]
        self._lines[i] = out
    return self._lines[i]


def frame(self, i):
    if i not in self._frame:
        f = _frame(self, i)
        w = self.doc[i].rect.width
        folio = [l["y1"] for l in self.lines(i) if l["y1"] < 70 and re.fullmatch(r"\d{1,2}", l["text"]) and abs((l["x0"] + l["x1"]) / 2 - w / 2) < 30]
        if folio and max(folio) + 2 > f.y0:
            f = self._frame[i] = pymupdf.Rect(f.x0, max(folio) + 2, f.x1, f.y1)
        if not self.scheme and self.left() > f.x0 + 14:
            self._frame[i] = pymupdf.Rect(self.left() - 8, f.y0, f.x1, f.y1)
    return self._frame[i]


def left(self):
    """Where the paper's question numbers sit: 50pt in from the edge, but 58pt in a few (Combined Science A
    Paper 9, November 2020), past the 16pt the cutter allows beyond its margin, so it found no questions."""
    if not hasattr(self, "_left"):
        nums = [l["x0"] for i in range(1, len(self.doc)) for l in self.lines(i)
                if re.fullmatch(r"\d{1,2}", l["text"]) and 70 < l["y0"] < self.doc[i].rect.height - 80 and l["x0"] < 100]
        self._left = min(nums) if nums else 0
    return self._left


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """For a scanned paper, each scheme row's text starts with its whole label ("12(b)"), so the cutter's check that a
    part read by OCR has its own row, with its question's number, holds for a question's later parts too."""
    doc = pymupdf.open(qp_path)
    scanned = sum(len(doc[i].get_text().strip()) for i in range(min(6, len(doc)))) < 200
    cp.ms_tables = labelled if scanned else tables
    try:
        return _cut_set(qp_path, ms_path, er_path, set_id, meta)
    finally:
        cp.ms_tables = _ms_tables


HEADER = re.compile(r"Question|Answer|Marks|AO|element|Guidance|[A-Z]\d{3}/\d\d|Mark Scheme|(January|June|October|November) \d{4}|\d{1,3}")


def tables(doc):
    """The scheme's rows, less an empty table at the end of the paper's last row: a scheme's last page can be a ruled
    table with nothing in it, which the last question's crop took in (Biology A Paper 2, June 2022, 18(d))."""
    out = {}
    for k, (pieces, text, ans) in _ms_tables(doc).items():
        while len(pieces) > 1 and all(HEADER.fullmatch(l["text"].strip()) for l in doc.lines(pieces[-1][0]) if cp.inside(l, pieces[-1][1])):
            pieces = pieces[:-1]
        out[k] = (pieces, text, ans)
    return out


def labelled(doc):
    return {k: (pieces, f"{k[0]}{f'({k[1]})' if k[1] else ''}{f'({k[2]})' if k[2] else ''} {text}", ans)
            for k, (pieces, text, ans) in tables(doc).items()}


cp.Doc.__init__, cp.Doc.frame, cp.Doc.lines, cp.Doc.left, cp.cut_set = init, frame, lines, left, cut_set

if __name__ == "__main__":
    cp.main()
