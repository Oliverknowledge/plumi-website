"""Read Pearson Edexcel's International A Level Biology, Chemistry and Physics specifications into a topic tree.

    python3 scripts/question-bank/edexcel_ial/spec_ial.py [work-dir]   # default scripts/question-bank/.work/edexcel-ial

Writes <work-dir>/spec.json in spec_pearson.py's shape: { "WBI": { "sections": [...], "topics": [...] }, ... }.
Chemistry splits some of its topics into lettered sub-topics ("3A: Ionic bonding"): those are
the bank's topics there ("3.A", as spec_pearson.py's Chemistry). Otherwise the specifications number
every statement with no headings between a topic and its statements, so, as spec_pearson.py does for
Biology A and Physics, the statements are grouped here (GROUPS) into sub-topics a student would
recognise, with their statement numbers kept as `points`. Sections are the specifications' own topics: Biology's eight and Chemistry's twenty
("Topic 6: Energetics"), and Physics' content headings, which it numbers by unit ("1.3 Mechanics";
its statements run 1-171 through the whole specification). Units 3 and 6 test practical skills
on the other units' content: their questions are tagged to that content, and a last section,
"Practical skills", holds what those units add (planning, measuring, analysing and evaluating).
Year 1 is the International AS content (Units 1 and 2); the rest is year 2.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-ial")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from spec_pearson import clean, sentence_case  # noqa: E402

BASE = "https://qualifications.pearson.com/content/dam/pdf/International Advanced Level/"
SPECS = {
    "WBI": "Biology/2018/Specification-and-Sample-Assessment/International-A-Level-Biology-Spec.pdf",
    "WCH": "Chemistry/2018/Specification-and-Sample-Assessment/International-A-Level-Chemistry-Spec.pdf",
    "WPH": "Physics/2018/Specification and Sample Assessment/9781446957783_IAL_Physics_Iss3.pdf",
}
FOOTER = re.compile(r"Pearson Edexcel International Advanced Subsidiary/Advanced Level in \w+ *\nSpecification[^\n]*\n\s*\d+\s*\n")
# Where each specification's content starts, and its topic headings ("Topic 1 – Molecules, Transport and Health").
START = {"WBI": "Topic 1 – Molecules, Transport and Health", "WCH": "Topic 1: Formulae, Equations and Amount of Substance", "WPH": "1.3 Mechanics"}
TOPIC = {"WBI": re.compile(r"^Topic (\d) – ([^\n]+(?:\n(?!Candidates)[^\n]+)?)", re.M),
         "WCH": re.compile(r"^Topic (\d{1,2}): ([^\n]+?,? *(?:\n(?:and |Amino)[^\n]+)?)\s*$", re.M)}
LETTERED = re.compile(r"^(\d{1,2})([A-E]): ([^\n]+?)(?: \(limited to[^\n]*\n[^\n]*)?\s*$", re.M)
# Physics' content headings, by unit, with the statements each covers.
PHYSICS = [("1.3", "Mechanics", 1, 22), ("1.4", "Materials", 23, 32), ("2.3", "Waves and the particle nature of light", 33, 63),
           ("2.4", "Electric circuits", 64, 80), ("4.3", "Further mechanics", 81, 91), ("4.4", "Electric and magnetic fields", 92, 110),
           ("4.5", "Nuclear and particle physics", 111, 124), ("5.3", "Thermodynamics", 125, 132), ("5.4", "Nuclear decay", 133, 142),
           ("5.5", "Oscillations", 143, 153), ("5.6", "Astrophysics and cosmology", 154, 171)]
AS_LAST = {"WBI": 4, "WCH": 10}  # the last AS topic (Physics: its Unit 1 and 2 headings)

# (topic, title, first statement, last statement); Physics' statements are numbered through the whole specification.
GROUPS = {
    "WBI": [
        (1, "Water, carbohydrates and lipids", 1, 5), (1, "Heart, blood vessels and haemoglobin", 6, 9),
        (1, "Cardiovascular disease and its risk factors", 10, 14), (1, "Health risk, data and treatments", 15, 20),
        (2, "Gas exchange and cell membranes", 1, 3), (2, "Transport across membranes", 4, 5), (2, "Proteins and enzymes", 6, 8),
        (2, "DNA, RNA and replication", 9, 10), (2, "The genetic code and protein synthesis", 11, 13),
        (2, "Mutation, inheritance and cystic fibrosis", 14, 16), (2, "Genetic screening", 17, 18),
        (3, "Cell structure and organisation", 1, 6), (3, "Microscopy", 7, 8), (3, "Meiosis, gametes and fertilisation", 9, 13),
        (3, "Mitosis and the cell cycle", 14, 16), (3, "Stem cells and gene expression", 17, 19), (3, "Genotype, environment and phenotype", 20, 21),
        (4, "Plant cells, starch and cellulose", 1, 4), (4, "Plant stems, fibres and mineral ions", 5, 9),
        (4, "Antimicrobial plants and drug testing", 10, 13), (4, "Classification", 14, 14), (4, "Biodiversity and its measurement", 15, 18),
        (4, "Niche, adaptation and Hardy-Weinberg", 19, 20), (4, "Conservation", 21, 21),
        (5, "Photosynthesis", 1, 8), (5, "Productivity and energy transfer", 9, 10), (5, "Ecosystems, distribution and succession", 11, 15),
        (5, "Climate change", 16, 22), (5, "Evolution and speciation", 23, 24), (5, "Scientific debate, reforestation and biofuels", 25, 26),
        (6, "Culturing microorganisms and growth curves", 1, 4), (6, "Bacteria, viruses, TB and HIV", 5, 6),
        (6, "Infection and the immune response", 7, 12), (6, "Antibiotics and hospital infections", 13, 15),
        (6, "Decomposition, DNA profiling and forensics", 16, 20),
        (7, "Respiration", 1, 8), (7, "Muscles and movement", 9, 11), (7, "Heart rate, ventilation and exercise", 12, 15),
        (7, "Homeostasis and the kidney", 16, 21), (7, "Switching genes on and off", 22, 22),
        (8, "Neurones and nerve impulses", 1, 5), (8, "Synapses and drugs", 6, 7), (8, "Detecting stimuli and habituation", 8, 9),
        (8, "Plant responses and coordination", 10, 13), (8, "The brain, imaging and brain chemicals", 14, 16),
        (8, "Gene technology and bioinformatics", 17, 22),
    ],
    "WCH": [
        (1, "Formulae, equations and the mole", 1, 5), (1, "Calculations from equations", 6, 12),
        (2, "Atomic structure and mass spectrometry", 1, 7), (2, "Ionisation energies and electronic configuration", 8, 15),
        (2, "The Periodic Table and periodicity", 16, 18),
        (5, "Alkenes and geometric isomerism", 1, 3), (5, "Reactions of alkenes", 4, 6), (5, "Addition polymers", 7, 8),
        (6, "Enthalpy changes and Hess’s law", 1, 8), (6, "Bond enthalpies", 9, 11),
        (7, "Intermolecular forces", 1, 6),
        (11, "Rate equations and orders", 1, 9), (11, "Activation energy and catalysis", 10, 13),
        (13, "Chemical equilibria", 1, 9),
        (14, "Acids, bases and pH", 1, 14), (14, "Titration curves and indicators", 15, 16), (14, "Buffer solutions", 17, 23),
        (16, "Electrode potentials and cells", 1, 14), (16, "Redox titrations", 15, 17), (16, "Fuel cells", 18, 19),
        (17, "Transition metals and complex ions", 1, 17), (17, "Transition metal redox and ligand exchange", 18, 25), (17, "Transition metal catalysts", 26, 33),
        (18, "Arenes", 1, 6),
        (19, "Amines", 1, 6), (19, "Amides, amino acids and condensation polymers", 7, 12),
        (20, "Organic synthesis", 1, 5),
    ],
    "WPH": [
        ("1.3", "Motion graphs and SUVAT", 1, 3), ("1.3", "Vectors and projectiles", 4, 7), ("1.3", "Forces and Newton’s laws", 8, 12),
        ("1.3", "Momentum", 13, 14), ("1.3", "Moments and centre of gravity", 15, 16), ("1.3", "Work, energy and power", 17, 22),
        ("1.4", "Density, upthrust and viscosity", 23, 26), ("1.4", "Hooke’s law, stress and strain", 27, 32),
        ("2.3", "Wave properties", 33, 38), ("2.3", "Superposition and stationary waves", 39, 43),
        ("2.3", "Intensity, refraction and total internal reflection", 44, 48), ("2.3", "Polarisation, diffraction and de Broglie", 49, 54),
        ("2.3", "Pulse-echo techniques", 55, 56), ("2.3", "Photons, the photoelectric effect and line spectra", 57, 63),
        ("2.4", "Current, potential difference and resistance", 64, 70), ("2.4", "Resistivity and charge carriers", 71, 73),
        ("2.4", "Potential dividers", 74, 76), ("2.4", "E.m.f. and internal resistance", 77, 78), ("2.4", "Thermistors and LDRs", 79, 80),
        ("4.3", "Impulse and collisions", 81, 86), ("4.3", "Circular motion", 87, 91),
        ("4.4", "Electric fields and potential", 92, 99), ("4.4", "Capacitors", 100, 104), ("4.4", "Magnetic fields and forces", 105, 107),
        ("4.4", "Electromagnetic induction", 108, 110),
        ("4.5", "The nuclear atom and particle accelerators", 111, 117), ("4.5", "Particles and the standard model", 118, 124),
        ("5.3", "Specific heat capacity and latent heat", 125, 127), ("5.3", "Internal energy and ideal gases", 128, 132),
        ("5.4", "Binding energy, fission and fusion", 133, 136), ("5.4", "Radioactive decay and half-life", 137, 142),
        ("5.5", "Simple harmonic motion", 143, 147), ("5.5", "Resonance and damping", 148, 153),
        ("5.6", "Gravitational fields and orbits", 154, 160), ("5.6", "Black body radiation", 161, 164),
        ("5.6", "Astronomical distances and the H-R diagram", 165, 168), ("5.6", "Redshift and cosmology", 169, 171),
    ],
}
PRACTICAL = ("Planning an experiment: choosing apparatus and techniques, identifying and controlling variables, safety and risk. "
             "Carrying it out and measuring: readings, resolution, precision, accuracy, repeat readings, uncertainties and percentage "
             "uncertainty. Processing and analysing results: tables, graphs, gradients and intercepts, logarithmic plots, calculations "
             "from data, errors and anomalies, conclusions and evaluating the method and suggesting improvements.")


def body(code, path):
    text = FOOTER.sub("\n", "\n".join(p.get_text() for p in pymupdf.open(path)))
    start = text.find(START[code])
    end = text.find("Assessment information\n", text.find("Unit 6", start)) if code != "WPH" else text.find("Appendices", start)
    return text[start:end if end > 0 else None]


def statements(code, text):
    """{(topic, n): words} for Biology and Chemistry, {n: words} for Physics, each statement read in order
    (a number on its own line that is the next one expected, so a stray page number is no statement)."""
    out, last = {}, None
    pat = re.compile(r"^\s*(\d{1,3})\s*\n" if code == "WPH" else r"^\s*(\d{1,2})\.(\d{1,2})\s*\n", re.M)
    marks = []
    for m in pat.finditer(text):
        key = int(m.group(1)) if code == "WPH" else (int(m.group(1)), int(m.group(2)))
        expected = (last or 0) + 1 if code == "WPH" else None
        if code == "WPH" and key != expected:
            continue
        if code != "WPH" and last and not (key == (last[0], last[1] + 1) or key == (last[0] + 1, 1)):
            continue
        marks.append((key, m.end(), m.start()))
        last = key
    for k, (key, at, _) in enumerate(marks):
        out[key] = text[at:marks[k + 1][2] if k + 1 < len(marks) else at + 1500]
    return out


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for code, rel in SPECS.items():
        path = os.path.join(WORK, "spec", f"{code}.pdf")
        if not os.path.exists(path):
            import urllib.parse, urllib.request  # noqa: E401, PLC0415
            req = urllib.request.Request(urllib.parse.quote(BASE + rel, safe=":/"), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                open(path, "wb").write(r.read())
        text = body(code, path)
        found = statements(code, text)
        if code == "WPH":
            heads = [(c, t) for c, t, *_ in PHYSICS]
            sections = [{"code": c, "title": f"{c} {t}", "short": t, "year": 1 if c[0] in "12" else 2} for c, t in heads]
        else:
            # (Chemistry's "Organic Chemistry – Arenes" reads "Organic chemistry: arenes", as its other organic topics do)
            titles = {int(m.group(1)): sentence_case(re.sub(r"\s+", " ", m.group(2)).strip().replace(" – ", ": ")) for m in TOPIC[code].finditer(text)}
            sections = [{"code": str(n), "title": f"Topic {n}: {t}", "short": t, "year": 1 if n <= AS_LAST[code] else 2} for n, t in sorted(titles.items())]
        topics, count = [], {}
        heads = list(LETTERED.finditer(text)) if code == "WCH" else []
        tops = [m.start() for m in re.finditer(r"^Topic \d", text, re.M)]
        lettered = {}
        for k, m in enumerate(heads):
            end = min([h.start() for h in heads[k + 1:k + 2]] + [t for t in tops if t > m.start()] + [len(text)])
            nums = [int(x.group(2)) for x in re.finditer(r"^\s*(\d{1,2})\.(\d{1,2})\s*$", text[m.end():end], re.M) if int(x.group(1)) == int(m.group(1))]
            lettered.setdefault(int(m.group(1)), []).append((m.group(2), sentence_case(m.group(3).strip()), min(nums), max(nums)))
        for n, subs in sorted(lettered.items()):
            for letter, title, a, b in subs:
                topics.append({"code": f"{n}.{letter}", "ref": f"{n}{letter}", "title": title, "section": str(n), "points": f"{n}.{a}–{n}.{b}",
                               "year": 1 if n <= AS_LAST[code] else 2, "text": clean(" ".join(found[(n, i)] for i in range(a, b + 1)))})
        for sec, title, a, b in GROUPS[code]:
            sec = str(sec)
            count[sec] = count.get(sec, 0) + 1
            keys = list(range(a, b + 1)) if code == "WPH" else [(int(sec), i) for i in range(a, b + 1)]
            missing = [k for k in keys if k not in found]
            assert not missing, f"{code}: no statement {missing}"
            points = (f"{a}–{b}" if a != b else str(a)) if code == "WPH" else (f"{sec}.{a}–{sec}.{b}" if a != b else f"{sec}.{a}")
            year = next(s["year"] for s in sections if s["code"] == sec)
            topics.append({"code": f"{sec}.{count[sec]}", "ref": "", "title": title, "section": sec, "points": points, "year": year,
                           "text": clean(" ".join(found[k] for k in keys))})
        order = [x["code"] for x in sections]
        topics.sort(key=lambda t: order.index(t["section"]))  # lettered and grouped topics in the specification's order
        sections.append({"code": "P", "title": "Practical skills (Units 3 and 6)", "short": "Practical skills", "year": 1})
        topics.append({"code": "P.1", "ref": "", "title": "Practical skills", "section": "P", "points": "", "year": 1, "text": PRACTICAL})
        last = max(found)
        assert all(any(t["section"] == s["code"] for t in topics) for s in sections), f"{code}: a section with no topics"
        out[code] = {"sections": sections, "topics": topics}
        print(f"{code}: {len(sections)} sections, {len(topics)} topics, statements to {last}", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
