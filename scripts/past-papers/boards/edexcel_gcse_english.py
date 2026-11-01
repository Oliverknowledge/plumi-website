"""Pearson Edexcel's GCSE English Language (1EN0) and English Literature (1ET0) for the past paper library.

    python3 scripts/past-papers/boards/edexcel_gcse_english.py

The question banks fetch every public file from Pearson's own site (question-bank/edexcel_gcse_english/fetch_english.py),
so this reads their manifests, in scripts/question-bank/.work/edexcel-gcse-english-{lang,lit}, as english_lit.py does the
A-Level's: Language's source booklets are split out of its question papers as the papers' inserts. The files are copied
here under the library's names (EDX-1EN0-01-QP-JUN24.pdf), which the banks link to too. Writes
.work/edexcel-gcse-english/pdf/ and .work/edexcel-gcse-english/manifest.json (boards/README.md).
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "edexcel-gcse-english")
BANK = os.path.join(HERE, "..", "..", "question-bank", ".work")

# bank work folder: (subject, group, {component: paper})
SPECS = {
    "edexcel-gcse-english-lang": ("gcse-english-language", "GCSE (1EN0)", {
        "1en0-01": "Paper 1: Fiction and Imaginative Writing", "1en0-02": "Paper 2: Non-fiction and Transactional Writing"}),
    "edexcel-gcse-english-lit": ("gcse-english-literature", "GCSE (1ET0)", {
        "1et0-01": "Paper 1: Shakespeare and Post-1914 Literature", "1et0-02": "Paper 2: 19th-century Novel and Poetry since 1789",
        "1et0-2n": "Paper 2N: 19th-century Novel", "1et0-2p": "Paper 2P: Poetry since 1789"}),
}


def main():
    os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    manifest = []
    for folder, (subject, group, papers) in SPECS.items():
        for f in json.load(open(os.path.join(BANK, folder, "manifest.json"))):
            if f["component"] not in papers:
                continue
            out = os.path.join(WORK, "pdf", os.path.basename(f["r2"]))
            if not os.path.exists(out) or os.path.getsize(out) != f["bytes"]:
                shutil.copyfile(os.path.join(BANK, folder, "pdf", f["file"]), out)
            spec, num = f["component"].split("-")
            manifest.append({"subject": subject, "board": "edexcel", "group": group, "paper": papers[f["component"]],
                             "code": f"{spec.upper()}/{num.upper()}", "series": f["series"], "kind": f["kind"], "source": f["source"], "file": f["r2"]})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files copied to {os.path.join(WORK, 'pdf')}", file=sys.stderr)


if __name__ == "__main__":
    main()
