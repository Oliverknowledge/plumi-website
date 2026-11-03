"""Check the cut GCSE PE crops: A-Level PE's checks, and each multiple-choice key against its paper's options.

    python3 scripts/question-bank/aqa_gcse_pe/check_gcse_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-pe

check_gcse_psychology.py run over GCSE PE with cut_gcse_pe.py's patches (an edge through a line of text, front
matter in question 1, a section heading in a question, a multiple-choice question missing an option, a label read
twice, a scheme region missing), then a scheme whose last line isn't its marking's close, and a key whose
scheme words ("Answer A – It contracts") aren't what that letter says in the paper.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cut_gcse_pe  # noqa: E402  (reads the work dir from argv and patches cut.py; must come first)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_gcse_psychology"))
import check_gcse_psychology as check  # noqa: E402
import pymupdf  # noqa: E402

g, cut = cut_gcse_pe.gcse, cut_gcse_pe.cut
_mcq = g.MCQ
CLOSE = re.compile(r"(Maximum \d+ marks?|marks?\)?|\(\d\)|\.|No relevant content\.?)\s*$", re.I)


class MCQ:
    """For check_gcse_psychology's option test, which wants A-D: a PE question may offer only A-C. Read as
    multiple choice only when it lacks one of A-C, so that test passes over a 3-option question."""
    @staticmethod
    def search(text):
        return _mcq.search(text) and not all(re.search(rf"^\s*{l}\s+\S", text, re.M) for l in "ABC")


def words(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def keys():
    """Each key's words in the scheme against the option with that letter in the paper."""
    problems = n = 0
    parts = json.load(open(os.path.join(g.WORK, "parts.json")))
    for p in parts:
        if not p.get("key"):
            continue
        n += 1
        said = g.MARKS_LINE.split(p["msText"], 1)[-1]
        said = re.sub(r"^\s*Answers?\s*[:–-]?\s*", "", said)
        said = re.sub(r"^\s*[A-D]\s*[–-]?\s*", "", said)
        said = re.sub(r"\(\d\)", " ", said)
        body = re.split(r"\[1 mark\]", p["text"], 1)[-1]
        m = re.search(rf"(?:^|\s){p['key']}\s+(.+?)(?=\s[A-D]\s+\S|\s*$)", body, re.S)
        opt = m.group(1) if m else ""
        if words(said)[:12] != words(opt)[:12]:
            print(f"  {p['id']}: key {p['key']}, scheme '{said[:60]}', option '{opt[:60]}'", file=sys.stderr)
            problems += 1
    print(f"{n} keys checked against their options; {problems} differ", file=sys.stderr)


def scheme_ends():
    problems = 0
    for name in sorted(os.listdir(os.path.join(g.WORK, "pdf"))):
        m = re.match(r"AQA-(\d{5})-MS-(\w+)\.pdf", name)
        if not m:
            continue
        set_id = f"{m.group(1)}-{m.group(2)}".lower()
        qp = pymupdf.open(os.path.join(g.WORK, "pdf", name.replace("-MS-", "-QP-")))
        g.asked(qp)
        asked = {k: t for k, _, t in cut.regions(qp, 75, True, True)}
        doc = pymupdf.open(os.path.join(g.WORK, "pdf", name))
        for (q, p), pieces, text in cut.regions(doc, 110, False, False):
            if _mcq.search(asked.get((q, p), "")):
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
    keys()
    scheme_ends()
