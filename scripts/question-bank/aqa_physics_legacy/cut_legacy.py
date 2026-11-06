"""Cut AQA's legacy Physics A (2450) papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/aqa_physics_legacy/cut_legacy.py [work-dir] [--only=phya1-jun14]   # needs pymupdf, pillow

The 2010-2016 papers (fetch_pmt.py) are laid out unlike the 7408 papers cut.py reads:
  - every part prints its whole label in the left margin, "1 (a) (i)": the question number
    in bold, then the letter and the numeral, as separate spans (2010-2013) or one bold span
    ("2 (a) (iii) State the..." 2014 on). Marks are "(2 marks)" at the right.
  - a label whose region prints no marks and is followed by its own sub-parts ("1 (a)" then
    "1 (a) (i)") is a setup, not a part. A part's setups, its question's and its letter's,
    stack into one start image, `<set>-<q>[-<letter>]-stem.webp` (the bank's `st`, with
    `sk` naming it where the part's id doesn't).
  - the schemes come in three layouts: a "Question 1" heading with "(a)" "(i)" (or "a" "i")
    columns (2010-2012), a Question/Part/Sub-part table (January 2013, June 2012-2013),
    and a one-cell label, "1bi" (2014-2015) or "2(a)(i)" (2016). Every layout rules its
    rows, so a part's scheme runs from the rule above its label to the rule above the next.
  - PHYA4 Section A (PHYA4A) is the objective test: questions 1-25, each a whole question,
    answered by the key in the Unit 4 scheme. No crop; `key` is the letter.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, <stem>-stem.webp and <work-dir>/parts.json in
cut.py's shape, plus `level` (the label's depth) and `stemKey` where it differs.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
QB = os.path.dirname(HERE)
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(QB, ".work", "phya")
sys.path.insert(0, QB)
sys.argv = [sys.argv[0], WORK]  # cut.py reads its work dir from argv at import
import cut  # noqa: E402

IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)
cut.IMG = IMG

ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
QP_LABEL = re.compile(r"^(\d{1,2})(?:\s*\(([a-h])\))?(?:\s*\(([ivx]{1,4})\))?(?=\s|$)")
MARKS = re.compile(r"[(\[](\d{1,2}) marks?[)\]]")
SKIP = re.compile(r"no questions printed on this page|do not write on this page|answer in the spaces provided|DO NOT WRITE ON THIS PAGE", re.I)
MARGIN = re.compile(r"^(Do not write|outside the|box$|Areas outside|the box will|not be scanned|for marking)", re.I)


def lines_of(page):
    """[(x0, y0, x1, y1, text, bold, size, spans)], spans as (x0, text, bold).

    Some 2015 papers' fonts report line boxes 30pt tall for 11pt text, their tops far above
    the ink: a line's top is read off its baseline where the box runs higher."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            t = "".join(s["text"] for s in spans).strip()
            x0, y0, x1, y1 = line["bbox"]
            y0 = max(y0, min(s["origin"][1] - s["size"] for s in spans))
            out.append((x0, y0, x1, y1, t, "Bold" in spans[0]["font"], spans[0]["size"],
                        [(s["bbox"][0], s["text"].strip(), "Bold" in s["font"]) for s in spans]))
    return out


def rows_of(page, max_x=140, min_y=46, foot=50):
    """Text in the left margin grouped by baseline: [(y, [(x0, text, bold)])], top to bottom."""
    h = page.rect.height
    spans = []
    for x0, y0, x1, y1, t, bold, size, ss in lines_of(page):
        if y0 < min_y or y0 > h - foot or size < 8:
            continue
        for sx, st, sb in ss:
            if sx < max_x:
                spans.append((y0, sx, st, sb))
    rows = []
    for y, x, t, b in sorted(spans, key=lambda s: (round(s[0]), s[1])):
        if rows and abs(rows[-1][0] - y) < 4:
            rows[-1][1].append((x, t, b))
        else:
            rows.append([y, [(x, t, b)]])
    return [(y, sorted(r)) for y, r in rows]


def key_of(q, a=None, r=None):
    return (int(q), a, r)


def label_str(k):
    q, a, r = k
    return f"{q}" + (f"({a})" if a else "") + (f"({r})" if r else "")


def sort_key(k):
    q, a, r = k
    return (q, ord(a) - 96 if a else 0, ROMAN.index(r) + 1 if r else 0)


def is_child(parent, child):
    """child is a sub-label of parent: (1,a,None) of (1,None,None), (1,a,i) of (1,a,None)."""
    if parent == child or parent[0] != child[0]:
        return False
    if parent[1] is None and parent[2] is None:
        return child[1] is not None or child[2] is not None  # "3 (i)" sits under "3" with no letter
    return parent[1] == child[1] and parent[2] is None and child[2] is not None


def under(parent, child):
    """child is anywhere below parent."""
    return child != parent and child[0] == parent[0] and parent[1] in (None, child[1]) and parent[2] in (None, child[2])


def ok_next(prev, k):
    """Labels only move forward: the same question deeper or further on, or the next question."""
    if prev is None:
        return k[0] <= 2
    if k[0] == prev[0] + 1:
        return True
    return k[0] == prev[0] and sort_key(k) > sort_key(prev)


# ---- question papers ----------------------------------------------------------------

FOOTER = re.compile(r"^(Turn over|END OF QUESTIONS|\(\d\d\)$|(WMP|G|IB|SP|M)/\S*/(Jan|Jun)\d\d)")


def ink(line):
    """A line's ink, top to bottom, from its baselines (some fonts report boxes far taller than their glyphs)."""
    spans = [s for s in line["spans"] if s["text"].strip()]
    top = max(line["bbox"][1], min(s["origin"][1] - s["size"] * 0.75 for s in spans))
    return top, max(s["origin"][1] + s["size"] * 0.22 for s in spans)


def clear_cut(page, y, below):
    """A cut at y that runs through a line of text moves to just under it ("(1 mark)" printed a few
    points above the next label), or, where that would reach the next label (`below`), just over it."""
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            if not "".join(s["text"] for s in line["spans"]).strip():
                continue
            top, bottom = ink(line)
            if top + 1 < y < bottom - 1:
                y = bottom + 1 if bottom + 1 <= below else top - 1
    return y


def qp_frame(page):
    f = cut.frame(page, True)
    # The page's own footer ends it, not a fixed margin: some print a part's last "(1 mark)" below 766.
    h = page.rect.height
    lines = lines_of(page)
    foot = [y0 for x0, y0, x1, y1, t, b, s, ss in lines if y0 > h * 0.55 and FOOTER.match(t)]
    stop = min(foot) - 1 if foot else h - 40
    # Down to the page's lowest text, figure or drawing, never into the footer: not the barcode
    # (a picture at the bottom left on some papers) nor the long rule some draw above it.
    low = [y1 for x0, y0, x1, y1, t, b, s, ss in lines if not FOOTER.match(t) and not MARGIN.match(t) and x0 < 540 and y0 < stop]
    low += [r["bbox"][3] for r in page.get_image_info() if r["bbox"][1] < h - 70 and r["bbox"][3] < stop]
    low += [d["rect"].y1 for d in page.get_drawings() if d["rect"].y1 < stop and d["rect"].x0 < 540
            and not (d["rect"].height < 3 and d["rect"].width > 300) and d["rect"].width < 500]
    f.y1 = min(stop, max(low, default=stop - 3) + 6)
    turn = [y0 for x0, y0, x1, y1, t, b, s, ss in lines_of(page) if t.startswith("Turn over")]
    if turn:
        f.y1 = min(f.y1, min(turn) - 1)
    # The paper prints its text out to x 527-532, under the margin column's edge on some
    # pages: reach past any line that runs over, never into the margin notes (x > 540).
    over = [x1 for x0, y0, x1, y1, t, b, s, ss in lines_of(page)
            if x0 < 520 and x1 > f.x1 and f.y0 < y0 < f.y1 and not MARGIN.match(t)]
    if over:
        f.x1 = min(max(over) + 3, 545)
    return f


def qp_labels(page, mcq, allow_plain=False):
    out = []
    for y, row in rows_of(page):
        x0, first, bold = row[0]
        if x0 > 75 or not re.match(r"\d", first):
            continue
        if mcq:
            if re.fullmatch(r"\d{1,2}", first) and x0 < 60:
                out.append((y, key_of(first)))
            continue
        m = QP_LABEL.match(" ".join(t for _, t, _ in row))
        if not bold and not (allow_plain and m and m.group(2)):
            continue
        if m:
            out.append((y, key_of(m.group(1), m.group(2), m.group(3))))
    return out


def qp_regions(doc, mcq, allow_plain=False):
    marks, prev = [], None
    for i, page in enumerate(doc):
        if SKIP.search(page.get_text()):
            continue
        for y, k in qp_labels(page, mcq, allow_plain):
            if ok_next(prev, k):
                marks.append((i, y, k))
                prev = k
    out = []
    for n, (i, y, k) in enumerate(marks):
        nxt = marks[n + 1] if n + 1 < len(marks) else None
        pieces, pg = [], i
        while True:
            page = doc[pg]
            f = qp_frame(page)
            top = clear_cut(page, y - 6, y + 1) if pg == i else f.y0
            end = clear_cut(page, nxt[1] - 6, nxt[1] + 1) if nxt and nxt[0] == pg else f.y1
            if end > top + 8 and page.get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, end)).strip():
                pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, end)))
            if (nxt and nxt[0] == pg) or pg + 1 >= len(doc) or "END OF QUESTIONS" in page.get_text():
                break
            pg += 1
            if nxt and pg > nxt[0]:
                break
            if SKIP.search(doc[pg].get_text()):
                break
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        out.append((k, pieces, text))
    return out


# ---- mark schemes -------------------------------------------------------------------

QWC = re.compile(r"^(The candidate.s writing should be legible|Quality of written communication:|The marking scheme for this question includes an overall)")
LETTER = re.compile(r"^\(?([a-h])\)?$")
NUMERAL = re.compile(r"^\(?([ivx]{1,4})\)?$")
COMPACT = re.compile(r"^(\d{1,2})\s*(?:\(?([a-h])\)?)?\s*(?:\(?([ivx]{1,4})\)?)?$")


def ms_label(row, q, headed=False):
    """A scheme row's label, given the question its heading set: (key, x, whether it prints its number) or None."""
    toks = [(x, t) for x, t, b in row if x < 215]
    if not toks:
        return None
    x0, t0 = toks[0]
    if x0 > 140:
        return None
    m = NUMERAL.match(t0)
    if m and 100 < x0 and q is not None and headed and not LETTER.match(t0):
        return key_of(q, None, m.group(1)), x0, False  # "(i)" under "Question 7": its letter, if any, comes from the rows above
    if x0 > 100:
        return None
    m = COMPACT.match(t0.replace(" ", ""))
    if m and x0 < 100 and not re.fullmatch(r"\d{1,2}", t0) or (m and re.fullmatch(r"\d{1,2}", t0) and x0 < 90):
        k = [m.group(1), m.group(2), m.group(3)]
        rest = toks[1:]
        # A Question/Part/Sub-part table (2012-2013) puts them in columns of their own, out to x 210.
        if not k[1] and rest and LETTER.match(rest[0][1]) and rest[0][0] < 165:
            k[1] = LETTER.match(rest[0][1]).group(1)
            rest = rest[1:]
        if not k[2] and rest and NUMERAL.match(rest[0][1]) and rest[0][0] < 215:
            k[2] = NUMERAL.match(rest[0][1]).group(1)
        return key_of(*k), x0, True
    if q is None:
        return None
    m = LETTER.match(t0)
    if m:
        r = toks[1][1] if len(toks) > 1 and NUMERAL.match(toks[1][1]) and toks[1][0] < 140 else None
        return key_of(q, m.group(1), NUMERAL.match(r).group(1) if r else None), x0, False
    return None


def row_top(page, y, x):
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].width > 15 and d["rect"].x0 <= x + 5 and d["rect"].x1 >= x + 4})
    above = [r for r in rules if r <= y + 2]
    return above[-1] - 1 if above else y - 4


SECTION = re.compile(r"^(GCE Physics, Specification A, PHYA5\S*|Section [AB] [–-] )")


def section_window(doc, core):
    """PHYA5's schemes to 2013 print the Section 1 (core) scheme and the option's in one file, under
    titles of their own ("GCE Physics, Specification A, PHYA5/1, Nuclear and Thermal Physics" and
    "..., PHYA5/2A, Astrophysics"; June 2010 "..., PHYA5/2A, Section A/B"; 2013 "Section A – ...",
    "Section B – Astrophysics"). ((page, y) to start at, (page, y) to stop at) for the one wanted,
    or None where the file holds one scheme."""
    titles = [(i, y0, "PHYA5/1" in t or "Section A" in t) for i, page in enumerate(doc)
              for x0, y0, x1, y1, t, b, sz, ss in sorted(lines_of(page), key=lambda l: l[1]) if SECTION.match(t)]
    for n, (i, y, is_core) in enumerate(titles):
        if is_core == core:
            nxt = next(((j, z) for j, z, c in titles[n + 1:] if c != core), (len(doc), 0))
            return (i, y), nxt
    return None


def ms_regions(doc, mode):
    """{key: (pieces, text)} for the written questions.

    mode "B": Unit 4, whose scheme opens with Section A's key: read Section B only (from its
    heading, or from the page after the key where it prints none, June 2016).
    mode "first" / "last": PHYA5's schemes to 2013 print the Section 1 (core) scheme and the
    option's in one file: each reads its own section (section_window), and where a file's
    numbering starts again at 1 without a title, the core takes the first block, an option
    the last. Other schemes have one block."""
    blocks, marks, cands, q, prev, begun = [], [], [], None, None, False
    window = section_window(doc, mode == "first") if mode in ("first", "last") else None
    letter, headed = {}, False
    (wp, wy), (ep, ey) = window or ((0, 0), (len(doc), 0))
    started, after_key = mode != "B", False
    for i, page in enumerate(doc):
        if i < wp or i > ep:
            continue
        text = page.get_text()
        rows = [(y, row) for y, row in rows_of(page, 215, 55, 40) if (i, y) >= (wp, wy - 1) and (i, y) < (ep, ey - 2)]
        floor = 0
        if not started:
            sb = next((y for y, row in rows if re.match(r"^Section B\s*:?$", " ".join(t for _, t, _ in row))), None)
            if sb is not None or after_key:
                started, floor = True, (sb or 0)
            elif re.search(r"Section A", text):
                after_key = True
                continue
            else:
                continue
        # The marking guidance at the front numbers its paragraphs 1-7: start at the first question
        # (a "Question 1" heading, the table's "Question" column, the scheme's own title line,
        # "GCE Physics, Specification A, PHYA1, ...", or the first lettered label of question 1),
        # and read every page after it.
        if not begun:
            title = next((y for y, row in rows if re.match(r"^(Question\b|GCE Physics, Specification A)", " ".join(t for _, t, _ in row))
                          or ((g := ms_label(row, None)) and g[0][0] == 1 and g[0][1])), None)
            if title is None:
                continue
            begun, floor = True, max(floor, title - 2)
        for y, row in rows:
            if y < floor:
                continue
            joined = " ".join(t for _, t, _ in row)
            h = re.match(r"^Question\s*(\d{1,2})\s*$", joined)
            if h:
                q, headed = h.group(1), True
                cands.append((i, y - 3, key_of(q), y, True, row[0][0], True))  # a question with no parts has only its heading
                continue
            got = ms_label(row, q, headed)
            if got:
                k, x, numbered = got
                headed = headed and not numbered
                if not numbered and k[1] is None and k[2]:
                    k = (k[0], letter.get(k[0]), k[2])
                if k[1]:
                    letter[k[0]] = k[1]
                cands.append((i, row_top(page, y, x), k, y, False, x, numbered))
                q = str(k[0])
    # A bare number counts only in the labels' own column (or centred in it, a 2016 table's "5"):
    # an answer's numbered points to its left (PHYA5, June 2014: "1 The universe has expanded...",
    # x 57 against labels at x 70) don't.
    col = sorted(c[5] for c in cands if not c[4] and (c[2][1] or c[2][2]))
    col = col[len(col) // 2] if col else None
    shift = {}
    for i, top, k, y, heading, x, numbered in cands:
        bare = not heading and not k[1] and not k[2]
        if bare and col is not None and not col - 8 <= x <= col + 40:
            continue
        if not numbered and k[0] in shift:
            k = (shift[k[0]], k[1], k[2])
        if prev and k[0] < prev[0] and k[0] == 1 and not bare:
            blocks.append(marks)  # numbering starts again: the next scheme in the file
            marks, prev = [], None
        if bare and prev and k[0] == prev[0]:
            continue  # a "1" heading cell over a question's rows (Question/Part/Sub-part tables)
        if prev and k == prev:
            continue  # a label repeated on a row's continuation
        if prev and not ok_next(prev, k) and k[1] == "a" and k[0] == prev[0] and not numbered:
            shift[k[0]] = k[0] + 1  # a question whose "Question 6" heading isn't printed starts again at (a)
            k = (k[0] + 1, k[1], k[2])
        if not ok_next(prev, k) and not (heading and prev and k[0] == prev[0] + 2):
            continue
        if marks and marks[-1][4] and is_child(marks[-1][2], k):
            marks.pop()  # the heading of a question with parts
        marks.append((i, max(top, (marks[-1][3] + 4) if marks and marks[-1][0] == i else 0), k, y, heading))
        prev = k
    blocks.append(marks)
    blocks = [b for b in blocks if b]
    marks = (blocks[-1] if mode == "last" else blocks[0]) if blocks else []
    # A quality-of-written-communication answer is one tall row that can start a page before its
    # label (printed mid-row, 2013): its opening lines belong to the next part, not this one.
    orig = list(marks)
    for n in range(len(orig) - 1):
        i, top0, k, ly, hd = orig[n]
        j, ntop, nk, nly, nhd = orig[n + 1]
        first = min((round(d["rect"].y0) for d in doc[j].get_drawings() if d["rect"].height < 3 and d["rect"].width > 15
                     and d["rect"].x0 <= (col or 60) + 5 <= d["rect"].x1), default=None)
        if j == 0 or first is None or abs(ntop - (first - 1)) > 3:
            continue  # the next label's row starts on its own page: nothing of it is on the page before
        for pg in (j - 1,):
            if pg < i:
                break
            lo = ly + 20 if pg == i else 0  # after this part's own row: a QWC part opens with them too
            hi = ntop if pg == j else 10 ** 6
            starts = [y0 for x0, y0, x1, y1, t, b, sz, ss in lines_of(doc[pg]) if lo < y0 < hi and QWC.match(t)]
            if starts:
                y = row_top(doc[pg], min(starts), col or 60)
                ruled = any(ly + 4 < d["rect"].y0 <= min(starts) and d["rect"].height < 3 and d["rect"].width > 15
                            and d["rect"].x0 <= (col or 60) + 5 <= d["rect"].x1 for d in doc[pg].get_drawings())
                if pg == i and (y <= ly or not ruled):
                    break  # the opener is in this part's own row: it is the QWC part
                marks[n + 1] = (pg, max(y, lo), nk, nly, nhd)
                break
    out = {}
    for n, (i, top0, k, ly, _) in enumerate(marks):
        nxt = marks[n + 1] if n + 1 < len(marks) else None
        pieces, pg = [], i
        while True:
            page = doc[pg]
            f = cut.ms_frame(page)
            top = top0 if pg == i else f.y0
            end = nxt[1] if nxt and nxt[0] == pg else f.y1
            if pg == ep:
                end = min(end, ey - 3)
            stop = ending(page, top + 14 if pg == i else top, end)
            if stop is not None:
                end = stop
            if end > top + 8 and page.get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, end)).strip():
                pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, end)))
            if stop is not None or (nxt and nxt[0] == pg) or pg + 1 >= len(doc) or pg >= ep:
                break
            pg += 1
            if nxt and pg > nxt[0]:
                break
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        out.setdefault(k, (pieces, text))
    return out


def ending(page, top, end):
    """Where a question's last rows end: a "Total" row, the next question's heading, or the end of the scheme."""
    for x0, y0, x1, y1, t, bold, size, ss in sorted(lines_of(page), key=lambda l: l[1]):
        if top < y0 < end and x0 < 120 and (re.match(r"^(Question\s*\d+|Total\b|Section B)", t) and bold
                                             or re.match(r"^(Question\s+\d+\s*$|Copyright|UMS conversion)", t)):
            return y0 - 3
    return None


def ms_questions_2009(doc):
    """The unruled 2009 schemes centre labels vertically beside their answers.

    Cutting at those labels divides answers between parts. Keep the complete
    question, including diagrams and QWC descriptors, and mark it as shared.
    Every question in these four schemes has an explicit 'Question n' heading.
    """
    headings = []
    for pg, page in enumerate(doc):
        for x0, y0, x1, y1, text, *_ in lines_of(page):
            match = re.fullmatch(r"Question\s+(\d+)", text)
            if match:
                headings.append((pg, y0 - 3, key_of(match.group(1))))
    out = {}
    for n, (pg, top, key) in enumerate(headings):
        end_pg, end_y, _ = headings[n + 1] if n + 1 < len(headings) else (len(doc) - 1, float("inf"), None)
        pieces = []
        for i in range(pg, end_pg + 1):
            frame = cut.ms_frame(doc[i])
            rect = pymupdf.Rect(frame.x0, top if i == pg else frame.y0,
                                frame.x1, min(end_y, frame.y1) if i == end_pg else frame.y1)
            if rect.height > 8 and doc[i].get_text("text", clip=rect).strip():
                pieces.append((i, rect))
        out[key] = (pieces, "\n".join(doc[i].get_text("text", clip=r) for i, r in pieces))
    return out


def mcq_keys(doc):
    """The Unit 4 scheme's key to Section A: {1: 'C', ...}, read by position (a row of numbers over a
    row of letters, or number-letter pairs side by side)."""
    for page in doc:
        if not re.search(r"Section A", page.get_text()):
            continue
        words = [(w[0], w[1], w[4]) for w in page.get_text("words")]
        nums = [(x, y, int(t)) for x, y, t in words if re.fullmatch(r"\d{1,2}", t) and 1 <= int(t) <= 25 and y > 60]
        lets = [(x, y, t) for x, y, t in words if re.fullmatch(r"[A-D]", t)]
        keys = {}
        for x, y, n in nums:
            right = [(lx - x, lt) for lx, ly, lt in lets if abs(ly - y) < 4 and 0 < lx - x < 110]
            below = [(ly - y, lt) for lx, ly, lt in lets if abs(lx - x) < 8 and 0 < ly - y < 40]
            if right:
                keys.setdefault(n, min(right)[1])
            elif below:
                keys.setdefault(n, min(below)[1])
        if len(keys) >= 20:
            return keys
    return {}


def match(qp_keys, ms_keys):
    """{paper part: ([scheme rows], whole)}. A paper and its scheme don't always label alike:
    the paper's "1 (i)" is the scheme's "1(a)(i)" (June 2013), a part's scheme can split into
    rows of its own ("1(b)" scored as "1(b)(i)" to "(iii)"), or one row can score several
    parts (`whole`: the part shows its parent's row, the bank's `msq`). Exact labels first,
    then rows below a part, then the row above it, then what is left of the question in order
    where the counts agree."""
    plan, used = {}, set()
    for k in qp_keys:
        if k in ms_keys:
            plan[k] = ([k], False)
            used.add(k)
    for k in qp_keys:  # one side leaves out the letter: the paper's "7 (a) (i)" is the scheme's "Question 7 (i)"
        if k in plan or not k[2]:
            continue
        same = [m for m in ms_keys if m not in used and m[0] == k[0] and m[2] == k[2] and None in (m[1], k[1])]
        if len(same) == 1:
            plan[k] = (same, False)
            used.add(same[0])
    for k in qp_keys:
        if k in plan:
            continue
        below = [m for m in ms_keys if under(k, m) and m not in used and not any(under(o, m) for o in qp_keys if o != k and under(k, o))]
        if below:
            plan[k] = (below, False)
            used.update(below)
    for k in qp_keys:
        if k in plan:
            continue
        above = [m for m in ms_keys if under(m, k)]
        if above:
            plan[k] = ([max(above, key=sort_key)], True)
            used.add(max(above, key=sort_key))
    for q in sorted({k[0] for k in qp_keys}):
        left_qp = [k for k in qp_keys if k[0] == q and k not in plan]
        left_ms = [m for m in ms_keys if m[0] == q and m not in used]
        if left_qp and len(left_qp) == len(left_ms):
            for k, m in zip(left_qp, left_ms):
                plan[k] = ([m], False)
                used.add(m)
    return plan


def open_upright(path):
    """PHYA5's June 2016 schemes store landscape pages rotated 90 degrees: make every page
    rotation 0 (looking the same) so coordinates read the way the page looks (as cut_edexcel.py)."""
    doc = pymupdf.open(path)
    for page in doc:
        if page.rotation:
            page.remove_rotation()
    return doc


# ---- one set ------------------------------------------------------------------------

def cut_set(qp_path, ms_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    ms = open_upright(ms_path) if ms_path and os.path.exists(ms_path) else None
    mcq = meta["component"] == "PHYA4A"
    early = meta["series"] in ("JAN09", "JUN09")
    regions = qp_regions(qp, mcq, allow_plain=early)
    keys = mcq_keys(ms) if (ms and mcq) else {}
    mode = "B" if meta["component"] == "PHYA4B" else "last" if meta["component"].startswith("PHYA5B") else "first"
    ms_map = (ms_questions_2009(ms) if early else ms_regions(ms, mode)) if (ms and not mcq) else {}
    # January 2009 PHYA1 6(b)(i–iii) has one combined six-mark award, printed
    # after (iii). Keep the three prompts together rather than inventing marks.
    if meta["component"] == "PHYA1" and meta["series"] == "JAN09":
        grouped = []
        for k, pieces, text in regions:
            if k[:2] == (6, "b") and k[2] and grouped and grouped[-1][0] == (6, "b", None):
                pk, pp, pt = grouped[-1]
                grouped[-1] = (pk, pp + pieces, pt + "\n" + text)
            else:
                grouped.append((k, pieces, text))
        regions = grouped
    # A part that prints the marks for its own (i) and (ii), which print none ("2 (b) Suggest why ...
    # if a sample is: [2 marks]" then "(i) less than 200 years old", PHYA5 June 2014), is one part.
    merged = []
    for k, pieces, text in regions:
        if merged and under(merged[-1][0], k) and MARKS.search(merged[-1][2]) and not MARKS.search(text) and not mcq:
            pk, pp, pt = merged[-1]
            merged[-1] = (pk, pp + pieces, pt + "\n" + text)
        else:
            merged.append((k, pieces, text))
    regions = merged
    labels = [k for k, _, _ in regions]
    setups = {}
    for n, (k, pieces, text) in enumerate(regions):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        if not mcq and nxt and is_child(k, nxt) and not MARKS.search(text):
            setups[k] = (pieces, text)
    plan = match([k for k in labels if k not in setups], list(ms_map))
    parts = []
    for k, pieces, text in regions:
        if k in setups:
            continue
        q, a, r = k
        pid = "-".join([set_id, str(q)] + ([a] if a else []) + ([r] if r else []))
        anc = list(dict.fromkeys(x for x in [key_of(q), key_of(q, a) if r else None] if x and x != k and x in setups))
        # June 2009 PHYA2 puts Figure 6 under 5(a), but 5(b) also asks about
        # point Y on that figure. Carry the figure to the sibling part too.
        if meta["component"] == "PHYA2" and meta["series"] == "JUN09" and k == (5, "b", None):
            anc = [key_of(5, "a")]
        stem_name = stem_key = None
        if anc:
            parent = anc[-1]
            stem_key = "-".join([set_id, str(q)] + ([parent[1]] if parent[1] else []))
            stem_name = f"{stem_key}-stem.webp"
            if not os.path.exists(os.path.join(IMG, stem_name)):
                cut.save(cut.stack([cut.trim_bottom(cut.render(qp[pg], rr), 16) for x in anc for pg, rr in setups[x][0]]), stem_name)
        keep = [pieces[0]] + [(pg, rr) for pg, rr in pieces[1:]
                              if re.search(r"[A-Za-z]{3,}", re.sub(r"Extra space|Do not write|outside the|box|Answer|Turn over|[(\[]\d+ marks?[)\]]|Question \d+ continues on the next page|QWC", "", qp[pg].get_text("text", clip=rr)))]
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[pg], rr)) for pg, rr in keep])
        msimg, ms_text, whole = None, "", False
        if k in plan:
            keys, whole = plan[k]
            for mk in keys:
                ms_text += ms_map[mk][1] + "\n"
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], rr), 12) for mk in keys for pg, rr in ms_map[mk][0]])
        m = MARKS.findall(text)
        default_stem = pid.rsplit("-", 1)[0]
        setup_text = " ".join(setups[x][1] for x in anc)
        parts.append({
            "id": pid, "set": set_id, **meta, "question": str(q), "part": label_str(k)[len(str(q)):] or None,
            "label": label_str(k), "level": 1 + bool(a) + bool(r),
            "marks": 1 if mcq else (sum(int(x) for x in m) if m else None),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            **({"stemKey": stem_key} if stem_key and stem_key != default_stem else {}),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", setup_text + " " + text).strip()[:1500],
            "ownText": re.sub(r"\s+", " ", text).strip()[:900],
            "setupText": re.sub(r"\s+", " ", setup_text).strip()[:900],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            **({"key": keys[q]} if mcq and q in keys else {}),
            **({"msq": 1} if whole else {}),
            # Where each crop came from, for check_legacy.py: [[page, x0, y0, x1, y1], ...].
            "qpRects": [[pg, *map(round, rr)] for pg, rr in keep],
            "msRects": [[pg, *map(round, rr)] for mk in (plan[k][0] if k in plan else []) for pg, rr in ms_map[mk][0]],
            "stemRects": [[pg, *map(round, rr)] for x in anc for pg, rr in setups[x][0]],
        })
    used = {mk for keys_, _ in plan.values() for mk in keys_}
    unmatched = sorted(set(ms_map) - used, key=sort_key)
    return parts, [label_str(k) for k in unmatched]


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        parts, unmatched = cut_set(pdf("qp"), pdf("ms"), set_id, meta)
        return set_id, parts, unmatched, None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": "2450", "series": series})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, unmatched, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = [p["label"] for p in parts if not p["ms"] and not p.get("key")]
            no_marks = [p["label"] for p in parts if p["marks"] is None]
            print(f"{set_id}: {len(parts)} parts, {sum(p['marks'] or 0 for p in parts)} marks, no scheme {no_ms}, no marks {no_marks}, scheme rows unused {unmatched}",
                  file=sys.stderr, flush=True)
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
