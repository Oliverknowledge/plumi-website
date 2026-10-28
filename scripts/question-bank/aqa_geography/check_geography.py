"""Check the cut Geography parts' marks against the totals each paper prints, counting the choices.

    python3 scripts/question-bank/aqa_geography/check_geography.py [work-dir]

Every paper's cover prints its total ("The total number of marks available for this
paper is 120"). The papers are choices of whole questions, the same in every series:
  A-Level Paper 1: Question 1, one of 2-4 (deserts, coasts, glaciers), one of 5-6 (hazards, ecosystems)
  A-Level Paper 2: Questions 1 and 2, one of 3-5 (urban, population, resources)
  AS Paper 1:      one of 1-3 (water and carbon, coasts, glaciers), one of 4-5 (hazards, urban)
  AS Paper 2:      Questions 1 and 2, one of 3-4 (two fieldwork investigations)
so every question of a choice must carry the same marks, and the compulsory questions
plus one of each choice the paper's total. Each question's marks are also checked
against the total AQA prints in the examiner's box at its end, where it prints one.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-geography")
CHOICES = {"70371": [["01"], ["02", "03", "04"], ["05", "06"]], "70372": [["01"], ["02"], ["03", "04", "05"]],
           "70361": [["01", "02", "03"], ["04", "05"]], "70362": [["01"], ["02"], ["03", "04"]]}


def printed_total(path):
    text = pymupdf.open(path)[0].get_text()
    return int(re.search(r"total number of marks available for this\s+paper is (\d+)", text).group(1))


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    got = {}
    for p in parts:
        q = got.setdefault(p["set"], {})
        q[p["question"]] = q.get(p["question"], 0) + (p["marks"] or 0)
        if not p["marks"]:
            print(f"  {p['id']}: no marks", file=sys.stderr)
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        set_id = f"{f['component']}-{f['series']}".lower()
        if f["kind"] != "qp" or set_id not in got:
            continue
        total, marks, wrong, counted = printed_total(os.path.join(WORK, "pdf", f["file"])), got[set_id], [], 0
        groups = CHOICES[f["component"]]
        if sorted(marks) != sorted(q for g in groups for q in g):
            wrong.append(f"questions {sorted(marks)}")
        for g in groups:
            each = {marks.get(q) for q in g}
            if len(each) != 1:
                wrong.append(f"choice {g} gives {[marks.get(q) for q in g]}")
            counted += marks.get(g[0]) or 0
        if counted != total:
            wrong.append(f"questions give {counted}")
        bad += bool(wrong)
        print(f"{set_id}: {total} marks, {len(marks)} questions {[marks[q] for q in sorted(marks)]}" + (" — " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
