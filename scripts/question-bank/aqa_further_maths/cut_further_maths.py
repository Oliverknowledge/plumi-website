"""Cut AQA's A-Level and AS Further Maths papers into questions, each with its mark scheme rows.

    python3 scripts/question-bank/aqa_further_maths/cut_further_maths.py [work-dir] [--only=73671-jun23]
    # default work dir: scripts/question-bank/.work/aqa-further-maths

aqa_maths/cut_maths.py run over 7367 and 7366, which AQA sets as it sets A-Level Maths:
bold labels in the margin, answer lines, and a "Q | Marking instructions | AO | Marks |
Typical solution" scheme. What differs: many questions open with a matrix, a column
vector, a sum or a stacked fraction on the label's line, standing taller than the label
(June 2023 Paper 1 question 3's matrix starts 16pt above its "3"). A question starts at
the top of that line, not of its label, so the top row isn't left on the question before
(the fix aqa_l2_further_maths/cut_l2fm.py makes for 8365). Writes what cut_maths.py
writes: <work-dir>/img/<id>-qp.webp and -ms.webp and <work-dir>/parts.json, one entry per
question, id "73673m-jun23-04".

The older schemes of Papers 1 and 2 (June 2019, November 2020) draw their table further
right, their labels at x 82-87, and each table's columns sit a little differently: a label
is one that starts left of its own table's "Marking instructions" heading (the nearest above
it on the page), not left of a fixed x, since newer schemes print a bold "(a)(ii)" at the
start of that column. Row rules start left of x 90 (MS_RULE_X). November 2020 Paper 2's scheme prints question 5's
number in regular type: a plain number in the Q column counts when it is the question
missing between two the scheme does label.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "aqa-further-maths")
sys.argv = [sys.argv[0], WORK, *[a for a in sys.argv[1:] if a.startswith("--")]]
sys.path.insert(0, os.path.join(HERE, "..", "aqa_maths"))
import cut_maths  # noqa: E402

cut_maths.MS_RULE_X = 90
# Some tables print the heading over two lines, "Marking" above "instructions".
HEADING = re.compile(r"Marking(\s+instructions)?", re.I)
TEXT_X = 100  # the question's words start at x 108, right of the margin labels


def line_top(page, y, reach=40):
    """The top of the ink on a label's line, which starts at y: whatever overlaps the line (a matrix's
    brackets, its top row, a fraction's numerator), and whatever overlaps that, up to `reach` above."""
    frame = cut_maths.qp_frame(page)
    items = [(l["bbox"][1], l["bbox"][3]) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
             if TEXT_X < l["bbox"][0] < frame.x1 - 10 and "".join(s["text"] for s in l["spans"]).strip()]
    items += [(d["rect"].y0, d["rect"].y1) for d in page.get_drawings()
              if d["rect"].x0 > TEXT_X and d["rect"].width < 400 and d["rect"].height < 120]
    top = y
    while True:
        up = min((y0 for y0, y1 in items if y - reach <= y0 < top and y1 > top + 1 and y0 > frame.y0), default=top)
        if up >= top:
            return top
        top = up


_qp_labels = cut_maths.qp_labels


def qp_labels(doc):
    return [(pg, line_top(doc[pg], y), *rest) for pg, y, *rest in _qp_labels(doc)]


cut_maths.qp_labels = qp_labels

_ms_labels = cut_maths.ms_labels


def column_left(doc, i, y, cache={}):
    """Where the Marking instructions column starts in the table holding y on page i."""
    if (doc.name, i) not in cache:
        cache[(doc.name, i)] = sorted((s["bbox"][1], s["bbox"][0]) for s in cut_maths.spans(doc[i]) if HEADING.fullmatch(s["text"].strip()))
    heads = cache[(doc.name, i)]
    above = [x for hy, x in heads if hy <= y + 2]
    return above[-1] if above else heads[0][1] if heads else 100


def ms_labels(doc):
    cut_maths.MS_LABEL_X = 110  # candidates; each is then held to its own table's Q column
    start, labels = _ms_labels(doc)
    found = {int(q) for _, _, q, _, _ in labels}
    gaps = set(range(min(found, default=0), max(found, default=0))) - found
    for i in range(start, len(doc)):
        page = doc[i]
        for s in cut_maths.spans(page):
            x, y, m = s["bbox"][0], s["bbox"][1], re.match(r"(\d{1,2})(?:\s|$)", s["text"].strip())  # "5 Selects a correct"
            if x < cut_maths.MS_LABEL_X and m and int(m.group(1)) in gaps and 60 < y < page.rect.height - 50:
                labels.append((i, y, m.group(1), None, None))
                gaps.discard(int(m.group(1)))
    labels.sort(key=lambda l: (l[0], l[1]))
    keep = []
    for lab in labels:
        i, y = lab[0], lab[1]
        x = min((s["bbox"][0] for s in cut_maths.spans(doc[i]) if abs(s["bbox"][1] - y) < 0.5), default=0)
        if x < column_left(doc, i, y) - 2:
            keep.append(lab)
    return start, keep


cut_maths.ms_labels = ms_labels

if __name__ == "__main__":
    cut_maths.main()
