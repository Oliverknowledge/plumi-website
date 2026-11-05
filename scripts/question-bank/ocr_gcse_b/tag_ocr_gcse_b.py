"""Split the cut OCR GCSE Twenty First Century Science parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_gcse_b/tag_ocr_gcse_b.py split [work-dir] [batch-size]
    python3 scripts/question-bank/ocr_gcse_b/tag_ocr_gcse_b.py merge [work-dir]

edexcel_gcse/tag_gcse.py for OCR's Biology B (J257), Chemistry B (J258), Physics B (J259) and Combined
Science B (J260), as ocr_gcse/tag_ocr_gcse.py does for the Gateway suite. split writes <work-dir>/tag/<subject>-topics.txt (each sub-topic's code, its topic,
its title and what the specification says under it) and <work-dir>/tag/batch-NN-<subject>.jsonl, one
part per line. Each batch is tagged following ../tag.md ("OCR GCSE Twenty First Century sciences", tag/ocr-gcse-21c-sciences.md) into
batch-NN-<subject>.tags.json: {"<part id>": ["B1.2"], ...}. merge combines them into <work-dir>/tags.json
for build_ocr_gcse_b.py, as tag_pearson.py does.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-gcse-b")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 300
sys.argv[2:] = [WORK, str(SIZE)]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402
from build_ocr_gcse_b import paper_name  # noqa: E402

TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology": ("J257", "J257"), "chemistry": ("J258", "J258"), "physics": ("J259", "J259"), "combined": ("J260", "J260")}


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, (code, _) in SUBJECTS.items():
        tree = spec[code]
        titles = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {t['section']} {titles[t['section']]} | {t['title']} — {tp.clip(t['text'], 3000)}" for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["spec"] == code and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = tp.own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": paper_name(p["component"]),
                                        "setup": tp.clip(setup, 200), "question": tp.clip(question, 360),
                                        "scheme": tp.clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


if __name__ == "__main__":
    tp.SUBJECTS, tp.TAG = SUBJECTS, TAG
    split() if mode == "split" else tp.merge()
