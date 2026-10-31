"""Pearson Edexcel's A-Level Economics B (9EB0) papers for the past paper library.

    python3 scripts/past-papers/boards/edexcel_economics_b.py

The question bank's fetcher (scripts/question-bank/edexcel_economics_b/fetch_economics_b.py)
fetches every public file from Pearson's own site: each sitting's question paper, mark scheme
and examiner's report for Papers 1 to 3. This copies them under the library's names and writes
the library's manifest (boards/README.md). It is kept apart from boards/edexcel.py, whose
file name pattern and dating are the sciences' and maths'.

Writes .work/edexcel-economics-b/pdf/EDX-9EB0-<01|02|03>-<KIND>-<SERIES>.pdf and .work/edexcel-economics-b/manifest.json.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "edexcel-economics-b")
sys.path.insert(0, os.path.join(HERE, "..", "..", "question-bank", "edexcel_economics_b"))
sys.argv[1:] = []
import fetch_economics_b  # noqa: E402

TITLES = {"1": "Markets and how they work", "2": "Competing in the global economy", "3": "The economic environment and business"}


def main():
    fetch_economics_b.main()
    os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    manifest = []
    for f in json.load(open(os.path.join(fetch_economics_b.fp.WORK, "manifest.json"))):
        n = f["component"][-1]
        name = f"EDX-9EB0-0{n}-{f['kind'].upper()}-{f['series']}.pdf"
        out = os.path.join(WORK, "pdf", name)
        if not os.path.exists(out) or os.path.getsize(out) != f["bytes"]:
            shutil.copyfile(os.path.join(fetch_economics_b.fp.PDF, f["file"]), out)
        manifest.append({"subject": "a-level-economics-b", "board": "edexcel", "group": "A-Level (9EB0)",
                         "paper": f"Paper {n}: {TITLES[n]}", "code": f"9EB0/0{n}", "series": f["series"],
                         "kind": f["kind"], "source": f["source"], "file": f"edexcel/{name}"})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files in {os.path.join(WORK, 'pdf')}", file=sys.stderr)


if __name__ == "__main__":
    main()
