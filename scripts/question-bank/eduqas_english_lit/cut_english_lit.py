"""Cut Eduqas's A Level English Literature (A720QS) papers into questions, each with its mark scheme and examiner's comments.

    python3 scripts/question-bank/eduqas_english_lit/cut_english_lit.py [work-dir] [--only=a720u20-jun24]
    # work-dir: .work/eduqas-english-lit (fetch_english_lit.py); needs: pip install pymupdf pillow

eduqas_rs/cut_eduqas_rs.py's crop helpers (lines, crop, trim, stack, save), with the Literature
papers' layout around them. Every paper since June 2017 is set the same way:
  - Component 1, Poetry: Section A, one question per pre-1900 text ("Either," / "Or,", the text's
    heading, "1."), each in two parts, (i) on a poem or lines the question names [20] and (ii) on
    the text as a whole [40]; Section B, two questions on each prescribed pair of poets [60], under
    the pair's two headings. Component 2, Drama, the same: Section A a Shakespeare play, its extract
    printed under the heading, i) on the extract [15] and ii) on the play [45]; Section B two questions
    on each pair of plays [60]. Component 3, Unseen Texts: Section A an unseen prose passage from
    1880-1910 (question 1) and one from 1918-1939 (question 2), each with supporting extracts [50];
    Section B two unseen poems [30]. Component 4 is the Prose Study, non-exam assessment.
  - A question's number is "1." (to 2018) or two boxes, "0" "1" (from 2019); a student answers one
    question in each section, so every question in a section after its first is an alternative (`or`).
  - What a question's parts share is its stem: the text's heading (Component 1 Section A), the heading
    and the printed extract (Component 2 Section A), or the pair's headings and prescribed sections
    (Section B): "a720u20-jun24-01-i" and "a720u20-jun24-01-stem.webp". A one-part question's id ends
    "-q" ("a720u10-jun24-06-q") so its stem has a name of its own. Component 3's passage or poem is
    printed after its question's instruction, so it stays in the question's crop.
  - The mark scheme gives each question (and part) its notes, headed "Q1 (i)", "Q1" then "(i)", "Q 15",
    or two boxed digits (Component 2, 2023), with the question reprinted under it. The notes are read
    from the heading to the next one (or the next text's heading, or the section's grids); they're
    matched to the paper's questions by that reprinted text, since a few schemes misnumber one (June 2018
    Drama heads question 8 "Q9", June 2018 Poetry question 15 "Q14"). Each section's assessment grids
    (band descriptors for every AO, "Assessment Grid for Component 1 Section A part (ii)", over one or
    two pages) follow its notes, and a question's crop is its notes with its grid stacked under them.
  - The examiner's report is one for the A Level and series, a chapter per component ("COMPONENT 1:
    POETRY"), commented by question in some years ("Q1 (i)", "Question 8 was…", "1. King Lear"), by part
    and text in others ("Section A (i)", then "Chaucer"), by section in the rest: each question gets the
    most particular comments there are.

Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <question>-stem.webp, and <work-dir>/parts.json in
edexcel_english_lit/cut_english_lit.py's shape, for build_english_lit.py.
"""
import importlib.util, json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import texts  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-english-lit")
IMG = os.path.join(WORK, "img")

# The Religious Studies cutter's crop helpers, loaded from its file (both folders have a cut script of their own).
_spec = importlib.util.spec_from_file_location("cut_eduqas_rs", os.path.join(HERE, "..", "eduqas_rs", "cut_eduqas_rs.py"))
rs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rs)
rs.IMG = IMG
lines, crop, trim, stack, save = rs.lines, rs.crop, rs.trim, rs.stack, rs.save

MARKS = re.compile(r"\[(\d{1,2})\]")
# Which texts each section sets: a poem in Component 3 called "Hamlet" is not the play.
ALLOWED = {("1", "A"): "poetry-pre-1900", ("1", "B"): "poetry-post-1900", ("2", "A"): "shakespeare", ("2", "B"): "drama", ("3", "A"): "unseen"}
# The words a report's subheading names a text by ("Chaucer", "Hardy and Eliot", "King Lear").
REPORT_NAMES = [("chaucer", "chaucer"), ("donne", "donne"), ("milton", "milton"), ("keats", "keats"), ("blake", "blake"), ("rossetti", "rossetti"),
                ("hardy", "hardy-eliot"), ("lawrence", "lawrence-clarke"), ("yeats", "yeats-abse"), ("hughes", "hughes-plath"), ("larkin", "larkin-duffy"),
                ("heaney", "heaney-sheers"), ("lear", "king-lear"), ("antony", "antony-and-cleopatra"), ("hamlet", "hamlet"), ("henry", "henry-iv-part-1"),
                ("tempest", "the-tempest"), ("faustus", "faustus-enron"), ("malfi", "malfi-streetcar"), ("revenger", "revengers-tragedy-loot"),
                ("windermere", "windermere-betrayal"), ("measure", "measure-murmuring-judges")]


def frame(page, qp):
    """A page's text area: between its page number and its footer ("© WJEC CBAC Ltd.", "(A720U10-1)", "Turn over."),
    clear of a question paper's barcode in the right margin."""
    w, h = page.rect.width, page.rect.height
    top, bottom = 30, h - 25
    for l in lines(page):
        t, mid = l["text"], abs((l["x0"] + 10) - w / 2) < 45
        if not (t.startswith("©") or re.fullmatch(r"\(?A720U\d0-1\)?|Turn over\.?|JD\*.*|A720U\d0-1 EDUQAS.*", t) or mid and re.fullmatch(r"\d{1,3}", t)):
            continue
        if l["y1"] < 100:
            top = max(top, l["y1"] + 2)
        elif l["y0"] > h - 100:
            bottom = min(bottom, l["y0"] - 2)
    return pymupdf.Rect(20, top, 562 if qp and w < 700 else w - 20, bottom)


def heading(t):
    """The text a heading names ("John Donne: Selected Poems (Penguin Classics)", "King Lear", "Period 1880-1910"), or None:
    not a line of a question that names a text ("…presented in The Merchant’s Prologue and Tale. [40]")."""
    if re.search(r"[\[“”\"]|\.$", t) or len(t) > 40 and not re.search(r"[:(]", t):
        return None
    return texts.find(t)


def blank(page):
    t = page.get_text()
    return "BLANK PAGE" in t and len(t.strip()) < 90


def pieces(doc, start, end, qp):
    """[(page, rect)] from (page, y) down to (page, y), inside each page's text area; stretches with no words are dropped."""
    out = []
    for pg in range(start[0], end[0] + 1):
        page = doc[pg]
        if qp and blank(page):
            continue
        f = frame(page, qp)
        y0 = max(f.y0, start[1]) if pg == start[0] else f.y0
        y1 = min(f.y1, end[1]) if pg == end[0] else f.y1
        if y1 > y0 + 6:
            r = pymupdf.Rect(f.x0, y0, f.x1, y1)
            if re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=r)):
                out.append((pg, r))
    return out


def text_of(doc, ps):
    return re.sub(r"\s+", " ", " ".join(doc[pg].get_text("text", clip=r) for pg, r in ps)).strip()


def render(doc, ps, keep=24):
    return stack([trim(crop(doc, pg, r), keep) for pg, r in ps])


def boxed(ls, gap=(15, 35)):
    """Question numbers in two boxes, "0" "1": [(line, number)]."""
    digits = [l for l in ls if re.fullmatch(r"\d", l["text"]) and l["x0"] < 125 and l["bold"]]
    out = []
    for a in digits:
        b = next((o for o in digits if o is not a and abs(o["y0"] - a["y0"]) < 3 and gap[0] < o["x0"] - a["x0"] < gap[1]), None)
        if b and a["x0"] < 85:
            out.append((a, int(a["text"] + b["text"])))
    return out


# ---------- question paper ----------

RANK = {"section": 0, "heading": 1, "or": 2, "label": 3, "part": 4, "end": 5}


def qp_events(doc):
    """[(page, y, kind, value)] in reading order: sections, text headings (with their codes), "Either,"/"Or,",
    question numbers, parts and END OF PAPER."""
    ev = []
    for pg in range(1, len(doc)):
        page = doc[pg]
        if blank(page):
            continue
        ls = lines(page, frame(page, True))
        for l in ls:
            t, x, y = l["text"], l["x0"], l["y0"]
            if t.startswith("END OF PAPER"):
                ev.append((pg, y, "end", None))
            elif re.match(r"^Section [AB]\b", t) and l["bold"] and x > 100:
                ev.append((pg, y, "section", t[8]))
            elif re.match(r"^(Either|Or),?$", t) and x < 75:
                ev.append((pg, y, "or", t))
            elif x < 75 and re.match(r"^(\d{1,2})\.(?:\s|$)", t):
                ev.append((pg, y, "label", int(re.match(r"^(\d{1,2})", t).group(1))))
            elif 75 <= x < 140 and re.match(r"^\(?(i{1,2})\)(?:\s|$)", t):
                ev.append((pg, y, "part", re.match(r"^\(?(i{1,2})\)", t).group(1)))
            elif l["bold"] and x > 90 and heading(t):
                ev.append((pg, y, "heading", heading(t)))
        ev += [(pg, a["y0"], "label", n) for a, n in boxed(ls)]
    # A heading on its number's row ("0 1  King Lear", a few points lower) comes before it.
    labels = [e for e in ev if e[2] == "label"]
    ev = [(pg, min([y] + [l[1] - 0.5 for l in labels if l[0] == pg and abs(l[1] - y) < 12]), kind, value) if kind == "heading" else (pg, y, kind, value)
          for pg, y, kind, value in ev]
    return sorted(ev, key=lambda e: (e[0], round(e[1]), RANK[e[2]]))


def qp_questions(doc, comp):
    """[dict(q, section, code, stem pieces, parts [(part or None, pieces)])] in order."""
    ev = qp_events(doc)
    no = comp[5]  # "1" of "a720u10"
    out, section, code, block_top, expected = [], "A", None, None, 1
    last = (len(doc) - 1, doc[-1].rect.height)
    for n, (pg, y, kind, value) in enumerate(ev):
        if kind == "section":
            section, code, block_top = value, None, None
        elif kind == "heading":
            if texts.section_of(value) != ALLOWED.get((no, section)):
                continue
            if value != code or block_top is None or pg != block_top[0] or y - block_top[1] > 70:
                code, block_top = value, (pg, y)
        elif kind == "label" and value == expected:
            expected += 1
            later = ev[n + 1:]
            stop = next((e for e in later if e[2] in ("label", "or", "section", "end")
                         or e[2] == "heading" and texts.section_of(e[3]) == ALLOWED.get((no, section))), None)
            stop_at = (stop[0], stop[1] - 4) if stop else last
            tag = code if section == "A" or no != "3" else "unseen-poetry"
            q = {"q": value, "section": section, "code": tag, "stem": [], "parts": []}
            if no in "12" and section == "A":
                parts = [e for e in later if e[2] == "part" and (e[0], e[1]) < (stop_at[0], stop_at[1])]
                first = [e for e in parts if e[3] == "i"][:1]
                second = [e for e in parts if e[3] == "ii"][:1]
                if first and second:
                    top = min([(pg, y)] + ([block_top] if block_top else []))
                    q["stem"] = pieces(doc, (top[0], top[1] - 5), (first[0][0], first[0][1] - 4), True)
                    q["parts"] = [("i", pieces(doc, (first[0][0], first[0][1] - 5), (second[0][0], second[0][1] - 4), True)),
                                  ("ii", pieces(doc, (second[0][0], second[0][1] - 5), stop_at, True))]
                else:
                    q["parts"] = [(None, pieces(doc, (pg, y - 5), stop_at, True))]
            else:
                if no in "12" and block_top:
                    first = next((e for e in ev if (e[0], e[1]) > block_top and e[2] in ("or", "label")), None)
                    if first:
                        q["stem"] = pieces(doc, (block_top[0], block_top[1] - 5), (first[0], first[1] - 4), True)
                q["parts"] = [(None, pieces(doc, (pg, y - 5), stop_at, True))]
            out.append(q)
    return out


# ---------- mark scheme ----------

def grid_kind(text):
    return "ii" if re.search(r"part\s*\(ii\)", text, re.I) else "i" if re.search(r"part\s*\(i\)", text, re.I) else "B" if re.search(r"Section B", text, re.I) else "A"


def ms_events(doc):
    """[(page, y, kind, value)]: question headings ("label", (q, part or None)), lone parts, sections, text headings, grids."""
    ev = []
    for pg in range(len(doc)):
        page = doc[pg]
        ls = lines(page, frame(page, False))
        whole = page.get_text()
        if "Articulate informed" in whole and "marks" in whole:
            head = next((l for l in ls[:5] if re.search(r"Assessment Grid|^Component\s*\d.*(Section [AB]|part)", l["text"], re.I)), None)
            if head:
                ev.append((pg, head["y0"], "grid", grid_kind(head["text"])))
                continue
            if "Band" in whole and not any(e[2] == "grid" and e[0] == pg - 1 for e in ev):
                # A grid printed without its heading (Poetry June 2019, Section B): the section it follows says which
                section = next((e[3] for e in reversed(ev) if e[2] == "section"), "A")
                ev.append((pg, ls[0]["y0"] if ls else 40, "grid", "B" if section == "B" else "A"))
                continue
        for l in ls:
            t, x, y = l["text"], l["x0"], l["y0"]
            m = re.match(r"^Q\s*\.?\s*(\d{1,2})\b\s*(?:\(?(i{1,2})\))?", t)
            if m and x < 130:
                ev.append((pg, y, "label", (int(m.group(1)), m.group(2))))
            elif x < 110 and l["bold"] and re.match(r"^\(?(i{1,2})\)(?:\s|$)", t):
                ev.append((pg, y, "part", re.match(r"^\(?(i{1,2})\)", t).group(1)))
            elif re.match(r"^(Section|SECTION) [AB]\b", t) and len(t) < 80 and l["bold"]:
                ev.append((pg, y, "section", t[8]))
            elif l["bold"] and x > 90 and heading(t):
                ev.append((pg, y, "heading", heading(t)))
        ev += [(pg, a["y0"], "label", (n, None)) for a, n in boxed(ls, (10, 35))]
    rank = {"section": 0, "grid": 0, "heading": 1, "label": 2, "part": 3}
    return sorted(ev, key=lambda e: (e[0], round(e[1]), rank[e[2]]))


def ms_blocks(doc):
    """[{key: (q, part or None), pieces, text}] each question's notes, and {kind: pieces}, the grids."""
    ev = ms_events(doc)
    hard = ("label", "part", "grid", "section")
    last = (len(doc) - 1, doc[-1].rect.height)
    blocks, grids, q, pending = [], {}, None, None

    def stop_after(n, start):
        e = next((e for e in ev[n + 1:] if e[2] in hard or e[2] == "heading" and (e[0], e[1]) > (start[0], start[1] + 30)), None)
        return (e[0], e[1] - 3) if e else last

    for n, (pg, y, kind, value) in enumerate(ev):
        if kind == "grid":
            if value not in grids:
                e = next((e for e in ev[n + 1:] if e[2] in hard), None)
                grids[value] = pieces(doc, (pg, y - 4), (e[0], e[1] - 3) if e else last, False)
            q = None
            continue
        if kind == "section":
            q, pending = None, None
            continue
        if kind == "label":
            q, part = value
            nxt = next((e for e in ev[n + 1:] if e[2] in hard), None)
            if part is None and nxt and nxt[2] == "part" and nxt[3] == "i":
                pending = (pg, y)  # "Q1", its text's heading, then "(i)": part (i) starts at the number
                continue
            start, pending = (pg, y), None
        elif kind == "part" and q is not None:
            part = value
            start, pending = (pending if part == "i" and pending else (pg, y)), None
        else:
            continue
        ps = pieces(doc, (start[0], start[1] - 4), stop_after(n, start), False)
        blocks.append({"key": (q, part), "pieces": ps, "text": text_of(doc, ps)})
    return blocks, grids


def words(t):
    return re.findall(r"[a-z]{3,}", t.lower().replace("’", "'"))


def similarity(question, notes):
    a, b = words(question)[:40], set(words(notes)[:150])
    return sum(w in b for w in a) / max(1, len(a))


def match(blocks, key, question, used):
    """The scheme block for a question part: the one numbered for it, unless another reprints its question far more closely."""
    free = [b for b in blocks if id(b) not in used]
    if not free:
        return None, None
    scored = sorted(((similarity(question, b["text"]), b) for b in free), key=lambda s: -s[0])
    best_sim, best = scored[0]
    own = next(((s, b) for s, b in scored if b["key"] == key), None)
    if own and (own[0] >= best_sim - 0.15 or best_sim < 0.5):
        return own[1], None
    if best_sim >= 0.5:
        return best, f"scheme {best['key']} read for {key} ({best_sim:.2f} against {own[0] if own else 0:.2f})"
    # A number the scheme prints twice (Unseen Texts June 2018 heads question 4 "Q3"): the repeat, in order.
    if not own:
        taken = {b["key"] for b in blocks if id(b) in used}
        repeat = next((b for b in free if b["key"] in taken and b["key"][1] == key[1]), None)
        if repeat:
            return repeat, f"scheme's second {repeat['key']} read for {key}"
    return None, None


# ---------- examiner's report ----------

def report(path, comp_no):
    """{("q", 1) or ("t", "chaucer") or ("s", "A"): {part or None: text}}: the component's chapter, sorted by heading."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"(?m)^[ \t]*© WJEC CBAC Ltd\.?.*$", "", text)
    # The chapter's heading is "COMPONENT 2: DRAMA" or "Component 2: Drama"; the contents list names each too, so the longest run wins.
    # Eduqas's own slips too: "COMONENT 2: DRAMA" (June 2024), "COMPONENT: UNSEEN TEXTS" (June 2018), so the name will do for the number.
    heads = list(re.finditer(r"(?im)^[ \t]*COMP?ONENT\s*(\d)?\b[^\n]{0,40}$", text))
    names = {"POETRY": "1", "DRAMA": "2", "UNSEEN": "3", "PROSE": "4"}
    chunk = ""
    for n, m in enumerate(heads):
        if (m.group(1) or next((v for k, v in names.items() if k in m.group(0).upper()), None)) == comp_no:
            c = text[m.end(): heads[n + 1].start() if n + 1 < len(heads) else len(text)]
            chunk = c if len(c) > len(chunk) else chunk
    out, buf = {}, []
    state = {"section": None, "section_part": None, "part": None, "target": None}

    def flush():
        para = re.sub(r"\s+", " ", " ".join(buf)).strip()
        buf.clear()
        if para and state["target"] and not re.fullmatch(r"\d{1,3}", para) and not para.startswith("Supporting you"):
            out.setdefault(state["target"], {}).setdefault(state["part"], []).append(para)

    for raw in chunk.split("\n"):
        line = raw.strip()
        if not line:
            flush()
            continue
        # A heading is a short line of its own that names a section, a part, a question or a text ("Section A (i)", "Part (ii)",
        # "Q4(ii)", "1. King Lear", "Question 3: presentation of…", "Hardy and Eliot"); a paragraph that opens "Question 8 was…" is that question's.
        heading = len(line) < 50 and not line.endswith((".", ",", ";")) and line[0].isupper() or re.fullmatch(r"\(?i+\)", line)
        m = re.match(r"^Section ([AB])\b(?:\s*:?\s*\(?(i+)\))?", line)
        if m and heading:
            flush()
            state.update(section=m.group(1), section_part=m.group(2), part=m.group(2), target=("s", m.group(1)))
            continue
        m = re.match(r"^(?:Part\s*)?\(?(i+)\)$", line, re.I)
        if m and heading:
            flush()
            state["part"] = m.group(1).lower()
            continue
        m = re.match(r"^(?:Q\.?\s*|Question\s+)(\d{1,2})\b\s*(?:\((i+)\))?", line) or (re.match(r"^(\d{1,2})\.\s+[A-Z]", line) if heading else None)
        if m and (heading or not buf):
            flush()
            state.update(target=("q", int(m.group(1))), part=(m.group(2) if m.lastindex and m.lastindex >= 2 else None) or state["section_part"])
            if heading:
                continue
        elif heading and any(w in line.lower() for w, _ in REPORT_NAMES) and not re.search(r"\b(the|was|were|is)\b", line):
            flush()
            state.update(target=("t", next(c for w, c in REPORT_NAMES if w in line.lower())), part=state["section_part"])
            continue
        buf.append(line)
    flush()
    return {k: {pt: "\n".join(v) for pt, v in d.items()} for k, d in out.items()}


def comments(rep, q, part, code, section):
    """The most particular comments on a question part: on the question, on its text, or on its section."""
    for target in (("q", q), ("t", code), ("s", section)):
        d = rep.get(target, {})
        text = d.get(part) or d.get(None)
        if text and len(text) > 80:
            return cap(text)
    return None


def cap(text, limit=6000):
    if len(text) <= limit:
        return text
    cut_at = text.rfind(". ", 0, limit)
    return text[:cut_at + 1 if cut_at > limit // 2 else limit] + " …"


# ---------- one sitting ----------

def cut_set(job):
    set_id, files, meta = job
    try:
        qp = pymupdf.open(os.path.join(WORK, "pdf", files["qp"]["file"]))
        ms = pymupdf.open(os.path.join(WORK, "pdf", files["ms"]["file"])) if "ms" in files else None
        comp, no = meta["component"], meta["component"][5]
        questions = qp_questions(qp, comp)
        blocks, grids = ms_blocks(ms) if ms else ([], {})
        rep = report(os.path.join(WORK, "pdf", files["er"]["file"]), no) if "er" in files else {}
        parts, problems, used, firsts = [], [], set(), {}
        for qn in questions:
            q, section = qn["q"], qn["section"]
            stem_name, stem_text = None, ""
            if qn["stem"]:
                stem_name = save(render(qp, qn["stem"], 16), f"{set_id}-{q:02d}-stem.webp")
                stem_text = text_of(qp, qn["stem"])
            firsts.setdefault(section, q)
            for part, ps in qn["parts"]:
                pid = f"{set_id}-{q:02d}-{part or 'q'}"
                img = render(qp, ps)
                text = text_of(qp, ps)
                marks = [int(m) for m in MARKS.findall(text)]
                msimg, ms_text = None, ""
                block, note = match(blocks, (q, part), text, used) if blocks else (None, None)
                if note:
                    problems.append(f"{pid}: {note}")
                if block:
                    used.add(id(block))
                    kind = section if no == "3" else (part if section == "A" else "B")
                    grid = grids.get(kind, [])
                    if not grid:
                        problems.append(f"{pid}: no {kind} grid")
                    msimg = stack([render(ms, block["pieces"], 12)] + ([render(ms, grid, 12)] if grid else []), gap=28)
                    ms_text = block["text"]
                elif ms:
                    problems.append(f"{pid}: no scheme")
                if not qn["code"]:
                    problems.append(f"{pid}: no set text")
                parts.append({
                    "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": part,
                    "label": f"{q}({part})" if part else str(q), "marks": marks[-1] if marks else None, "section": section,
                    "or": firsts[section] != q, "text_code": qn["code"],
                    "qp": save(img, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
                    "w": img.width if img else 0, "h": img.height if img else 0,
                    "text": (text + " " + stem_text).strip()[:4000], "msText": ms_text[:800],
                    "er": comments(rep, q, part, qn["code"], section),
                })
        return set_id, parts, problems, None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc(limit=6)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4].upper(), "series": series})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    parts_path = os.path.join(WORK, "parts.json")
    all_parts = [p for p in json.load(open(parts_path)) if not p["set"].startswith(ONLY)] if ONLY and os.path.exists(parts_path) else []
    problems = []
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(cut_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            marks = sum(p["marks"] or 0 for p in parts if not p["or"])
            print(f"{set_id}: {len(parts)} parts {[p['label'] for p in parts]}, {no_ms} without scheme, "
                  f"{sum(1 for p in parts if p['er'])} reported, {marks} marks answered", file=sys.stderr, flush=True)
            want = {"1": 120, "2": 120, "3": 80}[set_id[5]]
            if marks != want:
                problems.append(f"{set_id}: {marks} marks answered, not {want}")
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
