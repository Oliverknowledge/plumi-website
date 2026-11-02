"""Fetch AQA's own GCSE Psychology (8182) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_psychology/fetch_gcse_psychology.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-psychology

fetch_aqa.py run over 8182: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. 8182 was first sat in June
2019; June 2020 and 2021 were cancelled.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-psychology")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/psychology/gcse/psychology-8182/assessment-resources"]
fetch_aqa.COMPONENTS = {"8182": ["81821", "81822"]}
fetch_aqa.SERIES = ["JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
