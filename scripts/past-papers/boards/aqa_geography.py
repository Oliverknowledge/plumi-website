"""AQA's GCSE Geography (8035) papers for the past paper library.

    python3 scripts/past-papers/boards/aqa_geography.py

The question bank's fetcher (scripts/question-bank/aqa_gcse_geography/fetch_gcse_geography.py)
fetches every public file from AQA's own site: each sitting's question paper, mark scheme and
examiner's report for Papers 1-3, the insert (an OS map key, or in November 2021 Paper 2's OS
maps), and Paper 3's pre-release resources booklet. This copies them under the library's names
and writes the library's manifest (boards/README.md); the booklet goes on its sitting's row as
"Resources booklet" (kind "pm"). The files are the bank's own, uploaded once under aqa/.

Writes .work/aqa-geography/pdf/AQA-8035<n>-<KIND>-<SERIES>.pdf and .work/aqa-geography/manifest.json.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "aqa-geography")
BANK = os.path.join(HERE, "..", "..", "question-bank", ".work", "aqa-gcse-geography")
TITLES = {"1": "Living with the physical environment", "2": "Challenges in the human environment", "3": "Geographical applications"}


def main():
    os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    manifest = []
    for f in json.load(open(os.path.join(BANK, "manifest.json"))):
        n = f["component"][-1]
        out = os.path.join(WORK, "pdf", f["file"])
        if not os.path.exists(out) or os.path.getsize(out) != f["bytes"]:
            shutil.copyfile(os.path.join(BANK, "pdf", f["file"]), out)
        manifest.append({"subject": "gcse-geography", "board": "aqa", "group": "GCSE (8035)",
                         "paper": f"Paper {n}: {TITLES[n]}", "code": f"8035/{n}", "series": f["series"],
                         "kind": f["kind"], "source": f["source"], "file": f"aqa/{f['file']}"})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files in {os.path.join(WORK, 'pdf')}", file=sys.stderr)


if __name__ == "__main__":
    main()
