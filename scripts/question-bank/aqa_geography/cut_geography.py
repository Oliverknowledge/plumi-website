"""Cut AQA's Geography papers into question parts, each with its figures, its mark scheme and its report.

    python3 scripts/question-bank/aqa_geography/cut_geography.py [work-dir] [--only=70371]   # default scripts/question-bank/.work/aqa-geography

cut.py's label finder and image helpers, with Geography's own layout around them:
  - Each part ("0 1 . 3") is one crop: whatever sets it up above its label (its
    "Figure 2 is in the insert. Figure 2 shows…" lines, or a figure printed in the
    paper), then its label and words down to its marks, and anything set under the
    marks before the answer space (an AS multiple-choice question's options A-D, a
    table to complete). The answer lines ("____", or ruled), "Extra space" and
    "Space for working" end it; section and question headings ("Section B",
    "Question 2 Hot desert systems and landscapes", "Answer either…") are left out.
  - A-Level papers print most figures in a colour insert. A part that names a figure
    the insert has ("Figure 1a and Figure 1b are in the insert") has that figure in
    its crop, between its setup and its label, so the part stands alone wherever the
    bank shows it. A figure runs from its bold caption to the next ("Figure 3b") or the
    page's end, and a page with no caption of its own ("Key for Figure 3a and Figure
    3b") goes on from the figure before; a figure printed sideways is turned upright.
  - A question with a bare label ("0 3", AS Paper 2's fieldwork scenarios) has a
    stem, from that label to its first part, saved once as <set>-03-stem.webp.
  - The schemes are tables: a part's row is labelled in two cells ("01" | "3"), and
    its scheme runs from its row to the next part's, so a 20-mark question's
    "Marking grid for Question 01.4", printed after its notes, comes whole with it.
  - Examiner's reports are keyed by question ("70371-jun24-01"). AQA heads some by
    question ("Question 1", "Question 01.2"), and writes others by question type
    ("6-mark AO3 questions", "Q1.3 … Q5.3"): every paragraph that names a part is
    kept for that part's question, in the report's order.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-geography")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks

MARKS = re.compile(r"\[(\d+) marks?\]")
# Page furniture: never content, and it bounds a page's frame.
FURNITURE = re.compile(r"^(Do not write|outside the|box$|Turn over|Question \d+ continues|\*\d+\*$|\(\d+\)$|(IB/)?[A-Z]{1,2}/[A-Za-z/]*\w{3}\d{2}/|\d{1,2}$|_{1,7}$|There are no questions|DO\s+NOT\s+WRITE|ANSWER\s+IN\s+THE)")
TITLES = r"(Water and carbon cycles|Hot desert systems and landscapes|Coastal systems and landscapes|Glaci(al|ated) (systems and )?landscapes|Hazards|Ecosystems under stress|Global systems and global governance|Changing places|Contemporary urban environments|Population and (the )?environment|Resources?( security)?|Geography fieldwork investigation and geographical skills|Geographical fieldwork skills)"
# Headings, the answer space and the multiple-choice instructions: a part's setup starts after the last of these before it.
BARRIER = re.compile(r"^(Section [A-D]$|Question \d\b|End of (Question|Section)|END\s+OF\s+QUESTIONS|Turn over for|Answer (all|either|one|Question)|Either Question|Or Question|\(If you answer|"
                     + TITLES + r"\s*$|Extra space|Space for working|.*_{8,}|.*(?P<rep>\S)(?P=rep){14,}$|Only one answer per question|For the multiple-choice|CORRECT METHOD|WRONG METHOD|If you want to change|If you wish to return|select as shown|Copyright information)", re.I)


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold)] top to bottom: horizontal lines only."""
    out = []
    for block in (page.get_text("dict", clip=rect) if rect else page.get_text("dict"))["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t and abs(line["dir"][0] - 1) < 0.01:
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, all("Bold" in s["font"] for s in spans)))
    return sorted(out)


def frame(page):
    """A paper page's content: below the page number, above "Turn over" and the footer, inside the answer box's border."""
    w, h = page.rect.width, page.rect.height
    top, bottom, right = 46, h - 46, w - 50
    for y0, x0, y1, t, _ in lines_of(page):
        if y0 > h - 70 and (FURNITURE.match(t) or re.match(r"^\(\d+\)|^\*\d+\*", t)) or t.startswith("Turn over") or re.match(r"Question \d+ continues", t):
            bottom = min(bottom, y0 - 4)
        if t.startswith("Do not write"):
            right = min(right, x0 - 3)
    left = 38
    # The answer box runs most of the page's height; a box round a figure (or its copyright notice) is shorter.
    sides = [d["rect"] for d in page.get_drawings() if d["rect"].width < 3 and d["rect"].height > h * 0.6]
    if any(r.x0 < 60 for r in sides) and any(r.x0 > w / 2 for r in sides):
        left = max(r.x1 for r in sides if r.x0 < 60) + 1
        right = min(right, min(r.x0 for r in sides if r.x0 > w / 2) - 0.5)
        top = max(top, min(r.y0 for r in sides) + 1.5)
        bottom = min(bottom, max(r.y1 for r in sides) - 1.5)
    # Or drawn as one rectangle, from the left margin to the "Do not write" column (a map's border is narrower).
    for r in (d["rect"] for d in page.get_drawings()):
        if r.x0 < 50 and r.x1 > w - 80 and r.height > h * 0.75:
            left, right = max(left, r.x0 + 1.5), min(right, r.x1 - 1.5)
            top, bottom = max(top, r.y0 + 1.5), min(bottom, r.y1 - 1.5)
    return pymupdf.Rect(left, top, right, bottom)


def answer_rules(page):
    """The ruled answer lines' y: three or more long rules, evenly spaced, under one another."""
    rules = sorted({(round(d["rect"].y0), round(d["rect"].x0), round(d["rect"].x1)) for d in page.get_drawings()
                    if d["rect"].height < 2 and d["rect"].width > 300})
    out = set()
    for k in range(len(rules) - 2):
        a, b, c = rules[k:k + 3]
        if a[1:] == b[1:] == c[1:] and 18 <= b[0] - a[0] <= 34 and abs((c[0] - b[0]) - (b[0] - a[0])) <= 2 \
                and not page.get_text("text", clip=pymupdf.Rect(a[1], a[0] + 1, a[2], c[0] - 1)).strip():  # a table's rows have words between them
            out |= {a[0], b[0], c[0]}
    return sorted(out)


def labels_of(page):
    """[(y, '01', '3' or None, x)]: the boxed labels in the left margin. cut.left_labels joins a label's
    boxes by their tops, and some papers set the point's box (14pt) a few points above the digits'
    (11pt), splitting "0 1 . 1" in two; these are joined by their middles instead."""
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             if s["bbox"][0] < 110 and re.fullmatch(r"[\d.\s]+", s["text"]) and s["text"].strip() and "Bold" in s["font"]
             and s["size"] >= 9 and s["bbox"][1] < page.rect.height - 60]
    rows = []
    for s in sorted(spans, key=lambda s: ((s["bbox"][1] + s["bbox"][3]) / 2, s["bbox"][0])):
        mid = (s["bbox"][1] + s["bbox"][3]) / 2
        if rows and abs(rows[-1][0] - mid) < 6:
            rows[-1][1].append(s)
        else:
            rows.append([mid, [s]])
    out = []
    for _, row in rows:
        row.sort(key=lambda s: s["bbox"][0])
        m = cut.QLABEL.match(cut.norm("".join(s["text"] for s in row)))
        if m and row[0]["bbox"][0] < 75:
            out.append((min(s["bbox"][1] for s in row if s["text"].strip() != "."), m.group(1), m.group(2), row[0]["bbox"][0]))
    return out


def skip_page(page):
    return bool(cut.NOT_QUESTIONS.search(page.get_text()))


def has_content(page, rect):
    """Words, a picture or a drawing (other than an answer rule) inside rect."""
    if re.search(r"[A-Za-z]{3,}|\d{2,}", re.sub(r"Extra space|Do not write|outside the|box|_+", "", page.get_text("text", clip=rect))):
        return True
    if any(pymupdf.Rect(page.get_image_bbox(im)).intersects(rect) for im in page.get_images(full=True)):
        return True
    return any(d["rect"].intersects(rect) and not (d["rect"].height < 2 and d["rect"].width > 300) for d in page.get_drawings())


def span(doc, start, end, framer=frame):
    """Pieces from (page, y) down to (page, y), page by page inside the frame; empty pieces dropped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        if skip_page(doc[pg]) and pg not in (start[0], end[0]):
            continue
        f = framer(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        if bottom > top + 6:
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if has_content(doc[pg], r):
                pieces.append((pg, r))
    return pieces


def qp_events(doc):
    """[(page, y0, y1, kind, value, x0)] in reading order: labels, marks, barriers and text lines."""
    events = []
    for pg, page in enumerate(doc):
        if pg == 0 or skip_page(page):
            continue
        f = frame(page)
        labels = labels_of(page)
        label_ys = [y for y, *_ in labels]
        for y, q, part, x in labels:
            events.append((pg, y, y + 10, "label", (q, part), x))
        for y in answer_rules(page):
            events.append((pg, y, y + 1, "barrier", "rule", 0))
        for y0, x0, y1, t, bold in lines_of(page):
            if not (f.y0 - 8 <= y0 <= f.y1 + 2) or FURNITURE.match(t) or any(abs(y0 - ly) < 6 for ly in label_ys) and x0 < 110:
                continue
            if MARKS.search(t):
                events.append((pg, y0, y1, "marks", t, x0))
            elif BARRIER.match(t):
                events.append((pg, y0, y1, "barrier", t, x0))
            else:
                events.append((pg, y0, y1, "text", t, x0))
    events.sort(key=lambda e: (e[0], e[1]))
    # A heading's other half: "Question 4" and "Population and environment" are set as two lines on one baseline.
    heads = {(e[0], round(e[1])) for e in events if e[3] == "barrier" and e[4] != "rule"}
    return [(pg, y0, y1, "barrier", t, x0) if kind == "text" and any((pg, round(y0) + d) in heads for d in (-2, -1, 0, 1, 2)) else (pg, y0, y1, kind, t, x0)
            for pg, y0, y1, kind, t, x0 in events]


def setup_line(e, margin):
    """A sentence at the text margin after a part's marks: the next part's setup, not more of this one
    (a multiple-choice option set on one line with its letter, "A  Ash fallout, liquefaction, tephra", is not)."""
    pg, y0, y1, kind, t, x0 = e
    return kind == "text" and abs(x0 - margin) < 10 and len(t.split()) >= 4 and t[:1].isupper() and not re.match(r"[A-D]\s", t)


def qp_parts(doc):
    """[(q, part, lead pieces, main pieces, lead text, main text)] in reading order; part None for a stem."""
    events = qp_events(doc)
    labels = [n for n, e in enumerate(events) if e[3] == "label"]
    out, lead_start = [], None
    for k, n in enumerate(labels):
        pg, y, _, _, (q, part), _ = events[n]
        nxt = labels[k + 1] if k + 1 < len(labels) else len(events)
        stop = (events[nxt][0], events[nxt][1] - 6) if nxt < len(events) else (len(doc) - 1, doc[-1].rect.height)
        lead = span(doc, lead_start, (pg, y - 6)) if lead_start else []
        lead_start = None
        if part is None and k + 1 < len(labels) and events[nxt][4][0] == q:
            out.append((q, None, [], span(doc, (pg, y - 6), stop), "", ""))  # a stem: to its first part
            continue
        between = events[n + 1:nxt]
        marks = next((i for i, e in enumerate(between) if e[3] == "marks"), None)
        margin = min((e[5] for e in between[:marks] if e[3] == "text" and e[0] == pg and e[5] > 90), default=116) if marks is not None else 116
        gap = between[marks + 1:] if marks is not None else []
        barriers = [i for i, e in enumerate(gap) if e[3] == "barrier"]
        setups = [i for i, e in enumerate(gap) if setup_line(e, margin)]
        ends = [i for i in barriers[:1] + setups[:1]]
        if marks is None:
            end = stop
        elif ends:
            e = gap[min(ends)]
            end = (e[0], e[1] - 4)
        else:
            end = stop
        main = span(doc, (pg, y - 6), end)
        # The next part's setup: after this part's answer space and the headings that follow it (the first run of
        # barriers), else from the first setup sentence. A setup can hold barriers of its own: a figure to complete
        # has its "Space for working".
        if barriers:
            run = barriers[0]
            while run + 1 < len(gap) and gap[run + 1][3] == "barrier":
                run += 1
            after = [e for e in gap[run + 1:] if e[3] in ("text", "marks")]
            lead_start = (after[0][0], after[0][1] - 6) if after else None
        elif setups:
            lead_start = (gap[setups[0]][0], gap[setups[0]][1] - 6)
        text = lambda pieces: "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)  # noqa: E731
        out.append((q, part, lead, main, text(lead), text(main)))
    return out


def ins_frame(page):
    w, h = page.rect.width, page.rect.height
    bottom = h - 40
    for y0, x0, y1, t, _ in lines_of(page):
        if y0 > h - 70 and (t.startswith("Turn over") or re.match(r"^(IB/)?[A-Z]{1,2}/", t) or re.fullmatch(r"\(?\d+\)?", t)):
            bottom = min(bottom, y0 - 4)
    return pymupdf.Rect(28, 42, w - 28, bottom)


CAPTION = re.compile(r"^Figures? (\d{1,2}[a-z]?(?:\s*(?:[–-]|to|and|,)\s*\d{1,2}[a-z]?)*)")


def insert_figures(path):
    """{"3a": [image, ...]} for each figure in the insert, the page with no caption of its own going on from the figure before."""
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    figs, order = {}, []
    for pg, page in enumerate(doc):
        text = page.get_text()
        if pg == 0 or re.search(r"no (resources|sources) printed on this page", text, re.I):
            continue
        f = ins_frame(page)
        caps, turned = [], None
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                t = "".join(s["text"] for s in line["spans"]).strip()
                m = CAPTION.match(t)
                if m and spans and all("Bold" in s["font"] for s in spans):
                    if abs(line["dir"][0] - 1) < 0.01:
                        caps += [(line["bbox"][1], fig) for fig in figure_ids(m.group(1))]
                    else:
                        turned = line["dir"]
                        caps += [(None, fig) for fig in figure_ids(m.group(1))]
        if turned:  # printed sideways: the whole page, turned upright
            img = cut.trim_bottom(cut.render(page, f), 16)
            img = img.rotate(-90 if turned[1] < 0 else 90, expand=True) if img else None
            for _, fig in caps:
                figs.setdefault(fig, []).append(img)
                order.append(fig)
            continue
        caps = sorted(set(caps))
        if caps and caps[0][0] > f.y0 + 30 and order:
            # Above the first caption: more of the figure before ("Key for Figure 3a and Figure 3b").
            figs[order[-1]].append(cut.trim_bottom(cut.render(page, pymupdf.Rect(f.x0, f.y0, f.x1, caps[0][0] - 6)), 16))
        if not caps and order:
            figs[order[-1]].append(cut.trim_bottom(cut.render(page, f), 16))
        for k, (y, fig) in enumerate(caps):
            nxt = [c for c, _ in caps[k + 1:] if c > y + 6]  # "Figures 9a – 9d" is one caption over four
            bottom = nxt[0] - 6 if nxt else f.y1
            figs.setdefault(fig, []).append(cut.trim_bottom(cut.render(page, pymupdf.Rect(f.x0, y - 6, f.x1, bottom)), 16))
            order.append(fig)
    return {k: [i for i in v if i is not None] for k, v in figs.items()}


FIG_REF = re.compile(r"Figures?\s+(\d{1,2}[a-z]?(?:(?:\s*,\s*|\s+and\s+|\s*&\s*|\s+to\s+|\s*[–-]\s*)(?:Figures?\s+)?\d{1,2}[a-z]?)*)")


def figure_ids(refs):
    """"9a – 9d" -> ["9a", "9b", "9c", "9d"]; "3a and 3b" -> ["3a", "3b"]."""
    out = []
    for a, dash, b in re.findall(r"(\d{1,2}[a-z]?)(?=(\s*(?:[–-]|to)\s*(?:Figures?\s+)?(\d{1,2}[a-z]))?)", refs):
        out.append(a)
        if dash and a[-1:].isalpha() and a[:-1] == b[:-1]:  # the letters between
            out += [a[:-1] + chr(c) for c in range(ord(a[-1]) + 1, ord(b[-1]))]
    return out


def named_figures(text, figs):
    """The insert's figures a part names, in order: "Figure 1a and Figure 1b", "Figures 3a, 3b and 3c", "Figures 9a – 9d",
    "Figure 3" for 3a and 3b."""
    out = []
    for m in FIG_REF.finditer(text):
        for ref in figure_ids(m.group(1)):
            hits = [ref] if ref in figs else sorted(k for k in figs if re.fullmatch(rf"{ref}[a-z]", k))
            out += [h for h in hits if h not in out]
    return out


def fit(img, width):
    """A figure no wider than the part's crop."""
    if img is None or img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def ms_frame(page):
    """A scheme page's content: under the running header ("MARK SCHEME – A-LEVEL GEOGRAPHY – …"), above the page number."""
    w, h = page.rect.width, page.rect.height
    lines = lines_of(page)
    head = [y1 for y0, x0, y1, t, b in lines if y0 < 60]
    foot = [y0 for y0, x0, y1, t, b in lines if y0 > h - 60]
    top, bottom = max(head) + 3 if head else 52, min(foot) - 3 if foot else h - 46
    for d in page.get_drawings():
        r = d["rect"]
        if r.height < 3 and r.width > 300 and (r.x1 > w - 5 or r.x0 < 5):  # the header and footer rules, drawn out to one edge of the page
            top = max(top, r.y1 + 2) if r.y0 < 90 else top
            bottom = min(bottom, r.y0 - 2) if r.y0 > h - 90 else bottom
    return pymupdf.Rect(30, top, w - 30, bottom)


def ms_labels(page):
    """[(y, '01', '3')]: a scheme row's question number ("01", x about 60) and part ("3", about 38pt to its right)
    on one baseline. Two schemes set it otherwise: as one run of text ("02 2 Complete Figure 3a…", June 2023 Paper 2),
    and with the question number's digits one above the other (AS Paper 2, November 2020)."""
    h = page.rect.height
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             if s["text"].strip() and 60 < s["bbox"][1] < h - 50]
    digits = lambda x0, x1, y: [t for t in spans if re.fullmatch(r"\d{1,2}", t["text"].strip()) and x0 < t["bbox"][0] < x1 and abs(t["bbox"][1] - y) < 3]  # noqa: E731
    out = []
    for s in spans:
        t, x, y = s["text"].strip(), s["bbox"][0], s["bbox"][1]
        if x >= 80:
            continue
        if re.fullmatch(r"0\d", t):
            part = digits(x + 18, x + 60, y)
            out.append((y, t, part[0]["text"].strip() if part else None))
        elif m := re.match(r"(0\d)\s+(\d{1,2})(\s+\S|\s*$)", t):
            out.append((y, m.group(1), m.group(2)))
        elif t == "0":
            below = [u for u in spans if re.fullmatch(r"\d", u["text"].strip()) and abs(u["bbox"][0] - x) < 2 and 8 < u["bbox"][1] - y < 18]
            part = digits(x + 12, x + 60, y)
            if below and part:
                out.append((y, "0" + below[0]["text"].strip(), part[0]["text"].strip()))
    return sorted(out)


MS_STOP = re.compile(r"^(Section [A-D]$|Question \d\b(?! *\d)|Option [A-Z]\b)")


def row_top(page, y):
    """The top of the table row whose label sits at y: the cell edge just above it, else a little above the text."""
    edges = [d["rect"].y0 for d in page.get_drawings() if d["rect"].x0 < 70 and d["rect"].width > 20 and y - 40 <= d["rect"].y0 <= y + 1]
    return max(edges) - 1 if edges else y - 7


def ms_parts(ms):
    """{('01', '3'): (pieces, text)}: each part's rows, from its row to the next part's row or a section heading."""
    events = []
    for pg, page in enumerate(ms):
        f = ms_frame(page)
        for y, q, part in ms_labels(page):
            if f.y0 - 4 <= y <= f.y1:
                events.append((pg, y, "label", (q, part)))
        for y0, x0, y1, t, bold in lines_of(page, f):
            if bold and MS_STOP.match(t):
                events.append((pg, y0, "stop", t))
    events.sort(key=lambda e: (e[0], e[1]))
    out = {}
    for n, (pg, y, kind, value) in enumerate(events):
        if kind != "label" or value in out:
            continue
        start = row_top(ms[pg], y)
        end = (len(ms) - 1, ms[-1].rect.height)
        for pg2, y2, kind2, value2 in events[n + 1:]:
            if kind2 == "stop":
                end = (pg2, y2 - 4)
                break
            if value2 != value:
                end = (pg2, row_top(ms[pg2], y2) - 1)
                break
        pieces = span(ms, (pg, start), end, ms_frame)
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


# A part named in a report: "Q1.3", "Qn 01.1", "Question 01.2", "Q3.1/4.1", or bare in a list ("in 1.2 and 2.2").
REF = re.compile(r"(?<![\d.£$])0?([1-6])\.([1-9])(?![\d.]*\d)(?!\s*(?:%|per ?cent|million|billion|m\b|km|mm|oC|°))")
# A heading on its own: "Question 1", "Question 1 – Changing Places", "Questions 3 and 4 - Fieldwork investigation optional questions", "Question 01.2".
HEADING = re.compile(r"^(?:Questions?|Q)\s*0?([1-6])(?:\.(\d))?(?:\s*(?:and|&|/)\s*0?([1-6]))?\s*(?:[–:-]\s*[A-Za-z ,&()-]*|\s+[A-Z][A-Za-z ,&()-]*)?$")
# The parts a paragraph opens on: "Q3.1/4.1 –", "Question 01.2, 04.2 and 06.2 were…", "1.1 & 1.2 – The multiple-choice…".
OPENS = re.compile(r"^[•o ]*(?:(?:Questions?|Qn?)\.?\s*)?(0?[1-6]\.\d(?:\s*(?:&|and|,|/)\s*(?:Q\.?\s*)?0?[1-6]\.\d)*)")


def examiner_report(path, labels):
    """{'01': comments}: each paragraph kept for the questions it is about, in the report's order. In a report headed by
    question, a heading ("Question 1", "Questions 3 and 4") or a paragraph that opens on parts ("2.3 – Student
    performance…") says which questions the paragraphs after it are about. A report written by question type ("6-mark
    AO3 questions"), or the general comments before the first heading, keep a paragraph for every question it names."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"^[ \t]*(©|REPORT ON THE EXAMINATION|Report on the examination|Copyright ©)[^\n]*$|^[ \t]*\d+ of \d+[ \t]*$", "", text, flags=re.M)
    text = re.sub(r"[ \t]+\n", "\n", text)
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    qs_of = lambda refs: sorted({f"{int(a):02d}" for a, b in refs if f"{int(a):02d}.{b}" in labels})  # noqa: E731
    headed = any(HEADING.match(p) and len(p) < 100 for p in paras)
    out, current = {}, []
    for para in paras:
        if not para or re.match(r"(AQA Education \(AQA\)|Contents\b|The below table is interactive|Published:|Version:|Further copies|Further support|Mark Ranges|Use of statistics|Enhanced Results|Online Results)", para):
            if para.startswith(("Further support", "Mark Ranges")):
                current = []
            continue
        h = HEADING.match(para)
        if h and len(para) < 100:
            current = sorted({f"{int(g):02d}" for g in (h.group(1), h.group(3)) if g})
            if not h.group(2):
                continue
            para = f"{current[0]}.{h.group(2)}"
        elif len(para) < 70 and not para.endswith(".") and not REF.search(para):
            current = []  # another heading: "Section B", "Summary", "6-mark AO3 questions"
            continue
        opens = OPENS.match(para)
        if headed and opens and qs_of(REF.findall(opens.group(1))):
            current = qs_of(REF.findall(opens.group(1)))
            mine = current
        else:
            mine = current or qs_of(REF.findall(para))
        for q in mine:
            if para not in out.get(q, []):
                out.setdefault(q, []).append(para)
    return {q: "\n\n".join(ps) for q, ps in out.items()}


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    parts_found = qp_parts(qp)
    figs = insert_figures(ins_path)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms) if ms else {}
    labels = {f"{q}.{p}" for q, p, *_ in parts_found if p}
    er = examiner_report(er_path, labels)
    out, problems, stems = [], [], {}
    for q, p, lead, main, lead_text, main_text in parts_found:
        if p is None:
            cut.save(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in main]), f"{set_id}-{q}-stem.webp")
            stems[q] = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in main)
            continue
        pid = f"{set_id}-{q}-{p}"
        lead_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in lead]
        main_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 24) for pg, r in main]
        width = max((i.width for i in lead_imgs + main_imgs if i is not None), default=1000)
        shown = named_figures(lead_text + " " + main_text, figs)
        imgs = [img for fig in shown for img in figs[fig]]
        fig_imgs = [fit(img, width) for k, img in enumerate(imgs) if all(img is not other for other in imgs[:k])]  # a page holding two figures is drawn once
        qimg = cut.stack(lead_imgs + fig_imgs + main_imgs)
        msimg, ms_text = None, ""
        if (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        marks = [int(x) for x in MARKS.findall(main_text)]
        marks = sum(marks) if marks else None
        if marks and marks >= 9 and not re.search(r"Level\s*\d|Marking grid", ms_text):
            problems.append(f"{pid}: no levels in its {marks}-mark scheme")
        if marks == 20 and not re.search(r"Level 4", ms_text):
            problems.append(f"{pid}: 20-mark scheme without its Level 4")
        if re.search(r"in the insert|insert\b", lead_text + main_text, re.I) and not shown:
            problems.append(f"{pid}: names the insert, no figure found")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": f"{q}.{p}", "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{q}-stem.webp" if q in stems else None,
            "figures": shown,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", stems.get(q, "") + " " + lead_text + " " + main_text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
        })
    return out, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), pdf("ins"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] in SERIES and f["component"] in ("70361", "70362", "70371", "70372"):
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {len({p['question'] for p in parts if p['er']})} questions reported, "
                  f"{sum(1 for p in parts if p['figures'])} with insert figures, {sum(p['marks'] or 0 for p in parts)} marks printed", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} parts, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
