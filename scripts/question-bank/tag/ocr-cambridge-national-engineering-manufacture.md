# OCR Cambridge National Engineering Manufacture

`ocr_cn_engineering/tag_ocr_cn_engineering.py split` writes batches of OCR Cambridge National in
Engineering Manufacture (J823, exam unit R014) parts to `.work/ocr-cn-engineering/tag/`, and `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- `eng-topics.txt` lists one topic per line: `code | section | title — the specification's words`.
  1.2 and 2.3 are their sub-headings (`1.2.1` wasting processes, `2.3.2` polymers); choose those,
  never `1.2` or `2.3`.
- A machine's parts, hazards and safety measures go with its process (a lathe or pillar drill is
  `1.2.1`); a material's forms of supply and applications with its material (`2.3.x`).
- Jigs, fixtures, templates, moulds as aids, CAM and automation are `3.2`; quality control and
  assurance `3.3`; drawing conventions, abbreviations, BS 8888 and tolerances `3.1`.
