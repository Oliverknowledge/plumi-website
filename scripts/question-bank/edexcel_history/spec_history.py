"""Read Pearson Edexcel's A-Level History specification (9HI0, Issue 4) into a topic tree.

    python3 scripts/question-bank/edexcel_history/spec_history.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 9HI0, plus the options:
  sections  one per option, its code as the specification prints it ("1A", "2A.1", "30", "37.2"),
            with the route its Papers 1 and 2 options belong to ("A" to "H"); Paper 3's options
            can be taken with most routes, so they have none.
  topics    each option's own headings: Paper 1's four themes and its historical interpretations
            question ("1A.1" to "1A.4", "1A.I"); Paper 2's four key topics ("2A.1.1"); Paper 3's
            aspects in breadth, two themes ("30.T1", "30.T2"), and aspects in depth, five key topics
            ("30.K1" to "30.K5"). The specification's words under each are kept as "text", for tagging.
  routes    {"A": "Conquest, control and resistance in the medieval world", ...}
Every topic is year 0: the options are A-Level only (the AS papers, 8HI0, are not in the bank).
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-history")
URL = "https://qualifications.pearson.com/content/dam/pdf/A%20Level/History/2015/Specification%20and%20sample%20assessments/9781446914366-gce-2015-a-hist.pdf"
NOISE = re.compile(r"^(Pearson Edexcel Level 3 Advanced GCE in History|Specification – Issue \d.*|\d{1,3}|Themes|Key topics|Content|Historical|interpretations|Historical interpretations|Overview)$")
OPTION = re.compile(r"^Paper (\d), Option (\d[A-H0-9](?:\.\d)?):\s*(.*)$")
ROUTE = re.compile(r"^Route ([A-H]): (.+)$")
# Headings whose first letters the PDF has no text for.
HAND = {"2D.2.3": "Austro-Prussian rivalry, 1852–66"}


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "history.pdf"))
    lines, heads = [], set()  # the subject content, Route A's overview to the coursework; which lines head a topic
    for i in range(len(doc)):
        text = doc[i].get_text()
        if lines and re.search(r"(?m)^\s*Coursework\s*\n\s*Overview", text):
            break
        if not (lines or re.search(r"(?m)^\s*Route A: ", text) and "Overview" in text):
            continue
        rows = []
        for blk in doc[i].get_text("dict")["blocks"]:
            for l in blk.get("lines", []):
                t = re.sub(r"\s+", " ", "".join(sp["text"] for sp in l["spans"])).strip()
                if t:
                    # Headings are set bold in the page's left column, a topic's beside its first bullet.
                    rows.append([l["bbox"][1], l["bbox"][0], t, l["bbox"][0] < 150 and "Bold" in l["spans"][0]["font"]])
        rows.sort(key=lambda r: (round(r[0]), r[1]))
        items, last = [], None  # a heading's lines, one after another down the column, are one item
        for r in rows:
            if r[3] and last is not None and r[0] - last[0] < 16 and not NOISE.match(r[2]) and not NOISE.match(last[2].split("\n")[-1]):
                last[2] += "\n" + r[2]
                last[0] = r[0]
                continue
            items.append(r)
            last = r if r[3] else last
        for y, x, t, head in items:
            if head:
                heads.add(len(lines))
            lines.append(re.sub(r"(\w)- ?\n(?=[a-z])", r"\1", t).replace("\n", " "))
    routes, sections, topics = {}, [], []
    route, opt, part, expect, title, body = None, None, None, 1, None, []

    def close():
        nonlocal title, body
        if title is not None:
            topics[-1]["text"] = re.sub(r"\s+", " ", " ".join(body))[:1500]
        title, body = None, []

    k = 0
    while k < len(lines):
        l = lines[k]
        m, r = OPTION.match(l), ROUTE.match(l)
        if r and k + 1 < len(lines):
            name = r.group(2)
            while not lines[k + 1].startswith("Overview"):
                k += 1
                name += " " + lines[k]
            routes[r.group(1)] = name.strip()
            route = r.group(1)
            k += 1
            continue
        if m:
            close()
            name = m.group(3)
            while not lines[k + 1].startswith("Overview"):
                k += 1
                name += " " + lines[k]
            opt = m.group(2)
            sections.append({"code": opt, "title": re.sub(r"\s+", " ", name).strip(), "paper": int(m.group(1)),
                             **({"option": route} if m.group(1) in "12" else {})})
            part, expect = None, 1
            k += 1
            continue
        if l.startswith("Knowledge, skills and understanding"):
            close()
            opt = None  # Paper 3's introduction, before its options
        elif opt and l.startswith("Aspects in breadth"):
            close()
            part, expect = "T", 1
        elif opt and l.startswith("Aspects in depth"):
            close()
            part, expect = "K", 1
        elif opt and k in heads and not NOISE.match(l) and not l.startswith(("●", "Overview", "Aspects")):
            close()
            interp = sections[-1]["paper"] == 1 and "interpretations" in lines[k - 3:k]
            name = re.sub(r"(\w)- (?=[A-Z])", r"\1-", re.sub(r"\s+", " ", l).strip())  # "Anglo- Saxon"
            k += 1
            if interp:
                code, name = f"{opt}.I", "Interpretations: " + name
            else:
                name = re.sub(rf"^{expect} ", "", name)
                code = f"{opt}.{part}{expect}" if part else f"{opt}.{expect}"
                expect += 1
            name = HAND.get(code, name)
            topics.append({"code": code, "ref": "", "title": name, "section": opt, "year": 0})
            title = (code, None)
            continue
        elif title is not None and not NOISE.match(l):
            body.append(l)
        k += 1
    close()
    for s in sections:
        s.pop("paper")
    json.dump({"9HI0": {"sections": sections, "topics": topics, "routes": routes}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(routes)} routes, {len(sections)} options, {len(topics)} topics", file=sys.stderr)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"  {s['code']:5s} {s.get('option', '-')} {s['title'][:60]!r}: {len(mine)} topics", file=sys.stderr)
        for t in mine:
            print(f"      {t['code']:8s} {t['title'][:70]!r} ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
