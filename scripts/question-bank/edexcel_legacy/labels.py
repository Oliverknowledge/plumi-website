"""Bounded mark-scheme labels; paragraphs starting with digits are not labels."""
import re

# The shared cutter's repeated, overlapping letter groups backtrack exponentially
# on legacy scheme paragraphs. Optional part and subpart groups are sufficient.
MS_LABEL = re.compile(r"^(?:Qu(?:estion)?\s*|Q\s*)?(\d{1,2})\.?\s*(?:\(?[a-z]{1,2}\)?\s*)?(?:\(?[ivx]{1,4}\)?\s*)?$")
