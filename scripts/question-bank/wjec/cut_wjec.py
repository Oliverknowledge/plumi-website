"""Cut WJEC's A-Level papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/wjec/cut_wjec.py [work-dir] [--only=2420u10] [--whole] [--squeeze]
    # work-dir: .work/wjec (fetch_wjec.py); --whole for maths, a whole question at a time
    # --squeeze: Further Maths (.work/wjec-fm): take the dotted answer lines out of question crops
    # needs: pip install pymupdf pillow

WJEC's papers are close enough to Pearson's that edexcel_sciences/cut_pearson.py does
most of the work, used here as a library, unchanged: its pages, crops, regions across
page breaks, marks and mark scheme tables (WJEC's schemes are ruled tables under a
"Question" header, the label split across three columns, "1 | (a) | (i)", which it
already joins). What differs, and is set here in its place for this run only:
  - question numbers carry a full stop, "1.", where Pearson's stand alone, and the
    papers end at "END OF PAPER";
  - Section B of Physics and Biology Unit 4 is a choice of options, each headed
    "Option A – Alternating Currents" with no question number: the schemes number them
    on from the last question (Option A is 7 after questions 1-6), and so do we;
  - maths papers (answered in a separate booklet) box their question numbers as two
    digits, "0" "1", and their parts "a)": cut whole questions, as the other maths banks;
  - the scheme ends with a "Summary of marks allocated" grid, which isn't a question's
    row, and closes each question with a "Question 1 total" row, which is left off;
  - the examiners' report is one per subject a summer, a section per unit ("AS UNIT 1
    – MOTION, ENERGY AND MATTER"), its comments headed "Q.1" or "Question 1"; options
    are headed by name ("Option A").
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <unit>-<series>-<question>[-<part>]: "2420u10-jun23-03-bi".
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402  (reads the same work dir and --whole/--only from the command line)

WORK, ONLY = cp.WORK, cp.ONLY
END = re.compile(r"^END OF PAPER\b")
# (maths prints "TURN OVER" in large type at the foot of a page, inside the margins)
cp.STOP = re.compile(cp.STOP.pattern.replace("|BLANK PAGE|", r"|BLANK PAGE|END OF PAPER|(?-i:TURN OVER)\s*$|"), cp.STOP.flags)
OPTION = re.compile(r"^Option\s+([A-F])\s*[–:-]")
NUMBER = re.compile(r"^(\d{1,2})\.(?:\s+(.*))?$")
TOTAL_ROW = re.compile(r"^Question\s+\d{1,2}\s+total\b", re.I)
SUMMARY = re.compile(r"SUMMARY OF MARKS ALLOCATED", re.I)
options = {}  # the paper being cut's options, {"A": 7}: the report's "Option A" comments go with question 7


def wjec_labels(doc):
    """cut_pearson.qp_labels for WJEC's layout: [(page, y, q, letter, roman)] and the last page."""
    out, q, letter, roman, letter_x = [], 0, None, None, 0
    end_page = len(doc) - 1
    options.clear()
    for i in range(1, len(doc)):
        if doc.blank(i):
            continue
        f = doc.frame(i)
        lines = doc.lines(i)
        stop = False
        # The options' contents page lists them all ("Answer the question on one topic only"): not their headings.
        listing = any(re.match(r"Answer the question on one (topic|option) only", l["text"]) for l in lines)
        for k, l in enumerate(lines):
            if l["y0"] > f.y1 or l["y0"] < f.y0 - 8:
                continue
            if END.match(l["text"]):
                stop = True
                break
            rest = l["text"]
            m = NUMBER.match(rest) if l["x0"] < f.x0 + 16 else None
            if cp.WHOLE and not m and re.fullmatch(r"\d", rest) and l["x0"] < f.x0 + 40:
                # Maths: the number in two boxes, "0" then "1", on one line.
                nxt = next((o for o in lines[k + 1:k + 3] if abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"\d", o["text"]) and 10 < o["x0"] - l["x0"] < 40), None)
                if nxt:
                    m = re.match(r"(\d+)(.*)", l["text"] + nxt["text"])
            opt = OPTION.match(rest) if q and not listing and l["x0"] > f.x0 + 60 else None
            if m and options and int(m.group(1)) == q and out[-1][2:] == (q, None, None) and not letter:
                rest = m.group(2) or ""  # an option also numbered: "Option D – Energy…" then "10. (a)"
            elif m and int(m.group(1)) == q + 1:
                q, letter, roman = int(m.group(1)), None, None
                out.append((i, l["y0"], q, None, None))
                rest = m.group(2) or ""
            elif opt and opt.group(1) not in options:
                q, letter, roman = q + 1, None, None
                options[opt.group(1)] = q
                out.append((i, l["y0"], q, None, None))
                continue
            elif q == 0 or cp.WHOLE:
                continue
            # Then a part and a sub-part, either of which can share the line: "(a) (i) Which…".
            for n in range(2):
                m = cp.LEAD.match(rest)
                if not m:
                    break
                tok = m.group(1)
                nxt_letter = cp.LETTERS[cp.LETTERS.index(letter) + 1] if letter and letter != cp.LETTERS[-1] else ("a" if not letter else None)
                nxt_roman = cp.ROMANS[cp.ROMANS.index(roman) + 1] if roman and roman != cp.ROMANS[-1] else ("i" if not roman else None)
                indented = n == 1 or l["x0"] > letter_x + 8
                if tok == nxt_roman and letter and (tok != nxt_letter or roman or indented):
                    roman = tok
                    out.append((i, l["y0"], q, letter, roman))
                elif tok == nxt_letter:
                    letter, roman, letter_x = tok, None, l["x0"]
                    out.append((i, l["y0"], q, letter, None))
                else:
                    break
                rest = rest[m.end():]
        if stop:
            end_page = i
            break
    qp_questions[0] = sum(1 for o in out if o[3] is None)
    return out, end_page


qp_questions = [0]  # how many questions the paper being cut has: wjec_labels counts them, label_starts checks against it


def wjec_frame(page):
    """cut_pearson's frame; where a page draws none (maths, some years' sciences), the text's own margins:
    below the page number, left of the "Examiner only" column."""
    f = pearson_frame(page)
    drawn = f != pymupdf.Rect(40, 40, page.rect.width - 40, page.rect.height - 50)
    if not drawn:
        f = pymupdf.Rect(50, 76, 541, page.rect.height - 50)
    # A line can run to the frame's border or a little past that margin, which took the end off its last letter: reach it, but not the column beside it nor the border's own line.
    ends = [s["bbox"][2] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
            if s["text"].strip() and f.y0 < s["bbox"][1] < f.y1 and s["bbox"][0] < f.x1 - 1 and f.x1 < s["bbox"][2] <= f.x1 + 12]
    if ends:
        f = pymupdf.Rect(f.x0, f.y0, min(max(ends) + 0.5, f.x1 + 2.7) if drawn else max(ends) + 0.5, f.y1)
    return f


def wjec_ms_tables(doc):
    """cut_pearson.ms_tables, without the summary grid at the back and each question's "Question 1 total" row."""
    summary = next((i for i in range(len(doc)) if SUMMARY.search(doc.text(i))), len(doc))
    for i in range(len(doc)):
        labels = []
        for l in doc.lines(i):
            # Some schemes print the paper's full stop too: "1.", "4. (a)".
            if l["x0"] < 200 and re.match(r"\d{1,2}\.(\s|$)", l["text"]):
                l["text"] = re.sub(r"^(\d{1,2})\.", r"\1", l["text"])
            # 2016's schemes write a sub-part bare, "ii": bracket it, as cut_pearson only takes a bare one in bold.
            if l["x0"] < 200 and (l["text"] in cp.ROMANS or re.fullmatch(r"[a-h]", l["text"])):
                l["text"] = f"({l['text']})"
            if l["x0"] < 200 and re.fullmatch(r"\d{1,2}\*?|\(?[a-z]{1,4}\)?", l["text"]):
                labels.append(l)
            # Maths heads its label column "Q" or "Qu.", beside "Solution": cut_pearson only takes a bare "Q" beside "Key".
            if l["text"] in ("Q", "Qu", "Qu.") and any(o["text"] == "Solution" and abs(o["y0"] - l["y0"]) < 10 for o in doc.lines(i)):
                l["text"] = "Question"
        # The pieces of one label, "10 | (a) | (i)", can sit a point apart, "(i)" above "(a)": level them, so they read in order.
        for l in labels:
            row = [o for o in labels if abs(o["y0"] - l["y0"]) < 2]
            l["y0"] = min(o["y0"] for o in row)
        doc._lines[i] = sorted(doc.lines(i), key=lambda l: (round(l["y0"]), l["x0"]))
        # The "Question" header is centred over three label columns, so a narrow first column's "9" can sit
        # further left of it than cut_pearson looks: the header reaches back over the labels below it.
        for h in (l for l in doc.lines(i) if l["text"] == "Question"):
            under = [l["x0"] for l in labels if l["y0"] > h["y0"] and re.fullmatch(r"\d{1,2}\*?", l["text"])]
            if under:
                h["x0"] = min(h["x0"], min(under) + 20)
    out = {}
    for key, (pieces, text, ans) in pearson_ms_tables(doc).items():
        kept = []
        for pg, r in pieces:
            if pg >= summary:
                continue
            total = [l["y0"] for l in doc.lines(pg) if TOTAL_ROW.match(l["text"]) and r.y0 + 4 < l["y0"] < r.y1]
            if total:
                rules = [y for y in cp.table_rules(doc[pg]) if r.y0 + 4 < y <= min(total) + 1]
                r = pymupdf.Rect(r.x0, r.y0, r.x1, (max(rules) if rules else min(total) - 3))
            kept.append((pg, r))
        if kept:
            out[key] = (kept, TOTAL_ROW.split(text)[0].strip() if TOTAL_ROW.search(text) else text, ans)
    return whole_questions(doc, out, summary) if cp.WHOLE else out


def whole_questions(doc, tables, summary):
    """Maths: each question's scheme whole, from its first row to the next question's. Mechanics sections head
    each question's table "Q7" and close it "Total for Question 7"; one year's "Q7" is a picture, not text:
    then the question after a "Total for Question 6", or the first after "SECTION B", starts there."""
    starts, ends, section_b = {}, {}, None
    for (q, _, _), (pieces, _, _) in tables.items():
        at = (pieces[0][0], pieces[0][1].y0)
        starts[q] = min(starts.get(q, at), at)
    for i in range(summary):
        for l in doc.lines(i):
            m = re.fullmatch(r"Q\.?\s?(\d{1,2})", l["text"])
            if m and l["x0"] < 120:
                starts[int(m.group(1))] = min(starts.get(int(m.group(1)), (i, l["y0"] - 6)), (i, l["y0"] - 6))
            m = re.match(r"Total for Question (\d{1,2})\b(?!\s*\()", l["text"])  # (not a part's subtotal: "Total for Question 4 (a) (ii)", 2025's Unit 6)
            if m:
                ends[int(m.group(1))] = (i, l["y1"] + 6)
            if section_b is None and re.match(r"SECTION B\b", l["text"]):
                section_b = (i, l["y0"] - 4)
    labelled = label_starts(doc, summary)
    if labelled:
        # Every question on the paper, in order: those are the starts. (cut_pearson's rows can take a number in the
        # working for a label: 2024's Unit 4 scheme gave Q1's rows to Q3, and 2019's Unit 1 started Q3 inside Q2.)
        starts = dict(labelled)
    last = max(list(starts) + list(ends) + [0])
    for q in range(2, last + 1):
        if q in starts or q - 1 not in starts:
            continue
        if q - 1 in ends:
            starts[q] = ends[q - 1]
        elif section_b and section_b > starts[q - 1] and not any(starts[q - 1] < at < section_b for at in starts.values()):
            starts[q] = section_b
    order = sorted(starts.items(), key=lambda kv: kv[1])
    ruled = {at for at in labelled.values() if at in starts.values()}
    out = {}
    for n, (q, (pg, top)) in enumerate(order):
        stop = order[n + 1][1] if n + 1 < len(order) else (summary, 0)
        # (a numbered scheme runs on to the next question: Further Mechanics prints a "Q1 Alternative Solution" table after "Total for Question 1")
        if q in ends and not labelled:
            stop = min(stop, ends[q])
        pieces = []
        for p in range(pg, min(stop[0] + 1, summary)):
            box = cp.ms_page_box(doc, p)
            if labelled:
                # (a page's drawn rules can stop short of its rows, or start below them: the box takes in all its text)
                h = doc[p].rect.height
                page_no = lambda l: re.fullmatch(r"\d{1,3}", l["text"]) and abs(l["x0"] - doc[p].rect.width / 2) < 40  # noqa: E731
                inked = [l for l in doc.lines(p) if not SCHEME_FOOT.match(l["text"]) and l["y0"] < h - 62 and not page_no(l)]
                if inked:
                    # (across too: on a page with no table the only drawn lines can be a diagram's, 2018's Unit 3 Q5)
                    box = pymupdf.Rect(min(box.x0, min(l["x0"] for l in inked) - 2), min(box.y0, min(l["y0"] for l in inked) - 2),
                                       max(box.x1, max(l["x1"] for l in inked) + 2), max(box.y1, max(l["y1"] for l in inked) + 2))
                    # (and no further: 2018's Unit 3 draws no table, and its box is the whole page, footer and all)
                    feet = [l["y0"] for l in doc.lines(p) if (SCHEME_FOOT.match(l["text"]) or page_no(l)) and l["y0"] >= max(o["y1"] for o in inked) - 4]
                    if feet:
                        box.y1 = min(box.y1, min(feet) - 2)
            t = top if p == pg else box.y0
            # (a start on a rule is just under it: the question before keeps the rule, and the "Total [9]" touching it)
            b = (stop[1] - 1 if stop in ruled else stop[1] - 2) if p == stop[0] else box.y1
            foot = [l["y0"] for l in doc.lines(p) if re.match(r"[12]\d{3}U\d0-\d WJEC", l["text"]) and t < l["y0"] < b]
            b = min([b] + [y - 2 for y in foot])  # (2019 Unit 2 sets its footer just under the last row)
            if b > t + 6 and doc.text(p, pymupdf.Rect(box.x0, t, box.x1, b)).strip():
                pieces.append((p, pymupdf.Rect(box.x0, t, box.x1, b)))
        if pieces:
            out[(q, None, None)] = (pieces, re.sub(r"\s+", " ", " ".join(doc.text(p, r) for p, r in pieces)), None)
    return out


SCHEME_FOOT = re.compile(r"©|[12]\d{3}U\d0-\d|Further Mathematics\b|UNIT \d|SUMMER 20|MS S\d\d")  # (set well above the foot of the page, and further left than the table)


def question_label(doc, i, l):
    """The question number a scheme's line prints, or None: "Q3" (2025's table header) anywhere near the margin,
    or in the page's leftmost column "3", "3 (a)", "2.a)", "4. a) working" (wjec_ms_tables has taken "1."'s stop
    off), "10 Dividing both sides". Further Statistics' column moves from 71 to 94 between pages, so the column is
    the page's own. A number with anything else after it is working ("33 < 48", "9 ∫"), and so is a digit right of
    the column."""
    if l["x0"] >= 100:
        return None
    m = re.fullmatch(r"Q\s?(\d{1,2})", l["text"])
    if m:
        return int(m.group(1))
    m = re.match(r"(\d{1,2})\.?(?:\s*\(?[a-z]{1,4}\)(?:\s|$|\().*|\s+[A-Za-z]{2,}\b.*|\s*)$", l["text"])
    if not m:
        return None
    left = min((o["x0"] for o in doc.lines(i) if not SCHEME_FOOT.match(o["text"])), default=0)
    return int(m.group(1)) if l["x0"] < left + 8 else None


def label_starts(doc, summary):
    """Further Maths: {q: (page, y)} where a scheme numbers its questions down the left, each counted only as the
    next question's, so a label reprinted over a carried page ("3." or "Q1" again) isn't a start. Where no number
    is text (Further Mechanics' 2022 and 2023 schemes draw their "Q1" header as pictures), each table's blue "Q"
    header cell, in order, is the next question's. Either has to find every question on the paper (qp_questions)
    to be believed."""
    out = {}
    for i in range(summary):
        for l in doc.lines(i):
            q = question_label(doc, i, l)
            if q != len(out) + 1:
                continue
            drawn = [d["rect"].y0 for d in doc[i].get_drawings() if d["rect"].width > 100 and d["rect"].height < 3]
            # From the rule over its row, where one is drawn just above: the row's working can sit higher than its number.
            rules = [y for y in drawn if l["y0"] - 25 < y < l["y0"] + 3]
            top = max(rules) + 1 if rules else l["y0"] - 4
            # And from its table's header, where one is just above ("Qu Solution" as one line in 2024's, "Qu." over "No." in Statistics').
            head = [o["y0"] for o in doc.lines(i) if o["x0"] < 100 and re.match(r"(Question|Qu\.?)(\s|$)", o["text"]) and l["y0"] - 60 < o["y0"] < l["y0"] - 2]
            if head:
                over = [y for y in drawn if min(head) - 20 < y < min(head) + 2]
                top = max(over) + 1 if over else min(head) - 4
            out[q] = (i, top)
    if len(out) == qp_questions[0]:
        return out
    cells = []
    for i in range(summary):
        for d in doc[i].get_drawings():
            r, fill = d["rect"], d.get("fill")
            if fill and r.x0 < 100 and 15 < r.width < 45 and 12 < r.height < 30 and fill[0] < 0.3 and fill[1] > 0.4 and fill[2] > 0.6:
                if not cells or cells[-1][0] != i or r.y0 - cells[-1][1] > 12:
                    cells.append((i, r.y0))
    return {n + 1: (i, y - 2) for n, (i, y) in enumerate(cells)} if len(cells) == qp_questions[0] else {}


def wjec_report(path, section=None):
    """{"03": "<paragraphs>"}: the comments on each question of one unit (`section`, its number).
    Its questions are headed "Q.1", "Question 1" or "1." on a line of their own; Chemistry's Section A
    runs on, "In Q6(a) the candidates had to…", a paragraph a question; options are headed by name."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"\n\s*© WJEC CBAC Ltd\.?\s*\n(\s*\d{1,3}\s*\n)?", "\n", text)
    text = re.sub(r"\n\s*\d{1,3}\s*\n\s*© WJEC CBAC Ltd\.?\s*\n", "\n", text)
    # Some years set their lines a blank line apart: a line that runs on into a lower-case one is one sentence.
    text = re.sub(r"([^.?!:\n])[ \t]*\n[ \t]*\n[ \t]*(?=[a-z])", r"\1 ", text)
    # The unit's own section, from its heading ("AS UNIT 1 – …", "Unit 3 Energy, …") to the next unit's: the
    # longest such stretch, which the contents page's line for it isn't.
    # Maths heads a unit's sections by name first: "APPLIED MATHEMATICS A – AS UNIT 2 SECTION B"; both are the unit's.
    heads = [(m.start(), m.group(1)) for m in re.finditer(
        r"\n[ \t]*(?:[A-Z][A-Z ]+[–−-] )?(?:AS |A2 |A LEVEL )?(?:UNIT|Unit)\s*(\d)(?=[ \t]*(?:[–−:(-]|[A-Z]|\n))[^\n]{0,80}\n", text)]
    chunks = {}
    for n, (pos, unit) in enumerate(heads):
        chunks.setdefault(unit, []).append(text[pos:heads[n + 1][0] if n + 1 < len(heads) else len(text)])
    found = chunks.get(section or "", [])
    # (Further Maths's reports since 2024 open with a contents list: the stretch after its last line, "A2 Unit 6…",
    # is the overview, long but no question's, so a unit's own section is the stretch that comments on its Q.1)
    found = [c for c in found if re.search(r"\n[ \t]*(?:Q\.?\s*|Question\s+)1\b", c)] or found
    body = "\n".join(c for c in found if len(c) >= 800) or max(found, key=len, default="")
    if len(body) < 1500:
        return {}
    body = re.split(r"\n\s*(?:Summary of key points|Supporting you)", body)[0]
    # A heading can carry its comment on its own line, "Q.10  This question was a high-point…": part them.
    body = re.sub(r"\n([ \t]*Q\.\s?\d{1,2})[ \t]+(?=\S[^\n]{60})", r"\n\1\n", body)
    # Headings, in order: a question's number only counts when it's past the last one (a "1." in a list isn't one).
    marks, last = [], 0
    for m in re.finditer(r"\n[ \t]*(?:(?:Q\.?\s*|Question\s+)(\d{1,2})\b[^\n]{0,60}|(\d{1,2})\.[ \t]*|(?:Option|OPTION)\s+([A-F])\b[^\n]{0,80})\n", body):
        q = int(m.group(1) or m.group(2) or 0) or options.get(m.group(3), 0)
        if m.group(3) and q:
            marks.append((m.start(), m.end(), q))
            last = 99  # within an option, its own numbering is its parts'
        elif q and last < q <= last + 3:
            marks.append((m.start(), m.end(), q))
            last = q
    out = {}

    def add(q, chunk):
        chunk = re.sub(r"\n[ \t]*(\([a-z]{1,4}\))[ \t]*\n", r"\n\n\1 ", "\n" + chunk)  # a part's label on its own line starts its paragraph
        chunk = re.sub(r"(?<=\S)[ \t]*\n(?![ \t]*\n)", " ", chunk)
        paras = [re.sub(r"[ \t]+", " ", p).strip() for p in re.split(r"\n[ \t]*\n", chunk)]
        paras = [p for p in paras if len(p) > 40]
        if paras:
            key = f"{q:02d}"
            out[key] = (out[key] + "\n\n" if key in out else "") + "\n\n".join(paras)

    for n, (start, end, q) in enumerate(marks):
        add(q, body[end:marks[n + 1][0] if n + 1 < len(marks) else len(body)])
    # Paragraphs that name their question ("In Q8 just under half…"), before the first heading.
    lead = body[:marks[0][0]] if marks else body
    lead = re.sub(r"(?<=\S)[ \t]*\n(?![ \t]*\n)", " ", lead)
    for para in re.split(r"\n[ \t]*\n", lead):
        m = re.match(r"\s*(?:In |For )?(?:Q|Question)\s*\.?\s*(\d{1,2})\b", para)
        if m:
            add(int(m.group(1)), para)
    return out


def wjec_marks_in(doc, pieces):
    """cut_pearson.marks_in, and the extended response question's "[6 QER]" (2018's maths: "[5 marks]")."""
    marks = pearson_marks_in(doc, pieces)
    if marks is None:
        qer = [int(m.group(1)) for pg, rect in pieces for l in doc.lines(pg) if cp.inside(l, rect)
               for m in [re.search(r"\[(\d{1,2})\s*(?:QER|marks?)\]", l["text"])] if m]
        marks = sum(qer) if qer else None
    return marks


def squeezed_region(doc, start, end, end_page):
    """--squeeze: cut_pearson.region without the pages of dotted answer lines the papers since 2024 are printed with
    (answered in the paper, a question's crop ran to 5,800px, most of it dots). A band of the dashed rules, with no
    text or drawing among them, comes out; a grid or diagram to draw on stays."""
    out = []
    for pg, r in pearson_region(doc, start, end, end_page):
        drawn = [d for d in doc[pg].get_drawings() if d["rect"].y1 >= r.y0 and d["rect"].y0 <= r.y1 and d["rect"].x1 >= r.x0 and d["rect"].x0 <= r.x1]  # (a rule's rect is empty: Rect.intersects says no)
        dashed = sorted(d["rect"].y0 for d in drawn if d["rect"].height < 2 and d["rect"].width > 400 and re.search(r"\[\s*[\d.]", d.get("dashes") or ""))
        others = [d["rect"] for d in drawn if d["rect"].height >= 2 and d["rect"].height < r.height + 40 and not d["rect"].contains(r)]
        text = [l for l in doc.lines(pg) if cp.inside(l, r) and l["text"].strip()]
        top, bands = r.y0, []
        for y in dashed:
            if not (r.y0 <= y <= r.y1):
                continue
            if bands and not any(bands[-1][1] < l["y1"] and l["y0"] < y for l in text) \
                    and not any(bands[-1][1] < o.y1 and o.y0 < y for o in others):
                bands[-1][1] = y
            else:
                bands.append([y, y])
        # (and "TURN OVER FOR QUESTIONS 7(c) & 7(d)", which means nothing in a crop)
        bands += [[l["y0"] - 1, l["y1"] + 1] for l in text if re.match(r"TURN OVER FOR\b", l["text"])]
        for a, b in sorted(bands):
            if a - 3 > top + 6:
                out.append((pg, pymupdf.Rect(r.x0, top, r.x1, a - 3)))
            top = b + 3
        if r.y1 > top + 6:
            out.append((pg, pymupdf.Rect(r.x0, top, r.x1, r.y1)))
    return out


pearson_frame, pearson_ms_tables, pearson_marks_in, pearson_region = cp.frame, cp.ms_tables, cp.marks_in, cp.region
cp.qp_labels, cp.frame, cp.ms_tables, cp.marks_in, cp.examiner_report = wjec_labels, wjec_frame, wjec_ms_tables, wjec_marks_in, wjec_report
if "--squeeze" in sys.argv:
    cp.region = squeezed_region


def run_set(job):
    # (defined here, so each worker process imports this module, and with it the replacements above)
    return cp.run_set(job)


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    maths = {"300", "305"}  # (Further Maths too)
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" not in files or (comp[1:4] in maths) != cp.WHOLE or (ONLY and not set_id.startswith(ONLY)):
            continue
        jobs.append((set_id, files, {"component": comp.lower(), "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")}))
    all_parts, problems = [], []
    parts_path = os.path.join(WORK, "parts-maths.json" if cp.WHOLE else "parts.json")
    if ONLY and os.path.exists(parts_path):
        all_parts = [p for p in json.load(open(parts_path)) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            no_marks = sum(1 for p in parts if p["marks"] is None)
            no_er = sum(1 for p in parts if not p["er"])
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {no_marks} without marks, {no_er} without report", file=sys.stderr, flush=True)
            if not parts or no_ms > len(parts) / 3:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
