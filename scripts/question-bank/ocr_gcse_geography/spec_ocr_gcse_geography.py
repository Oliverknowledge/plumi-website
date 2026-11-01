"""Read OCR's GCSE Geography B specification (J384) into the bank's topic tree.

    python3 scripts/question-bank/ocr_gcse_geography/spec_ocr_gcse_geography.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-geography

Writes <work-dir>/spec.json under J384: sections and the topics under them, each with the specification's words
("text", for tagging only, never shown).
  - The eight content topics (Topic 1 Global Hazards … Topic 8 Resource Reliance) are the sections. Each enquiry
    question's sub-questions ("1.1 How can weather be hazardous?" > "a. Why do we have weather extremes?") are the
    topics, coded as the specification numbers them ("1.1a"), with the content beside them as their text. The
    sub-questions are read from the content tables' first column, a word or two a line.
  - 9 Geographical Skills: the specification's 9.1-9.4 (cartographic, graphical, numerical and statistical,
    formulating enquiry and argument), a second tag for a part that is mostly a skill.
  - Fieldwork: the six areas the specification says fieldwork is assessed on (i-vi), with codes of the bank's own
    (F1-F6, no ref shown), for Papers 1 and 2's fieldwork sections.
Geographical Exploration (Paper 3) has no content of its own: it is synoptic, so its questions are tagged to the
topics they draw on. The specification is OCR's current one (version 2.0), whose topics are those the 2021-2025
papers were set on.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-geography")
URL = "https://www.ocr.org.uk/Images/737448-specification-accredited-gcse-geography-b-j384.pdf"
SECTIONS = [("1", "Global Hazards"), ("2", "Changing Climate"), ("3", "Distinctive Landscapes"), ("4", "Sustaining Ecosystems"),
            ("5", "Urban Futures"), ("6", "Dynamic Development"), ("7", "UK in the 21st Century"), ("8", "Resource Reliance"),
            ("9", "Geographical Skills"), ("F", "Fieldwork")]
SKILLS = [("9.1", "Cartographic skills"), ("9.2", "Graphical skills"), ("9.3", "Numerical and statistical skills"),
          ("9.4", "Formulating enquiry and argument")]
FIELDWORK = [("F1", "Fieldwork enquiry questions", "Understanding of the kinds of question capable of being investigated through fieldwork and an understanding of the geographical enquiry processes appropriate to investigate these. Hypothesis, aim, enquiry question, sequence of enquiry."),
             ("F2", "Fieldwork techniques and methods", "Understanding of the range of techniques and methods used in fieldwork, including observation and different kinds of measurement. Primary and secondary data, sampling (random, systematic, stratified), equipment, risk assessment, data collection sheets, questionnaires, surveys."),
             ("F3", "Processing and presenting fieldwork data", "Processing and presenting fieldwork data in various ways including maps, graphs and diagrams."),
             ("F4", "Analysing and explaining fieldwork data", "Analysing and explaining data collected in the field using knowledge of relevant geographical case studies and theories. Patterns, trends, anomalies, statistics, mean, median, range."),
             ("F5", "Drawing conclusions from fieldwork", "Drawing evidenced conclusions and summaries from fieldwork transcripts and data. Whether a hypothesis is proved or disproved."),
             ("F6", "Evaluating fieldwork", "Reflecting critically on fieldwork data, methods used, conclusions drawn and knowledge gained. Accuracy, reliability, improvements, limitations.")]
KEY_IDEA = re.compile(r"^(\d\.\d)\.?\s+(.+)$")
SUB = re.compile(r"^([a-g])\.\s+(.+)$")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def rows(doc, pages):
    """Each line of the content tables, in reading order: (page, y, x, text, right edge)."""
    out = []
    for i in pages:
        for b in doc[i].get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in l["spans"])).strip()
                if t and 60 < l["bbox"][1] < doc[i].rect.height - 50:
                    out.append((i, l["bbox"][1], l["bbox"][0], t, l["bbox"][2]))
    return sorted(out, key=lambda r: (r[0], round(r[1]), r[2]))


def content_topics(doc):
    """[{code, title, section, text}] for each enquiry sub-question in topics 1-8."""
    pages = [i for i in range(len(doc)) if re.search(r"Topic [1-8]\s*[–:-]|^\d\.\d\.?\s", doc[i].get_text(), re.M) and "9. Geographical Skills" not in doc[i].get_text()]
    pages = [i for i in pages if i >= 11 and i <= 20]
    out, idea, current = [], None, None
    for pg, y, x, t, x1 in rows(doc, pages):
        m = KEY_IDEA.match(t)
        if m and x < 60:
            idea, current = m.group(1), None
            continue
        if idea is None or re.match(r"Topic \d|Scale$|This enquiry question|Version|Cambridge OCR|^\d+$|^\d[a-z]\.$", t):
            continue
        s = SUB.match(t) if x < 60 else None
        if s:
            current = {"code": f"{idea}{s.group(1)}", "title": s.group(2), "section": idea.split(".")[0], "text": "", "_x": x}
            out.append(current)
        elif current and x < 60 and x1 < 125:
            current["title"] += " " + t  # the sub-question runs on down its narrow column (not a topic's introduction, page-wide)
        elif current and x > 120 and t != "•":
            current["text"] += " " + t
    for t in out:
        t.pop("_x")
        t["title"] = re.sub(r"(\w)- (\w)", r"\1\2", re.sub(r"\s+", " ", t["title"])).strip()  # "environ- ments"
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:3500]
    return out


def skills(doc):
    text = re.sub(r"[\s\x07]+", " ", " ".join(doc[i].get_text() for i in range(len(doc)) if re.search(r"9\.[1-4]\s", doc[i].get_text())))
    out = []
    for n, (code, title) in enumerate(SKILLS):
        a = text.find(code + " With respect")
        b = text.find(SKILLS[n + 1][0] + " With respect") if n + 1 < len(SKILLS) else a + 2500
        out.append({"code": code, "title": title, "section": "9", "text": text[a:b][:3500] if a >= 0 else ""})
    return out


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(fetch(os.path.join(WORK, "spec", "j384.pdf")))
    topics = content_topics(doc) + skills(doc) + [{"code": c, "ref": "", "title": t, "section": "F", "text": x} for c, t, x in FIELDWORK]
    for t in topics:
        t["year"] = 0
    out = {"J384": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s, title in SECTIONS:
        mine = [t for t in topics if t["section"] == s]
        print(f"{s} {title}: {len(mine)} topics", file=sys.stderr)
        for t in mine:
            print(f"   {t['code']} {t['title']} ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
