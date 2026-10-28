"""Read OCR's A-Level Biology B, Chemistry B (Salters) and Physics B specifications into a topic tree.

    python3 scripts/question-bank/ocr/spec_ocr_b.py [work-dir]

spec_ocr.py's sibling for the three B specifications, writing <work-dir>/spec.json
in the same shape: { "H433": { "sections": [...], "topics": [...] } }. Each is laid
out its own way, so each is read its own way:

- Biology B (Advancing Biology) numbers its content as Biology A does: sections
  ("2.1 Cells and chemicals for life") are the tiles, numbered topics ("2.1.1 Cells
  and microscopy") sit under them. Modules 2-3 are the AS content (Year 1).
- Chemistry B (Salters) teaches through ten storylines, the tiles (Elements of life
  ... Colour by design; the first five are the AS). Each storyline's learning outcomes
  are lettered, EL(a), EL(b)..., under the chemical ideas it covers ("Atomic
  structure"): those headings are the topics, shown with the storyline's code ("EL
  Atomic structure") because several storylines share a heading. The lettered
  outcomes they span are kept as `points` ("EL(e)–(h)").
- Physics B (Advancing Physics) numbers its content to two or three levels (3.1.1
  Imaging and signalling, 3.2 Mechanical properties of materials, Module 2 has no
  number below it): the modules are the tiles, their numbered units the topics.
  Modules 2-4 are the AS content.

Module 1 (practical skills) and Chemistry B's Chemical literacy (reading an article)
are left out: those questions are tagged to the content they test. Each topic keeps
the specification's words under it ("text") for tagging only.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-b-sciences")
BASE = "https://www.ocr.org.uk/Images/"
SPECS = {
    "biology": ("171714-specification-accredited-a-level-biology-b-advancing-biology-h422.pdf", ("H022", "H422")),
    "chemistry": ("171723-specification-accredited-a-level-gce-chemistry-b-salters-h433.pdf", ("H033", "H433")),
    "physics": ("171729-specification-accredited-a-level-gce-physics-b-advancing-physics-h557.pdf", ("H157", "H557")),
}
BIOLOGY = {"2.1": "Cells and chemicals for life", "2.2": "Transport and gas exchange systems", "3.1": "Cell division and development",
           "3.2": "Pathogens, immunity and disease control", "3.3": "Non-communicable diseases", "4.1": "Energy, metabolism and exercise",
           "4.2": "Mammalian reproduction", "4.3": "Photosynthesis, food production and populations", "4.4": "From flowers to food",
           "5.1": "Genetics in the twenty first century", "5.2": "Nervous control", "5.3": "Homeostasis"}
# Chemistry B's storylines, in teaching order, each with its chemical-idea headings and the
# letter of the first learning outcome under each, as printed.
STORYLINES = [
    ("EL", "Elements of life", [("a", "Formulae, equations and amount of substance"), ("e", "Atomic structure"), ("i", "Bonding and structure"),
                                ("m", "Inorganic chemistry and the periodic table"), ("t", "Equilibria (acid–base)"), ("v", "Energy and matter"),
                                ("x", "Modern analytical techniques")]),
    ("DF", "Developing fuels", [("a", "Formulae, equations and amount of substance"), ("b", "Bonding and structure"), ("d", "Energetics"),
                                ("h", "Kinetics"), ("k", "Inorganic chemistry and the periodic table"), ("l", "Organic functional groups"),
                                ("n", "Organic reactions"), ("p", "Polymers"), ("q", "Organic mechanisms"), ("r", "Isomerism"), ("u", "Sustainability")]),
    ("ES", "Elements from the sea", [("a", "Formulae, equations and amount of substance"), ("b", "Redox"),
                                     ("h", "Inorganic chemistry and the periodic table"), ("o", "Equilibria")]),
    ("OZ", "The ozone story", [("a", "Bonding and structure"), ("e", "Kinetics"), ("i", "Inorganic chemistry and the periodic table"),
                               ("j", "Organic functional groups"), ("k", "Organic reactions"), ("l", "Reaction mechanisms"), ("r", "Sustainability"),
                               ("s", "Energy and matter")]),
    ("WM", "What’s in a medicine?", [("a", "Organic functional groups"), ("c", "Organic reactions"), ("h", "Reaction mechanisms"),
                                     ("i", "Modern analytical techniques")]),
    ("CI", "The chemical industry", [("a", "Kinetics"), ("f", "Equilibrium"), ("i", "Inorganic chemistry and the periodic table"), ("k", "Sustainability")]),
    ("PL", "Polymers and life", [("a", "Structure and bonding"), ("f", "Kinetics"), ("h", "Equilibria (acid–base)"), ("k", "Organic functional groups"),
                                 ("m", "Organic reactions"), ("o", "Polymers"), ("q", "Isomerism"), ("r", "Modern analytical techniques")]),
    ("O", "Oceans", [("a", "Energetics"), ("i", "Equilibria (acid–base)"), ("n", "Energy and matter")]),
    ("DM", "Developing metals", [("a", "Formulae, equations and amount of substance"), ("b", "Bonding and structure"), ("c", "Redox"),
                                 ("g", "Inorganic chemistry and the periodic table"), ("n", "Energy and matter")]),
    ("CD", "Colour by design", [("a", "Bonding and structure"), ("c", "Organic functional groups"), ("g", "Organic reactions"),
                                ("k", "Reaction mechanisms"), ("m", "Energy and matter"), ("n", "Modern analytical techniques")]),
]
PHYSICS_MODULES = {"2": "Fundamental data analysis", "3": "Physics in action", "4": "Understanding processes",
                   "5": "Rise and fall of the clockwork universe", "6": "Field and particle physics"}
# code, title, and the heading its content starts under.
PHYSICS = [("2.0", "Fundamental data analysis", r"Module 2: Fundamental data analysis"), ("3.1.1", "Imaging and signalling", r"3\.1\.1 Imaging and signalling"),
           ("3.1.2", "Sensing", r"3\.1\.2 Sensing"), ("3.2", "Mechanical properties of materials", r"3\.2 Mechanical properties of materials"),
           ("4.1", "Waves and quantum behaviour", r"4\.1 Waves and quantum behaviour"), ("4.2", "Space, time and motion", r"4\.2 Space, time and motion"),
           ("5.1.1", "Creating models", r"5\.1\.1 Creating models"), ("5.1.2", "Out into space", r"5\.1\.2 Out into space"),
           ("5.1.3", "Our place in the universe", r"5\.1\.3 Our place in the universe"), ("5.2.1", "Matter: very simple", r"5\.2\.1 Matter: very simple"),
           ("5.2.2", "Matter: hot or cold", r"5\.2\.2 Matter: hot or cold"), ("6.1.1", "Electromagnetism", r"6\.1\.1 Electromagnetism"),
           ("6.1.2", "Charge and field", r"6\.1\.2 Charge and field"), ("6.2.1", "Probing deep into matter", r"6\.2\.1 Probing deep into matter"),
           ("6.2.2", "Ionising radiation and risk", r"6\.2\.2 Ionising radiation and risk")]
# Running heads and table headings repeated on every page of the content.
NOISE = re.compile(r"Version [\d.]+ © (?:Cambridge )?OCR \d{4}|Cambridge OCR Level 3 Advanced GCE in [^\n]+|Learning outcomes|Additional guidance|"
                   r"Learners should be able to demonstrate and apply their knowledge and understanding of:")


def fetch(name, path):
    if not os.path.exists(path):
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def clean(text):
    return re.sub(r"\s+", " ", NOISE.sub(" ", text)).strip()[:3500]


def biology(text):
    heading = re.compile(r"^\s*([2-5]\.\d\.\d)\s+([A-Z][^\n]{2,90})$", re.M)
    found = {}
    for m in heading.finditer(text):  # the contents pages list the topics too; the content is the last time each appears
        if m.group(1)[:3] in BIOLOGY:
            found[m.group(1)] = (m.start(), m.end(), m.group(2).strip())
    order = sorted(found.items(), key=lambda kv: kv[1][0])
    topics = []
    for n, (code, (start, end, title)) in enumerate(order):
        stop = order[n + 1][1][0] if n + 1 < len(order) else end + 4000
        topics.append({"code": code, "title": title, "section": code[:3], "text": clean(text[end:stop]), "year": 1 if int(code[0]) <= 3 else 2})
    sections = [{"code": c, "title": t, "year": 1 if int(c[0]) <= 3 else 2} for c, t in BIOLOGY.items()]
    return sections, topics


def chemistry(text):
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    sections, topics = [], []
    for n, (code, name, heads) in enumerate(STORYLINES):
        # A storyline runs from its first "<name> (<code>)" heading (its overview, then its outcomes) to the next's.
        start = lines.index(f"{name} ({code})")
        if n + 1 < len(STORYLINES):
            nc, nn, _ = STORYLINES[n + 1]
            stop = next(i for i in range(start, len(lines) - 1) if lines[i] == f"{nn} ({nc})")
        else:
            stop = next(i for i in range(start, len(lines)) if re.match(r"2e\.\s+Chemical literacy", lines[i]))
        block = lines[start:stop]
        at = []
        for letter, head in heads:
            i = next(i for i in range(at[-1] + 1 if at else 0, len(block) - 1) if block[i] == head and block[i + 1] == f"({letter})")
            at.append(i)
        year = 1 if n < 5 else 2
        sections.append({"code": code, "title": name, "year": year})
        for k, ((letter, head), i) in enumerate(zip(heads, at)):
            body = block[i + 1:at[k + 1] if k + 1 < len(at) else len(block)]
            # The outcomes run (a), (b), (c)...; sub-points "(i)", "(ii)" sit among them, so only the next letter counts.
            last = letter
            for l in body:
                if l == f"({chr(ord(last) + 1)})":
                    last = chr(ord(last) + 1)
            topics.append({"code": f"{code}.{k + 1}", "ref": code, "title": head, "section": code, "year": year,
                           "points": f"{code}({letter})" + (f"–({last})" if last != letter else ""),
                           "slug": re.sub(r"[^a-z0-9]+", "-", f"{code} {head}".lower()).strip("-"),
                           "text": clean(f"{name} ({code}): " + "\n".join(body))})
    return sections, topics


def physics(text):
    # The content starts at its second "Content of modules 1 to 6" (the first is the contents page).
    content = text.index("Content of modules 1 to 6", text.index("Content of modules 1 to 6") + 1)
    starts = []
    for code, title, head in PHYSICS:
        m = re.compile(r"^\s*" + head.replace(" ", r"\s+") + r"\s*$", re.M).search(text, content)
        starts.append((m.start(), m.end()))
    end = text.index("3 Assessment of", starts[-1][1]) if "3 Assessment of" in text[starts[-1][1]:] else starts[-1][1] + 6000
    topics = []
    for n, (code, title, _) in enumerate(PHYSICS):
        stop = starts[n + 1][0] if n + 1 < len(starts) else end
        topics.append({"code": code, "title": title, "section": code[0], "year": 1 if int(code[0]) <= 4 else 2,
                       **({"ref": code[0]} if code == "2.0" else {}), "text": clean(text[starts[n][1]:stop])})
    sections = [{"code": c, "title": t, "year": 1 if int(c) <= 4 else 2} for c, t in PHYSICS_MODULES.items()]
    return sections, topics


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for subject, (name, specs) in SPECS.items():
        text = "\n".join(p.get_text() for p in pymupdf.open(fetch(name, os.path.join(WORK, "spec", f"{subject}.pdf"))))
        sections, topics = {"biology": biology, "chemistry": chemistry, "physics": physics}[subject](text)
        for spec in specs:
            out[spec] = {"sections": sections, "topics": topics}
        empty = [s["code"] for s in sections if not any(t["section"] == s["code"] for t in topics)]
        short = [t["code"] for t in topics if len(t["text"]) < 150]
        print(f"{subject}: {len(sections)} sections, {len(topics)} topics" + (f"; no topics for {empty}" if empty else "")
              + (f"; little text for {short}" if short else ""), file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
