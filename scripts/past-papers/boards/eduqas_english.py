"""Eduqas GCSE English Language (C700) and English Literature (C720, and June 2022's C722) for the past paper library.

    python3 scripts/past-papers/boards/eduqas_english.py

The question banks fetch every public file from eduqas.co.uk (question-bank/eduqas_gcse_english/fetch_english.py), so
this reads their manifests, in scripts/question-bank/.work/eduqas-gcse-english-{lang,lit}. Those files are already on R2
under the banks' names (eduqas/c700u10-qp-jun24.pdf, Language's inserts eduqas/c700u10-ins-jun24.pdf), so they aren't
copied or sent again. Writes .work/eduqas-english/manifest.json (boards/README.md).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "eduqas-english")
BANK = os.path.join(HERE, "..", "..", "question-bank", ".work")
LANG, LIT = "gcse-english-language", "gcse-english-literature"

PAPERS = {
    # component: (subject, group, paper, code)
    "c700u10": (LANG, "GCSE (C700)", "Component 1: 20th Century Literature Reading and Creative Prose Writing", "C700U10"),
    "c700u20": (LANG, "GCSE (C700)", "Component 2: 19th and 21st Century Non-Fiction Reading and Transactional/Persuasive Writing", "C700U20"),
    "c720u10": (LIT, "GCSE (C720)", "Component 1: Shakespeare and Poetry", "C720U10"),
    "c720u20": (LIT, "GCSE (C720)", "Component 2: Post-1914 Prose/Drama, 19th Century Prose and Unseen Poetry", "C720U20"),
    "c722u10a": (LIT, "GCSE, June 2022 (C722)", "Component 1A: Shakespeare", "C722U10-A"),
    "c722u10b": (LIT, "GCSE, June 2022 (C722)", "Component 1B: Post-1914 Prose/Drama", "C722U10-B"),
    "c722u20a": (LIT, "GCSE, June 2022 (C722)", "Component 2A: Poetry Anthology", "C722U20-A"),
    "c722u20b": (LIT, "GCSE, June 2022 (C722)", "Component 2B: 19th Century Prose", "C722U20-B"),
    "c722u20c": (LIT, "GCSE, June 2022 (C722)", "Component 2C: Unseen Poetry", "C722U20-C"),
}


def main():
    os.makedirs(WORK, exist_ok=True)
    manifest = []
    for folder in ("eduqas-gcse-english-lang", "eduqas-gcse-english-lit"):
        for f in json.load(open(os.path.join(BANK, folder, "manifest.json"))):
            subject, group, paper, code = PAPERS[f["component"]]
            manifest.append({"subject": subject, "board": "eduqas", "group": group, "paper": paper, "code": code,
                             "series": f["series"], "kind": f["kind"], "source": f["source"], "file": f["r2"]})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, all the banks' own on R2", file=sys.stderr)


if __name__ == "__main__":
    main()
