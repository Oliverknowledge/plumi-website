"""WJEC AS/A Level Further Mathematics' topics, from its specification (from 2017), section 2.

Used by tag_wjec.py and build_wjec.py as `further`. A topic's code is its unit and its
place in that unit: the specification's 2.4.3 is 4.3. Unit 2's 2.2.1 and 2.2.2 are each
several subjects under one heading, so they are split at the specification's own
sub-headings (2.1 to 2.5). Every AS unit and Unit 4 are compulsory; at A2 a candidate
sits Unit 5 or Unit 6 (Further Statistics B or Further Mechanics B), the bank's option.
"""
SECTIONS = [
    {"code": "U1", "title": "AS Unit 1: Further Pure Mathematics A"},
    {"code": "U2", "title": "AS Unit 2: Further Statistics A"},
    {"code": "U3", "title": "AS Unit 3: Further Mechanics A"},
    {"code": "U4", "title": "A2 Unit 4: Further Pure Mathematics B"},
    {"code": "U5", "title": "A2 Unit 5: Further Statistics B", "option": "S"},
    {"code": "U6", "title": "A2 Unit 6: Further Mechanics B", "option": "M"},
]
# (code, title, what the specification lists under it)
TOPICS = [
    ("1.1", "Proof by induction", "proof by mathematical induction: sums of series, powers of matrices, divisibility, the binomial theorem for a positive integral power"),
    ("1.2", "Complex numbers and Argand diagrams", "arithmetic of complex numbers, conjugates, roots of quadratic, cubic and quartic equations with real coefficients, Argand diagrams, modulus-argument form, loci such as |z-a|=r and arg(z-a)=θ, transformations w=f(z)"),
    ("1.3", "Matrices and transformations", "matrix arithmetic, transpose, 2x2 determinants and inverses, singular matrices, matrices of transformations in 2-D and 3-D (translation, rotation, reflection), successive transformations, invariant points and lines"),
    ("1.4", "Roots of polynomials and series", "relationship between roots and coefficients up to quartics, forming an equation with transformed roots, sums of integers, squares and cubes, method of differences with partial fractions"),
    ("1.5", "Lines and planes in 3-D", "vector and Cartesian equations of lines and planes, scalar product, angles between lines and planes, intersection of a line and a plane, perpendicular distances between lines, point to line, point to plane"),
    ("2.1", "Discrete random variables and expectation", "mean and variance of discrete distributions, E and Var of linear combinations of independent random variables, E(XY)"),
    ("2.2", "Continuous random variables", "probability density and cumulative distribution functions, median, quartiles and percentiles, mean and variance, expected value of a function E[g(X)]"),
    ("2.3", "Poisson and exponential distributions", "Poisson distribution, Poisson approximation to the binomial, sum of independent Poissons, exponential distribution as a model for intervals between events, their means and variances"),
    ("2.4", "Correlation and regression", "Spearman's rank and Pearson's product-moment correlation coefficients, significance tests, choosing between them, least squares regression line, interpolation and extrapolation"),
    ("2.5", "Chi-squared tests", "goodness of fit tests (binomial, discrete uniform, Poisson), pooling, contingency tables and tests for association"),
    ("3.1", "Momentum, impulse and direct collisions", "momentum and impulse, conservation of momentum, Newton's Experimental Law for direct impact of two bodies and of a body with a plane, in one dimension"),
    ("3.2", "Hooke's law, work, energy and power", "light strings and springs obeying Hooke's law, elastic energy, gravitational potential and kinetic energy, conservation of energy, work-energy principle, power"),
    ("3.3", "Circular motion", "angular speed, radial acceleration, motion in a horizontal circle (conical pendulum, banked tracks, two strings), motion in a vertical circle, loss of contact, complete circles"),
    ("3.4", "Vectors in mechanics", "differentiating and integrating vectors with respect to time, displacement, velocity, acceleration, force and momentum as vectors, resultants, relative motion of two objects and the shortest distance between them"),
    ("4.1", "De Moivre's theorem and roots of unity", "de Moivre's theorem and its proof, multiple angle formulae, sums of series, exponential form re^iθ, nth roots of a complex number, roots of unity, geometric problems"),
    ("4.2", "Further trigonometry", "t = tan(x/2) formulae, general solutions of trigonometric equations, factor formulae, solving trigonometric equations"),
    ("4.3", "3x3 matrices and simultaneous equations", "determinants and inverses of 3x3 matrices, adjugate, scale factors of area and volume, three linear simultaneous equations by inverse matrix and echelon form, unique and non-unique solutions, geometric interpretation as planes"),
    ("4.4", "Maclaurin series and partial fractions", "Maclaurin series including the general term, standard series and their ranges of validity, partial fractions with a quadratic factor"),
    ("4.5", "Further calculus", "improper integrals, volumes of revolution about either axis, mean value of a function, integrating with partial fractions, differentiating inverse trigonometric functions, integrals giving inverse trigonometric functions, trigonometric substitutions"),
    ("4.6", "Polar coordinates", "converting between polar and Cartesian coordinates, sketching curves r=f(θ), tangents parallel or perpendicular to the initial line, area enclosed by a polar curve"),
    ("4.7", "Hyperbolic functions", "definitions, domains and ranges, identities and double angle formulae, differentiating and integrating, inverse hyperbolic functions and their logarithmic forms, integrals using hyperbolic substitutions"),
    ("4.8", "Differential equations", "integrating factors, general and particular solutions, modelling (not mechanics), second order equations with constant coefficients, auxiliary equation, complementary function and particular integral, coupled first order simultaneous equations"),
    ("5.1", "Samples and estimators", "unbiased estimators of a mean, a probability and a variance, standard errors, the variance criterion for choosing between estimators"),
    ("5.2", "Combining normal variables and the Central Limit Theorem", "linear combinations of independent normal random variables, distribution of a sample mean, the Central Limit Theorem"),
    ("5.3", "Hypothesis testing", "tests for a mean with known or estimated variance, difference of two means, Student's t-distribution, Mann-Whitney and Wilcoxon signed-rank tests, choosing a test"),
    ("5.4", "Confidence intervals", "confidence intervals for a normal mean (known or estimated variance), the difference of two means, large-sample approximate intervals for a probability or proportion, interpreting them"),
    ("6.1", "Rectilinear motion with variable force", "equations of motion with acceleration as a function of time, displacement or velocity, v dv/dx, velocity as a function of time or displacement"),
    ("6.2", "Oblique collisions", "momentum and impulse in two dimensions, oblique impact of two spheres, Newton's Experimental Law along the line of centres, loss of kinetic energy"),
    ("6.3", "Moments and centres of mass", "centres of mass of systems of particles, uniform laminae and solids, by symmetry or integration, composite bodies, suspended bodies in equilibrium"),
    ("6.4", "Equilibrium of rigid bodies", "a rigid body under non-parallel coplanar forces, rods against rough or smooth walls and floors, friction, moments"),
    ("6.5", "Differential equations in kinematics and SHM", "first and second order differential equations in kinematics, simple harmonic motion: equation of motion, period, amplitude, displacement formulae, elastic strings and springs, damped motion"),
]


def tree():
    return {"sections": SECTIONS, "topics": [{"code": c, "title": t, "section": "U" + c[0], "text": x} for c, t, x in TOPICS]}
