"""Read Cambridge International's AS & A Level Psychology (9990) syllabus into a topic tree.

    python3 scripts/question-bank/caie_psychology/spec_caie_psychology.py [work-dir]
    # default work dir: scripts/question-bank/.work/caie-psychology

Writes <work-dir>/spec.json in caie/spec_caie.py's shape: { "9990": { "sections": [...], "topics": [...] } }.
Psychology has no numbered topics of its own at AS Level, so the tree is the syllabus's headings:
  AS (year 1)   1 Biological, 2 Cognitive, 3 Learning, 4 Social approach: a topic per core study (12);
                5 Issues and debates (and the approaches' assumptions); 6 Research methods;
                7 Methodological concepts.
  A Level (2)   A Clinical, B Consumer, C Health, D Organisational psychology, the four specialist options
                (sections carry their `option`, so the bank's Option filter picks a student's two): a topic
                for each of the option's five areas ("A1 Schizophrenia"), the syllabus's 1.1 to 1.5, each with
                the wording of its diagnosis/explanation/treatment (or the like) sub-topics.
The letters follow the papers: Paper 3 and Paper 4's Section A-D are the options in this order.
A topic's `text` is the syllabus's own wording for it (for tagging only), clipped at 3,000 characters.
The syllabus is the 2024-2026 one, which the June 2024 papers and the specimens were set on.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "caie-psychology")
SYLLABUS = "https://www.cambridgeinternational.org/Images/634461-2024-2026-syllabus.pdf"
CLIP = 3000

APPROACHES = [
    ("1", "Biological approach", [("Dement and Kleitman (sleep and dreams)", "Dement and Kleitman (sleep and dreams)"),
                                  ("Hassett et al. (monkey toy preferences)", "Hassett et al. (monkey toy preferences)"),
                                  ("Hölzel et al. (mindfulness and brain scans)", "Hölzel et al. (mindfulness and brain scans)")]),
    ("2", "Cognitive approach", [("Andrade (doodling)", "Andrade (doodling)"),
                                 ("Baron-Cohen et al. (eyes test)", "Baron-Cohen et al. (eyes test)"),
                                 ("Pozzulo et al. (line-ups)", "Pozzulo et al. (line-ups)")]),
    ("3", "Learning approach", [("Bandura et al. (aggression)", "Bandura et al. (aggression)"),
                                ("Fagen et al. (elephant learning)", "Fagen et al. (elephant learning)"),
                                ("Saavedra and Silverman (button phobia)", "Saavedra and Silverman (button phobia)")]),
    ("4", "Social approach", [("Milgram (obedience)", "Milgram (obedience)"),
                              ("Perry et al. (personal space)", "Perry et al. (personal space)"),
                              ("Piliavin et al. (subway Samaritans)", "Piliavin et al. (subway Samaritans)")]),
]
ISSUES = [("5.1", "The application of psychology to everyday life"), ("5.2", "Individual and situational explanations"),
          ("5.3", "Nature versus nurture"), ("5.4", "The use of children in psychological research"),
          ("5.5", "The use of animals in psychological research"), ("5.6", "The four approaches")]
METHODS = ["Experiments", "Self-reports", "Case studies", "Observations", "Correlations", "Longitudinal studies"]
CONCEPTS = ["Aims and hypotheses", "Variables", "Controlling of variables", "Types of data", "Sampling of participants", "Ethics",
            "Validity", "Reliability and replicability", "Data analysis"]
# What A Level adds to a method or concept (the syllabus's "Research methods which are relevant to some of the A Level studies").
A_LEVEL_ADDS = {
    "Experiments": "A Level adds: describe and evaluate the main features of randomised control trials.",
    "Self-reports": "A Level adds: postal questionnaires; rating scales; forced/fixed choice.",
    "Aims and hypotheses": "A Level: write and apply null hypotheses and alternative directional (one-tailed) and non-directional (two-tailed) hypotheses.",
    "Types of data": "A Level adds: psychometric tests (describe and evaluate).",
    "Validity": "A Level adds: temporal validity.",
}
OPTIONS = [  # letter, option number, name, [(area, title)]
    ("A", "1", "Clinical psychology", "clinical", ["Schizophrenia", "Mood (affective) disorders: depressive disorder (unipolar) and bipolar disorder",
                                                   "Impulse control disorders", "Anxiety disorders and fear-related disorders", "Obsessive-compulsive disorder (OCD)"]),
    ("B", "2", "Consumer psychology", "consumer", ["The physical environment", "The psychological environment", "Consumer decision-making", "The product", "Advertising"]),
    ("C", "3", "Health psychology", "health", ["The patient–practitioner relationship", "Adherence to medical advice", "Pain", "Stress", "Health promotion"]),
    ("D", "4", "Organisational psychology", "organisational", ["Motivation to work", "Leadership and management", "Group behaviour in organisations",
                                                              "Organisational work conditions", "Satisfaction at work"]),
]
RUNNING = re.compile(r"Cambridge International AS & A Level Psychology 9990 syllabus for[^\n]*\n\s*\d+\s*\nwww\.[^\n]*\nBack to contents page")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(SYLLABUS, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def clean(s):
    s = RUNNING.sub(" ", s).replace("\x07", "")
    s = re.sub(r"[\t•–○]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clip(s, n=CLIP):
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0]


def slices(text, heads, start=0, end=None):
    """{head: its text}: each from its own line (a line that is only the heading) to the next heading's."""
    end = len(text) if end is None else end
    at = []
    for h in heads:
        m = re.compile(rf"(?m)^{re.escape(h)}[ \t]*$").search(text, start, end)
        if not m:
            sys.exit(f"heading not found: {h!r}")
        at.append((m.start(), m.end()))
    out = {}
    for n, h in enumerate(heads):
        out[h] = text[at[n][1]:(at[n + 1][0] if n + 1 < len(heads) else end)]
    return out


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    path = fetch(os.path.join(WORK, "spec", "9990.pdf"))
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    as_start = [m.start() for m in re.finditer(r"3\.1\.1\s+The core studies", text)][-1]
    methods_start = [m.start() for m in re.finditer(r"3\.1\.2\s+Research methodology", text)][-1]
    a_start = [m.start() for m in re.finditer(r"3\.2\s+A Level Content", text)][-1]
    sections, topics = [], []

    # AS: the core studies, a topic each.
    studies = [h for _, _, ss in APPROACHES for h, _ in ss]
    body = slices(text, studies, as_start, methods_start)
    for code, name, ss in APPROACHES:
        sections.append({"code": code, "title": name, "year": 1})
        for n, (head, short) in enumerate(ss, 1):
            topics.append({"code": f"{code}.{n}", "title": short, "section": code, "text": clip(clean(f"{name}. {short}. " + body[head])), "year": 1})
    # AS: issues and debates, and the approaches' assumptions.
    assumptions = " ".join(clean(m.group(0)) for m in re.finditer(r"Main assumptions of the[^\n]*approach:.*?(?=\n[A-Z][^\n]*\([^\n]*\)\n[A-Z][^\n]*\n)", text[as_start:methods_start], re.S))
    sections.append({"code": "5", "title": "Issues and debates", "year": 1})
    for code, title in ISSUES:
        extra = {"5.6": f"Each approach has its assumptions and three core studies. {assumptions}"}.get(code, "")
        topics.append({"code": code, "title": title, "section": "5", "year": 1,
                       "text": clip(clean(f"At AS Level the issues and debates to consider for each core study: {title}. {extra}"))})
    # AS: research methods and methodological concepts.
    concepts_at = re.compile(r"(?m)^Methodological concepts[ \t]*$").search(text, methods_start, a_start).start()
    methods = slices(text, METHODS, methods_start, concepts_at)
    concepts = slices(text, CONCEPTS, concepts_at, a_start)
    sections.append({"code": "6", "title": "Research methods", "year": 1})
    for n, h in enumerate(METHODS, 1):
        topics.append({"code": f"6.{n}", "title": h, "section": "6", "year": 1, "text": clip(clean(f"{h}. " + methods[h] + " " + A_LEVEL_ADDS.get(h, "")))})
    sections.append({"code": "7", "title": "Methodological concepts", "year": 1})
    for n, h in enumerate(CONCEPTS, 1):
        topics.append({"code": f"7.{n}", "title": h, "section": "7", "year": 1, "text": clip(clean(f"{h}. " + concepts[h] + " " + A_LEVEL_ADDS.get(h, "")))})

    # A Level: the four specialist options.
    for letter, num, name, option, titles in OPTIONS:
        start = [m.start() for m in re.finditer(rf"Specialist Option {num}:[^\n]*\n[^\n]*\n", text[a_start:])]
        start = a_start + start[0] if start else None
        nxt = re.compile(rf"Specialist Option {int(num) + 1}:[^\n]*\n").search(text, start + 10) if int(num) < 4 else re.compile(r"4\s+Details of the assessment").search(text, start + 10)
        region = text[start:nxt.start()]
        sections.append({"code": letter, "title": name, "year": 2, "option": option})
        blocks = list(re.finditer(rf"(?m)^({num}\.\d\.\d)[ \t]+([^\n]+)\n", region))
        by_area = {}
        for n, m in enumerate(blocks):
            area = ".".join(m.group(1).split(".")[:2])
            stop = blocks[n + 1].start() if n + 1 < len(blocks) else len(region)
            by_area.setdefault(area, []).append(f"{m.group(2).strip()}. " + clean(region[m.end():stop]))
        for n, title in enumerate(titles, 1):
            area = f"{num}.{n}"
            if area not in by_area:
                sys.exit(f"no text for {area} {title}")
            topics.append({"code": f"{letter}{n}", "title": title, "section": letter, "year": 2, "text": clip(clean(f"{name}: {title}. " + " ".join(by_area[area])))})

    for s in sections:  # (a section's year is its topics', for the files that read it)
        s["year"] = s.get("year", 0)
    json.dump({"9990": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    empty = [s["code"] for s in sections if not any(t["section"] == s["code"] for t in topics)]
    print(f"9990: {len(sections)} sections, {len(topics)} topics" + (f"; no topics found for {empty}" if empty else ""), file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:5} {t['title'][:55]:55} {len(t['text'])} chars", file=sys.stderr)


if __name__ == "__main__":
    main()
