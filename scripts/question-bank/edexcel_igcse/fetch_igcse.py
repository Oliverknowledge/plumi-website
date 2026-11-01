"""Fetch Pearson Edexcel's own International GCSE Biology, Chemistry and Physics papers.

    python3 scripts/question-bank/edexcel_igcse/fetch_igcse.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-igcse

Lists 4BI1, 4CH1 and 4PH1's exam materials through the same search index as the past paper
library (scripts/past-papers/boards/edexcel.py): question papers ("que"), mark schemes ("rms",
"msc") and examiner's reports ("pef"). Pearson keeps its latest series for teachers only, so
those come back as a page and are skipped.

Pearson's file names carry a date, not a series, and the dates mislead: January 2020's papers
are dated the day results came out (March), and a November scheme comes out in the January
after it. So each file's series is read off its own cover: "Mark Scheme (Results) January 2022",
"Principal Examiner Feedback November 2021", "Summer 2019", a paper's "Tuesday 10 January 2022"
(or, where the cover prints no date, the month its file name gives). The papers printed for May 2020
were sat in November 2020, so they are November 2020's. Each paper also comes in an "R" version
(4BI1/1BR), a different paper sat in other time zones; it is its own series here ("JUN24R"), as
Cambridge's second variant is ("JUN24V2"), so the paper filter stays Paper 1 and Paper 2.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("4bi1-1b-qp-jun24r.pdf") and
<work-dir>/manifest.json in fetch_pearson.py's shape. Downloads four at a time (Pearson's file
server is slow per file), reads the covers one at a time (PyMuPDF isn't thread-safe). Cached.
"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse")
sys.path.insert(0, os.path.join(HERE, "..", "..", "past-papers", "boards"))
import edexcel as library  # noqa: E402  (search() and get(): Pearson's index and file server)

PDF = os.path.join(WORK, "pdf")
RAW = os.path.join(WORK, "raw")  # every file as Pearson names it
SPECS = ("4BI1", "4CH1", "4PH1")
MONTHS = {"January": "JAN", "May": "JUN", "June": "JUN", "Summer": "JUN", "November": "NOV"}
NAMED = re.compile(r"\b(January|May|June|Summer|November)\s+(20[12]\d)\b")


def listed():
    """[(spec, paper, R, kind, raw kind, date, url)] for every exam-materials PDF of 4BI1, 4CH1, 4PH1."""
    out = set()
    for spec in SPECS:
        for h in library.search(spec):
            url = h.get("url", "")
            m = library.NAME.search(url)
            if not m or "exam-materials" not in url.lower() or m.group(1).upper() != spec:
                continue
            comp, raw, date = m.group(2).upper(), m.group(3).lower(), m.group(4)
            c = re.fullmatch(r"([12])[BCP](R?)", comp)
            if c and int(date[:4]) >= 2019:
                out.add((spec, c.group(1), c.group(2), library.KINDS[raw], raw, date, library.SITE + url))
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
        # May 2020's papers weren't sat until November 2020, the series their schemes and reports name.
        return "NOV20" if series == "JUN20" else series
    mon, year = int(date[4:6]), int(date[2:4])
    if kind == "qp":  # a cover without a date: the file's own month (January's are dated March, results day;
        return ("JAN" if mon <= 3 else "JUN" if mon <= 8 else "NOV") + f"{year:02d}"  # Summer 2021's, assessment materials, April)
    # a cover that doesn't read (one report's font has no text): results day, January for November, March for January
    return "NOV" + f"{year - 1:02d}" if mon == 1 else ("JAN" if mon <= 3 else "JUN") + f"{year:02d}"


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    rows = listed()
    print(f"{len(rows)} files listed", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=4) as pool:
        paths = list(pool.map(fetch, rows))
    slots, restricted, unread = {}, [], []
    for row, path in zip(rows, paths):
        spec, paper, r, kind, raw, date, url = row
        name = f"{spec}/{paper}{spec[1]}{r} {kind} {date}"
        if not path:
            restricted.append(name)
            continue
        series = series_of(path, kind, date)
        if not series:
            unread.append(name)
            continue
        slot = (f"{spec.lower()}-{paper}{spec[1].lower()}", kind, series + r)
        if slot in slots and (raw == "msc" or slots[slot][1] > date):
            continue  # an "rms" scheme over an "msc" one, and the latest reissue
        slots[slot] = (path, date, url, os.path.basename(url))
    manifest = []
    for (comp, kind, series), (path, date, url, pname) in sorted(slots.items()):
        out = os.path.join(PDF, f"{comp}-{kind}-{series.lower()}.pdf")
        if not os.path.exists(out) or os.path.getsize(out) != os.path.getsize(path):
            open(out, "wb").write(open(path, "rb").read())
        manifest.append({"component": comp, "spec": comp[:4].upper(), "kind": kind, "series": series,
                         "title": f"International GCSE {comp[:4].upper()}/{comp[5:].upper()}{'R' if series.endswith('R') else ''}",
                         "source": url, "pearsonName": pname, "file": os.path.basename(out), "bytes": os.path.getsize(out)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    print(f"not public ({len(restricted)}): " + "; ".join(restricted), file=sys.stderr)
    if unread:
        print(f"no series on the cover ({len(unread)}): " + "; ".join(unread), file=sys.stderr)


if __name__ == "__main__":
    main()
