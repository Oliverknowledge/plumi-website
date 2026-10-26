"""Cut OCR's Computer Science papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/computer_science/cut_ocr_cs.py [work-dir] [--only=h44602-jun25]
    # work-dir: .work/ocr-cs (fetch_ocr_cs.py); needs: pip install pymupdf pillow

OCR's Computer Science papers are typeset like its sciences, so
edexcel_sciences/cut_pearson.py does the work, used here as a library, unchanged.
What differs is code, and it is set here in its place, for this run only:
  - a question's code listing ends in what look like the cutter's other signals: LMC's
    "END  HLT" reads as the "END" that closes a paper, and "array myArray[9]" as a
    mark "[9]". The paper ends at "END OF QUESTION PAPER" only, and a mark counts only
    at the right margin, where OCR prints them;
  - a part's code or scenario (1(c): a quick sort, then five questions on it) is printed
    once, above its first sub-part: every sub-part carries it, not only (i);
  - a part's label can sit a line above its first sub-part's, "(a)" over "(i) Describe…":
    the sub-part starts at the part's label, so the "(a)" isn't sliced through;
  - continuation pages start below the page number OCR centres at the top;
  - some schemes set a label across three columns in plain type, "1 | b | i", where the
    cutter joins the pieces only when the letter is bold or bracketed: they are joined
    here as "1 (b) (i)" before it reads them.
  - H446/01 November 2021 question 7(c)(ii) had an error (OCR's report says so, and a
    corrected paper went to centres only): it is left out.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <component>-<series>-<question>[-<part>]: "h44602-jun25-01-ci".
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-cs"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402  (reads the work dir and --only from the command line)

WORK, ONLY = cp.WORK, cp.ONLY
cp.STOP = re.compile(cp.STOP.pattern.replace(r"|END\s*$", ""), cp.STOP.flags)
LEFT_OUT = {"h44601-nov21": {"7(c)(ii)"}}
MARK = re.compile(r"\[(\d{1,2})\]$")
SUBS = set(cp.LETTERS) | set(cp.ROMANS)
LABEL = re.compile(r"^(\d{1,2})(?:\(([a-z])\))?(?:\(([ivx]{1,4})\))?$")

_frame = cp.frame


def frame(page):
    f = _frame(page)
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    number = [s for s in spans if re.fullmatch(r"\d{1,2}", s["text"].strip()) and s["bbox"][1] < 50
              and abs((s["bbox"][0] + s["bbox"][2]) / 2 - page.rect.width / 2) < 30]
    if f.y0 < 58 and number:
        # (a page can start higher than usual, beside the number: then start there)
        first = min((s["bbox"][1] for s in spans if s not in number and s["bbox"][1] > number[0]["bbox"][1] - 2), default=59)
        f = pymupdf.Rect(f.x0, min(59, first - 1), f.x1, f.y1)
    return f


def marks_in(doc, pieces):
    total, found = 0, False
    for pg, rect in pieces:
        for l in doc.lines(pg):
            m = MARK.search(l["text"])
            if m and l["x1"] > rect.x1 - 45 and rect.x0 <= l["x0"] and rect.y0 <= l["y0"] <= rect.y1:
                total += int(m.group(1))
                found = True
    return total if found else None


_qp_labels = cp.qp_labels


def qp_labels(doc):
    labels, end_page = _qp_labels(doc)
    out = []
    for lab in labels:
        pg, y, q, letter, roman = lab
        prev = out[-1] if out else None
        # "(a)" a line above "(i)", nothing between: the sub-part starts at the part's label.
        if prev and prev[0] == pg and 0 < y - prev[1] < 16 and prev[2] == q and prev[3] is not None \
                and (roman and prev[3] == letter and prev[4] is None or prev[3] is None and letter):
            y = prev[1]
        out.append((pg, y, q, letter, roman))
    return out, end_page


_lines = cp.Doc.lines


def lines(self, i):
    """A scheme's label set in plain type across its columns, "1" | "b i", joined as "1 (b) (i)"."""
    fresh = i not in self._lines
    got = _lines(self, i)
    if not fresh or "-ms-" not in os.path.basename(self.doc.name):
        return got
    out, used = [], set()
    for k, l in enumerate(got):
        if k in used:
            continue
        bits_of = lambda o: re.sub(r"[()]", " ", o["text"]).split()  # noqa: E731
        fits = lambda o: 0 < len(bits_of(o)) <= 2 and all(b in SUBS for b in bits_of(o))  # noqa: E731
        if l["x0"] < 120 and (re.fullmatch(r"\d{1,2}", l["text"].strip()) or re.fullmatch(r"\([a-n]\)", l["text"].strip())):
            # Its letter and numeral, each in a column of its own: "2" | "(b)" | "(i)", or "1" | "b i";
            # each piece can sit a few points above or below the others ("8" and "i" at 216, "(b)" at 228).
            # The nearest piece in each column, read left to right.
            near = {}
            for j, o in enumerate(got):
                if j not in used and j != k and abs(o["y0"] - l["y0"]) < 14 and l["x1"] - 2 < o["x0"] < 165 and fits(o):
                    col = round(o["x0"] / 10)
                    if col not in near or abs(o["y0"] - l["y0"]) < abs(got[near[col]]["y0"] - l["y0"]):
                        near[col] = j
            subs, x1, y0 = [], l["x1"], l["y0"]
            for j in sorted(near.values(), key=lambda j: got[j]["x0"]):
                o = got[j]
                if o["x0"] - x1 >= 60:
                    break
                used.add(j)
                subs, x1, y0 = subs + bits_of(o), o["x1"], min(y0, o["y0"])
            if subs:
                head = l["text"].strip() if l["text"].strip()[0].isdigit() else f"({l['text'].strip()[1:-1]})"
                l = {**l, "text": head + " " + " ".join(f"({x})" for x in subs), "x1": x1, "y0": y0}
        elif l["x0"] < 120 and (m := re.match(r"^(\d{1,2})\s+([a-n])(?:\s+([ivx]{1,4}))?(?=\s|$)(.*)$", l["text"].strip())):
            # Label and answer on one line, unbracketed: "6 a ii 1 mark per bullet".
            l = {**l, "text": f"{m.group(1)} ({m.group(2)})" + (f" ({m.group(3)})" if m.group(3) else "") + m.group(4)}
        elif l["x0"] < 100 and l["text"].strip().lower() in SUBS:
            # A row's letter alone in plain type, or a numeral set "Iv": "(f)", "(iv)".
            l = {**l, "text": f"({l['text'].strip().lower()})"}
        elif l["x0"] < 150 and re.fullmatch(r"I[ivx]{0,3}|[ivx]{1,4}", l["text"].strip()) and cp.bold(l["spans"][0]):
            l = {**l, "text": l["text"].strip().lower()}
        out.append(l)
    # A label centred down a tall row (an answer with code in it) sits far below the row's top
    # rule, out of the cutter's reach: read it as starting at the top of its row. Only the schemes
    # that write their labels run together, "1biii", "5c", centre them.
    if not hasattr(self, "_cs_centred"):
        self._cs_centred = sum(1 for p in self.doc for w in p.get_text("words") if w[0] < 150 and re.fullmatch(r"\d{1,2}[a-h][ivx]{0,4}", w[4])) >= 3
    page = self.doc[i]
    rules = [r for r in (d["rect"] * page.rotation_matrix for d in cp.drawings(page)) if r.height < 3 and r.width > 15]
    for n, l in enumerate(out):
        compact = re.fullmatch(r"\d{1,2}[a-h][ivx]{0,4}", l["text"].strip())  # "2b": set this way, it's centred wherever it is
        if (self._cs_centred or compact) and l["x0"] < 150 and len(l["text"].strip()) <= 16 and cp.MS_LABEL.match(l["text"].strip()) and re.match(r"\s*\d", l["text"]):
            across = [r.y0 for r in rules if r.x0 <= l["x0"] + 2 and r.x1 >= l["x1"] - 2]
            above = max((y for y in across if y < l["y0"] - 1), default=None)
            below = min((y for y in across if y > l["y1"] + 1), default=None)
            # (centred: as far from its row's top rule as from its foot)
            if above is not None and below is not None and l["y0"] - above > 24 \
                    and abs((l["y0"] - above) - (below - l["y1"])) < 0.3 * (below - above) \
                    and not any(above < o["y0"] < l["y0"] - 1 for o in out if o["x0"] < l["x1"] + 8 and o is not l and o["text"].strip()):
                # 8pt in: where the rule runs through the box of the line above (code's taller boxes), the
                # cutter, which won't start a row on such a rule, starts it just under the rule instead.
                out[n] = {**l, "y0": above + 8, "y1": above + 8 + (l["y1"] - l["y0"])}
    # A table carried over to a page with no header row of its own: the cutter looks for its
    # labels under the column of the header that last came before. (It sits off the page, so it
    # places the column and nothing else: no row starts at it, and no crop takes it in.)
    heads = [l for l in out if cp.is_head(l, out)]
    if heads:
        self._cs_head = heads[-1]
    elif getattr(self, "_cs_head", None):
        out.insert(0, {**self._cs_head, "y0": -100, "y1": -99})
    self._lines[i] = out
    return out


cp.frame, cp.marks_in, cp.qp_labels, cp.Doc.lines = frame, marks_in, qp_labels, lines
_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = [p for p in _cut_set(qp_path, ms_path, er_path, set_id, meta) if p["label"] not in LEFT_OUT.get(set_id, ())]
    qp = cp.Doc(qp_path)
    labels, end_page = qp_labels(qp)
    by_key = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        by_key[(q, letter, roman)] = cp.region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)
    for p in parts:
        m = LABEL.match(p["label"])
        q, letter, roman = int(m.group(1)), m.group(2), m.group(3)
        if not roman or roman == "i" or (q, letter, roman) not in by_key:
            continue
        lead = [x for x in by_key.get((q, letter, None), []) if cp.has_content(qp, *x)]
        if not lead:
            continue
        pieces = by_key[(q, letter, roman)]
        keep = lead + pieces[:1] + [x for x in pieces[1:] if cp.has_content(qp, *x)]
        img = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in keep])
        cp.save(img, p["qp"])
        p["w"], p["h"] = img.width, img.height
        p["text"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", " ".join(qp.text(pg, r) for pg, r in lead) + " " + p["text"])).strip()[:1500]
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
