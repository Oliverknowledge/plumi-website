"""Fetch AQA's own A-Level (7136) and AS (7135) Economics papers.

    python3 scripts/question-bank/aqa_economics/fetch_economics.py [work-dir]   # default scripts/question-bank/.work/aqa-economics

The A-Level fetcher (fetch_aqa.py) run over the Economics specifications: the same
two sources (each spec's assessment-resources page, then AQA's file store for
older series), the same file names and the same <work-dir>/manifest.json. The
inserts matter here: AS Papers 1 and 2 print their extracts in one, and A-Level
Paper 3 its case study.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-economics")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/economics/a-level/economics-7136/assessment-resources",
    "https://www.aqa.org.uk/subjects/economics/as-level/economics-7135/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7135": ["71351", "71352"], "7136": ["71361", "71362", "71363"]}
# AS was first sat in June 2016, the A-Level in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
