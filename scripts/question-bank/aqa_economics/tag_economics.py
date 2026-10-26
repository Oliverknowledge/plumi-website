"""Split the cut AQA Economics questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_economics/tag_economics.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_economics/tag_economics.py merge [work-dir]

edexcel_sciences/tag_pearson.py, pointed at AQA Economics (7135 and 7136, one topic
tree). Each batch is tagged following ../tag.md's "AQA Economics" section. A question's
text is its own words first, then its context's extracts, so `question` is what it asks.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3:
    sys.argv[2:] = [os.path.join(HERE, "..", ".work", "aqa-economics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

tp.SUBJECTS = {"economics": ("7135", "7136")}


def split():
    """tag_pearson's split, then AQA's paper names ("AS 1", "A-Level 3") and each multiple-choice answer as its scheme."""
    tp.split()
    parts = {p["id"]: p for p in json.load(open(os.path.join(tp.WORK, "parts.json")))}
    topics = os.path.join(tp.TAG, "economics-topics.txt")
    listing = open(topics).read()
    open(topics, "w").write(listing.replace(" — Content Additional information ", " — "))
    for path in glob.glob(os.path.join(tp.TAG, "batch-*.jsonl")):
        rows = [json.loads(line) for line in open(path)]
        for r in rows:
            p = parts[r["id"]]
            r["paper"] = ("AS " if p["spec"] == "7135" else "A-Level ") + p["component"][-1]
            if p.get("key"):
                r["scheme"] = f"Answer: {p['key']}"
        open(path, "w").write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


if __name__ == "__main__":
    split() if tp.mode == "split" else tp.merge()
