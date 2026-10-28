"""Cut AQA's Economics papers into questions, each with its mark scheme, its extracts and its report.

    python3 scripts/question-bank/aqa_economics/cut_economics.py [work-dir] [--only=71361]   # default scripts/question-bank/.work/aqa-economics

cut.py's label finder and image helpers, with Economics' own layout around them:
  - The papers are choices. A-Level Papers 1 and 2: Section A is EITHER Context 1
    (questions 01-04) OR Context 2 (05-08), each set on two or three pages of
    extracts printed before its questions; Section B is one essay of three, each a
    short passage and two questions (09-10, 11-12, 13-14). AS Papers 1 and 2:
    Section A is 20 multiple-choice questions, Section B EITHER Context 1 (21-26)
    OR Context 2 (27-32), whose extracts are in the insert. Paper 3: 30
    multiple-choice questions, then an investigation (31-33) on the insert's extracts.
  - So a question's id names its group: "71361-jun24-c1-01", "-e2-11", "-a-05"
    (multiple choice), "-b-31" (the investigation). The group's extracts, or its
    essay's passage, are its stem ("71361-jun24-c1-stem.webp", which the site finds
    by dropping the id's last part): from the "Context 1" heading to the first
    question, or the insert's pages for that context.
  - A question ends at its marks ("[25 marks]"): the answer lines or answer book
    pages after it add nothing. Multiple choice runs to the next label, so the
    options stay with it. A heading ("OR", "Context 2", "Essay 3", "Section B",
    "END OF QUESTIONS") ends a question too.
  - The schemes are not tables: each question is its label and words, then its
    guidance, ending "MAXIMUM FOR QUESTION 04: 25 MARKS". The 15- and 25-mark
    questions mostly share a levels-of-response grid printed once per section
    ("Use the level mark scheme on page 4"): that grid is cut once and stacked
    under each question that uses it, so no scheme is shown without its levels.
  - Multiple-choice answers come from the scheme's KEY LIST, a grid of numbers each
    with its letter (and, from 2021, the answer's words under it).
  - Examiner's reports head each question "Question 4"; they are keyed by question id.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-economics")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks

# Lines that end a question in the paper: the either/or, a new context, essay or section.
QP_STOP = re.compile(r"^(EITHER|OR|Context [1-9]\b|Essay [1-9]\b|Section [AB]\b|SECTION [AB]\b|Do NOT answer|END\s+OF\s+QUESTIONS|Turn over for|There are no questions)")
GROUP = re.compile(r"^(?:Context ([1-9])\b|Essay ([1-9])\b|Section ([AB])\b|SECTION ([AB])\b)")
MS_STOP = re.compile(r"^(Section [AB]\b|SECTION [AB]\b|Context [1-9]\b|Essay [1-9]\b|INVESTIGATION|Below is|The levels? of response (marking )?grid|Level of response marking instructions)")
GRID = re.compile(r"^(Below is the levels?|The levels? of response (marking )?grid)", re.I)
MAXIMUM = re.compile(r"^MAXIMUM FOR QUESTION", re.I)
MARKS = re.compile(r"\[(\d+) marks?\]")


def lines_of(page, rect=None):
    """[(y0, x0, y1, text)] top to bottom: cut.text_lines with each line's foot."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"] if rect else page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t:
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t))
    return sorted(out)


def frame(page):
    """A paper or insert page's content: below the page number, above "Turn over" and the footer, left of the box margin."""
    w, h = page.rect.width, page.rect.height
    top, bottom, right = 55, h - 46, w - 44
    for y0, x0, y1, t in lines_of(page):
        if y0 > h - 60 or t.startswith("Turn over") or re.fullmatch(r"\*\d+\*", t):
            bottom = min(bottom, y0 - 4)
        if t.startswith("Do not write"):
            right = min(right, x0 - 3)
    left = 38
    # Inside the answer box's border, where a page draws one, so trailing white space can be trimmed.
    sides = [d["rect"] for d in page.get_drawings() if d["rect"].width < 3 and d["rect"].height > 300]
    if any(r.x0 < 60 for r in sides) and any(r.x0 > w / 2 for r in sides):
        left = max(r.x1 for r in sides if r.x0 < 60) + 1
        right = min(right, min(r.x0 for r in sides if r.x0 > w / 2) - 0.3)
        bottom = min(bottom, max(r.y1 for r in sides) - 1.5)
    return pymupdf.Rect(left, top, right, bottom)


def ms_frame(page):
    """A scheme page's content: under the running header ("MARK SCHEME – A-LEVEL ECONOMICS – …"), above the page number."""
    w, h = page.rect.width, page.rect.height
    lines = lines_of(page)
    head = [y1 for y0, x0, y1, t in lines if y0 < 60]
    foot = [y0 for y0, x0, y1, t in lines if y0 > h - 60]
    top, bottom = max(head) + 3 if head else 52, min(foot) - 3 if foot else h - 46
    # The header and footer rules, drawn out to the page's edge.
    for d in page.get_drawings():
        r = d["rect"]
        if r.height < 3 and r.width > 300 and r.x1 > w - 5:
            top = max(top, r.y1 + 2) if r.y0 < 90 else top
            bottom = min(bottom, r.y0 - 2) if r.y0 > h - 90 else bottom
    return pymupdf.Rect(36, top, w - 34, bottom)


def has_words(page, rect):
    return bool(re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=rect)))


def span(doc, start, end, framer):
    """Pieces from (page, y) down to (page, y), page by page inside the frame. Pieces with no words are dropped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        f = framer(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        if bottom > top + 8:
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if has_words(doc[pg], r):
                pieces.append((pg, r))
    return pieces


def walk(doc, labels_of, stop):
    """Every label and every stop line in reading order: [(page, y0, y1, kind, value)]."""
    events = []
    for pg, page in enumerate(doc):
        f = frame(page)
        for y, q, part, x in labels_of(page):
            events.append((pg, y, y, "label", q))
        for y0, x0, y1, t in lines_of(page):
            if f.y0 - 10 <= y0 <= f.y1 + 4:
                if stop.match(t):
                    events.append((pg, y0, y1, "stop", t))
                if MAXIMUM.match(t) or MARKS.search(t):
                    events.append((pg, y0, y1, "end", t))
    return sorted(set(events), key=lambda e: (e[0], e[1], e[3] != "stop"))


def qp_questions(doc):
    """[(q, group, pieces, text, marks)] in order, and each group's first label position."""
    labels = lambda page: cut.left_labels(page, 75, True, with_x=True)  # noqa: E731
    events = walk(doc, labels, QP_STOP)
    out, group, firsts = [], "a", {}
    for n, (pg, y, _, kind, value) in enumerate(events):
        if kind == "stop":
            m = GROUP.match(value)
            if m:
                group = ("c" + m.group(1)) if m.group(1) else ("e" + m.group(2)) if m.group(2) else (m.group(3) or m.group(4)).lower()
            continue
        if kind != "label":
            continue
        firsts.setdefault(group, (pg, y))
        # It ends at the next label or heading, or under its marks once it has printed them (not multiple choice).
        end = (len(doc) - 1, doc[-1].rect.height)
        for pg2, y2, y2b, kind2, value2 in events[n + 1:]:
            if kind2 in ("label", "stop"):
                end = (pg2, y2 - 6)
                break
            if kind2 == "end" and MARKS.search(value2) and int(MARKS.search(value2).group(1)) > 1:
                end = (pg2, y2b + 5)
                break
        pieces = span(doc, (pg, y - 6), end, frame)
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        marks = [int(x) for x in MARKS.findall(text)]
        out.append((value, group, pieces, text, sum(marks) if marks else None))
    return out, firsts, events


def qp_stems(doc, ins, firsts, events):
    """{group: [(doc, page, rect)]}: a context's extracts, an essay's passage, the investigation's scenario and insert."""
    stems = {}
    for pg, y, _, kind, value in events:
        m = GROUP.match(value) if kind == "stop" else None
        if not m or m.group(3) == "A" or m.group(4) == "A":
            continue
        group = ("c" + m.group(1)) if m.group(1) else ("e" + m.group(2)) if m.group(2) else "b"
        if group not in firsts or (pg, y) > firsts[group] or group in stems:
            continue
        own = span(doc, (pg, y - 4), (firsts[group][0], firsts[group][1] - 6), frame)
        pieces = [(doc, p, r) for p, r in own]
        if ins is not None and group.startswith("c"):
            pieces = insert_context(ins, group[1:])  # AS: the extracts are in the insert; the paper's own lines only point to it
        elif ins is not None and group == "b":
            pieces += insert_extracts(ins)
        if pieces:
            stems[group] = pieces
    return stems


def insert_context(ins, n):
    """An AS insert's pages for Context n: from its "Context n" heading to the page that lists its questions."""
    pieces, on = [], False
    for pg, page in enumerate(ins):
        f = frame(page)
        lines = lines_of(page, f)
        start = next((y0 for y0, x0, y1, t in lines if re.match(rf"^Context {n}\b(?!\s*[–-]\s*Questions)", t)), None)
        if start is not None and not on:
            on = True
            f = pymupdf.Rect(f.x0, start - 4, f.x1, f.y1)
        elif not on:
            continue
        stop = next((y0 for y0, x0, y1, t in lines if y0 > f.y0 + 8 and re.match(r"^(Context [1-9]\b|There are no extracts|Turn over for)", t)), None)
        if stop is not None:
            f = pymupdf.Rect(f.x0, f.y0, f.x1, stop - 6)
        if f.height > 8 and has_words(page, f):
            pieces.append((ins, pg, f))
        if stop is not None:
            break
    return pieces


def insert_extracts(ins):
    """Paper 3's insert: every page from Extract A on, leaving out the cover, the blank pages and the copyright notice."""
    pieces, on = [], False
    for pg, page in enumerate(ins):
        text = page.get_text()
        on = on or bool(re.search(r"^\s*Extract A\b", text, re.M))
        if on and not re.search(r"There are no (sources|extracts) printed", text):
            f = frame(page)
            notice = next((y0 for y0, x0, y1, t in lines_of(page, f) if t.startswith("Copyright information")), None)
            if notice is not None:
                f = pymupdf.Rect(f.x0, f.y0, f.x1, notice - 6)
            if f.height > 8 and has_words(page, f):
                pieces.append((ins, pg, f))
    return pieces


def ms_parts(ms, wanted):
    """{q: (pieces, text)}: each question's own scheme, from its label to its "MAXIMUM FOR QUESTION" line."""
    def labels(page):
        if re.search(r"KEY\s+LIST", page.get_text(), re.I):
            return []
        return cut.left_labels(page, 110, False, with_x=True)
    events = walk(ms, labels, MS_STOP)
    out, last = {}, 0
    for n, (pg, y, _, kind, value) in enumerate(events):
        # A label read once, in order: a stray number in the margin ("10", "99") is not a question.
        if kind != "label" or value not in wanted or value in out or int(value) < last:
            continue
        last = int(value)
        end = (len(ms) - 1, ms[-1].rect.height)
        for pg2, y2, y2b, kind2, value2 in events[n + 1:]:
            if kind2 in ("label", "stop"):
                end = (pg2, y2 - 6)
                break
            if kind2 == "end" and MAXIMUM.match(value2):
                end = (pg2, y2b + 4)
                break
        pieces = span(ms, (pg, y - 4), end, ms_frame)
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


def ms_grids(ms):
    """The shared levels-of-response grids: [(page, marks, pieces)], from "Below is the levels…" to the next heading or label."""
    grids = []
    for pg, page in enumerate(ms):
        f = ms_frame(page)
        lines = lines_of(page, f)
        for i, (y0, x0, y1, t) in enumerate(lines):
            if not GRID.match(t):
                continue
            below = [l for l in lines[i + 1:] if MS_STOP.match(l[3]) and not GRID.match(l[3]) or cut.QLABEL.match(re.sub(r"\s", "", l[3]))]
            end = below[0][0] - 6 if below else f.y1
            rect = pymupdf.Rect(f.x0, y0 - 4, f.x1, end)
            pieces = [(pg, rect)]
            if not below and pg + 1 < len(ms):  # a grid that runs over the page
                nf = ms_frame(ms[pg + 1])
                nlines = lines_of(ms[pg + 1], nf)
                if nlines and re.match(r"^(\d|Level|•|[A-Z][a-z]+ )", nlines[0][3]) and not any(cut.QLABEL.match(re.sub(r"\s", "", l[3])) or MS_STOP.match(l[3]) for l in nlines[:1]):
                    nend = next((l[0] - 6 for l in nlines if MS_STOP.match(l[3]) or cut.QLABEL.match(re.sub(r"\s", "", l[3])) or l[1] < 80 and re.fullmatch(r"\d \d", l[3])), nf.y1)
                    pieces.append((pg + 1, pymupdf.Rect(nf.x0, nf.y0, nf.x1, nend)))
            text = "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces)
            m = re.search(r"Max\s*(\d+)\s*marks|(\d+)[- ]marks? question", text, re.I)
            if m:
                grids.append((pg, int(m.group(1) or m.group(2)), pieces))
    return grids


def grid_for(q, marks, own_text, own_pieces, grids):
    """The shared grid a question's scheme leaves out, or None: the page it names, else the nearest one before it for its marks."""
    if not marks or marks < 9 or re.search(r"\bMax\s*\d+\s*marks", own_text):
        return None
    named = re.search(r"on page (\d+)", own_text)
    fits = [g for g in grids if g[1] == marks]
    if named:
        on_page = [g for g in fits if g[0] == int(named.group(1)) - 1]
        if on_page:
            return on_page[0]
    first_page = own_pieces[0][0] if own_pieces else 0
    before = [g for g in fits if g[0] <= first_page]
    return (before or fits or [None])[-1] if (before or fits) else None


def mcq_keys(ms):
    """The KEY LIST: {'01': 'B', ...}. A grid of columns, each a column of numbers with its
    letters to the right. A letter sits at the top of its cell (the answer's words under it,
    from 2021), so a tall cell's letter is well above its number: the letters of a column are
    paired with its numbers in order, top to bottom."""
    keys = {}
    for page in ms:
        if not re.search(r"KEY\s+LIST", page.get_text(), re.I):
            continue
        spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
        nums = [s for s in spans if re.fullmatch(r"\d{1,2}", s["text"].strip()) and 60 < s["bbox"][1] < page.rect.height - 60 and s["bbox"][0] < page.rect.width - 80]
        cols = []
        for s in sorted(nums, key=lambda s: s["bbox"][0]):
            if cols and s["bbox"][0] - cols[-1][0]["bbox"][0] < 15:
                cols[-1].append(s)
            else:
                cols.append([s])
        cols = [c for c in cols if len(c) >= 3]
        for n, col in enumerate(cols):
            col.sort(key=lambda s: s["bbox"][1])
            x0 = max(s["bbox"][2] for s in col)
            x1 = cols[n + 1][0]["bbox"][0] if n + 1 < len(cols) else page.rect.width
            bottom = col[-1]["bbox"][3] + 4
            letters = [s for s in spans if re.fullmatch(r"[A-D]", s["text"].strip()) and x0 < s["bbox"][0] < x1 and s["bbox"][1] < bottom]
            bold = [s for s in letters if "Bold" in s["font"]]
            letters = bold if len(bold) >= len(col) else letters
            # The letters stand in a column of their own; a bold letter in the answer's words ("Point C") is off it.
            xs = [round(s["bbox"][0]) for s in letters]
            mode = max(set(xs), key=xs.count, default=0)
            letters = sorted((s for s in letters if abs(s["bbox"][0] - mode) < 4), key=lambda s: s["bbox"][1])
            # Two answers allowed: "A (…) OR C (…)" in one cell.
            ors = [s["bbox"][1] for s in spans if s["text"].strip() == "OR" and x0 < s["bbox"][0] < x1]
            answers = []
            for s in letters:
                if answers and any(answers[-1][1] < y < s["bbox"][1] for y in ors):
                    answers[-1] = (answers[-1][0] + " or " + s["text"].strip(), s["bbox"][1])
                else:
                    answers.append((s["text"].strip(), s["bbox"][1]))
            if len(answers) == len(col):
                keys.update({f"{int(s['text']):02d}": a for s, (a, _) in zip(col, answers)})
        break
    return keys


# "Question 4", "Questions 1 and 5", "Questions 9, 11 and 13", "Question B31".
REPORT_SPLIT = re.compile(r"\n\s*Questions? [AB]?(\d{1,2}(?:\s*(?:,|and|&)\s*\d{1,2})*)\s*(?:\([^)\n]*\))?\s*\n")
REPORT_TAIL = re.compile(r"(\n\s*(Section [AB]\b[^\n]*|SECTION [AB]\b[^\n]*|(The )?Context\b[^\n]*|(The )?Essays?\b[^\n]*|Multiple[- ]choice[^\n]*|Investigation[^\n]*|Comments on Individual Questions)\s*)+$", re.I)


def examiner_report(path):
    """{'04': its comments}: everything under a "Question 4" heading, up to the next; a heading
    over several questions ("Questions 1 and 5", one for each context) gives them all its comments."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"REPORT ON THE EXAMINATION[^\n]*\n|\n\s*\d+ of \d+\s*\n|\n\s*©[^\n]*", "\n", text)
    parts = REPORT_SPLIT.split(text)
    out = {}
    for k in range(1, len(parts) - 1, 2):
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)", parts[k + 1])[0]
        body = REPORT_TAIL.sub("", body)
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))
        for q in re.findall(r"\d+", parts[k]):
            if body:
                q = f"{int(q):02d}"
                out[q] = (out[q] + "\n\n" + body) if q in out else body
    return out


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    ins = pymupdf.open(ins_path) if ins_path and os.path.exists(ins_path) else None
    questions, firsts, events = qp_questions(qp)
    stems = qp_stems(qp, ins, firsts, events)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, {q for q, *_ in questions}) if ms else {}
    grids = ms_grids(ms) if ms else []
    keys = mcq_keys(ms) if ms else {}
    er = examiner_report(er_path)
    parts, problems = [], []
    stem_text = {}
    for group, pieces in stems.items():
        name = f"{set_id}-{group}-stem.webp"
        if not os.path.exists(os.path.join(IMG, name)):
            cut.save(render(pieces, 16), name)
        stem_text[group] = " ".join(doc[pg].get_text("text", clip=r) for doc, pg, r in pieces)
    for q, group, pieces, text, marks in questions:
        pid = f"{set_id}-{group}-{q}"
        qimg = render([(qp, pg, r) for pg, r in pieces])
        msimg, ms_text, key = None, "", None
        if q in keys and marks == 1:
            key = keys[q]
        elif q in schemes:
            mpieces, ms_text = schemes[q]
            grid = grid_for(q, marks, ms_text, mpieces, grids)
            images = [render([(ms, pg, r) for pg, r in mpieces], 12)]
            if grid:
                images.append(render([(ms, pg, r) for pg, r in grid[2]], 12))
            elif marks and marks >= 9 and not re.search(r"\bMax\s*\d+\s*marks", ms_text):
                problems.append(f"{pid}: no levels grid for {marks} marks")
            msimg = cut.stack(images)
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "group": group, "label": q, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{group}-stem.webp" if group in stems else None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            # The question's own words first: its stem is pages of extracts, which would push them out.
            "text": re.sub(r"\s+", " ", text + " " + stem_text.get(group, "")).strip()[:3000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
            **({"key": key} if key else {}),
        })
    return parts, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), pdf("ins"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] in SERIES:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"] and not p.get("key"))
            marks = sum(p["marks"] or 0 for p in parts)
            print(f"{set_id}: {len(parts)} questions, {no_ms} without scheme, {sum(1 for p in parts if p.get('key'))} keys, "
                  f"{sum(1 for p in parts if p['er'])} reported, stems {sorted({p['group'] for p in parts if p['stem']})}, {marks} marks printed", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} questions, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
