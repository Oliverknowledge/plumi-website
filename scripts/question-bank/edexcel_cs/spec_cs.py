"""Read Pearson Edexcel's GCSE Computer Science (1CP2) specification into the bank's topic tree.

    python3 scripts/question-bank/edexcel_cs/spec_cs.py [work-dir]   # writes <work-dir>/spec.json

The shape spec_cs.py writes for OCR and AQA: {"1CP2": {"sections": [...], "topics": [...]}}.
The sections are the specification's subject headings (1.2 Algorithms, 4.1 Networks), under
its six topics; Paper 1 sets Topics 1 to 5, Paper 2 Topic 6. The topics are its numbered points
(2.1.3 be able to convert between denary and 8-bit binary numbers), each with a short title
written here, since the specification gives the points none, and its words ("text", for
tagging only). Every point is GCSE content: "year" is 0.
"""
import json, os, re, subprocess, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-cs")
SPEC = "https://qualifications.pearson.com/content/dam/pdf/GCSE/Computer%20Science/2020/specification-and-sample-assessments/GCSE_L1_L2_Computer_Science_2020_Specification.pdf"
SECTIONS = {
    "1.1": "Decomposition and abstraction", "1.2": "Algorithms", "1.3": "Truth tables",
    "2.1": "Binary", "2.2": "Data representation", "2.3": "Data storage and compression",
    "3.1": "Hardware", "3.2": "Software", "3.3": "Programming languages",
    "4.1": "Networks", "4.2": "Network security",
    "5.1": "Environmental issues", "5.2": "Ethical and legal issues", "5.3": "Cybersecurity",
    "6.1": "Develop code", "6.2": "Constructs", "6.3": "Data types and structures", "6.4": "Input and output",
    "6.5": "Operators", "6.6": "Subprograms",
}
TITLES = {
    "1.1.1": "Decomposition and abstraction", "1.1.2": "Benefits of subprograms",
    "1.2.1": "Following and writing algorithms", "1.2.2": "Variables, constants and data structures in algorithms",
    "1.2.3": "Arithmetic, relational and logical operators", "1.2.4": "Trace tables and algorithm output",
    "1.2.5": "Types of error", "1.2.6": "Sorting and searching algorithms", "1.2.7": "Evaluating algorithms",
    "1.3.1": "Truth tables",
    "2.1.1": "Binary and number of states", "2.1.2": "Unsigned and two’s complement integers",
    "2.1.3": "Converting denary and binary", "2.1.4": "Binary addition and shifts", "2.1.5": "Overflow",
    "2.1.6": "Hexadecimal",
    "2.2.1": "ASCII", "2.2.2": "Bitmap images", "2.2.3": "Sound", "2.2.4": "Limits of binary representation",
    "2.3.1": "Units and file size calculations", "2.3.2": "Compression",
    "3.1.1": "The CPU and the fetch-decode-execute cycle", "3.1.2": "Secondary storage", "3.1.3": "Embedded systems",
    "3.2.1": "Operating systems", "3.2.2": "Utility software", "3.2.3": "Robust software",
    "3.3.1": "Low-level and high-level languages", "3.3.2": "Interpreters and compilers",
    "4.1.1": "Why computers are networked", "4.1.2": "LANs and WANs", "4.1.3": "Structure of the internet",
    "4.1.4": "Wired and wireless connectivity", "4.1.5": "Network speed calculations", "4.1.6": "Protocols",
    "4.1.7": "The TCP/IP model", "4.1.8": "Network topologies",
    "4.2.1": "Network security",
    "5.1.1": "Environmental issues",
    "5.2.1": "Personal data", "5.2.2": "AI, machine learning and robotics", "5.2.3": "Intellectual property",
    "5.3.1": "Malware and cyberattacks", "5.3.2": "Protecting digital systems",
    "6.1.1": "Decomposition and abstraction in programs", "6.1.2": "Reading, writing and refining programs",
    "6.1.3": "Algorithms into programs", "6.1.4": "Readable code", "6.1.5": "Finding and fixing errors",
    "6.1.6": "Testing and evaluating programs",
    "6.2.1": "Structural components of programs", "6.2.2": "Sequence, selection, repetition and iteration",
    "6.3.1": "Data types, arrays and records", "6.3.2": "Variables and constants", "6.3.3": "String manipulation",
    "6.4.1": "User input", "6.4.2": "Reading and writing files", "6.4.3": "Validation", "6.4.4": "Authentication",
    "6.5.1": "Arithmetic operators", "6.5.2": "Relational operators", "6.5.3": "Logical operators",
    "6.6.1": "Built-in, library and user-devised subprograms", "6.6.2": "Functions and procedures",
    "6.6.3": "Global and local variables",
}


def main():
    os.makedirs(os.path.join(WORK, "raw"), exist_ok=True)
    path = os.path.join(WORK, "raw", os.path.basename(SPEC).replace("%20", " "))
    if not os.path.exists(path):
        subprocess.run(["curl", "-sfL", "-A", "Mozilla/5.0", "-o", path, SPEC], check=True)
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = text[text.find("Subject content"):text.find("Onscreen problem solving with programming")]
    text = re.sub(r"Pearson Edexcel Level 1/Level 2 GCSE[^\n]*\n[^\n]*\n\s*\d+\s*\n", " ", text)
    text = re.sub(r"\*In this specification, the term.*?syntax\.", " ", re.sub(r"\s+", " ", text))
    topics = []
    for code, title in TITLES.items():
        # the point's words run to the next number: "2.1.4", a heading's "2.2 Data representation" or "Topic 3:"
        m = re.search(rf"\b{re.escape(code)} (.+?)(?= \d\.\d\.\d |\s\d\.\d [A-Z]| Topic \d| Assessment information| Subject content|$)", text)
        assert m, code
        topics.append({"code": code, "title": title, "section": code[:3], "year": 0, "text": m.group(1).strip()})
    json.dump({"1CP2": {"sections": [{"code": c, "title": t} for c, t in SECTIONS.items()], "topics": topics}},
              open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"1CP2: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)


if __name__ == "__main__":
    main()
