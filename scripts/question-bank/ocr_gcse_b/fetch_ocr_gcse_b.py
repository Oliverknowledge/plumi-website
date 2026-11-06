"""Gather OCR's GCSE Twenty First Century Science papers (Biology B, Chemistry B, Physics B, Combined Science B) for the question bank.

    python3 scripts/question-bank/ocr_gcse_b/fetch_ocr_gcse_b.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-b

Reads each specification's assessment page on ocr.org.uk with the past paper library's own reader
(scripts/past-papers/boards/ocr.py), so the files, their series and their R2 names are the library's.
Combined Science B (J260) isn't on the library's list, so its page is added here. Keeps the question
papers, mark schemes and examiners' reports of every series from June 2018 (the first exams), and
downloads each, unmodified, to <work-dir>/pdf/<component>-<kind>-<series>.pdf, a few at a time.

Each file's `component` is the bank's paper id, which pairs a Foundation paper with the Higher paper
on the same topics (tiers.py pairs a sitting's Foundation papers with its Higher ones in the bank's order):
  J257-J259/01 Breadth Foundation -> j2571f  /02 Depth Foundation -> j2572f  /03 Breadth Higher -> j2571h  /04 Depth Higher -> j2572h
  J260/01-04 Foundation (Biology, Chemistry, Physics, Combined science) -> j260bf j260cf j260pf j260mf
  J260/05-08 Higher, the same order                                     -> j260bh j260ch j260ph j260mh
Writes <work-dir>/manifest.json in fetch_ocr.py's shape, with `r2`: the library's key for the file
(ocr/OCR-J247-01-QP-JUN24.pdf). J257-J259's are already in the bucket; J260's are uploaded by
upload_r2.py --pdf-prefix=ocr/ under the same scheme.
"""
import json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-b")
PDF = os.path.join(WORK, "pdf")
sys.path.insert(0, os.path.join(ROOT, "scripts", "past-papers", "boards"))
import ocr  # noqa: E402

SPECS = ("J257", "J258", "J259", "J260")
PAGES = [p for p in ocr.PAGES if next(iter(p["specs"])) in SPECS] + [
    dict(path="gcse/twenty-first-century-science-suite-combined-science-b-j260-from-2016", subject="gcse-combined-science", board="ocr",
         specs={"J260": "GCSE"}, label="Combined Science B")]
KINDS = ("qp", "ms", "er")
# Links that serve another sitting's file, found by reading the code and series printed inside every PDF
# (the library's own FIXES already leave out J257/04 June 2024's report).
WRONG = {"753529"}  # J260/08 June 2025 question paper link serves J260/06's (same bytes): that paper is left out
LETTER = "bcpm"  # J260's papers 1-4 and 5-8: Biology, Chemistry, Physics, Combined science


def paper_id(spec, num):
    """("J257", 3) -> "j2571h"; ("J260", 6) -> "j260ch"."""
    if spec == "J260":
        return f"j260{LETTER[(num - 1) % 4]}{'f' if num <= 4 else 'h'}"
    return f"{spec.lower()}{(num - 1) % 2 + 1}{'f' if num <= 2 else 'h'}"


def series_ok(s):
    return re.fullmatch(r"(JUN|NOV)\d\d", s) and int(s[3:]) >= 18


def main():
    os.makedirs(PDF, exist_ok=True)
    items = []
    for page in PAGES:
        got, _, _ = ocr.entries_for(page)
        items += [it for it in got if it["section"] == "current" and it["kind"] in KINDS and len(it["comps"]) == 1 and series_ok(it["series"])]
        time.sleep(1)
    out, seen = [], set()
    for it in items:
        spec, num = it["comps"][0]
        key = ocr.r2_key(it["board"], it["code"], it["kind"], it["series"])
        if key in seen or re.sub(r"^.*/(\d+)-[^/]*$", r"\1", it["source"]) in WRONG:
            continue
        seen.add(key)
        comp = paper_id(spec, int(num))
        out.append({"component": comp, "spec": spec, "code": it["code"], "kind": it["kind"], "series": it["series"],
                    "title": it["title"], "source": it["source"], "file": f"{comp}-{it['kind']}-{it['series'].lower()}.pdf", "r2": key})

    def fetch(f):
        dest = os.path.join(PDF, f["file"])
        if not os.path.exists(dest):
            body = ocr.get(f["source"], binary=True)
            if not body or not body.startswith(b"%PDF"):
                return f, False
            open(dest, "wb").write(body)
        return f, True

    with ThreadPoolExecutor(4) as pool:
        got = list(pool.map(fetch, out))
    missing = [f["source"] for f, ok in got if not ok]
    out = [dict(f, bytes=os.path.getsize(os.path.join(PDF, f["file"]))) for f, ok in got if ok]
    out.sort(key=lambda f: (f["spec"], f["code"], f["series"], f["kind"]))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; {len(missing)} couldn't be fetched", file=sys.stderr)
    for m in missing:
        print("  ", m, file=sys.stderr)


if __name__ == "__main__":
    main()
