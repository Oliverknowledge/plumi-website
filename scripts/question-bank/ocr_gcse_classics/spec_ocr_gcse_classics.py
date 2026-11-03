"""Read OCR's GCSE Classical Civilisation specification (J199) into the bank's topic tree.

    python3 scripts/question-bank/ocr_gcse_classics/spec_ocr_gcse_classics.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-classics

Writes <work-dir>/spec.json under J199: a section per component, each one of the bank's options (a student sits one
thematic study and one literature and culture component), and the specification's key topics under it, with the
content beside each as its text ("text", for tagging only, never shown):
  - J199/11 Myth and Religion and J199/12 Women in the Ancient World: eight key topics each, every one of them
    covering Greece and Rome;
  - J199/21 The Homeric World, J199/22 Roman City Life and J199/23 War and Warfare: four Culture and four Literature
    key topics each.
The specification gives its key topics no numbers: their codes are the bank's own ("21.5", no ref shown), and the
titles shared by two components ("Themes") name their own ("Themes of the Odyssey"). The specification is OCR's
current one (version 2.0), whose content the 2021-2025 papers were set on.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-classics")
URL = "https://www.ocr.org.uk/Images/315240-specification-accredited-gcse-classical-civilisation-j199.pdf"
# (component, title, option, [(the key topic's label as the specification prints it, the bank's title)])
COMPONENTS = [
    ("11", "Myth and Religion", "myth", [
        ("Gods", "Gods"), ("The Universal Hero", "The universal hero: Heracles/Hercules"),
        ("Religion and the", "Religion and the city: temples"), ("Myth and the City", "Myth and the city: foundation stories"),
        ("Festivals", "Festivals"), ("Myth and Symbols", "Myth and symbols of power"),
        ("Death and Burial", "Death and burial"), ("Journeying to the", "Journeying to the Underworld")]),
    ("12", "Women in the Ancient World", "women", [
        ("Women of Legend", "Women of legend"), ("Young Women", "Young women"), ("Women in the", "Women in the home"),
        ("‘Improper’ Women", "‘Improper’ women"), ("Women and", "Women and religion"), ("Women and power", "Women and power"),
        ("Warrior Women", "Warrior women"), ("Women to be", "Women to be feared")]),
    ("21", "The Homeric World", "homeric", [
        ("Key Sites", "Key Mycenaean sites"), ("Life in the", "Life in the Mycenaean age"), ("Decorative arts", "Mycenaean decorative arts"),
        ("Tombs, graves and", "Mycenaean tombs, graves and burial"),
        ("Literary techniques and", "Homer’s literary techniques and composition"), ("Themes", "Themes of the Odyssey"),
        ("The character of", "The character of Odysseus"), ("The portrayal of key", "Key characters in the Odyssey")]),
    ("22", "Roman City Life", "roman", [
        ("Roman Housing", "Roman housing"), ("The Roman Home", "The Roman home and family"), ("Society", "Roman society"),
        ("Leisure and", "Leisure and entertainment"),
        ("Satire and", "Satire and fiction"), ("Pliny and his", "Pliny and his letters"),
        ("Experiencing", "Experiencing Roman city life"), ("Relationships", "Relationships and Roman society")]),
    ("23", "War and Warfare", "war", [
        ("Sparta at War in", "Sparta at war in the 5th century BC"), ("Athens at War", "Athens at war in the 5th century BC"),
        ("The Roman", "The Roman military in the Imperial period"), ("The Romans", "The Romans at war"),
        ("Literary Context", "Literary context of war literature"), ("Characterisation", "Characterisation in war literature"),
        ("Themes", "Themes of war literature"), ("Heroes and", "Heroes and warfare")]),
]
STOP = re.compile(r"^(Prescribed|Literature$|Culture$|2d\.|2c\.|Learners should|When studying)")


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def rows(doc):
    """Every line of the content pages, in reading order: (page, y, x, text, bold)."""
    out = []
    for i in range(len(doc)):
        for b in doc[i].get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in l["spans"])).strip()
                if t and 60 < l["bbox"][1] < doc[i].rect.height - 50:
                    out.append((i, l["bbox"][1], l["bbox"][0], t, bool(l["spans"][0]["flags"] & 16)))
    return sorted(out, key=lambda r: (r[0], round(r[1]), r[2]))


def key_topics(doc):
    lines = rows(doc)
    out = []
    for comp, _, _, topics in COMPONENTS:
        # (the last "Content of …" heading: the first is the contents page's)
        start = [n for n, r in enumerate(lines) if re.match(rf"Content of .*\(J199/{comp}\)", r[3])][-1]
        end = next((n for n, r in enumerate(lines) if n > start and re.match(r"Content of .*\(J199/\d\d\)|2d\. ", r[3])), len(lines))
        mine = lines[start:end]
        # Each key topic's label, the bold line in the left column that opens it.
        at = []
        for label, title in topics:
            n = next(k for k, r in enumerate(mine) if r[2] < 70 and r[4] and r[3].startswith(label) and all(k > a for a, _ in at))
            at.append((n, title))
        # A label sits midway down its row, so a row starts above it: halfway from the label before (on the same page),
        # or 80pt above it.
        starts = []
        for k, (n, _) in enumerate(at):
            pg, y = mine[n][0], mine[n][1]
            prev = mine[at[k - 1][0]] if k else None
            starts.append((pg, (prev[1] + y) / 2 if prev and prev[0] == pg else y - 80))
        for k, (n, title) in enumerate(at):
            lo, hi = starts[k], starts[k + 1] if k + 1 < len(at) else (999, 0)
            body = []
            for r in mine:
                if (r[0], r[1]) < lo:
                    continue
                if (r[0], r[1]) >= hi or (r[2] < 70 and STOP.match(r[3]) and (r[0], r[1]) > (mine[n][0], mine[n][1])):
                    break
                if r[2] > 120 and r[3] != "•":
                    body.append(r[3])
            out.append({"code": f"{comp}.{k + 1}", "ref": "", "title": title, "section": comp,
                        "text": re.sub(r"\s+", " ", " ".join(body)).strip()[:3500], "year": 0})
    return out


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(fetch(os.path.join(WORK, "spec", "j199.pdf")))
    topics = key_topics(doc)
    sections = [{"code": c, "title": t, "option": o} for c, t, o, _ in COMPONENTS]
    json.dump({"J199": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        mine = [t for t in topics if t["section"] == s["code"]]
        print(f"{s['code']} {s['title']}: {len(mine)} topics", file=sys.stderr)
        for t in mine:
            print(f"   {t['code']} {t['title']} ({len(t['text'])} chars) {t['text'][:70]}", file=sys.stderr)


if __name__ == "__main__":
    main()
