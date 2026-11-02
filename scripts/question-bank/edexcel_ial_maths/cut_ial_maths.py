"""Cut Pearson Edexcel's International A Level Maths and Further Maths unit papers into questions.

    python3 scripts/question-bank/edexcel_ial_maths/cut_ial_maths.py [--only=wma11-jun19]
    # work dir: scripts/question-bank/.work/edexcel-ial-maths (fetch_ial_maths.py)

The units are set like the UK A-Level's papers, so the question is the unit, as there: a question starts at its
bold "2." and ends where its answer space begins (cut_edexcel.py's qp_regions, which keeps the cover and its
"You must have" lines out of Question 1), with its marks off "(Total for Question 2 is 6 marks)" or, before 2020,
"(Total 6 marks)". Its scheme starts where the shared Pearson reader (edexcel_sciences/cut_pearson.py's ms_tables,
with carried()) finds its label's row, and runs to the next question's, over every page between.

What IAL needs besides (none of it a fork: the readers see the papers through proxies, or their results are settled):
  - the 2019 papers keep a "Leave blank" column down the right, as the UK's legacy modules did: those take
    cut_edexcel.py's legacy frame, the rest its current one;
  - Decision 1 bind the D1 answer book in after the questions, numbered 1 to 8 again: a question stops at the
    answer book's cover (QuestionBook);
  - a question crop's edges settle on rows with no ink (qp_regions): a matrix can stand taller than its label;
  - the schemes number, head and lay out their tables their own ways (SchemeLines), run notes and pictures on
    below them (ms_page_box, SchemeLines.figures), and the reader's pieces of a question are laid out again as one
    run (scheme).
check_ial_maths.py checks the result for crops cut through ink, short schemes and front matter.
Writes <work-dir>/img/<id>-qp.webp and -ms.webp and <work-dir>/parts.json in cut_edexcel.py's shape, ids
"wma11-jun19-01", "wfm02-jun25a-07" for the 01A paper of June 2025.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
QB = os.path.abspath(os.path.join(HERE, ".."))
WORK = os.path.join(QB, ".work", "edexcel-ial-maths")
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
sys.path[:0] = [QB, os.path.join(QB, "edexcel_sciences")]
argv = sys.argv
sys.argv = [argv[0], WORK]  # both cutters read their work dir off argv at import
import cut_edexcel  # noqa: E402
import cut_pearson  # noqa: E402

sys.argv = argv
pymupdf, cut = cut_edexcel.pymupdf, cut_edexcel.cut
cut_pearson.IMG = cut.IMG = os.path.join(WORK, "img")
os.makedirs(cut.IMG, exist_ok=True)
ANSWER_BOOK = re.compile(r"Answer Book|D1 Answer|Do not return the question paper with the answer book", re.I)


class QuestionBook:
    """A paper as qp_regions reads it: the pages before an answer book bound in at the back (Decision 1)."""

    def __init__(self, doc):
        self.doc = doc
        self.end = next((i for i in range(2, len(doc)) if ANSWER_BOOK.search(doc[i].get_text()[:400])
                         and re.search(r"Candidate surname|Centre Number", doc[i].get_text())), len(doc))

    def __len__(self):
        return self.end

    def __getitem__(self, i):
        if i >= self.end:
            raise IndexError(i)
        return self.doc[i]

    def __iter__(self):
        return (self.doc[i] for i in range(self.end))


# A line that opens on a number, as a label or the working's "10 2".
LABEL = re.compile(r"^\*?(\d{1,2})\s*\.?\s*(?=\(|[a-z]?\s*$|\s)")
# The Question column's heading as the IAL schemes print it besides "Question": "QUESTION" over "NUMBER" (Mechanics),
# "Qu" (Statistics), "Q" (Mechanics 2, June 2022), "Questio" wrapped over "n" (Pure 1, October 2021); told from a
# point Q by the column headings beside it.
HEADING = re.compile(r"Q(u(e(s(t(i(o(n)?)?)?)?)?)?)?( Number)?", re.I)
BESIDE = re.compile(r"Scheme|Solution|Marks?|Mark Guidance|Answer|Notes", re.I)
# A question's label as printed: "4.", "1.(a)", "2 .(a)", "10 (a)", "1a", "7ai", "8" alone; not "3 5", "6.33", "2x" or "10 2".
PART = r"[a-h](?:i{1,3}|iv|vi{0,3})?(?=[\s().]|$)"  # (a space, a bracket or the end after it: "9e−0.75t" is working)
QUESTION = re.compile(rf"^\*?(\d{{1,2}})(?=\s*\.(?!\d)|\s*\(|{PART}|\s*$|\s+cont)\s*\.?")


class SchemeLines:
    """An IAL scheme as ms_tables reads it, for whole questions: its question numbers are the only labels.
    Pearson numbers these "1.(a)", "2.(a) (i)", "4.", "1a", "1 (a)", which the reader doesn't take for labels (the
    dot), sets few of them in bold, and places them anywhere across a wide Question column (48pt to 89pt in on one
    Statistics 1 scheme), with numbers of the working just right of it. So a label is told by its order and its
    shape, as the IGCSE maths cutter's SchemeLines tells 4MA1's:
      - the paper's next question, first on its row (nothing to its left), and printed as a label: a number with
        a dot, a part, a bracket or nothing after it, not a word: "1. The total number of marks…" and "2. Formula"
        are the marking guidance, which numbers its paragraphs too;
      - left of the scheme's usual label column (the middle of where its dotted and lettered labels sit), however
        far (Decision 1, June 2025, sets "3. (i)(a)" 50pt left of the rest), or under 35pt right of it; or, a bare
        number ("5"), within 16pt of it or of the label before, and only where no "5(a)" follows before the next
        question: "2 (0.05)" and a "3" of the working are not labels.
    A label reads as its number alone, bold, at its page's header, where the reader looks (its parts' rows are the
    question's either way, and "2a Use of (" set as one line is no label to the reader); any other
    line of the Question column that opens on a number ("10 2" carried down from the row above, a question's number
    printed again over its alternative method) or is a part's label is moved out of the column. The parts go because
    each question's Notes repeat them ("(a) M1: …" under the rows of (a) and (b)), and the reader keeps a label's
    first rows only: Decision 1, January 2021, lost Question 4's last page of notes that way. A heading the reader doesn't know
    (HEADING) reads "Question"."""

    def __init__(self, doc, questions):
        self.doc, self._lines, self.starts, self.first = doc, {}, set(), None
        cands = []  # (page, line, number, printed with a dot or a part)
        for i in range(len(doc)):
            lines = doc.lines(i)
            for l in lines:
                m = QUESTION.match(l["text"])
                if not m or l["x0"] > 140:
                    continue
                rest = l["text"][m.end():].strip()
                if re.match(r"(?!cont)[A-Za-z]{3,}", rest):
                    continue
                if any(o is not l and abs(o["y0"] - l["y0"]) < 3 and o["x1"] <= l["x0"] + 1 for o in lines):
                    continue
                cands.append((i, l, int(m.group(1)), bool(rest) or m.group(0).endswith(".")))
        xs = sorted(l["x0"] for _, l, _, strong in cands if strong)
        col = xs[len(xs) // 2] if xs else None
        want, q, last = [int(x) for x in questions], 0, None
        near = lambda l, strong: l["x0"] - col < 35 if strong else abs(l["x0"] - col) < 16 or (last is not None and abs(l["x0"] - last) < 16)  # noqa: E731
        for k, (i, l, n, strong) in enumerate(cands):
            if q >= len(want) or n != want[q] or col is None:
                continue
            if not strong:
                # (a bare "4" gives way to a "4(a)" printed before the next question: Further Pure 3, January 2025,
                # has a "4" in Question 3's notes)
                later = next((x for x in cands[k + 1:] if x[3] and near(x[1], True) and x[2] in want[q:q + 2]), None)
                if later and later[2] == n:
                    continue
            if near(l, strong):
                q, last = q + 1, l["x0"]
                self.starts.add((i, id(l)))
                self.first = self.first or (i, id(l))
        heads = sorted(h["x0"] for i in range(len(doc)) for h in doc.lines(i) if self.is_head(h, doc.lines(i)))
        self.typical = heads[len(heads) // 2] if heads else col

    @staticmethod
    def is_head(l, lines):
        return cut_pearson.is_head(l, lines) or bool(HEADING.fullmatch(l["text"])) and l["x0"] < 130 and l["y0"] < 160 \
            and any(o["x0"] > l["x1"] and abs(o["y0"] - l["y0"]) < 20 and BESIDE.match(o["text"]) for o in lines)

    def row_top(self, i, l):
        """Where a label's table row starts: the nearest rule above it that crosses the Question column. Decision 1
        centres its labels down tall rows (a network drawn beside "2. (a)"), so the row, and its rows' crop, starts
        well above the label, further than the reader looks for a rule; a top-aligned label's rule is just above it."""
        page = self.doc[i]
        ys = [y for d in cut_pearson.drawings(page) for r in [d["rect"] * page.rotation_matrix]
              if r.width > 40 and r.x0 <= l["x0"] + 2 and r.x1 >= l["x1"] - 2 for y in (r.y0, r.y1) if y <= l["y0"] + 1]
        top = max(ys) if ys else None
        # (only up an empty cell: with the notes of the question before above it in the column, the rule over them is
        # another table's, and Pure 3, June 2022, Question 9 took Question 8's notes)
        if top is not None and any(o is not l and top + 1 < o["y0"] and o["y1"] < l["y0"] - 1 and o["x0"] < l["x1"] + 5
                                   and o["x1"] > l["x0"] - 5 for o in self.doc.lines(i)):
            return None
        return top

    def __getattr__(self, name):
        return getattr(self.doc, name)

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def lines(self, i):
        if i not in self._lines:
            out, raw = [], self.doc.lines(i)
            heads = [h for h in raw if self.is_head(h, raw)]
            for l in raw:
                m = QUESTION.match(l["text"])
                if any(l is h for h in heads) and not cut_pearson.is_head(l, raw):
                    out.append({**l, "text": "Question", "spans": [{**l["spans"][0], "text": "Question"}]})
                elif (i, id(l)) in self.starts:
                    text, raw_l = m.group(1), l
                    top = self.row_top(i, l)
                    if top is not None and l["y0"] - 300 < top < l["y0"] - 4:
                        l = {**l, "y0": top + 1, "y1": top + 1 + l["y1"] - l["y0"]}
                    above = [h for h in heads if h["y0"] <= l["y0"]]
                    x = above[-1]["x0"] if above else heads[0]["x0"] if heads else self.typical
                    if self.first == (i, id(raw_l)) and not above:
                        # (no heading over the first question: Mechanics 1, June 2025, heads its table from page 2)
                        out.append({**l, "x0": x, "x1": x + 40, "y0": l["y0"] - 2, "text": "Question",
                                    "spans": [{**l["spans"][0], "text": "Question"}]})
                    out.append({**l, "x0": x, "x1": x + 6 * len(text), "text": text,
                                "spans": [{**l["spans"][0], "text": text, "font": "Label-Bold", "flags": 16}]})
                elif l["x0"] < 200 and (LABEL.match(l["text"]) or l["text"].startswith("(")
                                        or len(l["text"]) <= 16 and cut_pearson.MS_LABEL.match(l["text"])):
                    out.append({**l, "x0": 200})
                else:
                    out.append(l)
            self._lines[i] = sorted(out + self.figures(i), key=lambda l: (round(l["y0"]), l["x0"]))
        return self._lines[i]

    def figures(self, i):
        """A "[figure]" line over each picture and drawn diagram (a path with curves or slants; not the table's
        rules and boxes), out of the Question column: the reader takes a page with no text for an empty one, and
        its box ends at the text, so a sector diagram pictured under its notes (Pure 1, January 2020, Question 4)
        lost its foot, and a page of pictured working (Question 6's overleaf) was left out."""
        page = self.doc[i]
        m, w, h = page.rotation_matrix, page.rect.width, page.rect.height
        rects = [pymupdf.Rect(b) * m for img in page.get_images() for b in page.get_image_rects(img[0])]
        for d in cut_pearson.drawings(page):
            if any(it[0] == "c" or it[0] == "l" and abs(it[1].x - it[2].x) > 1 and abs(it[1].y - it[2].y) > 1 for it in d["items"]):
                rects.append(d["rect"] * m)
        spans = []  # the figures' heights, merged where they overlap
        for r in sorted((r for r in rects if r.width > 3 and r.height > 3 and r.height < h * 0.8), key=lambda r: r.y0):
            if spans and r.y0 <= spans[-1].y1:
                spans[-1] |= r
            else:
                spans.append(pymupdf.Rect(r))
        return [{"x0": max(r.x0, 200), "y0": r.y0, "x1": max(r.x1, 201), "y1": r.y1, "text": "[figure]",
                 "spans": [{"text": "[figure]", "font": "Figure", "flags": 0, "bbox": tuple(r)}]} for r in spans]

    def text(self, i, rect=None):
        return "\n".join(l["text"] for l in self.lines(i) if rect is None or cut_pearson.inside(l, rect))


def blank_row(page, r, y, step, reach=None):
    """The first row from `y`, going `step` (up -1, down +1), with no ink across the crop's width, within `reach`
    (40pt up or 8pt down); a vertical rule (dark in every row looked at) aside."""
    reach = reach or (40 if step < 0 else 8)
    # (10pt in from each side: the frame's own sides, white above its top, would read as ink)
    band = pymupdf.Rect(r.x0 + 10, y - reach, r.x1 - 10, y + 0.5) if step < 0 else pymupdf.Rect(r.x0 + 10, y - 0.5, r.x1 - 10, y + reach)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=band, colorspace=pymupdf.csGRAY)
    rows = [pix.samples[k * pix.stride:k * pix.stride + pix.width] for k in range(pix.height)]
    rule = {x for x in range(pix.width) if all(row[x] < 200 for row in rows)}
    ink = [any(v < 200 for x, v in enumerate(row) if x not in rule) for row in rows]
    order = range(len(rows) - 1, -1, -1) if step < 0 else range(len(rows))
    for k in order:
        if not ink[k]:
            return band.y0 + k / 2
    return None


def qp_regions(qp, legacy):
    """cut_edexcel.py's regions, each edge settled on a row with no ink. A question can open on a matrix taller than
    its label (Further Pure 1, January 2022, Question 5's P sits 25pt above its "5."): its top goes up to the first
    clear row, and the question above ends there. And a question's marks, "(6)", can sit 4pt over the answer line
    the crop stops 4pt above: its foot goes down to the first clear row, within 8pt."""
    regions = cut_edexcel.qp_regions(qp, legacy)
    out = [(q, [(pg, pymupdf.Rect(r)) for pg, r in pieces], text) for q, pieces, text in regions]
    for n, (q, pieces, _) in enumerate(out):
        if pieces:
            pg, r = pieces[0]
            top = blank_row(qp[pg], r, r.y0, -1)
            if top is not None and top < r.y0:
                r.y0 = top
                if n and out[n - 1][1] and out[n - 1][1][-1][0] == pg:
                    above = out[n - 1][1][-1][1]
                    above.y1 = min(above.y1, top)
    for n, (q, pieces, _) in enumerate(out):
        for k, (pg, r) in enumerate(pieces):
            foot = blank_row(qp[pg], r, r.y1, 1)
            nxt = out[n + 1][1][0] if n + 1 < len(out) and out[n + 1][1] and k == len(pieces) - 1 else None
            if foot is not None and foot > r.y1 and not (nxt and nxt[0] == pg and foot > nxt[1].y0):
                r.y1 = foot
    return out


_ms_page_box = cut_pearson.ms_page_box
# A scheme page's foot: the unit's code ("WDM11_01"), a four-figure code, a page number (or two, "1 10"); and the
# company notice on the last page.
FOOTER = re.compile(r"W[A-Z]{2}\d\d_\d\d|[\d ]{1,9}")
COMPANY = re.compile(r"Pearson Education Limited|Registered company number|registered office", re.I)


def ms_page_box(doc, p):
    """cut_pearson.py's box, out to every line of text on the page: IAL schemes run their notes on under the table
    ("Additional Note", "Eg. 420 = …"), and the reader's box ended at the lowest drawn line, a fraction bar among
    them, so a crop stopped halfway down a fraction and lost the notes under it. Pearson sets notes as close as 13pt
    to a page's edges; the foot (FOOTER, the bottom 64pt) stays out."""
    box = _ms_page_box(doc, p)
    h = doc[p].rect.height
    lines = doc.lines(p)
    notice = min([l["y0"] for l in lines if l["y0"] > h / 2 and COMPANY.search(l["text"])], default=h)
    body = [l for l in lines if 2 < l["y0"] and l["y1"] < min(h - 2, notice) and not (l["y0"] > h - 64 and FOOTER.fullmatch(l["text"]))]
    if not body:
        return box
    return pymupdf.Rect(min(box.x0, min(l["x0"] for l in body) - 2), max(2, min(box.y0, min(l["y0"] for l in body) - 3)),
                        max(box.x1, max(l["x1"] for l in body) + 2), min(notice - 3, max(box.y1, min(h - 2, max(l["y1"] for l in body) + 3))))


cut_pearson.ms_page_box = ms_page_box


def scheme(ms_path, questions):
    """{"03": (pieces, text)}: every row of a question, page by page. The reader finds where each question's rows
    start (its label's row, under its table's heading); from there they run to where the next question's start, over
    every page between (blank ones aside), as cut_edexcel.py's ms_regions runs them. The reader's own pieces would
    split a question wherever it takes a stray letter for a part ("b B1 …", "k …" in the notes), leaving a sliver
    out between two pieces and, once (Pure 4, January 2024, Question 6), the rest of the question's notes."""
    doc = cut_pearson.Doc(ms_path)
    sl = SchemeLines(doc, questions)
    found = cut_pearson.ms_tables(sl)
    first, last = {}, {}
    for k, (pieces, _, _) in found.items():
        if pieces:
            q, a, b = f"{k[0]:02d}", (pieces[0][0], pieces[0][1].y0), (pieces[-1][0], pieces[-1][1].y1)
            first[q], last[q] = min(first.get(q, a), a), max(last.get(q, b), b)
    order = sorted(first, key=first.get)
    whole = {}
    for n, q in enumerate(order):
        (pg, y), end = first[q], first[order[n + 1]] if n + 1 < len(order) else last[q]
        pieces = []
        while pg <= end[0]:
            box = ms_page_box(sl, pg)
            r = pymupdf.Rect(box.x0, y if pg == first[q][0] else box.y0, box.x1, min(box.y1, end[1]) if pg == end[0] else box.y1)
            words = sl.text(pg, r).replace("[figure]", "figure").strip()
            if r.height > 6 and words and not FOOTER.fullmatch(words):
                pieces.append((pg, r))
            pg += 1
        whole[q] = (pieces, re.sub(r"\s+", " ", " ".join(sl.text(p, r) for p, r in pieces)).replace("[figure]", " "))
    # Each edge on a row with no ink, as the questions' (qp_regions): a fraction's numerator can stand above its row's
    # rule, and a denominator hang below its line's box at a page's foot (Pure 1, October 2022, Question 8).
    for n, q in enumerate(order):
        pieces = whole[q][0]
        for k, (pg, r) in enumerate(pieces):
            if k == 0:
                top = blank_row(doc[pg], r, r.y0, -1, 14)
                if top is not None and top < r.y0:
                    r.y0 = top
                    above = whole[order[n - 1]][0] if n else []
                    if above and above[-1][0] == pg:
                        above[-1][1].y1 = min(above[-1][1].y1, top)
            nxt = whole[order[n + 1]][0][0] if n + 1 < len(order) and whole[order[n + 1]][0] else None
            if not (k == len(pieces) - 1 and nxt and nxt[0] == pg):
                foot = blank_row(doc[pg], r, r.y1, 1)
                if foot is not None and foot > r.y1:
                    r.y1 = min(foot, doc[pg].rect.height - 1)
    return doc, whole


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = QuestionBook(cut_edexcel.open_upright(qp_path))
    legacy = any("Leave" in qp[i].get_text() and "blank" in qp[i].get_text() for i in range(1, min(4, len(qp))))
    regions = qp_regions(qp, legacy)
    marks = cut_edexcel.qp_marks(qp, [(pieces[0][0], pieces[0][1].y0 + 6, q) for q, pieces, _ in regions if pieces])
    ms_doc, ms = scheme(ms_path, [q for q, _, _ in regions]) if ms_path and os.path.exists(ms_path) else (None, {})
    er = cut.examiner_report(er_path)
    parts = []
    # (Mechanics 2, June 2023, totals "(Total for Question 1 = 7 marks)"; Further Pure 1, June 2024, sets the bracket
    # apart from the words, which cut_edexcel.py reads span by span)
    printed = {f"{int(n):02d}": int(m) for n, m in re.findall(r"Total for Question (\d+) (?:is|=) (\d+) marks?", " ".join(p.get_text() for p in qp))}
    marks = {**printed, **marks}
    for q, pieces, text in regions:
        if not pieces:
            continue
        pid = f"{set_id}-{q}"
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[p], r)) for p, r in pieces])
        msimg, ms_text = None, ""
        if ms.get(q) and ms[q][0]:
            mpieces, ms_text = ms[q]
            msimg = cut_pearson.stack([cut_pearson.trim(ms_doc.crop(p, r), 10, sides=True) for p, r in mpieces])
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": str(int(q)),
            "marks": marks.get(q),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "msPieces": [[p, [round(v, 1) for v in r]] for p, r in ms.get(q, ([], ""))[0]],
            "er": er.get(q),
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception as e:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], f"{type(e).__name__}: {e}\n{traceback.format_exc(limit=4)}"


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" in files and (not ONLY or set_id.startswith(ONLY)):
            jobs.append((set_id, files, {"component": comp, "spec": comp, "series": series, "paperTitle": files["qp"].get("title", "")}))
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            total = sum(p["marks"] or 0 for p in parts)
            print(f"{set_id}: {len(parts)} questions, {total} marks, {no_ms} without scheme", file=sys.stderr, flush=True)
            if not parts or no_ms or total != 75 or any(p["marks"] is None for p in parts):
                problems.append(f"{set_id}: {len(parts)} questions, {total} marks, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
