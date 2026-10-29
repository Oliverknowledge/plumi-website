"""Cut Pearson Edexcel's Politics papers: cut_pearson.py --extracts --figures, with Politics' own changes.

    python3 scripts/question-bank/edexcel_politics/cut_politics.py [work-dir] [--only=9pl001-jun23]

Every Politics question is an essay, "EITHER 1(a) OR 1(b)", ending at its "(30)"; --extracts
stops each crop there (or above the "OR"), and --figures' scheme fixes keep the levels grids'
"0 No rewardable material" row. The patches are at the top level, so cut_pearson's worker
processes (which re-run this file) have them too.
"""
import os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-politics"), "--extracts", "--figures", *[f for f in flags if f not in ("--extracts", "--figures")]]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402



# ---------- mark schemes ----------

# "1(a)", "1 (a)", "1a", "2a.", "Question 3(b)", "Question number 3", or a part's number then its question: "1a   Using the source…"
MS_LABEL = re.compile(r"^(?:Question\s+)?(?:number\s+)?(\d{1,2})\s*(?:\(?\s*([a-c])\s*\)|([a-c])(?![a-z]))?\s*[.:]?(?:\s+(.*))?$")
GUIDE = re.compile(r"^Guidelines for\b(.*)$", re.I)
INTRO = re.compile(r"General Marking Guidance|How to award marks|Edexcel and BTEC Qualifications|Mark Scheme \(Results\)", re.I)


# Where a scheme prints a part's indicative content with no label of its own: (page index, top).
# AS Paper 2, June 2022, labels 4(b)'s table "4a" (its header row is on page 21).
MS_HAND = {"8pl002-jun22": {(4, "b"): (20, 160)}}


def ms_box(doc, i):
    page = doc[i]
    return pymupdf.Rect(15, 25, page.rect.width - 15, page.rect.height - 30)


def ms_anchors(doc, expected):
    """The scheme's landmarks in reading order: ("g", None) for each "Guidelines for marking…" block (its
    assessment objectives and, in most years, its levels grid) and ("p", (q, letter)) where each part's own
    indicative content begins. `expected`: the paper's parts in order, [(1, "a"), (1, "b"), (2, None)…]: a
    label counts only as the next part expected (or the one after, where a scheme leaves a label out), which
    keeps a levels grid's "2 | 7–12" from reading as Question 2."""
    out, ptr = [], 0
    for i in range(len(doc)):
        if INTRO.search(doc.text(i)) and not GUIDE.search(doc.text(i), re.M):
            continue
        lines = doc.lines(i)
        w = doc[i].rect.width
        for k, l in enumerate(lines):
            t = l["text"]
            g = GUIDE.match(t)
            if g:
                named = re.findall(r"(\d{1,2})\s*\(?([a-c])?\)?", g.group(1) + " " + (lines[k + 1]["text"] if k + 1 < len(lines) and len(lines[k + 1]["text"]) < 12 else ""))
                out.append((i, l["y0"], "g", [(int(q), x or None) for q, x in named]))
                continue
            m = MS_LABEL.match(t)
            if not m or l["x0"] > w * 0.3 or ptr >= len(expected):
                continue
            key = (int(m.group(1)), m.group(2) or m.group(3))
            rest = m.group(4) or ""
            for step in range(4):  # a lettered label may follow parts whose labels the scheme left out
                if ptr + step >= len(expected) or key != expected[ptr + step] or (step and not key[1]):
                    continue
                if not key[1]:
                    # A bare number is a part only under a "Question number" header or followed by its question.
                    above = [o["text"] for o in lines[max(0, k - 3):k] if l["y0"] - o["y0"] < 60]
                    if not (re.match(r"[A-Z‘'“]", rest) and not re.match(r"Level", rest) or any(re.search(r"\bnumber\b|^Question$", a) for a in above) or "number" in t):
                        continue
                    if k + 1 < len(lines) and re.match(r"^\d{1,2}\s*[–-]", lines[k + 1]["text"]):
                        continue  # a levels grid's row: "2" then "7–12"
                top = l["y0"]
                for o in reversed(lines[:k]):  # the table's header, "Question number | Indicative content", and a question set above its label
                    if 0 < l["y0"] - o["y0"] < 70 and re.match(r"Question|number|Indicative content", o["text"]):
                        top = min(top, o["y0"])
                out.append((i, top - 2, "p", key))
                ptr += step + 1
                break
    return out


def ms_segments(doc, expected):
    """{(q, letter, None): ([(page, rect)], text, None)} in ms_tables' shape: each part's own indicative content
    to the next landmark, after its "Guidelines for marking…" block (the levels grid), wherever the scheme puts it."""
    anchors = ms_anchors(doc, expected)
    for key, (pg, y) in MS_HAND.get(SET, {}).items():
        anchors = [a for a in anchors if a[3] != key] + [(pg, y, "p", key)]
    anchors.sort(key=lambda a: (a[0], a[1]))
    found = {a[3] for a in anchors if a[2] == "p"}
    # A part with no label of its own: its "Guidelines for Question 1(a)" block is its scheme (3A, November 2021).
    anchors = [(pg, y, "p", named[0]) if kind == "g" and len(named) == 1 and named[0] in expected and named[0] not in found else (pg, y, kind, named)
               for pg, y, kind, named in anchors]

    def segment(n):
        pg, y = anchors[n][:2]
        end = anchors[n + 1][:2] if n + 1 < len(anchors) else (len(doc) - 1, None)
        pieces = []
        for i in range(pg, end[0] + 1):
            box = ms_box(doc, i)
            top = max(box.y0, y) if i == pg else box.y0
            bottom = min(box.y1, end[1]) if i == end[0] and end[1] is not None else box.y1
            if bottom > top + 8 and cp.has_content(doc, i, pymupdf.Rect(box.x0, top, box.x1, bottom)):
                pieces.append((i, pymupdf.Rect(box.x0, top, box.x1, bottom)))
        return pieces

    out, guide = {}, None
    for n, (pg, y, kind, key) in enumerate(anchors):
        if kind == "g":
            guide = segment(n)
            continue
        if key in [k[:2] for k in out]:
            continue
        pieces = segment(n)
        own = " ".join(doc.text(p, r) for p, r in pieces)
        out[(key[0], key[1], None)] = ((guide or []) + pieces, own, None)
    return out


# ---------- question papers ----------

# Older papers print the question's number again before its alternative, "1 (b) This source…", "3 (b) To what
# extent…": read as "(b)", the next part, not as a question 1 or 3 that has come round again.
AGAIN = re.compile(r"^(\d{1,2})\s*(\([b-n]\).*)$")
_qp_labels = cp.qp_labels


def qp_labels(doc):
    lines = doc.lines

    def relabelled(i):
        out = []
        for l in lines(i):
            m = AGAIN.match(l["text"])
            if m and l["spans"][0]["text"].strip() == m.group(1):
                l = {**l, "text": m.group(2), "spans": l["spans"][1:]}
            out.append(l)
        return out
    doc.lines = relabelled
    try:
        return _qp_labels(doc)
    finally:
        del doc.lines


cp.qp_labels = qp_labels

# From June 2023 the sources are in a Source Booklet bound in after the paper: "Source 1(a)", "Source 1(b)" (A-Level
# Papers 1 and 2), "Source 1", "Source 2", "Source 3" (AS). A question that says "Look at Source 1(a)…" or "Read
# Sources 2 and 3…" carries them in its stem: both of an "EITHER 1(a) OR 1(b)"'s sources, since the bank shows
# a question's stem once above its parts. Before 2023 each source is printed in its part, so its crop has it.
SOURCE = re.compile(r"^Sources? (\d)\s*(?:\(?([ab])\)?)?$")
SAYS = re.compile(r"(?:Look at|Read) Sources? (\d)\s*(?:\(([ab])\))?(?:\s*and\s*(\d))?")
FURNITURE = re.compile(r"^(\d{1,2}|P\d{5}[A-Z]{0,2}\d*|Turn over|BLANK PAGE)$")


def booklet_sources(qp, end_page):
    """{"1a": [(page, rect)], "2": …}: each source, from its heading to the next or the booklet's end."""
    heads = [(i, l["y0"], m.group(1) + (m.group(2) or "")) for i in range(end_page + 1, len(qp))
             for l in qp.lines(i) if (m := SOURCE.match(l["text"]))]
    out = {}
    for n, (pg, y, sid) in enumerate(heads):
        stop = heads[n + 1][:2] if n + 1 < len(heads) else (len(qp) - 1, None)
        pieces = []
        for i in range(pg, stop[0] + 1):
            f = qp.frame(i)  # inside the booklet page's border, so its rule, page number and code stay out
            body = [l for l in qp.lines(i) if cp.inside(l, f) and not FURNITURE.match(l["text"]) and not re.search(r"©|Pearson Education", l["text"])]
            top = y - 4 if i == pg else f.y0
            end = stop[1] if i == stop[0] and stop[1] is not None else f.y1
            body = [l for l in body if top - 2 <= l["y0"] < end - 2]
            if not body or qp.blank(i):
                continue
            bottom = min(end - 6, max(l["y1"] for l in body) + 6)
            if bottom > top + 10:
                pieces.append((i, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        out[sid] = pieces
    return out


_cut_set = cp.cut_set
SET, EXPECTED = None, []


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    global SET, EXPECTED
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    keys = [(q, letter) for _, _, q, letter, _ in labels]
    SET, EXPECTED = set_id, [k for k in keys if k[1] or not any(o[0] == k[0] and o[1] for o in keys)]
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    booklet = booklet_sources(qp, end_page)
    if not booklet:
        return parts
    starts = sorted((pg, y, q) for pg, y, q, *_ in labels)
    uses = {}
    for i in range(1, end_page + 1):
        for l in qp.lines(i):
            for m in SAYS.finditer(l["text"]):
                q = next((q for pg, y, q in starts if (pg, y) > (i, l["y0"])), None)
                for sid in (m.group(1) + (m.group(2) or ""), m.group(3)):
                    if q and sid and sid in booklet and sid not in uses.setdefault(q, []):
                        uses[q].append(sid)
    for p in parts:
        q = int(p["question"])
        if q not in uses:
            continue
        uses[q].sort()
        pieces = [x for sid in uses[q] for x in booklet[sid]]
        if not p["part"]:  # a whole question: its stem is named for the question, so the part takes "-q" (as Geography's)
            old, p["id"] = p["id"], p["id"] + "-q"
            for kind in ("qp", "ms"):
                if p[kind]:
                    os.replace(os.path.join(cp.IMG, p[kind]), os.path.join(cp.IMG, f"{p['id']}-{kind}.webp"))
                    p[kind] = f"{p['id']}-{kind}.webp"
        p["stem"] = f"{p['set']}-{q:02d}-stem.webp"
        cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in pieces]), p["stem"])
        p["text"] = (p["text"] + " " + " ".join(qp.text(pg, r) for pg, r in pieces))[:3000]
        p["sources"] = uses[q]
    return parts


cp.cut_set = cut_set
cp.ms_tables = lambda doc: ms_segments(doc, EXPECTED)

# ---------- examiner's reports ----------

# Politics' reports head a question "Q1a Using the source…", "1b Using the source…", "Question 1b Describe…" or
# "Question 2 (a) Evaluate…", its words on the heading's line: put the heading on a line of its own, as
# examiner_report reads it. Two (A-Level Paper 1 and Paper 3B, June 2024) set their text in fonts with no
# character map, so it comes out as symbols: those are read by OCR (cut_pearson's ocr_lines), with the
# candidates' scripts (pictures) whited out first, and a blank line
# wherever the gap between lines says a paragraph ends.
HEADING = re.compile(r"(?m)^[ \t]*(?:Q(?:uestion)?[ \t]*)?(\d{1,2})[ \t]*(?:\(?([a-c])\)?)?[ \t]*[:.–-]?[ \t]+(?=[A-Z‘'])")


def heading(m):
    if not m.group(2) and not m.group(0).lstrip().startswith("Q"):
        return m.group(0)  # a bare number opening a line is a list or a page number, not a question
    return f"Question {m.group(1)}" + (f" ({m.group(2)})" if m.group(2) else "") + "\n"


def report_pages(path):
    doc = pymupdf.open(path)
    texts = [page.get_text() for page in doc]
    seen = "".join(texts)
    if seen.strip() and len(re.findall(r"[A-Za-z]", seen)) < 0.5 * len(re.sub(r"\s", "", seen)):
        # The candidates' scripts are pictures: whited out first, so only the examiners' own words are read.
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
    return [HEADING.sub(heading, t) for t in texts]


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
