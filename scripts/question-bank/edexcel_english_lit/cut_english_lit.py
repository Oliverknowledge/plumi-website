"""Cut Pearson Edexcel's A-Level (9ET0) and AS (8ET0) English Literature papers into questions, each with its mark scheme and report.

    python3 scripts/question-bank/edexcel_english_lit/cut_english_lit.py [work-dir] [--only=9et0-03]
    # default work dir: scripts/question-bank/.work/edexcel-english-lit

cut.py's image helpers, with Pearson's Literature layout around them (aqa_english_lit/cut_english_lit.py
is the AQA counterpart):
  - A paper is choices. Each set text (Paper 1, AS Paper 1 Section B), prose theme (Paper 2, AS Paper 2)
    or poetry collection (Paper 3 Section B) has a heading and two questions under it, "EITHER 1 ... OR 2",
    and a student answers one question in each section. A question runs from its number to its
    "(Total for Question 1 = 35 marks)"; the answer pages come after the section's questions.
  - Every question in a section after its first is an alternative (`or`), so a paper's marks add up to
    the one question a student answers in each section, as its front cover says.
  - Where a heading has more under it than a name, the texts a prose theme may be answered on ("Texts
    Pre-1900: ...") or a collection's prescribed edition, that block is the stem its two questions share:
    "9et002-jun24-childhood-01" and "9et002-jun24-childhood-stem.webp".
  - Paper 3's source booklet is printed at the back of the question paper. Section A's two questions
    compare an unseen poem, printed first in the booklet, with an anthology poem: the unseen poem is their
    stem ("9et003-jun24-unseen-01"), and the booklet is split out as the paper's insert (fetch_english_lit.py),
    which the questions link to.
  - The schemes give each question a row of a table, "Question number | Indicative content": the number in
    the left column, the text's name and the content beside it. The levels grids ("No rewardable
    material") follow a section's questions (or, in the early schemes, each text's pair), and the grid
    after a question is stacked under its content, so no scheme is shown without its levels.
  - The reports head each question ("Question 7", "Question 1 & Question 2"), with candidates' answers
    as images between the examiner's comments: each question gets the text under its heading.
  - Each question is tagged to the text, theme or collection whose heading it sits under (texts.py).
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-english-lit")] + flags
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import cut  # noqa: E402
import texts  # noqa: E402

WORK, ONLY = cut.WORK, cut.ONLY

LABEL = re.compile(r"^(\d{1,2})(?:\s+\S|$)")  # "1 Explore ...", or the number alone on its line
TOTAL = re.compile(r"\(Total for Question (\d{1,2}) = (\d+) marks\)")
SECTION = re.compile(r"^SECTION ([AB])\b")
EITHER = re.compile(r"^(EITHER|OR)$")
BOOKLET = re.compile(r"Do not return this (Source )?Booklet", re.I)
MS_LABEL = re.compile(r"^(\d{1,2})((?:\s*(?:,|and|&)\s*\d{1,2})*)$")
WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
         "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
NUMBER = r"(?:\d{1,2}|" + "|".join(WORDS[::-1]) + ")"
# "Question 7", "Question 1 & Question 2", "Questions 5, 6, 7, 8", "Question Two" (AS June 2022), "Question 3: presentation of journeys".
REPORT_QUESTION = re.compile(rf"^Questions? ({NUMBER})((?:\s*(?:,|and|&)\s*(?:Questions? )?{NUMBER})*)(?:\s*[:–-].*)?$", re.I)
REPORT_END = re.compile(r"^(Paper Summary|Grade Boundaries|Summary|Section [AB]\b.*)$")


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold)] top to bottom."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in line["spans"])).strip()
            if t and spans:
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, all("Bold" in s["font"] for s in spans)))
    return sorted(out)


def frame(page):
    """A paper page's content: under the barcode's row, above the page number, clear of the "DO NOT WRITE" margin."""
    w, h = page.rect.width, page.rect.height  # 595 x 842, or 652 x 899 in 2017-19
    # The "DO NOT WRITE IN THIS AREA" margin: text from 2020 (at x 571), a drawing before (at x 590 of 652).
    margin = [b[0] for b in page.get_text("blocks") if "DO NOT WRITE" in b[4] and b[0] > w / 2]
    return pymupdf.Rect(w * (0.085 if w > 620 else 0.057), h * 0.06, min([w * (0.895 if w > 620 else 0.94)] + [x - 4 for x in margin]), h * 0.94)


def ms_frame(page):
    """A scheme page's content: under its running header and over its page number."""
    w, h = page.rect.width, page.rect.height
    top, bottom = 40, h - 40
    for y0, x0, y1, t, _ in lines_of(page):
        if y1 < 70 and re.fullmatch(r"\d{1,3}", t) and x0 > w / 2:  # not a question number at the top of the column
            top = max(top, y1 + 3)
        if y0 > h - 80 and (re.fullmatch(r"\d{1,3}", t) or t.startswith("Pearson Education")):
            bottom = min(bottom, y0 - 3)
    return pymupdf.Rect(20, top, w - 20, bottom)


def has_words(page, rect):
    return bool(re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=rect)))


def span(doc, start, end, framer, skip=lambda pg: False):
    """Pieces from (page, y) down to (page, y), page by page inside the frame; pages with no words, or skipped, are dropped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        if skip(pg):
            continue
        f = framer(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        if bottom > top + 8:
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if has_words(doc[pg], r):
                pieces.append((pg, r))
    return pieces


def answer_page(page):
    t = page.get_text()
    return t.count(".....") > 3 or "Chosen question number" in t or "BLANK PAGE" in t and len(t.strip()) < 120


def booklet_start(doc):
    return next((pg for pg in range(1, len(doc)) if BOOKLET.search(doc[pg].get_text())), len(doc))


def qp_questions(doc, component):
    """[dict(label, section, pieces, text, marks, code, block, stem)] in order. `block` is the heading's
    topic where the heading has a stem of its own (the texts, the prescribed edition), else None."""
    end = booklet_start(doc)
    events = []  # (page, y0, y1, kind, value, x0 or a total's marks)
    for pg in range(1, end):
        page = doc[pg]
        if answer_page(page):
            continue
        f = frame(page)
        left = page.rect.width * 0.15  # the numbers' and EITHERs' column; headings are centred
        for y0, x0, y1, t, bold in lines_of(page, f):
            m = SECTION.match(t)
            if m and bold:
                events.append((pg, y0, y1, "section", m.group(1), x0))
            elif x0 > left and bold and texts.find(t) and not TOTAL.search(t):
                events.append((pg, y0, y1, "heading", t, x0))
            elif EITHER.match(t) and x0 < left:
                events.append((pg, y0, y1, "either", t, x0))
            elif LABEL.match(t) and x0 < left:
                events.append((pg, y0, y1, "label", LABEL.match(t).group(1), x0))
            elif TOTAL.search(t):
                events.append((pg, y0, y1, "total", TOTAL.search(t).group(1), int(TOTAL.search(t).group(2))))
            elif x0 < left and re.match(r"^(Texts|Prescribed texts?)$", t):
                events.append((pg, y0, y1, "texts", t, x0))
    out, section, heading, block_top, extra, expected = [], "A", None, None, False, 1
    for n, (pg, y0, y1, kind, value, x0) in enumerate(events):
        if kind == "section":
            section, heading, block_top = value, None, None
        elif kind == "heading":
            heading, block_top, extra = value, (pg, y0 - 4), False
        elif kind == "texts":
            extra = True
        elif kind == "label":
            if int(value) != expected:  # a page number or a line number, not the next question
                continue
            expected += 1
            total = next((e for e in events[n + 1:] if e[3] == "total" and e[4] == value), None)
            stop = total or next((e for e in events[n + 1:] if e[3] in ("label", "heading", "section")), None)
            stop_at = (total[0], total[2] + 5) if total else (stop[0], stop[1] - 6) if stop else (end - 1, doc[end - 1].rect.height)
            pieces = span(doc, (pg, y0 - 5), stop_at, frame, lambda p: answer_page(doc[p]))
            text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
            code = texts.find(heading) if heading else texts.UNHEADED.get((component, section))
            stem = []
            if heading and extra and block_top:
                first = next((e for e in events[:n + 1] if (e[0], e[1]) > block_top and (e[3] == "label" or e[4] == "EITHER")), None)
                if first:
                    stem = span(doc, block_top, (first[0], first[1] - 4), frame)
            out.append(dict(label=value, section=section, pieces=pieces, text=text, marks=total[5] if total else None,
                            code=code, block=code if stem else None, stem=stem))
    return out


def unseen_stem(doc, questions):
    """Paper 3 Section A's unseen poem: the booklet's pages from the one its questions name ("on page 2 of the source
    booklet") up to the first anthology poem ("(on pages 3–5)"). Booklet page n is the PDF's page start + n - 1."""
    start = booklet_start(doc)
    if start >= len(doc):
        return []
    a = [q for q in questions if q["section"] == "A"]
    if not a:
        return []
    flat_text = re.sub(r"\s+", " ", a[0]["text"])
    m = re.search(r"on page (\d+) of the source booklet", flat_text)
    anth = [int(x) for q in a for x in re.findall(r"\(on pages? (\d+)", re.sub(r"\s+", " ", q["text"]))]
    if not m:
        return []
    first = int(m.group(1))
    last = min(anth) - 1 if anth and min(anth) > first else first
    pieces = []
    for n in range(first, last + 1):
        pg = start + n - 1
        if pg < len(doc):
            # Inside the booklet's border, down to the poem's last line (its source, a footnote) over the page number.
            page = doc[pg]
            w, h = page.rect.width, page.rect.height
            box = max((d["rect"] for d in page.get_drawings() if d["rect"].width > w / 2 and d["rect"].height > h / 2),
                      key=lambda r: r.width * r.height, default=None)
            inner = pymupdf.Rect(box.x0 + 4, box.y0 + 4, box.x1 - 4, box.y1 - 4) if box else pymupdf.Rect(w * 0.07, h * 0.04, w * 0.93, h * 0.92)
            body = [l for l in lines_of(page, inner) if not l[3].startswith("Source information") and not re.fullmatch(r"\d{1,2}|P\d+\w*", l[3])]
            if not body:
                continue
            r = pymupdf.Rect(inner.x0, max(inner.y0, body[0][0] - 8), inner.x1, min(inner.y1, body[-1][2] + 10))
            if has_words(doc[pg], r):
                pieces.append((pg, r))
    return pieces


GRID_HEAD = re.compile(r"^Please refer to the specific marking guidance", re.I)


def divider_page(page):
    """A page that only says "Section B" (and its page number)."""
    return bool(re.fullmatch(r"(\d+\s*)?Section [AB]\s*(\d+)?", re.sub(r"\s+", " ", page.get_text()).strip()))


def ms_markers(ms):
    """Every question number, levels grid and section divider in the scheme, in reading order: [(page, y, kind, label)].
    A number sits in the "Question number" column, left of the indicative content; a grid starts at its "Please refer to
    the specific marking guidance" (or its "Level | Mark" header); the last page, Pearson's address, ends the scheme."""
    out, col = [], None
    for pg, page in enumerate(ms):
        if divider_page(page):
            out.append((pg, 0, "end", None))
            continue
        f = ms_frame(page)
        lines = lines_of(page, f)
        address = next((l[0] for l in lines if "Registered company number" in l[3]), None)
        if address is not None:
            out.append((pg, address - 30, "end", None))
        # June 2025's schemes embed their fonts without names, so neither the header nor the numbers read as bold.
        head = next((l for l in lines if re.match(r"^Indicative content", l[3])), None)
        if head:
            col = head[1]
        for i, (y0, x0, y1, t, bold) in enumerate(lines):
            if GRID_HEAD.match(t) or t == "Level" and any(l[3].startswith("Mark") and abs(l[0] - y0) < 4 for l in lines) \
                    and not any(GRID_HEAD.match(l[3]) and 0 < y0 - l[0] < 60 for l in lines):
                out.append((pg, y0 - 4, "grid", None))
            m = MS_LABEL.match(t)
            if m and col and x0 < col - 5 and m.group(1) != "0":
                for label in [m.group(1)] + re.findall(r"\d+", m.group(2) or ""):
                    out.append((pg, y0 - 1.5, "label", str(int(label))))
    return sorted(out, key=lambda e: (e[0], e[1]))


def ms_questions(ms):
    """{label: (pieces, text, grid pieces)}: each question's row of the table, from its number to whatever comes next;
    and the grid that follows it (or, where a section's grid is printed before its questions, the one before)."""
    markers = ms_markers(ms)
    end_of = lambda k: next(((m[0], m[1] - 2) for m in markers[k + 1:] if (m[0], m[1]) > markers[k][:2]), (len(ms) - 1, ms[-1].rect.height))  # noqa: E731
    grids = []  # [(index of first marker, pieces)]: consecutive grid markers make one grid
    for k, m in enumerate(markers):
        if m[2] != "grid":
            continue
        pieces = span(ms, m[:2], end_of(k), ms_frame)
        if grids and k > 0 and markers[k - 1][2] == "grid":
            grids[-1][1].extend(pieces)
        else:
            grids.append((k, pieces))
    out = {}
    for k, (pg, y, kind, label) in enumerate(markers):
        if kind != "label" or label in out:
            continue
        pieces = span(ms, (pg, y), end_of(k), ms_frame)
        grid = next((g for i, g in grids if i > k), None) or next((g for i, g in reversed(grids) if i < k), None)
        out[label] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces), grid or [])
    return out


def report_sections(path):
    """{question number: its text}: everything under a report's "Question 7" heading, to the next."""
    if not path or not os.path.exists(path):
        return {}
    out, current, buf = {}, None, []

    def flush():
        if current and buf:
            text = re.sub(r"[ \t]+", " ", "\n".join(buf)).strip()
            for q in current:
                out.setdefault(q, []).append(text)
        buf.clear()

    for page in pymupdf.open(path):
        h = page.rect.height
        for y0, x0, y1, t, bold in lines_of(page):
            if y0 < 30 or y0 > h - 50 or re.fullmatch(r"\d{1,3}", t):
                continue
            m = REPORT_QUESTION.match(t)
            if m and len(t) < 90 and (len(t) < 25 or ":" in t):
                flush()
                current = [x if x.isdigit() else str(WORDS.index(x.lower()) + 1)
                           for x in re.findall(NUMBER, m.group(1) + " " + (m.group(2) or ""), re.I)]
                current = [str(int(x)) for x in current]
                continue
            if REPORT_END.match(t) and len(t) < 60:
                flush()
                current = None
                continue
            if current:
                buf.append(t)
    flush()
    return {q: cap("\n".join(v)) for q, v in out.items()}


def cap(text, limit=6000):
    """A report's text joined into paragraphs, cut at a sentence end near the limit."""
    text = re.sub(r"\n(?=[a-z,;(])", " ", text)
    if len(text) <= limit:
        return text
    cut_at = text.rfind(". ", 0, limit)
    return text[:cut_at + 1 if cut_at > limit // 2 else limit] + " …"


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    questions = qp_questions(qp, meta["component"])
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_questions(ms) if ms else {}
    reports = report_sections(er_path)
    unseen = unseen_stem(qp, questions) if meta["component"] == "9et0-03" else []
    parts, problems, stems, firsts = [], [], {}, {}
    for q in questions:
        label, section, code = q["label"], q["section"], q["code"]
        if unseen and section == "A":
            block = "unseen"
            if block not in stems:
                stems[block] = cut.save(render([(qp, pg, r) for pg, r in unseen], 16), f"{set_id}-{block}-stem.webp")
        else:
            block = q["block"]
            if block and block not in stems:
                stems[block] = cut.save(render([(qp, pg, r) for pg, r in q["stem"]], 16), f"{set_id}-{block}-stem.webp")
        pid = f"{set_id}-{block}-{int(label):02d}" if block else f"{set_id}-{int(label):02d}"
        qimg = render([(qp, pg, r) for pg, r in q["pieces"]])
        msimg, ms_text = None, ""
        if label in schemes:
            mpieces, ms_text, grid = schemes[label]
            images = [render([(ms, pg, r) for pg, r in mpieces], 12)]
            if grid:
                images.append(render([(ms, pg, r) for pg, r in grid], 12))
            else:
                problems.append(f"{pid}: no levels grid")
            msimg = cut.stack(images)
        if not code:
            problems.append(f"{pid}: no set text ({q['text'][:60]!r})")
        firsts.setdefault(section, label)
        parts.append({
            "id": pid, "set": set_id, **meta, "label": label, "marks": q["marks"], "section": section,
            "or": firsts[section] != label, "text_code": code,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stems.get(block),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", q["text"]).strip()[:4000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": reports.get(label),
        })
    return parts, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    os.makedirs(cut.IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp.replace('-', '')}-{series}".lower(), files, {"component": comp, "spec": comp[:4].upper(), "series": series})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not f"{p['component']}-{p['series']}".lower().startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            marks = sum(p["marks"] or 0 for p in parts if not p["or"])
            print(f"{set_id}: {len(parts)} questions {[p['label'] for p in parts]}, {no_ms} without scheme, "
                  f"{sum(1 for p in parts if p['er'])} reported, {marks} marks answered", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} questions, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
