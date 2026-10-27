"""Cut AQA's GCSE Combined Science: Trilogy papers: cut.py with two fixes of its own.

    python3 scripts/question-bank/aqa_trilogy/cut_trilogy.py [work-dir] [--only=8464c2h]   # default scripts/question-bank/.work-gcse-trilogy

cut.py as the other AQA banks run it, with two changes kept to this bank so no other
bank's crops move:
- A question that runs over the page onto one with an "Extra space" box (and no new
  label) went unread: cut.py took that page for a blank one and stopped. A page whose
  text before "Extra space" carries a mark ("[6 marks]") is the question's own.
- A label whose point isn't bold ("0 3 . 1" with a plain "."; Chemistry 2H, November
  2021) went unread, as cut.py reads bold labels only on a question paper. A label with
  a part is distinctive enough to take whatever its point's font.
The patches sit at the top level, so the worker processes cut.py starts (which re-run
this file) get them too.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work-gcse-trilogy")]
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

MARK = re.compile(r"\[\s*\d+\s+marks?\s*\]", re.I)
_left_labels = cut.left_labels


def skip_page(page, max_x, bold_only):
    text = page.get_text()
    if cut.NOT_QUESTIONS.search(text):
        return True
    if cut.EXTRA_SPACE.search(text) and not cut.left_labels(page, max_x, bold_only):
        return not MARK.search(cut.EXTRA_SPACE.split(text)[0])
    return False


def left_labels(page, max_x, bold_only, with_x=False):
    out = _left_labels(page, max_x, bold_only, with_x)
    if not bold_only:
        return out
    have = {(o[1], o[2]) for o in out}
    extra = [o for o in _left_labels(page, max_x, False, with_x) if o[2] and (o[1], o[2]) not in have]
    return sorted(out + extra, key=lambda o: o[0])


cut.skip_page = skip_page
cut.left_labels = left_labels

if __name__ == "__main__":
    cut.main()
