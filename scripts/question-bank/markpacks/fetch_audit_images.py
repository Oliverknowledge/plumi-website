#!/usr/bin/env python3
"""Fetches the question and scheme pictures an auditor needs, only for the packs that AGREED in a text-only batch (no model calls).

  python3 scripts/question-bank/markpacks/fetch_audit_images.py <slug> <batchDir>

Reads <batch>/agreed/verdicts.json (written by wave_step.py verify) and, for each agreed part, saves <batch>/in/<id>.{qp,ms,stem}.jpg exactly as fetch_batch.py does, then writes
<batch>/audit_ids_all.txt (every agreed id) and splits it in two (audit_ids_p1.txt, audit_ids_p2.txt) so two auditors can share a batch. Gentle on the public address: 2 or 3 small
pictures per agreed part, with the pause extract.get already makes.
"""
import io, json, re, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract

def main():
    slug, batch = sys.argv[1], Path(sys.argv[2])
    verdicts = json.loads((batch / "agreed" / "verdicts.json").read_text())
    ids = sorted(v["id"] for v in verdicts if v["status"] == "agreed")
    rows = {r["id"]: r for r in json.loads((batch / "_parts.json").read_text())}
    meta = json.loads((extract.HERE.parents[2] / "src/content/questionBank" / f"{slug}.json").read_text())
    cv = meta.get("cropVersion") or 0
    (batch / "in").mkdir(exist_ok=True)
    done = []
    for pid in ids:
        r = rows[pid]
        try:
            def save(name, raw): Image.open(io.BytesIO(raw)).convert("RGB").save(batch / "in" / f"{pid}.{name}.jpg", quality=88)
            if not (batch / "in" / f"{pid}.ms.jpg").exists():
                save("qp", extract.get(f"{extract.BASE}/bank/{pid}-qp.webp")); save("ms", extract.get(f"{extract.BASE}/bank/{pid}-ms.webp?v={max(2, cv)}"))
                if r.get("st") or r.get("sk"):
                    sid = r.get("sk") or re.sub(r"-[^-]+$", "", pid)
                    try: save("stem", extract.get(f"{extract.BASE}/bank/{sid}-stem.webp", tries=2))
                    except Exception: pass
            done.append(pid)
        except Exception as e:
            print(pid, "skipped:", str(e)[:80])
    h = (len(done) + 1) // 2
    (batch / "audit_ids_all.txt").write_text("\n".join(done) + "\n")
    (batch / "audit_ids_p1.txt").write_text("\n".join(done[:h]) + "\n"); (batch / "audit_ids_p2.txt").write_text("\n".join(done[h:]) + "\n")
    print(f"{batch.name}: {len(done)} of {len(ids)} agreed parts have pictures; audit lists written")

if __name__ == "__main__": main()
