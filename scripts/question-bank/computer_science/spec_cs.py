"""Read OCR's (H446) and AQA's (7517) Computer Science specifications into the banks' topic trees.

    python3 scripts/question-bank/computer_science/spec_cs.py   # writes .work/ocr-cs/spec.json and .work/aqa-cs/spec.json

The shape spec_ocr.py writes: {"H446": {"sections": [...], "topics": [...]}}, each topic
with its code, title, section, year (1 where the AS specification teaches it too, 2 where
only the A-Level does) and the specification's words under it ("text", for tagging only).
  - OCR: the sections are the A-Level's (1.1 The characteristics of contemporary
    processors…, 2.3 Algorithms), the topics its numbered ones (1.1.1 Structure and
    function of the processor). The programming project (3.x) has no paper, so no topics.
    AS (H046) teaches every topic but 1.3.1 (compression, encryption and hashing) and
    2.1.5 (thinking concurrently), some under other numbers; AS questions are tagged with
    the A-Level's codes.
  - AQA: the sections are the A-Level's (4.1 Fundamentals of programming … 4.13 Systematic
    approach to problem solving; 4.14, the project, is left out) and the topics their
    three-number headings (4.2.6 Hash tables). A topic is AS content where the AS
    specification (numbered 3) has a heading of the same name, or (AQA_AS_TOO) teaches it under another.
Section titles are written out here, as some of the PDFs' headings wrap or abbreviate.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work")
OCR_A = "https://www.ocr.org.uk/Images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf"
AQA = "https://cdn.sanity.io/files/p28bar15/green/f166bc32cf15f0544176053d76db4544891e8399.pdf"  # AQA's own CDN, linked from aqa.org.uk
OCR_SECTIONS = {
    "1.1": "Processors, input, output and storage", "1.2": "Software and software development", "1.3": "Exchanging data",
    "1.4": "Data types, data structures and algorithms", "1.5": "Legal, moral, cultural and ethical issues",
    "2.1": "Elements of computational thinking", "2.2": "Problem solving and programming", "2.3": "Algorithms",
}
OCR_A_LEVEL_ONLY = {"1.3.1", "2.1.5"}
AQA_SECTIONS = {
    "4.1": "Fundamentals of programming", "4.2": "Fundamentals of data structures", "4.3": "Fundamentals of algorithms",
    "4.4": "Theory of computation", "4.5": "Fundamentals of data representation", "4.6": "Fundamentals of computer systems",
    "4.7": "Computer organisation and architecture", "4.8": "Consequences of uses of computing",
    "4.9": "Communication and networking", "4.10": "Fundamentals of databases", "4.11": "Big Data",
    "4.12": "Fundamentals of functional programming", "4.13": "Systematic approach to problem solving",
}
# AS content under another AS heading: procedural programming (AS 3.1.2) and finite state machines (AS 3.4.2).
AQA_AS_TOO = {"4.1.2", "4.4.2"}
TITLES = {"4.8.1": "Individual, social, legal and cultural issues and opportunities", "4.9.4": "TCP/IP",
          "4.10.1": "Conceptual data models and entity relationship modelling", "1.2.1": "Systems software",
          "1.2.2": "Applications generation", "1.2.3": "Software development", "1.2.4": "Types of programming language",
          "1.3.1": "Compression, encryption and hashing", "1.4.1": "Data types", "1.4.2": "Data structures",
          "1.4.3": "Boolean algebra", "1.5.2": "Moral and ethical issues"}
SHORT = {"4.10.1": "Entity relationship modelling", "4.8.1": "Social, legal and cultural issues"}


def fetch(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def headings(text, pattern, keep):
    """The body's heading for each code (its last appearance: the contents page lists them first), in order."""
    found = {}
    for m in re.finditer(pattern, text):
        if keep(m.group(1)):
            found[m.group(1)] = (m.start(), m.end(), m.group(2).strip())
    return sorted(((code, *v) for code, v in found.items()), key=lambda h: h[1])


def topics_from(text, heads, section_of, year_of):
    out = []
    for n, (code, start, end, title) in enumerate(heads):
        stop = heads[n + 1][1] if n + 1 < len(heads) else min(len(text), end + 6000)
        body = re.sub(r"\s+", " ", text[end:stop]).strip()[:4000]
        out.append({"code": code, "title": TITLES.get(code, title), **({"short": SHORT[code]} if code in SHORT else {}),
                    "section": section_of(code), "year": year_of(code, title), "text": body})
    return out


def ocr():
    d = os.path.join(WORK, "ocr-cs")
    os.makedirs(d, exist_ok=True)
    text = "\n".join(p.get_text() for p in pymupdf.open(fetch(OCR_A, os.path.join(d, os.path.basename(OCR_A)))))
    text = text[:text.rfind("3.1.1")]  # the programming project's criteria follow the content
    text = re.sub(r"© OCR \d{4}[^\n]*\n|A Level in Computer Science[^\n]*\n", "\n", text)
    heads = headings(text, r"\n\s*([12]\.\d\.\d)\s*\n?\s*([A-Z][^\n]{3,90})", lambda c: c[:3] in OCR_SECTIONS)
    topics = topics_from(text, heads, lambda c: c[:3], lambda c, t: 2 if c in OCR_A_LEVEL_ONLY else 1)
    json.dump({"H446": {"sections": [{"code": c, "title": t} for c, t in OCR_SECTIONS.items()], "topics": topics}},
              open(os.path.join(d, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"H446: {len(topics)} topics in {len(OCR_SECTIONS)} sections", file=sys.stderr)


def aqa():
    d = os.path.join(WORK, "aqa-cs")
    os.makedirs(d, exist_ok=True)
    text = "\n".join(p.get_text() for p in pymupdf.open(fetch(AQA, os.path.join(d, "AQA-7516-7517-SP-2015.PDF"))))
    as_titles = {re.sub(r"\W+", " ", t).strip().lower() for t in re.findall(r"\n3\.\d+\.\d+\s+([^\n]+)", text)}
    body = text[:text.rfind("\n4.14.1")]
    heads = headings(body, r"\n(4\.\d+\.\d+)\s+([^\n]{3,90})", lambda c: ".".join(c.split(".")[:2]) in AQA_SECTIONS)
    topics = topics_from(body, heads, lambda c: ".".join(c.split(".")[:2]),
                         lambda c, t: 1 if c in AQA_AS_TOO or re.sub(r"\W+", " ", t).strip().lower() in as_titles else 2)
    json.dump({"7517": {"sections": [{"code": c, "title": t} for c, t in AQA_SECTIONS.items()], "topics": topics}},
              open(os.path.join(d, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7517: {len(topics)} topics in {len(AQA_SECTIONS)} sections, {sum(t['year'] == 1 for t in topics)} also AS", file=sys.stderr)


if __name__ == "__main__":
    ocr()
    aqa()
