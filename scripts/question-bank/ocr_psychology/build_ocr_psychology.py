"""Write the OCR A-Level Psychology bank's data files: ocr_sociology/build_ocr_sociology.py --psychology.

    python3 scripts/question-bank/ocr_psychology/build_ocr_psychology.py
"""
import os, runpy, sys

sys.argv.insert(1, "--psychology")
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ocr_sociology", "build_ocr_sociology.py"), run_name="__main__")
