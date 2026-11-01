"""Gather the GCSE Maths papers, both tiers, of AQA (8300), Pearson Edexcel (1MA1) and OCR (J560).

    python3 scripts/question-bank/gcse_maths/fetch_gcse_maths.py aqa|edexcel|ocr [--from=<past-papers work dir>] [work-dir]
    # default work dir: scripts/question-bank/.work/gcse-maths/<board>
    # default --from:   scripts/past-papers/.work (the library's crawl of the boards' own sites)

Every file comes from the board's own website:
  - AQA and OCR: the past paper library's crawl already holds every paper, mark
    scheme and examiner's report from aqa.org.uk and ocr.org.uk, unmodified, with a
    manifest. This keeps the GCSE Maths ones (AQA 8300/1F-3F and 1H-3H, OCR J560/01-03
    Foundation and 04-06 Higher) and copies each to <work-dir>/pdf/, downloading from
    the same board address what isn't local. AQA's specimen papers come as separate
    files and are kept. OCR's specimen papers and its reports covering three papers at
    once (June and November 2017, and "J560/01/02/03" from 2023) are single files, so
    they are left out.
  - Pearson: its past paper search (as fetch_pearson.py) lists every series from June
    2019 as single PDFs, and June 2017 to November 2018 as one zip of question papers and
    mark schemes and one of examiner's reports per series, all public; both tiers' files
    are taken out of those. Pearson keeps November 2025 and later for teachers only.

Writes <work-dir>/manifest.json in fetch_pearson.py's shape: component (AQA "83001H",
Pearson "1ma1-1h", OCR "j560-04"; Foundation "83001F", "1ma1-1f", "j560-01"), kind (qp, ms, er), series ("JUN23", "SPEC"),
title, source, file, and `r2`: the library's key for the same file where the bucket
already has it (aqa/AQA-83001H-QP-JUN23.pdf), so the bank links to that copy.
"""
import io, json, os, re, shutil, sys, time, urllib.parse, urllib.request, zipfile

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
BOARD = ARGS[0]
SOURCE = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--from=")), os.path.join(ROOT, "scripts", "past-papers", ".work"))
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", "gcse-maths", BOARD)
PDF = os.path.join(WORK, "pdf")
LAST = 2025  # the bank runs to the 2025 series
PEARSON = "https://qualifications.pearson.com"
MONTHS = {"June": "JUN", "November": "NOV"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            time.sleep(2)
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None


def in_range(series):
    return series == "SPEC" or (re.fullmatch(r"(JUN|NOV)\d\d", series) and 2017 <= 2000 + int(series[3:]) <= LAST)


def from_library():
    """AQA and OCR: the library's GCSE Maths files."""
    library = json.load(open(os.path.join(SOURCE, BOARD, "manifest.json")))
    out = []
    for f in library:
        if f["subject"] != "gcse-maths" or f["kind"] not in ("qp", "ms", "er", "ins") or not in_range(f["series"]):
            continue
        if BOARD == "aqa":
            m = re.fullmatch(r"8300/([123][FH])", f["code"])
            comp = m and f"8300{m.group(1)}"
        else:
            m = re.fullmatch(r"J560/0([1-6])", f["code"])
            comp = m and f"j560-0{m.group(1)}"
            if f["series"] == "SPEC":
                comp = None  # one file for a tier's three papers
        if not comp:
            continue
        name = f"{comp}-{f['kind']}-{f['series'].lower()}.pdf"
        dest = os.path.join(PDF, name)
        if not os.path.exists(dest):
            local = os.path.join(SOURCE, BOARD, "pdf", os.path.basename(f["file"]))
            body = open(local, "rb").read() if os.path.exists(local) else get(f["source"])
            if not body or not body.startswith(b"%PDF"):
                print("  failed", f["source"], file=sys.stderr)
                continue
            open(dest, "wb").write(body)
        out.append({"component": comp, "spec": "8300" if BOARD == "aqa" else "J560", "kind": f["kind"], "series": f["series"],
                    "title": f["paper"], "source": f["source"], "file": name, "r2": f["file"]})
    return out


def pearson_records():
    url = f"{PEARSON}/services/pearson/algolia/GET.servlet?" + urllib.parse.quote('fq=category:"Pearson-UK:Specification-Code/gcse15-maths"', safe="=&+:")
    return json.loads(get(url))["searchResults"]["algoliaRecords"]


def from_pearson():
    out = []
    library = {}
    path = os.path.join(SOURCE, "edexcel", "manifest.json")
    if os.path.exists(path):
        library = {f["source"]: f["file"] for f in json.load(open(path))}
    for r in pearson_records():
        cats = r.get("category", [])
        series = next((c.split("/")[-1] for c in cats if c.startswith("Pearson-UK:Exam-Series/")), "")
        mon, _, year = series.partition("-")
        if mon not in MONTHS or not year.isdigit():
            continue
        code = MONTHS[mon] + year[2:]
        if not in_range(code):
            continue
        name = os.path.basename(r["url"])
        source = PEARSON + urllib.parse.quote(r["url"])
        if "/secure/" in r["url"]:
            continue  # teachers only
        m = re.match(r"1ma1[-_]([123][fh])[-_](que|rms|msc|pef)[-_]", name, re.I)
        if m:
            kind = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}[m.group(2).lower()]
            items = [(f"1ma1-{m.group(1).lower()}", kind, lambda s=source: get(s), source)]
        elif name.endswith(".zip") and re.search(r"(QP_MS|question-papers|Examiner)", name, re.I) and "modified" not in name.lower():
            body = get(source)
            if not body:
                continue
            z = zipfile.ZipFile(io.BytesIO(body))
            items = []
            for member in z.namelist():
                base = os.path.basename(member)
                mm = re.match(r"1MA1_([123][FH])(?:_(QP|MS|que|msc|pef))?", base, re.I)
                if not mm or not base.lower().endswith(".pdf"):
                    continue
                tag = (mm.group(2) or "").lower()
                kind = "er" if "xaminer" in name or tag == "pef" else "ms" if tag in ("ms", "msc") else "qp"
                items.append((f"1ma1-{mm.group(1).lower()}", kind, lambda z=z, member=member: z.read(member), f"{source}#{base}"))
        else:
            continue
        for comp, kind, read, src in items:
            fname = f"{comp}-{kind}-{code.lower()}.pdf"
            dest = os.path.join(PDF, fname)
            if any(f["file"] == fname for f in out):
                continue
            if not os.path.exists(dest):
                body = read()
                if not body or not body.startswith(b"%PDF"):
                    print("  not public", src, file=sys.stderr)
                    continue
                open(dest, "wb").write(body)
                time.sleep(0.3)
            out.append({"component": comp, "spec": "1MA1", "kind": kind, "series": code, "title": r.get("title", ""), "source": src,
                        "file": fname, **({"r2": library[src]} if src in library else {})})
    return out


def main():
    os.makedirs(PDF, exist_ok=True)
    out = from_pearson() if BOARD == "edexcel" else from_library()
    for f in out:
        f["bytes"] = os.path.getsize(os.path.join(PDF, f["file"]))
    out.sort(key=lambda f: (f["component"], f["series"], f["kind"]))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    sets = {(f["component"], f["series"]) for f in out if f["kind"] == "qp"}
    print(f"{BOARD}: {len(out)} files, {len(sets)} papers, {sum(f['bytes'] for f in out) / 1e6:.0f} MB in {PDF}", file=sys.stderr)


if __name__ == "__main__":
    main()
