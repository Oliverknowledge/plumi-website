"""Tag every French and Spanish question with its topics.

    python3 scripts/question-bank/aqa_languages/tag_languages.py [work-dir]   # default scripts/question-bank/.work/aqa-languages

Writes <work-dir>/tags.json, { part id: [topic codes] }. Three kinds of topic (spec_languages.py):

  - Paper 1's (and AS Paper 2's translation's) passage is set in one of the specification's
    sub-themes. A passage's title rarely names it ("Le Café Renaissance" is about prison), so each
    passage was read and placed by hand, below. A literary extract ("Lisez cet extrait adapté du
    roman...") belongs to no theme; it is a skill of its own.
  - Every Paper 1 question has its skill: listening (it has a recording), reading, a summary,
    translation into English or into the language, or a literary extract.
  - Paper 2's essays are each on one set text or film, found by the pattern in its heading.
  - A question whose scheme demands a construction ("must be pluperfect", "Must be in the future
    tense") is tagged with that grammar point too. AQA's schemes seldom say so, so few are.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-languages")
sys.path.insert(0, HERE)
from spec_languages import WORKS  # noqa: E402

LIT = "literary"
# "<component>-<series>-<question>": the sub-theme its passage is set in (or a literary extract).
THEME = {
    # French AS Paper 1 (Year 1 themes only)
    "76511-jun22-01": "family", "76511-jun22-02": "cinema", "76511-jun22-03": "voluntary", "76511-jun22-04": "music", "76511-jun22-05": "cyber",
    "76511-jun22-06": "voluntary", "76511-jun22-07": LIT, "76511-jun22-08": "heritage", "76511-jun22-09": "family", "76511-jun22-10": "music",
    "76511-jun23-01": "heritage", "76511-jun23-02": "cinema", "76511-jun23-03": "voluntary", "76511-jun23-04": "family", "76511-jun23-05": "cyber",
    "76511-jun23-06": "music", "76511-jun23-07": LIT, "76511-jun23-08": "family", "76511-jun23-09": "voluntary", "76511-jun23-10": "heritage",
    "76511-jun24-01": "cyber", "76511-jun24-02": "music", "76511-jun24-03": "family", "76511-jun24-04": "heritage", "76511-jun24-05": "heritage",
    "76511-jun24-06": "family", "76511-jun24-07": LIT, "76511-jun24-08": "cinema", "76511-jun24-09": "cyber", "76511-jun24-10": "voluntary",
    "76511-jun25-01": "cyber", "76511-jun25-02": "music", "76511-jun25-03": "cinema", "76511-jun25-04": "family", "76511-jun25-05": "heritage",
    "76511-jun25-06": "cinema", "76511-jun25-07": LIT, "76511-jun25-08": "voluntary", "76511-jun25-09": "music", "76511-jun25-10": "cyber",
    "76511-nov20-01": "cinema", "76511-nov20-02": "heritage", "76511-nov20-03": "cyber", "76511-nov20-04": "family", "76511-nov20-05": "voluntary",
    "76511-nov20-06": "cyber", "76511-nov20-07": LIT, "76511-nov20-08": "family", "76511-nov20-09": "music", "76511-nov20-10": "cinema",
    # French AS Paper 2, Section A (translation into French)
    "76512-jun22-01": "cyber", "76512-jun23-01": "voluntary", "76512-jun24-01": "music", "76512-jun25-01": "family", "76512-nov20-01": "family",
    # French A-Level Paper 1
    "76521-jun22-01": "voluntary", "76521-jun22-02": "criminals", "76521-jun22-03": "heritage", "76521-jun22-04": "strikes", "76521-jun22-05": "cyber",
    "76521-jun22-06": "cinema", "76521-jun22-07": LIT, "76521-jun22-08": "immigration", "76521-jun22-09": "marginalised", "76521-jun22-10": "immigration",
    "76521-jun23-01": "heritage", "76521-jun23-02": "family", "76521-jun23-03": "diversity", "76521-jun23-04": "criminals", "76521-jun23-05": "cinema",
    "76521-jun23-06": "marginalised", "76521-jun23-07": LIT, "76521-jun23-08": "strikes", "76521-jun23-09": "strikes", "76521-jun23-10": "marginalised",
    "76521-jun24-01": "heritage", "76521-jun24-02": "voluntary", "76521-jun24-03": "diversity", "76521-jun24-04": "vote", "76521-jun24-05": "music",
    "76521-jun24-06": "marginalised", "76521-jun24-07": LIT, "76521-jun24-08": "strikes", "76521-jun24-09": "criminals", "76521-jun24-10": "family",
    "76521-jun25-01": "marginalised", "76521-jun25-02": "strikes", "76521-jun25-03": "family", "76521-jun25-04": "music", "76521-jun25-05": "criminals",
    "76521-jun25-06": "vote", "76521-jun25-07": LIT, "76521-jun25-08": "cyber", "76521-jun25-09": "immigration", "76521-jun25-10": "cinema",
    "76521-nov20-01": "music", "76521-nov20-02": "cyber", "76521-nov20-03": "marginalised", "76521-nov20-04": "vote", "76521-nov20-05": "diversity",
    "76521-nov20-06": "family", "76521-nov20-07": LIT, "76521-nov20-08": "strikes", "76521-nov20-09": "criminals", "76521-nov20-10": "heritage",
    "76521-nov21-01": "cinema", "76521-nov21-02": "criminals", "76521-nov21-03": "diversity", "76521-nov21-04": "strikes", "76521-nov21-05": "music",
    "76521-nov21-06": "immigration", "76521-nov21-07": LIT, "76521-nov21-08": "marginalised", "76521-nov21-09": "criminals", "76521-nov21-10": "family",
    # Spanish AS Paper 1 (Year 1 themes only)
    "76911-jun22-01": "heritage", "76911-jun22-02": "equality", "76911-jun22-03": "cyber", "76911-jun22-04": "heritage", "76911-jun22-05": "regional",
    "76911-jun22-06": "heritage", "76911-jun22-07": LIT, "76911-jun22-08": "values", "76911-jun22-09": "cyber", "76911-jun22-10": "idols",
    "76911-jun23-01": "equality", "76911-jun23-02": "cyber", "76911-jun23-03": "values", "76911-jun23-04": "heritage", "76911-jun23-05": "idols",
    "76911-jun23-06": "regional", "76911-jun23-07": LIT, "76911-jun23-08": "equality", "76911-jun23-09": "idols", "76911-jun23-10": "values",
    "76911-jun24-01": "values", "76911-jun24-02": "heritage", "76911-jun24-03": "regional", "76911-jun24-04": "equality", "76911-jun24-05": "cyber",
    "76911-jun24-06": "values", "76911-jun24-07": LIT, "76911-jun24-08": "idols", "76911-jun24-09": "values", "76911-jun24-10": "equality",
    "76911-jun25-01": "values", "76911-jun25-02": "regional", "76911-jun25-03": "heritage", "76911-jun25-04": "idols", "76911-jun25-05": LIT,
    "76911-jun25-06": "heritage", "76911-jun25-07": "idols", "76911-jun25-08": "equality", "76911-jun25-09": "cyber", "76911-jun25-10": "idols",
    "76911-nov20-01": "values", "76911-nov20-02": "equality", "76911-nov20-03": "cyber", "76911-nov20-04": "idols", "76911-nov20-05": "cyber",
    "76911-nov20-06": "idols", "76911-nov20-07": LIT, "76911-nov20-08": "heritage", "76911-nov20-09": "heritage", "76911-nov20-10": "regional",
    # Spanish AS Paper 2, Section A (translation into Spanish)
    "76912-jun22-01": "regional", "76912-jun23-01": "idols", "76912-jun24-01": "idols", "76912-jun25-01": "values", "76912-nov20-01": "equality",
    # Spanish A-Level Paper 1
    "76921-jun22-01": "cyber", "76921-jun22-02": "regional", "76921-jun22-03": "idols", "76921-jun22-04": "equality", "76921-jun22-05": "idols",
    "76921-jun22-06": "monarchies", "76921-jun22-07": "movements", "76921-jun22-08": LIT, "76921-jun22-09": "heritage", "76921-jun22-10": "youth",
    "76921-jun22-11": "racism",
    "76921-jun23-01": "racism", "76921-jun23-02": "racism", "76921-jun23-03": "movements", "76921-jun23-04": "idols", "76921-jun23-05": "monarchies",
    "76921-jun23-06": "heritage", "76921-jun23-07": "movements", "76921-jun23-08": "idols", "76921-jun23-09": LIT, "76921-jun23-10": "immigration",
    "76921-jun23-11": "youth",
    "76921-jun24-01": "immigration", "76921-jun24-02": "idols", "76921-jun24-03": "heritage", "76921-jun24-04": "youth", "76921-jun24-05": "immigration",
    "76921-jun24-06": LIT, "76921-jun24-07": "idols", "76921-jun24-08": "movements", "76921-jun24-09": "integration", "76921-jun24-10": "cyber",
    "76921-jun24-11": "idols",
    "76921-jun25-01": "monarchies", "76921-jun25-02": "cyber", "76921-jun25-03": "immigration", "76921-jun25-04": "idols", "76921-jun25-05": "racism",
    "76921-jun25-06": "movements", "76921-jun25-07": "immigration", "76921-jun25-08": LIT, "76921-jun25-09": "regional", "76921-jun25-10": "equality",
    "76921-jun25-11": "values",
    "76921-nov20-01": "values", "76921-nov20-02": "heritage", "76921-nov20-03": "monarchies", "76921-nov20-04": "integration", "76921-nov20-05": "cyber",
    "76921-nov20-06": LIT, "76921-nov20-07": "youth", "76921-nov20-08": "idols", "76921-nov20-09": "immigration", "76921-nov20-10": "racism",
    "76921-nov20-11": "equality",
    "76921-nov21-01": "cyber", "76921-nov21-02": "racism", "76921-nov21-03": "youth", "76921-nov21-04": "idols", "76921-nov21-05": "monarchies",
    "76921-nov21-06": "movements", "76921-nov21-07": "idols", "76921-nov21-08": "immigration", "76921-nov21-09": LIT, "76921-nov21-10": "values",
    "76921-nov21-11": "heritage",
}

INTO_ENGLISH = re.compile(r"Translate (the|this)", re.I)
INTO_TARGET = re.compile(r"tradu(isez|ce|zca)\b", re.I)
SUMMARY = re.compile(r"résumez|resumiendo|resumen", re.I)
EXTRACT = re.compile(r"extrait (adapté )?d[ue] (roman|conte)|extrait du roman|\bextract[oa]? (del|de la) (libro|obra|cuento|novela)|texto (basado en|de) la (obra|novela)|fragmento basado|Lee este (texto|extracto|fragmento) (de|del|basado)", re.I)
# What a scheme row demands, in its notes column: "must be pluperfect", "Must be in the future tense".
GRAMMAR = ("subjunctive", "conditional", "pluperfect", "imperfect", "preterite", "future", "passive")
DEMANDS = re.compile(r"(?:must|needs? to|has to|should)\s+(?:be|use|have)\s+(?:in\s+)?(?:the\s+|a\s+|an\s+)?(?:\w+\s+)?(" + "|".join(GRAMMAR) + r")"
                     r"|(" + "|".join(GRAMMAR) + r")\s+(?:is\s+)?(?:required|needed|essential)", re.I)


def grammar_demanded():
    """{part id: [grammar codes]} from the full text of each Paper 1 and AS Paper 2 scheme row
    (the parts' msText is cut short, and a translation's demands are pages into its row)."""
    sys.argv[1:] = [WORK]
    import cut_languages  # noqa: PLC0415  (patches cut.py as it is imported)
    import pymupdf  # noqa: PLC0415
    cut, out = cut_languages.cut, {}
    for f in sorted(os.listdir(os.path.join(WORK, "pdf"))):
        m = re.match(r"AQA-(76\d\d\d)-MS-(\w+)\.pdf$", f)
        if not m or m.group(1)[3:] == "22":
            continue  # Paper 2's essays demand no grammar point of their own
        ms = pymupdf.open(os.path.join(WORK, "pdf", f))
        for (q, p), pieces, _ in cut.regions(ms, 110, False, False):
            full = re.sub(r"\s+", " ", " ".join(ms[pg].get_text("text", clip=r) for pg, r in pieces))
            found = sorted({(a or b).lower() for a, b in DEMANDS.findall(full)})
            if found:
                out[f"{m.group(1)}-{m.group(2).lower()}-{q}" + (f"-{p}" if p else "")] = found
    return out


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    audio = json.load(open(os.path.join(WORK, "audio.map.json")))
    grammar = grammar_demanded()
    works = {lang: [(code, re.compile(rx)) for _, _, items in WORKS[lang] for code, _, rx in items] for lang in WORKS}
    tags, missing = {}, []
    for p in parts:
        comp, q = p["component"], p["question"]
        lang = "french" if comp.startswith("765") else "spanish"
        key = f"{p['set']}-{q}"
        essay = comp[4] == "2" and not (comp[3] == "1" and q == "01")
        if essay:
            # The essay's heading ("Molière : Le Tartuffe") is the start of its text, before the question.
            found = [code for code, rx in works[lang] if rx.search(p["text"][:200])]
            tags[p["id"]] = found[:1]
            if not found:
                missing.append(p["id"])
            continue
        t = []
        theme = THEME.get(key)
        if theme and theme != LIT:
            t.append(theme)
        if theme == LIT or EXTRACT.search(p["text"][:400]):
            t.append("literary")
        text = p["text"]
        if INTO_ENGLISH.search(text):
            t.append("into-english")
        elif INTO_TARGET.search(text):
            t.append("into-language")
        elif key in audio:
            t.append("listening")
        else:
            t.append("reading")
        # A long article pushes the instruction past the text kept; a summary's scheme rows say "Bullet 1" either way.
        if p["part"] is None and (SUMMARY.search(text) or re.search(r"\bBullet\b", p.get("msText", ""))):
            t.append("summary")
        t += grammar.get(p["id"], [])
        if not theme:
            missing.append(p["id"])
        tags[p["id"]] = list(dict.fromkeys(t))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged; without a theme or work: {missing}", file=sys.stderr)


if __name__ == "__main__":
    main()
