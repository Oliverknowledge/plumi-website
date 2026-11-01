"""Read OCR's GCSE Computer Science (J277) specification into the bank's topic tree.

    python3 scripts/question-bank/ocr_gcse_cs/spec_ocr_gcse_cs.py [work-dir]   # writes <work-dir>/spec.json

The shape computer_science/spec_cs.py writes: {"J277": {"sections": [...], "topics": [...]}}.
The sections are the specification's topics (1.1 Systems architecture … 2.5 Programming
languages and IDEs); J277/01 sets 1.x, J277/02 sets 2.x. The topics are its numbered sub topics
(1.1.1 Architecture of the CPU), each with the specification's words under it ("text", for
tagging only), except 1.2.4 Data storage, which the specification sets under four headings of
its own (Numbers, Characters, Images, Sound) and which is a topic for each here: 1.2.4a to
1.2.4d. Titles are written out here, as some of the PDF's wrap. Every topic is GCSE content:
"year" is 0.
"""
import json, os, re, subprocess, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-cs")
SPEC = "https://www.ocr.org.uk/Images/558027-specification-gcse-computer-science-j277.pdf"
SECTIONS = {
    "1.1": "Systems architecture", "1.2": "Memory and storage", "1.3": "Computer networks, connections and protocols",
    "1.4": "Network security", "1.5": "Systems software", "1.6": "Ethical, legal, cultural and environmental impacts",
    "2.1": "Algorithms", "2.2": "Programming fundamentals", "2.3": "Producing robust programs", "2.4": "Boolean logic",
    "2.5": "Programming languages and IDEs",
}
TITLES = {
    "1.1.1": "Architecture of the CPU", "1.1.2": "CPU performance", "1.1.3": "Embedded systems",
    "1.2.1": "Primary storage (memory)", "1.2.2": "Secondary storage", "1.2.3": "Units and file sizes",
    "1.2.4a": "Storing numbers: binary, hexadecimal and shifts", "1.2.4b": "Storing characters",
    "1.2.4c": "Storing images", "1.2.4d": "Storing sound", "1.2.5": "Compression",
    "1.3.1": "Networks and topologies", "1.3.2": "Wired and wireless networks, protocols and layers",
    "1.4.1": "Threats to computer systems and networks", "1.4.2": "Identifying and preventing vulnerabilities",
    "1.5.1": "Operating systems", "1.5.2": "Utility software",
    "1.6.1": "Ethical, legal, cultural and environmental impact",
    "2.1.1": "Computational thinking", "2.1.2": "Designing, creating and refining algorithms",
    "2.1.3": "Searching and sorting algorithms",
    "2.2.1": "Variables, constants, operators and constructs", "2.2.2": "Data types and casting",
    "2.2.3": "Additional programming techniques",
    "2.3.1": "Defensive design", "2.3.2": "Testing",
    "2.4.1": "Boolean logic",
    "2.5.1": "Languages and translators", "2.5.2": "The Integrated Development Environment (IDE)",
}
DATA_STORAGE = {"1.2.4a": "Numbers", "1.2.4b": "Characters", "1.2.4c": "Images", "1.2.4d": "Sound"}
NOISE = re.compile(r"Version [\d.]+ © Cambridge OCR \d{4}\s*\d*\s*Cambridge OCR Level 1/Level 2 GCSE \(9-1\) in Computer Science"
                   r"|\b\d[a-c]\.\s+Content of [^\n]*|Sub topic\s+Guidance|[¨üû§•]\t?|^o\t", re.M)  # the spec's bullets, "o⇥" among them


def main():
    os.makedirs(os.path.join(WORK, "raw"), exist_ok=True)
    path = os.path.join(WORK, "raw", "spec-j277.pdf")
    if not os.path.exists(path):
        subprocess.run(["curl", "-sfL", "-A", "Mozilla/5.0", "-o", path, SPEC], check=True)
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    start = text.find("1.1 – Systems architecture")
    text = text[start:text.find("2d.", start)]  # (from the content to "2d. Practical Programming skills")
    text = re.sub(r"\s+", " ", NOISE.sub(" ", text))
    starts = sorted((text.find(f" {c[:5]} " if c[:5] != "1.1.1" else "1.1.1"), c) for c in TITLES if len(c) == 5 or c == "1.2.4a")
    # 1.2.4's headings, each found after the one before it
    heads, at = {}, text.find(" 1.2.4 ")
    for c, name in DATA_STORAGE.items():
        at = heads[c] = text.find(f" {name} ", at)
    topics = []
    for code, title in TITLES.items():
        if code in DATA_STORAGE:
            a = heads[code]
            b = min([h for h in heads.values() if h > a] + [text.find(" 1.2.5 ")])
        else:
            a = text.find(f" {code} ") if code != "1.1.1" else text.find("1.1.1")
            b = min([s for s, _ in starts if s > a] + [len(text)])
        assert a >= 0, code
        words = re.sub(r"^\s*(\d\.\d\.\d\s+)?", "", text[a:b]).strip()
        # the running header, and the page numbers and section heading the next sub topic sits under
        words = re.sub(r"\s*(\d\s+)?Version [\d.]+ © Cambridge OCR \d{4}(\s+\d+)?|\s*Cambridge OCR Level 1/Level 2 GCSE \(9-1\) in Computer Science", " ", words)
        words = re.sub(r"(\s+\d{1,2})*(\s+\d\.\d – .*|\s+Integrated Development Environments)?\s*$", "", words).strip()
        topics.append({"code": code, "title": title, "section": code[:3], "year": 0, "text": words})
    json.dump({"J277": {"sections": [{"code": c, "title": t} for c, t in SECTIONS.items()], "topics": topics}},
              open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"J277: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)


if __name__ == "__main__":
    main()
