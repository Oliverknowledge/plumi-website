"""Split the cut Edexcel International GCSE parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_igcse/tag_igcse.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_igcse/tag_igcse.py merge [work-dir]

edexcel_sciences/tag_pearson.py for the International GCSE specifications. split writes
<work-dir>/tag/<subject>-topics.txt (each sub-topic's code, its topic, its title, its statement
numbers and what the specification says under it) and <work-dir>/tag/batch-NN-<subject>.jsonl,
one part per line. Each batch is tagged following ../tag.md ("Edexcel International GCSE
sciences") into batch-NN-<subject>.tags.json: {"<part id>": ["2e"], ...}. merge combines them
into <work-dir>/tags.json for build_igcse.py, as tag_pearson.py does.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-igcse")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
sys.argv[2:] = [WORK, str(SIZE)]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology": ("4BI1", "4BI1"), "chemistry": ("4CH1", "4CH1"), "physics": ("4PH1", "4PH1")}


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, (code, _) in SUBJECTS.items():
        tree = spec[code]
        titles = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {titles[t['section']]} | {t['title']} (statements {t['points']}) — {tp.clip(t['text'], 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["spec"] == code and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = tp.own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": f"Paper {p['component'][4]}",
                                        "setup": tp.clip(setup, 200), "question": tp.clip(question, 360),
                                        "scheme": tp.clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


if __name__ == "__main__":
    tp.SUBJECTS, tp.TAG = SUBJECTS, TAG
    split() if mode == "split" else tp.merge()
