"""Fetch Pearson Edexcel's own A-Level (9ET0) and AS (8ET0) English Literature papers.

    python3 scripts/question-bank/edexcel_english_lit/fetch_english_lit.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-english-lit

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the same
manifest, the same caching); this points it at English Literature ("al15-eng-lit"). The
A-Level was first sat in June 2017 and the AS in June 2016; June 2020 and 2021 were
cancelled, and October 2020 and November 2021 sat in their place. Component 4 is the
coursework, with a report but no paper, so it is left out, as are the International
A-Level's papers (WET01) that share the listing and June 2026, which Pearson keeps for
teachers. Each file is also given `r2`, the key the past paper library and the bank share
(edexcel/EDX-9ET0-01-QP-JUN24.pdf).

Paper 3's source booklet (the unseen poem, the anthology poems its questions name and the lists of
prescribed poems) is bound in at the back of its question paper. It is split out as the paper's
insert, "9et0-03-ins-jun24.pdf" (kind "ins"), from the page that says "Do not return this Booklet".
October 2020's AS reports are a page saying Pearson won't publish one (too few entries): they are left out.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-english-lit")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

fp.SPECS = ["al15-eng-lit"]
fp.CODES = {"al15-eng-lit": ("8et0", "9et0")}
# October 2020's schemes are filed under a capitalised type.
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"([89]et0)[-_ ]?(0[123])(?!\d)", re.I)
_listed = fp.listed


def listed(spec):
    # June 2018's Paper 2 is listed twice ("9ET0-02-June-2018.pdf" beside the dated "9ET0_02_que_20180613.pdf"),
    # and its Paper 3 report twice ("9ET0_03_PEF_V3_final.pdf"): the dated copy is the one in Pearson's naming.
    # Component 4's reports are titled "Paper 4", "Non-examination assessment" or "Moderator Report".
    return [r for r in _listed(spec) if "/secure/" not in r.get("url", "")
            and not re.search(r"-June-2018\.pdf$|_PEF_V3_final\.pdf$|[-_]04[-_]", r.get("url", ""))
            and not re.search(r"Paper 4|Non-examination|Moderator", r.get("title", ""))]


fp.listed = listed


def split_booklets(files):
    """Paper 3's source booklets, as inserts of their own."""
    import pymupdf  # noqa: PLC0415

    for f in [f for f in files if f["component"] == "9et0-03" and f["kind"] == "qp"]:
        doc = pymupdf.open(os.path.join(fp.PDF, f["file"]))
        start = next((pg for pg in range(1, len(doc)) if re.search(r"Do not return this (Source )?Booklet", doc[pg].get_text(), re.I)), None)
        if start is None:
            print(f"  no source booklet in {f['file']}", file=sys.stderr)
            continue
        name = f["file"].replace("-qp-", "-ins-")
        out = pymupdf.open()
        out.insert_pdf(doc, from_page=start, to_page=len(doc) - 1)
        out.save(os.path.join(fp.PDF, name), garbage=3, deflate=True)
        files.append({**f, "kind": "ins", "title": f["title"].replace("Question paper", "Source booklet"), "file": name,
                      "bytes": os.path.getsize(os.path.join(fp.PDF, name)), "pages": f"{start + 1}-{len(doc)}"})


def unpublished(f):
    """A report that only says there is no report."""
    import pymupdf  # noqa: PLC0415

    return f["kind"] == "er" and "will not publish an Examiner" in re.sub(r"\s+", " ", pymupdf.open(os.path.join(fp.PDF, f["file"]))[0].get_text())


def main():
    fp.main()
    path = os.path.join(fp.WORK, "manifest.json")
    files = [f for f in json.load(open(path)) if not unpublished(f)]
    split_booklets(files)
    for f in files:
        spec, num = f["component"].split("-")
        f["r2"] = f"edexcel/EDX-{spec.upper()}-{num}-{f['kind'].upper()}-{f['series']}.pdf"
    json.dump(files, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
