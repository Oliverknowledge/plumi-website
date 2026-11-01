"""Write the AQA GCSE or A-Level English Language bank's data files from the cut questions.

    python3 scripts/question-bank/aqa_english_lang/build_english_lang.py [work-dir]             # default scripts/question-bank/.work/aqa-english-lang
    python3 scripts/question-bank/aqa_english_lang/build_english_lang.py --level=a [work-dir]   # A-Level 7702, default .work/aqa-english-lang-a

build_english_lit.py for Language: the same rows and files
(src/content/questionBank/aqa-gcse-english-language.json and
public/question-bank/aqa-gcse-english-language/{parts,text,reports}.json). What differs:
  - The topics are the question types, one for each of a paper's five questions, under the paper's
    two sections: each is the same question every series, assessing the same objectives (AO1-AO6).
    Each question's tag is its number on its paper: no tagging pass.
  - Every question is whole ("03"), and the reports are keyed by question id (reportsBy "question").
  - A paper's sources are printed in its insert, which `wholes` carries as "ins": each question links to it.
  - At A-Level (cut_english_lang_a.py) a section of choices marks its second question "or" (Paper 1's 05,
    Paper 2's 02), and a section on the insert's texts shares a stem (`st`): what each text is, and the texts.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
A_LEVEL = "--level=a" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-english-lang-a" if A_LEVEL else "aqa-english-lang")
SLUG, LEVEL, SPECS = "aqa-gcse-english-language", "GCSE", ["8700"]
PAPERS = {"87001": ("Paper 1", "Explorations in creative reading and writing"), "87002": ("Paper 2", "Writers’ viewpoints and perspectives")}
# (section code, title, [(topic code, ref, title, slug)]): the specification's sections and question types.
SPEC = [
    ("p1-reading", "Paper 1 Section A: Reading a literature fiction source", [
        ("p1-q1", "Q1", "Listing information (AO1)", "paper-1-question-1-list-four-things"),
        ("p1-q2", "Q2", "Language analysis (AO2)", "paper-1-question-2-language"),
        ("p1-q3", "Q3", "Structure (AO2)", "paper-1-question-3-structure"),
        ("p1-q4", "Q4", "Evaluating a statement (AO4)", "paper-1-question-4-evaluation"),
    ]),
    ("p1-writing", "Paper 1 Section B: Descriptive or narrative writing", [
        ("p1-q5", "Q5", "Descriptive or narrative writing (AO5, AO6)", "paper-1-question-5-creative-writing"),
    ]),
    ("p2-reading", "Paper 2 Section A: Reading two non-fiction sources", [
        ("p2-q1", "Q1", "True statements (AO1)", "paper-2-question-1-true-statements"),
        ("p2-q2", "Q2", "Summary of differences (AO1)", "paper-2-question-2-summary"),
        ("p2-q3", "Q3", "Language analysis (AO2)", "paper-2-question-3-language"),
        ("p2-q4", "Q4", "Comparing writers' perspectives (AO3)", "paper-2-question-4-comparison"),
    ]),
    ("p2-writing", "Paper 2 Section B: Writing to present a viewpoint", [
        ("p2-q5", "Q5", "Writing a viewpoint (AO5, AO6)", "paper-2-question-5-viewpoint-writing"),
    ]),
]
NOTE = ("AQA publishes its English Language papers from November 2020 on, with each paper's sources in a separate insert: "
        "open it from any question. Where AQA has removed a paper's source for copyright (Paper 1 in June 2022 and "
        "November 2022, 2023 and 2025, Paper 2 in November 2025), only its writing question is here, and AQA hasn't "
        "published Paper 2 for November 2023.")
MAXIMUM = 80
if A_LEVEL:
    SLUG, LEVEL, SPECS, MAXIMUM = "aqa-a-level-english-language", "A-Level", ["7702"], 100
    PAPERS = {"77021": ("Paper 1", "Language, the individual and society"), "77022": ("Paper 2", "Language diversity and change")}
    SPEC = [
        ("p1-texts", "Paper 1 Section A: Textual variations and representations", [
            ("p1-q1", "Q1", "Analysing Text A: meanings and representations (AO1, AO3)", "paper-1-question-1-text-a"),
            ("p1-q2", "Q2", "Analysing Text B: meanings and representations (AO1, AO3)", "paper-1-question-2-text-b"),
            ("p1-q3", "Q3", "Comparing Text A and Text B (AO4)", "paper-1-question-3-comparing-texts"),
        ]),
        ("p1-children", "Paper 1 Section B: Children's language development", [
            ("p1-q4", "Q4", "Spoken language development (AO1, AO2)", "paper-1-question-4-spoken-language"),
            ("p1-q5", "Q5", "Literacy development (AO1, AO2)", "paper-1-question-5-literacy"),
        ]),
        ("p2-diversity", "Paper 2 Section A: Diversity and change", [
            ("p2-q1", "Q1", "Language diversity essay (AO1, AO2)", "paper-2-question-1-diversity"),
            ("p2-q2", "Q2", "Language change essay (AO1, AO2)", "paper-2-question-2-change"),
        ]),
        ("p2-discourses", "Paper 2 Section B: Language discourses", [
            ("p2-q3", "Q3", "Analysing two texts' views on language (AO1, AO3, AO4)", "paper-2-question-3-language-discourses"),
            ("p2-q4", "Q4", "Writing an opinion article (AO2, AO5)", "paper-2-question-4-opinion-article"),
        ]),
    ]
    NOTE = ("AQA publishes its A-Level English Language papers from November 2020 on; the NEA (coursework) has no paper. "
            "The texts a question analyses are printed in the paper's insert: open it from the question, or show how the question "
            "starts to read them here. The child language data is printed with its question. Where AQA has removed a text for "
            "copyright, the questions on it aren't here (Paper 1: June 2022 Text B, June 2024 Text A; Paper 2: November 2020 "
            "Text B, June 2022 both texts, June 2023 Text A).")



def own_words(text, label):
    """The question's own words: after its label, before its marks."""
    m = re.search(r"(?<!\d)" + r"\s*".join(list(label)) + r"\s+", text)
    words = text[m.end():] if m else text
    return BOILERPLATE.sub(" ", re.split(r"\[\d+ marks?\]", words)[0]).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er", "ins") and f["series"] in series_cut and f["component"] in PAPERS:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_words(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [p["text_code"]],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("or"):
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    order = list(PAPERS)
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), r["l"]))
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v not in (MAXIMUM, 40)}  # GCSE 40: the writing question alone
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    sections = [{"code": code, "title": title} for code, title, _ in SPEC]
    topics = [{"code": code, "ref": ref, "title": title, "section": sec, "slug": slug, "count": counts.get(code, 0), "year": 0}
              for sec, _, ts in SPEC for code, ref, title, slug in ts]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = [c for c in order if any(r["p"] == c for r in rows)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": LEVEL, "subject": "English Language", "specs": SPECS,
        "sections": sections, "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items())},
        "noCalc": True, "reportsBy": "question",
        "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    empty = [t["code"] for t in topics if not t["count"]]
    print(f"{SLUG}: {len(rows)} questions, {len(reports)} reports, papers {comps}, series {series}"
          + (f"; marks off: {off}" if off else "; every paper's marks add up") + (f"; empty topics {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
