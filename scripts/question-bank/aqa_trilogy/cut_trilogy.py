"""Cut AQA's GCSE Combined Science: Trilogy papers: cut.py with three fixes of its own.

    python3 scripts/question-bank/aqa_trilogy/cut_trilogy.py [work-dir] [--only=8464c2h]   # default scripts/question-bank/.work-gcse-trilogy

cut.py as the other AQA banks run it, with three changes kept to this bank so no other
bank's crops move:
- A setup printed just above a part's label went with the part before. See move_setups.
- A question that runs over the page onto one with an "Extra space" box (and no new
  label) went unread: cut.py took that page for a blank one and stopped. A page whose
  text before "Extra space" carries a mark ("[6 marks]") is the question's own.
- A label whose point isn't bold ("0 3 . 1" with a plain "."; Chemistry 2H, November
  2021) went unread, as cut.py reads bold labels only on a question paper. A label with
  a part is distinctive enough to take whatever its point's font.
The patches sit at the top level, so the worker processes cut.py starts (which re-run
this file) get them too.
"""
import os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work-gcse-trilogy")]
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402

MARK = re.compile(r"\[\s*\d+\s+marks?\s*\]", re.I)
_left_labels = cut.left_labels


def skip_page(page, max_x, bold_only):
    text = page.get_text()
    if cut.NOT_QUESTIONS.search(text):
        return True
    if cut.EXTRA_SPACE.search(text) and not cut.left_labels(page, max_x, bold_only):
        return not MARK.search(cut.EXTRA_SPACE.split(text)[0])
    return False


def left_labels(page, max_x, bold_only, with_x=False):
    out = _left_labels(page, max_x, bold_only, with_x)
    if not bold_only:
        return out
    have = {(o[1], o[2]) for o in out}
    extra = [o for o in _left_labels(page, max_x, False, with_x) if o[2] and (o[1], o[2]) not in have]
    return sorted(out + extra, key=lambda o: o[0])


CONTINUES = re.compile(r"^Question \d+ continues on the next page", re.I)
DO_NOT_WRITE = re.compile(r"do\s+not\s+write\s+on\s+this\s+page", re.I)
# Words a part's own instructions open with, printed after its marks ("[3 marks] Use the equation:").
OWN = re.compile(r"(?:(?:Answer|Extra space|Show|Use|Give|Calculate|Complete|Choose|Draw|Plot|Tick|Write|Describe|Explain|Suggest|Determine|Name|Label|"
                 r"Circle|Select|Compare|Balance|Add|Include|Estimate|Sketch|Underline|Measure|Read|Do not|You|Your|Reason)\b|Figure \d+$|Table \d+$)")


def rules(page):
    """Thin drawn strips: (x0, y0, x1, y1) of the upright ones, a tick box's or table's sides, and the flat ones, a gap to fill's line."""
    upright, flat = [], []
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 2 and r.height >= 14:
            upright.append(tuple(r))
        elif r.height < 2 and r.width >= 20:
            flat.append(tuple(r))
    return upright, flat


def starts_setup(lines, i, margins, page, fills_gaps=False):
    """Whether line i opens a setup: a sentence or a lead-in at the text margin, not in a tick box's or table's row, nor one with a gap to fill.
    On a "complete the sentences" part (fills_gaps), a sentence with a gap still to come below it is one of those sentences, whole as it reads."""
    y, x, t = lines[i][2:]
    if all(abs(x - m) >= 12 for m in margins) or not t[:1].isupper() or (OWN.match(t) and "to answer question" not in t):
        return False
    if fills_gaps and (any(re.fullmatch(r"[.,]", l[4]) for l in lines[i + 1:] if l[0] == lines[i][0])
                       or any(b > y and a >= x - 4 for a, b, _, _ in rules(page)[1])):
        return False
    words = [t]
    for j in range(i + 1, len(lines)):
        if lines[j][0] != lines[i][0] or lines[j][2] - lines[j - 1][2] >= 17 or abs(lines[j][3] - x) >= 12:
            break
        words.append(lines[j][4])
    text = " ".join(words)
    if not re.search(r"[.:’']$", text) or len(text.split()) < 3 or re.search(r"_{3}|\.{3}", text):
        return False
    upright, flat = rules(page)
    bottom = lines[i][2] + 13 * len(words)
    return not (any(a >= x - 4 and a < 537 and b <= y + 7 <= d for a, b, _, d in upright)
                or any(y + 2 <= b <= bottom + 4 and a >= x - 4 for a, b, _, _ in flat))


def move_setups(doc, out):
    """A part ends at the next label, so a setup printed above that label stays on the part before ("Particle X consists of:" and its
    three bullets, on 03.1, when 03.2 needs them: a student reported it, as the PDF of 03.2 went without them, 4 November 2026).
    cut.py's rule takes a sentence of six words or more on a part with no tick boxes. This one also takes shorter ones ("Figure 2 shows the
    results.") and lead-ins, on tick-box parts too, and anything after "Question 3 continues on the next page", which is dropped."""
    _move_setups(doc, out)
    for n in range(len(out) - 1):
        key, pieces, _ = out[n]
        nkey, npieces, ntext = out[n + 1]
        if not pieces or key[1] is None or nkey[0] != key[0]:
            continue
        lines = [(k, pg, *line) for k, (pg, r) in enumerate(pieces) for line in cut.text_lines(doc[pg], r)]
        last = max((i for i, l in enumerate(lines) if MARK.search(l[4])), default=None)
        if last is None:
            continue
        # The text column: where most lines of words start, up to its marks or in all (the label's digits and a table's cells start elsewhere; a numbered method
        # can outnumber the part's sentences, and a diagram's labels can outnumber its question's).
        common = lambda ls: max(Counter(round(l[3]) for l in ls if len(l[4]) >= 15 and not MARK.search(l[4])).items(), key=lambda c: c[1], default=(None,))[0]
        margins = {m for m in (common(lines[:last + 1]), common(lines)) if m is not None}
        fills_gaps = re.search(r"\bsentences?\b", " ".join(l[4] for l in lines[:last + 2]), re.I)
        end, split = None, None
        for i in range(last + 1, len(lines)):
            k, pg, y, x, t = lines[i]
            if CONTINUES.match(t):
                end, split = i, i + 1 if i + 1 < len(lines) else None
                break
            if starts_setup(lines, i, margins, doc[pg], fills_gaps):
                end, split = i, i
                break
        if end is None:
            continue
        k, pg, y, _, _ = lines[end]
        rect = pieces[k][1]
        kept = pieces[:k] + ([(pg, cut.pymupdf.Rect(rect.x0, rect.y0, rect.x1, y - 6))] if y - 6 > rect.y0 + 8 else [])
        moved = []
        if split is not None:
            k2, pg2, y2, _, _ = lines[split]
            r2 = pieces[k2][1]
            moved = [(pg2, cut.pymupdf.Rect(r2.x0, y2 - 6, r2.x1, r2.y1))] + pieces[k2 + 1:]
            moved = [(p, r) for p, r in moved if not DO_NOT_WRITE.search(doc[p].get_text("text", clip=r))]
        if not kept:
            continue  # the whole part would move: it is its own setup
        moved_text = "\n".join(doc[p].get_text("text", clip=r) for p, r in moved)
        out[n] = [key, kept, "\n".join(doc[p].get_text("text", clip=r) for p, r in kept)]
        if moved and npieces and npieces[0][0] == moved[-1][0] and abs(npieces[0][1].y0 - moved[-1][1].y1) < 2:
            first = npieces[0][1]
            joined = moved[:-1] + [(moved[-1][0], cut.pymupdf.Rect(first.x0, moved[-1][1].y0, first.x1, first.y1))]
            out[n + 1] = [nkey, joined + npieces[1:], moved_text + "\n" + ntext]
        elif moved:
            out[n + 1] = [nkey, moved + npieces, moved_text + "\n" + ntext]


_move_setups = cut.move_setups
cut.skip_page = skip_page
cut.left_labels = left_labels
cut.move_setups = move_setups

if __name__ == "__main__":
    cut.main()
