"""Cut AQA's Law papers into questions, each with its scenario, its mark scheme and its report.

    python3 scripts/question-bank/aqa_law/cut_law.py [work-dir] [--only=71623a]   # default scripts/question-bank/.work/aqa-law

cut_sociology.py's frames, spans, renderer, scheme reader and examiner's report reader,
with Law's own layout around them. Every paper (1, 2, 3A Contract, 3B Human rights) is
the same eleven questions, all answered, for 100 marks:
  - 01-05, multiple choice for a mark each. The marks ("[1 mark]") come before the
    options A-D, so each runs to the next label, or to the foot of its page; its scheme
    is a key ("D  The defendant must have intended..."), read into the part's answer
    letter (`key`), which the site shows instead of a crop;
  - 06-11, short answers (5 marks), an applied scenario (5 and 10 marks), a 15-mark
    essay and two 30-mark problem questions. A scenario is printed between the label
    and the question's own words, so each question is whole, from its boxed label to
    its marks: the scenario is always in the crop.
The schemes give each question its own levels grid and indicative content, from its
label ("10") to the next, across pages; the paper's closing "Assessment Objectives
Grid" ends the last.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-law")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_sociology"))
import cut_sociology as soc  # noqa: E402  (sets cut.py up for the work dir above as it is imported)

cut = soc.cut
MARKS = soc.MARKS
KEY = re.compile(r"AO\d = 1\s+([A-D])\b")


def qp_questions(doc):
    """[(q, pieces, text, marks)] in reading order."""
    events = []
    for pg, page in enumerate(doc):
        f = soc.frame(page)
        for y, q, part in cut.left_labels(page, 75, True):
            if part is None:
                events.append((pg, y, y, "label", q))
        for y0, x0, y1, t, bold in soc.lines_of(page):
            if f.y0 - 10 <= y0 <= f.y1 + 4 and MARKS.search(t):
                events.append((pg, y0, y1, "marks", t))
    events.sort(key=lambda e: (e[0], e[1]))
    out = []
    for n, (pg, y, _, kind, value) in enumerate(events):
        if kind != "label":
            continue
        marks_at = next((e for e in events[n + 1:] if e[3] == "marks"), None)
        if marks_at is None:
            raise ValueError(f"question {value}: no marks")
        if marks_at[4] == "[1 mark]":
            # A multiple-choice question: its options follow its marks, down to the next label or the page's foot.
            nxt = next((e for e in events[n + 1:] if e[3] == "label"), None)
            end = (pg, nxt[1] - 8) if nxt and nxt[0] == pg else (pg, soc.frame(doc[pg]).y1)
        else:
            end = (marks_at[0], marks_at[2] + 5)
        pieces = soc.span(doc, (pg, y - 6), end, soc.frame)
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        marks = [int(x) for x in MARKS.findall(text)]
        out.append((value, pieces, text, sum(marks) if marks else None))
    return out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    questions = qp_questions(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = soc.ms_parts(ms, {q for q, *_ in questions}) if ms else {}
    er = soc.examiner_report(er_path)
    parts, problems = [], []
    for q, pieces, text, marks in questions:
        pid = f"{set_id}-q-{q}"
        qimg = soc.render(qp, pieces, 36)
        msimg, ms_text, key = None, "", None
        if q in schemes:
            mpieces, ms_text = schemes[q]
            if marks == 1:
                m = KEY.search(ms_text)
                key = m.group(1) if m else None
                if not key:
                    problems.append(f"{pid}: no answer letter in its scheme")
            else:
                msimg = soc.render(ms, mpieces, 12)
                if not re.search(r"Mark\s+range", ms_text) or not re.search(r"Indicative content|AO1\n", ms_text):
                    problems.append(f"{pid}: its scheme lacks the levels grid or the indicative content")
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "group": "q", "option": None, "label": q, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "key": key, "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text).strip()[:3000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
        })
    return parts, problems


soc.cut_set = cut_set  # run_set and main look it up as they run

if __name__ == "__main__":
    soc.main()
