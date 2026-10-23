"""Fetch AQA's own GCSE Biology, Chemistry and Physics papers.

    python3 scripts/question-bank/aqa_gcse/fetch_gcse.py [work-dir]   # default scripts/question-bank/.work-gcse

The A-Level fetcher (fetch_aqa.py) run over the GCSE specifications: the same two
sources (each spec's assessment-resources page, then AQA's file store for older
series), the same file names and the same <work-dir>/manifest.json. Every GCSE
science paper comes in two tiers, so each paper is two components: 84611F and
84611H are Biology Paper 1 Foundation and Higher.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/assessment-resources",
    "https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/assessment-resources",
    "https://www.aqa.org.uk/subjects/physics/gcse/physics-8463/assessment-resources",
]
fetch_aqa.COMPONENTS = {spec: [f"{spec}{n}{tier}" for n in "12" for tier in "FH"] for spec in ("8461", "8462", "8463")}
# The specifications were first sat in June 2018; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # AQA uploaded June 2022's Biology Paper 1 reports as "AQA-84611F-WRE-%202022.PDF".
    m = re.match(r"AQA-(\d{5}[FH])-WRE-%20(20\d\d)\.PDF$", name, re.I)
    if m:
        return m.group(1), "er", "JUN" + m.group(2)[2:], False
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
