"""The set texts of AQA's English Literature specifications: the bank's topics.

A Literature paper offers one question (or two) on each set text, and a student
answers only on the texts they studied, so the bank's topics are the texts, under
the specification's sections. Each text has a pattern that finds it in a paper's
or a mark scheme's heading ("Charles Dickens: A Christmas Carol", "Macbeth",
"Love and relationships"). Only texts AQA has set a question on since 2020 are
listed: a text with no questions would be an empty tile.
"""
import re

# GCSE 8702: (section code, section title, [(code, title, pattern)]).
GCSE = [
    ("shakespeare", "Shakespeare", [
        ("macbeth", "Macbeth", r"\bMacbeth\b"),
        ("romeo-and-juliet", "Romeo and Juliet", r"Romeo and Juliet"),
        ("the-tempest", "The Tempest", r"The Tempest"),
        ("the-merchant-of-venice", "The Merchant of Venice", r"Merchant of Venice"),
        ("much-ado-about-nothing", "Much Ado About Nothing", r"Much Ado"),
        ("julius-caesar", "Julius Caesar", r"Julius Caesar"),
    ]),
    ("novel", "The 19th-century novel", [
        ("jekyll-and-hyde", "The Strange Case of Dr Jekyll and Mr Hyde", r"Jekyll"),
        ("a-christmas-carol", "A Christmas Carol", r"Christmas Carol"),
        ("great-expectations", "Great Expectations", r"Great Expectations"),
        ("jane-eyre", "Jane Eyre", r"Jane Eyre"),
        ("frankenstein", "Frankenstein", r"Frankenstein"),
        ("pride-and-prejudice", "Pride and Prejudice", r"Pride and Prejudice"),
        ("the-sign-of-four", "The Sign of Four", r"Sign of Four"),
    ]),
    ("modern", "Modern prose or drama", [
        ("an-inspector-calls", "An Inspector Calls", r"Inspector Calls"),
        ("blood-brothers", "Blood Brothers", r"Blood Brothers"),
        ("the-history-boys", "The History Boys", r"History Boys"),
        ("dna", "DNA", r"\bDNA\b"),
        ("curious-incident", "The Curious Incident of the Dog in the Night-Time", r"Curious Incident"),
        ("a-taste-of-honey", "A Taste of Honey", r"Taste of Honey"),
        ("princess-and-the-hustler", "Princess & The Hustler", r"Princess (&|and) The Hustler"),
        ("leave-taking", "Leave Taking", r"Leave Taking"),
        ("lord-of-the-flies", "Lord of the Flies", r"Lord of the Flies"),
        ("telling-tales", "Telling Tales (AQA Anthology)", r"Telling Tales"),
        ("animal-farm", "Animal Farm", r"Animal Farm"),
        ("never-let-me-go", "Never Let Me Go", r"Never Let Me Go"),
        ("anita-and-me", "Anita and Me", r"Anita and Me"),
        ("pigeon-english", "Pigeon English", r"Pigeon English"),
        ("my-name-is-leon", "My Name Is Leon", r"My Name Is Leon"),
    ]),
    ("anthology", "Poetry anthology", [
        ("love-and-relationships", "Love and relationships", r"Love and relationships"),
        ("power-and-conflict", "Power and conflict", r"Power and conflict"),
        ("worlds-and-lives", "Worlds and lives", r"Worlds and lives"),
    ]),
    ("unseen", "Unseen poetry", [
        ("unseen-poetry", "Unseen poetry", r"Unseen poetry"),
    ]),
]


# A-Level 7712 and AS 7711 (Specification A). Paper 1 (and AS) is Love through the ages; Paper 2A
# and 2B each offer three options, a poetry, drama or prose set text, and a Section B that links an
# unseen prose extract to two other texts. That section's heading names no text ("Drama and Prose
# Contextual Linking"), so it is read as WW1's, and as Modern times' on Paper 2B (for_component).
A_LEVEL = [
    ("love", "Love through the ages", [
        ("othello", "Othello", r"\bOthello\b"),
        ("the-taming-of-the-shrew", "The Taming of the Shrew", r"Taming of the Shrew"),
        ("measure-for-measure", "Measure for Measure", r"Measure for Measure"),
        ("the-winters-tale", "The Winter’s Tale", r"Winter.s Tale"),
        ("love-poetry-pre-1900", "AQA Anthology of love poetry: pre-1900 (AS)", r"love poetry through the ages pre-1900"),
        ("love-poetry-post-1900", "AQA Anthology of love poetry: post-1900 (AS)", r"love poetry through the ages post-1900"),
        ("unseen-poetry", "Unseen poetry", r"Unseen Poetry"),
        ("unseen-prose", "Unseen prose (AS)", r"Unseen prose"),
        ("comparing-texts", "Comparing texts", r"Comparing (prose )?texts"),
    ]),
    ("ww1", "WW1 and its aftermath (Paper 2A)", [
        ("up-the-line-to-death", "Up the Line to Death", r"Up the Line to Death"),
        ("scars-upon-my-heart", "Scars Upon My Heart", r"Scars Upon My Heart"),
        ("oh-what-a-lovely-war", "Oh! What a Lovely War", r"Lovely War"),
        ("journeys-end", "Journey’s End", r"Journey.s End"),
        ("regeneration", "Regeneration", r"\bRegeneration\b"),
        ("birdsong", "Birdsong", r"\bBirdsong\b"),
        ("ww1-contextual-linking", "WW1: unseen prose and contextual linking", r"Contextual Linking"),
    ]),
    ("modern", "Modern times: literature from 1945 to the present (Paper 2B)", [
        ("feminine-gospels", "Feminine Gospels", r"Feminine Gospels"),
        ("skirrid-hill", "Skirrid Hill", r"Skirrid Hill"),
        ("a-streetcar-named-desire", "A Streetcar Named Desire", r"Streetcar"),
        ("top-girls", "Top Girls", r"Top Girls"),
        ("waterland", "Waterland", r"\bWaterland\b"),
        ("the-handmaids-tale", "The Handmaid’s Tale", r"Handmaid"),
        ("modern-contextual-linking", "Modern times: unseen prose and contextual linking", r"^$"),
    ]),
]


def for_component(code, component):
    """Paper 2B's contextual linking is Modern times', though its heading reads like WW1's."""
    return "modern-contextual-linking" if code == "ww1-contextual-linking" and component.startswith("77122B") else code


def flat(spec):
    return [(sec, code, title, re.compile(pat, re.I)) for sec, _, texts in spec for code, title, pat in texts]


def find(spec, *headings):
    """The code of the first text any heading names, in order, or None."""
    texts = flat(spec)
    for h in headings:
        for sec, code, title, pat in texts:
            if h and pat.search(h):
                return code
    return None


# A-Level 7717 and AS 7716 (Specification B). Every paper is sat as one of two options, each a literary genre:
# Paper 1 Aspects of tragedy (1A) or of comedy (1B); Paper 2 Elements of crime writing (2A) or of political and
# social protest writing (2B); AS Paper 1 (drama) and Paper 2 (prose and poetry) in tragedy (A) or comedy (B).
# A question is tagged within its option's genre only (for_option), so a text's pattern need only be unique there.
# The questions that name no text, Paper 2's unseen extract (Section A) and the A-Level's two-text questions
# (Section C), are their genre's own topics (unheaded).
B = [
    ("tragedy", "Aspects of tragedy", [
        ("othello", "Othello", r"\bOthello\b"),
        ("king-lear", "King Lear", r"King Lear"),
        ("richard-ii", "Richard II (AS)", r"Richard II\b"),
        ("death-of-a-salesman", "Death of a Salesman (AS)", r"Death of a Salesman"),
        ("a-streetcar-named-desire", "A Streetcar Named Desire (AS)", r"Streetcar"),
        ("tess-of-the-durbervilles", "Tess of the D’Urbervilles (AS)", r"Tess of the D.Urbervilles"),
        ("the-great-gatsby", "The Great Gatsby (AS)", r"Great Gatsby"),
        ("the-remains-of-the-day", "The Remains of the Day (AS)", r"Remains of the Day"),
        ("keats-selection", "John Keats selection (AS)", r"Keats (selection|Poetry Selection)"),
        ("hardy-selection", "Thomas Hardy selection (AS)", r"Hardy selection"),
        ("poetry-anthology-tragedy", "Poetry Anthology: Tragedy (AS)", r"Poetry Anthology: Tragedy"),
        ("tragedy-two-texts", "Tragedy across two texts (Paper 1A Section C)", r"^$"),
    ]),
    ("comedy", "Aspects of comedy", [
        ("the-taming-of-the-shrew", "The Taming of the Shrew", r"Taming of the Shrew"),
        ("twelfth-night", "Twelfth Night", r"Twelfth Night"),
        ("she-stoops-to-conquer", "She Stoops to Conquer (AS)", r"She Stoops to Conquer"),
        ("the-importance-of-being-earnest", "The Importance of Being Earnest (AS)", r"Importance of Being Earnest"),
        ("educating-rita", "Educating Rita (AS)", r"Educating Rita"),
        ("emma", "Emma (AS)", r"^Emma\b"),
        ("small-island", "Small Island (AS)", r"Small Island"),
        ("wise-children", "Wise Children (AS)", r"Wise Children"),
        ("the-nuns-priests-tale", "The Nun’s Priest’s Tale (AS)", r"Nun.s Priest.s Tale"),
        ("betjeman-selection", "Betjeman selection (AS)", r"Betjeman selection"),
        ("poetry-anthology-comedy", "Poetry Anthology: Comedy (AS)", r"Poetry Anthology: Comedy"),
        ("comedy-two-texts", "Comedy across two texts (Paper 1B Section C)", r"^$"),
    ]),
    ("crime", "Elements of crime writing (Paper 2A)", [
        ("crime-unseen", "Unseen crime extract (Section A)", r"^$"),
        ("crabbe-browning-wilde", "Selected Poems: Crabbe, Browning and Wilde", r"Crabbe"),
        ("the-rime-of-the-ancient-mariner", "The Rime of the Ancient Mariner", r"Ancient Mariner"),
        ("atonement", "Atonement", r"^Atonement\b"),
        ("when-will-there-be-good-news", "When Will There Be Good News?", r"When Will There Be Good News"),
        ("oliver-twist", "Oliver Twist", r"Oliver Twist"),
        ("the-murder-of-roger-ackroyd", "The Murder of Roger Ackroyd", r"Roger Ackroyd"),
        ("brighton-rock", "Brighton Rock", r"Brighton Rock"),
        ("hamlet", "Hamlet", r"^Hamlet\b"),
        ("crime-two-texts", "Crime writing across two texts (Section C)", r"^$"),
    ]),
    ("protest", "Elements of political and social protest writing (Paper 2B)", [
        ("protest-unseen", "Unseen protest extract (Section A)", r"^$"),
        ("tony-harrison", "Selected Poems: Tony Harrison", r"Tony Harrison"),
        ("songs-of-innocence-and-of-experience", "Songs of Innocence and of Experience", r"Songs of Innocence"),
        ("the-kite-runner", "The Kite Runner", r"Kite Runner"),
        ("the-handmaids-tale", "The Handmaid’s Tale", r"Handmaid"),
        ("harvest", "Harvest", r"^Harvest\b"),
        ("hard-times", "Hard Times", r"^Hard Times\b"),
        ("henry-iv-part-1", "Henry IV Part 1", r"Henry IV"),
        ("a-dolls-house", "A Doll’s House", r"Doll.s House"),
        ("protest-two-texts", "Protest writing across two texts (Section C)", r"^$"),
    ]),
]
B_GENRE = {"77161A": "tragedy", "77162A": "tragedy", "77171A": "tragedy", "77161B": "comedy", "77162B": "comedy",
           "77171B": "comedy", "77172A": "crime", "77172B": "protest"}


def for_option(component):
    """Specification B: the one genre a component's questions can be on."""
    return [s for s in B if s[0] == B_GENRE[component]]


def unheaded(component, section):
    """Specification B: the topic of a question that names no text, or None."""
    genre = B_GENRE[component]
    if component.startswith("7717") and section == "C":
        return f"{genre}-two-texts"
    if component.startswith("77172") and section == "A":
        return f"{genre}-unseen"
    return None
