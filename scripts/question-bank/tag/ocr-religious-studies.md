# OCR Religious Studies

`ocr_rs/tag_ocr_rs.py split` writes the OCR A-Level Religious Studies (H573) questions to
`.work/ocr-rs/tag/`, and `merge` collects them. The 136 questions of November 2021 to June 2025
were tagged on 1 November 2026 by reading each question against the specification's content.
The brief is the one in `tag.md`, with these differences:

- `rs-topics.txt` lists the specification's topics: `code | section | title [AS] or [A-Level
  only] — what is taught`. A section is a component (`P` philosophy of religion, `E` religion
  and ethics) or a religion for Developments in religious thought (`C` Christianity, `I` Islam,
  `J` Judaism, `B` Buddhism, `H` Hinduism); the code is the section and the topic's place in it
  (`P5` Religious experience). Choose only from the paper's own section.
- Each line is one 40-mark essay, with its `paper` ("Developments in Islamic thought").
- One code nearly always: a second only where the essay plainly sets two topics against each
  other (utilitarianism applied to sexual ethics is `E9` then `E4`; euthanasia judged by
  situation ethics `E5` then `E2`), the topic the question is about first.
- Placings that aren't obvious from the titles: the Prime Mover and the cave are `P1`; divine
  power and Anselm's four-dimensionalism `P7`; meta-ethics and intuitionism `E7`; whistle-blowing
  `E6`; Rubenstein, Fackenheim and Berkovitz `J11`; Plaskow, Adler and same-sex relationships
  `J10`; the Sunni and Shi'a succession `I2`; maslaha `I10`; 9/11 `I12`; secularism in the
  Muslim world `I11`; the Dalai Lama `B10`; upaya, the paramitas and the arhat and bodhisattva
  paths `B7`; Zen and Pure Land `B9`; Vaishnavism, Shaivism and Shaktism `H1`; the monkey and cat
  analogies `H4`; Neo-Vedanta `H7` with `H8`.
