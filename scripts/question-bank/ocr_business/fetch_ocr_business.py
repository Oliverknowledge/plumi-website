"""Fetch OCR's own A-Level (H431) and AS (H031) Business papers.

    python3 scripts/question-bank/ocr_business/fetch_ocr_business.py [work-dir]   # default scripts/question-bank/.work/ocr-business

ocr_economics/fetch_ocr_economics.py for Business: the same reader of OCR's assessment page
(computer_science/fetch_ocr_cs.py), used as a library. Keeps H431/01-03 and H031/01-02: question
papers, resource booklets (the case studies the questions are set on, kind `rb`), mark schemes and
examiners' reports of every series OCR lists. That is A-Level November 2021 (no reports) and June
2022 on, AS June 2022 on (a report for June 2024 only); earlier series aren't on this page (OCR keeps them
on Teach Cambridge, its login site), and are never fetched. Modified papers (zips) and the sample assessment materials
are left out. Every file is checked for its own component code and series, as OCR's links sometimes
serve another sitting's file.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and <work-dir>/manifest.json
in fetch_ocr_cs.py's shape, with `r2` the key each whole file is uploaded to (ocr/OCR-H431-01-QP-JUN24.pdf).
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-business")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import KIND, MONTHS, SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/business-h031-h431-from-2015/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"H431/01": "Operating in a local business environment", "H431/02": "The UK business environment",
              "H431/03": "The global business environment", "H031/01": "The local business environment",
              "H031/02": "The wider business environment"}
MONTH_NAME = {"JUN": "May|June|Summer|Jun", "NOV": "October|November|December|Autumn|Nov|Oct"}


def own_file(path, f):
    """The PDF names its own component and its sitting ("H431/01", "Tuesday 16 May 2023", "Mark Scheme for Autumn 2021").
    Sequential: PyMuPDF isn't thread-safe."""
    text = " ".join(p.get_text() for p in pymupdf.open(path))
    return f["spec"] + "/" + f["component"][-2:] in re.sub(r"\s", "", text) and \
        re.search(rf"\b({MONTH_NAME[f['series'][:3]]})\s*(20)?{f['series'][3:]}\b", text)


def main():
    os.makedirs(PDF, exist_ok=True)
    page = get(PAGE)
    if not page:
        sys.exit(f"could not fetch {PAGE}")
    out, headings = [], set()
    for r in listing(page):
        if r["section"] != "Question papers, mark schemes and reports":
            continue
        headings.add((r["tab"], r["series"]))
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        head, _, title = r["title"].partition(" - ")
        kind = KIND.get(head.strip().lower())
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        if kind == "qp" and "resource booklet" in title.lower():
            kind = "rb"
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        out.append({"component": f"{spec.lower()}-{num}", "spec": spec, "kind": kind, "series": series,
                    "title": f"Paper {int(num)}: {COMPONENTS[r['code']]}" if kind == "qp" else "",
                    "source": SITE + r["href"] if r["href"].startswith("/") else r["href"],
                    "file": f"{spec.lower()}-{num}-{kind}-{series.lower()}.pdf", "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf"})

    def fetch(f):
        dest = os.path.join(PDF, f["file"])
        if not os.path.exists(dest):
            body = get(f["source"], binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", f["source"], file=sys.stderr)
                return None
            open(dest, "wb").write(body)
            time.sleep(0.3)
        return {**f, "bytes": os.path.getsize(dest)}

    with ThreadPoolExecutor(6) as pool:
        got = [f for f in pool.map(fetch, out) if f]
    out = []
    for f in got:
        if own_file(os.path.join(PDF, f["file"]), f):
            out.append(f)
        else:
            print(f"  {f['file']}: doesn't name {f['spec']}/{f['component'][-2:]} {f['series']}, left out ({f['source']})", file=sys.stderr)
    out.sort(key=lambda f: (f["component"], f["series"], f["kind"]))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: "
          + ", ".join(sorted(f"{t} {s}" for t, s in headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
