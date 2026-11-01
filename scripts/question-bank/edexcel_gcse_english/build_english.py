"""Write the Pearson Edexcel GCSE English Language and English Literature banks' data files from the cut questions.

    python3 scripts/question-bank/edexcel_gcse_english/build_english.py lang   # .work/edexcel-gcse-english-lang -> edexcel-gcse-english-language
    python3 scripts/question-bank/edexcel_gcse_english/build_english.py lit    # .work/edexcel-gcse-english-lit -> edexcel-gcse-english-literature

edexcel_english_lit/build_english_lit.py's build() writes them, in the same shapes as the A-Level's
(src/content/questionBank/<slug>.json and public/question-bank/<slug>/{parts,text,reports}.json):
  - Literature's topics are the set texts, the anthology's collections and the unseen poems (texts.py), each
    question tagged to the one the cutter read from its heading. Every question in a section after its first is
    an alternative, so a paper's marks count what a student answers (80).
  - Language's topics are the paper's questions, the same task in the same place every series (texts below):
    each question is tagged to its number on its paper, the two writing tasks to one topic. The second writing
    task is the alternative. A paper's sources are its insert, which `wholes` carries as "ins".
The whole papers the banks link to are the past paper library's names on R2 (edexcel/EDX-1ET0-01-QP-JUN24.pdf),
so the bank's upload is its crops plus those PDFs.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_english_lit"))
import build_english_lit as edexcel_lit  # noqa: E402

spec = importlib.util.spec_from_file_location("gcse_texts", os.path.join(HERE, "texts.py"))  # (not the A-Level's texts.py)
texts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(texts)

LIT = len(sys.argv) > 1 and sys.argv[1] == "lit"
WORK = os.path.join(HERE, "..", ".work", "edexcel-gcse-english-lit" if LIT else "edexcel-gcse-english-lang")

LIT_PAPERS = {"1et001": ("Paper 1", "Shakespeare and Post-1914 Literature"),
              "1et002": ("Paper 2", "19th-century Novel and Poetry since 1789"),
              "1et02n": ("Paper 2N", "19th-century Novel"), "1et02p": ("Paper 2P", "Poetry since 1789")}
LIT_NOTE = ("Pearson publishes these papers from the first exams in June 2017 to June 2025, with November 2020 and 2021 sat in "
            "place of the cancelled summers (in November 2021 and June 2022 Paper 2 was sat as two papers, 2N and 2P). Each "
            "paper asks about every set text, so the topics here are the texts and the anthology's collections: pick the ones "
            "you studied. Extract questions show their extract, and the anthology and unseen questions their poems.")

LANG_PAPERS = {"1en001": ("Paper 1", "Fiction and Imaginative Writing"),
               "1en002": ("Paper 2", "Non-fiction and Transactional Writing")}
# (section code, title, [(topic code, title, (paper, questions))]): each topic is a question's place on its paper.
LANG_SPEC = [
    ("p1-reading", "Paper 1 Section A: Reading a 19th-century fiction extract", [
        ("paper-1-question-1-identify", "Question 1: Identify from the opening lines", ("1en001", ["1"])),
        ("paper-1-question-2-short-answer", "Question 2: Two points from a short extract", ("1en001", ["2"])),
        ("paper-1-question-3-language-and-structure", "Question 3: Language and structure (AO2)", ("1en001", ["3"])),
        ("paper-1-question-4-evaluate", "Question 4: Evaluate the extract (AO4)", ("1en001", ["4"])),
    ]),
    ("p1-writing", "Paper 1 Section B: Imaginative writing", [
        ("paper-1-imaginative-writing", "Questions 5 and 6: Imaginative writing (AO5, AO6)", ("1en001", ["5", "6"])),
    ]),
    ("p2-reading", "Paper 2 Section A: Reading two non-fiction texts", [
        ("paper-2-question-1-identify", "Question 1: Identify from Text 1", ("1en002", ["1"])),
        ("paper-2-question-2-short-answer", "Question 2: A short answer on Text 1", ("1en002", ["2"])),
        ("paper-2-question-3-language-and-structure", "Question 3: Language and structure in Text 1 (AO2)", ("1en002", ["3"])),
        ("paper-2-question-4-identify", "Question 4: Identify from Text 2", ("1en002", ["4"])),
        ("paper-2-question-5-short-answer", "Question 5: A short answer on Text 2", ("1en002", ["5"])),
        ("paper-2-question-6-evaluate", "Question 6: Evaluate Text 2 (AO4)", ("1en002", ["6"])),
        ("paper-2-question-7a-synthesis", "Question 7(a): Similarities across both texts (AO1)", ("1en002", ["7(a)"])),
        ("paper-2-question-7b-compare", "Question 7(b): Compare the writers' ideas and perspectives (AO3)", ("1en002", ["7(b)"])),
    ]),
    ("p2-writing", "Paper 2 Section B: Transactional writing", [
        ("paper-2-transactional-writing", "Questions 8 and 9: Transactional writing (AO5, AO6)", ("1en002", ["8", "9"])),
    ]),
]
LANG_NOTE = ("Pearson publishes these papers from the first exams in June 2017 to June 2025, June and November (no June sittings in 2020 and 2021). Each paper's texts are printed in "
             "its source booklet: open it from any reading question. The topics are the paper's questions, the same task in "
             "the same place every series, and Section B's two writing tasks are a choice: answer one.")


def tag_language(parts):
    """Each Language question's topic and whether it is the alternative writing task."""
    where = {(paper, label): code for _, _, ts in LANG_SPEC for code, _, (paper, labels) in ts for label in labels}
    for p in parts:
        p["text_code"] = where.get((p["component"].replace("-", ""), p["label"]))
        p["or"] = (p["component"].replace("-", ""), p["label"]) in (("1en001", "6"), ("1en002", "9"))
    return parts


def main():
    if LIT:
        edexcel_lit.build("edexcel-gcse-english-literature", "Edexcel", "English Literature", ["1ET0"], texts.SPEC, LIT_PAPERS, LIT_NOTE,
                          WORK, lambda c: False, {"level": "GCSE"})
        return
    path = os.path.join(WORK, "parts.json")
    parts = tag_language(json.load(open(path)))
    untagged = [p["id"] for p in parts if not p["text_code"]]
    assert not untagged, f"untagged: {untagged}"
    json.dump(parts, open(path, "w"), ensure_ascii=False)
    spec = [(sec, title, [(code, t, None) for code, t, _ in ts]) for sec, title, ts in LANG_SPEC]
    edexcel_lit.build("edexcel-gcse-english-language", "Edexcel", "English Language", ["1EN0"], spec, LANG_PAPERS, LANG_NOTE,
                      WORK, lambda c: False, {"level": "GCSE"})


if __name__ == "__main__":
    main()
