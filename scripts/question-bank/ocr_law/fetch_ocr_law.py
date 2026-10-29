"""Fetch OCR's own A-Level (H418) and AS (H018) Law papers.

    python3 scripts/question-bank/ocr_law/fetch_ocr_law.py [work-dir]   # default scripts/question-bank/.work/ocr-law

The past paper library has no Law, so this reads OCR's assessment page itself with
computer_science/fetch_ocr_cs.py's reader (a tab per level, accordions "Question papers, mark
schemes and reports" > "2025 - June series", each a list of /Images/<id>-<slug>.pdf links with
the component code beside them). Keeps the question papers, mark schemes and examiners' reports
of H418/01-04 and H018/01-02; modified papers (zips) and the sample assessment materials are
left out. H418/03 and /04 are the two Component 3 options (human rights, contract): a student
sits one of them.

The specification was first examined in June 2022 (AS and A-Level), and OCR lists every June
series since; there are no November series. Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf
(OCR's files, unmodified) and <work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key
the bank uploads each whole paper to (ocr/OCR-H418-01-QP-JUN24.pdf, the library's naming).
"""
import json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-law"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/law-h018-h418-from-2020/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"H418/01", "H418/02", "H418/03", "H418/04", "H018/01", "H018/02"}
KIND = {"question paper": "qp", "mark scheme": "ms", "examiners' report": "er"}
MONTHS = {"june": "JUN", "november": "NOV"}


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
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        comp = f"{spec.lower()}-{num}"
        name = f"{comp}-{kind}-{series.lower()}.pdf"
        dest = os.path.join(PDF, name)
        source = SITE + r["href"] if r["href"].startswith("/") else r["href"]
        if not os.path.exists(dest):
            body = get(source, binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", source, file=sys.stderr)
                continue
            open(dest, "wb").write(body)
            time.sleep(0.5)
        out.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": title.strip() if kind == "qp" else "",
                    "source": source, "file": name, "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf", "bytes": os.path.getsize(dest)})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: "
          + ", ".join(sorted(f"{t} {s}" for t, s in headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
