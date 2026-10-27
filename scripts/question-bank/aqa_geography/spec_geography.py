"""Read AQA's A-Level Geography specification (7037) into the bank's topic tree.

    python3 scripts/question-bank/aqa_geography/spec_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-geography

The A-Level subject content numbers its areas (3.1.1 Water and carbon cycles … 3.2.5
Resource security) and each area's topics (3.1.1.2 The water cycle). Writes
<work-dir>/spec.json under 7037:
  - sections are the areas, each option its own ("3.1.2 Hot desert systems and
    landscapes", "3.1.3 Coastal systems and landscapes"), so a student shows only the
    options they study;
  - topics are the numbered topics under them, with their own codes ("3.1.1.2") and the
    specification's words ("text", for tagging only). A topic's subheadings (3.2.1.5.1
    Antarctica as a global common) are part of its text;
  - a last section, Fieldwork investigation and geographical skills, holds the stages
    of a fieldwork enquiry the AS specification (7036, 3.4) lists for its Paper 2
    Section B, with its skills checklist (3.5). The specifications number neither as
    topics, so these codes ("3.3.2") are the bank's own and aren't shown.
The AS covers water and carbon, coasts, glaciers, hazards, urban environments, changing
places and fieldwork (Year 1 · AS); deserts, ecosystems, global systems, population and
resources are A-Level only (Year 2), as in the Edexcel Geography bank.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-geography")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/geography/specifications/AQA-7037-SP-2016.PDF"
AS_URL = "https://filestore.aqa.org.uk/resources/geography/specifications/AQA-7036-SP-2016.PDF"
FOOTER = re.compile(r"(AQA A-level Geography 7037\. A-level exams June 2018 onwards\. Version [\d.]+ \d+ \w+ \d{4}\s*)?(\d+\s*)?Visit (aqa\.org\.uk/7037 )?for the most up-to-date specification, resources, support and administration([ \t]*\d+)?")
YEAR_2 = {"3.1.2", "3.1.6", "3.2.1", "3.2.4", "3.2.5"}  # not in the AS
SHORT = {"3.1.4": "Glacial systems and landscapes"}
FIELDWORK = [  # (title, the AS specification's words for that stage, with the skills it draws on)
    ("Planning fieldwork: aims, sampling and risk",
     "Preparation for fieldwork, including background reading, drawing up aims and objectives for the enquiry, hypotheses, "
     "planning research in the field and from secondary sources, using data sampling techniques (random, systematic, stratified) "
     "and carrying out health and safety procedures, risk assessment and ethical considerations. Choosing a location or site."),
    ("Collecting primary and secondary data",
     "Collection of primary data in the field and using secondary data sources. Questionnaire and interview techniques, "
     "qualitative and quantitative data, census data, field measurements, photographs, field sketches, coding of qualitative data."),
    ("Presenting data: maps and graphs",
     "Processing and presenting data using relevant graphical and cartographical techniques: atlas maps, maps with located "
     "proportional symbols, flow lines, choropleth, isoline and dot maps; line, bar, scatter graphs, pie charts, triangular "
     "graphs, logarithmic scales, dispersion diagrams; GIS."),
    ("Analysing data and statistics",
     "Analysing data, including using statistical techniques where relevant: measures of central tendency (mean, mode, median), "
     "measures of dispersion (range, inter-quartile range, standard deviation), Spearman's rank correlation and significance "
     "tests, chi-squared, Mann-Whitney U."),
    ("Conclusions and evaluating the enquiry",
     "Drawing conclusions related back to the original aims and objectives and linking these conclusions to both the place "
     "studied and the general ideas forming the basis of the enquiry. Reviewing the success, or otherwise, of all stages of "
     "the enquiry, reliability and accuracy of data. Considering how the enquiry could be further developed."),
]


def headings(doc):
    """[(code, title, size, page, y)] for every numbered heading in the subject content, in order."""
    out = []
    for pg, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                t = "".join(s["text"] for s in line["spans"]).strip()
                size = max((s["size"] for s in line["spans"]), default=0)
                m = re.match(r"^(3(?:\.\d+){1,4})\s+(.+)$", t)
                if m and size >= 10.5 and pg > 5:
                    out.append((m.group(1), m.group(2).strip(), size, pg))
    return out


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    spec.fetch(AS_URL, os.path.join(spec.WORK, "spec", os.path.basename(AS_URL)))  # for the fieldwork stages (FIELDWORK, above)
    doc = pymupdf.open(path)
    text = "\n".join(page.get_text() for page in doc)
    start = text.index("3.1.1 Water and carbon cycles\n")
    text = FOOTER.sub("\n", text[start:text.index("3.3 Geography fieldwork investigation\n", start)])  # the contents page lists it first
    sections, topics = [], []
    for code, title, size, pg in headings(doc):
        depth = code.count(".")
        if not code.startswith(("3.1.", "3.2.")) or depth > 3:
            continue
        if depth == 2:
            sections.append({"code": code, "title": f"{code} {SHORT.get(code, title)}", "short": SHORT.get(code, title), "year": 2 if code in YEAR_2 else 1})
        else:
            # The topic's words: from its heading to the next heading of its depth or above.
            m = re.search(rf"\n{re.escape(code)} [^\n]*\n(.*?)(?=\n3(?:\.\d){{1,3}} [A-Z]|\Z)", "\n" + text, re.S)
            body = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
            topics.append({"code": code, "ref": code, "title": title, "section": code.rsplit(".", 1)[0], "text": body[:1500],
                           "year": 2 if code.rsplit(".", 1)[0] in YEAR_2 else 1})
    sections.append({"code": "3.3", "title": "Fieldwork investigation and geographical skills", "short": "Fieldwork and skills", "year": 1})
    for n, (title, words) in enumerate(FIELDWORK, 1):
        topics.append({"code": f"3.3.{n}", "ref": "", "title": title, "section": "3.3", "text": words, "year": 1})
    json.dump({"7037": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    thin = [t["code"] for t in topics if len(t["text"]) < 60]
    print(f"{len(sections)} areas, {len(topics)} topics" + (f"; little text for {thin}" if thin else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
