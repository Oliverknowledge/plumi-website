"""Fetch AQA's own GCSE Physical Education (8582) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_pe/fetch_gcse_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-pe

fetch_aqa.py run over 8582: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. 8582 was first sat in June
2018; June 2020 and 2021 were cancelled. The NEA is left out: only the two written papers.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-pe")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/physical-education/gcse/physical-education-8582/assessment-resources"]
fetch_aqa.COMPONENTS = {"8582": ["85821", "85822"]}
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers aren't a sat series: left out, as for A-Level PE.
    if re.match(r"AQA-\d{5}-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
