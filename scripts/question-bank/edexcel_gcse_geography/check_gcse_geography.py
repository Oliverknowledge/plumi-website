"""Check the cut Geography B parts: their marks against the totals each paper prints, and each scheme crop against its part.

    python3 scripts/question-bank/edexcel_gcse_geography/check_gcse_geography.py [work-dir]

Marks: every question ends "(Total for Question 2 = 34 marks)", which counts its SPaG marks
("(Spelling, punctuation, grammar and use of specialist terminology = 4 marks)"): its cut
parts and that SPaG must add up to it. Each section ends "TOTAL FOR SECTION C1 = 18 MARKS"
and the paper "TOTAL FOR PAPER = 94 MARKS": Paper 2's Sections C1 and C2, where students
answer one of two questions ("Answer EITHER Question 8 OR Question 9"), count one of them.

Schemes: every part has a scheme crop, and the crop opens on the part's own row ("2a (i)",
"2(a)(i)", "2a (i)", or "(a) (ii)" where the number is left off), so no part shows another part's answer.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography")
ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]


def printed(path):
    """{q: total}, {q: SPaG marks}, [(section, total, [questions])], paper total, whether B and C are alternatives."""
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    end = text.find("TOTAL FOR PAPER")
    text = text[:text.find("\n", end) if end >= 0 else None]
    questions = {int(q): int(m) for q, m in re.findall(r"Total for Question\s(\d+) = (\d+) marks?", text)}
    # Each SECTION heading starts a section; its total is printed at its end ("TOTAL FOR SECTION C1 = 18 MARKS"),
    # though not always (June 2024 Paper 2 leaves C1's out).
    spag, sections = {}, []
    for m in re.finditer(r"\nSECTION ([A-D]\d?)\s*\n|Total for Question\s(\d+)|TOTAL FOR SECTION ([A-D]\d?) = (\d+) MARKS|specialist te(?:rminology|chnology) = (\d) marks", text):
        if m.group(1):
            if not any(s[0] == m.group(1) for s in sections):
                sections.append([m.group(1), None, []])
        elif m.group(2):
            if not sections:
                sections.append(["", None, []])
            sections[-1][2].append(int(m.group(2)))
        elif m.group(3):
            sec = next((s for s in sections if s[0] == m.group(3)), None)
            if sec:
                sec[1] = int(m.group(4))
        else:
            # printed just above its question's total
            nxt = re.search(r"Total for Question\s(\d+)", text[m.end():])
            spag[int(nxt.group(1))] = int(m.group(5))
    paper = int(re.search(r"TOTAL FOR PAPER = (\d+) MARKS", text).group(1))
    return questions, spag, sections, paper, bool(re.search(r"EITHER Section B OR Section C", text))


def ms_opens_on(p):
    """Whether the scheme text has the part's own label near its top (after the header row, which can carry the
    question's words: "Question Indicative Content Mark Number Explain one reason… 1(e)(ii)")."""
    t = re.sub(r"\s+", " ", p.get("msText", ""))[:300].lower()
    q, subs = int(p["question"]), re.findall(r"\(([a-z]+)\)", p["label"])
    pat = rf"(?<![\d.])\*?{q}\*?" + "".join(rf"\s?(\({s}\)|{s}(?![a-z]))" for s in subs) + r"(?![a-z\d(])"
    # Or, where the scheme leaves the question's number off ("(a) (ii)", "(g)", "(ii)" under "(e) (i)"), the part's
    # bracketed label; or its pieces set apart, a bracket short ("1bi", "3(c", "2 (a) (ii", "5 (a) … (iii)").
    loose = rf"(?<![\d.]){q}\s?" + r"\s?".join(rf"\(?{s}\)?" for s in subs) + r"(?![a-z])"
    apart = len(subs) == 2 and rf"(?<![\d.]){q}\s?\(?{subs[0]}\)?.{{0,80}}\({subs[1]}\)"
    own = subs and re.search(r"(?<![\w)])" + r"\s?".join(rf"\({s}\)" for s in subs) + r"(?!\s?\()", t[:200])
    lone = len(subs) == 2 and re.match(rf"(question|number|answer|indicative|content|marks?|\s)*\({subs[1]}\)", t)
    return bool(re.search(pat, t) or own or lone or re.search(loose, t) or apart and re.search(apart, t))


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    got = {}
    for p in parts:
        got.setdefault(p["set"], {})
        got[p["set"]][int(p["question"])] = got[p["set"]].get(int(p["question"]), 0) + (p["marks"] or 0)
    bad = 0
    for f in sorted(manifest, key=lambda f: f["file"]):
        if f["kind"] != "qp":
            continue
        set_id = f"{f['component'].replace('-', '')}-{f['series'].lower()}"
        questions, spag, sections, paper, either_section = printed(os.path.join(WORK, "pdf", f["file"]))
        cut = got.get(set_id, {})
        wrong = [f"Q{q}: cut {cut.get(q)} + SPaG {spag.get(q, 0)} of {m}" for q, m in questions.items() if (cut.get(q) or 0) + spag.get(q, 0) != m]
        if set(cut) - set(questions):
            wrong.append(f"questions with no printed total: {sorted(set(cut) - set(questions))}")
        counted = 0
        for sec, total, qs in sections:
            marks = [questions.get(q, 0) for q in qs]
            either = len(marks) == 2 and marks[0] == marks[1]  # EITHER Question 8 OR Question 9
            if total is None:
                total = marks[0] if either else sum(marks)  # not printed: what the questions give
            if sum(marks) == total or either and marks[0] == total:
                counted += total
            else:
                wrong.append(f"section {sec}: questions {qs} give {marks}, printed {total}")
        if either_section and {"B", "C"} <= {s for s, _, _ in sections}:
            counted -= next(total for s, total, _ in sections if s == "C")  # June 2022's Paper 1: Section A, then B or C
        if counted != paper:
            wrong.append(f"sections give {counted}, paper prints {paper}")
        mine = [p for p in parts if p["set"] == set_id]
        no_ms = [p["label"] for p in mine if not p["ms"]]
        # (a part whose row the scheme names otherwise is set by hand in labels/: November 2020 Paper 2 prints "7 (a)"
        # on its one-part question, which the scheme calls "7")
        hand = os.path.join(HERE, "..", "labels", f"{set_id}.json")
        aliased = {tuple(good) for good, _ in json.load(open(hand)).get("ms_alias", [])} if os.path.exists(hand) else set()
        off = [p["label"] for p in mine if p["ms"] and not ms_opens_on(p)
               and (int(p["question"]), *(re.findall(r"\(([a-z]+)\)", p["label"]) + [None, None])[:2]) not in aliased]
        if no_ms:
            wrong.append(f"no scheme: {no_ms}")
        if off:
            wrong.append(f"scheme opens elsewhere: {off}")
        bad += bool(wrong)
        print(f"{set_id}: {paper} marks, {len(mine)} parts" + (" - " + "; ".join(wrong) if wrong else " ok"), file=sys.stderr)
    print(f"{bad} papers with a problem", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
