# OCR B sciences

`ocr/tag_ocr.py split --b` writes batches for OCR's A-Level Biology B (Advancing
Biology, H422 and AS H022), Chemistry B (Salters, H433 and AS H033) and Physics B
(Advancing Physics, H557 and AS H157) to `.work/ocr-b-sciences/tag/`, and `merge --b`
collects them. The brief is the one in `tag.md` with the OCR section's differences
(`paper`, [AS] topics, Module 1 practical skills tagged to their content), and these:

- **Biology B** topics are numbered as Biology A's (`3.2.2 The immune system`). AS is
  Modules 2 and 3.
- **Chemistry B** is taught through storylines, and its topics are the chemical ideas
  under each one: `EL.2 | EL Elements of life | Atomic structure (EL(e)–(h))`. Codes are
  the storyline and a number (`EL.2`, `CI.1`); the letters in brackets are the
  learning outcomes the topic covers. The same idea comes up in several storylines
  (Kinetics in DF, OZ, CI and PL; Energy and matter in five), so read what each one's
  outcomes say and choose the storyline that teaches what the marks need, whatever
  the question's context: rate equations and orders are `CI.1`, catalysts `DF.4`,
  activation enthalpy and the Boltzmann distribution `OZ.2`, enzymes `PL.2`, Kc and moving
  an equilibrium `ES.4`, Kc with units, temperature's effect on K and operating
  conditions `CI.2`, pH, Ka and buffers `O.2`. AS papers only take the
  AS storylines (EL, DF, ES, OZ, WM).
- **Physics B** topics are its numbered units (`3.1.2 Sensing`, `4.2 Space, time and
  motion`, `5.1.1 Creating models`), plus `2.0 Fundamental data analysis`: uncertainty,
  accuracy and precision, resolution and sensitivity, plots, best-fit lines and
  uncertainty bars. Give `2.0` to a part that tests handling data or uncertainty
  itself; a part that uses an experiment's data to test physics gets that physics.
- **Paper 2** (Scientific literacy) is set partly on an advance notice article the
  candidates have read; tag the content the part tests, not the article. **Paper 3**
  (Practical skills) gets the content its experiment is about.
