# Edexcel GCSE Geography B

`edexcel_gcse_geography/tag_gcse_geography.py split` writes batches of Pearson Edexcel GCSE
Geography B (1GB0) parts to `.work/edexcel-gcse-geography/tag/`, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `geography-b-topics.txt` lists one key idea per line: `code | topic | title — the
  specification's detailed content`. Codes are the specification's numbered key ideas (`1.4`
  tropical cyclones' causes, `2.5` globalisation in the emerging country, `4.6` river
  landscapes); Topic 6's four fieldwork contexts, which the specification doesn't number, are
  `6.1` coasts, `6.2` rivers, `6.3` urban, `6.4` rural.
- **Each line says which codes it may take**: `first` (the key ideas of the topic its question
  is in, fixed by paper and number) and `second`. merge rejects anything else. Give a second
  code only when it adds something.
- Each line has its `paper` and section. Paper 1: Question 1 Hazardous Earth, 2 Development
  dynamics, 3 Challenges of an urbanising world. Paper 2: Section A (Questions 1-4) the UK's
  physical landscape (1 the overview, 2 coasts, 3 rivers, 4 an 8-mark question on either),
  Section B (5-7) the human landscape, Section C1 (8 or 9) physical fieldwork, C2 (10 or 11)
  human fieldwork. Paper 3: Section A (Question 1) People and the biosphere, B (2) Forests
  under threat, C (3) Consuming energy resources, D (4) the 12-mark decision.
- Within a topic, tag the content the part tests, by the scheme: the global circulation and
  climate graphs `1.1`, natural climate change and its evidence `1.2`, human-caused change and
  projections `1.3`; tropical cyclones' characteristics and formation `1.4`, their hazards and
  vulnerability `1.5`, preparation and response `1.6`; Earth's structure and convection `1.7`,
  plate boundaries, volcano and earthquake types `1.8`, impacts and management `1.9`.
  Development indicators and demographic data `2.1`, causes of inequality, Rostow and Frank
  `2.2`, top-down and bottom-up, NGOs, IGOs, TNCs `2.3`; the emerging country case study
  (India, China, Nigeria…) `2.4`-`2.7` by what it asks. World urbanisation trends `3.1`, its
  causes and economic sectors `3.2`, land use change in cities `3.3`; the megacity case study
  (Mumbai, Lagos, Jakarta…) `3.4`-`3.7`. UK geology, relief and climate `4.1`-`4.2`, coastal
  processes and landforms `4.3`, human activity at the coast `4.4`, coastal flooding and
  management `4.5`, river processes and landforms `4.6`, human activity on rivers `4.7`,
  flooding and river management `4.8`. UK population, economy and settlement `5.1`,
  migration, globalisation and the UK economy `5.2`, the UK city case study `5.3`-`5.6`,
  rural areas and the rural-urban fringe `5.7`-`5.8`. Biomes `7.1`, goods and services,
  Malthus and Boserup `7.2`. Rainforest and taiga structure and adaptations `8.1`-`8.2`,
  threats `8.3`-`8.4`, protection `8.5`-`8.6`. Energy types and impacts `9.1`, access and
  use `9.2`, oil supply and demand `9.3`, new oil and gas sources `9.4`, alternatives and
  technology `9.5`, attitudes and energy efficiency `9.6`.
- Skills parts (a graph to complete, a mean, a range, a percentage, a ratio, a map reading)
  get the key idea of the data they are about.
- Fieldwork (Paper 2 Section C): choose the context from the question's own words (a coastal
  investigation `6.1`, river `6.2`, urban `6.3`, rural `6.4`); a second code only when a part
  is mostly about the content (river flooding `4.8`, coastal management `4.5`, quality of life
  in a city `5.5`).
- Paper 3 Question 4 (one part, set on the whole resource booklet): the key idea of Topics 7-9
  its options are mainly about first (protecting a forest `8.5` or `8.6`, an energy future `9.5`),
  and the other one second.
