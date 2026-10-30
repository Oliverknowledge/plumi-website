"""Write the Eduqas GCSE Religious Studies or History bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/eduqas_gcse/build_eduqas_gcse.py rs|history [work-dir]

eduqas_rs/build_eduqas_rs.py for GCSE, in the same shapes. Reads <work-dir>/parts.json
(cut_eduqas_gcse.py), spec.json (spec_eduqas_gcse.py), manifest.json (fetch_eduqas_gcse.py) and
tags.json (tag_eduqas_gcse.py merge). Writes src/content/questionBank/<slug>.json and
public/question-bank/<slug>/{parts,text,reports}.json, where the slug is
eduqas-gcse-religious-studies or eduqas-gcse-history. What differs:
  - Every option is a paper of its own, and the bank's `options` filter keeps a student's:
    Religious Studies' "Religion" is Component 3's faith (the Route A Component 1 and 2 and
    Route B papers stay in every choice); History's "Study" is the kind of option (British
    depth 1A-1D, non-British depth 1E-1H, period 2A-2D, thematic 2E-2H). The sections (the
    specification's themes, faiths and options) carry theirs too, so the topic list follows it.
  - History's sources are a question's stem (`st`), shown above it.
  - Essays: no calculations (noCalc). Reports are by question (a question's parts share one).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SUBJECT = ARGS[0] if ARGS else "rs"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-{SUBJECT}")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import slug  # noqa: E402

MONTH = {"JUN": "June", "OCT": "Autumn"}  # Eduqas calls its October 2020 and November 2021 resits "Autumn"
BOILER = re.compile(r"©\s*WJEC CBAC Ltd\.?|\(C1\d0U\w0-1\)", re.I)
RS_PAPERS = {
    "c120u10": ("Route A Component 1", "Religious, Philosophical and Ethical Studies"), "c120u20": ("Route A Component 2", "Christianity"),
    "c120u30": ("Component 3", "Buddhism"), "c120u40": ("Component 3", "Hinduism"), "c120u50": ("Component 3", "Islam"),
    "c120u60": ("Component 3", "Judaism"), "c120u70": ("Component 3", "Sikhism"),
    "c120u80": ("Route B Component 1", "Foundational Catholic Theology"), "c120u90": ("Route B Component 2", "Applied Catholic Theology"),
}
# How a shared title names its section
WHOSE = {**{f"T{n}": "Route A" for n in range(1, 5)}, **{f"B{n}": "Route B" for n in range(1, 5)},
         "1B": "Elizabethan", "1C": "Britain 1890–1918", "1D": "Britain 1951–79", "1G": "Germany 1919–39", "1H": "USA 1910–29",
         "2A": "USA 1929–2000", "2B": "Germany 1919–91", "2C": "USSR 1924–91", "2D": "UK 1919–90",
         "2E": "crime and punishment", "2F": "health and medicine", "2G": "warfare", "2H": "entertainment and leisure"}
STUDIES = [("british", "British depth study"), ("non-british", "Non-British depth study"), ("period", "Period study"), ("thematic", "Thematic study")]
CONF = {
    "rs": {
        "slug": "eduqas-gcse-religious-studies", "subject": "Religious Studies", "label": "Religion",
        "note": "Route A and Route B (Catholic Christianity) papers. Pick your religion to keep your Component 3 paper with the rest; "
                "Route B's Component 3 is the Judaism paper.",
    },
    "history": {
        "slug": "eduqas-gcse-history", "subject": "History", "label": "Study",
        "note": "Every Component 1 and 2 option (Component 3 is a non-exam assessment). Pick a kind of study, then your option "
                "under Paper; a question's sources are shown above it.",
    },
}[SUBJECT]


def series_rank(s):
    return int("20" + s[3:]) * 100 + (10 if s.startswith("OCT") else 6)


def option_code(comp):
    """History: "c100ug0" -> "1G", "c100u50" -> "2E"."""
    return f"1{comp[5].upper()}" if comp[5] in "abcdefgh" else f"2{'ABCDEFGH'[int(comp[5]) - 1]}"


def own(text):
    """A part's own words: no label ("1. Issues of Relationships (a)", "QUESTION 4"), no marks."""
    text = re.sub(r"[\x00-\x1f]", " ", BOILER.sub(" ", text))
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"^QUESTION \d+\s*", "", text)
    text = re.sub(r"^\d\.\s*(.*?)\s*(?=\([a-e]\))", "", text)  # the number and its theme, before (a)
    text = re.sub(r"^\([a-e]\)\s*", "", text)
    return re.sub(r"\s+", " ", text).strip()


def paper_for(comp, sections):
    if SUBJECT == "rs":
        name, title = RS_PAPERS[comp]
        option = {"c120u30": "bu", "c120u40": "hi", "c120u50": "is", "c120u60": "ju", "c120u70": "si"}.get(comp)
    else:
        code = option_code(comp)
        name, title, option = f"Component {code}", sections[code]["title"], sections[code]["option"]
    return {"id": comp, "name": name, "title": title, "as": False, **({"option": option} if option else {})}


def paper_rank(comp):
    if SUBJECT == "rs":
        return list(RS_PAPERS).index(comp)
    return option_code(comp)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    sections = {s["code"]: s for s in tree["sections"]}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {}).setdefault(f["kind"], f["r2"])
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        words = own(p["text"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        rows.append(row)
        text[p["id"]] = re.sub(r"[\s\x00-\x1f]+", " ", BOILER.sub(" ", " ".join([p.get("stemText", ""), p["text"], p.get("msText", "")]))).lower()
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_rank(r["p"]), int(re.match(r"\d+", r["l"]).group()), r["l"]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    # A title that more than one section has ("The afterlife", "Popular entertainment") names its section: "The afterlife
    # (Judaism)", "Immigration (USA 1910–29)"
    seen = {}
    for t in tree["topics"]:
        seen[t["title"].lower()] = seen.get(t["title"].lower(), 0) + 1
    topics, used = [], set()
    for t in tree["topics"]:
        title = t["title"] if seen[t["title"].lower()] == 1 else f"{t['title']} ({WHOSE.get(t['section']) or sections[t['section']]['title']})"
        s = slug(title)
        assert s not in used and len(s) < 70, s
        used.add(s)
        topics.append({"code": t["code"], "ref": "", "title": title, "section": t["section"], "slug": s,
                       "count": counts.get(t["code"], 0), "year": 0})
    comps = sorted({r["p"] for r in rows}, key=paper_rank)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    options = ([{"id": s["option"], "name": s["title"]} for s in tree["sections"] if s.get("option")] if SUBJECT == "rs"
               else [{"id": k, "name": v} for k, v in STUDIES])
    meta = {
        "slug": CONF["slug"], "board": "Eduqas", "level": "GCSE", "subject": CONF["subject"], "specs": [comps[0][:4].upper()],
        "sections": [{"code": s["code"], "title": s["title"], **({"option": s["option"]} if s.get("option") else {})} for s in tree["sections"]],
        "topics": topics,
        "papers": [paper_for(c, sections) for c in comps],
        "options": {"label": CONF["label"], "list": options},
        "series": [{"id": s, "label": f"{MONTH[s[:3]]} 20{s[3:]}"} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
        "noCalc": True,
        "note": CONF["note"],
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{CONF['slug']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", CONF["slug"])
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{CONF['slug']}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('st'))} with sources, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('er'))} with report comments ({len(reports)} questions), "
          f"{len(comps)} papers, {len(topics)} topics, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
