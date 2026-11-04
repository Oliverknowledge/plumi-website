"""Cut AQA's A-Level Physical Education (7582) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_pe/cut_pe.py [work-dir] [--only=75821]   # default scripts/question-bank/.work/aqa-pe

The GCSE Psychology cutter (aqa_gcse_psychology/cut_gcse_psychology.py, so cut.py with
cut_psychology's patches): PE's papers and schemes are set the same way. Three sections a
paper ("Section A / Applied anatomy and physiology"), each opening with multiple choice and
closing with an 8-mark and a 15-mark extended answer; questions are numbered through the
paper ("0 5"), with parts ("0 4 . 2") now and then. Each scheme reprints its question under
its label, then "Marks for this question: AO1 = 1" and its guidance, and for an extended
answer the whole levels grid and the possible content. What differs:
  - Multiple choice is a 1-mark question over options A-D, and its scheme
    answers "D – Pyruvic acid" after an "AO1 = 1" marks line: the letter is the part's key.
  - Each paper is out of 105 marks, not 100.
  - The scheme frame ends at the footer rule only (see ms_frame).
  - No stimulus is moved down to the question below it.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-pe")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_psychology"))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_psychology"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_gcse_psychology as gcse  # noqa: E402  (patches cut.py the way Psychology's papers need)
import cut_psychology  # noqa: E402
import pymupdf  # noqa: E402

# Top level, not under main: the worker processes import this file and need the same patches.
gcse.COMPONENTS = ("75821", "75822")
# Options A, B, C (and D) under a 1-mark question: "Which one of the following ...?", November 2020's
# "Which of these performers ...?", "Which lever system ...?", "Identify which type of goal this is.".
gcse.MCQ = re.compile(r"\[1 mark\]\s+A\s+\S.*?\sB\s+\S.*?\sC\s+\S", re.S)
gcse.MARKS_LINE = re.compile(r"Marks for this question:\s*(?:AO\d\s*[=–-]\s*\d+(?:\s*marks?)?\s*(?:,|and)?\s*)+")
gcse.KNOWN = {}
TOTAL = 105


def ms_frame(page):
    """GCSE Psychology's scheme frame, ending at the footer rule (553pt wide, at 785 or 791pt; 752pt in November
    2020's Paper 2, with the page number below it). Its test for that rule (any rule over half the page wide in
    the bottom 80pt) also took a levels grid's row rule (398pt wide) when the grid runs to the foot of a page,
    and cut off the grid's last row ("0 | No relevant content"). It starts just under the running header's rule
    (54-68pt), not at a fixed 70pt, which ran through a line set right under the rule ("Possible content may include:")."""
    w, h = page.rect.width, page.rect.height
    rules = [d["rect"] for d in page.get_drawings() if d["rect"].height < 2 and d["rect"].width > w * 0.85]
    head = [r.y1 for r in rules if 40 < r.y0 < 72]
    foot = [r.y0 for r in rules if r.y0 > h - 100]
    return pymupdf.Rect(38, max(head) + 1 if head else 70, w - 30, (min(foot) if foot else h - 60) - 1)


cut.ms_frame = ms_frame
# PE prints a question's stimulus under its label, never above it, so nothing is moved down to the next question:
# Psychology's test took an answer prompt carried onto a new page ("Type of anticipation 2: ____") for one.
cut_psychology.stimulus_split = lambda doc, pieces: None
LEVELS = re.compile(r"Level\s+Marks\s+Description")


def problems_of(set_id, parts, full):
    """GCSE Psychology's checks, for PE: one letter a multiple-choice key, every 8- and 15-mark scheme
    with its whole levels grid and its possible content, and 105 marks a paper."""
    out = []
    for p in parts:
        pid, ms = p["id"], full.get(p["id"], "")
        if not p["ms"] and not p.get("key"):
            out.append(f"{pid}: no scheme")
        if gcse.MCQ.search(p["text"]) and not re.fullmatch(r"[A-D]", p.get("key") or ""):
            out.append(f"{pid}: multiple choice, key {p.get('key')}")
        if p["ms"] and ((p["marks"] or 0) >= 8 or LEVELS.search(ms)):
            if not LEVELS.search(ms) or not re.search(r"No relevant content", ms):
                out.append(f"{pid}: {p['marks']}-mark scheme without its whole levels grid")
            # November 2021 Paper 2's 15-mark scheme goes straight to its "AO1 Knowledge of ..." headings.
            if not re.search(r"Possible content|Indicative content|\bAO1 Knowledge", ms, re.I):
                out.append(f"{pid}: {p['marks']}-mark scheme without its possible content")
        if not p["qp"] or not p["h"]:
            out.append(f"{pid}: no crop")
    marks = sum(p["marks"] or 0 for p in parts)
    if marks != TOTAL:
        out.append(f"{set_id}: {marks} marks, not {TOTAL}")
    return out


gcse.problems_of = problems_of

if __name__ == "__main__":
    gcse.main()
