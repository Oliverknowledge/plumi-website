"""Read Level 2 Further Maths' topics from AQA's 8365 specification.

    python3 scripts/question-bank/aqa_l2_further_maths/spec_l2fm.py <AQA-8365-SP-2018.PDF> [out]
    # default out: scripts/question-bank/.work/aqa-l2fm/spec.json
    # the specification: https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-8365-SP-2018.PDF

The specification sets its content out in six areas (Number, Algebra, Coordinate Geometry,
Calculus, Matrix Transformations, Geometry), each a table of numbered statements, 1.1 to
6.10: those are the sections and topics. Each statement's words and AQA's notes beside it
(read here, for tagging) run to a paragraph, so each has a short name of ours for the page.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-l2fm", "spec.json")
SECTIONS = [
    {"code": "Number", "title": "Number"},
    {"code": "Algebra", "title": "Algebra"},
    {"code": "Coordinate geometry", "title": "Coordinate geometry"},
    {"code": "Calculus", "title": "Calculus"},
    {"code": "Matrices", "title": "Matrix transformations"},
    {"code": "Geometry", "title": "Geometry and trigonometry"},
]
TITLES = {
    "1.1": "Number, fractions, percentages and ratio", "1.2": "The product rule for counting", "1.3": "Surds",
    "2.1": "Basic algebra", "2.2": "Functions", "2.3": "Domain and range", "2.4": "Composite functions", "2.5": "Inverse functions",
    "2.6": "Expanding brackets", "2.7": "Binomial expansion", "2.8": "Factorising", "2.9": "Algebraic fractions",
    "2.10": "Rearranging formulae", "2.11": "The factor theorem", "2.12": "Completing the square",
    "2.13": "Sketching and interpreting graphs", "2.14": "Linear and quadratic equations", "2.15": "Simultaneous equations",
    "2.16": "Simultaneous equations in three unknowns", "2.17": "Inequalities", "2.18": "Index laws", "2.19": "Algebraic proof",
    "2.20": "Using the nth term", "2.21": "The nth term of a linear sequence", "2.22": "The nth term of a quadratic sequence",
    "3.1": "Gradients", "3.2": "Parallel and perpendicular lines", "3.3": "The distance between two points",
    "3.4": "Dividing a line in a ratio", "3.5": "The equation of a straight line", "3.6": "Drawing straight lines",
    "3.7": "Circles centred at the origin", "3.8": "The equation of a circle", "3.9": "Tangents to a circle",
    "4.1": "The gradient function", "4.2": "The gradient of a curve", "4.3": "Differentiating powers of x",
    "4.4": "Tangents and normals to a curve", "4.5": "Increasing and decreasing functions", "4.6": "The second derivative",
    "4.7": "Stationary points", "4.8": "Maxima and minima problems", "4.9": "Sketching curves from their turning points",
    "5.1": "Multiplying matrices", "5.2": "The identity matrix", "5.3": "Transformations of the unit square",
    "5.4": "Combined transformations",
    "6.1": "Perimeter and area", "6.2": "Geometric proof", "6.3": "Sine and cosine rules", "6.4": "Pythagoras in 2D and 3D",
    "6.5": "Trigonometry in 2D and 3D problems", "6.6": "Graphs of sin, cos and tan", "6.7": "Trigonometric ratios of any angle",
    "6.8": "Exact trigonometric values", "6.9": "Trigonometric identities", "6.10": "Trigonometric equations",
}
NOISE = re.compile(r"^(AQA Level 2 Certificate in Further Maths.*|\d+\s+Visit aqa\.org\.uk.*|Ref|Content|Notes|\d+)$")


def main():
    text = "\n".join(p.get_text() for p in pymupdf.open(SPEC))
    text = text[text.find("1.\nNumber\nRef"):]
    text = text[:text.find("\n4. \nScheme of assessment")] if "\n4. \nScheme of assessment" in text else text
    heads = [m for m in re.finditer(r"\n([1-6]\.\d{1,2})(?=\s)", text) if m.group(1) in TITLES]
    topics, seen = [], set()
    for n, h in enumerate(heads):
        code = h.group(1)
        if code in seen:
            continue
        seen.add(code)
        body = text[h.end():heads[n + 1].start() if n + 1 < len(heads) else len(text)]
        body = re.split(r"\n[2-6]\.\s*\n", body)[0]  # the next area's heading
        lines = [l.strip() for l in body.split("\n") if l.strip() and not NOISE.match(l.strip())]
        topics.append({"code": code, "title": TITLES[code], "section": SECTIONS[int(code[0]) - 1]["code"],
                       "text": re.sub(r"\s+", " ", " ".join(lines)).strip()})
    assert [t["code"] for t in topics] == list(TITLES), [t["code"] for t in topics]
    json.dump({"sections": SECTIONS, "topics": topics}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"{len(topics)} topics in {len(SECTIONS)} areas", file=sys.stderr)


if __name__ == "__main__":
    main()
