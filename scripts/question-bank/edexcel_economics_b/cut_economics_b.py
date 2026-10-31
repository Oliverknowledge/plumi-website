"""Cut Pearson Edexcel's Economics B papers: cut_pearson.py --extracts --stem-singles, and one repair.

    python3 scripts/question-bank/edexcel_economics_b/cut_economics_b.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-economics-b

Economics B's mark scheme tables put the question's own words in their header row
("Question Number | Discuss the use of venture capital… Indicative content | Mark").
When a table's header closes a page and its first row is overleaf, cut_pearson.py leaves
it to the next table only if the header is bare ("Question Number … Mark"); with the
question in it, the header stayed on the end of the question before, one scheme crop
showing the next question's heading. Here a page's closing header, with no row under it, is
cut off whatever it says. (Patched in over ms_tables, whose own check is left as it is.)
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work", "edexcel-economics-b"),
                *[a for a in sys.argv[2:]], "--extracts", "--stem-singles"]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import pymupdf  # noqa: E402
import cut_pearson as cp  # noqa: E402

_ms_tables = cp.ms_tables


def ms_tables(doc):
    out = _ms_tables(doc)
    for key, (pieces, text, ans) in list(out.items()):
        if not pieces:
            continue
        pg, r = pieces[-1]
        lines = [l for l in doc.lines(pg) if cp.inside(l, r)]
        # (a table's own header, on its first piece, stays: only a header further down, or on a later page's piece, is the next one's)
        head = next((l for l in lines if re.match(r"Questio", l["text"]) and l["x0"] < 200 and (len(pieces) > 1 or l["y0"] > r.y0 + 40)), None)
        # a closing header: the piece ends within it, no row of its own under it
        if head is not None and r.y1 - head["y0"] < 140:
            kept = pieces[:-1] + ([(pg, pymupdf.Rect(r.x0, r.y0, r.x1, head["y0"] - 4))] if head["y0"] - 4 > r.y0 + 10 else [])
            out[key] = (kept, text, ans)
    return out


cp.ms_tables = ms_tables

if __name__ == "__main__":
    cp.main()
