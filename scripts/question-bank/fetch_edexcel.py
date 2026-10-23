"""Fetch Pearson Edexcel A-Level Maths and Further Maths papers, from Pearson.

    python3 scripts/question-bank/fetch_edexcel.py [work-dir]   # default scripts/question-bank/.work-edexcel

Pearson's course-materials pages read their file list from a public Algolia
index (the same search key every visitor's browser uses). This asks it for each
specification code and keeps the exam materials:

  9MA0 A-Level Maths and 8MA0 AS (first sat 2018), 9FM0 A-Level Further Maths
  (2019) and 8FM0 AS (2018). The legacy modules they replaced (C1-C4, FP1-3,
  M1-5, S1-4, D1-2) are left out on purpose: the bank covers the current
  specifications only. Add their codes to LEGACY to bring them back.

Downloads question papers ("que"), mark schemes ("rms", or "msc" for some
autumn series) and examiner reports ("pef"), unmodified, to
<work-dir>/pdf/EDX-<component>-<KIND>-<SERIES>.pdf, and writes
<work-dir>/manifest.json in the same shape as fetch_aqa.py's. Polite and cached.
"""
import json, os, re, sys, time, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work-edexcel")
PDF = os.path.join(WORK, "pdf")
os.makedirs(PDF, exist_ok=True)

ALGOLIA = "https://l639t95u5a-dsn.algolia.net/1/indexes/qualifications-uk_LIVE_master-content/query"
HEADERS = {"X-Algolia-Application-Id": "L639T95U5A", "X-Algolia-API-Key": "f79c7a8352e9ffbdaec387bf43612ee6", "Content-Type": "application/json"}
SITE = "https://qualifications.pearson.com"

CURRENT = ["9MA0", "8MA0", "9FM0", "8FM0"]
# Legacy GCE modules: code -> short name. Pearson publishes June 2015-2019.
# Legacy GCE modules (6663 C1 ... 6690 D2) work with this pipeline but aren't in the bank: current specs only.
LEGACY: dict[str, str] = {}
KINDS = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}
NAME = re.compile(r"/([0-9a-z]{4})[-_]([0-9a-z]{2})[-_](que|rms|msc|pef)[-_](\d{8})[^/]*\.pdf$", re.I)


def search(code):
    hits, page = [], 0
    while True:
        body = json.dumps({"params": f"query={code}&hitsPerPage=1000&page={page}"}).encode()
        with urllib.request.urlopen(urllib.request.Request(ALGOLIA, data=body, headers=HEADERS), timeout=60) as r:
            d = json.load(r)
        hits += d["hits"]
        page += 1
        if page >= d.get("nbPages", 1):
            return hits


def series_of(date):
    """A file's date to the sitting it belongs to: summer papers and their August
    schemes are June; October/November papers and their December schemes are NOV."""
    year, month = int(date[:4]), int(date[4:6])
    return ("JUN" if month <= 9 else "NOV") + str(year)[2:], year


def main():
    files = {}
    for code in CURRENT + list(LEGACY):
        for h in search(code):
            url = h.get("url", "")
            m = NAME.search(url)
            if not m or "exam-materials" not in url.lower():
                continue
            spec, comp, kind, date = m.group(1).upper(), m.group(2).upper(), m.group(3).lower(), m.group(4)
            if spec != code:
                continue
            series, year = series_of(date)
            if year < 2015 or year > 2030 or (spec in LEGACY and year > 2019):  # 2030: a mistyped date in Pearson's index
                continue
            component = spec if spec in LEGACY else f"{spec}-{comp}"
            slot = (component, KINDS[kind], series)
            # Prefer the "rms" scheme over an "msc" one for the same sitting.
            if slot in files and kind == "msc":
                continue
            files[slot] = {"component": component, "spec": spec, "kind": KINDS[kind], "series": series,
                           "title": h.get("title", ""), "source": SITE + url}
        time.sleep(0.5)
    print(f"{len(files)} files listed", file=sys.stderr)
    manifest = []
    for (comp, kind, series), f in sorted(files.items()):
        out = os.path.join(PDF, f"EDX-{comp}-{kind.upper()}-{series}.pdf")
        if not os.path.exists(out):
            req = urllib.request.Request(f["source"], headers={"User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=90) as r:
                    body = r.read()
            except Exception as e:  # noqa: BLE001
                print("  failed", f["source"], e, file=sys.stderr)
                continue
            if not body.startswith(b"%PDF"):
                print("  not a pdf", f["source"], file=sys.stderr)
                continue
            with open(out, "wb") as fh:
                fh.write(body)
            time.sleep(0.4)
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)


if __name__ == "__main__":
    main()
