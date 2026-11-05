# AQA GCSE Psychology

`aqa_gcse_psychology/tag_gcse_psychology.py split` writes batches of AQA GCSE Psychology
(8182) questions to `.work/aqa-gcse-psychology/tag/`, and `merge` collects them. The brief
is the one in `tag.md`, with these differences:

- `gcse-psychology-topics.txt` lists one topic per line: `code | area | title — what the
  specification says beside it`. Codes have four numbers (`3.1.2.4`); never an area like
  `3.1.2`. Two rows of the specification share their words (3.2.2.1 and 3.2.2.2, 3.2.4.1 and
  3.2.4.2, 3.1.3.2 and 3.1.3.3, 3.2.4.5 and 3.2.4.6, 3.2.4.8 and 3.2.4.9): choose by the
  title.
- Each line is a question or part with its `paper`, `marks`, the `setup` it is set on (a
  scenario or table), its own words and the start of its scheme. Multiple-choice questions
  carry their answer as `scheme` ("Answer: C and E").
- Any code is allowed on either paper. Paper 1 is mostly 3.1 (Memory, Perception,
  Development, Research methods), Paper 2 mostly 3.2 (Social influence; Language, thought and
  communication; Brain and neuropsychology; Psychological problems), but research methods
  is examined in both and each paper's synoptic 9-mark question draws on the other's content.
- A research-methods question set in a topic's context ("identify the experimental design",
  "calculate the mean", "write a hypothesis" about a memory study) gets its research-methods
  topic; add the context's topic second only when the answer needs knowledge of it too.
  A "design a study to investigate X" question is `3.1.4.4` Designing research (or the
  research-methods topic its bullets mostly ask for), with X's topic second.
- Where things live: encoding, storage, retrieval, episodic, semantic, procedural `3.1.1.1`;
  multi-store model, coding, capacity, duration, primacy and recency, Murdock `3.1.1.2`;
  reconstructive memory, Bartlett, interference, context, false memories `3.1.1.3`;
  sensation versus perception `3.1.2.1`; depth cues, retinal disparity, convergence `3.1.2.2`;
  Gibson, motion parallax `3.1.2.3`; illusions (Ponzo, Muller-Lyer, Rubin's vase, Ames room,
  Kanizsa, Necker cube) and their explanations `3.1.2.4`; Gregory `3.1.2.5`; perceptual set,
  culture, motivation, emotion, expectation, Gilchrist and Nesberg, Bruner and Minturn
  `3.1.2.6`; early brain development, nature and nurture `3.1.3.1`; Piaget's stages,
  assimilation, accommodation, conservation, egocentrism, McGarrigle and Donaldson, Hughes
  `3.1.3.2`; Piaget in education, readiness `3.1.3.3`; Dweck's mindset, praise, self-efficacy,
  learning styles, Willingham `3.1.3.4`; hypotheses `3.1.4.1`; variables `3.1.4.2`; sampling
  `3.1.4.3`; experiments, experimental designs, interviews, questionnaires, case studies,
  observations `3.1.4.4`; correlation, scatter diagrams `3.1.4.5`; standardised procedures,
  randomisation, counterbalancing, extraneous variables `3.1.4.6`; reliability, validity,
  pilot studies `3.1.4.7`; ethics `3.1.4.8`; quantitative and qualitative data `3.1.4.9`;
  primary and secondary data `3.1.4.10`; fractions, percentages, ratios, decimals,
  significant figures, estimates `3.1.4.11`; mean, median, mode, range `3.1.4.12`; tables,
  bar charts, histograms, drawing graphs `3.1.4.13`; normal distribution `3.1.4.14`;
  conformity, Asch `3.2.1.1`; obedience, Milgram, authoritarian personality `3.2.1.2`;
  bystanders, Piliavin `3.2.1.3`; crowds, deindividuation, social loafing `3.2.1.4`;
  Piaget and Sapir-Whorf on language and thought `3.2.2.1`, its effects on recall and colour
  recognition `3.2.2.2`; animal communication, von Frisch `3.2.2.3`; non-verbal communication,
  eye contact, body language, personal space `3.2.2.4`; Darwin, innate or learned non-verbal
  behaviour, Yuki `3.2.2.5`; nervous system divisions, fight or flight, James-Lange
  `3.2.3.1`; neurons, synapses, Hebb `3.2.3.2`; lobes, cerebellum, localisation, Penfield
  `3.2.3.3`; neuropsychology, scanning, Tulving, brain damage `3.2.3.4`; what mental health
  is, cultural beliefs, stigma `3.2.4.1` and how its incidence changes `3.2.4.2`; effects on
  individuals and society `3.2.4.3`; depression's characteristics and ICD `3.2.4.4`, its
  theories `3.2.4.5`, its treatments, antidepressants, CBT, Wiles `3.2.4.6`; addiction's
  characteristics `3.2.4.7`, its theories, Kaij, peer influence `3.2.4.8`, its treatments,
  aversion therapy, self-management `3.2.4.9`.
