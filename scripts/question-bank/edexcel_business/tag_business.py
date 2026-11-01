"""Split the cut Business parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_business/tag_business.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_business/tag_business.py merge [work-dir]

edexcel_sciences/tag_pearson.py, pointed at Business. Each batch is tagged following
../tag.md's "Edexcel Business" section.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3:
    sys.argv[2:] = [os.path.join(HERE, "..", ".work", "edexcel-business")]
if len(sys.argv) < 4:
    sys.argv.append("84")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

tp.SUBJECTS = {"business": ("8BS0", "9BS0")}

if __name__ == "__main__":
    if tp.mode == "split":
        tp.split()
        path = os.path.join(tp.TAG, "business-topics.txt")
        # there is no AS here: tag_pearson marks every year-0 topic "[A-Level only]"
        text = open(path).read().replace(" [A-Level only]", "")
        open(path, "w").write(text)
    else:
        tp.merge()
