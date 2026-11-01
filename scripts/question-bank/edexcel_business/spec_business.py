"""Read Pearson Edexcel's A-Level Business specification (9BS0) into a topic tree.

    python3 scripts/question-bank/edexcel_business/spec_business.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9BS0: sections are the
specification's numbered topics ("1.3 Marketing mix and strategy"), shown as the bank's
tiles; topics are their numbered sub-topics ("1.3.1 Product/service design"), each with the
specification's words under it ("text") for tagging only. Four themes, no AS split:
the topics are all "year 0" (shown by area, not by year).
spec_economics_b.py's sibling: Business prints each sub-topic's code and title the same way.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-business")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Business%20Studies/2015/specification-and-sample-assessment-materials/9781446914694-gce2015-a-bus-web.pdf"
SECTION = re.compile(r"^([1-4])\.([1-6]) ([A-Z].{3,70})$")
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
    doc = fetch(os.path.join(WORK, "spec", "business.pdf"))
    sections, topics, cur, title_open = [], [], None, False
    for page in doc:
        text = page.get_text()
        if "Assessment summary" in text[:600] and topics:
            break  # past the content (the first mention is the contents page, before any topic)
        for line in (x.strip() for x in text.split("\n")):
            if not line or NOISE.match(line):
                continue
            if line == "Overview":
                cur = None  # a theme's introduction, after the last sub-topic of the one before
                continue
            m = SECTION.match(line)
            if m and not any(s["code"] == f"{m.group(1)}.{m.group(2)}" for s in sections):
                sections.append({"code": f"{m.group(1)}.{m.group(2)}", "title": f"{m.group(1)}.{m.group(2)} {m.group(3).strip()}",
                                 "short": m.group(3).strip(), "year": 0})
                cur = None
                continue
            m = TOPIC.match(line)
            if m and not any(t["code"] == line for t in topics):
                cur = {"code": line, "ref": line, "title": "", "section": f"{m.group(1)}.{m.group(2)}", "text": "", "year": 0}
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
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"].replace(" o ", " • "))[:1200]
        t["title"] = re.sub(r"- (?=[a-z])", "-", re.sub(r"\s+", " ", t["title"]))
    json.dump({"9BS0": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    print(f"{len(sections)} topics, {len(topics)} sub-topics" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
