"""Cut AQA's GCSE Food Preparation and Nutrition (8585/W) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_food/cut_food.py [work-dir] [--only=8585w-jun23]   # default scripts/question-bank/.work/aqa-gcse-food

cut.py, patched for Food's one written paper. Section A is question 01: twenty 1-mark multiple-choice
parts ("0 1 . 1" to "0 1 . 2 0", options A-D); Section B is questions 02-06, with parts ("0 2 . 3")
and now and then a whole question (June 2025's 12-mark "0 4"). What differs from cut.py:
  - The scheme's Section B labels sit in two columns, "Qu" ("02") and "Part" ("1"), 40pt apart,
    which cut.py's reader takes for a question's label alone (left_labels), and each question
    reprints the columns' "Qu" heading over its first row (row_start).
  - The scheme frame stays inside the page-wide header and footer rules (ms_frame); a question's
    frame takes in a table's bottom rule just under it, but not the page's border, and ends above
    "Question 2 continues on the next page" (frame).
  - A question paper's part ends above the "Section B" heading (regions), and keeps a multiple-choice
    option or a table's "An example has been completed for you." rather than moving it down to the
    next part as its setup (move_setups).
  - Multiple choice is marked by its letter: the scheme's "D – Yellow" row is the part's key, checked
    against the question paper's option D, and it has no scheme crop.
  - The reports comment part by part ("Question 2.1"): a question's report keeps each part's comments
    under a "Question 02.1" heading, which the site's report panel reads to show a part's own comments first.
  - A set's problems are listed: a part with neither key nor scheme, a multiple-choice part whose key
    isn't one letter or whose words don't match the paper's option, a levels-marked scheme without its
    grid's 0-mark row or its indicative content (table answers are marked point by point), and a paper
    whose questions don't add up to 100 marks.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-food")] + flags
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
COMPONENTS = ("8585W",)
TOTAL = 100
MCQ = re.compile(r"\[1 mark\]\s*A\s+\S.*?\sB\s+\S.*?\sC\s+\S.*?\sD\s+\S", re.S)
KEY = re.compile(r"\b0?1\.\d{1,2}\s+([A-D])\s*[–-]\s*(.+?)\s+AO\d", re.S)
OPTIONS = re.compile(r"\[1 mark\]\s*A\s+(.+?)\s+B\s+(.+?)\s+C\s+(.+?)\s+D\s+(.+)$", re.S)
BANDS = re.compile(r"\d\s*[–-]\s*\d+\s*Marks", re.I)  # a levels grid's "5–6 Marks"
LEVELS = re.compile(r"\b0\s*Marks?\b|No answer worthy of credit|No relevant content", re.I)
_left_labels = cut.left_labels


def left_labels(page, max_x, bold_only, with_x=False):
    """cut.py's labels, with a scheme's "Qu | Part" pair read as one: "02" at x 43-68 and its part "1" at 69-122."""
    out = _left_labels(page, max_x, bold_only, with_x)
    if bold_only:
        return out
    parts = [(l["bbox"][1], t) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
             for t in ["".join(s["text"] for s in l["spans"]).strip()]
             if re.fullmatch(r"\d{1,2}", t) and 69 < l["bbox"][0] < 135 and "Bold" in l["spans"][0]["font"]]
    fixed = []
    for row in out:
        y, q, p = row[:3]
        if p is None:
            p = next((t for py, t in parts if abs(py - y) < 4), None)
        fixed.append((y, q, p, *row[3:]))
    return fixed


cut.left_labels = left_labels


def row_start(page, y, floor=0):
    """cut.py's row_start, for a scheme whose column headings read "Qu" (Section B), not "Question": each question
    reprints them over its first row, so the part above ended with them."""
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings()
                    if d["rect"].height < 3 and d["rect"].width > 20 and d["rect"].x0 < 70})
    above = [r for r in rules if r <= y + 2]
    if not above:
        return y - 6
    top = above[-1]
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip() in ("Question", "Qu") and "Bold" in s["font"] and max(top - 60, floor) < s["bbox"][1] < top:
                    head = [r for r in rules if r <= s["bbox"][1] + 2]
                    return (head[-1] if head else s["bbox"][1] - 8) - 1
    return top - 1


cut.row_start = row_start
_frame = cut.frame


def frame(page, portrait=True):
    """cut.py's page frame, taken down onto a table's bottom rule just under it (November 2021's 06.2 table ends at
    761-765pt, on a page whose frame ends at 761pt above "Turn over"), but never onto the page's own border (a rule 480pt
    or wider in its last 90pt), where trim_bottom would keep all the white space above it. It ends above "Question 2
    continues on the next page"."""
    r = _frame(page, portrait)
    if not portrait:
        return r
    h = page.rect.height
    rules = [d["rect"].y1 for d in page.get_drawings() if d["rect"].width > 100 and r.y1 - 2 < d["rect"].y0 < r.y1 + 6 and d["rect"].y1 < r.y1 + 8
             and not (d["rect"].width >= 480 and d["rect"].y0 > h - 90)]
    if rules:
        r = pymupdf.Rect(r.x0, r.y0, r.x1, max(rules) + 1)
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            if re.match(r"Question \d+ continues", "".join(s["text"] for s in line["spans"]).strip()):
                r.y1 = min(r.y1, line["bbox"][1] - 4)
    return r


cut.frame = frame
_ms_frame = cut.ms_frame


def ms_frame(page):
    """cut.py's scheme frame, inside the running header's and footer's page-wide rules (68 and 791pt), which it took
    for the table's own and left at the top and foot of a scheme carried over a page."""
    r = _ms_frame(page)
    w, h = page.rect.width, page.rect.height
    wide = [d["rect"].y0 for d in page.get_drawings() if d["rect"].height < 3 and d["rect"].width > w * 0.85]
    top = max([y + 1.5 for y in wide if y < 100], default=r.y0)
    foot = min([y - 1.5 for y in wide if y > h - 100], default=r.y1)
    return pymupdf.Rect(r.x0, max(r.y0, top), r.x1, min(r.y1, foot))


cut.ms_frame = ms_frame
_move_setups = cut.move_setups


def move_setups(doc, out):
    """cut.py's move_setups, sparing multiple choice and any part whose next label is on a later page. A multiple-choice
    part's options ("A Food can be sold after this date.") are full sentences at the margin after the marks, and an
    instruction under the marks ("An example has been completed for you.", over November 2020's cheesemaking table) is
    one too: both were moved down to the next part as its setup. A setup is printed right above its part, so a part
    whose next label is on a later page keeps everything under it. move_setups passes over a stem (part None), so each
    spared part is shown to it as one while it runs."""
    spare = [n for n, (key, pieces, text) in enumerate(out) if key[1] is not None and pieces and (
        key[0] == "01" or n + 1 >= len(out) or not out[n + 1][1] or out[n + 1][1][0][0] != pieces[-1][0])]
    keys = {n: out[n][0] for n in spare}
    for n in spare:
        out[n][0] = (keys[n][0], None)
    before = [[r for _, r in pieces] for _, pieces, _ in out]
    _move_setups(doc, out)
    for n in spare:
        out[n][0] = keys[n]
    if os.environ.get("SHOW_MOVES"):
        for n, (key, pieces, text) in enumerate(out):
            if [r for _, r in pieces] != before[n]:
                print("moved", doc.name.rsplit("/", 1)[-1], key, [tuple(round(v) for v in r) for r in before[n]], "->",
                      [tuple(round(v) for v in r) for _, r in pieces], file=sys.stderr)


cut.move_setups = move_setups
_regions = cut.regions


def regions(doc, max_x, bold_only, portrait):
    """cut.py's regions, with a question paper's part ended above a section's heading ("Section B / Answer all questions
    in this section. / There are 80 marks available."), which followed Section A's last multiple-choice part (01.20)."""
    out = _regions(doc, max_x, bold_only, portrait)
    if not portrait:
        return out
    for region in out:
        for n, (pg, rect) in enumerate(region[1]):
            head = next((y for y, x, t in cut.text_lines(doc[pg], rect) if t == "Section B" and y > rect.y0 + 8), None)
            if head is not None:
                region[1] = region[1][:n] + [(pg, pymupdf.Rect(rect.x0, rect.y0, rect.x1, head - 6))]
                region[2] = "\n".join(doc[p].get_text("text", clip=r) for p, r in region[1])
                break
    return out


cut.regions = regions
REPORT_HEADING = re.compile(r"\n\s*Question (\d{1,2})(?:\.(\d{1,2}))?\s*\n")


def tidy(body):
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"(?<!\n)\n(?!\n)", " ", body).strip()
    return re.sub(r"\n{2,}", "\n\n", re.sub(r"[ \t]{2,}", " ", body))


def examiner_report(path):
    """{question: its comments}, each part's under its own "Question 02.1" heading (a whole question's with none)."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    first = REPORT_HEADING.search(text)
    if not first:
        return {}
    end = re.search(r"\n\s*(?:Mark Ranges and Award of Grades|Use of statistics|Further support|Support and guidance)\s*\n", text[first.start():], re.I)
    text = text[first.start():first.start() + end.start()] if end else text[first.start():]
    text = re.sub(r"\n\s*\d+ of \d+\s*\n|\n\s*REPORT ON THE EXAMINATION[^\n]*\n", "\n", text)
    bits = REPORT_HEADING.split(text)
    out = {}
    for k in range(1, len(bits) - 2, 3):
        q, p, body = f"{int(bits[k]):02d}", bits[k + 1], tidy(bits[k + 2])
        if not body:
            continue
        piece = f"Question {q}.{p}\n\n{body}" if p else body
        out[q] = (out[q] + "\n\n" + piece) if q in out else piece
    return out


cut.examiner_report = examiner_report


def option(text, letter):
    """The words of a multiple-choice option in the question paper ("C" -> "Soft cheese")."""
    m = OPTIONS.search(text)
    return re.sub(r"\s+", " ", m.group("ABCD".index(letter) + 1)).strip() if m else ""


def squash(x):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\s*O\s*C\b", "C", x).lower())  # the scheme's "75 O C" is its degree sign


def same(text, letter, words):
    """The scheme's words for the key are the paper's option for that letter: read off its A-D, or, where an
    option holds a letter of its own ("Vitamins B and C"), found after the letter anywhere in the part."""
    a, b = squash(option(text, letter)), squash(words)
    return bool(b) and (a.startswith(b[:12]) or b.startswith(a[:12]) and a != "" or squash(letter + words) in squash(text))


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """cut.py's parts, with multiple choice keyed, and {id: its scheme's whole text} for the checks."""
    parts = cut.cut_set(qp_path, ms_path, er_path, set_id, meta)
    full = {}
    if ms_path and os.path.exists(ms_path):
        for (q, p), pieces, text in cut.regions(pymupdf.open(ms_path), 110, False, False):
            full.setdefault(f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}", text)
    for p in parts:
        if p["question"] == "01" and MCQ.search(p["text"]) and (m := KEY.search(full.get(p["id"], ""))):
            p["key"], p["keyWords"] = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            if p["ms"]:
                os.remove(os.path.join(IMG, p["ms"]))
                p["ms"] = None
    return parts, {k: re.sub(r"\s+", " ", v) for k, v in full.items()}


def problems_of(set_id, parts, full):
    out = []
    for p in parts:
        pid, ms = p["id"], full.get(p["id"], "")
        if not p["ms"] and not p.get("key"):
            out.append(f"{pid}: no scheme")
        if p["question"] == "01":
            if not re.fullmatch(r"[A-D]", p.get("key") or ""):
                out.append(f"{pid}: multiple choice, key {p.get('key')}")
            elif not same(p["text"], p["key"], p.get("keyWords", "")):
                out.append(f"{pid}: key {p['key']} '{p.get('keyWords')}' vs paper's '{option(p['text'], p['key'])}'")
            if p["marks"] != 1:
                out.append(f"{pid}: multiple choice worth {p['marks']}")
        elif p["ms"] and BANDS.search(ms) and not LEVELS.search(ms):
            out.append(f"{pid}: {p['marks']}-mark levels scheme without its 0-mark row")
        if p["ms"] and BANDS.search(ms) and not re.search(r"Indicative content|Possible content|Answers? (may|could|should) include", ms, re.I):
            out.append(f"{pid}: {p['marks']}-mark scheme without its indicative content")
        if not p["qp"] or not p["h"]:
            out.append(f"{pid}: no crop")
        if not p["marks"]:
            out.append(f"{pid}: no marks read")
    mc = sum(1 for p in parts if p["question"] == "01")
    if mc != 20:
        out.append(f"{set_id}: {mc} multiple-choice parts, not 20")
    marks = sum(p["marks"] or 0 for p in parts)
    if marks != TOTAL:
        out.append(f"{set_id}: {marks} marks, not {TOTAL}")
    return out


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        parts, full = cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta)
        return set_id, parts, problems_of(set_id, parts, full), None
    except Exception as e:  # noqa: BLE001
        return set_id, [], [], repr(e)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] != "SPEC" and f["component"] in COMPONENTS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} questions, {sum(1 for p in parts if p.get('key'))} keys, {sum(1 for p in parts if p['ms'])} schemes, "
                  f"{len({p['question'] for p in parts if p['er']})} reported, {sum(p['marks'] or 0 for p in parts)} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
