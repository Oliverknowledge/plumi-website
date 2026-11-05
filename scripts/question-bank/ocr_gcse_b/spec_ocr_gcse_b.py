"""Read OCR's GCSE Twenty First Century Science specifications into topic trees.

    python3 scripts/question-bank/ocr_gcse_b/spec_ocr_gcse_b.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-b

Writes <work-dir>/spec.json in spec_ocr.py's shape: { "J257": { "sections": [...], "topics": [...] }, ... }.
The specification's chapters ("Chapter B1: You and your genes") are the bank's sections and its topics
("B1.2 How is genetic information inherited?") the bank's topics, shown with their codes. Ideas about
Science (B7, C7, P7) and Practical skills (B8, C8, P8) are left out: those questions are tagged to the
content they test. Each topic keeps the specification's words under it ("text") for tagging only.

Section titles are written out here, as spec_ocr.py and the Gateway reader do, because OCR's headings wrap
and repeat in the PDF; the topics are read from the PDF, each one headed by its code and title and followed
by "Teaching and learning narrative". A "(separate science only)" note in a title is dropped (the bank
doesn't split Biology B by who sits what). Combined Science B (J260) has the three sciences' chapters
under their own codes (B1-B6, C1-C6, P1-P6), as the three separate sciences have.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-b")
BASE = "https://www.ocr.org.uk/Images/"
BIOLOGY = {"B1": "You and your genes", "B2": "Keeping healthy", "B3": "Living together – food and ecosystems",
           "B4": "Using food and controlling growth", "B5": "The human body – staying alive",
           "B6": "Life on Earth – past, present and future"}
CHEMISTRY = {"C1": "Air and water", "C2": "Chemical patterns", "C3": "Chemicals of the natural environment",
             "C4": "Material choices", "C5": "Chemical analysis", "C6": "Making useful chemicals"}
PHYSICS = {"P1": "Radiation and waves", "P2": "Sustainable energy", "P3": "Electric circuits", "P4": "Explaining motion",
           "P5": "Radioactive materials", "P6": "Matter – models and explanations"}
SPECS = {
    "J257": ("234595-specification-accredited-gcse-twenty-first-century-science-suite-biology-b-j257.pdf", BIOLOGY),
    "J258": ("234599-specification-accredited-gcse-twenty-first-century-science-suite-chemistry-b-j258.pdf", CHEMISTRY),
    "J259": ("234601-specification-accredited-gcse-twenty-first-century-science-suite-physics-b-j259.pdf", PHYSICS),
    "J260": ("234597-specification-accredited-gcse-twenty-first-century-science-suite-combined-science-b-j260.pdf",
             {**BIOLOGY, **CHEMISTRY, **PHYSICS}),
}
# A topic's heading in the content: its code (with a colon in a few), its title (one or two lines), then the narrative.
HEADING = re.compile(r"^([BCP]\d\.\d)[:\t ]+([^\n]*\n(?:[^\n]*\n)??)(?:Teaching and learning narrative)", re.M)


def fetch(name, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def topics_of(path, sections):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    found = {}
    for m in HEADING.finditer(text):
        title = re.sub(r"\s+", " ", m.group(2)).strip()
        title = re.sub(r"\s*\(separate science only\)", "", title).rstrip(". ")
        code = m.group(1)
        if code.split(".")[0] in sections and code not in found:
            found[code] = (m.start(), m.end(), title)
    order = sorted(found.items(), key=lambda kv: kv[1][0])
    out = []
    for n, (code, (start, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else end + 6000
        body = re.sub(r"\s+", " ", text[end:stop]).strip()
        out.append({"code": code, "title": title, "section": code.split(".")[0], "text": body[:3500], "year": 0})
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
