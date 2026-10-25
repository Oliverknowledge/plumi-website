"""Fetch AQA's own A-Level (7182) and AS (7181) Psychology papers.

    python3 scripts/question-bank/aqa_psychology/fetch_psychology.py [work-dir]   # default scripts/question-bank/.work/aqa-psychology

The A-Level fetcher (fetch_aqa.py) run over the Psychology specifications: the
same two sources (each spec's assessment-resources page, then AQA's file store
for older series), the same file names and the same <work-dir>/manifest.json.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-psychology")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/psychology/a-level/psychology-7182/assessment-resources",
    "https://www.aqa.org.uk/subjects/psychology/as-level/psychology-7181/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7181": ["71811", "71812"], "7182": ["71821", "71822", "71823"]}
# AS was first sat in June 2016, the A-Level in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers number questions in a way cut.py can't read (most labels
    # aren't found), so they're left out.
    if re.match(r"AQA-\d{5}-S(QP|MS)", name, re.I):
        return None
    # AQA uploaded November 2020's Paper 3 report as "AQA-71823R-WRE-NOV20.PDF".
    return _parse(re.sub(r"^AQA-71823R-", "AQA-71823-", name, flags=re.I))


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
