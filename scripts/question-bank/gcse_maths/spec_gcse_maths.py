"""Read GCSE Maths' topics: the DfE subject content every English board's specification sets out.

    python3 scripts/question-bank/gcse_maths/spec_gcse_maths.py <AQA 8300 specification.pdf> [out]
    # default out: scripts/question-bank/.work/gcse-maths/spec.json

AQA (8300), Pearson Edexcel (1MA1) and OCR (J560) all teach the content the DfE
prescribes for GCSE Mathematics: six areas (Number, Algebra, Ratio, proportion and
rates of change, Geometry and measures, Probability, Statistics) and 97 numbered
statements, N1 to S6. AQA and Pearson print those codes against their content; OCR
numbers its own sections but covers the same statements. So the three banks share one
topic list: the six areas as sections and the statements as topics, read here from
AQA's specification (its own wording, with its notes and the Foundation/Higher column
headings left out), each with a short name of ours for the page title, since the
statements themselves run to a paragraph.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "gcse-maths", "spec.json")
SECTIONS = [
    {"code": "Number", "title": "Number"},
    {"code": "Algebra", "title": "Algebra"},
    {"code": "Ratio", "title": "Ratio, proportion and rates of change"},
    {"code": "Geometry", "title": "Geometry and measures"},
    {"code": "Probability", "title": "Probability"},
    {"code": "Statistics", "title": "Statistics"},
]
SECTION_OF = {"N": "Number", "A": "Algebra", "R": "Ratio", "G": "Geometry", "P": "Probability", "S": "Statistics"}
TITLES = {
    "N1": "Ordering numbers", "N2": "The four operations", "N3": "Order of operations", "N4": "Primes, factors and multiples",
    "N5": "Systematic listing and the product rule", "N6": "Powers and roots", "N7": "Laws of indices",
    "N8": "Exact calculation and surds", "N9": "Standard form", "N10": "Fractions, decimals and recurring decimals",
    "N11": "Fractions in ratio problems", "N12": "Fractions and percentages as operators", "N13": "Units of measure",
    "N14": "Estimation", "N15": "Rounding and error intervals", "N16": "Upper and lower bounds",
    "A1": "Algebraic notation", "A2": "Substitution", "A3": "Expressions, equations, formulae and identities",
    "A4": "Simplifying, expanding and factorising", "A5": "Formulae and changing the subject", "A6": "Identities and algebraic proof",
    "A7": "Functions, inverse and composite functions", "A8": "Coordinates", "A9": "Straight-line graphs",
    "A10": "Gradients and intercepts", "A11": "Quadratic graphs and turning points", "A12": "Recognising and sketching graphs",
    "A13": "Graph transformations", "A14": "Graphs in real contexts", "A15": "Gradients and areas under graphs",
    "A16": "Equation of a circle and tangents", "A17": "Linear equations", "A18": "Quadratic equations",
    "A19": "Simultaneous equations", "A20": "Iteration", "A21": "Forming and solving equations", "A22": "Inequalities",
    "A23": "Generating sequences", "A24": "Special sequences", "A25": "The nth term",
    "R1": "Converting units", "R2": "Scale factors, scale drawings and maps", "R3": "One quantity as a fraction of another",
    "R4": "Ratio notation", "R5": "Sharing in a ratio", "R6": "Multiplicative relationships as ratios",
    "R7": "Proportion as equal ratios", "R8": "Ratios, fractions and linear functions", "R9": "Percentages",
    "R10": "Direct and inverse proportion", "R11": "Compound units: speed, density and pressure",
    "R12": "Comparing lengths, areas and volumes", "R13": "Proportion equations", "R14": "Gradient as a rate of change",
    "R15": "Instantaneous and average rates of change", "R16": "Growth, decay and compound interest",
    "G1": "Geometric terms and notation", "G2": "Constructions and loci", "G3": "Angles and polygons", "G4": "Quadrilaterals",
    "G5": "Congruent triangles", "G6": "Geometric proof", "G7": "Transformations", "G8": "Combined transformations",
    "G9": "Parts of a circle", "G10": "Circle theorems", "G11": "Geometry on coordinate axes", "G12": "Properties of 3D shapes",
    "G13": "Plans and elevations", "G14": "Measures", "G15": "Measuring, scale drawings and bearings",
    "G16": "Area of 2D shapes and volume of prisms", "G17": "Circles, surface area and volume", "G18": "Arcs and sectors",
    "G19": "Similar shapes", "G20": "Pythagoras and trigonometry", "G21": "Exact trigonometric values",
    "G22": "Sine and cosine rules", "G23": "Area of a triangle (½ab sin C)", "G24": "Translation vectors", "G25": "Vectors",
    "P1": "Frequency trees and probability experiments", "P2": "Expected outcomes", "P3": "Relative frequency",
    "P4": "Probabilities that sum to 1", "P5": "Sample size and probability", "P6": "Sets and Venn diagrams",
    "P7": "Sample spaces", "P8": "Combined events and tree diagrams", "P9": "Conditional probability",
    "S1": "Sampling", "S2": "Charts and tables", "S3": "Histograms and cumulative frequency", "S4": "Averages, spread and box plots",
    "S5": "Describing a population", "S6": "Scatter graphs and correlation",
}
NOISE = re.compile(r"^(Basic foundation content|Additional foundation|content|Higher content only|\d+|GCSE Mathematics \(8300\).*|Visit aqa\.org\.uk.*)$")


def main():
    text = "\n".join(p.get_text() for p in pymupdf.open(SPEC))
    text = text[text.find("3.1\t Number"):]
    heads = list(re.finditer(r"\n([NARGPS]\d{1,2})\n", text))
    topics = []
    for n, h in enumerate(heads):
        body = text[h.end():heads[n + 1].start() if n + 1 < len(heads) else text.find("\n", h.end() + 2000)]
        body = re.split(r"\n3\.\d(?:\.\d)?\t", body)[0]
        lines = [l.strip() for l in body.split("\n") if l.strip() and not NOISE.match(l.strip())]
        words = re.sub(r"\s+", " ", " ".join(lines)).split("Notes:")[0]
        words = re.sub(r"\s*(Basic foundation content|Additional foundation content|Higher content only)\s*", " ", words).strip()
        code = h.group(1)
        topics.append({"code": code, "title": TITLES[code], "section": SECTION_OF[code[0]], "text": words})
    assert [t["code"] for t in topics] == list(TITLES), [t["code"] for t in topics]
    json.dump({"sections": SECTIONS, "topics": topics}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"{len(topics)} topics in {len(SECTIONS)} areas", file=sys.stderr)


if __name__ == "__main__":
    main()
