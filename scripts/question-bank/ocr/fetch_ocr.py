"""Gather OCR's A-Level science and maths papers for the question bank.

    python3 scripts/question-bank/ocr/fetch_ocr.py [--from=<past-papers ocr work dir>] [work-dir]
    python3 scripts/question-bank/ocr/fetch_ocr.py --maths [...]
    # default work dir: scripts/question-bank/.work/ocr-sciences (with --maths, .work/ocr-maths)
    # default --from:   scripts/past-papers/.work/ocr (written by scripts/past-papers/boards/ocr.py)

The past paper library's OCR fetcher already downloads every OCR paper from
ocr.org.uk, unmodified, with a manifest. This reads that manifest, keeps the
question papers, mark schemes, examiner's reports and inserts of the three A science
specifications, or with --maths of OCR A and OCR MEI Maths and Further Maths (and
their AS papers), and copies each PDF to
<work-dir>/pdf/<component>-<kind>-<series>.pdf. A file the library hasn't got
locally is downloaded from the same ocr.org.uk address.

Writes <work-dir>/manifest.json in fetch_pearson.py's shape, plus `r2`: the
library's key for the same file (ocr/OCR-H432-01-QP-JUN24.pdf), already in the
bucket, so the bank links to it rather than storing a second copy.
"""
import json, os, re, shutil, sys, time, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MATHS = "--maths" in sys.argv
SOURCE = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--from=")), os.path.join(ROOT, "scripts", "past-papers", ".work", "ocr"))
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "ocr-maths" if MATHS else "ocr-sciences")
PDF = os.path.join(WORK, "pdf")
SPECS = ("H420", "H020", "H432", "H032", "H556", "H156")
# The library's group for each maths specification, and the bank its papers go in.
MATHS_BANKS = {"A-Level (H240)": "ocr-a-level-maths", "AS (H230)": "ocr-a-level-maths",
               "A-Level (H245)": "ocr-a-level-further-maths", "AS (H235)": "ocr-a-level-further-maths",
               "A-Level (H640)": "ocr-mei-a-level-maths", "AS (H630)": "ocr-mei-a-level-maths",
               "A-Level (H645)": "ocr-mei-a-level-further-maths", "AS (H635)": "ocr-mei-a-level-further-maths"}
KINDS = ("qp", "ms", "er", "ins")


def main():
    os.makedirs(PDF, exist_ok=True)
    library = json.load(open(os.path.join(SOURCE, "manifest.json")))
    out, missing = [], 0
    for f in library:
        spec, _, num = f["code"].partition("/")
        if (f["group"] not in MATHS_BANKS if MATHS else spec not in SPECS) or not num \
                or f["kind"] not in KINDS or not re.fullmatch(r"(JUN|NOV)\d\d", f["series"]) or "legacy" in f["group"]:
            continue
        comp = f"{spec.lower()}-{num}"
        name = f"{comp}-{f['kind']}-{f['series'].lower()}.pdf"
        dest = os.path.join(PDF, name)
        if not os.path.exists(dest):
            local = os.path.join(SOURCE, "pdf", os.path.basename(f["file"]))
            if os.path.exists(local):
                shutil.copyfile(local, dest)
            else:
                req = urllib.request.Request(f["source"], headers={"User-Agent": UA})
                try:
                    body = urllib.request.urlopen(req, timeout=60).read()
                except Exception:  # noqa: BLE001
                    body = b""
                if not body.startswith(b"%PDF"):
                    missing += 1
                    continue
                open(dest, "wb").write(body)
                time.sleep(0.5)
        out.append({"component": comp, "spec": spec, "kind": f["kind"], "series": f["series"], "title": f["paper"],
                    "source": f["source"], "file": name, "r2": f["file"], "bytes": os.path.getsize(dest),
                    **({"bank": MATHS_BANKS[f["group"]], "as": f["group"].startswith("AS")} if MATHS else {})})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; {missing} couldn't be fetched", file=sys.stderr)


if __name__ == "__main__":
    main()
