"""Fetch Pearson Edexcel's own GCSE (9-1) Computer Science (1CP2) papers.

    python3 scripts/question-bank/edexcel_cs/fetch_cs.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-cs

All from qualifications.pearson.com, found through the search index behind its course
materials pages (scripts/past-papers/boards/edexcel.py's search):
  - every public question paper ("que"), mark scheme ("rms") and examiner's report ("pef")
    of Paper 1 (Principles of Computer Science) and Paper 2 (Application of Computational
    Thinking), first sat June 2022. Pearson keeps the latest series (June 2026) for
    teachers only, under /secure/, so it isn't asked for;
  - Paper 2's code and data files, a zip per sitting ("1cp2-02-june-2022-data-files.zip"):
    Paper 2 is sat on screen, editing the Python files Q01.py to Q06.py. June 2025's are
    teacher-only too;
  - the sample assessment materials, one PDF per paper with its mark scheme bound in after it
    ("Paper 1 mark scheme"), split here into a question paper and a mark scheme, and
    Paper 2's specimen code files.

Writes <work-dir>/pdf/1cp2-<paper>-<kind>-<series>.pdf ("1cp2-1-qp-jun22.pdf"),
<work-dir>/pdf/1cp2-2-data-<series>.zip and <work-dir>/manifest.json in fetch_pearson.py's
shape: component ("1cp2-1"), kind (qp, ms, er, data), series ("JUN22", "SPEC"), title,
source. Polite and cached: a re-run fetches only what is missing.
"""
import json, os, re, subprocess, sys, time, urllib.parse

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-cs")
PDF = os.path.join(WORK, "pdf")
RAW = os.path.join(WORK, "raw")  # the specimen books as downloaded
sys.path.insert(0, os.path.join(HERE, "..", "..", "past-papers", "boards"))
from edexcel import SITE, UA, search  # noqa: E402

TITLES = {"1": "Principles of Computer Science", "2": "Application of Computational Thinking"}
KINDS = {"que": "qp", "rms": "ms", "pef": "er"}
# 1cp2-01-que-20220517.pdf; a paper's scheme and report are dated the August it was marked.
NAME = re.compile(r"/1cp2-0([12])-(que|rms|pef)-(20\d\d)\d{4}\.pdf$", re.I)
# 1cp2-02-june-2022-data-files.zip, data-files-june-2023-1cp2-02.zip
DATA = re.compile(r"/(?:1cp2-02-june-(20\d\d)-data-files|data-files-june-(20\d\d)-1cp2-02)\.zip$", re.I)
SAMS = "/content/dam/pdf/GCSE/Computer Science/2020/specification-and-sample-assessments/"
SAM_BOOKS = {"1": "GCSE_L1_L2_Computer_Science_2020_Sample_assessment_materials_for_Paper_1.pdf",
             "2": "GCSE_L1_L2_Computer_Science_2020_Sample_assessment_materials_for_Paper_2.pdf"}
SAM_CODE = "SAMs_GCSE_L1_L2_Computer_Science_2020_Paper_2_Code Files.zip"


def download(url):
    """A whole file, or None. curl, as fetch_gcse.py: Pearson's server drops long downloads part way."""
    r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", UA, urllib.parse.quote(url, safe=":/")], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


def entry(paper, kind, series, source, title=None):
    return {"component": f"1cp2-{paper}", "spec": "1CP2", "kind": kind, "series": series,
            "title": title or f"Paper {paper}: {TITLES[paper]}", "source": source, "pearsonName": os.path.basename(source)}


def sams(files):
    """Split each specimen book where its mark scheme starts ("Paper 1 mark scheme" at the top of a page)."""
    for paper, name in SAM_BOOKS.items():
        raw = os.path.join(RAW, name)
        if not os.path.exists(raw):
            body = download(SITE + SAMS + name)
            if not body or not body.startswith(b"%PDF"):
                continue
            open(raw, "wb").write(body)
            time.sleep(0.4)
        doc = pymupdf.open(raw)
        ms = next(i for i, p in enumerate(doc) if re.match(rf"\s*Paper {paper} mark scheme", p.get_text()))
        for kind, first, last in (("qp", 0, ms - 1), ("ms", ms, len(doc) - 1)):
            out = os.path.join(PDF, f"1cp2-{paper}-{kind}-spec.pdf")
            if not os.path.exists(out):
                part = pymupdf.open()
                part.insert_pdf(doc, from_page=first, to_page=last)
                part.save(out, garbage=3, deflate=True)
            files[(paper, kind, "SPEC")] = {**entry(paper, kind, "SPEC", SITE + SAMS + name, "Sample assessment materials"),
                                            "pearsonName": f"{name}#{first + 1}-{last + 1}"}
    files[("2", "data", "SPEC")] = entry("2", "data", "SPEC", SITE + SAMS + SAM_CODE, "Sample assessment materials")


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    files = {}
    for h in search("1CP2"):
        url = h.get("url", "")
        if "/secure/" in url.lower() or "exam-materials" not in url.lower():
            continue  # teacher-only, or not an exam paper
        m, d = NAME.search(url), DATA.search(url)
        if m:
            files.setdefault((m.group(1), KINDS[m.group(2).lower()], "JUN" + m.group(3)[2:]), entry(m.group(1), KINDS[m.group(2).lower()], "JUN" + m.group(3)[2:], SITE + url))
        elif d:
            year = d.group(1) or d.group(2)
            files.setdefault(("2", "data", "JUN" + year[2:]), entry("2", "data", "JUN" + year[2:], SITE + url))
    sams(files)

    manifest, missing = [], []
    for (paper, kind, series), f in sorted(files.items()):
        ext = "zip" if kind == "data" else "pdf"
        out = os.path.join(PDF, f"1cp2-{paper}-{kind}-{series.lower()}.{ext}")
        if not os.path.exists(out):
            body = download(f["source"])
            if not body or not body.startswith(b"PK" if ext == "zip" else b"%PDF"):
                missing.append(f"Paper {paper} {kind} {series}")
                continue
            open(out, "wb").write(body)
            time.sleep(0.4)
        manifest.append({**f, "file": os.path.basename(out), "bytes": os.path.getsize(out)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files in {PDF}; not public ({len(missing)}): {'; '.join(missing)}", file=sys.stderr)


if __name__ == "__main__":
    main()
