"""Cut AQA's GCSE History (8145) papers into questions, each with its sources, its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_history/cut_gcse_history.py [work-dir] [--only=81451ab]   # default scripts/question-bank/.work/aqa-gcse-history

The GCSE Geography cutter (aqa_gcse_geography/cut_gcse_geography.py, which is the A-Level one with
the GCSE's labels) on the History papers, which AQA sets the same way: every question has a bare
label ("0 1") and no parts, so each is one part, id "…-01-q", cut from the setup above it ("Study
Sources B and C in the Sources Booklet.") to its marks. What History adds:
  - The sources and interpretations are in the insert ("Sources Booklet", "Interpretations
    Booklet"), each from its heading ("Source B", "Interpretation A") to the next or "END OF
    SOURCES". A question's stem (<set>-<q>-stem.webp) is the ones it names ("Interpretations A
    and B", "Sources B and C"), so a student sees them above it.
  - Where AQA's copyright-removed insert blanks a source it names ("Source A cannot be reproduced
    here due to third-party copyright restrictions"), the question is left out: it can't be
    answered without it.
  - The schemes aren't tables: each question's scheme is under its label boxes ("0 | 1", set as two
    spans), with the question reprinted, then its target, levels and indicative content, running
    to the next question's label, across as many pages as it takes. "Question 04 requires students
    to produce an extended response…", printed above the label, is the next question's.
  - Reports are one per section from June 2022 (81451A covers Options A-D), headed by option
    ("1AB: Germany, 1890–1945", "8145/2B/C", "BA Conflict and Tension…") and then by question
    ("Question 3"); November 2020's are one per option.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-history")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_geography"))
import cut_gcse_geography as cgg  # noqa: E402

cut, cg = cgg.cut, cgg.cg
WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
HEAD = re.compile(r"^(Source|SOURCE|Interpretation|INTERPRETATION) ([A-F])(\s{2,}\S.*)?$")  # "Interpretation A  An interpretation of …" (2BC)
END = re.compile(r"^(END\s+OF\s+(SOURCES|INTERPRETATIONS)|Copyright information|There are no sources|There are no interpretations|BLANK\s+PAGE)", re.I)
REMOVED = re.compile(r"(cannot be|not) reproduced here|has been removed due to", re.I)
NAMED = re.compile(r"\b(Sources?|Interpretations?) ([A-F](?:(?:\s*,\s*|\s+and\s+)[A-F])*)\b")
_ms_labels = cg.ms_labels


def ms_labels(page):
    """cg.ms_labels, and History's question boxes: "0" and its digit as two spans on one baseline, about 20pt apart."""
    out = _ms_labels(page)
    h = page.rect.height
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             if s["text"].strip() and 60 < s["bbox"][1] < h - 50 and "Bold" in s["font"]]
    for s in spans:
        x, y = s["bbox"][0], s["bbox"][1]
        if x < 70 and s["text"].strip() == "0":
            digit = [t for t in spans if re.fullmatch(r"\d", t["text"].strip()) and x + 12 < t["bbox"][0] < x + 30 and abs(t["bbox"][1] - y) < 2]
            if digit and not any(abs(o[0] - y) < 3 for o in out):
                out.append((y, "0" + digit[0]["text"].strip(), None))
    return sorted(out)


cg.ms_labels = ms_labels


def ms_parts(ms):
    """cg.ms_parts, each question's scheme starting at the "Question 04 requires…" note above its label."""
    out = cg.ms_parts(ms)
    for (q, p), (pieces, text) in list(out.items()):
        pg, r = pieces[0]
        f = cg.ms_frame(ms[pg])
        note = [y0 for y0, x0, y1, t, b in cg.lines_of(ms[pg], pymupdf.Rect(f.x0, f.y0, f.x1, r.y0))
                if re.match(rf"Question {q}\b.*requires", t)]
        if note:
            pieces = [(pg, pymupdf.Rect(r.x0, note[0] - 4, r.x1, r.y1))] + pieces[1:]
            out[(q, p)] = (pieces, "\n".join(ms[g].get_text("text", clip=c) for g, c in pieces))
        # and the question before it ends above the note
        for (q2, p2), (pieces2, _) in list(out.items()):
            g, c = pieces2[-1]
            if note and (q2, p2) != (q, p) and g == pg and c.y1 > note[0] - 4 and c.y0 < note[0]:
                pieces2 = pieces2[:-1] + [(g, pymupdf.Rect(c.x0, c.y0, c.x1, note[0] - 6))]
                out[(q2, p2)] = (pieces2, "\n".join(ms[g2].get_text("text", clip=c2) for g2, c2 in pieces2))
    return out


def ins_sources(path):
    """{'A': (image, text, removed)}: each source or interpretation in the insert, from its heading to the next one,
    "END OF SOURCES" or the page's end; a page with no heading (a long one's second page) goes on from the one before."""
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    pieces = {}
    current = None
    for pg, page in enumerate(doc):
        if pg == 0:
            continue
        w, h = page.rect.width, page.rect.height
        lines = cg.lines_of(page)
        foot = [y0 for y0, x0, y1, t, b in lines if y0 > h - 60]
        top = max([y1 for y0, x0, y1, t, b in lines if y0 < 55 and re.fullmatch(r"\d{1,2}", t)] + [40]) + 4
        bottom = min(foot + [h - 40]) - 4
        marks = [(y0, "head", HEAD.match(t).group(2)) for y0, x0, y1, t, b in lines if HEAD.match(t) and x0 < w * 0.2]  # left of the text column (142pt, or 173pt on a landscape page)
        marks += [(y0, "end", None) for y0, x0, y1, t, b in lines if END.match(t)]
        marks.sort()
        y = top
        for y0, kind, src in marks + [(bottom + 4, "end", None)]:
            if current and y0 - 4 > y + 6:
                pieces.setdefault(current, []).append((pg, pymupdf.Rect(20, y - 2, w - 20, min(y0 - 4, bottom))))
            if kind == "head":
                current, y = src, y0 - 4
            else:
                current = None if kind == "end" and y0 <= bottom else current
                y = y0
            if y0 > bottom:
                break
    out = {}
    for src, ps in pieces.items():
        ps = [(pg, r) for pg, r in ps if cg.has_content(doc[pg], r)]
        text = "\n".join(doc[pg].get_text("text", clip=r) for pg, r in ps)
        imgs = [cut.trim_bottom(cut.render(doc[pg], r), 16) for pg, r in ps]
        out[src] = (cut.stack(imgs), text, bool(REMOVED.search(text)))
    return out


def named_sources(text):
    """The sources a question names, in order: "Sources B and C" -> ['B', 'C']."""
    out = []
    for kind, letters in NAMED.findall(text):
        for s in re.findall(r"[A-F]", letters):
            if s not in out:
                out.append(s)
    return out


# The report's option headings: "1AB: Germany…", "1A/A America…", "1 AB Germany…", "8145/2B/C", "Paper 2AB: Britain…", "BA Conflict…"
OPTION = re.compile(r"^(?:8145/([12])([AB])/([A-E])\b|(?:Paper )?([12]) ?([AB]) ?/?([A-E])\b(?=[:\s]|$)|([AB])([A-E]) (?=[A-Z]))")
QHEAD = re.compile(r"^Questions? 0?([1-6])(?:\s*(?:and|&)\s*0?([1-6]))?\s*$")


def examiner_reports(path, section, option=None):
    """{('81451ab', '01'): comments}: a section's report split by option and question; a report for one option is that option's."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"^[ \t]*(©|REPORT ON THE EXAMINATION|Report on the examination|Copyright ©)[^\n]*$|^[ \t]*\d+ of \d+[ \t]*$", "", text, flags=re.M)
    lines = [l.strip() for l in text.split("\n")]
    out, opt, qs, para = {}, option, [], []

    def flush():
        if opt and qs and para:
            words = re.sub(r"\s+", " ", " ".join(para)).strip()
            for q in qs:
                out.setdefault((opt, q), []).append(words)
        para.clear()

    for line in lines:
        m = OPTION.match(line) if len(line) < 110 else None
        if m and not option:
            g = [x for x in m.groups() if x]
            code = (section[:5] + "".join(g[-2:])) if len(g) == 2 else f"8145{g[0]}{g[1]}{g[2]}"
            if code[:6] == section:
                flush()
                opt, qs = code.lower(), []
                continue
        h = QHEAD.match(line)
        if h:
            flush()
            qs = [f"{int(x):02d}" for x in h.groups() if x]
            continue
        if re.match(r"^(General( [Cc]omments)?|Mark Ranges and Award of Grades|Concluding Remarks|Further support)\s*$", line):
            flush()
            qs = []
            continue
        if not line:
            flush()
        else:
            para.append(line)
    flush()
    return {k: "\n\n".join(v) for k, v in out.items()}


def cut_set(qp_path, ms_path, ins_path, set_id, meta, reports):
    qp = pymupdf.open(qp_path)
    parts_found = cgg.qp_parts(qp)
    sources = ins_sources(ins_path)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms) if ms else {}
    out, problems, dropped = [], [], []
    for q, p, lead, main, lead_text, main_text in parts_found:
        pid = f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}-q"
        named = named_sources(lead_text + " " + main_text)
        missing = [s for s in named if s not in sources]
        removed = [s for s in named if s in sources and sources[s][2]]
        if missing:
            problems.append(f"{pid}: names {named}, insert has {sorted(sources)}")
        if removed or missing:
            dropped.append(f"{pid} (source {', '.join(removed + missing)} {'blanked' if removed else 'missing'})")
            continue
        stem_text = ""
        if named:
            imgs = [sources[s][0] for s in named]
            width = max(i.width for i in imgs if i is not None)
            cut.save(cut.stack([cg.fit(i, width) for i in imgs if i is not None]), f"{set_id}-{q}-stem.webp")
            stem_text = "\n".join(sources[s][1] for s in named)
        lead_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in lead]
        main_imgs = [cut.trim_bottom(cut.render(qp[pg], r), 24) for pg, r in main]
        qimg = cut.stack(lead_imgs + main_imgs)
        msimg, ms_text = None, ""
        if (q, p) in schemes:
            mpieces, ms_text = schemes[(q, p)]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in mpieces])
        marks = [int(x) for x in cg.MARKS.findall(main_text)]
        marks = sum(marks) if marks else None
        spag = re.search(r"\[SPaG (\d) marks?\]", main_text)
        if not msimg:
            problems.append(f"{pid}: no scheme")
        elif not re.search(r"Level\s*\d", ms_text):
            problems.append(f"{pid}: no levels in its scheme")
        elif marks and marks >= 8 and not re.search(r"Level\s*[34]", ms_text):
            problems.append(f"{pid}: {marks}-mark scheme without its top levels")
        if spag and not re.search(r"[Ss]pelling, punctuation", ms_text):
            problems.append(f"{pid}: SPaG marks, no SPaG grid in its scheme")
        if not marks:
            problems.append(f"{pid}: no marks")
        out.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": str(int(q)) if not p else f"{int(q)}.{p}", "marks": marks,
            **({"spag": int(spag.group(1))} if spag else {}),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{q}-stem.webp" if named else None, "sources": named,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "stemText": re.sub(r"\s+", " ", stem_text).strip()[:1500],
            "text": re.sub(r"\s+", " ", lead_text + " " + main_text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": reports.get((meta["component"].lower(), q)),
        })
    return out, problems, dropped


def run_set(job):
    set_id, files, meta, reports = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, *cut_set(pdf("qp"), pdf("ms"), pdf("ins"), set_id, meta, reports), None
    except Exception:  # noqa: BLE001
        return set_id, [], [], [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets, reports = {}, {}
    for f in manifest:
        if f["kind"] == "er":
            path = os.path.join(WORK, "pdf", f["file"])
            whole = len(f["component"]) == 6
            got = examiner_reports(path, f["component"][:6], None if whole else f["component"].lower())
            for (opt, q), v in got.items():
                reports.setdefault((opt, f["series"]), {})[(opt, q)] = v
            print(f"report {f['component']} {f['series']}: {len({o for o, q in got})} options, {len(got)} questions", file=sys.stderr)
        else:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": "8145", "series": series, "paperTitle": files["qp"].get("title", "")},
             reports.get((comp.lower(), series), {}))
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems, dropped = [], [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
        dropped = [d for d in json.load(open(os.path.join(WORK, "dropped.json"))) if not d.startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, gone, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} questions, {sum(1 for p in parts if not p['ms'])} without scheme, {sum(1 for p in parts if p['stem'])} with sources, "
                  f"{sum(1 for p in parts if p['er'])} reported, {len(gone)} left out, {sum(p['marks'] or 0 for p in parts)} marks", file=sys.stderr, flush=True)
            problems += issues
            dropped += gone
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    json.dump(dropped, open(os.path.join(WORK, "dropped.json"), "w"), indent=0)
    print(f"{len(all_parts)} questions; {len(dropped)} left out for a blanked source; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
