"""Cut AQA's Computer Science papers into question parts, each with its mark scheme.

    python3 scripts/question-bank/computer_science/cut_aqa_cs.py [work-dir] [--only=75172]   # default scripts/question-bank/.work/aqa-cs

cut.py, with these differences for Computer Science:
  - The mark schemes set a question's number and its part in two columns, "Qu" and
    "Pt" ("01" | "1"), which cut.py would read as one number, "011": read them as "01.1".
  - Paper 1 is taken on screen, around a Skeleton Program and Preliminary Material that
    AQA releases to centres beforehand. Its first section (theory) and its programming
    task written from a new, empty program stand on their own; the section that opens
    "These questions refer to the Preliminary Material and the Skeleton Program", and
    every section after it (changes to the Skeleton Program), can't be answered without
    them. Those questions are left out: the paper is cut up to the first question under
    that heading.
  - The examiners' reports head their comments "Question 4", "Question 1.1 and 1.2",
    "Questions 5, 6 and 7" or "Question 2.1 – 2.2": a comment goes to every question its
    heading names.
"""
import collections, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-cs")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(HERE), "edexcel_sciences"))
from cut_pearson import squash  # noqa: E402

SECTION = re.compile(r"^Section [A-D]\s*$")
# A section's instructions, which cut.py's move_setups can hand to the question after them as its setup.
INSTRUCTIONS = re.compile(r"^(You are advised to|Enter your answers|Type your answers|You must save|The question in this section|Question \d+ in this section|starting from a new program|asks you to write program code|These questions refer)", re.I)
SETUP = re.compile(r"^(Figure|Table) \d+ (shows|is repeated|are repeated|contains|lists|gives)\b")
SKELETON = re.compile(r"refer to the Preliminary Material and the Skeleton Program|require you to load the Skeleton Program", re.I)
_norm, _left_labels = cut.norm, cut.left_labels


def ms_norm(text):
    m = re.fullmatch(r"(\d{2})\s*(\d{1,2})", re.sub(r"\s+", " ", text).strip())
    return f"{m.group(1)}.{m.group(2)}" if m else _norm(text)


def left_labels(page, max_x, bold_only, with_x=False):
    if bold_only:  # a question paper's boxed labels
        return _left_labels(page, max_x, bold_only, with_x)
    cut.norm = ms_norm
    try:
        found = _left_labels(page, max_x, bold_only, True)
    finally:
        cut.norm = _norm
    # Only in the "Qu" column (x 48-54): binary working in the answer column, "10" then "1", isn't 10.1.
    return [lab if with_x else lab[:3] for lab in found if lab[3] < 75]


def skeleton_from(doc):
    """The first question that needs the Skeleton Program, as "07"; None for a paper without one."""
    for i, page in enumerate(doc):
        hit = next((y for y, x, t in cut.text_lines(page, page.rect) if SKELETON.search(t)), None)
        if hit is None:
            continue
        for j in range(i, len(doc)):
            labels = [q for y, q, p in _left_labels(doc[j], 75, True) if j > i or y > hit]
            if labels:
                return labels[0]
    return None


HEADING = re.compile(r"\n[ \t]*Questions?[ \t]+(\d{1,2}(?:\.\d{1,2})?(?:[ \t]*(?:,|and|&|–|-)[ \t]*\d{1,2}(?:\.\d{1,2})?)*)[ \t]*\n")
NOISE = re.compile(r"^\s*(REPORT ON THE EXAMINATION.*|Report on the examination.*|© ?\d{4} AQA.*|\d+ of \d+)\s*$", re.I | re.M)


def tidy(body):
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
    return re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))


def examiner_report(path):
    """{question: its examiner's comments}, part headings ("Question 1.1") kept at the top of their comment."""
    if not path or not os.path.exists(path):
        return {}
    text = NOISE.sub("", "\n".join(p.get_text() for p in pymupdf.open(path)))
    pieces = HEADING.split(text)
    out = {}
    for k in range(1, len(pieces) - 1, 2):
        head, body = pieces[k], pieces[k + 1]
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)", body)[0]
        body = tidy(body)
        if not body:
            continue
        piece = (f"Question {head.strip()}\n\n" if "." in head else "") + body
        for q in dict.fromkeys(f"{int(n):02d}" for n in re.findall(r"(?<![.\d])(\d{1,2})(?:\.\d{1,2})?", head)):
            out[q] = out[q] + "\n\n" + piece if q in out else piece
    return out


_regions = cut.regions


def regions(doc, max_x, bold_only, portrait):
    """cut.regions, without the questions that need the Skeleton Program (only Paper 1 has any),
    and each ending above a section's heading ("Section B", then its instructions)."""
    out = _regions(doc, max_x, bold_only, portrait)
    stop = skeleton_from(doc) if portrait else None
    out = [r for r in out if not stop or r[0][0] < stop]
    for r in out if portrait else []:
        pg, rect = r[1][0] if r[1] else (None, None)
        lines = cut.text_lines(doc[pg], rect) if r[1] else []
        last = max((k for k, (y, x, t) in enumerate(lines) if INSTRUCTIONS.match(t)), default=None)
        if last is not None and last + 1 < len(lines):
            # start below the section's instructions, at the next line that isn't one of them
            r[1][0] = (pg, pymupdf.Rect(rect.x0, lines[last + 1][0] - 6, rect.x1, rect.y1))
            r[2] = "\n".join(doc[p].get_text("text", clip=c) for p, c in r[1])
        for n, (pg, rect) in enumerate(r[1]):
            y = next((y for k, (y, x, t) in enumerate(cut.text_lines(doc[pg], rect)) if (n or k) and SECTION.match(t)), None)
            if y is not None:
                r[1] = r[1][:n] + ([(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, y - 6))] if y - 6 > rect.y0 + 8 else [])
                r[2] = "\n".join(doc[p].get_text("text", clip=c) for p, c in r[1])
                break
    return out


def move_setups(doc, out):
    """cut.move_setups, with the text margin read first as the indent most of the part's lines start
    at, then as the leftmost: a figure's row labels ("Plaintext", "Ciphertext") can sit left of the
    text. A line introducing a figure or table for what follows starts a setup wherever it's set."""
    for n in range(len(out) - 1):
        key, pieces, text = out[n]
        if not pieces or key[1] is None:
            continue
        pg, rect = pieces[-1]
        lines = cut.text_lines(doc[pg], rect)
        marks_y = next((y for y, x, t in lines if re.search(r"\[\d+ marks?", t)), None)
        if marks_y is None and len(pieces) == 1:
            continue  # the marks haven't been printed yet: everything here is this part's
        indents = collections.Counter(round(x) for y, x, t in lines if x > rect.x0 + 30)
        if not indents or any(re.match(r"Tick\b", t) for y, x, t in lines):
            continue  # a tick-box part's options are full sentences at the margin too
        after = marks_y if marks_y is not None else rect.y0
        split = None
        # The indent most lines start at, then (as cut.py) the leftmost.
        for margin in dict.fromkeys([min(indents, key=lambda x: (-indents[x], x)), min(indents)]):
            # Paragraphs at the margin after the marks: lines no more than ~1.5 lines apart.
            paras, last_y = [], None
            for y, x, t in lines:
                if y <= after + 2:
                    continue
                if abs(x - margin) < 12 and paras and last_y is not None and y - last_y < 17:
                    paras[-1][1].append(t)
                elif abs(x - margin) < 12:
                    paras.append((y, [t]))
                last_y = y
            split = next((y for y, ts in paras if " ".join(ts).endswith(".") and len(" ".join(ts).split()) >= 6
                          and ts[0][:1].isupper() and not re.match(r"(Answer|Extra space|Show your working)", ts[0])), None)
            if split is not None:
                break
        # A figure or table introduced for what follows, wherever it's set: "Table 1 shows the standard
        # AQA assembly language instruction set that should be used to answer question part 07.1".
        intro = next((y for y, x, t in lines if y > after + 2 and SETUP.match(t)), None)
        split = min(y for y in (split, intro) if y is not None) if split is not None or intro is not None else None
        if split is None:
            continue
        cut_y = split - 6
        if cut_y <= rect.y0 + 8 and len(pieces) == 1:
            continue  # the whole part would move: it is its own setup
        moved = pymupdf.Rect(rect.x0, cut_y, rect.x1, rect.y1)
        moved_text = doc[pg].get_text("text", clip=moved)
        out[n] = [key, pieces[:-1] + ([(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, cut_y))] if cut_y > rect.y0 + 8 else []), text.replace(moved_text, "")]
        nkey, npieces, ntext = out[n + 1]
        if npieces and npieces[0][0] == pg and abs(npieces[0][1].y0 - rect.y1) < 2:
            first = npieces[0][1]
            out[n + 1] = [nkey, [(pg, pymupdf.Rect(first.x0, cut_y, first.x1, first.y1))] + npieces[1:], moved_text + "\n" + ntext]
        else:
            out[n + 1] = [nkey, [(pg, moved)] + npieces, moved_text + "\n" + ntext]


def row_start(page, y, floor=0):
    """cut.row_start, reading Computer Science's column headings, "Qu" | "Pt", as cut.py reads
    "Question": a row directly under them starts above them, so the crop of the row before
    doesn't end with the next table's header."""
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})
    above = [r for r in rules if r <= y + 2]
    if not above:
        return y - 6
    top = above[-1]
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip() in ("Question", "Qu") and "Bold" in s["font"] and max(top - 60, floor) < s["bbox"][1] < top:
                    head = [r for r in rules if r <= s["bbox"][1] + 2]
                    return (head[-1] if head else s["bbox"][1] - 8) - 1
    return top - 1


_save = cut.save


def save(img, name):
    """A scheme crop with its empty stretches closed up: Paper 1's levels-of-response rows run on
    for a page under a short answer."""
    return _save(squash(img) if img is not None and name.endswith("-ms.webp") else img, name)


_frame = cut.frame


def frame(page, portrait=True):
    """Paper 1 is answered on screen, so its pages have no answer boxes and no "Do not write outside
    the box" margin: its text runs out to 547pt and down to the footer, past cut.py's frame."""
    if not portrait or "Do not write" in page.get_text():
        return _frame(page, portrait)
    w, h = page.rect.width, page.rect.height
    foot = [y for y, x, t in cut.text_lines(page, page.rect) if y > h / 2 and (t.startswith("Turn over") or t.startswith("IB/") or t.startswith("END OF QUESTIONS"))]
    return pymupdf.Rect(40, 46, w - 40, (min(foot) if foot else h - 60) - 4)


cut.left_labels, cut.examiner_report, cut.regions, cut.frame, cut.save = left_labels, examiner_report, regions, frame, save
cut.move_setups, cut.row_start = move_setups, row_start

if __name__ == "__main__":
    cut.main()
