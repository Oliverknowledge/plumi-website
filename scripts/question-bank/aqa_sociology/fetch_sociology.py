"""Fetch AQA's own A-Level (7192) and AS (7191) Sociology papers.

    python3 scripts/question-bank/aqa_sociology/fetch_sociology.py [work-dir]   # default scripts/question-bank/.work/aqa-sociology

The A-Level fetcher (fetch_aqa.py) run over the Sociology specifications: the same
two sources (each spec's assessment-resources page, then AQA's file store for
older series), the same file names and the same <work-dir>/manifest.json.
Sociology has no inserts: each paper prints its Items above their questions.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-sociology")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/sociology/a-level/sociology-7192/assessment-resources",
    "https://www.aqa.org.uk/subjects/sociology/as-level/sociology-7191/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7191": ["71911", "71912"], "7192": ["71921", "71922", "71923"]}
# AS was first sat in June 2016, the A-Level in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
