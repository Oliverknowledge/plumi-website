# AQA Sociology

`aqa_sociology/tag_sociology.py split` writes batches of AQA A-Level (7192) and AS
(7191) Sociology questions to `.work/aqa-sociology/tag/`, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `sociology-topics.txt` lists one topic per line: `code | area | title — the
  specification's bullet point`. The specification doesn't number its bullet points:
  the codes number them in order under their area (`4.2.2.4` is Families and
  Households' fourth, childhood). Choose from these codes, never an area like `4.2.2`;
  `4.1.2` (Methods in context) is the one topic that is its area's only one.
- Each line is a whole question with its `paper`, its `area`, its `marks`, its own
  words, its `item` (the passage it is set on, where it has one) and the start of
  its `scheme`. Judge by what the question asks and what the scheme credits, not by
  the Item's subject.
- **The first code must be in the line's `area`**: the area is the option or section
  the question is printed in (an option question in "4.2.2 Families and Households"
  is always tagged to a Families topic, whatever it touches on). The merge rejects a
  first code from another area. A second code, only when the question genuinely needs
  two topics, must be in the same area, with one exception below.
- **Methods in Context** (area `4.1.2`, A-Level Paper 1 question 05 and AS Paper 1
  question 06, "evaluate the strengths and limitations of using <method> to
  investigate <issue in education>"): first `4.1.2`, then the Theory and Methods topic
  the method turns on, usually `4.1.3.2` (sources of data), or the Education topic
  the issue is, whichever is more useful to a student revising it. Prefer the method.
- **Theory and Methods** (area `4.1.3`: A-Level Paper 1 question 06, Paper 3 questions
  05-06, AS Paper 2 Section A): `4.1.3.1` research design and quantitative/qualitative
  methods; `4.1.3.2` a particular source of data (questionnaires, interviews,
  observation, experiments, documents, official statistics); `4.1.3.3` primary vs
  secondary data; `4.1.3.4` positivism and interpretivism; `4.1.3.5` theoretical,
  practical and ethical factors in choosing a topic or method; `4.1.3.6`
  functionalism, Marxism, feminism, interactionism, structure and action; `4.1.3.7`
  modernity and postmodernity, globalisation in theory; `4.1.3.8` is sociology a
  science; `4.1.3.9` how theory shapes methods; `4.1.3.10` values, objectivity;
  `4.1.3.11` sociology and social policy.
- Common calls: in Education, social class, gender or ethnic differences in
  achievement are `4.1.1.2` even when the cause named is inside school (labelling,
  subcultures), unless the question is about the school process itself ("pupil
  subcultures", "the hidden curriculum": `4.1.1.3`); marketisation, selection,
  academies and globalisation's effect on policy are `4.1.1.4`; Marxist or functionalist
  views of the role of education are `4.1.1.1`. In Crime and Deviance, a theory of why
  crime happens (functionalist, Marxist, labelling, realist) or of social control is
  `4.3.1.1`; patterns by class, gender or ethnicity `4.3.1.2`; globalisation, the
  media, green and state crime `4.3.1.3`; punishment, policing, surveillance, victims
  and prevention `4.3.1.4`.
