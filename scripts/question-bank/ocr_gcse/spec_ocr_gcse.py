"""Read OCR's GCSE Gateway science specifications into topic trees.

    python3 scripts/question-bank/ocr_gcse/spec_ocr_gcse.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse

Writes <work-dir>/spec.json in spec_ocr.py's shape: { "J247": { "sections": [...], "topics": [...] }, ... }.
The specification's topics ("Topic B1: Cell level systems") are the bank's sections and its sub-topics
("B1.1 Cell structures") the bank's topics, shown with their codes. The practical skills topic (B7, C7,
P9; in Combined Science A, the practical skills sections) is left out: those questions are tagged to the
content they test. Each sub-topic keeps the specification's words under it ("text") for tagging only.

Section titles are written out here, as spec_ocr.py does, because OCR's headings wrap and repeat in the
PDF ("Topic C4: Predicting and identifying chemical products" in one place, "…reactions and products"
in another); the sub-topics are read from the PDF. Combined Science A has three "Global challenges",
one per science, so its sections name theirs.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse")
BASE = "https://www.ocr.org.uk/Images/"
BIOLOGY = {"B1": "Cell level systems", "B2": "Scaling up", "B3": "Organism level systems", "B4": "Community level systems",
           "B5": "Genes, inheritance and selection", "B6": "Global challenges"}
CHEMISTRY = {"C1": "Particles", "C2": "Elements, compounds and mixtures", "C3": "Chemical reactions",
             "C4": "Predicting and identifying reactions and products", "C5": "Monitoring and controlling chemical reactions",
             "C6": "Global challenges"}
SPECS = {
    "J247": ("234594-specification-accredited-gcse-gateway-science-suite-biology-a-j247.pdf", BIOLOGY),
    "J248": ("234598-specification-accredited-gcse-gateway-science-suite-chemistry-a-j248.pdf", CHEMISTRY),
    "J249": ("234600-specification-accredited-gcse-gateway-science-suite-physics-a-j249.pdf",
             {"P1": "Matter", "P2": "Forces", "P3": "Electricity", "P4": "Magnetism and magnetic fields", "P5": "Waves in matter",
              "P6": "Radioactivity", "P7": "Energy", "P8": "Global challenges"}),
    "J250": ("234596-specification-accredited-gcse-gateway-science-suite-combined-science-a-j250.pdf",
             {**BIOLOGY, "B6": "Global challenges (Biology)", **CHEMISTRY, "C6": "Global challenges (Chemistry)",
              "P1": "Matter", "P2": "Forces", "P3": "Electricity and magnetism", "P4": "Waves and radioactivity", "P5": "Energy",
              "P6": "Global challenges (Physics)"}),
}
# A sub-topic's heading in the content: its code, its title (one or two lines), then "Summary".
HEADING = re.compile(r"^([BCP]\d\.\d)[ \t]*\n?([^\n]+(?:\n[^\n]+)?)\n\s*(?:Summary|Topic content)\b", re.M)
# The overview's list of sub-topics ("B6.1  Monitoring and maintaining the environment"), for one the content heads differently.
OVERVIEW = re.compile(r"^([BCP]\d\.\d)[\t  ]+\x07([^\n]+)$", re.M)


def fetch(name, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def topics_of(path, sections):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    found = {}  # the content is the last place each heading appears
    for m in HEADING.finditer(text):
        lines = [l.strip() for l in m.group(2).split("\n") if l.strip() and l.strip() != "sub-topic"]
        if lines:  # (a contents page's "B1.1 sub-topic" example has none)
            found[m.group(1)] = (m.start(), m.end(), " ".join(lines))
    for m in OVERVIEW.finditer(text):
        if m.group(1) not in found:
            # No heading in the content (Combined Science A's B6.1): start at its first statement, "B6.1a".
            first = re.search(rf"^{re.escape(m.group(1))}a$", text, re.M)
            if first:
                found[m.group(1)] = (first.start(), first.start(), m.group(2).strip())
    order = sorted(((c, v) for c, v in found.items() if c.split(".")[0] in sections), key=lambda kv: kv[1][0])
    out = []
    for n, (code, (start, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else end + 4000
        body = re.sub(r"\s+", " ", text[end:stop]).strip()
        out.append({"code": code, "title": title.rstrip("."), "section": code.split(".")[0], "text": body[:3500], "year": 0})
    return sorted(out, key=lambda t: ("BCP".index(t["code"][0]), [int(x) for x in t["code"][1:].split(".")]))


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for spec, (name, sections) in SPECS.items():
        topics = topics_of(fetch(name, os.path.join(WORK, "spec", f"{spec.lower()}.pdf")), sections)
        out[spec] = {"sections": [{"code": c, "title": t} for c, t in sections.items()], "topics": topics}
        empty = [s for s in sections if not any(t["section"] == s for t in topics)]
        print(f"{spec}: {len(sections)} sections, {len(topics)} topics" + (f"; no topics found for {empty}" if empty else ""), file=sys.stderr)
        for t in topics:
            print(f"   {t['code']} {t['title']} ({len(t['text'])} chars)", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
