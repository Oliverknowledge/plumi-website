"""Fetch AQA's own A-Level History (7042) papers.

    python3 scripts/question-bank/aqa_history/fetch_history.py [work-dir]   # default scripts/question-bank/.work/aqa-history

The A-Level fetcher (fetch_aqa.py) run over the History specification: the same two
sources (the spec's assessment-resources page, then AQA's file store for older series),
the same file names and the same <work-dir>/manifest.json.

Every option is its own paper: Component 1, the breadth study, is 70421A to 70421L,
and Component 2, the depth study, 70422A to 70422T (AQA uses no letter I). Component 3
is the non-exam assessment, so it has no papers. The AS (7041) is left out.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-history")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/history/a-level/history-7042/assessment-resources",
]
BREADTH = [f"70421{o}" for o in "ABCDEFGHJKL"]
DEPTH = [f"70422{o}" for o in "ABCDEFGHJKLMNOPQRST"]
fetch_aqa.COMPONENTS = {"7042": BREADTH + DEPTH}
# First sat in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers and the exemplar answers aren't a sat series: left out, as for Religious Studies.
    if re.match(r"AQA-\d{5}[A-Z]?-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
