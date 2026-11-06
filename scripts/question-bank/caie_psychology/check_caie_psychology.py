"""Check that every cut CAIE Psychology paper adds up to Cambridge's printed total (60 marks).

    python3 scripts/question-bank/caie_psychology/check_caie_psychology.py [work-dir]

Papers 1 and 2: every part, 60. Paper 3: four options of 30 marks (Questions 1-4, 5-8, 9-12, 13-16), a student
answering two: 60. Paper 4: Section A is two questions per option (18 marks each option, a student answers two options:
36), Section B one question of 24 from one option: 60. The check counts an option the way a student answers it.
"""
import collections, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "caie-psychology")


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    sets = collections.defaultdict(list)
    for p in parts:
        sets[p["set"]].append(p)
    bad = 0
    for name, ps in sorted(sets.items()):
        num = name.split("-")[0][4:]
        paper = num[1] if num.startswith("0") else num[0]
        by = collections.defaultdict(int)
        for p in ps:
            by[(p.get("option"), int(p["question"]))] += p["marks"] or 0
        if paper in "12":
            total = sum(by.values())
            ok = total == 60
            detail = f"{total}"
        elif paper == "3":
            per = collections.defaultdict(int)
            for (o, _), m in by.items():
                per[o] += m
            ok = set(per.values()) == {30} and len(per) == 4
            detail = f"options {dict(per)} (2 sat = 60)"
        else:
            sec_a = collections.defaultdict(int)
            sec_b = collections.defaultdict(int)
            for (o, q), m in by.items():
                (sec_a if q <= 8 else sec_b)[o] += m
            ok = set(sec_a.values()) == {18} and set(sec_b.values()) == {24} and len(sec_a) == len(sec_b) == 4
            detail = f"Section A {dict(sec_a)}, Section B {dict(sec_b)} (2 A options + 1 B = 60)"
        bad += not ok
        print(f"{'ok ' if ok else 'BAD'} {name}: {len(ps)} parts, {detail}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
