"""Fetch OCR's own GCSE Computer Science (J277) papers.

    python3 scripts/question-bank/ocr_gcse_cs/fetch_ocr_gcse_cs.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-cs

computer_science/fetch_ocr_cs.py for the GCSE: the same reader of OCR's assessment page (its
accordions "Question papers, mark schemes and reports" > "2025 - June series"), used here as a
library. Keeps J277/01 and J277/02's question papers, mark schemes and examiners' reports, June
2022 (J277's first exams) on, and the sample assessment materials (series "SPEC"): one PDF per
paper, its question paper and then its mark scheme, split here at the scheme's cover (the first
page after "END OF QUESTION PAPER" dated "…day June 20XX – Morning/Afternoon"), the scheme
ending before OCR's "Summary of updates" pages. The modified papers are left out.

J277 replaced J276 (first taught 2016). OCR's J276 page no longer lists any papers (they are on
Teach Cambridge, OCR's teacher login, only), so no J276 series is fetched.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified but for that split) and
<work-dir>/manifest.json in fetch_ocr_cs.py's shape, with `r2` the key the bank uploads each whole
paper to (ocr/OCR-J277-01-QP-JUN24.pdf, the library's naming).
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-cs")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import KIND, MONTHS, SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/gcse/computer-science-j277-from-2020/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"J277/01", "J277/02"}


def main():
    os.makedirs(PDF, exist_ok=True)
    page = get(PAGE)
    if not page:
        sys.exit(f"could not fetch {PAGE}")
    out, headings = [], set()
    sams = []
    for r in listing(page):
        if r["section"] == "Sample assessment materials" and r["code"] in COMPONENTS and r["href"].lower().endswith(".pdf"):
            sams.append(r)
        if r["section"] != "Question papers, mark schemes and reports":
            continue
        headings.add(r["series"])
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        kind = KIND.get(r["title"].split(" - ")[0].strip().lower())
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        name = f"{spec.lower()}-{num}-{kind}-{series.lower()}.pdf"
        title = r["title"].split(" - ", 1)[-1] if kind == "qp" else ""
        out.append({"component": f"{spec.lower()}-{num}", "spec": spec, "kind": kind, "series": series, "title": title,
                    "source": SITE + r["href"] if r["href"].startswith("/") else r["href"], "file": name,
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
        out = [f for f in pool.map(fetch, out) if f]
    for r in sams:
        spec, num = r["code"].split("/")
        names = {k: f"{spec.lower()}-{num}-{k}-spec.pdf" for k in ("qp", "ms")}
        source = SITE + r["href"] if r["href"].startswith("/") else r["href"]
        if not all(os.path.exists(os.path.join(PDF, n)) for n in names.values()):
            body = get(source, binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", source, file=sys.stderr)
                continue
            whole = pymupdf.open(stream=body, filetype="pdf")
            end = next(i for i, pg in enumerate(whole) if "END OF QUESTION PAPER" in pg.get_text())
            cover = next(i for i in range(end + 1, len(whole)) if "Morning/Afternoon" in whole[i].get_text())
            last = next((i - 1 for i in range(cover, len(whole)) if "Summary of updates" in whole[i].get_text()), len(whole) - 1)
            for kind, (a, b) in (("qp", (0, cover - 1)), ("ms", (cover, last))):
                piece = pymupdf.open()
                piece.insert_pdf(whole, from_page=a, to_page=b)
                piece.save(os.path.join(PDF, names[kind]))
        for kind, name in names.items():
            out.append({"component": f"{spec.lower()}-{num}", "spec": spec, "kind": kind, "series": "SPEC",
                        "title": r["title"] if kind == "qp" else "", "source": source, "file": name,
                        "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-SPEC.pdf", "bytes": os.path.getsize(os.path.join(PDF, name))})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
