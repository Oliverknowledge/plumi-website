"""Gather OCR's GCSE Gateway science papers (Biology A, Chemistry A, Physics A, Combined Science A) for the question bank.

    python3 scripts/question-bank/ocr_gcse/fetch_ocr_gcse.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse

Reads each specification's assessment page on ocr.org.uk with the past paper library's own reader
(scripts/past-papers/boards/ocr.py), so the files, their series and their R2 names are the library's.
Combined Science A (J250) isn't on the library's list, so its page is added here. Keeps the question
papers, mark schemes and examiners' reports of every series from June 2018 (the first exams), and
downloads each, unmodified, to <work-dir>/pdf/<component>-<kind>-<series>.pdf, a few at a time.

Each file's `component` is the bank's paper id, which pairs a Foundation paper with the Higher paper
on the same topics (tiers.py reads the pair as the id less its last letter):
  J247/01 Paper 1 Foundation  -> j2471f      J247/03 Paper 3 Higher -> j2471h
  J247/02 Paper 2 Foundation  -> j2472f      J247/04 Paper 4 Higher -> j2472h
  J250/01-06 Foundation (two each of Biology, Chemistry, Physics) -> j250b1f … j250p2f
  J250/07-12 Higher, the same order                                 -> j250b1h … j250p2h
Writes <work-dir>/manifest.json in fetch_ocr.py's shape, with `r2`: the library's key for the file
(ocr/OCR-J247-01-QP-JUN24.pdf). J247-J249's are already in the bucket; J250's are uploaded by
upload_r2.py --pdf-prefix=ocr/ under the same scheme.
"""
import json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse")
PDF = os.path.join(WORK, "pdf")
sys.path.insert(0, os.path.join(ROOT, "scripts", "past-papers", "boards"))
import ocr  # noqa: E402

SPECS = ("J247", "J248", "J249", "J250")
PAGES = [p for p in ocr.PAGES if next(iter(p["specs"])) in SPECS] + [
    dict(path="gcse/gateway-science-suite-combined-science-a-j250-from-2016", subject="gcse-combined-science", board="ocr",
         specs={"J250": "GCSE"}, label="Combined Science A")]
KINDS = ("qp", "ms", "er")
# Links that serve another sitting's file, found by reading the code and series printed inside every PDF.
WRONG = {"727476",  # J247/02 June 2024 examiners' report link serves the Summer 2023 report
         "650822"}  # J249/03 November 2020 examiners' report link serves the Summer 2018 report
SCIENCE = "bbccpp"  # J250's papers 1-6 and 7-12: Biology, Biology, Chemistry, Chemistry, Physics, Physics


def paper_id(spec, num):
    """("J247", 3) -> "j2471h"; ("J250", 9) -> "j250c1h"."""
    if spec == "J250":
        n = (num - 1) % 6
        return f"j250{SCIENCE[n]}{n % 2 + 1}{'f' if num <= 6 else 'h'}"
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
