"""The set texts of Pearson Edexcel's A-Level (9ET0) and AS (8ET0) English Literature: the bank's topics.

As in aqa_english_lit/texts.py, a paper offers a pair of questions on each set text (or prose theme,
or poetry collection) and a student answers on the one they studied, so the topics are the texts,
under the specification's components. Each has a pattern that finds it in the heading printed over
its questions ("Antony and Cleopatra", "Doctor Faustus, Christopher Marlowe", "Childhood",
"Metaphysical Poet: John Donne"). The poets' own collections come before the movements they belong
to, so "Romantic Poet: John Keats" is Keats's and "The Romantics" the anthology's. Only texts Pearson
has set a question on since 2016 are listed.
"""
import re

# (section code, section title, [(code, title, pattern)])
SPEC = [
    ("shakespeare", "Drama: Shakespeare (Paper 1 Section A)", [
        ("antony-and-cleopatra", "Antony and Cleopatra", r"Antony and Cleopatra"),
        ("hamlet", "Hamlet", r"^Hamlet\b"),
        ("king-lear", "King Lear", r"^King Lear\b"),
        ("othello", "Othello", r"^Othello\b"),
        ("a-midsummer-nights-dream", "A Midsummer Night’s Dream", r"Midsummer Night"),
        ("measure-for-measure", "Measure for Measure", r"^Measure for Measure\b"),
        ("the-taming-of-the-shrew", "The Taming of the Shrew", r"Taming of the Shrew"),
        ("twelfth-night", "Twelfth Night", r"^Twelfth Night\b"),
    ]),
    ("drama", "Drama: other drama (Paper 1 Section B, AS Paper 1 Section B)", [
        ("doctor-faustus", "Doctor Faustus", r"Doctor Faustus"),
        ("the-duchess-of-malfi", "The Duchess of Malfi", r"Duchess of Malfi"),
        ("a-streetcar-named-desire", "A Streetcar Named Desire", r"Streetcar Named Desire"),
        ("les-blancs", "Les Blancs", r"Les Blancs"),
        ("the-home-place", "The Home Place", r"Home Place"),
        ("the-importance-of-being-earnest", "The Importance of Being Earnest", r"Importance of Being Earnest"),
        ("the-rover", "The Rover", r"^The Rover\b"),
        ("waiting-for-godot", "Waiting for Godot", r"Waiting for Godot"),
        ("sweat", "Sweat", r"^Sweat\b"),
        ("the-pitmen-painters", "The Pitmen Painters", r"Pitmen Painters"),
    ]),
    ("prose", "Prose: comparing two texts on a theme (Paper 2, AS Paper 2)", [
        ("childhood", "Childhood", r"^Childhood$"),
        ("colonisation-and-its-aftermath", "Colonisation and its Aftermath", r"^Colonisation and its Aftermath$"),
        ("crime-and-detection", "Crime and Detection", r"^Crime and Detection$"),
        ("science-and-society", "Science and Society", r"^Science and Society$"),
        ("the-supernatural", "The Supernatural", r"^The Supernatural$"),
        ("women-and-society", "Women and Society", r"^Women and Society$"),
    ]),
    ("poetry", "Poetry (Paper 3, AS Paper 1 Section A)", [
        ("poems-of-the-decade", "Poems of the Decade (post-2000 poetry)", r"^$"),
        ("medieval-poetic-drama", "Medieval Poetic Drama", r"^Medieval Poetic Drama$"),
        ("chaucer", "Geoffrey Chaucer: The Wife of Bath’s Prologue and Tale", r"Geoffrey Chaucer"),
        ("donne", "John Donne", r"Poet: John Donne"),
        ("metaphysical-poets", "The Metaphysical Poets", r"Metaphysical Poets$"),
        ("keats", "John Keats", r"Poet: John Keats"),
        ("the-romantics", "The Romantics", r"^The Romantics$"),
        ("rossetti", "Christina Rossetti", r"Poet: Christina Rossetti"),
        ("the-victorians", "The Victorians", r"^The Victorians$"),
        ("eliot", "T S Eliot", r"Poet: T ?S Eliot"),
        ("modernism", "Modernism", r"^Modernism$"),
        ("larkin", "Philip Larkin", r"Poet: Philip Larkin"),
        ("the-movement", "The Movement", r"^The Movement$"),
    ]),
]
# The questions printed under no text's heading: the post-2000 poetry of Paper 3 Section A and AS Paper 1 Section A.
UNHEADED = {("9et0-03", "A"): "poems-of-the-decade", ("8et0-01", "A"): "poems-of-the-decade"}


def flat():
    return [(sec, code, title, re.compile(pat)) for sec, _, ts in SPEC for code, title, pat in ts]


def find(heading):
    """The code of the text a heading names, or None."""
    h = re.sub(r"\s+", " ", heading.replace("‑", "-")).strip()
    for sec, code, title, pat in flat():
        if pat.pattern != "^$" and pat.search(h):
            return code
    return None
