"""Split the cut Edexcel GCSE parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse/tag_gcse.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_gcse/tag_gcse.py merge [work-dir]

edexcel_sciences/tag_pearson.py for the GCSE specifications. split writes
<work-dir>/tag/<subject>-topics.txt (each sub-topic's code, its topic, its title, its statement
numbers, the papers that examine it and what the specification says under it) and
<work-dir>/tag/batch-NN-<subject>.jsonl, one part per line. Each batch is tagged following
../tag.md ("Edexcel GCSE sciences") into batch-NN-<subject>.tags.json: {"<part id>": ["6.2"], ...}.
merge combines them into <work-dir>/tags.json for build_gcse.py, as tag_pearson.py does.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-gcse")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
sys.argv[2:] = [WORK, str(SIZE)]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology": ("1BI0", "1BI0"), "chemistry": ("1CH0", "1CH0"), "physics": ("1PH0", "1PH0")}
# Which topics each paper examines; Topic 1, the key concepts, is on both.
PAPER_1 = {"1BI0": range(1, 6), "1CH0": range(1, 6), "1PH0": range(1, 8)}
TIER = {"f": "Foundation", "h": "Higher"}


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, (code, _) in SUBJECTS.items():
        tree = spec[code]
        titles = {s["code"]: s["title"] for s in tree["sections"]}
        papers = lambda t: "Papers 1 and 2" if int(t["section"]) == 1 else "Paper 1" if int(t["section"]) in PAPER_1[code] else "Paper 2"  # noqa: E731
        lines = [f"{t['code']} | {titles[t['section']]} | {t['title']} (statements {t['points']}) [{papers(t)}] — {tp.clip(t['text'], 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["spec"] == code and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = tp.own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": f"Paper {p['component'][4]} {TIER[p['component'][5]]}",
                                        "setup": tp.clip(setup, 200), "question": tp.clip(question, 360),
                                        "scheme": tp.clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


if __name__ == "__main__":
    tp.SUBJECTS, tp.TAG = SUBJECTS, TAG
    split() if mode == "split" else tp.merge()
