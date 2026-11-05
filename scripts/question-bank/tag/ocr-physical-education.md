# OCR Physical Education

`ocr_pe/tag_ocr_pe.py split` writes batches of OCR A-Level (H555) Physical Education parts to
`.work/ocr-pe/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with these differences:

- `pe-topics.txt` lists the specification's topic areas: `code | section | title [AS] or [A-Level only] — what
  students should know`. The specification doesn't number its topic areas, so the codes are the section's
  (`1.1` Applied anatomy and physiology, `1.2` Exercise physiology, `1.3` Biomechanics, `2.1` Skill acquisition,
  `2.2` Sports psychology, `3.1` Sport and society, `3.2` Contemporary issues in physical activity and sport) and
  the area's place in it: `1.1.6` is Cardiovascular system at rest. Choose from these codes, never a section like
  `1.1`.
- Each line has its `paper` ("A-Level 1") and `marks`. Paper 1 is `1.x`, Paper 2 `2.x`, Paper 3 `3.x`.
- A part that gives a table or figure (a pull up, a free throw, a graph of angular motion) is tagged by what it
  asks about, not by the activity it shows: "Analyse the movement at the elbow" is `1.1.1` or `1.1.3`, not the
  sport.
- The 20 mark Paper 1 essay ("9*") and the 10 mark essays on Papers 2 and 3 ("8*") name two or three topics in
  their wording ("Explain and evaluate the use of SALTAPS and PRICE…"): give the main one first and the second only
  where the scheme's indicative content takes about as much from it.
- Common confusions: the energy systems are `1.1.11` and their contribution at different intensities `1.1.12`
  (ATP itself `1.1.10`); EPOC and the recovery system `1.1.13`; the heat and altitude `1.1.14`, `1.1.15`; ergogenic
  aids (blood doping, IHT, creatine, caffeine) `1.2.2`, not altitude training; VO2 max and aerobic capacity
  `1.2.3`; flexibility `1.2.5`; periodisation `1.2.6`; training and lifestyle diseases `1.2.7`; the planes and axes
  of movement are `1.1.1`, while the axes of rotation of a somersault belong to angular motion `1.3.5`; ground
  reaction force, Newton's laws and net force `1.3.1`; levers `1.3.2`; air resistance and drag (the factors that
  affect them) `1.3.6`; projectile range and release factors, the parallelogram of forces, flight paths, lift and
  Bernoulli's principle, and spin and the Magnus effect `1.3.7`; motor units and the sliding filament's nerve stimulation
  `1.1.4`; the types of memory `2.1.8`; guidance (visual, verbal, manual, mechanical) `2.1.6`, feedback `2.1.7`;
  personality, attitudes, motivation, arousal and anxiety `2.2.1`; leadership `2.2.6`; the Olympic Games and other
  global events `3.1.2`; commercialisation, the media and technology `3.2.2` and `3.2.4`.
