"""Fetch Pearson Edexcel's own A-Level (9EB0) Economics B papers.

    python3 scripts/question-bank/edexcel_economics_b/fetch_economics_b.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-economics-b

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the
same manifest, the same caching); this points it at Economics B. Only the A-Level
(9EB0) papers are kept: the AS (8EB0) papers are a separate qualification.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics-b")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["al15-economics-b"]
fp.CODES = {"al15-economics-b": ("8eb0", "9eb0")}
# October 2020's schemes are filed under "Mark-Scheme" in some listings.
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"(9eb0)[-_ ]?(\d{2})(?!\d)", re.I)
_listed = fp.listed
fp.listed = lambda spec: [r for r in _listed(spec) if "9eb0" in r.get("url", "").lower()]


def main():
    fp.main()
    # November 2021 had too few entries for a report: Pearson's "report" is a one-page notice saying so. Not a report, so not kept.
    import json, pymupdf
    path = os.path.join(fp.WORK, "manifest.json")
    manifest, kept = json.load(open(path)), []
    for f in manifest:
        pdf = os.path.join(fp.PDF, f["file"])
        if f["kind"] == "er" and len(pymupdf.open(pdf)) == 1 and "will not publish an Examiner" in pymupdf.open(pdf)[0].get_text():
            os.remove(pdf)
            print(f"dropped {f['file']}: no examiner's report was published", file=sys.stderr)
            continue
        kept.append(f)
    json.dump(kept, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
