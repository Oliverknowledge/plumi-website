"""Cut the AQA Biology sets taken from PMT (fetch_pmt_aqa_biology.py): cut.py with three fixes of its own.

    python3 scripts/question-bank/cut_aqa_bio_pmt.py [work-dir] --only=74021-jun17   # one set at a time

These 2016-2019 schemes are laid out a little differently from the ones AQA still publishes,
so cut.py missed some of their rows. The fixes are kept to this run, so no other set's crops move:
- Their table header is one span, "Question Marking Guidance", and a long question's
  continuation pages carry no header at all, so cut.py took them for the front pages and
  skipped their "1.1"-style labels. Any page from the first table page on counts as a table page.
- An answer's "1." can sit close enough to the label to be read as part of it ("08.31.").
  A trailing "<digit>." after the label is dropped.
- A bare number inside a table cell ("23", x 103) passed for a question label and cut the
  row above it short. In a scheme, a label without a part must sit in the label column (x < 90).
- June 2016's AS papers (the first series) print "[2 marks]" out to x 542, under the "Do not
  write outside the box" column where the crop stops (x 531), so every crop lost the end of
  its mark. A page's crop now reaches past any mark that runs over its edge. This also
  re-cuts AS Paper 2 June 2016 (AQA's own copy), whose crops were clipped the same way.
The patches sit at the top level, so the worker processes cut.py starts (which re-run
this file) get them too.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, ".work")]
sys.path.insert(0, HERE)
import cut  # noqa: E402

_left_labels = cut.left_labels
_frame = cut.frame
MARK = re.compile(r"^\[\d+ marks?\]$")


def has_header(page):
    return any(s["text"].strip().startswith("Question") and "Bold" in s["font"]
               for block in page.get_text("dict")["blocks"] for line in block.get("lines", []) for s in line["spans"])


def table_page(page):
    return any(has_header(page.parent[i]) for i in range(page.number + 1))


def left_labels(page, max_x, bold_only, with_x=False):
    if bold_only:
        return _left_labels(page, max_x, bold_only, with_x)
    out = [o for o in _left_labels(page, max_x, bold_only, True) if o[2] is not None or o[3] < 90]
    return out if with_x else [o[:3] for o in out]


def frame(page, portrait=True):
    rect = _frame(page, portrait)
    if portrait:
        over = [s["bbox"][2] for block in page.get_text("dict")["blocks"] for line in block.get("lines", []) for s in line["spans"]
                if MARK.match(s["text"].strip()) and s["bbox"][2] > rect.x1]
        if over:
            rect.x1 = min(max(over) + 3, page.rect.width - 30)
    return rect


cut.QLABEL = re.compile(r"^(\d{2})(?:\.(\d{1,2}))?(?:\d\.)?$")
cut.table_page = table_page
cut.left_labels = left_labels
cut.frame = frame

if __name__ == "__main__":
    cut.main()
