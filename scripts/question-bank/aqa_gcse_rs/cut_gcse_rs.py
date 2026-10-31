"""Cut AQA's GCSE Religious Studies A (8062) papers into question parts, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_rs/cut_gcse_rs.py [work-dir] [--only=806213]   # default scripts/question-bank/.work/aqa-gcse-rs

The GCSE Geography cutter (aqa_gcse_geography/cut_gcse_geography.py, itself the A-Level one) on
the RS papers, which AQA sets the same way: every question is five parts, "0 1 . 1" to "0 1 . 5"
(1, 2, 4, 5 and 12 marks), a part running from its label to its marks. What RS adds:
  - A question's bare label ("0 1") heads it with its theme or area ("Theme A: Relationships and
    families", "Christianity: Beliefs"): a heading, not a stem, so no stem crop is made.
  - The multiple-choice part (every question's first)'s "Put a tick (✓) in the box next to the correct answer." and its
    options A-D stay with it (the Geography cutter would take that sentence for the next part's
    setup); its key is the scheme's "Answer: D   Sinful". A two-mark part's answer lines are
    numbered "1" and "2"; the crop ends above them.
  - The schemes aren't tables: each reprints its part with the same boxed label, then its
    guidance. A part's scheme runs from its label to the next part's, across as many pages as it
    takes, less the heading above the next question ("Christianity: Practices", "Theme B: …",
    "Section B"), so a 12-mark scheme has its levels grid and all of its indicative content.
  - Paper 2B's Section A is Paper 2A's themes A-F, the same questions on the same afternoon: only
    its Section B (St Mark's Gospel, questions 07 and 08) is kept, and the cutter checks that the
    rest matches 2A word for word.
  - The reports comment by part ("1.1", "7.3"), under the theme's heading on Component 2: a
    part's label says which question the paragraphs after it are about.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-rs")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_geography"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_gcse_geography as g  # noqa: E402

cg = g.cg
WORK, ONLY = cut.WORK, cut.ONLY
# Component 1's papers in AQA's order (8062/11 to /17), and what each one's scheme calls it.
RELIGION = {"806211": "Buddhism", "806212": "Catholic Christianity", "806213": "Christianity", "806214": "Hinduism",
            "806215": "Islam", "806216": "Judaism", "806217": "Sikhism"}
COMPONENTS = list(RELIGION) + ["80622A", "80622B"]
TICK = re.compile(r"Put a tick", re.I)
SPAG = re.compile(r"\[(?:Plus\s+)?SPaG\s+(\d)\s+marks\]", re.I)
# What heads a question in a scheme, above its first part's label.
HEAD = re.compile(r"^(Section [AB]\b|Theme [A-H]\b|(Buddhism|Catholic Christianity|Christianity|Hinduism|Islam|Judaism|Sikhism)\s*:|You should answer)")
_setup_line = cg.setup_line


def setup_line(e, margin):
    """cg.setup_line, but the multiple-choice instruction ("Put a tick …") is this part's, not the next one's setup."""
    return _setup_line(e, margin) and not TICK.match(e[4])


cg.setup_line = setup_line
# Section B's instruction and a theme's heading, above 2B's question 07, are the paper's, not its first part's setup.
cg.BARRIER = re.compile(r"^You should answer|^Theme [A-H]\b|" + cg.BARRIER.pattern, re.I)


def ms_frame(page):
    """cg.ms_frame from 14pt in: June 2022's Islam scheme sets its first labels at 18pt, left of the frame's 30pt."""
    f = cg.ms_frame(page)
    return pymupdf.Rect(14, f.y0, f.x1, f.y1)


def clip_numbered_lines(doc, main):
    """A crop's last piece ends under its marks when all that follows them is the answer lines' numbers ("1", "2")."""
    if not main:
        return main
    pg, r = main[-1]
    lines = cg.lines_of(doc[pg], r)
    marks = [k for k, l in enumerate(lines) if cg.MARKS.search(l[3]) or SPAG.search(l[3])]
    if not marks:
        return main
    after = lines[marks[-1] + 1:]
    if after and all(re.fullmatch(r"\d", l[3]) for l in after):
        return main[:-1] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, lines[marks[-1]][2] + 6))]
    return main


def box_top(page, y):
    """The top of the boxes a label at y is printed in, else a little above its digits: some schemes draw them 8pt above."""
    tops = [d["rect"].y0 for d in page.get_drawings() if d["rect"].x0 < 130 and 8 < d["rect"].height < 26 and d["rect"].width < 30 and y - 14 <= d["rect"].y0 <= y]
    return min(tops) - 2 if tops else y - 6


def ms_parts(ms):
    """{('01', '3'): (pieces, text)}: each part's scheme, from its label to the next part's label (or the heading above it)."""
    labels = []
    for pg, page in enumerate(ms):
        if pg == 0:
            continue
        f = ms_frame(page)
        labels += [(pg, y, (q, p)) for y, q, p, x in g.labels_of(page) if p and f.y0 - 4 <= y <= f.y1]
    out = {}
    for k, (pg, y, key) in enumerate(labels):
        if key in out:
            continue
        if k + 1 < len(labels):
            pg2, y2, _ = labels[k + 1]
            top = y if pg2 == pg else 0
            heads = [l[0] for l in cg.lines_of(ms[pg2]) if top < l[0] < y2 - 2 and HEAD.match(l[3])]
            end = (pg2, min(heads) - 6 if heads else box_top(ms[pg2], y2) - 1)
        else:
            end = (len(ms) - 1, ms[-1].rect.height)
        pieces = cg.span(ms, (pg, box_top(ms[pg], y)), end, ms_frame)
        out[key] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


PART = re.compile(r"^(?:Questions?\s*|Qn?\.?\s*)?0?([1-8])\.([1-5])(?![\d])")
REF = re.compile(r"(?<![\d.£$])0?([1-8])\.([1-5])(?![\d.]*\d)(?!\s*(?:%|per ?cent))")


def examiner_report(path, labels):
    """{'01': comments}: a part's label ("1.1", "7.3", on its own or opening a paragraph) and a theme's heading ("Theme G: …")
    say which question the paragraphs after them are about; the general comments before the first are kept for every
    question they name ("in 1.3, …")."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"^[ \t]*(©|REPORT ON THE EXAMINATION|Report on the examination|Copyright ©)[^\n]*$|^[ \t]*\d+ of \d+[ \t]*$", "", text, flags=re.M)
    text = re.sub(r"[ \t]+\n", "\n", text)
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    known = lambda q: f"{q:02d}" if any(lab.startswith(f"{q:02d}.") for lab in labels) else None  # noqa: E731
    out, current = {}, []
    for para in paras:
        if not para or re.match(r"(AQA Education \(AQA\)|Contents\b|The below table is interactive|Published:|Version:|Further copies|Further support|Mark Ranges|Use of statistics|Enhanced Results|Online Results)", para):
            if para.startswith(("Further support", "Mark Ranges", "Enhanced Results")):
                current = []
            continue
        theme = re.match(r"^Theme ([A-H])\b", para)
        if theme and len(para) < 120:
            q = known("ABCDEFGH".index(theme.group(1)) + 1)
            current = [q] if q else []
            continue
        m = PART.match(para)
        if m and known(int(m.group(1))):
            current = [known(int(m.group(1)))]
            if len(para) < 12:
                continue
        mine = current or sorted({known(int(a)) for a, b in REF.findall(para) if known(int(a))})
        for q in mine:
            if para not in out.get(q, []):
                out.setdefault(q, []).append(para)
    return {q: "\n\n".join(ps) for q, ps in out.items()}


def mcq_key(ms_text, qp_text):
    m = re.search(r"Answer\s*:?\s*([A-D])\b", ms_text)
    return m.group(1) if m else g.mcq_key(ms_text, qp_text)


def own_words(text):
    return re.sub(r"\s+", " ", re.sub(r"^\s*0\s*\d\s*\.\s*\d", "", text)).strip()


def cut_set(qp_path, ms_path, er_path, set_id, meta, keep):
    qp = pymupdf.open(qp_path)
    parts_found = cg.qp_parts(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms) if ms else {}
    if ms and meta["component"] in RELIGION:
        cover = re.sub(r"\s+", " ", ms[0].get_text())
        assert f"Paper 1: {RELIGION[meta['component']]}" in cover or f"Paper 1 {RELIGION[meta['component']]}" in cover, cover[:120]
    labels = {f"{q}.{p}" for q, p, *_ in parts_found if p}
    er = examiner_report(er_path, labels)
    out, problems, others = [], [], {}
    for q, p, lead, main, lead_text, main_text in parts_found:
        if p is None:
            continue  # the question's heading
        pid = f"{set_id}-{q}-{p}"
        if not keep(q):
            others[f"{q}.{p}"] = own_words(main_text)
            continue
        main = clip_numbered_lines(qp, main)
        main_text = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in main)
        imgs = [cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in lead] + [cut.trim_bottom(cut.render(qp[pg], r), 24) for pg, r in main]
        qimg = cut.stack(imgs)
        msimg, ms_text = None, ""
        if (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        marks = [int(x) for x in cg.MARKS.findall(main_text)]
        marks = sum(marks) if marks else None
        spag = SPAG.search(main_text)
        mcq = p == "1"  # every question opens on a multiple-choice part
        key = mcq_key(ms_text, main_text) if mcq else None
        want = {"1": 1, "2": 2, "3": 4, "4": 5, "5": 12}[p]
        if marks != want:
            problems.append(f"{pid}: {marks} marks printed, {want} expected")
        if mcq and not key:
            problems.append(f"{pid}: multiple choice, no letter in its scheme")
        if not ms_text:
            problems.append(f"{pid}: no scheme")
        elif not re.match(r"\s*0\s*" + q[1] + r"\s*\.\s*" + p, ms_text):
            problems.append(f"{pid}: scheme doesn't open on its label")
        if marks == 12:
            if not re.search(r"Level\s+Criteria|^\s*4\s*$", ms_text, re.M) or not re.search(r"\b1[–-]3\b", ms_text):
                problems.append(f"{pid}: 12-mark scheme without its levels")
            if not re.search(r"Arguments in support|might include|may include|Indicative", ms_text, re.I):
                problems.append(f"{pid}: 12-mark scheme without its indicative content")
        if re.search(r"0\s*" + q[1] + r"\s*\.\s*" + str(int(p) + 1) + r"\b", ms_text[20:]) and int(p) < 5:
            problems.append(f"{pid}: scheme runs into the next part")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": f"{q}.{p}", "marks": marks,
            **({"spag": int(spag.group(1))} if spag else {}),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", lead_text + " " + main_text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "msPages": len({pg for pg, _ in schemes.get((q, p), ([], ""))[0]}),
            "er": er.get(q),
            **({"key": key} if key else {}),
        })
    return out, problems, others


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    keep = (lambda q: q in ("07", "08")) if meta["component"] == "80622B" else (lambda q: True)
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta, keep), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], {}, traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["component"] in COMPONENTS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": "8062", "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems, section_a = [], [], {}
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, others, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} parts, {sum(1 for p in parts if not p['ms'])} without scheme, {sum(1 for p in parts if p.get('key'))} keys, "
                  f"{len({p['question'] for p in parts if p['er']})} questions reported, {sum(p['marks'] or 0 for p in parts)} marks printed", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
            if others:
                section_a[set_id.split("-")[1]] = others
    # 2B's Section A against 2A's themes, part by part.
    for series, others in sorted(section_a.items()):
        twin = {p["label"]: own_words(re.sub(r"^.*?(?=0\s*\d\s*\.\s*\d)", "", p["text"], count=1)) for p in all_parts if p["set"] == f"80622a-{series}"}
        differ = [lab for lab, t in others.items() if twin.get(lab, "")[:200] != t[:200]]
        print(f"80622b-{series}: Section A {len(others) - len(differ)} of {len(others)} parts word for word 2A's" + (f"; differ: {differ}" if differ else ""), file=sys.stderr)
        if differ:
            problems.append(f"80622b-{series}: Section A parts differ from 2A: {differ}")
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
