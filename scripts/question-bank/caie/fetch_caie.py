"""Gather Cambridge International's (CAIE's) public papers for the question bank.

    python3 scripts/question-bank/caie/fetch_caie.py [--igcse] [--maths] [--from=<past-papers cie work dir>] [work-dir]
    # default work dir: scripts/question-bank/.work/caie-sciences (with --maths, .work/caie-maths;
    # with --igcse, .work/caie-igcse-sciences and .work/caie-igcse-maths)
    # default --from:   scripts/past-papers/.work/cie (written by scripts/past-papers/boards/cie.py)

Cambridge keeps its archive behind the School Support Hub login; we never fetch from
it or from mirrors. On its public site it publishes, per syllabus, one series (May/June
2024, one time-zone variant of each component: 9709/11, not /12 or /13), that series's
examiner report, and the specimen papers. The past paper library's CIE fetcher has
already downloaded those, unmodified, with a manifest (its gaps.md lists what isn't
public). This reads that manifest and copies each question paper and mark scheme of
the A-Level sciences, or with --maths of Maths and Further Maths, to
<work-dir>/pdf/<component>-<kind>-<series>.pdf.

Cambridge writes one examiner report for the whole syllabus, a section per component
("Paper 9709/11"). Each component's set gets its own `er` row pointing at that report,
with `section` set to its component, so the cutter reads only its own section.

Writes <work-dir>/manifest.json in fetch_ocr.py's shape, `r2` being the library's key
for the same file (cie/CIE-9709-11-QP-JUN24.pdf), already in the bucket.

A mark scheme that is byte for byte its own question paper is left out: Cambridge's
public link for the 9231 Paper 2 specimen mark scheme serves the question paper.

--igcse does the same for Cambridge IGCSE: Biology 0610, Chemistry 0620 and Physics 0625,
or with --maths Mathematics 0580 and Additional Mathematics 0606. The 9-1 syllabuses sit
the same papers: 0970, 0971 and 0972's June 2024 and specimen papers are 0610, 0620 and
0625's word for word, so they are left out. Mathematics 9-1 (0980) shares 0580's specimens
but its public June 2024 papers are another time-zone variant (0980/12, /22, /32, /42
against 0580/11, /21, /31, /41), different questions on the same content: they join the
0580 bank as a second June 2024 sitting, series "JUN24V2".
"""
import filecmp, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MATHS = "--maths" in sys.argv
IGCSE = "--igcse" in sys.argv
SOURCE = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--from=")), os.path.join(ROOT, "scripts", "past-papers", ".work", "cie"))
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", f"caie{'-igcse' if IGCSE else ''}-{'maths' if MATHS else 'sciences'}")
PDF = os.path.join(WORK, "pdf")
# The syllabus and the bank its papers go in.
BANKS = {
    (False, True): {"9709": "caie-a-level-maths", "9231": "caie-a-level-further-maths"},
    (False, False): {"9700": "caie-a-level-biology", "9701": "caie-a-level-chemistry", "9702": "caie-a-level-physics"},
    (True, True): {"0580": "caie-igcse-maths", "0980": "caie-igcse-maths", "0606": "caie-igcse-additional-maths"},
    (True, False): {"0610": "caie-igcse-biology", "0620": "caie-igcse-chemistry", "0625": "caie-igcse-physics"},
}[(IGCSE, MATHS)]
# Components sat at AS (the rest are A-Level only). 9709: Pure 1, Pure 2, Mechanics, Probability & Statistics 1.
# IGCSE has no AS: its Core and Extended papers say which they are in their titles.
AS = {"9709": ("1", "2", "4", "5"), "9231": (), "9700": ("1", "2", "3"), "9701": ("1", "2", "3"), "9702": ("1", "2", "3")}
# The practical papers (A Level 3, IGCSE 5) are skipped: their questions are instructions for apparatus
# in front of the candidate. IGCSE Paper 6, the alternative to practical, is in.
SKIP = {"9700": ("3",), "9701": ("3",), "9702": ("3",), "0610": ("5",), "0620": ("5",), "0625": ("5",)}
# 0980's June 2024 papers are a second sitting of 0580's (another variant); its specimens are 0580's own.
SERIES = {"0980": {"JUN24": "JUN24V2", "SPEC": None}}


def main():
    os.makedirs(PDF, exist_ok=True)
    library = json.load(open(os.path.join(SOURCE, "manifest.json")))
    out, reports, qps = [], {}, {}
    for f in library:
        spec, _, num = f["code"].partition("/")
        if spec in BANKS and f["kind"] == "er" and f["series"] == "JUN24":
            reports[spec] = f
        if f["kind"] == "qp":
            qps[(f["code"], f["series"])] = os.path.join(SOURCE, "pdf", os.path.basename(f["file"]))
    for f in library:
        spec, _, num = f["code"].partition("/")
        # The paper is the component's first digit (9709/31), or a specimen's second (9709/03).
        paper = num[1:2] if num.startswith("0") else num[:1]
        if spec not in BANKS or f["kind"] not in ("qp", "ms") or f["series"] not in ("JUN24", "SPEC") or not num or paper in SKIP.get(spec, ()):
            continue
        series = SERIES.get(spec, {}).get(f["series"], f["series"])
        if not series:
            continue
        local = os.path.join(SOURCE, "pdf", os.path.basename(f["file"]))
        if f["kind"] == "ms" and filecmp.cmp(local, qps.get((f["code"], f["series"]), local), shallow=False) and (f["code"], f["series"]) in qps:
            print(f"{f['code']} {f['series']}: the mark scheme is the question paper; left out", file=sys.stderr)
            continue
        comp = f"{spec}-{num}"
        rows = [(f, f["kind"], None)]
        if f["kind"] == "qp" and f["series"] == "JUN24" and spec in reports:
            rows.append((reports[spec], "er", f"{spec}/{num}"))
        for g, kind, section in rows:
            name = f"{comp}-{kind}-{series.lower()}.pdf" if kind != "er" else f"{spec}-er-{g['series'].lower()}.pdf"
            dest = os.path.join(PDF, name)
            if not os.path.exists(dest):
                shutil.copyfile(os.path.join(SOURCE, "pdf", os.path.basename(g["file"])), dest)
            out.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": f["paper"],
                        "source": g["source"], "file": name, "r2": g["file"], "bytes": os.path.getsize(dest),
                        "bank": BANKS[spec], "as": paper in AS.get(spec, ()), **({"section": section} if section else {})})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} rows, {len({f['file'] for f in out})} files in {PDF}", file=sys.stderr)


if __name__ == "__main__":
    main()
