"""Cut Pearson Edexcel's International GCSE science papers into question parts, each with its mark scheme rows.

    python3 scripts/question-bank/edexcel_igcse/cut_igcse.py [work-dir] [--only=4bi11b-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-igcse

Pearson sets its International GCSE papers and schemes as it does its GCSEs, so this is
edexcel_gcse/cut_gcse.py (edexcel_sciences/cut_pearson.py with the GCSE schemes' fixes) run on
this bank's papers, with one more patch, here only so no other bank's crops move: the end of a
question paper ("END") is read in capitals, so a diagram's own "end" label (the burette readings in
Chemistry 2CR June 2019) no longer ends a part above it.
Two June 2019 papers are read with hand labels (labels/4ch11c-jun19.json, labels/4ph11p-jun19.json): their
question numbers are pictures (Chemistry 1C's opening pages) or a scan (Physics 1P), which OCR misses.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-igcse")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse"))
from cut_gcse import cp  # noqa: E402

cp.STOP = re.compile(cp.STOP.pattern.replace(r"|END\s*$", r"|(?-i:END)\s*$"), cp.STOP.flags)

if __name__ == "__main__":
    cp.main()
