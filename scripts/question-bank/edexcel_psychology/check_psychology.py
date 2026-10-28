"""Check the cut Psychology parts' marks against the totals each paper prints.

    python3 scripts/question-bank/edexcel_psychology/check_psychology.py [work-dir]

check_geography.py's check, for Psychology's layout. Every question ends "(Total for
Question 3 = 8 marks)": its cut parts must add up to that. Sections end "TOTAL FOR SECTION
A = 54 MARKS" and the paper "TOTAL FOR PAPER = 90 MARKS". A-Level Paper 2's Section B is
three options ("SECTION B OPTION 1 = 36 MARKS", or "SECTION B: OPTION 1"…), of which students answer one, so it
counts once. Papers that are scans (A-Level Paper 1, June 2019) are read through
cut_pearson's OCR, the text the cut came from.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-psychology")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402


def printed(path):
    """{q: total}, {section: total}, the options' total (or None), the paper's total (or None)."""
    doc = cp.Doc(path)
    text = "\n".join(doc.text(i) for i in range(len(doc.doc)))
    text = re.sub(r"[ \t]+", " ", text)
    questions = {int(q): int(m) for q, m in re.findall(r"Total for Question\s*(\d+)\s*=\s*(\d+)\s*marks?", text, re.I)}
    sections = {s: int(m) for s, m in re.findall(r"TOTAL FOR SECTION ([A-F])\s*=\s*(\d+)\s*MARKS", text, re.I)}
    options = [int(m) for m in re.findall(r"SECTION B:? OPTION \d\s*=\s*(\d+)\s*MARKS", text, re.I)]
    paper = re.search(r"TOTAL FOR PAPER\s*=\s*(\d+)\s*MARKS", text, re.I)
    return questions, sections, options, int(paper.group(1)) if paper else None


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    got = {}
    for p in parts:
        got.setdefault(p["set"], {}).setdefault(int(p["question"]), 0)
        got[p["set"]][int(p["question"])] += p["marks"] or 0
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        if f["kind"] != "qp":
            continue
        set_id = f"{f['component'].replace('-', '')}-{f['series'].lower()}"
        questions, sections, options, paper = printed(os.path.join(WORK, "pdf", f["file"]))
        cut = got.get(set_id, {})
        wrong = [f"Q{q}: cut {cut.get(q)} of {m}" for q, m in sorted(questions.items()) if cut.get(q) != m]
        if set(cut) - set(questions):
            wrong.append(f"questions with no printed total: {sorted(set(cut) - set(questions))}")
        # The paper's total: every section once, and of the options one.
        whole = sum(sections.values()) + (options[0] if options else 0)
        if paper is None:
            wrong.append("no paper total read")
        elif sections and whole != paper:
            wrong.append(f"sections give {whole}, paper prints {paper}")
        elif not sections and sum(questions.values()) != paper:
            wrong.append(f"questions give {sum(questions.values())}, paper prints {paper}")
        if options and len(set(options)) != 1:
            wrong.append(f"options differ: {options}")
        bad += bool(wrong)
        print(f"{set_id}: {paper} marks, {len(cut)} questions" + (f", options of {options[0]}" if options else "") + (" — " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
