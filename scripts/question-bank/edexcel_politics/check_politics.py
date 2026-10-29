"""Check the cut Politics parts' marks against the total each paper prints.

    python3 scripts/question-bank/edexcel_politics/check_politics.py [work-dir]

check_psychology.py's check, for Politics' choices. Every question is "EITHER (a) OR (b)" (or a single
question) with the same marks for each choice, so a question counts once. Students answer every question
except: A-Level Paper 2's Section B, one of Questions 3 to 7 (the optional idea they study), and Paper 3's
Section C, two of 3(a), 3(b) and 3(c). The paper prints "The total mark for this paper is 84." on its cover.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-politics")


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for p in parts:
        sets.setdefault(p["set"], {}).setdefault(int(p["question"]), []).append(p["marks"])
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        if f["kind"] != "qp":
            continue
        set_id = f"{f['component'].replace('-', '')}-{f['series'].lower()}"
        cover = pymupdf.open(os.path.join(WORK, "pdf", f["file"]))[0].get_text()
        printed = int(re.search(r"total mark for this paper is (\d+)", cover).group(1))
        qs = sets.get(set_id, {})
        wrong = [f"Q{q}: choices of {sorted(set(m))} marks" for q, m in qs.items() if len(set(m)) != 1 or None in m]
        once = {q: m[0] or 0 for q, m in qs.items()}
        paper = set_id.split("-")[0]
        if paper == "9pl002":
            options = {q: m for q, m in once.items() if q >= 3}
            total = sum(m for q, m in once.items() if q < 3) + (max(options.values()) if options else 0)
            if len(options) != 5:
                wrong.append(f"{len(options)} optional ideas, not 5")
        elif paper.startswith("9pl03"):
            total = sum(once.values()) + once.get(3, 0)  # two essays from Section C
            if len(qs.get(3, [])) != 3:
                wrong.append(f"Section C has {len(qs.get(3, []))} essays, not 3")
        else:
            total = sum(once.values())
        if total != printed:
            wrong.append(f"cut {total} of {printed}")
        bad += bool(wrong)
        print(f"{set_id}: {printed} marks, {sum(len(m) for m in qs.values())} parts" + (" — " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
