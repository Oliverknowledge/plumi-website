"""Fetch Pearson Edexcel's own GCSE (9-1) Statistics (1ST0) papers.

    python3 scripts/question-bank/edexcel_gcse_statistics/fetch_gcse_statistics.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-statistics

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the same manifest, the same
caching); this points it at GCSE Statistics ("gcse17-stat") and downloads with curl, as
edexcel_gcse_business/fetch_gcse_business.py does. Papers 1 and 2, each in two tiers: components "1st0-1f",
"1st0-1h", "1st0-2f", "1st0-2h". June 2019 was the first exam; Pearson keeps any latest series for teachers only.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["gcse17-stat"]
fp.CODES = {"gcse17-stat": ("1st0", "1st0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
_name = re.compile(r"(1st0)[-_ ]?([12][fh])(?![a-z0-9])", re.I)


class _Match:
    """Pearson's 2019 to 2021 files are named 1ST0_1F_…, the rest 1st0-1f-…: one lower-case component for both."""

    def __init__(self, m):
        self.m = m

    def group(self, n):
        return self.m.group(n).lower()


class _Name:
    @staticmethod
    def search(name):
        m = _name.search(name)
        return _Match(m) if m else None


fp.NAME = _Name
_get = fp.get


def get(url, binary=False):
    if not binary:
        return _get(url)
    r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", fp.UA, url], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


fp.get = get

if __name__ == "__main__":
    fp.main()
