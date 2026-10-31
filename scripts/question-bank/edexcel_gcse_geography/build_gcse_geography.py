"""Write the Edexcel GCSE Geography B bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_gcse_geography/build_gcse_geography.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Geography B (1GB0): the same shapes, written to
src/content/questionBank/edexcel-gcse-geography-b.json and public/question-bank/edexcel-gcse-geography-b/.
A GCSE, with no AS papers and no year split. The papers' choices are whole questions (Paper 2's
"EITHER Question 8 OR Question 9"), so, as in the A-Level Geography bank, no part is marked "or";
check_gcse_geography.py checks the totals with the choices. A part's marks are its own; the SPaG
marks printed under its question's last part ("Spelling, punctuation, grammar and use of specialist
terminology = 4 marks") are in its scheme crop's SPaG grid, not its mark.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-gcse-geography-b"
bp.SUBJECTS = [(SLUG, "Geography B", "Geography B", ("1GB0", "1GB0"))]
bp.TITLES = {"1GB0": ["Global Geographical Issues", "UK Geographical Issues", "People and Environment Issues"]}
bp.FILES_JSON = None  # no past paper library page for Geography B yet: the whole papers are linked from the bank

if __name__ == "__main__":
    bp.main()
    path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = json.load(open(path))
    meta["level"], meta["specs"] = "GCSE", ["1GB0"]
    meta.pop("fullName", None)  # "Geography B" already
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
