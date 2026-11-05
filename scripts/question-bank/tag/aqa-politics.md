# AQA Politics

`aqa_politics/tag_politics.py split` writes the AQA A-Level Politics (7152) questions to
`.work/aqa-politics/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with
these differences:

- `politics-topics.txt` lists the specification's 32 topics: `code | section | title — the
  specification's words`. Codes are the specification's own four-part numbers (`3.1.2.2`
  Elections and referendums); choose from these, never a section like `3.1.2`.
- **Choose only from the line's `sections`**: Paper 1 is the UK (`3.1.1` government, `3.1.2`
  politics), Paper 2 the USA (`3.2.1`) and comparative politics (`3.2.2`), Paper 3 the core
  ideologies (`3.3.1`) and the other ideologies (`3.3.2`).
- Each line is a whole question with its `marks`, its own words and the start of its
  scheme's indicative content. Question 04 is set on extracts; tag by what it asks.
- Paper 3 questions name their ideology in a heading after the label ("Socialism"): that
  ideology is the code, alone.
- Paper 2: a question about the USA alone is a `3.2.1` topic. A question comparing the USA
  and the UK (Section A's third question, "structural theory...", and the Section C essays)
  is the matching `3.2.2` topic first (constitutions `3.2.2.1`, executives `3.2.2.2`,
  judiciaries `3.2.2.3`, electoral and party systems `3.2.2.4`, pressure groups `3.2.2.5`,
  civil rights `3.2.2.6`), then the US topic it turns on.
- Paper 1: party funding, ideology and party systems are `3.1.2.3`; electoral systems,
  referendums and voting behaviour `3.1.2.2`; rights, participation and the franchise
  `3.1.2.1`; Brexit and the EU's impact `3.1.2.5`; the Supreme Court and judicial
  independence `3.1.1.4`; the Commons, Lords, backbenchers and select committees `3.1.1.2`.
