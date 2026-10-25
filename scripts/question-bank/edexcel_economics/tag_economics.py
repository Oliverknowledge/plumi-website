"""Split the cut Economics A parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_economics/tag_economics.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_economics/tag_economics.py merge [work-dir]

edexcel_sciences/tag_pearson.py, pointed at Economics A. Each batch is tagged following
../tag.md's "Edexcel Economics A" section.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3:
    sys.argv[2:] = [os.path.join(HERE, "..", ".work", "edexcel-economics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

tp.SUBJECTS = {"economics": ("8EC0", "9EC0")}

if __name__ == "__main__":
    tp.split() if tp.mode == "split" else tp.merge()
