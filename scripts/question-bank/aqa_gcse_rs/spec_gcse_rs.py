"""Read AQA's GCSE Religious Studies A specification (8062) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_rs/spec_gcse_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-rs

Writes <work-dir>/spec.json under 8062: sections and the topics under them, each with the
specification's words ("text", for tagging only, never shown). A section is what one question
of a paper is on, so a question's five parts are tagged within one section:
  - Component 1, a section per religion's beliefs and teachings (question 1 of its paper) and
    per its practices (question 2), each carrying its religion as an `option` (the bank's
    "Religion" filter). Their topics are the specification's bullet points ("The Trinity",
    "Pilgrimage"), the way a student revises them; a bullet that only lists ("Beliefs and
    teachings about:") gives a topic per item.
  - Component 2, a section per theme: A-F (the thematic studies, questions 1-6) and G-H (the
    textual studies of St Mark's Gospel, 2B's questions 7 and 8). Themes A-F take their issues as
    topics; G and H their headings (the passages studied together) and what each heading's
    "Significance" asks about.
Codes are the bank's own ("CH1.3", "TA.5") with no ref, so no number is shown that the
specification doesn't print.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-rs")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/rs/specifications/AQA-8062-SP-2016.PDF"
FOOTER = re.compile(r"GCSE Religious Studies A 8062\. GCSE exams June 2018 onwards\. Version [\d.]+ \d+ \w+ \d{4}|(\d+\s*)?Visit aqa\.org\.uk/8062 for the most up-to-date specification, resources, support and administration(\s*\d+(?![.\d]))?")
RELIGIONS = [("bu", "BU", "Buddhism"), ("ca", "CA", "Catholic Christianity"), ("ch", "CH", "Christianity"), ("hi", "HI", "Hinduism"),
             ("is", "IS", "Islam"), ("ju", "JU", "Judaism"), ("si", "SI", "Sikhism")]
# (code, title, option, where its words start); a section runs to the next one's start.
SECTIONS = [
    ("BU1", "Buddhism: beliefs and teachings", "bu", "3.1.1.1 Key Beliefs"), ("BU2", "Buddhism: practices", "bu", "3.1.1.2 Practices"),
    ("CH1", "Christianity: beliefs and teachings", "ch", "3.1.2.1 Beliefs and teachings"), ("CH2", "Christianity: practices", "ch", "3.1.2.2 Practices"),
    ("CA1", "Catholic Christianity: beliefs and teachings", "ca", "3.1.3.1 Beliefs and teachings"), ("CA2", "Catholic Christianity: practices", "ca", "3.1.3.2 Practices"),
    ("HI1", "Hinduism: beliefs and teachings", "hi", "3.1.4.1 Beliefs and teachings"), ("HI2", "Hinduism: practices", "hi", "3.1.4.2 Practices"),
    ("IS1", "Islam: beliefs and teachings", "is", "3.1.5.1 Beliefs and teachings"), ("IS2", "Islam: practices", "is", "3.1.5.2 Practices"),
    ("JU1", "Judaism: beliefs and teachings", "ju", "3.1.6.1 Beliefs and teachings"), ("JU2", "Judaism: practices", "ju", "3.1.6.2 Practices"),
    ("SI1", "Sikhism: beliefs and teachings", "si", "3.1.7.1 Beliefs and teachings"), ("SI2", "Sikhism: practices", "si", "3.1.7.2 Practices"),
    ("TA", "Theme A: Relationships and families", None, "Sex, marriage and divorce"),
    ("TB", "Theme B: Religion and life", None, "The origins and value of the universe"),
    ("TC", "Theme C: The existence of God and revelation", None, "Philosophical arguments for and against the existence of God"),
    ("TD", "Theme D: Religion, peace and conflict", None, "Religion, violence, terrorism and war"),
    ("TE", "Theme E: Religion, crime and punishment", None, "Religion, crime and the causes of crime"),
    ("TF", "Theme F: Religion, human rights and social justice", None, "Human rights Prejudice and discrimination"),
    ("TG", "Theme G: St Mark's Gospel, the life of Jesus", None, "The early ministry of Jesus"),
    ("TH", "Theme H: St Mark's Gospel as a source of religious, moral and spiritual truths", None, "The Kingdom of God Parable"),
]
END = "3.2.2.2 Theme H"  # (TH starts after it) and the subject content ends at "4 Scheme of assessment"
# (section, title, where its words start, searched from the section's start in order)
TOPICS = [
    ("BU1", "Dhamma (Dharma)", "The concept of Dhamma"),
    ("BU1", "Dependent arising", "The concept of dependent arising"),
    ("BU1", "The Three Marks of Existence", "The Three Marks of Existence"),
    ("BU1", "The human personality: skandhas and sunyata", "The human personality"),
    ("BU1", "Human destiny: Arhat, Bodhisattva and Buddhahood", "Human destiny"),
    ("BU1", "The Buddha's life and its significance", "The Buddha’s life and its significance"),
    ("BU1", "The Four Noble Truths and the Eightfold Path", "The Four Noble Truths:"),
    ("BU2", "Buddhist places of worship", "The nature, use and importance of Buddhist places"),
    ("BU2", "Puja", "Puja, the significance"),
    ("BU2", "Meditation", "Meditation, the different aims"),
    ("BU2", "Death and mourning", "The practice and significance of different ceremonies"),
    ("BU2", "Festivals and retreats: Wesak and Parinirvana Day", "Festivals and retreats"),
    ("BU2", "Kamma, compassion and loving kindness", "Ethical teaching"),
    ("BU2", "The five moral precepts", "The five moral precepts"),
    ("BU2", "The six perfections", "The six perfections"),
    ("CH1", "The nature of God, the Trinity and evil and suffering", "The nature of God"),
    ("CH1", "Creation", "Different Christian beliefs about creation"),
    ("CH1", "The afterlife: resurrection, judgement, heaven and hell", "Different Christian beliefs about the afterlife"),
    ("CH1", "The incarnation and Jesus as the Son of God", "the incarnation and Jesus as the Son of God"),
    ("CH1", "The crucifixion, resurrection and ascension", "the crucifixion, resurrection and ascension"),
    ("CH1", "Sin and original sin", "sin, including original sin"),
    ("CH1", "Salvation and atonement", "the means of salvation"),
    ("CH2", "Forms of worship", "Different forms of worship and their significance"),
    ("CH2", "Prayer and the Lord's Prayer", "Prayer and its significance"),
    ("CH2", "The sacraments: baptism and Holy Communion", "The role and meaning of the sacraments"),
    ("CH2", "Pilgrimage: Lourdes and Iona", "two contrasting examples of Christian pilgrimage"),
    ("CH2", "Christmas and Easter", "the celebrations of Christmas and Easter"),
    ("CH2", "The Church in the local community", "The role of the Church in the local community"),
    ("CH2", "Mission, evangelism and Church growth", "The place of mission"),
    ("CH2", "The worldwide Church: reconciliation, persecution and charities", "The importance of the worldwide Church"),
    ("CA1", "The Trinity", "One God as a Trinity"),
    ("CA1", "Creation and the dignity of human beings", "Creation: Biblical accounts"),
    ("CA1", "The incarnation", "Incarnation: the belief"),
    ("CA1", "Redemption", "Redemption: the significance"),
    ("CA1", "Life after death: judgement, heaven, hell and purgatory", "Beliefs about life after death"),
    ("CA1", "The meaning of sacrament", "The meaning and significance of ‘sacrament’"),
    ("CA1", "The seven sacraments", "The names, meanings and effects of the seven sacraments"),
    ("CA2", "Prayer and the Mass", "Prayer:"),
    ("CA2", "Popular piety: the Rosary and the Stations of the Cross", "The role and importance of forms of popular piety"),
    ("CA2", "Catholic pilgrimage", "The role and importance of pilgrimage"),
    ("CA2", "The funeral rite", "The funeral rite"),
    ("CA2", "Loving our neighbour: Catholic social teaching", "Catholic beliefs about the essential duty"),
    ("CA2", "Mission and evangelism", "The meaning and significance of mission and evangelism"),
    ("CA2", "The Society of Saint Vincent de Paul", "The aims and importance of the Society"),
    ("CA2", "Corrymeela or Pax Christi", "The aims and importance of either"),
    ("HI1", "Brahman", "Brahman: different Hindu"),
    ("HI1", "The three features of the divine", "Different understandings of the three features"),
    ("HI1", "How the divine presents: Trimurti, Tridevi and avatars", "How the divine presents"),
    ("HI1", "Prakriti, the three qualities, maya and cosmology", "Matter (prakriti)"),
    ("HI1", "Atman", "The concept of atman"),
    ("HI1", "Samsara, karma and moksha", "Cycle of birth and death"),
    ("HI1", "Free will and suffering", "Individual free will"),
    ("HI1", "Personal virtues and ahimsa", "Personal virtues"),
    ("HI1", "The four aims of human life", "The four aims of human life"),
    ("HI1", "Dharma, sanatana dharma and varnashrama dharma", "The meaning of dharma"),
    ("HI2", "Hindu places of worship", "Places of worship and their importance"),
    ("HI2", "Forms of worship: puja, arati, havan and darshan", "Different forms of worship/meditation"),
    ("HI2", "Focuses of worship: murtis and representations of the divine", "Focuses of worship"),
    ("HI2", "Festivals: Divali and Holi", "Sacred festivals"),
    ("HI2", "The four paths of yoga", "The four paths towards yoga"),
    ("HI2", "Hindu pilgrimage: Varanasi and the Kumbh Mela", "Pilgrimage:"),
    ("HI2", "Environmental projects and charities", "The work and significance of"),
    ("IS1", "The six articles of faith and the five roots of Usul ad-Din", "The six articles of faith"),
    ("IS1", "Tawhid", "Tawhid (the Oneness of God)"),
    ("IS1", "The nature of God: Islam", "The nature of God:"),
    ("IS1", "Angels", "Angels, their nature and role"),
    ("IS1", "Predestination and human freedom", "Predestination and human freedom"),
    ("IS1", "Akhirah: life after death", "Akhirah (life after death)"),
    ("IS1", "Risalah: prophethood", "Risalah (Prophethood)"),
    ("IS1", "The holy books", "The holy books"),
    ("IS1", "The imamate in Shi'a Islam", "The imamate in Shi'a Islam"),
    ("IS2", "The Five Pillars and the Ten Obligatory Acts", "Five Pillars of Sunni Islam"),
    ("IS2", "Shahadah", "Shahadah: declaration of faith"),
    ("IS2", "Salah and Jummah prayer", "Salah and its significance"),
    ("IS2", "Sawm: fasting in Ramadan", "Sawm: the role and significance"),
    ("IS2", "Zakah and khums", "Zakah: the role and significance"),
    ("IS2", "Hajj", "Hajj: the role and significance"),
    ("IS2", "Jihad", "Jihad: different understandings"),
    ("IS2", "Festivals: Id-ul-Adha, Id-ul-Fitr and Ashura", "Festivals and commemorations"),
    ("JU1", "The nature of God: Judaism", "The nature of God:"),
    ("JU1", "The Shekhinah", "The divine presence (Shekhinah)"),
    ("JU1", "Life after death: judgement and resurrection", "Beliefs about life after death"),
    ("JU1", "The Messiah", "The nature and role of the Messiah"),
    ("JU1", "The Covenant with Abraham and the promised land", "The promised land and the Covenant with Abraham"),
    ("JU1", "The Covenant at Sinai and the Ten Commandments", "The Covenant at Sinai"),
    ("JU1", "Key moral principles", "Key moral principles"),
    ("JU1", "The sanctity of life and pikuach nefesh", "The importance of the sanctity of human life"),
    ("JU1", "Free will and the 613 mitzvot", "The relationship between free will"),
    ("JU1", "Mitzvot between people and God", "Mitzvot between man and God"),
    ("JU2", "The synagogue", "The synagogue and its importance"),
    ("JU2", "The design and features of synagogues", "The design and religious features of synagogues"),
    ("JU2", "Public worship in Orthodox and Reform synagogues", "Public acts of worship"),
    ("JU2", "Shabbat", "Shabbat in the home and synagogue"),
    ("JU2", "Worship in the home and private prayer", "Worship in the home and private prayer"),
    ("JU2", "The Tenakh and the Talmud", "Tenakh (the written law)"),
    ("JU2", "Rituals: brit milah, bar and bat mitzvah, marriage and mourning", "Rituals and their significance"),
    ("JU2", "Dietary laws", "Dietary laws"),
    ("JU2", "Festivals: Rosh Hashanah, Yom Kippur and Pesach", "Festivals and their importance for Jews"),
    ("SI1", "The Mool Mantra and the nature of God", "The nature of God as expressed in the Mool Mantra"),
    ("SI1", "God as Creator", "God as Creator"),
    ("SI1", "Human life as an opportunity to unite with God", "The nature of human life as an opportunity"),
    ("SI1", "Karma, rebirth and mukti", "Beliefs in karma and rebirth"),
    ("SI1", "The five khands and the barriers to mukti", "The five stages of liberation"),
    ("SI1", "Gurmukh and manmukh", "The importance of being gurmukh"),
    ("SI1", "The oneness of humanity and equality", "Belief in the oneness of humanity"),
    ("SI1", "Equality in the Gurus' teachings", "The expression of the equality of all in"),
    ("SI1", "Sewa", "Sewa: the importance and priority of service"),
    ("SI1", "The sangat", "The role and importance of the sangat"),
    ("SI2", "The gurdwara: its features and practices", "Religious features of the gurdwara"),
    ("SI2", "The role of the gurdwara in the community", "The role of the gurdwara within the Sikh community"),
    ("SI2", "Prayer in the home", "The role of prayer in the home"),
    ("SI2", "The akhand path", "The role and importance of the akhand path"),
    ("SI2", "Langar", "The meaning and significance of langar"),
    ("SI2", "Nam japna", "The significance of meditating on the name of God"),
    ("SI2", "Festivals: Vaisakhi, Divali and gurpurbs", "Festivals and their importance for Sikhs"),
    ("SI2", "Historical gurdwaras and the Golden Temple", "The importance of visiting Sikh historical gurdwaras"),
    ("SI2", "Birth and naming ceremonies", "Birth and naming ceremonies"),
    ("SI2", "Amrit Sanskar and the Khalsa", "The initiation ceremony (Amrit Sanskar)"),
    ("SI2", "The names Singh and Kaur", "The significance and use of the names Singh and Kaur"),
    ("TA", "Human sexuality", "Human sexuality including"),
    ("TA", "Sex before and outside marriage", "Sexual relationships before and outside of marriage"),
    ("TA", "Contraception and family planning", "Contraception and family planning"),
    ("TA", "The nature and purpose of marriage", "The nature and purpose of marriage"),
    ("TA", "Same-sex marriage and cohabitation", "Same-sex marriage and cohabitation"),
    ("TA", "Divorce and remarriage", "Divorce, including reasons for divorce"),
    ("TA", "The nature of families", "The nature of families"),
    ("TA", "The purpose of families", "The purpose of families"),
    ("TA", "Contemporary family issues", "Contemporary family issues"),
    ("TA", "The roles of men and women", "The roles of men and women"),
    ("TA", "Gender equality, prejudice and discrimination", "Gender equality."),
    ("TB", "The origins of the universe", "The origins of the universe"),
    ("TB", "The value of the world and stewardship", "The value of the world and the duty of human beings"),
    ("TB", "The use and abuse of the environment", "The use and abuse of the environment"),
    ("TB", "The use and abuse of animals", "The use and abuse of animals"),
    ("TB", "The origins of human life", "The origins of life"),
    ("TB", "Sanctity of life and quality of life", "The concepts of sanctity of life and the quality of life"),
    ("TB", "Abortion", "Abortion, including situations"),
    ("TB", "Euthanasia", "Euthanasia."),
    ("TB", "Death and the afterlife", "Beliefs about death and an afterlife"),
    ("TC", "The Design argument", "The Design argument"),
    ("TC", "The First Cause argument", "The First Cause argument"),
    ("TC", "The argument from miracles", "The argument from miracles"),
    ("TC", "Evil and suffering as an argument against God", "Evil and suffering as an argument"),
    ("TC", "Science and the existence of God", "Arguments based on science"),
    ("TC", "Special revelation and visions", "Special revelation as a source"),
    ("TC", "Enlightenment", "Enlightenment as a source"),
    ("TC", "General revelation: nature and scripture", "General revelation: nature and scripture"),
    ("TC", "Ideas about the divine", "Different ideas about the divine"),
    ("TC", "The value of revelation and enlightenment", "The value of general and special revelation"),
    ("TD", "Peace, justice, forgiveness and reconciliation", "The meaning and significance of"),
    ("TD", "Violence and violent protest", "Violence, including violent protest"),
    ("TD", "Terrorism", "Terrorism."),
    ("TD", "Reasons for war", "Reasons for war"),
    ("TD", "Just war theory", "The just war theory"),
    ("TD", "Holy war", "Holy war."),
    ("TD", "Pacifism", "Pacifism."),
    ("TD", "Religion as a cause of war and violence", "Religion and belief as a cause of war"),
    ("TD", "Nuclear weapons and deterrence", "Nuclear weapons, including nuclear deterrence"),
    ("TD", "Weapons of mass destruction", "The use of weapons of mass destruction"),
    ("TD", "Peace-making", "Religion and peace-making"),
    ("TD", "Responses to the victims of war", "Religious responses to the victims of war"),
    ("TE", "Good and evil intentions and actions", "Good and evil intentions and actions"),
    ("TE", "Reasons for crime and views of lawbreakers", "Reasons for crime"),
    ("TE", "Types of crime: hate crimes, theft and murder", "Views about different types of crime"),
    ("TE", "The aims of punishment", "The aims of punishment"),
    ("TE", "The treatment of criminals", "The treatment of criminals"),
    ("TE", "Forgiveness", "Forgiveness."),
    ("TE", "The death penalty", "The death penalty."),
    ("TF", "Prejudice and discrimination in religion", "Prejudice and discrimination in religion and belief"),
    ("TF", "Freedom of religion and belief", "Issues of equality, freedom of religion"),
    ("TF", "Human rights and responsibilities", "Human rights and the responsibilities"),
    ("TF", "Social justice", "Social justice."),
    ("TF", "Racial prejudice and discrimination", "Racial prejudice and discrimination."),
    ("TF", "Wealth and its uses", "Wealth, including"),
    ("TF", "The responsibilities of wealth", "The responsibilities of wealth"),
    ("TF", "Exploitation of the poor", "Exploitation of the poor"),
    ("TF", "Poverty and self-help", "The responsibilities of those living in poverty"),
    ("TF", "Charity", "Charity, including issues"),
    ("TG", "The early ministry of Jesus", "The early ministry of Jesus"),
    ("TG", "The later ministry of Jesus", "The later ministry of Jesus"),
    ("TG", "The final days in Jerusalem", "The final days in Jerusalem"),
    ("TG", "The titles of Jesus", "The titles Son of Man"),
    ("TG", "Jesus as teacher and miracle worker", "St Mark’s portrayal of Jesus"),
    ("TG", "The Last Supper, death and resurrection: their meaning", "Differing beliefs about the meaning of Jesus’ words"),
    ("TG", "The authority of St Mark's account of Jesus' life", "Differing views on the authority of St Mark"),
    ("TH", "The Kingdom of God", "Parable of the sower"),
    ("TH", "Jesus and those disregarded by society", "The man with leprosy"),
    ("TH", "Faith and discipleship", "The call of the first disciples"),
    ("TH", "The Kingdom of God: its meaning today", "The significance and importance for Jesus, for the people"),
    ("TH", "Jesus' attitudes to the disregarded: their significance", "Reasons for 1st century attitudes"),
    ("TH", "Discipleship and faith: their importance", "Different views on the significance and importance for Jesus’ disciples"),
    ("TH", "The authority of Jesus' teaching", "Differing views on the authority of Jesus’ teaching"),
]


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL))))
    text = "\n".join(page.get_text() for page in doc)
    text = re.sub(r"\s+", " ", FOOTER.sub(" ", text[text.index("3.1.1 Buddhism\nStudents"):text.index("4 Scheme of assessment\nFind")]).replace("•", " "))
    starts = []
    at = 0
    for code, title, option, marker in SECTIONS:
        if code == "TH":
            at = text.index(END, at)
        at = text.index(marker, at)
        starts.append(at)
    bounds = {s[0]: (a, b) for s, a, b in zip(SECTIONS, starts, starts[1:] + [len(text)])}
    topics, n = [], {}
    found = []
    for section, title, marker in TOPICS:
        lo, hi = bounds[section]
        prev = max([f for s, f in found if s == section] + [lo])
        at = text.find(marker, prev)
        assert lo <= at < hi, f"{section} {marker!r} not found"
        found.append((section, at))
    for k, ((section, title, marker), (_, at)) in enumerate(zip(TOPICS, found)):
        nxt = found[k + 1][1] if k + 1 < len(found) and found[k + 1][0] == section else bounds[section][1]
        n[section] = n.get(section, 0) + 1
        body = re.split(r" 3\.[12](?:\.\d)* [A-Z]", text[at:nxt])[0]  # the last topic of a religion or theme stops at the next heading
        topics.append({"code": f"{section}.{n[section]}", "ref": "", "title": title, "section": section, "text": body.strip()[:1500], "year": 0})
    sections = [{"code": c, "title": t, **({"option": o} if o else {})} for c, t, o, _ in SECTIONS]
    options = [{"id": i, "name": name} for i, _, name in RELIGIONS]
    json.dump({"8062": {"sections": sections, "topics": topics, "options": options}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    thin = [t["code"] for t in topics if len(t["text"]) < 25]
    print(f"{len(sections)} sections, {len(topics)} topics" + (f"; little text for {thin}" if thin else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
