"""Fetch OCR's own A-Level History A (H505) papers.

    python3 scripts/question-bank/ocr_history/fetch_ocr_history.py [work-dir]   # default scripts/question-bank/.work/ocr-history

The past paper library has no History, so this reads OCR's assessment page itself with
computer_science/fetch_ocr_cs.py's reader, as ocr_law/fetch_ocr_law.py does. History A is a paper
per unit: Unit 1, the British period study and enquiry (Y101-Y113), Unit 2, the non-British period
study (Y201-Y224), and Unit 3, the thematic study and historical interpretations (Y301-Y321); a
student sits one of each. Keeps the question papers, mark schemes and examiners' reports of every
unit; the topic-based essay (Y100, the NEA, with reports only), the modified papers (zips) and the
sample assessment materials are left out, and so is the AS (H105), which has its own units.

OCR lists November 2021 and June 2022 on; earlier series are on Teach Cambridge (OCR's teacher
login) only. OCR lists no papers for Y211. A file that doesn't name its own unit on its first pages is
left out: OCR's June 2025 Y314 question paper link serves a Y303 mark scheme, and its Y222 mark
scheme link Y221's. A file listed twice for one slot is placed by the series it prints (OCR lists
Y105's June 2025 report under June 2024 as well). Writes
<work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and <work-dir>/manifest.json
in fetch_ocr.py's shape, with `r2` the key the bank uploads each whole paper to
(ocr/OCR-Y101-01-QP-JUN24.pdf, the library's naming). Downloads in threads.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-history"))
sys.path.insert(0, os.path.join(HERE, "..", "computer_science"))
from fetch_ocr_cs import SITE, get, listing  # noqa: E402

PAGE = f"{SITE}/qualifications/as-and-a-level/history-a-h105-h505-from-2015/assessment/"
PDF = os.path.join(WORK, "pdf")
UNIT = re.compile(r"Y[123]\d\d/01")
KIND = {"question paper": "qp", "mark scheme": "ms", "examiners' report": "er"}
MONTHS = {"june": "JUN", "november": "NOV"}


def download(f):
    dest = os.path.join(PDF, f["file"])
    if not os.path.exists(dest):
        body = get(f["source"], binary=True)
        if not body or not body.startswith(b"%PDF"):
            print("  failed", f["source"], file=sys.stderr)
            return None
        open(dest, "wb").write(body)
        time.sleep(0.3)
    return {**f, "bytes": os.path.getsize(dest)}


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
        if not s or not kind or not UNIT.fullmatch(r["code"]) or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        comp = f"{spec.lower()}-{num}"
        want.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": title.strip() if kind == "qp" else "",
                     "source": SITE + r["href"] if r["href"].startswith("/") else r["href"], "file": f"{comp}-{kind}-{series.lower()}.pdf",
                     "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf"})
    # A file listed twice for one slot (Y105's June 2025 report is listed under June 2024 too) is
    # fetched under a name of its own, and placed by the series it prints.
    names = [f["file"] for f in want]
    for n, f in enumerate(want):
        if f["file"] in names[:n]:
            f["file"] = f["file"].replace(".pdf", f"-{re.search(r'/Images/(\d+)', f['source']).group(1)}.pdf")
    with ThreadPoolExecutor(6) as pool:
        got = [f for f in pool.map(download, want) if f]
    out, taken = [], {(f["component"], f["kind"], f["series"]) for f in got if not re.search(r"-\d+\.pdf$", f["file"])}
    for f in got:  # (read one at a time: PyMuPDF isn't thread-safe)
        doc = pymupdf.open(os.path.join(PDF, f["file"]))
        text = " ".join(doc[i].get_text() for i in range(min(3, len(doc))))
        if f["spec"] not in text:
            print(f"  not {f['spec']}'s: {f['source']} (listed as {f['spec']} {f['kind']} {f['series']})", file=sys.stderr)
            continue
        if re.search(r"-\d+\.pdf$", f["file"]):
            said = {("JUN" if m.group(1) in ("Summer", "June") else "NOV") + m.group(2)[2:]
                    for m in re.finditer(r"\b(Summer|June|Autumn|November) (20\d\d)\b", text)}
            series = said.pop() if len(said) == 1 else None
            if not series or (f["component"], f["kind"], series) in taken:
                print(f"  listed twice, left out: {f['source']} (listed as {f['spec']} {f['kind']} {f['series']})", file=sys.stderr)
                continue
            name = f"{f['component']}-{f['kind']}-{series.lower()}.pdf"
            os.replace(os.path.join(PDF, f["file"]), os.path.join(PDF, name))
            print(f"  listed as {f['series']}, is {series}: {f['source']}", file=sys.stderr)
            spec, num = f["component"].upper().split("-")
            f = {**f, "series": series, "file": name, "r2": f"ocr/OCR-{spec}-{num}-{f['kind'].upper()}-{series}.pdf"}
            taken.add((f["component"], f["kind"], series))
        out.append(f)
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: " + ", ".join(sorted(headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
