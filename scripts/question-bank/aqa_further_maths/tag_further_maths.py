"""Split the cut AQA Further Maths questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_further_maths/tag_further_maths.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_further_maths/tag_further_maths.py merge [work-dir]

aqa_maths/tag_maths.py over the Further Maths work dir: the same maths-topics.txt and
batch-NN-maths.jsonl files, briefed by tag.md's AQA Further Maths section. What differs is
each line's `paper`: which content its paper holds.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-further-maths")
sys.argv = [sys.argv[0], mode, WORK, *sys.argv[3:4]]
sys.path.insert(0, os.path.join(HERE, "..", "aqa_maths"))
import tag_maths  # noqa: E402

OPTION = {"M": "Mechanics (MA-ME)", "S": "Statistics (SA-SH)", "D": "Discrete (DA-DG)"}


def section(part):
    """Papers 1 and 2 (and AS Paper 1) are compulsory pure; Paper 3 and AS Paper 2 are one option each."""
    comp = part["component"]
    name = ("AS " if comp.startswith("7366") else "") + f"Paper {comp[4]}"
    return f"{name}: {OPTION[comp[-1]]}" if comp[-1] in OPTION else f"{name}: compulsory pure (A-J)"


tag_maths.section = section

if __name__ == "__main__":
    tag_maths.split() if mode == "split" else tag_maths.merge()
