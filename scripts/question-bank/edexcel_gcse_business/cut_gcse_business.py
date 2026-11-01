"""Cut Pearson Edexcel's GCSE Business papers: cut_pearson.py --extracts, with readings of its own.

    python3 scripts/question-bank/edexcel_gcse_business/cut_gcse_business.py [work-dir] [--only=1bs001-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-business

Each paper has three sections. Section A's questions stand alone; Sections B and C are set on a case
study, one extract for Questions 4, 5 and 6 and another for Question 7. To June 2022 the extract is printed
in the paper ("Read the following extract before answering Questions 4, 5 and 6."); from June 2023 it is in
a Source Booklet bound in after the paper ("In the Source Booklet, look at Figure 2 and read Extract A, then
answer Questions 4, 5 and 6."), each block headed "SECTION B". cut_pearson.py gives an extract to the next
question only: here every question the line names carries it in its stem, so Questions 5 and 6 show the case
study too. Patched in here, cut_pearson.py is unchanged:
  - READ takes "In the Source Booklet, look at…", and the booklet's blocks are its "SECTION B" and "SECTION C";
  - a "(i)" in a table to complete is an answer cell, not a sub-part (1BS0 has none);
  - a part's premise printed above its label ("Table 1 contains information…", "…is considering two options:
    Option 1… Option 2…" over "(c) Justify which one…") starts the part, not the end of the part before;
  - a bare number in a scheme's label column is no question (a levels grid's "0 | No rewardable material");
  - each part is printed once, so no part is "printed again" (Economics' RELABEL).
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work", "edexcel-gcse-business"),
                *[a for a in sys.argv[1:] if a.startswith("--")], "--extracts"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import pymupdf  # noqa: E402
import cut_pearson as cp  # noqa: E402

cp.READ = re.compile(r"^(Read the following |In the Source Booklet, look at )", re.I)
cp.RELABEL = re.compile(r"(?!)")
NAMED = re.compile(r"answer(?:ing)?\s+Questions?\s+(\d{1,2}(?:\s*(?:,|and)\s*\d{1,2})*)", re.I)


def source_booklet(doc, end_page):
    """{"B": [(page, rect)], ...}: each "SECTION B" block of the Source Booklet after the questions, to the next
    block or the booklet's end, blank pages left out."""
    cover = next((i for i in range(end_page + 1, len(doc)) if "Source Booklet" in doc.text(i)), None)
    if cover is None:
        return {}
    found = [(i, l["y0"], re.match(r"SECTION ([A-C])\b", l["text"]).group(1))
             for i in range(cover + 1, len(doc)) for l in doc.lines(i) if re.match(r"SECTION [A-C]\b", l["text"])]
    out = {}
    for n, (pg, y, sec) in enumerate(found):
        stop = found[n + 1][:2] if n + 1 < len(found) else (len(doc), 0)
        pieces = []
        for i in range(pg, min(stop[0] + 1, len(doc))):
            f = doc.frame(i)
            top = y - 4 if i == pg else f.y0
            bottom = stop[1] - 4 if i == stop[0] else f.y1
            rect = pymupdf.Rect(f.x0, top, f.x1, bottom)
            if bottom > top + 10 and not doc.blank(i) and cp.has_content(doc, i, rect):
                pieces.append((i, rect))
        out[sec] = pieces
    return out


cp.source_booklet = source_booklet

# ---------- a part's premise, printed above its label ----------

_qp_labels = cp.qp_labels


def closes(l):
    """A line that ends what comes before a part's premise: the part before's marks, answer lines or options,
    a section's heading, the extract's reading line."""
    t, first = l["text"].strip(), l["spans"][0]["text"].strip()
    return bool(re.fullmatch(r"\(\d{1,2}\)", t) or re.search(r"\.{6,}|…", t) or re.fullmatch(r"[A-E]", first)
                or re.match(r"Select (one|two) answers?|SECTION [A-C]\b|Answer ALL questions|\(Total for Question|TOTAL FOR", t)
                or cp.READ.match(t))


def premise(doc, pg, below, labels):
    """The top of the words, tables and figures above `below` on page `pg`, back to the line that closes the
    part before (or the label above), or None if there is nothing there."""
    f = doc.frame(pg)
    floor = max([y for p, y, *_ in labels if p == pg and y < below - 2] + [f.y0 - 4])
    lines = [l for l in doc.lines(pg) if floor + 2 < l["y0"] < below - 2 and l["x0"] >= f.x0 - 2 and l["x1"] <= f.x1 + 2
             and not cp.BOILER.fullmatch(l["text"].strip()) and l["text"].strip() not in ("", str(pg + 1))]
    got, stop = [], floor
    for l in reversed(lines):
        # (a row closes with any piece of it: an option's "E" with its "Survey" set a point lower, beside it)
        if any(closes(o) for o in lines if abs(o["y0"] - l["y0"]) < 4):
            stop = l["y1"]
            break
        got.append(l)
    if not got or all(re.fullmatch(r"(Table|Figure) \d{1,2}|\(Source.*", l["text"].strip()) for l in got):
        return None  # (a table's caption under it, after its answer cells' dots, is the table's)
    top = min(l["y0"] for l in got)
    # a figure or a table's rules over the words (a chart, a photograph), above the first line of text
    page = doc[pg]
    shapes = [d["rect"] * page.rotation_matrix for d in cp.drawings(page)] + [pymupdf.Rect(i["bbox"]) for i in page.get_image_info()]
    over = [r.y0 for r in shapes if stop + 1 < r.y0 < top and r.y1 < below and f.x0 - 2 <= r.x0 and r.x1 <= f.x1 + 2 and r.height > 2]
    return min([top] + over) - 2


def qp_labels(doc):
    labels, end_page = _qp_labels(doc)
    # 1BS0 has no sub-parts: a "(i)" is an answer cell in a table to complete ("Closing balance | (i) ......").
    labels = [l for l in labels if not l[4]]
    out = []
    for n, (pg, y, q, letter, roman) in enumerate(labels):
        # "(a)" opens its question: what is above it (Question 5's "Table 2 shows…") is the question's stem, for every part
        if letter and letter != "a" and not roman:
            top = premise(doc, pg, y, labels)
            f = doc.frame(pg)
            if top is None and pg > 1 and not [l for l in doc.lines(pg) if f.y0 - 4 <= l["y0"] < y - 2 and l["x0"] >= f.x0 - 2
                                               and not cp.BOILER.search(l["text"]) and l["text"].strip() != str(pg + 1)]:
                prev = premise(doc, pg - 1, doc.frame(pg - 1).y1 + 2, labels)  # over a page break, at the foot of the page before
                if prev is not None:
                    print(f"  {q}({letter}): starts at the foot of page {pg}", file=sys.stderr)
                    out.append((pg - 1, prev, q, letter, roman))
                    continue
            if top is not None:
                out.append((pg, top, q, letter, roman))
                continue
        out.append((pg, y, q, letter, roman))
    return out, end_page


cp.qp_labels = qp_labels

# ---------- the case study, for every question it is set on ----------

_cut_set = cp.cut_set


def case_studies(qp, labels, end_page):
    """{q: [(page, rect)]}: the extract each question is set on, for every question its reading line names."""
    starts = [(pg, y, q) for pg, y, q, letter, _ in labels if letter is None]
    booklet = source_booklet(qp, end_page)
    out, section = {}, None
    for i in range(1, end_page + 1):
        lines = qp.lines(i)
        for k, l in enumerate(lines):
            m = re.match(r"SECTION ([A-C])\b", l["text"])
            section = m.group(1) if m else section
            if not cp.READ.match(l["text"]):
                continue
            nxt = next(((pg, y, q) for pg, y, q in starts if (pg, y) > (i, l["y0"])), None)
            if not nxt:
                continue
            pieces = [p for p in cp.region(qp, (i, l["y0"]), (nxt[0], nxt[1]), end_page) if cp.has_content(qp, *p)]
            said = " ".join(x["text"] for x in lines[k:k + 2])
            if "Source Booklet" in said and section in booklet:
                pieces = booklet[section]  # it opens with the same reading line ("Look at Figure 2 and read Extract A…")
            named = NAMED.search(said)
            qs = [int(n) for n in re.findall(r"\d{1,2}", named.group(1))] if named else [nxt[2]]
            for q in qs:
                out[q] = pieces
    return out


# Printed wrong and put right on the day by a clarification notice bound in front of the paper: the crop would show
# the wrong words ("earliest" for "latest") against a scheme marked for the right ones, so the part is left out.
MISPRINTED = {"1bs002-jun25-01-b": 1}  # {part: its marks}


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = [p for p in _cut_set(qp_path, ms_path, er_path, set_id, meta) if p["id"] not in MISPRINTED]
    qp = cp.Doc(qp_path)
    labels, end_page = cp.qp_labels(qp)
    cases = case_studies(qp, labels, end_page)
    starts = {q: n for n, (pg, y, q, letter, _) in enumerate(labels) if letter is None}
    done = set()
    for p in parts:
        q = int(p["question"])
        if q not in cases or p["stem"] and q in done:
            continue
        n = starts[q]
        own = [r for r in cp.region(qp, labels[n][:2], labels[n + 1][:2] if n + 1 < len(labels) else None, end_page)
               if cp.has_content(qp, *r)] if n + 1 < len(labels) and labels[n + 1][2] == q else []
        name = f"{set_id}-{q:02d}-stem.webp"
        if q not in done:
            cp.save(cp.stack([cp.trim(qp.crop(pg, r), 14) for pg, r in cases[q] + own]), name)
            done.add(q)
        if not p["stem"]:
            p["stem"] = name
        case_text = " ".join(qp.text(pg, r) for pg, r in cases[q])
        if case_text[:200] not in p["text"]:
            p["text"] = re.sub(r"\s+", " ", cp.BOILER.sub(" ", p["text"] + " " + case_text)).strip()[:3000]
    # A table to complete is printed under the part's marks, where --extracts ends a part: such a part runs on to the next label.
    for p in parts:
        if not re.search(r"\(\w\)\s+Complete the (table|diagram|chart)", p["text"]):
            continue
        n = next(k for k, l in enumerate(labels) if (l[2], l[3] or "") == (int(p["question"]), p["part"] or ""))
        pieces = [r for r in cp.region(qp, labels[n][:2], labels[n + 1][:2] if n + 1 < len(labels) else None, end_page) if cp.has_content(qp, *r)]
        img = cp.stack([cp.trim(qp.crop(pg, r)) for pg, r in pieces])
        cp.save(img, p["qp"])
        p["w"], p["h"] = img.width, img.height
    missing = sorted({int(p["question"]) for p in parts if int(p["question"]) >= 4 and int(p["question"]) not in cases})
    if missing:
        print(f"  {set_id}: no case study found for Questions {missing}", file=sys.stderr)
    return parts


cp.cut_set = cut_set

# ---------- mark schemes ----------

_ms_tables = cp.ms_tables


def ms_tables(doc):
    """A scheme's labels, its bare numbers left out: every row is labelled with its question and part on one
    line ("4(b)"), so a number alone is a levels grid's "0", a mark wrapped from the line above, or a page's number."""
    lines = doc.lines
    doc.lines = lambda i: [l for l in lines(i) if not re.fullmatch(r"\d{1,2}", l["text"].strip())]
    try:
        out = _ms_tables(doc)
    finally:
        del doc.lines
    # The next section's heading ("Section B") sits between the tables, under a section's last row: not that row's.
    for key, (pieces, text, ans) in out.items():
        cut = []
        for pg, r in pieces:
            head = [l["y0"] for l in doc.lines(pg) if cp.inside(l, r) and l["y0"] > r.y0 + 20 and re.fullmatch(r"Section [B-C]", l["text"].strip())]
            cut.append((pg, pymupdf.Rect(r.x0, r.y0, r.x1, min(head) - 4) if head else r))
        out[key] = (cut, text, ans)
    # A table to complete is one part, "(c) Complete the table", whose scheme can still give each cell a row ("2(c)(i)", "2(c)(ii)"):
    # the rows together are that part's scheme.
    for key in sorted((k for k in out if k[2]), key=lambda k: cp.ROMANS.index(k[2]) if k[2] in cp.ROMANS else 99):
        pieces, text, _ = out.pop(key)
        got = out.get(key[:2] + (None,), ([], "", None))
        out[key[:2] + (None,)] = (got[0] + pieces, (got[1] + " " + text).strip(), None)
    return out


cp.ms_tables = ms_tables

if __name__ == "__main__":
    cp.main()
