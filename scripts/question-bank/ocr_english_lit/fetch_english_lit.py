"""Fetch OCR's own A-Level (H472) and AS (H072) English Literature papers.

    python3 scripts/question-bank/ocr_english_lit/fetch_english_lit.py [work-dir]   # default scripts/question-bank/.work/ocr-english-lit

Reads OCR's assessment page with computer_science/fetch_ocr_cs.py's reader (a tab per level,
accordions "Question papers, mark schemes and reports" > "2025 - June series", each a list of
/Images/<id>-<slug>.pdf links with the component code beside them). Keeps the question papers,
mark schemes and examiners' reports of H472/01-02 and H072/01-02; modified papers (zips), the
sample assessment materials and Component 3 (H472/03, the coursework: a report, no paper) are
left out.

OCR publishes November 2021 (A-Level only) and every June series from 2022. Writes
<work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and
<work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key the past paper library and
the bank share (ocr/OCR-H472-01-QP-JUN24.pdf).
"""
import json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-english-lit"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/english-literature-h072-h472-from-2015/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"H472/01", "H472/02", "H072/01", "H072/02"}
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
