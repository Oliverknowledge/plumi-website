"""Read OCR's GCSE (9-1) Economics specification (J205) into the bank's topic tree.

    python3 scripts/question-bank/ocr_gcse_economics/spec_ocr_gcse_economics.py [work-dir]   # default .work/ocr-gcse-economics

ocr_economics/spec_ocr_economics.py for the GCSE. The content is four numbered sections, two per paper:
J205/01 "1. Introduction to Economics" and "2. The role of markets and money", J205/02 "3. Economic
objectives and the role of government" and "4. International trade and the global economy". Each is a
two-column table, the topic's number and title on the left ("2.3 Supply", a title wrapping over two or
three lines) and what learners should be able to do on the right ("text", for tagging only). Topics
are coded as the specification numbers them ("2.3"), sections "1" to "4".
Writes <work-dir>/spec.json in spec_ocr.py's shape, under J205.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-economics"))
URL = "https://www.ocr.org.uk/Images/306377-specification-accredited-gcse-economics-j205.pdf"
CONTENT = re.compile(r"2c\.\s+Content of J205/0[12]")
SECTION = re.compile(r"^([1-4])\.\s+([A-Z].+)$")
TOPIC = re.compile(r"^([1-4]\.\d{1,2})\s+(.*)$")


def fetch():
    path = os.path.join(WORK, "spec", "j205.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def read(doc):
    """[(section number, title)], [{code, title, text}] in order."""
    sections, topics, cur, inside = [], [], None, False
    for page in doc:
        text = page.get_text()
        if CONTENT.search(text):
            inside, cur = True, None  # (the component's introduction is no topic's)
        elif inside and re.search(r"^\s*2d\.|Prior knowledge, learning and progression", text, re.M):
            break
        if not inside:
            continue
        rows = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip(), l["spans"][0]["font"])
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])), key=lambda r: (round(r[1]), r[0]))
        column = min((x for x, y, t, f in rows if t == "Learners should be able to"), default=135) - 8
        for x, y, t, font in rows:
            if not t or y > page.rect.height - 50 or y < 60 or x < 30:
                continue  # (the running header and footer, and the section's number in a tab at the edge)
            if CONTENT.match(t):
                cur = None
                continue
            m = SECTION.match(t)
            if m and x < 100 and "Bold" in font:
                sections.append((m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()))
                cur = None
                continue
            m = TOPIC.match(t)
            if m and x < 100:
                cur = {"code": m.group(1), "title": m.group(2), "text": ""}
                topics.append(cur)
                continue
            if cur is None or t in ("Topic", "Learners should be able to"):
                continue
            if x < column:
                cur["title"] = (cur["title"] + " " + t).strip()
            else:
                cur["text"] = (cur["text"] + " " + t).strip()
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip()
        t["text"] = re.sub(r"\s+", " ", t["text"].replace("•", " • ")).strip()[:1200]
    return sections, topics


def main():
    sections, topics = read(fetch())
    tree = {"sections": [{"code": n, "title": title} for n, title in sections],
            "topics": [{"code": t["code"], "ref": t["code"], "title": t["title"], "section": t["code"].split(".")[0], "text": t["text"], "year": 0}
                       for t in topics]}
    assert [s["code"] for s in tree["sections"]] == ["1", "2", "3", "4"], tree["sections"]
    assert all(t["text"] for t in tree["topics"]), [t["code"] for t in tree["topics"] if not t["text"]]
    json.dump({"J205": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics", file=sys.stderr)
    for s in tree["sections"]:
        print(f"  {s['code']}. {s['title']}", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:5} {t['title']} ({len(t['text'])})", file=sys.stderr)


if __name__ == "__main__":
    main()
