"""Cut OCR's A-Level and AS Economics papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/ocr_economics/cut_ocr_economics.py [work-dir] [--only=h46003-jun24]
    # work-dir: .work/ocr-economics (fetch_ocr_economics.py); needs: pip install pymupdf pillow

OCR's Economics papers are typeset like its sciences, so edexcel_sciences/cut_pearson.py does
the work, used here as a library, unchanged. What differs is set here, for this run only:
  - the case material. H460/01 and /02 open Section A with stimulus material ("Read the stimulus
    material and answer all the parts of Question 1."), AS Section B opens with a case study, and
    H460/03's Section B has three extracts, either all before its questions (November 2021 to June
    2023) or each before its own (June 2024 on). Each block, from its heading ("Section B",
    "Read the extracts…", "Extract 2") to the next question, is the stem of every question after it
    until the next block or section. A part's crop stops at the next block, so Question 33 doesn't
    run on into Extract 2. Paper 3's extract questions have no parts, so they are named for their
    block, "h46003-jun24-e2-34", and share its stem, "h46003-jun24-e2-stem.webp" (questionBank.ts
    partImage), the way AQA Economics names its context groups;
  - answer lines. A part is shown down to its first answer line ("......"); where its marks sit at
    the end of the answer lines ("........ [8]"), that one line is shown under it;
  - the essays' schemes. OCR sets "2*" and "3*" (the Section B choice) above one level table, then
    "Question 2* Guidance" and "Question 3* Guidance": each essay gets its own heading, the shared
    levels and its own guidance;
  - the Paper 3 and AS multiple-choice key, a two-column table before the rationale table, is left
    out: the rationale table, one row per question with its key, is the scheme;
  - "Answer Question 2 or Question 3": the second of a choice is marked `or`;
  - and smaller things: a multiple-choice row's letter is read past the tick a quantitative-skills
    row carries; continuation pages start below OCR's centred page number, and a page's last line
    isn't cut through by the frame's foot; the AS June 2025 scheme's slips (question 2's row
    numbered "1", question 18's heading set as a sentence) are read as meant, and the
    assessment-objective grid at a scheme's back is left unread; the examiners' reports' "Question
    2*" headings and Section A's one-line multiple-choice notes are read, their section overviews
    and OCR's back pages left out.
Writes <work-dir>/img/<id>-qp.webp, -ms.webp, -stem.webp and <work-dir>/parts.json in
cut_pearson.py's shape. Ids are <component>-<series>-<question>[-<part>]: "h46001-jun24-01-ci".
"""
import os, re, sys, types

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-economics"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402  (reads the work dir and --only from the command line)

SECTION = re.compile(r"^(SECTION|Section) [A-C]$")
READ = re.compile(r"^Read the (following )?(stimulus|extracts)")
EXTRACT = re.compile(r"^Extract \d+\b")
ANSWER_LINE = re.compile(r"^[.…\s]*\.{10,}[.…\s]*(\[\d{1,2}\])?$|^Question No\b")
MARK_LINE = re.compile(r"\[\d{1,2}\]$")
GUIDANCE = re.compile(r"^Question (\d{1,2})\*? Guidance")
CHOICE = re.compile(r"Answer (?:either )?Question (\d{1,2}) or (?:Question )?(\d{1,2})", re.I)
LABEL = re.compile(r"^(\d{1,2})(?:\(([a-z])\))?(?:\(([ivx]{1,4})\))?$")


def markers(doc, end_page):
    """[(page, y, kind, below)]: where case material can start, "section" or "block", in reading order;
    `below`, where a block starting there begins (under a section's heading, which isn't wanted)."""
    if not hasattr(doc, "_econ_markers"):
        out = []
        for i in range(1, end_page + 1):
            f = doc.frame(i)
            for l in doc.lines(i):
                t = l["text"].strip()
                if SECTION.match(t):
                    out.append((i, l["y0"], "section", l["y1"] + 7))
                elif READ.match(t) or EXTRACT.match(t) and l["x0"] < f.x0 + 20 and cp.bold(l["spans"][0]):
                    out.append((i, l["y0"], "block", l["y0"] - 2))
        doc._econ_markers = out
    return doc._econ_markers


_frame = cp.frame


def frame(page):
    """Below the page number OCR centres at the top (as computer_science/cut_ocr_cs.py), and down past a
    line the frame's foot runs through ("The household savings ratio is…", H460/03 June 2024 page 20)."""
    f = _frame(page)
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    number = [s for s in spans if re.fullmatch(r"\d{1,2}", s["text"].strip()) and s["bbox"][1] < 50
              and abs((s["bbox"][0] + s["bbox"][2]) / 2 - page.rect.width / 2) < 30]
    if f.y0 < 58 and number:
        first = min((s["bbox"][1] for s in spans if s not in number and s["bbox"][1] > number[0]["bbox"][1] - 2), default=59)
        f = pymupdf.Rect(f.x0, min(59, first - 1), f.x1, f.y1)
    over = [s["bbox"][3] for s in spans if s["bbox"][1] < f.y1 - 2 < s["bbox"][3] and not re.search(r"© OCR|Turn over", s["text"])]
    if over:
        f = pymupdf.Rect(f.x0, f.y0, f.x1, max(over) + 2)
    return f


_region = cp.region


def region(doc, start, end, end_page):
    """A part's region also ends where case material starts."""
    nxt = next(((pg, y) for pg, y, *_ in markers(doc, end_page) if (pg, y) > (start[0], start[1] + 1)), None)
    if nxt and (end is None or nxt < tuple(end)):
        end = nxt
    return _region(doc, start, end, end_page)


_lines = cp.Doc.lines
TICK = re.compile(r"[\uf0fc✓✔]")


def lines(self, i):
    """A scheme page as the cutter should read it:
      - the two-column multiple-choice key (Question | Answer | Question | Answer, no rationale) reads
        as nothing, its answers kept in `_econ_keys`, and so does the assessment-objective grid at the
        back ("1-15", "16(a)", "17 / 18", "TOTAL"), whose labels aren't answers;
      - a heading set as a sentence, "18. Evaluate, using…" (AS June 2025), is a label and its question;
      - a row numbered the same as the one above where the next is two on ("1", "1", "3": AS June 2025's
        question 2) takes the number between."""
    fresh = i not in self._lines
    got = _lines(self, i)
    if not fresh or "-ms-" not in os.path.basename(self.doc.name):
        return got
    text = " ".join(l["text"] for l in got)
    if re.search(r"Multiple Choice", text) and not re.search(r"Rationale", text):
        keys = getattr(self, "_econ_keys", {})
        for l in got:
            if re.fullmatch(r"\d{1,2}", l["text"].strip()):
                key = min((o for o in got if re.fullmatch(r"[A-D]", TICK.sub("", o["text"]).strip()) and abs(o["y0"] - l["y0"]) < 4
                           and 0 < o["x0"] - l["x1"] < 150), key=lambda o: o["x0"], default=None)
                if key:
                    keys[int(l["text"])] = TICK.sub("", key["text"]).strip()
        self._econ_keys = keys
        got = []
    elif any(re.fullmatch(r"\d{1,2}\*?\s*/\s*\d{1,2}\*?|1\s*[-–]\s*\d{2}", l["text"].strip()) for l in got) and re.search(r"\bTOTAL\b|\bTotal\b", text):
        got = []
    out = []
    for l in got:
        m = re.match(r"^(\d{1,2})\.\s+([A-Z].*)$", l["text"])
        if m and l["x0"] < 60 and re.match(r"(Evaluate|Explain|Discuss|Assess|Analyse)\b", m.group(2)):
            w = (l["x1"] - l["x0"]) / max(len(l["text"]), 1)
            out.append({**l, "text": m.group(1), "x1": l["x0"] + w * len(m.group(1)), "spans": [{**l["spans"][0], "text": m.group(1)}]})
            out.append({**l, "text": m.group(2), "x0": l["x0"] + w * (len(m.group(1)) + 2)})
        else:
            out.append(l)
    nums = [l for l in out if l["x0"] < 80 and re.fullmatch(r"\d{1,2}", l["text"].strip())]
    for a, b, c in zip(nums, nums[1:], nums[2:]):
        if int(a["text"]) == int(b["text"]) and int(c["text"]) == int(a["text"]) + 2:
            out[out.index(b)] = {**b, "text": str(int(a["text"]) + 1)}
    self._lines[i] = out
    return out


def cut(pieces, frm=None, to=None):
    """The pieces between two points (page, y), either open."""
    out = []
    for pg, r in pieces:
        top, bottom = r.y0, r.y1
        if frm and (pg < frm[0] or pg == frm[0] and frm[1] >= bottom):
            continue
        if to and (pg > to[0] or pg == to[0] and to[1] <= top):
            continue
        if frm and pg == frm[0]:
            top = max(top, frm[1])
        if to and pg == to[0]:
            bottom = min(bottom, to[1])
        if bottom > top + 6:
            out.append((pg, pymupdf.Rect(r.x0, top, r.x1, bottom)))
    return out


_ms_tables = cp.ms_tables


def answer(doc, pieces):
    """A multiple-choice row's key, read from under its table's "Key" or "Answer" header, past the tick a
    quantitative-skills question carries."""
    for pg, r in pieces:
        lines = doc.lines(pg)
        head = next((l for l in lines if l["text"].strip() in ("Key", "Answer") and l["y0"] < r.y1), None)
        for l in lines:
            if head and cp.inside(l, r) and re.fullmatch(r"[A-D]", TICK.sub("", l["text"]).strip()) \
                    and head["x0"] - 15 < (l["x0"] + l["x1"]) / 2 < head["x1"] + 15:
                return TICK.sub("", l["text"]).strip()
    return None


def ms_tables(doc):
    """An essay choice's scheme: its own heading, the levels both share, and its own guidance. And every
    multiple-choice row's key, from the key table where there is one, else from its own row."""
    ms = _ms_tables(doc)
    keys = getattr(doc, "_econ_keys", {})
    for k, (pieces, text, ans) in list(ms.items()):
        if not k[1] and k[0] <= 30 and not re.search(r"Evaluate|Level \d", text):  # (the essays and Paper 3's case questions are 31 on)
            ms[k] = (pieces, text, keys.get(k[0]) or ans or answer(doc, pieces))
    for k, (pieces, text, ans) in list(ms.items()):
        b = k[0]
        if k[1] or not pieces:
            continue
        inside = [(pg, l) for pg, r in pieces for l in doc.lines(pg) if cp.inside(l, r)]
        heads = [(pg, l["y0"] - 4, int(m.group(1))) for pg, l in inside if (m := GUIDANCE.match(l["text"]))]
        others = sorted({q for *_, q in heads if q != b})
        if len(others) != 1 or (others[0], None, None) not in ms or b not in {q for *_, q in heads}:
            continue
        a = others[0]
        first_a = next((pg, y) for pg, y, q in heads if q == a)
        first_b = next((pg, y) for pg, y, q in heads if q == b)
        level = next(((pg, l["y0"] - 4) for pg, l in inside if re.match(r"Level\s*/\s*mark", l["text"])), None)
        levels = cut(pieces, level, min(first_a, first_b)) if level else []
        head_b = cut(pieces, None, level or min(first_a, first_b))
        own_a = ms[(a, None, None)][0]
        new_a = own_a + levels + cut(pieces, first_a, first_b if first_b > first_a else None)
        new_b = head_b + levels + cut(pieces, first_b, first_a if first_a > first_b else None)
        for q, new in ((a, new_a), (b, new_b)):
            ms[(q, None, None)] = (new, " ".join(doc.text(pg, r) for pg, r in new), ms[(q, None, None)][2])
    return ms


def shown(doc, pieces):
    """The part down to its first answer line, and the line its marks are on if they come after."""
    seq = [(pg, r, l) for pg, r in pieces for l in doc.lines(pg) if cp.inside(l, r)]
    first = next((n for n, (_, _, l) in enumerate(seq) if ANSWER_LINE.match(l["text"].strip())), None)
    if first is None:
        return pieces
    pg0, _, l0 = seq[first]
    out = cut(pieces, None, (pg0, l0["y0"] - 3))
    mark = next(((pg, r, l) for pg, r, l in seq[first:] if MARK_LINE.search(l["text"]) and l["x1"] > r.x1 - 60), None)
    before = any(MARK_LINE.search(l["text"]) and l["x1"] > r.x1 - 60 for _, r, l in seq[:first])
    if mark and not before:
        pg, r, l = mark
        out.append((pg, pymupdf.Rect(r.x0, l["y0"] - 4, r.x1, l["y1"] + 4)))
    return out


_examiner_report = cp.examiner_report


def examiner_report(path, section=None):
    """cut_pearson's reader, on the report's text without OCR's back pages ("Supporting you") or a section's
    overview, and with OCR Economics' headings put the way it reads them:
    an essay's "Question 2*" as "Question 2", and Section A's multiple-choice notes, "Question 4  Candidates
    did not know…" (a heading with its comment beside it, under "Most well answered questions"), each
    as a heading of its own with the comment under it."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.split(r"\n[ \t]*Supporting you[ \t]*\n", text)[0]  # OCR's back pages
    text = re.sub(r"\n[ \t]*Section [A-C] overview[ \t]*\n.*?(?=\n[ \t]*Question \d)", "\n", text, flags=re.S)
    text = re.sub(r"\n([ \t]*Question\s+\d{1,2}(?:\s*\(\s*[a-z]{1,4}\s*\))*)[ \t]*\*[ \t]*(?=\n)", r"\n\1", text)
    text = re.sub(r"\n[ \t]*Question (\d{1,2})[ \t]+(?=[A-Z])", r"\nQuestion \1\n", text)
    text = re.sub(r"\n[ \t]*((Most|Least) well answered questions|Questions which many candidates found challenging)[ \t]*(?=\n)", "\n", text)
    real = cp.pymupdf
    cp.pymupdf = types.SimpleNamespace(open=lambda _: [types.SimpleNamespace(get_text=lambda: text)])
    try:
        return _examiner_report(path, section)
    finally:
        cp.pymupdf = real


cp.frame, cp.region, cp.Doc.lines, cp.ms_tables, cp.examiner_report = frame, region, lines, ms_tables, examiner_report
_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    by_key = {}
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        by_key[(q, letter, roman)] = region(qp, (pg, y), (nxt[0], nxt[1]) if nxt else None, end_page)
    # The case material: each block's pieces, and which block each question is set on.
    # (a label's last field is its question; a marker's, where a block starting there begins)
    events = sorted([(pg, y, "label", q) for pg, y, q, letter, _ in labels if letter is None]
                    + list(markers(qp, end_page)), key=lambda e: (e[0], e[1]))
    blocks, block_of, current, gap = [], {}, None, []
    for pg, y, kind, last in events:
        if kind != "label":
            gap.append((pg, last, kind))
            continue
        if gap:
            start = gap[0]
            pieces = [p for p in _region(qp, (start[0], start[1]), (pg, y), end_page) if cp.has_content(qp, *p)]
            words = cp.BOILER.sub(" ", " ".join(qp.text(*p) for p in pieces))
            if len(re.sub(r"\s+", " ", words)) > 200:
                blocks.append(pieces)
                current = len(blocks)
            elif any(k == "section" for *_, k in gap):
                current = None
            gap = []
        if current:
            block_of[last] = current
    choices = {int(m.group(2)) for i in range(1, end_page + 1) for m in CHOICE.finditer(re.sub(r"\s+", " ", qp.text(i)))}
    for p in parts:
        m = LABEL.match(p["label"])
        q, letter, roman = int(m.group(1)), m.group(2), m.group(3)
        pieces = list(by_key[(q, letter, roman)])
        lead = []
        if roman == "i" and (q, letter, None) in by_key:
            lead = [x for x in by_key[(q, letter, None)] if cp.has_content(qp, *x)]
        keep = lead + shown(qp, pieces[:1] + [x for x in pieces[1:] if cp.has_content(qp, *x)])
        img = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in keep])
        if img is None:
            continue
        b = block_of.get(q)
        if letter:
            own = [x for x in by_key.get((q, None, None), []) if cp.has_content(qp, *x)]
            stem_pieces, stem = (blocks[b - 1] if b else []) + own, f"{set_id}-{q:02d}-stem.webp"
        elif b:
            p["id"] = f"{set_id}-e{b}-{q:02d}"
            stem_pieces, stem = blocks[b - 1], f"{set_id}-e{b}-stem.webp"
        else:
            stem_pieces, stem = [], None
        p["stem"] = cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in stem_pieces]), stem) if stem_pieces else None
        if p["ms"]:
            os.replace(os.path.join(cp.IMG, p["ms"]), os.path.join(cp.IMG, f"{p['id']}-ms.webp"))
            p["ms"] = f"{p['id']}-ms.webp"
        if p["qp"] != f"{p['id']}-qp.webp":
            os.remove(os.path.join(cp.IMG, p["qp"]))
        p["qp"] = cp.save(img, f"{p['id']}-qp.webp")
        p["w"], p["h"] = img.width, img.height
        stem_text = " ".join(qp.text(*x) for x in stem_pieces)
        text = " ".join(qp.text(*x) for x in keep)
        p["text"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", text + " " + stem_text)).strip()[:3000]
        p["own"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", text)).strip()[:1500]  # the part's own words, for tagging
        if not letter and q in choices:
            p["or"] = True
    return parts


cp.cut_set = cut_set

if __name__ == "__main__":
    cp.main()
