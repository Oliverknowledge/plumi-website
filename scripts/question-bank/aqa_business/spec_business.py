"""Read AQA's AS and A-Level Business specification (7131/7132) into the bank's topic tree.

    python3 scripts/question-bank/aqa_business/spec_business.py [work-dir]   # default scripts/question-bank/.work/aqa-business

spec.py's reader, over the subject content (numbered 3: 3.1 What is business? …
3.10 Managing strategic change), from the current specification (version 2.0, for
exams from 2024, linked from AQA's 7132 page). Writes <work-dir>/spec.json in the
AQA Economics bank's shape, under 7132: sections are the ten numbered areas, shown as
the bank's tiles; topics are their numbered topics ("3.5.2 Analysing financial
performance"), each with the specification's words under it ("text") for tagging only.
3.1 to 3.6 are the AS content (Year 1 · AS); 3.7 to 3.10 are A-Level only (Year 2).
The 2023 revision changed some wording (3.9.3 now "Assessing globalisation and
internationalisation") and dropped a few models; its numbering is the 2015 one, so
older papers are tagged against it too.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-business")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://cdn.sanity.io/files/p28bar15/green/5c265ac92b9358f142c2b69483df78f811d52739.pdf"  # AQA-7131-7132-SP-2023, v2.0
FOOTER = re.compile(r"(\d+ )?Visit (aqa\.org\.uk/\d+ )?for the most up-to-date specifications?, resources, support and administration( \d+)?|AQA AS and A-level Business[^.]*\. [^.]*\. Version [\d.]+ \d+ \w+ \d{4}")
# Shorter names for the longest titles, for page titles and tiles.
SHORT = {
    "3.1.3": "The external environment",
    "3.3.3": "Segmentation, targeting, positioning",
    "3.3.4": "The marketing mix",
    "3.4.3": "Efficiency and productivity",
    "3.4.4": "Quality",
    "3.4.5": "Inventory and supply chains",
    "3.5.3": "Sources of finance",
    "3.5.4": "Improving cash flow and profits",
    "3.6.3": "Organisational design",
    "3.6.4": "Motivation and engagement",
    "3.6.5": "Employer-employee relations",
    "3.7.1": "Mission, objectives and strategy",
    "3.7.2": "Financial ratio analysis",
    "3.7.3": "Overall performance",
    "3.7.4": "Political and legal change",
    "3.7.5": "Economic change",
    "3.7.6": "Social and technological change",
    "3.7.7": "The competitive environment",
    "3.7.8": "Investment appraisal",
    "3.8.1": "Which markets to compete in",
    "3.8.2": "How to compete",
}


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", "AQA-7131-7132-SP-2023.pdf"))
    spec.HEADING = re.compile(r"^(3(?:\.\d+){1,2})\s+(.+)$")
    spec.LEVEL_BY_SIZE = [(18, 1), (15, 2)]
    nodes = [n for n in spec.read(path) if n["code"].startswith("3.")]
    sections, topics = [], []
    for n in nodes:
        title = re.sub(r"\s+", " ", re.sub(r"\s*\(A-\s?level\s*only\)", "", n["title"])).strip()
        title = re.sub(r"(\w)- (\w)", r"\1-\2", title)  # "employer- employee", broken over a line
        year = 1 if int(n["code"].split(".")[1]) <= 6 else 2
        if n["level"] == 1:
            sections.append({"code": n["code"], "title": f"{n['code']} {title}", "short": title, "year": year})
        elif n["level"] == 2:
            text = re.split(r"\s4 Scheme of assessment|\s4\.1 Aims", n["text"])[0]
            text = re.sub(r"\s+", " ", FOOTER.sub(" ", text)).replace("Content Additional information ", "").strip()[:1500]
            topic = {"code": n["code"], "ref": n["code"], "title": title, "section": n["code"].rsplit(".", 1)[0], "text": text, "year": year}
            if n["code"] in SHORT:
                topic["short"] = SHORT[n["code"]]
            topics.append(topic)
    tree = {"sections": sections, "topics": topics}
    json.dump({"7132": tree, "7131": tree}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    print(f"{len(sections)} areas, {len(topics)} topics, {sum(t['year'] == 1 for t in topics)} also AS"
          + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
