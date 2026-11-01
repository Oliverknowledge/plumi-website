"""Fetch OCR's own A-Level Psychology (H567) papers, or, with --sociology, Sociology (H580).

    python3 scripts/question-bank/ocr_psychology/fetch_ocr_psychology.py [work-dir]               # .work/ocr-psychology
    python3 scripts/question-bank/ocr_psychology/fetch_ocr_psychology.py --sociology [work-dir]   # .work/ocr-sociology

ocr_law/fetch_ocr_law.py's sibling: OCR's assessment page, read with computer_science/fetch_ocr_cs.py's
reader, accordions "Question papers, mark schemes and reports" > "2025 - June series". Keeps the A-Level
tab's question papers, mark schemes and examiners' reports of components 01-03; the AS (H167, H180),
modified papers (zips), the sample assessment materials and November 2021 H567/02's "post exam
correction" notice (the paper beside it is the paper) are left out.

OCR lists November 2021 and every June from 2022; the series before (2017 to 2020) are on Teach
Cambridge, OCR's teacher login, only, and never fetched. November 2021 has no examiners' reports.
Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and
<work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key the bank uploads each whole paper
to (ocr/OCR-H567-01-QP-JUN24.pdf, the library's naming). Downloads run in threads.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
SOC = "--sociology" in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0] if ARGS else os.path.join(HERE, "..", ".work", "ocr-sociology" if SOC else "ocr-psychology"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

SPEC = "H580" if SOC else "H567"
PAGE = f"{SITE}/qualifications/as-and-a-level/" + ("sociology-h180-h580-from-2015" if SOC else "psychology-h167-h567-from-2015") + "/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {f"{SPEC}/0{n}" for n in (1, 2, 3)}
KIND = {"question paper": "qp", "mark scheme": "ms", "examiners' report": "er"}
MONTHS = {"june": "JUN", "november": "NOV"}


def download(job):
    source, dest = job
    if os.path.exists(dest):
        return True
    body = get(source, binary=True)
    if not body or not body.startswith(b"%PDF"):
        print("  failed", source, file=sys.stderr)
        return False
    open(dest, "wb").write(body)
    time.sleep(0.3)
    return True


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
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf") or "correction" in title.lower():
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        num = r["code"].split("/")[1]
        name = f"{SPEC.lower()}-{num}-{kind}-{series.lower()}.pdf"
        source = SITE + r["href"] if r["href"].startswith("/") else r["href"]
        want.append(({"component": f"{SPEC.lower()}-{num}", "spec": SPEC, "kind": kind, "series": series,
                      "title": title.strip() if kind == "qp" else "", "source": source, "file": name,
                      "r2": f"ocr/OCR-{SPEC}-{num}-{kind.upper()}-{series}.pdf"}, os.path.join(PDF, name)))
    with ThreadPoolExecutor(6) as pool:
        ok = list(pool.map(download, [(f["source"], dest) for f, dest in want]))
    out = [{**f, "bytes": os.path.getsize(dest)} for (f, dest), good in zip(want, ok) if good]
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
