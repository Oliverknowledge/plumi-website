"""Gather Pearson Edexcel's International GCSE Mathematics A (4MA1) papers, both tiers, from Pearson's own site.

    python3 scripts/question-bank/edexcel_igcse_maths/fetch_igcse_maths.py [--from=<past-papers work dir>] [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-igcse-maths
    # default --from:   scripts/past-papers/.work (the library's crawl of the boards' own sites)

Asks Pearson's public search index (scripts/past-papers/boards/edexcel.py's) for every 4MA1 exam-materials
PDF, keeps Papers 1F, 2F, 1H and 2H from January 2019 on, and leaves out what Pearson keeps for teachers
("/secure/": November 2025 on). Most January and June series also sat a second set of papers in another
time zone, "1HR", "2FR": the same paper's own series with an "R" ("JUN23R"), so the bank's papers stay four.

Pearson's file names carry a date, not a series (a scheme is dated the day results came out, sometimes two
months on, and November 2020 sat the papers printed for the cancelled May 2020), so the series is the one
Pearson's index files each under ("Pearson-UK:Exam-Series/November-2021"). A couple of files are named
off-pattern ("4MA1_1H_msc_2019307.pdf"); they are taken too.

Writes <work-dir>/manifest.json in fetch_gcse_maths.py's shape: component ("4ma1-1h"), kind (qp, ms, er),
series ("JAN19", "JUN23R"), title, source, file, and `r2`: the library's key for the same file where the
bucket already has it (edexcel/EDX-4MA1-1H-QP-JUN23.pdf), so the bank links to that copy.
"""
import json, os, re, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "past-papers", "boards"))
from edexcel import ALGOLIA, HEADERS, SITE, UA  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SOURCE = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--from=")), os.path.join(ROOT, "scripts", "past-papers", ".work"))
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "edexcel-igcse-maths")
PDF = os.path.join(WORK, "pdf")
FIRST = 2019
NAME = re.compile(r"/4ma1[-_]+([12][fh]r?)[-_]+(que|rms|msc|pef)[-_]+(\d{7,8})[^/]*\.pdf$", re.I)
KINDS = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}
MONTHS = {"January": "JAN", "June": "JUN", "November": "NOV"}


def curl(url, dest=None, data=None):
    cmd = ["curl", "-sSfL", "--retry", "3", "-A", UA, url]
    if data:
        cmd += ["-X", "POST", "-d", data] + [x for k, v in HEADERS.items() for x in ("-H", f"{k}: {v}")]
    if dest:
        cmd += ["-o", dest]
    out = subprocess.run(cmd, capture_output=True, timeout=300)
    return out.stdout if out.returncode == 0 else None


def listing():
    hits, page = [], 0
    while True:
        d = json.loads(curl(ALGOLIA, data=json.dumps({"params": f"query=4MA1&hitsPerPage=1000&page={page}"})))
        hits += d["hits"]
        page += 1
        if page >= d.get("nbPages", 1):
            break
    found = {}
    for h in hits:
        url = h.get("url", "")
        m = NAME.search(url)
        if not m or "exam-materials" not in url.lower() or "/secure/" in url.lower() or int(m.group(3)[:4]) < FIRST:
            continue
        series = next((c.split("/")[-1] for c in h.get("category", []) if c.startswith("Pearson-UK:Exam-Series/")), "")
        mon, _, year = series.partition("-")
        if mon in MONTHS and year.isdigit():
            found[SITE + url] = (m.group(1).upper(), m.group(2).lower(), h.get("title", ""), f"{MONTHS[mon]}{year[2:]}")
    return found


def main():
    os.makedirs(PDF, exist_ok=True)
    library = {}
    path = os.path.join(SOURCE, "edexcel", "manifest.json")
    if os.path.exists(path):
        library = {f["source"]: f["file"] for f in json.load(open(path)) if "4MA1" in f["file"]}
    found = listing()
    raw = os.path.join(WORK, "raw")
    os.makedirs(raw, exist_ok=True)

    def fetch(url):
        dest = os.path.join(raw, os.path.basename(url).replace(" ", "_"))
        if not os.path.exists(dest):
            local = os.path.join(SOURCE, "edexcel", "pdf", os.path.basename(library.get(url, "-")))
            if os.path.exists(local):
                open(dest, "wb").write(open(local, "rb").read())
            elif curl(url.replace(" ", "%20"), dest) is None or not open(dest, "rb").read(4) == b"%PDF":
                if os.path.exists(dest):
                    os.remove(dest)
                return None
        return dest

    # Four at a time: Pearson's file server is slow per file, not busy.
    urls = sorted(found)
    with ThreadPoolExecutor(max_workers=4) as pool:
        got = list(pool.map(fetch, urls))
    out, missing = {}, []
    for url, dest in zip(urls, got):
        comp, raw_kind, title, series = found[url]
        if not dest:
            missing.append(url)
            continue
        kind = KINDS[raw_kind]
        series += "R" if comp.endswith("R") else ""
        component = f"4ma1-{comp[:2].lower()}"
        slot = (component, kind, series)
        if slot in out and raw_kind == "msc":
            continue  # an "rms" scheme over an "msc" one for the same sitting
        name = f"{component}-{kind}-{series.lower()}.pdf"
        shutil.copyfile(dest, os.path.join(PDF, name))
        out[slot] = {"component": component, "spec": "4MA1", "kind": kind, "series": series, "title": title, "source": url,
                     "file": name, **({"r2": library[url]} if url in library else {})}
    manifest = sorted(out.values(), key=lambda f: (f["component"], f["series"], f["kind"]))
    for f in manifest:
        f["bytes"] = os.path.getsize(os.path.join(PDF, f["file"]))
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    sets = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    print(f"4MA1: {len(manifest)} files, {len(sets)} papers, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    for m in missing:
        print("  not fetched:", m, file=sys.stderr)


if __name__ == "__main__":
    main()
