"""The GCSE French, Spanish and Bengali banks' topic tree: AQA's three themes and their topics.

Imported by tag_gcse_languages.py and build_gcse_languages.py. French 8658, Spanish 8698 and
Bengali 8638 share one subject content (specification section 3.1 to 3.3): three themes of four
topics each, five of them split into sub-topics, which are the bank's topics here ("1.3 Music",
"1.3 Sport"), so a student can practise one. French 8652 and Spanish 8692, first sat in 2026,
regroup the same ground into new themes (People and lifestyle; Popular culture; Communication
and the world around us); their specimen papers are tagged to these topics too, as nothing in
them falls outside.
"""

SECTIONS = [
    {"code": "1", "title": "Identity and culture", "short": "Identity and culture"},
    {"code": "2", "title": "Local, national, international and global areas of interest", "short": "Local and global"},
    {"code": "3", "title": "Current and future study and employment", "short": "Study and employment"},
]
# code, ref (the spec's topic), title, what it covers (for tagging)
TOPICS = [
    ("1.1.1", "1.1", "Relationships with family and friends", "describing yourself, family and friends; getting on with people; role models"),
    ("1.1.2", "1.1", "Marriage and partnership", "marriage, weddings, living together, future relationships"),
    ("1.2.1", "1.2", "Social media", "social networks, posting online, online friends, its dangers and benefits"),
    ("1.2.2", "1.2", "Mobile technology", "phones, apps, the internet, computers, gaming, their uses and risks"),
    ("1.3.1", "1.3", "Music", "listening to, playing and making music, concerts, singers"),
    ("1.3.2", "1.3", "Cinema and TV", "films, TV programmes, series, actors, reading and books"),
    ("1.3.3", "1.3", "Food and eating out", "meals, cooking, restaurants and cafés, ordering, favourite food"),
    ("1.3.4", "1.3", "Sport", "playing and watching sport, sports events, clubs, competitions"),
    ("1.4", "1.4", "Customs and festivals", "festivals, celebrations, birthdays, traditions and customs of countries where the language is spoken"),
    ("2.1", "2.1", "Home, town, neighbourhood and region", "where you live, your house, town and region, shops, local facilities, directions"),
    ("2.2.1", "2.2", "Charity and voluntary work", "volunteering, charities, helping others"),
    ("2.2.2", "2.2", "Healthy and unhealthy living", "diet, exercise, sleep, smoking, alcohol, drugs, stress and health"),
    ("2.3.1", "2.3", "The environment", "pollution, recycling, climate, saving energy, transport and the planet"),
    ("2.3.2", "2.3", "Poverty and homelessness", "poverty, homelessness, inequality, unemployment as a social problem"),
    ("2.4", "2.4", "Travel and tourism", "holidays, travel, transport for trips, hotels and campsites, tourist places, weather on holiday"),
    ("3.1", "3.1", "My studies", "school subjects, opinions of subjects, homework, exams"),
    ("3.2", "3.2", "Life at school and college", "the school day, rules, uniform, teachers, school facilities, trips, pressures"),
    ("3.3", "3.3", "Education post-16", "sixth form, college, university, apprenticeships, gap years, plans after GCSEs"),
    ("3.4", "3.4", "Jobs, career choices and ambitions", "part-time jobs, work experience, careers, future ambitions, working abroad"),
]
SHORT = {"2.1": "Home, town and region", "3.4": "Jobs and careers"}


def tree():
    return {"sections": SECTIONS, "topics": [{"code": c, "ref": r, "title": t, "section": c[0], "text": x, **({"short": SHORT[c]} if c in SHORT else {})}
                                             for c, r, t, x in TOPICS]}
