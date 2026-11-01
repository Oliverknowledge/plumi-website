"""Cut AQA's Politics papers into questions, each with its extract, its mark scheme and its report.

    python3 scripts/question-bank/aqa_politics/cut_politics.py [work-dir] [--only=71523]   # default scripts/question-bank/.work/aqa-politics

cut_sociology.py's frames, spans, renderer and examiner's report reader, with Politics'
own layout around them. Each paper is the same three sections:
  - Section A, three 9-mark "Explain and analyse three..." questions (01-03), all answered;
  - Section B, one 25-mark question (04) on the extracts printed above it ("Read the
    extracts below and answer question 4 that follows."). The extracts are the
    question's stem ("71521-jun24-ex-stem.webp", which the site finds by dropping the
    id's last part), so the question's id names them: "71521-jun24-ex-04";
  - Section C, 25-mark essays, one answered: 05 or 06 (Papers 1 and 2), or one of 05-09
    (Paper 3, one per other ideology). The build marks 06 onwards as alternatives.
Every question is whole, from its boxed label to its marks ("[25 marks]").

The schemes print each section's levels-of-response grid once, under "Levels of
response mark scheme for 9-mark questions" (restating the section's questions), then
each question's "Indicative content" on its own pages. A question's scheme crop is its
indicative content, from its label to the next label or section, with its section's
grid stacked under it, so every long answer shows both.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-politics")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_sociology"))
import cut_sociology as soc  # noqa: E402  (sets cut.py up for the work dir above as it is imported)

cut = soc.cut
WORK, ONLY = soc.WORK, soc.ONLY
SERIES = soc.SERIES
EXTRACTS = re.compile(r"^Read the extracts? below")
MARKS = soc.MARKS
GRID = re.compile(r"^Levels of response mark scheme for")
INDICATIVE = re.compile(r"^Indicative content")
TARGET = re.compile(r"^Target AO")


def frame(page):
    """A paper page's content: soc.frame's top, bottom and margins, without its answer-box borders. Politics is
    answered in a separate book, so a paper's only tall rules are an extract's box, which must stay in."""
    w, h = page.rect.width, page.rect.height
    bottom = h - 46
    for y0, x0, y1, t, _ in soc.lines_of(page):
        if y0 > h - 60 or t.startswith("Turn over") or re.fullmatch(r"\*\d+\*", t) or t.startswith("IB/M/"):
            bottom = min(bottom, y0 - 4)
    return pymupdf.Rect(38, 50, w - 40, bottom)


def group_of(q):
    return "a" if int(q) <= 3 else "ex" if int(q) == 4 else "c"


def qp_questions(doc):
    """[(q, pieces, stem_pieces, text, stem_text, marks)] in reading order."""
    events = []
    for pg, page in enumerate(doc):
        f = frame(page)
        for y, q, part in cut.left_labels(page, 75, True):
            if part is None:
                events.append((pg, y, y, "label", q))
        for y0, x0, y1, t, bold in soc.lines_of(page):
            if f.y0 - 10 <= y0 <= f.y1 + 4:
                if EXTRACTS.match(t):
                    events.append((pg, y0, y1, "extracts", t))
                elif MARKS.search(t):
                    events.append((pg, y0, y1, "marks", t))
    events.sort(key=lambda e: (e[0], e[1]))
    out, extracts = [], None
    for n, (pg, y, _, kind, value) in enumerate(events):
        if kind == "extracts":
            extracts = (pg, y - 4)
        if kind != "label":
            continue
        end = next(((pg2, y2b + 5) for pg2, y2, y2b, kind2, _ in events[n + 1:] if kind2 == "marks"), None)
        if end is None:
            raise ValueError(f"question {value}: no marks")
        stem = soc.span(doc, extracts, (pg, y - 7), frame) if extracts else []
        if group_of(value) == "ex" and not stem:
            raise ValueError(f"question {value}: no extracts above it")
        extracts = None
        pieces = soc.span(doc, (pg, y - 6), end, frame)
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        stem_text = "\n".join(doc[p].get_text("text", clip=r) for p, r in stem)
        marks = [int(x) for x in MARKS.findall(text)]
        out.append((value, pieces, stem, text, stem_text, sum(marks) if marks else None))
    return out


def ms_parts(ms, wanted):
    """{q: (pieces, text)}: each question's indicative content, then its section's levels grid."""
    events = []
    for pg, page in enumerate(ms):
        f = soc.ms_frame(page)
        for y, q, part in cut.left_labels(page, 110, False):
            if part is None and q in wanted and f.y0 - 4 <= y <= f.y1:
                events.append((pg, y, "label", q))
        for y0, x0, y1, t, bold in soc.lines_of(page, f):
            for kind, pattern in (("grid", GRID), ("indicative", INDICATIVE), ("target", TARGET)):
                if pattern.match(t):
                    events.append((pg, y0, kind, (y1, t)))
            if bold and re.match(r"^Section [ABC]$", t):
                events.append((pg, y0, "section", t))
    events.sort(key=lambda e: (e[0], e[1]))
    kinds = [e[2] for e in events]
    doc_end = (len(ms) - 1, ms[-1].rect.height)
    out, grid = {}, None
    for n, (pg, y, kind, value) in enumerate(events):
        if kind == "grid":
            # The grid runs from its "Target AO..." line (under the restated questions) to the first
            # question's indicative content; its heading goes on top.
            stop = next((e for e, k in zip(events[n + 1:], kinds[n + 1:]) if k == "indicative"), None)
            end_label = next((e for e, k, e2 in zip(events[n + 1:], kinds[n + 1:], kinds[n + 2:] + [None]) if k == "label" and e2 == "indicative"), None)
            if not end_label:
                continue
            target = next((e for e, k in zip(events[n + 1:], kinds[n + 1:]) if k == "target" and (e[0], e[1]) < (end_label[0], end_label[1])), None)
            head = [(pg, pymupdf.Rect(soc.ms_frame(ms[pg]).x0, y - 3, soc.ms_frame(ms[pg]).x1, value[0] + 4))]
            body = soc.span(ms, (target[0], target[1] - 3) if target else (pg, value[0] + 4), (end_label[0], soc.row_top(ms[end_label[0]], end_label[1]) - 1), soc.ms_frame)
            grid = head + body
            continue
        if kind != "label" or n + 1 >= len(events) or kinds[n + 1] != "indicative" or value in out:
            continue
        end = next(((e[0], soc.row_top(ms[e[0]], e[1]) - 1) for e, k in zip(events[n + 1:], kinds[n + 1:]) if k in ("label", "grid", "section")), doc_end)
        pieces = soc.span(ms, (pg, soc.row_top(ms[pg], y)), end, soc.ms_frame) + (grid or [])
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    questions = qp_questions(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, {q for q, *_ in questions}) if ms else {}
    er = soc.examiner_report(er_path)
    parts, problems = [], []
    for q, pieces, stem, text, stem_text, marks in questions:
        group = group_of(q)
        pid = f"{set_id}-{group}-{q}"
        qimg = soc.render(qp, pieces, 36)
        if stem:
            cut.save(soc.render(qp, stem, 16), f"{set_id}-{group}-stem.webp")
        msimg, ms_text = None, ""
        if q in schemes:
            mpieces, ms_text = schemes[q]
            msimg = soc.render(ms, mpieces, 12)
            if not re.search(r"Indicative content", ms_text) or not re.search(r"Level\s+Marks|Descriptors", ms_text):
                problems.append(f"{pid}: its scheme lacks the indicative content or the levels grid")
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "group": group, "option": "c" if group == "c" else None, "label": q, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{group}-stem.webp" if stem else None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text + " " + stem_text).strip()[:3000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
        })
    return parts, problems


soc.cut_set = cut_set  # run_set and main look it up as they run

if __name__ == "__main__":
    soc.main()
