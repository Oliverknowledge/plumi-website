"""Check the cut Geography parts' marks against the totals each paper prints.

    python3 scripts/question-bank/edexcel_geography/check_geography.py [work-dir]

Every question ends "(Total for Question 2 = 20 marks)": its cut parts must add up to
that. Each section ends "TOTAL FOR SECTION B = 40 MARKS" and the paper "TOTAL FOR
PAPER = 105 MARKS": a section where students answer one question ("EITHER Question 2
OR Question 3") counts one of them, and AS papers, which answer "Section A and EITHER
Section B OR Section C", count one of those sections, so the totals check the choices too.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-geography")


def printed(path):
    """{q: total}, [(section, total, [questions])], paper total, whether B and C are alternatives."""
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = text[:text.find("Resource Booklet", text.find("TOTAL FOR PAPER"))]
    questions = {int(q): int(m) for q, m in re.findall(r"Total for Question\s(\d+) = (\d+) marks?", text)}
    sections, seen = [], []
    for m in re.finditer(r"Total for Question\s(\d+)|TOTAL FOR SECTION ([A-D]) = (\d+) MARKS", text):
        if m.group(1):
            seen.append(int(m.group(1)))
        else:
            sections.append((m.group(2), int(m.group(3)), seen))
            seen = []
    if seen:  # the last section's total left unprinted (it is the paper's), or a paper with no sections
        sections.append(("", sum(questions.get(q, 0) for q in seen), seen))
    paper = int(re.search(r"TOTAL FOR PAPER = (\d+) MARKS", text).group(1))
    return questions, sections, paper, bool(re.search(r"EITHER Section B OR Section C", text))


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    got = {}
    for p in parts:
        q = got.setdefault(p["set"], {}).setdefault(int(p["question"]), 0)
        got[p["set"]][int(p["question"])] = q + (p["marks"] or 0)
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        if f["kind"] != "qp":
            continue
        set_id = f"{f['component'].replace('-', '')}-{f['series'].lower()}"
        questions, sections, paper, either_section = printed(os.path.join(WORK, "pdf", f["file"]))
        cut = got.get(set_id, {})
        wrong = [f"Q{q}: cut {cut.get(q)} of {m}" for q, m in questions.items() if cut.get(q) != m]
        if set(cut) - set(questions):
            wrong.append(f"questions with no printed total: {sorted(set(cut) - set(questions))}")
        # A section's questions add up to its total, or, where students choose one, each one does.
        merged = {}
        for sec, total, qs in sections:
            merged.setdefault(sec, (total, []))[1].extend(qs)
        counted = 0
        for sec, (total, qs) in merged.items():
            marks = [questions.get(q, 0) for q in qs]
            if sum(marks) == total:
                counted += total
            elif marks and all(m == total for m in marks):
                counted += total  # EITHER … OR …
            else:
                wrong.append(f"section {sec}: questions {qs} give {marks}, printed {total}")
        if either_section and {"B", "C"} <= set(merged):
            counted -= merged["C"][0]
        if counted != paper:
            wrong.append(f"sections give {counted}, paper prints {paper}")
        bad += bool(wrong)
        print(f"{set_id}: {paper} marks, {len(cut)} questions" + (" — " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
