"""Check the cut IAL Maths questions before they go up.

    python3 scripts/question-bank/edexcel_ial_maths/check_ial_maths.py [--only=wdm11-jan23]
    # reads scripts/question-bank/.work/edexcel-ial-maths/{manifest,parts}.json and the PDFs

For every paper, each of the failures students have reported on other banks:
  - a question's crop edge (or a scheme crop's) runs through a line of text, a diagram or a picture, cutting it
    in two (Decision 1's networks, drawn beside a label set halfway down its row, lost their tops);
  - Question 1 starts on the cover or takes in the front matter (it must open on its own "1.");
  - a scheme crop stops short: its rows must run on to the next question's label, or to the scheme's end;
  - a crop runs on into the next question, or a scheme crop opens past its question's first part;
  - a question without a scheme crop, a paper whose marks don't make 75, a scheme whose question count isn't its
    paper's, or a scheme crop whose printed total ("(9 marks)") isn't its question's marks.
Prints each failure and a count.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
argv, sys.argv = sys.argv, sys.argv[:1]
import cut_ial_maths as c  # noqa: E402

sys.argv = argv
pymupdf, cut_pearson, cut_edexcel = c.pymupdf, c.cut_pearson, c.cut_edexcel
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)


def rules(page):
    """The table's thin rules, as displayed: (vertical x ranges, horizontal y ranges)."""
    v, h = [], []
    for d in cut_pearson.drawings(page):
        r = d["rect"] * page.rotation_matrix
        if r.width < 3 and r.height > 6:
            v.append((r.x0 - 1.5, r.x1 + 1.5))
        if r.height < 3 and r.width > 6:
            h.append((r.y0 - 1.5, r.y1 + 1.5))
    return v, h


def cut_through(page, r, what):
    """Where ink runs across a crop edge: dark just outside and just inside it in the same column, a table's
    thin rules aside. (A line's text box says little: a maths font's brackets and symbols have boxes far
    taller than their ink.)"""
    out, (v, h) = [], rules(page)
    for y, edge in ((r.y0, "top"), (r.y1, "foot")):
        if any(a <= y <= b for a, b in h):
            continue  # the edge is a rule
        scale = 4
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=pymupdf.Rect(r.x0, y - 1, r.x1, y + 1), colorspace=pymupdf.csGRAY)
        if pix.height < 8:
            continue
        row = lambda k: pix.samples[k * pix.stride:k * pix.stride + pix.width]  # noqa: E731
        above, below = row(1), row(pix.height - 2)
        crossed = [k for k in range(pix.width) if above[k] < 140 and below[k] < 140
                   and not any(a <= r.x0 + k / scale <= b for a, b in v)]
        if len(crossed) > 2:
            out.append(f"{what} crop's {edge} (page {page.number + 1}, y {y:.0f}) runs through ink at x {r.x0 + crossed[0] / scale:.0f}")
    return out


def labels_in(doc, pieces, col, most):
    """The question labels printed in a scheme crop's Question column, in order: (number, what follows it)."""
    out = []
    for pg, r in pieces:
        lines = doc.lines(pg)
        for l in sorted(lines, key=lambda l: l["y0"]):
            m = c.QUESTION.match(l["text"])
            if not m or not (r.y0 - 1 <= l["y0"] and l["y1"] <= r.y1 + 1) or l["x0"] - col > 20:
                continue
            rest = l["text"][m.end():].strip()
            if re.match(r"(?!cont)[A-Za-z]{3,}", rest) or not 1 <= int(m.group(1)) <= most \
                    or any(o is not l and abs(o["y0"] - l["y0"]) < 3 and o["x1"] <= l["x0"] + 1 for o in lines):
                continue
            out.append((int(m.group(1)), rest, pg, l["y0"], l))
    return out


def check(job):
    set_id, mine, files = job
    problems = []
    if sum(p["marks"] or 0 for p in mine) != 75:
        problems.append(f"{set_id}: marks add up to {sum(p['marks'] or 0 for p in mine)}")
    qp = c.QuestionBook(cut_edexcel.open_upright(files["qp"]))
    legacy = any("Leave" in qp[i].get_text() and "blank" in qp[i].get_text() for i in range(1, min(4, len(qp))))
    regions = c.qp_regions(qp, legacy)
    for n, (q, pieces, _) in enumerate(regions):
        # (no later question's bold "5." inside a question's crop)
        for pg, r in pieces:
            for s in cut_edexcel.spans(qp[pg]):
                m = cut_edexcel.QP_LABEL.match(s["text"].strip())
                if m and "Bold" in s["font"] and s["bbox"][0] < 75 and s["size"] >= 10.5 and int(m.group(1)) > int(q) \
                        and r.y0 + 2 < s["bbox"][1] < r.y1:
                    problems.append(f"{set_id}-{q}: question crop holds question {int(m.group(1))}'s label (page {pg + 1})")
        if n == 0 and (not pieces or pieces[0][0] == 0 or not re.match(r"1\b", qp[pieces[0][0]].get_text("text", clip=pieces[0][1]).strip())):
            problems.append(f"{set_id}-{q}: Question 1 doesn't open on its own label")
        for pg, r in pieces:
            problems += [f"{set_id}-{q}: {x}" for x in cut_through(qp[pg], r, "question")]
    ms_doc = cut_pearson.Doc(files["ms"])
    sl = c.SchemeLines(ms_doc, [q for q, _, _ in regions])
    if len(sl.starts) != len(regions):
        problems.append(f"{set_id}: scheme labels {len(sl.starts)} for {len(regions)} questions")
    # (where the reader sees each label: lifted to its row's top)
    starts = sorted((i, l["y0"]) for i in range(len(ms_doc)) for l in sl.lines(i) if l["spans"][0].get("font") == "Label-Bold")
    # (the column where its printed labels, "3.", "3(a)", sit; a bare "3" may be anything)
    xs = sorted(l["x0"] for i in range(len(ms_doc)) for l in ms_doc.lines(i) if c.QUESTION.match(l["text"]) and l["x0"] < 140
                and (c.OPENING.match(l["text"][c.QUESTION.match(l["text"]).end():].strip()) or c.QUESTION.match(l["text"]).group(0).endswith(".")))
    col = xs[len(xs) // 2] if xs else 60
    def headed(pg, l):
        """A bare number set straight under a table's heading (within 40pt): a question's start, not a number of the working."""
        raw = ms_doc.lines(pg)
        return abs(l["x0"] - col) < 40 and any(0 < l["y0"] - h["y0"] < 40 for h in raw if c.SchemeLines.is_head(h, raw))

    for n, p in enumerate(mine):
        if not p.get("ms"):
            problems.append(f"{p['id']}: no scheme crop")
            continue
        pieces = [(pg, pymupdf.Rect(*r)) for pg, r in p["msPieces"]]
        # (opens on its own question's first part, and holds no later question's opening label: Further Pure 1, June
        # 2025, Question 1's crop ran on through Question 2 (a) to (d), whose own crop opened at 2(e))
        found = labels_in(ms_doc, pieces, col, len(mine))
        q = int(p["question"])
        found = [f for f in found if f[1] or headed(f[2], f[4])]  # (a bare number heads a table, or is working)
        if found and (found[0][0] != q or found[0][1] and not c.OPENING.match(found[0][1])):
            problems.append(f"{p['id']}: scheme crop opens at '{found[0][0]}{found[0][1][:8]}', not question {q}'s start")
        later = next((f for f in found if f[0] == q + 1 and (c.OPENING.match(f[1]) if f[1] else headed(f[2], f[4]))), None)
        if later:
            problems.append(f"{p['id']}: scheme crop holds question {q + 1}'s opening (page {later[2] + 1}, y {later[3]:.0f})")
        for pg, r in pieces:
            problems += [f"{p['id']}: {x}" for x in cut_through(ms_doc[pg], r, "scheme")]
        # (opens on its own label: nothing in its first piece above the label's table heading, or, with no heading
        # over it on the page, above the label's own line; a note set under the heading is the question's own)
        lab = next(((i, l) for i in range(len(ms_doc)) for l in sl.lines(i) if l["spans"][0].get("font") == "Label-Bold"
                    and l["text"] == str(int(p["question"]))), None)
        if lab and lab[0] == pieces[0][0]:
            r0, raw = pieces[0][1], ms_doc.lines(lab[0])
            heads = [h["y0"] for h in raw if c.SchemeLines.is_head(h, raw) and h["y0"] < lab[1]["y0"] + 2]
            limit = max(heads) - 1 if heads else lab[1]["y0"] - 1
            over = " ".join(l["text"] for l in raw if l["y0"] >= r0.y0 - 1 and l["y1"] < limit and r0.x0 <= l["x0"] <= r0.x1)
            over = re.sub(r"(?i)Question|Number|Scheme|Marks?|Notes|Solution|Guidance|^Q|\s", "", over)
            if len(over) > 12:
                problems.append(f"{p['id']}: scheme crop starts above its question: '{over[:40]}'")
        # (the scheme's own total, "(9 marks)" or "Total 10", where it prints one, is the question's: a crop of another
        # question's rows, or one cut short, says otherwise or nothing)
        words = " ".join(ms_doc.text(pg, r) for pg, r in pieces)
        # ("Total 10" as a heading prints it; not a special case's "Total 7/9" or "total 72" in a note's prose)
        totals = [int(a or b) for a, b in re.findall(r"\((\d{1,2}) marks?\)|Total\s*(?:for [Qq]uestion\s*\d+\s*(?:is|=)?\s*)?(\d{1,2})\b(?![\s)]*[\d/)])", words)]
        if totals and p["marks"] not in totals:
            problems.append(f"{p['id']}: scheme crop's totals {totals} aren't the question's {p['marks']} marks")
        if any(c.COMPANY.search(ms_doc.text(pg, r)) for pg, r in pieces):
            problems.append(f"{p['id']}: scheme crop takes in Pearson's company notice")
        # (runs on to where the next question's rows start: on its page, or over pages with nothing but the
        # running header and the table's heading between)
        if n + 1 < len(mine) and mine[n + 1].get("msPieces"):
            npg, nr = mine[n + 1]["msPieces"][0][0], pymupdf.Rect(*mine[n + 1]["msPieces"][0][1])
            last_pg, last = pieces[-1]
            gap = [i for i in range(last_pg + 1, npg) if not c.FOOTER.fullmatch(ms_doc.text(i).strip() or "0")]  # (a blank page's number)
            between = ms_doc.text(last_pg, pymupdf.Rect(0, last.y1 + 2, 1000, nr.y0 - 2 if npg == last_pg else 1000)).strip() \
                + (ms_doc.text(npg, pymupdf.Rect(0, 60, 1000, nr.y0 - 2)).strip() if npg > last_pg else "")
            between = re.sub(r"Question|Number|Scheme|Marks|Notes|PMT|\d{1,3}|\s", "", between)
            if last_pg > npg or gap or len(between) > 8:
                problems.append(f"{p['id']}: scheme crop ends on page {last_pg + 1} at {last.y1:.0f}, next question's starts on page {npg + 1} at {nr.y0:.0f} ('{between[:30]}' between)")
    return set_id, problems


def main():
    parts = json.load(open(os.path.join(c.WORK, "parts.json")))
    manifest = json.load(open(os.path.join(c.WORK, "manifest.json")))
    files = {}
    for f in manifest:
        files.setdefault(f"{f['component']}-{f['series']}".lower(), {})[f["kind"]] = os.path.join(c.WORK, "pdf", f["file"])
    by_set = {}
    for p in parts:
        by_set.setdefault(p["set"], []).append(p)
    jobs = [(s, sorted(by_set[s], key=lambda p: p["question"]), files[s]) for s in sorted(by_set) if not ONLY or s.startswith(ONLY)]
    problems = []
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, found in pool.map(check, jobs):
            problems += found
            print(f"{set_id}: {len(found)}", file=sys.stderr, flush=True)
    for x in problems:
        print(x)
    print(f"{len(problems)} problems", file=sys.stderr)


if __name__ == "__main__":
    main()
