"""Cut AQA's A-Level Maths papers into questions, each with its mark scheme rows.

    python3 scripts/question-bank/aqa_maths/cut_maths.py [work-dir] [--only=73571-jun23]   # default scripts/question-bank/.work/aqa-maths

As in the other maths banks (cut_edexcel.py), the unit is the whole question: in
maths a later part builds on an earlier one. Read off AQA's maths layout:
  - Every part prints its whole label in bold in the left margin: "9", "9 (a)",
    "9 (a) (ii)". Each label's words run from it to where its answer lines begin
    (rows of underscores): the rest of the page, and any page after it, is space to
    write in. Labels with no answer lines (an opening, multiple choice, a sketch on
    printed axes) run to the next label. A question is its labels' words stacked in
    order, with the space to write in left out.
  - "Section B" and its instructions, between the Pure and the Mechanics or
    Statistics questions, are left out.
  - The scheme is a table, "Q | Marking instructions | AO | Marks | Typical
    solution", one row group per part ("9(a)(ii)", or "4a" and then "(b)" in June
    2018). A question's rows run from its first label to the next question's, across
    pages, with the column headings over its first row and below them on a
    continuation page.
  - The reports head each question "Question 4" (November 2020 Paper 1: "Q4").
Writes <work-dir>/img/<id>-qp.webp and -ms.webp, and <work-dir>/parts.json in
cut_edexcel.py's shape (one entry per question, id "73571-jun23-09").
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "aqa-maths")
IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)

sys.argv = [sys.argv[0], WORK]  # cut.py reads its work dir from argv at import
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

cut.IMG = IMG

BOLD = re.compile(r"Bold|-b$", re.I)
QP_LABEL = re.compile(r"^(\d{1,2})\s*(?:\(([a-h])\))?\s*(?:\(([ivx]{1,4})\))?$")
# June 2018 prints a question's later parts without its number: "(b)", "(d)(i)".
MS_LABEL = re.compile(r"^(\d{1,2})?\s*(?:\(?([a-h])\)?)?\s*(?:\(([ivx]{1,4})\))?(?=\s|$)")
HEADINGS = re.compile(r"Marking instructions", re.I)
ANSWER_LINE = re.compile(r"^_{10,}")
SECTION = re.compile(r"^(Section [A-C]|END OF QUESTIONS)\s*$")
# The papers' maths fonts put symbols at Latin-1 and control codes in the text layer, each
# font its own way: read them back for search, tagging and the opening words ("y ¼ 2x þ 1:5"
# is "y = 2x + 1.5"). AdvP4C4E46 draws brackets and root signs in pieces: those are dropped.
DROP = {chr(c): " " for c in range(1, 32) if chr(c) not in "\n\t"}
FONT_SYMBOLS = {
    "AdvP4C4E74": str.maketrans({**DROP, "¼": "=", "þ": "+", "\x02": "−", "\x03": "×", "\x04": "×", "\x05": "≤", "\x06": "≥", "\x07": "≥",
                                 "ð": "(", "Þ": ")", ":": "."}),
    "AdvP4C4E46": str.maketrans({**DROP, "ð": "(", "Þ": ")", "ﬃ": ""}),
    "AdvPS0601": str.maketrans({**DROP, "\x02": "°"}),
}
PLAIN = str.maketrans({**DROP, "\uf050": "✓"})


def clip_text(page, rect):
    """The words inside rect, a line at a time, with each span's symbols read for its font."""
    lines = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            lines.append("".join(s["text"].translate(next((t for k, t in FONT_SYMBOLS.items() if k in s["font"]), PLAIN)) for s in line["spans"]))
    return "\n".join(lines)


BOILER = re.compile(r"Do not write|outside the|^box$|Turn over|Question \d+ continues", re.I)


def spans(page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip():
                    yield s


def key_of(q, a, r):
    """('09', 'a', 'ii') -> '09aii': a label's key in the paper and in the scheme."""
    return f"{int(q):02d}{a or ''}{r or ''}"


def qp_labels(doc):
    """[(page, y, q, a, r)] in reading order: the bold labels in the left margin."""
    out = []
    for i, page in enumerate(doc):
        if cut.NOT_QUESTIONS.search(page.get_text()):
            continue
        rows = []
        for s in spans(page):
            x, y = s["bbox"][0], s["bbox"][1]
            if x < 100 and BOLD.search(s["font"]) and s["size"] >= 10 and 40 < y < page.rect.height - 60:
                if rows and abs(rows[-1][0] - y) < 4:
                    rows[-1][1].append(s)
                else:
                    rows.append([y, [s]])
        for y, row in rows:
            row.sort(key=lambda s: s["bbox"][0])
            if row[0]["bbox"][0] > 75:
                continue
            m = QP_LABEL.match(" ".join(s["text"].strip() for s in row))
            if m:
                out.append((i, y, *m.groups()))
    # Question numbers only go up: anything else is a bold number in the working.
    kept, last = [], 0
    for lab in out:
        if int(lab[2]) >= last:
            kept.append(lab)
            last = int(lab[2])
    return kept


def qp_frame(page):
    """Inside the box every question page draws (x 45-535, y 65-778): no page number, barcode or margin note."""
    sides = [d["rect"] for d in page.get_drawings() if d["rect"].width < 2 and d["rect"].height > page.rect.height / 2]
    if len(sides) >= 2:
        return pymupdf.Rect(min(r.x0 for r in sides) + 1, min(r.y0 for r in sides) + 1, max(r.x1 for r in sides) - 1, max(r.y1 for r in sides) - 2)
    return cut.frame(page, True)


def answer_stop(page, top, bottom):
    """Where the part's own words end on this page: the first answer line or section heading below `top`."""
    ys = [s["bbox"][1] for s in spans(page) if top + 6 < s["bbox"][1] < bottom
          and (ANSWER_LINE.match(s["text"].strip()) or SECTION.match(s["text"].strip()))]
    return min(ys) if ys else None


def qp_regions(doc):
    """[[key, (q, a, r), pieces, full text]]: each label's crop, and the text down to the next label (for its marks)."""
    labels = qp_labels(doc)
    out = []
    for n, (pg0, y0, q, a, r) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        pieces, full, pg, top, stopped = [], [], pg0, y0 - 6, False
        while pg < len(doc):
            page = doc[pg]
            f = qp_frame(page)
            end = nxt[1] - 6 if nxt and nxt[0] == pg else f.y1
            full.append(clip_text(page, pymupdf.Rect(f.x0, max(top, f.y0), f.x1, end)))
            if not stopped:
                stop = answer_stop(page, top, end)
                cut_end = min(end, stop - 4) if stop is not None else end
                rect = pymupdf.Rect(f.x0, max(top, f.y0), f.x1, cut_end)
                words = re.sub(BOILER, "", page.get_text("text", clip=rect))
                if cut_end > top + 8 and (not pieces or re.search(r"[A-Za-z]{2,}", words)):
                    pieces.append((pg, rect))
                stopped = stop is not None
            if (nxt and nxt[0] == pg) or "END OF QUESTIONS" in page.get_text():
                break
            pg += 1
            if nxt and pg > nxt[0] or pg == len(doc):  # (AQA's GCSE 2F specimen spaces its "END  OF  QUESTIONS")
                break
            if cut.NOT_QUESTIONS.search(doc[pg].get_text()):
                break
            top = qp_frame(doc[pg]).y0
        out.append([key_of(q, a, r), (q, a, r), pieces, "\n".join(full)])
    return out


def headers(page):
    """[(top, bottom)] of each run of the scheme's column headings ("Q | Marking instructions | ...") on the page:
    newer schemes print them again over each question."""
    out = []
    for s in spans(page):
        if HEADINGS.fullmatch(s["text"].strip()):
            mid = (s["bbox"][1] + s["bbox"][3]) / 2
            row = [t["bbox"] for t in spans(page) if abs((t["bbox"][1] + t["bbox"][3]) / 2 - mid) < 6]
            out.append((min(b[1] for b in row), max(b[3] for b in row) + 3))
    return sorted(out)


def header_bottom(page):
    """Where a continuation page's rows start: below its column headings at the top, or None."""
    return next((b for t, b in headers(page) if t < 160), None)


def row_top(page, y):
    """A label's row starts at the table rule above it; with the column headings when they sit right over it."""
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})
    above = [r for r in rules if r <= y + 2]
    # Some schemes draw no rule between a question's rows: then the row starts just above its label.
    top = above[-1] - 1 if above and y - above[-1] < 20 else y - 6
    for ht, hb in headers(page):
        if -16 <= top - hb < 14:
            over = [r for r in rules if r <= ht + 2 and ht - r < 12]
            return (over[-1] if over else ht - 4) - 1
    return top


def content_bottom(page, rect):
    """The foot of the last words or figure inside rect, leaving out the table's own long column rules."""
    ys = [l["bbox"][3] for b in page.get_text("dict", clip=rect)["blocks"] for l in b.get("lines", [])
          if "".join(s["text"] for s in l["spans"]).strip()]
    ys += [d["rect"].y1 for d in page.get_drawings() if rect.intersects(d["rect"]) and 3 < d["rect"].height < 250 and d["rect"].width > 3]
    ys += [b["bbox"][3] for b in page.get_text("dict", clip=rect)["blocks"] if b.get("type") == 1]
    return min(rect.y1, max(ys) + 6) if ys else rect.y0


def ms_labels(doc):
    start = next((i for i, p in enumerate(doc) if HEADINGS.search(p.get_text())), len(doc))
    out, q = [], None
    for i in range(start, len(doc)):
        page = doc[i]
        for s in sorted(spans(page), key=lambda s: (s["bbox"][1], s["bbox"][0])):
            x, y = s["bbox"][0], s["bbox"][1]
            t = s["text"].strip()
            m = MS_LABEL.match(t)
            bold = BOLD.search(s["font"]) or re.match(r"\d{1,2}\([a-h]\)", t)  # November 2020 Paper 1 prints "13(c)" in regular
            if m and (m.group(1) or (q and (m.group(2) or m.group(3)))) and x < 75 and bold and 60 < y < page.rect.height - 50:
                if out and out[-1][0] == i and m.group(1) is None and out[-1][3] is None and out[-1][4] is None and 0 < y - out[-1][1] < 18:
                    out[-1] = (i, out[-1][1], out[-1][2], m.group(2), m.group(3))  # "14" over "(a)(i)": one label on two lines
                    continue
                if m.group(1):
                    q = m.group(1)
                elif not m.group(2):
                    a = out[-1][3] if out and out[-1][2] == q else None  # "(ii)" alone: the part above's sub-part
                    out.append((i, y, q, a, m.group(3)))
                    continue
                out.append((i, y, q, m.group(2), m.group(3)))
    return start, out


def ms_regions(doc):
    """{key: (pieces, text)} for every labelled row group, in order."""
    start, labels = ms_labels(doc)
    out = {}
    for n, (pg0, y0, q, a, r) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        last = nxt[0] if nxt else min(len(doc) - 1, pg0 + 2)
        pieces, pg, top = [], pg0, row_top(doc[pg0], y0)
        while pg <= last:
            page = doc[pg]
            box = cut.ms_frame(page)
            if pg != pg0 and not page.get_drawings():
                break  # past the table: the back cover
            end = row_top(page, nxt[1]) if nxt and nxt[0] == pg else box.y1
            if end > top + 8:
                rect = pymupdf.Rect(box.x0, max(top, box.y0), box.x1, end)
                if not (nxt and nxt[0] == pg):
                    rect.y1 = content_bottom(page, rect)  # not down the empty column rules to the footer
                if rect.y1 > rect.y0 + 8:
                    pieces.append((pg, rect))
            pg += 1
            if pg <= last:
                top = header_bottom(doc[pg]) or cut.ms_frame(doc[pg]).y0
        out.setdefault(key_of(q, a, r), (pieces, "\n".join(clip_text(doc[p], rc) for p, rc in pieces)))
    return out


def split_key(key):
    """'09aii' -> ('09', 'a', 'ii')."""
    return re.fullmatch(r"(\d\d)([a-h]?)([ivx]*)", key).groups()


def merge_pieces(pieces):
    """Join pieces that touch on the same page (one label's words and the next's), so they read as one crop."""
    out = []
    for pg, r in pieces:
        if out and out[-1][0] == pg and abs(out[-1][1].y1 - r.y0) < 12:
            out[-1] = (pg, pymupdf.Rect(out[-1][1].x0, out[-1][1].y0, r.x1, r.y1))
        else:
            out.append((pg, r))
    return out


def examiner_report(path):
    """{question: its comments}: cut.py's reading, with November 2020 Paper 1's "Q4" headings read as "Question 4"
    and the pages' running headers and footers taken out wherever they fall."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"\n\s*Q(\d{1,2})\s*\n", r"\nQuestion \1\n", text)
    # Each page's running header and footer, in capitals or not (June 2025): "Report on the examination
    # – A-level - Mathematics – 7357/1 – June 2025", "© 2025 AQA and its licensors. All rights reserved.", "9 of 9".
    # The block and the blank lines round it go as one, so a sentence carried over the page reads on.
    page_break = r"[ \t]*(?:report on the examination\b.*|©\s*\d{4} AQA\b.*|\d+ of \d+)[ \t]*"
    text = re.sub(rf"(?:\n[ \t]*)*\n{page_break}(?:\n(?:{page_break}|[ \t]*))*(?=\n)", "", text, flags=re.I)
    parts = re.split(r"\n\s*Question (\d{1,2})(?:\s*\([^)\n]*\))?\s*\n", text)
    out = {}
    for k in range(1, len(parts) - 1, 2):
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support)", parts[k + 1])[0]
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", body)
        if body:
            out[f"{int(parts[k]):02d}"] = body
    return out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    regions = qp_regions(qp)
    ms = pymupdf.open(ms_path) if ms_path and os.path.exists(ms_path) else None
    ms_map = ms_regions(ms) if ms else {}
    er = examiner_report(er_path)
    questions = {}
    for _, (q, _, _), pieces, full in regions:
        questions.setdefault(f"{int(q):02d}", []).append((pieces, full))
    parts = []
    for q, labels in questions.items():
        pieces = merge_pieces([pc for pcs, _ in labels for pc in pcs])
        pid = f"{set_id}-{q}"
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[pg], rc)) for pg, rc in pieces])
        rows = [ms_map[k] for k in ms_map if split_key(k)[0] == q]
        mpieces = merge_pieces([pc for pcs, _ in rows for pc in pcs])
        msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], rc), 12) for pg, rc in mpieces]) if mpieces else None
        m = [int(x) for _, full in labels for x in re.findall(r"\[(\d+) marks?\]", full)]
        own = "\n".join(clip_text(qp[pg], rc) for pg, rc in pieces)
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": str(int(q)),
            "marks": sum(m) if m else None,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", own).strip()[:1500],
            "msText": re.sub(r"\s+", " ", "\n".join(t for _, t in rows)).strip()[:800],
            "er": er.get(q),
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception as e:  # noqa: BLE001
        return set_id, [], f"{type(e).__name__}: {e}"


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            no_marks = sum(1 for p in parts if p["marks"] is None)
            print(f"{set_id}: {len(parts)} questions, {no_ms} without scheme, {no_marks} without marks, {sum(1 for p in parts if p['er'])} with report", file=sys.stderr, flush=True)
            if not parts or no_ms > len(parts) / 4:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
