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
        topics.append({"code": code, "ref": f"{theme}{letter}", "title": title, "section": area, "year": 1 if in_as else 2,
                       "theme": theme, "themeTitle": themes[(area, theme)], "text": text[:1500]})
    # Two sections with one title (Buddhism's 2A and 2B "The nature of ultimate reality") take the start of their content too.
    twins = {(t["section"], t["title"]) for t in topics if sum(o["section"] == t["section"] and o["title"] == t["title"] for o in topics) > 1}
    for t in topics:
        if (t["section"], t["title"]) in twins:
            t["title"] += " – " + re.split(r"[:,(]| - | – ", t["text"])[0].strip()
    json.dump({"A120": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"{s['code']} {s['title']}: {len(mine)} topics, AS {sum(1 for t in mine if t['year'] == 1)}", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:6} y{t['year']} {t['title'][:90]}", file=sys.stderr)


if __name__ == "__main__":
    main()
