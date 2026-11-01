"""Read Pearson Edexcel's GCSE (9-1) Business specification (1BS0) into a topic tree.

    python3 scripts/question-bank/edexcel_gcse_business/spec_gcse_business.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 1BS0: sections are the
specification's ten topics ("Topic 1.3 Putting a business idea into practice"), shown as
the bank's tiles; topics are their numbered sub-topics ("1.3.2 Business revenues, costs and
profits"), each with the specification's words under it ("text") for tagging only. Each
content page sets a sub-topic's code and title in its left column and what students need
to learn in its right, so the columns are told apart by position. A GCSE has no AS split,
so every topic is "year 0".
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-business")
URL = "https://qualifications.pearson.com/content/dam/pdf/GCSE/Business/2017/specification-and-sample-assessments/gcse-business-spec-2017.pdf"
SECTION = re.compile(r"^Topic ([12])\.([1-5]) (.{4,70})$")
TOPIC = re.compile(r"^([12])\.([1-5])\.(\d)$")
NOISE = re.compile(r"^(Pearson Edexcel Level 1|Issue \d|\d{1,3}$|Subject content$|What students need to learn:?$)")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "business.pdf"))
    sections, topics = [], []
    for page in doc:
        lines = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip())
                        for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])), key=lambda l: (round(l[1]), l[0]))
        lines = [l for l in lines if l[2] and not NOISE.match(l[2])]
        if not lines or not SECTION.match(lines[0][2]):
            continue  # a topic's content starts its page with its heading
        m = SECTION.match(lines[0][2])
        sections.append({"code": f"{m.group(1)}.{m.group(2)}", "title": f"Topic {m.group(1)}.{m.group(2)} {m.group(3).strip()}",
                         "short": m.group(3).strip(), "year": 0})
        cur = None
        for x, y, t in lines[1:]:
            if x < 150:  # the left column: a sub-topic's code, then its title
                m = TOPIC.match(t)
                if m:
                    cur = {"code": t, "ref": t, "title": "", "section": sections[-1]["code"], "text": "", "year": 0}
                    topics.append(cur)
                elif cur is not None:
                    cur["title"] = (cur["title"] + " " + t).strip()
            elif cur is not None:
                cur["text"] = (cur["text"] + " " + t).strip()
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"].replace("●", "•"))[:1200]
    json.dump({"1BS0": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40 or not t["title"]]
    print(f"{len(sections)} topics, {len(topics)} sub-topics" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
