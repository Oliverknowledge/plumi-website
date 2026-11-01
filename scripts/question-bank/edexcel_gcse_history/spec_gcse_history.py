"""Read Pearson's GCSE (9-1) History (1HI0) specification into the bank's topic tree.

    python3 scripts/question-bank/edexcel_gcse_history/spec_gcse_history.py [work-dir]
    # reads <work-dir>/specs/spec.pdf: Pearson's "GCSE (9-1) History Specification", Issue 6

A section is an option, a paper a student sits ("10" Crime and punishment in Britain, "P4" Superpower
relations and the Cold War), and its topics are how the specification divides it:
  - Paper 1's thematic studies, four periods ("c1000–c1500: Crime and punishment in medieval England"),
    then the historic environment linked to it ("Whitechapel, c1870–c1900"): <option>.1 to .4 and .site;
  - Papers 2 and 3, the key topics ("Key topic 1: Anglo-Saxon England and the Norman Conquest, 1060–66").
Each section carries the kind of study it is (`option`): thematic, period, british or modern, the bank's filter.

Writes <work-dir>/spec.json: {sections: [{code, title, option}], topics: [{code, ref, title, section, text}]}.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-history")
# The options as the specification names them, and the kind of study each is
OPTIONS = {
    "10": ("Crime and punishment in Britain, c1000–present, and Whitechapel, c1870–c1900", "thematic"),
    "11": ("Medicine in Britain, c1250–present, and the British sector of the Western Front, 1914–18", "thematic"),
    "12": ("Warfare and British society, c1250–present, and London and the Second World War, 1939–45", "thematic"),
    "13": ("Migrants in Britain, c800–present, and Notting Hill, c1948–c1970", "thematic"),
    "P1": ("Spain and the ‘New World’, c1490–c1555", "period"),
    "P2": ("British America, 1713–83: empire and revolution", "period"),
    "P3": ("The American West, c1835–c1895", "period"),
    "P4": ("Superpower relations and the Cold War, 1941–91", "period"),
    "P5": ("Conflict in the Middle East, 1945–95", "period"),
    "B1": ("Anglo-Saxon and Norman England, c1060–88", "british"),
    "B2": ("The reigns of King Richard I and King John, 1189–1216", "british"),
    "B3": ("Henry VIII and his ministers, 1509–40", "british"),
    "B4": ("Early Elizabethan England, 1558–88", "british"),
    "30": ("Russia and the Soviet Union, 1917–41", "modern"),
    "31": ("Weimar and Nazi Germany, 1918–39", "modern"),
    "32": ("Mao’s China, 1945–76", "modern"),
    "33": ("The USA, 1954–75: conflict at home and abroad", "modern"),
}
OPTION = re.compile(r"^Option (\d{2}|[PB]\d):")
PERIOD = re.compile(r"^(c?\d{3,4}\s*[–-]\s*(?:c?\d{3,4}|present)):\s*(.+)$")
KEY = re.compile(r"^Key topic (\d):\s*(.+)$")
FURNITURE = re.compile(r"^(Pearson Edexcel Level 1/Level 2 GCSE.*|Specification – Issue.*|\d{1,3})$")


def main():
    doc = pymupdf.open(os.path.join(WORK, "specs", "spec.pdf"))
    lines = []
    for i in range(len(doc)):
        lines += [l.strip() for l in doc[i].get_text().split("\n") if l.strip() and not FURNITURE.match(l.strip())]
    sections, topics, option, topic = [], [], None, None
    for k, l in enumerate(lines):
        m = OPTION.match(l)
        if m and m.group(1) in OPTIONS and m.group(1) not in {s["code"] for s in sections}:
            option, topic = m.group(1), None
            sections.append({"code": option, "title": OPTIONS[option][0], "option": OPTIONS[option][1]})
            continue
        if option is None:
            continue
        if re.match(r"^(Paper 2: Period study and British depth study|Paper 3: Modern depth study|Assessment information|3 Assessment)", l) \
                and OPTION.match(" ".join(lines[k + 1:k + 3])) is None and topic:
            if OPTIONS[option][1] == "modern" and option == "33":
                option = None  # past the last option
            continue
        new = None
        if OPTIONS[option][1] == "thematic":
            p = PERIOD.match(l)
            if p and not any(t["section"] == option and t["ref"] == p.group(1) for t in topics):
                n = sum(1 for t in topics if t["section"] == option) + 1
                title = p.group(2)
                if re.search(r"(-| and| the| in)$", title):  # a title wrapped onto the next line
                    title += ("" if title.endswith("-") else " ") + lines[k + 1]
                new = {"code": f"{option}.{n}", "ref": p.group(1), "title": f"{p.group(1)}: {title}"}
            elif l == "The historic environment" and not any(t["code"] == f"{option}.site" for t in topics):
                new = {"code": f"{option}.site", "ref": "", "title": lines[k - 1] if PERIOD.match(lines[k - 1]) is None else lines[k - 1]}
                # the site's name is the heading over "The historic environment", which can wrap
                title = [lines[j] for j in range(k - 3, k) if not re.search(r"[.●]$", lines[j])]
                new["title"] = re.sub(r"\s+", " ", " ".join(title[-2:] if len(" ".join(title[-1:])) < 30 else title[-1:])).strip()
        else:
            m = KEY.match(l)
            if m and not any(t["section"] == option and t["ref"] == f"Key topic {m.group(1)}" for t in topics):
                title = m.group(2)
                if not re.search(r"\d{2}$|\)$", title) and k + 1 < len(lines) and len(lines[k + 1]) < 40 and not lines[k + 1].startswith(("1", "●")):
                    title += " " + lines[k + 1]
                new = {"code": f"{option}.{m.group(1)}", "ref": f"Key topic {m.group(1)}", "title": title}
        if new:
            topic = {**new, "section": option, "text": ""}
            topics.append(topic)
        elif topic:
            topic["text"] += " " + l
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:2500]
    json.dump({"sections": sections, "topics": topics}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"{s['code']} {s['title']}: " + "; ".join(f"{t['code']} {t['title']} ({len(t['text'])})" for t in mine), file=sys.stderr)


if __name__ == "__main__":
    main()
