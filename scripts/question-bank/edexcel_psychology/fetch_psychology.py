"""Fetch Pearson Edexcel's own A-Level (9PS0) and AS (8PS0) Psychology papers.

    python3 scripts/question-bank/edexcel_psychology/fetch_psychology.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-psychology

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Psychology.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-psychology")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["al15-psychology"]
fp.CODES = {"al15-psychology": ("8ps0", "9ps0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"([89]ps0)[-_ ]?(\d{2})(?!\d)", re.I)

if __name__ == "__main__":
    fp.main()
