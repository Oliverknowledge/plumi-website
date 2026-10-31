"""Read Pearson Edexcel's GCSE (9-1) Geography B specification (1GB0) into a topic tree.

    python3 scripts/question-bank/edexcel_gcse_geography/spec_gcse_geography.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 1GB0: sections are the
specification's nine topics ("Topic 1: Hazardous Earth"), shown as the bank's tiles;
topics are their numbered key ideas ("1.4 Tropical cyclones are caused by particular
meteorological conditions"), each with its detailed content ("text") for tagging only.
Topic 6 (fieldwork) has no numbered key ideas: its four contexts (coasts, rivers, urban,
rural, one physical and one human chosen by each school) are its topics, coded 6.1-6.4
here and shown without a code. A GCSE has no AS split, so every topic is "year 0".
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography")
URL = "https://qualifications.pearson.com/content/dam/pdf/GCSE/Geography-B/2016/specification-and-sample-assessments/gcse-2016-l12-geography-b-spec.pdf"
NOISE = re.compile(r"^(Pearson Edexcel Level 1|Specification – Issue|\d{1,3}$|Key idea$|Detailed content:?$|Case Study$|Integrated skills|\(\d+\) |= located example)")
FIELDWORK = [("6.1", "Investigating coastal change and conflict"), ("6.2", "Investigating river processes and pressures"),
             ("6.3", "Investigating dynamic urban areas"), ("6.4", "Investigating changing rural areas")]


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "geography-b.pdf"))
    sections, topics, cur, title_open, skills = [], [], None, False, False
    fieldwork, done = "", False
    for page in doc:
        if done:
            break
        text = page.get_text()
        for line in (re.sub(r"\s+", " ", x).strip() for x in text.split("\n")):
            m = re.match(r"Topic (\d): (.+)", line)
            if m and not any(s["code"] == m.group(1) for s in sections):
                title = m.group(2).strip()
                title = title[0].upper() + title[1:]
                sections.append({"code": m.group(1), "title": f"Topic {m.group(1)}: {title}", "short": title, "year": 0})
                cur, skills = None, False
                continue
            if not sections:
                continue
            if line.startswith("Assessment information") and sections[-1]["code"] == "9":
                done = True  # Topic 9's assessment notes end the content
                break
            if sections[-1]["code"] == "6":
                fieldwork += "" if NOISE.match(line) else " " + line
                continue
            if line.startswith(("Integrated skills", "Enquiry question", "Assessment information", "Component ")):
                cur, skills = None, line.startswith("Integrated skills")
                continue
            if line == "Key idea":
                skills = False  # a table's header: Topic 9's last key ideas follow its skills, over the page
            if not line or NOISE.match(line):
                continue
            m = re.match(r"(\d)\.(\d{1,2})\s*(.*)$", line)
            if m and m.group(1) == sections[-1]["code"] and not skills:
                code = f"{m.group(1)}.{m.group(2)}"
                if any(t["code"] == code for t in topics):
                    continue
                cur = {"code": code, "ref": code, "title": m.group(3), "section": m.group(1), "text": "", "year": 0}
                topics.append(cur)
                title_open = True
                continue
            if cur is None or skills:
                continue
            if title_open and not re.match(r"[a-d](\.(\s|$)|$)", line):  # "a.  The global…", or "b" alone over its words
                cur["title"] = (cur["title"] + " " + line).strip()
                continue
            title_open = False
            cur["text"] = (cur["text"] + " " + line).strip()
    # Topic 6: its four contexts, each with its focus and what its fieldwork must include
    fieldwork = re.sub(r"\s+", " ", fieldwork)
    fieldwork = fieldwork[fieldwork.find("Contexts for fieldwork"):]  # (the topic's opening names the four too)
    names = [n for _, n in FIELDWORK]
    for k, (code, name) in enumerate(FIELDWORK):
        start = fieldwork.find(name)
        end = fieldwork.find(names[k + 1]) if k + 1 < len(names) else fieldwork.find("Assessment information", start)
        topics.append({"code": code, "ref": "", "title": name, "section": "6", "text": fieldwork[start + len(name):end].strip(), "year": 0})
    topics.sort(key=lambda t: (int(t["section"]), int(t["code"].split(".")[1])))
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", re.sub(r"- (?=[a-z])", "-", re.sub(r"\(\d+\)|\*", "", t["title"]))).strip()
        t["text"] = re.sub(r"\s+", " ", re.sub(r"\(\d+\)", "", t["text"])).strip()[:1500]
    json.dump({"1GB0": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 80]
    print(f"{len(sections)} topics, {len(topics)} key ideas" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
