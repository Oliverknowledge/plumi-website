"""Read AQA's GCSE Physical Education specification (8582) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_pe/spec_gcse_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-pe

Writes <work-dir>/spec.json as {"8582": {"sections": [...], "topics": [...]}}, the shape the
A-Level PE bank uses. The sections are the specification's seven areas:

  3.1.1 Applied anatomy and physiology, 3.1.2 Movement analysis, 3.1.3 Physical training, 3.1.4 Use of data (Paper 1)
  3.2.1 Sports psychology, 3.2.2 Socio-cultural influences, 3.2.3 Health, fitness and wellbeing (Paper 2)

and the topics their numbered headings ("3.1.1.2 The structure and functions of the cardio-respiratory system").
The body text under each heading is kept for tagging, never shown.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-pe")
# AQA's specification page links the PDF from its content store.
URL = "https://cdn.sanity.io/files/p28bar15/green/9ce46055100bf20ff156b70b5429f3e5d2167fca.pdf"
HEADING = re.compile(r"^(3\.[12]\.\d+\.\d+)\s+(.+)$")
SECTIONS = [
    ("3.1.1", "Applied anatomy and physiology"),
    ("3.1.2", "Movement analysis"),
    ("3.1.3", "Physical training"),
    ("3.1.4", "Use of data"),
    ("3.2.1", "Sports psychology"),
    ("3.2.2", "Socio-cultural influences"),
    ("3.2.3", "Health, fitness and wellbeing"),
]
TITLES = {
    "3.1.1.1": "The musculoskeletal system",
    "3.1.1.2": "The cardio-respiratory system",
    "3.1.2.1": "Lever systems and mechanical advantage",
    "3.1.3.1": "Health, fitness and the role of exercise",
    "3.1.3.2": "Components of fitness and how they are measured",
    "3.1.3.3": "Principles of training",
    "3.1.4.1": "How data are collected",
    "3.1.4.2": "Presenting data",
    "3.2.1.2": "Goal setting and SMART targets",
    "3.2.2.1": "Engagement patterns of different social groups",
    "3.2.2.3": "Ethical and socio-cultural issues",
    "3.2.3.1": "Physical, emotional and social health, fitness and wellbeing",
}


def read(path):
    nodes, current = [], None
    for page in pymupdf.open(path):
        text = page.get_text()
        if nodes and re.search(r"^4\s+Scheme of assessment", text, re.M):
            break  # past the subject content (the contents page lists the heading too, before any topic)
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                size = spans[0]["size"]
                if (m := HEADING.match(t)) and size >= 12.5:
                    current = {"code": m.group(1), "title": m.group(2).rstrip(":").strip(), "text": "", "size": size}
                    nodes.append(current)
                elif re.match(r"^3\.\d", t) and size >= 15:
                    current = None  # an area's heading ("3.1.4 Use of data"), and any text under it
                elif current is not None and not current["text"] and abs(size - current["size"]) < 0.5:
                    current["title"] += " " + t  # a heading wrapped onto a second line
                elif current is not None and t not in ("Content", "Additional information") and not re.match(r"^(\d+|•)$", t):
                    current["text"] += " " + t
    return nodes


def main():
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, "AQA-8582-SP.pdf")
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    topics = []
    for n in read(path):
        # The page footer, read into the text where a topic crosses a page.
        body = re.sub(r"\s*\d* ?Visit aqa\.org\.uk/8582 for the most up-to-date specification, resources, support and administration\s*\d*", " ", n["text"])
        body = re.sub(r"\s*(AQA )?GCSE (Physical Education 8582\.? )?(exams )?(June )?2018 onwards\.?\s*Version [\d.]+ \d+ \w+( \d{4})?", " ", body)
        topics.append({"code": n["code"], "title": TITLES.get(n["code"], n["title"]), "section": n["code"][:5], "year": 0, "text": re.sub(r"\s+", " ", body).strip()[:4000]})
    json.dump({"8582": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"8582: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:10} {t['title']}  ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
