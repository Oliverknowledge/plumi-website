"""Fetch AQA's own A-Level Maths (7357) papers.

    python3 scripts/question-bank/aqa_maths/fetch_maths.py [work-dir]   # default scripts/question-bank/.work/aqa-maths

The A-Level fetcher (fetch_aqa.py) run over the Maths specification: the same two
sources (the spec's assessment-resources page, then AQA's file store), the same
file names and the same <work-dir>/manifest.json. AQA's page lists every series
from June 2018 (the first A-Level sitting) to June 2025.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-maths")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/mathematics/a-level/mathematics-7357/assessment-resources"]
fetch_aqa.COMPONENTS = {"7357": ["73571", "73572", "73573"]}
# First sat in June 2018; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # Specimen papers are left out, as for the other AQA banks: they were never sat.
    if re.match(r"AQA-\d{5}-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
