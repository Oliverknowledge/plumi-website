"""Fetch Pearson Edexcel A-level Statistics (9ST0) and AS Statistics (8ST0) papers, from Pearson.

    python3 scripts/question-bank/edexcel_statistics/fetch_statistics.py <work-dir>

Reuses fetch_edexcel.py (Pearson's public course-materials index, unmodified downloads, polite and cached)
with the Statistics spec codes instead of Maths and Further Maths. Writes <work-dir>/pdf and manifest.json.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import fetch_edexcel  # noqa: E402  (reads its work dir from argv[1])

fetch_edexcel.CURRENT = ["9ST0", "8ST0"]

if __name__ == "__main__":
    fetch_edexcel.main()
