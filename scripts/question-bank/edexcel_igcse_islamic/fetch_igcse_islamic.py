"""Fetch Pearson Edexcel's own International GCSE Islamic Studies (4IS1) papers.

    python3 scripts/question-bank/edexcel_igcse_islamic/fetch_igcse_islamic.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-igcse-islamic

4IS1 is one paper, 4IS1/01. Lists its exam materials through Pearson's public search index (the past
paper library's, scripts/past-papers/boards/edexcel.py): question papers ("que"), mark schemes ("rms",
"msc") and examiner's reports ("pef"), from June 2019 (the specification's first sitting) on. What
Pearson keeps for teachers ("/secure/": June 2026 on) is left out. Each file's series is the one the
index files it under ("Pearson-UK:Exam-Series/November-2020"), not its date: November 2020's scheme is
dated February 2021. June 2021 is Pearson's assessment materials for the year exams were cancelled.

Writes <work-dir>/pdf/4is1-01-<kind>-<series>.pdf and <work-dir>/manifest.json in fetch_igcse.py's
shape. Downloads four at a time; nothing here opens a PDF. Cached.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse-islamic")
sys.path.insert(0, os.path.join(HERE, "..", "..", "past-papers", "boards"))
import edexcel as library  # noqa: E402  (search() and get(): Pearson's index and file server)

PDF = os.path.join(WORK, "pdf")
RAW = os.path.join(WORK, "raw")
NAME = re.compile(r"/4is1[-_]+(01r?)[-_]+(que|rms|msc|pef)[-_]+(\d{8})[^/]*\.pdf$", re.I)
MONTHS = {"January": "JAN", "June": "JUN", "November": "NOV"}


def listed():
    """{url: (component, kind, raw kind, date, series)} for every public 4IS1 exam-materials PDF."""
    out = {}
    for query in ("4IS1", "islamic-studies"):
        for h in library.search(query):
            url = h.get("url", "")
            m = NAME.search(url)
            if not m or "exam-materials" not in url.lower() or "/secure/" in url.lower() or int(m.group(3)[:4]) < 2019:
                continue
            series = next((c.split("/")[-1] for c in h.get("category", []) if c.startswith("Pearson-UK:Exam-Series/")), "")
            mon, _, year = series.partition("-")
            if mon in MONTHS and year.isdigit():
                out[library.SITE + url] = (m.group(1).lower(), library.KINDS[m.group(2).lower()], m.group(2).lower(), m.group(3),
                                           MONTHS[mon] + year[2:] + ("R" if m.group(1).lower().endswith("r") else ""))
        time.sleep(0.4)
    return out


def fetch(url):
    path = os.path.join(RAW, os.path.basename(url))
    if not os.path.exists(path):
        body = library.get(url)
        if not body or not body.startswith(b"%PDF"):
            return None
        open(path, "wb").write(body)
        time.sleep(0.3)
    return path


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    rows = listed()
    urls = sorted(rows)
    with ThreadPoolExecutor(max_workers=4) as pool:
        paths = list(pool.map(fetch, urls))
    slots, failed = {}, []
    for url, path in zip(urls, paths):
        comp, kind, raw, date, series = rows[url]
        if not path:
            failed.append(os.path.basename(url))
            continue
        slot = (kind, series)
        if slot in slots and (raw == "msc" or slots[slot][1] > date):
            continue  # an "rms" scheme over an "msc" one, and the latest reissue
        slots[slot] = (path, date, url)
    manifest = []
    for (kind, series), (path, date, url) in sorted(slots.items()):
        out = os.path.join(PDF, f"4is1-01-{kind}-{series.lower()}.pdf")
        if not os.path.exists(out) or os.path.getsize(out) != os.path.getsize(path):
            open(out, "wb").write(open(path, "rb").read())
        manifest.append({"component": "4is1-01", "spec": "4IS1", "kind": kind, "series": series, "title": "International GCSE 4IS1/01",
                         "source": url, "pearsonName": os.path.basename(url), "file": os.path.basename(out), "bytes": os.path.getsize(out)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    for s in sorted({f["series"] for f in manifest}):
        print(f"   {s}: " + " ".join(sorted(f["kind"] for f in manifest if f["series"] == s)), file=sys.stderr)
    if failed:
        print(f"listed but not downloadable ({len(failed)}): " + "; ".join(failed), file=sys.stderr)


if __name__ == "__main__":
    main()
