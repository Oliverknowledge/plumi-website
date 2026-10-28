"""Fetch AQA's own GCSE (8702) or A-Level (7712, AS 7711) English Literature papers.

    python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py gcse [work-dir]      # default scripts/question-bank/.work/aqa-english-lit-gcse
    python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level [work-dir]   # default scripts/question-bank/.work/aqa-english-lit-a

The A-Level fetcher (fetch_aqa.py) run over the English Literature specifications:
the same two sources (each spec's assessment-resources page, then AQA's file store
for older series), the same file names and the same <work-dir>/manifest.json.
AQA prints some papers only as copyright-removed ("-CR") copies, which are what we take then.
In November 2021 and June 2022 GCSE Paper 1 was sat as three papers, one per
section a student chose (87021M, 87021N, 87021P).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LEVEL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ("gcse", "a-level") else "gcse"
rest = [a for a in sys.argv[1:] if a not in ("gcse", "a-level")]
sys.argv[1:] = [os.path.abspath(rest[0]) if rest else os.path.join(HERE, "..", ".work", "aqa-english-lit-" + ("gcse" if LEVEL == "gcse" else "a"))]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

if LEVEL == "gcse":
    fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/english/gcse/english-8702/assessment-resources"]
    fetch_aqa.COMPONENTS = {"8702": ["87021", "87021M", "87021N", "87021P", "87022"]}
else:
    fetch_aqa.PAGES = [
        "https://www.aqa.org.uk/subjects/english/a-level/english-7712/assessment-resources",
        "https://www.aqa.org.uk/subjects/english/as-level/english-7711/assessment-resources",
    ]
    fetch_aqa.COMPONENTS = {"7711": ["77111", "77112"], "7712": ["77121", "77122A", "77122B"]}
# First sat in June 2017 (GCSE) and June 2016 (AS); June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]

if __name__ == "__main__":
    fetch_aqa.main()
