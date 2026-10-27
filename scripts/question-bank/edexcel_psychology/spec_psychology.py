"""Read Pearson Edexcel's A-Level Psychology specification (9PS0) into a topic tree.

    python3 scripts/question-bank/edexcel_psychology/spec_psychology.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9PS0 and 8PS0. Sections
are the specification's nine topics ("Topic 1: Social psychology"), shown as the bank's
tiles; Paper 2's options (6 Criminological, 7 Child, 8 Health) are sections of their own,
so a student filters to the one they study. Topics are each section's numbered parts
("1.1 Content", "1.3 Studies", "1.6 Issues and debates"); as those names repeat, each
gets a `short` with its section ("Social psychology studies") for its page title and
address. Topic 9 (Psychological skills) is Paper 3's: methods, synoptic review of
studies, issues and debates. Topics 1 to 4 are the AS content (Year 1), 5 to 9 Year 2.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-psychology")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Psychology/2015/specification-and-sample-assessments/al-specification-psychology.pdf"
NOISE = re.compile(r"^(Pearson Edexcel Level 3|Specification – Issue|\d{1,3}$|Subject content$|What students need to learn:?$|●$)")
HEAD = re.compile(r"^([1-9])\.([1-6])\s*(.*)$")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "psychology.pdf"))
    sections, topics, cur, started, wrap = {}, {}, None, False, False
    for page in doc:
        text = page.get_text()
        if started and re.search(r"^Assessment information", text, re.M) and "9.3" in topics:
            break  # past the subject content
        for line in (re.sub(r"\s+", " ", x).strip() for x in text.split("\n")):
            if not line or NOISE.match(line):
                continue
            if wrap and re.fullmatch(r"[1-9]\.[1-6]\.\d+", line):
                wrap = False  # the heading has ended where its first numbered point begins
                continue
            m = re.match(r"Topic ([1-9]): (.+?):?$", line)
            if m and ("Content" in text or "Methods" in text) and re.search(r"^[1-9]\.1 ", text, re.M):
                started = True
                n = m.group(1)
                sections.setdefault(n, {"code": n, "title": f"Topic {n}: {m.group(2)}", "short": m.group(2), "year": 1 if int(n) <= 4 else 2})
                cur, wrap = None, False
                continue
            if not started:
                continue
            # 4.5's heading prints as ".5 Practical", its "4" lost: it belongs to the section it's in.
            lost = re.match(r"^\.([1-6])\s+([A-Z].*)$", line)
            if lost and cur is not None:
                line = f"{cur['section']}.{lost.group(1)} {lost.group(2)}"
            m = HEAD.match(line)
            if m and m.group(1) in sections and (not m.group(3) or m.group(3)[0].isupper()):
                code = f"{m.group(1)}.{m.group(2)}"
                if code in topics:  # repeated at the top of the next page
                    cur, wrap = topics[code], False
                    continue
                cur = {"code": code, "ref": code, "title": m.group(3), "section": m.group(1), "text": "", "year": sections[m.group(1)]["year"]}
                topics[code] = cur
                wrap = True
                continue
            if cur is None:
                continue
            # A heading wraps: "1.6 Issues and" / "debates"; "1.5 Practical" / "investigation".
            if wrap and re.fullmatch(r"(debates|investigation|review of|studies|review of studies|and debates)", line, re.I):
                cur["title"] = f"{cur['title']} {line}".strip()
                continue
            wrap = False
            cur["text"] = (cur["text"] + " " + line).strip()
    secs = [sections[k] for k in sorted(sections, key=int)]
    tops = sorted(topics.values(), key=lambda t: (int(t["section"]), int(t["code"].split(".")[1])))
    for t in tops:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip().rstrip(":")
        sec = sections[t["section"]]["short"]
        t["short"] = f"{sec} {t['title'].lower()}"  # "Social psychology studies": page titles add ": Edexcel A-Level Psychology"
        t["text"] = re.sub(r"\s+", " ", t["text"])[:1500]
    tree = {"sections": secs, "topics": tops}
    as_tree = {"sections": [s for s in secs if s["year"] == 1], "topics": [t for t in tops if t["year"] == 1]}
    json.dump({"9PS0": tree, "8PS0": as_tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(secs)} sections, {len(tops)} topics", file=sys.stderr)
    for t in tops:
        print(f"  {t['code']} {t['title']!r} ({len(t['text'])} chars) short={t['short']!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
