"""Cut Pearson Edexcel's A-Level History papers: cut_pearson.py --extracts, with History's own changes.

    python3 scripts/question-bank/edexcel_history/cut_history.py [work-dir] [--only=9hi02h-jun24]

Every History question is one 20 or 25 mark answer, "EITHER 3 OR 4", ending at its "(Total for Question 3 =
20 marks)", where --extracts stops each crop. On top of cut_pearson:
  - a question's crop starts at the lines set above its number, its option's heading ("Option 2H.2: The
    USA, 1955–92…") and "Study Sources 3 and 4 in the Sources Booklet…", which are its own;
  - the Sources or Extracts Booklet is bound in after the paper: each source or extract ("Source 1: From…",
    "Extract 2: From…") is cut out, and a question that says "Study Sources 1 and 2" carries them as its stem;
  - the schemes print their levels grids ("Generic Level Descriptors: Section A") before the indicative
    content, where ms_tables would read a grid's rows ("1 | 1–3", "2 | 4–7") as Questions 1 and 2: its pages are
    left out of the read, and each question's crop is its indicative content then its section's grid;
  - Paper 2 and Papers 34 to 39 print two sub-options in one paper, each with its own questions: a question
    goes to the paper of the option it is set under, "9hi02h1" (Option 2H.1) or "9hi0372" (Option 37.2), so
    every option is a paper of its own;
  - some reports set their text in fonts with no character map, so it comes out as symbols: those are read by OCR.
The patches are at the top level, so cut_pearson's worker processes (which re-run this file) have them too.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-history"), "--extracts", *[f for f in flags if f != "--extracts"]]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

OPTION = re.compile(r"^Option (\d[A-H0-9](?:\.\d)?)\s*:")
OVER = re.compile(r"^(Option \d[A-H0-9](?:\.\d)?\s*:|Study |Read |Look at )")
SECTION = re.compile(r"^SECTION ([A-C])\b")


# ---------- question papers ----------

_qp_labels = cp.qp_labels


def qp_labels(doc):
    """cut_pearson's labels, each question's moved up over its option's heading and its "Study…" line."""
    labels, end_page = _qp_labels(doc)
    out = []
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        prev = out[-1] if out else None
        top = y
        lines = [l for l in doc.lines(pg) if l["y0"] < y - 2 and not (prev and prev[0] == pg and l["y0"] <= prev[1] + 2)]
        lines.reverse()
        for k, l in enumerate(lines):
            if top - l["y1"] > 30 or re.match(r"\(Total for Question|EITHER$|OR$", l["text"]):
                break
            # (a heading or an instruction can run on to a second line: that line goes with the one over it)
            above = lines[k + 1] if k + 1 < len(lines) else None
            if OVER.match(l["text"]) or above and l["y0"] - above["y1"] < 8 and OVER.match(above["text"]):
                top = l["y0"]
            else:
                break
        out.append((pg, top, q, letter, roman))
    return out, end_page


cp.qp_labels = qp_labels


def booklet_start(qp, end_page):
    """The booklet's first page: its cover, after the paper's last page."""
    for i in range(end_page + 1, len(qp)):
        if re.search(r"(Sources|Extracts|Source|Extract) Booklet|Pearson Edexcel Level 3", qp.text(i)) and not qp.blank(i):
            return i
    return None


UNIT = re.compile(r"^(Source|Extract) (\d{1,2})\s*:")
ONE = re.compile(r"^Source for use with Section A")
UNIT_END = re.compile(r"^(Option \d|Sources? for use with|Extracts? for use with|Acknowledgements|Every effort has been made|BLANK PAGE)", re.I)
FURNITURE = re.compile(r"^(\d{1,2}|P\d{5}[A-Z]{0,2}\d*|\*?P\d{5}[A-Z]{0,2}\d*\*?|Turn over|BLANK PAGE)$")


def booklet_units(qp, start):
    """{("Source", 1): [(page, rect)], ("Extract", 2): …}: each from its heading to the next, or the booklet's end."""
    if start is None:
        return {}
    # (Papers 30 to 33 have one source, printed under "Source for use with Section A." with no heading of its
    # own: it is ("Source", 0), and their question says "Study the source…")
    heads = [(i, l["y0"], (m.group(1), int(m.group(2))) if m else ("Source", 0)) for i in range(start, len(qp)) for l in qp.lines(i)
             if (m := UNIT.match(l["text"])) and l["x0"] < qp[i].rect.width / 3 or ONE.match(l["text"])]  # (that one is centred)
    out = {}
    for n, (pg, y, key) in enumerate(heads):
        stop = heads[n + 1][:2] if n + 1 < len(heads) else (len(qp) - 1, None)
        pieces = []
        for i in range(pg, stop[0] + 1):
            f = qp.frame(i)
            top = y - 4 if i == pg else f.y0
            end = stop[1] if i == stop[0] and stop[1] is not None else f.y1
            body = []
            for l in qp.lines(i):
                if not (top - 2 <= l["y0"] < end - 2):
                    continue
                # (the booklet's last unit ends at a blank page or the copyright notice, not the booklet's end)
                if UNIT_END.match(l["text"]) and not (i == pg and abs(l["y0"] - y) < 2) and not (key[1] == 0 and ONE.match(l["text"])):
                    end = l["y0"]
                    break
                if FURNITURE.match(l["text"]) or re.search(r"©|Pearson Education", l["text"]):
                    continue
                body.append(l)
            if body and not qp.blank(i):
                bottom = min(end - 2, max(l["y1"] for l in body) + 12)  # (and the foot of the box the source is set in)
                if bottom > top + 10:
                    pieces.append((i, pymupdf.Rect(f.x0, top, f.x1, bottom)))
            if end < (f.y1 if not (i == stop[0] and stop[1] is not None) else stop[1]):
                break  # the unit ended at the next block's heading
        if key not in out:
            out[key] = pieces
    return out


STUDY = re.compile(r"\b(?:Study|Read|Look at) (?:the )?(Sources?|Extracts?) (\d{1,2})((?:\s*(?:,|and)\s*\d{1,2})*)")


def named_units(text):
    """"Study Sources 1 and 2…" -> [("Source", 1), ("Source", 2)]."""
    out = [("Source", 0)] if re.search(r"\bStudy the source\b", text) else []
    for m in STUDY.finditer(text):
        kind = "Source" if m.group(1).startswith("Source") else "Extract"
        for n in [m.group(2)] + re.findall(r"\d{1,2}", m.group(3)):
            if (kind, int(n)) not in out:
                out.append((kind, int(n)))
    return out


def paper_options(qp, labels, paper):
    """{q: (option, section)}: the "Option 2H.1:" heading and "SECTION A" over each question."""
    marks = []
    for i in range(1, len(qp)):
        for l in qp.lines(i):
            m, s = OPTION.match(l["text"]), SECTION.match(l["text"])
            if m:
                marks.append((i, l["y0"], "o", m.group(1)))
            elif s:
                marks.append((i, l["y0"], "s", s.group(1)))
    out = {}
    count = sum(1 for *_, letter, _ in labels if not letter)
    for pg, y, q, letter, _ in labels:
        if letter:
            continue
        before = [m for m in marks if (m[0], m[1]) <= (pg, y + 2)]
        opt = next((m[3] for m in reversed(before) if m[2] == "o"), None)
        sec = next((m[3] for m in reversed(before) if m[2] == "s"), None)
        # (a heading the PDF has no text for, as Paper 31's in November 2021: the paper's shape says it)
        out[q] = (opt, sec or BY_NUMBER.get((paper, count), {}).get(q))
    return out


# Each paper's sections by question number, by paper and how many questions it has: Paper 1 (5), Paper 2 (6),
# Papers 30 to 33 (5) and 34 to 39 (10).
BY_NUMBER = {("1", 5): {1: "A", 2: "A", 3: "B", 4: "B", 5: "C"},
             ("2", 6): {1: "A", 2: "A", 3: "B", 4: "B", 5: "B", 6: "B"},
             ("3", 5): {1: "A", 2: "B", 3: "B", 4: "C", 5: "C"},
             ("3", 10): {1: "A", 2: "A", **{q: "B" for q in range(3, 7)}, **{q: "C" for q in range(7, 11)}}}


# ---------- mark schemes ----------

GRID = re.compile(r"^(?:Generic Level Descriptors:\s*)?Sections? ([A-C])(?: and ([A-C]))?\s*$")
# The indicative content starts with Question 1's row: not every scheme heads it "Section A: indicative content".
INDICATIVE = re.compile(r"Answers will be credited according|Sections? [A-C]\s*:\s*indicative content", re.I)
SECTIONS = {}  # {question: section} of the paper being cut, read off the question paper
_ms_tables = cp.ms_tables
HEADER_ONLY = re.compile(r"Question|Indicative content|Sections? [A-C]\s*:\s*[Ii]ndicative content|Option \d[A-H0-9](?:\.\d)?\s*:[^\n]*")


def grids(doc):
    """({"A": [(page, rect)], …}, the first indicative content page): the levels grid for each section."""
    start = next((i for i in range(len(doc)) if "Generic Level Descriptors" in doc.text(i)), 0)
    first = next((i for i in range(start + 1, len(doc)) if INDICATIVE.search(doc.text(i))), len(doc))
    heads = []
    for i in range(start, first):
        for l in doc.lines(i):
            m = GRID.match(l["text"].strip())
            if m and l["x0"] < 150:
                heads.append((i, l["y0"], [m.group(1)] + ([m.group(2)] if m.group(2) else [])))
    out = {}
    for n, (pg, y, secs) in enumerate(heads):
        stop = heads[n + 1][:2] if n + 1 < len(heads) else (first, None)
        pieces = []
        for i in range(pg, (stop[0] if stop[1] is not None else first - 1) + 1):
            box = cp.ms_page_box(doc, i)
            top = max(box.y0, y - 4) if i == pg else box.y0
            bottom = min(box.y1, stop[1] - 4) if i == stop[0] and stop[1] is not None else box.y1
            if bottom > top + 10 and cp.has_content(doc, i, pymupdf.Rect(box.x0, top, box.x1, bottom)):
                pieces.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
        for s in secs:
            out.setdefault(s, pieces)
    return out, first


def ms_tables(doc):
    """ms_tables on the indicative content only, each question's rows followed by its section's levels grid."""
    grid, first = grids(doc)
    for i in range(first):
        doc._lines[i] = []  # the levels grids: no question's rows are there
    for i in range(first, len(doc)):
        # A question's number alone in the Question column is its label, however it is set: "1." in plain type
        # (Paper 3, June 2024), "1" in plain Open Sans (June 2022). ms_tables reads a label by its bold where
        # the table has no header of its own on a line: so the number is made bold, and the header, "Question
        # Indicative content" on one line on most pages and two on some, is read as one line everywhere.
        doc._lines[i] = [{**l, "text": l["text"].rstrip("."), "spans": [{**l["spans"][0], "text": l["text"].rstrip("."), "flags": 16}]}
                         if re.fullmatch(r"\d{1,2}\.?", l["text"]) and l["x0"] < 100
                         else {**l, "text": "Question Indicative content"} if l["text"] == "Question" else l for l in doc.lines(i)]
    found = _ms_tables(doc)
    heads = [(i, l["y0"], m.group(1)) for i in range(first, len(doc)) for l in doc.lines(i)
             if (m := re.match(r"Sections? ([A-C])\s*:\s*indicative content", l["text"], re.I))]
    out = {}
    for key, (pieces, text, ans) in found.items():
        if not pieces:
            out[key] = (pieces, text, ans)
            continue
        at = (pieces[0][0], pieces[0][1].y0 + 4)
        # (the question paper says which section a question is in; a scheme's own headings can be missing or out of order)
        sec = SECTIONS.get(key[0]) or next((s for pg, y, s in reversed(heads) if (pg, y) <= at), None)
        # A strip at the foot of the rows with only the next table's header (or its section's and option's
        # headings) in it is the next question's, not this one's.
        # (a narrow column can break "Question" over three lines, "Que", "stio", "n": a dozen letters is no answer)
        pieces = pieces[:1] + [(pg, r) for pg, r in pieces[1:] if len(re.findall(r"[A-Za-z]", HEADER_ONLY.sub("", doc.text(pg, r)))) > 12]
        out[key] = (pieces + grid.get(sec, []), text, ans)
    return out


cp.ms_tables = ms_tables


# ---------- examiner reports ----------

_examiner_report = cp.examiner_report


class _Page:
    def __init__(self, text):
        self.text = text

    def get_text(self):
        return self.text


class _Read:
    """pymupdf, but open() hands examiner_report the pages read by OCR."""

    def __init__(self, pages):
        self.pages = pages

    def __getattr__(self, name):
        return getattr(pymupdf, name)

    def open(self, path):
        return [_Page(t) for t in self.pages]


def ocr_pages(path):
    """A report's pages read by OCR (cut_pearson's ocr_lines), its candidates' scripts (pictures) whited out
    first so only the examiners' words are read; a blank line wherever the gap between lines ends a paragraph."""
    doc = pymupdf.open(path)
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


def examiner_report(path, section=None):
    """cut_pearson's; a report whose text has no character map (eight from June 2024: it comes out as symbols)
    is read by OCR first."""
    if not path or not os.path.exists(path):
        return {}
    seen = "".join(page.get_text() for page in pymupdf.open(path))
    if len(re.findall(r"[A-Za-z]", seen)) >= 0.5 * len(re.sub(r"\s", "", seen)):
        return _examiner_report(path, section)
    cp.pymupdf = _Read(ocr_pages(path))
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = pymupdf


cp.examiner_report = examiner_report


# ---------- one paper ----------

_cut_set = cp.cut_set


def paper_code(option):
    """"2H.1" -> "2h1", "37.2" -> "372", "1A" -> "1a", "30" -> "30"."""
    return option.replace(".", "").lower()


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    where = paper_options(qp, labels, meta["component"][4])
    SECTIONS.clear()
    SECTIONS.update({q: sec for q, (_, sec) in where.items()})
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    units = booklet_units(qp, booklet_start(qp, end_page))
    comp = meta["component"]  # "9hi02h"
    own = comp[4:].upper()  # "2H": Paper 1 and Papers 30 to 33 print no option heading over their questions
    for p in parts:
        q = int(p["question"])
        option, section = where.get(q, (None, None))
        option = option if option and option.replace(".", "").lower().startswith(own.lower()) else own
        new_comp = comp[:4] + paper_code(option)
        new_set = f"{new_comp}-{set_id.split('-', 1)[1]}"
        used = named_units(p["text"])
        pieces = [x for u in used for x in units.get(u, [])]
        pid = f"{new_set}-{q:02d}" + ("-q" if pieces else "")
        for kind in ("qp", "ms"):
            if p[kind]:
                name = f"{pid}-{kind}.webp"
                if name != p[kind]:
                    os.replace(os.path.join(cp.IMG, p[kind]), os.path.join(cp.IMG, name))
                p[kind] = name
        p.update({"id": pid, "set": new_set, "component": new_comp, "option": option, "section": section})
        if p["marks"] is None:  # "(Total for Question 1= 20 marks)", June 2017
            m = re.search(r"Total for Question \d+\s*=\s*(\d+) marks?", p["text"])
            p["marks"] = int(m.group(1)) if m else None
        if pieces:
            p["stem"] = f"{new_set}-{q:02d}-stem.webp"
            cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in pieces]), p["stem"])
            p["text"] = (p["text"] + " " + " ".join(qp.text(pg, r) for pg, r in pieces))[:3000]
            p["sources"] = [f"{k} {n}" for k, n in used if (k, n) in units]
    return parts


cp.cut_set = cut_set


def restem():
    """--stems-only: cut the questions' stems again from the booklets, for parts.json as it is."""
    path = os.path.join(cp.WORK, "parts.json")
    parts = cp.json.load(open(path))
    files = {(f["component"].replace("-", ""), f["series"]): f["file"] for f in cp.json.load(open(os.path.join(cp.WORK, "manifest.json"))) if f["kind"] == "qp"}
    by_paper = {}
    for p in parts:
        if p.get("sources"):
            by_paper.setdefault((p["component"][:6], p["series"]), []).append(p)
    for (comp, series), mine in sorted(by_paper.items()):
        qp = cp.Doc(os.path.join(cp.WORK, "pdf", files[(comp, series)]))
        labels, end_page = cp.qp_labels(qp)
        units = booklet_units(qp, booklet_start(qp, end_page))
        for p in mine:
            used = [(k, int(n)) for k, n in (u.split() for u in p["sources"])]
            cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for u in used for pg, r in units.get(u, [])]), p["stem"])
        print(f"{comp}-{series}: {len(mine)} stems", file=sys.stderr, flush=True)


if __name__ == "__main__":
    restem() if "--stems-only" in sys.argv else cp.main()
