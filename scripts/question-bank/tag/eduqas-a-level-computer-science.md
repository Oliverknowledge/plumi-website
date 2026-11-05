# Eduqas A-Level Computer Science

`eduqas/tag_eduqas.py split scripts/question-bank/.work/eduqas-cs` writes batches for Eduqas's A-Level Computer
Science (A500, and AS B500) to `.work/eduqas-cs/tag/`, and `merge` collects them. The brief is the one in `tag.md`,
with these differences:

- `cs-topics.txt` lists one topic per line: `code | component | title [AS] or [A-Level only] — what the specification
  says under it`. Choose from these codes. The specification numbers each component's topics from 1, so the codes are
  the component and the number: `1.3` Algorithms and programs, `2.5` Databases and distributed systems. There's no
  third number. Component 3 is the non-exam project, with no paper and no topics.
- Each line has a `paper` ("A-Level 1: Programming and System Development", "AS 2: Practical Programming to Solve
  Problems"). AS papers use these same A-Level codes and only take [AS] topics; merge drops any other (`1.6` System
  design is the only A-Level one).
- A-Level papers are synoptic: tag what the part tests, whichever component's topic that is.
- `1.1` is data structures themselves, `2.4` is how data is organised on disk (files, hashing for file access,
  indexes, backups of files), and `2.5` is databases, SQL and normalisation. A hash table in memory is `1.1`.
- Writing, tracing or correcting code goes to what the code is for when the part is about that: a bubble sort or a
  binary search is `1.3`, a stack or tree traversal `1.1` with `1.3` only where it's equally about the algorithm, a
  logical mask or Boolean simplification `1.2`. Variables, scope, parameters, recursion, annotation, program layout and
  testing are `1.3`. Paradigms, object-orientation, language levels and Backus-Naur form are `1.4`. Compilers,
  interpreters, assemblers and translation errors are `1.8`, and software tools, IDEs and version management `1.7`.
- `cs-topics.txt` clips each topic at 1,500 characters, which leaves these out, so they're here. `1.3` also has compression,
  shortest-path algorithms, modular programming, traversal of data structures and testing. `2.1` also has networks,
  networking standards, protocols (HTTP, FTP, SMTP, TCP/IP, IMAP, DHCP, UDP, wireless) and handshaking. `2.2` keeps
  serial and parallel transmission, multiplexing, collisions, routing, transfer rates and lowest-cost routes. A part
  asking for a shortest path over a network on a Component 1 paper is `1.3`.
- `1.5` is analysis: waterfall and agile, feasibility, investigation, data flow diagrams, changeover. `1.6` is
  human-computer interaction, natural language interfaces and spoken input (a voice interface's pros and cons too), and
  design review and evaluation. AS parts can't take
  `1.6`: use `1.5` there.
- AS Component 2 asks about a scenario. Tag the skill the part asks for, not the scenario's business: a data structure
  table is `2.4` or `2.5` by what it stores it in, an entity relationship diagram `2.5`, a class diagram `1.4`, a
  flowchart or algorithm `1.3`, a choice of method of solution `1.5`. Its programming task ("Create a new form…") and
  annotating that code ("add annotated listings…") are `1.3`.
