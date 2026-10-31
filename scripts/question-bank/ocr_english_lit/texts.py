"""The set texts of OCR's A-Level (H472) and AS (H072) English Literature: the bank's topics.

As in aqa_english_lit/texts.py, a paper offers a question on each set text and a student answers on the
ones they studied, so the topics are the texts. Each has a pattern that finds it in the heading printed
with its question ("Coriolanus", "Geoffrey Chaucer: The Merchant's Prologue and Tale", "(a) F Scott
Fitzgerald: The Great Gatsby"). Component 2 (H472/02) is sat on one of five topics, each with an unseen
passage to appreciate and an essay comparing two of its texts, led by one of two core texts or by none
(the "(c)" question): those are the topics' own entries. The AS prose texts are the A-Level topics' core
texts, and the AS poetry texts the A-Level's pre-1900 poetry, so they share their topics.
"""
import re

# (section code, section title, [(code, title, pattern)])
SPEC = [
    ("shakespeare", "Shakespeare (H472/01 and H072/01 Section 1)", [
        ("coriolanus", "Coriolanus", r"^Coriolanus$"),
        ("hamlet", "Hamlet", r"^Hamlet$"),
        ("measure-for-measure", "Measure for Measure", r"^Measure for Measure$"),
        ("richard-iii", "Richard III", r"^Richard III$"),
        ("the-tempest", "The Tempest", r"^The Tempest$"),
        ("twelfth-night", "Twelfth Night", r"^Twelfth Night$"),
    ]),
    ("pre-1900", "Drama and poetry pre-1900 (H472/01 Section 2, H072/01 Section 2)", [
        ("drama-and-poetry-pre-1900", "Comparing a drama and a poetry text (A-Level)", r"^$"),
        ("chaucer", "Chaucer: The Merchant’s Prologue and Tale (AS)", r"Chaucer"),
        ("milton", "Milton: Paradise Lost Books 9 and 10 (AS)", r"Milton"),
        ("coleridge", "Coleridge: Selected Poems (AS)", r"Coleridge"),
        ("tennyson", "Tennyson: Maud (AS)", r"Tennyson"),
        ("rossetti", "Christina Rossetti: Selected Poems (AS)", r"Rossetti"),
    ]),
    ("drama", "Drama post-1900 (H072/02 Section 1, AS)", [
        ("private-lives", "Private Lives", r"Private Lives"),
        ("a-streetcar-named-desire", "A Streetcar Named Desire", r"Streetcar Named Desire"),
        ("the-homecoming", "The Homecoming", r"The Homecoming"),
        ("the-history-boys", "The History Boys", r"History Boys"),
        ("that-face", "That Face", r"That Face"),
        ("jerusalem", "Jerusalem", r"Jerusalem"),
    ]),
    ("american", "American Literature 1880–1940 (H472/02)", [
        ("american-unseen", "Unseen passage: American Literature", r"^$"),
        ("the-great-gatsby", "The Great Gatsby", r"Great Gatsby"),
        ("the-grapes-of-wrath", "The Grapes of Wrath", r"Grapes of Wrath"),
        ("american-comparison", "Comparing two texts: American Literature", r"^$"),
    ]),
    ("gothic", "The Gothic (H472/02)", [
        ("gothic-unseen", "Unseen passage: the Gothic", r"^$"),
        ("dracula", "Dracula", r"Dracula"),
        ("the-bloody-chamber", "The Bloody Chamber and Other Stories", r"Bloody Chamber"),
        ("gothic-comparison", "Comparing two texts: the Gothic", r"^$"),
    ]),
    ("dystopia", "Dystopia (H472/02)", [
        ("dystopia-unseen", "Unseen passage: Dystopia", r"^$"),
        ("nineteen-eighty-four", "Nineteen Eighty-Four", r"Nineteen Eighty.Four"),
        ("the-handmaids-tale", "The Handmaid’s Tale", r"Handmaid"),
        ("dystopia-comparison", "Comparing two texts: Dystopia", r"^$"),
    ]),
    ("women", "Women in Literature (H472/02)", [
        ("women-unseen", "Unseen passage: Women in Literature", r"^$"),
        ("sense-and-sensibility", "Sense and Sensibility", r"Sense and Sensibility"),
        ("mrs-dalloway", "Mrs Dalloway", r"Mrs Dalloway"),
        ("women-comparison", "Comparing two texts: Women in Literature", r"^$"),
    ]),
    ("immigrant", "The Immigrant Experience (H472/02)", [
        ("immigrant-unseen", "Unseen passage: the Immigrant Experience", r"^$"),
        ("the-reluctant-fundamentalist", "The Reluctant Fundamentalist", r"Reluctant Fundamentalist"),
        ("call-it-sleep", "Call It Sleep", r"Call [Ii]t Sleep"),
        ("immigrant-comparison", "Comparing two texts: the Immigrant Experience", r"^$"),
    ]),
]
# The headings over H472/02's topics, and each topic's section.
AREAS = {"American Literature 1880–1940": "american", "The Gothic": "gothic", "Dystopia": "dystopia",
         "Women in Literature": "women", "The Immigrant Experience": "immigrant"}


def flat():
    return [(sec, code, title, re.compile(pat, re.I)) for sec, _, ts in SPEC for code, title, pat in ts]  # "CORIOLANUS" in June 2025


def find(heading):
    """The code of the text a heading names, or None."""
    h = re.sub(r"\s+", " ", (heading or "").replace("‑", "-")).strip()
    for sec, code, title, pat in flat():
        if pat.pattern != "^$" and pat.search(h):
            return code
    return None


def area(line):
    """The H472/02 topic a heading names ("American Literature 1880–1940"), or None."""
    t = re.sub(r"\s+", " ", line.replace("‑", "-")).strip()
    return next((code for name, code in AREAS.items() if t == name), None)
