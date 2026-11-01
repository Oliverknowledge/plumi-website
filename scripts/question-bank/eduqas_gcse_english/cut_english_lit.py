"""Cut Eduqas's GCSE English Literature (C720QS) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/eduqas_gcse_english/cut_english_lit.py [work-dir] [--only=c720u10-jun24] [--debug]
    # work-dir: .work/eduqas-gcse-english-lit (fetch_english.py lit); needs: pip install pymupdf pillow

common.py's page helpers, with the Literature papers' layout around them. Every paper is answered in a separate
booklet, so a question is its printed words and the text it's set on:
  - Each set text has a heading ("Macbeth"), then its question or questions, numbered in two boxes ("2" "1").
    Component 1 Section A gives each play an extract question (21, the extract on the opposite page) and an
    essay (22); Section B (the anthology) prints one poem with question 71 and asks 72 to compare it with
    another. Component 2 gives each post-1914 text (01-10) and each 19th-century novel (21-26) one question on
    an extract printed below it or opposite; Section C prints an unseen poem with 31 and another with 32.
    November 2021's Component 1 was Shakespeare and post-1914 prose/drama; June 2022 split both components
    into five papers (C722), one per section.
  - A text's block runs from its heading to the next heading (a text's, a section's, or END OF PAPER), the
    anthology's and the unseen poems' from their section's heading. A one-question block is that question,
    extract and all. In a two-question block the first runs to the second's number and takes the pages after
    the second's page (the extract opposite); the second runs to the foot of its own page. The second anthology
    or unseen question compares with the first one's poem, which is its stem ("c720u20-jun24-32-stem.webp").
    Ids are "c720u10-jun24-21-q", labels "21". The anthology's list of poems is left out.
  - A student answers on one text in a section, so every block after a section's first is an alternative (`or`).
  - The scheme gives each question its heading, number and indicative content, with an AO4 grid (spelling and
    punctuation) under the questions that carry those marks; a question's notes run to the next question's
    number, or the next grid. The levels grids are printed once per section ("GENERIC ASSESSMENT OBJECTIVES
    GRID", for "Questions 01 to 10", "Question 31"; Shakespeare's an extract grid and an essay grid), landscape
    in places and over two pages: a question's crop is its notes with its grid stacked under them.
  - The report has a chapter per component ("COMPONENT 1", June 2022's "COMPONENT 1A (SHAKESPEARE)"), commented
    by text (Shakespeare's extract questions, then under "Essay questions" the essays), by question ("Question
    3.1"), or by section: each question gets the most particular comments there are.

Writes <work-dir>/img/<id>-qp.webp, -ms.webp and <question>-stem.webp, and <work-dir>/parts.json, in
edexcel_english_lit/cut_english_lit.py's shape, for build_english.py.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common  # noqa: E402
import texts  # noqa: E402
from common import blank, boxed, frame, lines, pieces, render, save, stack, text_of  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
DEBUG = "--debug" in sys.argv
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-gcse-english-lit")
IMG = os.path.join(WORK, "img")
common.use(IMG)

MARKS = re.compile(r"\[(\d{1,2})(?:\+(\d))?\]")
# A section's heading, as printed over it ("SECTION B (19th Century Prose)", or alone on a June 2022 paper's first page).
SECTION_NAMES = [("unseen", r"Unseen"), ("anthology", r"Poetry"), ("shakespeare", r"Shakespeare"), ("modern", r"1914"), ("novel", r"19th")]
# The marks a paper's answers add up to: 40 a section.
TOTAL = {"c720u10": 80, "c720u20": 120, "c722u10a": 40, "c722u10b": 40, "c722u20a": 40, "c722u20b": 40, "c722u20c": 40}


def section_kind(t):
    return next((k for k, pat in SECTION_NAMES if re.search(pat, t, re.I)), None)


def section_heading(l, first_page):
    t = l["text"]
    if not l["bold"]:
        return None
    if re.match(r"^SECTION [A-C]\b", t):
        return section_kind(t)
    if first_page and re.fullmatch(r"(Post.?1914 Prose/Drama|Poetry( Anthology)?|19th Century Prose|Unseen Poetry|Shakespeare)", t, re.I):
        return section_kind(t)
    return None


# ---------- question paper ----------

def qp_events(doc):
    """[(page, y, kind, value)] in reading order: sections, text headings, question numbers (with their rows), END OF PAPER;
    and the pages left out (the anthology's list of poems)."""
    ev, skip = [], set()
    for pg in range(1, len(doc)):
        page = doc[pg]
        if blank(page):
            continue
        if "poems you have studied" in page.get_text():
            # (the anthology's list of poems: its section starts here, but the list is left out)
            skip.add(pg)
            ev += [(pg, l["y0"], "section", "anthology") for l in lines(page, frame(page)) if section_heading(l, False) == "anthology"][:1]
            continue
        ls = lines(page, frame(page))
        found = boxed(ls)
        for l in ls:
            if re.match(r"^END OF\s+PAPER", l["text"]):
                ev.append((pg, l["y0"], "end", None))
            elif (kind := section_heading(l, pg == 1 or not any(e[2] == "section" for e in ev))):
                ev.append((pg, l["y0"], "section", kind))
        # A text's heading is on the page of its question (a speaker's name in an extract is not a heading).
        head = next((l for l in ls if l["bold"] and texts.find(l["text"]) and found), None)
        if head:
            # (Component 2 boxes the number beside the heading: the heading comes first)
            y = min([head["y0"]] + [l["y0"] for l, n in found if abs(l["y0"] - head["y0"]) < 12]) - 0.5
            ev.append((pg, y, "heading", texts.find(head["text"])))
        ev += [(pg, l["y0"], "label", n) for l, n in found]
    rank = {"section": 0, "heading": 1, "label": 2, "end": 3}
    return sorted(ev, key=lambda e: (e[0], round(e[1]), rank[e[2]])), skip


def qp_blocks(doc):
    """[{section, code, start, end, labels: [(page, y, n)]}] per text (or per poetry section)."""
    ev, skip = qp_events(doc)
    last = (len(doc) - 1, doc[-1].rect.height)
    starts, section = [], None
    for pg, y, kind, value in ev:
        if kind == "section":
            section = value
            if value in ("anthology", "unseen") and not (starts and starts[-1]["section"] == value):
                starts.append({"section": value, "code": "poetry-anthology" if value == "anthology" else "unseen-poetry", "start": (pg, y)})
        elif kind == "heading" and texts.section_of(value) not in ("anthology", "unseen"):
            starts.append({"section": texts.section_of(value), "code": value, "start": (pg, y)})
    bounds = sorted({(pg, y) for pg, y, kind, value in ev if kind in ("section", "heading", "end")})
    for b in starts:
        b["end"] = next((x for x in bounds if x > b["start"] and not (b["section"] in ("anthology", "unseen") and
                                                                         any(e[:2] == x and e[2] == "section" and e[3] == b["section"] for e in ev))), last)
        b["labels"] = [(pg, y, n) for pg, y, kind, n in ev if kind == "label" and b["start"] <= (pg, y) < b["end"]]
    return starts, skip


def page_end(doc, pg):
    return frame(doc[pg]).y1


def qp_questions(doc):
    blocks, skip = qp_blocks(doc)
    out, problems, firsts = [], [], {}
    for b in blocks:
        labs, (spg, sy), (epg, ey) = b["labels"], b["start"], b["end"]
        firsts.setdefault(b["section"], b["code"])
        alt = firsts[b["section"]] != b["code"]
        if len(labs) == 1:
            pg, y, n = labs[0]
            out.append({"q": n, "block": b, "or": alt, "at": (pg, y), "pieces": pieces(doc, (spg, sy - 4), (epg, ey - 4), True, skip)})
        elif len(labs) == 2:
            (p1, y1, n1), (p2, y2, n2) = labs
            first = pieces(doc, (spg, sy - 4), (p2, y2 - 5), True, skip)
            if epg > p2 or (epg == p2 and False):
                first += pieces(doc, (p2 + 1, 0), (epg, ey - 4), True, skip)
            second = pieces(doc, (p2, y2 - 5), (p2, min(page_end(doc, p2), ey - 4 if epg == p2 else 1e9)), True, skip)
            out.append({"q": n1, "block": b, "or": alt, "at": (p1, y1), "pieces": first})
            out.append({"q": n2, "block": b, "or": alt, "at": (p2, y2), "pieces": second, "stem_of": n1 if b["section"] in ("anthology", "unseen") else None})
        else:
            problems.append(f"{b['code']}: {len(labs)} question numbers {[n for _, _, n in labs]}")
    return out, problems


# ---------- mark scheme ----------

def grid_names(text):
    """The questions a grid's heading names: "Questions 0 1 to 1 0", "Question 3 1", "7 2"; "extract" or "essay" for Shakespeare's."""
    t = re.sub(r"(\d) (\d)", r"\1\2", text)
    if re.search(r"Extract questions", text, re.I):
        return {"extract"}
    if re.search(r"Essay questions", text, re.I):
        return {"essay"}
    m = re.search(r"(\d\d)\s*to\s*(\d\d)", t)
    if m:
        return {f"{n:02d}" for n in range(int(m.group(1)), int(m.group(2)) + 1)}
    return set(re.findall(r"(?<!\d)(\d\d)(?!\d)", t[:120]))


def ms_layout(doc):
    """{label: (page, y)} each question's notes' start, [(start, names)] each grid's, and where grids end."""
    labels, grids, stops = {}, [], []
    for pg in range(1, len(doc)):
        page = doc[pg]
        ls = lines(page, frame(page, False))
        heads = [l for l in ls if re.search(r"ASSESSMENT OBJECTIVES? GRID|^(Extract|Essay) questions$", l["text"], re.I)]
        # (Section C's second grid is headed only "Question 3 2")
        heads += [l for l in ls if l["bold"] and re.fullmatch(r"Question", l["text"]) and l["y0"] < 150 and not any(0 <= l["y0"] - h["y0"] < 60 for h in heads)]
        # (a section's indicative content, after its grids, opens under its heading: the grids end there)
        for o in ls:
            if o["bold"] and re.match(r"^SECTION [A-C]\b", o["text"], re.I) and not any(0 < h["y0"] - o["y0"] < 30 for h in heads):
                stops.append((pg, o["y0"]))  # the heading over a section's notes, not over its grid
            elif re.fullmatch(r"INDICATIVE CONTENT", o["text"].strip()):
                over = next((h for h in ls if h["bold"] and re.match(r"^SECTION", h["text"], re.I) and 0 < o["y0"] - h["y0"] < 40), o)
                stops.append((pg, over["y0"]))
        for h in heads:
            over = next((o for o in ls if re.match(r"^\(?SECTION|^[A-Z ()0-9-]+$", o["text"]) and o["bold"] and 0 < h["y0"] - o["y0"] < 30), h)
            near = " ".join(o["text"] for o in ls if h["y0"] - 30 <= o["y0"] <= h["y0"] + 60 and (len(o["text"]) < 30 or o is h))
            names = grid_names(h["text"] if re.match(r"^(Extract|Essay)", h["text"], re.I) else near)
            if re.match(r"^Essay", h["text"], re.I) and grids and grids[-1][1] == {"extract"} or not re.match(r"^(Extract|Essay)", h["text"], re.I) or not grids or grids[-1][0][0] != pg:
                grids.append(((pg, (over if not re.match(r"^(Extract|Essay)", h["text"], re.I) else h)["y0"]), names))
            elif names:
                grids[-1] = (grids[-1][0], grids[-1][1] | names)
        for l, n in boxed(ls, 120):
            # (not a grid's own heading, "Question 3 1", nor the "1 1 and 1 2" over two questions' notes)
            if any(0 <= l["y0"] - h["y0"] < 70 for h in heads) or n in labels:
                continue
            if any(re.fullmatch(r"and|to|\+|\d", o["text"]) and abs(o["y0"] - l["y0"]) < 4 and o["x0"] > l["x0"] + 30 for o in ls if o is not l):
                continue
            top = l["y0"]
            for o in sorted((o for o in ls if o["y1"] <= l["y0"] + 1 and o["bold"]), key=lambda o: -o["y0"]):
                if top - o["y1"] > 14:
                    break
                top = o["y0"]
            # (and the text's heading over it, "Othello", when it's printed a line or two higher)
            head = next((o for o in ls if o["bold"] and texts.find(o["text"]) and 0 < top - o["y0"] < 130), None)
            labels[n] = (pg, head["y0"] if head else top)
    return labels, sorted(grids), stops


def ms_blocks(doc):
    """{label: (notes pieces, grid pieces)}."""
    labels, grids, stops = ms_layout(doc)
    last = (len(doc) - 1, doc[-1].rect.height)
    # The scheme ends where Eduqas stamps its file name ("C720U10-1 EDUQAS GCSE Eng Lit Comp 1 MS S24/DM")
    stamp = [(pg, l["y0"]) for pg in range(len(doc)) for l in lines(doc[pg]) if re.match(r"C7\d\dU\S*\s+EDUQAS", l["text"])]
    if stamp and stamp[-1] > max(labels.values(), default=(0, 0)):
        last = stamp[-1]
    starts = sorted([(at, "label", n) for n, at in labels.items()] + [(at, "grid", names) for at, names in grids] + [(at, "stop", None) for at in stops])
    regions = []
    for n, (at, kind, value) in enumerate(starts):
        if kind == "stop":
            continue
        # (a stop ends a grid; a question's notes, which may open under the same heading, run to the next start)
        nxt = next((s[0] for s in starts[n + 1:] if (kind == "grid" or s[1] != "stop") and s[0] > (at[0], at[1] + 5)), last)
        regions.append((kind, value, pieces(doc, (at[0], at[1] - 4), (nxt[0], nxt[1] - 3), False), at))
    out = {}
    for kind, value, ps, at in regions:
        if kind != "label":
            continue
        q = value
        named = [g for g in regions if g[0] == "grid" and q in g[1]]
        if not named:
            want = "extract" if q.endswith("1") else "essay"
            named = [g for g in regions if g[0] == "grid" and want in g[1] and g[3] < at]
        if not named:
            named = [g for g in regions if g[0] == "grid" and g[3] < at][-1:]
        out[q] = (ps, named[-1][2] if named else [])
    return out


# ---------- examiner's report ----------

def report(path, key):
    """{("t", code, kind) | ("q", "31") | ("s", section): text} from the component's chapter."""
    if not path or not os.path.exists(path):
        return {}
    chunk = common.chapter(common.report_text(path), key)
    out, buf = {}, []
    state = {"section": None, "kind": "extract", "target": None}

    def flush():
        para = re.sub(r"\s+", " ", " ".join(buf)).strip()
        buf.clear()
        if para and state["target"] and not re.fullmatch(r"\d{1,3}|(Summer|Autumn) 20\d\d", para):
            out.setdefault(state["target"], []).append(para)

    for raw in chunk.split("\n"):
        line = raw.strip()
        if not line:
            flush()
            continue
        short = len(line) < 60 and not line.endswith((",", ";"))
        if short and re.match(r"^(SECTION|Section)\b", line) or short and re.fullmatch(r"(Anthology Poetry|Poetry Anthology|Unseen Poetry)", line, re.I):
            flush()
            kind = section_kind(line)
            if kind:
                state.update(section=kind, kind="extract", target=("s", kind))
            continue
        if short and re.fullmatch(r"(Extract|Essay) questions?:?", line, re.I):
            flush()
            state["kind"] = "essay" if line.lower().startswith("essay") else "extract"
            continue
        m = re.match(r"^(?:Q\.?\s*|Question\s+)(\d)\s*\.?\s*(\d)\b\s*(.*)$", line)
        if m:
            flush()
            state["target"] = ("q", m.group(1) + m.group(2))
            if m.group(3) and len(m.group(3)) > 3:
                buf.append(m.group(3))
            continue
        code = texts.find(line.rstrip(":")) if short else None
        if code:
            flush()
            sec = texts.section_of(code)
            state.update(section=sec, target=("t", code, state["kind"] if sec == "shakespeare" else None))
            continue
        if short and line == "General Comments" and state["section"]:
            flush()
            state["target"] = ("s", state["section"])
            continue
        buf.append(line)
    flush()
    return {k: "\n\n".join(v) for k, v in out.items()}


def comments(rep, q, code, section):
    kind = ("extract" if q.endswith("1") else "essay") if section == "shakespeare" else None
    for target in (("t", code, kind), ("q", q), ("s", section)):
        text = rep.get(target)
        if text and len(text) > 80:
            return common.cap(text)
    return None


# ---------- one sitting ----------

def report_key(comp):
    return comp[5] + (comp[7].upper() if comp.startswith("c722") else "")


def cut_set(job):
    set_id, files, meta = job
    try:
        comp = meta["component"]
        qp = pymupdf.open(os.path.join(WORK, "pdf", files["qp"]["file"]))
        ms = pymupdf.open(os.path.join(WORK, "pdf", files["ms"]["file"])) if "ms" in files else None
        questions, problems = qp_questions(qp)
        schemes = ms_blocks(ms) if ms else {}
        rep = report(os.path.join(WORK, "pdf", files["er"]["file"]), report_key(comp)) if "er" in files else {}
        parts, imgs = [], {}
        for qn in questions:
            q, b = qn["q"], qn["block"]
            pid = f"{set_id}-{q}-q"
            img = render(qp, qn["pieces"])
            imgs[q] = img
            text = text_of(qp, qn["pieces"])
            marks = sum(int(a) + int(c or 0) for a, c in MARKS.findall(text))
            own = re.split(r"\[\d", common.own_text(qp, qn["pieces"], qn["at"]))[0]
            # (not the text's name, beside Component 2's number, nor the rubric over each question)
            own = re.sub(r"^\s*" + re.escape(b["code"] and next((l["text"] for pg, r in qn["pieces"][:1] for l in lines(qp[pg], r)
                                                                  if texts.find(l["text"]) == b["code"]), "") or ""), "", own)
            own = re.sub(r"You are advised to spend about \d+ minutes on this question\.|You should use the extract[^.]*answer this question\.|"
                         r"Read the extract on the opposite page\. Then answer the following question[.:]", "", own).strip(" *")
            stem_name = save(imgs.get(qn.get("stem_of")), f"{set_id}-{q}-stem.webp") if qn.get("stem_of") else None
            notes, grid = schemes.get(q, ([], []))
            msimg = stack([render(ms, notes, 12)] + ([render(ms, grid, 12)] if grid else []), gap=28) if notes else None
            ms_text = text_of(ms, notes) if notes else ""
            if ms and not notes:
                problems.append(f"{pid}: no scheme")
            elif ms and not grid:
                problems.append(f"{pid}: no grid")
            er = comments(rep, q, b["code"], b["section"])
            if DEBUG:
                print(set_id, q, b["code"], marks, "qp pages", sorted({pg for pg, _ in qn["pieces"]}), "ms", sorted({pg for pg, _ in notes}),
                      "grid", sorted({pg for pg, _ in grid}), "er", len(er or ""), "|", own[:60], file=sys.stderr)
            parts.append({
                "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": q, "marks": marks or None,
                "section": b["section"], "or": qn["or"], "text_code": b["code"],
                "qp": save(img, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
                "w": img.width if img else 0, "h": img.height if img else 0,
                "text": text[:4000], "msText": ms_text[:800], "er": er, "own": own,
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
            marks = sum(p["marks"] or 0 for p in parts if not p["or"])
            print(f"{set_id}: {len(parts)} questions, {sum(1 for p in parts if not p['ms'])} without scheme, "
                  f"{sum(1 for p in parts if p['er'])} reported, {marks} marks answered", file=sys.stderr, flush=True)
            want = TOTAL[set_id.split("-")[0]]
            if marks != want:
                problems.append(f"{set_id}: {marks} marks answered, not {want}")
            problems += [f"{set_id}: {p}" for p in issues]
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
