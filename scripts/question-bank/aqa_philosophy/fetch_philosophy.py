"""Fetch AQA's own A-Level (7172) and AS (7171) Philosophy papers.

    python3 scripts/question-bank/aqa_philosophy/fetch_philosophy.py [work-dir]   # default scripts/question-bank/.work/aqa-philosophy

The A-Level fetcher (fetch_aqa.py) run over the Philosophy specification: the same
two sources (the spec's assessment-resources page, then AQA's file store for older
series), the same file names and the same <work-dir>/manifest.json. AQA no longer
has an AS Philosophy page; the file store is tried for its papers all the same.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-philosophy")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/philosophy/a-level/philosophy-7172/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7171": ["71711", "71712"], "7172": ["71721", "71722"]}
# AS was first sat in June 2018, the A-Level in June 2019; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers aren't a sat series: left out, as for Psychology.
    if re.match(r"AQA-\d{5}-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
