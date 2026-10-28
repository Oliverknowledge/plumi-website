"""Add the older OCR Computer Science series, from Physics & Maths Tutor, to the OCR bank's work dir.

    python3 scripts/question-bank/computer_science/fetch_pmt_ocr_cs.py [work-dir]   # default scripts/question-bank/.work/ocr-cs

OCR publishes A-Level (H446) from November 2021 and AS (H046) from June 2022 only; the
earlier series are on Teach Cambridge, its teacher login. The founder asked for them
(27 October 2026) from Physics & Maths Tutor, for the question bank only (not the past
paper library): A-Level June 2017-2019 and November 2020, AS June 2016-2019 and November
2020, each question paper with its mark scheme, and the two examiners' reports PMT has.

Run after fetch_ocr_cs.py, which rewrites manifest.json: this downloads PMT's copies to
<work-dir>/pdf/ under fetch_ocr_cs.py's names (h446-01-qp-jun17.pdf) and adds them to the
manifest in its shape, with `source` the PMT link. A series OCR itself publishes is never
taken from PMT. Polite: one request at a time, cached.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-cs")
PDF = os.path.join(WORK, "pdf")
PAGES = {"ocr-paper-1": ("H446", "01"), "ocr-paper-2": ("H446", "02"), "ocr-paper-1-as": ("H046", "01"), "ocr-paper-2-as": ("H046", "02")}
BASE = "https://www.physicsandmathstutor.com/past-papers/a-level-computer-science/"
MONTHS = {"June": "JUN", "November": "NOV"}
TITLES = {("H446", "01"): "Computer systems", ("H446", "02"): "Algorithms and programming",
          ("H046", "01"): "Computing principles", ("H046", "02"): "Algorithms and problem solving"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            time.sleep(3)
    return None


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    have = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    added = 0
    for page, (spec, num) in PAGES.items():
        html = (get(BASE + page + "/") or b"").decode("utf-8", "replace")
        for href in sorted(set(re.findall(r'href="([^"#]+\.pdf)"', html))):
            name = urllib.parse.unquote(href.rsplit("/", 1)[1])
            m = re.match(r"(June|November) (\d{4}) (QP|MS|ER)\b", name)
            if not m:
                continue  # the specimen papers
            series, kind, comp = MONTHS[m.group(1)] + m.group(2)[2:], m.group(3).lower(), f"{spec.lower()}-{num}"
            if (comp, series) in have:
                continue  # OCR's own copy is already here
            fname = f"{comp}-{kind}-{series.lower()}.pdf"
            dest = os.path.join(PDF, fname)
            if not os.path.exists(dest):
                body = get(urllib.parse.quote(href, safe=":/"))
                if not body or not body.startswith(b"%PDF"):
                    print("  failed", href, file=sys.stderr)
                    continue
                open(dest, "wb").write(body)
                time.sleep(0.5)
            manifest = [f for f in manifest if f["file"] != fname]
            manifest.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": TITLES[(spec, num)] if kind == "qp" else "",
                             "source": href, "file": fname, "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf", "bytes": os.path.getsize(dest)})
            added += 1
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{added} files from PMT; manifest now {len(manifest)}", file=sys.stderr)


if __name__ == "__main__":
    main()
