"""Cut Pearson Edexcel's GCSE English Literature (1ET0) papers into questions, each with its extract, mark scheme and report.

    python3 scripts/question-bank/edexcel_gcse_english/cut_literature.py [work-dir] [--only=1et002-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-english-lit

edexcel_sciences/cut_pearson.py reads the pages (Doc), the schemes (ms_tables, carried()) and the reports
(examiner_report); the papers are laid out as the A-Level's (edexcel_english_lit/cut_english_lit.py), so finding
the questions is done here:
  - The questions are in a "Questions and Extracts Booklet": from 2022 bound in after the answer pages, before
    that the whole file. A paper is choices: a student answers on one text in each section.
    Paper 1: Section A Shakespeare, a question on each play, (a) on the extract printed above it and (b) on the
    play as a whole; Section B the post-1914 play or novel, two questions on each text, "EITHER 7 OR 8".
    Paper 2: Section A the 19th-century novel, (a) and (b) on an extract as in Paper 1; Section B Part 1 a question
    on each anthology collection, comparing the poem printed with one other; Part 2 the unseen poems, one question
    for everyone. In November 2021 and June 2022 Paper 2 was sat as 2N (the novel) and 2P (the poetry).
  - Each question runs from its number to its "(Total for Question 1 = 40 marks)"; (a) and (b) are cut apart,
    "1et001-jun24-01-a", labels "1(a)"; a whole question with a stem is "1et002-jun24-08-q". The extract or poem a question is set on, from its text's heading (or
    "Use this extract to answer Question 1.", or "Poem 1") down to the question, is the stem its parts share
    ("1et001-jun24-01-stem.webp"), so no extract question is shown without its extract.
  - Every question in a section after its first is an alternative (`or`), so a paper's marks add up to the
    questions a student answers (80 a paper; 2N 40, 2P 40).
  - The schemes give each question (and each of (a) and (b)) a table of its own, "Question Number | Indicative
    content", the text's name under the number, then the levels grids it is marked on (and, for Paper 1
    Section B, the AO4 grid for spelling and punctuation), before the next question's table: a scheme crop runs
    from its number to the next, so it carries the text's indicative content and the full level descriptors.
    A crop with no levels grid is a problem, reported (grids.py keeps the grids' level numbers from reading as labels).
  - Each question is tagged to the text, collection or unseen poetry its heading names (texts.py).
  - A scheme can label a part "(a)" with no number (November 2020's 4(a), under "A Christmas Carol"): read after
    3(b), as a second 3(a), it was dropped. A repeated (a) after a (b) is the next question's (renumber).
  - The reports head each question "Question 7" (examiner_report), or, in the November series, "Question 7, An
    Inspector Calls" (reports_of). June 2024's Paper 1 report has no text to read, and is left out.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-english-lit")
sys.argv[1:] = [WORK] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, HERE)
import pymupdf  # noqa: E402

import cut_pearson as cp  # noqa: E402
import grids  # noqa: E402
import texts  # noqa: E402

grids.patch(cp)

ONLY, IMG = cp.ONLY, cp.IMG
_carried = cp.carried


def renumber(found, doc):
    found = _carried(found, doc)
    seen = set()
    for n, (pg, top, key, y) in enumerate(found):
        if key in seen and key[1] == "a" and n and found[n - 1][2] == (key[0], "b", None):
            key = (key[0] + 1, "a", None)
            found[n] = (pg, top, key, y)
        seen.add(key)
    return found


cp.carried = renumber
BOOKLET = re.compile(r"Questions and Extracts Booklet|Do not return this Booklet", re.I)
LABEL = re.compile(r"^(\d{1,2})(?:\s|$)")
PART = re.compile(r"^\(([ab])\)")
TOTAL = re.compile(r"\(Total for Question (\d{1,2}) = (\d+) marks\)")
MARKS = re.compile(r"^\((\d{1,2})\)$")
SECTION = re.compile(r"^SECTION ([AB])\b(?:,?\s*[–-]?\s*Part (\d))?")
STEM_START = re.compile(r"^(Use this extract to answer Question|Poem 1\b)")
GRID = re.compile(r"No rewardable material", re.I)


def frame(page):
    """A booklet page's content: under its top margin, over its page number, inside its side margins."""
    w, h = page.rect.width, page.rect.height  # 595 x 842, or 652 x 899 in 2019 and November 2021
    return pymupdf.Rect(w * (0.085 if w > 620 else 0.05), h * 0.045, w * (0.895 if w > 620 else 0.95), h * 0.94)


def booklet_start(doc):
    """The booklet's first page: its cover, where the answer pages come first, else the file's first page."""
    return next((i for i in range(len(doc)) if BOOKLET.search(doc.text(i)) and not re.search(r"Candidate Number", doc.text(i))), 0)


def skip(doc, i):
    """Answer pages, blank pages and the contents page (its "Page" column)."""
    t = doc.text(i)
    return t.count(".....") > 3 or doc.blank(i) or any(l["text"] == "Page" for l in doc.lines(i))


def span(doc, start, end):
    """[(page, rect)] from (page, y) to (page, y), inside each page's frame, over pages that aren't skipped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        if skip(doc, pg) and pg != start[0]:
            continue
        f = frame(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        r = pymupdf.Rect(f.x0, top, f.x1, bottom)
        if bottom > top + 8 and re.search(r"[A-Za-z]{3,}", doc.text(pg, r)):
            pieces.append((pg, r))
    return pieces


def events_of(doc):
    """Everything that structures a paper, in reading order: [(page, y0, y1, kind, value)]."""
    out = []
    for pg in range(booklet_start(doc) + 1 if booklet_start(doc) else 0, len(doc)):
        if skip(doc, pg):
            continue
        page = doc[pg]
        f, left = frame(page), page.rect.width * 0.15
        for l in doc.lines(pg):
            if not cp.inside(l, f):
                continue
            t, x0, bold = l["text"], l["x0"], cp.bold(l["spans"][0])  # (a heading's dash can be set in another font)
            m = SECTION.match(t)
            if m and bold:
                out.append((pg, l["y0"], l["y1"], "section", m.group(1) + (m.group(2) or "")))
            elif TOTAL.search(t):
                m = TOTAL.search(t)
                out.append((pg, l["y0"], l["y1"], "total", (int(m.group(1)), int(m.group(2)))))
            elif bold and x0 < left and texts.find(t):
                out.append((pg, l["y0"], l["y1"], "heading", (t, texts.find(t))))
            elif STEM_START.match(t) and x0 < left:
                out.append((pg, l["y0"], l["y1"], "stem", t))
            elif LABEL.match(t) and x0 < left:
                out.append((pg, l["y0"], l["y1"], "label", int(LABEL.match(t).group(1))))
            elif PART.match(t) and x0 < left + 20:
                out.append((pg, l["y0"], l["y1"], "part", PART.match(t).group(1)))
            elif MARKS.match(t) and x0 > page.rect.width * 0.7:
                out.append((pg, l["y0"], l["y1"], "marks", int(MARKS.match(t).group(1))))
    return sorted(out, key=lambda e: (e[0], e[1]))


def qp_questions(doc):
    """[dict(q, part, label, section, pieces, marks, code, stem)] in order."""
    events = events_of(doc)
    out, section, code, expected, since = [], "A", None, 1, 0  # since: the index after the last question's total
    for n, (pg, y0, y1, kind, value) in enumerate(events):
        if kind == "section":
            section, code = value if value != "B" or not any(e[3] == "section" and e[4].startswith("B") and e[4] != "B" for e in events) else "B1", None
        elif kind == "heading":
            code = value[1]
        elif kind == "label" and value == expected:
            expected += 1
            total = next((e for e in events[n + 1:] if e[3] == "total" and e[4][0] == value), None)
            if not total:
                continue
            stop = (total[0], total[2] + 4)
            # The stem: from the first heading, "Use this extract" or "Poem 1" since the last question, down to this one,
            # where there is an extract or a poem between (not the few lines over a Section B text's EITHER).
            starts = [e for e in events[since:n] if e[3] in ("heading", "stem")]
            stem = []
            if starts:
                end = next((e for e in reversed(events[since:n]) if e[3] == "heading" and re.match(r"Question \d", e[4][0])), None)
                end = (end[0], end[1] - 4) if end and (end[0], end[1]) > (starts[0][0], starts[0][1]) else (pg, y0 - 5)
                stem = span(doc, (starts[0][0], starts[0][1] - 4), end)
                if len(" ".join(doc.text(p, r) for p, r in stem)) < 400:
                    stem = []
            qcode = "unseen-poetry" if section == "B2" or any(e[3] == "stem" and e[4].startswith("Poem") for e in starts) else code
            parts = [e for e in events[n + 1:events.index(total)] if e[3] == "part"]
            bounds = [(pg, y0 - 5)] + [(e[0], e[1] - 5) for e in parts] + [stop]
            names = [None] if not parts else ["a"] + [e[4] for e in parts]
            for k, letter in enumerate(names):
                pieces = span(doc, bounds[k], bounds[k + 1])
                inside = [e for e in events if e[3] == "marks" and bounds[k] <= (e[0], e[1]) < bounds[k + 1]]
                marks = inside[-1][4] if letter and inside else total[4][1] if not letter else None
                out.append(dict(q=value, part=letter, label=f"{value}({letter})" if letter else str(value), section=section,
                                pieces=pieces, marks=marks, code=qcode, stem=stem))
            since = events.index(total) + 1
    return out


REPORT_HEAD = re.compile(r"\n[ \t]*Question (\d{1,2})(?:,|:)[^\n]{0,90}\n")


def reports_of(path):
    """{"07": text}: examiner_report's, or, where it finds no "Question 7" heading of its own, each question's
    text under its "Question 7, An Inspector Calls" heading, to the next."""
    found = cp.examiner_report(path)
    if found or not path or not os.path.exists(path):
        return found
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    chunks = REPORT_HEAD.split(text)
    out = {}
    for k in range(1, len(chunks) - 1, 2):
        body = re.split(r"\n\s*(?:Paper Summary|Grade boundaries|Summary\s*\n|Based on their performance)", chunks[k + 1])[0]
        body = "\n".join("" if cp.DROP.match(line.strip()) else line.strip() for line in body.split("\n"))
        body = re.sub(r"[ \t]+", " ", re.sub(r"(?<!\n)\n(?!\n)", " ", body))
        paras = [p.strip() for p in re.split(r"\n{2,}", body) if len(p.strip()) > 40]
        if paras:
            key = f"{int(chunks[k]):02d}"
            out[key] = (out[key] + "\n\n" if key in out else "") + "\n\n".join(paras)
    return {k: v[:6000] for k, v in out.items()}


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = cp.Doc(qp_path)
    ms_doc = cp.Doc(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = cp.ms_tables(ms_doc) if ms_doc else {}
    reports = reports_of(er_path)
    parts, problems, firsts, stems = [], [], {}, {}
    for q in qp_questions(qp):
        # (the site names a stem for the id less its last piece, so a whole question with a stem is "-q", as in cut_pearson)
        pid = f"{set_id}-{q['q']:02d}" + (f"-{q['part']}" if q["part"] else "-q" if q["stem"] else "")
        if q["stem"] and q["q"] not in stems:
            stems[q["q"]] = cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in q["stem"]]), f"{set_id}-{q['q']:02d}-stem.webp")
        qimg = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in q["pieces"]])
        hit = schemes.get((q["q"], q["part"], None)) or schemes.get((q["q"], None, None))
        msimg, ms_text = None, ""
        if hit and hit[0]:
            mpieces, ms_text, _ = hit
            msimg = cp.stack([cp.trim(ms_doc.crop(pg, r), 10, sides=True) for pg, r in mpieces])
            if not GRID.search(ms_text):
                problems.append(f"{pid}: scheme has no levels grid")
        else:
            problems.append(f"{pid}: no scheme")
        if not q["code"]:
            problems.append(f"{pid}: no set text")
        # (2P prints no sections: its unseen question is everyone's, whatever collection was answered)
        section = "unseen" if q["code"] == "unseen-poetry" else q["section"]
        firsts.setdefault(section, q["q"])
        text = " ".join(qp.text(pg, r) for pg, r in q["pieces"])
        parts.append({
            "id": pid, "set": set_id, **meta, "label": q["label"], "marks": q["marks"], "section": q["section"],
            "or": firsts[section] != q["q"], "text_code": q["code"],
            "qp": cp.save(qimg, f"{pid}-qp.webp"), "ms": cp.save(msimg, f"{pid}-ms.webp"), "stem": stems.get(q["q"]),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", cp.BOILER.sub(" ", text)).strip()[:4000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": reports.get(f"{q['q']:02d}"),
        })
    return parts, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp.replace('-', '')}-{series}".lower(), files, {"component": comp, "spec": "1ET0", "series": series})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp.replace('-', '')}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            marks = sum(p["marks"] or 0 for p in parts if not p["or"])
            print(f"{set_id}: {len(parts)} questions {[p['label'] for p in parts]}, {sum(1 for p in parts if not p['ms'])} without scheme, "
                  f"{sum(1 for p in parts if p['stem'])} with a stem, {sum(1 for p in parts if p['er'])} reported, {marks} marks answered",
                  file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
