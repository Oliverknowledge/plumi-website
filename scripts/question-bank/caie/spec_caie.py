"""Read Cambridge International's (CAIE's) syllabuses into topic trees.

    python3 scripts/question-bank/caie/spec_caie.py [--igcse] [--maths] [work-dir]

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

--igcse reads Cambridge IGCSE's syllabuses, set out differently (topics_igcse), all
year 0. Their tiles' titles are read from each syllabus's content overview. The
syllabuses are the ones the papers were set on: sciences 2023-2025 (June 2024 and the
specimens for exams from 2023), maths 2025-2027 (the specimens; the June 2024 papers
are the previous syllabus, whose content is the same bar a few additions).
  - Sciences: topics ("8 Transport in plants") are the tiles, sub-topics ("8.3
    Transpiration") under them, each a Core and a Supplement column.
  - Mathematics 0580: Core (C1.1) and Extended (E1.1) number their sub-topics alike,
    Core marking the ones it leaves out "Extended content only". A sub-topic is its
    number ("1.1"), with the Extended text (which includes the Core's) and `extended`
    where only Extended candidates study it.
  - Additional Mathematics 0606: its topics ("6 Logarithmic and exponential functions")
    number single learning statements (6.1, 6.2, …), not titled sub-topics, so each
    topic is one tile with one code ("6"), its statements its text.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MATHS = "--maths" in sys.argv
IGCSE = "--igcse" in sys.argv
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", f"caie{'-igcse' if IGCSE else ''}-{'maths' if MATHS else 'sciences'}")
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
# IGCSE: the syllabus PDF and how it sets out its content.
IGCSE_SYLLABUSES = {
    "0610": ("595426-2023-2025-syllabus.pdf", "science"),
    "0620": ("595428-2023-2025-syllabus.pdf", "science"),
    "0625": ("595430-2023-2025-syllabus.pdf", "science"),
    "0580": ("662466-2025-2027-syllabus.pdf", "tiered"),
    "0606": ("662470-2025-2027-syllabus.pdf", "statements"),
}
# Sub-topic headings the PDF garbles.
TITLES = {"9231": {"4.3": "χ²-tests"}, "0580": {"6.6": "Pythagoras’ theorem and trigonometry in 3D"},
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


def overview(text):
    """The topics' titles from the content overview: "1\tCharacteristics and …", "10\t Diseases and immunity"."""
    block = text[text.index("Content overview"):]
    titles = []
    for m in re.finditer(r"(?m)^(\d{1,2})[\t ]*\n?[\t ]*([A-Z][^\n]+)", block):
        if int(m.group(1)) != len(titles) + 1:
            if titles:
                break
            continue
        titles.append(re.sub(r"\s+", " ", m.group(2)).strip())
    return titles


def topics_igcse(path, layout):
    """(sections, topics) from a Cambridge IGCSE syllabus; see the module's note."""
    text = "\n".join(p.get_text() for p in pymupdf.open(path)).replace("\x07", "")
    titles = overview(text)
    # The running header: "Cambridge IGCSE Biology 0610 syllabus for 2023, 2024 and 2025. [Subject content]\n10\nwww…\nBack to contents page".
    text = re.sub(r"Cambridge IGCSE[^\n]*syllabus for[^\n]*\n\s*\d+\s*\n[^\n]*www\.cambridgeinternational\.org[^\n]*\n\s*Back to contents page", " ", text)
    text = text[text.index("Subject content", text.index("Content overview")):]
    if layout == "science":
        heads = re.compile(r"(?m)^(\d{1,2}\.\d{1,2})[\t ]+([^\n]+)\n(?=(?:[^\n]*\n){0,2}?(?:Core|Supplement)\s*\n)")
    elif layout == "tiered":
        heads = re.compile(r"(?m)^([CE]\d{1,2}\.\d{1,2})[\t ]*\n?([^\n\t]+)")
    else:
        heads = re.compile(r"(?m)^(\d{1,2})\.\d{1,2}[\t ]")
    found = list(heads.finditer(text))
    bodies, names = {}, {}
    for n, m in enumerate(found):
        code = m.group(1)
        stop = found[n + 1].start() if n + 1 < len(found) else m.end() + 4000
        body = text[m.end():stop] if layout != "statements" else text[m.start():stop]
        bodies.setdefault(code, []).append(body)
        if layout != "statements":
            names.setdefault(code, re.sub(r"\s+", " ", m.group(2).replace("continued", "")).strip())
    clean = lambda parts: re.sub(r"\s+", " ", " ".join(parts)).strip()  # noqa: E731
    spec = os.path.basename(path)[:4]
    names = {c: TITLES.get(spec, {}).get(c.lstrip("CE"), t) for c, t in names.items()}
    sections = [{"code": str(n), "title": t, "year": 0} for n, t in enumerate(titles, 1)]
    topics = []
    if layout == "science":
        for code, parts in bodies.items():
            topics.append({"code": code, "title": names[code], "section": code.split(".")[0], "text": clean(parts)[:3500], "year": 0})
    elif layout == "tiered":
        for code, parts in bodies.items():
            if code.startswith("E"):
                core = names.get("C" + code[1:], "")
                topics.append({"code": code[1:], "title": names[code], "section": code[1:].split(".")[0], "text": clean(parts)[:3500],
                               "year": 0, **({"extended": True} if core.startswith("Extended content only") else {})})
    else:
        for code, parts in bodies.items():
            topics.append({"code": code, "title": titles[int(code) - 1], "section": code, "text": clean(parts)[:3500], "year": 0})
    topics.sort(key=lambda t: [int(x) for x in t["code"].split(".")])
    return sections, topics


def main_igcse():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for spec, (name, layout) in IGCSE_SYLLABUSES.items():
        if (layout != "science") != MATHS:
            continue
        sections, topics = topics_igcse(fetch(name, os.path.join(WORK, "spec", f"{spec}.pdf")), layout)
        out[spec] = {"sections": sections, "topics": topics}
        empty = [s["code"] for s in sections if not any(t["section"] == s["code"] for t in topics)]
        print(f"{spec}: {len(sections)} sections, {len(topics)} topics" + (f"; no topics found for {empty}" if empty else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


def main():
    if IGCSE:
        return main_igcse()
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
