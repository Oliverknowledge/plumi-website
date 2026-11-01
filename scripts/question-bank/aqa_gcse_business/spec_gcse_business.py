"""Read AQA's GCSE Business specification (8132) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_business/spec_gcse_business.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-business

spec.py's reader over the subject content (3.1 Business in the real world … 3.6 Finance),
from the specification linked from AQA's 8132 page (AQA-8132-SP-2017). Writes
<work-dir>/spec.json under 8132, in the A-Level Business bank's shape: sections are the six
numbered areas, shown as the bank's tiles; topics are their numbered topics ("3.6.2 Cash
flow"), each with the specification's words under it ("text") for tagging only. GCSE topics
aren't split by year. Both papers draw on 3.1 and 3.2; Paper 1 on 3.3 and 3.4, Paper 2 on 3.5
and 3.6.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-business")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://cdn.sanity.io/files/p28bar15/green/85a13a92ddf27ffd158bcc1e1be853fb9076a629.pdf"  # AQA-8132-SP-2017
FOOTER = re.compile(r"(\d+ )?Visit (aqa\.org\.uk/\d+ )?for the most up-to-date specifications?, resources, support and administration( \d+)?|AQA GCSE Business 8132\.[^.]*\. Version [\d.]+ \d+ \w+ \d{4}")
# Shorter names for the longest titles, for page titles and tiles.
SHORT = {
    "3.1.1": "The purpose and nature of business",
    "3.1.3": "Business aims and objectives",
    "3.2.2": "Ethical and environmental issues",
    "3.2.3": "The economic climate",
    "3.4.2": "Recruitment and selection",
    "3.5.3": "Market research",
    "3.5.4": "The marketing mix",
    "3.6.4": "Analysing financial performance",
}


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", "AQA-8132-SP-2017.pdf"))
    spec.HEADING = re.compile(r"^(3(?:\.\d+){1,2})\s+(.+)$")
    spec.LEVEL_BY_SIZE = [(18, 1), (15, 2)]
    nodes = [n for n in spec.read(path) if n["code"].startswith("3.")]
    sections, topics = [], []
    for n in nodes:
        title = re.sub(r"\s+", " ", n["title"]).strip()
        if n["level"] == 1:
            sections.append({"code": n["code"], "title": f"{n['code']} {title}", "short": title})
        elif n["level"] == 2:
            text = re.split(r"\s4 Scheme of assessment|\s4\.1 Aims", n["text"])[0]
            text = re.sub(r"\s+", " ", FOOTER.sub(" ", text)).replace("Content Additional information ", "").strip()[:1500]
            topic = {"code": n["code"], "ref": n["code"], "title": title, "section": n["code"].rsplit(".", 1)[0], "text": text, "year": 0}
            if n["code"] in SHORT:
                topic["short"] = SHORT[n["code"]]
            topics.append(topic)
    json.dump({"8132": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    print(f"{len(sections)} areas, {len(topics)} topics" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
