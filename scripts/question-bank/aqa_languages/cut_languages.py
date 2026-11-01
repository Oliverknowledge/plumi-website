"""Cut AQA's A-Level and AS French and Spanish papers into questions, each with its mark scheme.

    python3 scripts/question-bank/aqa_languages/cut_languages.py [work-dir] [--only=76521]   # default scripts/question-bank/.work/aqa-languages

The papers are laid out as the sciences' are, so this is cut.py with a few patches:

  - A question ends at its last marks ("[2 marks]", or a summary's "[5 marks]" under its
    bullet points' own), so the answer lines and the next question's "Tracks: 15–32" stay out.
  - AS Paper 2 prints its essay questions in the insert, not the paper: they are cut from it.
  - Paper 1's scheme is a table per row, each headed "Qu | Key Idea | Accept | Mark | Notes".
    Its translations are marked box by box ("Box 1" to "30"), and those box numbers sit where
    a question's number would: a whole question's number counts only as the first label under a
    "Qu" header, under a "Question 10" heading, or in AQA's drawn boxes (Paper 2's schemes). A row starts at its
    header, or at the "Question 09.9 Guidance on level of accuracy..." (or AS: "Acceptable quality of English in
    translations...") heading above it.
  - A scheme row runs on, across pages, to the next one, but never into the marking guidance
    AQA prints before each section's summary ("Level of response marking instructions",
    "Summary questions", the AO3 grid) or past a "Section B" heading.
  - Grids printed once for many questions go under each question they mark: the AO3 grid for
    a summary's language mark (its rows say "Bullet point 1", or "Bullet 1"), the AO3 and AO4
    grids for an essay, and AS Paper 2's conversion grid for each of its five translated
    sentences. Paper 1's translations already have their guidance, box table and conversion grid
    in their rows.
  - Reports comment question by question on Paper 1 and essay by essay on Paper 2 (see
    examiner_report).
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-languages")] + flags
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import cut  # noqa: E402

MARKS = re.compile(r"\[\d+ marks?\]")
GUIDE = re.compile(r"^\s*(Level of response marking instructions|Summary questions\s*$|AO3 quality of language marks)", re.M)
HEADING = re.compile(r"^(Question\s+\d|Acceptable quality of English in translations|Guidance on level of accuracy in translations)")
SUMMARY_GRID = re.compile(r"^AO3 quality of language marks")
ESSAY_MARKS = re.compile(r"\[(\d+) marks\]")


def lines(page):
    """[(y0, x0, text, spans)] of a page, top to bottom."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t:
                out.append((line["bbox"][1], line["bbox"][0], t, line["spans"]))
    return sorted(out, key=lambda l: (l[0], l[1]))


def end_at_marks(doc, pieces):
    """The pieces up to the foot of the last line that prints marks."""
    for n in range(len(pieces) - 1, -1, -1):
        pg, rect = pieces[n]
        found = [l for l in cut.text_lines(doc[pg], rect) if MARKS.search(l[2])]
        if found:
            y = max(line["bbox"][3] for b in doc[pg].get_text("dict", clip=rect)["blocks"] for line in b.get("lines", [])
                    if MARKS.search("".join(s["text"] for s in line["spans"])))
            return pieces[:n] + [(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1, y + 8)))]
    return pieces


_left_labels = cut.left_labels


def left_labels(page, max_x, bold_only, with_x=False):
    """A scheme's labels without the translation tables' box numbers (see above)."""
    found = _left_labels(page, max_x, bold_only, True)
    if not bold_only:
        ls = lines(page)
        # AS Spanish June 2023 numbers one summary "8", not "08": a lone digit counts under a "Qu" header.
        for ly, lx, t, spans in ls:
            if lx < 90 and re.fullmatch(r"\d", t) and spans[0]["size"] >= 10 and not any(abs(y - ly) < 4 for y, *_ in found):
                found.append((ly, "0" + t, None, lx))
        # A label whose answer is a number just after it ("02.5" then "2015", AS Spanish November 2020) reads as one number: take the label's own span.
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                s0 = l["spans"][0]
                m = re.fullmatch(r"\s*(\d\d)\.(\d{1,2})\s*", s0["text"])
                if m and s0["bbox"][0] < 90 and s0["size"] >= 9 and not any(abs(y - s0["bbox"][1]) < 4 for y, *_ in found):
                    found.append((s0["bbox"][1], m.group(1), m.group(2), s0["bbox"][0]))
        found.sort()
        keep = []
        for y, q, p, x in found:
            if p is None:
                # Under its own header: the nearest "Qu" above it, with no other label in between
                # (a tall merged cell centres the number well below its header).
                header_y = max((ly for ly, lx, t, _ in ls if ly < y - 1 and lx < max_x + 40 and t in ("Qu", "Qu.", "Question")), default=None)
                header = header_y is not None and not any(header_y < oy < y - 1 for oy, *_ in found)
                heading = any(re.match(rf"^Question\s+0?{int(q)}\b(?!\.)", t) for ly, lx, t, _ in ls if y - 160 < ly < y + 2)
                boxed = sum(1 for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
                            if abs(s["bbox"][1] - y) < 4 and s["bbox"][0] < max_x + 70 and re.fullmatch(r"\s*\d\s*", s["text"])) >= 2
                if not (header or heading or boxed):
                    continue
            keep.append((y, q, p, x))
        found = keep
    return found if with_x else [f[:3] for f in found]


_skip_page = cut.skip_page


def skip_page(page, max_x, bold_only):
    # In a scheme, a row never runs on into the marking guidance; a page that has the guidance
    # and then a row (Spanish: the AO3 grid, then the summary under it) still has its row.
    return _skip_page(page, max_x, bold_only) or (not bold_only and bool(GUIDE.search(page.get_text())) and not left_labels(page, max_x, bold_only))


_row_start = cut.row_start


def row_start(page, y, floor=0):
    """At a "Question 04" / "Question 09.9 Guidance..." heading above the row, else at its "Qu" header's rule."""
    ls = lines(page)
    heads = [ly for ly, lx, t, _ in ls if floor + 2 < ly < y - 2 and HEADING.match(t) and lx < 120]
    if heads:
        return heads[0] - 6
    header = [ly for ly, lx, t, _ in ls if t in ("Qu", "Qu.") and max(floor + 2, y - 75) < ly < y - 1]
    if header:
        rules = sorted({round(d["rect"].y0) for d in page.get_drawings() if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})
        above = [r for r in rules if r <= header[-1] + 2 and r > floor]
        return (above[-1] if above else header[-1] - 8) - 1
    if not any(t in ("Qu", "Qu.", "Question") for _, _, t, _ in ls):
        # Paper 2's schemes are no table: a row starts at its boxed label, not at the rule
        # AQA draws under the essay above it (which cut that essay's scheme to its first line).
        return y - 8
    return _row_start(page, y, floor)


def grid_pieces(doc, match, before_page=None):
    """The crop of a grid printed apart from the rows: from its heading line to the page's foot,
    or to the first row under it (Spanish prints a summary's row under the AO3 grid)."""
    pages = range(len(doc)) if before_page is None else range(before_page, -1, -1)
    for n in pages:
        ls = lines(doc[n])
        for ly, lx, t, _ in ls:
            if match(t):
                f = cut.ms_frame(doc[n])
                foot = min([y for y, x, u, _ in ls if y > ly and u in ("Qu", "Qu.")], default=cut.frame(doc[n], False).y1 + 6) - 6
                return n, pymupdf.Rect(f.x0, ly - 6, f.x1, foot)
    return None


def essay_grids(doc):
    """The AO3 and AO4 grids an essay is marked by, from "Assessment criteria" (or "AO3") to the end of the AO4 page."""
    ao3 = grid_pieces(doc, lambda t: t in ("Assessment criteria", "AO3") or t.startswith("Assessment criteria"))
    ao4 = grid_pieces(doc, lambda t: t == "AO4")
    if not ao3:
        return []
    out = [ao3]
    if ao4 and ao4[0] != ao3[0]:
        f = cut.frame(doc[ao4[0]], False)
        out.append((ao4[0], pymupdf.Rect(ao4[1].x0, f.y0, ao4[1].x1, f.y1)))
    return out


_regions = cut.regions


def regions(doc, max_x, bold_only, portrait):
    out = _regions(doc, max_x, bold_only, portrait)
    if portrait:
        for r in out:
            if r[0][1] is not None or not any(o[0][0] == r[0][0] and o[0][1] for o in out):
                r[1] = end_at_marks(doc, r[1])
                r[2] = "\n".join(doc[pg].get_text("text", clip=rect) for pg, rect in r[1])
        return out
    for r in out:
        # A row run on to the next page stops at that page's "Section B" heading.
        for n, (pg, rect) in enumerate(r[1][1:], 1):
            head = [ly for ly, lx, t, _ in lines(doc[pg]) if rect.y0 <= ly < rect.y1 and re.match(r"^Section [A-C]\b", t)]
            if head:
                r[1] = r[1][:n] + ([(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, head[0] - 4))] if head[0] - 4 > rect.y0 + 24 else [])
                break
    essays = None
    for r in out:
        m = ESSAY_MARKS.findall(r[2])
        if m and max(int(x) for x in m) >= 20:
            essays = essay_grids(doc) if essays is None else essays
            r[1] = r[1] + essays
        elif re.search(r"Bullet( point)? \d", r[2]) and r[1]:
            grid = grid_pieces(doc, lambda t: bool(SUMMARY_GRID.match(t)), r[1][0][0])
            if grid:
                r[1] = r[1] + [grid]
    # AS Paper 2's translation is five sentences, each marked by ticks through one conversion grid
    # printed after the last: every sentence gets it.
    conv = grid_pieces(doc, lambda t: t == "Conversion grid")
    sentences = [r for r in out if r[0][0] == "01" and r[0][1] and "Possible answer" in doc[r[1][0][0]].get_text()] if conv else []
    gpage, grect = conv if conv else (None, None)
    if conv and len(sentences) > 1 and all((pg, rect.y0) < (gpage, grect.y0) for r in sentences for pg, rect in r[1][:1]):
        for r in sentences:
            # Up to the grid (November 2020 prints it on the page with the last two sentences), then the grid.
            kept = [(pg, rect if pg < gpage else pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1, grect.y0)))
                    for pg, rect in r[1] if (pg, rect.y0) < (gpage, grect.y0)]
            r[1] = [(pg, rect) for pg, rect in kept if rect.height > 8] + [conv]
    return out


REPORT_HEAD = re.compile(
    # "Question 01", "Question 1.1.", "Question 9.1 - 9.8", on a line of its own
    r"(?m)^[ \t]*Question\s+0?(?P<q>\d{1,2})(?:\s*\.\s*(?P<p>\d{1,2}))?\.?(?P<range>\s*[-–]\s*\d+(?:\.\d+)?)?\s*:?[ \t]*$"
    # "1.1 Students dealt well...", "Question 2.1 seemed to present...": a part's comment, from its first words
    r"|^[ \t]*(?:Question\s+)?0?(?P<q2>\d{1,2})\.(?P<p2>\d)\.?[ \t]+(?=[A-Za-z(])"
    # "Question 1 La casa de Bernarda Alba": a work's heading
    r"|^[ \t]*Question\s+0?(?P<q3>\d{1,2})[ \t]+(?=[A-ZÁÉÍÓÚ«‘'\"])[^\n]{1,70}$")
REPORT_NOISE = re.compile(r"(?m)^\s*(REPORT ON THE EXAMINATION.*|.*© ?\d{4} AQA.*|\d+ of \d+|Version:?\s*[\d.]+.*|Section [A-C]\b.*|General [Cc]omments:?)\s*$")
REPORT_END = re.compile(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance|Enhanced Results Analysis)\b")


def examiner_report(path):
    """{question: its comments}. Paper 1's reports head a question ("Question 01", "Question 9.1 - 9.8",
    "Question 9.9"); Paper 2's head each work ("Question 1 La casa de Bernarda Alba") or essay
    ("Question 1.1.") or start an essay's paragraph with it ("1.1 Students dealt well...").
    A part's comment is kept under a "Question 01.1" line, which the page shows as that part's own."""
    if not path or not os.path.exists(path):
        return {}
    text = REPORT_END.split(REPORT_NOISE.sub("", "\n".join(p.get_text() for p in pymupdf.open(path))))[0]
    heads = list(REPORT_HEAD.finditer(text))
    out = {}
    for n, m in enumerate(heads):
        q = f"{int(m.group('q') or m.group('q2') or m.group('q3')):02d}"
        part = m.group("p") or m.group("p2")
        ranged = m.group("range")
        # An inline label ("2.1 was the more popular...") stays part of its sentence.
        body = text[m.start() if m.group("q2") else m.end():heads[n + 1].start() if n + 1 < len(heads) else len(text)]
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", re.sub(r" {2,}", " ", body))
        if not body:
            continue
        chunk = f"Question {q}.{int(part)}\n\n{body}" if part and not ranged else body
        out[q] = f"{out[q]}\n\n{chunk}" if q in out else chunk
    if len(out) < 3:
        out = {**by_work(path, text), **out}
    return out


def by_work(path, text):
    """A Paper 2 report headed only by each work's title ("Molière: Le Tartuffe", June 2022): each
    comment goes to the question the paper sets on that work."""
    from spec_languages import WORKS  # noqa: PLC0415
    # AS Paper 2 sets its essays in the insert.
    papers = [p for p in (path.replace("-ER-", "-QP-"), path.replace("-ER-", "-INS-")) if os.path.exists(p)]
    printed = "\n".join(pg.get_text() for paper in papers for pg in pymupdf.open(paper))
    works = [re.compile(rx) for lang in WORKS.values() for _, _, items in lang for _, _, rx in items]
    number = {}
    for m in re.finditer(r"(?m)^\s*0?\s*(\d)\s*(\d)?\s*\n\s*([^\n]{3,90})\n", printed):
        for rx in works:
            if rx.search(m.group(3)) and rx.pattern not in number:
                number[rx.pattern] = f"{int(m.group(1) + (m.group(2) or '')):02d}"
    heads = []
    for m in re.finditer(r"(?m)^[ \t]*([^\n]{3,90}?)[ \t]*$", text):
        hit = next((rx for rx in works if rx.search(m.group(1)) and rx.pattern in number), None)
        if hit and len(m.group(1)) < 90 and not m.group(1).rstrip().endswith("."):
            heads.append((number[hit.pattern], m.start(), m.end()))
    out = {}
    for n, (q, start, end) in enumerate(heads):
        body = text[end:heads[n + 1][1] if n + 1 < len(heads) else len(text)]
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", re.sub(r"[ \t]+\n", "\n", body)).strip()
        body = re.sub(r"\n{2,}", "\n\n", re.sub(r" {2,}", " ", body))
        if body and q not in out:
            out[q] = body
    return out


_cut_set = cut.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    ins = qp_path.replace("-QP-", "-INS-")
    # AS Paper 2: Section A (the translation) is in the paper, the essays in the insert.
    if meta["component"] in ("76512", "76912") and os.path.exists(ins):
        have = {p["id"] for p in parts}
        parts += [p for p in _cut_set(ins, ms_path, er_path, set_id, meta) if p["id"] not in have]
    return parts


cut.examiner_report = examiner_report
cut.left_labels = left_labels
cut.skip_page = skip_page
cut.row_start = row_start
cut.regions = regions
cut.cut_set = cut_set

if __name__ == "__main__":
    cut.main()
