#!/usr/bin/env python3
"""Prepares a whole wave of reading batches from a list of part ids per bank (no model calls, no cost).

  python3 scripts/question-bank/markpacks/prepare_wave.py <wave.json> <outRoot> [--per-batch 60] [--only slug,slug]

<wave.json> is {slug: [partId, ...]} (for example the parts students have actually attempted that the pipeline can read). For each bank it
writes <outRoot>/<slug>/b01, b02, ... each holding up to 60 parts as fetch_batch.py does, plus the reader prompt, four chunk files of 15 ids
(one Claude reader takes one chunk) and empty outA / outB folders (reader A and reader B write there independently).
Fetches gently through the public address (the bank's bucket has no key here): one bank at a time, and it skips a batch that is already prepared.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("wave"); ap.add_argument("out")
    ap.add_argument("--per-batch", type=int, default=60); ap.add_argument("--only")
    a = ap.parse_args()
    wave = json.loads(Path(a.wave).read_text())
    only = set(a.only.split(",")) if a.only else None
    for slug, ids in wave.items():
        if only and slug not in only: continue
        for n, start in enumerate(range(0, len(ids), a.per_batch), 1):
            d = Path(a.out) / slug / f"b{n:02d}"
            if (d / "READY").exists(): continue
            d.mkdir(parents=True, exist_ok=True)
            chunk = ids[start:start + a.per_batch]
            (d / "want.txt").write_text("\n".join(chunk))
            r = subprocess.run([sys.executable, str(HERE / "fetch_batch.py"), slug, str(len(chunk)), str(d), "--ids", str(d / "want.txt")], capture_output=True, text=True)
            print(slug, f"b{n:02d}", r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()[-200:], flush=True)
            done = (d / "ids.txt").read_text().split() if (d / "ids.txt").exists() else []
            if not done: continue
            shutil.copy(HERE / "extraction_prompt_v4.txt", d / "prompt.txt")
            for k in range(4): (d / f"chunk{k}.txt").write_text("\n".join(done[k::4]))
            (d / "outA").mkdir(exist_ok=True); (d / "outB").mkdir(exist_ok=True)
            shutil.copy(d / "_parts.json", d / "outA" / "_parts.json")
            # the word check runs against the BOARD's own text layer (a part whose scheme could not be located is left out, and is then held), as in the earlier rounds
            tl = json.loads((d / "_tl.json").read_text()) if (d / "_tl.json").exists() else {}
            (d / "outA" / "_ocr.json").write_text(json.dumps({i: tl[i] for i in done if tl.get(i)}))
            (d / "READY").write_text("ok")

if __name__ == "__main__": main()
