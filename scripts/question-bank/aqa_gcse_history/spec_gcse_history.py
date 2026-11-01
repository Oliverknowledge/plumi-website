"""Read AQA's GCSE History (8145) specification into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_history/spec_gcse_history.py [work-dir]   # default .work/aqa-gcse-history; reads specs/spec.pdf

The specification (AQA-8145-SP-2016, version 1.3) sets each option out as its title ("AB Germany,
1890–1945: Democracy and dictatorship"), then its parts ("Part two: Germany and the Depression"),
each a list of bullets that open on their subject ("Weimar democracy: political change and unrest,
1919–1923, …"). A section is an option, coded by paper, section and option as AQA codes its papers
("1AB", "2BC"); a topic is a bullet, titled by the words before its colon. A British depth study's
Part four, its historic environment, is one topic ("2BC.site"), as the site changes every year.
(The specification heads Power and the people "BB"; it is Section A's Option B, "2AB".)

Writes <work-dir>/spec.json: {sections: [{code, title, option}], topics: [{code, ref, title, section, part, text}]}.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "aqa-gcse-history")
SECTIONS = {"3.2.1": "1A", "3.2.2": "1B", "3.3.1": "2A", "3.3.2": "2B"}
# A bullet's subject as a student would know it, where the specification's runs on
SHORT = {
    "The development of Germ Theory and its impact on the treatment of disease in Britain": "Germ Theory and the treatment of disease",
    "Why the early settlers went west and the challenges they faced": "The early settlers and their challenges",
    "Racial tension and developments in the Civil Rights campaigns in the 1950s and 1960s": "Racial tension and the Civil Rights campaigns",
    "The effectiveness of the New Deal on different groups in society": "The effectiveness of the New Deal",
    "Military developments in 1918 and their contribution to Germany’s defeat": "Military developments in 1918",
    "The Gulf War,1990": "The Gulf War, 1990",
}


def lines(doc):
    """[(page, x0, size, bold, text)] of the subject content (section 3), top to bottom, page furniture left out."""
    out = []
    for pg in range(len(doc)):
        page = doc[pg]
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                t = "".join(s["text"] for s in l["spans"]).strip()
                y = l["bbox"][1]
                if not t or y < 40 or y > page.rect.height - 50:
                    continue
                sp = l["spans"][0]
                out.append((pg, l["bbox"][0], round(sp["size"]), "Bold" in sp["font"], t))
    return out


def main():
    doc = pymupdf.open(os.path.join(WORK, "specs", "spec.pdf"))
    sections, topics = [], []
    sec = opt = part = None
    bullet = None
    letters = {}

    def close():
        nonlocal bullet
        if bullet and opt:
            text = re.sub(r"\s+", " ", bullet).strip()
            subject = text.split(":", 1)[0].strip() if ":" in text[:110] else None
            if subject:
                n = sum(1 for t in topics if t["section"] == opt) + 1
                title = SHORT.get(subject, subject)
                topics.append({"code": f"{opt}.{n}", "ref": "", "title": title[:1].upper() + title[1:], "section": opt, "part": part,
                               "text": text.split(":", 1)[1].strip()})
        bullet = None

    for pg, x, size, bold, t in lines(doc):
        m = re.match(r"^(3\.\d\.\d) Section [AB]", t)
        if size == 16 and m:
            close()
            sec, opt, part = SECTIONS.get(m.group(1)), None, None
            continue
        if size >= 19 and t.startswith("4 Scheme") or re.match(r"^4\.\d", t) and size >= 16:
            close()
            break
        m = re.match(r"^[AB]([A-E]) (.+)$", t)
        if size == 13 and sec and m:
            close()
            letter = "ABCDE"[letters.setdefault(sec, 0)]
            letters[sec] += 1
            opt, part = f"{sec}{letter}", None
            sections.append({"code": opt, "title": m.group(2).replace(" - ", ": "), "option": opt.lower()})
            continue
        if size == 13 and opt and sections[-1]["code"] == opt and not bold and x < 60 and not part:
            continue
        if bold and size == 11 and t.startswith("Part "):
            close()
            part = t
            if "historic environment" in t:
                topics.append({"code": f"{opt}.site", "ref": "", "title": "The historic environment", "section": opt, "part": part,
                               "text": "The specified site, which AQA changes every year: its location, function, structure, design, the "
                                       "people connected with it, and how the depth study's events and developments are connected to it."})
                part = "site"
            continue
        if not opt or not part or part == "site":
            continue
        if t == "•":
            close()
            bullet = ""
        elif bullet is not None and 80 < x < 95:
            bullet += " " + t
        elif x < 70:
            close()
    by = {}
    for t in topics:
        by[t["section"]] = by.get(t["section"], 0) + 1
    for s in sections:
        print(f"{s['code']} {s['title']}: {by.get(s['code'], 0)} topics", file=sys.stderr)
    json.dump({"sections": sections, "topics": topics}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} sections, {len(topics)} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
