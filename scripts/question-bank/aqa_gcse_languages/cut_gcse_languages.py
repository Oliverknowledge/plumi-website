"""Cut AQA's GCSE French, Spanish and Bengali papers into question parts, each with its mark scheme and, for Listening, its recording.

    python3 scripts/question-bank/aqa_gcse_languages/cut_gcse_languages.py [work-dir] [--only=8658rh]   # default scripts/question-bank/.work/aqa-gcse-languages

cut.py, imported unchanged and patched here, as aqa_gcse_cs/cut_gcse_cs.py patches it:
  - Listening and Reading are set as AQA's science papers are: a question's text or recording
    under its boxed label ("0 2"), its parts below ("0 2 . 1"), one scheme table per part
    ("02.1"). cut.py reads them as they are, with two kinds of label it misses: Bengali's
    boxes sit on baselines 4pt apart ("0" at 79, "1 . 1" at 75), and the 2026 specimens set
    the part's box apart from the question's ("0 2 ." then "1", 22pt on). Their schemes
    number a row "9" or "5.1" under a "Qu" heading, unpadded and not bold.
  - Writing schemes are not tables of parts. After the general guidance (Part 1, the same
    every year) each question has its own section (Part 2: "Question 01"), its levels grids
    first, then a table of what each option's bullet points need ("Question 01.1 Content")
    and a model answer for each option (a row headed "Question 01.1" under "The following
    indicative content…"). A part's scheme is its question's section without the other
    options' tables. A part with no section or row of its own (Foundation Question 1's four
    sentences, marked together) takes its question's, flagged `msq`.
  - Listening and Reading crops (tidy): a question's title and instructions printed above its first
    part, or at the top of the next page, go to that question, not the one before (move_titles); a
    page's first question takes what is printed above it (orphans); a run of short questions set on
    one block of options (Hobbies: A Baking … F Watching TV, then 01 to 04) shows the block as each
    one's start (share_leads); and a "[2 marks]" printed beside the next label is masked out of it.
  - A choice of tasks ("Either 01.1 or 01.2", each worth the question's marks) marks every
    option after the first `or`, so a paper's marks count each choice once.
  - The 2026 Listening specimens end with a dictation (Section B), under no label: it is cut
    as the question after the last one, from its heading to the end, its scheme likewise.
  - AQA's copyright-removed copies, all it publishes of nine Reading papers, print "This extract
    cannot be reproduced here…" for a text: that text's questions are left out.
  - Bengali's text layer is a legacy font's glyph order (vowel signs before their consonants,
    no spaces), which reads as nonsense, or, in older papers, Latin letters in a font drawn as
    Bengali (SutonnyMJ: "†Zvgvi" for তোমার), so its Bengali, in either form, is left out of the
    search text, leaving the English questions and instructions.
  - Listening parts carry their recording ("audio"): AQA's tracked recordings number their
    tracks by question (track 007 is question 07, as the transcripts list them), re-encoded
    here at 48 kbps mono to <work-dir>/audio/<component>-<series>-07.mp3; the specimens' dictation
    is a track per sentence, after the last question's, joined into one. Where AQA publishes
    only the whole recording (November 2020), every part carries that ("audioWhole").
"""
import json, os, re, subprocess, sys, traceback
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-languages")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import pymupdf  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
AUDIO = os.path.join(WORK, "audio")
TOTAL = {"L": {"F": 40, "H": 50}, "R": {"F": 60, "H": 60}, "W": {"F": 50, "H": 60}}
TOTAL_NEW = {"L": {"F": 40, "H": 50}, "R": {"F": 50, "H": 50}, "W": {"F": 50, "H": 50}}
REMOVED = re.compile(r"cannot\s+be\s+reproduced|has\s+been\s+removed\s+due|not\s+reproduced\s+here\s+due", re.I)
BENGALI = re.compile(r"[ঀ-৿।॥‌‍]+")  # with the danda, "।", which Unicode keeps with Devanagari
LEGACY = re.compile(r"Sutonny|Arrows", re.I)  # fonts that set Bengali as Latin letters ("†Zvgvi ¯‹zj" for তোমার স্কুল)


def legacy_words(*docs):
    """Words set in a legacy Bengali font in these files, less any also set as real English there."""
    legacy, english = set(), set()
    for doc in docs:
        for page in doc:
            for b in page.get_text("dict")["blocks"]:
                for l in b.get("lines", []):
                    for sp in l["spans"]:
                        (legacy if LEGACY.search(sp["font"]) else english).update(sp["text"].split())
    return {w for w in legacy - english if len(w) > 1 or not w.isalnum()}
HEADING = re.compile(r"^Question\s+0?(\d{1,2})(?:\.(\d{1,2}))?(\s+Content)?$")
_left_labels, _regions, _cut_set = cut.left_labels, cut.regions, cut.cut_set
writing = False  # the paper being cut is a Writing paper


def spans_of(page):
    return [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
            if s["text"].strip() and s["bbox"][1] < page.rect.height - 60]


def join_row(spans, s, gap):
    """A label read from span `s` rightwards: digits, spaces and points, each box at most `gap` after the last."""
    row = sorted((t for t in spans if abs(t["bbox"][1] - s["bbox"][1]) < 6 and t["bbox"][0] >= s["bbox"][0]), key=lambda t: t["bbox"][0])
    label, x1 = "", s["bbox"][0]
    for t in row:
        if not re.fullmatch(r"[\d.\s]+", t["text"]) or t["bbox"][0] - x1 > gap:
            break
        label, x1 = label + t["text"], t["bbox"][2]
    return cut.norm(label)


def left_labels(page, max_x, bold_only, with_x=False):
    found = _left_labels(page, max_x, bold_only, True)
    taken = lambda y: any(abs(y - f[0]) < 6 for f in found)  # noqa: E731
    spans = spans_of(page)
    if bold_only:
        # A question paper's boxes on baselines a few points apart (Bengali), or set further apart (the 2026 specimens).
        for s in spans:
            if s["bbox"][0] < max_x and "Bold" in s["font"] and s["size"] >= 9 and re.fullmatch(r"\d[\d .]*", s["text"].strip()) and not taken(s["bbox"][1]):
                m = re.fullmatch(r"(\d{2})(?:\.(\d{1,2}))?", join_row([t for t in spans if "Bold" in t["font"] or t["text"].strip() == "."], s, 32))
                if m:
                    # at its highest box: Bengali's "1 . 1" sits 4pt above its "0"
                    top = min(t["bbox"][1] for t in spans if abs(t["bbox"][1] - s["bbox"][1]) < 6 and s["bbox"][0] <= t["bbox"][0] < max_x + 40 and re.fullmatch(r"[\d .]+", t["text"]))
                    found.append((top, m.group(1), m.group(2), s["bbox"][0]))
    elif any(s["text"].strip() in ("Question", "Qu") and "Bold" in s["font"] for s in spans):
        # A scheme table's row label cut.py passes over: "10" a little right of the column ("05" at x 77, "9" at 111),
        # alone in its cell, or the specimens' "9" and "5.1", not bold, under a "Qu" heading.
        qu = any(s["text"].strip() == "Qu" and "Bold" in s["font"] for s in spans)
        for s in spans:
            m = re.fullmatch(r"(\d{1,2})(?:\.(\d{1,2}))?", s["text"].strip())
            if m and s["bbox"][0] < 115 and ("Bold" in s["font"] or (qu and s["bbox"][0] < 70)) and not taken(s["bbox"][1]):
                found.append((s["bbox"][1], f"{int(m.group(1)):02d}", m.group(2), s["bbox"][0]))
    found = sorted(found)
    return [f if with_x else f[:3] for f in found]


def page_frame(page):
    """The whole width of a scheme page, between its running header and its page number."""
    w, h = page.rect.width, page.rect.height
    lines = [l["bbox"] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip()]
    head = [y1 for x0, y0, x1, y1 in lines if y0 < 60]
    foot = [y0 for x0, y0, x1, y1 in lines if y0 > h - 60]
    # The rules under the running header and over the page number run in from the page's edge.
    rules = [d["rect"] for d in page.get_drawings() if d["rect"].x0 < 5 and d["rect"].width > w / 2 and d["rect"].height < 2]
    head += [r.y1 for r in rules if r.y0 < 100]
    foot += [r.y0 for r in rules if r.y0 > h - 100]
    return pymupdf.Rect(30, max(head) + 2 if head else 46, w - 30, min(foot) - 2 if foot else h - 50)


def writing_events(ms):
    """[(page, y, kind, q, part)] through a Writing scheme's Part 2: each question's heading, its options' content
    tables and model answers, and the line that introduces the model answers."""
    start = next((n for n, p in enumerate(ms) if re.search(r"Part 2\s*[–-]\s*Marking guidance", p.get_text())), None)
    if start is None:  # the specimens have no Part 1: start at the first question's heading
        start = next((n for n, p in enumerate(ms) for s in spans_of(p) if "Bold" in s["font"] and HEADING.match(s["text"].strip())), len(ms))
    events = []
    for n in range(start, len(ms)):
        page = ms[n]
        f = page_frame(page)
        spans = spans_of(page)
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                t = "".join(s["text"] for s in line["spans"]).strip()
                bold = any("Bold" in s["font"] for s in line["spans"] if s["text"].strip())
                y = line["bbox"][1]
                if not f.y0 - 2 <= y <= f.y1:
                    continue
                if bold and (m := HEADING.match(t)):
                    q = f"{int(m.group(1)):02d}"
                    events.append((n, y - 6, "content" if m.group(2) else "question", q, m.group(2)))
                elif t.startswith("The following indicative content"):
                    events.append((n, y - 6, "intro", None, None))
        # A row labelled "01.1" (or "Question" over "01.1"): an option's model answer, or one of Question 1's sentences.
        for s in spans:
            m = re.fullmatch(r"(\d{2})\.(\d{1,2})", s["text"].strip())
            if m and "Bold" in s["font"] and s["bbox"][0] < page.rect.width * 0.4:
                above = [t for t in spans if t["text"].strip() == "Question" and 0 < s["bbox"][1] - t["bbox"][1] < 20 and abs(t["bbox"][0] - s["bbox"][0]) < 30]
                y = above[0]["bbox"][1] if above else s["bbox"][1]
                events.append((n, cut.row_start(page, y, f.y0) if not above else y - 8, "row", m.group(1), m.group(2)))
    # Where Part 2 opens on Question 1's table with no heading of its own (French Foundation, November 2020), its heading starts it.
    if not any(e[2] == "question" and e[3] == "01" for e in events) and start < len(ms):
        head = [l["bbox"][3] for b in ms[start].get_text("dict")["blocks"] for l in b.get("lines", [])
                if re.match(r"Part 2\s*[–-]", "".join(s["text"] for s in l["spans"]).strip())]
        events.append((start, head[0] + 4 if head else page_frame(ms[start]).y0, "question", "01", None))
    events.sort(key=lambda e: (e[0], e[1]))
    # An "intro" and a bare row take the question of the heading above them.
    out, q = [], None
    for n, y, kind, eq, part in events:
        if kind == "question":
            q = eq
        elif kind == "intro":
            eq = q
        if eq is None:
            continue
        if out and out[-1][0] == n and abs(out[-1][1] - y) < 4 and out[-1][2] in ("content", "row") and kind == "row":
            continue  # a content heading's own label
        out.append((n, y, kind, eq, part))
    return out


def writing_regions(ms):
    """[((q, part), pieces, text)]: each question's whole section (part None), and each option's own."""
    events = writing_events(ms)
    segments = []  # (q, part or None for the question's own, pieces)
    for k, (n, y, kind, q, part) in enumerate(events):
        nxt = events[k + 1] if k + 1 < len(events) else None
        end = (nxt[0], nxt[1]) if nxt else (len(ms) - 1, page_frame(ms[-1]).y1)
        pieces = []
        for pg in range(n, end[0] + 1):
            f = page_frame(ms[pg])
            top = y if pg == n else f.y0
            bottom = end[1] if pg == end[0] else f.y1
            if bottom - top > 10 and ms[pg].get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, bottom)).strip():
                pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        segments.append((q, part if kind in ("content", "row") else None, pieces))
    out = []
    text = lambda pieces: "\n".join(ms[pg].get_text("text", clip=r) for pg, r in pieces)  # noqa: E731
    for q in dict.fromkeys(s[0] for s in segments):
        mine = [s for s in segments if s[0] == q]
        whole = [p for s in mine for p in s[2]]
        out.append(((q, None), whole, text(whole)))
        for part in dict.fromkeys(s[1] for s in mine if s[1]):
            pieces = [p for s in mine if s[1] in (None, part) for p in s[2]]
            out.append(((q, part), pieces, text(pieces)))
    return out


def regions(doc, max_x, bold_only, portrait):
    if writing and not portrait:
        return writing_regions(doc)
    if portrait:
        # cut.move_setups runs in tidy instead, once the titles have moved (move_titles).
        move_setups, cut.move_setups = cut.move_setups, lambda doc, out: None
        try:
            out = _regions(doc, max_x, bold_only, portrait)
        finally:
            cut.move_setups = move_setups
        tidy(doc, out)
    else:
        out = _regions(doc, max_x, bold_only, portrait)
    if dictation_at(doc) and out:
        # The specimens' dictation, under no label: the question after the last one, from Section B's heading on.
        pg, y = dictation_at(doc)
        q = f"{int(max(k[0] for k, _, _ in out)) + 1:02d}"
        last = out[-1]
        last[1] = [(p, r) for p, r in last[1] if p < pg] + [(p, pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, y - 6))) for p, r in last[1] if p == pg and r.y0 < y - 30]
        last[2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in last[1])
        f = (cut.frame if portrait else page_frame)(doc[pg])
        pieces = [(pg, pymupdf.Rect(f.x0, y - 6, f.x1, f.y1))] + [(p, (cut.frame if portrait else page_frame)(doc[p])) for p in range(pg + 1, len(doc))
                                                                  if doc[p].get_text().strip() and not re.search(r"Copyright information|END OF QUESTIONS\s*$", doc[p].get_text()[:400])]
        out.append([(q, None), pieces, "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)])
    return out


def lines_in(page, rect):
    """[(bbox, text)] for each line of text crossing a rect."""
    return [(pymupdf.Rect(l["bbox"]), t) for b in page.get_text("dict", clip=rect)["blocks"] for l in b.get("lines", [])
            if (t := "".join(s["text"] for s in l["spans"]).strip())]


MASKS = {}  # (file, page, crop top): areas of that crop to paint white (render); a crop's top stays put when tidy runs its bottom on
_render = cut.render


def render(page, rect):
    img = _render(page, rect)
    masks = MASKS.get((page.parent.name, page.number, round(rect.y0, 1)))
    if masks:
        from PIL import ImageDraw  # noqa: PLC0415
        draw = ImageDraw.Draw(img)
        for m in masks:
            m = m & rect
            if m.is_empty:
                continue
            draw.rectangle([(m.x0 - rect.x0) * cut.SCALE, (m.y0 - rect.y0) * cut.SCALE, (m.x1 - rect.x0) * cut.SCALE, (m.y1 - rect.y0) * cut.SCALE], fill=(255, 255, 255))
    return img


def tidy(doc, out):
    """What cut.py leaves on a Listening paper, whose parts sit close together (and see orphans, move_titles, LEADS):
      - a part's crop starts 6pt above its label, and a part's "[2 marks]" can print there, beside
        the next label rather than above it, so that no line parts the two: each crop runs on to
        take in all of its own marks and paints over the other's words, and the marks are
        counted once;
      - a question with no parts that is followed by the next question's title and instructions
        ("Family. Your French friend, Flora, is talking about her family.") keeps them, as
        cut.move_setups only moves them on from a part: move them on from such a question too."""
    starts = {e[0]: (e[1][0][0], e[1][0][1].y0) for e in out if e[1]}
    if not writing:
        orphans(doc, out)
    if not writing:  # a Writing paper sets its tasks' "Either" / "or" and instructions at the page's edge on purpose
        move_titles(doc, out)
    parted = {k[0] for k, _, _ in out if k[1]}
    # cut.move_setups moves on from an entry with a part; give the questions with none a stand-in part while it runs.
    keys = [e[0] for e in out]
    for e in out:
        e[0] = (e[0][0], "_") if e[0][1] is None and e[0][0] not in parted else e[0]
    cut.move_setups(doc, out)
    for e, k in zip(out, keys):
        e[0] = k
    # What a question with no parts was given from above its label (its title and instructions, moved on to it): its lead.
    for e in out:
        start = starts.get(e[0])
        if start and e[0][1] is None and e[0][0] not in parted:
            lead = [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, start[1]) if pg == start[0] else r.y1)) for pg, r in e[1] if (pg, r.y0) < (start[0], start[1] - 1)]
            if lead:
                LEADS[(doc.name, e[0][0])] = lead
            own = [(pg, pymupdf.Rect(r.x0, max(r.y0, start[1]), r.x1, r.y1)) for pg, r in e[1] if pg == start[0] and r.y1 > start[1]]
            if has_title(doc, own):
                TITLED.add((doc.name, e[0][0]))
    # Last, so that nothing after it reads the part before's extended crop as its own.
    for n in range(1, len(out)):
        (ppg, pr), (pg, r) = out[n - 1][1][-1] if out[n - 1][1] else (None, None), out[n][1][0] if out[n][1] else (None, None)
        if pg is None or ppg != pg or abs(pr.y1 - r.y0) > 1:
            continue
        lines = lines_in(doc[pg], r)
        # the part before's marks, at the right, crossing into this crop
        theirs = [b for b, t in lines if b.y0 < r.y0 + 4 and b.y1 > r.y0 and b.x0 > r.x0 + 200]
        if not theirs:
            continue
        mine = [b for b, t in lines if b.y0 >= r.y0 + 4]
        end = max(b.y1 for b in theirs) + 1
        prev = pymupdf.Rect(pr.x0, pr.y0, pr.x1, end)
        out[n - 1][1][-1] = (ppg, prev)
        MASKS.setdefault((doc.name, pg, round(prev.y0, 1)), []).append(pymupdf.Rect(r.x0, r.y0 + 3, max((b.x1 for b in mine if b.y0 < end), default=r.x0) + 3, end + 1))
        MASKS.setdefault((doc.name, pg, round(r.y0, 1)), []).extend(pymupdf.Rect(b.x0 - 2, r.y0, b.x1 + 2, b.y1 + 1) for b in theirs)
        out[n][2] = "\n".join(t for b, t in lines if b.y0 >= r.y0 + 4) + "\n" + "\n".join(doc[p].get_text("text", clip=c) for p, c in out[n][1][1:])


LEADS = {}  # (file, question): the title and instructions a question with no parts starts with (tidy)
TITLED = set()  # (file, question): a question with no parts whose own words open with its title
HEADINGS = re.compile(r"^(Section [A-C]|Questions and answers in \w+\.?|Answer all questions.*|Reading comprehension|Listening comprehension|Translation into \w+)$", re.I)


def orphans(doc, out):
    """A page's first label with a question's title and options printed above it, in no question's crop (the first
    question, or one after a page with none): give them to that question."""
    for n, (key, pieces, _) in enumerate(out):
        if not pieces:
            continue
        pg, r = pieces[0]
        covered = any(p == pg and c.y0 < r.y0 - 8 for e in out[:n] for p, c in e[1])
        if covered:
            continue
        f = cut.frame(doc[pg])
        above = pymupdf.Rect(f.x0, f.y0, f.x1, r.y0)
        lines = [(b, t) for b, t in lines_in(doc[pg], above) if b.y1 <= r.y0 + 1]
        words = [(b, t) for b, t in lines if WORDS.search(t) and not HEADINGS.match(t) and not t.startswith("Do not write")]
        if not words:
            continue
        top = min(b.y0 for b, t in words) - 6
        out[n][1] = [(pg, pymupdf.Rect(r.x0, top, r.x1, r.y1))] + pieces[1:]
        out[n][2] = "\n".join(doc[p].get_text("text", clip=c) for p, c in out[n][1])


def has_title(doc, pieces):
    """A question that starts with its own title, a bold line of words at the text margin ("A football match in Tunisia"),
    and goes on to say what to do in a sentence: not a speaker's name over an answer grid ("Bodrul")."""
    text = " ".join(doc[pg].get_text("text", clip=r) for pg, r in pieces)
    if not any(len(re.findall(r"[A-Za-zÀ-ÿ]{2,}", m)) >= 6 for m in re.findall(r"[^.?!]+[.?!]", re.sub(r"\s+", " ", text))):
        return False
    for pg, r in pieces[:1]:
        for b in doc[pg].get_text("dict", clip=r)["blocks"]:
            for l in b.get("lines", []):
                sp = [s for s in l["spans"] if s["text"].strip()]
                t = "".join(s["text"] for s in sp).strip()
                if sp and all("Bold" in s["font"] for s in sp) and len(re.findall(r"[A-Za-zÀ-ÿ\u0980-\u09FF]{2,}", t)) >= 1 \
                        and not MARKS.search(t) and not HEADINGS.match(t) and l["bbox"][0] > r.x0 + 40 and len(t) > 3:
                    return True
    return False


MARKS = re.compile(r"\[\d+ marks?\]")
WORDS = re.compile(r"[A-Za-zÀ-ÿ\u0980-\u09FF]{2,}")


def move_titles(doc, out):
    """A Listening question with parts and no label of its own prints its title and instructions at the margin
    ("Weather forecast", "You are listening to Bangla radio.") above its first part, often at the top of the next
    page: cut.py gives them to the question before. Whatever is printed at the text margin after a part's last
    marks is the next question's (and so is a "Section B" heading, and an instruction set out at the page's edge,
    "Answer both parts of question 13."): moved on, as its start (a stem) when it has
    parts and no start of its own."""
    n = 0
    while n < len(out) - 1:
        key, pieces, _ = out[n]
        lines = [(k, b, t) for k, (pg, r) in enumerate(pieces) for b, t in lines_in(doc[pg], r)]
        marks = [(k, b.y1) for k, b, t in lines if MARKS.search(t)]
        # The text margin: where the part's own words start, or, for a part that is only an answer grid ("1 6 [2 marks]"), anyone's.
        own = ([b.x0 for k, b, t in lines if k == 0 and b.x0 > pieces[0][1].x0 + 30 and WORDS.search(t) and not MARKS.search(t) and b.y1 <= (marks[-1][1] if marks and marks[-1][0] == 0 else 1e9)]
               or [b.x0 for k, b, t in lines if b.x0 > pieces[0][1].x0 + 30 and b.x0 < pieces[0][1].x0 + 120 and WORDS.search(t) and not MARKS.search(t)])
        if not marks or not own:
            n += 1
            continue
        margin, (mk, my) = min(own), marks[-1]
        after = [(k, b) for k, b, t in lines if (k, b.y0) > (mk, my - 2) and WORDS.search(t) and not t.startswith("Turn over")
                 and (abs(b.x0 - margin) < 5 or b.x0 < margin - 30 or re.match(r"Section [A-C]$", t))]
        if not after:
            n += 1
            continue
        k, b = after[0]
        pg, r = pieces[k]
        cut_y = b.y0 - 6
        keep = pieces[:k] + ([(pg, pymupdf.Rect(r.x0, r.y0, r.x1, cut_y))] if cut_y > r.y0 + 8 else [])
        moved = [(pg, pymupdf.Rect(r.x0, cut_y, r.x1, r.y1))] + pieces[k + 1:]
        text = lambda ps: "\n".join(doc[p].get_text("text", clip=c) for p, c in ps)  # noqa: E731
        out[n][1], out[n][2] = keep, text(keep)
        nkey, npieces, _ = out[n + 1]
        if nkey[1] and not any(e[0] == (nkey[0], None) for e in out):
            out.insert(n + 1, [(nkey[0], None), moved, text(moved)])  # the question's start
        else:
            first = npieces[0] if npieces else None
            if first and first[0] == moved[-1][0] and abs(first[1].y0 - moved[-1][1].y1) < 2:
                merged = moved[:-1] + [(first[0], pymupdf.Rect(first[1].x0, moved[-1][1].y0, first[1].x1, first[1].y1))] + npieces[1:]
            else:
                merged = moved + npieces
            out[n + 1][1], out[n + 1][2] = merged, text(merged)
        n += 1


def dictation_at(doc):
    """Where a specimen's dictation starts: (page, y) of its "Section B" heading, with "Dictation" under it."""
    for n, page in enumerate(doc):
        lines = [(l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip()) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
        for y, t in lines:
            if t == "Section B" and any(t2 == "Dictation" and 0 < y2 - y < 40 for y2, t2 in lines):
                return n, y
    return None


def tracks(comp, series):
    """{question: source mp3} from AQA's tracked recording, or {None: whole recording}."""
    d = os.path.join(WORK, "audio-src", f"{comp}-{series}")
    if not os.path.isdir(d):
        return {}
    out = {}
    for name in os.listdir(d):
        if name == "whole.mp3":
            out[None] = os.path.join(d, name)
        elif m := re.search(r"_(\d{3})\.mp3$", name, re.I):
            if int(m.group(1)):
                out[f"{int(m.group(1)):02d}"] = os.path.join(d, name)
    return out


def encode(srcs, name):
    """One MP3 at 48 kbps mono from AQA's track, or tracks joined in order (a dictation's sentences)."""
    os.makedirs(AUDIO, exist_ok=True)
    out = os.path.join(AUDIO, name)
    srcs = [srcs] if isinstance(srcs, str) else srcs
    if not os.path.exists(out):
        inputs = [a for src in srcs for a in ("-i", src)]
        join = ["-filter_complex", f"concat=n={len(srcs)}:v=0:a=1"] if len(srcs) > 1 else []
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, *join, "-ac", "1", "-ar", "22050", "-b:a", "48k", "-map_metadata", "-1", out], check=True)
    return name


# Spanish Foundation Reading, June 2024: AQA's copy (copyright-removed, the only one it publishes) prints page 5,
# question 04, as a picture with no text layer, so no label can be read. Its place on the page, from the page's bands of ink: the question's
# start, then each part (page index, top, bottom, in points), and its words for search.
IMAGE_PAGES = {"8698rf-jun24": {"page": 4, "stem": (60, 422), "parts": [("1", 422, 540), ("2", 540, 650), ("3", 650, 762)],
                                "text": "Jobs. You read a blog with comments from three Spanish people. They are writing about jobs they would like "
                                        "to do and why. For each person, complete the table in English.",
                                "asks": {"1": "What job does Antonio want to do? Why? [1 mark]", "2": "What job does Juan want to do? Why? [1 mark]",
                                         "3": "What job does Sofia want to do? Why? [2 marks]"}}}


def image_page(set_id, qp_path, ms_path, er_path, meta):
    """The parts of a question printed as a picture (IMAGE_PAGES), with their scheme rows."""
    spec = IMAGE_PAGES[set_id]
    qp, ms = pymupdf.open(qp_path), pymupdf.open(ms_path)
    schemes = {k: v for k, v, _ in regions(ms, 110, False, False)}
    f = cut.frame(qp[spec["page"]])
    crop = lambda y0, y1: cut.trim_bottom(cut.render(qp[spec["page"]], pymupdf.Rect(f.x0, y0, f.x1, y1)), 16)  # noqa: E731
    q = "04"
    stem = cut.save(crop(*spec["stem"]), f"{set_id}-{q}-stem.webp")
    out = []
    for part, y0, y1 in spec["parts"]:
        pid = f"{set_id}-{q}-{part}"
        img = crop(y0, y1)
        mpieces = schemes.get((q, part), [])
        ms_text = "\n".join(ms[pg].get_text("text", clip=r) for pg, r in mpieces)
        out.append({"id": pid, "set": set_id, **meta, "question": q, "part": part, "label": f"{q}.{part}",
                    "marks": int(re.search(r"\[(\d+) marks?", spec["asks"][part]).group(1)),
                    "qp": cut.save(img, f"{pid}-qp.webp"), "stem": stem,
                    "ms": cut.save(cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces]), f"{pid}-ms.webp") if mpieces else None,
                    "w": img.width, "h": img.height, "text": spec["text"] + " 0 4 . " + part + " " + spec["asks"][part],
                    "msText": re.sub(r"\s+", " ", ms_text).strip()[:800], "er": cut.examiner_report(er_path).get(q)})
    return out


def share_leads(qp_path, set_id, parts):
    """A run of questions with no parts set on one title, instructions and options (Hobbies: "What hobby does each
    person enjoy?", A Baking … F Watching TV, then 01 to 04, each a box): the first carries them in its crop, and
    each after it shows them as its start (a stem), up to a question with a title of its own or with parts."""
    qp = pymupdf.open(qp_path)
    parted = {p["question"] for p in parts if p["part"]}
    current = None
    for p in parts:
        q = p["question"]
        if q in parted:
            current = None
        elif (qp_path, q) in LEADS:
            current = q
        elif (qp_path, q) in TITLED:
            current = None
        elif current and not p["stem"]:
            pieces = LEADS[(qp_path, current)]
            p["stem"] = cut.save(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in pieces]), f"{set_id}-{q}-stem.webp")
            p["text"] = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in pieces) + "\n" + p["text"]


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    global writing
    comp, series = meta["component"], meta["series"]
    skill, tier = comp[4], comp[5]
    writing = skill == "W"
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    if set_id in IMAGE_PAGES:
        parts = sorted(parts + image_page(set_id, qp_path, ms_path, er_path, meta), key=lambda p: (p["question"], int(p["part"] or 0)))
    problems = []
    # AQA's copyright-removed copies (the only ones it publishes of some Reading papers) blank a text and
    # leave its questions: a question whose text is gone can't be answered, so it is left out.
    gone = {p["question"] for p in parts if REMOVED.search(p["text"])}
    dropped = sum(p["marks"] or 0 for p in parts if p["question"] in gone)
    for p in parts:
        if p["question"] in gone:
            for name in (p["qp"], p["ms"], p["stem"]):
                if name and os.path.exists(os.path.join(IMG, name)):
                    os.remove(os.path.join(IMG, name))
    parts = [p for p in parts if p["question"] not in gone]
    if gone:
        problems.append(f"{set_id}: left out questions {sorted(gone)} ({dropped} marks), their texts removed for copyright")
    if not writing:
        share_leads(qp_path, set_id, parts)
    by_q = {}
    for p in parts:
        by_q.setdefault(p["question"], []).append(p)
    ms = pymupdf.open(ms_path)
    schemes = {}
    for k, v, _ in regions(ms, 110, False, False):
        schemes.setdefault(k, v)
    ms_whole = {k: v for k, v in schemes.items() if k[1] is None} if writing else {}
    for q, group in by_q.items():
        # A choice of tasks: every option after the first is an alternative ("or").
        if writing and len(group) > 1 and len({p["marks"] for p in group}) == 1 and (group[0]["marks"] or 0) >= 10:
            for p in group[1:]:
                p["or"] = True
        for p in group:
            # A question set without parts whose scheme numbers its one row as a part ("01.1", Spanish Foundation Reading, November 2020).
            rows = [k for k in schemes if k[0] == q and k[1]]
            if not p["ms"] and not p["part"] and len(rows) == 1:
                p["ms"] = cut.save(cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in schemes[rows[0]]]), f"{p['id']}-ms.webp")
            if not p["ms"] and (q, None) in ms_whole and p["part"]:
                pieces = ms_whole[(q, None)]
                p["ms"] = cut.save(cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in pieces]), f"{p['id']}-ms.webp")
                p["msq"] = True
    if comp[:4] == "8638":
        junk = legacy_words(pymupdf.open(qp_path), ms)
        for p in parts:
            for k in ("text", "msText"):
                words = BENGALI.sub(" ", p[k]).split()
                p[k] = " ".join(w for w in words if w not in junk and not re.search(r"[†‡¯‹©¨¤ÿÖ›ˆ‰Š¦¬®±´µ¶·¸¹º¼½¾¿×÷`©Ô]", w))
    if skill == "L":
        found = tracks(comp, series)
        if None in found:
            whole = encode(found[None], f"{comp}-{series}.mp3".lower())
            for p in parts:
                p["audioWhole"] = whole
        else:
            # The 2026 specimens' dictation (the last question, cut from its heading) is a track per sentence, after the last question's.
            if dictation_at(pymupdf.open(qp_path)):
                q = parts[-1]["question"]
                sentences = [found.pop(n) for n in sorted(found) if int(n) >= int(q)]
                if sentences:
                    found[q] = sentences
            for p in parts:
                if p["question"] in found:
                    p["audio"] = encode(found[p["question"]], f"{comp}-{series}-{p['question']}.mp3".lower())
                else:
                    problems.append(f"{p['id']}: no track")
            extra = sorted(set(found) - {p["question"] for p in parts})
            if extra:
                problems.append(f"{set_id}: tracks for no question: {extra}")
    total = (TOTAL_NEW if comp[:4] in ("8652", "8692") else TOTAL)[skill][tier] - dropped
    marks = sum(p["marks"] or 0 for p in parts if not p.get("or"))
    if marks != total:
        problems.append(f"{set_id}: {marks} marks, not {total}")
    for p in parts:
        if not p["ms"] and not p.get("key"):
            problems.append(f"{p['id']}: no scheme")
        if p["marks"] is None:
            problems.append(f"{p['id']}: no marks")
        if writing and (p["marks"] or 0) >= 10 and not re.search(r"Level|Marks\s+Response|Response", p["msText"]):
            problems.append(f"{p['id']}: {p['marks']}-mark scheme without its grid")
    return parts, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


cut.left_labels, cut.regions, cut.render = left_labels, regions, render


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", ""), "cr": files["qp"]["cr"]})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and "ms" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} parts, {sum(1 for p in parts if p['ms'])} schemes, {sum(1 for p in parts if p.get('or'))} options, "
                  f"{sum(1 for p in parts if p.get('audio') or p.get('audioWhole'))} with audio, {sum(p['marks'] or 0 for p in parts if not p.get('or'))} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
