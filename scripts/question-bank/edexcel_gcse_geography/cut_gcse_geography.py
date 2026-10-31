"""Cut Pearson Edexcel's GCSE Geography B (1GB0) papers: cut_pearson.py --extracts --figures, with Geography B's scheme labels.

    python3 scripts/question-bank/edexcel_gcse_geography/cut_gcse_geography.py [work-dir] [--only=1gb001]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-geography

The A-Level Geography cut (Papers 1 and 2 print their figures in the paper; Paper 3's
Resource Booklet is bound in after it and its figures go in each question's stem). What
Geography B's mark schemes add, patched in over ms_tables so no other bank's crops move:
  - From June 2023 Sections B and C set their labels in a narrower column, "2a" with "(i)"
    under it at the page's left edge (x 34), where the first page's "Question number" header
    sits at x 87: those labels are read as if under the header.
  - Some rows drop the question's number, "b", "d (i)", "a (ii) Jakarta", or set the letter
    alone, "(d)": read as "(b)", "(d) (i)".
  - A scheme can print a chart (June 2024 Paper 1's 2(d), an axis "8 7 6 … 0" down the
    label column): a bare number only counts as a question's row when it is the question
    being read or the next one.
  - (and June 2024's examiner's reports, whose fonts have no character map, are read by OCR)
  - A levels grid's last row printed under the next question's table (November 2020 Paper 3's
    3(d), its "Level 3" under 3(e)(i)) is moved back to its question.
And two changes to the papers: a column of bracketed figures in a table ("(57)", "(54)") isn't
read as a part's marks, and Paper 3's decision-making question (Section D, "Use
information from the Resource Booklet and knowledge and understanding from the rest of
your geography course") is set on the whole booklet, which it carries as its stem.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography"), *flags, "--extracts", "--figures"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

# a label with its number dropped: "b", "d (i)", "(d)", "a (ii) Jakarta"
BARE = re.compile(r"^\(?([a-k])\)?(?:\s*\(?(i{1,3}|iv|vi{0,3}|ix|x)\)?)?(?=\s|$)(.*)$")
RUN_ON = re.compile(r"^(\d{1,2})? ?([a-k])(?: ?\(?(i{1,3}|iv|vi{0,3}|ix|x)\)?)?\s+([A-Z●•].{3,})$")
ROMAN_ONLY = re.compile(r"\((i{1,3}|iv|vi{0,3}|ix|x)\)")
NUMBERED = re.compile(r"^\*?(\d{1,2})\*?(?:\s*\(?[a-k]\)?)?(?:\s*\(?(?:i{1,3}|iv|vi{0,3}|ix|x)\)?)?\s*\*?$")


LABELISH = re.compile(r"^\*?\d{1,2}\*? ?\(?[a-k]?\)?( ?\((i{1,3}|iv|vi{0,3}|ix|x)\))?(\s|$)")


def label_zone(l):
    """The Question number column: x 34-50 in the narrow layout (its answers start at 56), 78-120 in the wide one (at 133);
    between them only what reads as a label ("3(a)(i)" at x 54, June 2019 Paper 1's Section C)."""
    return l["x0"] < 52 or 78 < l["x0"] < 120 or l["x0"] < 78 and bool(LABELISH.match(l["text"].strip()))


def relabel(doc):
    """Rewrite the scheme's label column so cut_pearson's reader takes it (see the module's docstring)."""
    q_now = 0
    first = next((i for i in range(len(doc)) if any(cp.is_head(l, doc.lines(i)) for l in doc.lines(i))), len(doc))
    for i in range(first, len(doc)):
        out, lines = [], list(doc.lines(i))
        # "3a" (or "a", "(d)") with its "(i)" set a line or two under it (up to 30pt; cut_pearson joins them within 16): one label
        for k, l in enumerate(lines):
            if label_zone(l) and re.fullmatch(r"(\d{1,2} ?)?\(?[a-k]\)?", l["text"].strip()):
                under = next((o for o in lines[k + 1:k + 6] if label_zone(o) and ROMAN_ONLY.fullmatch(o["text"].strip())
                              and 0 < o["y0"] - l["y0"] < 30 and abs(o["x0"] - l["x0"]) < 12), None)
                if under is not None:
                    lines[k] = {**l, "text": l["text"].strip() + " " + under["text"].strip()}
                    lines.remove(under)
        for l in lines:
            t = l["text"].strip()
            run_on = RUN_ON.match(t) if label_zone(l) else None
            if run_on:
                # "3c  Award one mark…", "2a(iv) Award…", "3diii Award…", "f  Award…": the label, bracketed, so
                # cut_pearson reads it off the front
                n, letter, roman, rest = run_on.groups()
                t = (f"{n} " if n else "") + f"({letter})" + (f" ({roman})" if roman else "") + " " + rest
                l = {**l, "text": t}
                q_now = int(n) if n and int(n) in (q_now, q_now + 1) else q_now
            if ROMAN_ONLY.match(t) and re.match(r"\S+(\s|$)", t) and ROMAN_ONLY.fullmatch(t.split()[0]) or run_on:
                pass  # a sub-part under its part's label, or beside its answer: "(ii) Award one mark…"
            elif label_zone(l) and len(t) <= 16 and NUMBERED.match(t):
                n = int(NUMBERED.match(t).group(1))
                # A bare number is a question's row only when it is this question or the next, alone at the row's left
                # and not one of a column of numbers (a chart's axis, "8 7 6 … 0"; a SPaG grid's "SpaG 3 | 4").
                axis = re.fullmatch(r"\d{1,2}", t) and (
                    any(o is not l and abs(o["y0"] - l["y0"]) < 4 and o["x1"] < l["x0"] for o in lines)
                    or any(o is not l and label_zone(o) and re.fullmatch(r"\d{1,2}", o["text"].strip()) and 0 < abs(o["y0"] - l["y0"]) < 25 for o in lines))
                if re.fullmatch(r"\d{1,2}", t) and (n not in (q_now, q_now + 1) or axis):
                    l = {**l, "text": "· " + t}  # a chart's axis, a levels grid's mark
                else:
                    q_now = max(q_now, n) if n in (q_now, q_now + 1) else q_now
            elif label_zone(l) and q_now and BARE.match(t) and (len(t) <= 8 or t.startswith("(") or re.match(r"^[a-k] \(", t)):
                m = BARE.match(t)
                if not m.group(2) and not m.group(3).strip() or m.group(2):
                    l = {**l, "text": f"({m.group(1)})" + (f" ({m.group(2)})" if m.group(2) else "") + m.group(3)}
            if l["x0"] < 78 and label_zone(l):
                l = {**l, "x0": 90, "x1": l["x1"] + 90 - l["x0"]}  # into the header's column
            out.append(l)
        doc._lines[i] = out
    return doc


def stray_levels(doc, out):
    """A levels grid's last row printed under the next question's table (November 2020 Paper 3: 3(d)'s "Level 3 | 7-8"
    sits on the next page, under 3(e)(i)) goes back to the question whose grid it completes."""
    rows = sorted((k for k in out if out[k][0]), key=lambda k: (out[k][0][0][0], out[k][0][0][1].y0))
    for prev, key in zip(rows, rows[1:]):
        pieces, text, ans = out[key]
        p_pieces, p_text, p_ans = out[prev]
        for n, (pg, r) in enumerate(pieces):
            lv = next((l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > r.y0 + 20
                       and re.match(r"Level (\d)\b", l["text"]) and l["x0"] < 100), None)
            k = int(re.match(r"Level (\d)", lv["text"]).group(1)) if lv else 0
            if not lv or k < 2 or f"Level {k - 1}" not in p_text or f"Level {k}" in p_text or "Level 1" in cp.BOILER.sub("", doc.text(pg, r)):
                continue
            moved = (pg, cp.pymupdf.Rect(r.x0, lv["y0"] - 4, r.x1, r.y1))
            out[prev] = (p_pieces + [moved], p_text + " " + doc.text(*moved), p_ans)
            out[key] = (pieces[:n] + [(pg, cp.pymupdf.Rect(r.x0, r.y0, r.x1, lv["y0"] - 4))] + pieces[n + 1:], text, ans)
            break
    return out


_ms_tables = cp.ms_tables
cp.ms_tables = lambda doc: stray_levels(doc, _ms_tables(relabel(doc)))

_resources_for = cp.resources_for


def resources_for(text, units, q):
    if units and re.search(r"Use information from the Resource Booklet", text):
        return [p for u in units for p in u["pieces"]]
    return _resources_for(text, units, q)


cp.resources_for = resources_for

_marks_in = cp.marks_in


class _NoColumnMarks:
    """A paper whose bracketed figures down a table ("(57)", "(54)", "(74)", "(91)", "(7)", 16pt apart, beside June 2018
    Paper 2's Figure 7) aren't read as marks: a part's "(8)" stands alone."""

    def __init__(self, doc):
        self.doc = doc

    def __getattr__(self, name):
        return getattr(self.doc, name)

    def lines(self, i):
        lines = self.doc.lines(i)
        bracketed = [l for l in lines if re.fullmatch(r"\(\d{1,3}\)", l["text"])]
        column = {id(l) for l in bracketed for o in bracketed if o is not l and abs(o["y0"] - l["y0"]) < 20 and abs(o["x1"] - l["x1"]) < 10}
        return [l for l in lines if id(l) not in column]


cp.marks_in = lambda doc, pieces: _marks_in(_NoColumnMarks(doc), pieces)

# ---------- examiner's reports ----------

def report_pages(path):
    """A report's pages as text. June 2024's three set their text in fonts with no character map, so it comes out as
    symbols: those are read by OCR (cut_pearson's ocr_lines), with the candidates' scripts (pictures) whited out
    first, as edexcel_politics/cut_politics.py does."""
    doc = pymupdf.open(path)
    texts = [page.get_text() for page in doc]
    seen = "".join(texts)
    if not seen.strip() or len(re.findall(r"[A-Za-z]", seen)) >= 0.5 * len(re.sub(r"\s", "", seen)):
        return texts
    plain = os.path.join(cp.WORK, "unpictured", os.path.basename(path))
    if not os.path.exists(plain):
        os.makedirs(os.path.dirname(plain), exist_ok=True)
        for page in doc:
            for info in page.get_image_info():
                page.draw_rect(pymupdf.Rect(info["bbox"]), color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
        doc.save(plain)
    doc = pymupdf.open(plain)
    read = cp.ocr_lines(doc, plain)
    texts = []
    for i in range(len(doc)):
        lines, out = read.get(i, []), []
        for a, b in zip([None] + lines, lines):
            if a is not None:
                out.append("\n\n" if b["y0"] - a["y1"] > 0.8 * (b["y1"] - b["y0"]) else "\n")
            out.append(b["text"])
        texts.append("".join(out) + "\n")
    return texts


class _Page:
    def __init__(self, text):
        self.text = text

    def get_text(self):
        return self.text


class _Reports:
    """pymupdf, but open() hands examiner_report the pages report_pages reads."""

    def __getattr__(self, name):
        return getattr(pymupdf, name)

    def open(self, path):
        return [_Page(t) for t in report_pages(path)]


_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    if not path or not os.path.exists(path):
        return {}
    cp.pymupdf = _Reports()
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = pymupdf


cp.examiner_report = examiner_report

if __name__ == "__main__":
    cp.main()
