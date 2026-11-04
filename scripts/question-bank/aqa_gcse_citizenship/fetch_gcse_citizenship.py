"""Fetch AQA's own GCSE Citizenship Studies (8100) papers: question papers, mark schemes, examiner's reports and inserts.

    python3 scripts/question-bank/aqa_gcse_citizenship/fetch_gcse_citizenship.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-citizenship

fetch_aqa.py run over 8100: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. 8100 was first sat in June
2018; June 2020 and 2021 were cancelled.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-citizenship")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/citizenship/gcse/citizenship-studies-8100/assessment-resources"]
fetch_aqa.COMPONENTS = {"8100": ["81001", "81002"]}
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
