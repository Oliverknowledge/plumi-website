"""Cut AQA's legacy A-Level Chemistry unit papers (CHEM1, 2, 4, 5; 2010-2016) into question parts.

    python3 scripts/question-bank/aqa_chem_legacy/cut_legacy.py [work-dir] [--only=chem1-jun14]
    # needs: pip install pymupdf pillow

The 2420 papers print their labels the old way, "2 (b) (ii)", the question number bold at the
left margin and every part's line carrying its full label, where cut.py reads the current
spec's boxed "01.1". So this is cut.py's sibling, using its frame, render and save helpers:
  - a label counts only when it comes after the one before it in the paper (2(b) after 2(a)(ii),
    3 after 2), which keeps numbers in tables and diagrams out;
  - a question's opening words, before its first part, are its stem ("<id>-stem.webp"); a part's
    own opening words, "2 (a) Figure 1 shows…" before "2 (a) (i)", go above its first sub-part,
    as cut_pearson.py does for Edexcel;
  - a part's crop stops at its "(Extra space)" line: the dotted lines under it are only room to write;
  - its scheme rows are found by the same label in the scheme's table, which AQA printed as
    "2(b)(ii)", "2 (b) (ii)", "2b(ii)" or across three columns "2 | b | ii" over the years. A
    part whose own rows can't be read takes its part's or question's rows (`msq`), or, failing
    that, the whole scheme (`msf`, added by build_legacy.py).
Ids are <unit>-<series>-<question>[-<part><sub-part>]: "chem2-jan12-03-bii".
Writes <work-dir>/img/*.webp and <work-dir>/parts.json in cut.py's shape.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--only=")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work-chem-legacy")
sys.argv = [sys.argv[0], WORK]  # cut.py reads its work dir from argv at import
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

LETTERS = "abcdefgh"
ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"]
TOKEN = re.compile(r"^(?=.)(?:\d{1,2})?(?:\(?[a-h]\)?)?(?:\(?(?:i{1,3}|iv|vi{0,3})\)?)?$")  # "2", "(b)", "ii", "2(b)(ii)", "2b(ii)"
LABEL = re.compile(r"^(\d{1,2})(?:\(?([a-h])\)?)?(?:\(?(i{1,3}|iv|vi{0,3})\)?)?$")
MARKS = re.compile(r"[(\[](\d{1,2}) marks?[)\]]")
EXTRA = re.compile(r"^\(?Extra space\)?", re.I)


def key_of(q, letter, roman):
    """A sortable key: (2, 1, 2) for 2(a)(ii); 0 where a level is absent."""
    return (q, LETTERS.index(letter) + 1 if letter else 0, ROMANS.index(roman) + 1 if roman else 0)


def rows_of(page, max_x):
    """Text left of `max_x`, grouped into rows by baseline: [(y0, [spans left to right])].
    Some schemes print a label twice over itself (a fake bold: "9" and "9(a)(i)" at one x, or "6(c" and
    "c)(i)"), so the row is rebuilt from its characters, a repeated character at the same place dropped,
    and split into spans again wherever a gap opens."""
    chars = [(c["c"], c["bbox"], s["font"]) for b in page.get_text("rawdict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             for c in s["chars"] if c["bbox"][0] < max_x]
    rows = []
    for ch in sorted(chars, key=lambda ch: (round(ch[1][1]), ch[1][0])):
        if rows and abs(rows[-1][0] - ch[1][1]) < 4:
            rows[-1][1].append(ch)
        else:
            rows.append([ch[1][1], [ch]])
    out = []
    for y, row in rows:
        kept = []
        for c, bbox, font in sorted(row, key=lambda ch: ch[1][0]):
            if any(k[0] == c and abs(k[1][0] - bbox[0]) < 1.5 for k in kept[-4:]):
                continue
            kept.append((c, bbox, font))
        spans = []
        for c, bbox, font in kept:
            if c.isspace() and not (spans and bbox[0] - spans[-1]["bbox"][2] < 4):
                continue  # a span starts at its first mark: its font is that mark's ("Arial-Bold" for a label)
            if spans and bbox[0] - spans[-1]["bbox"][2] < 4:
                spans[-1]["text"] += c
                spans[-1]["bbox"][2] = max(spans[-1]["bbox"][2], bbox[2])
            else:
                spans.append({"text": c, "bbox": list(bbox), "font": font})
        spans = [sp for sp in spans if sp["text"].strip()]
        if spans:
            out.append((y, spans))
    return out


def read_label(row, gap=40):
    """The label a row opens with, "2 (b) (ii)" in one span or several: ((q, letter, roman), x0) or None.
    The longest run of label-like tokens that reads as a label wins: a scheme row can go on "1 (a) 2"."""
    toks, x1 = [], row[0]["bbox"][0]
    for s in row:
        if s["bbox"][0] - x1 > gap:
            break
        words = s["text"].split()
        n = next((k for k, tok in enumerate(words) if not TOKEN.match(tok)), len(words))
        toks += words[:n]
        if n < len(words):
            break
        x1 = s["bbox"][2]
    for k in range(len(toks), 0, -1):
        m = LABEL.match("".join(toks[:k]))
        if m:
            return (int(m.group(1)), m.group(2), m.group(3)), row[0]["bbox"][0]
    return None


def follows(prev, key):
    """`key` can come next after `prev` in a paper: later, and in the same question or the next."""
    return key > prev and key[0] in (prev[0], prev[0] + 1) and (key[0] == prev[0] or key[1:] in ((0, 0), (1, 0), (1, 1)))


def qp_labels(doc):
    """[(page, y, (q, letter, roman))] in reading order, and the page the questions end on."""
    out, prev = [], (0, 0, 0)
    for i, page in enumerate(doc):
        if i == 0 or cut.NOT_QUESTIONS.search(page.get_text()):
            continue
        f = cut.frame(page)
        for y, row in rows_of(page, 140):
            if not (f.y0 - 4 < y < f.y1) or row[0]["bbox"][0] > 70 or "Bold" not in row[0]["font"]:
                continue
            got = read_label(row)
            if not got:
                continue
            q, letter, roman = got[0]
            key = key_of(q, letter, roman)
            if follows(prev, key):
                out.append((i, y, (q, letter, roman)))
                prev = key
        if "END OF QUESTIONS" in page.get_text():
            return out, i
    return out, len(doc) - 1


def qp_frame(page):
    """cut.frame, inside the box these papers draw round the page's content (x 34 or 40 to 532), whose
    left edge cut.frame's x 44 would clip a two-digit question number at (x 45)."""
    f = cut.frame(page)
    box = [d["rect"] for d in page.get_drawings() if d["rect"].x0 < 42 and d["rect"].height > 150 and d["rect"].width > 400]
    if box:
        f.x0 = max(r.x0 for r in box) + 1.5
        f.x1 = min(f.x1, min(r.x1 for r in box) - 1.5)
    # The 2015-16 papers print "[2 marks]" out past the box's edge: take the crop out to it.
    over = [sp["bbox"][2] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for sp in l["spans"]
            if MARKS.fullmatch(sp["text"].strip()) and sp["bbox"][2] > f.x1]
    if over:
        f.x1 = min(max(over) + 3, page.rect.width - 30)
    end = [y for y, x, t in cut.text_lines(page, page.rect) if re.match(r"END\s+OF\s+QUESTIONS", t)]
    if end:
        f.y1 = min(f.y1, end[0] - 4)  # printed spaced out, "END  OF  QUESTIONS", which cut.frame misses
    return f


def label_top(page, y):
    """Where a part starts: 5pt above its label, or just below a line of the part above that reaches
    that far down (its "(1 mark)" sat close enough to show at the top of this crop and count here);
    or higher, for a power on the label's own line, which starts above the label and runs past it ("mol dm⁻³" lost its top)."""
    lines = [l["bbox"] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if "".join(sp["text"] for sp in l["spans"]).strip()]
    top = min([y - 5] + [b[1] - 1 for b in lines if b[1] < y - 2 and b[3] > y + 2 and y - b[1] < 32 and b[2] < 540])
    reach = [b[3] for b in lines if b[1] < y - 2 and top < b[3] <= y + 2]
    return min(max(reach) + 0.5, y - 1) if reach else top


def pieces_between(doc, start, end, last_page):
    """The crops from (page, y) `start` to `end` (exclusive), page by page inside each page's frame."""
    (pg, y), out = start, []
    while pg <= last_page:
        page = doc[pg]
        if not cut.NOT_QUESTIONS.search(page.get_text()):
            f = qp_frame(page)
            top = label_top(page, y) if pg == start[0] else f.y0
            bottom = label_top(page, end[1]) if end and end[0] == pg else f.y1
            if bottom > top + 8:
                out.append((pg, pymupdf.Rect(f.x0, top, f.x1, bottom)))
        if end and end[0] == pg:
            break
        pg += 1
        if end and pg > end[0]:
            break
    return out


def drop_extra_space(doc, pieces):
    """Stop at the "(Extra space)" line: what follows is only room to write."""
    out = []
    for pg, r in pieces:
        lines = cut.text_lines(doc[pg], r)
        extra = next((y for y, x, t in lines if EXTRA.match(t)), None)
        if extra is not None:
            if extra - 1 > r.y0 + 8:
                out.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, extra - 1)))
            return out
        out.append((pg, r))
    return out


def has_words(doc, pg, r):
    return re.search(r"[A-Za-z]{3,}", re.sub(r"Extra space|Do not write|outside the|box|Areas outside|will not be scanned|for marking|Answer",
                                              "", doc[pg].get_text("text", clip=r)))


# ---------- mark schemes ----------

def ms_labels(doc, wanted):
    """Each label's row in the scheme's table: {(q, letter, roman): (page, y)}, first one found.
    A bare number counts only in the labels' column, and only labels the paper has, in order."""
    found, prev, col = [], (0, 0, 0), None
    for i, page in enumerate(doc):
        if i == 0:
            continue  # the cover
        for y, row in rows_of(page, 200):
            if y < 40 or y > page.rect.height - 40:
                continue
            got = read_label(row, gap=75)
            if not got:
                continue
            (q, letter, roman), x = got
            if (q, letter, roman) not in wanted and (q, None, None) not in wanted:
                continue
            if letter is None and col is not None and abs(x - col) > 14:
                continue  # a number in the answer column
            key = key_of(q, letter, roman)
            if key <= prev:
                continue
            if letter and col is None:
                col = x
            found.append((i, y, (q, letter, roman)))
            prev = key
    return found


def row_top(page, y):
    """A scheme row starts at the table rule just above its label (rows are boxed); else a little above."""
    rules = sorted({round(d["rect"].y0) for d in page.get_drawings() if d["rect"].height < 3 and d["rect"].width > 60})
    above = [r for r in rules if y - 30 <= r <= y + 2]
    return (above[-1] - 1) if above else y - 6


def ms_regions(doc, wanted):
    labels = ms_labels(doc, wanted)
    out = {}
    for n, (pg, y, lab) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        pieces, p = [], pg
        while p < len(doc):
            page = doc[p]
            f = cut.ms_frame(page)
            top = row_top(page, y) if p == pg else f.y0
            end = row_top(page, nxt[1]) if nxt and nxt[0] == p else f.y1
            # A table header below the row starts the next table, whose rows are on the next page;
            # the last row can be followed by AQA's note on converting marks.
            heads = [y for y, x, t in cut.text_lines(page, pymupdf.Rect(f.x0, top + 10, f.x1, end)) if re.match(r"^Question\b", t) and len(t) < 40 or re.match(r"UMS conversion|Converting marks|Grade boundar", t)]
            if heads:
                end = min(end, row_top(page, heads[0]))
            if end > top + 8 and page.get_text("text", clip=pymupdf.Rect(f.x0, top, f.x1, end)).strip():
                pieces.append((p, pymupdf.Rect(f.x0, top, f.x1, end)))
            if (nxt and nxt[0] == p) or not nxt:
                break
            p += 1
        if not nxt and pieces:
            pieces = pieces[:1]  # the last row: its own page only, not the grade boundaries after it
        out.setdefault(lab, pieces)
    return out


def open_upright(path):
    doc = pymupdf.open(path)
    for page in doc:
        if page.rotation:
            page.remove_rotation()
    return doc


# ---------- a set ----------

def label_text(q, letter, roman):
    return f"{q}" + (f"({letter})" if letter else "") + (f"({roman})" if roman else "")


def part_id(set_id, q, letter, roman):
    return f"{set_id}-{q:02d}" + (f"-{letter or ''}{roman or ''}" if letter or roman else "")


def cut_set(qp_path, ms_path, set_id, meta):
    qp = pymupdf.open(qp_path)
    labels, last_page = qp_labels(qp)
    keys = [lab for _, _, lab in labels]
    # A label with children ("2", "2(a)" before "2(a)(i)") is an intro, not a part of its own.
    def parent(lab):
        q, letter, roman = lab
        return (q, letter, None) if roman else (q, None, None) if letter else None
    has_child = {parent(k) for k in keys if parent(k) in keys}
    regions = {}
    for n, (pg, y, lab) in enumerate(labels):
        nxt = (labels[n + 1][0], labels[n + 1][1]) if n + 1 < len(labels) else None
        regions[lab] = pieces_between(qp, (pg, y), nxt, last_page)
    ms = open_upright(ms_path) if ms_path and os.path.exists(ms_path) else None
    ms_map = ms_regions(ms, set(keys)) if ms else {}
    parts, intro_used = [], set()
    for lab in keys:
        if lab in has_child:
            continue
        q, letter, roman = lab
        pieces = drop_extra_space(qp, regions[lab])
        pieces = [pieces[0]] + [(pg, r) for pg, r in pieces[1:] if has_words(qp, pg, r)] if pieces else []
        # A part's opening words go above its first sub-part.
        intro = parent(lab) if roman else None
        lead = []
        if intro in has_child and intro not in intro_used and intro[1]:
            intro_used.add(intro)
            lead = [pc for pc in regions[intro] if has_words(qp, *pc)]
        text = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in lead + regions[lab])
        qimg = cut.stack([cut.trim_bottom(cut.render(qp[pg], r)) for pg, r in lead + pieces])
        pid = part_id(set_id, q, letter, roman)
        stem_name = None
        if letter and (q, None, None) in has_child:
            stem_name = f"{set_id}-{q:02d}-stem.webp"
            if not os.path.exists(os.path.join(cut.IMG, stem_name)):
                cut.save(cut.stack([cut.trim_bottom(cut.render(qp[pg], r), 16) for pg, r in regions[(q, None, None)] if has_words(qp, pg, r)]), stem_name)
        msimg, ms_text, msq = None, "", False
        for k in (lab, (q, letter, None), (q, None, None)):
            if k in ms_map and ms_map[k]:
                msimg = cut.stack([cut.trim_bottom(cut.render(ms[pg], r), 12) for pg, r in ms_map[k]])
                ms_text = "\n".join(ms[pg].get_text("text", clip=r) for pg, r in ms_map[k])
                msq = k != lab
                break
        stem_text = "\n".join(qp[pg].get_text("text", clip=r) for pg, r in regions.get((q, None, None), [])) if stem_name else ""
        m = MARKS.findall(qp_text := "\n".join(qp[pg].get_text("text", clip=r) for pg, r in regions[lab]))
        parts.append({
            "id": pid, "set": set_id, **meta, "question": f"{q:02d}", "part": (letter or "") + (roman or "") or None,
            "label": label_text(q, letter, roman), "marks": sum(int(x) for x in m) if m else None,
            "qp": cut.save(qimg, f"{pid}-qp.webp"), "ms": cut.save(msimg, f"{pid}-ms.webp"), "stem": stem_name,
            **({"msq": 1} if msimg is not None and msq else {}),
            "w": qimg.width if qimg else 0, "h": qimg.height if qimg else 0,
            "text": re.sub(r"\s+", " ", stem_text + " " + text).strip()[:1500],
            "own": re.sub(r"\s+", " ", qp_text).strip()[:600],
            "msText": re.sub(r"\s+", " ", ms_text).strip()[:800],
        })
    return parts


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        return set_id, cut_set(pdf("qp"), pdf("ms"), set_id, meta), None
    except Exception as e:  # noqa: BLE001
        import traceback
        return set_id, [], traceback.format_exc()


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": "2420", "series": series, "paperTitle": files["qp"].get("title", "")})
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
            whole = sum(1 for p in parts if p.get("msq"))
            print(f"{set_id}: {len(parts)} parts, {sum(p['marks'] or 0 for p in parts)} marks, {no_ms} without scheme, {whole} on a whole question's rows", file=sys.stderr, flush=True)
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
