"""Read Pearson Edexcel's A-Level science specifications into a topic tree.

    python3 scripts/question-bank/edexcel_sciences/spec_pearson.py [work-dir]

Writes <work-dir>/spec.json: { "9CH0": { "sections": [...], "topics": [...] }, ... }
Sections are the specification's numbered topics ("Topic 6: Organic Chemistry I"),
shown as the bank's tiles. Topics are what sits under them:
  - Chemistry: the specification's own lettered sub-topics (6A Alkanes…); a topic
    without letters is one topic.
  - Biology B: its numbered sub-topics (1.1 Carbohydrates…).
  - Biology A and Physics number every statement but give no headings between
    topic and statement, so the statements are grouped here (GROUPS), by
    statement number, into sub-topics a student would recognise. These have no
    printed code of their own; their statement numbers are kept as `points`.
Each topic keeps the specification's words under it ("text") for tagging only.
Year 1 is the AS content (the AS specifications cover Chemistry Topics 1–10,
Physics 1–5 and Biology 1–4); the rest is Year 2.
"""
import json, os, re, sys, urllib.parse, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-sciences")
BASE = "https://qualifications.pearson.com/content/dam/pdf/A Level/"
SPECS = {
    "chemistry": ("Chemistry/2015/Specification and sample assessments/a-level-chemistry-2015-specification.pdf", ("8CH0", "9CH0"), 10),
    "physics": ("Physics/2015/Specification and sample assessments/pearsonedexcel-alevel-physics-spec.pdf", ("8PH0", "9PH0"), 5),
    "biology-a": ("biology-a/2015/specification-and-sample-assessment-materials/9781446930885-gce2015-a-bioa-spec.pdf", ("8BN0", "9BN0"), 4),
    "biology-b": ("biology-b/2015/specification-and-sample-assessment-materials/9781446930892-gce2015-a-biob-spec.pdf", ("8BI0", "9BI0"), 4),
}

# Statement groups for the specifications with no sub-headings: (topic, title, first, last).
# Physics statements are numbered 1–191 through the whole specification; Biology A's
# per topic (1.1–1.18), written here as their second number.
GROUPS = {
    "physics": [
        (1, "Units, estimation and measurement", 1, 8),
        (2, "Motion and SUVAT", 9, 11), (2, "Vectors and projectiles", 12, 15), (2, "Forces and Newton’s laws", 16, 20),
        (2, "Momentum", 21, 22), (2, "Moments and centre of gravity", 23, 24), (2, "Work, energy and power", 25, 30),
        (3, "Charge, current and potential difference", 31, 35), (3, "Resistance, resistivity and power", 36, 42),
        (3, "Potential dividers", 43, 44), (3, "E.m.f. and internal resistance", 45, 46), (3, "Thermistors and LDRs", 47, 48),
        (4, "Density, upthrust and viscosity", 49, 52), (4, "Hooke’s law, stress and strain", 53, 58),
        (5, "Wave properties", 59, 64), (5, "Superposition and stationary waves", 65, 69),
        (5, "Intensity, refraction and total internal reflection", 70, 74), (5, "Lenses", 75, 81),
        (5, "Polarisation and diffraction", 82, 87), (5, "Pulse-echo techniques", 88, 89),
        (5, "Photons and the photoelectric effect", 90, 96),
        (6, "Impulse and collisions", 97, 102), (6, "Circular motion", 103, 107),
        (7, "Electric fields and potential", 108, 115), (7, "Capacitors", 116, 120),
        (7, "Magnetic fields and forces", 121, 123), (7, "Electromagnetic induction and alternating current", 124, 129),
        (8, "The nuclear atom and particle accelerators", 130, 136), (8, "Particles and the standard model", 137, 143),
        (9, "Heat capacity, latent heat and internal energy", 144, 148), (9, "Ideal gases", 149, 152), (9, "Black body radiation", 153, 155),
        (10, "Stars, distances and the H-R diagram", 156, 160), (10, "Redshift and cosmology", 161, 163),
        (11, "Binding energy, fission and fusion", 164, 167), (11, "Radioactive decay and half-life", 168, 173),
        (12, "Gravitational fields and orbits", 174, 180),
        (13, "Simple harmonic motion", 181, 185), (13, "Resonance and damping", 186, 191),
    ],
    "biology-a": [
        (1, "Heart, blood vessels and circulation", 1, 4), (1, "Atherosclerosis and blood clotting", 5, 6),
        (1, "Risk factors and health data", 7, 10), (1, "Diet, carbohydrates and lipids", 11, 15), (1, "Treating cardiovascular disease", 16, 18),
        (2, "Gas exchange and cell membranes", 1, 2), (2, "Transport across membranes", 3, 4),
        (2, "DNA, RNA and protein synthesis", 5, 8), (2, "Proteins and enzymes", 9, 10), (2, "DNA replication and mutation", 11, 12),
        (2, "Inheritance and cystic fibrosis", 13, 14), (2, "Genetic screening", 15, 16),
        (3, "Cell structure", 1, 5), (3, "Gametes and fertilisation", 6, 7), (3, "Meiosis, mitosis and the cell cycle", 8, 10),
        (3, "Stem cells and specialisation", 11, 13), (3, "Genes, environment and phenotype", 14, 15),
        (4, "Biodiversity, adaptation and natural selection", 1, 4), (4, "Hardy-Weinberg and classification", 5, 6),
        (4, "Plant cells, fibres and mineral ions", 7, 12), (4, "Drug testing and antimicrobial plants", 13, 14),
        (4, "Sustainability and conservation", 15, 16),
        (5, "Ecosystems and succession", 1, 4), (5, "Photosynthesis", 5, 9), (5, "Productivity and energy transfer", 10, 11),
        (5, "Climate change", 12, 16), (5, "Evolution and speciation", 17, 20), (5, "The carbon cycle and reforestation", 21, 22),
        (6, "Time of death and decomposition", 1, 2), (6, "DNA profiling and PCR", 3, 4), (6, "Bacteria, viruses, TB and HIV", 5, 6),
        (6, "The immune response", 7, 12), (6, "Antibiotics and hospital infections", 13, 15),
        (7, "Muscles and movement", 1, 2), (7, "Respiration", 3, 7), (7, "Heart rate, cardiac output and ventilation", 8, 9),
        (7, "Muscle fibres, homeostasis and feedback", 10, 13), (7, "Sport, medical technology and ethics", 14, 15),
        (7, "Switching genes on and off", 16, 16),
        (8, "Neurones and nerve impulses", 1, 3), (8, "Synapses", 4, 4), (8, "Detecting stimuli and plant responses", 5, 6),
        (8, "Coordination and the brain", 7, 9), (8, "Learning, brain development and animal research", 10, 13),
        (8, "Brain chemicals and drugs", 14, 15), (8, "Genomes, GM organisms and nature versus nurture", 16, 19),
    ],
}


def fetch(rel, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE.replace(" ", "%20") + urllib.parse.quote(rel), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def content(path):
    """The subject content's text, Topic 1 to the practical endorsement, without page furniture."""
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    # "Topic 1:" also heads the overview's list of topics; the content is the one followed by "Students should".
    start = next(m.start() for m in re.finditer(r"^\s*Topic 1:", text, re.M)
                 if "Students should" in text[m.start():text.find("Topic 2:", m.start())])
    end = text.find("Science Practical Endorsement", start + 1000)
    body = text[start:end]
    body = re.sub(r"Pearson Edexcel Level 3[^\n]*\n[^\n]*©[^\n]*\n\s*\d+\s*\n", "\n", body)
    return body


def clean(s, n=3500):
    return re.sub(r"\s+", " ", s).strip()[:n]


def topic_titles(body):
    return {int(m.group(1)): m.group(2).strip() for m in re.finditer(r"^\s*Topic (\d+): ([^\n]+)", body, re.M)}


def sentence_case(t):
    """Pearson's headings are Title Case; the bank's are sentence case, as AQA's."""
    keep = {"I", "II", "III", "IR", "NMR", "DNA", "RNA"}
    words = t.split()
    return " ".join(w if i == 0 or w in keep or w.isupper() else w.lower() for i, w in enumerate(words))


def chemistry(body):
    titles = topic_titles(body)
    chunks = re.split(r"^\s*(Topic \d+[A-Z]?): ([^\n]+)\n", body, flags=re.M)
    texts = {chunks[k]: (chunks[k + 1].strip(), chunks[k + 2]) for k in range(1, len(chunks) - 2, 3)}
    topics = []
    for n in sorted(titles):
        lettered = sorted(k for k in texts if re.fullmatch(rf"Topic {n}[A-Z]", k))
        if lettered:
            for k in lettered:
                letter = k[-1]
                topics.append({"code": f"{n}.{letter}", "ref": f"{n}{letter}", "title": texts[k][0], "section": str(n), "text": clean(texts[k][1])})
        else:
            topics.append({"code": f"{n}.0", "ref": str(n), "title": sentence_case(titles[n]), "section": str(n), "text": clean(texts[f"Topic {n}"][1])})
    return titles, topics


def biology_b(body):
    titles = topic_titles(body)
    chunks = re.split(r"^\s*(\d{1,2})\.(\d{1,2})\s*\n\s*([A-Z][^\n]{2,80})\n", body, flags=re.M)
    topics, seen = [], {}
    for k in range(1, len(chunks) - 3, 4):
        n, m, title, text = int(chunks[k]), int(chunks[k + 1]), chunks[k + 2].strip(), chunks[k + 3]
        code = f"{n}.{m}"
        if code in seen:  # "4.2 Cell transport mechanisms (continued)"
            seen[code]["text"] = clean(seen[code]["text"] + " " + text)
            continue
        seen[code] = {"code": code, "ref": code, "title": re.sub(r"\s*\(?continued\)?$", "", title, flags=re.I), "section": str(n), "text": clean(text)}
        topics.append(seen[code])
    return titles, topics


def grouped(subject, body):
    titles = topic_titles(body)
    if subject == "physics":
        found = re.split(r"^\s*(\d{1,3})\.\s", body, flags=re.M)
        statements = {int(found[k]): found[k + 1] for k in range(1, len(found) - 1, 2)}
    else:
        found = re.split(r"^\s*(\d{1,2})\.(\d{1,2})\s", body, flags=re.M)
        statements = {(int(found[k]), int(found[k + 1])): found[k + 2] for k in range(1, len(found) - 2, 3)}
    topics, count = [], {}
    for n, title, a, b in GROUPS[subject]:
        count[n] = count.get(n, 0) + 1
        keys = [(n, i) if subject != "physics" else i for i in range(a, b + 1)]
        text = " ".join(statements.get(k, "") for k in keys)
        points = f"{a}–{b}" if a != b else str(a)
        if subject != "physics":
            points = f"{n}.{a}–{n}.{b}" if a != b else f"{n}.{a}"
        topics.append({"code": f"{n}.{count[n]}", "ref": "", "title": title, "section": str(n), "points": points, "text": clean(text)})
    return titles, topics


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for subject, (rel, specs, as_last) in SPECS.items():
        body = content(fetch(rel, os.path.join(WORK, "spec", f"{subject}.pdf")))
        titles, topics = {"chemistry": chemistry, "biology-b": biology_b}.get(subject, lambda b: grouped(subject, b))(body)
        sections = [{"code": str(n), "title": f"Topic {n}: {sentence_case(t)}", "short": sentence_case(t), "year": 1 if n <= as_last else 2}
                    for n, t in sorted(titles.items())]
        for t in topics:
            t["year"] = 1 if int(t["section"]) <= as_last else 2
        tree = {"sections": sections, "topics": topics}
        for spec in specs:
            out[spec] = tree
        empty = [t["code"] for t in topics if len(t["text"]) < 40]
        print(f"{subject}: {len(sections)} topics, {len(topics)} sub-topics" + (f"; no text for {empty}" if empty else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
