# AQA GCSE Design and Technology

`aqa_gcse_dt/tag_dt.py split` writes AQA GCSE Design and Technology (8552/W) questions to
`.work/aqa-gcse-dt/tag/`, and `merge` collects them into `tags.json`. The brief is the one at the
top, with these differences:

- `gcse-dt-topics.txt` lists one topic per line: `code | section | title — what the specification
  says under it`. Codes have three numbers (`3.2.7`), except `3.1.6.1` Material categories and
  `3.1.6.2` Material properties; never a section like `3.2`.
- Multiple-choice questions (01–10) carry their answer as `scheme` ("Answer: C – Kevlar").
- A question usually belongs to the section it's printed in, but a skill goes where the
  specification puts it: a volume or a nesting layout in Section A or B is still `3.3.9`.
- Where things live: technology push and market pull, planned obsolescence, crowd funding, virtual
  marketing, lean working, fashion, faith and inclusive design `3.1.1`; smart materials, composites,
  technical textiles `3.1.3`; naming or classing a material `3.1.6.1`; what a property means, or a
  material's properties `3.1.6.2`; choosing by aesthetics, cost, availability or ethics `3.2.1`;
  deforestation, carbon footprint, pollution, the six Rs `3.2.3`; a chosen material in a chosen
  product, or modifying it `3.2.5`; stock forms, standard components and calculating a quantity
  `3.2.6`; batch, mass, continuous and production rates `3.2.7`; templates, jigs, commercial
  processes and quality control `3.2.8`; analysing a product for the user, ergonomics,
  anthropometrics, focus groups, primary and secondary research, presenting data `3.3.1`; fair trade
  and global warming as challenges to design `3.3.2`; collaboration, user-centred and iterative
  design, design fixation `3.3.4`; every kind of drawing and recording `3.3.5`; prototypes, and
  the innovation or aesthetics of a product `3.3.6`; lengths, areas, volumes, ratios, datums and
  nesting `3.3.9`; using tools safely `3.3.10`; deforming, reforming and preparing for a finish
  in the workshop `3.3.11`.
