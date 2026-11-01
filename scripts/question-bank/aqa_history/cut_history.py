"""Cut AQA's A-Level History papers into questions, each with its sources, mark scheme and examiner's comments.

    python3 scripts/question-bank/aqa_history/cut_history.py [work-dir] [--only=70421h]   # default scripts/question-bank/.work/aqa-history

History's papers are laid out as Philosophy's are, so this is cut_philosophy.py
(cut_psychology.py, itself cut.py with Psychology's patches): the same boxed labels
("0 1"), whole questions with no parts, each ending at its marks ("[25 marks]"), the
"Section B / Answer two questions." heading cut off the question above, and the scheme
read as text from one label to the next, across pages, so each crop holds the
question's levels grid ("Generic Mark Scheme", L5 to L1) and all its indicative content.
What differs:

  - Question 01 is set on three extracts (Component 1, interpretations) or three sources
    (Component 2), printed between the "Section A" heading and its label. They are the
    question's stem (<set>-01-stem.webp), shown above it, from "Extract A" or "Source A"
    to the label. Where AQA's copy of the paper had to leave an extract out for copyright
    ("-CR"), its stem shows AQA's note in its place, with the book it came from; the
    space it leaves is closed up. The question's id ends "-q" (70421h-jun23-01-q), as
    Eduqas GCSE History's do, so partImage finds the stem; every question's does.
    The stem starts at the top of the extract's box, and each page below the running
    header's rule.
  - The papers are answered in a separate answer book, so the text runs out to the
    marks at 542pt and the extracts' line numbers at 545pt: the frame's right edge is
    the page's less 40pt, not cut.py's 537pt.
  - Each option's report heads its questions its own way ("Question 01", "Q1", "Section A,
    Q1", "Report on Question 2", "Question One"), and some list them on a contents page or
    under general guidance first: examiner_report() below reads them all.
  - One scheme prints a bullet over "Section B", which cut_psychology.py's heading_split
    took for the question's own heading: heading_split() below steps past it.
"""
import os, re, sys

import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-history")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "aqa_philosophy"))
import cut_philosophy  # noqa: E402  (patches cut.py for this layout as it is imported)

cut, cut_psychology = cut_philosophy.cut, cut_philosophy.cut_psychology
cut_psychology.INSTRUCTION = re.compile(cut_psychology.INSTRUCTION.pattern[:-1] + r"|Answer (two|three) questions|Answer Question 0?1)", re.I)
SOURCE = re.compile(r"^(Extract|Source|Interpretation) A\b", re.I)  # "EXTRACT A" in some papers
_frame = cut.frame


def heading_split(doc, pieces):
    """cut_psychology's, past a lone bullet: one scheme prints "•" over "Section B", and the
    heading, read as the question's second line, emptied every question below it (2T, June 2025)."""
    for n, (pg, rect) in enumerate(pieces):
        lines = [ln for ln in cut.text_lines(doc[pg], rect) if ln[2].strip() not in ("•", "●", "-")]
        y = next((y for y, x, t in lines[0 if n else 1:] if cut_psychology.HEADING.match(t)), None)
        if y is not None:
            return n, y
    return None


# Reports head each question their own way, on a line of its own: "Question 01", "Question  03",
# "Q1", "O1" (a letter O), a bare "02", "Question One", "Section A, Q1", "Section B , Q4.",
# "Report on Question 2", "Question 1: The ‘Extract’ Question", "Questions 2-4: Essay questions";
# or opening the paragraph, "Q2 This question was answered well". A section's own heading
# ("Section B") covers its questions where nothing names them one by one.
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4}
NUM = r"(0?[1-4]|One|Two|Three|Four)"
REPORT_HEADING = re.compile(
    r"^[ \t]*(Section\s+[AB]\s*[,:–-]?\s*)?(Report on\s+)?((?-i:Questions?|Q)\s*|O(?=\d))?" + NUM
    + r"(?:\s*(?:-|–|and|&|to)\s*(?:Questions?\s*|Q\s*)?" + NUM + r")?"
    + r"(?:[ \t]*(?:[.:][^\n]*|\([^)\n]*\))?[ \t]*$|[ \t]+(?=(?-i:[A-Z‘'])))", re.I | re.M)
SECTION_HEADING = re.compile(r"^[ \t]*Section\s+([AB])\b[^\n]{0,40}$", re.M)
REPORT_FURNITURE = re.compile(r"^\s*(REPORT ON THE EXAMINATION.*|© ?\d{4} AQA.*|\d+ of \d+)\s*$", re.I | re.M)


def number(s):
    return WORDS.get(s.lower()) or int(s)


def examiner_report(path):
    """{question: its examiner's comments}, from the report's headings. Where a question is
    headed more than once (in the contents, in general guidance on the Extract question, then
    "Report on Question 1"), the report's own heading wins, else the longest comment; each
    comment runs to the next heading. With no headings, cut_psychology.py's reader, which
    takes prose that names its questions ("On Question 02, ...")."""
    if not path or not os.path.exists(path):
        return {}
    text = REPORT_FURNITURE.sub("", "\n".join(p.get_text() for p in pymupdf.open(path)))
    # The report ends at its closing sections, which its contents page lists too: the last, past the first question.
    first = next((m.start() for m in REPORT_HEADING.finditer(text) if m.group(1) or m.group(2) or m.group(3)), 0)
    ends = [m.start() for m in re.finditer(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\s*\n", text, re.I) if m.start() > first]
    text = text[:ends[-1]] if ends else text
    heads = []  # (start, end, questions, the report's own heading)
    for m in REPORT_HEADING.finditer(text):
        prefixed = bool(m.group(1) or m.group(2) or m.group(3))
        if not m.group(4).isdigit() and not (m.group(3) or "").lower().startswith("question"):
            continue  # "Question One", never a line that opens "One of..."
        if not prefixed and len(m.group(4)) < 2:
            continue  # a bare "3" is a contents page's page number; a bare "03" is a heading
        if not prefixed and not re.fullmatch(r"\s*\d+\.?\s*", m.group(0)):
            continue  # only a prefixed number opens a paragraph ("Q2 This question...")
        lo, hi = number(m.group(4)), number(m.group(5) or m.group(4))
        if hi >= lo:
            heads.append((m.start(), m.end(), range(lo, hi + 1), bool(m.group(2))))
    for m in SECTION_HEADING.finditer(text):
        if not any(h[0] == m.start() for h in heads):
            heads.append((m.start(), m.end(), range(1, 2) if m.group(1) == "A" else range(2, 5), False))
    heads.sort()
    if not heads:
        return cut_psychology.examiner_report(path)
    out = {}
    for q in range(1, 5):
        own = [h for h in heads if q in h[2]]
        # A range's or a section's heading only where nothing heads the question itself.
        own = [h for h in own if len(h[2]) == 1] or own
        if not own:
            continue
        # A contents page lists the headings too, with nothing under them: the longest comment wins.
        bodies = [(h[3] and len(b) > 300, len(b), b) for h in own
                  for b in [cut_psychology.tidy(text[h[1]:next((g[0] for g in heads if g[0] >= h[1]), len(text))])]]
        best = max(bodies)[2]
        if best:
            out[f"{q:02d}"] = best
    return out


def frame(page, portrait=True):
    f = _frame(page, portrait)
    if portrait:
        f.x1 = page.rect.width - 40
        f.y0 = max(f.y0, 64)  # below the running header's rule (61pt)
    return f


def squeeze(img, gap=60):
    """Close up runs of blank rows taller than `gap` px (an extract AQA left out leaves half a page)."""
    if img is None:
        return None
    grey = img.convert("L")
    w, h = grey.size
    px = grey.load()
    ink = [any(px[x, y] < 200 for x in range(0, w, 3)) for y in range(h)]
    keep, run = [], 0
    for y in range(h):
        run = 0 if ink[y] else run + 1
        if run <= gap:
            keep.append(y)
    if len(keep) == h:
        return img
    out = Image.new("RGB", (w, len(keep)), (255, 255, 255))
    for n, y in enumerate(keep):
        out.paste(img.crop((0, y, w, y + 1)), (0, n))
    return out


def stem_pieces(qp, label_page, label_y):
    """Question 01's extracts or sources: from the first "Extract A"/"Source A" line to its label."""
    for pg in range(label_page + 1):
        for y, x, t in cut.text_lines(qp[pg], frame(qp[pg])):
            if SOURCE.match(t):
                # From the top of the box the extract is printed in, where there is one.
                rules = [d["rect"].y0 for d in qp[pg].get_drawings() if d["rect"].width > 300 and d["rect"].height < 3 and y - 60 < d["rect"].y0 < y]
                y = max(rules) + 3 if rules else y  # the crop starts 6pt above y
                pieces = []
                for n in range(pg, label_page + 1):
                    f = frame(qp[n])
                    top = y - 6 if n == pg else f.y0
                    end = label_y - 6 if n == label_page else f.y1
                    if end > top + 8:
                        pieces.append((n, pymupdf.Rect(f.x0, top, f.x1, end)))
                return pieces
    return []


def label_at(qp, q):
    """(page, y) of a question's label in the paper."""
    for n, page in enumerate(qp):
        for y, lq, lp in cut.left_labels(page, 75, True):
            if lq == q and lp is None:
                return n, y
    return None


_cut_set = cut.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = pymupdf.open(qp_path)
    for p in parts:
        old = p["id"]
        p["id"] = f"{old}-q"
        for kind in ("qp", "ms"):
            if p[kind]:
                os.replace(os.path.join(cut.IMG, p[kind]), os.path.join(cut.IMG, f"{p['id']}-{kind}.webp"))
                p[kind] = f"{p['id']}-{kind}.webp"
        p["stemText"] = ""
        if p["question"] == "01" and (at := label_at(qp, "01")):
            pieces = stem_pieces(qp, *at)
            if pieces:
                p["stem"] = cut.save(squeeze(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in pieces])), f"{set_id}-01-stem.webp")
                p["stemText"] = re.sub(r"\s+", " ", " ".join(qp[pg].get_text("text", clip=r) for pg, r in pieces)).strip()[:3000]
                p["removed"] = len(re.findall(r"not reproduced here", p["stemText"], re.I))
    return parts


cut.frame = frame
cut.examiner_report = examiner_report
cut.cut_set = cut_set
cut_psychology.heading_split = heading_split

if __name__ == "__main__":
    cut.main()
