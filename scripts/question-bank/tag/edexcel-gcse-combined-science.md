# Edexcel GCSE Combined Science

`edexcel_combined/tag_combined.py split` writes batches for Pearson Edexcel's GCSE Combined
Science (1SC0) to `.work/edexcel-combined/tag/`, one science to a batch, and `merge` collects
them. As "Edexcel GCSE sciences" above, with these differences:

- Codes carry the science: `B6.2` is the second group of Biology Topic 6, `P10.3` the third
  of Physics Topic 10. Choose from the batch's own science (`biology-topics.txt` and so on).
- Each line's `paper` names its science, paper and tier ("Chemistry Paper 2 Higher").
- 1SC0 leaves out the separate sciences' own statements, so some topics a 1BI0, 1CH0 or 1PH0
  question would get aren't here; take the nearest one the question really tests.
- Parts also printed on a separate science's paper of the same sitting have been tagged from
  that bank already (`carried.json`) and aren't in the batches.
