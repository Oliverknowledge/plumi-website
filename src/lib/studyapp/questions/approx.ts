import { symbolsFor } from "./symbols";

/**
 * The bank's examiner's reports and question texts come from the papers' own text, and a stacked fraction or a power reaches it with its layout gone: the
 * report that says "x = 3/2 not 2/3" reads "x = 2 3 instead of x = 3 2". The data has only the flat runs (no numerator or denominator to put back), so what can be done is to say so,
 * on the reports and texts of maths and science subjects that look affected (the picture and the paper's PDF are exact). Audit: scratchpad/qfix/r7-fix/SPECIAL-FIELDS.md.
 */
export const mathsLike = (slug: string) => symbolsFor(slug).script;

/** Two short runs of digits side by side that are not a number written in thousands ("16 500", "14 000"): most likely a fraction that lost its bar ("2 3"). */
const FLAT_FRACTION = /(?<![\d.,£$€/])\d{1,3} \d{1,3}(?!\d|[.,]\d|%)(?<!\b\d{1,3} \d{3})/;

/** Does this text from a maths or science subject look as if a fraction or power lost its layout? */
export const lostLayout = (slug: string, text: string) => mathsLike(slug) && FLAT_FRACTION.test(text);
