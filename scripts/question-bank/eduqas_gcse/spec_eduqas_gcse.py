"""Read Eduqas's GCSE Religious Studies or History specification into the bank's topic tree.

    python3 scripts/question-bank/eduqas_gcse/spec_eduqas_gcse.py rs|history [work-dir]
    # default work dir: .work/eduqas-gcse-<subject>; reads specs/spec.pdf (fetch_eduqas_gcse.py)

Religious Studies (C120QS) sets its content out in tables, "Areas of Study" down the left and
"Specific Content" to the right. Here a section is what a paper's question is on, and a topic
is an area of study:
  - Route A's Component 1, four themes ("T1" Issues of Relationships to "T4" Issues of Human
    Rights), each taught from a Christian perspective and then each world faith's, with the same
    areas ("Sexual relationships"): one topic per area, its content every perspective's;
  - Component 2, Christianity ("CH"), and Component 3's five faiths ("BU", "HI", "IS", "JU",
    "SI"), each its beliefs and teachings, then its practices;
  - Route B's four themes, "B1" Origins and Meaning to "B4" Sin and Forgiveness, whose areas
    are headed by their kind ("Forms: Painting"). Route B's Component 3 is Route A's Judaism.
History (C100QS) has a table per option, its "Key questions" on the left (a bold title, "The
Black Death", then the question) and its "Required Content" on the right. A section is an
option ("1A" Conflict and Upheaval: England, 1337-1381), a topic is a key question's area, and a
thematic study (2E-2H) has one more, its historic site, which Eduqas names for two years at a time.

Writes <work-dir>/spec.json: {sections: [{code, title, option?}], topics: [{code, ref, title,
section, text}]}; `text` (the area's content) is for tagging.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SUBJECT = ARGS[0] if ARGS else "rs"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-{SUBJECT}")
FAITHS = {"Buddhism": "BU", "Hinduism": "HI", "Islam": "IS", "Judaism": "JU", "Sikhism": "SI"}
ROUTE_B = {"Origins and Meaning": "B1", "Good and Evil": "B2", "Life and Death": "B3", "Sin and Forgiveness": "B4"}
# Areas as a student would know them: the specification's can run to a sentence, and a topic's slug is made from its title
SHORT = {
    "Issues of equality: gender prejudice and discrimination": "Gender prejudice and discrimination",
    "Christianity in Britain and the Church in the local community": "Christianity in Britain and the local church",
    "Practices: Loving and Serving in Catholic communities in Britain and elsewhere": "Practices: Loving and serving",
    "Practices: Popular devotion as practised in Catholic communities in Britain and elsewhere": "Practices: Popular devotion",
    "Practices: Prayer within Catholic communities in Britain and elsewhere": "Practices: Prayer",
    "Practices: Mission and Evangelisation in Britain and elsewhere": "Practices: Mission and evangelisation",
    "Buddhist places of worship in Britain and elsewhere": "Places of worship",
    "Places of worship in Britain and elsewhere": "Places of worship",
    "Ten Obligatory Acts of Shi’a Islam: practices in Britain and elsewhere": "The Ten Obligatory Acts of Shi’a Islam",
}
# History's options: the section titles as a student would know them (the specification prints them in capitals)
HISTORY = {
    "1A": "Conflict and Upheaval: England, 1337–1381", "1B": "The Elizabethan Age, 1558–1603",
    "1C": "Empire, Reform and War: Britain, 1890–1918", "1D": "Austerity, Affluence and Discontent: Britain, 1951–1979",
    "1E": "The Crusades, c.1095–1149", "1F": "The Voyages of Discovery and Conquest of the Americas, 1492–1522",
    "1G": "Germany in Transition, 1919–1939", "1H": "The USA: A Nation of Contrasts, 1910–1929",
    "2A": "The Development of the USA, 1929–2000", "2B": "The Development of Germany, 1919–1991",
    "2C": "The Development of the USSR, 1924–1991", "2D": "The Development of the UK, 1919–1990",
    "2E": "Crime and Punishment in Britain, c.500 to the present day", "2F": "Health and Medicine in Britain, c.500 to the present day",
    "2G": "Warfare in Britain, c.500 to the present day", "2H": "Entertainment and Leisure in Britain, c.500 to the present day",
}


ASKS = re.compile(r"^(How|What|Why|Was|Were|Did|Do|To what|Which|Who|In what|Is|Has|Have|Had|Are)\b")
# Titles that run to a line and a half
SHORT_HISTORY = {
    "The economic impact of the Second World War and post-war developments": "The post-war economy",
    "The Rise of the Nazi Party and its consolidation of power between 1933 and 1934": "The rise of the Nazis",
    "The collapse of communism and the break-up of the USSR": "The collapse of the USSR",
    "Childrens’ entertainment": "Children’s entertainment",
}


def study(code):
    """History's option groups, the bank's "Study" filter: 1A-1D British depth, 1E-1H non-British, 2A-2D period, 2E-2H thematic."""
    return {"1": "british" if code[1] in "ABCD" else "non-british", "2": "period" if code[1] in "ABCD" else "thematic"}[code[0]]


def lines(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            text = "".join(s["text"] for s in l["spans"]).strip()
            if text:
                out.append({"text": text, "x0": l["bbox"][0], "x1": l["bbox"][2], "y0": l["bbox"][1], "font": l["spans"][0]["font"]})
    return sorted(out, key=lambda l: (round(l["y0"]), l["x0"]))


def tidy(s):
    return re.sub(r"\s+", " ", s.replace("➢", " ")).strip()


def read_rs(doc):
    sections, topics = [], {}
    section, area, table, started = None, None, False, False
    for page in doc:
        ls = lines(page)
        # (the contents page lists these headings too: a heading is at the top of its page)
        heads = [l["text"] for l in ls if l["y0"] < 100]
        if "2.1 Component 1 (Route A)" in heads:
            started = True
        if not started:
            continue
        if "2.6 Component 3 (Route B)" in heads or "3 ASSESSMENT" in heads:
            break
        # A row's area runs over several lines in the left column, its content beside and below it.
        names, content = [], []
        for l in ls:
            t, x = l["text"], l["x0"]
            m = re.match(r"^Theme (\d): (?:Issues of )?(.+?)\s*$", t)
            if m and x < 80:
                name = m.group(2)
                code = ROUTE_B.get(name) if name in ROUTE_B and any(s["code"] == "CH" for s in sections) else f"T{m.group(1)}"
                if code not in [s["code"] for s in sections]:
                    sections.append({"code": code, "title": f"Issues of {name}" if code.startswith("T") else name})
                section, area, table = code, None, False
                continue
            if t == "Study of Christianity":
                sections.append({"code": "CH", "title": "Christianity"})
                section, area, table = "CH", None, False
                continue
            if t in FAITHS and 130 < x < 160:  # "Option 1:" … "Buddhism" on one line
                sections.append({"code": FAITHS[t], "title": t, "option": FAITHS[t].lower()})
                section, area, table = FAITHS[t], None, False
                continue
            if section is None:
                continue
            if t == "Areas of Study":
                table = True
                continue
            if t.startswith("From the study of") or t == "Concepts:":
                table = False  # the concepts list, then the next table
                continue
            if not table:
                continue
            if 75 < x < 86 and l["x1"] < 186:
                if names and l["y0"] - names[-1]["y"] < 15:
                    names[-1]["text"] += " " + t  # the area's name runs on ("Issues of equality:" "gender prejudice")
                    names[-1]["y"] = l["y0"]
                else:
                    names.append({"text": t, "top": l["y0"], "y": l["y0"]})
            elif x >= 175 and not re.match(r"^(Specific Content|GCSE RELIGIOUS STUDIES \d+)$", t):
                content.append(l)
        for nm in names:
            area = tidy(nm["text"])
            topics.setdefault((section, area), {"text": "", "top": nm["top"]})
        for l in content:
            # the row it is in: the last area that starts above it (or the one carried over from the page before)
            own = [nm for nm in names if nm["top"] <= l["y0"] + 2]
            key = (section, tidy(own[-1]["text"])) if own else (section, area) if area else None
            if key:
                topics[key]["text"] += " " + l["text"]
    out, n = [], {}
    for (section, area), v in topics.items():
        n[section] = n.get(section, 0) + 1
        title = re.sub(r"\s*:\s*", ": ", re.sub(r"(\w)- (\w)", r"\1-\2", area)).rstrip(": ")
        title = SHORT.get(title, re.sub(r":? practices in Britain and elsewhere$", "", title))
        out.append({"code": f"{section}.{n[section]}", "ref": "", "title": title, "section": section, "text": tidy(v["text"])})
    return sections, out


def read_history(doc):
    sections, topics = [], []
    section = None
    for page in doc:
        ls = lines(page)
        if any(l["text"].startswith("3 ASSESSMENT") for l in ls):
            break
        rows = []
        for l in ls:
            m = re.match(r"^(\d[A-H])\.\s*\S", l["text"])
            if m and l["x0"] < 40 and "Bold" in l["font"] and m.group(1) in HISTORY:
                section = m.group(1)
                if section not in [s["code"] for s in sections]:
                    sections.append({"code": section, "title": HISTORY[section], "option": study(section)})
                continue
            if section and l["text"].startswith("A study of the historic environment"):
                topics.append({"code": f"{section}.site", "ref": "", "title": "The historic site", "section": section, "text": ""})
                rows = None
                continue
            if section and rows is None:
                if l["y0"] > 60 and l["text"] not in ("Required Content",):
                    topics[-1]["text"] += " " + l["text"]
                continue
            if not section or l["text"] in ("Key questions", "Required Content"):
                continue
            if 36.5 < l["x0"] < 45 and "Bold" in l["font"]:
                r = rows[-1] if rows and l["y0"] - rows[-1]["y"] < 15 else None
                if r and (r["question"] or ASKS.match(l["text"])):
                    r["question"] += " " + l["text"]  # the key question, under its title
                elif r:
                    r["title"] += " " + l["text"]  # the title runs on ("… and post-" "war developments")
                else:
                    rows.append({"title": l["text"], "question": "", "content": "", "y": l["y0"]})
                    continue
                r["y"] = l["y0"]
            elif rows and l["x0"] > 250 and "Italic" in l["font"]:
                rows[-1]["content"] += " " + l["text"]
        for r in rows or []:
            n = sum(1 for t in topics if t["section"] == section) + 1
            title = re.sub(r"(\w)- (\w)", r"\1-\2", tidy(r["title"])).replace(" )", ")")
            title = re.sub(r"`([^`]+)`", r"‘\1’", title).replace("`", "’")
            topics.append({"code": f"{section}.{n}", "ref": "", "title": SHORT_HISTORY.get(title, title), "section": section,
                           "text": tidy(f"{r['question']} {r['content']}")})
    for t in topics:
        t["text"] = tidy(t["text"])[:2500]
    return sections, topics


def main():
    doc = pymupdf.open(os.path.join(WORK, "specs", "spec.pdf"))
    sections, topics = read_rs(doc) if SUBJECT == "rs" else read_history(doc)
    json.dump({"sections": sections, "topics": topics}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"{s['code']} {s['title']}: {len(mine)} topics", file=sys.stderr)
        for t in mine:
            print(f"    {t['code']} {t['title']}  [{len(t['text'])} chars] {t['text'][:70]}", file=sys.stderr)


if __name__ == "__main__":
    main()
