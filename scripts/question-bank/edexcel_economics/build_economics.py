"""Write the Edexcel A-Level Economics A bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_economics/build_economics.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Economics A: the same shapes, written to
src/content/questionBank/edexcel-a-level-economics-a.json and public/question-bank/edexcel-a-level-economics-a/.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

bp.SUBJECTS = [("edexcel-a-level-economics-a", "Economics A", "Economics A", ("8EC0", "9EC0"))]
bp.TITLES = {
    "9EC0": ["Markets and Business Behaviour", "The National and Global Economy", "Microeconomics and Macroeconomics"],
    "8EC0": ["Introduction to Markets and Market Failure", "The UK Economy – Performance and Policies"],
}
bp.FILES_JSON = None  # no past paper library page for economics yet

if __name__ == "__main__":
    bp.main()
