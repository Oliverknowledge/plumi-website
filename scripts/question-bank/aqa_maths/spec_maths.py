"""Read AQA A-Level Maths (7357)'s topics from its specification.

    python3 scripts/question-bank/aqa_maths/spec_maths.py <specification.pdf> [work-dir]   # default scripts/question-bank/.work/aqa-maths

The specification (AQA's own, from the 7357 specification page) lays its content
out as 19 lettered sections, "3.2 A: Proof" to "3.20 S: Moments", each a list of
numbered statements ("B3 Work with quadratic functions..."). Those sections are
the bank's topics, as the other maths banks have Proof, Algebra and functions and
the rest; they are grouped, as the papers are, into Pure (A-J), Statistics (K-O)
and Mechanics (P-S). Writes <work-dir>/spec.json:
  {"sections": [{code, title}], "topics": [{code, title, section, statements: [{code, text}]}]}
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = sys.argv[1]
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-maths")
# Not single letters: the topic filter takes section and topic codes alike, and M, P and S are topics here.
SECTIONS = [{"code": "Pure", "title": "Pure mathematics"}, {"code": "Stats", "title": "Statistics"}, {"code": "Mech", "title": "Mechanics"}]
SECTION_OF = {**{c: "Pure" for c in "ABCDEFGHIJ"}, **{c: "Stats" for c in "KLMNO"}, **{c: "Mech" for c in "PQRS"}}
NOISE = re.compile(r"^(Content|AQA A-level Mathematics 7357\..*|\d*\s*Visit for the most up-to-date.*|\d+)$")


def main():
    text = "\n".join(p.get_text() for p in pymupdf.open(SPEC))
    text = text[text.find("3.2 A: Proof", text.find("3.2 A: Proof") + 10):]  # past the contents page
    text = text[:text.find("3.21 Use of data in statistics")]
    heads = list(re.finditer(r"^3\.\d+ ([A-S]): (.+)$", text, re.M))
    topics = []
    for n, h in enumerate(heads):
        body = text[h.end():heads[n + 1].start() if n + 1 < len(heads) else len(text)]
        lines = [l.strip() for l in body.split("\n") if l.strip() and not NOISE.match(l.strip())]
        statements = []
        for l in lines:
            if re.fullmatch(rf"{h.group(1)}\d+", l):
                statements.append({"code": l, "text": ""})
            elif statements:
                statements[-1]["text"] = (statements[-1]["text"] + " " + l).strip()
        title = re.sub(r"\(\s*x\s*,\s*y\s*\)", "(x, y)", h.group(2)).replace("’", "'").strip()
        topics.append({"code": h.group(1), "title": title, "section": SECTION_OF[h.group(1)], "statements": statements})
    assert [t["code"] for t in topics] == list("ABCDEFGHIJKLMNOPQRS"), [t["code"] for t in topics]
    json.dump({"sections": SECTIONS, "topics": topics}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(topics)} topics, {sum(len(t['statements']) for t in topics)} statements", file=sys.stderr)


if __name__ == "__main__":
    main()
