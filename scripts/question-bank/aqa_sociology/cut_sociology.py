"""Cut AQA's Sociology papers into questions, each with its Item, its mark scheme and its report.

    python3 scripts/question-bank/aqa_sociology/cut_sociology.py [work-dir] [--only=71922]   # default scripts/question-bank/.work/aqa-sociology

cut.py's label finder and image helpers, with Sociology's own layout around them:
  - Every question is whole ("05"), from its boxed label down to its marks
    ("[20 marks]"): the answer lines after it add nothing.
  - The longer questions are set on an Item, a boxed passage between the label's
    "Read Item C below…" and the question's own words. The Item is the question's
    stem ("71922-jun24-ic-stem.webp", which the site finds by dropping the id's last
    part), so it is cut out of the question: the question's crop is its label line
    and its own words, stacked. Each Item serves one question, so a question with an
    Item carries the Item's letter in its id ("71922-jun24-ic-05"); one without,
    its option ("71922-jun24-a1-01") or "q".
  - A-Level Paper 2 and AS Paper 2 are choices: "Topic A1 Culture and Identity" …
    "Topic B4 Stratification and Differentiation", one topic answered from each
    section. Each question records its topic ("a1"), for the build to mark the
    alternatives and the tags to follow.
  - The schemes are tables, one per question, headed "Qu | Marking guidance | Total
    marks", each with its own levels-of-response grid (the 10-, 20- and 30-mark
    questions) and its sources: a question's scheme runs from its heading to the
    next question's, so the grid is never cut off.
  - Examiner's reports head each question "Question 4", "Question14" or "Q4:", and
    are keyed by question id.
"""
import json, os, re, sys, traceback
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-sociology")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}  # the specimen papers are left out, as in the other AQA banks

OPTION = re.compile(r"^(?:Topic ([AB])\s*(\d)\b|Section ([AB])\b)")
ITEM = re.compile(r"^Item ([A-Z])$")
MARKS = re.compile(r"\[(\d+) marks?\]")
MS_STOP = re.compile(r"^(Qu$|Topic [AB]\s*\d|Section [AB]\b|Assessment [Oo]bjective)")


def lines_of(page, rect=None):
    """[(y0, x0, y1, text, bold)] top to bottom."""
    out = []
    for block in (page.get_text("dict", clip=rect) if rect else page.get_text("dict"))["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t:
                out.append((line["bbox"][1], line["bbox"][0], line["bbox"][3], t, all("Bold" in s["font"] for s in spans)))
    return sorted(out)


def frame(page):
    """A paper page's content: below the page number, above "Turn over" and the footer, inside the answer box's border."""
    w, h = page.rect.width, page.rect.height
    top, bottom, right = 50, h - 46, w - 44
    for y0, x0, y1, t, _ in lines_of(page):
        if y0 > h - 60 or t.startswith("Turn over") or re.fullmatch(r"\*\d+\*", t) or t.startswith("IB/M/"):
            bottom = min(bottom, y0 - 4)
        if t.startswith("Do not write"):
            right = min(right, x0 - 3)
    left = 38
    sides = [d["rect"] for d in page.get_drawings() if d["rect"].width < 3 and d["rect"].height > 300]
    if any(r.x0 < 60 for r in sides) and any(r.x0 > w / 2 for r in sides):
        left = max(r.x1 for r in sides if r.x0 < 60) + 1
        right = min(right, min(r.x0 for r in sides if r.x0 > w / 2) - 0.3)
        bottom = min(bottom, max(r.y1 for r in sides) - 1.5)
    return pymupdf.Rect(left, top, right, bottom)


def ms_frame(page):
    """A scheme page's content: under the running header ("MARK SCHEME – A-LEVEL SOCIOLOGY – …"), above the page number."""
    w, h = page.rect.width, page.rect.height
    lines = lines_of(page)
    head = [y1 for y0, x0, y1, t, b in lines if y0 < 60]
    foot = [y0 for y0, x0, y1, t, b in lines if y0 > h - 60]
    top, bottom = max(head) + 3 if head else 52, min(foot) - 3 if foot else h - 46
    for d in page.get_drawings():
        r = d["rect"]
        if r.height < 3 and r.width > 300 and (r.x1 > w - 5 or r.x0 < 5):  # the header and footer rules, drawn out to one edge of the page
            top = max(top, r.y1 + 2) if r.y0 < 90 else top
            bottom = min(bottom, r.y0 - 2) if r.y0 > h - 90 else bottom
    return pymupdf.Rect(36, top, w - 34, bottom)


def has_words(page, rect):
    return bool(re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=rect)))


def span(doc, start, end, framer):
    """Pieces from (page, y) down to (page, y), page by page inside the frame. Pieces with no words are dropped."""
    pieces = []
    for pg in range(start[0], end[0] + 1):
        f = framer(doc[pg])
        top = max(f.y0, start[1]) if pg == start[0] else f.y0
        bottom = min(f.y1, end[1]) if pg == end[0] else f.y1
        if bottom > top + 8:
            r = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if has_words(doc[pg], r):
                pieces.append((pg, r))
    return pieces


def item_box(page, heading_y):
    """The box drawn round an Item whose heading ("Item C") sits at heading_y: its rule above the heading, its sides' foot."""
    drawings = [d["rect"] for d in page.get_drawings()]
    sides = [r for r in drawings if r.width < 3 and r.height > 20 and heading_y - 20 <= r.y0 <= heading_y + 6]
    rules = [r for r in drawings if r.height < 3 and r.width > 300 and heading_y - 20 <= r.y0 <= heading_y]
    if len(sides) < 2 or not rules:
        return None
    return pymupdf.Rect(min(r.x0 for r in sides) - 3, max(r.y0 for r in rules) - 3, max(r.x1 for r in sides) + 3, max(r.y1 for r in sides) + 3)


def qp_questions(doc):
    """[(q, option, item, pieces, item_pieces, text, item_text, marks)] in reading order."""
    events = []
    for pg, page in enumerate(doc):
        f = frame(page)
        for y, q, part, x in cut.left_labels(page, 75, True, with_x=True):
            if part is None:
                events.append((pg, y, y, "label", q))
        for y0, x0, y1, t, bold in lines_of(page):
            if f.y0 - 10 <= y0 <= f.y1 + 4:
                if OPTION.match(t) and bold:
                    events.append((pg, y0, y1, "option", t))
                elif ITEM.match(t) and bold:
                    events.append((pg, y0, y1, "item", t))
                elif MARKS.search(t):
                    events.append((pg, y0, y1, "marks", t))
    events.sort(key=lambda e: (e[0], e[1]))
    out, option = [], None
    for n, (pg, y, _, kind, value) in enumerate(events):
        if kind == "option":
            m = OPTION.match(value)
            option = (m.group(1) + m.group(2)).lower() if m.group(1) else m.group(3).lower()
            continue
        if kind != "label":
            continue
        item, end = None, None
        for pg2, y2, y2b, kind2, value2 in events[n + 1:]:
            if kind2 in ("label", "option"):
                break
            if kind2 == "item" and item is None:
                item = (pg2, y2, ITEM.match(value2).group(1))
            if kind2 == "marks":
                end = (pg2, y2b + 5)
                break
        if end is None:
            raise ValueError(f"question {value}: no marks")
        box, item_pieces = None, []
        if item:
            box = item_box(doc[item[0]], item[1])
            if box is None:
                raise ValueError(f"question {value}: Item {item[2]} has no box")
            item_pieces = [(item[0], box)]
            pieces = span(doc, (pg, y - 6), (item[0], box.y0 - 1), frame) + span(doc, (item[0], box.y1 + 1), end, frame)
        else:
            pieces = span(doc, (pg, y - 6), end, frame)
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        item_text = "\n".join(doc[p].get_text("text", clip=r) for p, r in item_pieces)
        marks = [int(x) for x in MARKS.findall(text)]
        out.append((value, option, item[2].lower() if item else None, pieces, item_pieces, text, item_text, sum(marks) if marks else None))
    return out


def row_top(page, y):
    """The top of the table row whose text starts at y: the rule just above it, else a little above the text."""
    rules = [d["rect"].y0 for d in page.get_drawings() if d["rect"].height < 3 and d["rect"].width > 30 and y - 14 <= d["rect"].y0 <= y]
    return max(rules) - 1 if rules else y - 7  # the nearest: a box just above (the last question's sources) has its own rule


def ms_parts(ms, wanted):
    """{q: (pieces, text)}: each question's scheme table, from its "Qu" heading (or its own row) to the next question's."""
    events = []
    for pg, page in enumerate(ms):
        f = ms_frame(page)
        for y, q, part, x in cut.left_labels(page, 110, False, with_x=True):  # some series set the label in plain type
            if part is None and f.y0 - 4 <= y <= f.y1:
                events.append((pg, y, "label", q))
        for y0, x0, y1, t, bold in lines_of(page, f):
            if MS_STOP.match(t) and (bold or t.startswith("Assessment")):
                events.append((pg, y0, "stop", t))
    events.sort(key=lambda e: (e[0], e[1]))
    out, last = {}, 0
    for n, (pg, y, kind, value) in enumerate(events):
        # A label read once, in order: a stray number in the margin is not a question.
        if kind != "label" or value not in wanted or value in out or int(value) < last:
            continue
        last = int(value)
        heading = [e for e in events[:n] if e[0] == pg and e[2] == "stop" and e[3] == "Qu" and y - 60 < e[1] < y]
        start = row_top(ms[pg], heading[-1][1] if heading else y)
        end = (len(ms) - 1, ms[-1].rect.height)
        for pg2, y2, kind2, value2 in events[n + 1:]:
            if kind2 == "stop" or kind2 == "label" and value2 in wanted and int(value2) > last:
                end = (pg2, row_top(ms[pg2], y2) - 1)
                break
        pieces = span(ms, (pg, start), end, ms_frame)
        out[value] = (pieces, "\n".join(ms[p].get_text("text", clip=r) for p, r in pieces))
    return out


# "Question 4", "Question14", "Questions 1 and 5", "Q4:", "Q15.", "Q1 Answers here…", "Question 01".
REPORT_HEAD = re.compile(r"^[ \t]*(?:Questions?[ \t]*|Q)(\d{1,2})(?:[ \t]*(?:,|and|&)[ \t]*(\d{1,2}))?(?:[ \t]*\([^)\n]*\))?(?:[ \t]*[:.][ \t]*|[ \t]*$|[ \t]+(?=[A-Z]))", re.M)
REPORT_TAIL = re.compile(r"(\n\s*(Section [AB]\b[^\n]*|Topic [AB]\s*\d[^\n]*|Methods in Context[^\n]*|Theory and Methods[^\n]*|Education\s*|Crime and Deviance\s*|Research methods\s*|Comments on Individual Questions)\s*)+$", re.I)


def examiner_report(path):
    """{'04': its comments}: everything under a question's heading, up to the next."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    # The running header and footer: "Report on the examination – A-Level - Sociology – 7192/2 – June 2025", "5 of 5", "© 2024 AQA…".
    text = re.sub(r"^[ \t]*(REPORT ON THE EXAMINATION|Report on the examination|©)[^\n]*$|^[ \t]*\d+ of \d+[ \t]*$", "", text, flags=re.M)
    heads = list(REPORT_HEAD.finditer(text))
    out = {}
    for k, m in enumerate(heads):
        raw = text[m.end():heads[k + 1].start() if k + 1 < len(heads) else len(text)]
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)", raw)[0]
        body = REPORT_TAIL.sub("", body)
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))
        for q in filter(None, m.groups()):
            q = f"{int(q):02d}"
            if body:
                out[q] = (out[q] + "\n\n" + body) if q in out else body
    return out


def render(doc, pieces, keep=36):
    return cut.stack([cut.trim_bottom(cut.render(doc[pg], r), keep) for pg, r in pieces])


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    questions = qp_questions(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    schemes = ms_parts(ms, {q for q, *_ in questions}) if ms else {}
    er = examiner_report(er_path)
    parts, problems = [], []
    for q, option, item, pieces, item_pieces, text, item_text, marks in questions:
        group = f"i{item}" if item else (option or "q")
        pid = f"{set_id}-{group}-{q}"
        qimg = render(qp, pieces, 16 if item else 36)
        if item:
            cut.save(render(qp, item_pieces, 16), f"{set_id}-{group}-stem.webp")
        msimg, ms_text = None, ""
        if q in schemes:
            mpieces, ms_text = schemes[q]
            msimg = render(ms, mpieces, 12)
            if marks and marks >= 10 and not re.search(r"Level descriptors|Marks\s+Level", ms_text, re.I):
                problems.append(f"{pid}: no levels grid in its {marks}-mark scheme")
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "group": group, "option": option, "label": q, "marks": marks,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"),
            "stem": f"{set_id}-{group}-stem.webp" if item else None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text + " " + item_text).strip()[:3000],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
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
        if f["series"] in SERIES:
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
            print(f"{set_id}: {len(parts)} questions, {no_ms} without scheme, {sum(1 for p in parts if p['er'])} reported, "
                  f"{sum(1 for p in parts if p['stem'])} Items, options {sorted({p['option'] for p in parts if p['option']})}, "
                  f"{sum(p['marks'] or 0 for p in parts)} marks printed", file=sys.stderr, flush=True)
            problems += [f"{set_id}: {len(parts)} questions, {no_ms} without scheme"] if not parts or no_ms else []
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
