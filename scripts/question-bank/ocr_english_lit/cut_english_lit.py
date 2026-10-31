"""Cut OCR's A-Level (H472) and AS (H072) English Literature papers into questions, each with its mark scheme and report.

    python3 scripts/question-bank/ocr_english_lit/cut_english_lit.py [work-dir] [--only=h472-02]
    # default work dir: scripts/question-bank/.work/ocr-english-lit

cut.py's image helpers, with OCR's Literature layout around them (aqa_english_lit/cut_english_lit.py is the
AQA counterpart, edexcel_english_lit/ Pearson's):
  - A paper is choices: a question per set text, its number with the text's name beside it ("1 Coriolanus"),
    and a student answers one question in each section. Each question is whole ("h072-01-jun24-07", label
    "7") or in parts, each part a crop of its own ("h47201-jun24-01-a", label "1(a)"). On H472/01 a Shakespeare
    question's parts are both answered ("And"): (a) on a printed passage, (b) on the play as a whole. On
    the AS papers they are alternatives ("Either (a) ... Or (b)").
  - A unit runs from its number (the first part from the question's, so its text's name comes with it) to
    the next number, part, "Either/Or/And", section or rubric: a passage printed under a question is its own.
  - Every question in a section after its first is an alternative (`or`), and so is every part after an
    "Or", so a paper's marks add up to what a student answers, as its front cover says (60 each).
  - H472/02 is sat on one of five topics ("The Gothic"), each two questions: an unseen passage (Questions
    1, 3, ...) and an essay comparing two of the topic's texts, led by one of its two core texts, (a) or (b),
    or by none, (c). A student answers both of their topic's, so the other four topics are alternatives,
    whole. The topic's list of texts is the stem its essay's three parts share ("h47202-jun24-02-stem.webp").
    On H472/01 Section 2's list of drama and poetry texts is the stem of its questions ("h47201-jun24-s2-07").
  - The schemes give a question (or part) a table of its own, "Question | Guidance | Marks", under the
    "Level Descriptors" printed once a section (on H472/01 once a Section 1 part; on H472/02 once for the
    unseen passages and once for the essays). The levels a question is marked on are stacked under its
    guidance, so no scheme is shown without its levels.
  - The reports head each question or part ("Question 1 (a)", "Question 1 (a) and (b)").
  - Each question is tagged to the text its heading names (texts.py); an unseen passage, an open "(c)"
    essay and H472/01's drama and poetry comparison to their topic's own entries.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-english-lit")] + flags
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import cut  # noqa: E402
import texts  # noqa: E402

WORK, ONLY = cut.WORK, cut.ONLY

SECTION = re.compile(r"^Section (\d)\b")
PART = re.compile(r"^\(([a-c])\)\s*(.*)$")
CHOICE = re.compile(r"^(Either|Or|And)$")
MARKS = re.compile(r"\[(\d+)\]")
RUBRIC = re.compile(r"^(In your answer to Question|Answer (one|both|Question|two)|Then answer|You should|You must answer|At least one text)")
REPORT_QUESTION = re.compile(r"^Questions? (\d{1,2})\s*(?:\(([a-c])\))?(?:\s*(?:and|&)\s*\(([a-c])\))?$")
REPORT_END = re.compile(r"^(Section \d( overview|, Part \([ab]\).*)?|Section \d: .{0,40}|Supporting you.*|Copyright information.*|Need to get in touch.*)$", re.I)


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold)] top to bottom."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in line["spans"])).strip()
            if t and spans:
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, "Bold" in spans[0]["font"]))
    return sorted(out)


def frame(page):
    """A paper page's content: under the page number, above the footer ("H472/01 Jun24", "© OCR 2024", "Turn over")."""
    w, h = page.rect.width, page.rect.height
    return pymupdf.Rect(40, 56, w - 36, h - 50)


def ms_frame(page):
    """A scheme page's content: under its running header ("H472/01 Mark Scheme June 2024") and the table's
    "Question | Guidance | Marks" row, above its page number."""
    w, h = page.rect.width, page.rect.height
    top, bottom = 30, h - 30
    lines = lines_of(page)
    for y0, x0, y1, t, _ in lines:
        if y0 < 60 and re.search(r"Mark Scheme|H[04]72/0\d|20\d\d$", t):
            top = max(top, min(y1, 54) + 3)  # November 2021's "October 2021" has a box far taller than its words
        if y0 > h - 70 and re.fullmatch(r"\d{1,3}", t):
            bottom = min(bottom, y0 - 3)
    heads = [y1 for y0, x0, y1, t, _ in lines if t in ("Question", "Guidance", "Marks") and y0 < top + 60]
    if heads and any(t == "Question" and y0 < top + 60 for y0, x0, y1, t, _ in lines):
        top = max(heads) + 1
    return pymupdf.Rect(28, top, w - 28, bottom)


def has_words(page, rect):
    return bool(re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=rect)))


def span(doc, start, end, framer):
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


def skip_page(page):
    t = page.get_text()
    return "BLANK PAGE" in t and len(t.strip()) < 120 or "Copyright Information" in t or "Topics" in t and "Pages" in t \
        or re.search(r"Section 1\b.*\n.*Question\s*\n\s*Page", t)


def qp_events(doc):
    """[(page, y0, y1, kind, value)] in reading order. Kinds: section, area, label, part, choice, marks, rubric."""
    events = []
    for pg in range(1, len(doc)):
        page = doc[pg]
        if skip_page(page):
            continue
        f = frame(page)
        lines = lines_of(page, f)
        for y0, x0, y1, t, bold in lines:
            if SECTION.match(t) and bold:
                events.append((pg, y0, y1, "section", SECTION.match(t).group(1)))
            elif texts.area(t) and bold and x0 < 60:
                events.append((pg, y0, y1, "area", texts.area(t)))
            # "10 ‘Self-belief is ...’": a two-digit number shares its line; a one-digit one has its own ("2 CITIZEN" is a speaker).
            elif re.fullmatch(r"\d|\d{2}(\s.*)?", t) and bold and x0 < 60:
                num, _, rest = t.partition(" ")
                beside = rest.strip() or next((l[3] for l in lines if abs(l[0] - y0) < 4 and l[1] > x0 + 10 and not re.fullmatch(r"\d+", l[3])), "")
                events.append((pg, y0, y1, "label", (num, beside)))
                if PART.match(rest.strip()):  # "10 (a) Henry Roth: Call It Sleep"
                    events.append((pg, y0 + 0.5, y1, "part", PART.match(rest.strip()).groups()))
            elif PART.match(t) and x0 < 80:
                events.append((pg, y0, y1, "part", PART.match(t).groups()))
            elif CHOICE.match(t) and x0 < 80:
                events.append((pg, y0, y1, "choice", t))
            elif RUBRIC.match(t) and x0 < 80:
                events.append((pg, y0, y1, "rubric", t))
            if MARKS.search(t) and x0 > 400:
                events.append((pg, y0, y1, "marks", int(MARKS.search(t).group(1))))
    return sorted(events, key=lambda e: (e[0], e[1]))


def qp_units(doc, component):
    """[dict(label, q, part, section, pieces, text, marks, code, or, stem_key, stem)] in order."""
    events = qp_events(doc)
    end = (len(doc) - 1, doc[-1].rect.height)
    bounds = {"section", "area", "label", "part", "choice", "rubric"}
    units, section, area, expected = [], "1", None, 1
    question, heading, after_or = None, "", False
    stems, first_q, first_area = {}, {}, None
    for n, (pg, y0, y1, kind, value) in enumerate(events):
        if kind == "section":
            section = value
        elif kind == "area":
            area = value
            first_area = first_area or value
        elif kind == "choice":
            after_or = value == "Or"
        elif kind == "label":
            num, beside = value
            if int(num) != expected:  # a line number or a page number
                continue
            expected += 1
            question, heading, after_or = int(num), beside, False
            nxt = events[n + 1] if n + 1 < len(events) else None
            if nxt and nxt[3] == "part" and nxt[0] == pg and nxt[1] - y0 < 20:
                continue  # "2" over "(a) F Scott Fitzgerald: The Great Gatsby": the part's unit starts here
            if not heading:  # "1" with "Coriolanus" on the next line
                line = next((l for l in lines_of(doc[pg], frame(doc[pg])) if l[0] > y0 + 4), None)
                heading = line[3] if line else ""
            ahead = []
            for e in events[n + 1:]:
                if e[3] in ("section", "area") or e[3] == "label" and int(e[4][0]) == expected:
                    break
                ahead.append(e)
            if any(e[3] == "part" for e in ahead):
                continue  # its parts are its units
            units.append(_unit(doc, events, n, end, bounds, question, None, section, area, heading, component))
        elif kind == "part" and question is not None:
            letter, beside = value
            start = n
            # The question's first part starts at its number, so its heading comes with it.
            if letter == "a":
                start = max(k for k in range(n + 1) if events[k][3] == "label" and int(events[k][4][0]) == question) \
                    if any(events[k][3] == "label" and int(events[k][4][0]) == question for k in range(n + 1)) else n
            u = _unit(doc, events, n, end, bounds, question, letter, section, area, beside, component, start=start, fallback=heading)
            u["after_or"] = after_or
            units.append(u)
            after_or = False
    # Alternatives: in a section (or, on H472/02, the paper) every question after the first, and a part after "Or".
    for u in units:
        key = u["area"] if component == "h472-02" else u["section"]
        first_q.setdefault(key, u["q"])
        if component == "h472-02":
            u["or"] = u["area"] != first_area or u.get("after_or", False)
        else:
            u["or"] = first_q[key] != u["q"] or u.get("after_or", False)
    # Stems: H472/02's lists of texts, from "In your answer to Question 2" to its "Either"; H472/01 Section 2's list.
    for u in units:
        if component == "h472-02" and u["part"]:
            r = next((e for e in events if e[3] == "rubric" and e[4].startswith(f"In your answer to Question {u['q']},")), None)
            either = next((e for e in events if r and (e[0], e[1]) > (r[0], r[1]) and e[3] == "choice"), None)
            if r and either:
                stems.setdefault(f"{u['q']:02d}", span(doc, (r[0], r[1] - 4), (either[0], either[1] - 4), frame))
                u["stem_key"] = f"{u['q']:02d}"
        elif component == "h472-01" and u["section"] == "2":
            s2 = next((e for e in events if e[3] == "section" and e[4] == "2"), None)
            q7 = next((e for e in events if e[3] == "label" and (e[0], e[1]) > (s2[0], s2[1])), None) if s2 else None
            if s2 and q7:
                stems.setdefault("s2", span(doc, (s2[0], s2[1] - 4), (q7[0], q7[1] - 6), frame))
                u["stem_key"] = "s2"
    for u in units:
        u["stem"] = stems.get(u.get("stem_key"), [])
    return units


def _unit(doc, events, n, end, bounds, q, part, section, area, heading, component, start=None, fallback=""):
    """A question or part: from its event (or `start`'s) to the next boundary. Its text is the one `heading` names,
    else the question's (`fallback`: a Shakespeare part's own line is its task, not the play)."""
    pg, y0 = events[start if start is not None else n][:2]
    stop = next((e for e in events[n + 1:] if e[3] in bounds and not (e[3] == "label" and e[0] == pg and abs(e[1] - y0) < 2)), None)
    stop_at = (stop[0], stop[1] - 5) if stop else end
    pieces = span(doc, (pg, y0 - 5), stop_at, frame)
    marks = [e[4] for e in events[n + 1:] if e[3] == "marks" and (e[0], e[1]) < (stop_at[0], stop_at[1] + 5)]
    text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
    code = None
    if component == "h472-02":
        code = f"{area}-unseen" if part is None else texts.find(heading) or f"{area}-comparison"
    elif component == "h472-01" and section == "2":
        code = "drama-and-poetry-pre-1900"
    else:
        code = texts.find(heading) or texts.find(fallback)
    return dict(q=q, part=part, label=f"{q}({part})" if part else str(q), section=section, area=area,
                pieces=pieces, text=text, marks=marks[0] if marks else None, code=code)


def ms_markers(ms):
    """Every question or part and every block of level descriptors, in reading order: [(page, y, kind, value)]."""
    out, current, tables = [], None, False
    for pg, page in enumerate(ms):
        text = page.get_text()
        # The questions' tables, from the first "Question | Guidance | Marks" row: before it, numbered instructions.
        tables = tables or bool(re.search(r"^\s*Question\s*$", text, re.M) and re.search(r"^\s*(Guidance|Marks)\s*$", text, re.M))
        if tables and re.search(r"^APPENDIX|Need to get in touch|Assessment Objectives Grid", text, re.M):
            out.append((pg, 0, "end", None))
            continue
        f = ms_frame(page)
        every = lines_of(page)
        lines = [l for l in every if l[0] >= f.y0 - 3 and l[2] <= f.y1 + 3]  # a number can sit just under the header row
        for y0, x0, y1, t, bold in lines:
            if re.match(r"^Level [Dd]escriptors", t) and x0 < 80:
                out.append((pg, y0 - 4, "levels", t))
            elif tables and re.fullmatch(r"\d{1,2}", t) and bold and x0 < 100:
                part = next((l[3][1] for l in every if abs(l[0] - y0) < 8 and re.fullmatch(r"\([a-c]\)", l[3])), None)
                label = t + (part or "")
                if label != current:
                    out.append((pg, y0 - 2, "label", label))
                    current = label
            elif tables and re.fullmatch(r"\([a-c]\)", t) and x0 < 130 and current and not any(abs(l[0] - y0) < 8 and re.fullmatch(r"\d{1,2}", l[3]) for l in lines):
                label = re.match(r"\d+", current).group() + t[1]
                if label != current:
                    out.append((pg, y0 - 2, "label", label))
                    current = label
    return sorted(out, key=lambda e: (e[0], e[1]))


def levels_key(heading, component):
    """Which questions a block of level descriptors marks: ("1", "a"), ("2", None), ("unseen", None)."""
    if re.search(r"unseen", heading, re.I):
        return ("unseen", None)
    if re.search(r"Comparative", heading, re.I):
        return ("essay", None)
    s = re.search(r"Section (\d)", heading)
    p = re.search(r"part \(([ab])\)", heading)
    return (s.group(1) if s else None, p.group(1) if p and component == "h472-01" else None)


def ms_questions(ms, component):
    """({label: (pieces, text)}, {levels key: pieces})."""
    markers = ms_markers(ms)
    first_table = next((m[0] for m in markers if m[2] == "label"), len(ms))
    end_of = lambda k: next(((m[0], m[1] - 2) for m in markers[k + 1:] if (m[0], m[1]) > markers[k][:2]), (len(ms) - 1, ms[-1].rect.height))  # noqa: E731
    schemes, levels = {}, {}
    for k, (pg, y, kind, value) in enumerate(markers):
        if kind == "levels":
            stop = end_of(k)
            if stop[0] >= first_table:  # the last block ends where the questions' tables begin
                stop = (first_table - 1, ms[first_table - 1].rect.height)
            levels.setdefault(levels_key(value, component), span(ms, (pg, y), stop, ms_frame))
        elif kind == "label" and value not in schemes:
            pieces = span(ms, (pg, y), end_of(k), ms_frame)
            schemes[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return schemes, levels


def report_sections(path):
    """{"1a": text, "7": text}: everything under a report's "Question 1 (a)" heading, to the next heading."""
    if not path or not os.path.exists(path):
        return {}
    out, current, buf = {}, None, []

    def flush():
        if current and buf:
            text = cap(re.sub(r"[ \t]+", " ", "\n".join(buf)).strip())
            for key in current:
                out.setdefault(key, text)
        buf.clear()

    for page in pymupdf.open(path):
        h = page.rect.height
        for y0, x0, y1, t, bold in lines_of(page):
            if y0 < 45 or y0 > h - 45 or re.fullmatch(r"\d{1,3}", t):
                continue
            m = REPORT_QUESTION.match(t)  # the headings are set in the body's font, a size up
            if m:
                flush()
                q, a, b = m.groups()
                current = [q + x for x in (a, b) if x] or [q]
                continue
            if REPORT_END.match(t):
                flush()
                current = None
                continue
            if current:
                buf.append(t)
    flush()
    return out


def cap(text, limit=6000):
    text = re.sub(r"\n(?=[a-z,;(])", " ", text)
    if len(text) <= limit:
        return text
    at = text.rfind(". ", 0, limit)
    return text[:at + 1 if at > limit // 2 else limit] + " …"


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    component = meta["component"]
    qp = pymupdf.open(qp_path)
    units = qp_units(qp, component)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes, levels = ms_questions(ms, component) if ms else ({}, {})
    reports = report_sections(er_path)
    parts, problems, saved = [], [], {}
    for u in units:
        q, part = u["q"], u["part"]
        key = u.get("stem_key")
        base = f"{set_id}-{key}-{q:02d}" if key == "s2" else f"{set_id}-{q:02d}"
        pid = f"{base}-{part}" if part else base
        if key and key not in saved:
            saved[key] = cut.save(render([(qp, pg, r) for pg, r in u["stem"]], 16), f"{set_id}-{key}-stem.webp")
        qimg = render([(qp, pg, r) for pg, r in u["pieces"]])
        label = f"{q}{part or ''}"
        msimg, ms_text = None, ""
        if label in schemes:
            mpieces, ms_text = schemes[label]
            if component == "h472-02":
                lk = ("unseen", None) if part is None else ("essay", None)
            else:
                lk = (u["section"], part if component == "h472-01" else None)
            grid = levels.get(lk) or levels.get((u["section"], None))
            images = [render([(ms, pg, r) for pg, r in mpieces], 12)]
            if grid:
                images.append(render([(ms, pg, r) for pg, r in grid], 12))
            else:
                problems.append(f"{pid}: no level descriptors {lk}")
            msimg = cut.stack(images)
        if not u["code"]:
            problems.append(f"{pid}: no set text ({u['text'][:60]!r})")
        parts.append({
            "id": pid, "set": set_id, **meta, "label": u["label"], "marks": u["marks"], "section": u["section"],
            "or": u["or"], "text_code": u["code"],
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": saved.get(key),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", u["text"]).strip()[:9000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": reports.get(label) or (reports.get(str(q)) if not part else None),
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
            print(f"{set_id}: {len(parts)} units {[p['label'] for p in parts]}, {no_ms} without scheme, "
                  f"{sum(1 for p in parts if p['er'])} reported, {marks} marks answered", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} units, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} units; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
