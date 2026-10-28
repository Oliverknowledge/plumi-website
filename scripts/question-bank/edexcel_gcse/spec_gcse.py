"""Read Pearson Edexcel's GCSE (9–1) Biology, Chemistry and Physics specifications into a topic tree.

    python3 scripts/question-bank/edexcel_gcse/spec_gcse.py [work-dir]   # default scripts/question-bank/.work/edexcel-gcse

Writes <work-dir>/spec.json in spec_pearson.py's shape: { "1BI0": { "sections": [...], "topics": [...] }, ... }.
Sections are the specification's numbered topics ("Topic 6: Plant structures and their functions"),
shown as the bank's tiles. Under them Pearson prints only numbered statements (6.1 … 6.16B; a
letter marks a statement for that science alone), so, as for A-Level Biology A and Physics, the
statements are grouped here (GROUPS) into sub-topics a student would recognise. Groups have no
printed code; their statement numbers are kept as `points`. Each keeps the specification's words
for tagging. GCSE topics aren't split by year (`year` 0).
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from spec_pearson import clean, sentence_case  # noqa: E402

BASE = "https://qualifications.pearson.com/content/dam/pdf/GCSE/Science/2016/Specification/"
SPECS = {"1BI0": "gcse-biology-spec.pdf", "1CH0": "gcse-chemistry-spec.pdf", "1PH0": "gcse-physics-spec.pdf"}

# (topic, title, statement ranges): ranges are first–last statement numbers within the topic.
GROUPS = {
    "1BI0": [
        (1, "Cells and microscopy", [(1, 6)]), (1, "Enzymes", [(7, 12)]), (1, "Food tests and calorimetry", [(13, 14)]),
        (1, "Diffusion, osmosis and active transport", [(15, 17)]),
        (2, "Mitosis, growth and cancer", [(1, 7)]), (2, "Stem cells", [(8, 9)]), (2, "The brain", [(10, 12)]),
        (2, "The nervous system and reflexes", [(13, 14)]), (2, "The eye", [(15, 17)]),
        (3, "Reproduction and meiosis", [(1, 3)]), (3, "DNA and protein synthesis", [(4, 10)]),
        (3, "Inheritance and genetic diagrams", [(11, 18)]), (3, "Variation and mutation", [(19, 23)]),
        (4, "Evolution by natural selection", [(1, 3)]), (4, "Evidence for human evolution", [(4, 6)]), (4, "Classification", [(7, 7)]),
        (4, "Selective breeding and tissue culture", [(8, 9)]), (4, "Genetic engineering", [(10, 14)]),
        (5, "Health and disease", [(1, 3)]), (5, "Pathogens and infections", [(4, 8)]), (5, "Plant diseases and defences", [(9, 11)]),
        (5, "The immune system and immunisation", [(12, 15)]), (5, "Antibiotics and new medicines", [(16, 20)]),
        (5, "Monoclonal antibodies", [(21, 22)]), (5, "Non-communicable diseases", [(23, 25)]),
        (6, "Photosynthesis", [(1, 6)]), (6, "Transport in plants", [(7, 10)]), (6, "Leaves and transpiration", [(11, 13)]),
        (6, "Plant adaptations and plant hormones", [(14, 16)]),
        (7, "Hormones, adrenalin and thyroxine", [(1, 3)]), (7, "The menstrual cycle and contraception", [(4, 8)]),
        (7, "Homeostasis and thermoregulation", [(9, 12)]), (7, "Blood glucose and diabetes", [(13, 17)]), (7, "The kidneys", [(18, 22)]),
        (8, "Exchange surfaces and diffusion", [(1, 5)]), (8, "Blood, blood vessels and the heart", [(6, 8), (12, 12)]),
        (8, "Respiration", [(9, 11)]),
        (9, "Ecosystems and sampling", [(1, 6)]), (9, "Energy transfer between trophic levels", [(7, 8)]),
        (9, "Biodiversity and food security", [(9, 11)]), (9, "Material cycles", [(12, 15)]),
        (9, "Decomposition and indicator species", [(16, 19)]),
    ],
    "1CH0": [
        (1, "Atomic structure and isotopes", [(1, 12)]), (1, "The periodic table", [(13, 20)]), (1, "Ionic bonding", [(21, 27)]),
        (1, "Covalent bonding", [(28, 32)]), (1, "Structure and properties", [(33, 42)]),
        (1, "Formula mass and empirical formulae", [(43, 46)]), (1, "Conservation of mass and moles", [(47, 53)]),
        (2, "States of matter", [(1, 4)]), (2, "Pure substances and separating mixtures", [(5, 8)]), (2, "Chromatography", [(9, 11)]),
        (2, "Water treatment", [(12, 12)]),
        (3, "Acids, alkalis and pH", [(1, 8)]), (3, "Neutralisation and making salts", [(9, 21)]), (3, "Electrolysis", [(22, 31)]),
        (4, "Reactivity and extracting metals", [(1, 9)]), (4, "Recycling and life-cycle assessment", [(10, 12)]),
        (4, "Reversible reactions and equilibrium", [(13, 17)]),
        (5, "Transition metals, corrosion and alloys", [(1, 7)]), (5, "Titrations and concentration in mol dm⁻³", [(8, 10)]),
        (5, "Yield and atom economy", [(11, 15)]), (5, "Molar gas volume", [(16, 18)]), (5, "The Haber process and fertilisers", [(19, 24)]),
        (5, "Chemical cells and fuel cells", [(25, 27)]),
        (6, "Alkali metals", [(1, 5)]), (6, "Halogens", [(6, 13)]), (6, "Noble gases", [(14, 16)]),
        (7, "Rates of reaction", [(1, 8)]), (7, "Energy changes in reactions", [(9, 16)]),
        (8, "Crude oil and hydrocarbons", [(1, 6)]), (8, "Combustion, pollution and fuels", [(7, 14)]), (8, "Cracking", [(15, 17)]),
        (8, "The Earth’s atmosphere", [(18, 23)]), (8, "Climate change", [(24, 26)]),
        (9, "Tests for ions and instrumental analysis", [(1, 9)]), (9, "Alkanes and alkenes", [(10, 16)]), (9, "Polymers", [(17, 25)]),
        (9, "Alcohols and carboxylic acids", [(26, 34)]), (9, "Nanoparticles and materials", [(35, 39)]),
    ],
    "1PH0": [
        (1, "Units and measurement", [(1, 4)]),
        (2, "Speed, acceleration and motion graphs", [(1, 13)]), (2, "Newton’s laws, weight and mass", [(14, 19)]),
        (2, "Circular motion and Newton’s third law", [(20, 23)]), (2, "Momentum", [(24, 26)]),
        (2, "Stopping distances and road safety", [(27, 33)]),
        (3, "Energy stores and transfers", [(1, 8)]), (3, "Reducing energy transfers and efficiency", [(9, 12)]),
        (3, "Energy resources", [(13, 14)]),
        (4, "Wave properties and the wave equation", [(1, 8), (17, 17)]), (4, "Reflection, refraction and absorption", [(9, 12)]),
        (4, "Ultrasound, infrasound and seismic waves", [(13, 16)]),
        (5, "Reflection, colour and lenses", [(1, 6)]), (5, "The electromagnetic spectrum", [(7, 14)]),
        (5, "Thermal radiation", [(15, 19)]), (5, "Uses and dangers of EM radiation", [(20, 24)]),
        (6, "Atoms and isotopes", [(1, 9)]), (6, "Ionising radiation", [(10, 17)]), (6, "Nuclear decay and equations", [(18, 22)]),
        (6, "Activity and half-life", [(23, 27)]), (6, "Uses and dangers of radioactivity", [(28, 36)]), (6, "Fission and fusion", [(37, 46)]),
        (7, "Gravity, the Solar System and orbits", [(1, 7)]), (7, "The Big Bang and red-shift", [(8, 15)]),
        (7, "Life cycle of stars", [(16, 19)]),
        (8, "Work done and energy transfers", [(1, 11)]), (8, "Power", [(12, 15)]),
        (9, "Forces and vector diagrams", [(1, 5), (10, 10)]), (9, "Moments, levers and gears", [(6, 9)]),
        (10, "Circuits, current and potential difference", [(1, 11)]), (10, "Resistance, series and parallel circuits", [(12, 21)]),
        (10, "Electrical energy and power", [(22, 32)]), (10, "Mains electricity and safety", [(33, 42)]),
        (11, "Static electricity", [(1, 7)]), (11, "Electric fields", [(8, 10)]),
        (12, "Magnets and magnetic fields", [(1, 6)]), (12, "Electromagnetism and solenoids", [(7, 9)]), (12, "The motor effect", [(10, 14)]),
        (13, "Generators, dynamos and microphones", [(1, 4)]), (13, "Transformers and the National Grid", [(5, 11)]),
        (14, "Density", [(1, 4)]), (14, "Changes of state and specific heat capacity", [(5, 11)]),
        (14, "Gas pressure and temperature", [(12, 15)]), (14, "Gas pressure and volume", [(16, 20)]),
        (15, "Elasticity and springs", [(1, 6)]), (15, "Pressure in fluids and upthrust", [(7, 17)]),
    ],
}


def content(path):
    """Topic 1 to the appendices, the subject content's text."""
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    start = [m.start() for m in re.finditer(r"^\s*Topic 1 [–-]", text, re.M)][-1]  # the content, not the overview's list
    end = text.find("Appendix 1", start)
    return text[start:end if end > 0 else None]


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for code, name in SPECS.items():
        path = os.path.join(WORK, "spec", name)
        if not os.path.exists(path):
            with urllib.request.urlopen(urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
                open(path, "wb").write(r.read())
        body = content(path)
        titles = {}
        for m in re.finditer(r"^\s*Topic (\d+) [–-] ([^\n]+)", body, re.M):
            titles.setdefault(int(m.group(1)), re.sub(r"\s+", " ", m.group(2)).strip())
        found = re.split(r"^\s*(\d{1,2})\.(\d{1,2})[BCP]?\b", body, flags=re.M)
        statements = {}
        for k in range(1, len(found) - 2, 3):
            key = (int(found[k]), int(found[k + 1]))
            statements[key] = statements.get(key, "") + " " + found[k + 2]
        topics, count, covered = [], {}, set()
        for n, title, ranges in GROUPS[code]:
            count[n] = count.get(n, 0) + 1
            keys = [(n, i) for a, b in ranges for i in range(a, b + 1)]
            covered.update(keys)
            points = ", ".join(f"{n}.{a}–{n}.{b}" if a != b else f"{n}.{a}" for a, b in ranges)
            topics.append({"code": f"{n}.{count[n]}", "ref": "", "title": title, "section": str(n), "points": points, "year": 0,
                           "text": clean(" ".join(statements.get(k, "") for k in keys))})
        missed = sorted(k for k in statements if k not in covered and k[0] in titles)
        titles = {n: sentence_case(t).replace("earth science", "Earth science") for n, t in titles.items()}
        sections = [{"code": str(n), "title": f"Topic {n}: {t}", "short": t, "year": 0} for n, t in sorted(titles.items())]
        out[code] = {"sections": sections, "topics": topics}
        empty = [t["code"] for t in topics if len(t["text"]) < 40]
        print(f"{code}: {len(sections)} topics, {len(topics)} sub-topics" + (f"; no text for {empty}" if empty else "")
              + (f"; statements in no group: {missed}" if missed else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
