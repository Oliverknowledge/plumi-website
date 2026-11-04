"""Cut AQA's GCSE Biology, Chemistry and Physics papers: cut.py with setups.py's rule, kept to these banks so no other bank's crops move.

    python3 scripts/question-bank/aqa_gcse/cut_gcse.py [work-dir] [--only=84611h]   # default scripts/question-bank/.work-gcse

The patch sits at the top level, so the worker processes cut.py starts (which re-run this file) get it too.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
    sys.argv[1] = os.path.abspath(sys.argv[1])
else:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work-gcse"))
sys.path.insert(0, os.path.dirname(HERE))
import cut, setups  # noqa: E402

setups.install()

if __name__ == "__main__":
    cut.main()
