# AQA GCSE Geography

`aqa_gcse_geography/tag_gcse_geography.py split` writes batches of AQA GCSE Geography (8035)
parts to `.work/aqa-gcse-geography/tag/`, and `merge` collects them. The brief is the one at
the top, with these differences:

- `gcse-geography-topics.txt` lists one topic per line: `code | section | title — the
  specification's words`. Codes are the specification's numbered topics (`3.1.1.2 Tectonic
  hazards`, `3.2.3.2 Food`); urban issues (`3.2.1.1`-`3.2.1.4`) and the changing economic
  world (`3.2.2.1`-`3.2.2.4`) are its key ideas, fieldwork (`3.3.2.1`-`3.3.2.6`) the six
  stages of an enquiry, and Geographical skills `3.4.1`-`3.4.4`.
- **Each line says which codes it may take**: `first` (the topics of the question it is
  printed in, fixed by paper and number, so the coasts question never takes a rivers topic)
  and `second`. merge rejects anything else. Give a second code only when it adds something.
- Within an area, tag the content the part tests: in Paper 1's Question 1, plate margins,
  earthquake effects and responses `3.1.1.2`; atmospheric circulation, tropical storms and
  UK extreme weather `3.1.1.3`; climate change evidence, causes and management `3.1.1.4`;
  hazard risk in general `3.1.1.1`. Question 2: a small-scale UK ecosystem, food webs, global
  biomes `3.1.2.1`; rainforests and deforestation `3.1.2.2`; hot deserts and desertification
  `3.1.2.3`; cold environments `3.1.2.4`. Physical landscapes: `3.1.3.1` only for the UK's
  relief, upland and lowland areas; everything else in Questions 3-5 is the landscape's own
  topic. Paper 2 Question 1: world urban trends and megacities `3.2.1.1`; the LIC/NEE city
  case study (Rio, Lagos, Mumbai), slums, urban planning for the urban poor `3.2.1.2`; the UK
  city case study, regeneration, the rural-urban fringe `3.2.1.3`; sustainable cities,
  transport `3.2.1.4`. Question 2: measuring development, the DTM, population pyramids,
  causes of uneven development `3.2.2.1`; aid, trade, debt relief, tourism, intermediate
  technology `3.2.2.2`; the LIC/NEE country case study (Nigeria), TNCs `3.2.2.3`; the UK
  economy, deindustrialisation, science parks, the north-south divide, rural change,
  transport infrastructure `3.2.2.4`.
- A part that is mostly a skill (a grid reference, a distance or direction on an OS map, a
  graph or map to complete, a mean, median, range or percentage) takes its area's content
  topic first and the skill second: `3.4.1` maps, OS maps, grid references, distances, cross
  sections; `3.4.2` graphs and charts to read or complete; `3.4.3` percentages, ratios,
  proportions, calculations; `3.4.4` mean, median, mode, range, interquartile range, quartiles.
- Paper 3 Section A (questions 01-03, issue evaluation, set on the pre-release resources
  booklet) is `3.3.1` first, with the content topic the issue is about second (waste
  incineration: `3.2.3.4` Energy; housing and brownfield sites: `3.2.1.3`; an urban world:
  `3.2.1.1`), or a skill when the part is one.
- Paper 3 Section B (questions 04-05) is fieldwork: tag the stage the part asks about, not
  the scenario. `3.3.2.1` the enquiry question or hypothesis, its theory, risks and how to
  reduce them, choosing a site; `3.3.2.2` collecting data, primary and secondary data,
  sampling, describing or justifying a method; `3.3.2.3` presenting data, completing or
  choosing a graph or map; `3.3.2.4` describing, analysing and explaining results, links
  between data sets, statistics, anomalies; `3.3.2.5` conclusions; `3.3.2.6` evaluating
  methods, data or conclusions, and how the enquiry could be improved. A skill can be second.
