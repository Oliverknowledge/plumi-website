"""Read Pearson Edexcel's A-Level Geography specification (9GE0) into a topic tree.

    python3 scripts/question-bank/edexcel_geography/spec_geography.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9GE0 and 8GE0:
sections are the specification's topics, with each option a section of its own
("2A Glaciated Landscapes and Change", "2B Coastal Landscapes and Change"), shown as
the bank's tiles; topics are their enquiry questions ("Why are some locations more at
risk from tectonic hazards?"), coded "1.EQ1", with the key ideas under them as
`points` ("1.1–1.3") and the specification's words ("text") for tagging only. The
specification numbers its key ideas, not its enquiry questions, so a topic has no
`ref` of its own. Topics 1 to 4 are the AS content (Year 1), 5 to 8 Year 2.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-geography")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Geography/2016/specification-and-sample-assessments/pearson-edexcel-a-level-geography-issue-6.pdf"
NOISE = re.compile(r"^(Pearson Edexcel Level 3|Issue \d+ – |\d{1,3}$|Key idea$|Detailed content$|Content$|Overview$|Area of study \d)")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "geography.pdf"))
    sections, topics, cur, topic_title, eq_open, overview = [], [], None, None, False, False
    for page in doc:
        text = page.get_text()
        if re.search(r"^Fieldwork statement", text, re.M):
            break  # the subject content ends where the fieldwork requirements begin
        if not re.search(r"^Topic \d: ", text, re.M) and not sections:
            continue
        for line in (re.sub(r"\s+", " ", x).strip() for x in text.split("\n")):
            if not line or NOISE.match(line):
                continue
            m = re.match(r"Topic (\d): (.+)", line)
            if m:
                topic_title, overview = (m.group(1), m.group(2)), True
                if m.group(1) not in ("2", "4", "8"):  # those have options, each a section
                    sections.append({"code": m.group(1), "title": f"Topic {m.group(1)}: {m.group(2)}", "short": m.group(2)})
                cur = None
                continue
            m = re.match(r"Option (\d[AB]): (.+)", line)
            if m:
                sections.append({"code": m.group(1), "title": f"Topic {m.group(1)}: {m.group(2)}", "short": m.group(2)})
                continue
            m = re.match(r"Enquiry question (\d): (.+)", line)
            if m:
                sec = sections[-1]["code"]
                code = f"{sec}.EQ{m.group(1)}"
                overview = False
                if topics and topics[-1]["code"] == code:  # repeated at the top of the next page
                    cur, eq_open = topics[-1], False
                    continue
                cur = {"code": code, "ref": "", "title": m.group(2), "section": sec, "text": "", "keys": [],
                       "year": 1 if int(sec[0]) <= 4 else 2}
                topics.append(cur)
                eq_open = True
                continue
            if cur is None or overview:
                continue
            k = re.match(r"(\d[AB]?\.\d{1,2})(?:\s|$)", line)
            if eq_open and not k:
                cur["title"] = (cur["title"] + " " + line).strip()
                continue
            eq_open = False
            if k and k.group(1).split(".")[0] == cur["section"]:
                cur["keys"].append(k.group(1))
            cur["text"] = (cur["text"] + " " + line).strip()
    for t in topics:
        keys = sorted(set(t.pop("keys")), key=lambda c: int(c.split(".")[1]))
        if keys:
            t["points"] = keys[0] if len(keys) == 1 else f"{keys[0]}–{keys[-1]}"
        text = re.sub(r"\s+", " ", re.sub(r"\(\d\)", "", t["text"]))
        # the key ideas first ("1.1 The global distribution of tectonic hazards can be explained…"), then their detail
        heads = re.findall(r"\d[AB]?\.\d{1,2} (.*?)(?= a\. )", text)
        t["text"] = (" ".join(heads) + " Detail: " + text)[:1500]
        # (4A and 4B add "An in-depth study of the local place in which you live or study…" to their first question)
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip().split("? ")[0].rstrip("?") + "?"
    for s in sections:
        s["year"] = 1 if int(s["code"][0]) <= 4 else 2
    tree = {"sections": sections, "topics": topics}
    as_tree = {"sections": [s for s in sections if s["year"] == 1], "topics": [t for t in topics if t["year"] == 1]}
    json.dump({"9GE0": tree, "8GE0": as_tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 80 or "points" not in t]
    print(f"{len(sections)} topics, {len(topics)} enquiry questions" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
