"""Cut Pearson Edexcel Maths and Further Maths papers into questions, each paired
with its mark scheme rows.

    python3 scripts/question-bank/cut_edexcel.py [work-dir] [--only=9ma0-01]   # needs: pip install pymupdf pillow

Edexcel lays papers out differently from AQA (see cut.py), and maths is best
practised a whole question at a time, so the unit here is the question:
  - a question starts at its bold "2." label and its printed text ends where the
    lined answer space begins (current specs) or where blank space begins
    (legacy modules); "Question 2 continued" pages are answer space and skipped;
  - its marks come from "(Total for Question 2 is 6 marks)" or, on legacy
    papers, the "(Total 6 marks)" lines in order;
  - its mark scheme is every row from its first "2" / "2(a)" label to the next
    question's first label, read from where the scheme's table starts (so the
    general marking guidance at the front is never mistaken for a question);
  - the examiner report's "Question 2" paragraph is attached, as for AQA.
Writes <work-dir>/img/<id>-qp.webp and -ms.webp, and <work-dir>/parts.json in
the same shape as cut.py's, ready for build_bank.py.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ARGS = [a for a in sys.argv[1:] if not a.startswith("--only=")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, ".work-edexcel")
IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)

sys.argv = [sys.argv[0], WORK]  # cut.py reads its work dir from argv at import
import cut  # noqa: E402

cut.IMG = IMG  # its render/save helpers write here

QP_LABEL = re.compile(r"^(\d{1,2})(?:\.(?!\d)|\s*$)")  # "2." or, on some papers, a bold "2" on its own
MS_LABEL = re.compile(r"^(?:Qu(?:estion)?\s*|Q\s*)?(\d{1,2})\.?\s*(?:\(?(?:[a-z]{1,2}|[ivx]{1,4})\)?\s*)*$")  # "2", "2.", "2(a)(i)", "4a", "Qu 2"
ANSWER_LINE = re.compile(r"^_{12,}")
CONTINUED = re.compile(r"^Question\s+\d+\s+continued", re.I)
TOTAL_NEW = re.compile(r"\(Total for Question (\d+) is (\d+) marks?\)", re.I)
TOTAL_OLD = re.compile(r"\(Total\s+(\d+)\s+marks?\)", re.I)


def spans(page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip():
                    yield s


def qp_frame(page, legacy):
    h = page.rect.height
    # Legacy papers keep a "Leave blank" mark column on the right; both keep
    # "DO NOT WRITE IN THIS AREA" down the left edge and a barcode at the foot.
    return pymupdf.Rect(36, 36, 526 if legacy else 557, h - 50)


def qp_regions(doc, legacy):
    labels = []  # (page, y, q)
    seen = set()
    for i, page in enumerate(doc):
        for s in spans(page):
            m = QP_LABEL.match(s["text"].strip())
            if m and "Bold" in s["font"] and s["bbox"][0] < 75 and s["size"] >= 10.5 and 30 < s["bbox"][1] < page.rect.height - 60:
                q = f"{int(m.group(1)):02d}"
                if q not in seen:
                    seen.add(q)
                    labels.append((i, s["bbox"][1], q))
    out = []
    for n, (pg0, y0, q) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        pieces, pg, top = [], pg0, y0 - 6
        while pg < len(doc):
            page = doc[pg]
            f = qp_frame(page, legacy)
            stops = [s["bbox"][1] for s in spans(page) if s["bbox"][1] > top + 10 and (
                ANSWER_LINE.match(s["text"].strip()) or CONTINUED.match(s["text"].strip()) or TOTAL_NEW.search(s["text"]) or TOTAL_OLD.search(s["text"]))]
            if nxt and nxt[0] == pg:
                stops.append(nxt[1])
            end = min(stops) - 4 if stops else f.y1
            if end > top + 8:
                pieces.append((pg, pymupdf.Rect(f.x0, max(top, f.y0), f.x1, end)))
            if stops:
                break
            pg += 1
            if pg >= len(doc) or (nxt and pg > nxt[0]):
                break
            # The first real line of the page (not the margin's "Leave blank" or "DO NOT WRITE").
            first = next((s for s in spans(doc[pg]) if s["bbox"][1] > 30 and 30 < s["bbox"][0] < 520), None)
            if first and CONTINUED.match(first["text"].strip()):
                break  # the rest is answer space
            top = qp_frame(doc[pg], legacy).y0
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        out.append((q, pieces, text))
    return out


def qp_marks(doc, labels):
    """Each "(Total for Question 2 is 6 marks)" / "(Total 6 marks)" belongs to the
    question whose label comes last before it in the paper (answer pages included)."""
    marks = {}
    for i, page in enumerate(doc):
        for s in spans(page):
            t = s["text"]
            m = TOTAL_NEW.search(t)
            if m:
                marks[f"{int(m.group(1)):02d}"] = int(m.group(2))
                continue
            m = TOTAL_OLD.search(t)
            if m:
                before = [q for (pg, y, q) in labels if (pg, y) < (i, s["bbox"][1])]
                if before and before[-1] not in marks:
                    marks[before[-1]] = int(m.group(1))
    return marks


def below_header(page):
    """Where a scheme page's own content starts: under the "Question | Scheme | Marks"
    header Edexcel repeats at the top of every page, or 30pt down if there isn't one."""
    for s in spans(page):
        if s["text"].strip() == "Scheme" and s["bbox"][1] < 150:
            mid = (s["bbox"][1] + s["bbox"][3]) / 2
            return max(t["bbox"][3] for t in spans(page) if abs((t["bbox"][1] + t["bbox"][3]) / 2 - mid) < 6) + 4
    return 30


def page_box(page):
    """Where a scheme page's rows can be: the page's margins, widened to its table where that
    runs past them (the AOs column), and above its footer ("Pearson Education Limited.
    Registered company number 872828"), which a question's last piece used to take in."""
    w, h = page.rect.width, page.rect.height
    table = cut.ms_frame(page)
    foot = [s["bbox"][1] for s in spans(page) if s["bbox"][1] > h - 90
            and not table.contains(pymupdf.Point((s["bbox"][0] + s["bbox"][2]) / 2, (s["bbox"][1] + s["bbox"][3]) / 2))]
    return pymupdf.Rect(28, 30, min(w - 4, max(w - 28, table.x1)), min([h - 40] + [y - 2 for y in foot]))


def ms_regions(doc, questions):
    """Each question's rows: from its first label to the next question's first label.

    Read only from where the scheme's table starts (a page with a "Scheme" column
    heading), and find the paper's questions in order, so the numbered marking
    guidance at the front and stray digits in the maths are never taken for labels.
    A plain "2" counts as a label only if it's bold or sits in the label column."""
    start = next((i for i, p in enumerate(doc) if re.search(r"^\s*Scheme\s*$", p.get_text(), re.M)), 0)
    cands = []
    for i in range(start, len(doc)):
        page = doc[i]
        for s in spans(page):
            t = s["text"].strip()
            m = MS_LABEL.match(t)
            if m and s["bbox"][0] < 140 and s["size"] >= 10 and s["bbox"][1] < page.rect.height - 50:
                strong = "Bold" in s["font"] or bool(re.search(r"[.(a-zQ]", t))
                cands.append({"pg": i, "y": s["bbox"][1], "x": s["bbox"][0], "n": int(m.group(1)), "strong": strong})
    xs = sorted(c["x"] for c in cands if c["strong"])
    col = xs[len(xs) // 2] if xs else None
    firsts, cursor = [], (start, -1)
    for q in questions:
        hit = next((c for c in cands if c["n"] == int(q) and (c["pg"], c["y"]) > cursor
                    and (c["strong"] or (col is not None and abs(c["x"] - col) < 6))), None)
        if hit:
            firsts.append((hit["pg"], hit["y"], q))
            cursor = (hit["pg"], hit["y"])
    out = {}
    for n, (pg0, y0, q) in enumerate(firsts):
        nxt = firsts[n + 1] if n + 1 < len(firsts) else None
        pieces, pg = [], pg0
        top = cut.row_start(doc[pg0], y0)
        head = below_header(doc[pg0])
        if 30 < head < y0:
            top = max(top, head - 3)  # never part way through the column headings over the row
        last = nxt[0] if nxt else min(len(doc) - 1, pg0 + 2)
        while pg <= last:
            page = doc[pg]
            box = page_box(page)
            end = cut.row_start(page, nxt[1]) if nxt and nxt[0] == pg else box.y1
            if end > top + 8:
                pieces.append((pg, pymupdf.Rect(box.x0, max(top, box.y0), box.x1, end)))
            pg += 1
            if pg <= last:
                top = below_header(doc[pg])  # a continuation page: skip its repeated table header
        out[q] = (pieces, "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces))
    return out


def open_upright(path):
    """Some older schemes store landscape pages rotated 90°: make every page
    rotation 0 (looking the same) so coordinates read the way the page looks."""
    doc = pymupdf.open(path)
    for page in doc:
        if page.rotation:
            page.remove_rotation()
    return doc


def cut_set(qp_path, ms_path, er_path, set_id, meta, legacy):
    qp = open_upright(qp_path)
    if not any(p.get_text().strip() for p in qp):
        return []  # a scanned paper with no text layer: nothing to cut without OCR
    regions = qp_regions(qp, legacy)
    marks = qp_marks(qp, [(pieces[0][0], pieces[0][1].y0 + 6, q) for q, pieces, _ in regions if pieces])
    ms = open_upright(ms_path) if ms_path and os.path.exists(ms_path) else None
    ms_map = ms_regions(ms, [q for q, _, _ in regions]) if ms else {}
    er = cut.examiner_report(er_path)
    parts = []
    for q, pieces, text in regions:
        if not pieces:
            continue
        pid = f"{set_id}-{q}"
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[p], r)) for p, r in pieces])
        msimg, ms_text = None, ""
        if q in ms_map and ms_map[q][0]:
            mpieces, ms_text = ms_map[q]
            msimg = cut.stack([cut.trim_bottom(cut.render(ms[p], r), 12) for p, r in mpieces])
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": None, "label": str(int(q)),
            "marks": marks.get(q),
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": None,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
        })
    return parts


def run_set(job):
    set_id, files, meta, legacy = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta, legacy), None
    except Exception as e:  # noqa: BLE001
        return set_id, [], f"{type(e).__name__}: {e}"


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" not in files or (ONLY and not set_id.startswith(ONLY)):
            continue
        spec = comp.split("-")[0]
        jobs.append((set_id, files, {"component": comp, "spec": spec, "series": series, "paperTitle": files["qp"].get("title", "")}, "-" not in comp))
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
            print(f"{set_id}: {len(parts)} questions, {no_ms} without scheme, {no_marks} without marks", file=sys.stderr, flush=True)
            if parts and no_ms > len(parts) / 3:
                problems.append(f"{set_id}: {len(parts)} questions, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} questions; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
