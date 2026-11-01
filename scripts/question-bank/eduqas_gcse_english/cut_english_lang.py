"""Cut Eduqas's GCSE English Language (C700QS) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/eduqas_gcse_english/cut_english_lang.py [work-dir] [--only=c700u20-jun24]
    # work-dir: .work/eduqas-gcse-english-lang (fetch_english.py lang); needs: pip install pymupdf pillow

common.py's page helpers, with the Language papers' layout around them. Every paper since June 2017 is set
the same way, and answered in a separate booklet, so a question is only its printed words:
  - Component 1 (20th Century Literature Reading and Creative Prose Writing): Section A, five questions
    on a prose passage printed in the insert ("Read lines 1-5." 01 [5], 02 [5], 03 [10], 04 [10], 05 [10]);
    Section B, question 11, a choice of four titles for a story [40].
  - Component 2 (19th and 21st Century Non-Fiction Reading and Transactional/Persuasive Writing): Section A,
    questions 11 to 16 on two texts, the 21st-century one in the insert (11, three one-mark parts, and 12),
    the 19th-century one printed in the paper itself, on the page after the questions (13 and 14), then both
    (15 and 16); Section B, two pieces of writing, 21 and 22 [20 each].
  - A question's number is two boxed digits ("1" "3"). Its crop runs from the number, or from the instruction
    printed over it at the left margin ("To answer the following questions read the account on the opposite
    page..."), to the next question's; a section's first question starts at the section's heading, so its
    rubric is read with it. Ids are "c700u20-jun24-13-q", labels "13". The in-paper text is the stem of
    questions 13 to 16 ("c700u20-jun24-13-stem.webp"); the questions on the insert's text say so (`src`)
    and link to it.
  - The scheme reprints each question under its number, then its marking notes and levels; a Section A
    question's notes run to the next number. Section B's begin with band descriptors for the whole section
    and a grid (Component 2's for both tasks, "21 + 22"), then a page of task-specific guidance per question
    ("Question 2.1 - Additional task-specific guidance"), up to the assessment objective weightings: a
    writing question's crop is the section's descriptors and grid with its own guidance.
  - The report has a chapter per component, comments under "Q.1", "Q1.2", "Question 0.3" (Component 1's
    0.1-0.5 and 1.1, Component 2's 1.1-1.6, 2.1 and 2.2), some opening the paragraph they head. A question
    no comment names gets its section's ("Section B Creative Writing"), or none.

Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <question>-stem.webp, and <work-dir>/parts.json, in
edexcel_english_lit/cut_english_lit.py's shape, for build_english.py.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common  # noqa: E402
from common import blank, boxed, frame, lines, pieces, render, save, stack, text_of  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
DEBUG = "--debug" in sys.argv
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-gcse-english-lang")
IMG = os.path.join(WORK, "img")
common.use(IMG)

MARKS = re.compile(r"\[(\d{1,2})\]")
# Each paper's questions, by section, and their topic (the question type, the same every series).
QUESTIONS = {
    "c700u10": {"A": ["01", "02", "03", "04", "05"], "B": ["11"]},
    "c700u20": {"A": ["11", "12", "13", "14", "15", "16"], "B": ["21", "22"]},
}
TOPIC = {("c700u10", "01"): "c1-q1", ("c700u10", "02"): "c1-q2", ("c700u10", "03"): "c1-q3", ("c700u10", "04"): "c1-q4",
         ("c700u10", "05"): "c1-q5", ("c700u10", "11"): "c1-writing",
         ("c700u20", "11"): "c2-q1", ("c700u20", "12"): "c2-q2", ("c700u20", "13"): "c2-q3", ("c700u20", "14"): "c2-q4",
         ("c700u20", "15"): "c2-q5", ("c700u20", "16"): "c2-q6", ("c700u20", "21"): "c2-writing", ("c700u20", "22"): "c2-writing"}
# Read with the insert open: Component 1's reading questions, Component 2's on the 21st-century text and on both.
ON_INSERT = {("c700u10", q) for q in ("01", "02", "03", "04", "05")} | {("c700u20", q) for q in ("11", "12", "15", "16")}
STEMMED = {"13", "14", "15", "16"}  # Component 2's questions on the text printed in the paper
TOTAL = {"c700u10": 80, "c700u20": 80}


# ---------- question paper ----------

def qp_layout(doc, comp):
    """{q: (page, y) its start}, {q: (page, y) its number}, [(section, page, y)], (page, y) the paper's end, [extract pages]."""
    labels, at, sections, end, extract = {}, {}, [], (len(doc) - 1, doc[-1].rect.height), []
    for pg in range(1, len(doc)):
        page = doc[pg]
        if blank(page):
            continue
        ls = lines(page, frame(page))
        found = boxed(ls)
        heads = [l for l in ls if l["bold"] and re.match(r"^SECTION ([AB])\b", l["text"])]
        for l in heads:
            sections.append((l["text"][8], pg, l["y0"]))
        stop = next((l for l in ls if re.match(r"^(END OF PAPER|The space below can be used)", l["text"])), None)
        if stop and end[0] == len(doc) - 1 and end[1] == doc[-1].rect.height:
            end = (pg, stop["y0"])
        if not found and not heads and len(page.get_text()) > 1000:
            extract.append(pg)  # Component 2's 19th-century text
            continue
        for l, n in found:
            if n in labels:
                continue  # Component 1's Section B prints its number beside each of its four titles
            # The instruction over a question, at the left margin, is read with it.
            top = l["y0"]
            above = sorted((o for o in ls if o["y1"] <= l["y0"] + 1 and o["x0"] < 100 and not re.fullmatch(r"\*?\d( \d)?", o["text"])),
                           key=lambda o: -o["y0"])
            for o in above:
                if top - o["y1"] > 14 or o["bold"] and re.match(r"^SECTION", o["text"]):
                    break
                top = o["y0"]
            labels[n] = (pg, top)
            at[n] = (pg, l["y0"])
    return labels, at, sections, end, extract


def qp_questions(doc, comp):
    labels, at, sections, end, extract = qp_layout(doc, comp)
    out, problems = [], []
    want = QUESTIONS[comp]
    order = [(sec, q) for sec in "AB" for q in want[sec]]
    starts = []
    for sec, q in order:
        if q not in labels:
            problems.append(f"no question {q}")
            continue
        head = next(((pg, y) for s, pg, y in sections if s == sec), None)
        first = q == want[sec][0]
        starts.append((sec, q, (head[0], head[1] - 4) if first and head else (labels[q][0], labels[q][1] - 5)))
    for n, (sec, q, start) in enumerate(starts):
        stop = (starts[n + 1][2][0], starts[n + 1][2][1] - 3) if n + 1 < len(starts) else (end[0], end[1] - 4)
        ps = pieces(doc, start, stop, True, extract)
        out.append({"q": q, "section": sec, "pieces": ps, "own": re.split(r"\[\d", common.own_text(doc, ps, at[q]))[0].strip()})
    stem = [(pg, frame(doc[pg])) for pg in extract]
    if comp == "c700u20" and not stem:
        problems.append("no text printed in the paper")
    return out, stem, problems


# ---------- mark scheme ----------

def ms_blocks(doc, comp):
    """{q: pieces}: Section A's notes per question, and Section B's descriptors and grid with each question's guidance."""
    labels, section_b, weights, guidance = {}, None, None, {}
    for pg in range(1, len(doc)):
        page = doc[pg]
        ls = lines(page, frame(page, False))
        for l in ls:
            t = l["text"]
            # (June 2023's Component 2 has no heading: its Section B opens with the writing grid, "21 + 22")
            if (l["bold"] and re.match(r"^SECTION B\b", t, re.I) or re.match(r"^2\s*1\s*\+\s*2\s*2", t)) and section_b is None and labels:
                section_b = (pg, l["y0"])
            elif re.search(r"ASSESSMENT OBJECTIVE WEIGHTINGS", t) and weights is None and section_b:
                over = next((o for o in ls if re.fullmatch(r"COMPONENT \d", o["text"]) and 0 < l["y0"] - o["y0"] < 30), l)
                weights = (pg, over["y0"])
            elif section_b and l["bold"] and (m := re.match(r"^Question\s*2\.?\s*([12])\b.*guidance", t, re.I)):
                guidance.setdefault("2" + m.group(1), (pg, l["y0"]))
        if section_b and not weights and comp == "c700u20":
            # Or the guidance's heading over the question's boxed number (June 2023); not the grid's "21 + 22"
            for l, n in boxed(ls, 120):
                if n in ("21", "22") and not any("+" in o["text"] and abs(o["y0"] - l["y0"]) < 4 for o in ls):
                    head = next((o for o in ls if o["bold"] and "guidance" in o["text"] and 0 <= l["y0"] - o["y0"] < 14), l)
                    guidance.setdefault(n, (pg, head["y0"]))
        if section_b is None:
            for l, n in boxed(ls, 120):
                if n in labels or n not in QUESTIONS[comp]["A"]:
                    continue
                top = l["y0"]
                # (the question reprinted over its number, "To answer the following questions…", is bold)
                for o in sorted((o for o in ls if o["y1"] <= l["y0"] + 1 and o["bold"]), key=lambda o: -o["y0"]):
                    if top - o["y1"] > 14:
                        break
                    top = o["y0"]
                labels[n] = (pg, top)
    last = (len(doc) - 1, doc[-1].rect.height)
    out = {}
    a = [q for q in QUESTIONS[comp]["A"] if q in labels]
    for n, q in enumerate(a):
        stop = labels[a[n + 1]] if n + 1 < len(a) else section_b or last
        out[q] = pieces(doc, (labels[q][0], labels[q][1] - 4), (stop[0], stop[1] - 3), False)
    if section_b:
        end = weights or last
        b = QUESTIONS[comp]["B"]
        if len(b) == 1 or not all(q in guidance for q in b):
            for q in b:
                out[q] = pieces(doc, (section_b[0], section_b[1] - 4), (end[0], end[1] - 3), False)
        else:
            shared = pieces(doc, (section_b[0], section_b[1] - 4), (guidance[b[0]][0], guidance[b[0]][1] - 3), False)
            for n, q in enumerate(b):
                stop = guidance[b[n + 1]] if n + 1 < len(b) else end
                out[q] = shared + pieces(doc, (guidance[q][0], guidance[q][1] - 4), (stop[0], stop[1] - 3), False)
    return out


# ---------- examiner's report ----------

def report(path, comp):
    """{q: text, ("s", section): text}: the component's chapter, sorted by the question each paragraph comments on."""
    if not path or not os.path.exists(path):
        return {}
    no = comp[5]
    chunk = common.chapter(common.report_text(path), no)
    out, buf = {}, []
    state = {"section": "A", "target": None}

    def flush():
        para = re.sub(r"\s+", " ", " ".join(buf)).strip()
        buf.clear()
        if para and state["target"] and not re.fullmatch(r"\d{1,3}", para):
            out.setdefault(state["target"], []).append(para)

    for raw in chunk.split("\n"):
        line = raw.strip()
        if not line:
            flush()
            continue
        m = re.match(r"^Section ([AB])\b", line)
        if m and len(line) < 40:
            flush()
            state.update(section=m.group(1), target=("s", m.group(1)))
            continue
        m = re.match(r"^(?:Q\.?\s*|Question\s+)(\d)(?:\s*\.\s*(\d)|(\d))?\b\.?\s*(?:\(?[a-c]\)?)?\s*(.*)$", line)
        if m:
            flush()
            d1, d2, rest = m.group(1), m.group(2) or m.group(3), m.group(4)
            if d2:
                q = d1 + d2
            elif no == "1":
                q = "11" if state["section"] == "B" else "0" + d1
            else:
                q = ("2" if state["section"] == "B" else "1") + d1
            if q == "11" and no == "1":
                state["section"] = "B"
            state["target"] = q
            if rest:
                buf.append(rest)
            continue
        buf.append(line)
    flush()
    return {k: "\n\n".join(v) for k, v in out.items()}


def comments(rep, q, section):
    text = rep.get(q)
    if not text and (section == "B" and q == "11"):
        text = rep.get(("s", "B"))
    return common.cap(text) if text and len(text) > 80 else None


# ---------- one sitting ----------

def cut_set(job):
    set_id, files, meta = job
    try:
        comp = meta["component"]
        qp = pymupdf.open(os.path.join(WORK, "pdf", files["qp"]["file"]))
        ms = pymupdf.open(os.path.join(WORK, "pdf", files["ms"]["file"])) if "ms" in files else None
        questions, stem, problems = qp_questions(qp, comp)
        schemes = ms_blocks(ms, comp) if ms else {}
        rep = report(os.path.join(WORK, "pdf", files["er"]["file"]), comp) if "er" in files else {}
        stem_img = render(qp, stem, 16) if stem else None
        stem_text = text_of(qp, stem) if stem else ""
        parts = []
        for qn in questions:
            q = qn["q"]
            pid = f"{set_id}-{q}-q"
            img = render(qp, qn["pieces"])
            text = text_of(qp, qn["pieces"])
            marks = sum(int(m) for m in MARKS.findall(text))
            stem_name = save(stem_img, f"{set_id}-{q}-stem.webp") if q in STEMMED and stem_img and comp == "c700u20" else None
            ms_ps = schemes.get(q)
            msimg = render(ms, ms_ps, 12) if ms_ps else None
            ms_text = text_of(ms, ms_ps) if ms_ps else ""
            if ms and not msimg:
                problems.append(f"{pid}: no scheme")
            elif ms_ps and qn["section"] == "A" and not re.search(rf"[\[(]{marks}[\])]", ms_text.replace(" ", "")) and marks > 3:
                problems.append(f"{pid}: scheme doesn't print [{marks}]")
            er = comments(rep, q, qn["section"])
            if DEBUG:
                print(set_id, q, marks, len(qn["pieces"]), "ms pages", sorted({pg for pg, _ in ms_ps or []}), "er", len(er or ""), file=sys.stderr)
            parts.append({
                "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": q, "marks": marks or None,
                "section": qn["section"], "or": False, "text_code": TOPIC[(comp, q)], "src": (comp, q) in ON_INSERT,
                "qp": save(img, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
                "w": img.width if img else 0, "h": img.height if img else 0,
                "text": (text + " " + (stem_text if stem_name else "")).strip()[:4000], "msText": ms_text[:800], "er": er, "own": qn["own"],
            })
        return set_id, parts, problems, None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc(limit=6)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4].upper(), "series": series})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    parts_path = os.path.join(WORK, "parts.json")
    all_parts = [p for p in json.load(open(parts_path)) if not p["set"].startswith(ONLY)] if ONLY and os.path.exists(parts_path) else []
    problems = []
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(cut_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            marks = sum(p["marks"] or 0 for p in parts)
            print(f"{set_id}: {len(parts)} questions {[(p['label'], p['marks']) for p in parts]}, {sum(1 for p in parts if not p['ms'])} without scheme, "
                  f"{sum(1 for p in parts if p['er'])} reported", file=sys.stderr, flush=True)
            if marks != TOTAL[set_id[:7]]:
                problems.append(f"{set_id}: {marks} marks, not {TOTAL[set_id[:7]]}")
            problems += [f"{set_id}: {p}" for p in issues]
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
