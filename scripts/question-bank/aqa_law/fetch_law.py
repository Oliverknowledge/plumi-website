"""Fetch AQA's own A-Level Law (7162) papers.

    python3 scripts/question-bank/aqa_law/fetch_law.py [work-dir]   # default scripts/question-bank/.work/aqa-law

The A-Level fetcher (fetch_aqa.py) run over the Law specification: the same two
sources (the spec's assessment-resources page, then AQA's file store for older
series), the same file names and the same <work-dir>/manifest.json. Paper 3 is
two components, 71623C (Contract) and 71623H (Human rights).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-law")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/law/a-level/law-7162/assessment-resources"]
fetch_aqa.COMPONENTS = {"7162": ["71621", "71622", "71623C", "71623H"]}
# First sat in June 2019; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
