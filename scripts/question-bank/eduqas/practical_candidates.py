"""Add the Eduqas parts its schemes credit with practical-skills marks to practicals.py's batches.

    python3 scripts/question-bank/practicals.py split --only=eduqas-a-level-physics,eduqas-a-level-chemistry,eduqas-a-level-biology \\
        --parts=scripts/question-bank/.work/eduqas-sciences/parts.json
    python3 scripts/question-bank/eduqas/practical_candidates.py [work-dir]

practicals.py's net is the practical words in a part's question or scheme. Eduqas's schemes
also say it outright: a "Prac" column gives each part's practical-skills marks (cut_eduqas.py
reads it into `prac`). Those parts the net missed go into one more batch, in practicals.py's
line format, so the reader judges them by the same brief (tag.md, "Practical questions"):
the column is broader than the brief (it credits a reagent for a synthesis step, say), so
it is a reason to look, not an answer.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "eduqas-sciences")
BATCHES = os.path.join(HERE, "..", ".work", "practicals")
COURSE = {"physics": "Eduqas A-Level Physics", "chemistry": "Eduqas A-Level Chemistry", "biology": "Eduqas A-Level Biology"}
sys.path.insert(0, os.path.join(HERE, ".."))
from practicals import SIZE, clip  # noqa: E402


def main():
    paths = sorted(glob.glob(os.path.join(BATCHES, "batch-*.jsonl")))
    have = {json.loads(line)["id"] for p in paths for line in open(p)}
    extra = []
    for p in json.load(open(os.path.join(WORK, "parts.json"))):
        if p.get("prac") and p["id"] not in have and p.get("qp"):
            paper = ("AS " if p["spec"].startswith("B") else "") + f"Component {p['component'][-2]}" + (f": {p['paperTitle']}" if p.get("paperTitle") else "")
            extra.append({"id": p["id"], "course": COURSE[p["subject"]], "paper": paper,
                          "question": clip(p.get("text", ""), 650), "scheme": clip(p.get("msText", ""), 260)})
    n = max([int(re.search(r"batch-(\d+)", p).group(1)) for p in paths] or [0])
    for i in range(0, len(extra), SIZE):
        n += 1
        with open(os.path.join(BATCHES, f"batch-{n:02d}.jsonl"), "w") as f:
            f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in extra[i:i + SIZE])
    print(f"{len(extra)} parts with practical-skills marks the net missed, in batches up to {n:02d}", file=sys.stderr)


if __name__ == "__main__":
    main()
