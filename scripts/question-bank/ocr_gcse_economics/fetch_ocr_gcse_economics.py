"""Fetch OCR's own GCSE (9-1) Economics (J205) papers.

    python3 scripts/question-bank/ocr_gcse_economics/fetch_ocr_gcse_economics.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-economics

ocr_economics/fetch_ocr_economics.py for the GCSE: the same reader of OCR's assessment page
(computer_science/fetch_ocr_cs.py), used as a library. Keeps J205/01 (Introduction to economics) and
J205/02 (National and international economics): question papers, mark schemes and examiners'
reports of every series OCR lists. That is November 2021 (no report) and June 2022 on; June 2019 and
November 2020 are on Teach Cambridge (OCR's teacher login) only, and never fetched. June 2022's
J205/01 has a "post exam correction" beside the paper: a notice of the correction (kept as `corr`),
not a new paper. Modified papers (zips) and the sample assessment materials are left out. Every
file is checked for its own component code and series, as OCR's links sometimes serve another
sitting's file.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and <work-dir>/manifest.json
in fetch_ocr_cs.py's shape, with `r2` the key each whole file is uploaded to (ocr/OCR-J205-01-QP-JUN24.pdf).
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-economics")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import KIND, MONTHS, SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/gcse/economics-j205-from-2017/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"J205/01": "Introduction to economics", "J205/02": "National and international economics"}
MONTH_NAME = {"JUN": "May|June|Summer|Jun", "NOV": "October|November|December|Autumn|Nov"}


def own_file(path, f):
    """The PDF names its own component and its sitting ("J205/01", "Tuesday 16 May 2023", "Mark Scheme for Autumn 2021").
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
        headings.add(r["series"])
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        head, _, title = r["title"].partition(" - ")
        kind = KIND.get(head.strip().lower())
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        if "post exam correction" in title.lower():
            kind = "corr"
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
        if f["kind"] == "corr" or own_file(os.path.join(PDF, f["file"]), f):
            out.append(f)
        else:
            print(f"  {f['file']}: doesn't name {f['spec']}/{f['component'][-2:]} {f['series']}, left out ({f['source']})", file=sys.stderr)
    out.sort(key=lambda f: (f["component"], f["series"], f["kind"]))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
