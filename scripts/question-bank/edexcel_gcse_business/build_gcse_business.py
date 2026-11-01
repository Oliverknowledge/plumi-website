"""Write the Edexcel GCSE Business bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_gcse_business/build_gcse_business.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at GCSE Business (1BS0): the same shapes, written to
src/content/questionBank/edexcel-gcse-business.json and public/question-bank/edexcel-gcse-business/.
A GCSE, with no AS papers and no year split. The whole papers are on R2 as edexcel/1bs0-01-qp-jun24.pdf
(there is no past paper library page for GCSE Business yet).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-business")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-gcse-business"
bp.SUBJECTS = [(SLUG, "Business", "Business", ("1BS0", "1BS0"))]
bp.TITLES = {"1BS0": ["Investigating small business", "Building a business"]}
bp.FILES_JSON = None

if __name__ == "__main__":
    bp.main()
    path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = json.load(open(path))
    meta["level"], meta["specs"] = "GCSE", ["1BS0"]
    meta.pop("fullName", None)  # "Business" already
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
