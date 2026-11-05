# AQA GCSE Citizenship Studies

`aqa_gcse_citizenship/tag_gcse_citizenship.py split` writes batches of AQA GCSE Citizenship
Studies (8100) parts to `.work/aqa-gcse-citizenship/tag/`, and `merge` collects them. The brief
is the one in `tag.md`, with these differences:

- `gcse-citizenship-topics.txt` lists one topic per line: `code | theme | title — what the
  specification covers there`. Codes have four numbers (`3.4.3.2`); never a theme like `3.4`.
  The four themes are 3.2 Life in modern Britain, 3.3 Rights and responsibilities, 3.4 Politics
  and participation and 3.5 Active citizenship.
- Each line is a part with its `paper`, `marks`, its words (with its source, for a
  source-based part) and the start of its scheme; multiple choice carries its answer
  (`Answer: C and F`).
- Paper 1 Section A (questions 1 and 2) is Active citizenship, Section B (3 to 7) Politics and
  participation; Paper 2 Section A (1 to 5) is Life in modern Britain, Section B (6 to 10)
  Rights and responsibilities. Any code is allowed on either paper: Paper 1's question 1
  draws on all three content themes, and an 8-mark debate often spans two.
- Paper 1's question 2 is the student's own investigation: `3.5.2.1` choosing the issue and
  question, `3.5.2.2` research (primary, secondary, trusting sources), `3.5.2.3` planning,
  `3.5.2.4` taking the action and communicating it, `3.5.2.5` impact and evaluation.
- Each theme's "how citizens make a difference" content is kept once, under 3.5.1: actions
  (petitions, e-petitions, demonstrations, boycotts, direct action, volunteering, lobbying,
  joining a party) `3.5.1.1`; pressure groups, charities and voluntary groups `3.5.1.2`; using
  the media `3.5.1.3`; citizens working together on a community issue `3.5.1.4`. Paper 1's
  8-mark source question on what citizens could do about an issue (fuel poverty, child labour)
  is `3.5.1.1`, or `3.5.1.4` when it is about community groups acting together.
- Where things live: British values, tolerance, rule of law, individual liberty `3.2.1.1`;
  rights and duties, equal opportunities `3.2.1.2`; identity and multiple identities `3.2.1.3`;
  the four nations, national and regional identity `3.2.2.1`; migration and population
  `3.2.2.2`; diversity, multiculturalism, respect `3.2.2.3`; free press, media roles, citizen
  journalists `3.2.3.1`; public interest and privacy `3.2.3.2`; IPSO, IMPRESS, Ofcom,
  censorship `3.2.3.3`; the UN and its agencies, NATO, the EU, the Council of Europe, the
  Commonwealth, the WTO, veto, hard power `3.2.4.1`; Brexit `3.2.4.2`; mediation, sanctions,
  military intervention `3.2.4.3`; NGOs in humanitarian crises `3.2.4.4`; barriers to
  participation `3.2.5.1`. Principles of law, justice, due process `3.3.1.1`; equality law and
  the EHRC, rules versus laws `3.3.1.2`; rights in conflict (privacy, free speech limits)
  `3.3.1.3`; police powers, stop and search, warrants `3.3.2.1`; judges, solicitors,
  barristers, the CPS, Citizens Advice `3.3.2.2`; courts, tribunals, ombudsmen `3.3.2.3`;
  legal ages `3.3.2.4`; civil versus criminal law `3.3.2.5`; Scotland's and Northern Ireland's
  systems `3.3.2.6`; Magna Carta `3.3.3.1`; common law and statute `3.3.3.2`; trade unions,
  strikes, employers' associations `3.3.3.3`; types and causes of crime, reducing crime
  `3.3.3.4`; sentencing, mitigating and aggravating factors `3.3.3.5`; youth courts and youth
  sentences `3.3.3.6`; UDHR, ECHR, UNCRC, Human Rights Act `3.3.4.1`; rules of war, the ICC
  `3.3.4.2`; juries, magistrates, witnesses, special constables, PCCs `3.3.5.1`. Democracy and
  referendums `3.4.1.1`; democratic values `3.4.1.2`; the constitution `3.4.1.3`; councils,
  councillors, mayors `3.4.2.1`; devolution `3.4.2.2`; standing for election `3.4.2.3`; who
  can vote, voting age `3.4.2.4`; turnout, apathy, compulsory voting `3.4.2.5`; tax and
  spending `3.4.2.6`; FPTP, by-elections `3.4.3.1`; AMS, STV, proportional systems `3.4.3.2`;
  Commons, Lords, monarch, legislature `3.4.3.3`; parties `3.4.3.4`; scrutiny `3.4.3.5`; MPs,
  the Speaker, Black Rod `3.4.3.6`; the legislative process, royal assent `3.4.3.7`; the PM and
  cabinet `3.4.3.8`; the civil service and departments `3.4.3.9`; other countries' systems
  (anarchy, theocracy, absolute monarchy, North Korea) `3.4.4.1`; digital democracy and
  engagement `3.4.5.1`.
