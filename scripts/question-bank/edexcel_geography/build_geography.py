"""Write the Edexcel A-Level Geography bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_geography/build_geography.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Geography: the same shapes, written to
src/content/questionBank/edexcel-a-level-geography.json and public/question-bank/edexcel-a-level-geography/.

Geography's choices are whole questions ("EITHER Question 2 OR Question 3") or, at AS, whole
sections, so no part is marked "or" (that is for a choice inside one question, and would leave
the second question's card with no marks); each option's questions are tagged to its own topic
(2A or 2B, 4A or 4B, 8A or 8B), and check_geography.py checks the totals with the choices.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-geography")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

bp.SUBJECTS = [("edexcel-a-level-geography", "Geography", "Geography", ("8GE0", "9GE0"))]
# Pearson gives the papers no titles of their own: these are the areas of study each examines.
bp.TITLES = {
    "9GE0": ["Dynamic Landscapes and Physical Systems", "Dynamic Places and Human Systems", "Synoptic Investigation"],
    "8GE0": ["Dynamic Landscapes", "Dynamic Places"],
}
bp.FILES_JSON = None  # no past paper library page for geography yet

if __name__ == "__main__":
    bp.main()
