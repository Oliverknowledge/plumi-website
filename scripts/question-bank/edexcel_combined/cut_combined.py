"""Cut Pearson Edexcel's GCSE Combined Science (1SC0) papers into question parts, with their mark scheme rows.

    python3 scripts/question-bank/edexcel_combined/cut_combined.py [work-dir] [--only=1sc02ch-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-combined

edexcel_gcse/cut_gcse.py (cut_pearson.py with its two GCSE patches), with two changes kept to
this bank so no other bank's crops move:
  - a scheme's own tier is read from 1SC0's file names ("1sc0-2ch-ms-jun24.pdf"), so a row marked
    once for both tiers, "8c(i)(F)" over "2(ai)(H)", keeps this scheme's number;
  - 1SC0's schemes print some labels in ways the reader doesn't take, read here as they're meant:
    "6 *(c)" (every six-mark question's row in five schemes), "Q5c", "Q4a)", "6(c )(i)", "(a (i))"
    under its "2", and a "Question" header split "Questio" over "n", whose "n" read as a part; and a
    label-shaped answer in the answer column ("13" just right of "5(b)(i)", a fraction's "56", a state
    symbol's "(g) (2)", "29(g)") is kept out of the label column, which the reader takes to run 10pt
    past its header; so is a levels grid's "0" (No rewardable material) and the marks in its "Mark"
    column, which ended a six-mark question's row before its levels, and the grid's "1", "2", "3"
    under its "Level" header read as "Level 1" and so on (1SC0 has no question 0); and a
    label wrapped in its cell, "1 (b)" over "(ii)", is joined into one line (read as the wrapped label
    and again as a "(ii)" of its own, the row went to the first, an empty strip of header).
Rows a scheme misnumbers ("2(aiv)" for 1(a)(iv)) are set in labels/<set>.json's "ms_alias", or,
where the wrong number is another row's, its "ms_relabel" ([page, y, "1(b)(i)"]).
Examiner's reports: nine of June 2024's have no usable text layer (their fonts carry no Unicode map),
so they're read by OCR (cut_pearson.ocr_lines, cached in <work-dir>/ocr/); and the headings 1SC0's
reports use besides "Question 3 (b)" on a line of its own, "Q3", "Question 3(b)ii" and "Question 3 (b)
(i) required candidates to…", are read as that heading, the sentence kept under it.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-combined")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse"))
import cut_gcse  # noqa: E402

cp = cut_gcse.cp
_init, _lines = cut_gcse._init, cut_gcse.lines
FIXES = [(re.compile(r"^Q(?=\d)"), ""), (re.compile(r"^(\d{1,2})\s+\*\s*"), r"\1*"), (re.compile(r"\(\s*([a-z]{1,5})\s*\)"), r"(\1)"),
         (re.compile(r"^(\d{1,2})([a-z])\)"), r"\1(\2)"), (re.compile(r"^\(([a-z])\s*\(([ivx]+)\)\)$"), r"(\1)(\2)")]
OUT = 200.5  # right of where cut_pearson.ms_tables looks for labels (x0 < 200)


def init(self, path):
    _init(self, path)
    m = re.search(r"-[12][bcp]([fh])-ms-", os.path.basename(path))
    self.tier = m.group(1).upper() if m else None
    self._fixed = set()
    m = re.match(r"(1sc0)-(\d[bcp][fh])-ms-(\w+)\.pdf", os.path.basename(path))
    hand = cp.hand_labels(f"{m.group(1)}{m.group(2)}-{m.group(3)}") if m else None
    self.relabel = {(pg, round(y)): t for pg, y, t in (hand or {}).get("ms_relabel", [])}


def lines(self, i):
    out = _lines(self, i)
    if not self.tier or i in self._fixed:
        return out
    self._fixed.add(i)
    split = [l for l in out if l["text"].strip() == "Questio"]
    heads = [l for l in out if l["text"].strip() in ("Question", "Questio")]
    grids = [l for l in out if re.match(r"(Level|Leve)( Marks?\b|$)", l["text"].strip())]
    labels = [l for l in out if len(l["text"].strip()) <= 16 and re.match(r"\*?\s*\d{1,2}\s*\*?\s*\(?[a-z]", l["text"].strip())]
    fixed, labels_fixed = [], []
    for l in out:
        t = l["text"].strip()
        head = ([h for h in heads if h["y0"] < l["y0"]] or heads or [None])[-1]  # the "Question" header over this line
        if (i, round(l["y0"])) in self.relabel:
            l = {**l, "text": self.relabel[(i, round(l["y0"]))]}
        elif re.fullmatch(r"[0-6]", t) and (grid := next((g for g in reversed(grids) if l["x0"] > g["x0"] - 5 and 0 < l["y0"] - g["y0"] < 400), None)):
            # the level's number in its "Level" column, a mark in the grid's "Mark" column
            l = {**l, "text": f"Level {t}"} if abs(grid["x0"] - l["x0"]) < 25 else {**l, "x0": max(l["x0"], OUT), "x1": max(l["x1"], OUT + 0.1)}
        elif re.match(r"\*?\d{0,3}\*?\s*(\(?[a-z]{1,5}\)|$)", t) and head and l["x0"] > head["x0"] + 30 \
                or t == "0" or re.fullmatch(r"\d{1,3}", t) and any(abs(o["y0"] - l["y0"]) < 3 and o["x1"] < l["x0"] for o in labels):
            l = {**l, "x0": max(l["x0"], OUT), "x1": max(l["x1"], OUT + 0.1)}
        elif re.fullmatch(r"(\([a-z]{1,4}\))+", t.replace(" ", "")) and any(
                abs(o["x0"] - l["x0"]) < 12 and 0 < l["y0"] - o["y0"] < 16 for o in labels_fixed):
            above = next(o for o in reversed(labels_fixed) if abs(o["x0"] - l["x0"]) < 12 and 0 < l["y0"] - o["y0"] < 16)
            k = next(n for n, o in enumerate(fixed) if o is above)
            fixed[k] = {**above, "text": above["text"].strip() + t.replace(" ", ""), "x1": max(above["x1"], l["x1"])}
            labels_fixed.append(fixed[k])
            continue
        elif t == "Questio":
            l = {**l, "text": "Question"}
        elif t == "n" and any(abs(h["x0"] - l["x0"]) < 3 and 0 < l["y0"] - h["y0"] < 20 for h in split):
            continue
        elif len(t) <= 16:
            for pattern, to in FIXES:
                t = pattern.sub(to, t)
            if t != l["text"].strip():
                l = {**l, "text": t}
        fixed.append(l)
        if any(l is o for o in labels) or re.fullmatch(r"\*?\d{1,2}\*?\s*(\([a-z]{1,4}\)\s*)*\*?", l["text"].strip()):
            labels_fixed.append(l)
    self._lines[i] = fixed
    return fixed


# A report heading: "Q3", "Question 3(b)ii", "Question 3 (b) (i)", alone on its line or opening its sentence.
HEADING = re.compile(r"\n[ \t]*(?:Question[ \t]*|Q)(\d{1,2})[ \t]*(?:\(?([a-h])\)?)?[ \t]*(?:\(?(i{1,3}|iv|vi{0,3}|ix|x)\)?)?(?=[ \t]*\n|[ \t]+\S|[ \t]*[–:-])([^\n]*)")
RUNNING = re.compile(r"(\d+\s+)?(Pearson Edexcel )?GCSE Combined Science 1SC[0O]\s*\w{2,3}(\s+\d+)?", re.I)
_report = cp.examiner_report


def report_text(path):
    doc = cp.pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    if len(re.findall(r"\b(the|and|of|to|candidates)\b", text, re.I)) < len(text) / 200:  # no usable text layer
        read = cp.ocr_lines(doc, path)
        # (not the candidates' answers: those are pictures on the page, their handwriting OCR'd as noise)
        shots = {i: [cp.pymupdf.Rect(im["bbox"]) for im in doc[i].get_image_info()] for i in range(len(doc))}
        # nor the running header and footer, "5 GCSE Combined Science 1SC0 1PF"
        kept = lambda i, l: not RUNNING.fullmatch(l["text"].strip()) and not any(r.contains(cp.pymupdf.Point((l["x0"] + l["x1"]) / 2, (l["y0"] + l["y1"]) / 2)) for r in shots[i])  # noqa: E731
        text = "\n".join("\n".join(l["text"] for l in read[i] if kept(i, l)) for i in range(len(doc)))

    def heading(m):
        q, letter, roman, rest = m.groups()
        head = f"\nQuestion {q}" + (f" ({letter})" if letter else "") + (f"({roman})" if roman else "") + "\n"
        return head + ("\n" + m.group(0).strip() if rest.strip() else "")
    return HEADING.sub(heading, text)


def examiner_report(path, section=None):
    """cut_pearson's reader over report_text(path): it opens the report itself, so it is handed the text in its place."""
    if not path or not os.path.exists(path):
        return {}
    text, real = report_text(path), cp.pymupdf
    cp.pymupdf = type("Text", (), {"open": staticmethod(lambda _: [type("Page", (), {"get_text": lambda self: text})()])})
    try:
        return _report(path, section)
    finally:
        cp.pymupdf = real


cp.Doc.__init__, cp.Doc.lines, cp.examiner_report = init, lines, examiner_report

if __name__ == "__main__":
    cp.main()
