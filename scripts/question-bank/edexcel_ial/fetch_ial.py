"""Fetch Pearson Edexcel's own International A Level Biology, Chemistry and Physics papers.

    python3 scripts/question-bank/edexcel_ial/fetch_ial.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-ial

The International A Levels are sat unit by unit, six a subject: WBI11-WBI16, WCH11-WCH16,
WPH11-WPH16 (units 1 to 3 are the International AS). This lists their exam materials through
the same search index as the past paper library (scripts/past-papers/boards/edexcel.py):
question papers ("que"), mark schemes ("rms", "msc") and examiner's reports ("pef"). Pearson
keeps its latest series for teachers only, so those come back as a page and are skipped.

Pearson's file names carry a date, not a series, and the dates mislead (January's papers are
dated the day results came out, in March), so each file's series is read off its own cover, as
edexcel_igcse/fetch_igcse.py does: "Mark Scheme (Results) January 2022", "Principal Examiner
Feedback October 2021", "Summer 2019", a paper's "Tuesday 10 January 2022". Some sittings also
have a second paper sat in other time zones, "01R" (and, from October 2025, "01A"): each is its
own series here ("JUN24R"), so the paper filter stays Unit 1 to Unit 6. The papers printed for
May/June 2020, which was cancelled, were sat in October 2020, so they are October 2020's.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("wch12-01-qp-jun24r.pdf") and
<work-dir>/manifest.json in fetch_pearson.py's shape. Downloads four at a time (Pearson's file
server is slow per file), reads the covers one at a time (PyMuPDF isn't thread-safe). Cached.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-ial")
sys.path.insert(0, os.path.join(HERE, "..", "..", "past-papers", "boards"))
import edexcel as library  # noqa: E402  (search() and get(): Pearson's index and file server)

PDF = os.path.join(WORK, "pdf")
RAW = os.path.join(WORK, "raw")  # every file as Pearson names it
SPECS = tuple(f"W{s}1{n}" for s in ("BI", "CH", "PH") for n in "123456")
MONTHS = {"January": "JAN", "May": "JUN", "June": "JUN", "Summer": "JUN", "October": "OCT"}
NAMED = re.compile(r"\b(January|May|June|Summer|October)\s+(20[12]\d)\b")


def listed():
    """[(spec, variant, kind, raw kind, date, url)] for every exam-materials PDF of the eighteen units."""
    out = set()
    for spec in SPECS:
        for h in library.search(spec):
            url = h.get("url", "")
            m = library.NAME.search(url)
            if not m or "exam-materials" not in url.lower() or m.group(1).upper() != spec:
                continue
            comp, raw, date = m.group(2).upper(), m.group(3).lower(), m.group(4)
            c = re.fullmatch(r"01([AR]?)", comp)
            if c and int(date[:4]) >= 2019:
                out.add((spec, c.group(1), library.KINDS[raw], raw, date, library.SITE + url))
        time.sleep(0.4)
    return sorted(out)


def fetch(row):
    *_, url = row
    path = os.path.join(RAW, os.path.basename(url))
    if not os.path.exists(path):
        body = library.get(url)
        if not body or not body.startswith(b"%PDF"):
            return None
        open(path, "wb").write(body)
        time.sleep(0.3)
    return path


def series_of(path, kind, date):
    """The sitting a file belongs to, from its cover."""
    doc = pymupdf.open(path)
    text = re.sub(r"\s+", " ", " ".join(doc[i].get_text() for i in range(min(2, len(doc)))))
    m = NAMED.search(text)
    if m:
        series = MONTHS[m.group(1)] + m.group(2)[2:]
        # The papers printed for May/June 2020, which was cancelled, were sat in October 2020.
        return "OCT20" if series == "JUN20" else series
    mon, year = int(date[4:6]), int(date[2:4])
    if kind == "qp":  # a cover without a date: the file's own month (January's are dated March, results day)
        return ("JAN" if mon <= 3 else "JUN" if mon <= 8 else "OCT") + f"{year:02d}"
    # a cover that doesn't read: results day, January for October's, March for January's, August for June's
    return "OCT" + f"{year - 1:02d}" if mon <= 1 else ("JAN" if mon <= 4 else "JUN" if mon <= 9 else "OCT") + f"{year:02d}"


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    rows = listed()
    print(f"{len(rows)} files listed", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=4) as pool:
        paths = list(pool.map(fetch, rows))
    slots, restricted = {}, []
    for row, path in zip(rows, paths):
        spec, variant, kind, raw, date, url = row
        name = f"{spec}/01{variant} {kind} {date}"
        if not path:
            restricted.append(name)
            continue
        series = series_of(path, kind, date)
        slot = (f"{spec.lower()}-01", kind, series + variant)
        if slot in slots and (raw == "msc" and slots[slot][4] != "msc" or slots[slot][1] > date):
            continue  # an "rms" scheme over an "msc" one, and the latest reissue
        slots[slot] = (path, date, url, os.path.basename(url), raw)
    manifest = []
    for (comp, kind, series), (path, date, url, pname, _) in sorted(slots.items()):
        out = os.path.join(PDF, f"{comp}-{kind}-{series.lower()}.pdf")
        if not os.path.exists(out) or os.path.getsize(out) != os.path.getsize(path):
            open(out, "wb").write(open(path, "rb").read())
        variant = series[5:]
        manifest.append({"component": comp, "spec": comp[:5].upper(), "kind": kind, "series": series,
                         "title": f"International A Level {comp[:5].upper()}/01{variant}",
                         "source": url, "pearsonName": pname, "file": os.path.basename(out), "bytes": os.path.getsize(out)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    print(f"not public ({len(restricted)}): " + "; ".join(restricted), file=sys.stderr)


if __name__ == "__main__":
    main()
