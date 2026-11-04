"""Cut AQA's GCSE Citizenship Studies (8100) papers into question parts, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_citizenship/cut_gcse_citizenship.py [work-dir] [--only=81001]   # default scripts/question-bank/.work/aqa-gcse-citizenship

cut.py on the question papers, which AQA sets the usual way: every part has its boxed label
("0 3 . 1") and runs to the next one, across page breaks, with any source ("Source A …") printed
inside the part that uses it, so a source-based part's crop carries its source. What differs:
  - A page with "Extra space" on it ends a part only when it has nothing else on it: the 8-mark
    source question prints its source on one page and its question, marks and extra space on the
    next, which cut.py's skip_page treated as an answer page (the part lost its question).
  - No setups are moved (cut.py's move_setups): every part's setup and source sit under its own
    label, and moving full sentences took the multiple-choice options ("B religious leaders.")
    and their marks down into the next part.
  - A section's heading ("Section B / Politics and participation / Answer all questions…") and
    "Question 1 continues on the next page" are cut off the end of the part above them.
  - Paper 1's question 2 (the student's own investigation) has a bare label with an instruction
    ("State what your investigation is about."), and Paper 2's question 8 a source listing its
    options ("A – Arson"): each is its question's stem, shown above each part. Paper 1's
    question 1 has a title alone ("Investigating the action of others"): no stem.
  - The schemes are tables: "Qu | Part | Marking guidance | Total marks", a table per part from
    June 2022 (each with its own header row), one long table ruled per part before. A part's
    scheme runs from the top of its table (or row) to the next part's, across pages, so a
    levels-of-response scheme keeps its whole grid and all its indicative content.
  - Multiple choice ("Shade in the one correct answer." / "…two correct answers.") is marked by
    letters: the scheme's "Correct response: C (Equal Pay Act) and F (Race Relations Act)",
    "Correct answer: A (no one.)" or "Correct response – D and E" becomes the part's key, checked
    against the question paper's options where the scheme names them, and has no scheme crop.
  - The reports comment part by part ("Question 03.1 (Multiple choice)"); a question's report is
    its parts' comments, each under its label.
  - The specimen papers are left out, as in the other AQA banks.
A set's problems are listed: a part with neither key nor scheme, a scheme that doesn't reprint
its part's question, multiple choice without the right number of letters or with a letter whose
option doesn't match, a levels scheme without its whole grid or its indicative content, and a
paper whose parts don't add up to 80 marks.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-citizenship")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
COMPONENTS = ("81001", "81002")
MCQ = re.compile(r"Shade in the (one|two) correct answers?", re.I)
MARKS = re.compile(r"\[(\d+) marks?\]")
BOILER = re.compile(r"Do not write|outside the|\bbox\b|Extra space|Turn over|IB/[A-Z]/\w+/[\w/]+|\*\d+\*|Question \d+ continues on the next page", re.I)
TAIL = re.compile(r"^(Section [AB]\b|Question \d+ continues|Turn over for the next question)")
KEY = re.compile(r"Correct (?:response|answer)s?\s*[:–-]\s*(.+?)(?=\s*A[O0]\d\s*=|$)", re.S)
OPTIONS = re.compile(r"(?m)^\s*([A-F])(?:\s*[–-])?[ \t]+(\S[^\n]*)$")


def skip_page(page, max_x, bold_only):
    """cut.skip_page, but a page with "Extra space" on it is a question's page if anything besides answer lines is
    printed on it: a mark, or words that aren't the page's furniture."""
    text = page.get_text()
    if cut.NOT_QUESTIONS.search(text):
        return True
    if not cut.EXTRA_SPACE.search(text) or cut.left_labels(page, max_x, bold_only):
        return False
    words = re.sub(r"\d+", " ", BOILER.sub(" ", text))
    return not MARKS.search(text) and len(re.findall(r"[A-Za-z]{3,}", words)) < 4


cut.skip_page = skip_page
cut.move_setups = lambda doc, out: None


def cut_tail(doc, pieces, first_ok=False):
    """Pieces ending above a section's heading or a "continues"/"turn over" note; a piece left empty is dropped.
    A heading on a part's own first line (first_ok) is the part's, not a tail."""
    out = []
    for n, (pg, r) in enumerate(pieces):
        lines = cut.text_lines(doc[pg], r)
        at = next((y for k, (y, x, t) in enumerate(lines) if TAIL.match(t) and not (first_ok and n == 0 and k == 0)), None)
        if at is not None:
            r = pymupdf.Rect(r.x0, r.y0, r.x1, at - 4)
            if r.height > 10 and doc[pg].get_text("text", clip=r).strip():
                out.append((pg, r))
            break  # nothing after a heading is this part's
        out.append((pg, r))
    return out


def text_of(doc, pieces):
    return "\n".join(doc[pg].get_text("text", clip=r) for pg, r in pieces)


# --- mark schemes ---------------------------------------------------------------------------------------------

def ms_frame(page):
    """A scheme page's content: under the running header's rule (68pt), above the footer's (791pt) and the page number
    (November 2020's schemes draw no footer rule, and their page number kept the crop's white tail from trimming)."""
    w, h = page.rect.width, page.rect.height
    wide = [d["rect"].y0 for d in page.get_drawings() if d["rect"].height < 2 and d["rect"].width > w / 2]
    foot = [l["bbox"][1] for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
            if l["bbox"][1] > h - 70 and "".join(s["text"] for s in l["spans"]).strip()]
    top = max([y for y in wide if y < 100], default=60) + 2
    bottom = min([y for y in wide if y > h - 90] + foot, default=h - 50) - 2
    return pymupdf.Rect(40, top, w - 40, bottom)


def spans(page):
    return [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]


def first_col_rules(page):
    """The table's row rules, read off its first ("Qu") column: a levels grid's rules start further in."""
    return sorted({round(d["rect"].y0, 1) for d in page.get_drawings() if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})


def ms_labels(doc, asked):
    """[(page, y top of its table or row, (q, p))]: a question number in the Qu column ("03", x 45-80) beside a part
    number in the Part column ("1", x 85-112), on one line, for a part the question paper prints."""
    found = []
    for pg, page in enumerate(doc):
        ss = spans(page)
        qs = [s for s in ss if re.fullmatch(r"\d{2}", s["text"].strip()) and 45 <= s["bbox"][0] <= 80]
        for s in qs:
            y = s["bbox"][1]
            p = next((t for t in ss if re.fullmatch(r"\d{1,2}", t["text"].strip()) and 85 <= t["bbox"][0] <= 112 and abs(t["bbox"][1] - y) < 4), None)
            if not p:
                continue
            key = (s["text"].strip(), p["text"].strip())
            if key not in asked or any(k == key for _, _, k in found):
                continue
            rules = first_col_rules(page)
            top = max([r for r in rules if r <= y + 1], default=y - 8)
            head = [t for t in ss if t["text"].strip() == "Qu" and top - 40 < t["bbox"][1] < top + 1]
            if head:
                top = max([r for r in rules if r <= head[0]["bbox"][1] + 1], default=head[0]["bbox"][1] - 8)
            found.append((pg, top - 1, key))
    return sorted(found)


def ms_parts(ms, asked):
    """{(q, p): (pieces, text)}: each part's scheme from its table's top to the next part's, less its section's heading."""
    labels = ms_labels(ms, asked)
    out = {}
    for k, (pg, y, key) in enumerate(labels):
        nxt = labels[k + 1] if k + 1 < len(labels) else None
        pieces, p = [], pg
        while True:
            f = ms_frame(ms[p])
            top = y if p == pg else f.y0
            end = nxt[1] if nxt and nxt[0] == p else f.y1
            if nxt and nxt[0] == p:
                # A table per part: stop at this one's bottom rule, not above the next one's header.
                below = [r for r in first_col_rules(ms[p]) if top + 5 < r < end - 3]
                gap = ms[p].get_text("text", clip=pymupdf.Rect(f.x0, below[-1] + 1, f.x1, end - 1)).strip() if below else None
                if gap is not None and (not gap or TAIL.match(gap)):
                    end = below[-1] + 1
            if end > top + 6 and ms[p].get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, end)).strip():
                pieces.append((p, pymupdf.Rect(f.x0, top, f.x1, end)))
            if (nxt and nxt[0] == p) or p + 1 >= len(ms):
                break
            p += 1
        pieces = cut_tail(ms, pieces)
        out[key] = (pieces, text_of(ms, pieces))
    return out


# --- multiple choice ------------------------------------------------------------------------------------------

def options(text):
    """The question paper's options: {'A': 'Conservative Party', ...}, each a letter at the start of a line with its words
    beside it (a source can list them, "A – Arson", above bare letters to shade)."""
    return {m.group(1): re.sub(r"\s+", " ", m.group(2)).strip() for m in OPTIONS.finditer(text)}


def key_of(ms_text, want, opts):
    """The scheme's letters, and any whose words don't match the question paper's option."""
    m = KEY.search(ms_text)
    if not m:
        return None, []
    said = re.sub(r"\s+", " ", m.group(1)).strip()
    found = [(a.group(1), a.group(2) or a.group(3) or "") for a in
             re.finditer(r"(?:^|\band\s+|,\s*)([A-F])\b(?:\s*\(([^)]*)\)?|\s+((?:(?!\band\s+[A-F]\b).)*))?", said)]
    letters = list(dict.fromkeys(l for l, _ in found))[:want]
    wrong = []
    for l, words in found:
        words = re.sub(r"[.‘’'\"]", "", words).strip().lower()
        opt = re.sub(r"[.‘’'\"]", "", opts.get(l, "")).strip().lower()
        if words and opt and not (words[:12] in opt or opt[:12] in words):
            wrong.append(f"{l}: scheme '{words[:40]}', paper '{opt[:40]}'")
    return " and ".join(letters) or None, wrong


# --- examiner reports -----------------------------------------------------------------------------------------

# "Question 03.1 (Multiple choice)", or the label alone on its line ("01.1 (Multiple choice)", Paper 1, June 2022).
PART_HEAD = re.compile(r"\n\s*(?:Question\s*|Q)?0?(\d{1,2})\s*\.\s*(\d{1,2})[ \t]*(?:\([^)\n]*\))?[ \t]*\n")


def examiner_report(path):
    """{'01': '01.1: …\n\n01.2: …'}: each part's comments, under the part's own heading."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"(?m)^[ \t]*(©|REPORT ON THE EXAMINATION|Copyright ©)[^\n]*$|^[ \t]*\d+ of \d+[ \t]*$", "", text)
    bits = PART_HEAD.split(text)
    out = {}
    for k in range(1, len(bits) - 2, 3):
        q, p, body = f"{int(bits[k]):02d}", bits[k + 1], bits[k + 2]
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Further support|Enhanced Results|Use of statistics)", body)[0]
        paras = [re.sub(r"\s+", " ", x).strip() for x in re.split(r"\n\s*\n", body)]
        body = "\n\n".join(x for x in paras if x)
        if body:
            out.setdefault(q, []).append(f"{q}.{p}: {body}" if not body.startswith(f"{q}.{p}") else body)
    return {q: "\n\n".join(v) for q, v in out.items()}


# --- a set ----------------------------------------------------------------------------------------------------

def opening(text, n=6):
    """A question's first few words, for matching its scheme (which reprints it)."""
    words = re.findall(r"[a-z]+", re.sub(r"Source [A-Z]\b.*", "", text, flags=re.S).lower())
    return words[:n]


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    regions = cut.regions(qp, 75, True, True)
    asked = {key for key, _, _ in regions if key[1]}
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, asked) if ms else {}
    er = examiner_report(er_path)
    # A bare label over a title alone ("0 1 Investigating the action of others") heads its question: no stem.
    stems = {q: cut_tail(qp, pieces) for (q, p), pieces, text in regions
             if p is None and (re.search(r"\bSource\b|[.?]", BOILER.sub(" ", text)) or len(re.findall(r"[A-Za-z]{2,}", BOILER.sub(" ", text))) > 8)}
    out, problems = [], []
    for (q, p), pieces, _ in regions:
        if p is None:
            continue
        pid, label = f"{set_id}-{q}-{p}", f"{q}.{p}"
        pieces = cut_tail(qp, pieces)
        text = text_of(qp, pieces)
        # Continuation pages that are only answer lines add nothing on screen.
        keep = [pieces[0]] + [(pg, r) for pg, r in pieces[1:] if len(re.findall(r"[A-Za-z]{3,}", BOILER.sub(" ", qp[pg].get_text("text", clip=r)))) >= 2]
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[pg], r)) for pg, r in keep])
        stem_name = None
        if q in stems and stems[q]:
            stem_name = f"{set_id}-{q}-stem.webp"
            if not os.path.exists(os.path.join(IMG, stem_name)):
                cut.save(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in stems[q]]), stem_name)
        marks = [int(x) for x in MARKS.findall(text)]
        marks = sum(marks) if marks else None
        mpieces, ms_text = schemes.get((q, p), ([], ""))
        stem_text = text_of(qp, stems[q]) if q in stems else ""
        opts = {**options(stem_text), **options(text)}
        mc = MCQ.search(text)
        want = {"one": 1, "two": 2}[mc.group(1).lower()] if mc else None
        # November 2020 prints its options with no "Shade in…" line: options A-D and a lettered scheme make it one.
        if not mc and {"A", "B", "C", "D"} <= set(opts) and re.search(r"Correct (?:response|answer)s?\s*[:–-]\s*[A-F]\b(?!\w)", ms_text):
            want = 2 if re.search(r"\btwo\b", text) and marks == 2 else 1
        key = None
        if want:
            key, wrong = key_of(ms_text, want, opts)
            if not key or len(key.split(" and ")) != want:
                problems.append(f"{pid}: multiple choice for {want}, key {key}")
            problems += [f"{pid}: key {w}" for w in wrong]
            if marks != want:
                problems.append(f"{pid}: multiple choice for {want}, {marks} marks printed")
        msimg = None if key else cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        flat = re.sub(r"\s+", " ", ms_text)
        if not key and not msimg:
            problems.append(f"{pid}: no scheme")
        elif ms_text:
            own = opening(re.sub(r"^\s*0\s*\d\s*\.\s*\d+", "", text))
            if own and sum(w in set(opening(flat[:400], 60)) for w in own) < len(own) - 1:
                problems.append(f"{pid}: scheme doesn't reprint '{' '.join(own)}'")
            if re.search(r"\bLevel\s+Marks\s+Descriptor", flat) or (marks or 0) >= 6:
                if not re.search(r"Nothing (?:to credit|worthy of credit)|No relevant content", flat, re.I):
                    problems.append(f"{pid}: {marks}-mark scheme without its whole levels grid")
                # The student's own investigation is marked on what "The response will" do, not on content.
                if not re.search(r"Indicative content|may (?:therefore )?include|Points which may|The (?:response|account) (?:will|may)|This account may", flat, re.I):
                    problems.append(f"{pid}: {marks}-mark scheme without its indicative content")
        if marks is None:
            problems.append(f"{pid}: no marks printed")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": label, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", (text_of(qp, stems[q]) + " " if q in stems else "") + text).strip()[:1500],
            "msText": flat.strip()[:800],
            "msPages": len({pg for pg, _ in mpieces}),
            "er": er.get(q),
            **({"key": key} if key else {}),
        })
    total = sum(p["marks"] or 0 for p in out)
    if total != 80:
        problems.append(f"{set_id}: {total} marks, not 80")
    return out, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] != "SPEC" and f["component"] in COMPONENTS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": "8100", "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} parts, {sum(1 for p in parts if p.get('key'))} keys, {sum(1 for p in parts if p['ms'])} schemes, "
                  f"{len({p['question'] for p in parts if p['er']})} questions reported, {sum(p['marks'] or 0 for p in parts)} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
