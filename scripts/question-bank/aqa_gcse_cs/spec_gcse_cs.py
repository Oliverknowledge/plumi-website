"""Read AQA's GCSE Computer Science (8525) specification into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_cs/spec_gcse_cs.py [work-dir]   # writes <work-dir>/spec.json

The shape spec_cs.py writes for the A-Levels: {"8525": {"sections": [...], "topics": [...]}}.
The sections are the specification's eight areas (3.1 Fundamentals of algorithms … 3.8
Ethical, legal and environmental impacts), the topics their numbered headings (3.2.6 Data
structures; 3.6.2.1 Social engineering), each with the specification's words under it
("text", for tagging only). 3.5 (networks) and 3.8 have no numbered headings: 3.5 is split
here into its five strands (3.5a-e, as OCR's GCSE bank splits 1.2.4), and 3.8 is one topic.
Every topic is GCSE content: "year" is 0.

The topics are the 2020 specification's (version 1.2, from AQA's file store), the one every
paper here but the 2027 specimen was set on. AQA's page now lists the specification for exams
from 2027 (version 1.3), whose headings are the same but which drops star and bus topologies,
optical storage and the Ethernet, Wi-Fi, UDP and FTP protocols.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-cs")
SPEC = "https://filestore.aqa.org.uk/resources/computing/specifications/AQA-8525-SP-2020.PDF"
SECTIONS = {
    "3.1": "Fundamentals of algorithms", "3.2": "Programming", "3.3": "Fundamentals of data representation",
    "3.4": "Computer systems", "3.5": "Fundamentals of computer networks", "3.6": "Cyber security",
    "3.7": "Relational databases and SQL", "3.8": "Ethical, legal and environmental impacts",
}
TITLES = {
    "3.2.10": "Structured programming and subroutines (procedures and functions)",
    "3.7.2": "Structured query language (SQL)",
    "3.8": "Ethical, legal and environmental impacts of digital technology",
}
SHORT = {
    "3.2.3": "Arithmetic operations", "3.2.4": "Relational operations", "3.2.5": "Boolean operations",
    "3.2.8": "String handling", "3.2.9": "Random number generation", "3.2.10": "Subroutines",
    "3.4.4": "Programming languages and translators", "3.6.3": "Detecting and preventing threats",
    "3.8": "Ethical, legal and environmental impacts",
}
# 3.5's strands, each from the line of the specification that opens it to the next one's.
NETWORKS = [
    ("3.5a", "Types of network: PAN, LAN and WAN, wired and wireless", "Types of network", "Define what a computer network is"),
    ("3.5b", "Network topologies: star and bus", "Network topologies", "Describe the following common LAN topologies"),
    ("3.5c", "Network protocols", None, "Define the term network protocol"),
    ("3.5d", "Network security", None, "Understand the need for, and importance of, network security"),
    ("3.5e", "The TCP/IP model", None, "Describe the 4 layer TCP/IP model"),
]
NOISE = re.compile(r"AQA GCSE Computer Science 8525\.[^\n]*\n|Visit aqa\.org\.uk/8525[^\n]*\n|\n\d+\s*\n|Content\s*\nAdditional information\s*\n")


def main():
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, "AQA-8525-SP-2020.PDF")
    if not os.path.exists(path):
        req = urllib.request.Request(SPEC, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    text = NOISE.sub("\n", "\n".join(p.get_text() for p in pymupdf.open(path)))
    text = text[text.find("\n3.1 Fundamentals of algorithms", text.find("3 Subject content\n", 2000)):text.find("\n4 Scheme of assessment", 10000)]
    heads = {}
    for m in re.finditer(r"\n(3\.\d(?:\.\d+){0,2})\s+([^\n]{3,90})", text):
        heads[m.group(1)] = (m.start(), m.end(), m.group(2).strip())  # the body's, after the contents
    order = sorted(heads.items(), key=lambda h: h[1][0])
    topics = []
    for n, (code, (start, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else len(text)
        body = re.sub(r"\s+", " ", text[end:stop]).strip()
        section = ".".join(code.split(".")[:2])
        if code == "3.5":
            starts = [body.find(opening) for *_, opening in NETWORKS] + [len(body)]
            assert all(s >= 0 for s in starts), "a networks strand's opening line has moved"
            topics += [{"code": c, "title": t, **({"short": s} if s else {}), "section": "3.5", "year": 0, "text": body[starts[k]:starts[k + 1]][:4000]}
                       for k, (c, t, s, _) in enumerate(NETWORKS)]
            continue
        if code.count(".") == 1 and code != "3.8":
            continue  # an area with numbered headings under it
        if any(other.startswith(code + ".") for other in heads) and code != "3.6.2":
            continue
        topics.append({"code": code, "title": TITLES.get(code, title), **({"short": SHORT[code]} if code in SHORT else {}),
                       "section": section, "year": 0, "text": body[:4000]})
    json.dump({"8525": {"sections": [{"code": c, "title": t} for c, t in SECTIONS.items()], "topics": topics}},
              open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"8525: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:8} {t['title']}  ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
