"""Cut AQA's GCSE Physical Education (8582) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_pe/cut_gcse_pe.py [work-dir] [--only=85821]   # default scripts/question-bank/.work/aqa-gcse-pe

A-Level PE's cutter (aqa_pe/cut_pe.py, so GCSE Psychology's patches on cut.py): the papers and schemes
are set the same way, with questions numbered through the paper ("0 7"), parts ("0 7 . 1") under a figure
or a stimulus, and each scheme reprinting its question under its label, then "Marks for this question: AO1 = 1"
and its guidance. What differs:
  - Each paper is out of 78 marks.
  - Multiple choice is the paper's opening questions, keyed from the scheme's "Answer A – It contracts" or "D – Ulna".
  - An extended answer is 6 or 9 marks, and only those carry a levels grid.
  - A part ending a page often sits above "Question 7 continues on the next page": left out of its crop.
  - The reports head each comment "QUESTION 6.1" or "Question 7.1", and the multiple choice "QUESTION 1-5" or
    "Multiple Choice Questions (1-5)": see examiner_report.
  - A scheme ends with a grid of each question's marks by assessment objective (one or two pages), not part of its last question.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-pe")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_pe"))
sys.path.insert(0, os.path.dirname(HERE))
import cut_pe  # noqa: E402  (patches cut.py the way PE's papers need)
import pymupdf  # noqa: E402

gcse, cut = cut_pe.gcse, cut_pe.cut
# Top level, not under main: the worker processes import this file and need the same patches.
gcse.COMPONENTS = ("85821", "85822")
# June 2024's schemes drop the colon from a part's "Marks for this question AO1 = 2".
gcse.MARKS_LINE = re.compile(r"Marks for this question:?\s*(?:AO\d\s*[=–-]\s*\d+(?:\s*marks?)?\s*(?:,|and)?\s*)+")
TOTAL = 78
_frame = cut.frame


def frame(page, portrait=True):
    """The paper's frame, ending above a page's "Question 7 continues on the next page"."""
    f = _frame(page, portrait)
    if portrait:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                if re.match(r"Question \d+ continues", "".join(s["text"] for s in line["spans"]).strip()):
                    f.y1 = min(f.y1, line["bbox"][1] - 4)
    return f


cut.frame = frame
_skip_page = cut.skip_page


def skip_page(page, max_x, bold_only):
    """cut.py's test, and a scheme's closing grid of marks by assessment objective ("Question | AO1 | AO2 | AO3 | Total"):
    it runs on from the last question's scheme otherwise, and its row numbers read as labels."""
    text = page.get_text()
    words = [t for t in text.splitlines() if re.search(r"[A-Za-z]{2}", t) and not t.startswith("MARK SCHEME")]
    return _skip_page(page, max_x, bold_only) or bool(re.search(r"^AO1\s*$", text, re.M) and re.search(r"^AO3\s*$", text, re.M) and len(words) < 8) or words == ["Total"]


cut.skip_page = skip_page
_regions = cut.regions


# Two parts ask about a figure or table printed only on the part before them: (paper, part, the part it's on, the lines it runs between).
SHARED = [("AQA-85821-QP-NOV20.pdf", ("10", "5"), ("10", "4"), r"Figure 4 shows", r"Explain what is happening"),
          ("AQA-85822-QP-JUN22.pdf", ("13", "2"), ("13", "1"), r"Table 2 shows", r"Plot the data")]


def share_figure(doc, out):
    """Each of SHARED's parts gets that figure or table too, so it can be read on its own."""
    parts = {r[0]: r for r in out}
    for paper, key, source, start, stop in SHARED:
        if not (doc.name or "").endswith(paper):
            continue
        pg, rect = parts[source][1][0]
        lines = cut.text_lines(doc[pg], rect)
        y0 = next(y for y, x, t in lines if re.match(start, t))
        y1 = next(y for y, x, t in lines if re.match(stop, t))
        figure = (pg, pymupdf.Rect(rect.x0, y0 - 6, rect.x1, y1 - 6))
        parts[key][1].insert(0, figure)
        parts[key][2] = doc[pg].get_text("text", clip=figure[1]) + "\n" + parts[key][2]
    return out


def close_at_maximum(doc, out):
    """A scheme's stray "." under its closing "Maximum 2 marks" (June 2022 and 2023 Paper 2) is left out. In November 2021
    Paper 1 it sits above the boxed stimulus for 16.2 (the paper prints Figure 3 between 16.1 and 16.2): that goes to 16.2,
    whose crop would otherwise open on a sliver of the box."""
    for n, (key, pieces, text) in enumerate(out):
        if not pieces or not re.search(r"Maximum \d+ marks?\s*\.(\s|$)", text):
            continue
        pg, rect = pieces[-1]
        lines = [l["bbox"] for b in doc[pg].get_text("dict", clip=rect)["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip().startswith("Maximum")]
        if not lines:
            continue
        end = max(l[3] for l in lines) + 2
        pieces[-1] = (pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, end))
        out[n][2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        rest = doc[pg].get_text("text", clip=pymupdf.Rect(rect.x0, end, rect.x1, rect.y1))
        if re.search(r"Figure \d+ shows", rest) and n + 1 < len(out) and out[n + 1][1] and out[n + 1][1][0][0] == pg:
            boxes = [d["rect"].y0 for d in doc[pg].get_drawings() if d["rect"].width > 300 and end <= d["rect"].y0 < rect.y1]
            top = min(boxes) - 1.5 if boxes else end
            first = out[n + 1][1][0][1]
            out[n + 1][1][0] = (pg, pymupdf.Rect(first.x0, top, first.x1, first.y1))
            out[n + 1][2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in out[n + 1][1])


def regions(doc, max_x, bold_only, portrait):
    """GCSE Psychology's regions, with each scheme ending above the next one's box. In November 2020's Paper 1 that
    box (a drawn rectangle) starts up to 16pt above where the next region starts, too far for on_box_rule: the scheme above
    ended with a sliver of the box, and the box's crop lost its top. A rule closing a table or a figure is left be:
    it sits close under its text, this one in the gap after "Maximum 2 marks"."""
    out = _regions(doc, max_x, bold_only, portrait)
    if portrait:
        return share_figure(doc, out)
    close_at_maximum(doc, out)
    for n in range(1, len(out)):
        if not out[n][1] or not out[n - 1][1] or out[n][1][0][0] != out[n - 1][1][-1][0]:
            continue
        pg, above = out[n - 1][1][-1]
        rules = [d["rect"].y0 for d in doc[pg].get_drawings() if d["rect"].width > 300 and above.y1 - 20 < d["rect"].y0 < above.y1 + 1]
        if not rules:
            continue
        y = min(rules)
        lines = [l["bbox"] for b in doc[pg].get_text("dict")["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip()]
        if any(y - 6 < y1 and y0 < above.y1 and y0 < y for x0, y0, x1, y1 in lines):
            continue
        out[n - 1][1][-1] = (pg, pymupdf.Rect(above.x0, above.y0, above.x1, y - 1.5))
        below = out[n][1][0][1]
        out[n][1][0] = (pg, pymupdf.Rect(below.x0, y - 1.5, below.x1, below.y1))
    return out


cut.regions = regions
# "Level Marks Description", or November 2021 on's "Level Mark Descriptor".
LEVELS = re.compile(r"Level\s+Marks?\s+Descript")


def problems_of(set_id, parts, full):
    """A-Level PE's checks at GCSE's sizes: one letter a multiple-choice key, every 9-mark scheme with its
    whole levels grid and its possible content, and 78 marks a paper."""
    out = []
    for p in parts:
        pid, ms = p["id"], full.get(p["id"], "")
        if not p["ms"] and not p.get("key"):
            out.append(f"{pid}: no scheme")
        if gcse.MCQ.search(p["text"]) and not re.fullmatch(r"[A-D]", p.get("key") or ""):
            out.append(f"{pid}: multiple choice, key {p.get('key')}")
        if p["ms"] and ((p["marks"] or 0) >= 9 or LEVELS.search(ms)):
            if not LEVELS.search(ms) or not re.search(r"No relevant content", ms):
                out.append(f"{pid}: {p['marks']}-mark scheme without its whole levels grid")
        if not p["qp"] or not p["h"]:
            out.append(f"{pid}: no crop")
    marks = sum(p["marks"] or 0 for p in parts)
    if marks != TOTAL:
        out.append(f"{set_id}: {marks} marks, not {TOTAL}")
    return out


gcse.problems_of = problems_of
REPORT_HEADING = re.compile(r"\n\s*(?:QUESTIONS?|Questions?|Multiple Choice Questions)\s*\(?(\d{1,2})(?:\.(\d{1,2}))?(?:\s*[-–&]\s*(\d{1,2})(?:\.(\d{1,2}))?)?\)?\s*\n")


def examiner_report(path):
    """{question: its comments}, each part's under its own "Question 06.1" heading, which QuestionRow's splitReport reads
    (a whole question's with none). A comment on the multiple choice as a whole goes to each of those questions, and one
    headed for two parts ("QUESTION 23.1 & 23.2") under both."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    first = REPORT_HEADING.search(text)
    if not first:
        return {}
    end = re.search(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\s*\n", text[first.start():], re.I)
    text = text[first.start():first.start() + end.start()] if end else text[first.start():]
    text = re.sub(r"^\s*(?:\d+ of \d+|REPORT ON THE EXAMINATION.*|© ?\d{4} AQA.*)\s*$\n?", "", text, flags=re.I | re.M)
    bits = REPORT_HEADING.split(text)
    out = {}
    for k in range(1, len(bits) - 4, 5):
        q, p, q2, p2, body = bits[k], bits[k + 1], bits[k + 2], bits[k + 3], cut_pe.cut_psychology.tidy(bits[k + 4])
        if not body:
            continue
        if q2 and not p:  # "QUESTION 1-5"
            for n in range(int(q), int(q2) + 1):
                out[f"{n:02d}"] = body
            continue
        q = f"{int(q):02d}"
        labels = [f"{q}.{p}"] + ([f"{q}.{p2}"] if p2 else []) if p else [None]
        for label in labels:
            piece = f"Question {label}\n\n{body}" if label else body
            out[q] = (out[q] + "\n\n" + piece) if q in out else piece
    return out


cut.examiner_report = examiner_report

if __name__ == "__main__":
    gcse.main()
