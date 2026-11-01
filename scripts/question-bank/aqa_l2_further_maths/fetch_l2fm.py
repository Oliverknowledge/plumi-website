"""Fetch AQA's own Level 2 Certificate in Further Mathematics (8365) papers.

    python3 scripts/question-bank/aqa_l2_further_maths/fetch_l2fm.py [work-dir]   # default scripts/question-bank/.work/aqa-l2fm

The A-Level fetcher (fetch_aqa.py) run over 8365: the same two sources (the spec's
assessment-resources page, then AQA's file store), the same file names, so the past
paper library's copies already on R2 (aqa/AQA-83651-QP-JUN23.pdf) are the same files,
and the same <work-dir>/manifest.json. The certificate is sat in June only; AQA's page
lists November 2021 (the autumn series that replaced June 2021) and June 2022 to June
2025, and its file store has nothing older public (June 2019 is for centres only).
The specimen papers are kept, as in the GCSE Maths bank. The formulae sheet AQA prints
for every series (AQA-8365-FS-INS) isn't a paper's own file, so it is left out.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-l2fm")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/mathematics/aqa-certificate/mathematics-8365/assessment-resources"]
fetch_aqa.COMPONENTS = {"8365": ["83651", "83652"]}
fetch_aqa.SERIES = ["JUN19", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
