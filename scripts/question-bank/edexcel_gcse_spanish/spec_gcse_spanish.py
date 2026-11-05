"""The Edexcel GCSE Spanish bank's topic tree: Pearson's five themes for 1SP0 and their topics.

Imported by tag_gcse_spanish.py and build_gcse_spanish.py. 1SP0's subject content is five themes, each of a few topics, some listing
several sub-topics; where a topic's sub-topics are things a student would practise apart (Daily life's food and shopping, Cultural
life's music and sport), they are the bank's topics. 1SP1, first sat in 2026, regroups the same ground into new themes; its sample
papers are tagged to these topics too, as the AQA banks tag their 2026 specimens, since nothing in them falls outside.
"""

SECTIONS = [
    {"code": "1", "title": "Identity and culture", "short": "Identity and culture"},
    {"code": "2", "title": "Local area, holiday and travel", "short": "Local area and travel"},
    {"code": "3", "title": "School", "short": "School"},
    {"code": "4", "title": "Future aspirations, study and work", "short": "Future and work"},
    {"code": "5", "title": "International and global dimension", "short": "Global dimension"},
]
# code, ref (the spec's topic), title, what it covers (for tagging)
TOPICS = [
    ("1.1.1", "1.1", "Family, friends and relationships", "who I am, describing family and friends, what makes a good friend, when I was younger, role models"),
    ("1.1.2", "1.1", "Interests and socialising", "free time, hobbies and going out with friends and family, where no one activity below is the point"),
    ("1.2.1", "1.2", "Customs and everyday life", "daily routine, life at home, chores, customs and ways of life in other countries"),
    ("1.2.2", "1.2", "Food and drink", "meals, what people eat and drink, cooking, healthy eating, diet"),
    ("1.2.3", "1.2", "Shopping", "buying things, clothes, markets, money and pocket money, online shopping"),
    ("1.2.4", "1.2", "Social media and technology", "phones, the internet, social networks, computers and games, their advantages and dangers"),
    ("1.3.1", "1.3", "Celebrations and festivals", "birthdays, Christmas, weddings, national days, local and religious festivals"),
    ("1.3.2", "1.3", "Reading", "books, magazines and comics, as a pastime"),
    ("1.3.3", "1.3", "Music", "listening to and playing music, instruments, singers and bands"),
    ("1.3.4", "1.3", "Sport", "playing and watching sport, exercise and keeping fit, clubs and teams"),
    ("1.3.5", "1.3", "Film and television", "cinema, TV programmes and series, actors, viewing habits"),
    ("2.1", "2.1", "Holidays", "holiday preferences, destinations and experiences, what people did on holiday"),
    ("2.2", "2.2", "Travel and tourist transactions", "transport and journeys, hotels, campsites and booking, asking for help, problems and complaints, directions, eating out in restaurants, souvenirs"),
    ("2.3", "2.3", "Town, region and country", "where you live, home and neighbourhood, weather, places to see and things to do in a place, the countryside"),
    ("3.1", "3.1", "What school is like", "school types, the school day, subjects, teachers, uniform, rules and pressures, homework, exams, celebrating success"),
    ("3.2", "3.2", "School activities", "school trips, events, clubs and exchanges"),
    ("4.1", "4.1", "Using languages beyond the classroom", "learning languages, why they are useful, using them to make friends, to travel, in work and abroad"),
    ("4.2", "4.2", "Ambitions", "future plans, further study, university, apprenticeships and training, gap years, volunteering as a plan"),
    ("4.3", "4.3", "Work", "part-time jobs, work experience, jobs, careers and professions, what a job is like"),
    ("5.1", "5.1", "Bringing the world together", "international sports and music events, charities, campaigns and good causes, helping others, poverty and homelessness, volunteering for a cause"),
    ("5.2", "5.2", "Environmental issues", "being green, recycling, pollution, climate, protecting nature, access to water and natural resources"),
]
SHORT = {"1.1.1": "Family and friends", "2.2": "Travel and transactions", "4.1": "Using languages", "5.1": "Events and good causes"}


def tree():
    return {"sections": SECTIONS, "topics": [{"code": c, "ref": r, "title": t, "section": c[0], "text": x, **({"short": SHORT[c]} if c in SHORT else {})}
                                             for c, r, t, x in TOPICS]}
