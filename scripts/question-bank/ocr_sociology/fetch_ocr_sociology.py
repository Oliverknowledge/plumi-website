"""Fetch OCR's own A-Level Sociology (H580) papers: ocr_psychology/fetch_ocr_psychology.py --sociology.

    python3 scripts/question-bank/ocr_sociology/fetch_ocr_sociology.py [work-dir]   # default .work/ocr-sociology
"""
import os, runpy, sys

sys.argv.insert(1, "--sociology")
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ocr_psychology", "fetch_ocr_psychology.py"), run_name="__main__")
