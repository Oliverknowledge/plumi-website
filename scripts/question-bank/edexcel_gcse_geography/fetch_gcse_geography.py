"""Fetch Pearson Edexcel's own GCSE (9-1) Geography B (1GB0) papers.

    python3 scripts/question-bank/edexcel_gcse_geography/fetch_gcse_geography.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-geography

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Geography B ("gcse16-geography-b")
and downloads with curl, which picks up the long downloads Pearson's server drops part
way (edexcel_gcse/fetch_gcse.py's finding). Each paper's Resource Booklet is bound into
its question paper, so there is nothing else to fetch. June 2026 is for teachers only.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["gcse16-geography-b"]
fp.CODES = {"gcse16-geography-b": ("1gb0", "1gb0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"(1gb0)[-_ ]?(\d{2})(?!\d)", re.I)
_get = fp.get


def get(url, binary=False):
    if not binary:
        return _get(url)
    r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", fp.UA, url], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


fp.get = get

if __name__ == "__main__":
    fp.main()
