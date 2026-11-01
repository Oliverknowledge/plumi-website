"""Fetch Pearson Edexcel's own GCSE English Language (1EN0) and English Literature (1ET0) papers.

    python3 scripts/question-bank/edexcel_gcse_english/fetch_english.py lang [work-dir]   # default .work/edexcel-gcse-english-lang
    python3 scripts/question-bank/edexcel_gcse_english/fetch_english.py lit [work-dir]    # default .work/edexcel-gcse-english-lit

edexcel_sciences/fetch_pearson.py does the work (Pearson's past paper search, the same manifest, the same
caching), as for the A-Level (edexcel_english_lit/fetch_english_lit.py); this points it at the GCSEs
("gcse15-englang", "gcse15-englit"). Both were first sat in June 2017. Pearson keeps November 2025 and June 2026
for teachers, so both run to June 2025. Language is sat every June and
November; Literature only in June, with November 2020 and 2021 sat in place of the cancelled summers.
In November 2021 and June 2022 Literature's Paper 2 was sat as two papers, 2N (the novel) and 2P (poetry).
Left out: Language's Spoken Language Endorsement (a report, no paper), the June 2018 and November 2018
"updated" zips and the June 2022 and November 2021 papers reprinted "Reflecting September 2022 format
updates" (the same questions), and Pearson's 2024 SAM scheme. Each file is also given `r2`, the key the
past paper library and the bank share (edexcel/EDX-1EN0-01-QP-JUN24.pdf).

The texts the questions are on are printed in the question paper. Language's are in a Source Booklet bound
in at the back (from its cover, "Do not return this Reading Text Insert" or the like): it is split out as the paper's
insert, "1en0-01-ins-jun24.pdf" (kind "ins"), which each reading question links to. Until June 2018 it was bound in front
of the paper instead (booklet_pages). The Pearson file itself, booklet and all, stays the question paper.
"""
import json, os, re, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
LIT = len(sys.argv) > 1 and sys.argv[1] == "lit"
args = sys.argv[2:]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-english-lit" if LIT else "edexcel-gcse-english-lang")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import fetch_pearson as fp  # noqa: E402

SPEC = "gcse15-englit" if LIT else "gcse15-englang"
fp.SPECS = [SPEC]
fp.CODES = {SPEC: ("1et0", "1et0") if LIT else ("1en0", "1en0")}
# Some schemes are filed under a capitalised type.
fp.DOC_TYPES = {**fp.DOC_TYPES, "Mark-Scheme": "ms"}
fp.NAME = re.compile(r"(1et0)[-_ ]?(0[12]|2[np])(?![\da-z])" if LIT else r"(1en0)[-_ ]?(0[12])(?!\d)", re.I)
# A booklet's cover: "Do not return this Reading Text Insert", "Insert Booklet", "Source Booklet", or the barcode alone
# with no page number after it ("*P74796RA*", where a page of the paper is "*P74796RA0120*"). The paper's own cover asks for
# the candidate's number; the booklet's doesn't.
COVER = re.compile(r"Do not return (this|the)\b|Insert Booklet|Source Booklet|^\*P\d{5}[A-Z]{0,2}\*$", re.I | re.M)
PAPER_COVER = re.compile(r"Candidate Number|Centre Number")
_listed = fp.listed
_get = fp.get


def get(url, binary=False):
    """fetch_pearson's get, for Pearson's older paths, which have spaces in them ("English Language/2015/"). Files
    are fetched with curl: urllib gets IncompleteRead on Pearson's bigger ones (edexcel_gcse's finding)."""
    url = urllib.parse.quote(url, safe=":/?=&%+")
    if not binary:
        return _get(url)
    r = subprocess.run(["curl", "-sfL", "--retry", "3", "-A", fp.UA, url], capture_output=True)
    return r.stdout if r.returncode == 0 else None


fp.get = get


def listed(spec):
    return [r for r in _listed(spec) if "/secure/" not in r.get("url", "").lower() and r.get("url", "").lower().endswith(".pdf")
            and "format updates" not in r.get("title", "")]


fp.listed = listed


def booklet_pages(doc):
    """(first, last + 1) of the source booklet bound into a Language paper, or None. From June 2018's Paper 1 (and
    November 2018's Paper 2) it is bound in at the back; before that, in front of the paper."""
    for i in range(len(doc)):
        t = doc[i].get_text()
        if COVER.search(t) and not PAPER_COVER.search(t):
            end = next((j for j in range(i + 1, len(doc)) if PAPER_COVER.search(doc[j].get_text())), len(doc))
            return i, end
    return None


def split_booklets(files):
    """Language's source booklets, as inserts of their own."""
    import pymupdf  # noqa: PLC0415

    for f in [f for f in files if f["kind"] == "qp"]:
        doc = pymupdf.open(os.path.join(fp.PDF, f["file"]))
        span = booklet_pages(doc)
        if span is None:
            print(f"  no source booklet in {f['file']}", file=sys.stderr)
            continue
        name = f["file"].replace("-qp-", "-ins-")
        out = pymupdf.open()
        out.insert_pdf(doc, from_page=span[0], to_page=span[1] - 1)
        out.save(os.path.join(fp.PDF, name), garbage=3, deflate=True)
        files.append({**f, "kind": "ins", "title": f["title"].replace("Question paper", "Source booklet"), "file": name,
                      "bytes": os.path.getsize(os.path.join(fp.PDF, name)), "pages": f"{span[0] + 1}-{span[1]}"})


def main():
    fp.main()
    path = os.path.join(fp.WORK, "manifest.json")
    files = [f for f in json.load(open(path)) if f["kind"] != "ins"]
    if not LIT:
        split_booklets(files)
    for f in files:
        spec, num = f["component"].split("-")
        f["r2"] = f"edexcel/EDX-{spec.upper()}-{num.upper()}-{f['kind'].upper()}-{f['series']}.pdf"
    json.dump(files, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
