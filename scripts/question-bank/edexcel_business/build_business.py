"""Write the Edexcel A-Level Business bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_business/build_business.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Business: the same shapes, written to
src/content/questionBank/edexcel-a-level-business.json and public/question-bank/edexcel-a-level-business/.
The whole papers are on R2 as edexcel/9bs0-01-qp-jun24.pdf (there is no past paper library page for Business yet).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-business")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-a-level-business"
bp.SUBJECTS = [(SLUG, "Business", "Business", ("8BS0", "9BS0"))]
bp.TITLES = {"9BS0": ["Marketing, people and global businesses", "Business activities, decisions and strategy",
                      "Investigating business in a competitive environment"]}
bp.FILES_JSON = None
CONTROL = re.compile(r"\s*[\x00-\x08\x0b\x0c\x0e-\x1f]\s*")  # a stray tab glyph in a few papers' text ("\x07Using the data…")


def clean(v):
    if isinstance(v, str):
        return CONTROL.sub(" ", v).strip() if CONTROL.search(v) else v
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    return v

if __name__ == "__main__":
    bp.main()
    # Only the A-Level (9BS0) papers are held: the AS (8BS0) papers are a separate qualification.
    path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = clean(json.load(open(path)))
    meta["specs"] = ["9BS0"]
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(bp.ROOT, "public", "question-bank", SLUG)
    for name in ("parts", "text", "reports"):
        data = clean(json.load(open(os.path.join(pub, f"{name}.json"))))
        json.dump(data, open(os.path.join(pub, f"{name}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
