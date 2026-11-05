# OCR GCSE Geography B

`ocr_gcse_geography/tag_ocr_gcse_geography.py split` writes batches of OCR GCSE Geography B (J384)
parts to `.work/ocr-gcse-geography/tag/`, and `merge` collects them. The brief is the one at the
top, with these differences:

- `geography-b-topics.txt` lists one topic per line: `code | section | title — the specification's
  words`. The content codes are the specification's enquiry sub-questions (`1.1a Why do we have
  weather extremes?`, `6.2c What development strategy is most appropriate?`); `9.1`-`9.4` are
  Geographical Skills and `F1`-`F6` the six areas fieldwork is assessed on (enquiry questions,
  techniques and methods, processing and presenting, analysing, conclusions, evaluating).
- **Each line says which codes it may take**: `first` (fixed by the topic heading the question is
  printed under, its `area`) and `second`. merge rejects anything else. Give a second code only when
  it adds something.
- Within a topic, tag the content the part tests: in Global Hazards, weather extremes and
  atmospheric circulation `1.1a`, a weather hazard event (UK or non-UK case study) and drought,
  tropical storms as hazards `1.1b`, plate boundaries and plate movement `1.2a`, a tectonic event's
  causes, consequences and responses `1.2b`, prediction and protection technology `1.2c`. Changing
  Climate: evidence (ice cores, sea ice, paintings, temperature records) `2.1a`, natural and human
  causes, the greenhouse effect `2.1b`, its effects and why it is a global issue `2.1c`. Sustaining
  Ecosystems: biomes and their distribution `4.1a`, rainforest biodiversity, adaptations and soils
  `4.2a`, rainforest exploitation and sustainable management `4.2b`, polar climate, flora and fauna
  `4.3a`, polar management `4.3b`.
- A part that is mostly a skill (a graph to complete, reading a map, a mean, median, range or
  percentage) takes its area's content topic first and the skill (`9.1` cartographic, `9.2`
  graphical, `9.3` numerical and statistical, `9.4` enquiry and argument) second.
- Fieldwork questions (area "Physical/Human Geography Fieldwork") take `F1`-`F6` first; a second may
  be the content topic the fieldwork is about or a skill.
- Paper 3 (Geographical Exploration) is synoptic: its `first` is any content topic. Choose the topic
  the part mainly draws on (a development indicator `6.1a`, a city's growth `5.1b`, flooding `1.1b`,
  water or food security `8.1a`/`8.2a`); its 12-mark essay takes the topic its question is about.
