"""Read Eduqas's A Level Religious Studies specification into the bank's topic tree.

    python3 scripts/question-bank/eduqas_rs/spec_eduqas_rs.py [work-dir]   # default .work/eduqas-rs

The specification (A120QS, specs/rs.pdf from fetch_eduqas_rs.py) sets out eight areas, each
in four themes of six sections, A to F, with a title of its own ("A. Jesus – his birth:"):
Component 1's six options, one religion each, and Components 2 and 3. Here:
  - a section of the bank is an area: Options A-F as their religion, "P" Philosophy of
    Religion, "R" Religion and Ethics;
  - a topic is a theme's section, "Theme 1A: Jesus – his birth" (code "A.1A", ref "1A");
  - the AS specification (B120QS, specs/rs-as.pdf) teaches half of these sections, numbered
    its own way (AS Christianity's Theme 3A is the A Level's Theme 2D): a section the AS
    specification also has, by its words, is year 1; the rest year 2. AS papers are tagged to
    the A Level's sections, so one tree serves both.
Some sections open with a sentence from the subject content's overview ("The relationship
between religion and society: …") before their own title: the title is the first paragraph
that ends in a colon.
Writes <work-dir>/spec.json: {"A120": {sections: [{code, title}], topics: [{code, ref, title,
section, year, theme, themeTitle, text}]}}; `text` (the section's content) is for tagging.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "eduqas-rs")
AREA = re.compile(r"^(?:Option ([A-F]): (?:A Study of|An? introduction to) (\w+)|Component ([23]): (?:An Introduction to )?(Philosophy of Religion|Religion and Ethics))\s*$", re.I)
THEME = re.compile(r"^Theme (\d):\s*(.+?)\s*$")
LETTER = re.compile(r"^([A-F])\.\s*(.*)$")  # the title can share the line: "A.  Sources of authority - the origins of Hinduism:"
ISSUES = re.compile(r"^Issues for analysis and evaluation")
# (Option E is Hinduism, so Religion and Ethics is "R")
NAMES = {"2": ("P", "Philosophy of Religion"), "3": ("R", "Religion and Ethics")}


def read(path):
    """{(area, theme, letter): (title, content)} and {area: name}, {(area, theme): theme title}."""
    doc = pymupdf.open(path)
    lines = []
    for page in doc:
        text = page.get_text()
        if not re.search(r"\nTheme \d:", text):
            continue
        for l in text.split("\n"):
            if re.match(r"^\s*(A LEVEL|AS) RELIGIOUS STUDIES \d+\s*$|^© WJEC CBAC", l):
                continue
            lines.append(l.strip())
    out, areas, themes = {}, {}, {}
    area = theme = letter = None
    done = {}  # (area, theme): its sections so far
    buf = []

    def flush():
        if area and theme and letter and buf:
            paras = re.split(r"\n{2,}", "\n".join(buf).strip())
            paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in paras if p.strip()]
            title_at = next((i for i, p in enumerate(paras) if p.endswith(":")), 0)
            title = re.sub(r"^[A-F]\.\s+", "", re.sub(r"\s+", " ", paras[title_at]).rstrip(":").strip()) if paras else ""
            if (area, theme, letter) not in out:
                out[(area, theme, letter)] = (title, " ".join(paras[title_at + 1:]))

    for l in lines:
        m = AREA.match(l)
        if m:
            flush()
            buf, letter = [], None
            area, name = (m.group(1), m.group(2)) if m.group(1) else NAMES[m.group(3)]
            areas[area] = name
            continue
        m = THEME.match(l)
        if m and area:
            flush()
            buf, letter = [], None
            theme = m.group(1)
            done.setdefault((area, theme), [])
            themes.setdefault((area, theme), m.group(2))
            continue
        m = LETTER.match(l)
        # (in order: "F. R. Tennant’s anthropic … arguments" is a line of 1B's content, not section F)
        if m and area and theme and "ABCDEF".index(m.group(1)) == len(done[(area, theme)]):
            flush()
            buf, letter = ([m.group(2)] if m.group(2) else []), m.group(1)
            done[(area, theme)].append(letter)
            continue
        if ISSUES.match(l):
            flush()
            buf, letter = [], None
            continue
        if l == "Knowledge and understanding of religion and belief":
            continue
        buf.append(l)
    flush()
    return out, areas, themes


# Each section's name as a student would know it: the specification's own heading can be a sentence (R.2B runs on into
# its content). The full wording stays in the topic's `text`, for tagging.
SHORT = {
    "C.3B": "Judaism and science",
    "C.3A": "Judaism and secularisation",
    "A.1C": "The Bible in daily life",
    "A.1D": "The Bible: canon and inspiration",
    "A.1E": "The early church in Acts",
    "A.2A": "The nature of God in Christianity",
    "A.2B": "The Trinity",
    "A.2C": "The Atonement",
    "A.2D": "Faith and works",
    "A.2E": "The community of believers",
    "A.2F": "Christian moral principles",
    "A.3A": "Attitudes towards wealth",
    "A.3B": "Migration and Christianity in the UK",
    "A.3C": "Feminist theology and the roles of men and women",
    "A.3D": "Christianity and secularisation",
    "A.3E": "Christianity and science",
    "A.3F": "Pluralism and diversity within Christianity",
    "A.4A": "Baptism",
    "A.4B": "The Eucharist",
    "A.4C": "Christmas and Easter",
    "A.4D": "The Ecumenical Movement",
    "A.4E": "The Charismatic Movement",
    "A.4F": "Liberation theology",
    "B.1A": "Muhammad in Makkah",
    "B.1B": "The Hijrah and Muhammad in Madinah",
    "B.1C": "The Qur’an as a source of wisdom and authority",
    "B.1D": "Sources of shari’a",
    "B.1E": "The role of shari’a",
    "B.2A": "Tawhid and shahadah",
    "B.2B": "Prophets and risalah",
    "B.2C": "Angels and the Day of Judgement",
    "B.2D": "Salah (prayer)",
    "B.2E": "Zakah and Hajj",
    "B.2F": "The five categories of ethical action",
    "B.3A": "An Islamic state and secularisation",
    "B.3B": "Islam and science",
    "B.3D": "Muslim family life",
    "B.3E": "Muslims in Britain",
    "B.4A": "The masjid (mosque)",
    "B.4B": "Festivals and Muslim identity",
    "B.4E": "Islam and change: Sufism",
    "B.4F": "Crime and punishment",
    "C.1A": "Abraham and the covenant of circumcision",
    "C.1B": "Moses and the covenant of law",
    "C.1C": "The Torah as a source of authority",
    "C.1D": "The Talmud",
    "C.1E": "Midrash: Halakhah and Aggadah",
    "C.2A": "The nature of God in Judaism",
    "C.2B": "God, humanity and the purpose of life",
    "C.2C": "Judgement, the Messiah and the afterlife",
    "C.2D": "Diversity of views on mitzvot",
    "C.2E": "Tefillah (prayer) and tzedakah (charity)",
    "C.2F": "The Ten Sayings (Ten Commandments)",
    "C.3C": "Reform Judaism and pluralism",
    "C.3D": "Jewish family life and gender equality",
    "C.3E": "Jews in Britain",
    "C.4A": "Jewish practices and identity",
    "C.4B": "Festivals and Jewish identity",
    "C.4D": "Hasidic Judaism",
    "C.4E": "Kabbalah",
    "C.4F": "Embryo research",
    "D.1A": "The birth of the Buddha and the Four Sights",
    "D.1B": "The Awakening of the Buddha",
    "D.1C": "Buddhist texts in daily life",
    "D.1D": "The Pali Canon",
    "D.1E": "Two Mahayana texts",
    "D.1F": "Contemporary Buddhist teachers",
    "D.2A": "The three lakshanas",
    "D.2B": "Pratityasamutpada, karma and rebirth",
    "D.2C": "Arhat and bodhisattva",
    "D.2E": "The Eightfold Path",
    "D.2F": "The dasa sila (ten precepts)",
    "D.3A": "Buddhism in Japan",
    "D.3B": "Buddhism and science",
    "D.3C": "Buddhism and secularisation",
    "D.3D": "Buddhism, pluralism and diversity",
    "D.3E": "Buddhism in Britain",
    "D.3F": "Men, women and feminism in Buddhism",
    "D.4C": "Dana (giving) and punya (merit)",
    "D.4D": "Tibetan Buddhism: mudra, mandala and mantra",
    "D.4E": "Buddhism and change: the Mindfulness Movement",
    "D.4F": "Socially Engaged Buddhism",
    "E.1A": "The origins of Hinduism",
    "E.1C": "Hindu texts in daily life",
    "E.1D": "The Upanishads",
    "E.1E": "Gandhi and Ramakrishna",
    "E.2A": "Hindu teachings on self, death and afterlife",
    "E.2C": "Karma and reincarnation",
    "E.2D": "Varnashramadharma",
    "E.2E": "The status of the Dalits",
    "E.2F": "Ahimsa",
    "E.3A": "ISKCON",
    "E.3B": "Hinduism, secularisation and science",
    "E.3C": "Hindu liberationist thinking",
    "E.3D": "Diversity and pluralism in Hinduism",
    "E.3E": "Hindus in Britain",
    "E.3F": "Men and women in Hinduism",
    "E.4A": "Hindu practices and identity",
    "E.4B": "Festivals and Hindu identity",
    "E.4E": "Hinduism and change: Samkhya and Advaita Vedanta",
    "F.1A": "Guru Nanak",
    "F.1B": "Guru Gobind Singh",
    "F.1C": "The Guru Granth Sahib",
    "F.1D": "The Mul Mantra and the Japji",
    "F.1E": "Guru Arjan",
    "F.1F": "Maharaja Ranjit Singh and the Sikh empire",
    "F.2A": "Sikh teachings on self, death and afterlife",
    "F.2D": "Sewa and Sikh moral principles",
    "F.2F": "Sant Sipahi and Dharam Yudh",
    "F.3A": "Khalistan",
    "F.3B": "Men and women in Sikhism",
    "F.3C": "Diversity and pluralism in Sikhism",
    "F.3D": "Sikhism, science and secularisation",
    "F.3E": "Sikhs in Britain",
    "F.3F": "Miri and piri: Sikhs as a minority in Britain",
    "F.4A": "The gurdwara",
    "F.4D": "Rahit Maryada and Rahit Namas",
    "F.4E": "Sikhism and change: the names of God",
    "F.4F": "Bioethics: infertility",
    "P.1A": "The cosmological argument",
    "P.1B": "The teleological argument",
    "P.1C": "Challenges to inductive arguments",
    "P.1D": "The ontological argument: origins",
    "P.1E": "The ontological argument: developments",
    "P.1F": "Challenges to the ontological argument",
    "P.2B": "Augustinian theodicy",
    "P.2C": "Irenaean theodicy",
    "P.2D": "Freud on religious belief",
    "P.2E": "Jung on religious belief",
    "P.2F": "Rejecting religion: atheism",
    "P.3A": "Religious experience",
    "P.3C": "Challenges to religious experience",
    "P.3D": "Religious experience, practice and faith",
    "P.3F": "Hume and Swinburne on miracles",
    "P.4A": "Problems of religious language",
    "P.4B": "Verification and falsification",
    "P.4C": "Religious language as analogy",
    "P.4D": "Religious language as symbol",
    "P.4E": "Religious language as myth",
    "P.4F": "Religious language as a language game",
    "R.1D": "Naturalism",
    "R.1E": "Intuitionism",
    "R.1F": "Emotivism",
    "R.2A": "Aquinas’ Natural Law: laws and precepts",
    "R.2B": "Aquinas’ Natural Law: virtues and goods",
    "R.2C": "Aquinas’ Natural Law applied",
    "R.2D": "Finnis’ Natural Law",
    "R.2E": "Proportionalism",
    "R.2F": "Finnis and Proportionalism applied",
    "R.3A": "Situation Ethics: agape",
    "R.3B": "Situation Ethics: its principles",
    "R.3C": "Situation Ethics applied",
    "R.3D": "Bentham’s Act Utilitarianism",
    "R.3E": "Mill’s Rule Utilitarianism",
    "R.3F": "Utilitarianism applied",
    "R.4A": "Predestination",
    "R.4B": "Determinism",
    "R.4C": "Implications of predestination and determinism",
    "R.4D": "Free will",
    "R.4E": "Libertarianism",
    "R.4F": "Implications of libertarianism and free will",
}
# Shares the words of AS Theme 2C (applying Aquinas' Natural Law) but is Finnis and Proportionalism: A Level only.
NOT_AS = {"R.2F"}


def words(s):
    return set(re.findall(r"[a-z’']{4,}", s.lower()))


def alike(a, b):
    """The same section in both specifications: most of the words of its title and opening content in common."""
    a, b = words(a[:300]), words(b[:300])
    return len(a & b) >= 0.6 * min(len(a), len(b))


def main():
    full, areas, themes = read(os.path.join(WORK, "specs", "rs.pdf"))
    as_, _, _ = read(os.path.join(WORK, "specs", "rs-as.pdf"))
    sections = [{"code": a, "title": areas[a]} for a in sorted(areas, key="ABCDEFPR".index)]
    topics = []
    for (area, theme, letter), (title, text) in full.items():
        code = f"{area}.{theme}{letter}"
        title = re.sub(r",?\s+(with (particular )?reference to|the definitions of)$", "", title)  # a title that runs on into a list
        in_as = code not in NOT_AS and any(a == area and alike(title + " " + text, t + " " + x) for (a, _, _), (t, x) in as_.items())
        topics.append({"code": code, "ref": f"{theme}{letter}", "title": SHORT.get(code, title), "section": area, "year": 1 if in_as else 2,
                       "theme": theme, "themeTitle": themes[(area, theme)], "text": (title + ": " + text)[:1500]})
    json.dump({"A120": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"{s['code']} {s['title']}: {len(mine)} topics, AS {sum(1 for t in mine if t['year'] == 1)}", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:6} y{t['year']} {t['title'][:90]}", file=sys.stderr)


if __name__ == "__main__":
    main()
