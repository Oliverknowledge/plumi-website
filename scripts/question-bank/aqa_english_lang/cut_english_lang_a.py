"""Cut AQA's A-Level English Language (7702) papers into questions, each with its texts, its mark scheme and its report.

    python3 scripts/question-bank/aqa_english_lang/cut_english_lang_a.py [work-dir] [--only=77021]   # default scripts/question-bank/.work/aqa-english-lang-a

The A-Level papers are set out like AQA's A-Level English Literature papers (answers in a separate
book, a question running from its label to the next label, "or", heading or "END OF QUESTIONS"), so
this reads them with cut_english_lit.py's A-Level paper and scheme readers, around 7702's own layout:
  - Paper 1 (Language, the individual and society): Section A analyses two texts printed in the insert
    (01 Text A, 02 Text B, 03 comparing them); Section B is either 04 or 05 on children's language
    development, each on data printed in the paper under the question (Data Set 1, a transcript, for 04;
    the written data sets for 05), which the question's crop carries.
  - Paper 2 (Language diversity and change): Section A is either 01 (diversity) or 02 (change), an essay
    on no text; Section B's 03 and 04 read two texts printed in the insert.
  - A section on the insert's texts shares a stem: its introduction (what each text is) and the insert's
    texts themselves ("77021-jun24-a-01", "77021-jun24-a-stem.webp"; Paper 2 "77022-jun24-b-03"). The
    bank's `wholes` links the insert too.
  - AQA's copyright-removed ("-CR") inserts blank out a text it hasn't the rights to: a question that
    reads a blanked text can't be answered and is left out (Paper 1 June 2022 Text B, June 2024 Text A;
    Paper 2 November 2020 Text B, June 2022 both texts, June 2023 Text A).
  - The schemes print each question's label in a box, then a page per assessment objective: its levels
    grid with the indicative content beside it. A question's scheme runs from its label to the next, so
    every objective's levels and content come with it (cut_english_lit.ms_questions_b).
  - Each question is tagged to its question type (`p1-q2`), which is also its assessment objectives.
  - The reports (June 2022, 2023 and 2025) head each question ("Question 1", "Question 3 – AO4"). A
    question gets everything under its heading up to the next one, its section's or the report's end.
"""
import json, os, re, sys, traceback

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-english-lang-a"), "--level=a"] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_english_lit"))
sys.path.insert(0, HERE)
import cut_english_lit as lit  # noqa: E402  (A-Level mode: imports cut.py with the work dir above)
import cut_english_lang as gcse  # noqa: E402

cut = lit.cut
WORK, ONLY = cut.WORK, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks
PAPERS = {"77021": {"A": ["01", "02", "03"], "B": ["04", "05"]}, "77022": {"A": ["01", "02"], "B": ["03", "04"]}}
INSERT_SECTION = {"77021": "A", "77022": "B"}  # the section that reads the insert's texts
ALTERNATIVES = {"77021": {"05"}, "77022": {"02"}}  # "Either 04 or 05", "Either 01 or 02"
REMOVED = re.compile(r"(cannot be|not) reproduced|third[- ]party copyright", re.I)
REPORT_QUESTION = re.compile(r"^Question ([1-5])\b(?:\s*[–-]\s*AO\d)?$")
REPORT_END = re.compile(r"^(Section [AB]\b|Mark ranges|Advice to students|Use of statistics|Enhanced Results|Professional development|Further support)", re.I)

_has_words = lit.has_words


def has_ink(page, rect):
    """Words, or a picture: a child's writing (Data Set 2) can fill a page with no text on it."""
    return _has_words(page, rect) or any(pymupdf.Rect(i["bbox"]).intersects(rect) for i in page.get_image_info())


lit.has_words = has_ink  # span() keeps the pages a data set's picture runs on to
# The schemes' header and footer rules run out to the left edge on even pages, the right on odd ones:
# the GCSE scheme frame drops both, where Literature's looks only to the right.
lit.ms_frame = gcse.ms_frame


def removed_texts(ins):
    """The texts AQA has blanked out of the insert: a page headed "Text A" that says it isn't reproduced.
    (A page printed as one picture, heading and all, has no words to say so: June 2023's Text A, which only blanks a photo.)"""
    out = set()
    for page in ins:
        t = page.get_text()
        m = re.search(r"^\s*Text ([A-D])\s*$", t, re.M)
        if m and REMOVED.search(t):
            out.add(m.group(1))
    return out


def report_paragraphs(path):
    """{question number: [paragraph]}: everything under each "Question N" heading, read line by line.
    A gap wider than the line spacing ends a paragraph; a sub-heading ("AO1", "More successful answers:") is one too."""
    if not path or not os.path.exists(path):
        return {}
    out, current, para, last = {}, None, [], None

    def flush():
        if current and para and len(" ".join(para)) > 3:
            out.setdefault(current, []).append(re.sub(r"\s+", " ", " ".join(para)).replace("• ", "\n• ").strip())
        para.clear()
    for page in pymupdf.open(path):
        h = page.rect.height
        for y0, x0, y1, t, bold in lit.lines_of(page):
            if y0 < 40 or y0 > h - 50 or re.match(r"^(Report on the examination|REPORT ON THE EXAMINATION|©|\d+ of \d+$)", t):
                continue
            if bold and REPORT_QUESTION.match(t):
                flush()
                current, last = int(REPORT_QUESTION.match(t).group(1)), None
                continue
            if bold and REPORT_END.match(t):
                flush()
                current, last = None, None
                continue
            if bold and len(t) < 90 or last is not None and (y0 - last > (y1 - y0) * 1.45 or y0 < last - 100):
                flush()
            if t != "•":
                para.append(t)
            last = y0
            if bold and len(t) < 90:
                flush()
        last = None
    flush()
    return out


def scheme_pieces(ms, pieces):
    """A scheme's pieces without the next section's heading ("Section B: Children's language development") at their foot."""
    while pieces and re.fullmatch(r"\s*Section [AB]\b[^\n]*\s*", ms[pieces[-1][0]].get_text("text", clip=pieces[-1][1])):
        pieces = pieces[:-1]
    return pieces


def cut_set(qp_path, ms_path, er_path, ins_path, set_id, meta):
    comp = meta["component"]
    qp = pymupdf.open(qp_path)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = lit.ms_questions_b(ms) if ms else {}
    reports = report_paragraphs(er_path)
    ins = pymupdf.open(ins_path) if ins_path and os.path.exists(ins_path) else None
    removed = removed_texts(ins) if ins else set("ABCD")
    parts, problems, left_out, stem = [], [], [], None
    for q, section, pieces, text, marks, heading, _, option, both, intro in lit.qp_questions(qp):
        reads = sorted(set(re.findall(r"\bText ([A-D])\b", text)))
        if removed.intersection(reads):
            left_out.append(f"{q} (Text {' and '.join(sorted(removed.intersection(reads)))} removed)")
            continue
        pid = f"{set_id}-{q}"
        if section == INSERT_SECTION[comp] and ins:
            pid = f"{set_id}-{section.lower()}-{q}"
            if stem is None:  # the section's introduction, then each text the insert still prints
                kept = [(d, pg, r) for d, pg, r in lit.insert_extract(ins) if not REMOVED.search(d[pg].get_text())]
                stem = cut.save(lit.render([(qp, pg, r) for pg, r in intro] + kept, 16), f"{set_id}-{section.lower()}-stem.webp")
        qimg = lit.render([(qp, pg, r) for pg, r in pieces])
        msimg, ms_text = None, ""
        if q in schemes:
            mpieces, ms_text, _ = schemes[q]
            mpieces = scheme_pieces(ms, mpieces)
            msimg = lit.render([(ms, pg, r) for pg, r in mpieces], 12)
            ms_text = "\n".join(ms[p].get_text("text", clip=r) for p, r in mpieces)
            if not re.search(r"Level 5", ms_text) or not re.search(r"Level 1", ms_text):
                problems.append(f"{pid}: scheme without its levels")
        else:
            problems.append(f"{pid}: no scheme")
        er = reports.get(int(q))
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": q, "marks": marks,
            "section": section, "or": q in ALTERNATIVES[comp], "text_code": f"p{comp[-1]}-q{int(q)}",
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": stem if pid.startswith(f"{set_id}-{section.lower()}-") else None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text).strip()[:9000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": "\n\n".join(er) if er else None,
        })
    found = sorted([p["label"] for p in parts] + [x[:2] for x in left_out])
    expected = PAPERS[comp]["A"] + PAPERS[comp]["B"]
    if found != expected:
        problems.append(f"{set_id}: questions {found}, expected {expected}")
    return parts, problems, left_out


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] in SERIES and f["component"] in PAPERS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    # One set at a time: PyMuPDF isn't thread-safe, and twelve papers are quick.
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" not in files or ONLY and not set_id.startswith(ONLY):
            continue
        pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
        meta = {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", ""), "cr": files["qp"].get("cr", False)}
        try:
            parts, issues, left_out = cut_set(pdf("qp"), pdf("ms"), pdf("er"), pdf("ins"), set_id, meta)
        except Exception:  # noqa: BLE001
            problems.append(f"{set_id}: {traceback.format_exc()}")
            continue
        print(f"{set_id}: {[p['label'] for p in parts]}" + (f", left out {left_out}" if left_out else "")
              + f", {sum(1 for p in parts if not p['ms'])} without scheme, {sum(1 for p in parts if p['er'])} reported, "
              f"{sum(p['marks'] or 0 for p in parts if not p['or'])} marks", file=sys.stderr, flush=True)
        problems += issues
        all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
