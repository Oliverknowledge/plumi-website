"""Read OCR's GCSE (9-1) Design and Technology specification (J310) into the bank's topic tree.

    python3 scripts/question-bank/ocr_gcse_dt/spec_ocr_gcse_dt.py [work-dir]   # default .work/ocr-gcse-dt

Section 2c, "Content of Principles of Design and Technology (J310/01)", is eight numbered sections ("5. Material
considerations"), each of two to six numbered enquiries ("5.2 What factors are important to consider when selecting
appropriate materials...?"). The sections are the bank's sections and the enquiries its topics, coded as the
specification numbers them ("5.2"), with a short title of the bank's own (TITLES: the specification's titles are whole
questions). The body under each enquiry (the content lettered a, b, c) is kept for tagging, never shown.
Writes <work-dir>/spec.json in spec_ocr.py's shape, under J310.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-dt"))
URL = "https://www.ocr.org.uk/Images/304658-specification-accredited-gcse-design-and-technology-j310.pdf"
START, END = re.compile(r"2c\.\s+Content of Principles of Design and Technology"), re.compile(r"^2d\.\s+Non-exam assessment content")
SECTION = re.compile(r"^([1-8])\.\s+([A-Z].+)$")
TOPIC = re.compile(r"^([1-8]\.\d{1,2})\s+(.+)$")
# The enquiry's own words say what it is about; these are the names students filter by.
TITLES = {
    "1.1": "Exploring the context", "1.2": "Usability", "2.1": "Learning from existing products", "2.2": "Developments in design and technology",
    "3.1": "Impacts of new and emerging technologies", "3.2": "Sources of energy", "3.3": "Wider influences on designing and making",
    "4.1": "Communicating design solutions", "4.2": "Design approaches and collaboration",
    "5.1": "Categories of materials", "5.2": "Selecting materials and components", "5.3": "Sources and origins of materials", "5.4": "Forms of materials and components",
    "6.1": "Structural integrity", "6.2": "Finishes", "6.3": "Controlled movement", "6.4": "Electronic systems",
    "7.1": "Making iterative models", "7.2": "Manipulating and joining materials", "7.3": "Accuracy in making", "7.4": "Digital design tools",
    "7.5": "Scales of production", "7.6": "New technologies in production", "8.1": "Cost and availability of materials",
}
RUNNING = re.compile(r"^(\d{1,2}|Version 2\.0 © .*|Cambridge OCR Level 1/Level 2 GCSE.*|Considerations|Core|In-depth|D & M PRINCIPLES|TECHNICAL PRINCIPLES)$")


def fetch():
    path = os.path.join(WORK, "spec", "j310.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def read(doc):
    sections, topics, cur, inside = [], [], None, False
    for page in doc:
        text = page.get_text()
        if START.search(text) and not re.search(r"^\s*2c\.\s+Content of Principles.*\n.*\n.*\n", text[:0]):
            if page.number > 8:
                inside = True
        if not inside:
            continue
        if re.search(r"^2d\.\s+Non-exam assessment content", text, re.M):
            break
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"].strip()]
                if not spans:
                    continue
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in l["spans"])).strip()
                x = l["bbox"][0]
                if l["bbox"][1] < 50 or RUNNING.match(t):
                    continue
                m = SECTION.match(t)
                if m and x < 70 and spans[0]["size"] >= 11.5:
                    sections.append((m.group(1), m.group(2).strip()))
                    cur = None
                    continue
                m = TOPIC.match(t)
                if m and 80 < x < 100 and spans[0]["size"] < 11.5:
                    cur = {"code": m.group(1), "title": m.group(2), "text": ""}
                    topics.append(cur)
                    continue
                if cur is not None:
                    # a heading's question wraps over lines set in the same bold; the body starts at "a."
                    if not cur["text"] and not re.match(r"^[a-z]\.", t) and x < 130 and "Bold" in spans[0]["font"]:
                        cur["title"] += " " + t
                    else:
                        cur["text"] += " " + t
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip()
        # (8.1's body runs into the specification's tables of mathematical skills)
        t["text"] = re.sub(r"\s+", " ", t["text"].split("Mathematical skills in the Principles exam")[0]).strip()[:3000]
    return sections, topics


def main():
    sections, topics = read(fetch())
    tree = {"sections": [{"code": n, "title": title} for n, title in sections],
            "topics": [{"code": t["code"], "ref": t["code"], "title": TITLES.get(t["code"], t["title"]), "question": t["title"],
                        "section": t["code"].split(".")[0], "text": t["text"], "year": 0} for t in topics]}
    json.dump({"J310": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics", file=sys.stderr)
    for s in tree["sections"]:
        print(f"  {s['code']}. {s['title']}", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:5} {t['title']} ({len(t['text'])})", file=sys.stderr)


if __name__ == "__main__":
    main()
