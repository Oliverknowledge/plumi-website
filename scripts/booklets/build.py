"""Turn the downloaded MadAsMaths booklets into what the site serves (src/content/booklets.ts).

    python3 scripts/booklets/fetch.py                 # the PDFs, from the shared Drive folder
    python3 scripts/booklets/build.py [work-dir]      # this: the list, the previews, the files for R2
    python3 scripts/booklets/upload.py [work-dir]     # put them on R2

Reads <work-dir>/pdf/<folder>/<file>.pdf (fetch.py) and writes:
  src/content/booklets.json                                    the groups and every booklet, read at build time
  <work-dir>/r2/booklets/madasmaths/<group>/<slug>.pdf          the booklet, unmodified
  <work-dir>/r2/booklets/madasmaths/<group>/<slug>-questions.pdf   its questions-only version, where there is one
  <work-dir>/r2/booklets/madasmaths/<group>/<slug>-preview.webp  a preview: the first question, 4:3

Each booklet is a title page, then its questions, each with its difficulty in stars, its answer boxed and
a worked solution beside it. Some also come as a "student version", questions only, which is paired with
the full one ("Questions only"); "_student_version_condense" is the same, set closer. Left out: Drive's
repeat downloads of one file ("… (3).pdf") and the "Coming soon" pages MadAsMaths published for booklets
it hadn't written yet (one page, no text). R2 serves files for a year as immutable, so a changed booklet
needs a new name: add a version to its slug.
"""
import json, os, re, shutil, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")
PDF = os.path.join(WORK, "pdf")
OUT = os.path.join(WORK, "r2", "booklets", "madasmaths")
PREFIX = "booklets/madasmaths"
PREVIEW_WIDTH = 640
PREVIEW_MARGIN = 48  # points either side: MadAsMaths' text starts about 70pt in on a 595pt page

# The Drive folder's groups, in the order a student meets them, and their own folders' shelves.
GROUPS = [
    ("elementary", "Elementary Topics", "Elementary", {"": "Getting started"}),
    ("basic", "Basic Topics", "Basic", {"various": "Pure", "calculus": "Calculus"}),
    ("standard", "Standard Topics", "Standard", {"various": "Pure", "trignometry": "Trigonometry", "integration": "Integration and differential equations"}),
    ("further", "Further Topics", "Further", {"various": "Pure", "linear_algebra": "Matrices and vectors", "integration": "Integration and differential equations"}),
    ("mechanics", "Mechanics", "Mechanics", {"": "Mechanics"}),
    ("statistics", "Statistics", "Statistics", {"": "Statistics"}),
    ("advanced", "Advanced Topics", "Advanced", {"": "Beyond A-Level"}),
]
# File names as published, misspellings and all; the slug and title use the right spelling.
SPELLING = {"diffeentiation": "differentiation", "coodinates": "coordinates", "cordinates": "coordinates",
            "tranformations": "transformations", "trignometry": "trigonometry"}
# Words a title keeps in capitals or as their names are written.
WORDS = {"odes": "ODEs", "pdes": "PDEs", "3d": "3D", "i": "I", "ii": "II", "iii": "III", "1": "1", "2": "2",
         "bessel": "Bessel", "fourier": "Fourier", "laplace": "Laplace", "legendre": "Legendre", "leibniz": "Leibniz",
         "heaviside": "Heaviside", "poisson": "Poisson", "r": "R", "t": "t", "d": "D", "a": "A", "b": "B"}
# Where the file name doesn't make a good title on its own.
TITLES = {
    "m3_m5_s.h.m": "Simple harmonic motion",
    "t_distribution": "The t-distribution",
    "z_transforms": "Z-transforms",
    "d_operator": "The D operator",
    "1st_order_differential_equations_exam_questions": "First order differential equations",
    "1st_order_differential_equations_practice": "First order differential equations",
    "1st_order_differential_equations_substitutions": "First order differential equations by substitution",
    "2nd_order_differential_equations_exam_questions": "Second order differential equations",
    "2nd_order_differential_equations_practice": "Second order differential equations",
    "2nd_order_differential_equations_substitutions": "Second order differential equations by substitution",
    "trigonometry_r_transformations": "Trigonometry: R transformations",
    "trigonometric_identities_with_solutions": "Trigonometric identities",
    "integration_indefinite_megamix": "Indefinite integration megamix",
    "integration_definite_megamix": "Definite integration megamix",
    "integration_indefinite_mix": "Indefinite integration mix",
    "odes_systematic_1": "ODEs, systematic methods I",
    "odes_systematic_2": "ODEs, systematic methods II",
    "odes_various": "ODEs, various methods",
    "odes_context_modelling": "Differential equations in context",
    "odes_separable_no_context": "Separable differential equations",
    "pdes_general_introduction": "PDEs: an introduction",
    "pdes_general_applied": "PDEs: applications",
    "pdes_integral_tranformations": "PDEs by integral transforms",
    "pdes_the_heat_equation": "PDEs: the heat equation",
    "pdes_the_laplace_equation": "PDEs: Laplace's equation",
    "leibniz_rule_diffeentiation": "Leibniz's rule for differentiation",
    "big_integral_theorems": "The big integral theorems",
    "residues_and_applications_in_integration": "Residues: applications in integration",
    "residues_and_applications_in_series_summation": "Residues: applications in series summation",
    "equations_exam_questions_i": "Equations",
    "polynomials_exam_questions_intro": "Polynomials, an introduction",
    "polynomials_practice_intro": "Polynomials, an introduction",
    "integration_areas_intro": "Areas by integration, an introduction",
    "integration_intro": "Integration, an introduction",
    "calculus_introduction_exam_questions": "Calculus, an introduction",
    "differentiation_optimization_problems": "Optimisation problems",
    "integration_by_a_special_manipulation": "Integration by a special manipulation",
    "integration_structured_exam_questions_part_i": "Integration, structured questions I",
    "integration_structured_exam_questions_part_ii": "Integration, structured questions II",
    "parametric_integration_exam_questions": "Parametric integration",
    "practical_arithmetic_problem_solving": "Practical arithmetic and problem solving",
    "trigonometry_introduction_exam_equations": "Trigonometric equations, an introduction",
    "jacobians_and_curvilinear_coodinates": "Jacobians and curvilinear coordinates",
    "multivariable_integration_in_cartesian": "Multivariable integration in Cartesian coordinates",
    "multivariable_integration_in_polars": "Multivariable integration in polar coordinates",
    "multivariable_integration_in_spherical_polars": "Multivariable integration in spherical polar coordinates",
    "m4_m6_polar_cordinates_and_central_forces": "Polar coordinates and central forces",
    "m1_m2_kinematics_using_calculus": "Kinematics using calculus",
    "m3_m4_kinematics_dynamics_easier_odes": "Kinematics and dynamics with differential equations I",
    "m4_m6_kinematics_dynamics_harder_odes": "Kinematics and dynamics with differential equations II",
    "m2_m4_frameworks_multistructures": "Frameworks and multi-body structures",
    "m4_m5_moment_of_inertia_calculations": "Moments of inertia",
    "m4_m6_equilibrium_and_potential_energy": "Equilibrium and potential energy",
    "m2_m3_elastic_strings_springs": "Elastic strings and springs",
    "m3_m6_advanced_projectiles": "Projectiles, advanced",
    "m1_m2_projectiles": "Projectiles",
    "differentiation_practice_ii_exam_questions": "Differentiation II, more",
    "equations_exam_questions_i": "Equations I",
    "integration_further_applications": "Further applications of integration",
    "laplace_transforms_applications": "Laplace transforms: applications",
    "laplace_transforms_further": "Laplace transforms: further",
    "laplace_transforms_introduction": "Laplace transforms: an introduction",
    "partial_differentiation_applications": "Partial differentiation: applications",
    "partial_differentiation_introduction": "Partial differentiation: an introduction",
    "odes_series_solutions": "ODEs: series solutions",
    "arclength_surface_of_revolution": "Arc length and surfaces of revolution",
    "differential_equations_numerical_methods": "Numerical methods for differential equations",
    "vector_exam_questions_part_a": "Vectors A",
    "vector_practice_part_a": "Vectors A",
    "proof_general": "Proof",
    "series_mixed_exam_questions": "Series, mixed",
    "surd_exam_questions": "Surds",
    "inequalities_basic_practice": "Inequalities, the basics",
    "equations_basic_techniques": "Equations: basic techniques",
    "vector_algebra_introduction": "Vector algebra, an introduction",
    "integration_areas": "Areas by integration",
    "integration_basics": "Integration: the basics",
    "integration_numerical": "Numerical integration",
    "integration_partial_fractions": "Integration by partial fractions",
    "integration_volume_of_revolution": "Volumes of revolution",
    "trigonometric_equations_introduction": "Trigonometric equations, an introduction",
    "trigonometry_introduction_exam_equations": "Trigonometric equations, introductory exam questions",
    "trigonometry_compound_angle_identities": "Compound angle identities",
    "trigonometry_double_angle_identities": "Double angle identities",
    "trigonometry_minor_trig_ratios": "Sec, cosec and cot",
    "trigonometry_pythagorean_identities": "Pythagorean identities",
    "trigonometric_inverse_functions": "Inverse trigonometric functions",
    "exponentials_logarithms_exam_questions": "Exponentials and logarithms",
    "exponentials_logarithms_practice": "Exponentials and logarithms",
    "function_exam_questions": "Functions",
    "function_practice": "Functions",
    "hypothesis_testing_introduction": "Hypothesis testing, an introduction",
    "hypothesis_testing_normal_distribution": "Hypothesis testing with the normal distribution",
    "sketching_in_3_dimensions": "Sketching in three dimensions",
    "diagonalization_of_conics_and_quadrics": "Diagonalisation of conics and quadrics",
    "linearization_of_graphs": "Linearisation of graphs",
    "parameterization": "Parameterisation",
    "matrix_row_reducing": "Row reduction of matrices",
    "heaviside_function": "The Heaviside function",
    "impulse_function": "The impulse function",
    "fourier_transform": "Fourier transforms",
    "m1_vectors_applications": "Vectors in mechanics",
    "geometric_series_worded_questions": "Geometric series, worded questions",
    "discriminant_exam_questions": "The discriminant",
    "discriminant_practice": "The discriminant",
    "3d_geometric_mensuration": "Mensuration in three dimensions",
    "geometric_mensuration": "Mensuration",
    "advanced_mensuration": "Mensuration, advanced",
    "proportion_samples": "Sampling proportions",
    "normal_distribution_calculations": "Normal distribution calculations",
}
KIND = [("_exam_questions_part_", "Exam questions"), ("_exam_questions", "Exam questions"), ("_practice", "Practice")]
STARS = re.compile(r"\((\*{1,6})\+?\)")
QUESTION = re.compile(r"^Question\s+(\d{1,3})\b", re.M)
# The mixes and the identities booklet number their questions "1.", "2.", … at the start of a line instead.
NUMBERED = re.compile(r"^(\d{1,3})\.(?:\s|$)", re.M)


def fix(name):
    for wrong, right in SPELLING.items():
        name = name.replace(wrong, right)
    return name


def title_and_kind(base):
    """("Logarithms", "Exam questions") for logarithms_exam_questions; mechanics' module codes come off as `modules`."""
    modules = []
    m = re.match(r"((?:m\d_)+)(.+)", base)
    name = base
    if m:
        modules = [c.upper() for c in m.group(1).strip("_").split("_")]
        name = m.group(2)
    kind = next((label for suffix, label in KIND if suffix in name and not name.startswith("integration_structured")), None)
    if base in TITLES:
        return TITLES[base], kind, modules
    words = fix(name)
    for suffix, _ in KIND:
        words = words.replace(suffix, "_")
    part = "_part_" in name
    words = [w for w in words.split("_") if w and w not in ("part", "intro")]
    if part:
        words[-1] = words[-1].upper()
    out = [WORDS.get(w, w) for w in words]
    title = " ".join(out)
    return title[:1].upper() + title[1:], kind, modules


def slug_of(base):
    return re.sub(r"[^a-z0-9]+", "-", fix(base).lower()).strip("-")


def read(path):
    """Pages, questions, the difficulty range in stars, and whether it's a placeholder (one page, no words)."""
    doc = pymupdf.open(path)
    text = "\n".join(p.get_text() for p in doc)
    numbers = [int(n) for n in QUESTION.findall(text)] or [int(n) for n in NUMBERED.findall(text)]
    stars = [len(s) for s in STARS.findall(text)]
    return {"doc": doc, "pages": len(doc), "questions": max(numbers) if numbers else 0,
            "stars": [min(stars), max(stars)] if stars else None, "placeholder": len(doc) <= 1 and not text.strip()}


def preview(doc, dest):
    """The first question, as a 4:3 WebP: cut from the first page with a question on it (the title page says only
    the booklet's name), from just above the question's first line, past the "Created by" line every page repeats,
    across the text's width, so a card shows the question itself."""
    def first_line(page, pattern):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if pattern.match(text + " "):
                    return line["bbox"][1]
        return None
    for pattern in (QUESTION, NUMBERED):
        hit = next(((p, y) for p in doc if (y := first_line(p, pattern)) is not None), None)
        if hit:
            break
    page, top = hit if hit else (doc[min(1, len(doc) - 1)], 60)
    width = page.rect.width - 2 * PREVIEW_MARGIN
    clip = pymupdf.Rect(PREVIEW_MARGIN, max(0, top - 14), PREVIEW_MARGIN + width, max(0, top - 14) + width * 3 / 4)
    zoom = PREVIEW_WIDTH / width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=False)
    from PIL import Image  # noqa: PLC0415
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.save(dest, "WEBP", quality=74, method=6)
    return img.width, img.height


def main():
    rows = json.load(open(os.path.join(HERE, "drive-files.json")))
    shutil.rmtree(OUT, ignore_errors=True)
    groups, skipped, seen = [], [], set()
    for gslug, folder, name, shelves in GROUPS:
        group = {"slug": gslug, "name": name, "shelves": []}
        for sub, shelf_name in shelves.items():
            path_folder = f"{folder}/{sub}" if sub else folder
            files = sorted(r["file"] for r in rows if r["folder"] == path_folder)
            bases = [f[:-4] for f in files if f.endswith(".pdf")]
            students = {b: b for b in bases if "_student_version" in b}
            shelf = {"name": shelf_name, "booklets": []}
            for base in bases:
                if base in students:
                    continue
                if re.search(r" \(\d+\)$", base):
                    skipped.append(f"{path_folder}/{base}.pdf: a repeat download of {re.sub(r' \(\d+\)$', '', base)}.pdf")
                    continue
                src = os.path.join(PDF, path_folder, base + ".pdf")
                info = read(src)
                if info["placeholder"]:
                    skipped.append(f"{path_folder}/{base}.pdf: a \"Coming soon\" page")
                    continue
                if not info["questions"]:
                    skipped.append(f"{path_folder}/{base}.pdf: no questions found ({info['pages']} pages)")
                    continue
                slug = slug_of(base)
                assert slug not in seen, f"two booklets share the slug {slug}"
                seen.add(slug)
                title, kind, modules = title_and_kind(base)
                os.makedirs(os.path.join(OUT, gslug), exist_ok=True)
                shutil.copyfile(src, os.path.join(OUT, gslug, slug + ".pdf"))
                w, h = preview(info["doc"], os.path.join(OUT, gslug, slug + "-preview.webp"))
                booklet = {"slug": slug, "title": title, "pages": info["pages"], "questions": info["questions"],
                           "bytes": os.path.getsize(src), "preview": [w, h]}
                if kind:
                    booklet["kind"] = kind
                if modules:
                    booklet["modules"] = modules
                if info["stars"]:
                    booklet["stars"] = info["stars"]
                student = next((s for s in (f"{base}_student_version", f"{base}_student_version_condense") if s in students), None)
                if student:
                    qsrc = os.path.join(PDF, path_folder, student + ".pdf")
                    shutil.copyfile(qsrc, os.path.join(OUT, gslug, slug + "-questions.pdf"))
                    booklet["questionsOnly"] = {"pages": pymupdf.open(qsrc).page_count, "bytes": os.path.getsize(qsrc)}
                shelf["booklets"].append(booklet)
            for s in students:
                if not any(s.startswith(b + "_student_version") for b in bases if b not in students):
                    skipped.append(f"{path_folder}/{s}.pdf: a questions-only version with no full booklet")
            shelf["booklets"].sort(key=lambda b: (b["title"].lower(), b.get("kind") or ""))
            group["shelves"].append(shelf)
        groups.append(group)
    out = {"source": "https://www.madasmaths.com", "prefix": PREFIX, "groups": groups}
    json.dump(out, open(os.path.join(ROOT, "src", "content", "booklets.json"), "w"), ensure_ascii=False, indent=1)
    n = sum(len(s["booklets"]) for g in groups for s in g["shelves"])
    print(f"{n} booklets, {sum(b['questions'] for g in groups for s in g['shelves'] for b in s['booklets'])} questions; "
          + ", ".join(f"{g['name']} {sum(len(s['booklets']) for s in g['shelves'])}" for g in groups), file=sys.stderr)
    for line in skipped:
        print("  left out:", line, file=sys.stderr)


if __name__ == "__main__":
    main()
