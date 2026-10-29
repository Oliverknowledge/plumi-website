"""Read Pearson Edexcel's A-Level Politics specification (9PL0, Issue 4) into a topic tree.

    python3 scripts/question-bank/edexcel_politics/spec_politics.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9PL0 and 8PL0. Sections are the
specification's six areas, shown as the bank's tile groups: UK Politics and Core Political Ideas
(Component 1), UK Government and Non-core Political Ideas (Component 2), and Component 3's two
options, Government and Politics of the USA (Paper 3A) and Global Politics (Paper 3B), so a student
filters to the one they study. Topics are each area's content areas ("2. Political parties",
"Liberalism", "1. The US Constitution and federalism"), with the specification's words under them
("text", for tagging only). The specification numbers its content areas afresh in each area, so
codes carry the area ("UKP.2"); topics show their names alone (ref ""). Essays range across an area's
sub-points (1.1, 1.2…), so the bank tags to content areas, not to those.
UK Politics and UK Government are the AS content (Year 1, AS Papers 1 and 2), the political ideas
Year 2, and the Paper 3 options year 3.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-politics")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Politics/2017/Specification%20and%20sample%20assessments/9781446933602-gce2017-al-politics-issue4.pdf"
SECTIONS = [("UKP", "UK Politics", 1), ("CPI", "Core Political Ideas", 2), ("UKG", "UK Government", 1),
            ("NPI", "Non-core Political Ideas", 2), ("USA", "USA (Paper 3A)", 3), ("GLO", "Global Politics (Paper 3B)", 3)]
# (code, title, the specification's pages for it, as printed at their foot)
TOPICS = [
    ("UKP.1", "Democracy and participation", [9]), ("UKP.2", "Political parties", [10]),
    ("UKP.3", "Electoral systems", [11]), ("UKP.4", "Voting behaviour and the media", [12]),
    ("CPI.1", "Liberalism", [16, 17, 18]), ("CPI.2", "Conservatism", [13, 14, 15]), ("CPI.3", "Socialism", [19, 20]),
    ("UKG.1", "The constitution", [24]), ("UKG.2", "Parliament", [25]),
    ("UKG.3", "Prime Minister and executive", [26]), ("UKG.4", "Relations between the branches", [27]),
    ("NPI.1", "Anarchism", [28, 29]), ("NPI.2", "Ecologism", [30, 31]), ("NPI.3", "Feminism", [32, 33]),
    ("NPI.4", "Multiculturalism", [34, 35]), ("NPI.5", "Nationalism", [36, 37]),
    ("USA.1", "The US Constitution and federalism", [40]), ("USA.2", "US Congress", [41]), ("USA.3", "US presidency", [42]),
    ("USA.4", "US Supreme Court and civil rights", [43]), ("USA.5", "US democracy and participation", [44, 45]),
    ("USA.6", "Comparative theories (USA and UK)", [45, 46]),
    ("GLO.1", "The state and globalisation", [48]), ("GLO.2", "Global governance: political and economic", [49]),
    ("GLO.3", "Global governance: human rights and environmental", [50]), ("GLO.4", "Power and developments", [51]),
    ("GLO.5", "Regionalism and the European Union", [52]), ("GLO.6", "Comparative theories (global politics)", [53]),
]
NOISE = re.compile(r"^(Pearson Edexcel Level 3|Issue 4|\d{1,3}$|Subject content$|Students should gain knowledge|of:$|●$|•$)")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "politics.pdf"))
    printed = {}  # the page number printed at the head of each page
    for i, page in enumerate(doc):
        m = re.search(r"©\s*Pearson Education Limited \d{4}\s*\n\s*(\d{1,3})\s*\n", page.get_text())
        if m:
            printed[int(m.group(1))] = i
    year = {code: y for code, _, y in SECTIONS}
    topics = []
    for code, title, pages in TOPICS:
        lines = [re.sub(r"\s+", " ", x).strip() for p in pages for x in doc[printed[p]].get_text().split("\n")]
        text = " ".join(x for x in lines if x and not NOISE.match(x))
        section = code.split(".")[0]
        topics.append({"code": code, "ref": "", "title": title, "section": section, "year": year[section], "text": text[:1500]})
    sections = [{"code": c, "title": t, "year": y} for c, t, y in SECTIONS]
    tree = {"sections": sections, "topics": topics}
    as_tree = {"sections": [s for s in sections if s["year"] == 1], "topics": [t for t in topics if t["year"] == 1]}
    json.dump({"9PL0": tree, "8PL0": as_tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} sections, {len(topics)} topics", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']} {t['title']!r}: {t['text'][:90]!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
