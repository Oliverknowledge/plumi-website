"""Cut AQA's Business papers into questions, each with its mark scheme, its case material and its report.

    python3 scripts/question-bank/aqa_business/cut_business.py [work-dir] [--only=71322]   # default scripts/question-bank/.work/aqa-business

cut_economics.py's page frames and spans, with Business's own layout around them:
  - A-Level Paper 1: Section A is 15 multiple-choice questions, Section B short
    answers (16-20, sometimes one with parts on its own data, 16.1-16.4), then
    EITHER 21 OR 22 and EITHER 23 OR 24, 25-mark essays. AS Paper 1: 10 multiple-
    choice questions, short answers 11-15, then two short cases with parts (16.1,
    16.2, 17.1, 17.2). A-Level Paper 2: three cases (01-03), each its text and
    appendices, then its parts (01.1-01.5). Paper 3 and AS Paper 2: one case study,
    printed in the insert, and six or eight whole questions on it.
  - So ids are cut.py's: "71322-jun24-01-3" for a part, "71321-jun24-18" for a whole
    question. A part's stem is its question's case ("71322-jun24-01-stem.webp"), from
    the question's label to its first part. Paper 3 and AS Paper 2's questions share
    the insert as their stem ("71323-jun24-stem.webp"): the site finds a stem by
    dropping the id's last part.
  - A few papers print data that several questions use ("Questions 14 and 15 are
    based on the network below"). The first of them keeps it in its own crop; the
    others share it as their stem ("71321-jun24-stem.webp", one such group a paper at
    most): from that line to the foot of the table or figure under it.
  - A question ends at its marks ("[9 marks]"): the answer lines and pages after it
    add nothing. Multiple choice runs to the next label, so the options stay with it.
  - The schemes are not tables: each question is its label, its words again, then
    its guidance and its own levels-of-response grid, up to the next label. So no
    grid is shared and none is cut apart from its question.
  - Multiple-choice answers come from Section A's "Question number / Answer" table
    (a letter, and from 2022 the answer's words after it).
  - Examiner's reports head each question "Question 16", "Question 16.1" or just
    "1.1"; a whole question's comments are collected under it (AQA's reportKey).
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-business")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_economics"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_economics as ce  # noqa: E402  (reads the same argv: the work dir is ours)

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks
INSERT_PAPERS = {"71323", "71312"}  # one case study, in the insert, for every question

# Lines that end a question in the paper.
QP_STOP = re.compile(r"^(OR\b|(?:[Oo]r|EITHER|Either)\s*$|Section [A-D]\b|SECTION [A-D]\b|END\s+OF\s+QUESTIONS|Turn over for|Question \d+ continues|There are no questions|DO\s+NOT\s+WRITE|Answer either|Extra space)")
MS_STOP = re.compile(r"^(Section [A-D]\b|SECTION [A-D]\b|Assessment [Oo]bjectives?\b|Assessment [Oo]bjective grid|AO1\s+AO2|Breakdown of|Total quantitative|Quantitative skills\b|Paper \d+ Marks|Objective [Tt]est)")
MARKS = ce.MARKS
GROUP = re.compile(r"Questions? (\d{1,2}((?:\s*,\s*\d{1,2})*)\s*(?:and|&)\s*\d{1,2})\s+(?:are|is) based on")


def ms_frame(page):
    """cut_economics' scheme frame, also inside the header and footer rules that even pages draw
    from the left edge (x 0 to 553) rather than out to the right one."""
    f = ce.ms_frame(page)
    w, h = page.rect.width, page.rect.height
    for d in page.get_drawings():
        r = d["rect"]
        if r.height < 3 and r.width > 300 and r.x0 < 5:
            if r.y0 < 90:
                f.y0 = max(f.y0, r.y1 + 2)
            elif r.y0 > h - 90:
                f.y1 = min(f.y1, r.y0 - 2)
    return f


def qp_regions(doc):
    """[(q, part, pieces, text, marks)] in order: whole questions, parts, and question headers (a case before its parts)."""
    labels = lambda page: [(y, q, p, x) for y, q, p, x in cut.left_labels(page, 75, True, with_x=True)]  # noqa: E731
    events = []
    for pg, page in enumerate(doc):
        f = ce.frame(page)
        for y, q, p, x in labels(page):
            events.append((pg, y, y, "label", (q, p)))
        for y0, x0, y1, t in ce.lines_of(page):
            if f.y0 - 10 <= y0 <= f.y1 + 4:
                if QP_STOP.match(t) or GROUP.search(t):
                    events.append((pg, y0, y1, "stop", t))
                if MARKS.search(t):
                    events.append((pg, y0, y1, "end", t))
    events.sort(key=lambda e: (e[0], e[1], e[3] != "stop"))
    out = []
    for n, (pg, y, _, kind, value) in enumerate(events):
        if kind != "label":
            continue
        q, p = value
        nxt = next((e for e in events[n + 1:] if e[3] == "label"), None)
        header = p is None and nxt is not None and nxt[4][0] == q and nxt[4][1] is not None
        end = (len(doc) - 1, doc[-1].rect.height)
        if header:
            end = (nxt[0], nxt[1] - 6)  # a case: everything up to its first part
        else:
            for pg2, y2, y2b, kind2, value2 in events[n + 1:]:
                if kind2 == "stop" and pg2 == pg and y2 < y + 4:
                    continue  # its own line ("1 4  Questions 14 and 15 are based on…")
                if kind2 in ("label", "stop"):
                    end = (pg2, y2 - 6)
                    break
                if kind2 == "end" and int(MARKS.search(value2).group(1)) > 1:
                    # A little air under the marks, short of an "OR" printed just below them.
                    below = [e[1] for e in events if e[0] == pg2 and e[1] > y2b and e[3] != "end"]
                    end = (pg2, min([y2b + 5] + [b - 1 for b in below]))
                    break
        pieces = ce.span(doc, (pg, y - 6), end, ce.frame)
        text = "\n".join(doc[p_].get_text("text", clip=r) for p_, r in pieces)
        marks = [int(x) for x in MARKS.findall(text)]
        # An essay printed after "OR" ("or" in 2021 and 2022) is the alternative to the one before it (A-Level Paper 1, Sections C and D).
        before = [e for e in events[:n] if e[3] in ("label", "stop")]
        alt = bool(before) and before[-1][3] == "stop" and re.match(r"OR\b|[Oo]r\s*$", before[-1][4]) is not None
        out.append((q, p, "header" if header else "alt" if alt else "item", pieces, text, sum(marks) if marks else None))
    return out


def shared_data(doc, regions):
    """A group of whole questions on one table or figure: (members with the stem, pieces) or None.

    Mostly the data is printed above the first question's label ("Questions 16, 17 and
    18 are based on the data provided in Table 1 below."): it runs to that label and every
    member shares it. Where the line sits beside the first label instead ("1 4  Questions
    14 and 15 are based on the network below:"), the first question keeps the data in its
    own crop, and the others share it, from that line to the foot of the figure or table
    under it, above the first question's own words."""
    labels = [(pieces[0][0], pieces[0][1].y0 + 6, q) for q, p, kind, pieces, text, marks in regions if pieces and p is None]
    for pg, page in enumerate(doc):
        f = ce.frame(page)
        lines = ce.lines_of(page, f)
        start = next((l for l in lines if GROUP.search(l[3])), None)
        if not start:
            continue
        members = [f"{int(x):02d}" for x in re.findall(r"\d+", GROUP.search(start[3]).group(1))]
        first = next(((lpg, ly) for lpg, ly, q in labels if q == members[0]), None)
        if first is None:
            continue
        if first[0] != pg or first[1] > start[0] + 4:
            return members, [(p_, r) for p_, r in ce.span(doc, (pg, start[0] - 4), (first[0], first[1] - 6), ce.frame)]
        stop = next((l[0] for l in lines if l[0] > start[0] and MARKS.search(l[3])), f.y1)
        art = [r for r in [d["rect"] for d in page.get_drawings()] + [pymupdf.Rect(i["bbox"]) for i in page.get_image_info()]
               if r.y0 >= start[2] - 2 and r.y1 <= stop and r.x1 > f.x0 and r.width > 4]
        if not art:
            print(f"  no figure under {start[3]!r}", file=sys.stderr)
            return None
        foot = max(r.y1 for r in art)
        # From the sentence's own first word: the first question's label box stays with it.
        word = min((r for r in page.search_for("Question") if abs(r.y0 - start[0]) < 6), key=lambda r: r.x0, default=None)
        left = word.x0 if word else start[1]
        x0 = min([left] + [r.x0 for r in art if r.x1 > left]) - 6
        return members[1:], [(pg, pymupdf.Rect(max(f.x0, x0), start[0] - 4, f.x1, foot + 6))]
    return None


def insert_pages(ins):
    """The case study: every page after the cover up to "END OF SOURCE", leaving out blank pages and the copyright notice."""
    pieces = []
    for pg, page in enumerate(ins):
        if pg == 0 or re.search(r"There (is|are) no (material|sources?|extracts?) printed", page.get_text()):
            continue
        f = ce.frame(page)
        lines = ce.lines_of(page, f)
        end = next((l[0] for l in lines if re.match(r"^(END\s+OF\s+SOURCE|Copyright information|Copyright ©)", l[3])), None)
        if end is not None:
            f = pymupdf.Rect(f.x0, f.y0, f.x1, end - 6)
        if f.height > 8 and ce.has_words(page, f):
            pieces.append((ins, pg, f))
        if end is not None:
            break
    return pieces


def ms_parts(ms, order):
    """{(q, part): (pieces, text)}: each question's own scheme, from its label to the next one or a heading."""
    rank = {k: n for n, k in enumerate(order)}
    events = []
    for pg, page in enumerate(ms):
        if pg < 2:
            continue  # the cover and the general guidance
        f = ms_frame(page)
        for y, q, p, x in cut.left_labels(page, 110, False, with_x=True):
            events.append((pg, y, y, "label", (q, p)))
        for y0, x0, y1, t in ce.lines_of(page, f):
            if MS_STOP.match(t):
                events.append((pg, y0, y1, "stop", t))
    events.sort(key=lambda e: (e[0], e[1], e[3] != "stop"))
    out, last = {}, -1
    for n, (pg, y, _, kind, value) in enumerate(events):
        # A label read once, in order: a stray number in the margin ("50", "20") is not a question.
        if kind != "label" or value not in rank or value in out or rank[value] < last:
            continue
        last = rank[value]
        end = (len(ms) - 1, ms[-1].rect.height)
        for pg2, y2, _, kind2, value2 in events[n + 1:]:
            if kind2 == "stop" or (kind2 == "label" and value2 in rank and rank[value2] > last):
                end = (pg2, y2 - 6)
                break
        pieces = ce.span(ms, (pg, y - 4), end, ms_frame)
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


def mcq_keys(ms):
    """Section A's "Question number / Answer" table: {'01': 'D', ...}, the letter that opens each answer."""
    keys = {}
    for page in ms:
        if not re.search(r"Question\s*\n\s*number\s*\n\s*Answer", page.get_text()):
            continue
        lines = ce.lines_of(page)
        # The numbers stand under the "Question number" heading, which is at the margin or mid-page (2020).
        head = next(l for l in lines if l[3].startswith("Question"))
        nums = [l for l in lines if re.fullmatch(r"\d{1,2}", l[3]) and abs(l[1] - head[1]) < 40 and l[0] > head[0]]
        for y0, x0, y1, t in nums:
            # An answer over two lines sits a little lower than its number: the nearest line to its right.
            row = [l for l in lines if abs(l[0] - y0) < 24 and l[1] > x0 + 15 and re.match(r"[A-D]\b", l[3])]
            if row:
                keys[f"{int(t):02d}"] = min(row, key=lambda l: abs(l[0] - y0))[3][0]
    return keys


# "Question 16", "Question 16.1", "Question 1)", or a part's label alone ("1.1"), on a line of its own;
# or "Q16:" or "1.1" opening its comments (Paper 1, 2022 and 2023; Paper 2, November 2020).
REPORT_HEAD = re.compile(r"\n[ \t]*(?:Questions?[ \t]+0?(\d{1,2})(?:\.(\d{1,2}))?[ \t]*\)?|0?(\d{1,2})\.(\d{1,2}))[ \t]*\n|\n[ \t]*Q0?(\d{1,2})(?:\.(\d{1,2}))?:[ \t]*|\n[ \t]*0?(\d{1,2})\.(\d{1,2})[ \t]+(?=[A-Za-z])")
REPORT_END = re.compile(r"\n\s*(?:Section [A-D]\b|SECTION [A-D]\b|Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance|Enhanced Results Analysis|Questions\s*\n)")


def examiner_report(path, labels):
    """{'01': its comments}: each heading's text, up to the next heading or section; a question's
    parts are gathered under it, each headed by its label ("Question 1.3")."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"REPORT ON THE EXAMINATION[^\n]*\n|\n\s*\d+ of \d+\s*\n|\n\s*©[^\n]*", "\n", text)
    found = []
    for m in REPORT_HEAD.finditer(text):
        g = [x for x in m.groups()]
        n = next(k for k in (0, 2, 4, 6) if g[k])
        q, p = f"{int(g[n]):02d}", g[n + 1]
        # Only labels the paper has; a page number or a stray figure is neither.
        if (q, p) in labels or (p is None and any(k[0] == q for k in labels)):
            found.append(((q, p), m.start(), m.end()))
    # A contents list ("Question 1  5  Question 2  9") heads nothing but a page number.
    found = [h for n, h in enumerate(found) if re.search(r"[A-Za-z]{3}", REPORT_END.split(text[h[2]:found[n + 1][1] if n + 1 < len(found) else len(text)])[0])]
    heads = []
    for h in found:  # read in order
        if not heads or labels_order(labels, h[0]) > labels_order(labels, heads[-1][0]):
            heads.append(h)
    out = {}
    for n, ((q, p), start, at) in enumerate(heads):
        body = text[at:heads[n + 1][1] if n + 1 < len(heads) else len(text)]
        body = REPORT_END.split(body)[0]
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))
        if not body:
            continue
        if p is not None:
            body = f"Question {int(q)}.{p}\n\n{body}"
        out[q] = (out[q] + "\n\n" + body) if q in out else body
    return out


def labels_order(labels, key):
    q, p = key
    if key in labels:
        return labels.index(key)
    return min(n for n, k in enumerate(labels) if k[0] == q) - 0.5


def scheme_words(text):
    """A scheme's own guidance, for search and tagging: from "The demands of the question" (or the
    answer, after "Marks for this question"), leaving out the question's words and the generic levels."""
    text = re.sub(r"\s+", " ", text).strip()
    m = re.search(r"The demands of (the|this) question|Indicative content", text) or re.search(r"Marks for this question:?(?:\s*(?:,|and)?\s*AO\d\s*=\s*\d+)+", text)
    return (text[m.start() if m.group(0).startswith(("The", "Indicative")) else m.end():] if m else text).strip()


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    ins = pymupdf.open(ins_path) if ins_path and os.path.exists(ins_path) else None
    regions = qp_regions(qp)
    items = [(q, p) for q, p, kind, *_ in regions if kind != "header"]
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, items) if ms else {}
    keys = mcq_keys(ms) if ms else {}
    er = examiner_report(er_path, items)
    problems = []
    # Stems: each question's case, the insert's case study, and a shared figure.
    stems, stem_text = {}, {}
    for q, p, kind, pieces, text, marks in regions:
        if kind == "header":
            stems[q] = [(qp, pg, r) for pg, r in pieces]
            stem_text[q] = text
    whole_stem, whole_members = None, set()
    if meta["component"] in INSERT_PAPERS:
        if ins is None:
            problems.append(f"{set_id}: no insert")
        else:
            whole_stem = insert_pages(ins)
            whole_members = {q for q, p in items}
    else:
        group = shared_data(qp, regions)
        if group:
            whole_members, pieces = set(group[0]), group[1]
            whole_stem = [(qp, pg, r) for pg, r in pieces]
    whole_text = " ".join(doc[pg].get_text("text", clip=r) for doc, pg, r in whole_stem) if whole_stem else ""
    for q, pieces in stems.items():
        name = f"{set_id}-{q}-stem.webp"
        if not os.path.exists(os.path.join(IMG, name)):
            cut.save(render(pieces, 16), name)
    if whole_stem and not os.path.exists(os.path.join(IMG, f"{set_id}-stem.webp")):
        cut.save(render(whole_stem, 16), f"{set_id}-stem.webp")
    parts = []
    for q, p, kind, pieces, text, marks in regions:
        if kind == "header":
            continue
        label = f"{q}.{p}" if p else q
        pid = f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}"
        qimg = render([(qp, pg, r) for pg, r in pieces])
        msimg, ms_text, key = None, "", None
        if p is None and q in keys and marks == 1:
            key = keys[q]
        elif (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = render([(ms, pg, r) for pg, r in mpieces], 12)
        if p is not None and q in stems:
            stem, extra = f"{set_id}-{q}-stem.webp", stem_text[q]
        elif p is None and q in whole_members:
            stem, extra = f"{set_id}-stem.webp", whole_text
        else:
            stem, extra = None, ""
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": label, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stem,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            # The question's own words first: its stem is a case study, which would push them out.
            "text": re.sub(r"\s+", " ", text + " " + extra).strip()[:3000],
            "msText": scheme_words(ms_text)[:800],
            "er": er.get(q),
            **({"key": key} if key else {}),
            **({"or": True} if kind == "alt" else {}),
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
            no_ms = [p["label"] for p in parts if not p["ms"] and not p.get("key")]
            marks = sum(p["marks"] or 0 for p in parts if not p.get("or"))
            print(f"{set_id}: {len(parts)} questions, {len(no_ms)} without scheme, {sum(1 for p in parts if p.get('key'))} keys, "
                  f"{sum(1 for p in parts if p['er'])} reported, {sum(1 for p in parts if p['stem'])} with stems, {sum(1 for p in parts if p.get('or'))} alternatives, {marks} marks", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} questions, no scheme for {no_ms}"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
