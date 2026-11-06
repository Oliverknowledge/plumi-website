# OCR GCSE Design and Technology

`ocr_gcse_dt/tag_ocr_gcse_dt.py split` writes batches of OCR GCSE (9-1) Design and Technology (J310/01) parts
to `.work/ocr-gcse-dt/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with these differences:

- `dt-topics.txt` lists the specification's 24 numbered enquiries, `code | section | title — content`, with
  codes as the specification numbers them (`5.2`). Every code may be used on every part: there is one paper.
- Give one code, the topic the part mainly tests, and a second only when the part plainly tests another too.
- The sections are the paper's themes, not its sections: Section A (questions 1 to 3) is core principles across
  all eight; Section B works from the Insert. Tag by what the part asks and the scheme.
- Questions 5 and 6 are set on "your chosen product" (six to choose from), so the scheme lists answers for all six.
  Tag by the skill asked for: 5(a) properties of a material `5.2`; 5(b) sourcing and processing a raw material
  `5.3`; 5(c)(i) a commercial manufacturing process `7.5`; 5(c)(ii) a step-by-step manufacturing plan `7.5` (or
  `7.2` where it is about workshop techniques and making iterative models, `7.1`); 6 design classics and
  aesthetics `2.1`.
- Calculations (areas, volumes, quantities, costs, percentages, scales) are `8.1` when they are about quantities or
  cost of materials, and the topic of their subject otherwise (a drawing to scale `4.1`).
- Technical principles: structure and reinforcing `6.1`, finishes `6.2`, levers, linkages, cams, gears and pulleys
  `6.3`, electronic systems, inputs, processes, outputs, sensors, microcontrollers `6.4`.
- Smart and modern materials, new and emerging technologies, CAD/CAM and 3D printing as emerging tech: `2.2` or
  `3.1` (impacts) or `7.6` (production). Choose by whether the part asks about design influence (`2.2`), wider
  impacts (`3.1`) or manufacture (`7.6`).
