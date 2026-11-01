"""Cut AQA's Religious Studies papers into question parts, each with its whole mark scheme and examiner's comments.

    python3 scripts/question-bank/aqa_rs/cut_rs.py [work-dir] [--only=70622b]   # default scripts/question-bank/.work/aqa-rs

Religious Studies' papers are laid out as Philosophy's are, so this is cut_philosophy.py
(cut_psychology.py, itself cut.py with Psychology's patches): the same boxed labels
("0 1 . 1"), the same scheme read as text from one label to the next, across pages, and
the same end at the question's marks ("[10 marks]"), so the "and", "Either"/"or" and
section headings between parts are left out. What differs:

  - Every question has parts ("01.1" Examine..., "01.2" Evaluate...; Paper 2's essays
    are "03.1"), and a "Question 2" heading over each question. The heading is cut off
    the part above, as a section heading is, in the paper and in its scheme, and a
    section's instructions ("Answer one question from this section.", "Either") are
    part of its heading block.
  - A scheme's own rows hold only the question's indicative content; the levels it is
    marked by are two grids at the front of the scheme ("Levels of Response: 10 marks
    A-level - AO1", "... 15 marks ... AO2"). Each part's scheme crop gets the grid its
    marks use under its content: AO1 for a 10-mark part, AO2 for a 15-mark one, and
    both for a 25-mark essay, which the scheme marks as AO1 (10) plus AO2 (15).
  - Reports comment part by part ("1.1 Examine...", "01.1", "Question 1.1", "3.1:"),
    so each part gets its own comment, not its question's.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-rs")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_philosophy"))
import cut_philosophy  # noqa: E402  (patches cut.py for this layout as it is imported)

cut, cut_psychology = cut_philosophy.cut, cut_philosophy.cut_psychology
cut_psychology.HEADING = re.compile(cut_psychology.HEADING.pattern[:-1] + r"|Question \d+$)")
cut_psychology.INSTRUCTION = re.compile(cut_psychology.INSTRUCTION.pattern[:-1] + r"|Answer (one|both) questions?|Each question has|Question \d+$|Either$|or$|and$)", re.I)
GRID = re.compile(r"Levels of Response:\s*(\d+) marks", re.I)
MARKS = re.compile(r"\[(\d+) marks?\]")
# Paper 1's parts, then Paper 2's: a two-part question per topic area, then the dialogues' essays.
LABELS = {"70621": ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2"],
          "70622": ["1.1", "1.2", "2.1", "2.2", "3.1", "4.1", "5.1", "6.1"]}


def grids(doc):
    """{10: [(page, rect)], 15: [...]}: each levels grid at the front of a scheme, from its heading to the page's foot."""
    out = {}
    for n, page in enumerate(doc):
        if cut.left_labels(page, 110, False):
            break  # the questions have started
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                m = GRID.search("".join(s["text"] for s in line["spans"]))
                if m and int(m.group(1)) not in out:
                    f = cut.ms_frame(page)
                    out[int(m.group(1))] = [(n, pymupdf.Rect(f.x0, line["bbox"][1] - 6, f.x1, f.y1))]
    return out


_regions = cut.regions


def regions(doc, max_x, bold_only, portrait):
    out = _regions(doc, max_x, bold_only, portrait)
    if not portrait:
        levels = grids(doc)
        for r in out:
            m = MARKS.search(r[2])
            marks = int(m.group(1)) if m else 0
            # The text stays the part's own (for search and tagging); only the crop gains its grids.
            r[1] = r[1] + [piece for k in ((10, 15) if marks == 25 else (marks,)) for piece in levels.get(k, [])]
    return out


NOISE = re.compile(r"^\s*(REPORT ON THE EXAMINATION.*|.*© ?\d{4} AQA.*|\d+ of \d+|Section [A-C]\b.*|General comments:?)\s*$", re.M | re.I)
END = re.compile(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\b", re.I)
BRACKET = re.compile(r"[\[(]\s*\d+\s*marks?\s*[\])]", re.I)


def report_by_part(path, comp):
    """{'01.1': its examiner's comments}. Each part's heading is found in order, so a part
    named in passing ("1.1 asked students to...") is never a heading: a heading's label is
    followed by the end of its line, a colon or point, or the question's own words."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = NOISE.sub("", text)
    heads, at = [], 0
    for label in LABELS[comp[:5]]:
        q, p = label.split(".")
        m = re.compile(rf"(?m)^[ \t]*(?:Question\s*)?0?{q}\s?\.\s?{p}(?!\d)[.:]?[ \t]*(?=\n|[A-Z‘'“\"])").search(text, at)
        if m:
            heads.append((f"0{q}.{p}", m.start(), m.end()))
            at = m.end()
    out = {}
    for n, (label, start, body) in enumerate(heads):
        stop = heads[n + 1][1] if n + 1 < len(heads) else len(text)
        chunk = END.split(text[body:stop])[0]
        # The heading repeats the question and its marks: the comment starts after them.
        marks = BRACKET.search(chunk[:600])
        if marks:
            chunk = chunk[marks.end():]
        else:
            # "Question 3.1 Dialogue of Philosophy and Judaism": a title, not the comment.
            first, _, rest = chunk.partition("\n")
            if first.strip() and len(first.strip()) < 60 and not first.strip().endswith("."):
                chunk = rest
        # A part whose heading was left out ("‘There is little agreement...’ Evaluate this claim. [15 marks]"
        # under 2.1's comment): the next part's question and marks inside this one's comment start it.
        q, p = label.split(".")
        twin = f"{q}.2"
        if p == "1" and twin.lstrip("0") in LABELS[comp[:5]] and twin not in {h[0] for h in heads}:
            second = BRACKET.search(chunk)
            if second:
                opening = max(chunk.rfind("\n‘", 0, second.start()), chunk.rfind("\n'", 0, second.start()))
                if opening > 0 and twin not in out:
                    out[twin] = cut_psychology.tidy(chunk[second.end():])
                    chunk = chunk[:opening]
        tidy = cut_psychology.tidy(chunk)
        if tidy:
            out[label] = tidy
    return {k: v for k, v in out.items() if v}


def without_question(report, question):
    """The comment without the question's own words in front of it, where a report repeats
    them with no marks after (June 2023 Paper 1: "Examine how Process Theodicy influences
    ... suffering. Whilst there were...")."""
    want = re.sub(r"[^a-z]", "", re.sub(r"^[\d\s.]+|\[\d+ marks?\]", "", question).lower())
    got, at, last = 0, len(report), 0
    for n, ch in enumerate(report):
        if not ch.isalpha():
            continue
        if got < len(want) and ch.lower() == want[got]:
            got, last = got + 1, n
        else:
            at = n
            break
    # All of the question, or its opening sentence (the claim without "Evaluate this claim.").
    if got < 20 or (got < len(want) and not re.search(r"[.?’'”\n]", report[last + 1:at])):
        return report
    return report[at:]


_cut_set = cut.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, None, set_id, meta)
    reports = report_by_part(er_path, meta["component"])
    for p in parts:
        p["er"] = reports.get(p["label"]) and without_question(reports[p["label"]], p["text"])
    return parts


cut.regions = regions
cut.cut_set = cut_set

if __name__ == "__main__":
    cut.main()
