"""Fetch AQA's own GCSE Business (8132) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_business/fetch_gcse_business.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-business

fetch_aqa.py run over 8132: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. Both papers print their case
studies and items in the paper itself; the only inserts AQA lists (June 2025) are the
modified copies', which fetch_aqa leaves out. June 2018 and June 2019 have been withdrawn
from AQA's site (the file store redirects to its home page); June 2020 and 2021 were cancelled.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-business")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/business/gcse/business-8132/assessment-resources"]
fetch_aqa.COMPONENTS = {"8132": ["81321", "81322"]}
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
