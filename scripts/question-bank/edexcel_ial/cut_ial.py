"""Cut Pearson Edexcel's International A Level science papers into question parts, each with its mark scheme rows.

    python3 scripts/question-bank/edexcel_ial/cut_ial.py [work-dir] [--only=wch1101-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-ial

Pearson sets its International A Level papers and schemes as it does its A-Levels, so this is
edexcel_sciences/cut_pearson.py run on this bank's papers, with edexcel_igcse/cut_igcse.py's one
patch and five of its own, here only so no other bank's crops move:
  - the end of a question paper ("END") is read in capitals, so a diagram's own "end" label no
    longer ends a part above it;
  - a scheme's levels grid set overleaf from its row ("Level 0 | 0 | No awardable content") has its
    "0" in the label column's span: no question is numbered 0, so it is no label, and the 6-mark
    row runs on through the grid (cut_pearson.py skips it for geography's --figures only);
  - not everything label-shaped in the label column starts a row (stray()): a digit in a small drawn
    box numbering a long answer's indicative content ("1" … "7" down *6(c) in WBI15 January 2025), a
    bare number whose question the scheme labels by part ("6" in WBI15 June 2023's indicative
    content, where Q6's rows are 6(a) and 6(b)), a label out of question order (WPH14 October 2023's
    "1" of a formula ended 15(a) mid-line; WPH15 January 2021's "40" of a nuclide, WPH16 June 2023's
    graph axis read as "10(g)" inside Q3, the examples in WBI11 June 2021's marking guidance), or a
    label met before but not just before (WPH16 January 2023's "e.c.f. 4(b)(i)" wrapped under
    4(b)(ii)). Each would end the row above it there;
  - some Physics schemes split their header "Questio / n / Number" (WPH14 October 2023, WPH15
    October 2020) or "Questio n / Number" (WPH11 October 2021): either is read as "Question", so
    the header heads its table, and a lone "n" is no part (n);
  - Cambria Math, which Physics and Chemistry set their equations in, reports an ascender of 3.1em,
    so a line with an equation in it reads as 60pt tall: a row's top rule then seems to run through
    text and is passed over, and the scheme crop starts at the label, through the row's first line
    (WPH14 June 2022 Q6). Such a span's height is taken from its size instead;
  - where a part opens with a built-up fraction ("(iii) Plot a graph of I against 1/d²"), cut_pearson.py
    starts it 9pt above the fraction's top, through the marks of the part above ("(2)", WPH13
    January 2024 4(b)): the boundary moves down to the foot of any line it would cut that ends
    above the label.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-ial")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

cp.STOP = re.compile(cp.STOP.pattern.replace(r"|END\s*$", r"|(?-i:END)\s*$"), cp.STOP.flags)
cp.MS_LABEL = re.compile(cp.MS_LABEL.pattern.replace(r"^\*?\s*(\d{1,2})?", r"^\*?\s*(?!0(?!\d))(\d{1,2})?", 1))
assert "(?!0(?!" in cp.MS_LABEL.pattern
_carried = cp.carried


def boxed(f, doc):
    """A whole-question label ("3") whose number sits alone in a small stroked box (about 36 by 30pt)."""
    pg, _, (q, letter, roman), y = f
    if letter or roman:
        return False
    page = doc[pg]
    nums = [l for l in doc.lines(pg) if abs(l["y0"] - y) < 1 and re.fullmatch(rf"\*?{q}\*?", l["text"].strip())]
    boxes = [d["rect"] * page.rotation_matrix for d in cp.drawings(page) if "s" in (d.get("type") or "")]
    return any(b.width < 60 and b.height < 45 and b.x0 - 1 <= l["x0"] and l["x1"] <= b.x1 + 1 and b.y0 - 1 <= l["y0"] and l["y1"] <= b.y1 + 1
               for l in nums for b in boxes)


def stray(found, doc):
    """The labels no row starts at: boxed digits, bare numbers whose question has parts, labels out of
    order, and then a label seen before but not just before (a row carried over a page repeats its
    label straight after). A scheme runs in question and part order (sub-parts can swap: "4(b)(ii)"
    above "4(b)(i)"), so it keeps the longest run that never goes backwards, which leaves out a stray
    number wherever it falls, early or late (or the examples in WBI11 June 2021's marking guidance).
    A label with only a numeral, "8(i)", can be part (i) after (h) or sub-part (i): it is left out of
    the ordering, as cut_pearson.py has it."""
    rank = lambda k: (k[0], cp.LETTERS.index(k[1]) + 1 if k[1] else 0)  # noqa: E731
    parted = {k[0] for _, _, k, _ in found if k[0] is not None and (k[1] or k[2])}
    free = lambda f: f[2][0] is None or not f[2][1] and f[2][2]  # noqa: E731
    live = [f for f in found if not (free(f) or boxed(f, doc) or not f[2][1] and f[2][0] in parted)]
    best, prev = [1] * len(live), [-1] * len(live)
    for j in range(len(live)):
        for i in range(j):
            if rank(live[i][2]) <= rank(live[j][2]) and best[i] + 1 > best[j]:
                best[j], prev[j] = best[i] + 1, i
    run, j = [], max(range(len(live)), key=lambda j: best[j]) if live else -1
    while j >= 0:
        run.insert(0, live[j])
        j = prev[j]
    keep, seen = set(), []
    for f in run:
        if f[2] not in seen[:-1]:
            keep.add(id(f))
            seen.append(f[2])
    return [f for f in found if (free(f) and not boxed(f, doc)) or id(f) in keep]


cp.carried = lambda found, doc: _carried(stray(found, doc), doc)
_lines_of = cp.lines_of


def lines_of(page, clip=None, visible=False):
    out = _lines_of(page, clip, visible)
    split = [l for l in out if re.fullmatch(r"Questio(?: n)?", l["text"])]
    for l in split:
        l["text"] = "Question"
    out = [l for l in out if not (l["text"] == "n" and any(0 < l["y0"] - h["y0"] < 18 and h["x0"] <= l["x0"] <= h["x1"] for h in split))]
    if page.rotation:
        return out
    for l in out:
        if l["y1"] - l["y0"] > 2.2 * max(sp["size"] for sp in l["spans"]):
            ys = [(sp["origin"][1] - sp["size"] * 0.95, sp["origin"][1] + sp["size"] * 0.3) if sp.get("ascender", 1) > 1.5
                  else (sp["bbox"][1], sp["bbox"][3]) for sp in l["spans"] if "origin" in sp]
            if ys:
                l["y0"], l["y1"] = min(y[0] for y in ys), max(y[1] for y in ys)
    out.sort(key=lambda l: (round(l["y0"]), l["x0"]))
    return out


cp.lines_of = lines_of
_label_top = cp.label_top


def label_top(doc, pg, y):
    top = _label_top(doc, pg, y)
    f = doc.frame(pg)
    for l in doc.lines(pg):
        if l["y0"] < top < l["y1"] and l["y1"] <= y + 2 and l["y1"] - l["y0"] < 30 and l["x1"] > f.x0 and l["x0"] < f.x1:
            top = l["y1"] - 1
    return top


cp.label_top = label_top

if __name__ == "__main__":
    cp.main()
