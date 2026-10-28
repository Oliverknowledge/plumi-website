"""Fetch OCR's own A-Level (H460) and AS (H060) Economics papers.

    python3 scripts/question-bank/ocr_economics/fetch_ocr_economics.py [work-dir]   # default scripts/question-bank/.work/ocr-economics

The past paper library has no Economics, so this reads OCR's assessment page itself
with computer_science/fetch_ocr_cs.py's reader (the same page layout: a tab per level,
accordions "Question papers, mark schemes and reports" > "2025 - June series", each a
list of /Images/<id>-<slug>.pdf links with the component code beside them). Keeps the
question papers, mark schemes and examiners' reports of H460/01-03 and H060/01-02;
modified papers (zips) and the sample assessment materials are left out.

OCR publishes A-Level November 2021 and June 2022 on, and AS June 2022 on; the earlier
series are on Teach Cambridge (OCR's teacher login) only, and never fetched. Two details
of OCR's listing:
  - November 2021's mark schemes are listed under "H460/01/02/03": the title
    ("Mark scheme - Microeconomics") says which paper each is;
  - June 2022's H460/02 and /03 each have a "post exam correction" beside the paper. It is a
    notice of the correction (kept as `corr` in the manifest for the docs), not a new paper.
Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and
<work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key the bank uploads
each whole paper to (ocr/OCR-H460-01-QP-JUN24.pdf, the library's naming).
"""
import json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-economics"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/economics-h060-h460-from-2019/assessment/"
PDF = os.path.join(WORK, "pdf")
PAPERS = {"H460": {"Microeconomics": "01", "Macroeconomics": "02", "Themes in economics": "03"},
          "H060": {"Microeconomics": "01", "Macroeconomics": "02"}}
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
        spec = r["code"][:4]
        correction = "post exam correction" in title.lower()
        title = re.sub(r"\s*post exam correction$", "", title, flags=re.I).strip()
        num = next((n for t, n in PAPERS.get(spec, {}).items() if t.lower() == title.lower()), None)
        if not s or not kind or not num or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        comp = f"{spec.lower()}-{num}"
        kind = "corr" if correction else kind
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
        out.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": f"Paper {int(num)}: {title}" if kind == "qp" else "",
                    "source": source, "file": name, "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf", "bytes": os.path.getsize(dest)})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: "
          + ", ".join(sorted(f"{t} {s}" for t, s in headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
