"""Fetch AQA's own A-Level (7367) and AS (7366) Further Maths papers.

    python3 scripts/question-bank/aqa_further_maths/fetch_further_maths.py [work-dir]   # default scripts/question-bank/.work/aqa-further-maths

The A-Level fetcher (fetch_aqa.py) run over the two Further Maths specifications, as
fetch_maths.py runs it over Maths: the same sources, file names and manifest. Each
option of the A-Level's Paper 3 and the AS's Paper 2 is a paper of its own
("AQA-73673M-QP-JUN23": Mechanics; S Statistics, D Discrete). The bank starts at
June 2019, the first A-Level sitting; the AS's June 2018 is left out with it.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-further-maths")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/mathematics/a-level/further-mathematics-7367/assessment-resources",
                   "https://www.aqa.org.uk/subjects/mathematics/as-level/further-mathematics-7366/assessment-resources"]
fetch_aqa.COMPONENTS = {"7367": ["73671", "73672", "73673M", "73673S", "73673D"], "7366": ["73661", "73662M", "73662S", "73662D"]}
# June 2020 and 2021 were cancelled; November 2020 and 2021 were sat.
fetch_aqa.SERIES = ["JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    # Specimen papers are left out, as for the other AQA banks: they were never sat. So is June 2018 (AS only).
    if re.match(r"AQA-\d{5}[A-Z]?-S(QP|MS)", name, re.I) or re.search(r"JUN18", name, re.I):
        return None
    got = _parse(name)
    return got if got and got[0] in sum(fetch_aqa.COMPONENTS.values(), []) else None


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
