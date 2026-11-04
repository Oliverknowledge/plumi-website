"""Fetch AQA's own GCSE Food Preparation and Nutrition (8585) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_food/fetch_food.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-food

fetch_aqa.py run over 8585: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. The written exam is one paper,
8585/W; the NEA (8585/C) is coursework and left out. The first sitting (June 2018) and June
2019's question paper redirect on the file store; June 2020 and 2021 were cancelled. June
2022's report on the written paper is filed as "AQA-85851-WRE-JUN22" (85852 is the NEA's).
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-food")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/food-preparation-and-nutrition/gcse/food-preparation-and-nutrition-8585/assessment-resources"]
fetch_aqa.COMPONENTS = {"8585": ["8585W"]}
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

def parse_name(name):
    """fetch_aqa's reader, for the paper's "8585W" (four digits and a letter, where the sciences have five digits)."""
    n = name.upper()
    if re.match(r"AQA-\d{5}-S(QP|MS)", n) or "MQP" in n:
        return None  # the specimen and the modified (large print) papers are left out
    if n.startswith("AQA-85851-WRE-JUN22"):
        return "8585W", "er", "JUN22", False
    m = re.match(r"AQA-8585W-(?:W-)?(QP|MS|WRE)-(JUN|NOV)(\d{2})", n)
    return ("8585W", fetch_aqa.KINDS[m.group(1)], m.group(2) + m.group(3), "-CR" in n) if m else None


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
