"""Cut the MadAsMaths booklets into single questions, for the question bank's "Add MadAsMaths questions" switch.

    python3 scripts/booklets/cut.py [work-dir] [--only=<booklet slug>]   # after fetch.py and build.py

Every booklet in the A-Level groups (Basic, Standard, Further, Mechanics, Statistics; not Elementary or Advanced) is
read from <work-dir>/pdf/. A MadAsMaths page sets each question out the same way: "Question 4 (**+)", the question
and its parts, then a row of answers on the right, each in a box drawn as four thin lines ("[3−], [6]"), then the
worked solution, a scanned handwritten page set small beside it. So each question is cut in two:

  <id>-qp.webp   the question: from its heading down to just above its row of answers, across page breaks
                 (a question that runs on is the pieces stacked), so the card doesn't give the answer away;
  <id>-ms.webp   the answers row, with the worked solution stacked under it: the part of each scan the PDF shows
                 beside this question (a scan is a whole page of working for several questions), rendered at about
                 the scan's own resolution, whitespace trimmed.

The answer row is the last row of boxes reaching the right margin before the next question; a row just above it
(answers on two lines) goes with it. A question with neither answers nor a solution is left out, as are the drill
booklets that number their items "1.", "2." with each answer written in (the integration mixes, trigonometric
identities). Ids are madas-<booklet slug>-<NNN>, its place among the booklet's headings: "madas-logarithms-exam-questions-004".

Writes <work-dir>/questions/img/*.webp and <work-dir>/questions/questions.json: each question's id, booklet, group,
number, stars (as printed, "**+"), size, its words (for tagging and search) and its answers' words.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, ".work")
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
OUT = os.path.join(WORK, "questions")
IMG = os.path.join(OUT, "img")
SCALE = 2.2  # ~160 dpi, as the question bank's cutters
GROUPS = {"basic": "Basic Topics", "standard": "Standard Topics", "further": "Further Topics", "mechanics": "Mechanics", "statistics": "Statistics"}
HEAD = re.compile(r"^Question\s+(\d{1,3})\b\s*(\((\*{1,6})(\+?)\))?")
TOP, FOOT = 70, 775          # the page's text area, inside the repeated "Created by" lines (y 38–66 and 779–807)
LEFT, RIGHT = 70, 525        # across the text, which starts at 90 and ends at 508
RIGHT_MARGIN = 495           # an answer row ends at the right margin (its last box's right side, ~502)
SOLUTION_ASPECT = (0.66, 0.75)  # a scanned A4 page, portrait


def boxes(page):
    """Rectangles drawn as four thin lines (or as one 're'), at least a character tall: the answer boxes, and any table's cells."""
    vert, horiz, out = [], [], []
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "re":
                r = pymupdf.Rect(item[1])
                if 8 <= r.height <= 80 and 6 <= r.width:
                    out.append(r)
            elif item[0] == "l":
                a, b = item[1], item[2]
                if abs(a.x - b.x) < 0.5 and abs(a.y - b.y) >= 8:
                    vert.append((round(a.x, 1), min(a.y, b.y), max(a.y, b.y)))
                elif abs(a.y - b.y) < 0.5 and abs(a.x - b.x) >= 6:
                    horiz.append((round(a.y, 1), min(a.x, b.x), max(a.x, b.x)))
    # Pair vertical sides of the same height whose top and bottom edges are drawn.
    vert.sort()
    for i, (x0, y0, y1) in enumerate(vert):
        for x1, v0, v1 in vert[i + 1:]:
            if x1 - x0 > 420:
                break
            if abs(v0 - y0) < 1.5 and abs(v1 - y1) < 1.5 and x1 - x0 >= 6:
                top = any(abs(hy - y0) < 1.5 and hx0 <= x0 + 1.5 and hx1 >= x1 - 1.5 for hy, hx0, hx1 in horiz)
                bottom = any(abs(hy - y1) < 1.5 and hx0 <= x0 + 1.5 and hx1 >= x1 - 1.5 for hy, hx0, hx1 in horiz)
                if top and bottom and y1 - y0 <= 80:
                    out.append(pymupdf.Rect(x0, y0, x1, y1))
                    break
    return out


def solution_images(page):
    """The worked solution's scans on a page, as shown: [(rect, zoom)], top to bottom. A scan is a whole handwritten
    page, with the working for several questions, clipped in the PDF to the part for this one, so it's the shown
    part (the image block's box in the page's text dict, which is clipped) that's wanted, never the image itself.
    `zoom` renders it at about the scan's own resolution."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 1:
            continue
        w, h = b.get("width", 0), b.get("height", 0)
        if not h or not (SOLUTION_ASPECT[0] < w / h < SOLUTION_ASPECT[1]) or w < 300:
            continue
        shown = pymupdf.Rect(b["bbox"]) & page.rect
        if 0 < shown.width < 260 and shown.height > 8:
            full = next((pymupdf.Rect(i["bbox"]) for i in page.get_image_info() if i["width"] == w and i["height"] == h
                         and abs(i["bbox"][0] - b["bbox"][0]) < 1 and abs(i["bbox"][1] - b["bbox"][1]) < 1), shown)
            out.append((shown, max(SCALE, min(5.0, w / max(full.width, 1)))))
    return sorted(out, key=lambda t: t[0].y0)


def headings(doc):
    """[(page, y top, number, stars)] for every "Question N" line, in reading order."""
    out = []
    for i, page in enumerate(doc):
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                m = HEAD.match(text)
                if m and line["bbox"][0] < 150:
                    out.append((i, line["bbox"][1], int(m.group(1)), (m.group(3) or "") + (m.group(4) or "")))
    return out


def trim(img, keep=16):
    """Whitespace off every side but `keep` pixels."""
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    box = ImageChops.difference(img.convert("RGB"), bg.convert("RGB")).point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    x0, y0, x1, y1 = box
    return img.crop((max(0, x0 - keep), max(0, y0 - keep), min(img.width, x1 + keep), min(img.height, y1 + keep)))


def render(page, rect, zoom=SCALE):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def stack(images, gap=18):
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


def text_in(page, rect):
    return re.sub(r"\s+", " ", page.get_text("text", clip=rect)).strip()


def cut_booklet(job):
    group, folder, slug, path = job
    doc = pymupdf.open(path)
    heads = headings(doc)
    out, skipped = [], []
    for k, (pg, y, number, stars) in enumerate(heads):
        nxt = heads[k + 1] if k + 1 < len(heads) else (len(doc), 0, None, None)
        # The question's pieces: this page from its heading, any pages before the next heading, the next heading's page above it.
        pieces = []
        for p in range(pg, min(nxt[0], len(doc) - 1) + 1):
            top = y - 4 if p == pg else TOP
            bottom = (nxt[1] - 6) if p == nxt[0] else FOOT
            if bottom - top > 12:
                pieces.append((p, pymupdf.Rect(LEFT, top, RIGHT, bottom)))
        if not pieces or len(pieces) > 4:
            skipped.append((number, f"{len(pieces)} pieces"))
            continue
        found = answer_row(doc, pieces)
        sols = [(p, r, x) for p, rect in pieces for r, x in solution_images(doc[p]) if rect.intersects(r)]
        if not found and not sols:
            skipped.append((number, "no answers or solution"))
            continue
        # The question stops above its answers, or above its solution where it has no boxed answers.
        stop = found or (sols[0][0], sols[0][1])
        q_pieces = []
        for p, rect in pieces:
            if p < stop[0]:
                q_pieces.append((p, rect))
            elif p == stop[0]:
                r = pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1, stop[1].y0 - 3))
                # A solution scan set beside the question text stays out of the question's crop.
                if r.height > 10:
                    q_pieces.append((p, r))
                break
        qp = stack([trim(_blank_images(doc[p], r)) for p, r in q_pieces])
        if qp is None:
            skipped.append((number, "empty question"))
            continue
        answer = None
        if found:
            p, r = found
            answer = trim(render(doc[p], pymupdf.Rect(LEFT, r.y0 - 4, RIGHT, r.y1 + 4)))
        scans = [trim(render(doc[p], r, zoom), keep=10) for p, r, zoom in sols]
        ms = stack([answer] + scans, gap=28)
        if ms is None:
            skipped.append((number, "answers came out blank"))
            continue
        # Numbering starts again in a booklet's sections (Poisson's "Introductory calculations", then …), so the id
        # is the question's place among the booklet's headings (left-out questions keep their place, so ids hold
        # between cuts); `n` keeps the number it's printed with.
        qid = f"madas-{slug}-{k + 1:03d}"
        qp.save(os.path.join(IMG, f"{qid}-qp.webp"), "WEBP", quality=82, method=6)
        ms.save(os.path.join(IMG, f"{qid}-ms.webp"), "WEBP", quality=82, method=6)
        words = " ".join(text_in(doc[p], r) for p, r in q_pieces)
        out.append({"id": qid, "booklet": slug, "group": group, "n": number, "stars": stars, "w": qp.width, "h": qp.height,
                    "msw": ms.width, "msh": ms.height, "pages": sorted({p + 1 for p, _ in pieces}),
                    "text": re.sub(r"^Question\s+\d+\s*(\(\*+\+?\))?\s*", "", words)[:1500],
                    "answer": text_in(doc[found[0]], found[1]) if found else "", "solution": len(scans)})
    return slug, out, skipped


def answer_row(doc, pieces):
    """(page, rect) of a question's answers, or None. Answers come last, after everything the question says: the
    lowest row of answer boxes in the right half of the question ("[x = √2]", and "[  ], [proof]"), with a row just
    above it where they run to two lines. Where MadAsMaths didn't box them, a line of text set to the right
    ("0.1898 , 0.3423 , …") counts, if it is the whole line: justified question text comes out of the PDF in
    pieces, and a piece that ends at the margin isn't an answer. Nothing inside a solution scan counts (its frame
    is drawn with lines too), and a row with question text below it isn't the answers."""
    for p, rect in reversed(pieces):
        page = doc[p]
        scans = [r + (-6, -6, 6, 6) for r, _ in solution_images(page)]
        inside = lambda r: rect.contains(r) and not any(s.intersects(r) for s in scans)  # noqa: E731
        lines = []
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                r = pymupdf.Rect(line["bbox"])
                if "".join(s["text"] for s in line["spans"]).strip() and inside(r):
                    lines.append(r)
        mid = lambda r: (r.y0 + r.y1) / 2  # noqa: E731
        whole = [r for r in lines if r.x0 >= 250 and r.x1 >= RIGHT_MARGIN
                 and not any(o is not r and abs(mid(o) - mid(r)) < 4 and o.x1 <= r.x0 + 2 for o in lines)]
        boxed = [b for b in boxes(page) if inside(b) and b.x1 >= 300]
        anchors = boxed + whole
        if not anchors:
            continue
        last = max(anchors, key=lambda r: r.y0)
        if any(r.y0 > last.y1 + 2 and r.x0 < 250 for r in lines):
            return None  # question text after it: a table or a box in the question, not its answers
        items = [b for b in boxes(page) if inside(b)] + whole
        band = [r for r in items if abs(mid(r) - mid(last)) <= 9]
        above = [r for r in anchors if 0 < mid(last) - mid(r) <= 32 and r.x0 > 150]
        if above:
            top = max(above, key=lambda r: r.y0)
            band += [r for r in items if abs(mid(r) - mid(top)) <= 9]
        return p, pymupdf.Rect(min(r.x0 for r in band), min(r.y0 for r in band), max(r.x1 for r in band), max(r.y1 for r in band))
    return None


def _blank_images(page, rect):
    """The question's crop with any solution scan inside it painted out (a scan set beside the question's last lines)."""
    img = render(page, rect)
    for r, _ in solution_images(page):
        if rect.intersects(r):
            x0, y0 = int((r.x0 - rect.x0) * SCALE), int((r.y0 - rect.y0) * SCALE)
            x1, y1 = int((r.x1 - rect.x0) * SCALE), int((r.y1 - rect.y0) * SCALE)
            img.paste((255, 255, 255), (max(0, x0 - 4), max(0, y0 - 4), min(img.width, x1 + 4), min(img.height, y1 + 4)))
    return img


def main():
    os.makedirs(IMG, exist_ok=True)
    meta = json.load(open(os.path.join(ROOT, "src", "content", "booklets.json")))
    rows = json.load(open(os.path.join(HERE, "drive-files.json")))
    sys.path.insert(0, HERE)
    from build import slug_of  # noqa: PLC0415
    by_slug = {slug_of(r["file"][:-4]): r for r in rows}
    jobs = []
    for g in meta["groups"]:
        if g["slug"] not in GROUPS:
            continue
        for shelf in g["shelves"]:
            for b in shelf["booklets"]:
                if ONLY and b["slug"] != ONLY:
                    continue
                r = by_slug[b["slug"]]
                jobs.append((g["slug"], r["folder"], b["slug"], os.path.join(WORK, "pdf", r["folder"], r["file"])))
    questions, skipped = [], {}
    with ProcessPoolExecutor() as pool:
        for slug, out, skip in pool.map(cut_booklet, jobs):
            questions += out
            if skip:
                skipped[slug] = skip
    path = os.path.join(OUT, "questions.json")
    if ONLY and os.path.exists(path):
        questions = [q for q in json.load(open(path)) if q["booklet"] != ONLY] + questions
    json.dump(questions, open(path, "w"), ensure_ascii=False, indent=0)
    n_skip = sum(len(v) for v in skipped.values())
    print(f"{len(jobs)} booklets: {len(questions)} questions cut, {n_skip} left out; "
          f"{sum(1 for q in questions if q['answer'])} with boxed answers, {sum(1 for q in questions if q['solution'])} with a worked solution",
          file=sys.stderr)
    for slug, skip in sorted(skipped.items(), key=lambda kv: -len(kv[1]))[:25]:
        print(f"  {slug}: {len(skip)} left out, e.g. Q{skip[0][0]} ({skip[0][1]})", file=sys.stderr)


if __name__ == "__main__":
    main()
