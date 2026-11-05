"""Fetch OCR's own A-Level (H555) Physical Education written papers.

    python3 scripts/question-bank/ocr_pe/fetch_ocr_pe.py [work-dir]   # default scripts/question-bank/.work/ocr-pe

The past paper library has no Physical Education, so this reads OCR's assessment page itself with
computer_science/fetch_ocr_cs.py's reader. Keeps the question papers, mark schemes and examiners'
reports of H555/01 (Physiological factors), /02 (Psychological factors) and /03 (Socio-cultural
issues). The practical performance and the evaluating/analysing components (H555/05, /06) have no
paper, and modified papers (zips) are left out. OCR also publishes AS (H155/01-02, June 2022 to
2025); this bank doesn't use them.

OCR publishes A-Level November 2021 (no examiners' report) and June 2022 to June 2025. Writes
<work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and <work-dir>/manifest.json
in fetch_ocr.py's shape, with `r2` the key the bank uploads each whole paper to.
"""
import json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-pe"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/physical-education-h155-h555-from-2016/assessment/"
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"H555/01", "H555/02", "H555/03"}
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
        if r["tab"] != "A Level" or not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
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
