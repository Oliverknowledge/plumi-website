#!/usr/bin/env python3
"""Picks parts for a mark-pack round: 1 to 3 marks (4 for maths), own scheme crop, no multiple choice or whole-paper scheme; parts with a shared introduction are included (read with its picture); stratified by
marks and spread across series; deterministic for a seed; skips ids already done.

  python3 scripts/question-bank/markpacks/select_parts.py aqa-gcse-biology 24 [--seed 1] [--exclude ids.txt]
"""
import argparse, json, random, re, subprocess, sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent
BASE = re.search(r'R2_DEV_URL = "([^"]+)"', (HERE.parents[2] / "src/config/papers.ts").read_text()).group(1)

def get(url):
    time.sleep(0.15)
    r = subprocess.run(["curl", "-sS", "--max-time", "60", url], capture_output=True)
    return r.stdout

def candidates(slug):
    meta = json.loads((HERE.parents[2] / "src/content/questionBank" / f"{slug}.json").read_text())
    rows = json.loads(get(f"{BASE}/bank-data/{slug}/parts.{meta['data']['parts']}.json"))
    top = 4 if "maths" in slug else 3
    return [r for r in rows if r.get("m") in range(1, top + 1) and r.get("ms") and not r.get("msq") and not r.get("msf")
            and not r.get("k")], len(rows)      # parts with a shared introduction (st / sk) are read with its picture too

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("slug"); ap.add_argument("n", type=int)
    ap.add_argument("--seed", type=int, default=1); ap.add_argument("--exclude")
    a = ap.parse_args()
    skip = set(Path(a.exclude).read_text().split()) if a.exclude else set()
    pool, total = candidates(a.slug)
    pool = [r for r in pool if r["id"] not in skip]
    random.Random(a.seed).shuffle(pool)
    pick, seen = [], {}
    by_marks = {}
    for r in pool: by_marks.setdefault(r["m"], []).append(r)
    marks = sorted(by_marks); i = 0
    while len(pick) < min(a.n, len(pool)):     # round-robin over mark values, preferring series not yet used
        m = marks[i % len(marks)]; i += 1
        lst = by_marks[m]
        if not lst: continue
        j = next((k for k, r in enumerate(lst) if r["s"] not in seen.get(m, set())), 0)
        r = lst.pop(j); pick.append(r["id"]); seen.setdefault(m, set()).add(r["s"])
    print(json.dumps({"slug": a.slug, "bank_parts": total, "candidates": len(pool) + len(pick), "ids": pick}))
