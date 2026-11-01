"""Read International GCSE Mathematics A's (4MA1) topics from Pearson's specification.

    python3 scripts/question-bank/edexcel_igcse_maths/spec_igcse_maths.py <international-gcse-in-mathematics-spec-a.pdf> [out]
    # default out: scripts/question-bank/.work/edexcel-igcse-maths/spec.json
    # the PDF: qualifications.pearson.com, International GCSE > Mathematics A (2016) > Specification and sample assessments

4MA1 is not the DfE's GCSE content (N1 to S6), so the bank takes the specification's own: six areas
(1 Numbers and the number system … 6 Statistics and probability) and their 39 numbered topics, 1.1
Integers to 6.3 Probability, under Pearson's names. The specification sets the Foundation tier's content
out first and then what the Higher tier adds, topic by topic ("1.4 Powers and roots: See Foundation Tier"
or more): a topic's text is both, for tagging.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-igcse-maths", "spec.json")
SECTIONS = [
    {"code": "1", "title": "Numbers and the number system"},
    {"code": "2", "title": "Equations, formulae and identities"},
    {"code": "3", "title": "Sequences, functions and graphs"},
    {"code": "4", "title": "Geometry and trigonometry"},
    {"code": "5", "title": "Vectors and transformation geometry"},
    {"code": "6", "title": "Statistics and probability"},
]
# The tiers' content pages (0-based): Foundation, then Higher, each to the end of 6.3 Probability.
TIERS = {"Foundation": range(16, 32), "Higher": range(34, 46)}
NOISE = re.compile(r"^(Pearson Edexcel International GCSE.*|Specification – Issue.*|\d{1,2}|Students should be taught to:|Notes|"
                   r"AO\d.*|[1-6]|Numbers and the number system|Equations, formulae and identities|Sequences, functions and graphs|"
                   r"Geometry( and trigonometry)?|Vectors and transformation geometry|Statistics and probability)$")


def topics_of(doc, pages):
    """{code: (title, words)} for one tier's pages."""
    lines = [l.strip() for i in pages for l in doc[i].get_text().split("\n")]
    lines = [l for l in lines if l and not NOISE.match(l)]
    out, code = {}, None
    for n, l in enumerate(lines):
        m = re.fullmatch(r"([1-6]\.\d{1,2})", l)
        if m and n + 1 < len(lines) and re.match(r"[A-Z][a-z]|3D", lines[n + 1]):
            code = m.group(1)
            title = []
            for t in lines[n + 1:]:
                # (a Higher-only topic's Foundation entry is its title and "Higher Tier only", then the next topic's code)
                if re.match(r"(See Foundation Tier|Higher Tier only|[A-J] |[1-6]\.\d{1,2}$)", t) or t == "I":
                    break
                title.append(t)
            out[code] = [" ".join(title), []]
        elif code:
            out[code][1].append(l)
    return {c: (title, re.sub(r"\s+", " ", " ".join(words))) for c, (title, words) in out.items()}


def main():
    doc = pymupdf.open(SPEC)
    found = {tier: topics_of(doc, pages) for tier, pages in TIERS.items()}
    topics = []
    for code, (title, words) in found["Foundation"].items():
        words = words[len(title):].strip() if words.startswith(title) else words
        higher = found["Higher"].get(code, ("", ""))[1]
        higher = higher[len(title):].strip() if higher.startswith(title) else higher
        if words.startswith("Higher Tier only"):
            text = f"Higher tier only: {higher}"
        else:
            text = words + ("" if higher.startswith("See Foundation Tier") else f" Higher tier: {higher}")
        topics.append({"code": code, "title": title, "section": code.split(".")[0], "text": text})
    assert len(topics) == 39 and [t["code"] for t in topics][-1] == "6.3", [t["code"] for t in topics]
    json.dump({"sections": SECTIONS, "topics": topics}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"{len(topics)} topics in {len(SECTIONS)} areas", file=sys.stderr)


if __name__ == "__main__":
    main()
