#!/usr/bin/env python3
"""Prepares TEXT-ONLY reading batches for a whole bank: no pictures fetched, no model calls, no cost. Images are fetched later, only for the packs that need an audit.

  python3 scripts/question-bank/markpacks/prepare_text_batch.py <slug> <outRoot> [--per-batch 60] [--exclude ids.txt] [--limit N]

For every readable part of the bank (1 to 3 marks, own scheme, no multiple choice; select_parts.candidates) that is not in --exclude (for example the ids that already have a live
pack), writes <outRoot>/<slug>/b01, b02, ... each holding up to 60 parts: _parts.json, _ocr.json (the bank's OCR: question then scheme), text/<id>.txt (the board's own text layer for
the scheme, cut by pdf_text.py), ids.txt, prompt.txt (extraction_prompt_text_v5.txt) and empty outA / outB for the two readers (deepseek_reader.py). Reads the bank's two small data files
and the board's whole-paper scheme PDFs (one per paper, cached) gently through the public address: AGENTS.md says bulk reads go through the S3 API, and this is one file per paper, not one per part.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import extract, select_parts

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("slug"); ap.add_argument("out")
    ap.add_argument("--per-batch", type=int, default=60); ap.add_argument("--exclude"); ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    skip = set(Path(a.exclude).read_text().split()) if a.exclude else set()
    pool, _ = select_parts.candidates(a.slug)
    pool = sorted((r for r in pool if r["id"] not in skip), key=lambda r: (r["p"], r["s"], r["id"]))   # same paper together: one scheme PDF read per paper
    if a.limit: pool = pool[:a.limit]
    meta = json.loads((HERE.parents[2] / "src/content/questionBank" / f"{a.slug}.json").read_text()); data = meta["data"]
    text = json.loads(extract.get(f"{extract.BASE}/bank-data/{a.slug}/text.{data['text']}.json"))
    print(f"{a.slug}: {len(pool)} parts to prepare in batches of {a.per_batch}", flush=True)
    for n, start in enumerate(range(0, len(pool), a.per_batch), 1):
        d = Path(a.out) / a.slug / f"b{n:02d}"
        if (d / "READY").exists(): continue
        chunk = pool[start:start + a.per_batch]; ids = [r["id"] for r in chunk]
        for sub in ("text", "outA", "outB"): (d / sub).mkdir(parents=True, exist_ok=True)
        (d / "_parts.json").write_text(json.dumps(chunk)); (d / "_ocr.json").write_text(json.dumps({i: text.get(i, "") for i in ids}))
        (d / "ids.txt").write_text("\n".join(ids))
        r = subprocess.run([sys.executable, str(HERE / "pdf_text.py"), a.slug, str(d / "_parts.json"), str(d / "_tl.json"), "--cache", "/tmp/markpack-pdfs"], capture_output=True, text=True)
        tl = json.loads((d / "_tl.json").read_text()) if (d / "_tl.json").exists() else {}
        for i in ids: (d / "text" / f"{i}.txt").write_text(tl.get(i, ""))
        shutil.copy(HERE / "extraction_prompt_text_v5.txt", d / "prompt.txt")
        shutil.copy(d / "_parts.json", d / "outA" / "_parts.json")
        (d / "outA" / "_ocr.json").write_text(json.dumps({i: tl[i] for i in ids if tl.get(i)}))   # the word check runs against the board's text layer, as in every earlier round
        (d / "READY").write_text("ok")
        print(f"b{n:02d}: {len(ids)} parts, board text located for {sum(1 for i in ids if tl.get(i))}", flush=True)

if __name__ == "__main__": main()
