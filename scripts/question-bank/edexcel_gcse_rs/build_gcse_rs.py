"""Write the Edexcel GCSE Religious Studies bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_gcse_rs/build_gcse_rs.py [work-dir]

Reads <work-dir>/parts.json (cut_gcse_rs.py), spec.json (spec_gcse_rs.py), manifest.json (fetch_gcse_rs.py) and
tags.json (tag_gcse_rs.py merge). Writes src/content/questionBank/edexcel-gcse-religious-studies.json and
public/question-bank/edexcel-gcse-religious-studies/{parts,text,reports}.json, in edexcel_sciences/build_pearson.py's
shapes, with eduqas_gcse/build_eduqas_gcse.py's options:
  - Every option is a paper of its own ("Spec A Paper 1A" · "Catholic Christianity (Study of Religion)").
  - The bank's `options` filter, "Course", is a specification and a religion: "Spec B: Judaism" keeps 1RB0's three Judaism
    papers and the topics they test. A section's option is "a-ju", "b-ju", or "ju" for one both specifications share (spec_gcse_rs.py),
    so each pick `takes` its own and the shared ones; 1RA0's Mark's Gospel goes with Catholic Christianity and Christianity,
    and the Qur'an with Islam. "Spec A: all religions" and "Spec B: all religions" are for a student who sits two.
  - No scheme, no part: November 2021's 1RB0 Paper 1D has a scheme for teachers only, so that paper is left out.
  - A report Pearson didn't write (a one-page "will not publish" notice) isn't linked.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse_history"))
from build_pearson import clean_report, series_label, series_rank, slug  # noqa: E402
from build_gcse_history import own, placeholder  # noqa: E402

SLUG = "edexcel-gcse-religious-studies"
SKIP = {"1rb01d-nov21"}  # no public scheme
RELIGIONS = [("ca", "Catholic Christianity"), ("ch", "Christianity"), ("is", "Islam"), ("bu", "Buddhism"), ("hi", "Hinduism"), ("ju", "Judaism"), ("si", "Sikhism")]
TEXT = {"ca": ["mk"], "ch": ["mk"], "is": ["qu"]}
LETTER = {"a": "ca", "b": "ch", "c": "is", "d": "bu", "e": "hi", "f": "ju", "g": "si"}
AREAS = {"1ra01": "Study of Religion", "1ra02": "Study of Second Religion", "1ra03": "Philosophy and Ethics", "1ra04": "Textual Studies",
         "1rb01": "Religion and Ethics", "1rb02": "Religion, Peace and Conflict", "1rb03": "Religion, Philosophy and Social Justice"}
# A word in a title that already says which religion it is about
ADJECTIVE = {"ca": r"Catholic", "ch": r"Christian|Church|Bible", "is": r"Muslim|Islam|Allah|Qur|Prophet Muhammad|Shari", "bu": r"Buddh|Dhamma", "hi": r"Hindu", "ju": r"Jew|Judaism|Torah|Tenakh",
             "si": r"Sikh|Guru|gurdwara", "mk": r"Mark", "qu": r"Qur|Allah"}
NAMES = dict(RELIGIONS) | {"mk": "Mark’s Gospel", "qu": "The Qur’an"}
NOTE = ("Religious Studies A (1RA0) and B (1RB0), every religion. Pick your specification and religion under Course to keep just its papers and topics; "
        "if you study two religions, pick the specification and tick your papers under Paper. Parts marked out of 15 include 3 marks for spelling, punctuation and grammar.")


def paper(comp):
    """{id, name: "Spec A Paper 1A", title: "Catholic Christianity (Study of Religion)", option: "a-ca"}."""
    spec, num, letter = comp[2], comp[4], comp[5]
    if spec == "a" and num == "4":
        title, option = ("Mark’s Gospel", "mk") if letter == "a" else ("The Qur’an", "qu")
    else:
        rel = LETTER[letter]
        title, option = NAMES[rel], f"{spec}-{rel}"
    return {"id": comp, "name": f"Spec {spec.upper()} Paper {num}{letter.upper()}", "title": f"{title} ({AREAS[comp[:5]]})", "as": False, "option": option}


def options():
    a = [x for rel, _ in RELIGIONS for x in (f"a-{rel}", rel)] + ["mk", "qu"]
    b = [x for rel, _ in RELIGIONS for x in (f"b-{rel}", rel)]
    out = [{"id": "spec-a", "name": "Spec A: all religions", "takes": a}, {"id": "spec-b", "name": "Spec B: all religions", "takes": b}]
    out += [{"id": f"a-{rel}", "name": f"Spec A: {name}", "takes": [f"a-{rel}", rel, *TEXT.get(rel, [])]} for rel, name in RELIGIONS]
    out += [{"id": f"b-{rel}", "name": f"Spec B: {name}", "takes": [f"b-{rel}", rel]} for rel, name in RELIGIONS]
    return out


def topic_rows(tree, counts):
    """A topic's title as the specification has it. Where two religions share a title, "Pilgrimage", the religion goes in
    brackets so each page has its own name; its slug starts with the religion unless the title says it, and stops
    at a word under 80 characters."""
    rel_of = {s["code"]: s["code"][:2].lower() for s in tree["sections"]}
    seen = {}
    for t in tree["topics"]:
        seen[t["title"]] = seen.get(t["title"], 0) + 1
    rows, used = [], set()
    for t in tree["topics"]:
        rel = rel_of[t["section"]]
        title = t["title"] if seen[t["title"]] == 1 else f"{t['title']} ({NAMES[rel]})"
        s = slug(t["title"] if re.search(ADJECTIVE[rel], t["title"]) else f"{NAMES[rel]} {t['title']}")
        if len(s) > 80:
            s = s[:80].rsplit("-", 1)[0]
        if s in used:
            s = f"{s}-{t['section'][2:].lower()}"
        assert s not in used and len(s) < 90, s
        used.add(s)
        rows.append({"code": t["code"], "ref": t["ref"], "title": title, "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": 0})
    return rows


def main():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p["set"] not in SKIP]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    files = {}
    for f in manifest:
        if f["kind"] == "er" and placeholder(os.path.join(WORK, "pdf", f["file"])):
            continue
        files.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports, wholes = [], {}, {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        key = f"{p['component']}-{p['series']}"
        wholes[key] = files.get(key, {})
        words = own(p.get("ask") or p["text"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        rows.append(row)
        scheme = re.sub(r"· (\d)", r"\1", p.get("msText", ""))
        text[p["id"]] = re.sub(r"\s+", " ", " ".join([words, scheme])).lower()
    order = sorted({r["p"] for r in rows})
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), int(re.match(r"\d+", r["l"]).group()), r["l"]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Edexcel", "level": "GCSE", "subject": "Religious Studies", "specs": ["1RA0", "1RB0"],
        "sections": [{"code": s["code"], "title": s["title"], "option": s["option"]} for s in tree["sections"]],
        "topics": topic_rows(tree, counts),
        "papers": [paper(c) for c in order],
        "options": {"label": "Course", "list": options()},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if v},
        "noCalc": True,
        "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('er'))} with report comments ({len(reports)} questions), {len(order)} papers, "
          f"{len(meta['topics'])} topics, {len(wholes)} sittings, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
