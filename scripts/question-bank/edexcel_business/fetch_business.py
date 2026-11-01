"""Fetch Pearson Edexcel's own A-Level (9BS0) Business papers.

    python3 scripts/question-bank/edexcel_business/fetch_business.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-business

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Business. Only the A-Level
(9BS0) papers are kept: the AS (8BS0) papers are a separate qualification.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-business")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["al15-business"]
fp.CODES = {"al15-business": ("8bs0", "9bs0")}
fp.NAME = re.compile(r"(9bs0)[-_ ]?(\d{2})(?!\d)", re.I)
_listed = fp.listed
fp.listed = lambda spec: [r for r in _listed(spec) if "9bs0" in r.get("url", "").lower()]

if __name__ == "__main__":
    fp.main()
