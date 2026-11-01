"""Fetch Pearson Edexcel's own A-Level History (9HI0) papers, June 2017 onwards.

    python3 scripts/question-bank/edexcel_history/fetch_history.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-history

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the same
manifest, the same caching); this points it at History. Every option is its own paper:
Paper 1's "9hi0-1a" to "9hi0-1h", Paper 2's "9hi0-2a" to "9hi0-2h" (each holds both of its
sub-options, 2A.1 and 2A.2) and Paper 3's "9hi0-30" to "9hi0-39". Paper 4 (coursework,
its reports only) and the AS papers (8HI0) are left out. History lists more than the
search's 1,000 records a query, so it is asked one series at a time. Each paper's Sources
or Extracts Booklet is bound in at the back of its question paper.
"""
import os, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-history")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

SERIES = ["June-2017", "June-2018", "June-2019", "October-2020", "November-2021", "June-2022",
          "June-2023", "June-2024", "June-2025", "June-2026"]
fp.SPECS = ["al15-history"]
fp.CODES = {"al15-history": ("8hi0", "9hi0")}


class Name:
    """fetch_pearson's NAME, read off the lower-cased file name, so "9HI0_1A" files as "9hi0-1a"."""
    pattern = re.compile(r"(9hi0)[-_ ]?([12][a-h]|3\d)(?![0-9a-z])")

    def search(self, name):
        return self.pattern.search(name.lower())


fp.NAME = Name()


def query(spec, series):
    types = "+OR+".join(f'category:"Pearson-UK:Document-Type/{t}"' for t in fp.DOC_TYPES)
    q = f'fq={types}&fq=category:"Pearson-UK:Specification-Code/{spec}"&fq=category:"Pearson-UK:Exam-Series/{series}"'
    body = fp.get(f"{fp.BASE}/services/pearson/algolia/GET.servlet?" + urllib.parse.quote(q, safe="=&+:"))
    return fp.json.loads(body)["searchResults"]["algoliaRecords"] if body else []


def date(r):
    m = re.search(r"(\d{8})\.pdf$", r.get("url", ""))
    return m.group(1) if m else ""


def listed(spec):
    # Copies in the teachers' area are skipped for the public ones. June 2024's Paper 2D was
    # posted twice (8 June and 2 July): the later copy wins, so it is listed first.
    records = [r for s in SERIES for r in query(spec, s) if "/secure/" not in r.get("url", "")]
    return sorted(records, key=date, reverse=True)


fp.listed = listed
_get = fp.get
cache = {}


def get(url, binary=False):
    return cache[url] if binary and url in cache else _get(url, binary)


fp.get = get


def prefetch():
    """Download the listed PDFs in threads first; fetch_pearson then reads them from memory."""
    want = []
    for r in listed(fp.SPECS[0]):
        name = os.path.basename(r["url"])
        if fp.NAME.search(name) and name.lower().endswith(".pdf"):
            want.append(fp.BASE + r["url"])
    have = set(os.listdir(fp.PDF))
    if len(have) >= 0.9 * len(want):
        return  # a re-run: only the missing few, one at a time
    with ThreadPoolExecutor(8) as pool:
        for url, body in zip(want, pool.map(lambda u: _get(u, True), want)):
            if body:
                cache[url] = body


if __name__ == "__main__":
    prefetch()
    fp.main()
