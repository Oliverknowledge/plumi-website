"""Cut AQA's GCSE Business (8132) papers into question parts, each with its items, its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_business/cut_gcse_business.py [work-dir] [--only=81321]   # default scripts/question-bank/.work/aqa-gcse-business

Both papers are set alike: Section A is question 01 (01.1-01.6 multiple choice, then short
answers to 01.12), Sections B and C are questions 02 and 03, each on one business told in
items printed through the question ("Item A" under the "0 2" label, "Item B" before 02.4,
"Item E" before the last part).
  - Parts are the GCSE Geography cutter's (cut_gcse_geography.py, so cut_geography.py's
    qp_parts): a part is its setup and any table or figure printed above its label, then its
    own words to its marks, and the options under a multiple-choice part.
  - A question's items are its stem ("81321-jun24-02-stem.webp"): every item it prints, in
    order, whether it opens the question, sits above a part ("Item B: …" before 02.4) or comes
    under a "0 2" label of its own (Paper 2, June 2022). So a part is shown with the items it
    uses, the ones printed after it included, and no part's crop repeats an item.
  - The answer space's prompts ("Method 1", "Workings", "Answer", "£") end a part, as its
    rules do, and are no part's setup.
  - The schemes are not tables: each part is its label ("2.3", at the margin), its words again,
    then its guidance and its levels grid, up to the next label or section heading, across as
    many pages as it takes. Multiple-choice answers come from Section A's "Question Number /
    Answer" table, as the part's key.
  - Examiner's reports head each part ("Question 2.3", or "2.3" alone in November 2020), and
    Section A's multiple choice together ("Questions 1.1 – 1.6"); cut_business.py's reader keeps
    them by question. A section commented on as a whole (Paper 1, November 2020's Sections B
    and C) is its question's report.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-business")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_geography"))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_business"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_gcse_geography as cgg  # noqa: E402  (patches cut_geography's labels and barriers for the GCSE)
import cut_business as cb  # noqa: E402

cg = cgg.cg
WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
COMPONENTS = ("81321", "81322")
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks
ITEM = re.compile(r"^\s*Item [A-Z]\b")
MCQ = re.compile(r"Shade one circle|Which (one )?of the following", re.I)

# The answer space's prompts, set under a part's marks: barriers, so a part ends at its marks and they lead nothing.
cg.BARRIER = re.compile(r"^(£|%|\$|€|Answer\b.{0,4}$|Workings?$|Formula$|(Method|Reason|Factor|Advantage|Disadvantage|Benefit|Drawback|Way|Example|Source|Objective|Stakeholder|Cost)s?\s*\d$|Explanation$|\d$)|" + cg.BARRIER.pattern, re.I)
# Section A's multiple choice is reported together: "Questions 1.1 – 1.6", "Questions 1.1 to 1.6", kept for question 01.
cb.REPORT_HEAD = re.compile(cb.REPORT_HEAD.pattern.replace(
    r"Questions?[ \t]+0?(\d{1,2})(?:\.(\d{1,2}))?",
    r"Questions?[ \t]+0?(\d{1,2})(?:\.(\d{1,2})(?![ \t]*(?:–|-|to)[ \t]*\d)|\.\d{1,2}[ \t]*(?:–|-|to)[ \t]*0?\d{1,2}\.\d{1,2})?", 1))
MS_STOP = re.compile(r"^(Section [A-C]\b|Assessment [Oo]bjectives?\b|Multiple [Cc]hoice [Qq]uestions)")
MS_LABEL = re.compile(r"(\d)\.(\d{1,2})")


def ms_events(ms):
    """[(page, y, kind, value)]: each part's label ("2.3", bold, at the margin) and the headings that end a section."""
    events = []
    for pg, page in enumerate(ms):
        if pg < 2:
            continue  # the cover and the general guidance
        f = cg.ms_frame(page)
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                s = next((s for s in line["spans"] if s["text"].strip()), None)
                if s and s["bbox"][0] < 64 and "Bold" in s["font"] and f.y0 - 4 <= s["bbox"][1] <= f.y1 and (m := MS_LABEL.fullmatch(s["text"].strip())):
                    events.append((pg, s["bbox"][1], "label", (f"{int(m.group(1)):02d}", m.group(2))))
        for y0, x0, y1, t, bold in cg.lines_of(page, f):
            if bold and MS_STOP.match(t):
                events.append((pg, y0, "stop", t))
    return sorted(events, key=lambda e: (e[0], e[1]))


def ms_parts(ms, order):
    """{(q, part): (pieces, text)}: each part's scheme, from its label to the next part's label or a section heading."""
    rank = {k: n for n, k in enumerate(order)}
    events = ms_events(ms)
    out, last = {}, -1
    for n, (pg, y, kind, value) in enumerate(events):
        if kind != "label" or value not in rank or value in out or rank[value] < last:
            continue
        last = rank[value]
        end = (len(ms) - 1, ms[-1].rect.height)
        for pg2, y2, kind2, value2 in events[n + 1:]:
            if kind2 == "stop" or (kind2 == "label" and value2 in rank and rank[value2] > last):
                end = (pg2, y2 - 6)
                break
        pieces = cg.span(ms, (pg, y - 6), end, cg.ms_frame)
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


def mcq_keys(ms):
    """Section A's "Question Number / Answer" table: {('01', '1'): 'B', ...}, the letter beside each number."""
    keys = {}
    for page in ms:
        if not re.search(r"Multiple [Cc]hoice", page.get_text()):
            continue
        spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
        for s in spans:
            m = MS_LABEL.fullmatch(s["text"].strip())
            if not m or s["bbox"][0] > 320:
                continue
            # The letter alone ("B"), or with the answer's words in the same span ("B – Money owed to suppliers").
            letter = [t for t in spans if re.match(r"[A-D](\s*[–-]|$)", t["text"].strip()) and abs(t["bbox"][1] - s["bbox"][1]) < 3 and 0 < t["bbox"][0] - s["bbox"][0] < 100]
            if letter:
                keys[(f"{int(m.group(1)):02d}", m.group(2))] = letter[0]["text"].strip()[0]
    return keys


def section_reports(path):
    """{"01": …, "02": …, "03": …}: a report's comments on a section where it writes them as prose, under the
    section's heading, rather than part by part (Paper 1, November 2020)."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"REPORT ON THE EXAMINATION[^\n]*\n|\n\s*\d+ of \d+\s*\n|\n\s*©[^\n]*", "\n", text)
    out = {}
    for q, sec in (("01", "A"), ("02", "B"), ("03", "C")):
        m = re.search(rf"\n[ \t]*Section {sec}[ \t]*\n(.*?)(?=\n[ \t]*Section [A-D][ \t]*\n|Mark Ranges and Award of Grades|Further support|Enhanced Results Analysis|$)", text, re.S)
        if m:
            body = re.sub(r"(?<!\n)\n(?!\n)", " ", re.sub(r"[ \t]+\n", "\n", m.group(1))).strip()
            body = re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))
            if len(body) > 80:
                out[q] = body
    return out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    found = cg.qp_parts(qp)
    order = [(q, p) for q, p, *_ in found if p]
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, order) if ms else {}
    keys = mcq_keys(ms) if ms else {}
    er = cb.examiner_report(er_path, order)
    er = {**section_reports(er_path), **er}
    text_of = lambda pieces: "\n".join(qp[pg].get_text("text", clip=r) for pg, r in pieces)  # noqa: E731
    render = lambda pieces, keep: [cut.trim_bottom(cut.render(qp[pg], r), keep) for pg, r in pieces]  # noqa: E731
    # Each question's items, in the order they're printed: under its label, above a part, or under a label of their own.
    items, item_text = {}, {}
    for q, p, lead, main, lead_text, main_text in found:
        if p is None:
            items.setdefault(q, []).extend(main)
            item_text[q] = item_text.get(q, "") + " " + text_of(main)
        elif ITEM.match(lead_text):
            items.setdefault(q, []).extend(lead)
            item_text[q] = item_text.get(q, "") + " " + lead_text
    for q, pieces in items.items():
        cut.save(cut.stack(render(pieces, 16)), f"{set_id}-{q}-stem.webp")
    out, problems = [], []
    for q, p, lead, main, lead_text, main_text in found:
        if p is None:
            continue
        # An item is the stem's; a lead that is only answer space ("Answer %") is nobody's.
        if ITEM.match(lead_text) or len(re.findall(r"[A-Za-z]{3,}", lead_text)) < 3:
            lead, lead_text = [], ""
        pid = f"{set_id}-{q}-{p}"
        qimg = cut.stack(render(lead, 16) + render(main, 24))
        marks = [int(x) for x in cg.MARKS.findall(main_text)]
        marks = sum(marks) if marks else None
        msimg, ms_text, key = None, "", None
        if marks == 1 and (q, p) in keys:
            key = keys[(q, p)]
        elif (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        if not key and not msimg:
            problems.append(f"{pid}: no scheme")
        if q == "01" and MCQ.search(main_text) and marks == 1 and not key:
            problems.append(f"{pid}: multiple choice, no key")
        if marks and marks >= 6 and not re.search(r"Level\s*\n?\s*Marks", ms_text):
            problems.append(f"{pid}: no levels grid in its {marks}-mark scheme")
        if marks and marks >= 9 and not re.search(r"ndicative content|Answers may include|Application", ms_text):
            problems.append(f"{pid}: {marks}-mark scheme without its content")
        if q != "01" and q not in items:
            problems.append(f"{pid}: no item")
        named = set(re.findall(r"\bItems? ([A-E])\b", lead_text + main_text))
        missing = sorted(i for i in named if f"Item {i}" not in item_text.get(q, ""))
        if missing:
            problems.append(f"{pid}: names Item {missing}, not in its stem")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": f"{q}.{p}", "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{q}-stem.webp" if q in items else None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            # The part's own words first: its stem is the whole case, which would push them out.
            "text": re.sub(r"\s+", " ", lead_text + " " + main_text + " " + item_text.get(q, "")).strip()[:3000],
            "msText": cb.scheme_words(ms_text)[:800],
            "er": er.get(q),
            **({"key": key} if key else {}),
        })
    return out, problems


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
        if f["series"] in SERIES and f["component"] in COMPONENTS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            marks = sum(p["marks"] or 0 for p in parts)
            print(f"{set_id}: {len(parts)} parts, {sum(1 for p in parts if p.get('key'))} keys, {sum(1 for p in parts if p['ms'])} schemes, "
                  f"{len({p['question'] for p in parts if p['er']})} questions reported, {len({p['question'] for p in parts if p['stem']})} stems, {marks} marks", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {marks} marks, not 90"] if marks != 90 else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
