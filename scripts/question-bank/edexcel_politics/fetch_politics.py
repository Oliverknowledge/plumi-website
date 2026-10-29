"""Fetch Pearson Edexcel's own A-Level (9PL0) and AS (8PL0) Politics papers, 2019 to 2025.

    python3 scripts/question-bank/edexcel_politics/fetch_politics.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-politics

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Politics. Paper 3 is two papers,
3A (USA) and 3B (Global), so their components are "9pl0-3a" and "9pl0-3b". The bank
covers 2019 to 2025: AS June 2018 (AS's first sitting) and June 2026 are left out, and
copies in Pearson's teachers-only area are skipped for the public ones.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-politics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

YEARS = range(2019, 2026)
fp.SPECS = ["al17-politics"]
fp.CODES = {"al17-politics": ("8pl0", "9pl0")}
# June 2022's Paper 3A scheme and June 2026's 3B report are filed under capitalised types.
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms", "Examiner-Report": "er"}


class Name:
    """fetch_pearson's NAME, read off the lower-cased file name, so "9PL0_3A" files as "9pl0-3a"."""
    pattern = re.compile(r"([89]pl0)[-_ ]?(0[12]|3[ab])(?![0-9a-z])")

    def search(self, name):
        return self.pattern.search(name.lower())


fp.NAME = Name()
_listed = fp.listed


def listed(spec):
    def year(r):
        s = next((c.split("/")[-1] for c in r.get("category", []) if c.startswith("Pearson-UK:Exam-Series/")), "")
        return int(s.split("-")[-1]) if re.fullmatch(r"\w+-\d{4}", s) else 0
    # June 2024's Paper 1 report is listed twice, first from the teachers' area: the public copy wins.
    return [r for r in _listed(spec) if year(r) in YEARS and "/secure/" not in r.get("url", "")]


fp.listed = listed

if __name__ == "__main__":
    fp.main()
