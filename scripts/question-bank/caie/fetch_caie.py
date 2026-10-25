"""Gather Cambridge International's (CAIE's) public papers for the question bank.

    python3 scripts/question-bank/caie/fetch_caie.py [--maths] [--from=<past-papers cie work dir>] [work-dir]
    # default work dir: scripts/question-bank/.work/caie-sciences (with --maths, .work/caie-maths)
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
"""
import filecmp, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MATHS = "--maths" in sys.argv
SOURCE = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--from=")), os.path.join(ROOT, "scripts", "past-papers", ".work", "cie"))
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "caie-maths" if MATHS else "caie-sciences")
PDF = os.path.join(WORK, "pdf")
# The syllabus and the bank its papers go in.
BANKS = ({"9709": "caie-a-level-maths", "9231": "caie-a-level-further-maths"} if MATHS else
         {"9700": "caie-a-level-biology", "9701": "caie-a-level-chemistry", "9702": "caie-a-level-physics"})
# Components sat at AS (the rest are A-Level only). 9709: Pure 1, Pure 2, Mechanics, Probability & Statistics 1.
AS = {"9709": ("1", "2", "4", "5"), "9231": (), "9700": ("1", "2", "3"), "9701": ("1", "2", "3"), "9702": ("1", "2", "3")}
# The practical papers (3) are skipped: their questions are instructions for apparatus in front of the candidate.
SKIP = {"9700": ("3",), "9701": ("3",), "9702": ("3",)}


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
        local = os.path.join(SOURCE, "pdf", os.path.basename(f["file"]))
        if f["kind"] == "ms" and filecmp.cmp(local, qps.get((f["code"], f["series"]), local), shallow=False) and (f["code"], f["series"]) in qps:
            print(f"{f['code']} {f['series']}: the mark scheme is the question paper; left out", file=sys.stderr)
            continue
        comp = f"{spec}-{num}"
        rows = [(f, f["kind"], None)]
        if f["kind"] == "qp" and f["series"] == "JUN24" and spec in reports:
            rows.append((reports[spec], "er", f"{spec}/{num}"))
        for g, kind, section in rows:
            name = f"{comp}-{kind}-{g['series'].lower()}.pdf" if kind != "er" else f"{spec}-er-{g['series'].lower()}.pdf"
            dest = os.path.join(PDF, name)
            if not os.path.exists(dest):
                shutil.copyfile(os.path.join(SOURCE, "pdf", os.path.basename(g["file"])), dest)
            out.append({"component": comp, "spec": spec, "kind": kind, "series": f["series"], "title": f["paper"],
                        "source": g["source"], "file": name, "r2": g["file"], "bytes": os.path.getsize(dest),
                        "bank": BANKS[spec], "as": paper in AS[spec], **({"section": section} if section else {})})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} rows, {len({f['file'] for f in out})} files in {PDF}", file=sys.stderr)


if __name__ == "__main__":
    main()
