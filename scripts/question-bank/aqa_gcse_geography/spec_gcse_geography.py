"""Read AQA's GCSE Geography specification (8035) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_geography/spec_gcse_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-geography

Writes <work-dir>/spec.json under 8035: sections and the topics under them, each with the
specification's words ("text", for tagging only, never shown).
  - Living with the physical environment and resource management number their topics
    (3.1.1.2 Tectonic hazards, 3.2.3.2 Food): those are the topics, with their codes.
  - Urban issues (3.2.1) and the changing economic world (3.2.2) number none: each key idea
    is a topic ("Urban change in the UK"), with a code of the bank's own (3.2.1.3) and no ref,
    so no code is shown that the specification doesn't print.
  - Geographical applications: Issue evaluation (3.3.1, Paper 3 Section A) and the six stages
    of a fieldwork enquiry the specification lists for Fieldwork (3.3.2), again with codes of
    the bank's own.
  - Geographical skills (3.4.1 Cartographic … 3.4.4 Statistical): a second tag for a part
    that is mostly a skill (a grid reference, a graph to complete, a median).
Hot deserts and cold environments, and the three landscapes and three resources, are options;
a student keeps the topics they study and skips the rest, as in the A-Level bank.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/geography/specifications/AQA-8035-SP-2016.PDF"
FOOTER = re.compile(r"AQA GCSE Geography 8035\. GCSE exams June 2018 onwards\. Version [\d.]+ \d+ \w+ \d{4}|(\d+\s*)?Visit (aqa\.org\.uk/8035 )?for the most up-to-date specification, resources, support and administration([ \t]*\d+(?![.\d]))?")
SECTIONS = [
    ("3.1.1", "The challenge of natural hazards"), ("3.1.2", "The living world"), ("3.1.3", "Physical landscapes in the UK"),
    ("3.2.1", "Urban issues and challenges"), ("3.2.2", "The changing economic world"), ("3.2.3", "The challenge of resource management"),
    ("3.3", "Geographical applications"), ("3.4", "Geographical skills"),
]
# (code, ref, title, where its words start in the specification)
TOPICS = [
    ("3.1.1.1", None, "Natural hazards", "3.1.1.1 Natural hazards"),
    ("3.1.1.2", None, "Tectonic hazards", "3.1.1.2 Tectonic hazards"),
    ("3.1.1.3", None, "Weather hazards", "3.1.1.3 Weather hazards"),
    ("3.1.1.4", None, "Climate change", "3.1.1.4 Climate change"),
    ("3.1.2.1", None, "Ecosystems", "3.1.2.1 Ecosystems"),
    ("3.1.2.2", None, "Tropical rainforests", "3.1.2.2 Tropical rainforests"),
    ("3.1.2.3", None, "Hot deserts", "3.1.2.3 Hot deserts"),
    ("3.1.2.4", None, "Cold environments", "3.1.2.4 Cold environments"),
    ("3.1.3.1", None, "UK physical landscapes", "3.1.3.1 UK physical landscapes"),
    ("3.1.3.2", None, "Coastal landscapes in the UK", "3.1.3.2 Coastal landscapes in the UK"),
    ("3.1.3.3", None, "River landscapes in the UK", "3.1.3.3 River landscapes in the UK"),
    ("3.1.3.4", None, "Glacial landscapes in the UK", "3.1.3.4 Glacial landscapes in the UK"),
    ("3.2.1.1", "", "Global urbanisation", "A growing percentage of the world"),
    ("3.2.1.2", "", "Cities in LICs and NEEs", "Urban growth creates opportunities and"),
    ("3.2.1.3", "", "Urban change in the UK", "Urban change in cities in the UK"),
    ("3.2.1.4", "", "Sustainable urban living", "Urban sustainability requires"),
    ("3.2.2.1", "", "Development and quality of life", "There are global variations in economic"),
    ("3.2.2.2", "", "Reducing the development gap", "Various strategies exist for reducing"),
    ("3.2.2.3", "", "Economic development in LICs and NEEs", "Some LICs and NEEs are experiencing"),
    ("3.2.2.4", "", "The changing UK economy", "Major changes in the economy of the UK"),
    ("3.2.3.1", None, "Resource management", "3.2.3.1 Resource management"),
    ("3.2.3.2", None, "Food", "3.2.3.2 Food"),
    ("3.2.3.3", None, "Water", "3.2.3.3 Water"),
    ("3.2.3.4", None, "Energy", "3.2.3.4 Energy"),
    ("3.3.1", None, "Issue evaluation", "3.3.1 Section A: Issue evaluation"),
    ("3.3.2.1", "", "Fieldwork: the enquiry question", None),
    ("3.3.2.2", "", "Fieldwork: collecting data", None),
    ("3.3.2.3", "", "Fieldwork: processing and presenting data", None),
    ("3.3.2.4", "", "Fieldwork: analysing and explaining data", None),
    ("3.3.2.5", "", "Fieldwork: conclusions", None),
    ("3.3.2.6", "", "Fieldwork: evaluating the enquiry", None),
    ("3.4.1", None, "Cartographic skills", "3.4.1 Cartographic skills"),
    ("3.4.2", None, "Graphical skills", "3.4.2 Graphical skills"),
    ("3.4.3", None, "Numerical skills", "3.4.3 Numerical skills"),
    ("3.4.4", None, "Statistical skills", "3.4.4 Statistical skills"),
]
# The six stages of an enquiry, as 3.3.2 lists them, with what each asks of a student.
FIELDWORK = {
    "3.3.2.1": "Suitable question for geographical enquiry. The factors that need to be considered when selecting suitable questions/hypotheses for geographical enquiry. The geographical theory/concept underpinning the enquiry. Appreciation of potential hazards and risks in the chosen fieldwork environment and how these risks might be reduced.",
    "3.3.2.2": "Selecting, measuring and recording data appropriate to the chosen enquiry. Difference between primary and secondary data. Identification, selection and collection of quantitative and qualitative data appropriate to the enquiry, including the use of sampling techniques. Description and justification of data collection methods.",
    "3.3.2.3": "Selecting appropriate ways of processing and presenting fieldwork data. Appreciation that a range of visual, graphical and cartographic methods is available. Selection and accurate use of appropriate presentation methods. Description, explanation and adaptation of presentation methods.",
    "3.3.2.4": "Describing, analysing and explaining fieldwork data. Description, analysis and explanation of the results of fieldwork data. Establish links between data sets. Use appropriate statistical techniques. Identification of anomalies in fieldwork data.",
    "3.3.2.5": "Reaching conclusions. Drawing evidenced conclusions in relation to original aims of the enquiry.",
    "3.3.2.6": "Evaluation of geographical enquiry. Identification of problems of data collection methods. Identification of limitations of data collected. Suggestions for other data that might be useful. Extent to which conclusions were reliable.",
}


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL))))
    text = "\n".join(page.get_text() for page in doc)
    text = re.sub(r"\s+", " ", FOOTER.sub(" ", text[text.index("3.1 Living with the physical environment\nThis unit"):]))
    def find(marker):
        """Where a topic's words start: its numbered heading ("3.1.3.2 " and a capital), or its key idea's opening words."""
        m = re.search(re.escape(marker.split(" ")[0]) + r" (?:Section [AB]: )?[A-Z]" if re.match(r"3\.", marker) else re.escape(marker), text)
        assert m, f"{marker!r} not found"
        return m.start()

    starts = sorted(find(marker) for code, ref, title, marker in TOPICS if marker)
    topics = []
    for code, ref, title, marker in TOPICS:
        if marker:
            at = find(marker)
            nxt = min([s for s in starts if s > at] + [len(text)])
            body = re.sub(r"^3[.\d]+ ", "", text[at:nxt]).strip()
        else:
            body = FIELDWORK[code]
        section = next(s for s, _ in SECTIONS if code.startswith(s + "."))
        topics.append({"code": code, **({"ref": ref} if ref is not None else {}), "title": title, "section": section, "text": body[:1500], "year": 0})
    sections = [{"code": c, "title": t} for c, t in SECTIONS]
    json.dump({"8035": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    thin = [t["code"] for t in topics if len(t["text"]) < 60]
    print(f"{len(sections)} sections, {len(topics)} topics" + (f"; little text for {thin}" if thin else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
