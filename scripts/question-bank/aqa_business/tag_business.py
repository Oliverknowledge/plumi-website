"""Split the cut AQA Business questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_business/tag_business.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_business/tag_business.py merge [work-dir]

edexcel_sciences/tag_pearson.py, pointed at AQA Business (7131 and 7132, one topic
tree). Each batch is tagged following ../tag.md's "AQA Business" section. A question's
text is its own words first, then its case or shared data, so `question` is what it asks.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3:
    sys.argv[2:] = [os.path.join(HERE, "..", ".work", "aqa-business")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

tp.SUBJECTS = {"business": ("7131", "7132")}


def split():
    """tag_pearson's split, then AQA's paper names ("AS 1", "A-Level 3"), each question's marks,
    a longer `question` (an essay's case comes after its words), and each multiple-choice answer as its scheme."""
    tp.split()
    parts = {p["id"]: p for p in json.load(open(os.path.join(tp.WORK, "parts.json")))}
    for path in glob.glob(os.path.join(tp.TAG, "batch-*.jsonl")):
        rows = [json.loads(line) for line in open(path)]
        for r in rows:
            p = parts[r["id"]]
            r["paper"] = ("AS " if p["spec"] == "7131" else "A-Level ") + p["component"][-1]
            r["label"], r["marks"] = p["label"], p["marks"]
            r["question"] = tp.clip(p["text"], 700)
            if p.get("key"):
                r["scheme"] = f"Answer: {p['key']}"
            else:
                r["scheme"] = tp.clip(p.get("msText", ""), 400)
            r.pop("setup", None)
        open(path, "w").write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


if __name__ == "__main__":
    split() if tp.mode == "split" else tp.merge()
