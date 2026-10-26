"""Read AQA's A-Level Economics specification (7135/7136) into the bank's topic tree.

    python3 scripts/question-bank/aqa_economics/spec_economics.py [work-dir]   # default scripts/question-bank/.work/aqa-economics

spec.py's reader, over the A-Level subject content (numbered 4: 4.1 Individuals,
firms, markets and market failure; 4.2 The national and international economy).
Writes <work-dir>/spec.json in the Edexcel Economics bank's shape, under 7136:
sections are the specification's numbered topics ("4.1.5 Perfect competition,
imperfectly competitive markets and monopoly"), shown as the bank's tiles; topics
are their numbered sub-topics ("4.1.5.7 Price discrimination"), each with the
specification's words under it ("text") for tagging only. A sub-topic the AS
content (numbered 3) also has, by its title, is Year 1 · AS; the rest are Year 2.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-economics")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/economics/specifications/AQA-7135-7136-SP-2015.PDF"
# The page footer, read into the text where a sub-topic crosses a page.
FOOTER = re.compile(r"(\d+ )?Visit (aqa\.org\.uk/\d+ )?for the most up-to-date specification, resources, support and administration( \d+)?")
# Titles the specification words differently at AS for the same content.
AS_ALSO = {"4.1.4.4", "4.1.4.6", "4.1.4.7", "4.1.5.1", "4.1.5.2", "4.1.5.3", "4.1.5.6", "4.1.5.8", "4.1.8.9", "4.1.8.10", "4.2.4.3", "4.2.5.1", "4.2.5.2",
           "4.1.7.1",  # AS: "An inequitable distribution of income and wealth", a market failure
           "4.2.6.3"}  # AS: "The balance of payments on current account"


def norm(t):
    return re.sub(r"[^a-z]+", " ", t.lower()).strip()


def read(path, first):
    spec.HEADING = re.compile(rf"^({first}(?:\.\d+){{1,3}})\s+(.+)$")
    return [n for n in spec.read(path) if n["code"].startswith(first + ".")]


def main():
    os.makedirs(spec.WORK, exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    as_titles = {norm(n["title"]) for n in read(path, "3") if n["level"] == 3}
    nodes = read(path, "4")
    sections, topics = [], []
    for n in nodes:
        title = re.sub(r"\s+", " ", n["title"]).strip()
        if n["level"] == 2:
            sections.append({"code": n["code"], "title": f"{n['code']} {title}", "short": title})
        elif n["level"] == 3:
            text = re.split(r"\s5 ?Scheme of assessment|\sAQA AS and A-level Economics \. AS and A-level exams|\s5\.1 ", n["text"])[0]
            text = re.sub(r"\s+", " ", FOOTER.sub(" ", text)).strip()[:1500]
            year = 1 if norm(title) in as_titles or n["code"] in AS_ALSO else 2
            topics.append({"code": n["code"], "ref": n["code"], "title": title, "section": n["code"].rsplit(".", 1)[0], "text": text, "year": year})
    for s in sections:
        years = {t["year"] for t in topics if t["section"] == s["code"]}
        s["year"] = 1 if years == {1} else 2
    tree = {"sections": sections, "topics": topics}
    json.dump({"7136": tree, "7135": tree}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    print(f"{len(sections)} topics, {len(topics)} sub-topics, {sum(t['year'] == 1 for t in topics)} also AS"
          + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
