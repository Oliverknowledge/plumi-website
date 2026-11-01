"""Read AQA A-Level Further Maths (7367)'s topics from its specification.

    python3 scripts/question-bank/aqa_further_maths/spec_further_maths.py <specification.pdf> [work-dir]   # default scripts/question-bank/.work/aqa-further-maths

spec_maths.py for Further Maths. The specification (AQA's own, from the 7367
specification page) lays its content out as lettered sections, each a list of
numbered statements ("C3 ..."): the compulsory content, "3.2.1 A: Proof" to
"3.2.10 J: Numerical methods", then the three optional applications, Mechanics
("3.3.1 MA: Dimensional analysis" to ME), Statistics (SA to SH) and Discrete (DA to
DG). Those sections are the bank's topics, grouped as the papers are: Pure (Papers
1 and 2, AS Paper 1) and the three options a student takes two of (Paper 3, AS
Paper 2), each section tagged with its option for the bank's option filter.
The AS specification (7366) is the same content, less of it, under the same codes.
Writes <work-dir>/spec.json:
  {"sections": [{code, title, option?}], "topics": [{code, title, section, statements: [{code, text}]}]}
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = sys.argv[1]
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-further-maths")
# Not single letters: the topic filter takes section and topic codes alike, and D is a topic here.
SECTIONS = [{"code": "Pure", "title": "Compulsory pure"}, {"code": "Mech", "title": "Mechanics", "option": "M"},
            {"code": "Stats", "title": "Statistics", "option": "S"}, {"code": "Disc", "title": "Discrete", "option": "D"}]
SECTION_OF = {"": "Pure", "M": "Mech", "S": "Stats", "D": "Disc"}
NOISE = re.compile(r"^(Content|Knowledge/skill|A-level Further Mathematics 7367\..*|\d*\s*Visit aqa\.org\.uk.*|\d+)$")
CODES = list("ABCDEFGHIJ") + [f"M{c}" for c in "ABCDE"] + [f"S{c}" for c in "ABCDEFGH"] + [f"D{c}" for c in "ABCDEFG"]


def main():
    text = "\n".join(p.get_text() for p in pymupdf.open(SPEC))
    text = text[text.find("3.2.1 A: Proof"):]
    text = text[:text.find("4 Scheme of assessment")]
    heads = list(re.finditer(r"^3\.[2-5]\.\d+ ([A-J]|[MSD][A-H]): (.+)$", text, re.M))
    topics = []
    for n, h in enumerate(heads):
        code = h.group(1)
        body = text[h.end():heads[n + 1].start() if n + 1 < len(heads) else len(text)]
        body = re.split(r"^3\.[3-5] Optional application", body, flags=re.M)[0]
        lines = [l.strip() for l in body.split("\n") if l.strip() and not NOISE.match(l.strip())]
        statements = []
        for l in lines:
            if re.fullmatch(rf"{code}\d+", l):
                statements.append({"code": l, "text": ""})
            elif statements:
                statements[-1]["text"] = (statements[-1]["text"] + " " + l).strip()
        title = re.sub(r"\s+-\s+", "-", h.group(2)).replace("’", "'").replace("(DRVs)", "").replace("(CRVs)", "")
        title = re.sub(r"\s+", " ", title).strip()
        topics.append({"code": code, "title": title, "section": SECTION_OF[code[0] if len(code) == 2 else ""], "statements": statements})
    assert [t["code"] for t in topics] == CODES, [t["code"] for t in topics]
    assert all(t["statements"] for t in topics), [t["code"] for t in topics if not t["statements"]]
    json.dump({"sections": SECTIONS, "topics": topics}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(topics)} topics, {sum(len(t['statements']) for t in topics)} statements", file=sys.stderr)


if __name__ == "__main__":
    main()
