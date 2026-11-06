"""Gather Cambridge International's AS & A Level Psychology (9990) papers for the question bank.

    python3 scripts/question-bank/caie_psychology/fetch_caie_psychology.py [work-dir]
    # default work dir: scripts/question-bank/.work/caie-psychology

caie/fetch_caie.py's sibling, for a syllabus the past paper library (scripts/past-papers/boards/cie.py)
doesn't list yet. Cambridge keeps its archive behind the School Support Hub login; this reads only
the syllabus's public "Past papers, examiner reports and specimen papers" page, with the library's own
page reader (imported, so its code and syllabus table are untouched), and downloads what is there:
  - May/June 2024, one time-zone variant of each component (9990/11, 21, 31, 41), question papers and
    mark schemes;
  - that series's examiner report (one for the whole syllabus, a section per component, 9990/11 ...);
  - the specimen papers and mark schemes for exams from 2024 (9990/01 to 04).
The specimen mark schemes for Papers 1 and 2 are listed twice (the same pages, re-issued): the first is kept.

Cambridge's public "June 2024 mark scheme, Paper 41" is the May/June 2023 scheme of the syllabus before (its
cover says 2023, "Section C: Essay", and its Question 1 is about SSRIs for OCD where the June 2024 paper's is about
Freeman et al.). A mark scheme whose cover doesn't carry its series' year is left out, so those 51 parts have
no scheme, as the 9231 Paper 2 specimen's questions in the other CAIE banks have none.

PDFs are saved unmodified under the library's names (CIE-9990-11-QP-JUN24.pdf), which are also their
R2 keys under cie/: upload_r2.py --pdf-prefix=cie/ puts them there, because the library hasn't.
Writes <work-dir>/manifest.json in caie/fetch_caie.py's shape.
"""
import importlib.util, json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "caie-psychology")
PDF = os.path.join(WORK, "pdf")
SLUG = "caie-a-level-psychology"
SPEC = "9990"
NAMES = {"1": "Approaches, Issues and Debates", "2": "Research Methods", "3": "Specialist Options: Approaches, Issues and Debates",
         "4": "Specialist Options: Application and Research Methods"}
AS_PAPERS = ("1", "2")


def wrong_scheme(path, series):
    """True for a mark scheme whose first pages date it to another year than its series (June 2024's should say 2024)."""
    if series == "SPEC":
        return False
    text = " ".join(page.get_text() for page in list(pymupdf.open(path))[:2])
    return f"20{series[3:]}" not in text


def library():
    """boards/cie.py as a module, with this syllabus added to its table (its fetching and page cache are its own)."""
    path = os.path.join(HERE, "..", "..", "past-papers", "boards", "cie.py")
    spec = importlib.util.spec_from_file_location("cie_library", path)
    cie = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cie)
    cie.WORK = os.path.join(WORK, "library")  # its page cache goes in this work folder, not the library's
    cie.PAGES = os.path.join(cie.WORK, "pages")
    cie.SYLLABUSES[SPEC] = ("a-level-psychology", "cie", "AS & A Level (9990)", "cambridge-international-as-and-a-level-psychology-9990")
    return cie


def main():
    os.makedirs(PDF, exist_ok=True)
    cie = library()
    files, url = cie.syllabus_files(SPEC)
    print(f"{len(files)} files listed on {url}", file=sys.stderr)
    out, seen, report = [], set(), None
    for f in files:
        if f["kind"] not in ("qp", "ms", "er"):
            print(f"  left out: {f['title']!r} ({f['kind']})", file=sys.stderr)
            continue
        comp = f["comp"]
        code = SPEC if f["kind"] == "er" else cie.code_of(SPEC, comp)
        name = f"CIE-{code.replace('/', '-')}-{f['kind'].upper()}-{f['series']}.pdf"
        if name in seen:
            print(f"  two files for {name}, kept the first", file=sys.stderr)
            continue
        seen.add(name)
        if not cie.download(f["source"], os.path.join(PDF, name)):
            sys.exit(f"could not download {f['source']}")
        if f["kind"] == "ms" and wrong_scheme(os.path.join(PDF, name), f["series"]):
            print(f"  {name} is not the {f['series']} mark scheme (its cover says another year): left out", file=sys.stderr)
            os.remove(os.path.join(PDF, name))
            continue
        row = {"kind": f["kind"], "series": f["series"], "source": f["source"], "file": name, "r2": f"cie/{name}", "code": code,
               "bytes": os.path.getsize(os.path.join(PDF, name))}
        if f["kind"] == "er":
            report = row
        else:
            row["paper"] = f"Paper {comp[0]}: {NAMES[comp[0]]}"
            out.append(row)
    # One manifest row per file, in caie/fetch_caie.py's shape; each June 2024 question paper also points at the report's section.
    manifest = []
    for r in out:
        number = r["code"].partition("/")[2]
        paper = number[1] if number.startswith("0") else number[0]
        base = {"component": f"{SPEC}-{number}", "spec": SPEC, "title": r["paper"], "bank": SLUG, "as": paper in AS_PAPERS}
        manifest.append({**base, "kind": r["kind"], "series": r["series"], "source": r["source"], "file": r["file"], "r2": r["r2"], "bytes": r["bytes"]})
        if r["kind"] == "qp" and r["series"] == "JUN24" and report:
            manifest.append({**base, "kind": "er", "series": "JUN24", "source": report["source"], "file": report["file"], "r2": report["r2"],
                             "bytes": report["bytes"], "section": f"{SPEC}/{number}"})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    kinds = {}
    for m in manifest:
        kinds[(m["series"], m["kind"])] = kinds.get((m["series"], m["kind"]), 0) + 1
    print(f"{len(manifest)} rows, {len(seen)} files in {PDF}: {kinds}", file=sys.stderr)


if __name__ == "__main__":
    main()
