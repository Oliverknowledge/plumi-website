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
# "Question 4 (**+)", and three headings MadAsMaths printed without their number, "Question (***+)" (headings).
HEAD = re.compile(r"^Question(?:\s*(\d{1,3})\b)?\s*(\((\*{1,6})(\+?)\))?\s*$|^Question\s*(\d{1,3})\b")  # ("Question6": one is printed without its space)
TOP, FOOT = 70, 775          # the page's text area, inside the repeated "Created by" lines (y 38–66 and 779–807)
LEFT, RIGHT = 70, 525        # across the text, which starts at 90 and ends at 508
RIGHT_MARGIN = 495           # an answer row ends at the right margin (its last box's right side, ~502)


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
            if x1 - x0 > 480:  # (an answer box can run the text's whole width, about 420pt)
                break
            if abs(v0 - y0) < 1.5 and abs(v1 - y1) < 1.5 and x1 - x0 >= 6:
                top = any(abs(hy - y0) < 1.5 and hx0 <= x0 + 1.5 and hx1 >= x1 - 1.5 for hy, hx0, hx1 in horiz)
                bottom = any(abs(hy - y1) < 1.5 and hx0 <= x0 + 1.5 and hx1 >= x1 - 1.5 for hy, hx0, hx1 in horiz)
                if top and bottom and y1 - y0 <= 80:
                    out.append(pymupdf.Rect(x0, y0, x1, y1))
                    break
    return out


def images(page):
    """Every picture on a page but its blank background, as shown: [(rect, zoom)], top to bottom. The worked
    solutions are scans of handwritten working: a whole A4 page clipped in the PDF to the part for one question, or
    a few landscape strips stacked one under another, so it's the shown part (the image block's box in the page's
    text dict, which is clipped) that's wanted, never the image itself. A question's own figures are pictures too;
    what tells them apart is where they are (solution_images). `zoom` renders one at about its own resolution."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 1 or b.get("width", 0) <= 2 or b.get("height", 0) <= 2:
            continue
        shown = pymupdf.Rect(b["bbox"]).normalize() & page.rect
        if shown.is_empty or shown.width < 4 or shown.height < 4 or shown.width * shown.height > 0.6 * page.rect.width * page.rect.height:
            continue
        out.append((shown, max(SCALE, min(5.0, b["width"] / max(shown.width, 1)))))
    return sorted(out, key=lambda t: (t[0].y0, t[0].x0))


def solution_images(doc, pieces, found):
    """The worked solution of a question: [(page, rect, zoom)], each a run of pictures that touch (a solution in strips
    is one). MadAsMaths sets it after the answers, so it's every picture below the answer row, or on a page after it,
    before the next question; a picture above the answers is the question's own figure. Without an answer row, it's the
    pictures set narrow on the right, as solutions are."""
    picked = []
    for p, rect in pieces:
        for r, z in images(doc[p]):
            if not rect.intersects(r) or (r & rect).height < 4:
                continue
            if found:
                ap, ar = found
                if p < ap or (p == ap and r.y0 < ar.y0 - 4):
                    continue
            elif not (r.x0 >= 280 and r.width < 260):
                continue
            picked.append((p, r & pymupdf.Rect(rect.x0, rect.y0, page_right(doc[p]), rect.y1), z))
    runs = []
    for p, r, z in sorted(picked, key=lambda t: (t[0], t[1].y0)):
        last = runs[-1] if runs else None
        if last and last[0] == p and r.y0 <= last[1].y1 + 8 and r.x0 < last[1].x1 and r.x1 > last[1].x0:
            runs[-1] = (p, last[1] | r, max(last[2], z))
        else:
            runs.append((p, r, z))
    return runs


def page_right(page):
    return page.rect.width


def headings(doc):
    """[(page, y top, number, stars)] for every "Question N" line, in reading order. A heading printed without its
    number (three of them, each between two numbered questions) has number None."""
    out = []
    for i, page in enumerate(doc):
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                m = HEAD.match(text)
                if m and line["bbox"][0] < 150 and (m.group(1) or m.group(5) or m.group(2)):
                    number = m.group(1) or m.group(5)
                    out.append((i, line["bbox"][1], int(number) if number else None, (m.group(3) or "") + (m.group(4) or "")))
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
    place, last = 0, 0
    for k, (pg, y, number, stars) in enumerate(heads):
        # Ids count the numbered headings, so they hold between cuts; one printed without its number is the question
        # before's with "b" ("madas-m2-work-and-energy-016b", shown as 16b), and moves nobody else's.
        if number is None:
            qid, number, suffix = f"madas-{slug}-{place:03d}b", last, "b"
        else:
            place += 1
            qid, suffix = f"madas-{slug}-{place:03d}", ""
            last = number
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
        sols = solution_images(doc, pieces, found)
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
        # Answers boxed beside a part ("b) ∫ … dx   [21]") come out of the question, and go with the answers: each as
        # its part's line, so the answers read "b) … [21]".
        inline = [(p, b) for p, r in q_pieces for b in inline_answers(doc[p], r, closing=not found)]
        notes = [(p, n) for p, r in q_pieces for n in overleaf_notes(doc[p], r)]
        qp = stack([trim(_blank(doc[p], r, [s for sp, s, _ in sols if sp == p] + [b for bp, b in inline + notes if bp == p])) for p, r in q_pieces])
        if qp is None:
            skipped.append((number, "empty question"))
            continue
        answer = None
        if found:
            p, r = found
            answer = trim(render(doc[p], pymupdf.Rect(LEFT, r.y0 - 4, RIGHT, r.y1 + 4)))
        scans = [trim(render(doc[p], r, zoom), keep=10) for p, r, zoom in sols]
        # each line with answers once, however many boxes it has
        bands = []
        for p, b in inline:
            if bands and bands[-1][0] == p and b.y0 < bands[-1][1].y1:
                bands[-1] = (p, bands[-1][1] | b)
            else:
                bands.append((p, pymupdf.Rect(b)))
        parts = [trim(render(doc[p], pymupdf.Rect(LEFT, b.y0 - 4, RIGHT, b.y1 + 4))) for p, b in bands]
        ms = stack([stack(parts, gap=10) if parts else None, answer] + scans, gap=28)
        if ms is None:
            skipped.append((number, "answers came out blank"))
            continue
        # Numbering starts again in a booklet's sections (Poisson's "Introductory calculations", then …), so the id
        # is the question's place among the booklet's headings (left-out questions keep their place, so ids hold
        # between cuts); `n` keeps the number it's printed with.
        qp.save(os.path.join(IMG, f"{qid}-qp.webp"), "WEBP", quality=82, method=6)
        ms.save(os.path.join(IMG, f"{qid}-ms.webp"), "WEBP", quality=82, method=6)
        words = " ".join(text_in(doc[p], r) for p, r in q_pieces)
        out.append({"id": qid, "booklet": slug, "group": group, "n": number, **({"suffix": suffix} if suffix else {}), "stars": stars, "w": qp.width, "h": qp.height,
                    "msw": ms.width, "msh": ms.height, "pages": sorted({p + 1 for p, _ in pieces}),
                    "text": re.sub(r"^Question\s+\d+\s*(\(\*+\+?\))?\s*", "", words)[:1500],
                    "answer": text_in(doc[found[0]], found[1]) if found else "", "solution": len(scans)})
    return slug, out, skipped


def answer_row(doc, pieces):
    """(page, rect) of a question's answers, or None. Answers come last, after everything the question says: the
    lowest row of answer boxes in the right half of the question ("[x = √2]", and "[  ], [proof]"), with every row
    above it the answers run on to, up to the question's last words. Where MadAsMaths didn't box them, a line of text set to the right
    ("0.1898 , 0.3423 , …") counts, if it is the whole line: justified question text comes out of the PDF in
    pieces, and a piece that ends at the margin isn't an answer. Nothing inside a solution scan counts (its frame
    is drawn with lines too, and a picture's own frame isn't an answer box), and a row with question text below it isn't
    the answers."""
    for p, rect in reversed(pieces):
        page = doc[p]
        scans = [r + (-6, -6, 6, 6) for r, _ in images(page)]
        inside = lambda r: rect.contains(r) and not any(s.intersects(r) for s in scans)  # noqa: E731
        lines = []
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                r = pymupdf.Rect(line["bbox"])
                # (words only: the commas between answer boxes are lines of their own)
                if re.sub(r"[\s,.;:]", "", "".join(s["text"] for s in line["spans"])) and inside(r):
                    lines.append(r)
        mid = lambda r: (r.y0 + r.y1) / 2  # noqa: E731
        notes = overleaf_notes(page, rect)
        lines = [r for r in lines if not any(n.intersects(r) for n in notes)]
        whole = [r for r in lines if r.x0 >= 250 and r.x1 >= RIGHT_MARGIN
                 and not any(o is not r and abs(mid(o) - mid(r)) < 4 and o.x1 <= r.x0 + 2 for o in lines)]
        # (a box beside question text on its line is that part's own answer: inline_answers takes it)
        drawn = boxes(page)
        # (text inside a box isn't question text: an answer row's first, "empty" box holds MadAsMaths' code, "SPX-N")
        loose = [t for t in lines if not any(b.intersects(t) for b in drawn)]
        boxed = [b for b in drawn if inside(b) and b.x1 >= 300 and not beside_text(b, loose)]
        anchors = boxed + whole
        if not anchors:
            continue
        last = max(anchors, key=lambda r: r.y0)
        if any(r.y0 > last.y1 + 2 and r.x0 < 250 and words_in(page, r) >= 3 for r in loose):
            return None  # question text after it: a box in the question, or answers mid-question (inline_answers)
        items = [b for b in drawn if inside(b) and not beside_text(b, loose)] + whole
        # A row's boxes are as tall as their answers ("[A = 2]" beside a fraction), so a row is what overlaps it.
        same = lambda a, b: min(a.y1, b.y1) - max(a.y0, b.y0) > 0  # noqa: E731
        band = [r for r in items if same(r, last)]
        band += [r for r in items if r not in band and any(same(r, b) for b in band)]
        # The answers can run over several rows ("[ ], [I = …], [J = …]," then the next row), with room between for
        # tall ones: take each row above while there's no question text between it and the answers so far.
        text = [r for r in lines if not any(b.contains(r) or b.intersects(r) for b in items)]
        while True:
            top = min(r.y0 for r in band)
            above = [r for r in anchors if r.y1 <= top + 2 and top - r.y1 <= 60]
            if not above:
                break
            row = max(above, key=lambda r: r.y1)
            if any(t.y0 >= row.y1 - 2 and t.y1 <= top + 2 and t.x0 < 250 for t in text):
                break  # question text between: that row belongs to the question
            band += [r for r in items if r not in band and same(r, row)]
        return p, pymupdf.Rect(min(r.x0 for r in band), min(r.y0 for r in band), max(r.x1 for r in band), max(r.y1 for r in band))
    return None


OVERLEAF = re.compile(r"solutions?\s+overleaf", re.I)


def words_in(page, rect):
    """Letters and digits in a rect: three or more is text; fewer, a diagram's label ("k", "A")."""
    return len(re.sub(r"\W", "", page.get_text("text", clip=rect)))


def overleaf_notes(page, rect):
    """"[solution overleaf]": a note that the working is on the next page, neither question nor answer."""
    return [t for t in text_lines(page, rect) if OVERLEAF.search(page.get_text("text", clip=t))]


def beside_text(box, lines):
    """Whether question text runs on the same line as a box, to its left: the box is that part's answer, inline."""
    return any(t.x0 < 250 and t.x1 < box.x0 and min(t.y1, box.y1) - max(t.y0, box.y0) > 0.4 * min(t.height, box.height) for t in lines)


def text_lines(page, rect=None):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for line in b.get("lines", []):
            r = pymupdf.Rect(line["bbox"])
            if "".join(s["text"] for s in line["spans"]).strip() and (rect is None or rect.contains(r)):
                out.append(r)
    return out


def inline_answers(page, rect, closing=False):
    """Answer boxes set beside a part inside the question, rather than in the answers at its end ("b) ∫ … dx   [21]"):
    a box on the right with words in it, with the part's own words beside it on its line, on its own (a table's cells
    share their sides, and a table stays in the question), and no wider than an answer is: a diagram's outlines and
    labels ("A", "C") are boxes too. With `closing` (a question whose answers aren't in a row at its end), any box on
    the right with three or more letters or digits in it is an answer too."""
    drawn = boxes(page)
    loose = [t for t in text_lines(page, rect) if not any(b.intersects(t) for b in drawn)
             and re.sub(r"[\s,.;:]", "", page.get_text("text", clip=t))]
    found = []
    for b in drawn:
        words = page.get_text("text", clip=b).strip()
        if not (rect.contains(b) and words and words_in(page, b) >= 1 and not OVERLEAF.search(words)):
            continue
        # beside a part's words; or, in a question with no closing row of answers, any answer box on the right
        # ("[proof]" before a closing note, "[t = π/15]"): real words, not a diagram's one-letter label
        if b.x0 >= 300 and b.width <= 260 and beside_text(b, loose) or closing and b.x1 >= 400 and words_in(page, b) >= 3:
            found.append(b)
    near = lambda a, b: a is not b and abs(a.y0 - b.y0) < 2 and (abs(a.x1 - b.x0) < 2 or abs(a.x0 - b.x1) < 2) or a is not b and abs(a.x0 - b.x0) < 2 and (abs(a.y1 - b.y0) < 2 or abs(a.y0 - b.y1) < 2)  # noqa: E731
    pics = [r + (-6, -6, 6, 6) for r, _ in images(page)]
    return sorted((b for b in found if not any(near(b, o) for o in drawn) and not any(pr.intersects(b) for pr in pics)), key=lambda b: (b.y0, b.x0))


def _blank(page, rect, scans):
    """The question's crop with its solution painted out, where some of it is set beside the question's last lines, and
    any answers boxed beside its parts."""
    img = render(page, rect)
    for r in scans:
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
