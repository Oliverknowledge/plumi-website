"""Write the AQA A-Level French and Spanish banks' data files from the cut parts, their tags and recordings.

    python3 scripts/question-bank/aqa_languages/build_languages.py [work-dir]   # default scripts/question-bank/.work/aqa-languages

build_rs.py's shapes (src/content/questionBank/<slug>.json and public/question-bank/<slug>/{parts,text,reports}.json),
one bank per language, the AS papers in it marked AS. What differs:
  - The topics are spec_languages.py's: the four themes' sub-themes (Year 1 for the two AS
    themes, Year 2 for the others), the skills a Paper 1 question tests, the grammar points a
    scheme demands, and Paper 2's set texts and films, so a student picks the works they study,
    as English Literature's set texts are picked.
  - A listening question carries its recording (`au`, aqa/audio/<file>.mp3), and its sitting the
    transcript (`wholes` "tr"); a reading question set on the insert's text links the insert (`src`).
  - Paper 2's essays come in pairs, either .1 or .2 on each work: the second is the alternative (`or`).
  - Each Paper 1 adds up to its 100 marks (AS: 90), less any question left out because AQA's
    copyright-removed paper blanks its text (AS French June 2022's Q08 article).
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402
from spec_languages import THEMES, WORKS  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-languages")
BANKS = {
    "french": {"slug": "aqa-a-level-french", "subject": "French", "specs": ["7652", "7651"], "a": "76521", "a2": "76522", "as": "76511", "as2": "76512"},
    "spanish": {"slug": "aqa-a-level-spanish", "subject": "Spanish", "specs": ["7692", "7691"], "a": "76921", "a2": "76922", "as": "76911", "as2": "76912"},
}
PAPER_TITLES = {"a": ("Paper 1", "Listening, reading and writing", False), "a2": ("Paper 2", "Writing: set texts and films", False),
                "as": ("AS Paper 1", "Listening, reading and writing", True), "as2": ("AS Paper 2", "Writing: translation, set texts and films", True)}
SKILLS = [("listening", "Listening"), ("reading", "Reading"), ("summary", "Summaries"), ("literary", "Literary extracts"),
          ("into-english", "Translation into English"), ("into-language", "Translation into {lang}")]
GRAMMAR = [("subjunctive", "The subjunctive"), ("conditional", "The conditional"), ("pluperfect", "The pluperfect"), ("imperfect", "The imperfect"),
           ("preterite", "The preterite"), ("future", "The future"), ("passive", "The passive")]
MAXIMUM = {"a": 100, "as": 90}
NOTE = ("AQA publishes these papers from November 2020 on (AS: November 2020, then June 2022 on); June 2017 to June 2019 are no longer on its site. "
        "Each listening question plays AQA’s own recording, as often as you like, as in the exam, with the transcript to check against afterwards. "
        "Paper 2’s essays are on the set texts and films: pick the ones you study under Topics. Paper 3, the speaking test, isn’t here, as it has no written questions.")


def topic_tree(lang, subject):
    sections, topics = [], []
    for code, title, year, subs in THEMES[lang]:
        sections.append({"code": code, "title": title})
        topics += [{"code": c, "ref": "", "title": t, "section": code, "year": year} for c, t, _ in subs]
    sections.append({"code": "skills", "title": "Skills"})
    topics += [{"code": c, "ref": "", "title": t.format(lang=subject), "section": "skills", "year": 0} for c, t in SKILLS]
    sections.append({"code": "grammar", "title": "Grammar the mark scheme asks for"})
    topics += [{"code": c, "ref": "", "title": t, "section": "grammar", "year": 0} for c, t in GRAMMAR]
    for code, title, items in WORKS[lang]:
        sections.append({"code": code, "title": title})
        topics += [{"code": c, "ref": "", "title": t, "section": code, "year": 0} for c, t, _ in items]
    return sections, topics


def build(lang, bank, parts, tags, manifest, audio):
    comps = {bank[k]: k for k in ("a", "a2", "as", "as2")}
    parts = [p for p in parts if p["component"] in comps]
    sections, tree = topic_tree(lang, bank["subject"])
    valid = {t["code"] for t in tree}
    wholes = {}
    for f in manifest:
        if f["component"] in comps and f["kind"] in ("qp", "ms", "er", "ins", "tr"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    rows, text, reports, left_out = [], {}, {}, []
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        if re.search(r"not reproduced here", p["text"]):
            left_out.append(p["id"])  # its text is blanked in AQA's copyright-removed paper: it can't be answered
            continue
        kind = comps[p["component"]]
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", re.sub(r"\[\d+ marks?\]", "", own)).strip()[:160]}
        if kind in ("a2", "as2") and p["part"] == "2" and not (kind == "as2" and p["question"] == "01"):
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[f"{p['set']}-{p['question']}"] = p["er"]
        recording = audio.get(f"{p['set']}-{p['question']}")
        if recording:
            row["au"] = f"aqa/audio/{recording}"
        if re.search(r"See insert", p["text"], re.I):
            row["src"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    order = [bank[k] for k in ("a", "a2", "as", "as2")]
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), r["l"]))
    totals = {}
    for r in rows:
        kind = comps[r["p"]]
        if kind in MAXIMUM:
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != MAXIMUM[comps[k[0]]]}
    print(f"  left out, text blanked: {left_out}", file=sys.stderr)
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = []
    for t in tree:
        if t["section"] in ("grammar",) and not counts.get(t["code"]):
            continue  # a grammar point no scheme has asked for yet would be an empty tile
        # "L’étranger" -> "l-etranger", not "l-tranger": accents folded before the shared slug().
        plain = unicodedata.normalize("NFKD", t["title"]).encode("ascii", "ignore").decode().replace("’", "").replace("'", "")
        entry = {"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": slug(plain), "count": counts.get(t["code"], 0), "year": t["year"]}
        topics.append(entry)
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    sections = [s for s in sections if any(t["section"] == s["code"] for t in topics)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    papers = [{"id": bank[k], "name": PAPER_TITLES[k][0], "title": PAPER_TITLES[k][1], "as": PAPER_TITLES[k][2]} for k in ("a", "a2", "as", "as2") if any(r["p"] == bank[k] for r in rows)]
    meta = {
        "slug": bank["slug"], "board": "AQA", "level": "A-Level", "subject": bank["subject"], "specs": bank["specs"],
        "sections": sections, "topics": topics, "papers": papers,
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[1] in series},
        "noCalc": True, "note": NOTE,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{bank['slug']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", bank["slug"])
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    untagged = [r["id"] for r in rows if not r["t"]]
    print(f"{bank['slug']}: {len(rows)} parts, {len(rows) - len(untagged)} tagged, {sum(1 for r in rows if r.get('ms'))} scheme crops, "
          f"{sum(1 for r in rows if r.get('au'))} with a recording, {len(reports)} reports, papers {[p['id'] for p in papers]}, series {series}"
          + (f"; marks off: {off}" if off else "; every Paper 1's marks add up") + (f"; untagged: {untagged}" if untagged else "")
          + f"; topics with no questions: {[t['code'] for t in topics if not t['count']]}", file=sys.stderr)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    audio = json.load(open(os.path.join(WORK, "audio.map.json")))
    for lang, bank in BANKS.items():
        build(lang, bank, parts, tags, manifest, audio)


if __name__ == "__main__":
    main()
