"""Scheme crops for the parts that only link the whole mark scheme PDF.

    python3 scripts/question-bank/ms_fallback.py cut [--bank=<slug>] [work-dir]    # crops to <work-dir>/img
    python3 scripts/question-bank/ms_fallback.py apply [--bank=<slug>] [work-dir]  # after upload_r2.py --crops-only

Every board's cutter pairs a part with its scheme rows by reading the scheme's own table, and where it
couldn't (a row it misread, a label set across two lines, a layout one summer used), the part shows
"Mark scheme (PDF)" instead of the scheme opening under it. A student asked why some open and some
don't (30 October 2026): 762 of 68,216 parts, scattered one or two a paper through sets whose other
parts all have their rows.

So this reads each such scheme the plain way, for those parts only: every label down the scheme's
left-hand column, in order ("05.5", "7(b)(i)", "7 b i", "(ii)" with its question carried), from where the
set's own first two labels appear (before that is the front matter's numbered guidance), and crops a
part's rows from its label to the next label that isn't one of its own sub-parts, across pages. Its
crop is `bank/<id>-ms.webp`, the name the part would have had. Where the part's own label doesn't read but
its question's do, the crop is the whole question's rows, if its label shows among them (`msq`: the site
says "Mark scheme for question 6"). A multiple-choice question answered in a key ("19 20 21 …" over
"A C A …", or a "Question | Key" table) takes its letter instead (`k`), as the cutters give one. `apply`
gives each part that now has a crop `ms` (and `msq`) instead of `msf` in
public/question-bank/<slug>/parts.json. A part whose label it can't find keeps its PDF link.

A bank's build script writes parts.json afresh, so after rebuilding a bank run this again for it
(`cut --bank=<slug>`, upload_r2.py --crops-only --checksum, `apply --bank=<slug>`).

Every crop was checked by eye in samples across the boards (30 October 2026): 384 parts' own rows, 58
whole questions, 126 key letters (checked against the printed keys), 194 left as PDFs.
"""
import json, os, re, sys, urllib.request

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
R2 = "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev/"
ARGS = [a for a in sys.argv[2:] if not a.startswith("--")]
BANKS = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--bank=")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, ".work", "ms-fallback")
SCALE = 2.2  # as cut.py
ROMAN = r"(?:i{1,3}|iv|vi{0,3}|ix|x)"


def part_key(label):
    """A part's label as a tuple: "05.5" -> (5, "5"), "07" -> (7,), "7(b)(i)" -> (7, "b", "i")."""
    m = re.match(r"^0?(\d{1,2})\.(\d{1,2})$", label)
    if m:
        return (int(m.group(1)), str(int(m.group(2))))
    m = re.match(r"^0?(\d{1,2})((?:\([a-z]+\))*)$", label)
    if m:
        return (int(m.group(1)),) + tuple(re.findall(r"[a-z]+", m.group(2)))
    return None


def line_key(text, current):
    """A scheme row's label, read from the start of its line; `current` carries the question for "(b)", "(ii)"."""
    t = text.strip()
    m = re.match(r"^0?(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)", t)  # AQA: 05.5, 5.5, 05 . 5
    if m:
        return (int(m.group(1)), str(int(m.group(2))))
    m = re.match(rf"^(?:Q\.?\s*)?0?(\d{{1,2}})(?![\d.])\s*((?:\(?\s*(?:[a-h]|{ROMAN})\s*\)?\s*){{0,3}})(?=\s|$|[A-Z])", t)
    if m and (m.group(2).strip() or len(t) <= 3 or re.match(r"^\d{1,2}\s{2,}", text) or re.match(r"^Q", t)):
        subs = tuple(re.findall(rf"\b(?:[a-h]|{ROMAN})\b", re.sub(r"[()]", " ", m.group(2))))
        return (int(m.group(1)),) + subs
    if m and len(t) <= 3:
        return (int(m.group(1)),)
    m = re.match(rf"^\(([a-h])\)\s*(?:\(({ROMAN})\))?", t)
    if m and current:
        return (current[0], m.group(1)) + ((m.group(2),) if m.group(2) else ())
    m = re.match(rf"^\(({ROMAN})\)", t)
    if m and current and len(current) >= 2:
        return (current[0], current[1], m.group(1))
    m = re.match(rf"^({ROMAN})$", t)  # OCR's own sub-part column: "ii" alone under "5 a i"
    if m and current and len(current) >= 3:
        return (current[0], current[1], m.group(1))
    return None


def frame(page):
    """The page inside its running header and footer (cut.py's ms_frame, without the table search)."""
    w, h = page.rect.width, page.rect.height
    lines = [l["bbox"] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip()]
    head = [y1 for x0, y0, x1, y1 in lines if y0 < 60]
    foot = [y0 for x0, y0, x1, y1 in lines if y0 > h - 60]
    foot += [l["bbox"][1] for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
             if l["bbox"][1] > h * 0.85 and abs((l["bbox"][0] + l["bbox"][2]) / 2 - w / 2) < w * 0.05 and re.fullmatch(r"\d{1,3}", "".join(s["text"] for s in l["spans"]).strip())]  # a page number
    return pymupdf.Rect(24, max(head) + 2 if head else 46, w - 24, min(foot) - 2 if foot else h - 50)


def glyph_top(line):
    """The top of a line's letters. Some schemes' line boxes run well above the text (OCR's are 16pt tall at
    12.8pt spacing), so the box's top would put a row's start inside the row above."""
    return min(s["origin"][1] - 0.8 * s["size"] for s in line["spans"])


def labels(doc):
    """[(page, y, key, x)] down every page's left-hand column, in reading order."""
    out, current = [], None
    for i, page in enumerate(doc):
        if i == 0:
            continue  # the cover
        w, f = page.rect.width, frame(page)
        rows = []
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                text = "".join(s["text"] for s in l["spans"])
                if text.strip() and l["bbox"][0] < w * 0.28 and f.y0 - 2 <= glyph_top(l) <= f.y1:  # not the page number
                    rows.append((glyph_top(l), l["bbox"][0], text))
        rows.sort()
        lines = []  # one baseline's spans, left to right (a superscript can put the answer a hair above its label)
        for row in rows:
            if lines and abs(lines[-1][0][0] - row[0]) < 3:
                lines[-1].append(row)
            else:
                lines.append([row])
        rows = [(ln[0][0], x, text) for ln in lines for _, x, text in sorted(ln, key=lambda r: r[1])]
        # Short spans on one baseline ("7", "b", "i" in three columns) read as one label. A longer one beside
        # the label is the answer cell ("02.1" then "2 protons and 2 neutrons"), not part of the label.
        merged = []
        for y, x, text in rows:
            if merged and abs(merged[-1][0] - y) < 3:
                if len(text.strip()) <= 5 and len(merged[-1][2].strip()) <= 12:
                    merged[-1] = (merged[-1][0], merged[-1][1], merged[-1][2] + " " + text)
            else:
                merged.append((y, x, text))
        for y, x, text in merged:
            key = line_key(text, current)
            # A label cell holds the label alone ("03.5", "2 (e) (ii)"); a line that runs on into words is
            # the front matter's guidance ("3.5 Phonetic spelling") or an answer ("7.3(4) x 10^5 C kg").
            if key and re.search(r"[A-Za-z]{4,}", re.sub(r"^\s*(?:Q\.?\s*)?[\d.\s()a-z]{1,16}", "", text)):
                key = None
            if key:
                if current and not re.match(r"^(?:Q\.?\s*)?\(?\d", text.strip()):
                    x = next((e[3] for e in reversed(out) if e[2] != STOP), x)  # a sub-part in its own column sits under its question's label
                out.append((i, y, key, x))
                current = key
            elif re.match(r"^Questio", text.strip()):
                out.append((i, y, STOP, x))  # a table's header: the rows above it are done
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                text = "".join(s["text"] for s in l["spans"]).strip()
                if re.match(r"^Total\b", text, re.I):
                    out.append((i, glyph_top(l), STOP, -1))  # "Total question 7 = 11 marks", "Total for Question 3"
    out.sort(key=lambda e: (e[0], e[1]))
    return out


STOP = ("stop",)


def in_column(seq, keys):
    """Only the labels in the scheme's own label column. A number at the start of an answer ("7.3(4) x 10^5",
    in the answer column) reads like a label; the set's own labels show where the column is."""
    xs = sorted(e[3] for e in seq if e[2] != STOP and any(e[2][:len(k)] == k for k in keys))
    if not xs:
        return seq
    col = xs[len(xs) // 2]
    return [e for e in seq if e[2] == STOP or abs(e[3] - col) <= 20]


HEADER = re.compile(r"^(Question|Answers?|Marking guidance|Mark scheme|Marks?|Extra information|Comments|AO\s*/?|Spec\.? ?Ref\.?|Guidance|Additional guidance|Indicative content|Acceptable answers?|Notes?)\b", re.I)


def row_top(page, y, floor, x=-1):
    """Where a row starts: the table rule above its label (a label can sit half way down a tall cell, with
    the answer starting above it), no higher than the label before it (`floor`); else the label's own line,
    so none of the row above comes with it."""
    w = page.rect.width
    # A rule can be drawn whole or cell by cell (AQA's are short segments at one height): add up what's at each height.
    span = {}
    for d in page.get_drawings():
        r = d["rect"]
        if r.height < 3 and floor < r.y0 <= y + 1:
            k = span.setdefault(round(r.y0), [0, False])
            k[0] += r.width
            k[1] = k[1] or x < 0 or r.x0 - 2 <= x <= r.x1 + 2
    # ... and runs across the label's own column: a table drawn inside an answer cell has rules of its own.
    rules = [k for k, (v, crosses) in span.items() if v > w * 0.4 and crosses]
    if rules:
        return max(rules) - 0.5
    return max(floor, y - 3)  # unruled: the row starts with its label's line (line boxes overlap, so the text above can't say)


def only_header(page, rect):
    """A continuation page's slice that holds nothing but the repeated table header."""
    words = [l for b in page.get_text("dict", clip=rect)["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip()]
    return all(HEADER.match("".join(s["text"] for s in l["spans"]).strip()) for l in words)


def trim(img, keep=10):
    bg = Image.new("RGB", img.size, (255, 255, 255))
    ink = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 24 else 0)
    box = ink.getbbox()
    if not box:
        return None
    # A table that ends half way down the page leaves a gap and then a lone rule (the page's own frame): drop them.
    rows = [ink.crop((0, y, ink.width, y + 1)).getbbox() is not None for y in range(box[1], box[3])]
    last = len(rows) - 1
    while last > 0 and rows[last]:
        last -= 1
    gap = last
    while gap > 0 and not rows[gap]:
        gap -= 1
    if len(rows) - 1 - last <= 6 and last - gap > 60:
        box = (box[0], box[1], box[2], box[1] + gap + 1)
    # A table carried on down an empty page leaves only its column borders: trim them off the bottom.
    end = box[3]
    while end > box[1] + 20 and sum(ink.crop((0, end - 1, ink.width, end)).histogram()[255:]) <= ink.width * 0.012:
        end -= 1
    if box[3] - end > 30:
        box = (box[0], box[1], box[2], end + 2)
    return img.crop((0, max(0, box[1] - 6), img.width, min(img.height, box[3] + keep)))


def render(page, rect):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=rect, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def grid_key(doc, target, body_page):
    """A multiple-choice answer from a key grid ("19 20 21 …" over "A C A …"): the letter under the number."""
    if len(target) != 1:
        return None
    want = str(target[0])
    def under(words, w):
        mid = (w[0] + w[2]) / 2
        return [x for x in words if 4 < x[1] - w[3] < 40 and re.fullmatch(r"[A-D]", x[4]) and x[0] - 6 < mid < x[2] + 6]
    for page in list(doc)[body_page:]:
        said = re.search(r"multiple[- ]choice", page.get_text(), re.I)
        words = page.get_text("words")
        for w in words:
            if w[4] in (want, want.zfill(2)):
                row = [x for x in words if abs(x[1] - w[1]) < 3 and re.fullmatch(r"\d{1,2}", x[4])]
                nums = sorted(int(x[4]) for x in row)
                if len(row) < 4 or any(not 1 <= b - a <= 2 for a, b in zip(nums, nums[1:])):
                    continue  # a key grid numbers its questions in a run: 5 6 7 8
                # A row of mark totals over a few letters isn't a key: unless the page says it's the multiple
                # choice, the run must be long, unbroken and have a letter under nearly every number.
                if not said and (len(row) < 8 or any(b - a != 1 for a, b in zip(nums, nums[1:]))
                                 or sum(1 for x in row if under(words, x)) < 0.75 * len(row)):
                    continue
                below = under(words, w)
                if below:
                    return min(below, key=lambda x: x[1])[4]
    return None


def list_key(doc, target, body_page):
    """A multiple-choice answer from a key table ("Question | Key | Answer": "7  B  16 cm3"): the letter
    beside the question's number in the left-hand column. Only asked of a multiple-choice part."""
    if len(target) != 1:
        return None
    want = {str(target[0]), str(target[0]).zfill(2)}
    for page in list(doc)[body_page:]:
        words = page.get_text("words")
        for w in words:
            if w[4] in want and w[0] < page.rect.width * 0.28:
                beside = [x for x in words if abs(x[3] - w[3]) < 3 and 0 < x[0] - w[2] < 160 and re.fullmatch(r"[A-D]", x[4])]
                if beside:
                    return min(beside, key=lambda x: x[0])[4]
    return None


def shows(page, rect, label):
    """Whether the label column inside `rect` prints `label` (a (q, sub...) key): "09.2", or "(ii)" / "ii"."""
    w = page.rect.width
    words = [x[4] for x in page.get_text("words", clip=rect) if x[0] < w * 0.35]
    if len(label) == 2 and label[1].isdigit():
        return bool(re.search(rf"(?<![\d.])0?{label[0]}\s*\.\s*{label[1]}(?!\d)", " ".join(words)))
    sub = label[-1]
    return any(re.fullmatch(rf"\(?{sub}\)?", x) or x.endswith(f"({sub})") for x in words)


def crop_part(doc, seq, target, body, whole=False, label=None):
    """The part's rows: from its first label to the next label that isn't its own, up to three pages. `whole`:
    the whole question's rows instead, on past the tables each part starts, to the next question or its total."""
    n = len(target)
    start = next((k for k in range(body, len(seq)) if seq[k][2] != STOP and seq[k][2][:n] == target), None)
    if start is None:
        return None
    if whole:
        end = next((k for k in range(start + 1, len(seq)) if (seq[k][2] == STOP and seq[k][3] < 0)
                    or (seq[k][2] != STOP and seq[k][2][0] > target[0])), None)
    else:
        end = next((k for k in range(start + 1, len(seq)) if seq[k][2] == STOP or (seq[k][2][:n] != target and seq[k][2][0] >= target[0])), None)
    def floor_of(k):  # the label before this one on its page, else the page's top
        before = [e[1] for e in seq[:k] if e[0] == seq[k][0] and e[2] != STOP and e[1] < seq[k][1] - 2]
        return max(before) + 2 if before else 0
    pg0, y0 = seq[start][0], row_top(doc[seq[start][0]], seq[start][1], floor_of(start), seq[start][3])
    pg1, y1 = (seq[end][0], row_top(doc[seq[end][0]], seq[end][1], max(seq[start][1] + 2 if seq[end][0] == pg0 else 0, floor_of(end)), seq[end][3])) \
        if end is not None else (max(e[0] for e in seq), None)  # not on into the back pages
    if whole:
        # No further than the last page that shows one of the question's own labels: a next question whose label
        # didn't read mustn't come with it.
        last = max(e[0] for e in seq[start:end] if e[2] != STOP and e[2][0] == target[0])
        if pg1 > last:
            pg1, y1 = last, None
    if pg1 - pg0 > 2:
        return None  # more than three pages: not a part's rows
    # Two multiple-choice tables side by side ("8 | D" beside "23 | D"): keep the label's own table.
    w0 = doc[pg0].rect.width
    level = [(l["bbox"][0], "".join(s["text"] for s in l["spans"]).strip()) for b in doc[pg0].get_text("dict")["blocks"]
             for l in b.get("lines", []) if abs(glyph_top(l) - seq[start][1]) < 3]
    beside = [x for x, t in level if x > w0 * 0.45 and re.fullmatch(r"\d{1,2}", t)
              and any(x2 > x and re.fullmatch(r"[A-D]", t2) for x2, t2 in level)]
    right = w0 / 2 if beside and pg1 == pg0 and any(x < w0 / 2 and re.fullmatch(r"[A-D]", t) for x, t in level) else None
    if label:
        # A whole question's rows are only worth showing if the part is among them: rows that didn't read
        # can leave just the question's last part ("09.3" for 09.2).
        clips = [(pg, pymupdf.Rect(0, y0 if pg == pg0 else 0, doc[pg].rect.width, y1 if (pg == pg1 and y1 is not None) else doc[pg].rect.height))
                 for pg in range(pg0, pg1 + 1)]
        if not any(shows(doc[pg], r, label) for pg, r in clips):
            return None
    pieces = []
    for pg in range(pg0, pg1 + 1):
        f = frame(doc[pg])
        if right:
            f.x1 = right
        top = max(f.y0, y0) if pg == pg0 else f.y0
        bottom = min(f.y1, y1) if (pg == pg1 and y1 is not None) else f.y1
        if bottom - top > 12 and not (pg > pg0 and only_header(doc[pg], pymupdf.Rect(f.x0, top, f.x1, bottom))):
            img = trim(render(doc[pg], pymupdf.Rect(f.x0, top, f.x1, bottom)))
            if img:
                pieces.append(img)
    if not pieces:
        return None
    w = max(i.width for i in pieces)
    out = Image.new("RGB", (w, sum(i.height for i in pieces) + 12 * (len(pieces) - 1)), (255, 255, 255))
    y = 0
    for i in pieces:
        out.paste(i, (0, y))
        y += i.height + 12
    return out


def fetch(key):
    path = os.path.join(WORK, "pdf", key.replace("/", "__"))
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(R2 + urllib.parse.quote(key), headers={"User-Agent": "Mozilla/5.0"})
        open(path, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    return path


def banks():
    return BANKS or sorted(s for s in os.listdir(PUB) if os.path.exists(os.path.join(PUB, s, "parts.json")))


def cut():
    os.makedirs(os.path.join(WORK, "img"), exist_ok=True)
    report = {}
    for slug in banks():
        parts = json.load(open(os.path.join(PUB, slug, "parts.json")))
        text = json.load(open(os.path.join(PUB, slug, "text.json"))) if os.path.exists(os.path.join(PUB, slug, "text.json")) else {}
        missing = [p for p in parts if p.get("msf") and not p.get("ms") and not p.get("k")]
        if not missing:
            continue
        done, keys_found, whole_q = [], {}, []
        for key in sorted({p["msf"] for p in missing}):
            doc = pymupdf.open(fetch(key))
            seq = labels(doc)
            mine = [p for p in missing if p["msf"] == key]
            setp = [p for p in parts if (p["p"], p["s"]) == (mine[0]["p"], mine[0]["s"])]
            keys = [part_key(p["l"]) for p in setp if part_key(p["l"])]
            seq = in_column(seq, keys)
            # The body starts where the set's first label is followed, within a few rows, by its second: the LAST
            # place that happens, since AQA's front matter numbers its guidance 1.1, 1.2 too ("3.5 Phonetic spelling").
            body = 0
            if len(keys) >= 2:
                first, second = keys[0], next((k for k in keys[1:] if k != keys[0]), None)
                for k in range(len(seq)):
                    if seq[k][2] != STOP and seq[k][2][:len(first)] == first and any(
                            second and s[2] != STOP and s[2][:len(second)] == second for s in seq[k + 1:k + 12]):
                        body = k
            # And never before the first table headed "Question": the guidance in front has none.
            header = next((k for k, e in enumerate(seq) if e[2] == STOP and e[3] >= 0), None)
            if header is not None:
                body = max(body, header)
            mc_from = min((part_key(q["l"])[0] for q in setp if part_key(q["l"]) and text.get(q["id"], "").startswith("[multiple choice]")), default=None)
            for p in mine:
                target = part_key(p["l"])
                # The paper tags only the first question of its multiple-choice section: the 1-mark questions
                # after it, with no parts, are in the section too.
                words = text.get(p["id"], "")
                mc = words.startswith("[multiple choice]") or (len(target or ()) == 1 and p.get("m") in (1, None) and (
                    (mc_from is not None and target[0] >= mc_from) or re.search(r"\[1 mar.*\ba\b.+\bb\b.+\bc\b.+\bd\b", words)))
                first = seq[body][0] if seq else 1
                letter = (grid_key(doc, target, first) or list_key(doc, target, first)) if target and mc else None
                if letter:
                    keys_found[p["id"]] = letter
                    continue
                img = crop_part(doc, seq, target, body) if target else None
                if img is None and target and len(target) > 1:
                    # The part's own row didn't read (or the scheme marks 6(b) as a whole): the whole question's
                    # rows, which hold it; the site says so ("Mark scheme for question 6").
                    img = crop_part(doc, seq, target[:1], body, whole=True, label=target)
                    if img is not None:
                        whole_q.append(p["id"])
                if img is None:
                    continue
                if img.height > 16000:
                    img = img.resize((round(img.width * 16000 / img.height), 16000))
                img.save(os.path.join(WORK, "img", f"{p['id']}-ms.webp"), "WEBP", quality=72, method=4)
                done.append(p["id"])
        report[slug] = {"missing": len(missing), "cut": done, "keys": keys_found, "whole": whole_q}
        print(f"{slug}: {len(done)} cut, {len(keys_found)} multiple-choice answers, of {len(missing)}", file=sys.stderr)
    json.dump(report, open(os.path.join(WORK, "report.json"), "w"), indent=1)
    print(f"total: {sum(len(r['cut']) for r in report.values())} cut, {sum(len(r['keys']) for r in report.values())} answers, of {sum(r['missing'] for r in report.values())}", file=sys.stderr)


def apply():
    report = json.load(open(os.path.join(WORK, "report.json")))
    for slug, r in report.items():
        if BANKS and slug not in BANKS:
            continue
        path = os.path.join(PUB, slug, "parts.json")
        parts = json.load(open(path))
        cut_ids, whole = set(r["cut"]), set(r.get("whole", []))
        n = 0
        for p in parts:
            if p["id"] in cut_ids and not p.get("ms"):
                p["ms"] = 1
                if p["id"] in whole:
                    p["msq"] = 1  # the crop is the whole question's scheme: the site says so
                p.pop("msf", None)
                n += 1
            elif p["id"] in r.get("keys", {}) and not p.get("k"):
                p["k"] = r["keys"][p["id"]]  # answered from the key, as the cutters do
                n += 1
        json.dump(parts, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{slug}: {n} parts now open their scheme in place", file=sys.stderr)


if __name__ == "__main__":
    import urllib.parse  # noqa: F401  (quote, for keys with spaces)
    {"cut": cut, "apply": apply}[sys.argv[1] if len(sys.argv) > 1 else "cut"]()
