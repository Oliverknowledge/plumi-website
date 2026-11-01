"""Fetch AQA's own GCSE (8700) or A-Level (7702) English Language papers: question papers, inserts, mark schemes and reports.

    python3 scripts/question-bank/aqa_english_lang/fetch_english_lang.py [work-dir]           # default scripts/question-bank/.work/aqa-english-lang
    python3 scripts/question-bank/aqa_english_lang/fetch_english_lang.py a-level [work-dir]   # default scripts/question-bank/.work/aqa-english-lang-a

The A-Level fetcher (fetch_aqa.py) run over the English Language specification: the same two
sources (the specification's assessment-resources page, then AQA's file store for older series),
the same file names and the same <work-dir>/manifest.json. Each paper's sources are printed in an
insert ("INS"), which a question can't be read without. English Language is sat every June and,
for resits, every November. The A-Level (Paper 1, 77021; Paper 2, 77022) prints its texts in an insert
too, and was sat in June, and in November 2020 and 2021; its NEA (77023) has no paper.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
A_LEVEL = len(sys.argv) > 1 and sys.argv[1] == "a-level"
rest = [a for a in sys.argv[1:] if a != "a-level"]
sys.argv[1:] = [os.path.abspath(rest[0]) if rest else os.path.join(HERE, "..", ".work", "aqa-english-lang-a" if A_LEVEL else "aqa-english-lang")]
sys.path.insert(0, os.path.dirname(HERE))
import re  # noqa: E402

import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/english/gcse/english-8700/assessment-resources"]
fetch_aqa.COMPONENTS = {"8700": ["87001", "87002"]}
# First sat in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN17", "NOV17", "JUN18", "NOV18", "JUN19", "NOV19", "NOV20", "NOV21", "JUN22", "NOV22", "JUN23", "NOV23", "JUN24", "NOV24", "JUN25", "NOV25"]
if A_LEVEL:
    fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/english/a-level/english-7702/assessment-resources"]
    fetch_aqa.COMPONENTS = {"7702": ["77021", "77022"]}
    # First sat in June 2017 (AQA's file store has the older series it still publishes); June 2020 and 2021 were cancelled.
    fetch_aqa.SERIES = ["JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
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
