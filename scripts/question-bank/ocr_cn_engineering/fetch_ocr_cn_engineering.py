"""Fetch OCR's own Cambridge National in Engineering Manufacture (J823) exam papers: unit R014.

    python3 scripts/question-bank/ocr_cn_engineering/fetch_ocr_cn_engineering.py [work-dir]   # default scripts/question-bank/.work/ocr-cn-engineering

ocr_gcse_cs/fetch_ocr_gcse_cs.py for J823: the same reader of OCR's assessment page, used as a library.
J823 is one exam unit, R014/01 Principles of engineering manufacture, and two NEA units (R015, R016)
with no question papers. Keeps R014/01's question papers, mark schemes and examiners' reports of every
series OCR lists ("2025 - January series" and "2025 - June series" on; first exams were 2023, but its
2023 papers are on Teach Cambridge, OCR's teacher login, only) and the sample assessment material
(series "SPEC"), one PDF of the question paper and then its mark scheme, split here at the scheme's
cover. Modified papers and the moderators' reports are left out.

J823 replaced Engineering Manufacture J832/J842 (unit R109). OCR's page for it no longer lists any papers.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified but for that split) and
<work-dir>/manifest.json in fetch_ocr_cs.py's shape, with `r2` the key each whole paper is uploaded to
(ocr/OCR-R014-01-QP-JUN24.pdf, the library's naming).
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-cn-engineering")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import KIND, MONTHS, SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/cambridge-nationals/engineering-manufacture-level-1-2-j823/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"R014/01"}
SERIES = {**MONTHS, "january": "JAN"}
REPORT_CODES = {"R014"}  # OCR lists the report under the unit, not the paper


def main():
    os.makedirs(PDF, exist_ok=True)
    page = get(PAGE)
    if not page:
        sys.exit(f"could not fetch {PAGE}")
    out, headings, sams = [], set(), []
    for r in listing(page):
        if r["section"] == "Sample assessment materials" and r["code"] == "R014" and r["title"] == "Principles of engineering manufacture":
            sams.append(r)
        if r["section"] != "Question papers, mark schemes and reports":
            continue
        headings.add(r["series"])
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        kind = KIND.get(r["title"].split(" - ")[0].strip().lower())
        code = "R014/01" if r["code"] in REPORT_CODES and kind == "er" else r["code"]
        if not s or not kind or code not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        series = SERIES[s.group(2).lower()] + s.group(1)[2:]
        spec, num = code.split("/")
        title = r["title"].split(" - ", 1)[-1] if kind == "qp" else ""
        out.append({"component": f"{spec.lower()}-{num}", "spec": spec, "kind": kind, "series": series, "title": title,
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
        out = [f for f in pool.map(fetch, out) if f]
    for r in sams:
        names = {k: f"r014-01-{k}-spec.pdf" for k in ("qp", "ms")}
        source = SITE + r["href"] if r["href"].startswith("/") else r["href"]
        if not all(os.path.exists(os.path.join(PDF, n)) for n in names.values()):
            body = get(source, binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", source, file=sys.stderr)
                continue
            whole = pymupdf.open(stream=body, filetype="pdf")
            end = next(i for i, pg in enumerate(whole) if "END OF QUESTION PAPER" in pg.get_text())
            cover = next(i for i in range(end + 1, len(whole)) if re.search(r"Mark [Ss]cheme|MARK SCHEME", whole[i].get_text()))
            for kind, (a, b) in (("qp", (0, cover - 1)), ("ms", (cover, len(whole) - 1))):
                piece = pymupdf.open()
                piece.insert_pdf(whole, from_page=a, to_page=b)
                piece.save(os.path.join(PDF, names[kind]))
        for kind, name in names.items():
            out.append({"component": "r014-01", "spec": "R014", "kind": kind, "series": "SPEC",
                        "title": r["title"] if kind == "qp" else "", "source": source, "file": name,
                        "r2": f"ocr/OCR-R014-01-{kind.upper()}-SPEC.pdf", "bytes": os.path.getsize(os.path.join(PDF, name))})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
