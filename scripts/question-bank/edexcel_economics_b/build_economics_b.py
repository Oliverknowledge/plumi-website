"""Write the Edexcel A-Level Economics B bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_economics_b/build_economics_b.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Economics B: the same shapes, written to
src/content/questionBank/edexcel-a-level-economics-b.json and public/question-bank/edexcel-a-level-economics-b/.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics-b")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-a-level-economics-b"
bp.SUBJECTS = [(SLUG, "Economics B", "Economics B", ("8EB0", "9EB0"))]
bp.TITLES = {"9EB0": ["Markets and how they work", "Competing in the global economy", "The economic environment and business"]}
bp.FILES_JSON = None  # the past paper library's page is built from the board's own manifest (scripts/past-papers/boards/edexcel_economics_b.py)

if __name__ == "__main__":
    bp.main()
    # Only the A-Level (9EB0) papers are held: the AS (8EB0) papers are a separate qualification.
    path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = json.load(open(path))
    meta["specs"] = ["9EB0"]
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    # The whole papers are the library's copies (EDX-9EB0-01-QP-JUN24.pdf), one copy on R2 for both pages.
    lib = lambda m: f"edexcel/EDX-9EB0-{m.group(1)}-{m.group(2).upper()}-{m.group(3).upper()}.pdf"  # noqa: E731
    named = re.compile(r"edexcel/9eb0-(\d\d)-(qp|ms|er)-([a-z]{3}\d\d)\.pdf")
    for path in (path, os.path.join(bp.ROOT, "public", "question-bank", SLUG, "parts.json")):
        text = named.sub(lib, open(path).read())
        open(path, "w").write(text)
