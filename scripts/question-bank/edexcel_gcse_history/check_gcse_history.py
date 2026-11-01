"""Check the cut Edexcel GCSE History parts against the papers' shapes.

    python3 scripts/question-bank/edexcel_gcse_history/check_gcse_history.py [work-dir]

Every paper's parts, counting one of each choice (a part marked "or" is the other half of the one before) and
leaving out SPaG, should add up to its printed total less the SPaG marks: Paper 1 and Paper 3, 52 less 4;
Paper 2's period and British depth studies, 32 each (June 2018's paired Paper 2, filed under each option, 32 a study).
Each part should have a scheme crop that opens on its own label ("Question 2 (a)"), and each long answer's
(8 marks or more) should run past its levels grid to the indicative content, a page or more. Prints what fails.
"""
import json, os, re, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-history")
EXPECT = {"1": 48, "p": 32, "b": 32, "3": 48}


def kind(comp):
    o = comp[4:]
    return "1" if o[0] == "1" else "3" if o[0] == "3" else o[0]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    sets, bad = {}, 0
    for p in parts:
        sets.setdefault(p["set"], []).append(p)
    for set_id, ps in sorted(sets.items()):
        total = sum(p["marks"] or 0 for p in ps if not p.get("or"))
        want = EXPECT[kind(ps[0]["component"])]
        problems = []
        if total != want:
            problems.append(f"marks {total} (want {want}): " + ", ".join(f"{p['label']}={p['marks']}{'/or' if p.get('or') else ''}" for p in ps))
        for p in ps:
            if not p.get("ms"):
                problems.append(f"{p['label']} has no scheme crop")
                continue
            head = re.sub(r"\s+", "", p.get("msText", "")[:240])
            want_label = re.sub(r"[()]", "", p["label"])
            if want_label not in re.sub(r"[()]", "", head):
                problems.append(f"{p['label']} scheme opens {p.get('msText', '')[:40]!r}")
            if (p["marks"] or 0) >= 8:
                h = Image.open(os.path.join(WORK, "img", p["ms"])).height
                if h < (1000 if p["label"] == "1" and "p" in p["component"] else 1400):
                    problems.append(f"{p['label']} ({p['marks']} marks) scheme only {h}px")
            if not p.get("er"):
                problems.append(f"{p['label']} no report")
        if problems:
            bad += 1
            print(f"{set_id}: " + "; ".join(problems))
    print(f"{len(sets)} papers, {len(parts)} parts; {bad} with something to look at", file=sys.stderr)


if __name__ == "__main__":
    main()
