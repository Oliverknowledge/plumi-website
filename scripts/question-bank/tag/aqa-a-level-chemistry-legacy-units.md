# AQA A-Level Chemistry, legacy units (2420, 2010–2016)

`aqa_chem_legacy/tag_legacy.py split` writes batches of the old CHEM1, CHEM2, CHEM4 and CHEM5
parts to `.work-chem-legacy/tag/`, and `merge` collects them. They were tagged on 2 November 2026
by Claude subagents with the brief above, against the current specification (7405), with these
differences:

- `chemistry-topics.txt` lists 7405's topics and, under each, its sub-topics with the start of
  what the specification says. Answer with the topic code (`3.2.2`), as above.
- Each line has a `unit` and a `label` ("2(b)(ii)"). The old units mixed content differently
  (CHEM2 had industrial chemistry, CHEM5 had both energetics and transition metals), so tag by
  what the part tests, not by unit.
- These questions were written for the old specification. If what a student needs to score the
  marks is not in 7405 at all, answer `["off", "<a few words why>"]` and the part is left out of
  the bank. Examples: extracting iron, aluminium, copper or tungsten (the blast furnace,
  electrolysis of alumina, scrap iron), recycling metals, deflecting ions in a magnetic-sector
  mass spectrometer (7405 teaches time of flight). But extracting titanium with magnesium is in
  7405 (3.2.2), as are cracking, CFCs and ozone, carbon neutrality and biofuels, IR absorption
  by CO2, methane and water and global warming (3.3.6), and an ion gaining an electron at the
  detector (3.1.1). The first brief also named the detector and the greenhouse effect as off;
  the parts tagged off for those were put back by hand (`tag/overrides.json`). Mark a part off only when its marks depend on the missing content;
  a part that merely mentions an old context but tests on-spec chemistry gets its topic.
