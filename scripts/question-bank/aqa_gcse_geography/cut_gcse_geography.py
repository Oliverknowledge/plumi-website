"""Cut AQA's GCSE Geography (8035) papers into question parts, each with its figures, its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_geography/cut_gcse_geography.py [work-dir] [--only=80353]   # default scripts/question-bank/.work/aqa-gcse-geography

The A-Level Geography cutter (aqa_geography/cut_geography.py) on the GCSE papers, which AQA
sets the same way: a part is its setup and any figure printed above its label, then its own
words to its marks; a scheme row runs to the next part's row, across as many pages as it takes,
so a 9-mark question's levels grid comes with all of its indicative content. What the GCSE adds:
  - Paper 3's issue evaluation (Section A) is about the pre-release resources booklet. Each of
    its questions has a stem made of the booklet's pages for the figure it names ("Study Figure 2
    in the resources booklet"), and a question that asks for "evidence from the resources booklet"
    has the whole booklet. The booklet's cover lists each figure's pages ("pages 4–5").
  - A question with no parts (Paper 3's "0 3", 9 marks + 3 SPaG) is one part, id "…-03-q", so
    its stem keeps the question's name.
  - The paper's first part keeps the setup above it ("Study Figure 1, a map showing…"), which
    the A-Level cutter starts only after a part.
  - Multiple-choice parts ("Shade one circle only", 1 mark) carry the scheme's letter as their key,
    as well as the scheme row.
  - Papers 1 and 2 print their figures in the paper. A figure "in the insert" (November 2021
    Paper 2's OS maps) is drawn into the part, as in the A-Level bank.
Optional questions (two of coasts, rivers and glacial; one of food, water and energy) are cut as
any other; check_gcse_geography.py checks the totals with the choices.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_geography"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_geography as cg  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
COMPONENTS = ("80351", "80352", "80353")
MCQ = re.compile(r"Shade one circle", re.I)
BOOKLET = re.compile(r"Figure (\d) in the resources booklet")


def labels_of(page):
    """cg.labels_of reading the boxes up to 125pt from the edge: a GCSE part runs to "0 1 . 1 1", whose last box
    sits at 111pt, past the 110pt the A-Level papers (never past part 9) are read to."""
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             if s["bbox"][0] < 125 and re.fullmatch(r"[\d.\s]+", s["text"]) and s["text"].strip() and "Bold" in s["font"]
             and s["size"] >= 9 and s["bbox"][1] < page.rect.height - 60]
    rows = []
    for s in sorted(spans, key=lambda s: ((s["bbox"][1] + s["bbox"][3]) / 2, s["bbox"][0])):
        mid = (s["bbox"][1] + s["bbox"][3]) / 2
        if rows and abs(rows[-1][0] - mid) < 6:
            rows[-1][1].append(s)
        else:
            rows.append([mid, [s]])
    out = []
    for _, row in rows:
        row.sort(key=lambda s: s["bbox"][0])
        m = cut.QLABEL.match(cut.norm("".join(s["text"] for s in row)))
        if m and row[0]["bbox"][0] < 75:
            out.append((min(s["bbox"][1] for s in row if s["text"].strip() != "."), m.group(1), m.group(2), row[0]["bbox"][0]))
    return out


cg.labels_of = labels_of
_ms_labels = cg.ms_labels


def ms_labels(page):
    """cg.ms_labels, and a row label with a stray letter before it: November 2021 Paper 3's scheme prints "s03 | 2"."""
    out = _ms_labels(page)
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    for s in spans:
        x, y = s["bbox"][0], s["bbox"][1]
        if x < 80 and 60 < y < page.rect.height - 50 and re.fullmatch(r"[a-z]0\d", s["text"].strip()):
            part = [t for t in spans if re.fullmatch(r"\d{1,2}", t["text"].strip()) and x + 18 < t["bbox"][0] < x + 60 and abs(t["bbox"][1] - y) < 3]
            out.append((y, s["text"].strip()[1:], part[0]["text"].strip() if part else None))
    return sorted(out)


cg.ms_labels = ms_labels
# A section's heading row ends the rows before it, named or not: "Section B: Fieldwork | Qu | Pt | Marking guidance".
cg.MS_STOP = re.compile(r"^(Section [A-D]\b|Question \d\b(?! *\d)|Option [A-Z]\b)")
# The GCSE's section headings name their theme on the same line ("Section B  Fieldwork", "Section A  The challenge of
# natural hazards"): headings, not the next part's setup. So are the choices' instructions ("Answer two questions from
# the following:", June 2022's "If you have answered Section B, do not answer Section C.").
cg.BARRIER = re.compile(r"^Section [A-C]\b.{0,60}$|^Answer two\b|^If you (have answered|choose)\b|" + cg.BARRIER.pattern, re.I)
_ins_frame = cg.ins_frame


def ins_frame(page):
    """cg.ins_frame, ending above an insert's back-page notices ("There is no resource material printed on this
    page", "Copyright information"), so a figure on the page before them doesn't take them along."""
    f = _ins_frame(page)
    stops = [y0 for y0, x0, y1, t, _ in cg.lines_of(page) if re.match(r"There is no resource material|Copyright information", t)]
    return pymupdf.Rect(f.x0, f.y0, f.x1, max(f.y0 + 1, min([f.y1] + [y - 6 for y in stops])))


cg.ins_frame = ins_frame


def qp_parts(doc):
    """cg.qp_parts, with the setup above the paper's first part as that part's lead."""
    parts = cg.qp_parts(doc)
    if not parts:
        return parts
    events = cg.qp_events(doc)
    first = next(n for n, e in enumerate(events) if e[3] == "label")
    before = events[:first]
    last_barrier = max((n for n, e in enumerate(before) if e[3] == "barrier"), default=-1)
    setup = [e for e in before[last_barrier + 1:] if e[3] in ("text", "marks")]
    q, p, lead, main, lead_text, main_text = parts[0]
    if setup and not lead:
        pg, y = events[first][0], events[first][1]
        lead = cg.span(doc, (setup[0][0], setup[0][1] - 6), (pg, y - 6))
        lead_text = "\n".join(doc[g].get_text("text", clip=r) for g, r in lead)
        parts[0] = (q, p, lead, main, lead_text, main_text)
    return parts


def booklet_pages(path):
    """{1: [page, ...], 2: [...], 3: [...]}: each resource's pages in the pre-release booklet, from its cover's list
    ("Figure 2 – Proposed energy from waste incinerator for Cambridge: pages 4–5"), else from the pages' own captions."""
    if not path or not os.path.exists(path):
        return {}, None
    doc = pymupdf.open(path)
    cover = re.sub(r"\s+", " ", doc[0].get_text())
    out = {}
    for fig, a, b in re.findall(r"Figure (\d)\b[^•]*?pages? (\d+)\s*(?:[–-]\s*(\d+))?", cover):
        out[int(fig)] = list(range(int(a) - 1, int(b or a)))
    if not out:
        for pg, page in enumerate(doc):
            m = re.search(r"^\s*Figure (\d)\b", page.get_text(), re.M)
            if m:
                out.setdefault(int(m.group(1)), []).append(pg)
    return out, doc


def booklet_image(doc, pages):
    """The booklet's pages, whole, inside their margins (below the page number, above the footer)."""
    imgs = []
    for pg in pages:
        page = doc[pg]
        w, h = page.rect.width, page.rect.height
        imgs.append(cut.trim_bottom(cut.render(page, pymupdf.Rect(20, 44, w - 20, h - 40)), 16))
    return cut.stack(imgs)


def mcq_key(ms_text, qp_text):
    """The letter in a multiple-choice part's scheme row, which AQA writes as the option itself ("B: 2007",
    "D. Volcanic activity", "C – Mill Lane Bridge", "A 5"): the letter whose option, as the paper prints it
    ("A  5", "D  Steep slopes"), follows it in the row."""
    options = {m.group(1): cut.norm(m.group(2)).lower() for m in re.finditer(r"^\s*([A-D])\s+(\S.*)$", qp_text, re.M)}
    for m in re.finditer(r"(?<![A-Za-z])([A-D])\s*[.:–-]?\s+(\S[^\n]{0,40})", ms_text):
        said = cut.norm(m.group(2)).lower()
        want = options.get(m.group(1), "")
        if want and (said.startswith(want[:12]) or want.startswith(said[:12])):
            return m.group(1)
    m = re.search(r"correct (?:answer|response)\s*(?:is)?\s*[:–-]?\s*\(?([A-D])\)?\b", ms_text)
    return m.group(1) if m else None


def cut_set(qp_path, ms_path, er_path, ins_path, pm_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    qp_text = "\n".join(p.get_text() for p in qp)
    parts_found = qp_parts(qp)
    figs = cg.insert_figures(ins_path) if re.search(r"in the insert", qp_text) else {}
    pages, booklet = booklet_pages(pm_path)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = cg.ms_parts(ms) if ms else {}
    labels = {f"{q}.{p}" for q, p, *_ in parts_found if p}
    er = cg.examiner_report(er_path, labels)
    out, problems, stem_imgs, stem_texts = [], [], {}, {}
    # A question's own words, all parts together, for which booklet figures its stem shows.
    qtext = {}
    for q, p, lead, main, lead_text, main_text in parts_found:
        qtext[q] = qtext.get(q, "") + " " + lead_text + " " + main_text
    with_parts = {q for q, p, *_ in parts_found if p}
    for q, p, lead, main, lead_text, main_text in parts_found:
        if p is None and q in with_parts:
            stem_imgs.setdefault(q, []).append(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in main]))
            stem_texts[q] = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in main)
    if booklet:
        for q, t in qtext.items():
            named = sorted({int(f) for f in BOOKLET.findall(t)})
            if re.search(r"evidence from the resources booklet", t):
                named = sorted(pages)
            if named:
                stem_imgs.setdefault(q, []).insert(0, booklet_image(booklet, [pg for f in named for pg in pages.get(f, [])]))
                stem_texts[q] = " ".join(f"Figure {f} in the resources booklet." for f in named) + " " + stem_texts.get(q, "")
                if any(f not in pages for f in named):
                    problems.append(f"{set_id}-{q}: names booklet figures {named}, booklet has {sorted(pages)}")
    for q, imgs in stem_imgs.items():
        cut.save(cut.stack(imgs), f"{set_id}-{q}-stem.webp")
    for q, p, lead, main, lead_text, main_text in parts_found:
        if p is None and q in with_parts:
            continue
        pid = f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}-q"
        label = f"{q}.{p}" if p else q
        lead_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in lead]
        main_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 24) for pg, r in main]
        width = max((i.width for i in lead_imgs + main_imgs if i is not None), default=1000)
        shown = cg.named_figures(lead_text + " " + main_text, figs)
        imgs = [img for fig in shown for img in figs[fig]]
        fig_imgs = [cg.fit(img, width) for k, img in enumerate(imgs) if all(img is not other for other in imgs[:k])]
        qimg = cut.stack(lead_imgs + fig_imgs + main_imgs)
        msimg, ms_text = None, ""
        if (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        marks = [int(x) for x in cg.MARKS.findall(main_text)]
        # "Either (hot deserts) … [9 marks]  Or (cold environments) … [9 marks]": one part, answered one way.
        either = re.search(r"\bEither\b", main_text) and re.search(r"\bOr\b", main_text) and len(marks) > 1 and len(set(marks)) == 1
        marks = (marks[0] if either else sum(marks)) if marks else None
        spag = re.search(r"\+\s*(\d) SPaG marks", main_text)
        key = mcq_key(ms_text, main_text) if MCQ.search(main_text) and marks == 1 else None
        if MCQ.search(main_text) and marks == 1 and not key:
            problems.append(f"{pid}: multiple choice, no letter in its scheme")
        if marks and marks >= 6 and not re.search(r"Level\s*\d|Levels? of response|\bLevel\b", ms_text):
            problems.append(f"{pid}: no levels in its {marks}-mark scheme")
        if marks and marks >= 9 and not re.search(r"ndicative|might include|may include|could include", ms_text):
            problems.append(f"{pid}: {marks}-mark scheme without indicative content")
        if re.search(r"in the insert", lead_text + main_text) and not shown:
            problems.append(f"{pid}: names the insert, no figure found")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": label, "marks": marks,
            **({"spag": int(spag.group(1))} if spag else {}),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{q}-stem.webp" if q in stem_imgs else None,
            "figures": shown,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", stem_texts.get(q, "") + " " + lead_text + " " + main_text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
            **({"key": key} if key else {}),
        })
    return out, problems


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), pdf("ins"), pdf("pm"), set_id, meta), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["component"] in COMPONENTS:
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
            no_ms = sum(1 for p in parts if not p["ms"])
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {sum(1 for p in parts if p.get('key'))} keys, "
                  f"{len({p['question'] for p in parts if p['er']})} questions reported, {len({p['question'] for p in parts if p['stem']})} stems, "
                  f"{sum(1 for p in parts if p['figures'])} with insert figures, {sum(p['marks'] or 0 for p in parts)} marks printed", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} parts, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
