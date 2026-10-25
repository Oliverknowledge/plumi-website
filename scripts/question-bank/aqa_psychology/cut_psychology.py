"""Cut AQA's Psychology papers into question parts, each with its mark scheme.

    python3 scripts/question-bank/aqa_psychology/cut_psychology.py [work-dir] [--only=71823]   # default scripts/question-bank/.work/aqa-psychology

cut.py, with two differences for Psychology's layout:
  - The mark schemes aren't tables: each question is a heading ("0 1" in a box,
    its words, "Marks for this question: AO1 = 4") followed by its guidance, and
    for an extended answer the whole levels table and the possible content. So a
    scheme part starts at its own label, not at a table row's top rule (which
    here is the page header, and would pull in the question above).
  - A question that opens with its stimulus can print its label twice, once over
    the stimulus and again over the question on the next page: the two are one part.
  - A section's heading ("Section C", "Topic: Schizophrenia") sits between the last
    part of one section and the first of the next: it is cut off the part above
    and left out, so it is neither shown nor tagged with the wrong question.
  - A question's stimulus (a scenario, a table of results) is often printed above
    its label, after the previous question's answer lines: it is moved down to
    its own question, as cut.py's move_setups does between parts.
  - The scheme's running header ends lower than the sciences' ("MARK SCHEME –
    A-LEVEL PSYCHOLOGY", ruled off at y 68): a part carried onto a new page starts below it.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-psychology")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

# Top level, not under main: the worker processes import this file and need the same patches.
cut.row_start = lambda page, y, floor=0: y - 4
_regions, _frame = cut.regions, cut.frame
HEADING = re.compile(r"^(Section [A-D]\b|Topic:)")
# The lines of a section's heading block: its name, which topic to choose, how to answer multiple choice.
INSTRUCTION = re.compile(r"^(Section [A-D]\b|Topic:|Choose one|Answer all|Only one answer|For each|CORRECT METHOD|WRONG METHODS|If you (want|wish)|as shown|.+ or .+ or .+$)", re.I)
BOILER = re.compile(r"^(Extra space|You may use this space|Question \d+ continues|Turn over|Do not write|outside the|box$)", re.I)


def frame(page, portrait=True):
    f = _frame(page, portrait)
    if not portrait:
        f.y0 = max(f.y0, 70)
    return f


def heading_split(doc, pieces):
    """Where a section heading starts below the part's own label: (piece index, y), or None."""
    for n, (pg, rect) in enumerate(pieces):
        lines = cut.text_lines(doc[pg], rect)
        y = next((y for y, x, t in lines[0 if n else 1:] if HEADING.match(t)), None)
        if y is not None:
            return n, y
    return None


def stimulus_split(doc, pieces):
    """Where the next question's stimulus starts in this one's pieces: (piece index, y), or None.

    Psychology prints a question's scenario or table above its label ("The calculated
    value of t was 3.576 ... Table 2"), and cut.py's move_setups only moves those
    between parts of one question. Here: once this question has printed its marks
    and then its answer space (a gap of 45pt or more with no words), a sentence or a
    table that follows is the next question's. Paper 3 is answered in a separate
    answer book, so has no answer space: there a sentence after the marks is the
    next question's, unless it is a table or a lettered option of this one."""
    answer_book = "answer book" in doc[0].get_text().lower()
    marked, last_y = False, None
    for n, (pg, rect) in enumerate(pieces):
        last_y = None if n else last_y
        for y, x, t in cut.text_lines(doc[pg], rect):
            gap = last_y is None or y - last_y >= 45 or (answer_book and not re.match(r"(Table|Figure) \d|[A-D]\s", t))
            if marked and gap and not BOILER.match(t) \
                    and (len(t.split()) >= 4 or re.match(r"(Table|Figure) \d", t)) and t[:1].isupper():
                return n, y
            if re.search(r"\[\d+ marks?\]", t):
                marked = True
            last_y = y
    return None


def cut_at(out, n, at):
    """Cut region n at (piece index, y); return what follows, as pieces."""
    i, y = at
    pieces = out[n][1]
    pg, rect = pieces[i]
    out[n][1] = pieces[:i] + ([(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, y - 6))] if y - 6 > rect.y0 + 8 else [])
    return [(pg, pymupdf.Rect(rect.x0, y - 6, rect.x1, rect.y1))] + pieces[i + 1:]


def hand_on(out, n, moved):
    """Put pieces cut off region n on top of region n + 1, joining them where they touch."""
    nxt = out[n + 1][1]
    if nxt and moved and moved[-1][0] == nxt[0][0] and abs(moved[-1][1].y1 - nxt[0][1].y0) < 2:
        mpg, mrect = moved.pop()
        nxt = [(mpg, pymupdf.Rect(mrect.x0, mrect.y0, mrect.x1, nxt[0][1].y1))] + nxt[1:]
    out[n + 1][1] = moved + nxt


def skip_heading(doc, pieces):
    """Start below a heading block at the top of the pieces, keeping a stimulus under it."""
    while pieces:
        pg, rect = pieces[0]
        lines = cut.text_lines(doc[pg], rect)
        if not lines or not HEADING.match(lines[0][2]):
            return pieces
        # The block ends at the first line that is neither an instruction nor a short section name.
        y = next((y for y, x, t in lines if not INSTRUCTION.match(t) and (len(t.split()) >= 4 or re.match(r"[\d\s.]+$|(Table|Figure) \d", t))), None)
        if y is None:
            pieces = pieces[1:]
        else:
            return [(pg, pymupdf.Rect(rect.x0, y - 6, rect.x1, rect.y1))] + pieces[1:]
    return pieces


def regions(doc, max_x, bold_only, portrait):
    merged = []
    for key, pieces, text in _regions(doc, max_x, bold_only, portrait):
        if merged and merged[-1][0] == key:
            merged[-1][1] += pieces
        else:
            merged.append([key, pieces, text])
    for n in range(len(merged)):
        at = heading_split(doc, merged[n][1])
        if at:
            moved = cut_at(merged, n, at)
            if n + 1 < len(merged):
                hand_on(merged, n, moved)
        if n + 1 < len(merged):
            merged[n + 1][1] = skip_heading(doc, merged[n + 1][1])
    if portrait:
        for n in range(len(merged) - 1):
            at = stimulus_split(doc, merged[n][1])
            if at:
                hand_on(merged, n, cut_at(merged, n, at))
    for r in merged:
        r[2] = "\n".join(doc[pg].get_text("text", clip=rect) for pg, rect in r[1])
    return merged


REPORT_NOISE = re.compile(r"^\s*(REPORT ON THE EXAMINATION.*|© ?\d{4} AQA.*|\d+ of \d+|Section [A-D]\b.*|(Research methods|Short answer|Extended (writing|response)|Multiple.choice)\b.*questions.*)\s*$", re.I | re.M)
REPORT_HEADING = re.compile(r"\n\s*Questions? (\d{1,2})(?:\.\d{1,2})?(?:\s*(?:and|&)\s*(?:Question\s*)?(\d{1,2})(?:\.\d{1,2})?)?(?:\s*\([^)\n]*\))?\s*\n")
MENTION = re.compile(r"\bquestions? (\d{1,2})(?:\.\d)?(?:(?:\s*,\s*|\s+and\s+|\s*&\s*)(\d{1,2}))?", re.I)


def tidy(body):
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
    return re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))


def examiner_report(path):
    """{question: its examiner's comments}. Psychology's reports come two ways: a
    "Question 4" (or "Question 6.1", "Question 2 and Question 3") heading over each
    comment, or, on most Paper 3 reports, prose by section ("For Question 06, most
    students..."), where each sentence goes to the questions its paragraph last named."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    # The report ends at its closing sections, which the contents page also lists: look past the first question.
    first = REPORT_HEADING.search(text) or MENTION.search(text)
    end = re.search(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\s*\n", text[first.end():], re.I) if first else None
    text = text[:first.end() + end.start()] if end else text
    text = REPORT_NOISE.sub("", text)
    out = {}
    parts = REPORT_HEADING.split(text)
    if len(parts) >= 7:  # three headings or more
        for k in range(1, len(parts) - 2, 3):
            body = tidy(parts[k + 2])
            for q in filter(None, (parts[k], parts[k + 1])):
                if body:
                    q = f"{int(q):02d}"
                    out[q] = (out[q] + "\n\n" + body) if q in out else body
        return out
    for para in re.split(r"\n\s*\n", text):
        current = []  # a paragraph that names no question is general comment
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z‘'])", re.sub(r"\s+", " ", para).strip())
        for s in sentences:
            named = [f"{int(n):02d}" for m in MENTION.finditer(s) for n in m.groups() if n]
            if named:
                current = list(dict.fromkeys(named))
            for q in current:
                out.setdefault(q, []).append(s)
    return {q: " ".join(ss) for q, ss in out.items()}


cut.frame = frame
cut.examiner_report = examiner_report


cut.regions = regions

if __name__ == "__main__":
    cut.main()
