"""Fetch Pearson Edexcel's own GCSE (9-1) Business (1BS0) papers.

    python3 scripts/question-bank/edexcel_gcse_business/fetch_gcse_business.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-business

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at GCSE Business ("gcse17-business")
and downloads with curl, as edexcel_gcse_geography/fetch_gcse_geography.py does. June 2019
was the first exam; Pearson keeps the latest series for teachers only.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-business")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["gcse17-business"]
fp.CODES = {"gcse17-business": ("1bs0", "1bs0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"(1bs0)[-_ ]?(\d{2})(?!\d)", re.I)
_get = fp.get


def get(url, binary=False):
    if not binary:
        return _get(url)
    r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", fp.UA, url], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


fp.get = get

if __name__ == "__main__":
    fp.main()
