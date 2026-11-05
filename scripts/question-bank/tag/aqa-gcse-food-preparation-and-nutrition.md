# AQA GCSE Food Preparation and Nutrition

`aqa_gcse_food/tag_food.py split` writes batches of AQA GCSE Food Preparation and Nutrition
(8585/W) questions to `.work/aqa-gcse-food/tag/`, and `merge` collects them. The brief is the
one in `tag.md`, with these differences:

- `gcse-food-topics.txt` lists one topic per line: `code | area | title — what the
  specification says beside it`. Codes have four numbers (`3.3.2.2`), except British and
  international cuisines `3.5.2` and Sensory evaluation `3.5.3`, which have three; never an
  area like `3.3`.
- Each line is a question or part with its `marks`, the `setup` it is set on (an ingredient
  list, recipe or scenario), its own words and the start of its scheme. Multiple-choice parts
  (01.1–01.20) carry their answer as `scheme` ("Answer: C – Soft cheese").
- Nutrition and food science share names: the nutrient itself (what it does in the body, its
  sources, deficiency, excess, dietary reference values such as "35% of energy from fat") is
  `3.2.1.x`/`3.2.2.x`; what it does in cooking (coagulation, gluten, foams, gelatinisation,
  dextrinisation, caramelisation, shortening, plasticity, aeration by creaming, emulsions) is
  `3.3.2.x`.
- Where things live: Eatwell Guide, 5-a-day, salt and juice limits, planning for life stages
  and dietary groups `3.2.3.1`; BMR, PAL, energy balance `3.2.3.2`; analysing a recipe's or
  menu's nutritional information `3.2.3.3`; obesity, CHD, high blood pressure, osteoporosis,
  anaemia, diabetes, a diet's long-term health effects `3.2.3.4`; reasons for cooking and
  conduction, convection, radiation `3.3.1.1`; choosing cooking methods (dry, water-based,
  fat-based) and keeping vitamins in `3.3.1.2`; enzymic browning and oxidation of fruit and
  vegetables `3.3.2.4`; chemical, mechanical, steam and yeast raising agents, and a bake's
  rising faults `3.3.2.5`; growth conditions for microorganisms and high risk foods `3.4.1.1`;
  spoilage signs and mould growth `3.4.1.2`; cheese, yoghurt, blue cheese moulds and yeast in
  bread production `3.4.1.3`; food poisoning bacteria, symptoms, sources and
  cross-contamination `3.4.1.4`; fridge, freezer and ambient storage, the danger zone, use-by and
  best before `3.4.2.1`; personal hygiene, chopping boards, defrosting, cooking and reheating
  to 75 °C, temperature probes `3.4.2.2`; what influences choice (cost, lifestyle, PAL,
  occasion, seasonality) `3.5.1.1`; religion, ethics (vegetarian, vegan, animal welfare),
  intolerances and allergies `3.5.1.2`; labels (mandatory information, allergens) and marketing
  `3.5.1.3`; organic, free range, intensive farming, sustainable fishing, and the advantages
  and disadvantages of local, seasonal and GM foods `3.6.1.1`; food miles, carbon footprint,
  packaging and food waste `3.6.1.2`; food security and Fairtrade `3.6.1.3`; primary and
  secondary processing (milling, milk heat treatments, jam) `3.6.2.1`; fortification,
  additives and GM technology `3.6.2.2`.
- A question about a dish's faults or its ingredients' functions gets the food science topics
  its answers need (a cake's ingredients: `3.3.2.3` and `3.3.2.1`; a bread dough's: `3.3.2.1`
  and `3.3.2.5`).
