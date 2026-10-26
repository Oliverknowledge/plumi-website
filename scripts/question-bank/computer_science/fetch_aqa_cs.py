"""Fetch AQA's own A-Level (7517) and AS (7516) Computer Science papers.

    python3 scripts/question-bank/computer_science/fetch_aqa_cs.py [work-dir]   # default scripts/question-bank/.work/aqa-cs

The A-Level fetcher (fetch_aqa.py) run over the Computer Science specifications: the
same two sources (each spec's assessment-resources page, then AQA's file store for
older series), the same file names and the same <work-dir>/manifest.json. Paper 1 is
taken on screen, around a skeleton program AQA releases beforehand with its
preliminary material ("PM"): that PDF is fetched too, to read, though the bank
doesn't show it. The skeleton programs themselves are zips, and not fetched.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-cs")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/computer-science/a-level/computer-science-7517/assessment-resources",
    "https://www.aqa.org.uk/subjects/computer-science/as-level/computer-science-7516/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7516": ["75161", "75162"], "7517": ["75171", "75172"]}
# AS was first sat in June 2016, the A-Level in June 2017; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
fetch_aqa.KINDS["PM"] = "pm"

_parse = fetch_aqa.parse_name


def parse_name(name):
    # The specimen papers aren't a sitting; leave them out.
    if re.match(r"AQA-\d{5}-S(QP|MS|PM)", name, re.I):
        return None
    m = re.match(r"AQA-(\d{5})-PM-(JUN|NOV)(\d{2})(?:-AM)?\.PDF$", name, re.I)  # "AQA-75161-PM-NOV20-AM.PDF"
    if m:
        return m.group(1), "pm", m.group(2).upper() + m.group(3), False
    # June 2023's Paper 1 report covers every language option: "AQA-75171AE-WRE-JUN23.PDF".
    return _parse(re.sub(r"^AQA-75171AE-", "AQA-75171-", name, flags=re.I))


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
