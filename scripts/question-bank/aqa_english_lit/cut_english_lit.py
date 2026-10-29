"""Cut AQA's GCSE English Literature papers into questions, each with its extract, its mark scheme and its report.

    python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py [work-dir] [--only=87021]   # default scripts/question-bank/.work/aqa-english-lit-gcse
    python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=a [work-dir]       # A-Level 7712 and AS 7711, default .work/aqa-english-lit-a
    python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=b [work-dir]       # A-Level B 7717 and AS 7716, default .work/aqa-english-lit-b

cut.py's label finder and image helpers, with Literature's own layout around them:
  - A paper is choices: a question on each set text, and the student answers on the
    text they studied. Paper 1: Section A Shakespeare (01-06), Section B the
    19th-century novel (07-13). Paper 2: Section A modern prose or drama, two
    questions a text (01-24 or so), Section B the poetry anthology, a question a
    cluster, Section C two unseen-poetry questions (27.1, 27.2). In November 2021
    and June 2022 Paper 1 was three papers, one a section (1M modern texts, 1N
    the novel, 1P the anthology), and Paper 2 Shakespeare and unseen poetry.
  - The answers go in a separate answer book, so a question runs from its label to
    the next "or", heading or label, whatever comes between: the extract printed
    under the label (Shakespeare, the novel), the question printed again under the
    same label, the named poem printed after an anthology question. An unseen
    question's poem comes before its label, so 27.2 runs from the end of 27.1, and
    27.1's poem, which 27.2 compares too, is the stem both share ("87022-jun24-27-stem.webp").
  - So every other question is whole and carries its own extract. Its id is
    "87021-jun24-01", "87022-jun24-27-p1"; its label "01", "27.1".
  - The marks are "[30 marks]" and, where spelling and grammar count, "AO4 [4 marks]":
    a question's marks are both (34), so a paper's add up to its maximum.
  - The schemes give each question a page of its own: the text's name, "Question 1",
    the question, then its indicative content. The levels it is marked on are a
    landscape grid printed once per section ("Section A: Questions 01-24 (30 marks
    ...)"); the AO4 descriptors once per paper. Both are stacked under the
    question's own page, so no scheme is shown without its levels. A question with
    its own grid (the 8-mark unseen comparison) takes none.
  - Each question is tagged to its set text from the scheme's heading ("Charles
    Dickens: A Christmas Carol"), else the paper's (texts.py).
  - The examiner's reports go section by section, a paragraph or two a text. Each
    question gets its section's paragraphs that name its text, or, where none
    does, the section's paragraphs that name no text.

The A-Level (7712) and AS (7711) papers are laid out the same way, with three differences:
  - Paper 2A (WW1 and its aftermath) and 2B (Modern times) offer three options, each a
    Section A on a set text and a Section B of two questions on an unseen prose extract,
    printed in the insert. Section B's questions are "77122a-jun24-b-05", and their stem is
    the section's introduction and the insert's extract ("77122a-jun24-b-stem.webp").
    The three options print the same Section B (05, 11, 17 and 06, 12, 18). A student
    answers one option, so options 2 and 3 are alternatives to option 1, whole.
  - The schemes print the text's name under "Question 01", one levels grid for every
    question, and Section B once for all three options ("Questions 05, 11 and 17").
  - The reports head each question ("Question 1 Othello", "Questions 5, 11, 17").

Specification B (7717 and AS 7716) is laid out like the GCSE's Paper 1: a question per set text, each
section either/or, the extract printed under the question. Each paper is sat as one of two options, a
genre (1A tragedy, 1B comedy; 2A crime, 2B protest writing; AS 1A/2A tragedy, 1B/2B comedy), a component
of its own, so a question is tagged to a text of its option's genre (texts.for_option). Otherwise:
  - The questions that name no text are their genre's own topics (texts.unheaded): Paper 2's unseen
    extract (Section A) and the two-text questions of Section C. Section C's rubric, which lists the
    texts it may be answered on, is their stem ("77171a-jun24-c-07", "77171a-jun24-c-stem.webp").
  - The schemes print each question's label in a box, as the papers do, and its indicative content
    runs to the next label. The one levels grid (landscape, "Band 5") is stacked under each.
  - The reports head a question ("Question 1", "Question 1: The Taming of the Shrew") or a section.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
A_LEVEL = "--level=a" in flags
B = "--level=b" in flags  # Specification B; A_LEVEL is Specification A's
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-english-lit-a" if A_LEVEL else "aqa-english-lit-b" if B else "aqa-english-lit-gcse")] + flags
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import cut  # noqa: E402
import texts  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks
SPEC = texts.A_LEVEL if A_LEVEL else texts.B if B else texts.GCSE

# Lines that end a question: the either/or, a section, the end, a pointer to the next page.
QP_STOP = re.compile(r"^(Either|EITHER|or|OR|and)$|^Option [1-3]$|^(Section|SECTION) [A-C]\b|^Answer (one|both|all) questions?\b|^END\s+OF\s+QUESTIONS|^Turn over for|^There are no questions")
# Specification B's rubrics between a section's questions: the texts Sections B and C may be answered on.
QP_STOP_B = re.compile(r"^Over Section B and Section C\b|^In (this section|your answer) you must\b|^You can write about\b")
SECTION = re.compile(r"^(?:Section|SECTION) ([A-C])\b")
MARKS = re.compile(r"\[(\d+) marks?\]")
MS_QUESTION = re.compile(r"^Questions? (\d{1,2})(?:\.(\d))?((?:\s*(?:,|and)\s*\d{1,2})*)$")
GRID = re.compile(r"(?:Questions? (\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?)?\s*[–-]?\s*\((\d+) marks")
GRID_SECTIONS = re.compile(r"^Sections? ([A-C])(?: and ([A-C]))?\b")


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold)] top to bottom."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in line["spans"])).strip()
            if t and spans:
                # Specification B's June 2025 reports set their headings in a medium weight.
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, all("Bold" in s["font"] or B and "Medium" in s["font"] and s["size"] > 12 for s in spans)))
    return sorted(out)


def frame(page):
    """A paper page's content: under the page number, above "Turn over" and the footer."""
    w, h = page.rect.width, page.rect.height
    top, bottom = 48, h - 46
    for y0, x0, y1, t, _ in lines_of(page):
        if y0 < 50:
            top = max(top, y1 + 3)
        if y0 > h - 60 or (t.startswith("Turn over") and y0 > h - 80) or re.fullmatch(r"\*\d+\w*\*", t):
            bottom = min(bottom, y0 - 4)
    return pymupdf.Rect(38, top, w - 36, bottom)


def ms_frame(page):
    """A scheme page's content: under the running header ("MARK SCHEME – GCSE ENGLISH LITERATURE – …"), above the page number."""
    w, h = page.rect.width, page.rect.height
    lines = lines_of(page)
    head = [y1 for y0, x0, y1, t, _ in lines if y0 < 60]
    foot = [y0 for y0, x0, y1, t, _ in lines if y0 > h - 60]
    top, bottom = max(head) + 3 if head else 52, min(foot) - 3 if foot else h - 46
    for d in page.get_drawings():  # the header and footer rules, drawn out to the page's edge
        r = d["rect"]
        if r.height < 3 and r.width > 300 and r.x1 > w - 5:
            top = max(top, r.y1 + 2) if r.y0 < 90 else top
            bottom = min(bottom, r.y0 - 2) if r.y0 > h - 90 else bottom
    return pymupdf.Rect(30, top, w - 28, bottom)


def has_words(page, rect):
    return bool(re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=rect)))


def span(doc, start, end, framer):
    """Pieces from (page, y) down to (page, y), page by page inside the frame. Pieces with no words are dropped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        if pg > start[0] and cut.NOT_QUESTIONS.search(doc[pg].get_text()):
            continue
        f = framer(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        if bottom > top + 8:
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if has_words(doc[pg], r):
                pieces.append((pg, r))
    return pieces


def heading_of(line):
    """A line that names a set text or a section, as a heading prints it, or None."""
    y0, x0, y1, t, bold = line
    # Not a speaker's name in an extract ("MACBETH"): those are capitals.
    return t if bold and len(t) < 90 and t != t.upper() and texts.find(SPEC, t) else None


def qp_events(doc):
    """Every label, stop, heading and marks line in reading order: [(page, y0, y1, kind, value)].
    A heading is also a stop (it opens the next text's questions), unless it is on a label's own row ("01 Macbeth")."""
    events = []
    for pg, page in enumerate(doc):
        if cut.NOT_QUESTIONS.search(page.get_text()) and not cut.left_labels(page, 75, True):
            continue
        f = frame(page)
        labels = cut.left_labels(page, 75, True, with_x=True)
        for y, q, part, x in labels:
            events.append((pg, y, y, "label", f"{q}.{part}" if part else q))
        for line in lines_of(page):
            y0, x0, y1, t, bold = line
            if not f.y0 - 4 <= y0 <= f.y1 + 4:
                continue
            on_label = any(abs(y0 - y) < 6 for y, *_ in labels)
            if heading_of(line):
                events.append((pg, y0, y1, "heading", t))
                if not on_label:
                    events.append((pg, y0, y1, "stop", t))
            elif QP_STOP.match(t) and (bold or not re.fullmatch(r"Either|EITHER|or|OR|and|Option [1-3]", t)) or B and QP_STOP_B.match(t):
                events.append((pg, y0, y1, "stop", t))
            if MARKS.search(t):
                events.append((pg, y0, y1, "marks", t))
    return sorted(set(events), key=lambda e: (e[0], e[1], e[3] != "stop"))


def qp_questions(doc):
    """[(label, section, pieces, text, marks, heading, stem, option, both, intro)] in order. The first
    unseen question's poem, printed before its label, is the stem the two unseen questions share
    (both compare it). `option` is the A-Level paper's option (1 elsewhere), `both` whether the
    section's questions are all answered, `intro` the lines between a section's heading and its first label."""
    events = qp_events(doc)
    out, seen, section, heading, option, both = [], set(), "A", None, 1, {}
    last_break = (0, 0)  # the foot of the last stop or question, where an unseen poem starts
    section_top, intros = (0, 0), {}
    for n, (pg, y, y1, kind, value) in enumerate(events):
        if kind == "heading":
            heading = value
            continue
        if kind == "stop":
            m = SECTION.match(value)
            if m:
                section, heading, section_top = m.group(1), value, (pg, y1 + 4)
            if re.match(r"^Option ([1-3])$", value):
                option = int(value[-1])
            if re.match(r"^Answer both questions", value):
                both[(option, section)] = True
            last_break = (pg, y1 + 4)
            continue
        if kind != "label" or value in seen:
            continue
        seen.add(value)
        # A heading on the label's own row ("01 Othello – William Shakespeare") is this question's, though it sorts after the label.
        heading = next((e[4] for e in events[n + 1:n + 4] if e[3] == "heading" and e[0] == pg and abs(e[1] - y) < 6), heading)
        if (option, section) not in intros:
            intros[(option, section)] = span(doc, section_top, (pg, y - 6), frame)
        part = "." in value
        start = last_break if part else (pg, y - 6)
        end, rest = (len(doc) - 1, doc[-1].rect.height), events[n + 1:]
        for k, (pg2, y2, y2b, kind2, value2) in enumerate(rest):
            if kind2 == "stop" or kind2 == "label" and value2 != value:
                end = (pg2, y2 - 6)
                break
            # An unseen question ends under its marks (and its AO4 line): the next one's poem follows.
            if part and kind2 == "marks":
                after = rest[k + 1] if k + 1 < len(rest) else None
                if after and after[3] == "marks" and after[0] == pg2 and after[1] - y2b < 30:
                    continue
                end = (pg2, y2b + 5)
                break
        stem = span(doc, start, (pg, y - 6), frame) if value.endswith(".1") else []
        pieces = span(doc, (pg, y - 6) if stem else start, end, frame)
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in stem + pieces)
        marks = [int(x) for x in MARKS.findall(text)]
        out.append((value, section, pieces, text, sum(marks) if marks else None, heading, stem, option, both, intros[(option, section)]))
        last_break = end if part else last_break
    return out


def ms_questions(ms):
    """{label: (pieces, text, heading)}: each question's own page(s), from the heading over "Question N" to the next one."""
    starts = []  # (page, y, label, heading)
    for pg, page in enumerate(ms):
        if page.rect.width > page.rect.height:
            continue
        f = ms_frame(page)
        lines = lines_of(page, f)
        for i, (y0, x0, y1, t, bold) in enumerate(lines):
            m = MS_QUESTION.match(t)
            if not m or not bold:
                continue
            labels = [f"{int(m.group(1)):02d}" + (f".{m.group(2)}" if m.group(2) else "")] + [f"{int(x):02d}" for x in re.findall(r"\d+", m.group(3) or "")]
            above = [l for l in lines[max(0, i - 2):i] if l[4] and y0 - l[0] < 60]
            # A-Level crops start at "Question": what's over it is a section's or an option's heading, and Section B's serves all three options.
            top = above[0][0] if above and not A_LEVEL else y0
            # The text's name: over "Question 1" (GCSE), or under it (A-Level, "Othello – William Shakespeare").
            below = [l for l in lines[i + 1:i + 4] if l[4] and len(l[3]) > 3][:1] if A_LEVEL else []
            heading = " ".join(l[3] for l in above + below)
            for label in labels:
                starts.append((pg, top - 4, label, heading))
    out = {}
    for k, (pg, y, label, heading) in enumerate(starts):
        later = [st for st in starts[k + 1:] if (st[0], st[1]) > (pg, y)]  # a heading over several questions starts once
        if later:
            end = (later[0][0], later[0][1] - 2)
        else:
            end = (len(ms) - 1, ms[-1].rect.height)
        # A grid (landscape) or the end of the scheme ends it too.
        for p in range(pg + 1, end[0] + 1):
            if ms[p].rect.width > ms[p].rect.height:
                end = (p - 1, ms[p - 1].rect.height)
                break
        pieces = span(ms, (pg, y), end, ms_frame)
        out.setdefault(label, (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces), heading))
    return out


def stacked_labels(page):
    """Labels whose two boxes are printed one over the other ("0" then "1", AS June 2022): [(y0, '01', None)]."""
    digits = [(s["bbox"][1], s["bbox"][0], s["text"].strip()) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
              for s in l["spans"] if s["bbox"][0] < 75 and "Bold" in s["font"] and re.fullmatch(r"\d", s["text"].strip())]
    return [(y, a + b, None) for y, x, a in digits for y2, x2, b in digits if 15 < y2 - y < 35 and abs(x2 - x) < 3]


def ms_questions_b(ms):
    """Specification B: {label: (pieces, text, heading)}, each from its boxed label (portrait pages) to the next one,
    or to the end of the scheme. The heading is the first line by or under the label ("Othello – William Shakespeare")."""
    starts = []
    for pg, page in enumerate(ms):
        if page.rect.width > page.rect.height:
            continue
        f = ms_frame(page)
        lines = lines_of(page, f)
        for y, q, part in cut.left_labels(page, 75, True) or stacked_labels(page):
            if not f.y0 - 4 <= y <= f.y1:
                continue
            below = [l[3] for l in lines if y - 4 <= l[0] < y + 40 and l[1] > 60 and not re.fullmatch(r"[\d.\s]+", l[3])][:1]
            starts.append((pg, y - 4, f"{q}.{part}" if part else q, " ".join(below)))
    out = {}
    for k, (pg, y, label, heading) in enumerate(starts):
        end = (starts[k + 1][0], starts[k + 1][1] - 2) if k + 1 < len(starts) else (len(ms) - 1, ms[-1].rect.height)
        pieces = span(ms, (pg, y), end, ms_frame)
        out.setdefault(label, (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces), heading))
    return out


def ms_grids_b(ms):
    """Specification B's one levels grid: from the page that heads it "How to arrive at (a) mark" (landscape, or portrait
    in AS June 2022), through the pages after it that go on with its bands."""
    pieces = []
    for pg, page in enumerate(ms):
        text = page.get_text()
        if re.search(r"How to arrive at (a )?mark", text) and not pieces or pieces and pieces[-1][0] == pg - 1 and re.search(r"\bBand [1-4]\b", text):
            pieces.append((pg, ms_frame(page)))
    return [[None, None, 0, pieces, set()]] if pieces else []


def ms_grids(ms):
    """The levels grids: [(first, last, marks, pieces, sections)], each the landscape pages from its heading on.
    A heading names its questions ("Questions 01–24"), or only its section ("Section C: Unseen poetry – (24 marks …)")."""
    grids = []
    for pg, page in enumerate(ms):
        if page.rect.width <= page.rect.height:
            continue
        f = ms_frame(page)
        head = " ".join(l[3] for l in lines_of(page, f)[:3])
        m = GRID.search(head)
        if m and not head.startswith("Level"):
            secs = GRID_SECTIONS.match(head)
            first = int(m.group(1)) if m.group(1) else None
            grids.append([first, int(m.group(2) or m.group(1)) if first else None, int(m.group(3)), [(pg, f)], set(g for g in secs.groups() if g) if secs else set()])
        elif grids and grids[-1][3][-1][0] == pg - 1:
            grids[-1][3].append((pg, f))
        else:  # an A-Level grid, for every question
            grids.append([None, None, 0, [(pg, f)], set()])
    return grids


def ao4_piece(ms):
    """The AO4 descriptors: the page headed "Assessment of AO4", from the heading down."""
    for pg, page in enumerate(ms):
        f = ms_frame(page)
        for y0, x0, y1, t, bold in lines_of(page, f):
            if t.startswith("Assessment of AO4"):
                return [(pg, pymupdf.Rect(f.x0, y0 - 4, f.x1, f.y1))]
    return []


REPORT_SECTION = re.compile(r"^Section ([A-C])\b|^(Shakespeare|The 19th[- ]century novel|Modern (prose or drama|texts)|Poetry( anthology)?|Unseen poetry)$", re.I)
# A heading over the whole paper's questions ("The Texts" in the one-section papers of 2021-22).
REPORT_ALL = re.compile(r"^(The Texts|Comments on Individual Questions)$", re.I)
REPORT_END = re.compile(r"(Advice for students|Mark Ranges and Award of Grades|Assessment Objectives?\b|AO\d?$|Further support|Summary$|General (Overview|Introduction)|Introduction$|Overview of Entry|Concluding Remarks|Enhanced Results|Professional development)", re.I)
# The A-Level reports' general parts, before and after their questions ("Part Two: Priorities", "Final points").
REPORT_END_A = re.compile(r"(Part (One|Two|Three)\b(?!: Feedback)|Final points|Extracts?\b|Comparison\b|Question key words|Genre-specific|Introductory comments|Guidance on priorities|General Remarks|Converting Marks|Summary$|Overall performance|Areas where)", re.I)
# A heading over Section B's questions in the general part: "Extract: unseen prose (Section B: Questions 5, 11, 17)".
REPORT_QUESTIONS_IN = re.compile(r"Questions? (\d{1,2}(?:\s*(?:,|and|&)\s*\d{1,2})+)")
# "Question 4", and at A-Level "Question 1 Othello", "Questions 5, 11, 17".
REPORT_QUESTION = re.compile(r"Questions? (\d{1,2})((?:\s*(?:,|and|&)\s*\d{1,2})*)\b" + (r".*" if A_LEVEL or B else r"(?:\.\d)?"))
# Specification B's reports' general parts ("Knowing the text", "Specific comments about 1A: Aspects of Tragedy").
REPORT_END_B = re.compile(r"(Introductory comments|Knowing the text|What is getting in the way|Answering the precise question|AO\d\b|Specific comments|Rubric Infringements?|(Open|Closed) [Bb]ook|Conclusion|Looking forward|General comments|Overview)", re.I)


def report_paragraphs(path):
    """[(section, paragraph)]: the report's paragraphs under each section heading ("Section A: Shakespeare"), in order.
    Read line by line: a bold line is a heading, and a gap wider than the line spacing ends a paragraph."""
    if not path or not os.path.exists(path):
        return []
    out, section, para, last = [], None, [], None
    def flush():
        if section and para and len(" ".join(para)) > 40:
            out.append((section, re.sub(r"\s+", " ", " ".join(para)).replace("• ", "\n• ").strip()))
        para.clear()
    for page in pymupdf.open(path):
        h = page.rect.height
        for y0, x0, y1, t, bold in lines_of(page):
            if y0 < 40 or y0 > h - 60 or re.match(r"^(REPORT ON THE EXAMINATION|©|\d+ of \d+$)", t):
                continue
            if bold and len(t) < 70 or re.match(r"^Section [A-C] [–:-]", t) or REPORT_END.fullmatch(t):
                flush()
                m = REPORT_SECTION.match(t)
                q = REPORT_QUESTION.fullmatch(t)
                if m:
                    section = m.group(1).upper() if m.group(1) else t
                elif q:
                    section = "Q" + ",".join(str(int(x)) for x in re.findall(r"\d+", q.group(1) + q.group(2)))
                elif A_LEVEL and REPORT_QUESTIONS_IN.search(t):
                    section = "Q" + ",".join(str(int(x)) for x in re.findall(r"\d+", REPORT_QUESTIONS_IN.search(t).group(1)))
                elif A_LEVEL and REPORT_END_A.match(t) or B and REPORT_END_B.match(t):
                    section = None
                elif (A_LEVEL or B) and texts.find(SPEC, t):
                    section = "T:" + texts.find(SPEC, t)  # a text's heading, over its questions' paragraphs
                elif REPORT_ALL.match(t):
                    section = "ALL"
                elif REPORT_END.match(t):
                    section = None
                last = None
                continue
            if last is not None and (y0 - last > (y1 - y0) * 1.45 or y0 < last - 100):
                flush()
            if t != "•":
                para.append(t)
            last = y0
        last = None
    flush()
    return out


def report_for(paras, section, code, single, q):
    """A question's report: its own, where the report heads it "Question 1"; else its section's
    paragraphs that name its text, else those that name no text."""
    own = [t for s, t in paras if s.startswith("Q") and str(int(q.split(".")[0])) in s[1:].split(",")]
    if own:
        return "\n\n".join(own)
    mine = [t for s, t in paras if single or s in (section, "ALL", "T:" + (code or ""))]
    named = [t for t in mine if texts.find(SPEC, t) == code or any(pat.search(t) for _, c, _, pat in texts.flat(SPEC) if c == code)]
    if named:
        return "\n\n".join(named)
    general = [t for t in mine if not texts.find(SPEC, t)]
    return "\n\n".join(general) or None


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def insert_extract(ins):
    """An A-Level insert's extract: every page after the cover, leaving out the blank pages and the copyright notice."""
    pieces = []
    for pg, page in enumerate(ins):
        if pg == 0 or re.search(r"There is no (material|text) printed", page.get_text()):
            continue
        f = frame(page)
        notice = next((y0 for y0, x0, y1, t, _ in lines_of(page, f) if t.startswith("Copyright information")), None)
        if notice is not None:
            f = pymupdf.Rect(f.x0, f.y0, f.x1, notice - 6)
        if f.height > 8 and has_words(page, f):
            pieces.append((ins, pg, f))
    return pieces


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    global SPEC
    if B:  # a question is on a text of its option's genre
        SPEC = texts.for_option(meta["component"])
    qp = pymupdf.open(qp_path)
    questions = qp_questions(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = (ms_questions_b(ms) if B else ms_questions(ms)) if ms else {}
    grids = (ms_grids_b(ms) if B else ms_grids(ms)) if ms else []
    ao4 = ao4_piece(ms) if ms else []
    paras = report_paragraphs(er_path)
    single = len({s for s, _ in paras}) <= 1  # the 2021-22 papers of one section each
    parts, problems = [], []
    firsts = {}
    stems = {}
    insert = pymupdf.open(ins_path) if ins_path and os.path.exists(ins_path) else None
    for q, section, pieces, text, marks, heading, stem, option, both, intro in questions:
        # "87022-jun24-27-p1": the site finds the stem by dropping the last part ("87022-jun24-27-stem.webp").
        qnum, _, part = q.partition(".")
        pid = f"{set_id}-{qnum}-p{part}" if part else f"{set_id}-{q}"
        if stem:
            stems[qnum] = cut.save(render([(qp, pg, r) for pg, r in stem], 16), f"{set_id}-{qnum}-stem.webp")
        linking = A_LEVEL and section == "B" and insert is not None  # Paper 2A/2B Section B: the insert's extract
        if linking:
            pid, qnum = f"{set_id}-b-{q}", "b"
            if "b" not in stems:
                stems["b"] = cut.save(render([(qp, pg, r) for pg, r in intro] + insert_extract(insert), 16), f"{set_id}-b-stem.webp")
        rubric = B and texts.unheaded(meta["component"], section)
        if rubric and section == "C":  # Specification B's two-text questions: the section's rubric and its list of texts
            pid, qnum = f"{set_id}-c-{q}", "c"
            if "c" not in stems:
                rubric_pieces = [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, min([r.y1] + [y0 - 4 for y0, x0, y1, t, _ in lines_of(qp[pg], r) if t in ("Either", "EITHER")])))
                                 for pg, r in intro]  # down to its "Either"
                stems["c"] = cut.save(render([(qp, pg, r) for pg, r in rubric_pieces if r.height > 8], 16), f"{set_id}-c-stem.webp")
        qimg = render([(qp, pg, r) for pg, r in pieces])
        msimg, ms_text, ms_heading = None, "", ""
        if q in schemes:
            mpieces, ms_text, ms_heading = schemes[q]
            images = [render([(ms, pg, r) for pg, r in mpieces], 12)]
            if not re.search(r"\bLevel 1\b", ms_text):
                n = int(q.split(".")[0])
                grid = next((g for g in grids if (g[0] <= n <= g[1] if g[0] else section in g[4] or not g[4]) and (not marks or g[2] <= marks)), None)
                if grid:
                    images.append(render([(ms, pg, r) for pg, r in grid[3]], 12))
                else:
                    problems.append(f"{pid}: no levels grid")
            if re.search(r"AO4", text) and ao4 and not A_LEVEL:
                images.append(render([(ms, pg, r) for pg, r in ao4], 12))
            msimg = cut.stack(images)
        code = rubric or texts.for_component(texts.find(SPEC, ms_heading, heading or "", text[:300]), meta["component"])
        if not code:
            problems.append(f"{pid}: no set text ({heading!r}, {ms_heading!r})")
        firsts.setdefault((option, section), q)
        # In a section of choices, every question after the first is an alternative to it; both unseen questions are
        # answered, as are both of an A-Level Section B. A paper's options 2 and 3 are alternatives to option 1.
        alternative = option > 1 or not both.get((option, section)) and "." not in q and firsts[(option, section)] != q
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q.split(".")[0], "part": q.split(".")[1] if "." in q else None,
            "label": q, "marks": marks, "section": section, "or": alternative, "text_code": code,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stems.get(qnum),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text).strip()[:9000],  # the whole extract, so a quotation finds its question
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": report_for(paras, section, code, single, q) if code else None,
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
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", ""), "cr": files["qp"].get("cr", False)})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
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
