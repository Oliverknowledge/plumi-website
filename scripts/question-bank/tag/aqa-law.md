# AQA Law

`aqa_law/tag_law.py split` writes the AQA A-Level Law (7162) questions to `.work/aqa-law/tag/`,
and `merge` collects them. The brief is the one in `tag.md`, with these differences:

- `law-topics.txt` lists the specification's topics: `code | section | title — what is
  taught`. The specification doesn't number them, so the codes are the section's (`NL` the
  nature of law, `LM` law making, `LS` the legal system, `CR` criminal law, `TO` tort, `CO`
  contract, `HR` human rights) and the topic's place in it: `CR.4` is fatal offences.
- **Choose only from the line's `sections`**: every paper sets the nature of law, law making
  and the legal system, with criminal law (Paper 1), tort (Paper 2), contract (Paper 3A) or
  human rights (Paper 3B).
- Questions 01-05 are multiple choice; the scheme's line is the right answer. Tag the topic
  the right answer turns on.
- Problem questions ("Advise...", "Consider the liability of..."): tag by what the scenario
  raises. A 30-mark question that also asks about the legal system or the nature of law
  ("Assess the ways in which Gary may obtain legal advice", "...the role law plays in
  society") takes the substantive topic first and that topic second.
- The 15-mark essays ("Examine what is meant by 'justice'. Discuss the extent to which the
  rules on anticipatory breach achieve justice") take the substantive topic first and the
  nature-of-law topic (`NL.2`-`NL.5`) second. A question on the section's theory ("the
  principles of correspondence and maximum certainty", "fault in tort") is the section's
  theory topic (`CR.2`, `TO.2`, `CO.2`, `HR.2`).
- Common calls: loss of control and diminished responsibility are `CR.4`; consent and
  self-defence `CR.9`, insanity, automatism and intoxication `CR.8`; causation, mens rea and
  omissions `CR.3`; attempts `CR.7`; magistrates, juries, sentencing and appeals `LS.2`;
  barristers, solicitors, legal executives and judges `LS.3`; legal aid and advice `LS.4`;
  ADR and the civil courts `LS.1`; by-laws and statutory instruments `LM.2`; consideration,
  offer and acceptance `CO.3`; frustration and breach `CO.8`; misrepresentation and
  economic duress `CO.7`; police powers, public order and protest are the Convention article
  they engage: the right to life `HR.7` (Article 2, never `HR.6`, which is the Convention as a
  whole), arrest, detention and stop and search `HR.8` (Article 5), privacy `HR.9` (Article 8), speech
  `HR.10` (Article 10), protest `HR.11` (Article 11).
