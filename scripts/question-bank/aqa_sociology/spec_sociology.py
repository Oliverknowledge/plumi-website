"""Read AQA's A-Level Sociology specification (7191/7192) into the bank's topic tree.

    python3 scripts/question-bank/aqa_sociology/spec_sociology.py [work-dir]   # default scripts/question-bank/.work/aqa-sociology

The A-Level subject content (numbered 4) names twelve topic areas (4.1.1 Education
… 4.3.2 Theory and Methods), each a list of bullet points ("the nature of
childhood, and changes in the status of children in the family and society").
Writes <work-dir>/spec.json under 7192:
  - sections are the topic areas, shown as the bank's tiles. 4.1.3 and 4.3.2
    (Theory and Methods, once in Paper 1 and again in Paper 3) are one section,
    and Methods in Context (4.1.2), which has no bullets of its own, is a topic in it;
  - topics are the bullets, numbered in order under their area ("4.2.2.4"). The
    specification prints no number for a bullet, so `ref` is empty and a topic is
    shown by its title, a short name for the bullet (TITLES); the bullet's own words
    are kept as "text", for tagging only.
Every topic is year 0: the bank groups them by area, not by AS and A-Level, since
the AS areas are taught and examined again at A-Level.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-sociology")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/sociology/specifications/AQA-7191-7192-SP-2015.PDF"
FOOTER = re.compile(r"(AQA AS and A-level Sociology \. AS and A-level exams MONTH onwards\. Version [\d.]+ \d+ \w+ \d{4} )?(\d+ )?Visit (aqa\.org\.uk/\d+ )?for the most up-to-date specification, resources, support and administration( \d+)?")
AREAS = [  # (code, title) in the order the bank shows them
    ("4.1.1", "Education"), ("4.1.3", "Theory and Methods"),
    ("4.2.1", "Culture and Identity"), ("4.2.2", "Families and Households"), ("4.2.3", "Health"), ("4.2.4", "Work, Poverty and Welfare"),
    ("4.2.5", "Beliefs in Society"), ("4.2.6", "Global Development"), ("4.2.7", "The Media"), ("4.2.8", "Stratification and Differentiation"),
    ("4.3.1", "Crime and Deviance"),
]
# A short name for each bullet, in the specification's order.
TITLES = {
    "4.1.1": ["Role and functions of education", "Differential educational achievement", "Relationships and processes within schools", "Educational policy"],
    "4.1.3": ["Quantitative and qualitative methods; research design", "Sources of data", "Primary and secondary, quantitative and qualitative data",
              "Positivism, interpretivism and social facts", "Theoretical, practical and ethical considerations", "Consensus, conflict, structural and action theories",
              "Modernity and postmodernity", "Sociology and science", "The relationship between theory and methods", "Subjectivity, objectivity and value freedom", "Sociology and social policy"],
    "4.2.1": ["Conceptions of culture", "Socialisation and its agencies", "The self, identity and difference", "Identity, class, gender, ethnicity and other differences",
              "Identity, production, consumption and globalisation"],
    "4.2.2": ["The family, social structure and social policy", "Changing family patterns and diversity", "Gender roles, domestic labour and power",
              "Childhood and the status of children", "Demographic trends since 1900"],
    "4.2.3": ["Social construction of health, illness and disability", "Inequalities in health chances", "Provision of and access to health care",
              "Mental illness", "Medicine, the health professions and the health industry"],
    "4.2.4": ["The nature and persistence of poverty", "Distribution of poverty, wealth and income", "Responses and solutions to poverty",
              "The labour process, technology and skill", "Work, worklessness and life chances"],
    "4.2.5": ["Ideology, science and religion", "Religion, social change and stability", "Religious organisations and movements",
              "Social groups and religion", "Secularisation and globalisation"],
    "4.2.6": ["Development, underdevelopment and global inequality", "Globalisation and relationships between societies", "TNCs, NGOs and international agencies",
              "Aid, trade, industrialisation, urbanisation, environment and war", "Employment, education, health, demography and gender"],
    "4.2.7": ["The new media", "Ownership and control of the media", "Media, globalisation and popular culture", "Selection and presentation of the news",
              "Media representations", "Media effects and audiences"],
    "4.2.8": ["Stratification by class, gender, ethnicity and age", "Dimensions of inequality and life chances", "Defining and measuring social class",
              "Changing structures of inequality", "Social mobility"],
    "4.3.1": ["Crime, deviance, social order and social control", "Social distribution of crime", "Globalisation, media, green and state crime",
              "Crime control, punishment, victims and the justice system"],
}
MIC = {"code": "4.1.2", "ref": "", "title": "Methods in context", "section": "4.1.3", "year": 0,
       "text": "Students must be able to apply sociological research methods to the study of education: the strengths and limitations of a research method for investigating a particular issue in education."}


def content(path):
    """The A-Level subject content as one string, from "4.1 Education with Theory and Methods" to the scheme of assessment."""
    doc = pymupdf.open(path)
    text = "\n".join(page.get_text() for page in doc)
    start = text.rindex("4 Subject Content – A-level")  # the contents page lists it first
    end = text.find("5 Scheme of assessment", start)
    end = end if end > 0 else len(text)
    return FOOTER.sub(" ", text[start:end])


def bullets(text, code):
    """The bullets under "<code> <title>", up to the next numbered heading."""
    m = re.search(rf"\n{re.escape(code)} [^\n]+\n(.*?)(?=\n4\.\d(?:\.\d)? [A-Z]|\Z)", text, re.S)
    body = m.group(1)
    # A bullet that ends a page carries the page's footer and number.
    items = [re.sub(r"\s*(AQA AS and A-level Sociology \..*)?\s\d+$", "", re.sub(r"\s+", " ", b).strip()) for b in body.split("•")[1:]]
    return [b for b in items if b]


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    text = content(path)
    sections, topics = [], []
    for code, title in AREAS:
        sections.append({"code": code, "title": f"{code} {title}", "short": title})
        items = bullets(text, code)
        assert len(items) == len(TITLES[code]), f"{code}: {len(items)} bullets, {len(TITLES[code])} titles"
        assert code != "4.1.3" or bullets(text, "4.3.2") == items[:len(bullets(text, "4.3.2"))], "4.3.2 isn't 4.1.3 again"
        if code == "4.1.3":
            topics.append(MIC)
        for n, (item, short) in enumerate(zip(items, TITLES[code]), 1):
            topics.append({"code": f"{code}.{n}", "ref": "", "title": short, "section": code, "text": item, "year": 0})
    json.dump({"7192": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} areas, {len(topics)} topics", file=sys.stderr)


if __name__ == "__main__":
    main()
