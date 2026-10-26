"""Read WJEC's AS/A Level Biology, Chemistry and Physics specifications into topic trees.

    python3 scripts/question-bank/wjec/spec_wjec.py [work-dir]
    # reads <work-dir>/spec/<subject>.pdf (fetch_wjec.py); writes <work-dir>/spec.json

WJEC sets each subject out by unit, and the units are what its papers are: AS Units 1
and 2, A2 Units 3 and 4. Each unit opens with a page listing its topics ("This unit
includes the following topics: 1. Basic physics, 2. Kinematics…"; Chemistry numbers
them "1.1", "1.2"), and Unit 4 of Physics and Biology adds a choice of options ("A:
Alternating currents"). So the bank's sections are the units and its topics their
topics, coded "<unit>.<topic>" ("1.2 Kinematics") and "4.A" for an option. AS units'
topics are year 1, A2's year 2, the options 3 (one is chosen, as an AQA Physics option).
Each topic keeps the specification's words under it ("text") for tagging only. Unit 5,
the practical exam, isn't in the bank, so has no topics.

Writes spec.json in spec_ocr.py's shape: {"physics": {"sections": [...], "topics": [...]}}.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "wjec")
# The units' names, as the papers print them (the specification sets them in capitals).
UNITS = {
    "physics": ["Motion, Energy and Matter", "Electricity and Light", "Oscillations and Nuclei", "Fields and Options"],
    "chemistry": ["The Language of Chemistry, Structure of Matter and Simple Reactions", "Energy, Rate and Chemistry of Carbon Compounds",
                  "Physical and Inorganic Chemistry", "Organic Chemistry and Analysis"],
    "biology": ["Basic Biochemistry and Cell Organisation", "Biodiversity and Physiology of Body Systems",
                "Energy, Homeostasis and the Environment", "Variation, Inheritance and Options"],
}


def squash(s):
    return re.sub(r"\s+", " ", s).strip()


def sentence(s):
    """"The physics of sports" from "The Physics of Sports"; names keep their capitals."""
    words = s.split()
    return " ".join([words[0]] + [w if re.match(r"[A-Z]{2,}|DNA|RNA", w) else w.lower() for w in words[1:]]) if words else s


def read(subject):
    doc = pymupdf.open(os.path.join(WORK, "spec", f"{subject}.pdf"))
    pages = [p.get_text() for p in doc]
    intros = {}  # unit: page index of its opening page
    for i, t in enumerate(pages):
        m = re.search(r"\b(?:AS|A2) UNIT (\d)\b", t)
        if m and re.search(r"following (topics|areas of study)", t) and m.group(1) in "1234":
            intros.setdefault(m.group(1), i)
    topics = []
    for unit, i in sorted(intros.items()):
        listing = re.split(r"following (?:topics|areas of study):", pages[i])[1]
        lines = [squash(l) for l in listing.split("\n") if squash(l)]
        found, k = [], 0
        while k < len(lines):
            num = re.fullmatch(r"(\d)\.(\d{1,2})|(\d{1,2})\.?", lines[k])  # Chemistry's "1.1", the others' "1."
            opt = re.match(r"^([A-D])[:.]\s*(.*)$", lines[k])
            if re.match(r"Choice of", lines[k]):
                k += 1
                continue
            if num and k + 1 < len(lines):
                n = num.group(2) or num.group(3)
                found.append((f"{unit}.{int(n)}", lines[k + 1], False))
                k += 2
            elif opt:
                title = opt.group(2) or (lines[k + 1] if k + 1 < len(lines) else "")
                found.append((f"{unit}.{opt.group(1)}", title, True))
                k += 1 if opt.group(2) else 2
            else:
                k += 1
        # Each topic's own words: from its heading in the unit's pages to the next topic's.
        end = min([j for j in intros.values() if j > i] + [next((j for j, t in enumerate(pages) if j > i and re.search(r"\bA2 UNIT 5\b", t)), len(pages))])
        body = squash("\n".join(pages[i + 1:end]))
        at = []
        for code, title, _ in found:
            # Its heading, number and all ("3.2 Redox reactions", "2. KINEMATICS", "Option A: …"), not the same
            # words inside the topic before it ("(a) redox reactions in terms of electron transfer").
            u, k = code.split(".")
            key = (rf"(?:{u}\.)?{k}\.?\s*" if k.isdigit() else rf"(?:Option\s+)?{k}\s*[:.–-]?\s*") + re.escape(squash(title)[:40])
            m = re.search(key, body[at[-1] + 1 if at else 0:], re.I)
            at.append((at[-1] + 1 if at else 0) + m.start() if m else (at[-1] if at else 0))
        for n, (code, title, option) in enumerate(found):
            text = body[at[n]:at[n + 1] if n + 1 < len(at) and at[n + 1] > at[n] else at[n] + 3000]
            text = re.sub(r"GCE AS and A Level \w+ \d+|© WJEC CBAC Ltd\.?", " ", text, flags=re.I)
            text = re.split(r"SPECIFIED PRACTICAL WORK", text)[0]
            # The learning outcomes, after the overview and skills paragraphs.
            outcomes = re.split(r"knowledge and understanding of:?", text, maxsplit=1)
            text = squash(outcomes[1] if len(outcomes) > 1 else text)
            topics.append({"code": code, "title": sentence(squash(title).rstrip(".")), "section": unit,
                           "year": 3 if option else (1 if unit in "12" else 2), "text": text[:1500]})
    sections = [{"code": str(n + 1), "title": f"{'AS' if n < 2 else 'A2'} Unit {n + 1}: {name}"} for n, name in enumerate(UNITS[subject])]
    return {"sections": sections, "topics": topics}


def main():
    out = {s: read(s) for s in UNITS}
    for s, tree in out.items():
        print(s, len(tree["topics"]), [f"{t['code']} {t['title']}" for t in tree["topics"]], file=sys.stderr)
        empty = [t["code"] for t in tree["topics"] if len(t["text"]) < 80]
        if empty:
            print("   little text under:", empty, file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
