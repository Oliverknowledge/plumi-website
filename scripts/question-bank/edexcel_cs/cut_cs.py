"""Cut Pearson Edexcel's GCSE Computer Science (1CP2) papers into question parts, each with its mark scheme.

    python3 scripts/question-bank/edexcel_cs/cut_cs.py [work-dir] [--only=1cp21-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-cs

edexcel_sciences/cut_pearson.py does the work: Paper 1 is set and marked as Pearson's science
papers are. What differs is handled here, so no other bank's crops move:
  - Paper 2 is sat on screen: six questions, each "Open file Q03.py" and amend or write it. Each is
    one part, cut whole. The next question's "Suggested time: 25 minutes", printed above its number,
    ends the one before rather than trailing on it;
  - Paper 2's scheme gives each question its own pages: a table of marking points, levels grids
    and then the model program, printed as pictures with no text. Its rows aren't labelled the way
    cut_pearson.py reads, so a question's scheme is cut here as its pages, from its "Question number"
    header to the next question's;
  - Paper 1's multiple-choice rows from 2022 and the specimen give the answer first, "B 17 080 000",
    not "The only correct answer is B": that letter becomes the part's key;
  - the examiner's reports head their parts "Question 1bii" or "Question 1(a)ii", and Paper 2's its
    questions "Q01 – Fix the errors": they are read as cut_pearson.py's "Question 1 (b)(ii)".
Marks the cutter misreads are set in scripts/question-bank/labels/1cp21-*.json.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-cs")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402

cp.STOP = re.compile(cp.STOP.pattern[:-1] + r"|Suggested time:)", re.I)
HEADER = re.compile(r"Questi ?o(?: ?n)?$")  # the scheme's "Question number" header cell, "Questio n" or "Questio" over "n" in 2024 and 2025
_cut_set, _examiner_report = cp.cut_set, cp.examiner_report
# "Question 1bii", "Question 1(a)ii", "Question 2e"; Paper 2's "Q01 – Fix the errors", "Q03"
PART_HEAD = re.compile(r"^[ \t]*Question[ \t]+(\d{1,2})[ \t]*\(?([a-h])?\)?[ \t]*\(?(iv|v|vi{0,3}|i{1,3})?\)?[ \t]*$", re.M)
Q_HEAD = re.compile(r"^[ \t]*Q0?([1-6])(?:[ \t]+[–-][^\n]*)?[ \t]*$", re.M)


class _Page:
    def __init__(self, text):
        self.text = text

    def get_text(self):
        return self.text


class _Reader:
    """pymupdf, as examiner_report() uses it, handing back the report's text with its headings rewritten."""
    @staticmethod
    def open(path):
        text = "\n".join(p.get_text() for p in pymupdf.open(path))
        text = PART_HEAD.sub(lambda m: f"Question {m.group(1)} " + "".join(f"({g})" for g in m.groups()[1:] if g), text)
        text = re.sub(r"^[ \t]*Q0?[1-6][ \t]+(Example \d)", r"\1", Q_HEAD.sub(r"Question \1", text), flags=re.M)
        return [_Page(text)]


def examiner_report(path, section=None):
    cp.pymupdf = _Reader
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = pymupdf


def paper2_schemes(ms_path):
    """{question: [(page, rect)]}: each question's scheme pages, from its header to the next question's."""
    doc = cp.Doc(ms_path)
    starts = []  # (page, y of the header, question)
    for i in range(len(doc)):
        lines = doc.lines(i)
        for n, l in enumerate(lines):
            if HEADER.match(l["text"]):
                # the question's number is the first cell under the header row: "1", then "Award marks as shown."
                q = next((int(o["text"]) for o in lines[n + 1:n + 14] if re.fullmatch(r"[1-6]", o["text"]) and o["x0"] < l["x1"] + 10), None)
                if q and q == len(starts) + 1:
                    starts.append((i, l["y0"] - 4, q))
                break
    out = {}
    for n, (pg, y, q) in enumerate(starts):
        last = starts[n + 1][0] - 1 if n + 1 < len(starts) else len(doc) - 1
        pieces = []
        for i in range(pg, last + 1):
            page = doc[i]
            w, h = page.rect.width, page.rect.height
            # below the running header ("4 2406 1CP2 02 Mark Scheme") and above the page number
            head = [l["y1"] for l in doc.lines(i) if l["y1"] < 60]
            top = y if i == pg else (max(head) + 4 if head else 20)
            foot = [l["y0"] for l in doc.lines(i) if l["y0"] > h - 75 and re.fullmatch(r"\d{1,3}", l["text"])]
            pieces.append((i, pymupdf.Rect(15, top, w - 15, min(foot) - 4 if foot else h - 25)))
        out[q] = (pieces, " ".join(doc.text(i, r) for i, r in pieces))
    return doc, out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    if set_id.startswith("1cp22"):
        doc, schemes = paper2_schemes(ms_path)
        for p in parts:
            pieces, text = schemes[int(p["question"])]
            img = cp.stack([cp.trim(doc.crop(i, r), 10, sides=True) for i, r in pieces])
            p["ms"] = cp.save(img, f"{p['id']}-ms.webp")
            p["msText"] = re.sub(r"\s+", " ", text)[:800]
    for p in parts:
        # "1(a)(iii) B 17 080 000 …", "1(b)ii A Data being sent …", "1(a) A bit (1) B is not correct …"
        m = re.match(r".*?\b\d\(\w\)\s?\(?[iv]*\)?\s+([A-D])\s", p["msText"])
        if not p.get("key") and p["marks"] == 1 and m and re.search(r"\bA .+\bB .+\bC .+\bD ", p["text"][-300:]):
            p["key"] = m.group(1)
    return parts


cp.cut_set, cp.examiner_report = cut_set, examiner_report

if __name__ == "__main__":
    cp.main()
