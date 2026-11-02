"""Read OCR's Cambridge National in Engineering Manufacture (J823) specification into the bank's topic tree: unit R014.

    python3 scripts/question-bank/ocr_cn_engineering/spec_ocr_cn_engineering.py [work-dir]   # writes <work-dir>/spec.json

The shape ocr_gcse_cs/spec_ocr_gcse_cs.py writes: {"R014": {"sections": [...], "topics": [...]}}.
The sections are R014's four topic areas (1 Manufacturing processes … 4 Developments in engineering
manufacture). The topics are their numbered teaching content (2.1 Mechanical properties of materials),
with 1.2 Details of different manufacturing processes and 2.3 Types of engineering materials taken a
level down, to the specification's own headings (1.2.1 Wasting processes … 2.3.5 Smart materials), as
most questions are set on one process or one material. Each carries the specification's words under it
("text", for tagging only). Titles are written out here, as some of the PDF's wrap. "year" is 0.
"""
import json, os, re, subprocess, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-cn-engineering")
SPEC = "https://www.ocr.org.uk/Images/711773-specification-cambridge-nationals-engineering-manufacture-j823-assessment-from-2025-.pdf"
SECTIONS = {"1": "Manufacturing processes", "2": "Engineering materials", "3": "Manufacturing requirements",
            "4": "Developments in engineering manufacture"}
TITLES = {
    "1.1": "Types of manufacturing processes",
    "1.2.1": "Wasting processes", "1.2.2": "Shaping processes", "1.2.3": "Forming processes",
    "1.2.4": "Additive manufacturing", "1.2.5": "Joining processes", "1.2.6": "Finishing processes",
    "2.1": "Mechanical properties of materials", "2.2": "Other properties influencing manufacturing",
    "2.3.1": "Metals", "2.3.2": "Polymers", "2.3.3": "Engineering ceramics", "2.3.4": "Composite materials",
    "2.3.5": "Smart materials",
    "3.1": "Orthographic third angle projection drawings", "3.2": "Scale of manufacture and the production method",
    "3.3": "Quality",
    "4.1": "Inventory management", "4.2": "Lean manufacturing", "4.3": "Globalisation",
}
# The heading each topic's words start at, as the specification sets it
HEADS = {"1.1": "1.1 Types of manufacturing processes", "2.1": "2.1 Mechanical properties", "2.2": "2.2 Other properties",
         "3.1": "3.1 Interpreting orthographic", "3.2": "3.2 Influence of the scale", "3.3": "3.3 Quality",
         "4.1": "4.1 Inventory management", "4.2": "4.2 Lean manufacturing", "4.3": "4.3 Globalisation"}
NOISE = re.compile(r"\d{1,2}\s+© Cambridge OCR \d{4}\s+Version \d+ \([A-Za-z]+ \d{4}\)\s+Cambridge OCR Level 1/Level 2 Cambridge National in\s+"
                   r"Engineering Manufacture(\s+Unit R014: Principles of engineering manufacture)?"
                   r"|Topic Area \d: [^\n]*\n|Teaching content\s+Breadth and Depth|[□•]|\s")


def main():
    os.makedirs(os.path.join(WORK, "raw"), exist_ok=True)
    path = os.path.join(WORK, "raw", "spec-j823.pdf")
    if not os.path.exists(path):
        subprocess.run(["curl", "-sfL", "-A", "Mozilla/5.0", "-o", path, SPEC], check=True)
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    start = text.find("Topic Area 1: Manufacturing processes")
    text = text[start:text.find("Assessment guidance", start)]
    at = {c: text.find(HEADS.get(c, c + " ")) for c in TITLES}
    assert all(v >= 0 for v in at.values()), at
    order = sorted(at.values()) + [len(text)]
    topics = []
    for code, title in TITLES.items():
        a = at[code]
        words = re.sub(r"\s+", " ", NOISE.sub(" ", text[a:min(o for o in order if o > a)]))
        words = re.sub(r"^\s*[\d.]+\s+", "", words).strip()
        words = re.sub(r"\s+\d\.\d [A-Z][^.]*$", "", words)  # the next heading (1.2 Details…) a sub topic runs into
        topics.append({"code": code, "title": title, "section": code[0], "year": 0, "text": words})
    json.dump({"R014": {"sections": [{"code": c, "title": t} for c, t in SECTIONS.items()], "topics": topics}},
              open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"R014: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)


if __name__ == "__main__":
    main()
