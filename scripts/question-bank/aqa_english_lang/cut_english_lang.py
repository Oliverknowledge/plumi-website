"""Cut AQA's GCSE English Language (8700) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_english_lang/cut_english_lang.py [work-dir] [--only=87002]   # default scripts/question-bank/.work/aqa-english-lang

cut.py's label finder and image helpers, with English Language's own layout around them:
  - Each paper is five questions, the same five every series. Paper 1 (Explorations in creative
    reading and writing): Section A reads one fiction source (01 list four things, 02 language,
    03 structure, 04 evaluate a statement), Section B is 05, a description or a story (either/or,
    one question). Paper 2 (Writers' viewpoints and perspectives): Section A reads two non-fiction
    sources (01 true statements, 02 summary, 03 language, 04 compare perspectives), Section B is 05,
    writing a viewpoint. Ids are "87002-jun24-03", labels "03".
  - The answers are written in the paper, so each question starts a page and runs from its label to
    the first answer line (three or more ruled lines close together), the next label, or the foot of
    the page. Paper 2's question 1 has no lines, its statements to shade run to the foot. Paper 1's
    question 2 prints its extract in a box, which a ruled box's two far-apart edges don't end.
  - The sources are in a separate insert, which each question links to (the bank's `wholes`).
    AQA blanks out a source it hasn't the rights to: where it has, the reading questions (01-04) can't
    be answered and are left out (Paper 1 in June 2022 and November 2022, 2023 and 2025; Paper 2 in
    November 2025, Source A). Their writing question (05) stands on its own and stays.
  - The schemes print each question's label in a box, then its indicative content and its levels;
    a question's scheme runs to the next label (05's to the end, AO6's grid included).
  - Each question is tagged to its question type (`p2-q3`, Paper 2's language question), which is
    also its assessment objective: the specification sets the same question in the same place each time.
  - The reports head each question ("Question 3"), or, in November 2024's Paper 1, open a paragraph
    with it in bold. A question gets everything under its heading up to the next one, or to the
    report's closing sections (mark ranges, results analysis).
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-english-lang")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
# Every series AQA publishes; the specimen papers are left out, as in the other AQA banks.
SERIES = {"NOV20", "NOV21", "JUN22", "NOV22", "JUN23", "NOV23", "JUN24", "NOV24", "JUN25", "NOV25"}
MARKS = re.compile(r"\[(\d+) marks?\]")
# An insert's pages after its cover run to some 4,000 characters (Paper 1) or 8,500 (Paper 2), its copyright
# notice included; with a source blanked out, to under 1,500 (Paper 1) or 6,000 (Paper 2).
SOURCE_CHARS = {"87001": 2500, "87002": 7000}
REPORT_END = re.compile(r"^(Mark ranges and award of grades|Enhanced Results Analysis|Professional development|Training courses|Feedback on the exams|Further support|Mark with insight)", re.I)


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold, size, lead)] top to bottom: `bold` all of the line, `lead` its first words."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in line["spans"])).strip()
            if t and spans:
                bold = all(re.search(r"Bold|Demi", s["font"]) for s in spans)
                lead = bool(re.search(r"Bold|Demi", spans[0]["font"]))
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, bold, spans[0]["size"], lead))
    return sorted(out)


def answer_top(page, below):
    """The first answer line under `below`: the top of a run of three ruled lines, each within 40pt of the last.
    The page frame's own border (the full width, at the foot) isn't one."""
    ys = sorted({round(d["rect"].y0, 1) for d in page.get_drawings()
                 if d["rect"].height < 2 and 250 < d["rect"].width < 480 and d["rect"].y0 > below})
    for i in range(len(ys) - 2):
        if ys[i + 1] - ys[i] < 40 and ys[i + 2] - ys[i + 1] < 40:
            return ys[i]
    return None


def qp_questions(doc):
    """[(label, page, rect, text, marks)]: each question from its label down to its answer lines."""
    out = []
    for pg, page in enumerate(doc):
        if cut.NOT_QUESTIONS.search(page.get_text()):
            continue
        f = cut.frame(page)
        labels = sorted(cut.left_labels(page, 75, True))
        for k, (y, q, part) in enumerate(labels):
            if part or q in {o[0] for o in out}:
                continue
            bottom = f.y1
            if k + 1 < len(labels):
                bottom = min(bottom, labels[k + 1][0] - 6)
            lines = answer_top(page, y)
            if lines is not None:
                bottom = min(bottom, lines - 4)
            # Paper 1's question 1 numbers its four answer lines: a lone "1" over the first isn't the question's.
            tail = [l for l in lines_of(page, pymupdf.Rect(f.x0, y, f.x1, bottom)) if l[0] > y + 4]
            while tail and re.fullmatch(r"\d", tail[-1][3]):
                bottom = tail.pop()[0] - 4
            rect = pymupdf.Rect(f.x0, y - 6, f.x1, bottom)
            text = page.get_text("text", clip=rect)
            marks = [int(x) for x in MARKS.findall(text)]
            out.append((q, pg, rect, text, marks[-1] if marks else None))
    return out


def ms_frame(page):
    """A scheme page's content: under the running header ("MARK SCHEME – GCSE ENGLISH LANGUAGE – …"), above the page number."""
    w, h = page.rect.width, page.rect.height
    lines = lines_of(page)
    head = [y1 for y0, x0, y1, *_ in lines if y0 < 60]
    foot = [y0 for y0, *_ in lines if y0 > h - 60]
    top, bottom = max(head) + 3 if head else 52, min(foot) - 3 if foot else h - 46
    for d in page.get_drawings():  # the header and footer rules, drawn out to one edge of the page
        r = d["rect"]
        if r.height < 3 and r.width > 300 and (r.x1 > w - 5 or r.x0 < 5):
            top = max(top, r.y1 + 2) if r.y0 < 90 else top
            bottom = min(bottom, r.y0 - 2) if r.y0 > h - 90 else bottom
    return pymupdf.Rect(30, top, w - 28, bottom)


def ms_questions(ms):
    """{label: (pieces, text)}: each question's scheme, from its boxed label to the next one or the end."""
    starts = []
    for pg, page in enumerate(ms):
        f = ms_frame(page)
        for y, q, part in cut.left_labels(page, 75, True):
            if not part and f.y0 - 4 <= y <= f.y1:
                starts.append((pg, y - 4, q))
    out = {}
    for k, (pg, y, label) in enumerate(starts):
        end = (starts[k + 1][0], starts[k + 1][1] - 2) if k + 1 < len(starts) else (len(ms) - 1, ms[-1].rect.height)
        pieces = []
        for p in range(pg, end[0] + 1):
            f = ms_frame(ms[p])
            top = max(f.y0, y) if p == pg else f.y0
            bottom = min(f.y1, end[1]) if p == end[0] else f.y1
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if bottom > top + 8 and re.search(r"[A-Za-z]{3,}", ms[p].get_text("text", clip=r)):
                pieces.append((p, r))
        out.setdefault(label, (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces)))
    return out


def report_paragraphs(path):
    """{question number: [paragraph]}: everything under each "Question N" heading, read line by line.
    A gap wider than the line spacing ends a paragraph; a heading of its own is a paragraph too."""
    if not path or not os.path.exists(path):
        return {}
    out, current, para, last = {}, None, [], None

    def flush():
        if current and para and len(" ".join(para)) > 3:
            out.setdefault(current, []).append(re.sub(r"\s+", " ", " ".join(para)).replace("• ", "\n• ").strip())
        para.clear()
    for page in pymupdf.open(path):
        h = page.rect.height
        for y0, x0, y1, t, bold, size, lead in lines_of(page):
            if y0 < 40 or y0 > h - 50 or re.match(r"^(Report on the examination|REPORT ON THE EXAMINATION|©|\d+ of \d+$)", t):
                continue
            head = re.fullmatch(r"Question ([1-5])", t)
            if head and size >= 13:
                flush()
                current, last = int(head.group(1)), None
                continue
            if size >= 13 and REPORT_END.match(t):
                flush()
                current, last = None, None
                continue
            # November 2024's Paper 1 opens each question's paragraph with it, in bold: "Question 4 presented…".
            opener = re.match(r"^Question ([1-5])\b(?! and)", t)
            if opener and lead and size < 13 and len(t) > 20:
                flush()
                current = int(opener.group(1))
            elif bold and len(t) < 90 or last is not None and (y0 - last > (y1 - y0) * 1.45 or y0 < last - 100):
                flush()
            if t != "•":
                para.append(t)
            last = y0
            if bold and len(t) < 90 and not opener:
                flush()  # a sub-heading ("Common misunderstandings") is its own paragraph
        last = None
    flush()
    return out


def render(pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for doc, pg, r in pieces])


def sources_removed(ins_path, component):
    """Whether AQA has blanked out the insert's sources (or one of them)."""
    if not ins_path or not os.path.exists(ins_path):
        return True
    ins = pymupdf.open(ins_path)
    return sum(len(p.get_text()) for p in ins[1:]) < SOURCE_CHARS[component]


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_questions(ms) if ms else {}
    reports = report_paragraphs(er_path)
    removed = sources_removed(ins_path, meta["component"])
    insert_text = ""
    if not removed:  # the sources, so a quotation from one finds its questions
        insert_text = " ".join(p.get_text() for p in pymupdf.open(ins_path)[1:] if "Copyright information" not in p.get_text())
    paper = meta["component"][-1]
    parts, problems = [], []
    for q, pg, rect, text, marks in qp_questions(qp):
        if removed and q != "05":
            continue
        pid = f"{set_id}-{q}"
        qimg = render([(qp, pg, rect)])
        msimg, ms_text = None, ""
        if q in schemes:
            mpieces, ms_text = schemes[q]
            msimg = render([(ms, p, r) for p, r in mpieces], 12)
        else:
            problems.append(f"{pid}: no scheme")
        er = reports.get(int(q))
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": q, "marks": marks,
            "section": "B" if q == "05" else "A", "or": False, "text_code": f"p{paper}-q{int(q)}",
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text + (" " + insert_text if q != "05" else "")).strip()[:9000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": "\n\n".join(er) if er else None,
        })
    found = [p["label"] for p in parts]
    expected = ["05"] if removed else ["01", "02", "03", "04", "05"]
    if found != expected:
        problems.append(f"{set_id}: questions {found}, expected {expected}")
    return parts, problems, removed


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), pdf("ins"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], False, traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] in SERIES and f["component"] in SOURCE_CHARS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", ""), "cr": files["qp"].get("cr", False)})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    missing = sorted(f"{c}-{s}" for (c, s), files in sets.items() if "qp" not in files)
    all_parts, problems = [], [f"{m}: no question paper" for m in missing]
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, removed, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {[p['label'] for p in parts]}{' (sources removed: writing only)' if removed else ''}, "
                  f"{sum(1 for p in parts if not p['ms'])} without scheme, {sum(1 for p in parts if p['er'])} reported, "
                  f"{sum(p['marks'] or 0 for p in parts)} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
