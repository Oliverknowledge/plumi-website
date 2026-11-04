"""Fetch AQA's own A-Level Physical Education papers (7582).

    python3 scripts/question-bank/aqa_pe/fetch_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-pe

The A-Level fetcher (fetch_aqa.py) run over the PE specification: the same two
sources (the spec's assessment-resources page, then AQA's file store for older
series), the same file names and the same <work-dir>/manifest.json. The AS
(7581) has no resources page any more and nothing on the file store, so only
its components are tried there, in case AQA puts them back.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-pe")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/physical-education/a-level/physical-education-7582/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7581": ["75811", "75812"], "7582": ["75821", "75822"]}
# AS was first sat in June 2017, the A-Level in June 2018; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers aren't a sat series: left out, as for Psychology.
    if re.match(r"AQA-\d{5}-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
