# AQA Religious Studies

`aqa_rs/tag_rs.py split` writes AQA's A-Level Religious Studies (7062) parts to
`.work/aqa-rs/tag/`, one batch per area a part can be on: `batch-1A.jsonl` (Paper 1
questions 01–02, Philosophy of religion), `batch-1B.jsonl` (Paper 1 questions 03–04,
Ethics and religion) and `batch-A.jsonl` … `batch-E.jsonl` (Paper 2, Buddhism, Christianity,
Hinduism, Islam, Judaism). `merge` collects them, keeping only codes from the batch's own
topics file. The brief is the one in `tag.md`, with these differences:

- `rs-<area>-topics.txt` lists one topic per line: `code | section | title — what the
  specification says under it`. Paper 1's codes are `1A.1` (Arguments for the existence
  of God) to `1B.7` (Bentham and Kant); a religion's are its letter and 1–11 (`B.2` God,
  `D.9` Islam, migration and religious pluralism, `A.10` The dialogue between Buddhism and
  philosophy, `A.11` … and ethics). A Paper 2 batch's file also lists Paper 1's topics.
- Each line is a part: `knowledge` (x.1, "Examine…", 10 marks), `evaluation` (x.2, a
  claim to evaluate, 15 marks) or `dialogue` (Paper 2's 25-mark essays, questions 03–06).
- Paper 1 and Paper 2's two-part questions: one code, the topic the part asks about. A
  theory applied to an issue ("Situation ethics cannot justify blood sports", "Natural
  Moral Law applied to cloning") is the issue's topic (`1B.2` human, `1B.3` animal life
  and death) then `1B.1`; meta-ethical questions on Utilitarianism or Divine Command
  Theory are `1B.4`; reward, punishment and moral responsibility are `1B.5`.
- A dialogue essay always gets two codes: its dialogue (03–04 the religion's `.10`,
  05–06 its `.11`), then the topic it debates, a Paper 1 one where it is one (miracles
  `1A.5`, religious experience `1A.3`, conscience `1B.6`, Bentham or Kant `1B.7`), or
  else the religion's own (sources of authority `.1`, science `.7`, the truth claims of
  other religions `.9`, marriage and sexuality `.6`). So a student revising Miracles finds
  Paper 1's questions and every religion's dialogue essay on it.
- Where the specification puts it, not where it sounds: wealth, materialism and the
  thinkers set against secularisation (Batchelor and Brazier, Roy and Saraswati, Ramadan
  and Ash-Sharabasi) are `.8`; celibacy, marriage, women's ordination and Hampson and
  Ruether are `.6`; war, ahimsa, stewardship and jihad are `.4`; paths of Yoga, puja,
  prayer and worship are `.5`; Maybaum and Rubenstein are `E.9`; concepts of Buddha and
  Anicca are `A.2`.

The 288 parts of November 2020 to June 2025 were tagged on 31 October 2026 by Claude,
following these rules, with the specification's text to hand for each placement.
