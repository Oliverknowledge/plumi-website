"""Check the cut GCSE Psychology crops: no edge through a line of text, and no front matter in question 1.

    python3 scripts/question-bank/aqa_gcse_psychology/check_gcse_psychology.py [work-dir]

Reads each set's regions again, as cut_gcse_psychology.py cuts them (its patches on cut.py), and lists
  - a question or scheme piece whose top or bottom edge crosses a line of text on its page (a crop cut
    through the line above or below it), the page's running header and footer aside;
  - a question 1 that starts on the cover or takes in the paper's instructions ("Answer all questions",
    "Only one answer per question", the multiple-choice "CORRECT METHOD" panel, a section heading);
  - a question region that takes in a section heading, a multiple-choice one without options A-D,
    or one that starts with an option (moved off the question above it);
  - a part id read twice in one set.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-psychology")]
sys.path.insert(0, HERE)
import cut_gcse_psychology as g  # noqa: E402

cut = g.cut
FRONT = re.compile(r"Answer all questions|Only one answer per question|CORRECT METHOD|WRONG METHODS|Instructions|Section A\b|Time allowed", re.I)


def crossings(page, pieces_on_page):
    """Edges of these rects that run through a line of text: [(y, the line)]."""
    lines = [(l["bbox"], "".join(s["text"] for s in l["spans"]).strip()) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
    out = []
    for rect in pieces_on_page:
        for y in (rect.y0, rect.y1):
            for (x0, y0, x1, y1), t in lines:
                if t and x1 > rect.x0 and x0 < rect.x1 and y0 + 2 < y < y1 - 2:
                    out.append((round(y), t[:50]))
    return out


def main():
    manifest = json.load(open(os.path.join(g.WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] != "SPEC" and f["component"] in g.COMPONENTS:
            sets.setdefault(f"{f['component']}-{f['series']}".lower(), {})[f["kind"]] = os.path.join(g.WORK, "pdf", f["file"])
    problems = 0
    for set_id, files in sorted(sets.items()):
        g.asked(pymupdf.open(files["qp"]))
        for kind, portrait, max_x, bold in (("qp", True, 75, True), ("ms", False, 110, False)):
            doc = pymupdf.open(files[kind])
            regions = cut.regions(doc, max_x, bold, portrait)
            ids = [f"{q}.{p}" if p else q for (q, p), _, _ in regions]
            for dup in sorted({i for i in ids if ids.count(i) > 1}):
                if kind == "ms" or not any(p is None and q == dup for (q, p), _, _ in regions):  # a stem's label read twice is fine
                    print(f"  {set_id} {kind} {dup}: read twice", file=sys.stderr)
                    problems += 1
            for (q, p), pieces, text in regions:
                if kind == "qp" and re.search(r"Answer all questions|^Section [A-D]\b", text, re.M):
                    print(f"  {set_id} qp {q}.{p or ''}: has a section heading", file=sys.stderr)
                    problems += 1
                if kind == "qp" and g.MCQ.search(text) and not all(re.search(rf"^\s*{l}\s+\S", text, re.M) for l in "ABCD"):
                    print(f"  {set_id} qp {q}.{p or ''}: multiple choice without all its options", file=sys.stderr)
                    problems += 1
                if kind == "qp" and re.match(r"\s*[A-F] [A-Z]", text):
                    print(f"  {set_id} qp {q}.{p or ''}: starts with an option", file=sys.stderr)
                    problems += 1
                for pg, rect in pieces:
                    for y, t in crossings(doc[pg], [rect]):
                        print(f"  {set_id} {kind} {q}.{p or ''} page {pg + 1}: edge at {y} cuts '{t}'", file=sys.stderr)
                        problems += 1
            if kind == "ms":
                missing = sorted(g.ASKED - {k for k, _, _ in regions} - {(q, None) for q, p in g.ASKED if p})
                if missing:
                    print(f"  {set_id} ms: no scheme region for {missing}", file=sys.stderr)
                    problems += len(missing)
            if kind == "qp":
                (q, p), pieces, text = regions[0]
                if q != "01" or pieces[0][0] == 0 or FRONT.search(text):
                    print(f"  {set_id}: question 1 starts with front matter (page {pieces[0][0] + 1}): {text[:80]!r}", file=sys.stderr)
                    problems += 1
    print(f"{len(sets)} sets checked; {problems} problems", file=sys.stderr)


if __name__ == "__main__":
    main()
