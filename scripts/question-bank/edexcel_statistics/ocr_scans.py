"""Give a scanned Pearson Statistics question paper a text layer, so cut_statistics.py can cut it.

    python3 scripts/question-bank/edexcel_statistics/ocr_scans.py <in.pdf> <out.pdf>

Needs macOS (the Vision framework) and `pip install pyobjc-framework-Vision pymupdf pillow`. AS Statistics June 2019
(8ST0/01, 8ST0/02) is a scan with no text. This writes a copy of the paper with each recognised line added as
invisible text where it sits, so the cutter finds the same things it finds in a born-digital paper:
  - a question's number, at the left margin, as a bold 12pt span;
  - "(Total for Question N is M marks)" lines, as text;
  - each lined answer space, as an underscore line (found from the page's ruled lines), which the cutter cuts out.
The copy is only for cutting: the crops are rendered from the scan, and the hosted paper is the original.
"""
import io, re, sys

import pymupdf
import Quartz  # noqa: F401  (Vision needs it loaded)
import Vision
from Foundation import NSData
from PIL import Image

SCALE = 3.0
LABEL = re.compile(r"^(\d{1,2})(?:\s+(.*))?$", re.S)


def recognise(png):
    data = NSData.dataWithBytes_length_(png, len(png))
    handler = Vision.VNImageRequestHandler.alloc().initWithData_options_(data, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(err)
    out = []
    for obs in request.results():
        box = obs.boundingBox()  # 0-1, origin at the bottom left
        out.append((obs.topCandidates_(1)[0].string(), box.origin.x, 1 - box.origin.y - box.size.height, box.size.width, box.size.height))
    return out


def ruled_lines(img, width_pt):
    """y (pt) of each long thin horizontal rule, as lined answer space prints them."""
    gray = img.convert("L")
    w, h = gray.size
    data = gray.tobytes()
    x0, x1 = int(62 * SCALE), int(540 * SCALE)  # answer lines run from the left margin to the right frame edge (about 552pt); tables stop short
    ys = []
    for y in range(int(60 * SCALE), int(780 * SCALE)):
        row = data[y * w + x0:y * w + x1]
        # Answer lines are a uniform light grey (168); a table's borders and cells have dark pixels in the same row.
        if min(row) > 140 and sum(1 for v in row if v < 215) > 0.985 * (x1 - x0):
            ys.append(y / SCALE)
    lines = []
    for y in ys:
        if not lines or y - lines[-1][-1] > 1.5:
            lines.append([y])
        else:
            lines[-1].append(y)
    return [sum(g) / len(g) for g in lines]


NOISE = re.compile(r"DO N|Turn over|continued|BLANK|^[\W\d_]*$|Answer ALL|Write your answers|^\*", re.I)
TOTAL = re.compile(r"Total (?:Marks )?for Question (\d+) is (\d+)", re.I)


def main(src, dst):
    doc = pymupdf.open(src)
    pages = []  # per page: its lines as (text, x0, y0, height) and its ruled lines
    for page in doc:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
        png = pix.tobytes("png")
        W, H = page.rect.width, page.rect.height
        obs = [(t.strip(), x * W, y * H, h * H) for t, x, y, w, h in recognise(png) if t.strip()]
        pages.append((obs, ruled_lines(Image.open(io.BytesIO(png)), W)))
    # Question numbers the recogniser read, and the totals it read.
    labels, totals = {}, {}
    for i, (obs, _) in enumerate(pages):
        H = doc[i].rect.height
        for text, x0, y0, h in obs:
            m = LABEL.match(text)
            if m and x0 < 55 and 40 < y0 < H - 60:
                labels.setdefault(int(m.group(1)), i)
            m = TOTAL.search(text)
            if m:
                totals[int(m.group(1))] = i
    # A number whose digit was not read still has its total: it starts at the first real line after the question
    # before it (a new page), or after the instructions on page 2 for question 1.
    extra = {}  # page -> [(question, y0)]
    for n in sorted(totals):
        if n in labels:
            continue
        i = totals[n - 1] + 1 if n - 1 in totals else next((j for j, (o, _) in enumerate(pages) if any("Answer ALL" in t for t, *_ in o)), 1)
        top = 40
        if n == 1:
            top = max(y0 for t, x0, y0, h in pages[i][0] if "Answer ALL" in t) + 4
        anchor = min(((y0, t) for t, x0, y0, h in pages[i][0] if y0 > top and len(t) >= 12 and not NOISE.search(t)), default=None)
        if anchor:
            extra.setdefault(i, []).append((n, anchor[0]))
    for i, page in enumerate(doc):
        obs, rules = pages[i]
        W, H = page.rect.width, page.rect.height
        for text, x0, y0, h in obs:
            m = LABEL.match(text)
            if m and x0 < 55 and 40 < y0 < H - 60:
                page.insert_text((x0, y0 + 11), m.group(1), fontsize=12, fontname="tibo", render_mode=3)
                text = (m.group(2) or "").strip()
                x0 = max(x0 + 19, 61)
                if not text:
                    continue
            page.insert_text((x0, y0 + h * 0.8), text, fontsize=min(12, max(6, h * 0.8)), fontname="tiro", render_mode=3)
        for n, y0 in extra.get(i, []):
            page.insert_text((42, y0 + 11), str(n), fontsize=12, fontname="tibo", render_mode=3)
        for y in rules:
            page.insert_text((42, y - 2), "_" * 60, fontsize=12, fontname="tiro", render_mode=3)
    doc.save(dst, garbage=3, deflate=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
