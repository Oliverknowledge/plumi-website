"""Read WJEC's AS/A Level Business specification into a topic tree.

    python3 scripts/question-bank/wjec/spec_wjec_business.py [work-dir]
    # reads <work-dir>/spec/business.pdf (fetch_wjec.py --only=business); writes <work-dir>/spec.json

Each unit's content is a two-column table, "Content | Amplification": the content area on
the left ("Enterprise", "Business plans"), what students should be able to do on the right.
The bank's sections are the units, but AS Unit 2's four areas (Marketing, Finance, People in
organisations, Operations management) are each a section of their own, since each is as big as
a unit, with the sub-headings the table sets under them ("Product", "Recruitment") as its topics.
Unit 4's PEST and "Ethical, legal and environmental" rows are a factor each ("4.3 Political factors").
Codes: "1.3 Markets", "2.3.5 Training", "3.9 Investment appraisal", "4.10 Globalisation"; AS
topics are year 1, A2's year 2. (Eduqas's A Level Business has the same content, set out as
three components.)

Writes spec.json in spec_wjec.py's shape: {"business": {"sections": [...], "topics": [...]}}.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "wjec-business")
UNITS = {1: "AS Unit 1: Business Opportunities", 2: "AS Unit 2: Business Functions",
         3: "A2 Unit 3: Business Analysis and Strategy", 4: "A2 Unit 4: Business in a Changing World"}
FIRST = {"Enterprise": 1, "Marketing": 2, "Data analysis": 3, "Change": 4}  # each unit's table opens with these


def main():
    doc = pymupdf.open(os.path.join(WORK, "spec", "business.pdf"))
    unit, area = None, None  # area: Unit 2's bold heading
    rows = []  # [unit, area, heading, text]
    for page in doc:
        lines = [l for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
        head = next((l for l in lines if "".join(s["text"] for s in l["spans"]).strip() == "Content"), None)
        if not head:
            continue
        amp = next((l["bbox"][0] for l in lines if "".join(s["text"] for s in l["spans"]).strip() == "Amplification"), 150)
        last_left = None
        for l in sorted(lines, key=lambda l: (round(l["bbox"][1]), l["bbox"][0])):
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in l["spans"])).strip()
            y = l["bbox"][1]
            if not t or y <= head["bbox"][1] + 2 or y > page.rect.height - 50:
                continue
            if l["bbox"][0] < amp - 10:  # the content column
                bold = "Bold" in l["spans"][0]["font"]
                joined = last_left is not None and y - last_left[0] < 15 and last_left[1] == bold
                if bold:
                    area = (area + " " + t) if joined and area else t
                    if area in FIRST:
                        unit = FIRST[area]
                    if not joined:  # the area's own introduction, beside its heading: it goes with its first topic
                        rows.append([unit, area, None, ""])
                elif joined and rows and rows[-1][2] is not None:
                    rows[-1][2] += " " + t
                else:
                    if t in FIRST:
                        unit, area = FIRST[t], None
                    if rows and rows[-1][2] is None:  # the area's introduction becomes its first topic's
                        rows[-1][1:3] = [area if unit == 2 else None, t]
                    else:
                        rows.append([unit, area if unit == 2 else None, t, ""])
                last_left = (y, bold)
            elif rows:
                rows[-1][3] += " " + t
    rows = [r for r in rows if r[2] is not None]
    # Unit 4's "PEST factors" and "Ethical, legal and environmental factors" are headings over one row per factor
    # ("Political", "Economic"): the factors are the topics, named in full ("Political factors").
    kept = []
    for k, (u, a, heading, text) in enumerate(rows):
        heading = re.sub(r"(\w)- (?=[a-z])", r"\1-", heading)  # "non- financial", broken over two lines
        if not text.strip() and k + 1 < len(rows) and rows[k + 1][0] == u:
            continue
        if u == 4 and heading in ("Political", "Economic", "Social", "Technological", "Ethical", "Legal", "Environmental"):
            heading += " factors"
        kept.append((u, a, heading, text))
    rows = kept
    sections, topics, areas = [], [], {}
    for u, title in UNITS.items():
        if u != 2:
            sections.append({"code": str(u), "title": title})
    n = {}
    for u, a, heading, text in rows:
        if u == 2:
            if a not in areas:
                areas[a] = f"2.{len(areas) + 1}"
                name = {"People in organisations (human resources)": "People in organisations"}.get(a, a)
                sections.insert(1 + len(areas) - 1, {"code": areas[a], "title": f"AS Unit 2: {name}"})
            sec = areas[a]
        else:
            sec = str(u)
        n[sec] = n.get(sec, 0) + 1
        topics.append({"code": f"{sec}.{n[sec]}", "title": heading.rstrip("."), "section": sec, "year": 1 if u in (1, 2) else 2,
                       "text": re.sub(r"\s+", " ", text).strip()[:1500]})
    tree = {"sections": sections, "topics": topics}
    json.dump({"business": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        print(s["code"], s["title"], [t["title"] for t in topics if t["section"] == s["code"]], file=sys.stderr)


if __name__ == "__main__":
    main()
