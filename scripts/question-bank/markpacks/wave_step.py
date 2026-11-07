#!/usr/bin/env python3
"""The per-batch routine of a mark-pack wave, with the rules enforced here rather than remembered. A batch folder holds the two readers' folders
(outA, outB), as prepare_wave.py makes them.

  wave_step.py verify  <batch>          two-reader agreement + gates -> <batch>/agreed ; writes a 12-pack audit sample (audit_ids.txt)
  wave_step.py audit-rest <batch>       when an audit found a problem: every agreed pack not yet audited, in two halves (audit_ids_2a/2b.txt)
  wave_step.py publish <batch> <slug> <out.sql>
                                        the SQL for the packs allowed to go live. The rules:
                                          * every audited pack must be clean; a pack with ANY audit problem is never published
                                          * if the 12-pack sample was all clean, every agreed pack may go; if the sample had a problem, only packs that have
                                            themselves been audited clean may go (so a defect forces a full audit before the rest is loaded)
                                          * a pack the audit never covered is not published in that case
Nothing here touches a database: it writes a .sql file, which is applied separately.
"""
import json, os, random, shutil, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]

def run(*a):
    r = subprocess.run(list(a), cwd=ROOT, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stdout + r.stderr)
    return r.stdout.strip()

def verdicts(b): return json.loads((b / "agreed" / "verdicts.json").read_text())
def agreed(b): return [x["id"] for x in verdicts(b) if x["status"] == "agreed"]
def audits(b):
    out = {}
    for f in (b / "audit").glob("*.json") if (b / "audit").exists() else []:
        r = json.loads(f.read_text()); out[r["id"]] = r
    return out
clean = lambda r: bool(r["ok"]) and r["severity"] == "none"

def verify(b):
    shutil.rmtree(b / "agreed", ignore_errors=True)
    print(run("npx", "tsx", "scripts/question-bank/markpacks/verify_pair.ts", str(b / "outA"), str(b / "outB"), str(b / "agreed")).splitlines()[-1])
    ag = agreed(b); pick = ag[:]; random.Random(5).shuffle(pick); pick = sorted(pick[:12])
    (b / "audit_ids.txt").write_text("\n".join(pick))
    print(f"{len(ag)} agreed of {len(verdicts(b))}; audit sample {len(pick)} written to audit_ids.txt")

def audit_rest(b):
    a = audits(b); rest = sorted(i for i in agreed(b) if i not in a); h = len(rest) // 2
    (b / "audit_ids_2a.txt").write_text("\n".join(rest[:h])); (b / "audit_ids_2b.txt").write_text("\n".join(rest[h:]))
    print(f"{len(rest)} agreed packs not yet audited: halves of {h} and {len(rest) - h}")

def publish(b, slug, out):
    a, ag = audits(b), agreed(b)
    sample = (b / "audit_ids.txt").read_text().split() if (b / "audit_ids.txt").exists() else []
    sample_done = [i for i in sample if i in a]
    if len(sample_done) < len(sample): sys.exit(f"the sample audit is incomplete: {len(sample_done)} of {len(sample)} audited")
    sample_clean = all(clean(a[i]) for i in sample)
    bad = sorted(i for i in a if not clean(a[i]))
    if sample_clean: allowed = [i for i in ag if i not in bad]
    else: allowed = [i for i in ag if i in a and clean(a[i])]
    skipped = [i for i in ag if i not in allowed]
    pub = b / "publish"; shutil.rmtree(pub, ignore_errors=True); pub.mkdir()
    for i in allowed: shutil.copy(b / "agreed" / f"{i}.json", pub / f"{i}.json")
    (pub / "verdicts.json").write_text(json.dumps([x for x in verdicts(b) if x["id"] in set(allowed)]))
    print(f"sample {'clean' if sample_clean else 'HAD A PROBLEM'}; publishing {len(allowed)} of {len(ag)} agreed; held back: {skipped if skipped else 'none'}; audit problems: {bad if bad else 'none'}")
    print(run("npx", "tsx", "scripts/question-bank/markpacks/publish_packs.ts", slug, str(pub), out).splitlines()[-1])

if __name__ == "__main__":
    cmd, b = sys.argv[1], Path(sys.argv[2]).resolve()
    {"verify": lambda: verify(b), "audit-rest": lambda: audit_rest(b), "publish": lambda: publish(b, sys.argv[3], sys.argv[4])}[cmd]()
