"""Fetch AQA's own A-Level Religious Studies (7062) papers.

    python3 scripts/question-bank/aqa_rs/fetch_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-rs

The A-Level fetcher (fetch_aqa.py) run over the Religious Studies specification: the
same two sources (the spec's assessment-resources page, then AQA's file store for older
series), the same file names and the same <work-dir>/manifest.json.

Paper 1 (70621) is everyone's; Paper 2 is set once per religion (70622A Buddhism, B
Christianity, C Hinduism, D Islam, E Judaism, F Sikhism). AQA publishes no Sikhism
paper for any series, and June 2017 to June 2019 are no longer on its site: the file
store is tried for them all the same, so a re-run picks them up if AQA restores them.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-rs")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/religious-studies/a-level/religious-studies-7062/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7062": ["70621"] + [f"70622{o}" for o in "ABCDEF"]}
# First sat in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers and exemplar answers ("-EX") aren't a sat series: left out, as for Philosophy.
    if re.match(r"AQA-\d{5}[A-Z]?-S(QP|MS)", name, re.I):
        return None
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
