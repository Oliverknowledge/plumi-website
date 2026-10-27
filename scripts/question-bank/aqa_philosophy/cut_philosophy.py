"""Cut AQA's Philosophy papers into questions, each with its mark scheme and examiner's comments.

    python3 scripts/question-bank/aqa_philosophy/cut_philosophy.py [work-dir] [--only=71722]   # default scripts/question-bank/.work/aqa-philosophy

Philosophy's papers are laid out as Psychology's are, so this is cut_psychology.py
(itself cut.py with Psychology's patches): the same boxed labels ("0 1"), the same
scheme read as text from one label to the next (the levels grid and the indicative
content stay whole, across pages), and the same "Section B / Moral philosophy"
heading cut off the question above it. Every question is whole: there are no parts.

A question ends at its marks ("[25 marks]"), as in cut_economics.py: Philosophy
asks in a line or two, so the answer lines under it (a page or more for an essay)
would otherwise be most of the crop.

The schemes' text runs out to 560pt, past the right margin Psychology's frame
keeps (541pt), so a scheme page is cut 30pt from its edge.

What differs is the examiner's report. Each question's comment is headed by the
question, with or without the word ("Question 4: Explain..." or "04: Explain...
[12 marks]"): a comment runs from its heading, past the question's own words, to
the next question's heading.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-philosophy")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_psychology"))
import cut_psychology  # noqa: E402  (patches cut.py for this layout as it is imported)

cut = cut_psychology.cut
# A section's heading block names its area on the line under "Section B" ("The Metaphysics of Mind"): part of the heading, not the question.
cut_psychology.INSTRUCTION = re.compile(cut_psychology.INSTRUCTION.pattern[:-1] + r"|((The )?Metaphysics of (God|Mind)|Epistemology|Moral philosophy)$)", re.I)
MARKS = re.compile(r"\[\d+ marks?\]")
NOISE = re.compile(r"^\s*(REPORT ON THE EXAMINATION.*|© ?\d{4} AQA.*|\d+ of \d+|Section [AB]\b.*)\s*$", re.M | re.I)  # the running header is in capitals until 2024
END = re.compile(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\s*\n", re.I)


def examiner_report(path):
    """{question: its examiner's comments}, finding questions 1 to 10 in order, so a
    mention in passing ("Question 05 and Question 10 are just below...") is never a heading."""
    if not path or not os.path.exists(path):
        return {}
    text = NOISE.sub("", "\n".join(p.get_text() for p in pymupdf.open(path)))
    heads, at = [], 0
    for q in range(1, 11):
        m = re.compile(rf"(?m)^[ \t]*(?:Question\s*)?0?{q}\s*:\s").search(text, at)
        if not m:
            continue
        heads.append((f"{q:02d}", m.start(), m.end()))
        at = m.end()
    out = {}
    for n, (q, start, body) in enumerate(heads):
        stop = heads[n + 1][1] if n + 1 < len(heads) else len(text)
        chunk = text[body:stop]
        chunk = END.split(chunk)[0]
        # The heading repeats the question and its marks: the comment starts after them.
        marks = re.search(r"[\[(]\d+\s+marks?[\])]", chunk[:400])
        chunk = chunk[marks.end():] if marks else chunk
        tidy = cut_psychology.tidy(chunk)
        if tidy:
            out[q] = tidy
    return out


def end_at_marks(doc, pieces):
    """The pieces up to the foot of the line that prints the question's marks."""
    for n, (pg, rect) in enumerate(pieces):
        for block in doc[pg].get_text("dict", clip=rect)["blocks"]:
            for line in block.get("lines", []):
                if MARKS.search("".join(s["text"] for s in line["spans"])):
                    return pieces[:n] + [(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1, line["bbox"][3] + 8)))]
    return pieces


_regions = cut.regions


def regions(doc, max_x, bold_only, portrait):
    out = _regions(doc, max_x, bold_only, portrait)
    if portrait:
        for r in out:
            r[1] = end_at_marks(doc, r[1])
            r[2] = "\n".join(doc[pg].get_text("text", clip=rect) for pg, rect in r[1])
    return out


def ms_frame(page):
    f = cut_psychology.frame(page, False)
    f.x1 = page.rect.width - 30
    return f


cut.examiner_report = examiner_report
cut.ms_frame = ms_frame
cut.regions = regions

if __name__ == "__main__":
    cut.main()
