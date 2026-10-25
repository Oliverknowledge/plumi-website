"""Read OCR's A-Level Biology A, Chemistry A and Physics A specifications into a topic tree.

    python3 scripts/question-bank/ocr/spec_ocr.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape: { "H432": { "sections": [...], "topics": [...] } }.
OCR numbers its content as AQA does: sections ("3.1 The periodic table") are the
bank's tiles and numbered topics ("3.1.2 Group 2") sit under them, shown with their
codes. Module 1 (practical skills) is left out: those questions are tagged to the
content they test. Modules 2-4 are the AS content (Year 1), Modules 5-6 Year 2.
Each topic keeps the specification's words under it ("text") for tagging only.

Section titles are written out here (SECTIONS) because a few of OCR's PDF headings
come out garbled ("New section", "HSW2"); the topics are read from the PDF.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-sciences")
BASE = "https://www.ocr.org.uk/Images/"
SPECS = {
    "biology": ("687834-download-a-level-specification.pdf", ("H020", "H420")),
    "chemistry": ("171720-specification-accredited-a-level-gce-chemistry-a-h432.pdf", ("H032", "H432")),
    "physics": ("171726-specification-accredited-a-level-gce-physics-a-h556.pdf", ("H156", "H556")),
}
SECTIONS = {
    "biology": {"2.1": "Foundations in biology", "3.1": "Exchange and transport",
                "4.1": "Communicable diseases, disease prevention and the immune system", "4.2": "Biodiversity, evolution and classification",
                "5.1": "Communication and homeostasis", "5.2": "Energy for biological processes",
                "6.1": "Genetics and evolution", "6.2": "Cloning and biotechnology", "6.3": "Ecosystems"},
    "chemistry": {"2.1": "Atoms and reactions", "2.2": "Electrons, bonding and structure", "3.1": "The periodic table", "3.2": "Physical chemistry",
                  "4.1": "Basic concepts and hydrocarbons", "4.2": "Alcohols, haloalkanes and analysis", "5.1": "Rates, equilibrium and pH",
                  "5.2": "Energy", "5.3": "Transition elements", "6.1": "Aromatic compounds, carbonyls and acids",
                  "6.2": "Nitrogen compounds, polymers and synthesis", "6.3": "Analysis"},
    "physics": {"2.1": "Physical quantities and units", "2.2": "Making measurements and analysing data", "2.3": "Nature of quantities",
                "3.1": "Motion", "3.2": "Forces in action", "3.3": "Work, energy and power", "3.4": "Materials",
                "3.5": "Newton’s laws of motion and momentum", "4.1": "Charge and current", "4.2": "Energy, power and resistance",
                "4.3": "Electrical circuits", "4.4": "Waves", "4.5": "Quantum physics", "5.1": "Thermal physics", "5.2": "Circular motion",
                "5.3": "Oscillations", "5.4": "Gravitational fields", "5.5": "Astrophysics and cosmology", "6.1": "Capacitors",
                "6.2": "Electric fields", "6.3": "Electromagnetism", "6.4": "Nuclear and particle physics", "6.5": "Medical imaging"},
}
# Topic headings that wrap onto a second line in the PDF.
TITLES = {"biology": {"4.1.1": "Communicable diseases, disease prevention and the immune system"}}
HEADING = re.compile(r"^\s*([2-6]\.\d\.\d)\s+([A-Z][^\n]{2,90})$", re.M)


def fetch(name, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def topics_of(path, sections, subject):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    # The contents pages list the topics too; the content is the last time each heading appears.
    found = {}
    for m in HEADING.finditer(text):
        code = m.group(1)
        if code[:3] in sections:
            found[code] = (m.start(), m.end(), m.group(2).strip().rstrip(".)").strip())
    order = sorted(found.items(), key=lambda kv: kv[1][0])
    out = []
    for n, (code, (start, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else end + 4000
        body = re.sub(r"\s+", " ", text[end:stop]).strip()
        out.append({"code": code, "title": TITLES.get(subject, {}).get(code, title), "section": code[:3], "text": body[:3500],
                    "year": 1 if int(code[0]) <= 4 else 2})
    return sorted(out, key=lambda t: [int(x) for x in t["code"].split(".")])


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for subject, (name, specs) in SPECS.items():
        sections = SECTIONS[subject]
        topics = topics_of(fetch(name, os.path.join(WORK, "spec", f"{subject}.pdf")), sections, subject)
        tree = {"sections": [{"code": c, "title": t, "year": 1 if int(c[0]) <= 4 else 2} for c, t in sections.items()], "topics": topics}
        for spec in specs:
            out[spec] = tree
        empty = [s for s in sections if not any(t["section"] == s for t in topics)]
        print(f"{subject}: {len(sections)} sections, {len(topics)} topics" + (f"; no topics found for {empty}" if empty else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
