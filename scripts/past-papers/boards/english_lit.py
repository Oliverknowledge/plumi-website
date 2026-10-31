"""English Literature for the past paper library: AQA's GCSE (8702) and A-Level A (7712, AS 7711) and B (7717, AS 7716),
Pearson Edexcel's A-Level (9ET0, AS 8ET0) and OCR's A-Level (H472, AS H072).

    python3 scripts/past-papers/boards/english_lit.py

Each board's question bank fetches every public file from the board's own site, so this reads their manifests:
  - AQA: aqa_english_lit/fetch_english_lit.py's, in scripts/question-bank/.work/aqa-english-lit-{gcse,a,b}. Those files
    are already on R2 under the bank's names (aqa/AQA-77121-QP-JUN24.pdf), so they aren't copied or sent again. AQA
    publishes from November 2020; its specimen papers are left out, as in the bank.
  - Edexcel: edexcel_english_lit/fetch_english_lit.py's (Paper 3's source booklet split out as its insert).
  - OCR: ocr_english_lit/fetch_english_lit.py's.
The Edexcel and OCR files are copied here under the library's names (EDX-9ET0-01-QP-JUN24.pdf, OCR-H472-01-QP-JUN24.pdf),
which the banks link to too. Writes .work/english-lit/pdf/ and .work/english-lit/manifest.json (boards/README.md).
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "english-lit")
BANK = os.path.join(HERE, "..", "..", "question-bank", ".work")
A_LEVEL, GCSE = "a-level-english-literature", "gcse-english-literature"

AQA = {
    # component: (subject, group, paper)
    "87021": (GCSE, "GCSE (8702)", "Paper 1: Shakespeare and the 19th-century novel"),
    "87021M": (GCSE, "GCSE (8702)", "Paper 1M: Modern prose or drama"),
    "87021N": (GCSE, "GCSE (8702)", "Paper 1N: The 19th-century novel"),
    "87021P": (GCSE, "GCSE (8702)", "Paper 1P: Poetry anthology"),
    "87022": (GCSE, "GCSE (8702)", "Paper 2: Modern texts and poetry"),
    "77121": (A_LEVEL, "English Literature A · A-Level (7712)", "Paper 1: Love through the ages"),
    "77122A": (A_LEVEL, "English Literature A · A-Level (7712)", "Paper 2A: Texts in shared contexts: WW1 and its aftermath"),
    "77122B": (A_LEVEL, "English Literature A · A-Level (7712)", "Paper 2B: Texts in shared contexts: Modern times"),
    "77111": (A_LEVEL, "English Literature A · AS (7711)", "AS Paper 1: Love through the ages: Shakespeare and poetry"),
    "77112": (A_LEVEL, "English Literature A · AS (7711)", "AS Paper 2: Love through the ages: prose"),
    "77171A": (A_LEVEL, "English Literature B · A-Level (7717)", "Paper 1A: Literary genres: Aspects of tragedy"),
    "77171B": (A_LEVEL, "English Literature B · A-Level (7717)", "Paper 1B: Literary genres: Aspects of comedy"),
    "77172A": (A_LEVEL, "English Literature B · A-Level (7717)", "Paper 2A: Texts and genres: Elements of crime writing"),
    "77172B": (A_LEVEL, "English Literature B · A-Level (7717)", "Paper 2B: Texts and genres: Elements of political and social protest writing"),
    "77161A": (A_LEVEL, "English Literature B · AS (7716)", "AS Paper 1A: Literary genres: Drama: Aspects of tragedy"),
    "77161B": (A_LEVEL, "English Literature B · AS (7716)", "AS Paper 1B: Literary genres: Drama: Aspects of comedy"),
    "77162A": (A_LEVEL, "English Literature B · AS (7716)", "AS Paper 2A: Literary genres: Prose and poetry: Aspects of tragedy"),
    "77162B": (A_LEVEL, "English Literature B · AS (7716)", "AS Paper 2B: Literary genres: Prose and poetry: Aspects of comedy"),
}
EDEXCEL = {"9et0-01": "Paper 1: Drama", "9et0-02": "Paper 2: Prose", "9et0-03": "Paper 3: Poetry",
           "8et0-01": "AS Paper 1: Poetry and drama", "8et0-02": "AS Paper 2: Prose"}
OCR = {"h472-01": "Component 1: Drama and poetry pre-1900", "h472-02": "Component 2: Comparative and contextual study",
       "h072-01": "AS Component 1: Shakespeare and poetry pre-1900", "h072-02": "AS Component 2: Drama and prose post-1900"}


def code_of(comp):
    """'77122A' -> '7712/2A'."""
    return f"{comp[:4]}/{comp[4:]}"


def main():
    os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    manifest = []
    for level in ("gcse", "a", "b"):
        for f in json.load(open(os.path.join(BANK, f"aqa-english-lit-{level}", "manifest.json"))):
            if f["component"] not in AQA or f["series"] == "SPEC" or f["kind"] not in ("qp", "ms", "er", "ins"):
                continue
            subject, group, paper = AQA[f["component"]]
            manifest.append({"subject": subject, "board": "aqa", "group": group, "paper": paper, "code": code_of(f["component"]),
                             "series": f["series"], "kind": f["kind"], "source": f["source"], "file": f"aqa/{f['file']}"})
    for board, folder, papers, groups in (
            ("edexcel", "edexcel-english-lit", EDEXCEL, {"9et0": "A-Level (9ET0)", "8et0": "AS (8ET0)"}),
            ("ocr", "ocr-english-lit", OCR, {"h472": "A-Level (H472)", "h072": "AS (H072)"})):
        for f in json.load(open(os.path.join(BANK, folder, "manifest.json"))):
            if f["component"] not in papers:
                continue
            name = os.path.basename(f["r2"])
            out = os.path.join(WORK, "pdf", name)
            if not os.path.exists(out) or os.path.getsize(out) != f["bytes"]:
                shutil.copyfile(os.path.join(BANK, folder, "pdf", f["file"]), out)
            spec, num = f["component"].split("-")
            manifest.append({"subject": A_LEVEL, "board": board, "group": groups[spec], "paper": papers[f["component"]],
                             "code": f"{spec.upper()}/{num}", "series": f["series"], "kind": f["kind"], "source": f["source"], "file": f["r2"]})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files ({sum(1 for f in manifest if f['board'] != 'aqa')} copied to {os.path.join(WORK, 'pdf')}; AQA's are the banks')",
          file=sys.stderr)


if __name__ == "__main__":
    main()
