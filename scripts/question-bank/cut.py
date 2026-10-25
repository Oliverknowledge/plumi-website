"""Cut AQA papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/cut.py [work-dir]        # needs: pip install pymupdf pillow

For every question paper in <work-dir>/manifest.json (see fetch_aqa.py):
  - finds each part by its boxed label ("0 1 . 1") in the left margin,
  - crops it from its label to the next one, across page breaks, inside the
    answer frame (so the "Do not write outside the box" margin is dropped),
  - finds the same part's rows in the mark scheme ("01.1") and crops those,
  - takes the examiner report's paragraph for the whole question,
and writes <work-dir>/img/<id>-qp.webp, <id>-ms.webp, <id>-stem.webp and
<work-dir>/parts.json with each part's text (for search and tagging) and marks.
"""
import io, json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--only=")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)  # re-cut just these sets, e.g. --only=74023
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, ".work")
IMG = os.path.join(WORK, "img")
os.makedirs(IMG, exist_ok=True)
SCALE = 2.2  # ~160 dpi: sharp on a retina phone, small as WebP

QLABEL = re.compile(r"^(\d{2})(?:\.(\d{1,2}))?$")
NOT_QUESTIONS = re.compile(r"no questions printed on this page|do not write on this page", re.I)
EXTRA_SPACE = re.compile(r"^\s*extra space\s*$", re.I | re.M)


def norm(text):
    return re.sub(r"\s+", "", text)


def left_labels(page, max_x, bold_only, with_x=False):
    """Question labels in the left margin: [(y0, '01', '1' or None)], with each one's x0 last when `with_x`.

    A label's boxes ("0", "1", ".", "1") can be separate lines or even blocks, so
    spans are gathered page-wide and joined by baseline before matching."""
    spans = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                # The part number box can sit further right than the question number.
                # Page numbers and barcodes live in the footer: never labels.
                if s["bbox"][1] > page.rect.height - 60 or s["size"] < 9:
                    continue
                if s["bbox"][0] < max_x + 70 and s["text"].strip() and (not bold_only or "Bold" in s["font"]):
                    spans.append(s)
    rows = []
    for s in sorted(spans, key=lambda s: (round(s["bbox"][1]), s["bbox"][0])):
        if rows and abs(rows[-1][0] - s["bbox"][1]) < 4:
            rows[-1][1].append(s)
        else:
            rows.append([s["bbox"][1], [s]])
    out = []
    for y, row in rows:
        row = sorted(row, key=lambda s: s["bbox"][0])
        if row[0]["bbox"][0] >= max_x:
            continue
        # Read boxes left to right, stopping at the first span that isn't digits or a point.
        # A wide gap ends the label too: a scheme's answer can open with digits on its line ("132").
        label, x1 = "", row[0]["bbox"][0]
        for s in row:
            if not re.fullmatch(r"[\d.\s]+", s["text"]) or s["bbox"][0] - x1 > 25:
                break
            label += s["text"]
            x1 = s["bbox"][2]
        x = (row[0]["bbox"][0],) if with_x else ()
        m = QLABEL.match(norm(label))
        if m:
            out.append((y, m.group(1), m.group(2), *x))
        elif not bold_only and row[0]["bbox"][0] < 90 and (m := re.fullmatch(r"(\d)\.(\d{1,2})", norm(label))) and table_page(page):
            out.append((y, "0" + m.group(1), m.group(2), *x))  # a scheme that prints "1.1" for "01.1" (GCSE, June 2019)
    return out


def table_page(page):
    """A mark scheme page with its table on it, headed "Question", unlike the marking
    guidance at the front, whose numbered paragraphs ("2.1") would pass for labels."""
    return any(s["text"].strip() == "Question" and "Bold" in s["font"]
               for block in page.get_text("dict")["blocks"] for line in block.get("lines", []) for s in line["spans"])


def frame(page, portrait=True):
    """The content area of a page: below the page number, above 'Turn over', inside the box margin."""
    w, h = page.rect.width, page.rect.height
    top, bottom, right = 46, h - 76, w - 54
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                t = s["text"].strip()
                if t.startswith("Turn over") or t.startswith("END OF QUESTIONS"):
                    bottom = min(bottom, s["bbox"][1] - 4)
                if t.startswith("Do not write") and portrait:
                    right = min(right, s["bbox"][0] - 5)
    if portrait:
        # Inside the answer frame's border lines, so trailing white space can be trimmed.
        return pymupdf.Rect(44, top, min(right, 537), bottom - 5)
    return pymupdf.Rect(38, top, right, bottom)


def ms_frame(page):
    """A mark scheme page's rows: inside its table where it draws one. frame()'s fixed margins
    cut the table's right-hand column off a portrait GCSE scheme (the table runs to 557pt, the
    frame to 541pt) and dropped rows below 766pt, and its top ran through the running header
    ("MARK SCHEME – A-LEVEL PHYSICS – 7408/1 – JUNE 2023", 34-50pt)."""
    w, h = page.rect.width, page.rect.height
    lines = [l["bbox"] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if "".join(s["text"] for s in l["spans"]).strip()]
    head = [y1 for x0, y0, x1, y1 in lines if y0 < 60]
    top = max(head) + 2 if head else 46
    rules = [d["rect"] for d in page.get_drawings() if d["rect"].width > 30 and d["rect"].width < w - 10]
    if len(rules) >= 2 and max(r.y1 for r in rules) - min(r.y0 for r in rules) >= h / 3:
        y0, y1 = min(r.y0 for r in rules), max(r.y1 for r in rules)
        cells = [d["rect"] for d in page.get_drawings() if d["rect"].y1 >= y0 and d["rect"].y0 <= y1 and d["rect"].width < w - 10]
        return pymupdf.Rect(max(20, min(r.x0 for r in cells) - 2), max(top, y0 - 2), min(w - 20, max(r.x1 for r in cells) + 2), min(h - 20, y1 + 2))
    foot = [y0 for x0, y0, x1, y1 in lines if y0 > h - 60]
    return pymupdf.Rect(38, top, w - 38, min(foot) - 2 if foot else h - 76)


def render(page, rect):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=rect, alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def trim_bottom(img, keep=36):
    """Trim trailing white space below the last ink, keeping a little air."""
    bg = Image.new("RGB", img.size, (255, 255, 255))
    box = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    return img.crop((0, 0, img.width, min(img.height, box[3] + keep)))


def stack(images):
    images = [i for i in images if i is not None]
    if not images:
        return None
    w = max(i.width for i in images)
    out = Image.new("RGB", (w, sum(i.height for i in images) + 12 * (len(images) - 1)), (255, 255, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + 12
    return out


def save(img, name):
    if img is None:
        return None
    if img.height > 16000:  # WebP's limit; only an unusually long part gets here
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    path = os.path.join(IMG, name)
    img.save(path, "WEBP", quality=72, method=4)
    return name


def row_start(page, y, floor=0):
    """In a mark scheme table a label sits mid-row: start at the row's top rule, or the
    rule above the column headings when they sit directly over the row."""
    # Cell borders are drawn per cell, so read row edges off the first column's segments.
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})
    above = [r for r in rules if r <= y + 2]
    if not above:
        return y - 6
    top = above[-1]
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip() == "Question" and "Bold" in s["font"] and max(top - 60, floor) < s["bbox"][1] < top:
                    head = [r for r in rules if r <= s["bbox"][1] + 2]
                    return (head[-1] if head else s["bbox"][1] - 8) - 1
    return top - 1


def text_lines(page, rect):
    """Lines of text inside a rect: [(y0, x0, text)], top to bottom."""
    out = []
    for block in page.get_text("dict", clip=rect)["blocks"]:
        for line in block.get("lines", []):
            t = "".join(s["text"] for s in line["spans"]).strip()
            if t:
                out.append((line["bbox"][1], line["bbox"][0], t))
    return sorted(out)


def move_setups(doc, out):
    """Once a part has printed its marks, a full sentence back at the text margin
    is the setup for the next part ("Table 1 shows..."), not more of this one.
    Move it, with everything after it, to the top of the next part."""
    for n in range(len(out) - 1):
        key, pieces, text = out[n]
        if not pieces or key[1] is None:
            continue
        pg, rect = pieces[-1]
        lines = text_lines(doc[pg], rect)
        marks_y = next((y for y, x, t in lines if re.search(r"\[\d+ marks?", t)), None)
        if marks_y is None and len(pieces) == 1:
            continue  # the marks haven't been printed yet: everything here is this part's
        margin = min((x for y, x, t in lines if x > rect.x0 + 30), default=None)
        if margin is None or any(re.match(r"Tick\b", t) for y, x, t in lines):
            continue  # a tick-box part's options are full sentences at the margin too
        after = marks_y if marks_y is not None else rect.y0
        # Paragraphs at the margin after the marks: lines no more than ~1.5 lines apart.
        paras, last_y = [], None
        for y, x, t in lines:
            if y <= after + 2:
                continue
            if abs(x - margin) < 12 and paras and last_y is not None and y - last_y < 17:
                paras[-1][1].append(t)
            elif abs(x - margin) < 12:
                paras.append((y, [t]))
            last_y = y
        split = next((y for y, ts in paras if " ".join(ts).endswith(".") and len(" ".join(ts).split()) >= 6
                      and ts[0][:1].isupper() and not re.match(r"(Answer|Extra space|Show your working)", ts[0])), None)
        if split is None:
            continue
        cut_y = split - 6
        if cut_y <= rect.y0 + 8 and len(pieces) == 1:
            continue  # the whole part would move: it is its own setup
        moved = pymupdf.Rect(rect.x0, cut_y, rect.x1, rect.y1)
        moved_text = doc[pg].get_text("text", clip=moved)
        out[n] = [key, pieces[:-1] + ([(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, cut_y))] if cut_y > rect.y0 + 8 else []), text.replace(moved_text, "")]
        nkey, npieces, ntext = out[n + 1]
        if npieces and npieces[0][0] == pg and abs(npieces[0][1].y0 - rect.y1) < 2:
            first = npieces[0][1]
            out[n + 1] = [nkey, [(pg, pymupdf.Rect(first.x0, cut_y, first.x1, first.y1))] + npieces[1:], moved_text + "\n" + ntext]
        else:
            out[n + 1] = [nkey, [(pg, moved)] + npieces, moved_text + "\n" + ntext]


def skip_page(page, max_x, bold_only):
    """A page with no questions on it. An "Extra space" line alone doesn't make one:
    newer papers print it under a long answer on a page that goes on to the next part."""
    text = page.get_text()
    return bool(NOT_QUESTIONS.search(text) or (EXTRA_SPACE.search(text) and not left_labels(page, max_x, bold_only)))


def regions(doc, max_x, bold_only, portrait):
    """Walk a document's labels in order: [(key, [(page, rect)], text)]. key = ('01', '1') or ('01', None) for a stem."""
    marks = []  # (page index, y, q, part)
    for i, page in enumerate(doc):
        if skip_page(page, max_x, bold_only):
            continue
        prev = 0
        labels = left_labels(page, max_x, bold_only, with_x=True)
        # A scheme's answer can open with a bare number at the answer column's edge ("24 × 3", x 109,
        # where the labels are at 63): a label with no part must start in the labels' column.
        col = min((x for _, _, p, x in labels if p), default=None)
        for y, q, p, x in labels:
            if not portrait and p is None and col is not None and x > col + 20:
                continue
            marks.append((i, y if portrait else max(prev + 8, row_start(page, y, prev)) + 6, q, p))
            prev = y
    out = []
    for n, (i, y, q, p) in enumerate(marks):
        nxt = marks[n + 1] if n + 1 < len(marks) else None
        pieces, pg = [], i
        while True:
            page = doc[pg]
            f = frame(page, portrait) if portrait else ms_frame(page)
            top = y - 6 if pg == i else f.y0
            end = nxt[1] - 6 if nxt and nxt[0] == pg else f.y1
            if end > top + 24 or (end > top + 8 and page.get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, end)).strip()):
                pieces.append((pg, pymupdf.Rect(f.x0, top, f.x1, end)))
            if (nxt and nxt[0] == pg) or pg + 1 >= len(doc) or "END OF QUESTIONS" in page.get_text():
                break
            pg += 1
            if nxt and pg > nxt[0]:
                break
            if skip_page(doc[pg], max_x, bold_only):
                break
        text = "\n".join(doc[pg].get_text("text", clip=r) for pg, r in pieces)
        out.append([(q, p), pieces, text])
    if portrait:
        move_setups(doc, out)
    return out


def examiner_report(path):
    if not path or not os.path.exists(path):
        return {}
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    text = re.sub(r"REPORT ON THE EXAMINATION[^\n]*\n|\n\s*\d+ of \d+\s*\n", "\n", text)
    # GCSE reports add the demand: "Question 1 (Standard demand)".
    parts = re.split(r"\n\s*Question (\d{1,2})(?:\s*\([^)\n]*\))?\s*\n", text)
    sections = [(parts[k], parts[k + 1]) for k in range(1, len(parts) - 1, 2)]
    if not sections:
        # Some go straight to the parts, each label on its own line ("01.3"): a question runs from its first part to the next question's.
        starts = {}
        for m in re.finditer(r"\n\s*(\d{1,2})\.\d{1,2}\s*\n", text):  # "01.3", or "1.3" (June 2025)
            starts.setdefault(f"{int(m.group(1)):02d}", m.start())
        bounds = sorted(starts.items(), key=lambda qs: qs[1]) + [("", len(text))]
        sections = [(q, text[at:bounds[n + 1][1]]) for n, (q, at) in enumerate(bounds[:-1])]
    out = {}
    for q, raw in sections:
        body = re.split(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support)", raw)[0]
        body = re.sub(r"[ \t]+\n", "\n", body)
        body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
        body = re.sub(r"\n{2,}", "\n\n", body)
        if body:
            out[f"{int(q):02d}"] = body
    return out


def mcq_keys(doc):
    """The objective test key at the back of a Physics scheme: rows of question
    numbers, each followed by a row of letters. Returns {'08': 'A', ...}."""
    text = "\n".join(p.get_text() for p in doc)
    i = text.find("Keys to Objective Test")
    if i < 0:
        return {}
    tokens = [t.strip() for t in text[i:].split("\n") if t.strip()][1:]
    keys, nums, letters = {}, [], []
    for t in tokens:
        if re.fullmatch(r"\d{1,2}", t):
            if letters:
                keys.update({f"{int(n):02d}": l for n, l in zip(nums, letters)})
                nums, letters = [], []
            nums.append(t)
        elif re.fullmatch(r"[A-D]", t) and nums:
            letters.append(t)
    keys.update({f"{int(n):02d}": l for n, l in zip(nums, letters)})
    return keys


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    parts = []
    qp_regions = regions(qp, 75, True, True)
    ms_map, keys = {}, {}
    if ms_path and os.path.exists(ms_path):
        ms = pymupdf.open(ms_path)
        keys = mcq_keys(ms)
        for (q, p), pieces, text in regions(ms, 110, False, False):
            ms_map.setdefault((q, p), (ms, pieces, text))
    er = examiner_report(er_path)
    stems = {}
    for (q, p), pieces, text in qp_regions:
        if p is None:
            stems[q] = (pieces, text)
    has_parts = {q for (q, p), _, _ in qp_regions if p is not None}
    for (q, p), pieces, text in qp_regions:
        if p is None and q in has_parts:
            continue  # a stem: saved once, shown above its question's parts
        label = f"{q}.{p}" if p else q
        pid = f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}"
        # Continuation pages that are only answer lines (an essay's two blank pages) add nothing on screen.
        keep = [pieces[0]] + [(pg, r) for pg, r in pieces[1:]
                              if re.search(r"[A-Za-z]{3,}", re.sub(r"Extra space|Do not write|outside the|box|Answer", "", qp[pg].get_text("text", clip=r)))]
        qimg = stack([trim_bottom(render(qp[pg], r)) for pg, r in keep])
        msimg = None
        ms_text = ""
        if p is None and q in keys:
            pass  # multiple choice: the key's letter, never a crop (the key grid's numbers look like row labels)
        elif (q, p) in ms_map:
            ms, mpieces, ms_text = ms_map[(q, p)]
            msimg = stack([trim_bottom(render(ms[pg], r), 12) for pg, r in mpieces])
        stem_name = None
        if p and q in stems:
            stem_name = f"{set_id}-{q}-stem.webp"
            if not os.path.exists(os.path.join(IMG, stem_name)):
                save(stack([trim_bottom(render(qp[pg], r), 16) for pg, r in stems[q][0]]), stem_name)
        m = re.findall(r"\[(\d+) marks?\]?", text)
        parts.append({
            "id": pid, "set": set_id, **meta, "question": q, "part": p, "label": label,
            "marks": sum(int(x) for x in m) if m else None,
            "qp": save(qimg, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", (stems.get(q, ("", ""))[1] if p else "") + " " + text).strip()[:1500],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
            "er": er.get(q),
            **({"key": keys[q]} if p is None and q in keys else {}),
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta), None
    except Exception as e:  # noqa: BLE001
        return set_id, [], str(e)


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY:
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"] and not p.get("key"))
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme", file=sys.stderr, flush=True)
            if not parts or no_ms > len(parts) / 2:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
