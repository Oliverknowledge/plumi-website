#!/usr/bin/env python3
"""Prepares a reading batch for the Claude readers (no model calls, no cost): picks parts, downloads each part's question, scheme and
(if any) shared-introduction pictures as JPEGs, and writes the bank rows, the bank OCR and the board text-layer segments.

  python3 scripts/question-bank/markpacks/fetch_batch.py aqa-a-level-biology 60 /tmp/batch --seed 11 --text-only [--exclude ids.txt]

--text-only drops parts whose question words suggest a figure, table, drawing, tick-box or calculation (a crude filter on the bank's text; the
readers' own flags and the gates decide for real). It biases the batch toward parts the text marker could take: say so when you report a result.
Writes <out>/in/<id>.{qp,ms,stem}.jpg, <out>/_parts.json, <out>/_ocr.json (bank OCR), <out>/_tl.json (text-layer segments), <out>/ids.txt.
The bank's public address is rate limited and students use it: this fetches 2 or 3 small pictures per part, gently.
"""
import argparse, io, json, random, re, subprocess, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract, select_parts, pdf_text

BAD = re.compile(r"figure|table|graph|diagram|shown|draw|tick|calculate|chart|plot|image|micrograph|photograph|complete|name the|label", re.I)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("slug"); ap.add_argument("n", type=int); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=1); ap.add_argument("--exclude"); ap.add_argument("--text-only", action="store_true")
    a = ap.parse_args()
    skip = set(Path(a.exclude).read_text().split()) if a.exclude else set()
    pool, total = select_parts.candidates(a.slug)
    pool = [r for r in pool if r["id"] not in skip and not (a.text_only and BAD.search(r.get("x") or ""))]
    random.Random(a.seed).shuffle(pool)
    by_marks = {}
    for r in pool: by_marks.setdefault(r["m"], []).append(r)
    pick, seen, marks, i = [], {}, sorted(by_marks), 0
    while len(pick) < min(a.n, len(pool)):          # round-robin over mark values, preferring series not yet used
        m = marks[i % len(marks)]; i += 1
        lst = by_marks[m]
        if not lst: continue
        j = next((k for k, r in enumerate(lst) if r["s"] not in seen.get(m, set())), 0)
        r = lst.pop(j); pick.append(r); seen.setdefault(m, set()).add(r["s"])
    out = Path(a.out); (out / "in").mkdir(parents=True, exist_ok=True)
    meta = json.loads((extract.HERE.parents[2] / "src/content/questionBank" / f"{a.slug}.json").read_text())
    cv, data = meta.get("cropVersion") or 0, meta["data"]
    rows = {r["id"]: r for r in json.loads(extract.get(f"{extract.BASE}/bank-data/{a.slug}/parts.{data['parts']}.json"))}
    text = json.loads(extract.get(f"{extract.BASE}/bank-data/{a.slug}/text.{data['text']}.json"))
    done = []
    for r in pick:
        pid = r["id"]
        try:
            def save(name, raw): Image.open(io.BytesIO(raw)).convert("RGB").save(out / "in" / f"{pid}.{name}.jpg", quality=88)
            save("qp", extract.get(f"{extract.BASE}/bank/{pid}-qp.webp")); save("ms", extract.get(f"{extract.BASE}/bank/{pid}-ms.webp?v={max(2, cv)}"))
            if r.get("st") or r.get("sk"):
                sid = r.get("sk") or re.sub(r"-[^-]+$", "", pid)
                try: save("stem", extract.get(f"{extract.BASE}/bank/{sid}-stem.webp", tries=2))
                except Exception: pass
            done.append(pid)
        except Exception as e: print(pid, "skipped:", str(e)[:80])
    parts = [rows[i] for i in done]
    (out / "_parts.json").write_text(json.dumps(parts)); (out / "_ocr.json").write_text(json.dumps({i: text.get(i, "") for i in done}))
    (out / "ids.txt").write_text("\n".join(done))
    (out / "_parts_file.json").write_text(json.dumps(parts))
    r = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "pdf_text.py"), a.slug, str(out / "_parts.json"), str(out / "_tl.json"), "--cache", "/tmp/markpack-pdfs"], capture_output=True, text=True)
    print(r.stdout.strip()[-600:])
    tl = json.loads((out / "_tl.json").read_text()) if (out / "_tl.json").exists() else {}
    (out / "text").mkdir(exist_ok=True)
    for i in done: (out / "text" / f"{i}.txt").write_text(tl.get(i, ""))
    print(f"{len(done)} parts prepared in {out}; text-layer segment for {sum(1 for i in done if tl.get(i))}")

if __name__ == "__main__": main()
