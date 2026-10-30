"""Pearson Edexcel's GCSE (9-1) Computer Science (1CP2) papers for the past paper library.

    python3 scripts/past-papers/boards/edexcel_cs.py

The question bank's fetcher (scripts/question-bank/edexcel_cs/fetch_cs.py) fetches every
public file from Pearson's own site: each sitting's question paper, mark scheme and
examiner's report for Paper 1 and Paper 2, Paper 2's code and data files (a zip, since
Paper 2 is sat on screen, in Python), and the sample assessment materials, each paper's
book split into its question paper and mark scheme. This copies them under the library's
names and writes the library's manifest (boards/README.md); the zips go on their sitting's
row as "Code files" (kind "data"). It is kept apart from boards/edexcel.py, whose file
name pattern and dating fit neither the zips nor the specimen books.

Writes .work/edexcel-cs/pdf/EDX-1CP2-<01|02>-<KIND>-<SERIES>.<pdf|zip> and .work/edexcel-cs/manifest.json.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "edexcel-cs")
sys.path.insert(0, os.path.join(HERE, "..", "..", "question-bank", "edexcel_cs"))
sys.argv[1:] = []
import fetch_cs  # noqa: E402


def main():
    fetch_cs.main()
    os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    manifest = []
    for f in json.load(open(os.path.join(fetch_cs.WORK, "manifest.json"))):
        n = f["component"][-1]
        ext = os.path.splitext(f["file"])[1]
        name = f"EDX-1CP2-0{n}-{f['kind'].upper()}-{f['series']}{ext}"
        out = os.path.join(WORK, "pdf", name)
        if not os.path.exists(out) or os.path.getsize(out) != f["bytes"]:
            shutil.copyfile(os.path.join(fetch_cs.PDF, f["file"]), out)
        manifest.append({"subject": "gcse-computer-science", "board": "edexcel", "group": "GCSE (1CP2)",
                         "paper": f"Paper {n}: {fetch_cs.TITLES[n]}", "code": f"1CP2/0{n}", "series": f["series"],
                         "kind": f["kind"], "source": f["source"], "file": f"edexcel/{name}"})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files in {os.path.join(WORK, 'pdf')}", file=sys.stderr)


if __name__ == "__main__":
    main()
