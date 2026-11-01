"""Split the cut OCR Psychology questions for topic tagging, and merge the answers back:
ocr_sociology/tag_ocr_sociology.py --psychology.

    python3 scripts/question-bank/ocr_psychology/tag_ocr_psychology.py split [batch-size]
    python3 scripts/question-bank/ocr_psychology/tag_ocr_psychology.py merge
"""
import os, runpy, sys

sys.argv.insert(1, "--psychology")
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ocr_sociology", "tag_ocr_sociology.py"), run_name="__main__")
