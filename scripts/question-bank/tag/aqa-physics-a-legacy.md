# AQA Physics A legacy (2450)

`aqa_physics_legacy/tag_legacy.py split` writes the 2010–2016 Physics A units (PHYA1, PHYA2,
PHYA4, PHYA5 and its four options, from `aqa_physics_legacy/cut_legacy.py`) to
`.work/phya/tag/`, and `merge` collects them into `.work/phya/tags.json`. The brief is the
one above, with the 7408 specification's topics (`topics.txt`), so the old questions sit
under the topics the bank already has. Each line has the `unit` it comes from, its `setup`,
its own words (`question`, answer lines shown as "…") and the start of its `scheme`, or the
`key` of a multiple-choice question (PHYA4 Section A, whose `question` includes options A–D).

- Tag what the part tests on the current specification. The legacy units map onto it:
  PHYA1 → 3.2 Particles and radiation and 3.5 Electricity; PHYA2 → 3.4 Mechanics and
  materials and 3.3 Waves; PHYA4 → 3.4.1 (momentum and impulse), 3.6.1 (circular motion,
  simple harmonic motion, resonance) and 3.7 Fields (gravitational, electric, capacitance,
  magnetic fields, electromagnetic induction, alternating current, transformers); PHYA5
  Section A → 3.8 Nuclear physics and 3.6.2 Thermal physics; option A Astrophysics → 3.9;
  option B Medical physics → 3.10; option C Applied physics (rotational dynamics,
  thermodynamics and engines) → 3.11 Engineering physics; option D Turning points → 3.12.
  A part that turns on measurement and uncertainty (reading a graph's gradient with its
  uncertainty, percentage uncertainties, precision) may take 3.1.2 as a second code.
- Where 7408's topics are broad, choose by what the part asks: 3.4.1 covers scalars and
  vectors, moments, motion, Newton's laws, momentum, work, energy and power; 3.4.2 density,
  Hooke's law, the Young modulus, stress, strain, elastic strain energy; 3.3.1 wave
  properties, polarisation, superposition and stationary waves; 3.3.2 path difference,
  interference, Young's slits, diffraction gratings, refraction, total internal reflection
  and fibres; 3.2.1 particles, antiparticles, the strong and weak interactions, quarks,
  hadrons, leptons and conservation laws; 3.2.2 the photoelectric effect, energy levels,
  excitation and ionisation, line spectra and wave–particle duality; 3.5.1 current,
  potential difference, resistance, resistivity, superconductivity, circuits, potential
  dividers, emf and internal resistance; 3.7.1 is fields in general (only for a part that
  compares field types); 3.7.2 gravitational fields and orbits; 3.7.3 electric fields;
  3.7.4 capacitance; 3.7.5 magnetic fields, flux, induction, alternating currents and
  transformers; 3.8.1 radioactivity, nuclear radius, mass and energy, fission and fusion.
- A part whose physics is not on the 7408 specification at all gets `[]`, with a short
  reason in `batch-NN.off.json` (`{"<id>": "why"}`). These are left out of the bank and
  counted in the PR. Be strict about this only when the content is genuinely absent from
  7408 (not when it is merely worded differently): check `topics.txt` and the lines above.
- Tag every multiple-choice question on its own, from its stem and options.
