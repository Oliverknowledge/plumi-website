"""Check the cut GCSE Geography parts' marks against the totals each paper prints, counting the choices.

    python3 scripts/question-bank/aqa_gcse_geography/check_gcse_geography.py [work-dir]

Every paper's cover prints its total, SPaG included ("The total number of marks available for
this paper is 88"). The choices are whole questions, the same in every series:
  Paper 1: Questions 1 and 2, and two of 3-5 (coasts, rivers, glacial)
  Paper 2: Questions 1, 2 and 3, and one of 4-6 (food, water, energy)
  Paper 3: every question (Section A's issue evaluation, Section B's fieldwork)
so every question of a choice must carry the same marks, and the compulsory questions plus
the chosen ones the paper's total. June 2022 and November 2021 sat AQA's adapted papers
(fewer fieldwork questions in Paper 3), whose covers print no total: those are listed only.
KNOWN lists the papers whose own printed marks don't add up to their total.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")
CHOICES = {"80351": [(["01"], 1), (["02"], 1), (["03", "04", "05"], 2)],
           "80352": [(["01"], 1), (["02"], 1), (["03"], 1), (["04", "05", "06"], 1)]}
KNOWN = {"80352-jun25": "AQA prints [1 mark] on 04.3, 05.3 and 06.3, but 14 in each question's total box (its scheme gives those parts 2 marks)"}


def printed_total(path):
    m = re.search(r"total number of marks available for this\s+paper is (\d+)", pymupdf.open(path)[0].get_text())
    return int(m.group(1)) if m else None


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    got = {}
    for p in parts:
        q = got.setdefault(p["set"], {})
        q[p["question"]] = q.get(p["question"], 0) + (p["marks"] or 0) + p.get("spag", 0)
        if not p["marks"]:
            print(f"  {p['id']}: no marks", file=sys.stderr)
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        set_id = f"{f['component']}-{f['series']}".lower()
        if f["kind"] != "qp" or set_id not in got:
            continue
        total, marks, wrong = printed_total(os.path.join(WORK, "pdf", f["file"])), got[set_id], []
        groups = CHOICES.get(f["component"], [([q], 1) for q in sorted(marks)])
        if sorted(marks) != sorted(q for g, _ in groups for q in g):
            wrong.append(f"questions {sorted(marks)}")
        counted = 0
        for g, n in groups:
            each = {marks.get(q) for q in g}
            if len(each) != 1:
                wrong.append(f"choice {g} gives {[marks.get(q) for q in g]}")
            counted += (marks.get(g[0]) or 0) * n
        if total is None:
            wrong = [w for w in wrong if not w.startswith("questions")]
            print(f"{set_id}: no total printed, questions give {counted} {[marks[q] for q in sorted(marks)]}" + (" — " + "; ".join(wrong) if wrong else ""), file=sys.stderr)
            bad += bool(wrong)
            continue
        if counted != total:
            wrong.append(f"questions give {counted}")
        if wrong and set_id in KNOWN:
            wrong = [f"known: {KNOWN[set_id]}"] + wrong
            print(f"{set_id}: {total} marks, {len(marks)} questions {[marks[q] for q in sorted(marks)]} — " + "; ".join(wrong), file=sys.stderr)
            continue
        bad += bool(wrong)
        print(f"{set_id}: {total} marks, {len(marks)} questions {[marks[q] for q in sorted(marks)]}" + (" — " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
