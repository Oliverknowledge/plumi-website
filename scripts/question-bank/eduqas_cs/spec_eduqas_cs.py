"""Read the topics of Eduqas's A Level Computer Science specification.

    python3 scripts/question-bank/eduqas_cs/spec_eduqas_cs.py [work-dir]

Reads <work-dir>/specs/cs.pdf and cs-as.pdf (fetch_eduqas_cs.py) and writes <work-dir>/spec.json in
spec_eduqas.py's shape: {"cs": {"sections": [{code, title}], "topics": [{code, ref, title, section, year, text}]}}.

The specification numbers each component's topics from 1, bold and at the margin: "1. Data structures"
under Component 1, "1. Hardware and communication" under Component 2. Codes are the component and the
number, "1.1", "2.1". Component 3 is the non-exam project, with no paper, so it has no topics here.

`year` is 1 for a topic the AS specification also has, 2 for A-Level only. The AS numbers its 17 topics
straight through and calls two of them something else (AS_NAMES); its "Practical programming", Component
2's programming task, has no A-Level topic of its own, and its questions go to programming topics.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "eduqas-cs")
SECTIONS = {"1": "Programming and System Development", "2": "Computer Architecture, Data, Communication and Applications"}
AS_NAMES = {"Organisation of data": "Organisation and structure of data", "Database systems": "Databases and distributed systems"}
SHORT = {"Economic, moral, legal, ethical and cultural issues relating to computer science": "Economic, moral, legal and ethical issues",
         "The need for different types of software systems and their attributes": "Types of software systems"}


def lines_of(path, first, last):
    """[(page, x, y, text, bold)] for the subject content's pages. No running heads or page numbers."""
    doc = pymupdf.open(path)
    out = []
    for i in range(first, min(last, len(doc))):
        for block in doc[i].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if text and not re.match(r"^(A LEVEL|AS) COMPUTER SCIENCE \d+|^©", text):
                    out.append((i, line["bbox"][0], line["bbox"][1], text, "Bold" in line["spans"][0]["font"]))
    return sorted(out, key=lambda l: (l[0], round(l[2] / 4), l[1]))


def headings(lines):
    """[(index in lines, number, title)]: a bold "3." with its title beside it, and the title's second line if it has one."""
    out = []
    for n, (pg, x, y, text, bold) in enumerate(lines):
        if bold and re.fullmatch(r"\d{1,2}\.", text):
            beside = [l for l in lines[max(0, n - 2):n + 4] if l[0] == pg and abs(l[2] - y) < 9 and l[4] and l[1] > x + 10]  # (a title can sit a little above its number)
            if not beside:
                continue
            title = beside[0][3]
            below = [l for l in lines[n + 1:n + 5] if l[0] == pg and 9 <= l[2] - y < 16 and l[4] and abs(l[1] - beside[0][1]) < 3]
            if below and not re.search(r"[.:]$", title) and len(below[0][3]) < 30:
                title += " " + below[0][3]
            out.append((n, text[:-1], title))
    return out


def main():
    lines = lines_of(os.path.join(WORK, "specs", "cs.pdf"), 5, 19)
    end = next((n for n, l in enumerate(lines) if re.match(r"2\s*\.?\d? ?Component 3", l[3])), len(lines))
    lines = lines[:end]
    as_titles = {AS_NAMES.get(t, t) for _, _, t in headings(lines_of(os.path.join(WORK, "specs", "cs-as.pdf"), 5, 15))}
    heads = headings(lines)
    topics, section = [], "0"
    for k, (n, num, title) in enumerate(heads):
        if num == "1":
            section = str(int(section) + 1)
        stop = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = " ".join(l[3] for l in lines[n + 1:stop] if l[3] != title and not re.match(r"^(2\s*\.\d Component|Written [Ee]xamination|\d+% of qualification)", l[3]))
        code = f"{section}.{num}"
        topics.append({"code": code, "ref": code, "title": title, **({"short": SHORT[title]} if title in SHORT else {}), "section": section,
                       "year": 1 if title in as_titles else 2, "text": re.sub(r"\s+", " ", body).strip()[:4000]})
    json.dump({"cs": {"sections": [{"code": c, "title": t} for c, t in SECTIONS.items()], "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{len(topics)} topics, {sum(t['year'] == 1 for t in topics)} AS", file=sys.stderr)
    for t in topics:
        print(f"   {t['code']:5} y{t['year']} {t['title'][:70]:70} {len(t['text'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
