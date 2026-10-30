"""Cut Eduqas's GCSE Religious Studies or History papers into parts, each with its mark scheme and examiner's comments.

    python3 scripts/question-bank/eduqas_gcse/cut_eduqas_gcse.py rs|history [work-dir] [--only=c100ug0-jun24]
    # work-dir: .work/eduqas-gcse-<subject> (fetch_eduqas_gcse.py); needs: pip install pymupdf pillow

Self-contained, like eduqas_rs/cut_eduqas_rs.py (the shared cutters are untouched). Both subjects
are answered in the question booklet, so a part's crop is its own words and not the answer lines
under them: each page's stretch of a part is cut from its first line to its last, leaving out the
page's furniture ("Examiner only", the mark boxes, page numbers, the codes down the margin).

Religious Studies: every paper, every year, is questions "1." with parts (a) to (d): (a) a key
concept [2], (b) describe [5], (c) explain [8], (d) evaluate a statement [15] (Route B's (a)-(c)
are in two halves, (i) and (ii), kept together as one part). The theme ("Issues of Relationships")
is printed under the question's number, so (a) starts there. The scheme opens with the band
descriptors for each part, headed "Question (b)", "Questions 1 (d), 3 (d) and 4 (d) ONLY" or
"Question 1 (a) (i) and (ii) and 2 (a)", and the spelling, punctuation and grammar grid, then each
part's indicative content under "(a)" … "(d)". A part's scheme crop is its indicative content and,
under it, the bands it is marked on (and the SPaG grid for the part that carries those marks).

History: one question to a heading, "QUESTION 3", most with sources or interpretations printed
before the question itself; thematic studies' question 6, on the historic site, has (a) and (b).
The sources are the question's stem (<set>-<q>-stem.webp), so a one-part question's id ends "-q"
(c100ug0-jun24-04-q) and partImage finds it; the part's crop is the question from its first line.
The question starts where the paragraph holding its marks ("[11]") does, after the last source's
attribution "[…]". A question with no source ("Describe …") is one crop. The scheme is a block per
question, "Question 4" (bands, then indicative content), "Question 6 (a)".

The examiner's report is one per series (Religious Studies: one per route until 2024), a section per
component or option ("COMPONENT 3 – STUDY OF A WORLD FAITH – ISLAM", History's "BRITISH STUDIES IN
DEPTH", or one option, "C100UB0-1 THE ELIZABETHAN AGE"), each question's comments headed "Q.1",
"Question 1" or "Q1.": a question's comments go to each of its parts (reports are by question).

Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <set>-<q>-stem.webp; <work-dir>/parts.json in
cut_eduqas_rs.py's shape. Ids: c120u10-jun24-01-a, c100ug0-jun24-04-q, c100u50-jun24-06-b.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SUBJECT = ARGS[0] if ARGS else "rs"
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-{SUBJECT}")
IMG = os.path.join(WORK, "img")
SCALE = 2.2  # ~160 dpi, as the other cutters
MARKS = re.compile(r"\[(\d{1,2})\]")
# A page's furniture: none of it is a question's
FURNITURE = re.compile(r"^(Examiner|only|Examiner only|Total|SPaG|Turn over\.?|\d{1,3}|0 \d|Question|number|Answer all questions\.?|"
                       r"Additional page, if required\.|Write the question number\(s\) in the left-hand margin\.|BLANK PAGE|"
                       r"PLEASE DO NOT WRITE|ON THIS PAGE|©.*|\(?C1\d0U\w*-\d\)?|C1\d ?\d .*|\.{4,}[.\s]*|[A-Z]{1,3}\d{2}C1\d0U\w+|\S*\*\(\S+\))$")
STOP = re.compile(r"^(END OF PAPER|Additional space for [Qq]uestion)")
SOURCE = re.compile(r"^(Source [A-H]\b|Interpretation \d|Study the|Look at|Read the)")
SPAG = re.compile(r"Marks for spelling, punctuation")


# ---------- pages ----------

def page_lines(page):
    """[{text, x0, x1, y0, y1, bold}] and the page's pictures as lines with no text, top to bottom."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") == 1:
            x0, y0, x1, y1 = b["bbox"]
            if x1 - x0 > 30 and y1 - y0 > 30:
                out.append({"text": "", "x0": x0, "x1": x1, "y0": y0, "y1": y1, "bold": False, "image": True})
            continue
        for l in b.get("lines", []):
            text = "".join(s["text"] for s in l["spans"]).strip()
            if text:
                out.append({"text": text, "x0": l["bbox"][0], "x1": l["bbox"][2], "y0": l["bbox"][1], "y1": l["bbox"][3],
                            "bold": "Bold" in l["spans"][0]["font"]})
    return sorted(out, key=lambda l: (round(l["y0"]), l["x0"]))


class Doc:
    """A PDF with its pages' lines read once."""

    def __init__(self, path):
        self.doc = pymupdf.open(path)
        self._lines = {}

    def __len__(self):
        return len(self.doc)

    def __getitem__(self, i):
        return self.doc[i]

    def lines(self, i):
        if i not in self._lines:
            self._lines[i] = page_lines(self.doc[i])
        return self._lines[i]


def content(doc, pg, y0, y1, kind="qp"):
    """The lines on page pg between y0 and y1 that belong to a question (or, kind "ms", to a scheme)."""
    h = doc[pg].rect.height
    out = []
    for l in doc.lines(pg):
        if not (y0 - 1 <= l["y0"] < y1) or l["y0"] < (52 if kind == "ms" else 70) or l["y0"] > h - 52:
            continue
        if not l.get("image") and not re.search(r"[A-Za-z0-9]", l["text"]):
            continue  # a stray tab or backspace on an answer line
        if kind == "qp" and (l["x0"] > 538 or FURNITURE.match(l["text"])):
            continue
        if kind == "ms" and re.fullmatch(r"©.*|\d{1,3}|_{5,}", l["text"]):
            continue
        out.append(l)
    return out


def segments(doc, start, end, kind="qp"):
    """[(page, rect)] covering what lies between (page, y) and (page, y): on each page, its first line to its last,
    split where a stretch of answer lines comes between (Route B's (a)(i) and (a)(ii))."""
    out = []
    # (inside the question paper's frame, 54 to 541pt, so its rules aren't cut with it)
    x0, x1 = (55.5, 540) if kind == "qp" else (34, doc[0].rect.width - 34)
    for pg in range(start[0], end[0] + 1):
        y0 = start[1] if pg == start[0] else 0
        y1 = end[1] if pg == end[0] else doc[pg].rect.height
        ls = sorted(content(doc, pg, y0, y1, kind), key=lambda l: l["y0"])
        runs = []
        for l in ls:
            if runs and (kind == "ms" or l["y0"] - runs[-1][-1]["y1"] < 48):
                runs[-1].append(l)
            else:
                runs.append([l])
        for n, run in enumerate(runs):
            top = max(y0, min(l["y0"] for l in run) - 5) if n == 0 else min(l["y0"] for l in run) - 5
            out.append((pg, pymupdf.Rect(x0, top, x1, max(l["y1"] for l in run) + 6)))
    return out


def crop(doc, pg, rect):
    pix = doc[pg].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=rect)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def trim(img, keep=10):
    if img is None:
        return None
    box = ImageChops.difference(img, Image.new("RGB", img.size, (255, 255, 255))).convert("L").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    return img.crop((0, max(0, box[1] - keep), img.width, min(img.height, box[3] + keep)))


def stack(images, gap=12):
    images = [i for i in images if i is not None]
    if not images:
        return None
    out = Image.new("RGB", (max(i.width for i in images), sum(i.height for i in images) + gap * (len(images) - 1)), (255, 255, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def image_of(doc, segs):
    return stack([trim(crop(doc, p, r)) for p, r in segs])


def save(img, name):
    if img is None:
        return None
    if img.height > 16000:
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    img.save(os.path.join(IMG, name), "WEBP", quality=72, method=4)
    return name


def text_of(doc, segs, kind="qp"):
    words = []
    for pg, r in segs:
        words += [l["text"] for l in content(doc, pg, r.y0, r.y1 + 1, kind) if r.x0 - 2 <= l["x0"] < r.x1]
    return re.sub(r"\s+", " ", " ".join(words)).strip()


def marks_of(text):
    """The part's marks: every "[n]" before the SPaG marks (Route B's (i) and (ii) add up)."""
    text = SPAG.split(text)[0]
    found = [int(m) for m in MARKS.findall(text)]
    return sum(found) if found else None


# ---------- question paper ----------

def qp_labels(doc):
    """[(page, y, q, letter)]: a question's start (letter None) and its parts; and the stops after them."""
    labels, stops, q = [], [], 0
    for pg in range(1, len(doc)):
        for l in doc.lines(pg):
            if l["y0"] < 70 or not l["text"]:
                continue
            if STOP.match(l["text"]):
                stops.append((pg, l["y0"]))
                if l["text"].startswith("END OF PAPER"):
                    return labels, stops
                continue
            if SUBJECT == "history":
                m = re.match(r"^QUESTION\s+(\d)\s*$", l["text"])
            else:
                m = re.match(r"^(\d)\.(?:\s|$)", l["text"]) if l["x0"] < 75 else None
            if m and int(m.group(1)) == q + 1:
                q = int(m.group(1))
                labels.append((pg, l["y0"], q, None))
                continue
            m = re.match(r"^\(([a-e])\)(?:\s|$)", l["text"]) if q and l["x0"] < 130 else None
            if m:
                done = [x[3] for x in labels if x[2] == q and x[3]]
                if m.group(1) == "abcde"[len(done)]:
                    labels.append((pg, l["y0"], q, m.group(1)))
    return labels, stops


def lines_between(doc, start, end):
    """[(page, line)] of question content between two (page, y) points."""
    out = []
    for pg in range(start[0], end[0] + 1):
        y0 = start[1] if pg == start[0] else 0
        y1 = end[1] if pg == end[0] else doc[pg].rect.height
        out += [(pg, l) for l in content(doc, pg, y0, y1)]
    return out


def question_start(doc, start, end):
    """History: where a question with sources starts, the first line of the paragraph that holds its marks
    (after the last source's "[…]" attribution); None if nothing before it is a source."""
    ls = lines_between(doc, start, end)
    # the marks, "[5]", in the margin or at the end of the question's line
    at = next((i for i, (pg, l) in enumerate(ls) if re.search(r"\[\d{1,2}\]\s*$", l["text"])), None)
    if at is None:
        return None
    pg, mark = ls[at]
    # the question's own line beside its marks
    i = next((j for j in range(at, -1, -1) if ls[j][0] == pg and abs(ls[j][1]["y0"] - mark["y0"]) < 4 and ls[j][1]["x0"] < 120), at)
    while i > 0:
        ppg, prev = ls[i - 1]
        cpg, cur = ls[i]
        if prev["image"] if "image" in prev else False:
            break
        if ppg != cpg or cur["y0"] - prev["y0"] > 16 or prev["x0"] > 100:
            break
        if prev["text"].endswith("]") or prev["text"].startswith("[") or SOURCE.match(prev["text"]) or prev["text"].startswith("QUESTION"):
            break
        i -= 1
    before = [l for _, l in ls[:i]]
    if not any(SOURCE.match(l["text"]) for l in before):
        return None
    return (ls[i][0], ls[i][1]["y0"] - 4)


# ---------- mark scheme ----------

def grid_rules(heading):
    """What a band descriptor grid's heading covers: [(question or None, letter)]."""
    heading = re.split(r"See below", heading)[0]
    out = []
    for q, letter in re.findall(r"(\d)?\s*\(([a-d])\)", heading):
        out.append((int(q) if q else None, letter))
    # "Questions 1 (d), 3 (d) and 4 (d)": each number its own; a bare "(b)" is every question's
    return out


def ms_rs(doc):
    """{(q, letter): [(page, rect)]} indicative content; {(q, letter): [(page, rect)]} bands; [(page, rect)] SPaG grid."""
    # The bands come first, then the indicative content, from the first page with a part's "(a)"
    first = next((pg for pg in range(3, len(doc)) if any(re.fullmatch(r"\(a\)", l["text"]) and 95 < l["x0"] < 125
                                                          for l in doc.lines(pg))), len(doc))
    heads, spag = [], None
    for pg in range(first):
        for l in doc.lines(pg):
            if l["bold"] and l["x0"] < 100 and re.match(r"^Questions?\s*(\d\s*)?\(\s*[a-d]\s*\)|^Questions?\s+\d\s*\(", l["text"]):
                heads.append((pg, l["y0"], l["text"]))
            elif l["bold"] and l["x0"] < 100 and re.match(r"^Assessment of spelling", l["text"]):
                spag = (pg, l["y0"])
    last = first - 1
    # Indicative content: "(a)" … "(d)" in turn, question by question
    found, q, want = [], 0, "a"
    for pg in range(first, len(doc)):
        for l in doc.lines(pg):
            m = re.match(r"^\(([a-d])\)$", l["text"])
            # (bold or not: 2019's aren't; Route B repeats "(b)" over its "(ii)", taken once)
            if m and 95 < l["x0"] < 125 and m.group(1) == want:
                q += want == "a"
                found.append((pg, l["y0"], q, want))
                want = "abcd"[("abcd".index(want) + 1) % 4]
    schemes = {}
    for n, (pg, y, qq, letter) in enumerate(found):
        end = (found[n + 1][0], found[n + 1][1] - 4) if n + 1 < len(found) else (len(doc) - 1, doc[-1].rect.height)
        # the next question's heading ("2.", "Q.2" and its theme) and "Refer to the marking bands for question (b)" are not this part's
        cut = None
        for p in range(pg, end[0] + 1):
            for l in doc.lines(p):
                if (p, l["y0"]) <= (pg, y + 2) or (p, l["y0"]) >= end:
                    continue
                if (l["bold"] and l["x0"] < 100 and re.match(r"^(\d\.|Q\.?\s?\d)", l["text"])) or l["text"].startswith("Refer to the marking bands"):
                    cut = (p, l["y0"] - 4)
                    break
            if cut:
                break
        schemes[(qq, letter)] = segments(doc, (pg, y - 4), cut or end, "ms")
    grids = {}
    stops = sorted([(h[0], h[1]) for h in heads] + ([spag] if spag else []) + ([(found[0][0], 0)] if found else [(last + 1, 0)]))
    for pg, y, text in heads:
        end = min(s for s in stops if s > (pg, y))
        segs = segments(doc, (pg, y - 4), (end[0], end[1] - 4) if end[1] else (end[0] - 1, doc[end[0] - 1].rect.height), "ms")
        body = " ".join(l["text"] for p, r in segs for l in content(doc, p, r.y0, r.y1, "ms"))
        if "Band" not in body:
            continue  # "Question (a): See instructions provided with indicative content."
        for rule in grid_rules(text):
            grids.setdefault(rule, segs)
    spag_segs = None
    if spag:
        end = min([s for s in stops if s > spag] + [(len(doc) - 1, doc[-1].rect.height)])
        spag_segs = segments(doc, (spag[0], spag[1] - 4), (end[0], end[1] - 4) if end[1] else (end[0] - 1, doc[end[0] - 1].rect.height), "ms")
    return schemes, grids, spag_segs


def ms_history(doc):
    """{(q, letter or None): [(page, rect)]}: each question's block, bands and indicative content."""
    found = []
    for pg in range(2, len(doc)):
        for l in doc.lines(pg):
            m = re.match(r"^Question\s+(\d)\s*(?:\(([ab])\))?\s*$", l["text"])
            if m and l["x0"] < 110:  # (bold or not)
                key = (int(m.group(1)), m.group(2))
                if key not in [f[2] for f in found]:
                    found.append((pg, l["y0"], key))
    out = {}
    for n, (pg, y, key) in enumerate(found):
        end = (found[n + 1][0], found[n + 1][1] - 4) if n + 1 < len(found) else (len(doc) - 1, doc[-1].rect.height)
        out[key] = segments(doc, (pg, y - 4), end, "ms")
    return out


# ---------- examiner's report ----------

RS_KEYS = [("FOUNDATIONAL", "c120u80"), ("APPLIED CATHOLIC", "c120u90"), ("PHILOSOPHICAL", "c120u10"), ("MODERN WORLD", "c120u10"),
           ("CHRISTIANITY", "c120u20"), ("BUDDHISM", "c120u30"), ("HINDUISM", "c120u40"), ("ISLAM", "c120u50"), ("JUDAISM", "c120u60"),
           ("SIKHISM", "c120u70")]
HISTORY_KEYS = [("NON-BRITISH", "non-british"), ("BRITISH", "british"), ("PERIOD", "period"), ("THEMATIC", "thematic")]
WORDS = {"One": "1", "Two": "2", "Three": "3", "Four": "4", "Five": "5", "Six": "6"}
QHEAD = re.compile(r"^(?:Q\.?\s*|Question\s+|QUESTION\s+)(\d)\s*\.?\s*(?:\(?([a-e])\)?\.?)?\s*(?:Beliefs(?: and [Tt]eachings)?|Practices|Issues of [\w ,]+|Origins and Meaning|Good and Evil|Life and Death|Sin and Forgiveness)?\s*$")


def section_key(line):
    """The component or option a report heading names: "c120u50", "c100ub0", "british"; else None."""
    up = line.upper()
    # one option's code, "C100UB0-1", 2018's "CF100UF0-1" and "PERIOD STUDY – C100U1", Autumn 2020's "OPTION C100UB"; not a
    # range of them ("OPTIONS C100U1-4")
    m = (re.search(r"C\w?100U([A-H1-8])0\b", up) or re.search(r"(?:OPTION|STUDY)\s*[–-]?\s*C100U([A-H1-8])\b(?!-)", up))
    if SUBJECT == "history":
        if m:
            return f"c100u{m.group(1).lower()}0"
        return next((k for w, k in HISTORY_KEYS if w in up), None)
    if re.search(r"COMPONENTS 1, 2 AND 3|FULL AND SHORT", up) and not re.search(r"COMPONENT \d\s*[:–-]", up):
        return None
    return next((k for w, k in RS_KEYS if w in up), None)


def is_heading(line):
    """A section's heading is in capitals ("COMPONENT 3 – STUDY OF A WORLD FAITH - ISLAM", "C100UB0-1 THE ELIZABETHAN AGE"),
    or 2025's "Route A Component 2 - Christianity", Autumn 2020's "OPTION C100UB – …"; never a sentence ("Component 3. There were …")."""
    if len(line) > 140 or not re.match(r"^(?:[A-Z ]*:?\s*)?(COMPONENT|Component|Route [AB] Component|OPTION C100U|C\w?100U\w0-1|PERIOD STUDY|THEMATIC STUDY)", line):
        return False
    letters = [c for c in line if c.isalpha()]
    return re.match(r"^(Route [AB] Component \d|OPTION C100U)", line) or sum(c.isupper() for c in letters) >= 0.85 * len(letters)


def report(path, route=None):
    """{section key: {"01": comments}}, {section key: {"01": what the report says the question tested}}."""
    if not path or not os.path.exists(path):
        return {}, {}
    lines = []
    for page in pymupdf.open(path):
        for l in page.get_text().split("\n"):
            l = l.strip()
            if not l or re.fullmatch(r"©.*|\d{1,3}", l):
                continue
            lines.append(l)
    out, hints, key, q, buf, listing = {}, {}, None, None, [], False

    def flush():
        if key and q and buf:
            # (a list of what each part tested, "(b) Area of Study: …; …", is a hint for tagging wherever it comes)
            is_list = listing or len(re.findall(r"Area of Study:|Key Concept:", " ".join(buf))) >= 2
            target = hints if is_list else out
            text = re.sub(r"\s+", " ", " ".join(buf)).strip() if is_list else tidy("\n".join(buf))
            if text:
                d = target.setdefault(key, {})
                d[f"{q:02d}"] = (d.get(f"{q:02d}", "") + "\n" + text).strip()

    for n, l in enumerate(lines):
        if is_heading(l):
            k = section_key(l + " " + (lines[n + 1] if n + 1 < len(lines) else ""))
            if not k and SUBJECT == "rs" and re.fullmatch(r"COMPONENT 1", l):
                k = "c120u80" if route == "b" else "c120u10"  # June 2018's "COMPONENT 1", the line under it a sentence
            if k:
                flush()
                key, q, buf, listing = k, None, [], False
                continue
        # 2024 lists what each question tested before commenting by type of question: kept for tagging, not as comments
        if l.startswith("Which aspects of the specification were assessed"):
            flush()
            q, buf, listing = None, [], True
            continue
        m = QHEAD.match(re.sub(r"(?<=^Question )(One|Two|Three|Four|Five|Six)\b( \(part ([ab])\))?",
                                lambda w: WORDS[w.group(1)] + (f" ({w.group(3)})" if w.group(3) else ""), l))
        if m and key:
            flush()
            q, buf = int(m.group(1)), ([f"({m.group(2)})"] if m.group(2) else [])
            continue
        if re.match(r"^(Supporting you|Summary of key points|Overview of (the Component|general performance)|Comments on individual|General Comments)", l):
            flush()
            q, buf, listing = None, [], False
            continue
        if q:
            buf.append(l)
    flush()
    return out, hints


def tidy(chunk):
    """Paragraphs: lines run together, bullets kept as their own lines."""
    chunk = re.sub(r"\n•\s*\n", "\n• ", "\n" + chunk)
    chunk = re.sub(r"(?<=[^\n])\n(?!• |\([a-e]\))", " ", chunk)
    text = "\n".join(re.sub(r"[ \t]+", " ", p).strip() for p in chunk.split("\n") if p.strip())
    return text if len(text) > 60 else ""


# ---------- one sitting ----------

def report_for(reports, comp, q):
    """The comments on question q of this paper: its own section, or (History) its kind of study's."""
    sys.path.insert(0, HERE)
    from spec_eduqas_gcse import study  # noqa: PLC0415
    own = reports.get(comp, {}).get(f"{q:02d}")
    if own or SUBJECT != "history":
        return own
    code = {**{f"c100u{c}0": f"1{c.upper()}" for c in "abcdefgh"}, **{f"c100u{n}0": f"2{'ABCDEFGH'[n - 1]}" for n in range(1, 9)}}[comp]
    return reports.get(study(code), {}).get(f"{q:02d}")


def cut_set(job):
    set_id, files, meta = job
    try:
        qp = Doc(os.path.join(WORK, "pdf", files["qp"]["file"]))
        ms = Doc(os.path.join(WORK, "pdf", files["ms"]["file"])) if "ms" in files else None
        labels, stops = qp_labels(qp)
        if SUBJECT == "rs":
            schemes, grids, spag = ms_rs(ms) if ms else ({}, {}, None)
        else:
            schemes, grids, spag = (ms_history(ms) if ms else {}), {}, None
        reports, hints = {}, {}
        for er in files.get("er", []):
            said, tested = report(os.path.join(WORK, "pdf", er["file"]), er.get("route"))
            for k, v in said.items():
                reports.setdefault(k, v)
            for k, v in tested.items():
                hints.setdefault(k, v)
        comp = meta["component"]
        parts = []
        for n, (pg, y, q, letter) in enumerate(labels):
            has_parts = any(x[2] == q and x[3] for x in labels)
            if letter is None and has_parts:
                continue
            # (a) starts at its question's number, on the same line or just above
            start = next(((p, yy) for p, yy, qq, ll in labels if qq == q and ll is None), (pg, y)) if letter == "a" else (pg, y)
            later = [(p, yy) for p, yy, *_ in labels[n + 1:]] + [s for s in stops if s > (pg, y)]
            end = min(later) if later else (len(qp) - 1, qp[-1].rect.height)
            end = (end[0], end[1] - 3)  # (a line's words can sit a point above its label)
            stem = None
            if SUBJECT == "history" and letter is None:
                qs = question_start(qp, (pg, y - 4), end)
                if qs:
                    stem, start = segments(qp, (pg, y - 4), qs), qs
            segs = segments(qp, (start[0], start[1] - 4), end)
            img = image_of(qp, segs)
            text = text_of(qp, segs)
            pid = f"{set_id}-{q:02d}-{letter or 'q'}"
            if stem:
                save(image_of(qp, stem), f"{set_id}-{q:02d}-stem.webp")
            key = (q, letter)
            msimg, ms_text = None, ""
            if ms and key in schemes:
                own = schemes[key]
                bands = grids.get(key) or grids.get((None, letter)) or next((v for (gq, gl), v in grids.items() if gl == letter), None)
                extra = [image_of(ms, bands)] if bands else []
                if spag and SPAG.search(text):
                    extra.append(image_of(ms, spag))
                msimg = stack([image_of(ms, own)] + extra, gap=28)
                ms_text = text_of(ms, own, "ms")
                # (History's block opens with its bands: the indicative content says what the question is about)
                ms_text = re.split(r"Indicative content|issues to consider are:?", ms_text, maxsplit=1)[-1].strip()
            parts.append({
                "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": letter or "", "label": f"{q}({letter})" if letter else f"{q}",
                "marks": marks_of(text), "qp": save(img, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"),
                "stem": f"{set_id}-{q:02d}-stem.webp" if stem else None, "stemText": text_of(qp, stem)[:1500] if stem else "",
                "w": img.width if img else 0, "h": img.height if img else 0,
                "text": text[:1500], "msText": ms_text[:800], "er": report_for(reports, comp, q),
                **({"hint": hints[comp][f"{q:02d}"]} if f"{q:02d}" in hints.get(comp, {}) else {}),
            })
        return set_id, parts, None
    except Exception:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], traceback.format_exc(limit=6)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        files = sets.setdefault((f["component"], f["series"]), {})
        if f["kind"] == "er":
            files.setdefault("er", []).append(f)
        else:
            files[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" not in files or (ONLY and not set_id.startswith(ONLY)):
            continue
        jobs.append((set_id, files, {"component": comp, "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"]["title"]}))
    parts_path = os.path.join(WORK, "parts.json")
    all_parts = [p for p in json.load(open(parts_path)) if not p["set"].startswith(ONLY)] if ONLY and os.path.exists(parts_path) else []
    problems = []
    expect = {"rs": lambda c: 16 if c == "c120u10" else 8, "history": lambda c: 7 if c[5] in "5678" else 5}[SUBJECT]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(cut_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            no_er = sum(1 for p in parts if not p["er"])
            stems = sum(1 for p in parts if p["stem"])
            print(f"{set_id}: {len(parts)} parts, {stems} stems, {no_ms} without scheme, {no_er} without report, marks "
                  + " ".join(f"{p['label']}={p['marks']}" for p in parts), file=sys.stderr, flush=True)
            if len(parts) != expect(set_id[:7]) or no_ms or any(p["marks"] is None for p in parts):
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, marks {[p['marks'] for p in parts]}")
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
