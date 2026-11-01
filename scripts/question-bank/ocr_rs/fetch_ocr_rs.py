"""Fetch OCR's own A-Level Religious Studies (H573) papers.

    python3 scripts/question-bank/ocr_rs/fetch_ocr_rs.py [work-dir]   # default scripts/question-bank/.work/ocr-rs

The past paper library has no Religious Studies, so this reads OCR's assessment page itself with
computer_science/fetch_ocr_cs.py's reader, as ocr_law/fetch_ocr_law.py does. Keeps the question
papers, mark schemes and examiners' reports of H573/01 (philosophy of religion), H573/02 (religion
and ethics) and H573/03-07 (developments in Christian, Islamic, Jewish, Buddhist and Hindu thought:
a student sits one of them). Modified papers (zips), the sample assessment materials and the AS
(H173) are left out.

The A-Level was first sat in June 2018, but OCR's page lists November 2021 and June 2022 on; the
earlier question papers are on Teach Cambridge (OCR's teacher login) only, and never fetched.
Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and
<work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key the bank uploads each whole
paper to (ocr/OCR-H573-01-QP-JUN24.pdf, the library's naming). Downloads run in threads.

A file is kept only if it names its own component ("H573/02") on its first pages: OCR's link for
the June 2024 H573/02 examiners' report is the AS report (H173/02, "AS Level Religious Studies -
H173/02 - Summer 2024"), on another paper's questions, so it is left out.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-rs"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/religious-studies-h173-h573-from-2016/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {f"H573/0{n}" for n in range(1, 8)}
KIND = {"question paper": "qp", "mark scheme": "ms", "examiners' report": "er"}
MONTHS = {"june": "JUN", "november": "NOV"}


def download(f):
    dest = os.path.join(PDF, f["file"])
    if not os.path.exists(dest):
        body = get(f["source"], binary=True)
        if not body or not body.startswith(b"%PDF"):
            print("  failed", f["source"], file=sys.stderr)
            return None
        open(dest, "wb").write(body)
        time.sleep(0.3)
    return {**f, "bytes": os.path.getsize(dest)}


def main():
    os.makedirs(PDF, exist_ok=True)
    page = get(PAGE)
    if not page:
        sys.exit(f"could not fetch {PAGE}")
    want, headings = [], set()
    for r in listing(page):
        if r["tab"] != "A Level" or r["section"] != "Question papers, mark schemes and reports":
            continue
        headings.add(r["series"])
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        head, _, title = r["title"].partition(" - ")
        kind = KIND.get(head.strip().lower())
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        comp = f"{spec.lower()}-{num}"
        if any(w["file"] == f"{comp}-{kind}-{series.lower()}.pdf" for w in want):
            continue  # listed twice (June 2023 H573/06's report, the same file under two addresses): the first is kept
        want.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": title.strip() if kind == "qp" else "",
                     "source": SITE + r["href"] if r["href"].startswith("/") else r["href"],
                     "file": f"{comp}-{kind}-{series.lower()}.pdf", "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf"})
    with ThreadPoolExecutor(4) as pool:
        got = [f for f in pool.map(download, want) if f]
    out = []
    for f in got:  # read one at a time: PyMuPDF isn't thread-safe
        doc = pymupdf.open(os.path.join(PDF, f["file"]))
        codes = set(re.findall(r"H[15]73/0\d", " ".join(doc[i].get_text() for i in range(min(4, len(doc))))))
        own = f"{f['spec']}/{f['component'][-2:]}"
        if own in codes or not codes:
            out.append(f)
        else:
            print(f"  left out {f['file']}: it is {', '.join(sorted(codes))}'s", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
