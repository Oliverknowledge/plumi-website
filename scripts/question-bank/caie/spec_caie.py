"""Read Cambridge International's (CAIE's) syllabuses into topic trees.

    python3 scripts/question-bank/caie/spec_caie.py [--maths] [work-dir]

Writes <work-dir>/spec.json in spec_ocr.py's shape: { "9701": { "sections": [...], "topics": [...] } }.
Cambridge numbers its content in two levels: topics ("23 Chemical energetics") are the
bank's tiles and sub-topics ("23.1 Lattice energy and Born-Haber cycles") sit under them,
shown with their codes. In the sciences topics 1-11 (Chemistry 1-22) are the AS
content (year 1), the rest A Level only (year 2). Maths and Further Maths are set out by
paper, so a paper's content is a tile ("Pure Mathematics 3") and its sub-topics the
topics; the banks don't split them by year. Each topic keeps the syllabus's learning
outcomes under it ("text") for tagging only.

The syllabuses are the current public ones on cambridgeinternational.org (sciences
2025-2027, maths 2026-2027); their content matches the 2024 papers and the specimens.
Topic titles are read from the PDF; the tiles' titles are written out here (SECTIONS),
from each syllabus's content overview, because the PDF sets them apart from their numbers.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MATHS = "--maths" in sys.argv
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "caie-maths" if MATHS else "caie-sciences")
BASE = "https://www.cambridgeinternational.org/Images/"
SYLLABUSES = {
    "9700": ("664560-2025-2027-syllabus.pdf", 11),
    "9701": ("664563-2025-2027-syllabus.pdf", 22),
    "9702": ("664565-2025-2027-syllabus.pdf", 11),
    "9709": ("697427-2026-2027-syllabus.pdf", None),
    "9231": ("697357-2026-2027-syllabus.pdf", None),
}
SECTIONS = {
    "9700": ["Cell structure", "Biological molecules", "Enzymes", "Cell membranes and transport", "The mitotic cell cycle",
             "Nucleic acids and protein synthesis", "Transport in plants", "Transport in mammals", "Gas exchange",
             "Infectious diseases", "Immunity", "Energy and respiration", "Photosynthesis", "Homeostasis",
             "Control and coordination", "Inheritance", "Selection and evolution", "Classification, biodiversity and conservation",
             "Genetic technology"],
    "9701": ["Atomic structure", "Atoms, molecules and stoichiometry", "Chemical bonding", "States of matter", "Chemical energetics",
             "Electrochemistry", "Equilibria", "Reaction kinetics", "The Periodic Table: chemical periodicity", "Group 2", "Group 17",
             "Nitrogen and sulfur", "An introduction to AS Level organic chemistry", "Hydrocarbons", "Halogen compounds",
             "Hydroxy compounds", "Carbonyl compounds", "Carboxylic acids and derivatives", "Nitrogen compounds", "Polymerisation",
             "Organic synthesis", "Analytical techniques",
             # A Level: the same areas again, further on (the bank shows them under "Year 2")
             "Chemical energetics", "Electrochemistry", "Equilibria", "Reaction kinetics", "Group 2", "Chemistry of transition elements",
             "An introduction to A Level organic chemistry", "Hydrocarbons", "Halogen compounds", "Hydroxy compounds",
             "Carboxylic acids and derivatives", "Nitrogen compounds", "Polymerisation", "Organic synthesis", "Analytical techniques"],
    "9702": ["Physical quantities and units", "Kinematics", "Dynamics", "Forces, density and pressure", "Work, energy and power",
             "Deformation of solids", "Waves", "Superposition", "Electricity", "D.C. circuits", "Particle physics",
             "Motion in a circle", "Gravitational fields", "Temperature", "Ideal gases", "Thermodynamics", "Oscillations",
             "Electric fields", "Capacitance", "Magnetic fields", "Alternating currents", "Quantum physics", "Nuclear physics",
             "Medical physics", "Astronomy and cosmology"],
    "9709": ["Pure Mathematics 1", "Pure Mathematics 2", "Pure Mathematics 3", "Mechanics", "Probability & Statistics 1",
             "Probability & Statistics 2"],
    "9231": ["Further Pure Mathematics 1", "Further Pure Mathematics 2", "Further Mechanics", "Further Probability & Statistics"],
}
# Sub-topic headings the PDF garbles.
TITLES = {"9231": {"4.3": "χ²-tests"},
          "9701": {"24.2": "Standard electrode potentials E⦵, standard cell potentials E⦵cell and the Nernst equation"}}
# "1.3 Electrons, energy levels and atomic orbitals", maybe a note ("In 1.3 each atom…"), then its learning outcomes.
HEADING = re.compile(r"(?m)^(\d{1,2}\.\d{1,2})[\t ]*\n?((?:(?!In \d)[^\n]*\n){1,5}?)(?:In \d{1,2}\.\d[^\n]*\n(?:[^\n]*\n){0,2}?)?"
                     r"\s*(?:Learning outcomes|Candidates should be able to)")


def fetch(name, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def topics_of(path, spec, as_last):
    text = "\n".join(p.get_text() for p in pymupdf.open(path)).replace("\x07", "")
    found = {}
    for m in HEADING.finditer(text):
        code = m.group(1)
        title = re.sub(r"\s+", " ", m.group(2).replace("(continued)", "").replace("continued", "")).strip()
        if code in found or len(title) > 120 or not 1 <= int(code.split(".")[0]) <= len(SECTIONS[spec]):
            continue
        found[code] = (m.start(), m.end(), TITLES.get(spec, {}).get(code, title))
    order = sorted(found.items(), key=lambda kv: kv[1][0])
    out = []
    for n, (code, (_, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else end + 4000
        body = re.sub(r"^\s*:\s*", "", re.sub(r"\s+", " ", re.sub(r"Cambridge International AS & A Level[^\n]*\n[^\n]*\n[^\n]*\nBack to contents page", " ", text[end:stop])).strip())
        top = int(code.split(".")[0])
        out.append({"code": code, "title": title, "section": str(top), "text": body[:3500],
                    "year": 0 if as_last is None else 1 if top <= as_last else 2})
    return sorted(out, key=lambda t: [int(x) for x in t["code"].split(".")])


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for spec, (name, as_last) in SYLLABUSES.items():
        if (spec in ("9709", "9231")) != MATHS:
            continue
        topics = topics_of(fetch(name, os.path.join(WORK, "spec", f"{spec}.pdf")), spec, as_last)
        sections = [{"code": str(n), "title": t, "year": 0 if as_last is None else 1 if n <= as_last else 2}
                    for n, t in enumerate(SECTIONS[spec], 1)]
        out[spec] = {"sections": sections, "topics": topics}
        empty = [s["code"] for s in sections if not any(t["section"] == s["code"] for t in topics)]
        print(f"{spec}: {len(sections)} sections, {len(topics)} topics" + (f"; no topics found for {empty}" if empty else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
