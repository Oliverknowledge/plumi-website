"""The set texts of Eduqas's A Level English Literature (A720QS): the bank's topics.

As in edexcel_english_lit/texts.py, a paper offers a question (or two) on every set text and a
student answers on the ones they studied, so the topics are the texts, under the specification's
components. Each has a pattern that finds it in the heading printed over its question:
  - Component 1 Section A, one pre-1900 poetry text ("John Donne: Selected Poems (Penguin Classics)");
  - Component 1 Section B and Component 2 Section B, a prescribed pair, printed as two headings
    ("Thomas Hardy: Poems selected by Tom Paulin (Faber)" over "T. S. Eliot: Selected Poems (Faber)"):
    the pattern finds the pair's first line;
  - Component 2 Section A, one Shakespeare play ("King Lear");
  - Component 3, no set text: Section A's two questions are an unseen prose passage from 1880-1910
    and one from 1918-1939 (a student prepares one period), Section B's two an unseen poem.
The specification's amendment of 2022: Blake replaced Keats, and Yeats and Abse replaced Lawrence and
Clarke, from summer 2022 (June 2022 still set both, for resitting candidates).
"""
import re

# (section code, section title, [(code, title, pattern)])
SPEC = [
    ("poetry-pre-1900", "Poetry pre-1900 (Component 1 Section A)", [
        ("chaucer", "Geoffrey Chaucer: The Merchant’s Prologue and Tale", r"Merchant.s Prologue"),
        ("donne", "John Donne: Selected Poems", r"^John Donne\b"),
        ("milton", "John Milton: Paradise Lost Book IX", r"Paradise Lost"),
        ("keats", "John Keats: Selected Poems (to 2022)", r"^John Keats\b"),
        ("blake", "William Blake: Poems selected by Patti Smith (from 2022)", r"^William Blake\b"),
        ("rossetti", "Christina Rossetti: Selected Poems", r"^Christina Rossetti\b"),
    ]),
    ("poetry-post-1900", "Poetry post-1900, a pair of poets (Component 1 Section B)", [
        ("hardy-eliot", "Thomas Hardy and T. S. Eliot", r"^Thomas Hardy\b"),
        ("lawrence-clarke", "D. H. Lawrence and Gillian Clarke (to 2022)", r"^D\.? ?H\.? Lawrence\b"),
        ("yeats-abse", "W. B. Yeats and Dannie Abse (from 2022)", r"^W\. ?B\. Yeats\b"),
        ("hughes-plath", "Ted Hughes and Sylvia Plath", r"^Ted Hughes\b"),
        ("larkin-duffy", "Philip Larkin and Carol Ann Duffy", r"^Philip Larkin\b"),
        ("heaney-sheers", "Seamus Heaney and Owen Sheers", r"^Seamus Heaney\b"),
    ]),
    ("shakespeare", "Shakespeare (Component 2 Section A)", [
        ("king-lear", "Shakespeare: King Lear", r"^King Lear$"),
        ("antony-and-cleopatra", "Shakespeare: Antony and Cleopatra", r"^Antony and Cleopatra$"),
        ("hamlet", "Shakespeare: Hamlet", r"^Hamlet$"),
        ("henry-iv-part-1", "Shakespeare: King Henry IV Part 1", r"^(King )?Henry IV Part 1$"),
        ("the-tempest", "Shakespeare: The Tempest", r"^The Tempest$"),
    ]),
    ("drama", "Drama, a pre-1900 and a post-1900 play (Component 2 Section B)", [
        ("faustus-enron", "Marlowe: Doctor Faustus and Prebble: Enron", r"Doctor Faustus"),
        ("malfi-streetcar", "Webster: The Duchess of Malfi and Williams: A Streetcar Named Desire", r"Duchess of Malfi"),
        ("revengers-tragedy-loot", "Middleton: The Revenger’s Tragedy and Orton: Loot", r"Revenger.s Tragedy"),
        ("windermere-betrayal", "Wilde: Lady Windermere’s Fan and Pinter: Betrayal", r"Windermere"),
        ("measure-murmuring-judges", "Shakespeare: Measure for Measure and Hare: Murmuring Judges", r"Measure for Measure|Murmuring Judges"),
    ]),
    ("unseen", "Unseen texts (Component 3)", [
        ("prose-1880-1910", "Unseen prose: 1880 to 1910", r"^Period 1880"),
        ("prose-1918-1939", "Unseen prose: 1918 to 1939", r"^Period 19(18|19)"),
        ("unseen-poetry", "Unseen poetry", r"^$"),
    ]),
]


def flat():
    return [(sec, code, title, re.compile(pat)) for sec, _, ts in SPEC for code, title, pat in ts]


def find(heading):
    """The code of the text a heading names, or None."""
    h = re.sub(r"\s+", " ", heading).strip()
    for sec, code, title, pat in flat():
        if pat.pattern != "^$" and pat.search(h):
            return code
    return None


def section_of(code):
    return next((sec for sec, c, _, _ in flat() if c == code), None)
