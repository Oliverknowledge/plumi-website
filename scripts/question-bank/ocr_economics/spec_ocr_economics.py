"""Read OCR's A-Level Economics specification (H460) into the bank's topic tree.

    python3 scripts/question-bank/ocr_economics/spec_ocr_economics.py [work-dir]   # default .work/ocr-economics

Writes <work-dir>/spec.json in spec_ocr.py's shape, under H460 and H060. The specification
numbers each component's content afresh: Component 1 (Microeconomics) "1. Introduction to
Microeconomics" to "5. The labour market", Component 2 (Macroeconomics) "1. Aggregate demand and
aggregate supply" to "5. The financial sector"; Component 3 is synoptic, with no content of its own.
So the sections are coded by component, "1.2" for Microeconomics 2 (The role of markets), and the
topics "1.2.6" for its 2.6 Elasticity, with `ref` "2.6", the number the specification prints.

The topic table is two columns, the topic's number and title on the left (the title wrapping over
two or three lines) and what students should be able to do on the right ("text", for tagging only).
A topic is AS content (year 1) where the AS specification (H060, numbered on its own) has a topic of
the same name in the same component; the rest is A-Level only (year 2).
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-economics"))
URLS = {"h460": "https://www.ocr.org.uk/Images/536455-specification-accredited-a-level-gce-economics-h460.pdf",
        "h060": "https://www.ocr.org.uk/Images/536454-specification-accredited-as-level-gce-economics-h060.pdf"}
COMPONENT = re.compile(r"Content of Component ([12]): (Microeconomics|Macroeconomics)")
SECTION = re.compile(r"^([1-5])\.\s+([A-Z].+)$")
TOPIC = re.compile(r"^([1-5])\.(\d{1,2})$")
NAMES = {"1": "Microeconomics", "2": "Macroeconomics"}


def fetch(name):
    path = os.path.join(WORK, "spec", f"{name}.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URLS[name], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def read(doc):
    """[(component, section number, section title)], [{component, code, title, text}] in order."""
    sections, topics, comp, cur, in_content = [], [], None, None, False
    for page in doc:
        text = page.get_text()
        m = COMPONENT.search(text)
        if m and "Contents" not in text[:400]:
            comp, in_content = m.group(1), True
        if not in_content:
            continue
        if re.search(r"Content of Component 3|Prior knowledge, learning and progression", text) and comp == "2" and topics:
            in_content = "Content of Component 2" in text  # the page Component 2 ends on
        rows = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip())
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])), key=lambda r: (round(r[1]), r[0]))
        for x, y, t in rows:
            if not t or y > page.rect.height - 50 or y < 40 or x > page.rect.width - 60 or x < 30:
                continue  # (the running footer, and the section's number in a tab at either edge)
            if re.match(r"^\d[a-f]\.\s", t):
                cur = None  # "2d. Content of Component 2…": its introduction is no topic's
                continue
            m = SECTION.match(t)
            if m and x < 100:
                sections.append((comp, m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()))
                cur = None
                continue
            m = TOPIC.match(t)
            if m and x < 100:
                cur = {"component": comp, "code": f"{comp}.{m.group(1)}.{m.group(2)}", "ref": t, "title": "", "text": ""}
                topics.append(cur)
                continue
            if cur is None or t in ("Topic", "Students should be able to:"):
                continue
            if x < 130:
                cur["title"] = (cur["title"] + " " + t).strip()
            else:
                cur["text"] = (cur["text"] + " " + t).strip()
        if not in_content:
            break
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip()
        t["text"] = re.sub(r"\s+", " ", t["text"].replace("•", " • ")).strip()[:1200]
    return sections, topics


def main():
    sections, topics = read(fetch("h460"))
    _, as_topics = read(fetch("h060"))
    as_names = {(t["component"], t["title"].lower()) for t in as_topics}
    tree = {"sections": [{"code": f"{c}.{n}", "title": f"{NAMES[c]} {n}: {title}", "short": title} for c, n, title in sections], "topics": []}
    for t in topics:
        year = 1 if (t["component"], t["title"].lower()) in as_names else 2
        tree["topics"].append({"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["code"].rsplit(".", 1)[0],
                               "text": t["text"], "year": year})
    json.dump({"H460": tree, "H060": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics, {sum(t['year'] == 1 for t in tree['topics'])} AS; "
          f"AS topics: {len(as_topics)}", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:7} y{t['year']} {t['title']} ({len(t['text'])})", file=sys.stderr)
    unmatched = sorted({a for c, a in as_names} - {t["title"].lower() for t in tree["topics"]})
    if unmatched:
        print("  AS names not in the A-Level:", unmatched, file=sys.stderr)


if __name__ == "__main__":
    main()
