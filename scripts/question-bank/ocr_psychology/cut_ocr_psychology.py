"""Cut OCR's A-Level Psychology (H567) papers into questions, each with its mark scheme.

    python3 scripts/question-bank/ocr_psychology/cut_ocr_psychology.py [work-dir] [--only=h56701-jun24]
    # work-dir: .work/ocr-psychology (fetch_ocr_psychology.py); needs: pip install pymupdf pillow

ocr_sociology/cut_ocr_sociology.py, run on Psychology's papers: ocr_economics/cut_ocr_economics.py
cuts them, with Sociology's options, copyright boxes and scheme headers on top. What that means here:
  - Paper 1's Sections B and C open with a study ("Slipping up can be good", its data table): the block
    before a section's first question is the stem of all its questions. Whole questions are named for
    the block, "h56701-jun24-e1-19", sharing "h56701-jun24-e1-stem.webp"; a question with parts has its
    own stem, the block and its own opening words ("h56701-jun24-29-stem.webp");
  - Paper 1's multiple-choice questions are answered by the key at the head of its scheme;
  - Paper 3's Section B options ("OPTION 1" / "Child psychology") tag their questions, "child";
  - Paper 2's Section C article, where OCR left it out for copyright (June 2024 and 2025), says so.
"""
import os, runpy, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if not [a for a in sys.argv[1:] if not a.startswith("--")]:
    sys.argv.insert(1, os.path.join(HERE, "..", ".work", "ocr-psychology"))
runpy.run_path(os.path.join(HERE, "..", "ocr_sociology", "cut_ocr_sociology.py"), run_name=__name__)  # (in a worker, "__mp_main__": the patches, not the run)
