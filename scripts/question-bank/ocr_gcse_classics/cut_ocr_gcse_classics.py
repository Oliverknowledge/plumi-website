"""Cut OCR's GCSE Classical Civilisation (J199) papers into question parts, each with its sources, its mark scheme rows and its report.

    python3 scripts/question-bank/ocr_gcse_classics/cut_ocr_gcse_classics.py [work-dir] [--only=j19921-jun24]
    # default work dir: scripts/question-bank/.work/ocr-gcse-classics

ocr_gcse_geography/cut_ocr_gcse_geography.py does the cutting (cut_pearson.py with OCR's GCSE patches): J199's papers
and schemes are set as Geography B's, with a separate Insert for the sources as Geography's Resource Booklet. What
Classical Civilisation adds, patched in here so no other bank's crops move:
  - A group of questions works from the sources its heading names ("Study Source A", "Study Sources D and E"). Each
    source is read from the Insert, from its "Source A: A plan of a Mycenaean city" caption to the next caption or
    the foot of its page (a page with no caption of its own carries on the source before), and a question's stem is
    every source its group's heading and its own words name ("Use Source K and Source L"). A literature source
    prints two translations (Rieu and Kline, say) under one caption: both are kept, as the student chooses one. The
    15-mark essays ("You must use any suitable classical sources you have studied") have none.
  - A section's headings ("Section A", "Culture", "Greece and Rome") and the essay choice ("Answer Question 12 or
    Question 13.") end a group; the section is the part's area, for tagging.
  - A part's crop ends at its marks, not its answer lines ("[15]" stands over pages of them).
  - An 8-mark and a 15-mark question's scheme crop ends with the scheme's levels grid for its kind of question
    ("Guidance on applying the marking grids for the 8-mark detailed response" and its table), wherever the scheme
    prints it: under the row, or once for both essays after the second.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import glob, os, re, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-gcse-classics")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "ocr_gcse_geography"))
import cut_ocr_gcse_geography as geog  # noqa: E402  (patches cut_pearson for OCR's GCSE papers, and Geography B's)
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

CAPTION = re.compile(r"^Source\s+([A-Z])\b(?!\s+(and|is|shows|was)\b)")
# "Study Source A", "Study Sources D and E", "Study Source F and Source G"; "Use Source K and Source L".
NAMED = re.compile(r"\bSources?\s+([A-Z](?:(?:\s*,\s*|\s+and\s+|\s*&\s*)(?:Source\s+)?[A-Z])*)\b(?![’'a-z])")
STUDY = re.compile(r"^(Study|Look at|Read)\s+Sources?\b")
# A group's end: a section's heading, and the essay choice.
# The essay choice: "Answer Question 12 or Question 13." (June 2023 on), "Answer one of the following questions." (before).
CHOICE = re.compile(r"^Answer (either )?(Question \d{1,2} or|one of the following questions)", re.I)
RESET = re.compile(CHOICE.pattern + r"|^(Section|SECTION)\s+[A-C]\b|^EITHER\b|^You (must|should) (use|refer to) any", re.I)
SECTION = re.compile(r"^Section\s+([A-C])\s*$", re.I)
HEADING = re.compile(r"^(SECTION\s+[A-C]|Section\s+[A-C]|Culture|Literature|Greece|Rome|Greece and Rome|Choose one of the following|question paper\.?|translations?)\b", re.I)
GRID = re.compile(r"Guidance on applying the marking grids? for the (\d{1,2})[- ]mark", re.I)
MARKS = re.compile(r"\[\d{1,2}\]$")
DOTS = re.compile(r"[.…\s]+")
AREA = {}  # question number -> "A Culture", the section and its title, for tagging
INSTRUCTIONS = []  # (page, top, bottom) of the instructions over the paper's essay choices


def insert_sources(path):
    """{"A": [image, ...], ...} in the Insert's order, and their titles: each source from its caption to the next caption, or
    to the foot of the page; a page that opens with more than headings carries on the source before it."""
    if not path or not os.path.exists(path):
        return {}, {}
    doc = cp.Doc(path)
    srcs, titles, current = {}, {}, None
    for i in range(1, len(doc)):
        page = doc[i]
        w, h = page.rect.width, page.rect.height
        # (a caption's word can come out split, "So urce C: A drawing of a burial site", November 2021 Homeric World)
        lines = [{**l, "text": re.sub(r"^S ?o ?u ?r ?c ?e\b", "Source", l["text"].strip())} for l in doc.lines(i)]
        text = " ".join(l["text"] for l in lines)
        if "BLANK PAGE" in text and len(text) < 200:
            continue
        bottom = h - 40
        top = 40
        for l in lines:
            t = l["text"].strip()
            # (the footer, and the copyright box under the last source; not a poem's line numbers, "5", "10")
            if l["y0"] > h / 2 and (re.match(r"©|Turn over|J199/\d\d|Oxford Cambridge and RSA|Copyright Information", t) or l["y0"] > h - 80 and re.fullmatch(r"\d{1,2}", t)):
                bottom = min(bottom, l["y0"] - 4)
        # The copyright box under the last source opens with OCR's logo and a rule, which are drawings.
        box = [l["y0"] for l in lines if re.match(r"Oxford Cambridge and RSA|Copyright Information|OCR is committed", l["text"])]
        if box:
            words = [l["y1"] for l in lines if l["y0"] < min(box) and not re.match(r"©|Turn over|J199/\d\d", l["text"])]
            shown = [r.y1 for x in page.get_images() for r in page.get_image_rects(x[0]) if r.y0 < min(box) - 60]
            drawn = [d["rect"].y0 for d in page.get_drawings() if max(words + shown + [0]) - 1 <= d["rect"].y0 < min(box)]
            bottom = min([bottom, min(box) - 4] + [y - 3 for y in drawn])
            if l["y1"] < 80 and (re.match(r"J199/\d\d|©", t) or re.fullmatch(r"\d{1,2}", t)):
                top = max(top, l["y1"] + 2)
        caps = [l for l in lines if CAPTION.match(l["text"].strip()) and l["x0"] < 110 and top - 2 < l["y0"] < bottom]
        above = [l for l in lines if top <= l["y0"] < (caps[0]["y0"] if caps else bottom) and not HEADING.match(l["text"].strip())]
        # (a page that opens with a section's heading over its first caption starts afresh)
        pictures = [r for r in (page.get_image_rects(x[0]) for x in page.get_images()) for r in r if r.y1 > top + 20 and r.y0 < (caps[0]["y0"] if caps else bottom) - 20]
        cuts = [(top, current)] if current and (above or pictures) and (not caps or caps[0]["y0"] - top > 30) else []
        for c in caps:
            src = CAPTION.match(c["text"].strip()).group(1)
            # Its title: the rest of its line ("Source A: A plan of a Mycenaean city"), or the bold line under it.
            rest = re.sub(r"^Source\s+[A-Z]\s*[:.–-]?\s*", "", c["text"].strip())
            nxt = next((l for l in lines if 0 < l["y0"] - c["y0"] < 20 and abs(l["x0"] - c["x0"]) < 4 and cp.bold(l["spans"][0])), None)
            titles.setdefault(src, rest if len(rest) > 3 else nxt["text"].strip() if nxt and not CAPTION.match(nxt["text"]) else "")
            cuts.append((c["y0"] - 4, src))
        # (the next section's heading ends the source above it)
        cuts += [(l["y0"] - 4, None) for l in lines if re.match(r"(SECTION|Section)\s+[A-C]\b", l["text"]) and top <= l["y0"] < bottom]
        cuts.sort(key=lambda c: c[0])
        for n, (y, src) in enumerate(cuts):
            end = cuts[n + 1][0] if n + 1 < len(cuts) else bottom
            if src is None or end < y + 12:
                continue
            # (OCR's "Item removed due to third party copyright restrictions" runs wider than the page's text)
            wide = [l for l in lines if y <= l["y0"] < end]
            x0, x1 = min([30] + [l["x0"] - 4 for l in wide]), max([w - 30] + [l["x1"] + 4 for l in wide])
            img = cp.trim(doc.crop(i, pymupdf.Rect(x0, y, x1, end)), 14)
            if img is not None:
                srcs.setdefault(src, []).append(img)
        current = cuts[-1][1] if cuts else current
    return srcs, titles


def named(text):
    out = []
    for m in NAMED.finditer(text):
        out += [s for s in re.findall(r"\b[A-Z]\b", m.group(1)) if s not in out]
    return out


def groups(qp_path):
    """{question number: [sources its group's heading names]} and each question's section, read down the paper."""
    doc = cp.Doc(qp_path)
    labels, end_page = geog._qp_labels(doc)
    INSTRUCTIONS.clear()
    firsts = {}
    for pg, y, q, letter, roman in labels:
        firsts.setdefault(q, (pg, y))
    events = []
    for i in range(1, end_page + 1):
        f = doc.frame(i)
        for l in doc.lines(i):
            if l["y0"] < f.y0 - 4:
                continue
            t = l["text"].strip()
            if STUDY.match(t):
                events.append(((i, l["y0"]), "study", named(t)))
            elif RESET.match(t):
                events.append(((i, l["y0"]), "reset", t))
                if CHOICE.match(t):
                    # The essays' instructions ("…and make comparisons between Greece and Rome"), down to "EITHER" or the first essay.
                    below = [m for m in doc.lines(i) if m["y0"] >= l["y0"]]
                    stop = next((m["y0"] for m in below if re.match(r"^(EITHER|OR)\s*$|^\d{1,2}\b", m["text"].strip())), None)
                    keep = [m for m in below if stop is None or m["y0"] < stop]
                    INSTRUCTIONS.append((i, l["y0"], max(m["y1"] for m in keep)))
            if SECTION.match(t):
                title = next((m["text"].strip() for m in doc.lines(i) if 0 < m["y0"] - l["y0"] < 30 and m["x0"] < 300), "")
                events.append(((i, l["y0"]), "section", f"{SECTION.match(t).group(1).upper()} {title}".strip()))
    for q, at in firsts.items():
        events.append((at, "q", q))
    events.sort(key=lambda e: (e[0], {"section": 0, "reset": 1, "study": 2, "q": 3}[e[1]]))
    out, current, section = {}, [], None
    AREA.clear()
    essay = {}
    for _, kind, value in events:
        if kind == "study":
            current = value
        elif kind == "reset":
            current = []
            essay = {"at": len(INSTRUCTIONS) - 1} if CHOICE.match(value) else essay
        elif kind == "section":
            section, current = value, []
        else:
            out[f"{value:02d}"] = list(current) if current else essay.get("at", -1)
            AREA[f"{value:02d}"] = section
    return out


def erratum(path):
    """{question: {from, to, image}} from OCR's erratum notice: "Turn to page 4 … look at question 14. In the second line,
    cross out ‘Source D’ and replace with ‘Source E’." The notice's words go over the question's stem, as the crop
    prints the paper's misprint, and the stem shows the source it should have named (June 2022 Women, Question 14)."""
    if not path or not os.path.exists(path):
        return {}
    doc = cp.Doc(path)
    lines = doc.lines(0)
    said = " ".join(l["text"] for l in lines)
    m = re.search(r"question (\d{1,2})\..*?cross out ‘Source ([A-Z])’ and replace with ‘Source ([A-Z])’", said, re.S)
    top = next((l for l in lines if l["text"].startswith("Turn to page")), None)
    end = next((l for l in lines if l["text"].startswith("If you have any queries")), None)
    if not m or not top or not end:
        return {}
    img = cp.trim(doc.crop(0, pymupdf.Rect(30, top["y0"] - 4, doc[0].rect.width - 30, end["y0"] - 4)), 10)
    return {int(m.group(1)): {"from": m.group(2), "to": m.group(3), "image": img}}


def grids(ms_path):
    """{8: image, 15: image}: each levels grid's guidance and table, cropped from its heading to the end of the table's
    last row (across a page break)."""
    if not ms_path or not os.path.exists(ms_path):
        return {}, {}
    doc = cp.Doc(ms_path)
    out, texts = {}, {}
    for i in range(len(doc)):
        for head in doc.lines(i):
            m = GRID.search(head["text"])
            if not m or int(m.group(1)) in out:
                continue
            marks = int(m.group(1))
            pieces, said = [], []
            for j in range(i, min(i + 3, len(doc))):
                f = doc.frame(j)
                lines = [l for l in doc.lines(j) if (j > i or l["y0"] >= head["y0"]) and f.y0 - 2 <= l["y0"] <= f.y1 + 2
                         and not (l["y1"] < 80 and PAGE_HEAD.fullmatch(l["text"].strip()))]
                # The grid ends at its "0  0  No response" row, whatever follows it on the page.
                end = next((l for l in lines if re.search(r"no response", l["text"], re.I)), None)
                body = [l for l in lines if end is None or l["y0"] <= end["y0"] + 2]
                body = [l for l in body if not re.fullmatch(r"\d{1,3}", l["text"].strip()) or l["x0"] < f.x0 + 60]
                if body:
                    # (overleaf, below the page's running header: "J199/11  Mark Scheme  June 2024")
                    header = [l["y1"] for l in doc.lines(j) if l["y1"] < 80 and PAGE_HEAD.fullmatch(l["text"].strip())]
                    y0 = max([head["y0"] - 4 if j == i else f.y0] + [y + (0 if j == i else 1) for y in header])
                    y1 = (end["y1"] if end else max(l["y1"] for l in body)) + 3
                    crop = doc.crop(j, pymupdf.Rect(f.x0, y0, f.x1, y1))
                    if j == i and not head["text"].strip().startswith("Guidance"):
                        # "6t^i)oGuidance on applying…": stray characters set before the heading (June 2023 War and Warfare).
                        at = doc[j].search_for("Guidance on applying")
                        if at:
                            ImageDraw.Draw(crop).rectangle([0, 0, round((at[0].x0 - f.x0) * cp.SCALE) - 1, round((head["y1"] - y0) * cp.SCALE)], fill="white")
                    img = cp.trim(crop, 8, sides=True)
                    if img is not None:
                        pieces.append(img)
                    said += [l["text"] for l in body]
                if end is not None:
                    break
            if pieces:
                out[marks] = cp.stack(pieces)
                texts[marks] = " ".join(said)
    return out, texts


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    if not ms_path or not os.path.exists(ms_path):
        # June 2025's Roman City Life and War and Warfare: OCR's links serve June 2024's schemes, so they have none. Left out.
        for old in glob.glob(os.path.join(cp.IMG, f"{set_id}-*.webp")):
            os.remove(old)
        return []
    for old in glob.glob(os.path.join(cp.IMG, f"{set_id}-*-stem.webp")):
        os.remove(old)  # a stem is saved only if it isn't there yet; the Insert's sources are added to it below
    parts = geog._cut_set(qp_path, ms_path, er_path, set_id, meta)
    heads = groups(qp_path)
    for p in parts:
        p["area"] = AREA.get(p["question"])
        full = next((t for t in geog.ROWS if p["msText"] and t[:800] == p["msText"]), "")
        if len(full) > 800:
            p["msTail"] = full[800:3000]
    srcs, titles = insert_sources(qp_path.replace("-qp-", "-ins-"))
    levels, level_text = grids(ms_path)
    errata = erratum(qp_path.replace("-qp-", "-err-"))
    by_q = {}
    for p in parts:
        by_q.setdefault(p["question"], []).append(p)
    for q, ps in by_q.items():
        said = " ".join(p["text"] for p in ps)
        group = heads.get(q, [])
        if isinstance(group, int):
            # An essay: its instructions as its stem, over each choice.
            if group >= 0:
                pg, top, bottom = INSTRUCTIONS[group]
                qp = cp.Doc(qp_path)
                f = qp.frame(pg)
                img = cp.trim(qp.crop(pg, pymupdf.Rect(f.x0, top - 4, f.x1, bottom + 4)), 10)
                said_too = " ".join(l["text"] for l in qp.lines(pg) if top - 1 <= l["y0"] < bottom)
                if img is not None:
                    stem = f"{set_id}-{q}-stem.webp"
                    cp.save(img, stem)
                    for p in ps:
                        one_part(p)
                        p["stem"] = stem
                        p["text"] = (said_too + " " + p["text"])[:1500]
            continue
        shown = list(dict.fromkeys(s for s in group + named(said) if s in srcs))
        fix = errata.get(int(q))
        if fix:
            shown = list(dict.fromkeys(fix["to"] if s == fix["from"] else s for s in shown))
        if not shown:
            continue
        stem = os.path.join(cp.IMG, f"{set_id}-{q}-stem.webp")
        lead = [Image.open(stem).convert("RGB")] if os.path.exists(stem) else []
        if fix:
            lead.insert(0, fix["image"])
        width = max([Image.open(os.path.join(cp.IMG, p["qp"])).width for p in ps if p["qp"]] + [1000])
        imgs = list({id(im): geog.fit(im, width) for s in shown for im in srcs[s]}.values())
        cp.save(cp.stack(lead + imgs), os.path.basename(stem))
        caption = " ".join(f"Source {s}: {titles.get(s, '')}".strip(": ") + "." for s in shown)
        for p in ps:
            one_part(p)
            p["stem"] = os.path.basename(stem)
            p["sources"] = shown
            p["text"] = (caption + " " + p["text"])[:1500]
    for p in parts:
        grid = levels.get(p["marks"])
        if p["ms"] and grid is not None and "Characteristics of Performance" not in p["msText"] + p.get("msTail", ""):
            img = Image.open(os.path.join(cp.IMG, p["ms"])).convert("RGB")
            cp.save(cp.stack([img, geog.fit(grid, img.width)]), p["ms"])
            p["levelsGrid"] = level_text[p["marks"]][:300]
    return parts


def one_part(p):
    """A one-part question with a stem: "-q", so its stem keeps the question's name (questionBank.ts partImage)."""
    if p["part"] is None and not p["id"].endswith("-q"):
        new = p["id"] + "-q"
        for kind in ("qp", "ms"):
            if p[kind]:
                os.replace(os.path.join(cp.IMG, p[kind]), os.path.join(cp.IMG, f"{new}-{kind}.webp"))
                p[kind] = f"{new}-{kind}.webp"
        p["id"] = new


def qp_labels(doc):
    """Geography B's labels, less the instructions over a question that run on to a second line ("You must use any
    suitable classical sources … and make" / "comparisons between Greece and Rome."): the essays' instructions are
    their stem, not the first essay's crop."""
    labels, end_page = geog.qp_labels(doc)
    first = {(pg, q, letter, roman): y for pg, y, q, letter, roman in geog._qp_labels(doc)[0]}
    out = []
    for pg, y, q, letter, roman in labels:
        own = first.get((pg, q, letter, roman), y)
        if y < own - 2:
            prev, keep = None, []
            for l in sorted((l for l in doc.lines(pg) if l["y0"] < own - 2), key=lambda l: l["y0"]):
                if geog.heading(l) or prev and l["y0"] - prev["y1"] < 6:
                    prev = l
                else:
                    prev = None
                    if l["y0"] >= y - 1:
                        keep.append(l)
            y = min([l["y0"] for l in keep] + [own])
        out.append((pg, y, q, letter, roman))
    return out, end_page


def region(doc, start, end, end_page):
    """Geography B's region, less a piece carried over a page that opens with the next question's instructions ("Answer
    Question 19 or Question 20.", set on the frame's edge, above where cut_pearson looks for cp.STOP), ended at the
    part's marks, and without its long runs of answer lines (a piece either side of them, so "[8]" under a page of
    lines, or overleaf from them, still shows)."""
    pieces = geog.region(doc, start, end, end_page)
    out = []
    for n, (pg, r) in enumerate(pieces):
        # A "[2]" set straight above the next part's label, its line running past the label's top (June 2023 Women, 21(a)),
        # is the part above's.
        for l in doc.lines(pg):
            if MARKS.search(l["text"]):
                if n == 0 and pg == start[0] and r.y0 <= l["y0"] < start[1] - 5 < l["y1"]:
                    r = pymupdf.Rect(r.x0, l["y1"] - 2, r.x1, r.y1)
                elif end and pg == end[0] and r.y1 <= l["y0"] < end[1] - 5 < l["y1"]:
                    r = pymupdf.Rect(r.x0, r.y0, r.x1, l["y1"] - 2)
        first = next((l for l in doc.lines(pg) if cp.inside(l, r)), None)
        if n and first and cp.STOP.match(first["text"]):
            break
        # A part ends at its marks: an essay prints its "[15]" over pages of answer lines.
        # (A "[1]" at the very foot of a page runs past the frame: all of it, not the footer under it.)
        marks = [l["y1"] for l in doc.lines(pg) if r.y0 <= l["y0"] <= r.y1 and r.x0 <= l["x0"] <= r.x1 and MARKS.search(l["text"])]
        if marks:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, max(marks) - 1)
        out += without_answer_lines(doc, pg, r, keep_empty=n == 0)
        if marks:
            break
    return out


def without_answer_lines(doc, pg, r, keep_empty):
    """[(page, rect)], the rect either side of a run of eight or more bare answer lines. Numbered lines ("1 ……", "2 ……") are
    kept: they say how many points to make."""
    lines = sorted((l for l in doc.lines(pg) if cp.inside(l, r)), key=lambda l: l["y0"])
    runs, run = [], []
    for l in lines:
        if DOTS.fullmatch(l["text"]):
            run.append(l)
        else:
            if run:
                runs.append(run)
            run = []
    if run:
        runs.append(run)
    longest = max(runs, key=len, default=[])
    if len(longest) < 8:
        return [(pg, r)]
    rest = [l for l in lines if l not in longest]
    above = [l for l in rest if l["y0"] < longest[0]["y0"]]
    below = [l for l in rest if l["y0"] > longest[-1]["y0"] - 8]
    out = []
    if above or keep_empty:
        out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, longest[0]["y0"] - 1)))
    if below:
        out.append((pg, pymupdf.Rect(r.x0, min(l["y0"] for l in below) - 1, r.x1, r.y1)))
    return out


def has_content(doc, pg, rect):
    """A "[8]" on its own, under a question's words, is worth keeping."""
    return _has_content(doc, pg, rect) or any(cp.inside(l, rect) and MARKS.search(l["text"]) for l in doc.lines(pg))


def lines(self, i):
    """Geography B's lines, and in a scheme: a label printed with a full stop ("3. (a)", "1.", June 2024 Women) read
    without it; and the "Question" header's span stretched left over the question numbers, which some schemes set
    well left of it (June 2024 Roman City Life: "4" at 48pt under a header at 99pt), past where cut_pearson looks."""
    if i in self._lines and getattr(self, "_classics", set()) >= {i}:
        return self._lines[i]
    out = geog_lines(self, i)
    if getattr(self, "scheme", False):
        # "12." beside "Subject Specific Marking Instructions" is the instructions' numbering, not Question 12.
        heads = [l["y0"] for l in out if re.match(r"(\d{1,2}\.\s*)?Subject Specific Marking", l["text"].strip())]
        out = [l for l in out if not (re.fullmatch(r"\d{1,2}\.?", l["text"].strip()) and any(abs(l["y0"] - y) < 4 for y in heads))]
        out = [{**l, "text": DOTTED.sub(r"\1\2", l["text"]), "spans": [{**l["spans"][0], "text": DOTTED.sub(r"\1\2", l["spans"][0]["text"])}] + l["spans"][1:]}
               if l["x0"] < 160 and DOTTED.match(l["text"]) else l for l in out]
        # "(C)" for (c) (June 2023 Myth and Religion, 10(c)).
        out = [{**l, "text": l["text"].lower(), "spans": [{**sp, "text": sp["text"].lower()} for sp in l["spans"]]}
               if l["x0"] < 160 and re.fullmatch(r"\([A-H]\)", l["text"].strip()) else l for l in out]
        # A part's letter set at the start of its question's words in the Answer column, "(a) State two ways in which…"
        # (November 2021 Roman City Life): its own label piece, under the "Question" header.
        # (a page that carries on a table can print no header: the last one's)
        head = next((l for l in out if l["text"].strip() == "Question" and cp.bold(l["spans"][0])), None) or getattr(self, "_head", None)
        self._head = head
        if head:
            split = []
            for l in out:
                m = INLINE.match(l["text"])
                if m and head["x1"] < l["x0"] < 200:
                    x = head["x0"] + 2
                    split.append({**l, "x0": x, "x1": x + 12, "text": f"({m.group(1)})",
                                  "spans": [{**l["spans"][0], "text": f"({m.group(1)})", "font": l["spans"][0]["font"] + ",Bold"}]})
                split.append(l)
            out = split
        nums = [l["x0"] for l in out if l["x0"] < 90 and re.fullmatch(r"\d{1,2}\*?", l["text"].strip()) and cp.bold(l["spans"][0])]
        out = [{**l, "x0": min([l["x0"]] + nums)} if l["text"].strip() == "Question" and cp.bold(l["spans"][0]) and nums and l["x0"] > min(nums) + 30 else l
               for l in out]
    self._lines[i] = out
    self._classics = getattr(self, "_classics", set()) | {i}
    return out


INLINE = re.compile(r"^\(([a-h])\)\s+([‘“]|State|What|How|Why|Give|Name|Identify|Explain|Which|Who|Where|When|Describe|In what|To what|Using|Outline|List)\b")
DOTTED = re.compile(r"^(\s*\d{1,2})\.((\s*\([a-z]{1,4}\))*\s*)$")


def examiner_report(path, section=None):
    """cut_pearson's reader, on the report's text with J199's headings put as it reads them: a question whose parts are
    reported together ("Question 1 (a) and (b)", "Question 5 (a), (b) and (c)", "Question 12(a)(b)(c)") as the whole
    question, "Question 1"; and a heading run into the line before or the sentence after ("Question 14(a)(b)(c)
    Question 15 The vast majority…") on a line of its own."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    parts = r"\s*\(\s*[a-z]{1,4}\s*\)"
    text = re.sub(rf"[ \t]{{2,}}(Question\s+\d{{1,2}})(?=\s)", r"\n\1", text)
    text = re.sub(rf"\n([ \t]*Question\s+\d{{1,2}})(?:{parts}(?:\s*,|\s+and)?)*{parts}\s*(?:,|and){parts}[ \t]*(?=\n)", r"\n\1", text)
    text = re.sub(rf"\n([ \t]*Question\s+\d{{1,2}})(?:{parts}){{2,}}[ \t]*(?=\n)", r"\n\1", text)
    text = re.sub(r"\n[ \t]*(Question\s+\d{1,2}(?:\s*\(\s*[a-z]{1,4}\s*\))*)[ \t]+(?=[A-Z‘“])", r"\n\1\n", text)
    # (a heading with another straight under it: a "." between, or cut_pearson reads the second into the first's comments)
    text = re.sub(r"(\n[ \t]*Question\s+\d{1,2}[ \t]*)\n(?:[ \t]*\n)*(?=[ \t]*Question\s+\d{1,2}[ \t]*\n)", r"\1\n.\n", text)
    real = cp.pymupdf
    cp.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        out = _examiner_report(path, section)
    finally:
        cp.pymupdf = real
    # Headings set one under the other with nothing between ("Question 1 (a) and (b)" then "Question 2", June 2023 Myth
    # and Religion) share the comments under the last, where those name the question ("For Question 1 (a), …").
    heads = [(m.start(), int(m.group(1))) for m in re.finditer(r"\n[ \t]*Question\s+(\d{1,2})[ \t]*(?=\n)", text)]
    for (at, q), (nxt, q2) in zip(heads, heads[1:]):
        between = text[at:nxt].split("\n", 2)[-1] if text[at:nxt].count("\n") > 1 else ""
        key, key2 = f"{q:02d}", f"{q2:02d}"
        if not re.sub(r"[\s.]", "", between) and key not in out and key2 in out and re.search(rf"\bQuestion {q}\b", out[key2]):
            out[key] = out[key2]
    return out


def tables(doc):
    """Geography B's scheme rows, put right where J199's schemes break them:
      - a row ends where its levels grid starts ("Guidance on applying the marking grids…", or the grid's own "Level  Mark
        Characteristics of Performance"): the row reader stops at the block, but carried on over the page into the rest
        of the grid. The grid is added whole, in cut_set, to the parts it marks;
      - no piece that is only the running header, and no next table's empty header under a row;
      - a row carried over a page under a repeated "Section A" row starts below it (June 2024 War and Warfare, 1(c));
      - the end of a row carried over a page, above the next row's label, is the row before's (June 2023 Myth and
        Religion, 16(b)), and a last line the next row's top cuts through too (November 2021 Roman City Life, 16(a))."""
    rows = geog_tables(doc)
    for (q, letter, roman), row in list(rows.items()):
        # "4" over 4(b) and 4(c): the scheme's row for 4(a), printed without its letter (November 2021 Roman City Life).
        if letter is None and (q, "b", None) in rows and (q, "a", None) not in rows:
            rows[(q, "a", None)] = row
    fixed = {}  # a row can stand under two labels: one list of pieces
    for row in rows.values():
        if id(row[0]) not in fixed:
            fixed[id(row[0])] = own_pieces(doc, row[0])
    order = sorted((k for k in rows if fixed[id(rows[k][0])]), key=lambda k: (fixed[id(rows[k][0])][0][0], fixed[id(rows[k][0])][0][1].y0))
    prev = None
    for k in order:
        here = fixed[id(rows[k][0])]
        if prev is None or k[0] >= prev[0][0]:  # (a levels grid's "4", "3", "2" read as labels aren't rows)
            if prev is not None and prev[1] is not here:
                join_rows(doc, prev[1], here, k)
            prev = (k, here)
    out = {}
    for k, (pieces, text, ans) in rows.items():
        kept = fixed[id(pieces)]
        if kept != pieces:
            text = re.sub(r"\s+", " ", " ".join(doc.text(p, r) for p, r in kept))
        out[k] = (kept, text, ans)
    geog.ROWS[:] = [text for _, text, _ in out.values()]
    return out


def own_pieces(doc, pieces):
    kept = []
    for n, (p, r) in enumerate(pieces):
        lines = sorted((l for l in doc.lines(p) if cp.inside(l, r)), key=lambda l: l["y0"])
        grid = [l["y0"] for l in doc.lines(p) if r.y0 - 2 <= l["y0"] < r.y1 + 40 and l["x0"] < 100 and GRID_START.search(l["text"].strip())]
        ended = bool(grid)
        if grid:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, min(min(grid) - 4, r.y1))
            lines = [l for l in lines if l["y1"] <= r.y1 + 2]
        # The next table's header, closing the page with nothing under it.
        head = next((k for k, l in enumerate(lines) if l["text"].strip() == "Question" and l["y0"] > r.y0 + 20 and all(running(o) for o in lines[k:])), None)
        if head is not None:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, lines[head]["y0"] - 3)
            lines = lines[:head]
        if n and lines:
            sec = next((l for l in lines if SECTION.match(l["text"].strip()) and l["y0"] < r.y0 + 60), None)
            if sec:
                body = [l for l in lines if l["y0"] > sec["y0"] + 4 and l["x0"] < 450]
                if not body:
                    lines = []
                else:
                    r = pymupdf.Rect(r.x0, body[0]["y0"] - 4, r.x1, r.y1)
                    lines = [l for l in lines if l["y0"] >= r.y0]
        if any(not running(l) for l in lines) and r.y1 > r.y0 + 6:
            kept.append((p, r))
        if ended:
            break
    return kept


def running(l):
    """The page's running header and the table's header row, or a page number."""
    return bool(RUNNING.fullmatch(l["text"].strip()))


def label_y(doc, pg, r, k):
    q, letter, _ = k
    for l in sorted((l for l in doc.lines(pg) if cp.inside(l, r)), key=lambda l: l["y0"]):
        t = l["text"].strip()
        if l["x0"] < 140 and len(t) <= 14 and (re.match(rf"{q}\b", t) or letter and t == f"({letter})"):
            return l["y0"]
    return None


def join_rows(doc, above, here, k):
    pg, r = here[0]
    y = label_y(doc, pg, r, k)
    if y is None:
        return
    if above[-1][0] < pg:
        carried = [l for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] < y - 4 and not running(l) and l["x0"] > 100]
        if carried and y - r.y0 > 10:
            cut = max(y - 3, max(l["y1"] for l in carried) - 1)
            above.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, cut)))
            here[0] = (pg, pymupdf.Rect(r.x0, cut, r.x1, r.y1))
    elif above[-1][0] == pg:
        p, ra = above[-1]
        cut = [l["y1"] - 2 for l in doc.lines(pg) if l["x0"] > 100 and l["y0"] < ra.y1 < l["y1"] - 1 and l["y1"] - 2 <= y]
        if cut:
            above[-1] = (p, pymupdf.Rect(ra.x0, ra.y0, ra.x1, max(cut)))
            here[0] = (pg, pymupdf.Rect(r.x0, max(r.y0, max(cut)), r.x1, r.y1))


GRID_START = re.compile(r"Guidance on applying the marking grids?|^Level\s+Marks?\b|^Level$")
PAGE_HEAD = re.compile(r"J199/\d\d|Mark Scheme|(January|June|October|November) \d{4}")
RUNNING = re.compile(r"J199/\d\d|Mark Scheme|(January|June|October|November) \d{4}|Question|Answer|Indicative Content|Marks?|\(AO\)|Marks \(AO\)|Guidance|\d{1,3}")
geog_tables, geog_lines = geog.tables, geog.lines
cp.Doc.lines = lines
cp.qp_labels, cp.region = qp_labels, region
_has_content, cp.has_content = cp.has_content, has_content
_examiner_report, cp.examiner_report = cp.examiner_report, examiner_report
geog.cut_ocr_gcse.tables = tables
geog.INSTRUCTION = re.compile(geog.INSTRUCTION.pattern + r"|^(Answer Questions? \d|You (must|should) (use|refer to) any|Use the Insert)", re.I)
# Bold lines over a question's number that are a sentence's end ("two authors." under an essay's "[15]") aren't headings.
geog_headings = geog.headings
geog.headings = lambda doc: {h for h in geog_headings(doc) if h[:1].isupper() and not h.endswith(".")}
geog._STOP = re.compile(geog._STOP.pattern + r"|^(Section [A-C]|Culture|Literature|Greece|Rome|Greece and Rome)\s*$|^Answer (either )?Questions? \d|^(Study|Look at|Read) Sources?\b", re.I)
cp.cut_set = cut_set
# A scheme's row ends where its levels grid's guidance starts: the grid is added above to the parts it marks.
cp.BACK_BLOCK = re.compile(cp.BACK_BLOCK.pattern + r"|^(Guidance on applying the marking grids?)")

if __name__ == "__main__":
    cp.main()
