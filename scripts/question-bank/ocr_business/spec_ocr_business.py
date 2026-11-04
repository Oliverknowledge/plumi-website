"""Read OCR's A-Level Business specification (H431) into the bank's topic tree.

    python3 scripts/question-bank/ocr_business/spec_ocr_business.py [work-dir]   # default .work/ocr-business

The content is a three-column table, unnumbered: "Area of Study" (a tab of the page, repeated over
each page), "Content" (the topic's title, wrapping over lines) and "Learners should be able to:" (its
bullets, kept as "text" for tagging only). AS (H031) teaches the same areas under the same titles, so
one tree serves both. The areas that OCR splits by where they sit in the book ("The workforce",
"Management accounting") are put under the eight the specification introduces in 2b (SECTIONS).
The specification prints no numbers, so the codes are the bank's own: "5.3", section "5", ref "".
"The strategy" (four times) and "Services" (twice) are named so each has its own address.
Writes <work-dir>/spec.json in spec_ocr.py's shape, under H431.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-business"))
URL = "https://www.ocr.org.uk/Images/170837-specification-accredited-a-level-gce-business-h431.pdf"
SECTIONS = [("1", "Introduction to business", r"Introduction to Business"),
            ("2", "Business objectives and strategy", r"Business objectives and strategy"),
            ("3", "External influences", r"External influences"),
            ("4", "Change", r"Change"),
            ("5", "Accounting and finance", r"Accounting and finance|Management accounting|Financial accounting|The finance strategy"),
            ("6", "Human resource management", r"Human resource|The workforce|Management$|Human resources"),
            ("7", "Marketing", r"Marketing|Customer needs|The marketing"),
            ("8", "Operations management", r"Operations|The production|Productive")]
RENAME = {("5", "The strategy"): "The finance strategy", ("6", "The strategy"): "The human resources strategy",
          ("7", "The strategy"): "The marketing strategy", ("8", "The strategy"): "The operations strategy",
          ("8", "Services", 0): "Services and the production process", ("8", "Services", 1): "Quality in services"}
AREA_X, CONTENT_X, TEXT_X = (40, 60), (150, 175), 200


def fetch():
    path = os.path.join(WORK, "spec", "h431.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def section_of(area):
    return next((code for code, _, pat in SECTIONS if re.match(pat, area)), None)


def read(doc):
    """[{section, title, text}] in order."""
    topics, cur, area_key = [], None, None
    for page in doc:
        text = page.get_text()
        if "Learners should be able to:" not in text or "Area of Study" not in text:
            if cur:
                break
            continue
        rows = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip())
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])), key=lambda r: (round(r[1]), r[0]))
        rows = [(x, y, t) for x, y, t in rows if t and t not in ("•", "Area of Study", "Content", "Learners should be able to:")
                and 60 < y < page.rect.height - 50 and x > 30 and len(t) < 90 or t and x > TEXT_X and 60 < y < page.rect.height - 50 and t != "•"]
        rows = [(x, y, t) for x, y, t in rows if not re.fullmatch(r"\d\s.*|\d", t) and t != "Learners should be able to:"]
        # An area's name wraps: join its lines before reading which section it opens.
        areas = [(y, t) for x, y, t in rows if AREA_X[0] <= x <= AREA_X[1]]
        joined, last = [], -99
        for y, t in areas:
            if y - last < 14 and joined:
                joined[-1] = (joined[-1][0], joined[-1][1] + " " + t)
            else:
                joined.append((y, t))
            last = y
        last_title = -99
        for x, y, t in rows:
            if AREA_X[0] <= x <= AREA_X[1]:
                continue
            here = next((a for ay, a in reversed(joined) if ay <= y + 2), None)
            if here:
                area_key = section_of(here) or area_key
            if CONTENT_X[0] <= x <= CONTENT_X[1]:
                # (a title can wrap with a wider gap: "Risk and" over "uncertainty", "Identifying customer needs" over "(cont.)")
                if cur and (y - last_title < 14 or y - last_title < 30 and (cur["title"].endswith(" and") or t == "(cont.)")):
                    cur["title"] += " " + t
                else:
                    cur = {"section": area_key, "title": t, "text": ""}
                    topics.append(cur)
                last_title = y
            elif x > TEXT_X and cur:
                cur["text"] += " " + t
    merged = []
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip()
        t["title"] = re.sub(r"(\w)- (\w)", r"\1-\2", t["title"])
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()
        if t["title"].endswith("(cont.)"):
            merged[-1]["text"] += " " + t["text"]
        else:
            merged.append(t)
    return merged


def main():
    topics = read(fetch())
    seen, codes, out = {}, {}, []
    for t in topics:
        s = t["section"]
        n = seen.get((s, t["title"]), 0)
        seen[(s, t["title"])] = n + 1
        title = RENAME.get((s, t["title"], n)) or RENAME.get((s, t["title"])) or t["title"]
        codes[s] = codes.get(s, 0) + 1
        out.append({"code": f"{s}.{codes[s]}", "ref": "", "title": title, "section": s, "text": t["text"], "year": 0})
    tree = {"sections": [{"code": c, "title": title} for c, title, _ in SECTIONS], "topics": out}
    for t in out:
        print(f"  {t['code']:5} {t['title']} ({len(t['text'])})", file=sys.stderr)
    assert all(t["text"] for t in out), [t["title"] for t in out if not t["text"]]
    assert len({t["title"] for t in out}) == len(out), "two topics share a title"
    json.dump({"H431": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(out)} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
