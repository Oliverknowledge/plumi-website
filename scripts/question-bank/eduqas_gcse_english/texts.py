"""The topics of the two Eduqas GCSE English banks.

English Literature (C720QS): as in aqa_english_lit/texts.py, a paper offers a question (or two) on every set
text and a student answers on the ones they studied, so the topics are the texts, under the specification's
sections. Each has a pattern that finds it in the heading printed over its question, in the paper and the scheme:
  - Component 1 Section A, Shakespeare: an extract question (N1) and an essay (N2) on each play. Twelfth
    Night replaced Henry V from June 2025.
  - Component 1 Section B, the Eduqas Poetry Anthology: one topic, the anthology (question 71 prints one of its
    eighteen poems; 72 compares it with another the student chooses).
  - Component 2 Section A, post-1914 prose or drama, and Section B, 19th-century prose: one question each,
    on an extract printed with it. Boys Don't Cry and Leave Taking replaced Never Let Me Go and A Taste of
    Honey from June 2025.
  - Component 2 Section C, unseen poetry: two poems, one topic.

English Language (C700QS): the topics are the question types, the same questions in the same places every
series, each assessing the objectives the specification gives it.
"""
import re

# (section code, section title, [(code, title, pattern)])
LIT = [
    ("shakespeare", "Shakespeare (Component 1 Section A)", [
        ("romeo-and-juliet", "Romeo and Juliet", r"^Romeo and Juliet$"),
        ("macbeth", "Macbeth", r"^Macbeth$"),
        ("othello", "Othello", r"^Othello$"),
        ("much-ado-about-nothing", "Much Ado About Nothing", r"^Much Ado About Nothing$"),
        ("henry-v", "Henry V (to 2024)", r"^(King )?Henry V$"),
        ("twelfth-night", "Twelfth Night (from 2025)", r"^Twelfth Night$"),
        ("the-merchant-of-venice", "The Merchant of Venice", r"^The Merchant of Venice$"),
    ]),
    ("anthology", "Poetry anthology (Component 1 Section B)", [
        ("poetry-anthology", "Eduqas Poetry Anthology", r"^$"),
    ]),
    ("modern", "Post-1914 prose and drama (Component 2 Section A)", [
        ("lord-of-the-flies", "Lord of the Flies", r"^Lord of the Flies$"),
        ("anita-and-me", "Anita and Me", r"^Anita and Me$"),
        ("never-let-me-go", "Never Let Me Go (to 2024)", r"^Never Let Me Go$"),
        ("boys-dont-cry", "Boys Don’t Cry (from 2025)", r"^Boys Don.t Cry$"),
        ("the-woman-in-black", "The Woman in Black", r"^The Woman in Black$"),
        ("oranges-are-not-the-only-fruit", "Oranges Are Not the Only Fruit", r"^Oranges are not the Only Fruit$"),
        ("curious-incident", "The Curious Incident of the Dog in the Night-Time", r"^The Curious Incident of the Dog in the Night.Time$"),
        ("a-taste-of-honey", "A Taste of Honey (to 2024)", r"^A Taste of Honey$"),
        ("leave-taking", "Leave Taking (from 2025)", r"^Leave Taking$"),
        ("an-inspector-calls", "An Inspector Calls", r"^An Inspector Calls$"),
        ("the-history-boys", "The History Boys", r"^The History Boys$"),
        ("blood-brothers", "Blood Brothers", r"^Blood Brothers$"),
    ]),
    ("novel", "19th-century prose (Component 2 Section B)", [
        ("a-christmas-carol", "A Christmas Carol", r"^A Christmas Carol$"),
        ("silas-marner", "Silas Marner", r"^Silas Marner$"),
        ("war-of-the-worlds", "The War of the Worlds", r"^(The )?War of the Worlds$"),
        ("pride-and-prejudice", "Pride and Prejudice", r"^Pride and Prejudice$"),
        ("jane-eyre", "Jane Eyre", r"^Jane Eyre$"),
        ("jekyll-and-hyde", "The Strange Case of Dr Jekyll and Mr Hyde", r"^The Strange Case of Dr\.? Jekyll and Mr\.? Hyde$"),
    ]),
    ("unseen", "Unseen poetry (Component 2 Section C)", [
        ("unseen-poetry", "Unseen poetry", r"^$"),
    ]),
]

# (section code, section title, [(code, title, pattern)]): the pattern is unused, kept for LIT's shape.
LANG = [
    ("c1-reading", "Component 1 Section A: Reading a 20th-century prose passage", [
        ("c1-q1", "Q01 Finding information (AO1, 5 marks)", ""),
        ("c1-q2", "Q02 Impressions (AO2, 5 marks)", ""),
        ("c1-q3", "Q03 How the writer uses language (AO2, 10 marks)", ""),
        ("c1-q4", "Q04 Language and structure (AO2, 10 marks)", ""),
        ("c1-q5", "Q05 Evaluating the passage (AO4, 10 marks)", ""),
    ]),
    ("c1-writing", "Component 1 Section B: Creative prose writing", [
        ("c1-writing", "Q11 Creative prose writing (AO5, AO6, 40 marks)", ""),
    ]),
    ("c2-reading", "Component 2 Section A: Reading 19th and 21st-century non-fiction", [
        ("c2-q1", "Q11 Finding information in the first text (AO1, 3 marks)", ""),
        ("c2-q2", "Q12 How the writer presents ideas (AO2, 10 marks)", ""),
        ("c2-q3", "Q13 Finding information in the second text (AO1, 3 marks)", ""),
        ("c2-q4", "Q14 Evaluating the second text (AO4, 10 marks)", ""),
        ("c2-q5", "Q15 Using both texts (AO1, 4 marks)", ""),
        ("c2-q6", "Q16 Comparing the two texts (AO3, 10 marks)", ""),
    ]),
    ("c2-writing", "Component 2 Section B: Transactional and persuasive writing", [
        ("c2-writing", "Q21 and Q22 Transactional and persuasive writing (AO5, AO6, 20 marks each)", ""),
    ]),
]


def flat():
    return [(sec, code, title, re.compile(pat)) for sec, _, ts in LIT for code, title, pat in ts]


def find(heading):
    """The code of the set text a heading names ("Romeo and Juliet", "The Strange Case of Dr Jekyll and Mr Hyde"), or None."""
    h = re.sub(r"\s+", " ", heading).replace("’", "'").strip()
    for sec, code, title, pat in flat():
        if pat.pattern != "^$" and pat.search(h):
            return code
    return None


def section_of(code):
    return next((sec for sec, c, _, _ in flat() if c == code), None)
