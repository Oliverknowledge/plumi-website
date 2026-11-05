# Edexcel Politics

`edexcel_politics/tag_politics.py split` writes Pearson Edexcel's A-Level (9PL0) and AS (8PL0)
Politics parts to `.work/edexcel-politics/tag/batch-NN.jsonl`, and `merge` collects
`batch-NN.answers.json` (`{"<id>": ["UKP.1"], ...}`, one or two codes, the main one first). The
brief is the one in `tag.md`, with these differences:

- `topics.txt` lists the specification's 28 content areas: `UKP.1` Democracy and participation,
  `UKP.2` Political parties, `UKP.3` Electoral systems, `UKP.4` Voting behaviour and the media;
  `CPI.1` Liberalism, `CPI.2` Conservatism, `CPI.3` Socialism; `UKG.1` The constitution, `UKG.2`
  Parliament, `UKG.3` Prime Minister and executive, `UKG.4` Relations between the branches; `NPI.1`
  Anarchism to `NPI.5` Nationalism; `USA.1`–`USA.6` and `GLO.1`–`GLO.6`.
- **Choose only from the line's `sections`**: AS Paper 1 and A-Level Paper 1's Questions 1–2 are
  UK Politics, Paper 1's Question 3 Core Political Ideas; AS Paper 2 and Paper 2's Questions 1–2 UK
  Government, Paper 2's Questions 3–7 Non-core Political Ideas; Paper 3A USA; Paper 3B Global.
- Read the question, not its source: a source question is tagged by the view it asks about.
- Where the specification puts things: rights, pressure groups, think tanks, lobbyists, turnout,
  the franchise and the democratic deficit are `UKP.1`; party funding, manifestos' parties, minor
  parties and party systems `UKP.2`; electoral systems, safe seats, coalitions and **referendums**
  `UKP.3`; elections' outcomes, class and partisan dealignment, the media and opinion polls `UKP.4`.
  Devolution, the rule of law, statute law and constitutional reform are `UKG.1`; the Lords, the
  Commons, backbenchers and select committees `UKG.2`; the PM, Cabinet, ministerial responsibility
  and the Royal Prerogative `UKG.3`; the Supreme Court, judicial review, executive dominance of
  Parliament, the EU and sovereignty `UKG.4`.
- Paper 3's Section A and B questions compare the USA (or the world) with the UK: the US area
  first, then `USA.6` (comparative theories). Paper 3B's Question 2 (realism and liberalism) is
  `GLO.6`. Polarity, hard and soft power, great and emerging powers and state types are `GLO.4`;
  the UN, NATO, IMF, World Bank, WTO, G7/G20 and poverty `GLO.2`; human rights courts, intervention
  and the environment `GLO.3`.
