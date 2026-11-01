"""Read AQA's A-Level Politics specification (7152) into the bank's topic tree.

    python3 scripts/question-bank/aqa_politics/spec_politics.py [work-dir]   # default scripts/question-bank/.work/aqa-politics

The subject content (numbered 3) is three areas, one per paper: 3.1 Government and
politics of the UK, 3.2 Government and politics of the USA and comparative politics,
3.3 Political ideas. Each splits in two (3.1.1 The government of the UK, 3.1.2 The
politics of the UK...), and those are the bank's sections; their numbered headings
(3.1.1.2 The structure and role of Parliament) are its topics, with the words under
them kept as "text", for tagging only. The specification prints every code, so `ref`
is the code itself. Every topic is year 0: there is no AS.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-politics")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/politics/specifications/AQA-7152-SP-2017.PDF"
HEADING = re.compile(r"^(3\.[1-3]\.[12](?:\.\d)?)\s+(.+)$")
# Shorter names for the page title, where the specification's are long.
SHORT = {"3.1.1.1": "The British Constitution", "3.1.1.2": "Parliament", "3.2.1.1": "The US Constitution",
         "3.2.1.2": "Congress", "3.2.1.3": "The President", "3.2.1.4": "The Supreme Court", "3.2.1.5": "US elections and direct democracy",
         "3.2.1.6": "US political parties", "3.2.1.7": "US pressure groups", "3.2.1.8": "US civil rights",
         "3.2.2.1": "Comparative: constitutions", "3.2.2.2": "Comparative: executives", "3.2.2.3": "Comparative: judiciaries",
         "3.2.2.4": "Comparative: electoral and party systems", "3.2.2.5": "Comparative: pressure groups", "3.2.2.6": "Comparative: civil rights"}
# The bank's topic titles, where a section repeats another's name (Political parties, Pressure groups, Civil rights).
TITLES = {"3.2.1.6": "US political parties", "3.2.1.7": "US pressure groups", "3.2.1.8": "US civil rights",
          "3.2.2.1": "Comparative constitutional arrangements", "3.2.2.2": "Comparative executives", "3.2.2.3": "Comparative judiciaries",
          "3.2.2.4": "Comparative electoral and party systems", "3.2.2.5": "Comparative pressure groups", "3.2.2.6": "Comparative civil rights"}
NOISE = re.compile(r"^(AQA A-level Politics \d+\. A-level exams.*|Visit aqa\.org\.uk.*|\d{1,2})$")


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL))))
    sections, topics, cur = [], [], None
    for page in list(doc)[9:27]:  # 3.1 starts on the tenth page; 3.3.2.5 Ecologism ends on the twenty-seventh
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in line["spans"])).strip()
                if not spans or not t or line["bbox"][1] > page.rect.height - 50:
                    continue
                m = HEADING.match(t)
                if m and spans[0]["size"] > 12:
                    code, title = m.groups()
                    if code.count(".") == 2:
                        sections.append({"code": code, "title": f"{code} {title}", "short": title})
                        cur = None
                    else:
                        cur = {"code": code, "ref": code, "title": TITLES.get(code, title), "section": code[:5], "year": 0, "text": ""}
                        if code in SHORT:
                            cur["short"] = SHORT[code]
                        topics.append(cur)
                    continue
                if cur is not None and not NOISE.match(t) and spans[0]["size"] < 12:
                    cur["text"] += " " + t
    for t in topics:
        t["text"] = t["text"].strip()[:1500]
    assert len(sections) == 6 and len(topics) == 32, (len(sections), len(topics))
    json.dump({"7152": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} sections, {len(topics)} topics", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']} {t['title']!r}: {t['text'][:80]!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
