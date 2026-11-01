"""Fetch Pearson Edexcel's own GCSE (9-1) History (1HI0) papers.

    python3 scripts/question-bank/edexcel_gcse_history/fetch_gcse_history.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-history

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the same
manifest, the same caching), pointed at History ("gcse16-history"). Every option is a
paper of its own, with its own code:
  - Paper 1, the thematic study and historic environment: 10 to 13 (13, Migrants, from 2022);
  - Paper 2, the period study P1 to P5 and the British depth study B1 to B4. June 2018 set
    both studies in one paper, 20 to 29, one per pair of options; from 2019 each is its own;
  - Paper 3, the modern depth study: 30 to 33.
November 2021 and June 2022 were set as 1HIA (the same options, with the choice of topics
Pearson gave that year): filed under 1hi0 with the rest, so a student's filter finds them.

The Sources/Interpretations Booklet of Papers 1 and 3 (and 2018's Paper 2) is bound into the
question paper, so there is nothing else to fetch. The files are listed by the search one
at a time, then downloaded with curl in a few threads (Pearson's server drops long
downloads part way under urllib: edexcel_gcse/fetch_gcse.py's finding). June 2026 is for
teachers only.
"""
import os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-history")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["gcse16-history"]
fp.CODES = {"gcse16-history": ("1hi0", "1hi0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
# 1HI0_10_que_20180605.pdf, 1hia-b1-que-20220617.pdf, 1HI0_P3_rms_...
_NAME = re.compile(r"(1hi[0a])[-_ ]?(\d{2}|[pb][1-5])(?![0-9a-z])", re.I)


class _Named:
    """A file name's code as one spec, "1hi0", and a lower-case option, "p3"."""

    def __init__(self, m):
        self.m = m

    def group(self, n):
        return "1hi0" if n == 1 else self.m.group(n).lower()


class _Name:
    def search(self, name):
        m = _NAME.search(name)
        return _Named(m) if m else None


fp.NAME = _Name()
CACHE = os.path.join(fp.WORK, "download")
_get = fp.get


def curl(url):
    out = os.path.join(CACHE, os.path.basename(url))
    if not os.path.exists(out):
        r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", fp.UA, "-o", out + ".part", url], capture_output=True)
        if r.returncode == 0 and os.path.exists(out + ".part"):
            os.replace(out + ".part", out)
    return out


def get(url, binary=False):
    if not binary:
        return _get(url)
    out = curl(url)
    return open(out, "rb").read() if os.path.exists(out) else None


def public(r):
    """A record whose file came down as a PDF: November 2021's schemes are listed twice, once for teachers only."""
    out = os.path.join(CACHE, os.path.basename(r.get("url", "")))
    return os.path.exists(out) and open(out, "rb").read(4) == b"%PDF"


def main():
    os.makedirs(CACHE, exist_ok=True)
    listed = {spec: fp.listed(spec) for spec in fp.SPECS}
    urls = {fp.BASE + r["url"] for records in listed.values() for r in records
            if r.get("url", "").lower().endswith(".pdf") and _NAME.search(os.path.basename(r["url"]))}
    with ThreadPoolExecutor(6) as pool:
        list(pool.map(curl, sorted(urls)))
    # fetch_pearson keeps the first record for each slot: put the public copy first.
    fp.listed = lambda spec: sorted(listed[spec], key=lambda r: not public(r))
    fp.get = get
    fp.main()


if __name__ == "__main__":
    main()
