"""Download Eduqas's AS and A Level Computer Science papers, schemes and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas_cs/fetch_eduqas_cs.py [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-cs

eduqas/fetch_eduqas.py, unchanged, over the Computer Science qualification (A500, AS B500). It
writes <work-dir>/pdf, manifest.json and specs/cs.pdf and cs-as.pdf, and prints the gaps.

One thing is put right after it: Eduqas lists AS Component 2's June 2022 question paper as a
"[Resource]", so it arrives as an insert with no paper beside it. Its cover is the paper's, and it
has every question. It's filed as the paper here, with its share of that series' examiner's report.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-cs")
sys.argv = [sys.argv[0], WORK]
sys.path.insert(0, os.path.join(HERE, "..", "eduqas"))
import fetch_eduqas  # noqa: E402

fetch_eduqas.QUALIFICATIONS = {"cs": (38409, "A500", "B500")}  # the hidden QualificationId on /qualifications/computer-science-asa-level/


def file_listed_resource_as_paper():
    import pymupdf  # noqa: PLC0415
    path = os.path.join(WORK, "manifest.json")
    manifest = json.load(open(path))
    papers = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    for f in [f for f in manifest if f["kind"] == "ins" and (f["component"], f["series"]) not in papers]:
        pdf = os.path.join(WORK, "pdf", f["file"])
        cover = pymupdf.open(pdf)[0].get_text()
        if "INSTRUCTIONS TO CANDIDATES" not in cover or f["component"].upper() not in cover:
            continue
        f["kind"], f["file"] = "qp", f["file"].replace("-ins-", "-qp-")
        os.replace(pdf, os.path.join(WORK, "pdf", f["file"]))
        print(f"  {f['file']} was listed as a resource: filed as the question paper", file=sys.stderr)
        report = next((r for r in manifest if r["kind"] == "er" and r["spec"] == f["spec"] and r["series"] == f["series"]), None)
        if report:
            manifest.append({**report, "component": f["component"], "section": f"COMPONENT {f['component'][-2]}", "file": f"{f['component']}-er-{f['series'].lower()}.pdf"})
            with open(os.path.join(WORK, "pdf", report["file"]), "rb") as src, open(os.path.join(WORK, "pdf", manifest[-1]["file"]), "wb") as dst:
                dst.write(src.read())
    json.dump(manifest, open(path, "w"), indent=1)


if __name__ == "__main__":
    fetch_eduqas.main()
    file_listed_resource_as_paper()
