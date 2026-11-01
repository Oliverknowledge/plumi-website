"""Write OCR's A-Level Sociology (H580) topic tree for the bank.

    python3 scripts/question-bank/ocr_sociology/spec_ocr_sociology.py [work-dir]   # default .work/ocr-sociology

Set out by hand from the specification (https://www.ocr.org.uk/Images/170212-specification-accredited-a-level-gce-sociology.pdf,
section 2c), whose content is tables of key questions ("1. What is culture?") and the content under each.
A key question is a topic where it is narrow; where it covers several things a question can be set on alone
(identity's aspects, the theories of crime) it is split, in the specification's order. Sections follow the
components: 1A socialisation, culture and identity, 1B-1D Component 1's options (families and relationships,
youth subcultures, media), 2A research methods, 2B social inequalities, 3A globalisation and the digital
social world, 3B-3D Component 3's options (crime and deviance, education, religion, belief and faith). An
option's section carries its `option`, so the bank's Option filter keeps the options a student sits. No topic
has a printed code (`ref` empty), every `year` is 0 (the bank groups them "By area"), and `text` is for
tagging only. Writes <work-dir>/spec.json in spec_ocr.py's shape, under H580.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-sociology"))

OPTIONS = [("families", "Families and relationships (Paper 1)"), ("youth", "Youth subcultures (Paper 1)"), ("media", "Media (Paper 1)"),
           ("crime", "Crime and deviance (Paper 3)"), ("education", "Education (Paper 3)"), ("religion", "Religion, belief and faith (Paper 3)")]
SECTIONS = [
    ("1A", "Socialisation, culture and identity", None, [
        ("Culture, norms and values", "what is culture; norms, values; relative nature of culture; cross-cultural material"),
        ("Types of culture", "subculture, high culture, popular culture, global culture, consumer culture; cultural diversity; cultural hybridity"),
        ("Socialisation and its agencies", "primary and secondary socialisation; agencies: family, peer group, media, religion, education, workplace; nature/nurture debate; socialisation and identity"),
        ("Social control", "formal agencies: police, law, courts, government, military; informal agencies: family, peer group, subcultures, media, religion, education, workplace"),
        ("Identity and hybrid identities", "the concept of identity; how identities are created; hybrid identities; changing identities; intersecting identities"),
        ("Gender and sexuality identities", "gender identity, masculinity, femininity, sexuality identity"),
        ("Ethnic and national identities", "ethnicity, ethnic identity, nationality, national identity, Britishness"),
        ("Social class identity", "social class identity, working-class, middle-class, upper-class identity"),
        ("Age and disability identities", "age identity, youth, old age, disability identity"),
    ]),
    ("1B", "Families and relationships", "families", [
        ("Family and household diversity", "nuclear, extended, lone parent, reconstituted, same-sex families, non-family households; diversity by social class, ethnicity, sexuality; debates about the extent of family diversity"),
        ("Marriage, divorce and demographic change", "trends in marriage, divorce, cohabitation; birth-rate, family size, age at marriage, age of child-bearing, ageing population"),
        ("Theories of the family", "ideology of the nuclear family; functionalism, New Right, Marxism, feminism, postmodernism on the role and desirability of the nuclear family"),
        ("Roles and relationships between partners", "domestic division of labour, power, dark side of the family, domestic violence; functionalist, Marxist, feminist approaches"),
        ("Parents, children and grandparents", "child-centred family, extension of childhood, power between parents and children; ageing population and grandparents"),
    ]),
    ("1C", "Youth subcultures", "youth", [
        ("Theories of youth culture and subcultures", "functionalism, Marxism, neo-Marxism (CCCS), feminism, postmodernism on the role and formation of youth culture and subcultures"),
        ("Subcultures, class, gender, ethnicity and hybridity", "subcultures related to social class, gender (girls, bedroom culture), ethnicity, hybridity"),
        ("Deviant subcultures and youth deviance", "delinquent, criminal, spectacular youth, anti-school subcultures, gangs; patterns and trends in youth deviance by class, gender, ethnicity"),
        ("Explaining youth deviance", "functionalism, New Right, Marxism, neo-Marxism, interactionism, culture and identity explanations for participation in deviant subcultures"),
        ("Media, moral panics and folk devils", "the media and youth deviance; deviance amplification; folk devils; moral panics"),
    ]),
    ("1D", "Media", "media", [
        ("Media representations of social groups", "representations of ethnicity, gender (masculinity, femininity), social class, age (young and old) and how they are changing"),
        ("Theories of media representation", "Marxism, neo-Marxism, pluralism, feminism, postmodernism on media representations; ownership and control"),
        ("Media effects on audiences", "direct and indirect effects, active audience; hypodermic syringe, two-step flow, cultural effects, uses and gratifications"),
        ("Media, deviance amplification and moral panics", "the role of the media in deviance amplification and the creation of moral panics"),
    ]),
    ("2A", "Research methods", None, [
        ("Positivism and interpretivism", "relationship between theory and methods; positivism: patterns, trends, objectivity, value freedom, quantitative data; interpretivism: meanings, verstehen, empathy, rapport, subjectivity, reflexivity, qualitative data"),
        ("Validity, reliability and representativeness", "key research concepts: validity, reliability, representativeness, generalisability"),
        ("The research process", "choice of research topic; aims, hypotheses, research questions; operationalisation; pilot studies; longitudinal studies; respondent validation; interpretation of data; sociology and social policy"),
        ("Sampling, access and gatekeeping", "sampling process; random, systematic, stratified, snowball, volunteer, opportunity, purposive, quota sampling; access and gatekeeping"),
        ("Research ethics", "ethics, British Sociological Association guidelines, informed consent, harm, confidentiality, covert research"),
        ("Questionnaires and structured interviews", "questionnaires, structured interviews, quantitative data"),
        ("Unstructured and semi-structured interviews", "unstructured interviews, semi-structured interviews, group interviews, qualitative data"),
        ("Observation and ethnography", "participant, non-participant, covert, overt observation; ethnography"),
        ("Statistics, documents and content analysis", "official and non-official statistical data; secondary data; content analysis; documents"),
        ("Mixed methods and triangulation", "quantitative and qualitative data; mixed methods; triangulation; methodological pluralism"),
    ]),
    ("2B", "Understanding social inequalities", None, [
        ("Social class inequality", "patterns and trends in social class inequality; life chances; work, employment, income, wealth, health, education"),
        ("Gender inequality", "patterns and trends in gender inequality; work, employment, pay gap, glass ceiling"),
        ("Ethnic inequality", "patterns and trends in ethnic inequality; work, employment, racism, discrimination"),
        ("Age inequality", "patterns and trends in age inequality; young and old; work and employment"),
        ("Functionalist explanations of inequality", "functionalism, meritocracy, Davis and Moore, Parsons"),
        ("Marxist explanations of inequality", "Marxism, neo-Marxism, class conflict, bourgeoisie, proletariat"),
        ("Weberian explanations of inequality", "Weber, status, party, market situation, class"),
        ("Feminist explanations of inequality", "liberal, Marxist, radical, intersectional feminism, patriarchy"),
        ("New Right explanations of inequality", "New Right, underclass, Murray, dependency culture"),
    ]),
    ("3A", "Globalisation and the digital social world", None, [
        ("Globalisation and digital communication", "definitions of globalisation; digital revolution; global village; networked global society; media convergence; social media; virtual communities; digital social networks; social capital"),
        ("Theories of digital communication", "Marxism, feminism, postmodernism applied to digital forms of communication"),
        ("Digital communication, identity, inequality and relationships", "impact of digital communication on identity, social inequalities (class, gender, age), relationships; digital divide; surveillance"),
        ("Digital communication and culture", "conflict and change; cultural homogenisation; cultural defence; glocalisation"),
    ]),
    ("3B", "Crime and deviance", "crime", [
        ("Defining and measuring crime", "crime and deviance, social order, social control, relativity, social construction; official crime statistics, victim surveys, self-report studies"),
        ("Patterns of crime and victimisation", "social distribution of offending and victimisation by social class, gender, age, ethnicity; global organised crime; green crime; state crime"),
        ("Functionalist and subcultural theories", "functionalism, Durkheim, Merton strain; subcultural theories, Cohen, Cloward and Ohlin, Miller"),
        ("Marxist and radical theories", "Marxism, neo-Marxism, radical criminology, white-collar and corporate crime"),
        ("Interactionism and labelling", "interactionism, labelling theory, Becker, Lemert, deviancy amplification"),
        ("Realist and New Right theories", "left realism, right realism, New Right, underclass"),
        ("Feminist and gender theories of crime", "feminism, female crime, chivalry thesis, masculinities"),
        ("Reducing crime", "social policy and crime: left wing (community crime prevention, restorative justice, structural change) and right wing (situational and environmental crime prevention, retributive justice, punitive punishment and control)"),
    ]),
    ("3C", "Education", "education", [
        ("The role of education", "functionalism, Marxism, liberal, social democratic, New Right, feminism on the role of education"),
        ("Education and work", "relationship between education and work; functionalism, Marxism, New Right; vocationalism, work-based training"),
        ("Patterns of educational achievement", "differential achievement by social class, ethnicity, gender; global gender apartheid in education; global disparity in provision"),
        ("Explaining differential achievement", "inside and outside school factors; structural, material, cultural factors; functionalism, Marxism, interactionism, labelling, social democratic, feminism, New Right"),
        ("Educational policy since 1988", "diversity of provision; policies from 1988; marketisation; competition, diversity and choice; raising standards; equality of opportunity; New Right and social democratic influences"),
    ]),
    ("3D", "Religion, belief and faith", "religion", [
        ("Defining and measuring religion", "defining religion, faith, belief; measuring religious belief, religiosity, believing without belonging, vicarious religion"),
        ("Religious organisations and movements", "churches, denominations, sects, cults, new religious movements, new age movements, fundamentalism"),
        ("Theories of religion", "functionalism, Marxism, neo-Marxism, Weberianism, feminism, phenomenology, postmodernism on the role of religion"),
        ("Religion and social change", "religion as a conservative force or a force for change; functionalism, Marxism, neo-Marxism, Weber"),
        ("Patterns of religious belief", "religion by social class, gender, ethnicity, age; global context; resurgence and decline"),
        ("Secularisation", "secularisation debate: belief, practice, power and influence; pro- and anti-secularisation theorists; postmodern views; religion and social policy"),
    ]),
]


def main():
    tree = {"sections": [], "topics": []}
    for code, title, option, topics in SECTIONS:
        tree["sections"].append({"code": code, "title": title, **({"option": option} if option else {})})
        for n, (name, text) in enumerate(topics, 1):
            tree["topics"].append({"code": f"{code}.{n}", "ref": "", "title": name, "section": code, "text": text, "year": 0})
    os.makedirs(WORK, exist_ok=True)
    json.dump({"H580": tree, "options": [{"id": i, "name": n} for i, n in OPTIONS]}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(tree['sections'])} sections, {len(tree['topics'])} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
