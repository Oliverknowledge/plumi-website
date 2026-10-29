"""Read OCR's A-Level Law specification (H418) into the bank's topic tree.

    python3 scripts/question-bank/ocr_law/spec_ocr_law.py [work-dir]   # default .work/ocr-law

Writes <work-dir>/spec.json in spec_ocr.py's shape, under H418 and H018. The specification sets
each component's content out as two sections ("Section A: The legal system", "Section B: Criminal
law"), each a table of bold topic headings ("Fatal offences against the person") with what is to
be taught under them, left, and its guidance, right ("text", for tagging only). The topics carry
no numbers, so they're coded here by section, "1B.3" for criminal law's third, with an empty `ref`
(the bank shows no code). Component 3 is two papers, H418/03 and H418/04: both open with the
nature of law, read once, then one has human rights law and the other contract law, sections 3B
and 3C. Where two sections have a topic of the same name ("Rules and theory", "Evaluation",
"Remedies") the title says whose: "Criminal law: rules and theory".

`year` 1 is a topic the AS (H018) also teaches, matched by name (the AS's "Rules" is the
A-Level's "Rules and theory"; its "Introduction to the nature of law" opens its legal system);
2 is A-Level only; 3 is a Component 3 option, human rights or contract law.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-law"))
URLS = {"h418": "https://www.ocr.org.uk/Images/587304-specification-accredited-a-level-gce-law-h418.pdf",
        "h018": "https://www.ocr.org.uk/Images/587303-specification-accredited-as-level-gce-law-h018.pdf"}
COMPONENT = re.compile(r"^Content of H[04]18/0([1-4])")
SECTION = re.compile(r"^Section ([AB]): (.+)$")
OPTIONS = {"Human rights law", "The law of contract"}
SHORT = {"Criminal law": "Criminal law", "The law of tort": "Tort", "Human rights law": "Human rights", "The law of contract": "Contract"}


def fetch(name):
    path = os.path.join(WORK, "spec", f"{name}.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URLS[name], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def read(doc):
    """[(component, section letter, section title)], [{component, section, title, text}] in order."""
    sections, topics, comp, sec, cur = [], [], None, None, None
    for page in doc:
        if re.search(r"^2d\.|^3a\.", page.get_text(), re.M) and topics:
            break
        rows = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip(), "Bold" in l["spans"][0]["font"])
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if l["spans"]), key=lambda r: (round(r[1]), r[0]))
        last_bold = None
        for x, y, t, bold in rows:
            if not t or y > page.rect.height - 50 or y < 60 or x > page.rect.width - 40 or x < 40:
                continue  # (the running footer, and the section's number in a tab at either edge)
            m = COMPONENT.match(t)
            if m:
                comp, cur = m.group(1), None
                continue
            m = SECTION.match(t)
            if m and bold and comp:
                sec, cur = m.group(1), None
                if not any(s[:2] == (comp, sec) for s in sections):
                    sections.append((comp, sec, m.group(2).strip()))
                continue
            if t in ("Content", "Guidance", "|") or re.match(r"^\d[a-f]\.", t) or not comp or not sec:
                continue
            if bold and x < 120:
                if cur and last_bold is not None and y - last_bold < 16 and not cur["text"]:
                    cur["title"] += " " + t  # a heading over two lines
                else:
                    cur = {"component": comp, "section": sec, "title": t, "text": ""}
                    topics.append(cur)
                last_bold = y
                continue
            if cur is not None and x > 70:
                cur["text"] = (cur["text"] + " " + t.replace("|", " ")).strip()
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:1500]
    return sections, topics


def main():
    sections, topics = read(fetch("h418"))
    _, as_topics = read(fetch("h018"))
    as_names = {t["title"].lower().replace("rules and theory", "rules") for t in as_topics}
    # Component 3's sections: its nature of law once, then each paper's option.
    codes, tree = {}, {"sections": [], "topics": []}
    for comp, sec, title in sections:
        code = f"{comp}{sec}" if comp in "12" else "3A" if sec == "A" else "3B" if comp == "3" else "3C"
        if code in codes.values():
            continue
        codes[(comp, sec)] = code
        tree["sections"].append({"code": code, "title": title})
    kept, seen = [], set()
    for t in topics:
        code = codes.get((t["component"], t["section"]))
        if code and (code, t["title"]) not in seen:  # (H418/04's nature of law is H418/03's again)
            seen.add((code, t["title"]))
            kept.append((code, t))
    names = [t["title"] for _, t in kept]
    n = {}
    for code, t in kept:
        n[code] = n.get(code, 0) + 1
        section = next(s["title"] for s in tree["sections"] if s["code"] == code)
        title = t["title"]
        if names.count(title) > 1:
            title = f"{SHORT[section]}: {title[0].lower()}{title[1:]}"
        year = 3 if section in OPTIONS else 1 if t["title"].lower().replace("rules and theory", "rules") in as_names else 2
        tree["topics"].append({"code": f"{code}.{n[code]}", "ref": "", "title": title, "section": code, "text": t["text"], "year": year})
    json.dump({"H418": tree, "H018": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics, {sum(t['year'] == 1 for t in tree['topics'])} AS; "
          f"AS topics: {len(as_topics)}", file=sys.stderr)
    for s in tree["sections"]:
        print(f" {s['code']} {s['title']}", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:6} y{t['year']} {t['title']} ({len(t['text'])})", file=sys.stderr)
    unmatched = sorted(as_names - {t["title"].lower().replace("rules and theory", "rules") for t in topics})
    if unmatched:
        print("  AS names not in the A-Level:", unmatched, file=sys.stderr)


if __name__ == "__main__":
    main()
