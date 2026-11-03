"""Check the cut PE crops: GCSE Psychology's checks, and each scheme ending where its question's guidance ends.

    python3 scripts/question-bank/aqa_pe/check_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-pe

check_gcse_psychology.py run over PE with cut_pe.py's patches (an edge through a line of text, front matter
in question 1, a section heading in a question, a multiple-choice question missing an option, a label read
twice, a scheme region missing), then a scheme region whose last line isn't its marking's close
("Maximum 3 marks", "Accept any other ...", "No relevant content", a possible-content bullet), which is where
a scheme carried over a page would be cut short or run into the next question's box.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cut_pe  # noqa: E402  (reads the work dir from argv and patches cut.py; must come first)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_psychology"))
import check_gcse_psychology as check  # noqa: E402
import pymupdf  # noqa: E402

g, cut = cut_pe.gcse, cut_pe.cut
_mcq = g.MCQ


class MCQ:
    """For check_gcse_psychology's option test, which wants A-D: a PE question may offer only A-C. Read as
    multiple choice only when it lacks one of A-C, so that test passes over a 3-option question."""
    @staticmethod
    def search(text):
        return _mcq.search(text) and not all(re.search(rf"^\s*{l}\s+\S", text, re.M) for l in "ABC")


CLOSE = re.compile(r"(Maximum \d+ marks?|marks?\)?|\(\d\)|\.|No relevant content\.?)\s*$", re.I)


def scheme_ends():
    problems = 0
    for name in sorted(os.listdir(os.path.join(g.WORK, "pdf"))):
        m = re.match(r"AQA-(\d{5})-MS-(\w+)\.pdf", name)
        if not m:
            continue
        set_id = f"{m.group(1)}-{m.group(2)}".lower()
        qp = pymupdf.open(os.path.join(g.WORK, "pdf", name.replace("-MS-", "-QP-")))
        g.asked(qp)
        doc = pymupdf.open(os.path.join(g.WORK, "pdf", name))
        for (q, p), pieces, text in cut.regions(doc, 110, False, False):
            if g.MCQ.search(next((t for k, _, t in cut.regions(qp, 75, True, True) if k == (q, p)), "")):
                continue  # keyed: no scheme crop
            last = next((t for t in reversed(text.splitlines()) if t.strip()), "").strip()
            if not CLOSE.search(last):
                print(f"  {set_id} ms {q}.{p or ''}: ends '{last[-60:]}'", file=sys.stderr)
                problems += 1
    print(f"{problems} schemes with an odd last line", file=sys.stderr)


if __name__ == "__main__":
    g.MCQ = MCQ
    check.main()
    g.MCQ = _mcq
    scheme_ends()
