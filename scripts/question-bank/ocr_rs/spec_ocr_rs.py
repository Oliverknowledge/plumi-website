"""Read OCR's A-Level Religious Studies specification (H573) into the bank's topic tree.

    python3 scripts/question-bank/ocr_rs/spec_ocr_rs.py [work-dir]   # default .work/ocr-rs

Writes <work-dir>/spec.json in spec_ocr.py's shape, under H573. The specification sets each
component out in six numbered parts ("1. Philosophical Language and Thought", "2. The Existence of
God"), each a table of topics: the topic's name in the left column ("Soul, mind and body*"), then
what is taught and its key knowledge ("text", for tagging only, without the reading lists). The
components follow in order, 01 to 07, each starting again at part "1.".

A section here is a component, as in the Eduqas bank: Philosophy of religion (P), Religion and
ethics (E), and one per religion for Developments in religious thought (C, I, J, B, H), which are
the bank's options. Topics are coded by section and order, "P3" for philosophy's third, with an
empty `ref` (the bank shows no code). The asterisk marks content the AS (H173) teaches too:
`year` 1 with it, 2 without.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-rs"))
URL = "https://www.ocr.org.uk/images/242913-specification-accredited-a-level-gce-religious-studies-h573.pdf"
SECTIONS = [("P", "Philosophy of religion"), ("E", "Religion and ethics"), ("C", "Christianity"), ("I", "Islam"),
            ("J", "Judaism"), ("B", "Buddhism"), ("H", "Hinduism")]
PART = re.compile(r"^([1-6])\.\s+([A-Z].+)$")  # "1.\u2002Philosophical Language and Thought"
# Where a topic's text stops being about its content: the reading lists and references under it.
READING = re.compile(r"^(Suggested scholarly views|Contextual references|Learners will be given credit|For reference)")


def fetch():
    path = os.path.join(WORK, "spec", "h573.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def read(doc):
    """[{component (0-6), part, title, star, text}] in order."""
    topics, comp, part, cur, reading = [], -1, None, None, False
    for page in doc:
        if re.search(r"^3a\. ", page.get_text(), re.M) and topics:
            break  # past the content, into assessment
        lines = [l for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if l["spans"]]
        rows = [(l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip(), "Bold" in l["spans"][0]["font"]) for l in lines]
        # The topic column: short lines at the table's left edge, not the introductions and notes that run the page's width.
        names = [(l["bbox"][0], l["bbox"][1], t) for l, (x, y, t, bold) in zip(lines, rows)
                 if 40 < x < 60 and l["bbox"][2] - x < 80 and not bold and 60 < y < page.rect.height - 60 and t.strip("•o ") and t != "Topic"]
        body = sorted([(x, y, t, bold) for x, y, t, bold in rows if x >= 120 and 60 < y < page.rect.height - 60 and x < page.rect.width - 40],
                      key=lambda r: (round(r[1]), r[0]))
        for x, y, t, bold in body:
            m = PART.match(t)
            if m and bold:
                if m.group(1) == "1" and part != "1":
                    comp += 1
                part, cur = m.group(1), None
        if comp < 0 or part is None:
            continue
        # The topic names on this page, a name over several lines read as one.
        starts, last = [], None
        for x, y, t in sorted(names, key=lambda r: r[1]):
            if last is not None and y - last < 16:
                starts[-1][1] += ("" if starts[-1][1].endswith("-") else " ") + t  # "Twentieth-" "century perspectives"
            else:
                starts.append([y, t])
            last = y
        if not starts and cur is None:
            continue
        cuts = [(y, name) for y, name in starts if not name.endswith(".")]  # (an introduction's last words, "…are discussed.")
        for x, y, t, bold in body:
            if bold or t in ("•", "o", "Topic", "Content", "Key Knowledge"):
                if bold and READING.match(t):
                    reading = True
                continue
            while cuts and y >= cuts[0][0] - 2:
                name = re.sub(r"\s+", " ", cuts.pop(0)[1].replace("•", " ")).strip()
                cur = {"component": comp, "part": part, "title": name.rstrip("*").strip(), "star": name.endswith("*"), "text": ""}
                topics.append(cur)
                reading = False
            if READING.match(t):
                reading = True
            if cur is not None and not reading:
                cur["text"] = (cur["text"] + " " + t).strip()
        for y, name in cuts:  # a name with no text beside it on this page
            name = re.sub(r"\s+", " ", name.replace("•", " ")).strip()
            cur = {"component": comp, "part": part, "title": name.rstrip("*").strip(), "star": name.endswith("*"), "text": ""}
            topics.append(cur)
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:1500]
    return topics


def main():
    topics = read(fetch())
    tree = {"sections": [{"code": c, "title": title} for c, title in SECTIONS], "topics": []}
    n = {}
    for t in topics:
        code = SECTIONS[t["component"]][0]
        n[code] = n.get(code, 0) + 1
        tree["topics"].append({"code": f"{code}{n[code]}", "ref": "", "title": t["title"][0].upper() + t["title"][1:], "section": code,
                               "part": int(t["part"]), "text": t["text"], "year": 1 if t["star"] else 2})
    json.dump({"H573": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['topics'])} topics, {sum(t['year'] == 1 for t in tree['topics'])} AS", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:4} part {t['part']} y{t['year']} {t['title']} ({len(t['text'])}): {t['text'][:70]}", file=sys.stderr)


if __name__ == "__main__":
    main()
