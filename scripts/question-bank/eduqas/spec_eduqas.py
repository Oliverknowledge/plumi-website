"""Read the topics of Eduqas's A-Level Biology, Chemistry and Physics specifications.

    python3 scripts/question-bank/eduqas/spec_eduqas.py [work-dir]

Reads <work-dir>/specs/<subject>.pdf and <subject>-as.pdf (fetch_eduqas.py) and writes
<work-dir>/spec.json: {"physics": {"sections": [{code, title}], "topics": [{code, ref,
title, section, year, text}]}, ...}, the shape the other spec_*.py scripts write.

  - Physics and Biology number their topics within each component ("This component
    covers the following areas of study: 1. Basic physics 2. Kinematics …"), with a
    choice of options in Component 3 ("A: Alternating currents"). Codes are the
    component and the number, "1.2", and the option's letter, "3.A". Biology's Core
    Concepts, assessed in every component, are "C.1" to "C.5".
  - Chemistry prints its own codes: "C1.1 Formulae and equations" under "Topic C1",
    "PI2.2", "OA3.1". The bank takes the sub-topics.

`year` is 1 for a topic the AS specification also has (matched by title), 2 for A-Level
only and 3 for a Component 3 option, as questionBank.ts's BankTopic says. `text` is what
the specification says under the topic, for the tagger.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "eduqas-sciences")
COMPONENTS = {
    "physics": ["Newtonian Physics", "Electricity and the Universe", "Light, Nuclei and Options"],
    "biology": ["Energy for Life", "Continuity of Life", "Requirements for Life"],
}


def text_of(path):
    doc = pymupdf.open(path)
    t = "\n".join(p.get_text() for p in doc)
    t = re.sub(r"\n\s*(?:A LEVEL|AS) (?:PHYSICS|CHEMISTRY|BIOLOGY) \d+\s*\n\s*©\s*WJEC CBAC Ltd\.\s*\n", "\n", t)
    return re.sub(r"[ \t]+", " ", t)


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower().replace("d.c.", "dc")).strip()


def find_title(text, title, start, code=""):
    """Where `title` is printed as a topic's heading after `start`: at a line's start, any case, however it
    wraps, with the topic's "Overview" under it (which keeps out the lists of topics and the appendices)."""
    words = [re.escape(w) for w in re.findall(r"[A-Za-z0-9]+", title)]
    lead = re.escape(code) if code else r"(?:\d{1,2}\.|(?:OPTION\s+)?[A-D][:.])?"
    pat = r"(?im)^[ \t]*" + lead + r"\s*" + r"\W+".join(words) + r"[^\n]*\n(?:\s*\n)*\s*Overview"
    return re.compile(pat).search(text, start)


def listed(block):
    """'1. | Basic physics | 2. | Kinematics' and 'A: | Alternating currents' -> [("1", "Basic physics"), ...]."""
    out = []
    for m in re.finditer(r"(?m)^\s*(\d{1,2}|[A-D])[.:]\s*\n?\s*([^\n]+?)\s*$", block):
        out.append((m.group(1), m.group(2).strip()))
    return out


def numbered(subject, text):
    """Physics and Biology: (sections, topics) from each component's list of topics."""
    sections, topics = [], []
    comps = list(re.finditer(r"\n\s*2\.(\d) Component \d\s*\n", text))
    core = re.search(r"Core Concepts include the following topics:(.*?)\n\s*CORE CONCEPTS", text, re.S)
    if core:
        sections.append({"code": "C", "title": "Core Concepts"})
        for n, title in listed(core.group(1)):
            topics.append({"code": f"C.{n}", "title": title, "section": "C"})
    for k, m in enumerate(comps):
        c = m.group(1)
        sections.append({"code": c, "title": COMPONENTS[subject][int(c) - 1]})
        block = re.search(r"following (?:areas of study|topics):(.*?)(?:Choice of|The assessment will also include)", text[m.end():], re.S).group(1)
        opts = re.search(r"Choice of (?:1|one) option from \w+:(.*?)(?:The assessment|\n\s*\n\s*\n|$)", text[m.end():m.end() + 3000], re.S)
        for n, title in listed(block):
            topics.append({"code": f"{c}.{n}", "title": title, "section": c})
        for n, title in [x for x in listed(opts.group(1)) if x[0].isalpha()] if opts else []:
            topics.append({"code": f"{c}.{n}", "title": title, "section": c, "option": True})
    # Each topic's words: from its heading to the next one's.
    pos = core.end() if core else comps[0].end()
    starts = []
    for t in topics:
        m = find_title(text, t["title"], pos)
        starts.append(m.start() if m else None)
        pos = m.end() if m else pos
    end = text.find("\n3 ASSESSMENT", pos)
    for n, t in enumerate(topics):
        if starts[n] is None:
            t["text"] = ""
            continue
        nxt = next((s for s in starts[n + 1:] if s), end if end > 0 else len(text))
        t["text"] = text[starts[n]:nxt]
    return sections, topics


def chemistry(text):
    sections, topics = [], []
    for m in re.finditer(r"(?m)^\s*Topic ((?:C|PI|OA)\d)\s*\n\s*([^\n]+?)\s*$", text):
        if not any(s["code"] == m.group(1) for s in sections):
            sections.append({"code": m.group(1), "title": m.group(2)})
    for m in re.finditer(r"(?m)^\s*((?:C|PI|OA)\d\.\d{1,2})\s*\n?\s*([A-Z][a-z][^\n]{2,80}?)\s*$", text):
        code = m.group(1)
        if not any(t["code"] == code for t in topics):
            topics.append({"code": code, "title": m.group(2).strip(), "section": code.split(".")[0]})
    # A topic with no sub-topics (PI3 Chemical kinetics, OA4) is one itself.
    for sec in sections:
        if not any(t["section"] == sec["code"] for t in topics):
            topics.append({"code": sec["code"], "title": sec["title"], "section": sec["code"]})
    order = [s["code"] for s in sections]
    topics.sort(key=lambda t: (order.index(t["section"]), [int(x) for x in re.findall(r"\d+", t["code"])]))
    # The words under each: from its heading on its own page (with "Overview" under it) to the next topic's.
    starts = []
    for t in topics:
        m = find_title(text, t["title"], 0, t["code"] if "." in t["code"] else "Topic " + t["code"])
        starts.append(m.start() if m else None)
    end = text.find("\n3 ASSESSMENT")
    for n, t in enumerate(topics):
        nxt = min([x for x in starts if x and starts[n] and x > starts[n]] + [end if end > 0 else len(text)])
        t["text"] = text[starts[n]:nxt] if starts[n] is not None else ""
    return sections, topics


def as_titles(subject):
    text = text_of(os.path.join(WORK, "specs", f"{subject}-as.pdf"))
    if subject == "chemistry":
        return {norm(t) for _, t in re.findall(r"(?m)^\s*((?:C|PI|OA)?\d\.\d{1,2})\s*\n?\s*([A-Z][^\n]{3,80}?)\s*$", text)}
    out = set()
    for m in re.finditer(r"(?:following areas of study|include[s]? the following topics|study of the following topics):?(.*?)(?:The assessment|Choice)", text, re.S):
        out |= {norm(t) for _, t in listed(m.group(1))}
    return out


def clean(t):
    t = re.sub(r"\s*\n\s*", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def main():
    out = {}
    for subject in ("physics", "chemistry", "biology"):
        path = os.path.join(WORK, "specs", f"{subject}.pdf")
        if not os.path.exists(path):
            continue
        text = text_of(path)
        sections, topics = chemistry(text) if subject == "chemistry" else numbered(subject, text)
        as_set = as_titles(subject)
        for t in topics:
            t["ref"] = t["code"]
            t["year"] = 3 if t.pop("option", False) else 1 if norm(t["title"]) in as_set else 2
            t["text"] = clean(t["text"])[:4000]
        out[subject] = {"sections": sections, "topics": topics}
        print(f"{subject}: {len(sections)} sections, {len(topics)} topics, {sum(1 for t in topics if t['year'] == 1)} AS, "
              f"{sum(1 for t in topics if not t['text'])} without text", file=sys.stderr)
        for t in topics:
            print(f"   {t['code']:7} y{t['year']} {t['title'][:60]:60} {len(t['text'])}", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
