"""Fetch Pearson Edexcel's own GCSE (9-1) Religious Studies A (1RA0) and B (1RB0) papers.

    python3 scripts/question-bank/edexcel_gcse_rs/fetch_gcse_rs.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-rs

edexcel_sciences/fetch_pearson.py does the work, pointed at Pearson's search codes "gcse16-rs-a" and
"gcse16-rs-b". Every option is a paper of its own: 1RA0's 1A to 1C, 2A to 2G, 3A to 3C and 4A and 4B;
1RB0's 1A to 1G, 2A to 2G and 3A to 3G. The Short Courses (3RA0, 3RB0) are left out. Downloads go through
curl in a few threads (Pearson's server drops long downloads part way under urllib), and the most
recent series comes back as a page, not a PDF, so it is skipped by fetch_pearson as teachers only.
"""
import os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["gcse16-rs-a", "gcse16-rs-b"]
fp.CODES = {"gcse16-rs-a": ("1ra0", "1ra0"), "gcse16-rs-b": ("1rb0", "1rb0")}
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
# 1RA0_1A_que_20180516.pdf, 1rb0-2f-rms-20220825.pdf
_NAME = re.compile(r"(1r[ab]0)[-_ ]?([1-4][a-g])(?![0-9a-z])", re.I)


class _Named:
    """A file name's code and option, lower case."""

    def __init__(self, m):
        self.m = m

    def group(self, n):
        return self.m.group(n).lower()


class _Name:
    def search(self, name):
        m = _NAME.search(name)
        return _Named(m) if m else None


fp.NAME = _Name()
CACHE = os.path.join(fp.WORK, "download")
_get = fp.get


def quoted(url):
    return url.replace(" ", "%20")


def curl(url):
    out = os.path.join(CACHE, os.path.basename(url))
    if not os.path.exists(out):
        r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", fp.UA, "-o", out + ".part", quoted(url)], capture_output=True)
        if r.returncode == 0 and os.path.exists(out + ".part"):
            os.replace(out + ".part", out)
    return out


def get(url, binary=False):
    if not binary:
        return _get(url)
    out = curl(url)
    return open(out, "rb").read() if os.path.exists(out) else None


def public(r):
    """A record whose file came down as a PDF: Pearson lists some files twice, once for teachers only."""
    out = os.path.join(CACHE, os.path.basename(r.get("url", "")))
    return os.path.exists(out) and open(out, "rb").read(4) == b"%PDF"


def main():
    os.makedirs(CACHE, exist_ok=True)
    listed = {spec: fp.listed(spec) for spec in fp.SPECS}
    urls = {fp.BASE + r["url"] for records in listed.values() for r in records
            if r.get("url", "").lower().endswith(".pdf") and _NAME.search(os.path.basename(r["url"]))}
    with ThreadPoolExecutor(6) as pool:
        list(pool.map(curl, sorted(urls)))
    fp.listed = lambda spec: sorted(listed[spec], key=lambda r: not public(r))
    fp.get = get
    fp.main()


if __name__ == "__main__":
    main()
