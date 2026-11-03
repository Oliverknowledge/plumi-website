"""Read Pearson's GCSE (9-1) Religious Studies A and B specifications into the bank's topic tree.

    python3 scripts/question-bank/edexcel_gcse_rs/spec_gcse_rs.py [work-dir]
    # reads <work-dir>/specs/spec-a.pdf and spec-b.pdf: Pearson's Issue 2 specifications (January 2024), from
    # qualifications.pearson.com/content/dam/pdf/GCSE/Religious Studies/2016/Specification and sample assessments/
    # specification-gcse-l1-l2-religious-studies-a-june-2016-draft-4.pdf (and -b-)

Each option's page is headed "1A Catholic Christianity", then "Section 1: Beliefs and Teachings", then its
numbered items: "1.1 The Trinity: the nature and significance of...". A topic is an item, and a section is a
religion's section of content. The same section is printed many times over: 1RB0's "Catholic Beliefs" under
1A, 2A and 3A, 1RA0's "Beliefs and Teachings" under 1A and 2A, and 1RA0's "Practices" is 1RB0's "Living the
Catholic Life", item for item (likewise "Arguments for the Existence of God" and "Philosophy of Religion",
"Relationships and Families" and "Marriage and the Family"). Sections of one religion whose items read the
same are one section here, so a topic's page shows every paper's questions on it: 632 topics become 528.

A section carries the bank's `option` (build_gcse_rs.py): "a-ca" if only Specification A's Catholic Christianity
sets it, "b-ca" if only B's, "ca" if both; "mk" and "qu" are 1RA0's textual studies.

Writes <work-dir>/spec.json: {sections: [{code, title, option}], topics: [{code, ref, title, section, text}],
map: {"1ra01a": ["CABEL", "CAPRA", "CASRC", "CAFRM"], ...}}, map giving each paper's sections in question order.
"""
import difflib, json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs")
RELIGION = {"Catholic Christianity": "CA", "Christianity": "CH", "Islam": "IS", "Buddhism": "BU", "Hinduism": "HI", "Hindusism": "HI", "Judaism": "JU", "Sikhism": "SI",
            "Mark’s Gospel": "MK", "The Qur’an": "QU"}
NAMES = {"CA": "Catholic Christianity", "CH": "Christianity", "IS": "Islam", "BU": "Buddhism", "HI": "Hinduism", "JU": "Judaism", "SI": "Sikhism", "MK": "Mark’s Gospel", "QU": "The Qur’an"}
# A section's short code and title, by what the specification calls it. (Its title keeps the religion's own words where the code is shared.)
KINDS = [(r"(Catholic|Christian|Muslim|Buddhist|Hindu|Jewish|Sikh) Beliefs|Beliefs and Teachings$", "BEL", "Beliefs and teachings"),
         (r"^Beliefs and Teachings of Islam", "BQU", "Beliefs and teachings of Islam"), (r"^Lives of the Prophets", "LOP", "Lives of the prophets and others"),
         (r"^Who is Jesus", "WHO", "Who is Jesus?"), (r"^The Nature of Discipleship", "DIS", "The nature of discipleship"),
         (r"^Practices", "PRA", "Practices"), (r"^Sources of Wisdom", "SRC", "Sources of wisdom and authority"), (r"^Forms of Expression", "FRM", "Forms of expression and ways of life"),
         (r"^Arguments for the Existence of Allah", "ARG", "Arguments for the existence of Allah"), (r"^Arguments for the Existence", "ARG", "Arguments for the existence of God"), (r"^Religious Teachings on Relationships", "RFM", "Relationships and families in the 21st century"),
         (r"^Marriage and the Family", "MFA", "Marriage and the family"), (r"^Living the", "LIV", "Living the religious life"), (r"^Matters of Life and Death", "LDE", "Matters of life and death"),
         (r"^Crime and Punishment", "CPU", "Crime and punishment"), (r"^Peace and Conflict", "PCO", "Peace and conflict"),
         (r"^Philosophy of Religion", "PHI", "Philosophy of religion"), (r"^Religious Experience", "PHI", "Religious experience"), (r"^Equality", "EQU", "Equality")]
HEAD = re.compile(r"^([1-4][A-G]) (.+)$")
SECTION = re.compile(r"^Section ([1-4]): (.+)$")
ITEM = re.compile(r"^([1-4]\.[1-8])\*?$")
FURNITURE = re.compile(r"^(Pearson Edexcel Level 1/Level 2 GCSE.*|Specification – Issue.*|\d{1,3}|Students should have an understanding of:)$")
STAR = re.compile(r"^\* .*|^\*[A-Z].*")


def read(path):
    """[(paper option "1A", section number, kind code, kind title, religion code, {"1.1": text})] in printed order."""
    doc = pymupdf.open(path)
    out = []
    for page in doc:
        lines = [l.strip() for l in page.get_text().split("\n") if l.strip() and not FURNITURE.match(l.strip())]
        head = HEAD.match(lines[0]) if lines else None
        sec = SECTION.match(lines[1]) if len(lines) > 1 else None
        if not (head and sec and head.group(2).strip() in RELIGION):
            continue
        kind = next((k for k in KINDS if re.search(k[0], sec.group(2))), None)
        assert kind, sec.group(2)
        items, cur = {}, None
        for l in lines[2:]:
            m = ITEM.match(l)
            if m:
                cur = m.group(1)
                items[cur] = ""
            elif cur and not STAR.match(l):
                items[cur] += " " + l
        out.append((head.group(1), int(sec.group(1)), kind[1], kind[2], RELIGION[head.group(2).strip()], {k: re.sub(r"\s+", " ", v).strip() for k, v in items.items()}))
    return out


def title_of(text):
    """"The Trinity: the nature and significance of…" -> "The Trinity"; an item with no heading of its own keeps its opening clause."""
    head = re.split(r":\s", text, maxsplit=1)[0].strip()
    head = re.sub(r",? (including|with reference to|with reference|as taught in)\b.*$", "", head).strip()
    if len(head) > 60:
        head = re.split(r";\s| – ", head)[0].strip()
    if len(head) > 120:
        head = head[:120].rsplit(" ", 1)[0]
        head = re.sub(r"(,| and| of| the| in| for| to| a| an| with| on| about| by| or)+$", "", head)
    # (a clause cut off: "…in the United Kingdom, what", "…origins and value of human life, such")
    head = re.sub(r", (what|such|their|buddharupas)\b.*$", "", head)
    return head.rstrip(" .,;/")


def same(a, b):
    """Two sections with the same items, in the same order."""
    return len(a) == len(b) and all(difflib.SequenceMatcher(None, a[x], b[y], autojunk=False).ratio() > 0.8 for x, y in zip(sorted(a), sorted(b)))


def main():
    sections, topics, paper_map, canon = [], [], {}, {}
    for spec, code in (("a", "1ra0"), ("b", "1rb0")):
        for opt, n, kind, ktitle, rel, items in read(os.path.join(WORK, "specs", f"spec-{spec}.pdf")):
            group = canon.setdefault(rel, [])
            hit = next((c for c in group if same(c["items"], items)), None)
            if not hit:
                hit = {"code": f"{rel}{kind}", "titles": {}, "specs": set(), "items": items, "rel": rel}
                assert not any(c["code"] == hit["code"] for c in group), hit["code"]
                group.append(hit)
            hit["specs"].add(spec)
            hit["titles"].setdefault(spec, ktitle)
            paper_map.setdefault(f"{code}{opt.lower()}", []).append(hit["code"])
    for rel, group in canon.items():
        for c in group:
            a, b = c["titles"].get("a"), c["titles"].get("b")
            title = f"{a} (Spec A), {b} (Spec B)" if a and b and a != b else a or b
            option = "mk" if rel == "MK" else "qu" if rel == "QU" else rel.lower() if len(c["specs"]) == 2 else f"{min(c['specs'])}-{rel.lower()}"
            sections.append({"code": c["code"], "title": f"{NAMES[rel]}: {title}", "option": option})
            for k in sorted(c["items"]):
                topics.append({"code": f"{c['code']}.{k[-1]}", "ref": "", "title": title_of(c["items"][k]), "section": c["code"], "text": c["items"][k]})
    json.dump({"sections": sections, "topics": topics, "map": paper_map}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} sections, {len(topics)} topics", file=sys.stderr)
    for s in sections:
        print(s["code"], s["option"], s["title"], file=sys.stderr)


if __name__ == "__main__":
    main()
