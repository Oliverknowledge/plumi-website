"""Cut AQA's GCSE Design and Technology (8552/W) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_dt/cut_dt.py [work-dir] [--only=8552w-jun23]   # default scripts/question-bank/.work/aqa-gcse-dt

GCSE Food's cutter (aqa_gcse_food/cut_food.py, so cut.py with its patches): one written paper out of 100
marks and a scheme with "Qu | Part" columns. Section A opens with questions 01-10, ten whole 1-mark
multiple-choice questions, then Sections B and C. What differs from Food:
  - Multiple choice is keyed from the scheme's "B  Brass  1 mark" row and checked against the paper's
    option B; it may offer only A-C (June 2024's lever question).
  - Marks can be printed as "[2 x 3 marks]".
  - The scheme's labels are read off its two columns whatever their weight, and November 2020 prints
    the first questions as "1", not "01" (left_labels).
  - "DO  NOT  WRITE  ON  THIS  PAGE" and "END  OF  QUESTIONS" have double spaces, and the lined pages at
    the back say "Additional page, if required": none of them are questions.
  - A section's heading ("Section B – Specialist technical principles") is never the end of the question before it.
  - A big empty box or gap for sketching is cut down to a short one (render). A drawn figure is left alone.
  - A part asking about a figure printed on an earlier part of its question gets that figure too (SHARED).
  - The reports head a question "Question B15 – specific materials", with its parts' comments under a bare
    "15.1"; the multiple choice has one comment, "Questions A1 to A10", which goes to each of the ten.
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-dt")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_food"))
sys.path.insert(0, os.path.dirname(HERE))
import cut_food  # noqa: E402  (patches cut.py the way a "Qu | Part" scheme needs)
import numpy as np  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image  # noqa: E402

cut = cut_food.cut
# Top level, not under main: the worker processes import this file and need the same patches.
cut_food.COMPONENTS = ("8552W",)
TOTAL = 100
MC_LAST = 10
cut.NOT_QUESTIONS = re.compile(r"no\s+questions\s+printed\s+on\s+this\s+page|do\s+not\s+write\s+on\s+this\s+page|additional\s+page,\s+if\s+required", re.I)
_left_labels = cut.left_labels


def left_labels(page, max_x, bold_only, with_x=False):
    """The paper's boxed labels as cut.py reads them; in a scheme, the "Qu" column's number (x under 78) with
    the "Part" column's on its line (78-116), from the first page with those headings on (a row carried to a
    new page often has no headings over it). Every other digit is an answer's."""
    if bold_only:
        return _left_labels(page, max_x, bold_only, with_x)
    doc = page.parent
    if doc.name not in TABLES_FROM:
        TABLES_FROM[doc.name] = next(p.number for p in doc if re.search(r"^Marking Guidance\s*$", p.get_text(), re.M))
    if page.number < TABLES_FROM[doc.name]:
        return []
    lines = [(l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip())
             for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
    out = []
    for x, y, t in sorted(lines, key=lambda l: l[1]):
        if re.fullmatch(r"\d{1,2}", t) and x < 78 and y < page.rect.height - 60:
            part = next((t2 for x2, y2, t2 in lines if re.fullmatch(r"\d{1,2}", t2) and 78 <= x2 < 116 and abs(y2 - y) < 4), None)
            out.append((y, f"{int(t):02d}", part, x) if with_x else (y, f"{int(t):02d}", part))
    return out


TABLES_FROM = {}
cut.left_labels = left_labels
_frame = cut.frame


def frame(page, portrait=True):
    """Food's frame, ending above "END  OF  QUESTIONS" and "Question 7 continues on the next page", and above the page's own
    border at its foot, which Food's frame takes for a table's bottom rule: trim_bottom would keep all the white space above it."""
    f = _frame(page, portrait)
    if portrait:
        for d in page.get_drawings():
            if d["rect"].width >= 480 and d["rect"].height < 3 and d["rect"].y0 > page.rect.height - 90:
                f.y1 = min(f.y1, d["rect"].y0 - 1)
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                if re.match(r"END\s+OF\s+QUESTIONS|Question \d+ continues", "".join(s["text"] for s in line["spans"]).strip()):
                    f.y1 = min(f.y1, line["bbox"][1] - 4)
    return f


cut.frame = frame
_regions = cut.regions
SECTION = re.compile(r"Section [ABC]\b")
# Parts working from a figure, table or setup printed only on an earlier part: (paper, part, the part it's on, the lines it runs
# between: the second, starting "+", is the last line taken, otherwise the first left out, or a height on the page where a figure
# with its words inside it is all that's under the first). A part drawing on two lists the later first.
SHARED = [("AQA-8552W-QP-NOV20.pdf", ("16", "3"), ("16", "2"), r"Figure 5$", 318),
          ("AQA-8552W-QP-NOV20.pdf", ("22", "2"), ("22", "1"), r"Table 4$", r"+Total"),
          ("AQA-8552W-QP-NOV21.pdf", ("20", "2"), ("20", "1"), r"Table 7", r"Calculate the internal"),
          ("AQA-8552W-QP-NOV21.pdf", ("22", "2"), ("22", "1"), r"Figure 5$", r"The overall base"),
          ("AQA-8552W-QP-NOV21.pdf", ("27", "2"), ("27", "1"), r"Figure 7$", r"Technique"),
          ("AQA-8552W-QP-JUN22.pdf", ("16", "3"), ("16", "2"), r"Figure 4$", r"Work out"),
          ("AQA-8552W-QP-JUN24.pdf", ("24", "2"), ("24", "1"), r"Two pieces", r"Calculate how many seconds"),
          ("AQA-8552W-QP-JUN25.pdf", ("24", "3"), ("24", "2"), r"Method 2", r"Calculate how much"),
          ("AQA-8552W-QP-JUN25.pdf", ("24", "3"), ("24", "1"), r"Method 1", r"Calculate how much")]
# A scheme with one row for all a question's parts, its "Part" column reading "1,2,3": each part gets that row.
JOINT = {"AQA-8552W-MS-NOV20.pdf": {"20": ("1", "2", "3")}}


def share_figure(doc, out):
    """Each of SHARED's parts gets that figure, table or setup too, so it can be read on its own."""
    parts = {r[0]: r for r in out}
    for paper, key, source, start, stop in SHARED:
        if not (doc.name or "").endswith(paper):
            continue
        for pg, rect in parts[source][1]:
            lines = cut.text_lines(doc[pg], rect)
            y0 = next((y for y, x, t in lines if re.match(start, t)), None)
            if isinstance(stop, int):
                end = stop
            else:
                y1 = next((y for y, x, t in lines if y0 is not None and y > y0 and re.match(stop.lstrip("+"), t)), None)
                end = y1 and y1 + (26 if stop.startswith("+") else -6)
            if y0 is not None and end:
                figure = (pg, pymupdf.Rect(rect.x0, y0 - 6, rect.x1, end))
                parts[key][1].insert(0, figure)
                parts[key][2] = doc[pg].get_text("text", clip=figure[1]) + "\n" + parts[key][2]
                break
    return out


def regions(doc, max_x, bold_only, portrait):
    """Food's regions, with a question ended above a section's heading, wherever it falls (the heading opens a new page
    more often than not, which leaves the question above with a piece that's only the heading: dropped)."""
    out = _regions(doc, max_x, bold_only, portrait)
    if not portrait:
        for n, (key, pieces, text) in enumerate(out):
            # A scheme row can end on the next row's reprinted headings where no rule sits above them: they go down to that row.
            pg, rect = pieces[-1] if pieces else (None, None)
            lines = cut.text_lines(doc[pg], rect) if pieces else []
            head = max((y for y, x, t in lines if t == "Qu"), default=None)
            if head is not None and head > rect.y0 + 20 and all(t in ("Qu", "Part", "Marking Guidance", "Total", "marks", "AO") for y, x, t in lines if y > head - 8):
                top = max((d["rect"].y0 for d in doc[pg].get_drawings() if d["rect"].height < 3 and d["rect"].width > 20 and head - 12 < d["rect"].y0 < head), default=head - 8) - 1
                pieces[-1] = (pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, top))
                out[n][2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
                if n + 1 < len(out) and out[n + 1][1] and out[n + 1][1][0][0] == pg:
                    first = out[n + 1][1][0][1]
                    out[n + 1][1][0] = (pg, pymupdf.Rect(first.x0, top, first.x1, first.y1))
        joint = next((v for k, v in JOINT.items() if (doc.name or "").endswith(k)), {})
        return out + [[(key[0], p), pieces, text] for key, pieces, text in out if key[1] is None and key[0] in joint for p in joint[key[0]]]
    for region in out:
        for n, (pg, rect) in enumerate(region[1]):
            head = next((y for y, x, t in cut.text_lines(doc[pg], rect) if SECTION.match(t)), None)
            if head is not None:
                keep = [(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, head - 6))] if head - 6 > rect.y0 + 8 else []
                region[1] = region[1][:n] + keep
                region[2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in region[1])
                break
    return share_figure(doc, out)


cut.regions = regions
_render = cut.render
GAP_MIN, GAP_KEEP = 170 * cut.SCALE, 60 * cut.SCALE  # in pixels: a run of 170pt or more goes down to 60pt


def render(page, rect):
    """cut.py's render; on a question paper, a run of rows with nothing but up to four upright strokes (an empty box's
    sides, or white paper) is cut down. Those are answer spaces for sketching: a figure has more going on across it."""
    img = _render(page, rect)
    if "-QP-" not in (page.parent.name or ""):
        return img
    ink = np.asarray(img.convert("L")) < 200
    rows = []
    for row in ink:
        edges = np.flatnonzero(np.diff(row.astype(np.int8)) == 1)
        rows.append(tuple(edges) if len(edges) + int(row[0]) <= 4 and row.sum() <= 4 * 5 else None)
    keep, y, cuts = [], 0, 0
    while y < len(rows):
        z = y
        while z < len(rows) and rows[z] is not None and rows[z] == rows[y]:
            z += 1
        if z - y >= GAP_MIN:
            keep.append((y, y + int(GAP_KEEP)))
            cuts += z - y - int(GAP_KEEP)
        else:
            keep.append((y, max(z, y + 1)))
        y = max(z, y + 1)
    if not cuts:
        return img
    if os.environ.get("SHOW_GAPS"):
        print("gap", os.path.basename(page.parent.name), page.number + 1, [round(v) for v in rect], round(cuts / cut.SCALE), "pt", file=sys.stderr)
    out = Image.new("RGB", (img.width, img.height - cuts), (255, 255, 255))
    at = 0
    for a, b in keep:
        out.paste(img.crop((0, a, img.width, b)), (0, at))
        at += b - a
    return out


cut.render = render
REPORT_HEADING = re.compile(r"\n\s*Questions?\s+([ABC]?\d{1,2}(?:\.\d)?)(?:\s*(?:to|[–-])\s*[ABC]?(\d{1,2}))?\b[^\n]*\n")


def examiner_report(path):
    """{question: its comments}, each part's under a "Question 15.1" heading, which QuestionRow's splitReport reads. A part's label
    sits on its own line or opens its comment's ("16.2 1 mark was awarded"), and a heading's topic can run onto a second line
    (dropped). The multiple choice's one comment goes to each of its questions."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"^\s*(?:\d+ of \d+|REPORT ON THE EXAMINATION.*|Report on the examination.*|(?:Copyright )?© ?(?:Copyright )?\d{4} AQA.*)\s*$\n?", "", text, flags=re.I | re.M)
    first = REPORT_HEADING.search(text)
    if not first:
        return {}
    end = re.search(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance|Concluding Remarks)\b", text[first.start():], re.I)
    text = text[first.start():first.start() + end.start()] if end else text[first.start():]
    bits = REPORT_HEADING.split(text)
    out = {}
    for k in range(1, len(bits) - 2, 3):
        start, last, raw = bits[k], bits[k + 1], bits[k + 2]
        q = int(re.sub(r"\D.*", "", start.lstrip("ABC")))
        if last:
            body = cut_food.tidy(raw)
            for n in range(q, int(last) + 1):
                if body:
                    out[f"{n:02d}"] = body
            continue
        raw = re.sub(r"^\s*[a-z][^\n]{0,60}\.\s*\n", "", raw, count=1)
        pieces = re.split(rf"\n\s*({q}\.\d{{1,2}})(?:\s*\n|\s+(?=[A-Z0-9]))", "\n" + raw)
        chunks = [cut_food.tidy(pieces[0])] if cut_food.tidy(pieces[0]) else []
        for j in range(1, len(pieces) - 1, 2):
            if body := cut_food.tidy(pieces[j + 1]):
                chunks.append(f"Question {f'{q:02d}'}.{pieces[j].split('.')[1]}\n\n{body}")
        if chunks:
            out[f"{q:02d}"] = "\n\n".join(chunks)
    return out


cut.examiner_report = examiner_report
TIMES = re.compile(r"\[(\d+)\s*[x×]\s*(\d+) marks?\]")
KEY = re.compile(r"(?:^|\s)0?\d{1,2}\s+([A-D])\s+(.+?)\s+1\s*mark", re.S)
BANDS = re.compile(r"\d\s*[–-]\s*\d+\s*marks", re.I)  # a levels grid's "5–6 marks"
_cut_set = cut.cut_set


def option(text, letter):
    """The words of a multiple-choice option in the question paper ("B" -> "Brass"): the printed order is A to D, each on its own line."""
    m = re.search(rf"(?:^|\s){letter}\s+(.+?)(?=\s[A-D]\s+\S|\s*\[1 mark|\s*$)", text, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def squash(x):
    return re.sub(r"[^a-z0-9]", "", x.lower())


def same(text, letter, words):
    a, b = squash(option(text, letter)), squash(words)
    return bool(b) and bool(a) and (a.startswith(b[:12]) or b.startswith(a[:12]) or b[:12] in squash(text))


def is_mc(p):
    return p["part"] is None and int(p["question"]) <= MC_LAST


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """cut.py's parts, with multiple choice keyed, and {id: its scheme's whole text} for the checks."""
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    for p in parts:  # "[2 x 3 marks]", which cut.py doesn't read
        if m := TIMES.findall(p["text"]):
            p["marks"] = (p["marks"] or 0) + sum(int(a) * int(b) for a, b in m)
    full = {}
    if ms_path and os.path.exists(ms_path):
        for (q, p), pieces, text in cut.regions(pymupdf.open(ms_path), 110, False, False):
            full.setdefault(f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}", text)
    for p in parts:
        if is_mc(p) and (m := KEY.search(re.sub(r"\s+", " ", full.get(p["id"], "")))):
            p["key"], p["keyWords"] = m.group(1), m.group(2).strip()
            if p["ms"]:
                os.remove(os.path.join(cut.IMG, p["ms"]))
                p["ms"] = None
    return parts, {k: re.sub(r"\s+", " ", v) for k, v in full.items()}


def problems_of(set_id, parts, full):
    out = []
    for p in parts:
        pid, ms = p["id"], full.get(p["id"], "")
        if not p["ms"] and not p.get("key"):
            out.append(f"{pid}: no scheme")
        if is_mc(p):
            if not re.fullmatch(r"[A-D]", p.get("key") or ""):
                out.append(f"{pid}: multiple choice, key {p.get('key')}")
            elif not same(p["text"], p["key"], p.get("keyWords", "")):
                out.append(f"{pid}: key {p['key']} '{p.get('keyWords')}' vs paper's '{option(p['text'], p['key'])}'")
            if p["marks"] != 1:
                out.append(f"{pid}: multiple choice worth {p['marks']}")
        elif p["ms"] and BANDS.search(ms) and not re.search(r"\b0\s*marks?\b|nothing worthy|no creditworthy", ms, re.I):
            out.append(f"{pid}: {p['marks']}-mark levels scheme without its 0-mark row")
        if not p["qp"] or not p["h"]:
            out.append(f"{pid}: no crop")
        if not p["marks"]:
            out.append(f"{pid}: no marks read")
    mc = sum(1 for p in parts if is_mc(p))
    if mc != MC_LAST:
        out.append(f"{set_id}: {mc} multiple-choice questions, not {MC_LAST}")
    marks = sum(p["marks"] or 0 for p in parts)
    if marks != TOTAL:
        out.append(f"{set_id}: {marks} marks, not {TOTAL}")
    return out


cut_food.cut_set = cut_set
cut_food.problems_of = problems_of

if __name__ == "__main__":
    cut_food.main()
