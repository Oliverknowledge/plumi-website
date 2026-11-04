"""Gather Pearson Edexcel's International A Level Mathematics and Further Mathematics unit papers, from Pearson's own site.

    python3 scripts/question-bank/edexcel_ial_maths/fetch_ial_maths.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-ial-maths

The 2018 specification (YMA01 Maths, YFM01 Further Maths; first exams 2019) is sat unit by unit, each unit its own
paper: Pure P1-P4 (WMA11-WMA14), Further Pure FP1-FP3 (WFM01-WFM03), Mechanics M1-M3 (WME01-WME03), Statistics
S1-S3 (WST01-WST03) and Decision D1 (WDM11). The FP, M and S codes are the 2013 specification's too, so only files
Pearson's index files under the 2018 specification ("ial18-mathematics") are kept.

Asks Pearson's public search index (scripts/past-papers/boards/edexcel.py's) for each unit, keeps question papers,
mark schemes and examiner's reports, and leaves out what Pearson keeps for teachers ("/secure/": January 2026 on).
Since 2024 some series sat a second paper in another time zone ("01A", "01R"): the same unit's own series with
the letter ("JUN25A"), so each unit stays one paper. Pearson's file names carry a date, not a series (a scheme is
dated the day results came out), so the series is the one the index files each under ("Exam-Series/October-2021").

Writes <work-dir>/pdf/<unit>-<kind>-<series>.pdf ("wma11-qp-jun19.pdf") and <work-dir>/manifest.json in
fetch_igcse_maths.py's shape: component ("WMA11"), spec, kind (qp, ms, er), series, title, source, file, bytes.
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "past-papers", "boards"))
from edexcel import ALGOLIA, HEADERS, SITE, UA  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "edexcel-ial-maths")
PDF = os.path.join(WORK, "pdf")
UNITS = ["WMA11", "WMA12", "WMA13", "WMA14", "WFM01", "WFM02", "WFM03", "WME01", "WME02", "WME03",
         "WST01", "WST02", "WST03", "WDM11"]
NAME = re.compile(r"/(w[a-z]{2}\d\d)[-_]+01([ar]?)[-_]+(que|rms|msc|mcs|pef)[-_]+(\d{7,9})([^/]*)\.pdf$", re.I)
# Named off-pattern: January 2020's P3 paper is "Question-paper-Unit-3-WMA13- January-2020.pdf".
LOOSE = re.compile(r"/Question-paper-Unit-\d-(W[A-Z]{2}\d\d)-[^/]*\.pdf$", re.I)
KINDS = {"que": "qp", "rms": "ms", "msc": "ms", "mcs": "ms", "pef": "er"}
MONTHS = {"January": "JAN", "June": "JUN", "October": "OCT", "November": "NOV"}


def curl(url, dest=None, data=None):
    cmd = ["curl", "-sSfL", "--retry", "3", "-A", UA, url]
    if data:
        cmd += ["-X", "POST", "-d", data] + [x for k, v in HEADERS.items() for x in ("-H", f"{k}: {v}")]
    if dest:
        cmd += ["-o", dest]
    out = subprocess.run(cmd, capture_output=True, timeout=300)
    return out.stdout if out.returncode == 0 else None


def listing():
    """{(unit, kind, series): [(rank, url, title)]} for every public 2018-specification file."""
    found = {}
    for unit in UNITS:
        hits, page = [], 0
        while True:
            d = json.loads(curl(ALGOLIA, data=json.dumps({"params": f"query={unit}&hitsPerPage=1000&page={page}"})))
            hits += d["hits"]
            page += 1
            if page >= d.get("nbPages", 1):
                break
        for h in hits:
            url, cats = h.get("url", ""), h.get("category", [])
            m = NAME.search(url)
            if m:
                code, letter, raw, date, rest = m.group(1).upper(), m.group(2).upper(), m.group(3).lower(), m.group(4), m.group(5)
            elif LOOSE.search(url):
                code, letter, raw, date, rest = LOOSE.search(url).group(1).upper(), "", "que", "0", ""
            else:
                continue
            if code != unit or "exam-materials" not in url.lower() or "/secure/" in url.lower():
                continue
            if not any(c.endswith("/ial18-mathematics") for c in cats):
                continue
            series = next((c.split("/")[-1] for c in cats if c.startswith("Pearson-UK:Exam-Series/")), "")
            mon, _, year = series.partition("-")
            if mon not in MONTHS or not year.isdigit() or int(year) < 2019:
                continue
            # An "-updated" file over the first one, an "rms" scheme over an "msc" one, then the newest.
            rank = ("updated" in rest.lower(), raw != "msc", date)
            slot = (unit, KINDS[raw], f"{MONTHS[mon]}{year[2:]}{letter}")
            found.setdefault(slot, []).append((rank, SITE + url, h.get("title", "")))
    return found


def main():
    os.makedirs(PDF, exist_ok=True)
    found = listing()
    picks = {slot: max(v) for slot, v in found.items()}

    def fetch(item):
        (unit, kind, series), (_, url, _) = item
        dest = os.path.join(PDF, f"{unit.lower()}-{kind}-{series.lower()}.pdf")
        if not os.path.exists(dest):
            if curl(url.replace(" ", "%20"), dest) is None or open(dest, "rb").read(4) != b"%PDF":
                if os.path.exists(dest):
                    os.remove(dest)
                return None
        return dest

    items = sorted(picks.items())
    # Four at a time: Pearson's file server is slow per file, not busy.
    with ThreadPoolExecutor(max_workers=4) as pool:
        got = list(pool.map(fetch, items))
    manifest, missing = [], []
    for ((unit, kind, series), (_, url, title)), dest in zip(items, got):
        if not dest:
            missing.append(url)
            continue
        manifest.append({"component": unit, "spec": unit, "kind": kind, "series": series, "title": title, "source": url,
                         "file": os.path.basename(dest), "bytes": os.path.getsize(dest)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    sets = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    print(f"{len(manifest)} files, {len(sets)} papers, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    for m in missing:
        print("  not fetched:", m, file=sys.stderr)


if __name__ == "__main__":
    main()
