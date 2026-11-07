#!/usr/bin/env python3
"""Regenerates the board text-layer segments of an already prepared batch (no images fetched, no model calls), after a fix to pdf_text.py.

  python3 scripts/question-bank/markpacks/refresh_text.py <slug> <batchDir> [--cache DIR]

Rewrites <batch>/_tl.json, <batch>/text/<id>.txt and <batch>/outA/_ocr.json (the file the word check reads) and prints how many segments changed. The
readers' outputs are untouched: re-run `wave_step.py verify <batch>` afterwards to see the effect on agreement.
"""
import json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

def main():
    slug, batch = sys.argv[1], Path(sys.argv[2])
    cache = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--cache" else "/tmp/markpack-pdfs"
    old = json.loads((batch / "_tl.json").read_text()) if (batch / "_tl.json").exists() else {}
    r = subprocess.run([sys.executable, str(HERE / "pdf_text.py"), slug, str(batch / "_parts.json"), str(batch / "_tl.json"), "--cache", cache], capture_output=True, text=True)
    print((r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1])
    tl = json.loads((batch / "_tl.json").read_text())
    done = (batch / "ids.txt").read_text().split()
    (batch / "text").mkdir(exist_ok=True)
    for i in done: (batch / "text" / f"{i}.txt").write_text(tl.get(i, ""))
    if (batch / "outA").exists(): (batch / "outA" / "_ocr.json").write_text(json.dumps({i: tl[i] for i in done if tl.get(i)}))
    changed = sum(1 for i in done if tl.get(i, "") != old.get(i, ""))
    print(f"{slug} {batch.name}: {changed} of {len(done)} segments changed")

if __name__ == "__main__": main()
