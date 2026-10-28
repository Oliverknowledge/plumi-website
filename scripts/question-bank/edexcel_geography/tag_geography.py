"""Split the cut Geography parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_geography/tag_geography.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_geography/tag_geography.py merge [work-dir]

edexcel_sciences/tag_pearson.py, pointed at Geography. Each batch is tagged following
../tag.md's "Edexcel Geography" section.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3:
    sys.argv[2:] = [os.path.join(HERE, "..", ".work", "edexcel-geography")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

tp.SUBJECTS = {"geography": ("8GE0", "9GE0")}

if __name__ == "__main__":
    tp.split() if tp.mode == "split" else tp.merge()
