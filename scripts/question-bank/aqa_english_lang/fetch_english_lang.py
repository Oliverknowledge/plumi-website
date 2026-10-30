"""Fetch AQA's own GCSE English Language (8700) papers: question papers, inserts, mark schemes and reports.

    python3 scripts/question-bank/aqa_english_lang/fetch_english_lang.py [work-dir]   # default scripts/question-bank/.work/aqa-english-lang

The A-Level fetcher (fetch_aqa.py) run over the English Language specification: the same two
sources (the specification's assessment-resources page, then AQA's file store for older series),
the same file names and the same <work-dir>/manifest.json. Each paper's sources are printed in an
insert ("INS"), which a question can't be read without. English Language is sat every June and,
for resits, every November.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-english-lang")]
sys.path.insert(0, os.path.dirname(HERE))
import re  # noqa: E402

import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/english/gcse/english-8700/assessment-resources"]
fetch_aqa.COMPONENTS = {"8700": ["87001", "87002"]}
# First sat in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "NOV17", "JUN18", "NOV18", "JUN19", "NOV19", "NOV20", "NOV21", "JUN22", "NOV22", "JUN23", "NOV23", "JUN24", "NOV24", "JUN25", "NOV25"]
_parse = fetch_aqa.parse_name


def parse_name(name):
    """The specimen papers for 2026 on, "AQA-8700-1-SQP-2026.pdf" and "AQA-87002-SINS-2026.PDF", are "SPEC"."""
    m = re.match(r"AQA-8700-?([12])-S(QP|MS|INS)-20\d\d\.PDF$", name, re.I)
    if m:
        return "8700" + m.group(1), fetch_aqa.KINDS[m.group(2).upper()], "SPEC", False
    return _parse(name)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
