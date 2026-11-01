"""The set texts of Pearson Edexcel's GCSE English Literature (1ET0): the Literature bank's topics.

As in edexcel_english_lit/texts.py, a paper sets a question (or a pair) on each set text and a student
answers on the one they studied, so the topics are the texts, under the specification's components. Each has a
pattern that finds it in the heading printed over its questions ("Macbeth – from Act 5 Scene 8",
"Journey’s End: R C Sherriff", "Question 1 − Jane Eyre", "Relationships"). The poetry anthology's collections
are topics of their own, and Paper 2's unseen poems, printed under no text's heading, are one more.
"""
import re

# (section code, section title, [(code, title, pattern)])
SPEC = [
    ("shakespeare", "Shakespeare (Paper 1 Section A)", [
        ("macbeth", "Macbeth", r"^Macbeth\b"),
        ("the-tempest", "The Tempest", r"^The Tempest\b"),
        ("romeo-and-juliet", "Romeo and Juliet", r"^Romeo and Juliet\b"),
        ("much-ado-about-nothing", "Much Ado About Nothing", r"^Much Ado About Nothing\b"),
        ("twelfth-night", "Twelfth Night", r"^Twelfth Night\b"),
        ("the-merchant-of-venice", "The Merchant of Venice", r"^The Merchant of Venice\b"),
    ]),
    ("play", "Post-1914 British play (Paper 1 Section B)", [
        ("an-inspector-calls", "An Inspector Calls", r"^An Inspector Calls\b"),
        ("hobsons-choice", "Hobson’s Choice", r"^Hobson.s Choice\b"),
        ("blood-brothers", "Blood Brothers", r"^Blood Brothers\b"),
        ("journeys-end", "Journey’s End", r"^Journey.s End\b"),
        ("the-empress", "The Empress", r"^The Empress\b"),
        ("refugee-boy", "Refugee Boy", r"^Refugee Boy\b"),
    ]),
    ("novel-1914", "Post-1914 British novel (Paper 1 Section B)", [
        ("animal-farm", "Animal Farm", r"^Animal Farm\b"),
        ("lord-of-the-flies", "Lord of the Flies", r"^Lord of the Flies\b"),
        ("anita-and-me", "Anita and Me", r"^Anita and Me\b"),
        ("the-woman-in-black", "The Woman in Black", r"^The Woman in Black\b"),
        ("coram-boy", "Coram Boy", r"^Coram Boy\b"),
        ("boys-dont-cry", "Boys Don’t Cry", r"^Boys Don.t Cry\b"),
    ]),
    ("novel-19th", "19th-century novel (Paper 2 Section A)", [
        ("jane-eyre", "Jane Eyre", r"^Jane Eyre\b"),
        ("great-expectations", "Great Expectations", r"^Great Expectations\b"),
        ("jekyll-and-hyde", "Dr Jekyll and Mr Hyde", r"^(The Strange Case of )?Dr\.? Jekyll and Mr\.? Hyde\b"),
        ("a-christmas-carol", "A Christmas Carol", r"^A Christmas Carol\b"),
        ("pride-and-prejudice", "Pride and Prejudice", r"^Pride and Prejudice\b"),
        ("silas-marner", "Silas Marner", r"^Silas Marner\b"),
        ("frankenstein", "Frankenstein", r"^Frankenstein\b"),
    ]),
    ("poetry", "Poetry since 1789 (Paper 2 Section B)", [
        ("relationships", "Poetry anthology: Relationships", r"^Relationships$"),
        ("conflict", "Poetry anthology: Conflict", r"^Conflict$"),
        ("time-and-place", "Poetry anthology: Time and Place", r"^Time and Place$"),
        ("belonging", "Poetry anthology: Belonging", r"^Belonging$"),
        ("unseen-poetry", "Unseen poetry", r"^Unseen Poetry$"),
    ]),
]


def flat():
    return [(sec, code, title, re.compile(pat)) for sec, _, ts in SPEC for code, title, pat in ts]


def find(heading):
    """The code of the text a heading names, or None. "Question 1 − Jane Eyre" names Jane Eyre."""
    h = re.sub(r"\s+", " ", heading.replace("’", "'").replace("‘", "'")).strip()
    h = re.sub(r"^Questions? \d{1,2}(\s*(and|&|or|OR)\s*\d{1,2})?\s*[−–-]\s*", "", h)
    for sec, code, title, pat in flat():
        if pat.search(h):
            return code
    return None
