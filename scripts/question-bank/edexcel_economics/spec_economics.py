"""Read Pearson Edexcel's A-Level Economics A specification (9EC0) into a topic tree.

    python3 scripts/question-bank/edexcel_economics/spec_economics.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9EC0 and 8EC0:
sections are the specification's numbered topics ("1.2 How markets work"), shown
as the bank's tiles; topics are their numbered sub-topics ("1.2.3 Price, income and
cross elasticities of demand"), each with the specification's words under it
("text") for tagging only. Themes 1 and 2 are the AS content (Year 1), 3 and 4 Year 2.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Economics/2015/specification-and-sample-assessment-materials/A_Level_Econ_A_Spec.pdf"
SECTION = re.compile(r"^([1-4])\.([1-6]) ([A-Z].{3,60})$")
TOPIC = re.compile(r"^([1-4])\.([1-6])\.(\d{1,2})$")
POINT = re.compile(r"^[a-z]\) ")
NOISE = re.compile(r"^(Pearson Edexcel Level 3|Specification – Issue|\d{1,3}$|Subject content|What students need to learn|Theme \d|o$)")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "economics-a.pdf"))
    sections, topics, cur, title_open = [], [], None, False
    for page in doc:
        for line in (x.strip() for x in page.get_text().split("\n")):
            if not line or NOISE.match(line):
                continue
            m = SECTION.match(line)
            if m and not any(s["code"] == f"{m.group(1)}.{m.group(2)}" for s in sections):
                sections.append({"code": f"{m.group(1)}.{m.group(2)}", "title": f"{m.group(1)}.{m.group(2)} {m.group(3).strip()}",
                                 "short": m.group(3).strip(), "year": 1 if int(m.group(1)) <= 2 else 2})
                cur = None
                continue
            m = TOPIC.match(line)
            if m:
                code = line
                cur = {"code": code, "ref": code, "title": "", "section": f"{m.group(1)}.{m.group(2)}", "text": "",
                       "year": 1 if int(m.group(1)) <= 2 else 2}
                topics.append(cur)
                title_open = True
                continue
            if cur is None:
                continue
            if title_open and not POINT.match(line):
                cur["title"] = (cur["title"] + " " + line).strip()
                continue
            title_open = False
            cur["text"] = (cur["text"] + " " + line).strip()
        if len(sections) == 21 and topics and topics[-1]["code"].startswith("4.5") and "Appendix" in page.get_text()[:400]:
            break
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"].replace(" o ", " • "))[:1200]
        t["title"] = re.sub(r"- (?=[a-z])", "-", re.sub(r"\s+", " ", t["title"]))  # "trade- offs", broken over two lines
    tree = {"sections": sections, "topics": topics}
    json.dump({"9EC0": tree, "8EC0": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    print(f"{len(sections)} topics, {len(topics)} sub-topics" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
