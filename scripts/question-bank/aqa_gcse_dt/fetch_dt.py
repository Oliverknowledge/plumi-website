"""Fetch AQA's own GCSE Design and Technology (8552) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_dt/fetch_dt.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-dt

fetch_aqa.py run over 8552: the specification's assessment-resources page, then AQA's file
store, with the same file names and <work-dir>/manifest.json. The written exam is one paper,
filed as "8552W" up to June 2023 and "85521" from June 2024: both are called 8552W here. The
NEA (8552/C) is coursework and left out, with its reports (8552C, 8552CE). 8552 was first sat
in June 2019, which redirects on the file store; June 2020 and 2021 were cancelled. November
2020's report is titled "Component 2 NEA" on AQA's page but is the written paper's.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-dt")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/design-and-technology/gcse/design-and-technology-8552/assessment-resources"]
fetch_aqa.COMPONENTS = {"8552": ["8552W"]}
fetch_aqa.SERIES = ["JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]


def parse_name(name):
    """fetch_aqa's reader, for the paper's two filings. The specimen and the modified (large print) papers are left out."""
    n = name.upper()
    if re.match(r"AQA-\d{5}-S(QP|MS)", n) or "MQP" in n:
        return None
    m = re.match(r"AQA-(?:8552W|85521)-(?:W-)?(QP|MS|WRE)-(JUN|NOV)(\d{2})", n)
    return ("8552W", fetch_aqa.KINDS[m.group(1)], m.group(2) + m.group(3), "-CR" in n) if m else None


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
