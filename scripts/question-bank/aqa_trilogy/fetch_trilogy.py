"""Fetch AQA's own GCSE Combined Science: Trilogy papers.

    python3 scripts/question-bank/aqa_trilogy/fetch_trilogy.py [work-dir]   # default scripts/question-bank/.work-gcse-trilogy

The A-Level fetcher (fetch_aqa.py) run over Trilogy (8464), as fetch_gcse.py does for the
separate sciences. Trilogy has six papers, each in two tiers, and AQA names them by
science: 8464B1F is Biology Paper 1 Foundation, 8464C2H Chemistry Paper 2 Higher,
8464P1F Physics Paper 1 Foundation. Same sources, file names and manifest.json.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse-trilogy")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/science/gcse/science-8464/assessment-resources"]
fetch_aqa.COMPONENTS = {"8464": [f"8464{s}{n}{tier}" for s in "BCP" for n in "12" for tier in "FH"]}
# First sat in June 2018; June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

KINDS = {"QP": "qp", "MS": "ms", "WRE": "er", "INS": "ins"}


def parse_name(name):
    n = name.upper()
    if "MQP" in n or "MODIFIED" in n:
        return None
    m = re.match(r"AQA-(8464[BCP][12][FH])-(?:W-)?(QP|MS|WRE|INS)-(JUN|NOV)(\d{2})(?:\d{2})?", n)
    if m:
        return m.group(1), KINDS[m.group(2)], m.group(3) + m.group(4)[-2:], "-CR" in n
    # Specimen papers carry the paper's number too: AQA-84641B1F-SQP-2024.PDF.
    m = re.match(r"AQA-8464\d([BCP][12][FH])-S(QP|MS)", n)
    if m:
        return "8464" + m.group(1), KINDS[m.group(2)], "SPEC", False
    # June 2022's Chemistry Paper 1 schemes: AQA-8464-C-1F-Final-MS-Jun22-v1.1.pdf.
    m = re.match(r"AQA-8464-([BCP])-([12][FH])-FINAL-MS-(JUN|NOV)(\d{2})", n)
    if m:
        return "8464" + m.group(1) + m.group(2), "ms", m.group(3) + m.group(4), False
    return None


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    fetch_aqa.main()
