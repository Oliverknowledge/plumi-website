"""Fetch AQA's own A-Level (7037) and AS (7036) Geography papers.

    python3 scripts/question-bank/aqa_geography/fetch_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-geography

The A-Level fetcher (fetch_aqa.py) run over the Geography specifications: the same
two sources (each spec's assessment-resources page, then AQA's file store for
older series), the same file names and the same <work-dir>/manifest.json. The
inserts matter here: the papers print some of their figures in one, in colour.
Component 3 (the NEA, the fieldwork investigation) is coursework, with no paper.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-geography")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/geography/a-level/geography-7037/assessment-resources",
    "https://www.aqa.org.uk/subjects/geography/as-level/geography-7036/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7036": ["70361", "70362"], "7037": ["70371", "70372"]}
# AS was first sat in June 2017, the A-Level in June 2018; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
