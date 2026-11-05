"""Fetch OCR's own GCSE (9-1) Design and Technology (J310) papers.

    python3 scripts/question-bank/ocr_gcse_dt/fetch_ocr_gcse_dt.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-dt

ocr_gcse_classics/fetch_ocr_gcse_classics.py for J310: the same reader of OCR's assessment page. J310 has one
written paper, J310/01 Principles of design and technology (the other components are non-exam assessment).
Keeps its question paper, insert ("ins": the context material some questions refer to), mark scheme and
examiners' report of every series OCR lists: November 2021 (no report) and June 2022 to June 2025. June 2026
isn't published on OCR's site (checked 5 November 2026). June 2018, June 2019 and November 2020 are on Teach
Cambridge (OCR's teacher login) only. Modified papers (zips) and the sample assessment materials are left out.
Every file is checked for its own component code and series, as OCR's links sometimes serve another sitting's file.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and <work-dir>/manifest.json,
with `r2` the key each whole file is uploaded to (ocr/OCR-J310-01-QP-JUN24.pdf).
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-dt")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import KIND, MONTHS, SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/gcse/design-and-technology-j310-from-2017/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"J310/01"}
# How a file names its sitting: a June paper is sat from May, November 2021's ran into December, schemes and reports
# call the series "Summer" or "Autumn", and a page's footer says "J310/23 Oct21".
MONTH_NAME = {"JUN": "May|June|Summer|Jun", "NOV": "October|November|December|Autumn|Nov|Oct"}


def kind_of(title):
    if re.search(r"\binsert$", title, re.I):
        return "ins"
    if re.search(r"erratum", title, re.I):
        return "err"
    return KIND.get(title.split(" - ")[0].strip().lower())


def own_file(path, f):
    """The PDF names its own component and its sitting ("J310/21", "Monday 22 May 2023", "Mark Scheme for Autumn 2021").
    Read anywhere in it. Sequential: PyMuPDF isn't thread-safe."""
    text = " ".join(p.get_text() for p in pymupdf.open(path))
    year = f["series"][3:]
    return f["spec"] + "/" + f["component"][-2:] in re.sub(r"\s", "", text) and \
        re.search(rf"\b({MONTH_NAME[f['series'][:3]]})\s*(20)?{year}\b", text)


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
        kind = kind_of(r["title"])
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        name = f"{spec.lower()}-{num}-{kind}-{series.lower()}.pdf"
        title = r["title"].split(" - ", 1)[-1] if kind == "qp" else ""
        href = r["href"] if r["href"].startswith(("/", "http")) else "/Images/" + r["href"]
        out.append({"component": f"{spec.lower()}-{num}", "spec": spec, "kind": kind, "series": series, "title": title,
                    "source": SITE + href if href.startswith("/") else href, "file": name,
                    "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf"})

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
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
