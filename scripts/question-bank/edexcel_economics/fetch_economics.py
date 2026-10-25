"""Fetch Pearson Edexcel's own A-Level (9EC0) and AS (8EC0) Economics A papers.

    python3 scripts/question-bank/edexcel_economics/fetch_economics.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-economics

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Economics A.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["al15-economics-a"]
fp.CODES = {"al15-economics-a": ("8ec0", "9ec0")}
# October 2020's schemes are filed under "Mark-Scheme" as well as "Mark-scheme".
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"([89]ec0)[-_ ]?(\d{2})(?!\d)", re.I)

if __name__ == "__main__":
    fp.main()
