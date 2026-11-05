"""Write the Eduqas A-Level Computer Science bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/eduqas_cs/build_eduqas_cs.py [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-cs

eduqas/build_eduqas.py, unchanged, over this bank, in the same shapes. Three things it doesn't know are added
afterwards: the topics' short names, the note about AS Component 2, and `sk` on a part with no sub-part
whose stem holds its scenario (the site finds a stem by taking the part off an id, and these have none to take off).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-cs")
sys.argv = [sys.argv[0], WORK]
sys.path.insert(0, os.path.join(HERE, "..", "eduqas"))
import build_eduqas  # noqa: E402

SLUG = "eduqas-a-level-computer-science"
build_eduqas.SUBJECTS = [(SLUG, "cs", "Computer Science")]
NOTE = ("AS Component 2 is sat on screen, around a program Eduqas gives centres for the exam: its written questions and its task to build a new "
        "program are here, with the paper's scenario above each. Completing the given program can’t be done without it, so those parts are left out. "
        "A-Level Component 3 is the non-exam project, with no paper.")


if __name__ == "__main__":
    build_eduqas.main()
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = {t["code"]: t for t in json.load(open(os.path.join(WORK, "spec.json")))["cs"]["topics"]}
    sks = {p["id"]: p["sk"] for p in parts if p.get("sk")}

    def with_sk(row):
        return {**row, "sk": sks[row["id"]]} if row["id"] in sks else row

    meta_path = os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = json.load(open(meta_path))
    meta["note"] = NOTE
    meta["sample"] = [with_sk(r) for r in meta["sample"]]
    meta["topics"] = [{**t, **({"short": spec[t["code"]]["short"]} if spec[t["code"]].get("short") else {})} for t in meta["topics"]]
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
    rows_path = os.path.join(ROOT, "public", "question-bank", SLUG, "parts.json")
    rows = [with_sk(r) for r in json.load(open(rows_path))]
    json.dump(rows, open(rows_path, "w"), ensure_ascii=False, separators=(",", ":"))
