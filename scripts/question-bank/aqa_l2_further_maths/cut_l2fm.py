"""Cut AQA's Level 2 Further Maths (8365) papers into questions, each with its mark scheme rows.

    python3 scripts/question-bank/aqa_l2_further_maths/cut_l2fm.py [work-dir] [--only=83651-jun23]
    # default work dir: scripts/question-bank/.work/aqa-l2fm

gcse_maths/cut_aqa_gcse_maths.py run over 8365, which AQA sets as it sets GCSE Maths:
bold labels in the margin, drawn working lines, "Answer" lines, and a "Q | Answer |
Mark | Comments" scheme with each label centred in a cell its rows' height. What differs:
  - The scheme's Q column is narrower in some years (June 2025 Paper 1's ends at x 84),
    so the rule over a label's cell is any that reaches past x 80.
  - Many questions open with a matrix, a column vector or a fraction on the label's line,
    standing taller than the label: a question starts at the top of that line, not of its
    label, so the matrix's top row isn't left on the question before. Writes what
cut_maths.py writes: <work-dir>/img/<id>-qp.webp and -ms.webp and <work-dir>/parts.json,
one entry per question, id "83651-jun23-09".
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "aqa-l2fm")
sys.argv = [sys.argv[0], WORK, *[a for a in sys.argv[1:] if a.startswith("--")]]
sys.path.insert(0, os.path.join(HERE, "..", "gcse_maths"))
import cut_aqa_gcse_maths  # noqa: E402

cut_aqa_gcse_maths.Q_COLUMN_END = 80
cut_maths = cut_aqa_gcse_maths.cut_maths


def line_top(page, y, reach=40):
    """The top of the ink on a label's line, which starts at y: whatever overlaps the line (a matrix's
    brackets, its top row, a fraction's numerator), and whatever overlaps that, up to `reach` above."""
    items = [(l["bbox"][1], l["bbox"][3]) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
             if l["bbox"][0] > 100 and "".join(s["text"] for s in l["spans"]).strip()]
    items += [(d["rect"].y0, d["rect"].y1) for d in page.get_drawings()
              if d["rect"].x0 > 100 and d["rect"].width < 480 and d["rect"].height < 120 and not cut_aqa_gcse_maths.grey_rule(d)]
    top = y
    while True:
        up = min((y0 for y0, y1 in items if y - reach <= y0 < top and y1 > top + 1), default=top)
        if up >= top:
            return top
        top = up


_qp_labels = cut_maths.qp_labels


def qp_labels(doc):
    return [(pg, line_top(doc[pg], y), *rest) for pg, y, *rest in _qp_labels(doc)]


cut_maths.qp_labels = qp_labels

if __name__ == "__main__":
    cut_aqa_gcse_maths.cut_maths.main()
