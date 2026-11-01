"""Cut Pearson Edexcel's GCSE History (1HI0) papers: cut_pearson.py --figures, with History's booklets and levels grids.

    python3 scripts/question-bank/edexcel_gcse_history/cut_gcse_history.py [work-dir] [--only=1hi030]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-history

cut_pearson reads the labels, crops each part and finds its scheme rows. What History adds, patched in
here so no other bank's crops move:
  - Sources. Papers 1 and 3 print their sources and interpretations in a Sources (or Sources/
    Interpretations) Booklet bound in after the paper, each headed "Source B:" or "Interpretation 1:";
    Paper 3's Source A is printed in the paper, under "Study Source A below and then answer Question 1".
    Each is cut out on its own, and a question carries the ones its parts name ("Study Sources B and C",
    "both interpretations") as its stem, so a one-part question's id ends "-q" (1hi030-jun23-01-q).
  - Answer space. Every question is answered in the paper, on pages of dotted lines: a part is cut from its
    first line to its last, with the dotted lines whited out and the gaps they leave closed up, and the
    paper's furniture left out ("Indicate which question you are answering", "Answer EITHER Question 5 OR
    Question 6", "EITHER", "OR", the notice that SPaG is assessed, the section and paper totals).
  - Labels. A choice of sub-parts is printed "(c) (ii)" after "(c) (i)": read as "(ii)".
  - Mark schemes. Every scheme row past the short answers is a levels grid, "Level | Mark | Descriptor",
    whose levels "1" to "4" sit in the Question column: a bare number with a mark ("1–3") beside it is a level,
    not a question. (And the pages' drawings are read once: Paper 3's schemes draw thousands of rules, which
    cut_pearson's ms_page_box read again for every row.)
June 2018's Paper 2 set the period study (Section A) and the British depth study (Section B, EITHER Question 4,
the first British option, OR Question 5, the second) in one paper, a code for each pair (20 to 29). Each of
its studies is filed here under the option paper sat since 2019, P1 to P5 and B1 to B4: 20 gives P1 and B1/B2,
21 the Tudor B3/B4, 22 P2, 24 P3, 26 P4, 28 P5; the other codes repeat a period study already cut.
A part's marks are its own: "Explain two of the following" (Paper 2's Question 3) is one question of 16 marks,
two of three choices at 8, and the SPaG marks are in the scheme, not the part's mark. A part that is one of a
choice ("EITHER Question 5 OR Question 6", "EITHER 1(c)(i) OR 1(c)(ii)") is marked "or" after the first.
"""
import glob, json, os, re, shutil, sys

import pymupdf
from PIL import ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-history"), *flags, "--figures"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

DOTS = re.compile(r"^[.…\s]{6,}$")
# The paper's furniture: no part's words
FURNITURE = re.compile(r"^(Answer EITHER\b.*|EITHER|OR|Spelling, punctuation,? grammar and (the )?use of specialist terminology will be assessed.*|"
                       r"in (this question|part \([a-d]\)|Question \d.*)\.?|TOTAL FOR (SECTION|BOOKLET|PAPER)\b.*|"
                       r"Answer (ALL|all|both) questions.*|Answer Questions? \d.*|Chosen question number.*|Question \d\(?\w?\)?(\(\w+\))?|Indicate .*|"
                       # June 2018's paired Paper 2: the next British option's heading and its box to cross
                       r"Option [PB]\d:.*|If you answer Question \d.*|PLEASE ENSURE YOU ALSO COMPLETE.*)$")
# Where the rest of a page is furniture: the boxes to mark which choice is being answered
CHOICE = re.compile(r"^Indicate (which|your)")
SOURCE_HEAD = re.compile(r"^(Source [A-H]|Interpretation \d)\s*:")
# "Study Source A below and then answer Question 1.": a source printed in the paper itself
IN_PAPER = re.compile(r"^Study Sources? ([A-H])(?:\s+and\s+([A-H]))? below")

# ---------- reading ----------

_get_text = pymupdf.Page.get_text


def get_text(page, option="text", **kw):
    """cut_pearson reads a page's lines from get_text("dict"), which by default carries every picture on the page too:
    History's pages hold big ones (the sources' photographs, the hatched margins), 2 seconds a page. Without them."""
    if option == "dict" and "flags" not in kw:
        kw["flags"] = pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES
    return _get_text(page, option, **kw)


pymupdf.Page.get_text = get_text

_drawings, _drawn = cp.drawings, {}


def drawings(page):
    key = (id(page.parent), page.number)
    if key not in _drawn:
        _drawn[key] = _drawings(page)
    return _drawn[key]


cp.drawings = drawings
_lines = cp.Doc.lines


def lines(self, i):
    out = _lines(self, i)
    if not getattr(self, "_relabelled", None):
        self._relabelled = set()
    if i not in self._relabelled:
        self._relabelled.add(i)
        # "(c) (ii) 'The main consequence…'": the second of a choice of sub-parts, its part's letter printed again
        for k, l in enumerate(out):
            m = re.match(r"^\(([a-h])\)\s*(\((?:ii|iii|iv)\).*)$", l["text"])
            if m:
                out[k] = {**l, "text": m.group(2)}
    return out


cp.Doc.lines = lines


def content(doc, pg, rect):
    """The lines in a stretch of a page that are a question's own words, in order: no dotted answer lines, no
    furniture, and nothing from the choice boxes or a source printed for the next question down."""
    out = []
    for l in doc.lines(pg):
        if not cp.inside(l, rect):
            continue
        t = cp.BOILER.sub(" ", l["text"]).strip()
        if CHOICE.match(t) or IN_PAPER.match(t):
            break
        # (and a stray mark with no letter or figure, the "." after June 2018's box to cross)
        if not re.search(r"[A-Za-z0-9]", t) or DOTS.match(l["text"]) or FURNITURE.match(t) or re.fullmatch(r"\d{1,3}|\*?P\d{5}[A-Z]{1,2}\d*\*?", t):
            continue
        out.append(l)
    return out


_region = cp.region


def region(doc, start, end, end_page):
    """A part's stretch of each page, from its first line to its last: the dotted lines, and pages of nothing else,
    left out. A stretch whose only words are its "(Total for Question 4 = 12 marks)" goes too, unless it is the first."""
    pieces = []
    for n, (pg, r) in enumerate(_region(doc, start, end, end_page)):
        mine = content(doc, pg, r)
        if not mine or n and all(re.match(r"\(Total for ", l["text"]) for l in mine):
            continue
        top = r.y0 if n == 0 else max(r.y0, mine[0]["y0"] - 4)
        pieces.append((pg, pymupdf.Rect(r.x0, top, r.x1, min(r.y1, mine[-1]["y1"] + 6))))
    return pieces


cp.region = region
_crop = cp.Doc.crop


def crop(self, i, rect):
    """The page with its dotted answer lines whited out."""
    if i not in self._img:
        _crop(self, i, rect)
        draw = ImageDraw.Draw(self._img[i])
        for l in self.lines(i):
            if DOTS.match(l["text"]):
                draw.rectangle([l["x0"] * cp.SCALE - 2, l["y0"] * cp.SCALE - 2, l["x1"] * cp.SCALE + 2, l["y1"] * cp.SCALE + 2], fill="white")
    return _crop(self, i, rect)


cp.Doc.crop = crop
# Each paper and scheme read once a set: cut_pearson opens the scheme twice, and the checks below the paper again.
_Doc, _open = cp.Doc, {}
cp.Doc = lambda path: _open[path] if path in _open else _open.setdefault(path, _Doc(path))
_qp_labels, _labelled = cp.qp_labels, {}
cp.qp_labels = lambda doc: _labelled[id(doc)] if id(doc) in _labelled else _labelled.setdefault(id(doc), _qp_labels(doc))
_trim = cp.trim


def trim(img, keep=30, sides=False):
    """A part's crop (cut_set trims those keeping 30) has the gaps left by its answer lines closed up."""
    if keep == 30 and not sides and img is not None:
        img = close_up(img)
    return _trim(img, keep, sides)


def close_up(img, run=70, keep=40):
    """cut_pearson's squash, closing up only rows with no ink but a box's side rules (4 pixels): its 12 also took the
    thin rows of a part's marks, "(16)", alone at the right, and cut them in half, and its "ink" (darker than 160)
    missed the marks' grey altogether."""
    g = img.convert("L").point(lambda v: 255 if v < 225 else 0)
    dark = [sum(1 for v in g.crop((0, y, g.width, y + 1)).getdata() if v) for y in range(g.height)]
    rows, start = [], None
    for y, d in enumerate(dark + [g.width]):
        if d <= 4:
            start = y if start is None else start
            continue
        if start is not None and y - start > run:
            rows.append((start + keep // 2, y - keep // 2))
        start = None
    if not rows:
        return img
    parts, y0 = [], 0
    for a, b in rows:
        parts.append(img.crop((0, y0, img.width, a)))
        y0 = b
    parts.append(img.crop((0, y0, img.width, img.height)))
    return cp.stack(parts) if len(parts) > 1 else img


cp.trim = trim

# ---------- sources ----------


def booklet_units(doc, end_page):
    """[{pieces, figs: {"Source B"}, section, block}] for each source and interpretation: those in the booklet bound in
    after the paper, from its heading to the next (or its page's end, the booklet's acknowledgements, a blank page),
    and one printed in the paper under "Study Source A below"."""
    units = []
    cover = next((i for i in range(end_page + 1, len(doc)) if re.search(r"Sources?(/Interpretations)? Booklet|Interpretations Booklet", doc.text(i))), None)
    heads = []
    for i in range(cover + 1 if cover is not None else len(doc), len(doc)):
        for l in doc.lines(i):
            if SOURCE_HEAD.match(l["text"]) and l["x0"] < doc.frame(i).x0 + 40:
                heads.append((i, l["y0"], SOURCE_HEAD.match(l["text"]).group(1)))
    for n, (pg, y, name) in enumerate(heads):
        stop = heads[n + 1] if n + 1 < len(heads) else (len(doc), 0, None)
        pieces = []
        for i in range(pg, min(stop[0] + 1, len(doc))):
            f = cp.pymupdf.Rect(doc.frame(i))
            top = y - 4 if i == pg else f.y0
            bottom = stop[1] - 4 if i == stop[0] else f.y1
            end = next((l["y0"] for l in doc.lines(i) if top < l["y0"] < bottom and re.match(r"Acknowledg|BLANK PAGE|Every effort has been made", l["text"])), None)
            if end is not None:
                bottom = end - 4
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if bottom > top + 10 and cp.has_content(doc, i, r):
                pieces.append((i, r))
            if end is not None:
                break
        units.append({"pieces": pieces, "figs": {name}, "section": None, "block": set()})
    for i in range(1, end_page + 1):
        for l in doc.lines(i):
            m = IN_PAPER.match(l["text"])
            if m:
                f = doc.frame(i)
                label = next((y for pg, y, q, letter, _ in cp.qp_labels(doc)[0] if pg == i and y > l["y0"] and letter is None), None)
                bottom = cp.label_top(doc, i, label) if label else f.y1
                units.append({"pieces": [(i, pymupdf.Rect(f.x0, l["y0"] - 4, f.x1, bottom))], "figs": {f"Source {m.group(1)}"},
                              "section": None, "block": set()})
    return units


def named(text):
    """The sources and interpretations a question names: "Sources B and C", "Interpretations 1 and 2", "Source A"."""
    out = set()
    for m in re.finditer(r"\bSources?\s+([A-H](?:(?:\s*,\s*|\s+and\s+)[A-H])*)\b", text):
        out |= {f"Source {x}" for x in re.findall(r"[A-H]", m.group(1))}
    for m in re.finditer(r"\bInterpretations?\s+(\d(?:(?:\s*,\s*|\s+and\s+)\d)*)\b", text):
        out |= {f"Interpretation {x}" for x in re.findall(r"\d", m.group(1))}
    if re.search(r"\b(both|the two) interpretations\b", text, re.I):
        out |= {"Interpretation 1", "Interpretation 2"}
    return out


def resources_for(text, units, q):
    wanted = named(text)
    return [p for u in units if u["figs"] & wanted for p in u["pieces"]]


cp.resource_booklet = booklet_units
cp.resources_for = resources_for

# ---------- mark schemes ----------


def mask_levels(doc):
    """A levels grid's "1", "2", "3", "4" in the Question column, each with its marks ("1–3", "10–12") beside it,
    read as "· 1" so cut_pearson takes no level for a question."""
    for i in range(len(doc)):
        out = []
        page = doc.lines(i)
        for l in page:
            if re.fullmatch(r"\d", l["text"].strip()) and l["x0"] < 100 and any(
                    o is not l and abs(o["y0"] - l["y0"]) < 4 and o["x0"] > l["x1"] and o["x0"] < 160
                    and re.fullmatch(r"\d{1,2}(\s*[–-]\s*\d{1,2})?", o["text"].strip()) for o in page):
                l = {**l, "text": "· " + l["text"].strip()}
            # A word wrapped in a narrow column, "Performanc" over "e" (the SPaG grid's header), is no part's label
            elif re.fullmatch(r"[a-z]{1,2}", l["text"].strip()) and any(
                    re.search(r"[A-Za-z]$", o["text"]) and 0 < l["y0"] - o["y0"] < 14 and abs(o["x0"] - l["x0"]) < 3 for o in out):
                l = {**l, "text": "· " + l["text"].strip()}
            out.append(l)
        doc._lines[i] = out
    return doc


_ms_tables = cp.ms_tables
cp.ms_tables = lambda doc: _ms_tables(mask_levels(doc))

# ---------- examiner's reports ----------

PLACEHOLDER = re.compile(r"will not publish an Examiner", re.I)


def report_pages(path):
    """A report's pages as text, as edexcel_gcse_geography/cut_gcse_geography.py reads them: June 2024's set their text in
    fonts with no character map, so it comes out as symbols, and those are read by OCR (cut_pearson's ocr_lines) with
    the candidates' scripts (pictures) whited out first. Then two ways History's reports head a question that
    cut_pearson's reader doesn't take: "Question 3:", and "Q1 Introduction", "Q3-2 Commentary", "Q1 Examiner Tip"
    (June 2022), each read as "Question 1" over its paragraph."""
    doc = pymupdf.open(path)
    texts = [page.get_text() for page in doc]
    seen = "".join(texts)
    if seen.strip() and len(re.findall(r"[A-Za-z]", seen)) < 0.5 * len(re.sub(r"\s", "", seen)):
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
    texts = [re.sub(r"\n(\s*Question\s+\d{1,2}\s*(?:\(\s*[a-z]{1,4}\s*\)\s*)*):[ \t]*\n", r"\n\1\n", t) for t in texts]
    return [re.sub(r"\n[ \t]*Q(\d{1,2})(?:[-.]\d)?[ \t]+(Introduction|Commentary|Examiner Tip)\b", r"\nQuestion \1\n\n\2", t) for t in texts]


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
    """{} for a report Pearson didn't write ("…it has not been possible to provide detailed feedback… Pearson will not
    publish an Examiner's Report for this paper"), else cut_pearson's, on report_pages' text."""
    if not path or not os.path.exists(path) or PLACEHOLDER.search("".join(p.get_text() for p in pymupdf.open(path))):
        return {}
    cp.pymupdf = _Reports()
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = pymupdf


cp.examiner_report = examiner_report

# ---------- after the cut ----------

# June 2018's Paper 2, by its code: the option of its Section A (questions 1 to 3) and of its Questions 4 and 5
JUNE18_PAPER2 = {"20": ("p1", "b1", "b2"), "21": (None, "b3", "b4"), "22": ("p2", None, None), "24": ("p3", None, None),
                 "26": ("p4", None, None), "28": ("p5", None, None)}


def refile(parts, img):
    """June 2018's Paper 2 parts under the option papers sat since (see the module's docstring), their crops renamed."""
    out = []
    for p in parts:
        m = re.fullmatch(r"1hi0(2\d)", p["component"])
        if not (m and p["series"] == "JUN18"):
            out.append(p)
            continue
        options = JUNE18_PAPER2.get(m.group(1))
        q = int(p["question"])
        option = options and options[0 if q <= 3 else q - 3]
        if not option:
            continue
        comp, old = f"1hi0{option}", p["set"]
        new = f"{comp}-jun18"
        rename = lambda name: name and name.replace(old, new, 1)  # noqa: E731
        for name in (p["qp"], p["ms"], p["stem"]):
            if name and os.path.exists(os.path.join(img, name)):
                shutil.copyfile(os.path.join(img, name), os.path.join(img, rename(name)))
        out.append({**p, "id": rename(p["id"]), "set": new, "component": comp, "qp": rename(p["qp"]), "ms": rename(p["ms"]),
                    "stem": rename(p["stem"]), "paired": m.group(1)})
    return out


def fix(parts):
    """"Explain two of the following" is one question: its marks are its total, not the sum of its three choices."""
    for p in parts:
        total = re.search(r"\(Total for Question \d+ = (\d+) marks?\)", p["text"])
        if re.search(r"Explain two of the following", p["text"]) and total:
            p["marks"] = int(total.group(1))
    return parts


_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """cut_pearson's parts, each that is the second of a choice marked "or": an "OR" just above its label."""
    _open.clear()
    _labelled.clear()
    _drawn.clear()  # keyed by the document's id, which a later set's document can reuse
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = cp.Doc(qp_path)
    labels, _ = cp.qp_labels(qp)
    after_or = set()
    for pg, y, q, letter, roman in labels:
        above = [l["text"].strip() for l in qp.lines(pg) if y - 40 < l["y0"] < y - 2]
        if above and above[-1] == "OR":
            after_or.add(f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else ""))
    # A question's marks where only its "(Total for Question 1 = 8 marks)" says them, over the page from its words
    # (June 2018's Option 24 prints "(Total for Question 2 = 8 marks", its bracket dropped)
    totals = {int(m.group(1)): int(m.group(2)) for i in range(len(qp)) for l in qp.lines(i)
              for m in [re.match(r"\(Total for Question (\d+) = (\d+) marks?", l["text"])] if m}
    # A part's own words ("ask"): cut_pearson's `text` puts the sources first and stops at 1,500 characters, which a
    # question on two sources and two interpretations passes before its own words begin.
    _, end_page = cp.qp_labels(qp)
    asks = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        words = " ".join(l["text"] for p_, r in cp.region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)
                         for l in content(qp, p_, r))
        asks[(q, letter, roman)] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", words)).strip()
    for p in parts:
        if p["label"] in after_or:
            p["or"] = 1
        if p["marks"] is None and not p["part"]:
            p["marks"] = totals.get(int(p["question"]))
        q, letter, roman = int(p["question"]), (p["part"] or "")[:1] or None, (p["part"] or "")[1:] or None
        lead = asks.get((q, letter, None), "") if roman == "i" else ""
        p["ask"] = (lead + " " + asks.get((q, letter, roman), "")).strip()[:1500]
    _open.clear()
    _labelled.clear()
    _drawn.clear()
    return parts


cp.cut_set = cut_set


def main():
    cp.main()
    path = os.path.join(cp.WORK, "parts.json")
    parts = json.load(open(path))
    if any(re.fullmatch(r"1hi02\d", p["component"]) for p in parts):
        parts = [p for p in parts if not p.get("paired")]  # cut again (--only=1hi02): refiled afresh
    parts = refile(parts, cp.IMG)
    json.dump(fix(parts), open(path, "w"), ensure_ascii=False)
    refiled = [p for p in parts if p.get("paired")]
    print(f"{len(parts)} parts after June 2018's Paper 2 is refiled ({len(refiled)} of them)", file=sys.stderr)
    for name in glob.glob(os.path.join(cp.IMG, "1hi02?-jun18-*")):
        os.remove(name)


if __name__ == "__main__":
    main()
