"""Mark the A-Level English Literature and AQA languages banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/english_languages_years.py          # write year13.json for each bank, print the counts
    python3 scripts/question-bank/english_languages_years.py sample   # print a few question ids per rule, to read by eye

Unlike maths_years.py nothing is read question by question: both families have a rule the bank's own
papers and topic tags already carry. Needs each bank's parts.json in public/question-bank/<slug>/
(`upload_data.py --pull <slug>`); writes year13.json beside it, the ids that need Year 13 (the site shows the
switch when the file exists, as for maths). Then `upload_data.py <slug> ...` puts it on R2.

AQA French, German, Spanish (7652, 7662, 7692; AS 7651, 7661, 7691). AQA's subject content says the
specification is "designed to be studied over two years": the first year is the first two themes (the
society theme of current trends, and artistic culture), the second adds the other two (current issues /
multiculturalism, and political life). The AS papers test themes 1 and 2 only. Each listening, reading and
writing question on an A-Level paper is tagged with its theme, so a question tagged with theme 3 or 4 is
Year 13; theme 1 or 2 is Year 12. Questions with no theme are the literary-extract reading questions
(the AS paper has them too) and the set-text and film essays on Paper 2, whose lists of works are the
same as the AS's, so those are Year 12. Every AS question is Year 12.

English Literature. Which texts are "first year" is the board's and the school's choice, so the AS papers
decide it: a text, section or task that an AS paper of the same board sets is Year 12 (an AS paper is what a
first-year student sits; Pearson says plainly that AS and the first year of the A-Level "can be taught at the
same time, with students in the same class covering the same content"). What only the A-Level sets is Year 13:
it is second-year content by the board's own design (the A-Level's comparative and contextual papers, its
second-genre and period options). Per bank:

  AQA A (7712/7711):  AS sets Paper 1's Shakespeare, love poetry, unseen prose and comparing texts, so all of
                      the A-Level Paper 1 is Year 12. Paper 2A and 2B (WW1 / Modern times, "texts in shared
                      contexts") have no AS paper: Year 13.
  AQA B (7717/7716):  AS sets the Paper 1 drama and Paper 2 prose and poetry, in tragedy and comedy. So Paper 1's
                      Section A (a Shakespeare play, in both genres) is Year 12. Section C "across two texts"
                      compares two texts, which no AS paper asks, and Paper 2A/2B (crime / protest writing) has
                      no AS equivalent: Year 13.
  Edexcel (9ET0/8ET0): AS sets Poems of the Decade and the Section B drama texts (Paper 1), and the prose
                      themes (Paper 2), identically to the A-Level. So those are Year 12. The A-Level's
                      Shakespeare (Paper 1 Section A) and the period / poet poetry options (Paper 3 Section B)
                      have no AS paper: Year 13.
  OCR (H472/H072):    AS sets Shakespeare (same six plays) and pre-1900 poetry, post-1900 drama and prose. So
                      Component 1 Section 1 (Shakespeare) is Year 12. The comparison of a drama and a poetry text
                      (Component 1 Section 2) and all of Component 2, the comparative and contextual study,
                      have no AS equivalent (the AS asks one text at a time): Year 13.
  Eduqas (A720QS):    skipped. The bank has no AS paper (the AS, B720, is a separate qualification, left out),
                      and the A-Level's three genre components carry no first-year / second-year statement.
  AQA English Language (7702): skipped. No AS papers, 44 questions, and no first-year / second-year split in
                      the papers.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# Languages: the sections that hold themes 3 and 4 in each bank's meta.
LANGUAGES = ["aqa-a-level-french", "aqa-a-level-german", "aqa-a-level-spanish"]
SECOND_YEAR_THEMES = {"t3", "t4"}

# English Literature: per bank, the A-Level papers that are all Year 13, the topics that are Year 13 wherever
# they appear, and the topic sections that are Year 13 (with topics to except from them).
LITERATURE = {
    "aqa-a-level-english-literature-a": {"papers": {"77122A", "77122B"}},
    "aqa-a-level-english-literature-b": {"papers": {"77172A", "77172B"}, "topics": {"tragedy-two-texts", "comedy-two-texts"}},
    "edexcel-a-level-english-literature": {"sections": {"shakespeare": set(), "poetry": {"poems-of-the-decade"}}},
    "ocr-a-level-english-literature": {"papers": {"h47202"}, "topics": {"drama-and-poetry-pre-1900"}},
}
BANKS = LANGUAGES + list(LITERATURE)


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), pub


def second_year(slug, meta, parts):
    """The ids of the Year 13 parts, with the rule that put each there."""
    papers = {p["id"]: p for p in meta["papers"]}
    section = {t["code"]: t["section"] for t in meta["topics"]}
    out = {}
    for p in parts:
        if papers[p["p"]].get("as"):
            continue
        tags = p["t"] if isinstance(p["t"], list) else [p["t"]]
        if slug in LANGUAGES:
            if any(section.get(t) in SECOND_YEAR_THEMES for t in tags):
                out[p["id"]] = "theme 3 or 4"
            continue
        rule = LITERATURE[slug]
        if p["p"] in rule.get("papers", ()):
            out[p["id"]] = f"paper {papers[p['p']]['name']}"
        elif any(t in rule.get("topics", ()) for t in tags):
            out[p["id"]] = "topic " + tags[0]
        elif any(section.get(t) in rule.get("sections", {}) and t not in rule["sections"][section.get(t)] for t in tags):
            out[p["id"]] = "section " + section.get(tags[0], "")
    return out


def write():
    for slug in BANKS:
        meta, parts, pub = load(slug)
        ids = [p["id"] for p in parts if p["id"] in second_year(slug, meta, parts)]
        json.dump(ids, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13", file=sys.stderr)


def sample():
    import random
    random.seed(5)
    for slug in BANKS:
        meta, parts, pub = load(slug)
        text = json.load(open(os.path.join(pub, "text.json")))
        y13 = second_year(slug, meta, parts)
        papers = {p["id"]: p for p in meta["papers"]}
        print(f"\n=== {slug}")
        for label, pick in (("YEAR 13", [p for p in parts if p["id"] in y13]),
                            ("YEAR 12 (A-Level paper)", [p for p in parts if p["id"] not in y13 and not papers[p["p"]].get("as")])):
            for p in random.sample(pick, min(4, len(pick))):
                print(f"[{label}] {p['id']} {papers[p['p']]['name']} {p['t']} :: {' '.join((text.get(p['id']) or p['x']).split())[:230]}")


if __name__ == "__main__":
    {"write": write, "sample": sample}[sys.argv[1] if len(sys.argv) > 1 else "write"]()
