#!/usr/bin/env python3
"""Reads every prepared text batch of a bank twice with plain (non-thinking) DeepSeek, at two temperatures, then runs the agreement gates. Stops at a dollar ceiling.

  python3 scripts/question-bank/markpacks/run_text_reads.py <rootDir>/<slug> --ceiling 3.5 [--workers 6]

<rootDir>/<slug> holds b01, b02, ... as prepare_text_batch.py makes them. For each batch without readings it runs deepseek_reader.py as reader A (temperature 0) into outA and as
reader B (temperature 0.5) into outB, then `wave_step.py verify`. Spend is counted from the _usage.json files at the app's prices ($0.30 / $1.20 per million tokens in / out) and the run
stops BEFORE a batch that could pass the ceiling (a plain batch of 60 costs about $0.14). Safe to re-run: finished batches are skipped.
"""
import argparse, json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PI, PO = 0.30, 1.20

def spent(batch):
    t = 0.0
    for o in ("outA", "outB"):
        f = batch / o / "_usage.json"
        if f.exists():
            u = json.loads(f.read_text()); t += u["prompt"] / 1e6 * PI + u["completion"] / 1e6 * PO
    return t

def readings(batch, o): return len([f for f in (batch / o).glob("*.json") if not f.name.startswith("_")])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("bank"); ap.add_argument("--ceiling", type=float, default=3.5); ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    batches = sorted(p for p in Path(a.bank).glob("b[0-9][0-9]") if (p / "READY").exists())
    total = sum(spent(b) for b in batches)
    print(f"{len(batches)} batches; already spent in this bank's folders: ${total:.2f}; ceiling ${a.ceiling:.2f}", flush=True)
    for b in batches:
        if readings(b, "outA") > 0 and readings(b, "outB") > 0:
            continue
        if total + 0.20 > a.ceiling: print(f"STOP before {b.name}: ${total:.2f} spent, the next batch could pass the ${a.ceiling:.2f} ceiling", flush=True); break
        for o, temp in (("outA", "0"), ("outB", "0.5")):
            r = subprocess.run([sys.executable, str(HERE / "deepseek_reader.py"), str(b), "--out", o, "--temp", temp, "--workers", str(a.workers), "--max-tokens", "450000"], capture_output=True, text=True)
            print(b.name, o, (r.stdout.strip().splitlines() or [r.stderr.strip()[-160:]])[-1], flush=True)
        total += spent(b)
        v = subprocess.run([sys.executable, str(HERE / "wave_step.py"), "verify", str(b)], cwd=ROOT, capture_output=True, text=True)
        print(b.name, "verify:", (v.stdout.strip().splitlines() or [v.stderr.strip()[-160:]])[-2:], f"| running total ${total:.2f}", flush=True)
    print(f"DONE. total spent in this bank's folders: ${total:.2f}", flush=True)

if __name__ == "__main__": main()
