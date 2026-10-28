"""Fetch Pearson Edexcel's own GCSE (9–1) Biology, Chemistry and Physics papers.

    python3 scripts/question-bank/edexcel_gcse/fetch_gcse.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse

All from qualifications.pearson.com, three ways:
  - November 2020 onwards: Pearson's past paper search (as fetch_pearson.py), filed
    under the sciences' shared code "gcse16-science". Pearson keeps the latest
    series (June 2026) for teachers only, so it comes back as a page and is skipped.
  - June 2018 and 2019: one zip per subject and tier, listed in the same search,
    holding the question papers, mark schemes and examiner's reports.
  - The specimen papers: the "Sample assessment materials" book, one PDF per
    subject with all four papers and their mark schemes; it is split into a
    question paper and a mark scheme per paper by each paper's cover.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("1ph0-1f-qp-jun22.pdf") and
<work-dir>/manifest.json in fetch_pearson.py's shape. Polite and cached.
"""
import io, json, os, re, subprocess, sys, time, urllib.parse, zipfile

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from fetch_pearson import BASE, UA, get  # noqa: E402

PDF = os.path.join(WORK, "pdf")
RAW = os.path.join(WORK, "raw")  # the zips and specimen books as downloaded
os.makedirs(PDF, exist_ok=True)
os.makedirs(RAW, exist_ok=True)

SPEC = "gcse16-science"
CODES = ("1bi0", "1ch0", "1ph0")
DOC_TYPES = {"Question-paper": "qp", "Mark-scheme": "ms", "Examiner-report": "er"}
MONTHS = {"June": "JUN", "November": "NOV"}
# 1ph0-1f-que-20220610.pdf, 1PH0_2H_rms_20220224.pdf, 1PH0_1F_Exam-paper_20180523.pdf
NAME = re.compile(r"(1(?:bi|ch|ph)0)[-_ ]?([12][fh])[-_ ]", re.I)
# ..._que_..., 2018's "_Exam-paper_", "_Mark-Scheme_", "_Principal-Examiner-Report_", 2019's "1PH0_1F_Question Paper 2019.pdf"
KIND = {"que": "qp", "exam-paper": "qp", "question-paper": "qp", "rms": "ms", "msc": "ms", "mark-scheme": "ms",
        "pef": "er", "principal-examiner-report": "er", "examiner-report": "er", "examiners-report": "er"}
# Physics's book (sams-gcse-l1-l2-in-physics.pdf) is a 158 MB scan with poor OCR text, so it isn't cut.
SAMS = {"1bi0": "SAMs_GCSE_L1-L2_in_Biology.pdf", "1ch0": "SAMs_GCSE_L1-L2_in_Chemistry.pdf"}


def download(url):
    """A whole file, or None. curl rather than urllib: Pearson's server drops long downloads part way,
    and curl picks them up again."""
    r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", UA, url], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


def kind_of(name):
    m = re.search(r"[-_](" + "|".join(KIND) + r")[-_]", re.sub(r"\s+", "-", name.lower()))
    return KIND[m.group(1)] if m else None


def listed():
    q = f'fq=category:"Pearson-UK:Specification-Code/{SPEC}"'
    body = get(f"{BASE}/services/pearson/algolia/GET.servlet?" + urllib.parse.quote(q, safe="=&+:"))
    return json.loads(body)["searchResults"]["algoliaRecords"] if body else []


def keep(files, comp, kind, series, title, source, name, body=None):
    slot = (comp, kind, series)
    if slot not in files:
        files[slot] = {"component": comp, "spec": comp[:4].upper(), "kind": kind, "series": series,
                       "title": title, "source": source, "pearsonName": name, **({"body": body} if body else {})}


def cached(url, name):
    path = os.path.join(RAW, name)
    if not os.path.exists(path):
        body = download(url)
        if not body:
            return None
        open(path, "wb").write(body)
        time.sleep(0.4)
    return open(path, "rb").read()


def sams(code, files):
    """Split the specimen book by its contents page ("Paper 1F Question paper 5", "Paper 1F Mark scheme 37"),
    whose numbers are the book's printed pages: the first paper's cover ("1BI0/1F" under "Paper Reference")
    says where printed page 5 falls in the PDF."""
    body = cached(f"{BASE}/content/dam/pdf/GCSE/Science/2016/Specification/{SAMS[code]}", f"sams-{code}.pdf")
    if not body:
        return
    doc = pymupdf.open(stream=body, filetype="pdf")
    contents = next(p.get_text() for p in doc if p.get_text().lstrip().startswith("Contents"))
    printed = [(int(n), f"{code}-{paper.lower()}", "qp" if what.lower().startswith("question") else "ms")
               for paper, what, n in re.findall(r"Paper ([12][FH])\s+(Question paper|Mark scheme)\s+(\d+)", contents, re.I)]
    first = min(printed)
    cover = next(i for i, p in enumerate(doc) if "Paper Reference" in p.get_text() and re.search(rf"{code}/{first[1][-2:]}\b", p.get_text(), re.I))
    starts = sorted((n - first[0] + cover, comp, kind) for n, comp, kind in printed)
    for n, (first, comp, kind) in enumerate(starts):
        last = starts[n + 1][0] - 1 if n + 1 < len(starts) else len(doc) - 1
        out = pymupdf.open()
        out.insert_pdf(doc, from_page=first, to_page=last)
        keep(files, comp, kind, "SPEC", f"Sample assessment materials {comp.upper()}", BASE + "/content/dam/pdf/GCSE/Science/2016/Specification/" + SAMS[code],
             SAMS[code] + f"#{first + 1}-{last + 1}", out.tobytes(garbage=3, deflate=True))
    print(f"{code} specimens: " + ", ".join(f"{c} {k} p{p + 1}" for p, c, k in starts), file=sys.stderr)


def main():
    files = {}
    records = listed()
    print(f"{SPEC}: {len(records)} documents listed", file=sys.stderr)
    for r in records:
        url, title = r.get("url", ""), re.sub(r"\s+", " ", r.get("title", "")).strip()
        cats = r.get("category", [])
        series = next((c.split("/")[-1] for c in cats if c.startswith("Pearson-UK:Exam-Series/")), None)
        name = os.path.basename(url)
        if name.lower().endswith(".zip"):
            # June 2018 "gcse-physics-higher-tier.zip", June 2019 "physics-higher-papers-2019.zip"
            z = re.fullmatch(r"(?:gcse-)?(biology|chemistry|physics)-(foundation|higher)-(?:tier|papers-2019)\.zip", name.lower())
            if not z:
                continue  # combined science, mocks, modified papers
            year = "19" if "2019" in name else "18"
            body = cached(BASE + urllib.parse.quote(url), name)
            if not body:
                continue
            with zipfile.ZipFile(io.BytesIO(body)) as zf:
                for member in zf.namelist():
                    base = os.path.basename(member)
                    m, kind = NAME.search(base), kind_of(base)
                    if m and kind and base.lower().endswith(".pdf"):
                        comp = f"{m.group(1).lower()}-{m.group(2).lower()}"
                        keep(files, comp, kind, f"JUN{year}", title, BASE + url, base, zf.read(member))
            continue
        kind = next((DOC_TYPES[c.split("/")[-1]] for c in cats if c.startswith("Pearson-UK:Document-Type/") and c.split("/")[-1] in DOC_TYPES), None)
        m = NAME.search(name)
        if not (kind and series and m and name.lower().endswith(".pdf")) or series.split("-")[0] not in MONTHS:
            continue
        kind = kind_of(name) or kind  # the file name wins over a misfiled type
        mon, year = series.split("-")
        keep(files, f"{m.group(1).lower()}-{m.group(2).lower()}", kind, MONTHS[mon] + year[2:], title, BASE + url, name)
    for code in SAMS:
        sams(code, files)

    manifest, restricted = [], []
    old_path = os.path.join(WORK, "manifest.json")
    before = {f["file"]: f["pearsonName"] for f in json.load(open(old_path))} if os.path.exists(old_path) else {}
    for slot, f in sorted(files.items()):
        out = os.path.join(PDF, f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf")
        if os.path.exists(out) and before.get(os.path.basename(out), f["pearsonName"]) != f["pearsonName"]:
            os.remove(out)
        body = f.pop("body", None)
        if not os.path.exists(out):
            body = body or download(urllib.parse.quote(f["source"], safe=":/"))
            if not body or not body.startswith(b"%PDF"):
                restricted.append(f"{f['component']} {f['kind']} {f['series']}")
                continue
            open(out, "wb").write(body)
            time.sleep(0.4)
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(old_path, "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    print(f"not public ({len(restricted)}): " + "; ".join(restricted), file=sys.stderr)


if __name__ == "__main__":
    main()
