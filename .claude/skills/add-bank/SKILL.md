---
name: add-bank
description: Add a new question bank for a UK exam board and subject, or extend or re-cut one, on tryplumi.app. Use when asked to add a subject, board, specification or older series to the question bank, or when a student asks for one.
---

# Add a question bank

Follow `docs/question-bank/add-a-bank.md`. It has the steps, the files to register and the checks.

1. Run `npm run bank:status -- <board> <level> <subject>` first. If the bank is live or has an open PR, say so and stop.
2. Build it from the closest existing bank, then run `npm run bank:check -- <slug> --img <work-dir>/img`.
3. Read the sheets it writes. The check's numbers aren't enough on their own.
4. Finish with one PR listing series, counts, gaps and anything odd. Don't merge it.

A new paper layout or board needs more judgement than a close copy of an existing pipeline, so say which this is in the PR.
