"""Read OCR's A-Level Physical Education specification (H555) into the bank's topic tree.

    python3 scripts/question-bank/ocr_pe/spec_ocr_pe.py [work-dir]   # default .work/ocr-pe

Writes <work-dir>/spec.json in spec_ocr.py's shape, under H555. The specification's content is a
table for each of its subsections ("1.1.a. Skeletal and muscular systems", "2.2 ... Group and team
dynamics"), a row for each "Topic Area" (no numbers) with what students should know beside it:
  - the sections are the specification's seven numbered areas: 1.1 Applied anatomy and physiology,
    1.2 Exercise physiology and 1.3 Biomechanics (Paper 1), 2.1 Skill acquisition and 2.2 Sport psychology
    (Paper 2), 3.1 Sport and society and 3.2 Contemporary issues in physical activity and sport (Paper 3);
  - a topic is a table row. Its title is the first column (wrapped over lines, "*" marking some rows,
    "cont." where a row runs over a page), its code its section and place in it ("1.1.3") and its `ref`
    the lettered subsection the specification puts it under ("1.1.a"), where it has one;
  - the table's right-hand column is the topic's `text`, for tagging only;
  - a topic is AS content (year 1) where the AS specification (H155) has a topic area of the same name
    ("Cardiovascular system at rest"); the rest is A-Level only (year 2). AS Paper 2 is one paper on
    psychological and socio-cultural themes.
Rows are found by the table's horizontal rules.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-pe"))
URLS = {"h555": "https://www.ocr.org.uk/Images/234833-specification-accredited-a-level-gce-physical-education-h555.pdf",
        "h155": "https://www.ocr.org.uk/Images/234832-specification-accredited-as-level-gce-physical-education-h155.pdf"}
AREA = re.compile(r"^[123]\.[123]$")
SUB = re.compile(r"^([123]\.[123]\.[a-d])\.\s*(.+)$")
STOP = re.compile(r"Content of non-exam assessment|Content of Evaluating and Analysing|Content of Practical|^2[def]\.")


def fetch(name):
    path = os.path.join(WORK, "spec", f"{name}.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URLS[name], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def clean(t):
    return re.sub(r"\s+", " ", t.replace("\x07", " ").replace(" ", " ").replace("•", " • ")).strip()


AREAS = {"1.1": "Applied anatomy and physiology", "1.2": "Exercise physiology", "1.3": "Biomechanics", "2.1": "Skill acquisition",
         "2.2": "Sports psychology", "3.1": "Sport and society", "3.2": "Contemporary issues in physical activity and sport"}


def read(doc, first_area="1.1"):
    """[(area, title)], [{area, sub, title, text}] in order. The A-Level specification opens its content on
    page 10 in 1.1 (whose heading is a graphic); `first_area` is where a specification starts."""
    areas, topics, cur_area, cur_sub = [], [], first_area, None
    for page in doc:
        if page.number < 9:
            continue
        rows = sorted(((round(l["bbox"][1]), l["bbox"][0], l["bbox"][3], clean("".join(s["text"] for s in l["spans"])))
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])), key=lambda r: (r[0], r[1]))
        rows = [r for r in rows if r[3] and 95 < r[0] < 790 and 30 < r[1] < 560]  # (not the page tab down the edge, "2")
        text = " ".join(r[3] for r in rows)
        if any(STOP.search(r[3]) and r[1] < 60 for r in rows) and topics:
            break
        heads = []  # (y, area or None, sub or None): the headings on this page, in reading order
        for y, x, y1, t in rows:
            if x < 60 and AREA.match(t):
                heads.append((y, t, None))
            elif x < 60 and (m := SUB.match(t)):
                heads.append((y, None, m.group(1)))
        start = (cur_area, cur_sub)
        for _, ar, sb in heads:
            if ar:
                cur_area, cur_sub = ar, None
            else:
                cur_sub = sb
        end = (cur_area, cur_sub)
        # the table's rules: a row sits between two
        rules = sorted({round(d["rect"].y0, 1) for d in page.get_drawings() if d["rect"].height < 2 and d["rect"].width > 50 and d["rect"].x0 < 60})
        head = next((r for r in rows if r[3].lower() == "topic area"), None)
        if not head:
            continue
        content_x = next((r[1] for r in rows if r[3] == "Content" and abs(r[0] - head[0]) < 4), 170)
        below = [y for y in rules if y > head[0]]
        bounds = [y for y in below if y > head[0]] + [800]
        for a, b in zip(bounds, bounds[1:]):
            if a < head[0]:
                continue
            first = [r for r in rows if a - 1 <= r[0] < b - 1 and 50 < r[1] < 60]
            rest = [r for r in rows if a - 1 <= r[0] < b - 1 and r[1] >= content_x - 3]
            title = clean(" ".join(r[3] for r in first))
            if not title or title.lower() == "topic area":
                continue
            body = clean(" ".join(r[3] for r in rest))
            if re.search(r"\bcont\.?$", title) and topics:
                topics[-1]["text"] = (topics[-1]["text"] + " " + body).strip()
                continue
            # (the headings above the row on this page, else where the last page left off)
            area, sub = start
            for y, ar, sb in heads:
                if y < a:
                    area, sub = (ar, None) if ar else (area, sb)
            topics.append({"area": area, "sub": sub, "title": title.lstrip("* ").strip(), "text": body})
    for t in topics:
        t["title"] = re.sub(r"\s+", " ", t["title"]).strip().rstrip(".")
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:2400]
    return areas, topics


def main():
    topics = read(fetch("h555"))[1]
    areas = [(a, t) for a, t in AREAS.items() if any(x["area"] == a for x in topics)]
    as_topics = read(fetch("h155"), "AS")[1]
    as_names = {t["title"].lower() for t in as_topics} | {"analysing movement through the use of technology"}  # (the AS says "Analysis through…")
    tree = {"sections": [{"code": a, "title": f"{a} {title}", "short": title} for a, title in areas], "topics": []}
    seen = {}
    for t in topics:
        seen[t["area"]] = seen.get(t["area"], 0) + 1
        tree["topics"].append({"code": f"{t['area']}.{seen[t['area']]}", "ref": t["sub"] or "", "title": t["title"], "section": t["area"],
                               "text": t["text"], "year": 1 if t["title"].lower() in as_names else 2})
    json.dump({"H555": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics, {sum(t['year'] == 1 for t in tree['topics'])} AS; "
          f"AS topics read: {len(as_topics)}", file=sys.stderr)
    for t in tree["topics"]:
        print(f"  {t['code']:6} {t['ref']:6} y{t['year']} {t['title']} ({len(t['text'])})", file=sys.stderr)
    unmatched = sorted(as_names - {t["title"].lower() for t in tree["topics"]} - {"analysis through the use of technology"})
    if unmatched:
        print("  AS names not in the A-Level:", unmatched, file=sys.stderr)


if __name__ == "__main__":
    main()
