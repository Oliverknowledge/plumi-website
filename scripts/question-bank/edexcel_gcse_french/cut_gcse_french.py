"""Cut Pearson Edexcel's GCSE French papers into question parts, each with its mark scheme and, for Listening, its recording.

    python3 scripts/question-bank/edexcel_gcse_french/cut_gcse_french.py [work-dir] [--only=1fr01f-jun24]

Built on edexcel_sciences/cut_pearson.py's reading of a Pearson page (Doc, its frame, its scheme tables), imported unchanged. What
languages papers do differently, so cut here:
  - A question's title is printed over its number ("Occupations", centred, then "1 What do these three young people want to be?"),
    and Foundation Writing's photo above that: everything between the last question's "(Total for Question …)" (or a section's
    heading) and a question's number is that question's.
  - Parts can be "(a)", "(b)", or bare "(i)", "(ii)" under no letter (Listening question 2's multiple choices), or "(a)" with "(i)" under it.
  - A passage, a word box or a gap-fill's instructions come before the first part, often over a page: that is the question's start
    (stem), which every part shows, and which is why nothing a part needs is left in the part before.
  - Answer lines: a part keeps two at most, and a writing task (10 marks or more) none, so a task's pages of lines aren't shown.
    Foundation Writing's photo question numbers its answer lines "(a)" to "(d)": those aren't parts, the question is one.
  - A choice of tasks ("Choose either Question 1(a) or Question 1(b)"): each option starts at its own title, and every option after
    the first is marked `or`, so a paper's marks count the choice once.
  - Writing schemes are not tables: each question has a section ("Question 2 – Higher tier (28 marks)") of grids, which every part of
    the question shows, flagged `msq`.
  - Higher Listening's long questions come in halves, "Part (a)" and "Part (b)", each with its own "(i)", "(ii)".
  - What is printed between one part's marks and the next label is the next part's: "Answer the following questions in English.", "The diary continues." and its text.
  - Listening schemes end with Pearson's transcript (fetch_gcse_french.py splits it out), and a row stops there, or at the next section's heading.
  - Multiple choices print no marks beside a part: they come from the scheme's row, then the question's total.
  - Reports head a question "QUESTION 1", "Question 1 (a)", "Question 2a" or open a paragraph with "Q3 was…" (reports()), and one
    has an unreadable text layer, read by OCR instead.
  - Listening parts carry their recording: Pearson's tracked zips (June 2022 on) number tracks by question (track 0 is the
    introduction); elsewhere split_audio_french.py found each question's start in the whole recording (audio_splits.json). Re-encoded at
    48 kbps mono to <work-dir>/audio-out/<component>-<series>-<question>.mp3 (R2: edexcel/audio/).
"""
import json, os, re, subprocess, sys, traceback
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-french")] + flags
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402

WORK, IMG, ONLY = cp.WORK, cp.IMG, cp.ONLY
cp.HEAD = re.compile(r"Question( [Nn]umber| Key)?|Q|No\.( AO)?")  # some schemes print "Question number" as one line
AUDIO = os.path.join(WORK, "audio-out")
SPLITS = os.path.join(HERE, "audio_splits.json")
TOTAL_Q = re.compile(r"\(Total for Question (\d+) = (\d+) marks?\)")
PAPER_TOTAL = re.compile(r"TOTAL FOR PAPER\s*=\s*(\d+)\s*MARKS", re.I)
DOTS = re.compile(r"^[.…_\s]+$")
# What is printed above a question but isn't part of it.
HEADING = re.compile(r"^(SECTION\s+[A-C]\b.*|[A-C]$|Answer ALL questions.*|Some questions must be answered.*|answer, put a line.*|and then mark your new.*|"
                     r"(Choose|Answer) either.*|If you answer.*|Listening Comprehension$|Reading comprehension$|Reading and Understanding.*|Dictation$)", re.I)
MARK = re.compile(r"^\(\d{1,2}\)$")
ROUTING = re.compile(r"^((Choose|Answer) either|If you answer)", re.I)
STOP = re.compile(r"^(TOTAL FOR (SECTION|PAPER)|SECTION [A-C]\b|BLANK PAGE|END\s*$|END OF QUESTION PAPER)")  # cut_pearson's, but in capitals only: "end" is a word in a word box
GREETING = re.compile(r"^(Monsieur|Madame|Cher|Chère|Salut|Bonjour|Cordialement|Merci|À bientôt)\b", re.I)
ROMANS, LETTERS = cp.ROMANS, cp.LETTERS
WANTED_TITLE = re.compile(r"[A-Za-zÀ-ÿ]{3,}")


INSTRUCTION = re.compile(r"^(Answer the following|Answer the question|Put a cross|Complete the|Read |Enter either|Réponds|Mets une croix|Complète)")


def gap_top(page, above, below):
    """Where to start between the last line above and the first line below: mid-way through the widest clear space, so a table's closing rule stays with the table and a box's top with the box."""
    edges = sorted({above, below} | {y for d in cp.drawings(page) if d["rect"].width > 50 for y in (d["rect"].y0, d["rect"].y1) if above < y < below})
    a, b = max(zip(edges, edges[1:]), key=lambda e: e[1] - e[0])
    return (a + b) / 2


def dots(l):
    return bool(DOTS.match(l["text"]))


def labels(doc):
    """[(page, y, q, letter, roman)] in reading order, and the page the paper ends on. The next label expected only, as cut_pearson's."""
    out, q, letter, roman = [], 0, None, None
    end = len(doc) - 1
    for i in range(1, len(doc)):
        if doc.blank(i):
            continue
        f = doc.frame(i)
        for l in doc.lines(i):
            if l["y0"] > f.y1 or l["y0"] < f.y0 - 4:
                continue
            if PAPER_TOTAL.match(l["text"]):
                return out, i
            rest = l["text"]
            first = l["spans"][0]
            # Higher Listening's two halves of a question, each with its own "(i)", "(ii)": "Part (a)", "Part (b) Amélie".
            part = re.match(r"^Part \(([a-e])\)", rest)
            if part and q and part.group(1) == ("a" if not letter else LETTERS[LETTERS.index(letter) + 1]):
                letter, roman = part.group(1), None
                out.append((i, l["y0"], q, letter, None))
                continue
            m = re.match(r"^(\d{1,2})\b\s*(.*)$", rest)
            if m and cp.bold(first) and l["x0"] < f.x0 + 16 and int(m.group(1)) == q + 1 and not DOTS.match(m.group(2) or "x"):
                q, letter, roman = q + 1, None, None
                out.append((i, l["y0"], q, None, None))
                rest = m.group(2)
            elif q == 0 or l["x0"] > f.x0 + 72:
                continue
            elif m and int(m.group(1)) == q and cp.LEAD.match(m.group(2)):
                rest = m.group(2)  # a task's option prints the question's number again: "1 (b)"
            for n in range(2):
                m = cp.LEAD.match(rest)
                if not m:
                    break
                tok = m.group(1)
                next_letter = "a" if not letter else (LETTERS[LETTERS.index(letter) + 1] if letter in LETTERS[:-1] else None)
                next_roman = "i" if not roman else (ROMANS[ROMANS.index(roman) + 1] if roman in ROMANS[:-1] else None)
                if tok == next_roman and not (tok == next_letter and not roman and letter):
                    roman = tok
                    out.append((i, l["y0"], q, letter, roman))
                elif tok == next_letter and not (roman and not letter):
                    letter, roman = tok, None
                    out.append((i, l["y0"], q, letter, None))
                else:
                    break
                rest = rest[m.end():]
    return out, end


def part_words(doc, pieces):
    """A part's own words, without its label, its marks or its answer lines."""
    words = []
    for pg, r in pieces:
        for l in doc.lines(pg):
            if cp.inside(l, r) and not dots(l) and not MARK.match(l["text"]) and not TOTAL_Q.search(l["text"]):
                words.append(l["text"])
    return re.sub(r"\(\w{1,4}\)|\.{3,}|…", " ", " ".join(words))


def anchor(doc, pg, y):
    """Where what belongs to the question or task at height y starts: under the last thing above it that isn't its own."""
    f = doc.frame(pg)
    top = f.y0
    for l in doc.lines(pg):
        if f.y0 - 4 <= l["y0"] and l["y1"] <= y + 2 and l["y0"] < y - 2 and (TOTAL_Q.search(l["text"]) or HEADING.match(l["text"]) or dots(l) or MARK.match(l["text"])):
            top = max(top, l["y1"] + 2)
    return top


def title_of(doc, pg, y):
    """The bold title printed over a question's number."""
    top = anchor(doc, pg, y)
    words = [l["text"] for l in doc.lines(pg) if top <= l["y0"] < y - 2 and cp.bold(l["spans"][0]) and WANTED_TITLE.search(l["text"])]
    return " ".join(words)


def span(doc, start, end, end_page):
    """[(page, rect)] from (page, top) down to (page, bottom), or the paper's end, skipping blank pages and stopping at a section's or paper's total."""
    pg, top = start
    pieces = []
    while True:
        f = doc.frame(pg)
        t = top if pg == start[0] else f.y0
        bottom = end[1] if end and end[0] == pg else f.y1
        for l in doc.lines(pg):
            if t + 2 < l["y0"] < bottom and (STOP.match(l["text"]) or ROUTING.match(l["text"])):
                bottom = l["y0"] - 4
                break
        if bottom > t + 6:
            pieces.append((pg, pymupdf.Rect(f.x0, t, f.x1, bottom)))
        if (end and end[0] == pg) or pg >= end_page:
            return pieces
        pg += 1
        while pg < end_page and doc.blank(pg):
            pg += 1
        if end and pg > end[0]:
            return pieces


def shown(doc, pieces, marks, single):
    """What of a part's pieces to show: up to its question's total (kept on a question with no parts), then no pages of answer lines."""
    lines = []
    for k, (pg, r) in enumerate(pieces):
        lines += [(k, pg, l) for l in doc.lines(pg) if cp.inside(l, r)]
    # Cut at the total, where a part mustn't look as if the question's marks were its own.
    for n, (k, pg, l) in enumerate(lines):
        if TOTAL_Q.search(l["text"]):
            if single:
                # (the total is kept; a long task's lines above it are dropped below)
                break
            r = pieces[k][1]
            pieces = pieces[:k] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, l["y0"] - 3))]
            lines = lines[:n]
            break
    words = [i for i, (k, pg, l) in enumerate(lines) if not dots(l) and not TOTAL_Q.search(l["text"])]
    if not words:
        return pieces
    last = words[-1]
    # A writing task ends at its marks: under them are its answer lines, "Monsieur/Madame," and "Cordialement,". (A specimen's translation prints its marks first, then its passage.)
    worth = [i for i in words if MARK.match(lines[i][2]["text"])] if (marks or 0) >= 10 else []
    if worth and all(GREETING.match(lines[i][2]["text"]) for i in words if i > worth[0]):
        last = worth[0]
    else:
        worth = []
    tail = [x for x in lines[last + 1:] if dots(x[2])]
    keep = 0 if (marks or 0) >= 10 else 2
    total = next((x for x in lines[last + 1:] if TOTAL_Q.search(x[2]["text"])), None)
    if len(tail) <= keep and not worth:
        return pieces
    if keep:
        k, pg, l = tail[keep - 1]
    else:
        k, pg, l = lines[last]
    out = []
    for j, (p, r) in enumerate(pieces):
        if j < k:
            out.append((p, r))
        elif j == k:
            out.append((p, pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, l["y1"] + 5))))
    if single and total:  # the total under the answer lines left out: the question's marks stay on show
        k2, pg2, l2 = total
        out.append((pg2, pymupdf.Rect(pieces[k2][1].x0, l2["y0"] - 3, pieces[k2][1].x1, l2["y1"] + 3)))
    return out


# Rows the scheme misnumbers: (file, page, height): the label it means. June 2024's 1H prints 7(b)(iii) twice, the first for 7(b)(ii).
# November 2020's 3H heads 6(ii)'s row "6(e) (i) & (ii)".
MISPRINTS = {("1fr0-1h-ms-jun24.pdf", 7, 563): "7(b)(ii)", ("1fr0-3h-ms-nov20.pdf", 7, 52): "6(ii)"}


def tidy_scheme(doc, listening):
    """Labels cut_pearson wouldn't read: "4 ( c)"; "3(Yannick)" or "3 AXEL", a row per person, read as 3(a), 3(b) and so on, the question's rows being shown together;
    an answer cell's "(an)" beside its label, which it would join to the label as "5(c) (an)"; and a levels grid's "0", "No rewardable material",
    which would end the translation's scheme there, as a question of its own."""
    seen = {}
    grid = False  # past a levels grid's heading its bare numbers ("7", "0") are marks
    ended = False
    for i in range(len(doc)):
        # Listening schemes end with Pearson's cover and the transcript: no row runs on into them.
        ended = ended or listening and i >= 3 and bool(re.search(r"\bTranscript\b|Registered company number", re.sub(r"\s+", " ", doc[i].get_text())[:140]))
        if ended:
            doc._lines[i] = []
            continue
        for l in doc.lines(i):
            t = l["text"]
            grid = grid or "Descriptor" in t or t.startswith(("Number of rewardable", "Assessment criteria"))
            # A header set as one line, or in capitals: "Question number Answer", "QUESTION ANSWER ACCEPT REJECT".
            if l["x0"] < 200 and re.fullmatch(r"question(\s+number)?(\s+(answers?|accept|reject|mark))*", t, re.I):
                l["text"], l["x1"] = "Question number", min(l["x1"], l["x0"] + 60)
                continue
            t = l["text"] = re.sub(r"^(\d{1,2}) ?\(([a-h]) ?\(", r"\1(\2)(", t)  # "9(b (i)"
            if l["x0"] < 120:
                t = l["text"] = MISPRINTS.get((os.path.basename(doc.doc.name), i, round(l["y0"])), t)
            if grid and re.fullmatch(r"\d{1,2}", t):
                l["text"] = "\u200b" + t
                continue
            if m := re.fullmatch(r"(\d{1,2})\s*\(\s*([a-z]{1,4})\s*\)", t):
                l["text"] = f"{m.group(1)}({m.group(2)})"
            elif (m := re.fullmatch(r"(\d{1,2})\s*\(\s*([A-ZÀ-Ý][\wÀ-ÿ’'-]+)\s*\)(?:\s+[A-H])?", t) or (l["x0"] < 130 and re.fullmatch(r"(\d{1,2})\s+([A-ZÀ-Ý]{3,}[\wÀ-ÿ]*)", t))):
                seen[m.group(1)] = seen.get(m.group(1), 0) + 1
                l["text"] = f"{m.group(1)}({LETTERS[seen[m.group(1)] - 1]})"
            elif t == "0" or re.fullmatch(r"\([a-zà-ÿ]{2,}\)", t) and t.strip("()") not in ROMANS:
                l["text"] = "\u200b" + t


END_ROW = re.compile(r"^(SECTION [A-C]\b.*|Section [A-C]\b.*|Assessment criteria.*|Exemplification.*|\d?FR\w*_\w+_QUESTION.*|Question \d+$|Pearson Education Limited.*|CORRECT TENSE IMPORTANT.*)")
HEADER_WORD = re.compile(r"^(Question number|Question|number|Answers?|Accept|Reject|Mark|QUESTION|ANSWER|ACCEPT|REJECT|MARK)$")


def end_rows(doc, pieces):
    """A scheme row's pieces, up to the next section's heading or the guidance that follows the last row."""
    out = []
    for k, (pg, r) in enumerate(pieces):
        # (a section's heading can sit above the table that starts a page, or start left of a row's table)
        if k and any(l["y0"] < r.y0 + 6 and END_ROW.match(l["text"]) for l in doc.lines(pg)):
            return out
        stop = [l["y0"] for l in doc.lines(pg) if r.y0 + (6 if not k else -2) < l["y0"] < r.y1 and END_ROW.match(l["text"])]
        if stop:
            if min(stop) - 1 > r.y0 + 8:
                out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(stop) - 1)))
            return out
        # The next row's header, its row over the page or lower down, stays with that row.
        inside = sorted((l for l in doc.lines(pg) if r.y0 <= l["y0"] < r.y1 and r.x0 <= l["x0"] <= r.x1), key=lambda l: l["y0"])
        tail = len(inside)
        while tail and HEADER_WORD.match(inside[tail - 1]["text"]):
            tail -= 1
        if not tail:
            continue
        if tail < len(inside):
            r = pymupdf.Rect(r.x0, r.y0, r.x1, inside[tail]["y0"] - 3)
        # (a cell's last line can run past the rule that closes it)
        over = [l["y1"] for l in inside[:tail] if l["y0"] + 2 < r.y1 < l["y1"]]
        if over:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, max(over) + 1.5)
        out.append((pg, r))
    return out


def writing_schemes(doc, tier):
    """{q: (pieces, text, marks)}: each question's own section of a Writing scheme, from its heading to the next's. (June 2019's Higher scheme opens
    Question 1's with "Assessment criteria for the Higher tier", and no heading, and June 2025's Foundation scheme likewise; the file then goes on to the Higher scheme, whose headings end it.)"""
    heads = []
    for i in range(len(doc)):
        for l in doc.lines(i):
            m = re.match(r"^Question (\d{1,2})\s*[–—-]\s*(Foundation|Higher) tier(?:\s*\((\d+) marks?\))?", l["text"])
            if m and m.group(2)[0].lower() != tier:
                heads.append((i, l["y0"], 0, None))
            elif m and not any(h[2] == int(m.group(1)) for h in heads):
                heads.append((i, l["y0"], int(m.group(1)), int(m.group(3)) if m.group(3) else None))
    if not any(h[2] == 1 for h in heads):
        word = {"f": "Foundation", "h": "Higher"}[tier]
        first = next(((i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i) if l["text"].startswith(f"Assessment criteria for the {word}")), None)
        if first:
            heads.insert(0, (*first, 1, None))
    heads.sort(key=lambda h: h[:2])
    out = {}
    for n, (pg, y, q, worth) in enumerate(heads):
        if not q:
            continue  # the other tier's section: where the one before it ends
        nxt = heads[n + 1] if n + 1 < len(heads) else None
        pieces = []
        p = pg
        while p < len(doc):
            lines = doc.lines(p)
            if not lines or cp.BACK_PAGE.search(doc.text(p)) or re.match(r"\s*Pearson Education Limited", doc.text(p)):
                break
            w, h = doc[p].rect.width, doc[p].rect.height
            top = y - 4 if p == pg else 30
            if p != pg:  # under a page number at the top of the page, above a heading there
                crossing = [l for l in lines if l["y0"] < 32 and l["y1"] > 28]
                top = max([top] + [l["y1"] + 1 for l in crossing if re.fullmatch(r"\W*\d{1,3}", l["text"])])
                top = min([top] + [l["y0"] - 2 for l in crossing if not re.fullmatch(r"\W*\d{1,3}", l["text"])])
            bottom = nxt[1] - 4 if nxt and nxt[0] == p else h - 30
            foot = [l["y0"] for l in lines if top < l["y0"] < bottom and re.match(r"(Pearson Edexcel Level 1/Level 2 GCSE|Pearson Education Limited)", l["text"])]
            bottom = min([bottom] + [l["y0"] - 2 for l in lines if l["y0"] > h - 70 and re.fullmatch(r"\W*\d{1,3}", l["text"])])
            if foot:
                bottom = min(foot) - 4
            if bottom > top + 10 and doc.text(p, pymupdf.Rect(20, top, w - 20, bottom)).strip():
                pieces.append((p, pymupdf.Rect(20, top, w - 20, bottom)))
            if (nxt and nxt[0] <= p) or foot and not nxt:
                break
            p += 1
        out[q] = (pieces, " ".join(doc.text(p, r) for p, r in pieces), worth)
    return out


# ---------- examiner reports ----------

NOTICE = re.compile(r"insufficient entries|will not publish", re.I)
Q_HEAD = re.compile(r"^\s*(?:QUESTION|Question|Q\.?)\s*(\d{1,2})\s*(\(?[a-h]\)?)?\s*(\(?[ivx]{1,4}\)?)?\s*(?:[-–:.]\s*)?(.*)$")
JUNK_LINE = re.compile(r"^(\d{1,3}|GCSE French.*|\d\s+GCSE French.*|Examiner Comments?:?|Examiner Tips?:?|Examiner Comment.*marks?\.?)$", re.I)
END_REPORT = re.compile(r"^\s*(Paper Summary|Grade boundaries|Summary$|Based on their performance|Pearson Education Limited|Publications Code|Advice to|Conclusion$)", re.I)


def garbled(text):
    letters = re.findall(r"[A-Za-zÀ-ÿ]", text)
    return len(text) > 500 and (len(letters) < len(text) * 0.5 or not re.search(r"\b(the|candidates|question)\b", text, re.I))


def report_text(path):
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    if garbled(text):
        read = cp.ocr_lines(doc, path)
        text = "\n".join(l["text"] for i in range(len(doc)) for l in read[i])
    return text


def reports(path):
    """{"03": "paragraphs…"}: what the report says under each question's heading. A notice that no report was written gives none."""
    if not path or not os.path.exists(path):
        return {}
    text = report_text(path)
    if NOTICE.search(text) and len(text) < 600:
        return {}
    start = next((m.end() for m in re.finditer(r"copyright\s*\n?\s*©[^\n]*\n", text)), 0)
    out, q, buf = {}, None, []

    def flush():
        if q is None:
            return
        body = re.sub(r"[ \t]+", " ", re.sub(r"(?<!\n)\n(?!\n)", " ", "\n".join(buf)))
        paras = [p.strip() for p in re.split(r"\n{2,}", body) if len(p.strip()) > 30]
        if paras:
            key = f"{q:02d}"
            piece = "\n\n".join(paras)
            out[key] = out[key] + "\n\n" + piece if key in out else piece

    for raw in text[start:].split("\n"):
        s = raw.strip()
        if END_REPORT.match(s) and q is not None:
            flush()
            q = None
            continue
        if JUNK_LINE.match(s):
            continue
        m = Q_HEAD.match(s)
        # A heading, alone or opening a paragraph with a capital or a part: "Q3 was also well done".
        # Not a sentence that only starts with a question ("Question 1 which part of speech…" counts: it is about question 1).
        if m and 1 <= int(m.group(1)) <= 30:
            flush()
            q, buf = int(m.group(1)), []
            sub = "".join(x for x in (m.group(2), m.group(3)) if x)
            rest = m.group(4).strip()
            if sub:
                buf += ["", f"Question {q}({sub.strip('()')})"[:18] + (f": {rest}" if rest else ""), ""] if rest else ["", f"Question {q}({sub.strip('()')})", ""]
            elif rest:
                buf.append(f"Question {q} {rest}" if not s.upper().startswith("QUESTION") or len(rest) > 3 else rest)
            continue
        buf.append(s)
    flush()
    return out


# ---------- recordings ----------

def tracks(comp, series, questions):
    """{question: source}: a tracked zip's track N is question N, or {} and the question's start from audio_splits.json."""
    d = os.path.join(WORK, "audio-src", f"{comp}-{series}")
    names = sorted(n for n in os.listdir(d) if n.lower().endswith(".mp3")) if os.path.isdir(d) else []
    numbered = {int(m.group(1)): n for n in names if (m := re.search(r"_(\d{3})\.mp3$", n, re.I))}
    if numbered:
        return {q: os.path.join(d, numbered[int(q)]) for q in questions if int(q) in numbered}
    return {}


ENCODED = set()  # this run's, so that a question's parts share one encoding and a re-cut replaces the last


def encode(name, source, start=None, end=None):
    os.makedirs(AUDIO, exist_ok=True)
    out = os.path.join(AUDIO, name)
    if name not in ENCODED:
        ENCODED.add(name)
        cut_at = (["-ss", f"{start:.2f}"] if start is not None else []) + (["-to", f"{end:.2f}"] if end is not None else [])
        subprocess.run(["ffmpeg", "-v", "error", "-y", *cut_at, "-i", source, "-ac", "1", "-ar", "22050", "-b:a", "48k", "-map_metadata", "-1", out], check=True)
    return name


def whole_recording(comp, series):
    d = os.path.join(WORK, "audio-src", f"{comp}-{series}")
    names = [n for n in os.listdir(d) if n.lower().endswith(".mp3")] if os.path.isdir(d) else []
    return os.path.join(d, names[0]) if len(names) == 1 else None


# ---------- one paper ----------

def translation_scheme(doc):
    """[(page, rect)]: the 2026 specimens' Reading translation, whose grid and example responses come under one heading, before and after its rows, to the end."""
    first = next(((i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i) if l["text"].startswith("SECTION B")), None)
    out = []
    for p in range(first[0], len(doc)) if first else ():
        w, h = doc[p].rect.width, doc[p].rect.height
        foot = [l["y0"] for l in doc.lines(p) if re.match(r"Pearson Edexcel Level 1/Level 2 GCSE", l["text"])]
        if doc.lines(p):
            out.append((p, pymupdf.Rect(20, first[1] - 4 if p == first[0] else 30, w - 20, min(foot) - 4 if foot else h - 40)))
    return out


def dictation_scheme(doc):
    """[(page, rect)] of the 2026 specimens' dictation criteria: from their heading to their worked examples."""
    pages = [i for i in range(len(doc)) if "Assessment criteria for Section B" in doc.text(i)]
    if not pages:
        return []
    out = []
    for p in range(pages[0], len(doc)):
        if doc.text(p).startswith("Exemplification") or "Exemplification of mark scheme" in doc.text(p)[:60]:
            break
        w, h = doc[p].rect.width, doc[p].rect.height
        foot = [l["y0"] for l in doc.lines(p) if re.match(r"Pearson Edexcel Level 1/Level 2 GCSE", l["text"])]
        out.append((p, pymupdf.Rect(20, 30, w - 20, min(foot) - 4 if foot else h - 40)))
    return out


def dictation_words(doc):
    """[(page, rect)]: what the dictation's recording says, from a specimen's transcript."""
    for i in range(len(doc)):
        if re.search(r"SECTION B", doc.text(i)) and "Dictation" in doc.text(i):
            w, h = doc[i].rect.width, doc[i].rect.height
            foot = [l["y0"] for l in doc.lines(i) if re.match(r"Pearson Edexcel Level 1/Level 2 GCSE|S\d{5}A$", l["text"])]
            top = min(l["y0"] for l in doc.lines(i) if l["text"].startswith("SECTION B"))
            return [(i, pymupdf.Rect(20, top - 6, w - 20, min([h - 40] + [y - 4 for y in foot if y > top])))]
    return []


def cut_set(qp_path, ms_path, er_path, set_id, meta, meta_tr=None):
    comp, series = meta["comp"], meta["series"]
    skill = {"1": "L", "2": "L", "3": "R", "4": "W"}[comp[5]]
    meta = {k: v for k, v in meta.items() if k != "comp"}
    qp = cp.Doc(qp_path)
    # Some specimen pages print the page's footer again, mid-page, among the question's lines: painted out.
    for i in range(len(qp)):
        strays = [l for l in qp.lines(i) if re.match(r"Pearson Edexcel Level 1/Level 2 GCSE|Issue 2 July 2025", l["text"]) and l["y0"] < qp.frame(i).y1]
        for l in strays:
            qp[i].add_redact_annot(pymupdf.Rect(l["x0"] - 1, l["y0"] + 2, l["x1"] + 1, l["y1"] - 3), fill=(1, 1, 1))
        if strays:
            qp[i].apply_redactions()
            qp._lines.pop(i, None)
    problems = []
    found, end_page = labels(qp)
    text_all = "\n".join(qp.text(i) for i in range(len(qp)))
    paper_total = PAPER_TOTAL.search(text_all)
    q_totals = {int(a): int(b) for a, b in TOTAL_Q.findall(re.sub(r"\s+", " ", text_all))}
    starts = {}  # label -> (page, top)
    writing = skill == "W"
    choices = {int(q) for q in re.findall(r"(?:Choose|Answer) either Question (\d+)", text_all)}

    def top_of(lab):
        pg, y, q, letter, roman = lab
        n = found.index(lab)
        if letter is None and roman is None:
            return pg, anchor(qp, pg, y)
        if writing and q in choices and not roman:
            # (a task's own title, under its "If you answer…"; the first shares its line with its question's number)
            return pg, anchor(qp, pg, y)
        # What is printed between the last part's marks and this label is this part's: "Answer the following questions in English.", or
        # a text carrying on ("The diary continues.", at the foot of the page or at the top of the next).
        prev = found[n - 1] if n else None
        f = qp.frame(pg)
        same = prev and prev[0] == pg
        above = [l for l in qp.lines(pg) if (prev[1] if same else f.y0 - 4) < l["y0"] < y - 2 and l["y0"] <= f.y1]
        spent = [l for l in above if MARK.match(l["text"]) or dots(l)]
        # (the rest of a table cell's words beside its marks isn't new: "One sport she / takes part in", with "(1)" between)
        after = [l for l in above if not spent or l["y0"] >= spent[-1]["y1"] - 1]
        words = [l for l in after if not dots(l) and not MARK.match(l["text"]) and not re.match(r"[A-H]( |$)", l["text"])]
        # (a new instruction under a multiple choice's options, whose marks came first, is the first line that counts)
        told = [l for l in words if INSTRUCTION.match(l["text"])]
        words = told or words
        said = bool(words) and words[0]["x0"] < f.x0 + 60 and len(words[0]["text"].split()) >= 3
        if said and spent:
            return pg, gap_top(qp[pg], max(l["y1"] for l in above if l["y0"] < words[0]["y0"] - 2), words[0]["y0"])
        if said and prev and not same and any(MARK.match(l["text"]) for l in qp.lines(prev[0]) if l["y0"] > prev[1]):
            return pg, f.y0  # the part before ended over the page
        # (above any line the top would cut through: an example's answer, "surfing", set in a hand above its dots)
        over = [l["y0"] - 2 for l in qp.lines(pg) if l["y0"] < y - 4 < l["y1"]]
        top = min(over + [y - 4])
        # at the rule over a table's row, where the part is one: no sliver of the row above
        lx = next((l["x0"] for l in qp.lines(pg) if abs(l["y0"] - y) < 1 and cp.LEAD.match(l["text"])), None)
        rules = [r.y0 for r in (d["rect"] for d in cp.drawings(qp[pg])) if r.height < 2 and r.x0 <= (lx or 0) <= r.x1 and y - 14 <= r.y0 <= y
                 and not any(r.y0 < l["y0"] < y - 2 for l in qp.lines(pg))]
        return pg, max(rules) - 1 if rules else top

    # Labels on nothing but answer lines aren't parts: the photo question's "(a)" to "(d)", or "(b) How do they help? (2)" over "(i)" and "(ii)".
    def own_words(lab):
        k = found.index(lab)
        nxt = found[k + 1] if k + 1 < len(found) else None
        stop = (nxt[0], anchor(qp, nxt[0], nxt[1]) if not nxt[3] and not nxt[4] else nxt[1] - 4) if nxt else None  # (the next question's title isn't this part's)
        return part_words(qp, span(qp, (lab[0], lab[1] - 4), stop, end_page))
    drop = set()
    for q in {x[2] for x in found}:
        for parent in {x[3] for x in found if x[2] == q and (x[3] or x[4])} | {None}:
            mine = [x for x in found if x[2] == q and (x[4] if parent else x[3] or x[4]) and (x[3] == parent if parent else True)]
            if mine and not any(re.search(r"[A-Za-zÀ-ÿ]{3,}", own_words(x)) for x in mine):
                drop |= set(mine)
    found = [x for x in found if x not in drop]
    # A choice of tasks: Pearson says so, or two tasks are each worth the question's marks.
    for q in {x[2] for x in found}:
        mine = [x for x in found if x[2] == q and x[3] and not x[4]]
        if writing and len(mine) > 1:
            worth = [cp.marks_in(qp, span(qp, (x[0], x[1] - 4), None, min(end_page, x[0] + 1))[:1]) for x in mine]
            if all((w or 0) >= 10 for w in worth):
                choices.add(q)

    tops = [top_of(x) for x in found]
    regions = {}
    for n, lab in enumerate(found):
        regions[(lab[2], lab[3], lab[4])] = span(qp, tops[n], tops[n + 1] if n + 1 < len(found) else None, end_page)
    keys = list(regions)
    children = lambda k: [o for o in keys if o != k and o[0] == k[0] and (k[1] is None and k[2] is None or (k[1] and not k[2] and o[1] == k[1]))]  # noqa: E731
    leaves = [k for k in keys if not children(k)]
    question_label = {x[2]: x for x in found if x[3] is None and x[4] is None}
    titles = {q: title_of(qp, lab[0], lab[1]) for q, lab in question_label.items()}

    # Schemes.
    ms_doc = cp.Doc(ms_path)
    tidy_scheme(ms_doc, skill == "L")
    written = writing_schemes(ms_doc, comp[6]) if writing else {}
    for q, (_, _, worth) in written.items():
        if worth and worth != q_totals.get(q):
            problems.append(f"{set_id} {q}: its scheme's section is worth {worth}, the paper's question {q_totals.get(q)}")
    tables = {} if writing else cp.ms_tables(ms_doc)
    dictation = dictation_scheme(ms_doc) if comp.startswith("1fr1") and skill == "L" else None
    tr_doc = cp.Doc(meta_tr) if meta_tr else None
    er = reports(er_path)
    used_rows = set()

    translation = translation_scheme(ms_doc) if comp.startswith("1fr1-3") else []
    last_q = found[-1][2] if found else None

    def scheme(key):
        """(pieces, text, answer, whole-question?) for a part: its own row; a row its part's letter or question stands for; or all its rows."""
        q, letter, roman = key
        if translation and q == last_q:
            used_rows.update(k for k in tables if k[0] == q)
            return translation, " ".join(ms_doc.text(p, r) for p, r in translation), None, bool(letter or roman)
        if writing:
            pieces, text, _ = written.get(q, ([], "", None))
            return pieces, text, None, bool(letter or roman)
        for k in (key, (q, letter, None) if roman else None, (q, None, None) if letter or roman else None, (q, None, letter) if letter and not roman else None):
            if k and tables.get(k) and tables[k][0]:
                used_rows.add(k)
                return tables[k][0], tables[k][1], tables[k][2], False
        rows = [k for k in tables if k[0] == q and (not letter or k[1] == letter) and tables[k][0]]
        if rows:
            used_rows.update(rows)
            rows.sort(key=lambda k: (tables[k][0][0][0], tables[k][0][0][1].y0))
            return [p for k in rows for p in tables[k][0]], " ".join(tables[k][1] for k in rows), None, bool(letter or roman)
        return [], "", None, False

    parts, stems, shown_pieces = [], set(), {}
    by_q = {}
    for key in leaves:
        by_q.setdefault(key[0], []).append(key)
    # Marks: beside the part, else its scheme row's "(n)", else the question's total shared out.
    marks = {}
    for q, ks in by_q.items():
        total = q_totals.get(q)
        if len(ks) == 1 and ks[0][1] is None and ks[0][2] is None:
            marks[ks[0]] = total
            continue
        for k in ks:
            marks[k] = cp.marks_in(qp, regions[k])
            if marks[k] is None:
                row = re.findall(r"\((\d{1,2})\)", scheme(k)[1]) if not writing else []
                marks[k] = int(row[-1]) if row and not scheme(k)[3] else None
        counted = [k for k in ks if not (q in choices and k != ks[0])]
        known = sum(marks[k] or 0 for k in counted)
        if total and any(marks[k] is None for k in counted):
            blank = [k for k in counted if marks[k] is None]
            if (total - known) % len(blank) == 0:
                for k in blank:
                    marks[k] = (total - known) // len(blank)
        elif total and known != total:
            problems.append(f"{set_id} {q}: parts {known} marks, total {total}")

    for key in leaves:
        q, letter, roman = key
        single = not letter and not roman
        keep = shown(qp, regions[key], marks[key], single)
        lead = []
        # The first sub-part carries its part's opening words.
        if letter and roman == "i" and (q, letter, None) in regions:
            lead = [p for p in regions[(q, letter, None)] if cp.has_content(qp, *p)]
        label = f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else "")
        pid = f"{set_id}-{q:02d}" + (f"-{letter or ''}{roman or ''}" if letter or roman else "")
        shown_pieces[pid] = lead + keep
        if not single:
            shown_pieces[f"{set_id}-{q:02d}-stem"] = [p for p in regions.get((q, None, None), []) if cp.has_content(qp, *p)]
        qimg = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in lead + keep])
        stem_name, stem_text = None, ""
        if not single:
            stem_pieces = [p for p in regions.get((q, None, None), []) if cp.has_content(qp, *p)]
            if stem_pieces:
                stem_name = f"{set_id}-{q:02d}-stem.webp"
                if stem_name not in stems:
                    stems.add(stem_name)
                    cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in stem_pieces]), stem_name)
                stem_text = " ".join(qp.text(pg, r) for pg, r in stem_pieces)
        own = " ".join(qp.text(pg, r) for pg, r in lead + keep)
        mpieces, ms_text, answer, whole = scheme(key)
        if not writing and not (translation and q == last_q):
            mpieces = end_rows(ms_doc, mpieces)
            ms_text = " ".join(ms_doc.text(p, r) for p, r in mpieces)
        for pg, r in mpieces:
            problems += [f"{pid} scheme p{pg + 1}: edge cuts {l['text'][:40]!r}" for l in ms_doc.lines(pg) if r.x0 <= l["x0"] <= r.x1 and (l["y0"] + 2.5 < r.y1 < l["y1"] - 2.5 or l["y0"] + 2.5 < r.y0 < l["y1"] - 2.5)]
        if re.search(r"\bDescriptor\b", ms_text) and not re.search(r"No rewardable", ms_text):
            problems.append(f"{pid}: scheme's grid cut off")
        msimg = cp.stack([cp.trim(ms_doc.crop(pg, r), 10, sides=True) for pg, r in mpieces]) if mpieces else None
        if not mpieces and dictation and single:
            said = dictation_words(tr_doc) if tr_doc else []
            msimg = cp.stack([cp.trim(tr_doc.crop(pg, r), 10, sides=True) for pg, r in said] + [cp.trim(ms_doc.crop(pg, r), 10, sides=True) for pg, r in dictation])
            ms_text = " ".join(tr_doc.text(pg, r) for pg, r in said) + " " + " ".join(ms_doc.text(pg, r) for pg, r in dictation)
        clean = lambda t: re.sub(r"\s+", " ", cp.BOILER.sub(" ", t)).strip()  # noqa: E731
        p = {"id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": f"{letter or ''}{roman or ''}" or None, "label": label, "marks": marks[key],
             "qp": cp.save(qimg, f"{pid}-qp.webp"), "ms": cp.save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
             "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0, "title": titles.get(q, ""),
             "own": clean(own), "stemText": clean(stem_text), "text": clean(own + " " + stem_text)[:3000], "msText": re.sub(r"\s+", " ", ms_text.replace("\u200b", ""))[:800],
             "er": er.get(f"{q:02d}"), **({"key": answer} if answer else {}), **({"msq": True} if whole else {}),
             **({"or": True} if q in choices and key != by_q[q][0] else {})}
        parts.append(p)
    problems += check_crops(qp, found, end_page, set_id, list(shown_pieces.items()))
    # A scheme row no part took means a part the paper's labels didn't show.
    for k in tables:
        if k not in used_rows and tables[k][0] and k[0] in by_q:
            problems.append(f"{set_id}: scheme row {k} has no part")
    # Recordings.
    if skill == "L":
        qs = [f"{q:02d}" for q in by_q]
        found_tracks = tracks(comp, series, qs)
        splits = json.load(open(SPLITS)).get(f"{comp}-{series}".lower()) if os.path.exists(SPLITS) else None
        whole = whole_recording(comp, series)
        for p in parts:
            name = f"{comp}-{series}-{p['question']}.mp3".lower()
            if p["question"] in found_tracks:
                p["audio"] = encode(name, found_tracks[p["question"]])
            elif splits and whole and p["question"] in splits["starts"]:
                ordered = sorted(splits["starts"].values())
                start = splits["starts"][p["question"]]
                later = [s for s in ordered if s > start]
                p["audio"] = encode(name, whole, start, later[0] if later else None)
            else:
                problems.append(f"{p['id']}: no recording")
    # Checks.
    want = int(paper_total.group(1)) if paper_total else None
    got = sum(p["marks"] or 0 for p in parts if not p.get("or"))
    if want != got:
        problems.append(f"{set_id}: {got} marks, paper says {want}")
    for p in parts:
        if not p["ms"]:
            problems.append(f"{p['id']}: no scheme")
        if p["marks"] is None:
            problems.append(f"{p['id']}: no marks")
    expected = sorted(q_totals)
    if expected != sorted(by_q):
        problems.append(f"{set_id}: questions {sorted(by_q)} but totals for {expected}")
    return parts, problems


ACKNOWLEDGE = re.compile(r"^(Turn over|DO NOT WRITE|Images used within|Every effort has been|material\. Pearson|such rectifications|This document was informed|MultilingProfiler|net/|Permission to reproduce|Pearson Edexcel Level 1)")


def check_crops(doc, found, end_page, set_id, shown_list):
    """Every printed line from the first question on must be in a crop, in one only, and no crop's edge may cut through a line."""
    problems = []
    first = (found[0][0], found[0][1]) if found else (0, 0)
    last_q = max((x[0], x[1]) for x in found) if found else (0, 0)
    for i in range(first[0], end_page + 1):
        if doc.blank(i):
            continue
        f = doc.frame(i)
        for l in doc.lines(i):
            t = l["text"]
            if not (f.y0 - 2 <= l["y0"] <= f.y1 - 2) or (i, l["y0"]) < (first[0], first[1] - 60) or dots(l):
                continue
            if HEADING.match(t) or STOP.match(t) or PAPER_TOTAL.match(t) or re.fullmatch(r"\d{1,2}", t) or GREETING.match(t) or ACKNOWLEDGE.match(t):
                continue
            homes = [pid for pid, pieces in shown_list if any(p == i and cp.inside(l, r) for p, r in pieces)]
            if not homes and not TOTAL_Q.search(t):
                problems.append(f"{set_id} p{i + 1}: in no crop: {t[:70]!r}")
            elif len(homes) > 1:
                problems.append(f"{set_id} p{i + 1}: in {homes}: {t[:50]!r}")
    for pid, pieces in shown_list:
        for pg, r in pieces:
            for l in doc.lines(pg):
                for edge in (r.y0, r.y1):
                    if l["y0"] + 2.5 < edge < l["y1"] - 2.5 and r.x0 <= l["x0"] <= r.x1 and not dots(l):
                        problems.append(f"{pid} p{pg + 1}: edge {edge:.0f} cuts {l['text'][:50]!r}")
    return problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta, pdf("tr")), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f.get("file"):
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp.replace('-', '')}-{series}".lower()
        if "qp" in files and "ms" in files and (not ONLY or set_id.startswith(ONLY)):
            jobs.append((set_id, files, {"comp": comp, "component": comp.replace("-", ""), "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"].get("title", "")}))
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} parts, {sum(1 for p in parts if p['ms'])} schemes, {sum(1 for p in parts if p.get('or'))} options, "
                  f"{sum(1 for p in parts if p.get('audio'))} with audio, {sum(1 for p in parts if p.get('er'))} with report, {sum(p['marks'] or 0 for p in parts if not p.get('or'))} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
